// engine.js — Headless Calculation Engine for D&D 5.5e (2024) Character Sheets

/**
 * Safely evaluates a string math formula against a resolved state dictionary.
 * @param {string|number} formula 
 * @param {Object} state 
 * @returns {number}
 */
export function evaluateFormula(formula, state) {
  if (formula === undefined || formula === null) return 0;
  if (typeof formula === 'number') return formula;
  if (typeof formula !== 'string') return Number(formula) || 0;

  // Replace variable placeholders: e.g. "{str.mod}" -> state["str.mod"]
  let replaced = formula.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const val = state[trimmedKey];
    return val !== undefined ? val : 0;
  });

  // Sanitize formula string: allow only numbers, arithmetic operators, parentheses, commas, and a whitelist of Math.* functions.
  const sanitized = replaced.replace(/[^0-9+\-*/().,a-zA-Z\s]/g, '');

  // Whitelist pattern for safe evaluation
  const safePattern = /^(?:[0-9+\-*/().,\s]|Math\.(?:max|min|floor|round|ceil))+$/;
  if (safePattern.test(sanitized.trim())) {
    try {
      return new Function(`return (${sanitized});`)() || 0;
    } catch (e) {
      console.error(`Error evaluating sanitized formula: "${sanitized}" (original: "${formula}")`, e);
      return 0;
    }
  } else {
    // If it contains non-math characters (like dice notation "1d4"), return 0 or parse any leading number
    const numericMatch = sanitized.match(/^[+-]?\d+/);
    if (numericMatch) {
      return parseInt(numericMatch[0]) || 0;
    }
    return 0;
  }
}

/**
 * Calculates the fully resolved state dictionary for a character.
 * @param {Object} character - The character sheet data object
 * @returns {Object} A flat dictionary of resolved stats
 */
