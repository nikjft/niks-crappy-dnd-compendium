# Character Sheet Sub-System

**Parent doc:** [architecture.md](./architecture.md)

The character sheet allows creating, viewing, editing, and leveling up D&D 5e/5.5e characters. All data is stored in the `characters` IndexedDB store. The stat engine is a headless module (`engine.js`) separate from the UI.

---

## Character Data Model

Created by `createNewCharacterTemplate()` (app.js L3511). The full shape:

```js
{
  // Identity
  name: string,               // primary key in IndexedDB
  species: string,
  background: string,
  notes: {
    alignment: string,
    age: string, height: string, weight: string,
    backstory: string, personality: string, ideals: string,
    bonds: string, flaws: string
  },

  // Classes (multiclass support)
  classes: [
    { name: string, level: number, subclass: string|null, hd: number }
  ],
  level: number,              // total level (sum of classes[].level)
  spellcastingAbility: string, // 'int' | 'wis' | 'cha'

  // Base Stats (before any modifiers)
  baseStats: { str, dex, con, int, wis, cha },  // all numbers

  // Proficiencies
  savesProficiency: { str, dex, con, int, wis, cha },  // 0 or 1
  skillsProficiency: {
    athletics, acrobatics, sleight_of_hand, stealth,
    arcana, history, investigation, nature, religion,
    animal_handling, insight, medicine, perception, survival,
    deception, intimidation, performance, persuasion
  },  // 0, 0.5 (half-prof), 1, or 2 (expertise)
  skillsAttributeOverride: {},  // skill → attr override

  // HP
  baseHpMax: number,
  hp: { current: number, temp: number },
  deathSaves: { successes: number, failures: number },
  speed: number,

  // Lists (items on the character sheet)
  spells: [],         // { name, active, favorite, id, listId, ... }
  equipment: [],      // { name, active, favorite, id, listId, ... }
  features: [],       // { name, active, favorite, id, listId, texts[], modifiers[] }
  options: [],        // same structure as features
  modifiers: [],      // direct stat modifiers not tied to a feature

  // Organization
  featureLists: [],   // [{ id, name }] — groups features into sections
  spellLists: [],
  equipmentLists: [],

  // Currency, conditions, notes
  currency: { pp, gp, ep, sp, cp },
  conditions: [],
  exhaustion: number,

  _modified_at: string,  // ISO — set on every save
}
```

---

## Stat Engine (`engine.js`)

`calculateCharacterState(character)` is the single export. It reads the character object and returns a **flat dictionary** of resolved numbers:

```js
const state = calculateCharacterState(char);
// Examples:
state['str.score']      // 18
state['str.mod']        // +4
state['save.str']       // +4 (or +6 with proficiency)
state['skill.athletics'] // +6
state['ac']             // 16
state['hp.max']         // 52
state['spell.dc']       // 15
state['prof_bonus']     // +3
state['speed']          // 30
```

### How modifiers are applied

1. For each item in `character.equipment`, `character.spells`, `character.features`, `character.options`, and `character.modifiers` where `item.active === true`:
   - `getEntityModifiers(item, type)` collects modifier objects from `item.modifiers[]` and from `feature-modifiers.js` lookup.
2. `resolveTarget(target, baseValue)` applies all matching modifiers in order: `add` first, then `min`/`max` clamps, then `set` overrides.

### Modifier object shape

```js
{
  target: string,   // e.g. 'str.score', 'ac', 'speed', 'spell.dc', 'save.all'
  type: 'add' | 'min' | 'max' | 'set',
  value: number | string,  // numbers or formula strings like "2 * {char.level}"
}
```

Formula strings support `{variable}` placeholders resolved against the partial `state` object. Safe eval via `evaluateFormula()` (whitelist pattern, no `eval`).

### `feature-modifiers.js` lookup

A static dictionary keyed by `"FeatureName|Source"` or `"FeatureName|ClassName|Source"` or `"FeatureName|ClassName|Source|Level"`. Used to hardcode modifiers for well-known feats and class features that cannot be inferred from text (e.g. *Tough*, *Alert*, *Fast Movement*, *Primal Champion*).

To add a new programmatic modifier, add an entry to this file — no changes to the engine needed.

---

## Character Roster (`renderCharactersRoster` — app.js L3564)

Rendered when `currentCategory === 'characters'`. Shows a card grid of all characters. Each card has:
- Name, class, level
- Quick stats (AC, HP, Speed)
- "Open Sheet" and "Delete" buttons

---

## Character Sheet View (`openCharacterSheet` — app.js L3668)

Opens a full-screen overlay modal (`.character-sheet-overlay`) on top of the compendium. Contains:

