/**
 * src/engine/engine.ts
 *
 * TypeScript re-implementation of the headless stat calculator.
 * Returns a CharacterState where every value carries its calculation trace
 * (a Breakdown), enabling the "tap any number → see its formula" UX.
 *
 * The legacy engine.js is kept intact and unchanged during the migration.
 * New Preact components use this module; app.js still calls engine.js.
 */

import type {
  Character,
  CharacterState,
  Breakdown,
  BreakdownPart,
  Modifier,
  EquipmentItem,
  WeaponAttack,
} from '../data/types.js';

// ─── Feature modifier lookup (reuse existing static table) ───────────────────
// @ts-ignore — legacy JS module, typed at use site
import _FEATURE_MODIFIERS from '../../feature-modifiers.js';
const FEATURE_MODIFIERS = _FEATURE_MODIFIERS as Record<string, Modifier[]>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bd(total: number, baseLabel: string, baseValue: number, parts: BreakdownPart[] = []): Breakdown {
  return { total, base: { label: baseLabel, value: baseValue }, parts };
}

function bdFlat(value: number, label: string): Breakdown {
  return bd(value, label, value);
}

/** Safely evaluate a formula string against the current state. */
function evalFormula(formula: number | string | undefined, state: Record<string, number>): number {
  if (formula === undefined || formula === null) return 0;
  if (typeof formula === 'number') return formula;
  if (typeof formula !== 'string') return Number(formula) || 0;

  const replaced = formula.replace(/\{([^}]+)\}/g, (_m, key: string) => {
    const v = state[key.trim()];
    return v !== undefined ? String(v) : '0';
  });

  const sanitized = replaced.replace(/[^0-9+\-*/().,a-zA-Z\s]/g, '');
  const safePattern = /^(?:[0-9+\-*/().,\s]|Math\.(?:max|min|floor|round|ceil))+$/;
  if (!safePattern.test(sanitized.trim())) {
    const m = sanitized.match(/^[+-]?\d+/);
    return m ? parseInt(m[0]) : 0;
  }
  try {
    // eslint-disable-next-line no-new-func
    return (new Function(`return (${sanitized});`))() || 0;
  } catch {
    return 0;
  }
}

// ─── Target key normalization ─────────────────────────────────────────────────

/**
 * Map UI-facing modifier target names to canonical engine state keys.
 * Bare attribute names ('str', 'wis', etc.) are aliases for '<attr>.score'.
 * Legacy underscore keys ('hp_max', 'passive_perception') map to their dot form.
 */
const BARE_ATTRS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);

function normalizeTarget(t: string): string {
  const s = t.trim();
  if (BARE_ATTRS.has(s)) return `${s}.score`;
  if (s === 'hp_max') return 'hp.max';
  if (s === 'passive_perception') return 'passive.perception';
  if (s === 'passive_investigation') return 'passive.investigation';
  if (s === 'passive_insight') return 'passive.insight';
  return s;
}

// ─── Modifier collection ──────────────────────────────────────────────────────

type EntityType = 'equipment' | 'item' | 'feature' | 'features' | 'feats' | 'spells' | 'options' | 'modifiers';

