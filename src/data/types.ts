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
  /** Numeric bonus added to the damage roll (ability mod + magic). 0 if none. */
  damageBonus: number;
  /** True when this weapon is equipped in the off-hand slot */
  isOffhand?: boolean;
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

export interface LevelHistoryCounterDelta {
  id: string;
  oldMax: number;
  oldValue: number;
}

/**
 * Records everything needed to display the history and reverse ("level down")
 * a single level-up event.
 */
export interface LevelHistoryEntry {
  /** Unique ID for this history entry */
  id: string;
  timestamp: string;
  /** Name of the class that was leveled (or added as multiclass) */
  className: string;
  /** Level before this event (0 = new multiclass addition) */
  fromLevel: number;
  /** Level after this event */
  toLevel: number;
  hpGain: number;
  /** IDs of CharacterFeatures added in this event (for revert removal) */
  addedFeatureIds: string[];
  /** IDs of counters created in this event */
  addedCounterIds: string[];
  /** Counters whose max/value were modified (for revert restoration) */
  modifiedCounters: LevelHistoryCounterDelta[];
  /** IDs of FeatureLists created (e.g. new multiclass list) */
  addedFeatureListIds: string[];
  /** IDs of SpellLists created */
  addedSpellListIds: string[];
  /** Stat point deltas applied (ASI) — keyed by stat name */
  statIncreases: Record<string, number>;
  /** True if this event added a brand-new multiclass entry */
  isMulticlass: boolean;
  /** Subclass name chosen at this level (if any) */
  addedSubclassName: string | null;
  /** Feature names displayed in history (human-readable) */
  featureNames: string[];
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

/** A spell as it lives on a character (extends compendium fields with character state) */
export interface CharacterSpell {
  name: string;
  source?: string;
  level: number;
  school?: string;
  time?: string;
  range?: string;
  components?: string;
  duration?: string;
  texts?: string[];
  ritual?: boolean;
  isConcentration?: boolean;
  /** Spell is "active" — concentration in effect, buff running */
  active?: boolean;
  /** Spell is "prepared" (selected) */
  selected?: boolean;
  listId?: string;
  compendiumId?: string;
  rolls?: string[];
  modifiers?: unknown[];
  [key: string]: unknown;
}

/** A named spell list on a character (one per class/subclass that grants spellcasting) */
export interface SpellList {
  id: string;
  name: string;
  spellcastingAbility?: string;
}

/** A named feature list on a character (Species, Background, Class, Subclass, Feats, etc.) */
export interface FeatureList {
  id: string;
  name: string;
}

/** A feature/trait/feat as it lives on a character */
export interface CharacterFeature {
  id?: string;
  name: string;
  category?: string;
  texts?: string[];
  active?: boolean;
  selected?: boolean;
  compendiumId?: string;
  listId?: string;
  isDynamic?: boolean;
  isOverview?: boolean;
  classData?: unknown;
  [key: string]: unknown;
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
  equipment?: EquipmentItem[];
  spells?: CharacterSpell[];
  spellLists?: SpellList[];
  features?: CharacterFeature[];
  options?: unknown[];
  modifiers?: unknown[];
  counters?: unknown[];
  featureLists?: FeatureList[];
  bestiaryLists?: unknown[];
  itemLists?: { id: string; name: string; }[];

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
  currency?: { pp?: number; gp?: number; ep?: number; sp?: number; cp?: number; };

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

  // Spell slots: { [level: 1..9]: { current, max } }
  spellSlots?: Record<number, { current: number; max: number }>;
  // Pact Magic slots (Warlock only, separate from standard slots)
  pactSlots?: { current: number; max: number; level: number };

  // Sync
  _modified_at?: string;
  classes?: CharacterClass[];
  notes?: Record<string, unknown>;
}

export interface CharacterClass {
  name: string;
  level: number;
  subclass?: string | null;
  hd?: number;
  spellAbility?: string | null;
  spellListId?: string | null;
  featureListId?: string | null;
}

// ─── Compendium record (base shape) ──────────────────────────────────────────

export interface CompendiumRecord {
  id?: string;
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
  listId?: string;
  /**
   * For weapons only: which hand slot the weapon is equipped in.
   * 'main' = main hand, 'off' = off-hand.
   * Non-weapons and unequipped weapons leave this undefined.
   */
  equippedSlot?: 'main' | 'off';
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
