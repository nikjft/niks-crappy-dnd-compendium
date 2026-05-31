# Product Specification: D&D 5.5e PWA Character Sheet

## 1. Overview & Core Philosophy

The objective is to introduce a fully functional, mobile-optimized
Character Sheet as a native component of the existing D&D Compendium
PWA. It is not a separate app, but a fully integrated feature set that
leverages the Compendium's database while maintaining independent state
for individual players.

**Core Tenets:**

- **Digital Paper, Not a VTT:** This tool tracks state but does not play
  the game for the user. No dice rollers. No strict rule enforcement.

- **Trust the Player:** Avoid hardcoding edge cases or policing rule
  limits (like spell preparation counts). If a player wants to add an
  arbitrary +2 to their AC, the system allows it via generic, modular
  features.

- **Data Flexibility:** Shift from a rigid, legacy XML structure to a
  highly flexible calculation engine that fully supports the 2024 (5.5e)
  ruleset. Character data is fully decoupled from the Compendium after
  creation, ensuring players can edit anything.

## 2. Data Model Enhancements

To support the 2024 rules and "Bonuses Everywhere," the underlying data
model requires the following functional expansions.

### 2.1 The Universal `Modifier` Object

Instead of hardcoding specific fields, **any** entity on the character
sheet (Items, Backgrounds, Feats, Spells, Classes, Custom Entries) can
contain an array of `modifiers`.

    {
      "modifiers": [
        {
          "target": "ac", 
          "type": "set", 
          "value": "17" 
        },
        {
          "target": "hp.max",
          "type": "add",
          "value": "2 * {char.level}"
        }
      ]
    }

**Modifier Types:**

- `add`: Adds a numeric value to the target.

- `set`: Overrides the target with a static value.

- `max` / `min`: Caps or floors a value.

- `ignore`: Ignores a specific variable in a calculation.

### 2.2 Updating to 2024 (5.5e) Rules

- **Attribute Bonuses:** Divorced from `Race` (Species). `Background`
  entities now hold the `modifiers` granting `+2/+1` or `+1/+1/+1` to
  attributes.

- The character builder UI will look for attribute modifiers in the
  Background selection step rather than the Race selection step.

### 2.3 Subclass Inheritance

Subclasses operate via an inheritance model to reduce duplication.

- A `Class` has an array of `autolevels` (features gained at specific
  levels).

- A `Subclass` also has an array of `autolevels`.

- When a Subclass is selected, its `autolevels` are merged into the
  parent Class's progression.

- **Optional Features:** Autolevel objects can flag `"optional": true`.
  The UI will present these as toggles.

### 2.4 Comprehensive State Dictionary Variables

The data model explicitly recognizes and calculates the following
standard D&D keys to be targeted by the engine:

- **Core Attributes:** `str`, `dex`, `con`, `int`, `wis`, `cha` (Both
  Base Score and calculated Modifier: e.g., `{str.score}`, `{str.mod}`).

- **Universal:** `{char.level}`, `{prof_bonus}`.

- **Saving Throws:** `save.str`, `save.dex`, `save.con`, `save.int`,
  `save.wis`, `save.cha`. Support for integer multipliers for
  proficiency (0 = none, 1 = proficient).

- **Skills (and Default Attributes):**

  - *Strength:* `skill.athletics`

  - *Dexterity:* `skill.acrobatics`, `skill.sleight_of_hand`,
    `skill.stealth`

  - *Intelligence:* `skill.arcana`, `skill.history`,
    `skill.investigation`, `skill.nature`, `skill.religion`

  - *Wisdom:* `skill.animal_handling`, `skill.insight`,
    `skill.medicine`, `skill.perception`, `skill.survival`

  - *Charisma:* `skill.deception`, `skill.intimidation`,
    `skill.performance`, `skill.persuasion`

  - *Skill Modifiers support states:* `0` (None), `0.5`
    (Half-Proficiency/Jack of All Trades), `1` (Proficient), `2`
    (Expertise).

- **Derived Stats:**

  - `ac` (Armor Class: Base 10 + `{dex.mod}` + Armor modifiers).

  - `initiative` (Base `{dex.mod}`).

  - `speed` (Base set by Species).

  - `passive.perception` (10 + `{skill.perception}`).

  - `passive.investigation` (10 + `{skill.investigation}`).

  - `passive.insight` (10 + `{skill.insight}`).