function getEntityModifiers(entity: Record<string, unknown>, type: EntityType): (Modifier & { sourceLabel: string })[] {
  const mods: (Modifier & { sourceLabel: string })[] = [];
  const label = (entity.name as string) || 'Unknown';

  // 1. Explicit user-defined modifiers
  if (Array.isArray(entity.modifiers)) {
    for (const m of entity.modifiers as Modifier[]) {
      mods.push({ ...m, sourceLabel: label });
    }
  }

  // 2. 5etools item bonus fields
  if (type === 'equipment' || type === 'item') {
    if (entity.bonusAc) mods.push({ target: 'ac', type: 'add', value: parseInt(entity.bonusAc as string) || 0, sourceLabel: label });
    if (entity.bonusSavingThrow) mods.push({ target: 'save.all', type: 'add', value: parseInt(entity.bonusSavingThrow as string) || 0, sourceLabel: label });
    if (entity.bonusSpellAttack) mods.push({ target: 'spell.attack', type: 'add', value: parseInt(entity.bonusSpellAttack as string) || 0, sourceLabel: label });
    if (entity.bonusSpellSaveDc) mods.push({ target: 'spell.dc', type: 'add', value: parseInt(entity.bonusSpellSaveDc as string) || 0, sourceLabel: label });
    if (entity.bonusWeapon) {
      const v = parseInt(entity.bonusWeapon as string) || 0;
      mods.push({ target: 'melee.attack', type: 'add', value: v, sourceLabel: label });
      mods.push({ target: 'melee.damage', type: 'add', value: v, sourceLabel: label });
      mods.push({ target: 'ranged.attack', type: 'add', value: v, sourceLabel: label });
      mods.push({ target: 'ranged.damage', type: 'add', value: v, sourceLabel: label });
    }
    if (entity.ability && typeof entity.ability === 'object' && (entity.ability as Record<string, unknown>).static) {
      for (const [attr, val] of Object.entries((entity.ability as Record<string, unknown>).static as Record<string, unknown>)) {
        mods.push({ target: `${attr}.score`, type: 'set', value: parseInt(String(val)) || 10, sourceLabel: label });
      }
    }
  }

  // 3. Feature modifier lookup table
  if (type === 'feature' || type === 'features' || type === 'feats') {
    const source = (entity.source as string) || '';
    const className = (entity.className as string) || '';
    let match: Modifier[] | undefined;

    if (className) {
      const levelSuffix = entity.level ? `|${entity.level}` : '';
      match = FEATURE_MODIFIERS[`${entity.name}|${className}|${source}${levelSuffix}`]
        ?? FEATURE_MODIFIERS[`${entity.name}|${className}|${source}`]
        ?? FEATURE_MODIFIERS[`${entity.name}|${source}`];
    } else {
      match = FEATURE_MODIFIERS[`${entity.name}|${source}`];
    }

    if (match) {
      for (const m of match) {
        mods.push({ ...m, sourceLabel: label });
      }
    }
  }

  return mods;
}

// ─── Armor AC helpers ─────────────────────────────────────────────────────────

/**
 * Determine the AC value contributed by equipped armor items.
 * Returns null if no armor is equipped (use 10 + DEX unarmored base).
 */
