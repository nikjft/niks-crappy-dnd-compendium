// ─── Modifier types ──────────────────────────────────────────────────────────

export type ModifierOp = 'add' | 'set' | 'min' | 'max';

export interface Modifier {
  target: string;
  type: ModifierOp;
  value: number | string;
}

// ─── Engine breakdown types ───────────────────────────────────────────────────

export interface BreakdownPart {
  label: string;
  value: number;
  op: ModifierOp;
}

export interface Breakdown {
  total: number;
  base: { label: string; value: number };
  parts: BreakdownPart[];
}

/** Full character state: every derived value plus its calculation trace. */
export type CharacterState = Record<string, Breakdown>;

// ─── Per-weapon attack row (derived by engine from equipped weapons) ──────────

export interface WeaponAttack {
  id: string;
  name: string;
  /** Primary attack bonus (STR or DEX based on weapon type/finesse) */
  atkBonus: Breakdown;
  /** Alternate finesse attack bonus when weapon is finesse and DEX != STR */
  atkBonusAlt?: Breakdown;
  damageFormula: string;
  damageType: string;
  properties: string[];
}

// ─── Tool proficiency ─────────────────────────────────────────────────────────

export interface ToolProficiency {
  name: string;
  /** Governing ability abbreviation, e.g. "dex" */
  attr: string;
  /** 0 = none, 0.5 = half, 1 = proficient, 2 = expertise */
  profLevel: number;
}

// ─── Condition ────────────────────────────────────────────────────────────────

export interface CharacterCondition {
  name: string;
  effects?: string;
  isConcentration?: boolean;
  spellName?: string;
}

// ─── Level history entry ──────────────────────────────────────────────────────

export interface LevelHistoryEntry {
  level: number;
  className: string;
  choices: Record<string, unknown>;
}

// ─── Pinned action reference ─────────────────────────────────────────────────

export interface PinnedAction {
  sourceList: 'equipment' | 'spells' | 'features' | 'counters';
  sourceId: string;
}

// ─── Character data model ─────────────────────────────────────────────────────

export interface BaseStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterHp {
  current: number;
  temp: number;
}

export interface DeathSaves {
  successes: number;
  failures: number;
}

/** Minimal shape every character object must satisfy. Optional fields default via migrateCharacter(). */
export interface Character {
  id?: string;
  name: string;
  level: number;
  baseStats: BaseStats;

  // HP
  baseHpMax: number;
  hp?: CharacterHp;
  deathSaves?: DeathSaves;

  // Combat
  speed: number;
  savesProficiency: Record<string, number>;
  skillsProficiency: Record<string, number>;
  skillsAttributeOverride?: Record<string, string>;
  spellcastingAbility?: string;
  inspiration?: boolean;

  // Lists
  equipment?: unknown[];
  spells?: unknown[];
  spellLists?: unknown[];
  features?: unknown[];
  options?: unknown[];
  modifiers?: unknown[];
  counters?: unknown[];
  featureLists?: unknown[];
  bestiaryList?: unknown[];

  // Phase 1 additions
  conditions?: CharacterCondition[];
  pinnedActions?: PinnedAction[];
  attunementMax?: number;
  toolProficiencies?: ToolProficiency[];
  weightTrackingEnabled?: boolean;
  collapsedLists?: Record<string, boolean>;
  levelHistory?: LevelHistoryEntry[];
  languages?: string[];
  otherProficiencies?: string[];

  // Profile
  background?: string;
  race?: string;
  alignment?: string;
  age?: string;
  height?: string;
  weight?: string;
  appearance?: string;
  backstory?: string;
  traits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  allies?: string;
  sessionNotes?: string;

  // Sync
  _modified_at?: string;
  classes?: unknown[];
}

// ─── Compendium record (base shape) ──────────────────────────────────────────

export interface CompendiumRecord {
  name: string;
  source: string;
  type?: string;
  texts?: string[];
  [key: string]: unknown;
}

// ─── Equipment item (subset of CompendiumRecord) ─────────────────────────────

export interface EquipmentItem extends CompendiumRecord {
  active?: boolean;
  selected?: boolean;
  quantity?: number;
  /** Parsed armor type: LA = light, MA = medium, HA = heavy, S = shield */
  armorType?: 'LA' | 'MA' | 'HA' | 'S';
  /** Base AC value for armor (e.g. 13 for studded leather) */
  ac?: number | null;
  /** Whether the armor imposes stealth disadvantage */
  stealth?: boolean;
  /** Weapon properties as structured array (e.g. ['F', 'L', 'T']) */
  properties?: string[];
  /** Legacy display string (keep for UI compat) */
  property?: string;
  armor?: boolean;
  weapon?: boolean;
  shield?: boolean;
  rawType?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  bonusAc?: string;
  bonusWeapon?: string;
  modifiers?: Modifier[];
  requiresAttunement?: boolean;
  weight?: number;
}

// ─── Spell item ───────────────────────────────────────────────────────────────

export interface SpellRecord extends CompendiumRecord {
  level: number;
  school: string;
  ritual?: boolean;
  isConcentration?: boolean;
  active?: boolean;
  selected?: boolean;
  time?: string;
  range?: string;
  components?: string;
  duration?: string;
}