- **Header bar** — character name, level/class, HP tracker, death saves, initiative.
- **Stats tab** — ability scores, saves, skills, passive scores.
- **Combat tab** — AC, speed, HP controls, attack rolls, spell DC/attack.
- **Features tab** — feature list with active toggles, organized by `featureLists`.
- **Equipment tab** — equipped/unequipped items, currency.
- **Spells tab** — spell list organized by `spellLists`.
- **Notes tab** — backstory, personality, ideals, bonds, flaws, conditions.

Whenever any toggle or stat changes, the sheet calls `saveCharacter(currentCharacter)` then re-renders the affected section. `saveCharacter` calls `saveRecord('characters', char)` in `db.js` and triggers `scheduleDebouncedSync()`.

---

## Character Creator Modal (`showCharacterCreatorModal` — app.js L3665)

A simpler quick-create form (legacy path). Lets users set name, class, background, species, base stats manually. Less guided than the Wizard.

---

## Character Creation Wizard (`openWizard` — app.js L3963)

A 5-step modal wizard. Renders into `#cs-wizard-modal`.

### Steps

| Step | Function | Purpose |
|------|----------|---------|
| 1 | `renderWizardStep1(body)` | Basic info: name, alignment, age, height, weight, stat method (roll/point-buy/standard) |
| 2 | `renderWizardStep2(body)` | Species selection — list + detail pane with 🧬 Species Grants box |
| 3 | `renderWizardStep3(body)` | Background selection — list + detail pane with 🎒 Background Grants box, ASI sliders, skill checkboxes |
| 4 | `renderWizardStep4(body)` | Class selection — list + detail pane with ⚔️ Class Grants box, HP input, skill choices, Level 1 feature checkboxes |
| 5 | `renderWizardStep5(body)` | Review — final summary of all choices before character creation |

### Wizard State (`wizardState`)

```js
wizardState = {
  step: number,            // 1-5
  basics: {
    name, alignment, age, height, weight,
    stats: { str, dex, con, int, wis, cha },
    statMethod: 'manual' | 'standard' | 'pointbuy'
  },
  species: object | null,          // full race record
  background: object | null,       // full background record
  classRecord: object | null,      // full class record
  classHpGain: number,
  classFeaturesChosen: string[],
  classSkills: string[],
  backgroundStats: { str, dex, con, int, wis, cha },  // ASI adjustments
  backgroundSkills: string[],
  backgroundLanguages: string[],
  speciesSkills: string[],
  speciesLanguages: string[],
}
```

`applyWizardResult()` (app.js L4872) converts `wizardState` into a new character using `createNewCharacterTemplate()`, then builds `features`, `featureLists`, and `modifiers` from species traits, background, and class Level 1 features.

---

## Level-Up Flow

### Entry Point

"Level Up" button on the character sheet calls `openLevelUpModal(char)` (app.js L5144) which renders `#cs-levelup-modal`.

### Steps

| Step | Function | Purpose |
|------|----------|---------|
| `choose_class` | `renderLevelUpChooseClass(body)` | Choose which class to advance (or multiclass into a new one) |
| `level_details` | `renderLevelUpDetails(body)` | HP gain input, subclass picker (at L3), ASI controls (if ASI level), feature checklist |

### `renderLevelUpDetails` (app.js L5239)

1. Looks up `classRecord.autolevels` for features at the target level.
2. Also loads `subclassRecord.autolevels` if a subclass is already chosen.
3. Detects if `targetLevel === 3` and no subclass → shows subclass picker.
4. Detects if any feature name contains "Ability Score Improvement" or "Feat" → shows ASI stat grid.
5. Renders each feature with its `texts[]` description inline (no modal required to read it).

### Apply Level-Up (`applyLevelUp` — app.js L5502)

1. Increments `char.classes[n].level` (or pushes a new class entry for multiclass).
2. Updates `char.level` (sum of all class levels).
3. Adds chosen features from `levelUpState.chosenFeatures` to `char.features[]`.
4. Applies `levelUpState.statIncreases` ASI to `char.baseStats`.
5. Adds subclass to `char.classes[n].subclass` if chosen.
6. Adds `levelUpState.hpRoll` to `char.baseHpMax`.
7. Saves and re-renders the character sheet.

---

## Picker Mode (Compendium → Sheet Integration)

When the character sheet is open, sidebar items can be clicked to "add to sheet":

- `pickerActive = true` enables picker mode.
- `pickerTargetListId` specifies which list on the sheet receives the picked item.
- Clicking a compendium item calls `addPickedItemToCharacter(item)`.
- "Back to Sheet" button in the sidebar exits picker mode.

This allows browsing spells/equipment/features in the compendium and adding them directly to the open character.