- **Combat Metrics:** `{hp.max}`, `{hp.current}`, `{hp.temp}`,
  `{spell.dc}`, `{spell.attack}`, `{melee.attack}`, `{melee.damage}`,
  `{ranged.attack}`, `{ranged.damage}`.

## 3. Core Mechanics

### 3.1 The Calculation Engine

A lightweight string-parsing engine is required to resolve formulas
dynamically against the State Dictionary.

- **Resolution Order:**

  1.  Base Attribute scores are established.

  2.  Universal variables (proficiency, level) are calculated.

  3.  Default derived calculations occur (Skills mapped to attributes,
      AC baseline, Initiative).

  4.  `add` modifiers are evaluated and summed across all *Active* list
      items.

  5.  `max`/`min` modifiers clip the results.

  6.  `set` modifiers override everything else.

### 3.2 The "Lists" Architecture

Lists are the core structural paradigm of the character sheet, replacing
rigid data structures.

**List Types:** `Spells`, `Equipment`, `Features/Traits`, `Options`,
`Bestiary`, `Modifiers`.

**List Properties & Customization (CRITICAL):**

- **Inline Editing & Creation:** Users can add custom content directly
  into *any* list within the UI. A player can create a custom spell,
  weapon, or feature directly on their sheet. These custom entities live
  exclusively on the character.

- **Item States:**

  1.  **Favorite:** Acts as a character-level bookmark. Highly visible.

  2.  **Selected:** The item is in the current "Loadout" (e.g., Prepared
      spells, Carried inventory).

  3.  **Active:** The item is currently equipped, attuned, or active.
      *Only items in the 'Active' state apply their `modifiers` to the
      Calculation Engine.*

### 3.3 Data Detachment & Compendium Sync

- **Copy, Don't Reference:** When a user adds an item, spell, class, or
  feature from the Compendium, the data is **deep-copied** onto the
  character sheet.

- **Player Freedom:** Because the data is copied, the player can edit
  the text, damage, or modifiers of *any* standard item without
  affecting the global Compendium.

- **Sync Button:** Every entity added from the Compendium retains its
  original Compendium ID. The UI provides a "Sync with Compendium"
  button on the item card. Pressing this overwrites the local copy with
  the latest data from the Compendium database.

### 3.4 State Management & Rests

- **Counters:** Generic integer counters that the user can
  increase/decrease (e.g., Ki Points, Superiority Dice, Rations, Hit
  Dice).

- **Rest Resets:**

  - Entities with counters have reset flags: `reset_short`,
    `reset_long`.

  - Selecting "Short Rest" resets applicable counters and allows manual
    HP adjustment.

  - Selecting "Long Rest" resets all counters, restores HP to
    `{hp.max}`, and resets Hit Dice (all Hit Dice on a Long Rest in 2024
    rules).

## 4. App Integration & UI/UX Layout

The Character Sheet is nested within the main Compendium app,
transitioning from a global app view to an individual character focus.

### 4.1 Entry Point: Main Navigation

- **Sidebar Navigation:** A new `Characters` link is added to the main
  Compendium sidebar/drawer.

- **Character Roster:** Clicking `Characters` opens a gallery view
  listing all the user's saved characters (displaying portrait, name,
  class, level, and quick-actions like delete/duplicate).

- **Full View Transition:** Clicking a specific character card hides the
  global Compendium layout and occupies the full view with that specific
  Character Sheet.

### 4.2 Individual Sheet Layout (Mobile-Optimized)

Once in the Full View, the layout uses a bottom tab navigation (or side
menu on wider desktop screens) to easily flip between logical groupings.

**Global Header (Persistent)**

- Back Button (returns to Character Roster).

- Character Name, Portrait Thumbnail.

- HP Tracker: Current / Max / Temp. Large +/- buttons for quick
  adjustment.

- Inspiration / Heroic Advantage Toggle.

**Tab 1: Combat & Main**

- **Top Row:** Armor Class (tappable to see calculation breakdown),
  Initiative, Speed, Proficiency Bonus.