function resolveArmorAC(
  equippedItems: EquipmentItem[],
  dexMod: number
): { value: number; parts: BreakdownPart[] } | null {
  // Find the first equipped piece of body armor
  const armor = equippedItems.find(
    (item) => item.armor && !item.shield && item.ac != null
  );
  const shield = equippedItems.find((item) => item.shield);

  if (!armor) return null;

  const baseAC = armor.ac!;
  const parts: BreakdownPart[] = [{ label: armor.name ?? 'Armor', value: baseAC, op: 'set' }];
  let total = baseAC;

  const armorType = armor.armorType ?? (armor.rawType as 'LA' | 'MA' | 'HA' | 'S' | undefined);

  if (armorType === 'LA') {
    total += dexMod;
    parts.push({ label: 'DEX', value: dexMod, op: 'add' });
  } else if (armorType === 'MA') {
    const cappedDex = Math.min(dexMod, 2);
    total += cappedDex;
    parts.push({ label: 'DEX (max +2)', value: cappedDex, op: 'add' });
  }
  // HA: no DEX contribution

  if (shield) {
    total += 2;
    parts.push({ label: shield.name ?? 'Shield', value: 2, op: 'add' });
  }

  return { value: total, parts };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function calculateCharacterState(character: Character): CharacterState {
  const S: CharacterState = {};
  // Parallel flat dict for formula evaluation (engine needs numbers, not Breakdowns)
  const flat: Record<string, number> = {};

  function set(key: string, breakdown: Breakdown): void {
    S[key] = breakdown;
    flat[key] = breakdown.total;
  }

  // ── 1. Level & proficiency bonus ────────────────────────────────────────────
  const level = parseInt(String(character.level)) || 1;
  const profBonus = Math.floor((level - 1) / 4) + 2;
  set('char.level', bdFlat(level, 'Level'));
  set('prof_bonus', bdFlat(profBonus, 'Proficiency Bonus'));

  // ── 2. Collect active modifiers with source labels ───────────────────────────
  type LabelledMod = Modifier & { sourceLabel: string };
  const activeMods: LabelledMod[] = [];

  const groups: { list: unknown[]; type: EntityType }[] = [
    { list: (character.equipment ?? []) as unknown[], type: 'equipment' },
    { list: (character.spells ?? []) as unknown[], type: 'spells' },
    { list: (character.features ?? []) as unknown[], type: 'feature' },
    { list: (character.options ?? []) as unknown[], type: 'options' },
    { list: (character.modifiers ?? []) as unknown[], type: 'modifiers' },
  ];

  for (const { list, type } of groups) {
    for (const item of list as Record<string, unknown>[]) {
      if (item.active === true) {
        activeMods.push(...getEntityModifiers(item, type));
      }
    }
  }

  /**
   * Apply modifiers to a base value and build a Breakdown.
   * @param target - state key (e.g. 'ac', 'save.str')
   * @param baseValue - value before modifiers
   * @param baseLabel - human-readable label for the base
   */
  function resolve(target: string, baseValue: number, baseLabel: string): Breakdown {
    const normTarget = normalizeTarget(target);
    const relevant = activeMods.filter((m) => {
      const t = normalizeTarget(m.target);
      return t === normTarget || (normTarget.startsWith('save.') && t === 'save.all');
    });

    const parts: BreakdownPart[] = [];
    let val = baseValue;

    // Add
    for (const m of relevant.filter((m) => m.type === 'add')) {
      const v = evalFormula(m.value, flat);
      parts.push({ label: m.sourceLabel, value: v, op: 'add' });
      val += v;
    }

    // Min / Max
    for (const m of relevant.filter((m) => m.type === 'min')) {
      const v = evalFormula(m.value, flat);
      const clamped = Math.max(val, v);
      if (clamped !== val) parts.push({ label: m.sourceLabel, value: v, op: 'min' });
      val = clamped;
    }
    for (const m of relevant.filter((m) => m.type === 'max')) {
      const v = evalFormula(m.value, flat);
      const clamped = Math.min(val, v);
      if (clamped !== val) parts.push({ label: m.sourceLabel, value: v, op: 'max' });
      val = clamped;
    }

    // Set (last one wins)
    const setMods = relevant.filter((m) => m.type === 'set');
    if (setMods.length > 0) {
      const last = setMods[setMods.length - 1];
      const v = evalFormula(last.value, flat);
      // Record the set operation, replacing the accumulated value
      parts.push({ label: last.sourceLabel, value: v, op: 'set' });
      val = v;
    }

    return { total: val, base: { label: baseLabel, value: baseValue }, parts };
  }

  // ── 3. Attribute scores & modifiers ──────────────────────────────────────────
  const attrs = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
  const baseStats = character.baseStats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  for (const attr of attrs) {
    const base = parseInt(String(baseStats[attr])) || 10;
    const scoreBreakdown = resolve(`${attr}.score`, base, `Base ${attr.toUpperCase()}`);
    set(`${attr}.score`, scoreBreakdown);

    const rawMod = Math.floor((scoreBreakdown.total - 10) / 2);
    // Run mod through resolve() so modifiers targeting e.g. 'str.mod' or 'wis.mod' apply
    const modBreakdown = resolve(`${attr}.mod`, rawMod, `${attr.toUpperCase()} Modifier`);
    set(`${attr}.mod`, modBreakdown);
  }

  // ── 4. Saving throws ─────────────────────────────────────────────────────────
  const savesProf = (character.savesProficiency ?? {}) as Record<string, number>;
  for (const attr of attrs) {
    const mult = parseFloat(String(savesProf[attr])) || 0;
    const modVal = flat[`${attr}.mod`];
    const base = modVal + mult * profBonus;
    const baseLabel = mult > 0
      ? `${attr.toUpperCase()} Mod (+${modVal}) + Prof ×${mult} (+${mult * profBonus})`
      : `${attr.toUpperCase()} Mod`;
    set(`save.${attr}`, resolve(`save.${attr}`, base, baseLabel));
  }

  // ── 5. Skills ─────────────────────────────────────────────────────────────────
  const SKILL_ATTRS: Record<string, string> = {
    athletics: 'str',
    acrobatics: 'dex', sleight_of_hand: 'dex', stealth: 'dex',
    arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
    animal_handling: 'wis', insight: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
    deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha',
  };

  const skillsProf = (character.skillsProficiency ?? {}) as Record<string, number>;
  const skillOverrides = (character.skillsAttributeOverride ?? {}) as Record<string, string>;

  // Jack of All Trades: Bard lvl ≥ 2 grants half-proficiency to non-proficient skills.
  // Detect from class list OR from a feature named "Jack of All Trades".
  const classes = (character.classes ?? []) as Array<{ name: string; level: number }>;
  const features = (character.features ?? []) as Array<{ name?: string }>;
  const hasJoaT =
    classes.some(c => c.name.toLowerCase() === 'bard' && c.level >= 2) ||
    features.some(f => f.name?.toLowerCase().includes('jack of all trades'));

  for (const [skill, defaultAttr] of Object.entries(SKILL_ATTRS)) {
    const attr = skillOverrides[skill] ?? defaultAttr;
    const rawMult = parseFloat(String(skillsProf[skill])) || 0;
    // Apply JoaT: floor(prof/2) for any skill with no proficiency
    const mult = hasJoaT && rawMult === 0 ? 0.5 : rawMult;
    const attrMod = flat[`${attr}.mod`];
    const base = attrMod + Math.floor(mult * profBonus);
    const profLabel = mult === 2 ? 'Expertise' : mult === 0.5 ? (rawMult === 0 ? 'Half Prof (JoaT)' : 'Half Prof') : mult > 0 ? 'Prof' : '';
    const baseLabel = profLabel
      ? `${attr.toUpperCase()} Mod + ${profLabel} (+${Math.floor(mult * profBonus)})`
      : `${attr.toUpperCase()} Mod`;
    set(`skill.${skill}`, resolve(`skill.${skill}`, base, baseLabel));
  }

  // ── 6. Passives ───────────────────────────────────────────────────────────────
  for (const p of ['perception', 'investigation', 'insight'] as const) {
    const base = 10 + flat[`skill.${p}`];
    set(`passive.${p}`, resolve(`passive.${p}`, base, `10 + ${p} skill`));
  }

  // ── 7. Combat stats ───────────────────────────────────────────────────────────
  set('speed', resolve('speed', parseInt(String(character.speed)) || 30, 'Base Speed'));
  set('initiative', resolve('initiative', flat['dex.mod'], 'DEX Modifier'));

  // AC — detect equipped armor, otherwise unarmored (10 + DEX)
  const equipped = ((character.equipment ?? []) as EquipmentItem[]).filter((e) => e.active);
  const dexMod = flat['dex.mod'];
  const armorResult = resolveArmorAC(equipped, dexMod);

  let acBreakdown: Breakdown;
  if (armorResult) {
    // Armored base — additional AC modifiers (e.g. Ring of Protection) still apply via resolve()
    // We build a synthetic breakdown then layer modifiers on top
    const baseAC = armorResult.value;
    const withMods = resolve('ac', baseAC, 'Armor');
    // Replace parts to include armor detail before generic modifier parts
    acBreakdown = {
      total: withMods.total,
      base: { label: armorResult.parts[0].label, value: armorResult.parts[0].value },
      parts: [...armorResult.parts.slice(1), ...withMods.parts],
    };
  } else {
    acBreakdown = resolve('ac', 10 + dexMod, 'Unarmored (10 + DEX)');
  }
  set('ac', acBreakdown);

  // HP
  const baseHpMax = parseInt(String(character.baseHpMax)) || 10;
  const hpMaxBase = baseHpMax + flat['con.mod'] * level;
  set('hp.max', resolve('hp.max', hpMaxBase, `Base HP + CON×${level}`));
  set('hp.current', bdFlat(parseInt(String(character.hp?.current)) || 0, 'Current HP'));
  set('hp.temp', bdFlat(parseInt(String(character.hp?.temp)) || 0, 'Temp HP'));

  // Spellcasting
  const castAbility = ((character.spellcastingAbility ?? 'wis') as string).toLowerCase();
  const castMod = flat[`${castAbility}.mod`] ?? 0;
  set('spell.dc', resolve('spell.dc', 8 + profBonus + castMod, `8 + Prof + ${castAbility.toUpperCase()} Mod`));
  set('spell.attack', resolve('spell.attack', profBonus + castMod, `Prof + ${castAbility.toUpperCase()} Mod`));

  // ── 8. Generic melee / ranged attack totals (non-weapon-specific) ─────────────
  set('melee.attack', resolve('melee.attack', profBonus + flat['str.mod'], 'Prof + STR Mod'));
  set('melee.damage', resolve('melee.damage', flat['str.mod'], 'STR Mod'));
  set('ranged.attack', resolve('ranged.attack', profBonus + flat['dex.mod'], 'Prof + DEX Mod'));
  set('ranged.damage', resolve('ranged.damage', flat['dex.mod'], 'DEX Mod'));

  // ── 9. Tool proficiencies ─────────────────────────────────────────────────────
  const tools = (character.toolProficiencies ?? []) as Array<{ name: string; attr: string; profLevel: number }>;
  for (const tool of tools) {
    const attr = (tool.attr ?? 'int').toLowerCase();
    const mult = parseFloat(String(tool.profLevel)) || 0;
    const attrMod = flat[`${attr}.mod`] ?? 0;
    const base = attrMod + mult * profBonus;
    const key = `tool.${tool.name.toLowerCase().replace(/\s+/g, '_')}`;
    set(key, resolve(key, base, `${attr.toUpperCase()} Mod + Prof ×${mult}`));
  }

  return S;
}

// ─── Per-weapon attack row calculation ────────────────────────────────────────

/**
 * Derive the attack bonus breakdown for a single equipped weapon.
 * Handles finesse weapons (use the higher of STR/DEX).
 *
 * @param opts.isOffhand  - True when this weapon is in the off-hand slot
 * @param opts.hasTWF     - True when the character has Two-Weapon Fighting style active
 */
export function calcWeaponAttack(
  item: EquipmentItem,
  state: CharacterState,
  opts: { isOffhand?: boolean; hasTWF?: boolean } = {},
): WeaponAttack {
  const { isOffhand = false, hasTWF = false } = opts;
  const flat: Record<string, number> = Object.fromEntries(
    Object.entries(state).map(([k, v]) => [k, v.total])
  );

  const profBonus = flat['prof_bonus'] ?? 2;
  const strMod = flat['str.mod'] ?? 0;
  const dexMod = flat['dex.mod'] ?? 0;

  // Determine governing ability
  const props = item.properties ?? (item.property ? item.property.split(', ') : []);
  const isFinesse = props.includes('F') || props.includes('Finesse');
  const isRanged = item.rawType === 'R' || (item.weapon && !item.rawType?.startsWith('M'));

  // Magic bonus from bonusWeapon field
  const magicBonus = parseInt(String(item.bonusWeapon ?? '0')) || 0;

  const makeParts = (atkMod: number, attrLabel: string): BreakdownPart[] => {
    const parts: BreakdownPart[] = [
      { label: `Prof`, value: profBonus, op: 'add' },
      { label: `${attrLabel} Mod`, value: atkMod, op: 'add' },
    ];
    if (magicBonus) parts.push({ label: `Magic (+${magicBonus})`, value: magicBonus, op: 'add' });
    return parts;
  };

  // Determine primary ability.
  // Finesse: use the higher of STR/DEX (best stat wins automatically).
  // Ranged:  DEX.
  // Melee:   STR.
  let primaryAttr: string;
  let primaryMod: number;

  if (isFinesse) {
    if (strMod >= dexMod) {
      primaryAttr = 'STR'; primaryMod = strMod;
    } else {
      primaryAttr = 'DEX'; primaryMod = dexMod;
    }
  } else if (isRanged) {
    primaryAttr = 'DEX'; primaryMod = dexMod;
  } else {
    primaryAttr = 'STR'; primaryMod = strMod;
  }

  const primaryTotal = profBonus + primaryMod + magicBonus;
  const atkBonus: WeaponAttack['atkBonus'] = {
    total: primaryTotal,
    base: { label: `Prof + ${primaryAttr} Mod`, value: profBonus + primaryMod },
    parts: makeParts(primaryMod, primaryAttr),
  };

  let atkBonusAlt: WeaponAttack['atkBonusAlt'] = undefined;
  if (isFinesse && strMod !== dexMod) {
    const altAttr = primaryAttr === 'STR' ? 'DEX' : 'STR';
    const altMod = altAttr === 'STR' ? strMod : dexMod;
    atkBonusAlt = {
      total: profBonus + altMod + magicBonus,
      base: { label: `Prof + ${altAttr} Mod`, value: profBonus + altMod },
      parts: makeParts(altMod, altAttr),
    };
  }

  // Damage bonus: ability modifier + magic bonus.
  // Off-hand without Two-Weapon Fighting: only add the ability modifier if negative.
  const rawDamageAbilityMod = primaryMod;
  const damageAbilityMod = (isOffhand && !hasTWF)
    ? Math.min(rawDamageAbilityMod, 0)
    : rawDamageAbilityMod;
  const damageBonus = damageAbilityMod + magicBonus;

  return {
    id: item.name ?? 'weapon',
    name: item.name ?? 'Weapon',
    atkBonus,
    atkBonusAlt,
    damageFormula: item.dmg1 ?? '',
    damageType: item.dmgType ?? '',
    properties: props,
    damageBonus,
    isOffhand: isOffhand || undefined,
  };
}