export function calculateCharacterState(character) {
  const state = {};

  // 1. Establish basic level and proficiency bonus
  const level = parseInt(character.level) || 1;
  state['char.level'] = level;
  state['prof_bonus'] = Math.floor((level - 1) / 4) + 2;

  // 2. Gather all active modifiers
  const activeModifiers = [];
  const lists = [
    character.equipment || [],
    character.spells || [],
    character.features || [],
    character.options || [],
    character.modifiers || []
  ];

  for (const list of lists) {
    for (const item of list) {
      if (item.active === true) {
        const mods = item.modifiers || [];
        for (const mod of mods) {
          activeModifiers.push(mod);
        }
      }
    }
  }

  /**
   * Helper to filter and apply modifiers for a given target
   * @param {string} target - The targeted variable name (e.g., 'ac')
   * @param {number} baseValue - The baseline value before modifiers
   * @returns {number}
   */
  function resolveTarget(target, baseValue) {
    let val = baseValue;

    // Filter modifiers targeting this variable. Also handle "save.all" for saving throws.
    const targetMods = activeModifiers.filter(mod => {
      if (!mod || !mod.target) return false;
      const t = mod.target.trim();
      if (t === target) return true;
      if (target.startsWith('save.') && t === 'save.all') return true;
      return false;
    });

    // 1. Additive modifiers
    let sumAdd = 0;
    const addMods = targetMods.filter(m => m.type === 'add');
    for (const mod of addMods) {
      sumAdd += evaluateFormula(mod.value, state);
    }
    val += sumAdd;

    // 2. Min/Max modifiers
    const minMods = targetMods.filter(m => m.type === 'min');
    for (const mod of minMods) {
      val = Math.max(val, evaluateFormula(mod.value, state));
    }

    const maxMods = targetMods.filter(m => m.type === 'max');
    for (const mod of maxMods) {
      val = Math.min(val, evaluateFormula(mod.value, state));
    }

    // 3. Set modifiers (last one overrides)
    const setMods = targetMods.filter(m => m.type === 'set');
    if (setMods.length > 0) {
      const lastSet = setMods[setMods.length - 1];
      val = evaluateFormula(lastSet.value, state);
    }

    return val;
  }

  // 3. Resolve Attribute Scores & Modifiers
  const attributes = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const baseStats = character.baseStats || {};
  for (const attr of attributes) {
    const baseScore = parseInt(baseStats[attr]) || 10;
    state[`${attr}.score`] = resolveTarget(`${attr}.score`, baseScore);
    state[`${attr}.mod`] = Math.floor((state[`${attr}.score`] - 10) / 2);
  }

  // 4. Resolve Saving Throws
  const savesProf = character.savesProficiency || {};
  for (const attr of attributes) {
    const profMultiplier = parseInt(savesProf[attr]) || 0;
    const baseSave = state[`${attr}.mod`] + profMultiplier * state['prof_bonus'];
    state[`save.${attr}`] = resolveTarget(`save.${attr}`, baseSave);
  }

  // 5. Resolve Skills
  const skillAttrs = {
    athletics: 'str',
    acrobatics: 'dex',
    sleight_of_hand: 'dex',
    stealth: 'dex',
    arcana: 'int',
    history: 'int',
    investigation: 'int',
    nature: 'int',
    religion: 'int',
    animal_handling: 'wis',
    insight: 'wis',
    medicine: 'wis',
    perception: 'wis',
    survival: 'wis',
    deception: 'cha',
    intimidation: 'cha',
    performance: 'cha',
    persuasion: 'cha'
  };

  const skillsProf = character.skillsProficiency || {};
  const skillsAttrOverride = character.skillsAttributeOverride || {};
  for (const skill of Object.keys(skillAttrs)) {
    const defaultAttr = skillAttrs[skill];
    const overriddenAttr = skillsAttrOverride[skill] || defaultAttr;
    const baseProfMultiplier = parseFloat(skillsProf[skill]) || 0; // 0, 0.5, 1, 2
    const profMultiplier = resolveTarget(`skill.${skill}.prof`, baseProfMultiplier);
    const baseSkillVal = state[`${overriddenAttr}.mod`] + profMultiplier * state['prof_bonus'];
    state[`skill.${skill}`] = resolveTarget(`skill.${skill}`, baseSkillVal);
  }

  // 6. Resolve Passives (dependent on resolved skills)
  const passives = ['perception', 'investigation', 'insight'];
  for (const passive of passives) {
    const basePassive = 10 + state[`skill.${passive}`];
    state[`passive.${passive}`] = resolveTarget(`passive.${passive}`, basePassive);
  }

  // 7. Resolve Derived Combat / Speed Metrics
  const speedBase = parseInt(character.speed) || 30;
  state['speed'] = resolveTarget('speed', speedBase);

  const initBase = state['dex.mod'];
  state['initiative'] = resolveTarget('initiative', initBase);

  const acBase = 10 + state['dex.mod'];
  state['ac'] = resolveTarget('ac', acBase);

  // HP
  const baseHpMax = parseInt(character.baseHpMax) || 10;
  const hpMaxBase = baseHpMax + state['con.mod'] * level;
  state['hp.max'] = resolveTarget('hp.max', hpMaxBase);
  state['hp.current'] = parseInt(character.hp?.current) || 0;
  state['hp.temp'] = parseInt(character.hp?.temp) || 0;

  // Spellcasting metrics
  const spellcastingAbility = (character.spellcastingAbility || 'wis').toLowerCase();
  const spellcastingMod = state[`${spellcastingAbility}.mod`] || 0;
  
  const spellDcBase = 8 + state['prof_bonus'] + spellcastingMod;
  state['spell.dc'] = resolveTarget('spell.dc', spellDcBase);

  const spellAttackBase = state['prof_bonus'] + spellcastingMod;
  state['spell.attack'] = resolveTarget('spell.attack', spellAttackBase);

  // Melee & Ranged attacks
  const meleeAttackBase = state['prof_bonus'] + state['str.mod'];
  state['melee.attack'] = resolveTarget('melee.attack', meleeAttackBase);

  const meleeDamageBase = state['str.mod'];
  state['melee.damage'] = resolveTarget('melee.damage', meleeDamageBase);

  const rangedAttackBase = state['prof_bonus'] + state['dex.mod'];
  state['ranged.attack'] = resolveTarget('ranged.attack', rangedAttackBase);

  const rangedDamageBase = state['dex.mod'];
  state['ranged.damage'] = resolveTarget('ranged.damage', rangedDamageBase);

  return state;
}