- **Death Saves:** 3 Success, 3 Failure checkboxes (resets on
  healing/rest).

- **Attacks/Actions (Active List):** Shows Weapons and Spells currently
  marked as "Active".

- **Custom Modifiers List:** A dedicated area for arbitrary bonuses.

  - Behaves like any other list. Users can create a named entry (e.g.,
    "Bless", "Paladin Aura", "Stance").

  - Provides quick-entry dropdowns for common targets: AC, Hit Points,
    Temp Hit Points, Attributes, Spell Attack, Spell DC, Weapon Attack,
    Weapon Damage, Saving Throws.

  - Also allows custom calculation entry for advanced use cases.

**Tab 2: Stats & Skills**

- **Attributes:** Grid of 6 stats (STR, DEX, CON, INT, WIS, CHA). Large
  modifier, smaller base score.

- **Passives:** Display for Passive Perception, Passive Investigation,
  Passive Insight.

- **Saving Throws:** List below attributes.

- **Skills:** Alphabetical list of all 18 standard skills with their
  governing attribute visually indicated. Toggles for Proficiency (None,
  Half, Proficient, Expertise).

**Tab 3: Features & Traits**

- Displays the background, species, class, and subclass.

- Uses the **Lists** mechanic to group active features.

- Users can inline-add custom feats or traits directly here. Sync
  buttons are visible for Compendium-sourced features.

**Tab 4: Inventory**

- Currency tracker (CP, SP, EP, GP, PP).

- **Equipment Lists:** "Equipped" (Active), "Carried" (Selected), and
  "Stored".

- Inline creation of custom loot and gear.

- Carrying Capacity calculator (Sum of active/selected item weights.
  Optional visual warning if exceeding `{str.score} * 15`).

**Tab 5: Spells**

- **Spell Slots:** Simple counter interface for tracking slots per
  level.

- **Spell Lists:** Grouped by Level.

- Items display preparation status (Selected) and active buffs (Active).

- *Note on Rules:* The app does not manage or calculate the number of
  prepared spells allowed. Users toggle "Selected" as they see fit with
  no UI warnings.

**Tab 6: Bestiary & Companions**

- A List for managing summoned creatures, familiars, pets, mounts, and
  shapeshifted forms (e.g., Druid Wild Shape).

- Treated purely as a list for tracking names, HP, abilities, and notes.
  No hardcoded engine integration; players rely on custom text.

**Tab 7: Profile / Notes**

- Basic Info, Backstory, Alignments, Age, Height, Weight, Allies,
  Enemies, and Session Notes.

## 5. Interaction Mapping & Edge Cases

1.  **Adding an Item from Compendium:**

    - User taps "+ Add Item" -&gt; Searches Compendium -&gt; Selects
      item.

    - Item data is **copied** into the Character's local state.

    - The user can immediately edit the item's local name, description,
      or modifiers.

    - User taps "Sync" later if they want to revert or update to the
      latest Compendium data.

2.  **Adding a Custom Modifier:**

    - User opens the "Modifiers" list and clicks "+ Add Modifier".

    - User enters "Shield of Faith", selects "Armor Class" from the
      quick-entry dropdown, and inputs "+2".

    - User toggles it to "Active". The Calculation Engine detects the
      new modifier, recalculates the State Dictionary, and updates the
      UI.

3.  **Spell Preparation:**

    - User taps to mark spells as "Selected" (Prepared). The system
      allows infinite selections, trusting the player to manage their
      own class limits.

4.  **Skill Customization:**

    - Player can tap a skill to override its default governing attribute
      (e.g., swapping Intimidation from CHA to STR) for a specific roll
      or state.

## 6. Implementation Phasing

- **Phase 1:** Data model schema updates (copy-based architecture,
  explicit state dictionary) & Calculation Engine logic.

- **Phase 2:** Base UI scaffolding (Sidebar integration, Roster View) &
  Global Header (HP, Inspiration).

- **Phase 3:** Tab implementation (Stats, Skills, Passives, Death
  Saves).

- **Phase 4:** The Universal "Lists" integration (Inventory, Spells,
  Bestiary, Modifiers) with inline editing and Compendium sync hooking.

- **Phase 5:** Rest mechanics, Counters, and Custom Formulas.