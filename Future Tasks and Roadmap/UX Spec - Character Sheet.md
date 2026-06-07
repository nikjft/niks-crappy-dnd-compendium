# Character Sheet UX Specification

> **Audience:** Human editor + vibe-coding agent.
> **Scope:** Functional UX only — no color/font/aesthetic directives. All layout is structural.
> **Starting point:** Current codebase (`app.js` monolith, `engine.js` stat calculator, `db.js` IndexedDB layer, `parser-5etools.js`).
> **Data source:** 5etools JSON via existing parser pipeline.

---

## 0. Design Philosophy

### 0.1 Core Tenets (unchanged from existing spec)

1. **Digital Paper, Not a VTT.** Track state; don't play the game. No dice rollers.
2. **Trust the Player.** No rule enforcement. No "you can't prepare that many spells" warnings. Expert players know the rules.
3. **Calculation Transparency.** Inspired by the pen-and-paper sheet: show *why* a number is what it is. Every derived value should be tappable/expandable to reveal its formula (e.g., `AC = 14 (Armor) + 2 (DEX) + 2 (Shield) = 18`). This is the single most important UX distinction from D&D Beyond.
4. **Speed at the Table.** The #1 use case is mid-combat. Every action the player does most frequently (track HP, check a save, toggle a buff, look up an attack) must be reachable in ≤ 2 taps from the default view.
5. **Lists Are Everything.** The universal container. Spells, equipment, features, modifiers, companions — all are lists with the same underlying behavior. Once users learn the list interaction model, they can operate any part of the sheet.

### 0.2 Key Departures from the Existing Spec

| Area | Previous Spec | This Spec |
|------|--------------|-----------|
| Tab count | 7 tabs | 5 tabs (merge Notes into Profile; merge Options into Features) |
| Combat focus | Attacks section in Combat tab | Dedicated "Quick Actions" panel that surfaces the 3–6 things a player uses most, user-configurable |
| Calculation transparency | Not specified | First-class: every derived number has an expandable breakdown |
| Compendium reference | Separate from sheet | Integrated lookup: tap any spell/item/monster name on the sheet to view its compendium entry inline |
| Homebrew | "Custom entries" mentioned | Full homebrew workflow: create, edit, template, import/export |
| Conditions/Buffs | Listed in Notes | First-class toggle bar on Combat tab with mechanical effects |
| Rest actions | Short/Long rest buttons | Rest wizard with checklist of what resets |

---

## 1. Information Architecture

### 1.1 Navigation Hierarchy

```
App Shell
├── Sidebar (always visible on desktop, hamburger on mobile)
│   ├── Compendium categories (existing)
│   ├── ─── separator ───
│   └── Characters (roster view)
│
└── When a character is opened:
    └── Character Sheet Overlay (full-screen, replaces compendium)
        ├── Persistent Header (always visible)
        ├── Tab Bar (bottom on mobile, sidebar on desktop)
        │   ├── ⚔️ Combat (default)
        │   ├── 📊 Stats & Skills
        │   ├── 📜 Features
        │   ├── 🎒 Inventory
        │   └── ✨ Spells
        └── Slide-out panels (on demand):
            ├── 🐾 Bestiary (companions/summons)
            ├── 📝 Profile & Notes
            └── ⚙️ Sheet Settings
```

### 1.2 Tab Rationale

**Five core tabs** covers 99% of gameplay. Bestiary and Profile are slide-out panels because:
- Bestiary is empty for most characters. It shouldn't occupy a permanent tab.
- Profile/Notes is written once, referenced rarely. It's a setup concern, not a gameplay concern.

---

## 2. Persistent Header

The header is **always visible** on every tab. It is the cockpit for mid-combat play.

### 2.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [← Back]   CHARACTER NAME          Lvl 12 Fighter / Rogue 3    │
│─────────────────────────────────────────────────────────────────-│
│  HP: [−] ████████████░░░░ 67/94  [+]   TMP: 8   │ ☠️ 2/3  1/3 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐                   │
│  │AC 21│ │+7   │ │30ft │ │+5   │ │⭐ Insp. │                   │
│  │     │ │Init │ │Speed│ │Prof │ │         │                   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Header Element Behaviors

| Element | Tap | Long-press / Expand |
|---------|-----|-------------------|
| **HP bar** | Opens HP adjustment modal: number pad with +/− toggle, Heal / Damage / Set buttons | — |
| **HP `−` / `+` buttons** | Decrease/increase HP by 1 | Hold to auto-repeat |
| **TMP (Temp HP)** | Tap to set temp HP value (number input) | — |
| **Death Saves** | Tap success/failure circles to toggle. Only visible when HP = 0 | Auto-resets when HP > 0 |
| **AC** | Shows calculation breakdown popup: `10 (base) + 2 (DEX) + 5 (Plate) + 2 (Shield) + 2 (Cloak of Protection) = 21` | — |
| **Initiative** | Shows breakdown: `DEX (+2) + Alert (+5) = +7` | — |
| **Speed** | Shows breakdown: `30 (base) + 10 (Fast Movement) = 40` | — |
| **Prof Bonus** | Shows: `Level 12 → +5` | — |
| **Inspiration** | Toggle on/off (Heroic Advantage in 2024 rules) | — |
| **Character Name** | Opens Profile & Notes slide-out | — |
| **Level/Class** | Opens level-up flow if tapped; shows multiclass breakdown | — |

### 2.3 Conditions Bar (below header, only when active)

When one or more conditions are active, a horizontal scrolling chip bar appears:

```
│ [🔴 Poisoned ×] [🟡 Frightened ×] [🔵 Concentrating: Haste ×]  [+] │
```

- Each chip is tappable to view the condition's mechanical effects.
- `×` removes the condition.
- `[+]` opens a picker with all standard conditions + a "Custom" option.
- **Concentration** is a special condition. When applied, it shows the spell name. When toggling a new concentration spell to Active, prompt: "Drop concentration on Haste?"
- Conditions with mechanical effects (e.g., Poisoned → disadvantage on attacks/ability checks) should display a reminder when relevant stat is viewed, but **do not modify calculations** — trust the player.

---

## 3. Tab 1: Combat (Default View)

The combat tab is the "dashboard." It is the screen the player looks at during their turn.

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                     QUICK ACTIONS (user-pinned)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Longsword    │ │ Eldritch     │ │ Second       │            │
│  │ +9 / 1d8+5 S│ │ Blast        │ │ Wind         │            │
│  │ [Atk Detail] │ │ +8 / 1d10 Fc│ │ 1d10+5 HP    │            │
│  └──────────────┘ └──────────────┘ │ ●●●○○ (3/5)  │            │
│                                     └──────────────┘            │
│──────────────────────────────────────────────────────────────────│
│                        ATTACKS                                   │
│  Weapon          ATK    DAMAGE     TYPE   PROPERTIES             │
│  Longsword ★     +9     1d8+5      S     Versatile (1d10)       │
│  Hand Crossbow   +9     1d6+5      P     Ammunition, Light      │
│  Unarmed Strike  +9     6          B     —                      │
│──────────────────────────────────────────────────────────────────│
│                   ACTIVE MODIFIERS                               │
│  [✓] Shield of Faith    AC +2                          [×]      │
│  [✓] Rage               Melee Dmg +3, Resistance       [×]      │
│  [ ] Haste              +2 AC, Double Speed, Extra Atk  [×]      │
│  [+ Add Modifier]                                                │
│──────────────────────────────────────────────────────────────────│
│                      COUNTERS                                    │
│  Superiority Dice   ●●●●○○ (4/6)  d10         [−] [+] [↻]     │
│  Action Surge       ●○ (1/2)                   [−] [+] [↻]     │
│  Second Wind        ●○ (1/2)      1d10+12 HP   [−] [+] [↻]     │
│  Ki Points          ●●●●●●●○○○ (7/10)         [−] [+] [↻]     │
│──────────────────────────────────────────────────────────────────│
│              CLASS PROGRESSION STATS (read-only)                 │
│  Sneak Attack: 3d6    Psi Die: d8    Martial Arts: 1d6          │
│──────────────────────────────────────────────────────────────────│
│  [☀️ Short Rest]                         [🌙 Long Rest]         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Quick Actions Panel

**Purpose:** The 3–6 most-used combat actions, pinned by the player.

**Behavior:**
- User configures which items appear here via a "Pin to Quick Actions" toggle on any attack, spell, feature, or counter.
- Each card shows: Name, key numbers (attack bonus, damage, uses remaining).
- Tapping a Quick Action card opens its full detail inline (spell description, weapon properties, etc.).
- If the item has a counter, the card shows remaining uses and a use button.
- **Default:** On character creation, auto-pin the first weapon and any class features with counters at level 1.

**Implementation note:** Quick Actions is a `pinnedActions` array on the character object. Each entry stores `{ sourceList, sourceId, type }`. The rendering pulls live data from the corresponding list item.

### 3.3 Attacks Section

**Derived from equipment list.** Any equipment item with weapon properties (damage dice, attack type) that is in the **Active** state appears here.

**Columns:**
- **Name** — weapon name. ★ if favorited.
- **ATK** — calculated attack bonus: `PROF + ATTR_MOD + MAGIC + OTHER`. Tappable for breakdown.
- **DAMAGE** — dice + modifier. Tappable for breakdown.
- **TYPE** — damage type abbreviation (S/P/B/Fc/Rd/etc.).
- **PROPERTIES** — Light, Heavy, Finesse, Thrown, etc.

**Attack bonus calculation transparency** (shown on tap):
```
+9 = Prof (+5) + STR Mod (+3) + Magic (+1)
     Finesse: Using DEX (+4) instead → +10
```

**Weapons not in Active state** show in a collapsed "Other Weapons" section below.

### 3.4 Active Modifiers

This is the **Modifiers list** filtered to show only those currently relevant. It replaces the idea of a separate "Modifiers tab."

- Each row has: checkbox (active toggle), name, effect summary, remove button.
- `[+ Add Modifier]` opens a quick-add modal with:
  - Name field
  - Target dropdown (AC, Attack, Damage, Saves, Speed, HP, Spell DC, Spell Attack, Ability Score, Skill, Custom)
  - Type dropdown (Add, Set, Min, Max)
  - Value field (number or formula)
  - Short rest / Long rest reset checkboxes
- **Pre-populated suggestions** when typing name: common buffs (Bless, Shield of Faith, Bardic Inspiration, Rage, Haste, etc.) with pre-filled targets and values.

### 3.5 Counters Section

**Already implemented** via `character.counters[]` and dynamic counters from `classTableGroups`. This section continues to work as-is with the following UX additions:

- **[↻] Reset button** per counter — resets to max.
- **Visual:** Filled/empty circles for small counts (≤ 10). Numeric display for larger counts.
- Counters grouped by source: "Fighter", "Monk", "Custom".
- **Add Custom Counter** button at bottom.

### 3.6 Rest Actions

**Short Rest button** opens a checklist modal:
```
☀️ Short Rest
─────────────
The following will reset:
  [✓] Action Surge (1/2 → 2/2)
  [✓] Second Wind (0/2 → 2/2)
  [✓] Superiority Dice (2/6 → 6/6)
  [ ] Hit Dice: Spend __ HD to heal (optional)

HP adjustment: [___] (manual entry for HD healing)

[Cancel]                              [Apply Short Rest]
```

**Long Rest button** opens a similar modal:
```
🌙 Long Rest
─────────────
The following will reset:
  [✓] HP restored to max (67 → 94)
  [✓] All Short Rest counters (listed)
  [✓] All Long Rest counters (listed)
  [✓] Hit Dice: Regain all HD (2024 rules)
  [✓] Spell Slots: All restored

Active conditions to clear:
  [✓] Exhaustion (reduce by 1)

[Cancel]                              [Apply Long Rest]
```

**Implementation note:** `reset_short` and `reset_long` flags on counters already exist. The rest modal reads these flags and presents the checklist. User can uncheck items they don't want to reset (edge cases, house rules).

---

## 4. Tab 2: Stats & Skills

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                       ABILITY SCORES                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                           │
│  │   16    │ │   18    │ │   14    │                           │
│  │  STR    │ │  DEX    │ │  CON    │                           │
│  │  (+3)   │ │  (+4)   │ │  (+2)   │                           │
│  │ Save +6 │ │ Save +4 │ │ Save +5 │                           │
│  └─────────┘ └─────────┘ └─────────┘                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                           │
│  │   12    │ │   14    │ │   8    │                           │
│  │  INT    │ │  WIS    │ │  CHA    │                           │
│  │  (+1)   │ │  (+2)   │ │  (-2)   │                           │
│  │ Save +1 │ │ Save +2 │ │ Save +0 │                           │
│  └─────────┘ └─────────┘ └─────────┘                           │
│──────────────────────────────────────────────────────────────────│
│                        PASSIVES                                  │
│  Perception: 17    Investigation: 11    Insight: 12             │
│──────────────────────────────────────────────────────────────────│
│                         SKILLS                                   │
│  PROF  SKILL              ATTR  MOD  TOTAL                      │
│   ●●  Acrobatics          DEX   +4    +10    ← Expertise        │
│   ○   Animal Handling     WIS   +2    +2                        │
│   ●   Arcana              INT   +1    +4                        │
│   ●   Athletics           STR   +3    +6                        │
│   ○   Deception           CHA   +0    +0                        │
│   ...                                                            │
│   ●   Stealth             DEX   +4    +7     ⚠️ Disadvantage    │
│   ○   Survival            WIS   +2    +2                        │
│──────────────────────────────────────────────────────────────────│
│                    TOOL PROFICIENCIES                             │
│   ●   Thieves' Tools      DEX   +4    +7                        │
│   ○   Smith's Tools       —     —     —                         │
│──────────────────────────────────────────────────────────────────│
│                       LANGUAGES                                  │
│  Common, Elvish, Thieves' Cant, Goblin                          │
│──────────────────────────────────────────────────────────────────│
│                    OTHER PROFICIENCIES                            │
│  Light Armor, Medium Armor, Shields, Simple Weapons,            │
│  Martial Weapons                                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Ability Score Card Behaviors

**Tap an ability card** → Expand to show calculation breakdown:
```
┌─────────────────────────────┐
│  STRENGTH                    │
│  Base: 15                    │
│  + Background ASI: +1       │
│  + ASI (Level 4): +2        │
│  + Gauntlets of Ogre Power: │
│    SET 19                    │
│  ────────────────            │
│  Final Score: 19   Mod: +4  │
│                              │
│  Save: +4 (mod) + 3 (prof)  │
│       = +7  [● Proficient]  │
│                              │
│  [Edit Base Score]           │
└─────────────────────────────┘
```

- **Save proficiency indicator**: filled circle = proficient, empty = not. Tapping toggles proficiency.
- **Edit Base Score**: Opens a number input for the base score (before modifiers).

### 4.3 Skills

**Each skill row shows:**
- Proficiency indicator: `○` none, `◐` half (Jack of All Trades), `●` proficient, `●●` expertise
- Skill name
- Governing attribute abbreviation (tappable to override to a different attribute)
- Attribute modifier contribution
- Total bonus

**Tap a skill row** → Expand to show breakdown:
```
Stealth: DEX (+4) + Prof (+3×2 Expertise) + Cloak of Elvenkind (+1) = +12
⚠️ Disadvantage: Heavy Armor equipped
```

**Tap the proficiency indicator** → Cycle through: None → Half → Proficient → Expertise → None.

**Tap the attribute label** → Dropdown to override governing attribute (e.g., Athletics from STR → CON for a specific scenario). Override persists until changed back.

### 4.4 Tool Proficiencies

Tool proficiencies function identically to skills but are stored in a separate list. They display in the same table format with the same proficiency cycling behavior.

- User can add new tool proficiencies via `[+ Add Tool]`.
- Each tool proficiency has an associated attribute (default varies by tool) and proficiency level.

### 4.5 Languages and Other Proficiencies

Simple text lists, editable inline. These are stored as arrays of strings on the character object.

---

## 5. Tab 3: Features

### 5.1 Layout

Features are organized into **feature lists** (already implemented as `character.featureLists[]`).

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 [Search features...]                                        │
│──────────────────────────────────────────────────────────────────│
│  ▼ Class: Fighter                                    [Overview] │
│    ● Fighting Style: Defense         Active ✓                   │
│    ● Second Wind                     Active ✓    ●○ (1/2)      │
│    ● Action Surge                    Active ✓    ●○ (1/2)      │
│    ● Extra Attack                    Active ✓                   │
│    ● Indomitable                     Active ✓    ●●○ (2/3)     │
│    ○ Martial Versatility (Optional)  Active ○                   │
│  ▼ Subclass: Psi Warrior                             [Overview] │
│    ● Psionic Power                   Active ✓    ●●●●○ (4/5)   │
│    ● Telekinetic Adept               Active ✓                   │
│  ▼ Class: Rogue                                      [Overview] │
│    ● Expertise                       Active ✓                   │
│    ● Sneak Attack                    Active ✓                   │
│    ● Thieves' Cant                   Active ✓                   │
│    ● Cunning Action                  Active ✓                   │
│  ▼ Species: Half-Elf                                             │
│    ● Darkvision                      Active ✓                   │
│    ● Fey Ancestry                    Active ✓                   │
│  ▼ Feats                                                         │
│    ● Alert                           Active ✓                   │
│    ● Sentinel                        Active ✓                   │
│    [+ Add from Compendium]  [+ Create Custom]                   │
│──────────────────────────────────────────────────────────────────│
│  [+ Add Feature List]                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Feature Row Behaviors

**Tap a feature name** → Expand inline to show full description text, source, level gained, and any modifiers the feature applies:

```
┌──────────────────────────────────────────────────────────────────┐
│  ● Psionic Power                          Active ✓  ●●●●○ (4/5)│
│  ──────────────────────────────────────────────────────────────  │
│  Fighter (Psi Warrior), Level 3           Source: XPHB          │
│                                                                  │
│  You harbor a wellspring of psionic energy within yourself...    │
│  [full description text, collapsible]                            │
│                                                                  │
│  Psionic Dice: d8 (at current level)                            │
│                                                                  │
│  Modifiers applied when Active:                                  │
│    (none — this feature's benefits are situational)              │
│                                                                  │
│  [✏️ Edit] [🔄 Sync with Compendium] [📌 Pin to Quick Actions] │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Feature List Headers

**[Overview]** button on class/subclass list headers → Opens the class/subclass progression table as a detail view (existing `class-overview` renderer). This lets the player see the full 1–20 progression at a glance.

**Feature lists can be:**
- Collapsed/expanded (state persisted).
- Reordered via drag handle.
- Renamed (tap the list name).
- Deleted (if empty and not a default list).

### 5.4 Optional Features

Features with `optional: true` flag display with a dimmed/outlined style and an `○` instead of `●` in the active column. Tapping the active toggle "opts in" to the feature. This handles Tasha's Optional Class Features and similar.

---

## 6. Tab 4: Inventory

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  💰 PP: 2  GP: 347  EP: 0  SP: 12  CP: 45                     │
│  ⚖️ Load: 87/225 lbs                          [Edit Currency]  │
│──────────────────────────────────────────────────────────────────│
│  🔍 [Search inventory...]                                       │
│──────────────────────────────────────────────────────────────────│
│  ▼ Equipped (Active)                                             │
│    ⓔ  Studded Leather +1       AC 13 + DEX        3 lbs        │
│    ⓔ  Shield                   AC +2               6 lbs        │
│    ⓔ  Longsword +1             1d8+1 S, Versatile  3 lbs        │
│    ⓐ  Cloak of Protection      +1 AC, +1 Saves     1 lb  a    │
│    ⓐ  Ring of Protection       +1 AC, +1 Saves     —     a    │
│  ▼ Carried (Selected)                                            │
│    ○  Hand Crossbow             1d6 P               3 lbs       │
│    ○  Crossbow Bolts (20)       Ammunition          1.5 lbs     │
│    ○  Potion of Healing ×4                          2 lbs       │
│    ○  Thieves' Tools                                1 lb        │
│    ○  Rope, Hempen (50ft)                           10 lbs      │
│  ▼ Stored (in bags of holding, etc.)                             │
│    ○  Plate Armor               AC 18               65 lbs      │
│    ○  Spare Longsword           1d8 S               3 lbs       │
│  ─────────────────────────────────────────────────────────────── │
│  [+ Add from Compendium]  [+ Create Custom Item]                │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Item States and Grouping

Items exist in three tiers (existing model, maintained):

| State | Display Group | Modifiers Apply? | Counts toward Carry Weight? |
|-------|--------------|------------------|-----------------------------|
| **Active** (equipped/attuned) | "Equipped" | ✅ Yes | ✅ Yes |
| **Selected** (carried) | "Carried" | ❌ No | ✅ Yes |
| **Neither** (stored) | "Stored" | ❌ No | ❌ No (in container) |

- `ⓔ` = Equipped, `ⓐ` = Attuned (equipped + requires attunement), `○` = not active.
- `a` badge = requires attunement.

### 6.3 Item Row Behaviors

**Tap item name** → Expand to show full item detail (same as compendium detail view, rendered inline). Includes:
- Full description text
- Properties, weight, cost
- Modifiers this item applies
- `[✏️ Edit]` — edit item properties inline
- `[🔄 Sync]` — overwrite local copy with compendium data
- `[📌 Pin]` — pin to Quick Actions (weapons/consumables)

**Swipe/drag item** → Move between Equipped/Carried/Stored tiers.

**Tap the state icon** (`ⓔ`/`○`) → Cycle: Active → Selected → Neither → Active.

**Quantity** → Items with `quantity > 1` show "×N" after the name. Tappable to adjust quantity.

### 6.4 Currency

Currency row is always visible at the top. Tap `[Edit Currency]` to open a quick editor for PP/GP/EP/SP/CP with +/− buttons and direct entry.

### 6.5 Carrying Capacity

`Load: 87/225 lbs` shows sum of Equipped + Carried item weights vs. `STR × 15`.

- Weight display is optional (can be toggled off in Sheet Settings).
- When over capacity, display a visual warning indicator (not a block — trust the player).
- Items in "Stored" do not count (assumed to be in an extradimensional space or left behind).

### 6.6 Attunement Tracking

Show attunement count: `Attuned: 3/3` near the top. Standard limit is 3. User can override the max in Sheet Settings (Artificer gets more, for example).

---

## 7. Tab 5: Spells

### 7.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ▼ Wizard Spells            DC: 17  Atk: +9  (INT)             │
│  ──────────────────────────────────────────────────────────────  │
│  Spell Slots:                                                    │
│  1st ●●●●  2nd ●●●  3rd ●●●  4th ●●○  5th ●○  6th ●           │
│──────────────────────────────────────────────────────────────────│
│  🔍 [Search spells...]           [Filter: All ▾] [Prepared ▾]  │
│──────────────────────────────────────────────────────────────────│
│  ▼ Cantrips                                                      │
│    ✦ Fire Bolt           Evocation    V,S     120ft  1 action   │
│    ✦ Mage Hand           Conjuration  V,S     30ft   1 action   │
│    ✦ Prestidigitation    Transmutation V,S    10ft   1 action   │
│  ▼ 1st Level                                         Slots: 4/4│
│    ☐ Alarm (R)           Abjuration   V,S,M   30ft  1 min      │
│    ☑ Detect Magic (R)(C) Divination   V,S     Self   1 action  │
│    ☑ Mage Armor          Abjuration   V,S,M   Touch  1 action  │
│    ☑ Magic Missile       Evocation    V,S     120ft  1 action   │
│    ☑ Shield (R)          Abjuration   V,S     Self   1 reaction │
│    ☐ Sleep               Enchantment  V,S,M   90ft   1 action  │
│  ▼ 2nd Level                                         Slots: 3/3│
│    ☑ Misty Step          Conjuration  V       Self   1 bonus    │
│    ☑ Scorching Ray       Evocation    V,S     120ft  1 action   │
│    ☑ Web (C)             Conjuration  V,S,M   60ft   1 action   │
│  ▼ 3rd Level                                         Slots: 3/3│
│    ☑ Counterspell (R)    Abjuration   S       60ft   1 reaction │
│    ☑ Fireball            Evocation    V,S,M   150ft  1 action   │
│    ☑ Haste (C)           Transmutation V,S,M  30ft   1 action  │
│                                                                  │
│  [+ Add from Compendium]  [+ Create Custom Spell]               │
│                                                                  │
│  ▼ Warlock Pact Magic            DC: 15  Atk: +7  (CHA)        │
│  ──────────────────────────────────────────────────────────────  │
│  Pact Slots: ●● (2 × 3rd level)                                │
│  ...                                                             │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Spell List Organization

Each spellcasting class gets its own spell list section (existing `character.spellLists[]`).

**Per-list header shows:**
- Spellcasting ability
- Spell save DC (calculated: `8 + PROF + ABILITY_MOD`). Tappable for breakdown.
- Spell attack bonus (calculated: `PROF + ABILITY_MOD`). Tappable for breakdown.

**Spell slots** displayed per list. Tappable circles to mark used/available.

**Multi-class slot merging**: For multiclass characters with merged spell slots (non-Warlock), display the merged pool once at the top. Warlock Pact Magic slots always display separately (existing `calculateCharacterSlots` logic).

### 7.3 Spell Row Behaviors

- `☑` / `☐` = Prepared toggle (the `selected` state). Cantrips are always `✦` (always available).
- `(R)` = Ritual tag. `(C)` = Concentration tag.
- **Tap spell name** → Expand inline to show full spell description from compendium data.
- **Active toggle** → Marks a spell as "currently active" (for buff spells like Mage Armor, Haste). When active, its modifiers apply to calculations.
- Spells with concentration auto-trigger the concentration condition in the header.

### 7.4 Spell Slot Usage

Tapping a filled slot circle (`●`) marks it as used (`○`). This is purely manual tracking — no enforcement of which spell uses which slot.

**Spells are not auto-linked to slots.** The player decides when to mark a slot as used. This is intentional — expert players know when they've used a slot.

### 7.5 Filters

- **All / Prepared / Active** — filter by spell state.
- **By School** — filter by spell school.
- **By Level** — jump to a specific level group.
- Text search across spell names and descriptions.

---

## 8. Slide-out: Bestiary & Companions

Accessible via a menu button or swipe gesture. Not a permanent tab.

### 8.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  🐾 BESTIARY & COMPANIONS                             [Close]  │
│──────────────────────────────────────────────────────────────────│
│  ▼ Familiars                                                     │
│    Robin (Homunculus Servant)                                    │
│    HP: 13/13   AC: 13   Speed: 20ft, Fly 30ft                  │
│    [Expand for full stat block]                                  │
│  ▼ Wild Shape Forms                                              │
│    Giant Spider    CR 1    AC 14  HP 26                          │
│    Dire Wolf       CR 1    AC 14  HP 37                          │
│    Brown Bear      CR 1    AC 11  HP 34                          │
│  ▼ Summons                                                       │
│    (empty)                                                       │
│  ──────────────────────────────────────────────────────────────  │
│  [+ Add from Compendium]  [+ Create Custom]                     │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Companion Entries

Each companion is a simplified monster stat block:
- Name, type, CR
- AC, HP (with +/− tracking), Speed
- Key stats (ability scores if relevant)
- Actions and abilities (text fields)
- HP tracking with +/− buttons (independent from character HP)

**Add from Compendium** → Opens compendium monster picker. Selected monster's stat block is deep-copied to the bestiary list.

**No engine integration** — companion stats do not affect character calculations. This is a reference/tracking tool.

---

## 9. Slide-out: Profile & Notes

### 9.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  📝 PROFILE & NOTES                                   [Close]  │
│──────────────────────────────────────────────────────────────────│
│  ▼ Identity                                                      │
│    Name: Kael Shadowmend                                        │
│    Species: Half-Elf (XPHB)           Background: Criminal     │
│    Alignment: Chaotic Neutral                                    │
│    Level 15: Fighter 12 / Rogue 3                               │
│  ▼ Appearance                                                    │
│    Age: 42    Height: 5'11"   Weight: 170 lbs                   │
│    [Portrait image area]                                         │
│  ▼ Personality                                                   │
│    Traits:  [editable text area]                                │
│    Ideals:  [editable text area]                                │
│    Bonds:   [editable text area]                                │
│    Flaws:   [editable text area]                                │
│  ▼ Backstory                                                     │
│    [large editable text area]                                    │
│  ▼ Allies & Organizations                                        │
│    [editable text area]                                          │
│  ▼ Session Notes                                                 │
│    [large editable text area, supports markdown]                │
└──────────────────────────────────────────────────────────────────┘
```

All fields are free-form editable text. No structured data required beyond what already exists in the character data model.

---

## 10. Character Building (Creation Wizard)

### 10.1 Wizard Flow

The creation wizard is the entry point for new characters. It replaces the current 5-step wizard with a refined 6-step flow that handles both 2014 and 2024 rules gracefully.

```
Step 1: Basics       → Name, stat method, stat entry
Step 2: Species      → Pick species, view traits, language/skill grants
Step 3: Background   → Pick background, ASI allocation (2024), skill/tool/language grants
Step 4: Class        → Pick starting class, HP, proficiency choices, Level 1 features
Step 5: Equipment    → Starting equipment picker (new)
Step 6: Review       → Summary of all choices, confirm and create
```

### 10.2 Step 1: Basics

**Stat Methods:**
- **Standard Array** (15, 14, 13, 12, 10, 8) — drag-and-drop or dropdown assignment to attributes.
- **Point Buy** — Interactive point-buy calculator with running total. 27 points, costs displayed.
- **Manual / Roll** — Direct number entry for each attribute. No auto-rolling.

**Other fields:** Name, Alignment (dropdown + custom option), Age, Height, Weight. All optional except Name.

### 10.3 Step 2: Species

**Left pane:** Searchable list of all species from compendium (filtered to `races` store).
**Right pane:** Full species detail with **🧬 Species Grants** box highlighting:
- Ability Score Increases (if 2014 rules)
- Languages granted
- Skill proficiencies granted (e.g., Half-Elf)
- Traits list (Darkvision, Fey Ancestry, etc.)

**Interaction:** Select species → grants auto-populate. User can edit language/skill selections where the species offers choices.

### 10.4 Step 3: Background

**Left pane:** Searchable list of backgrounds.
**Right pane:** Background detail with **🎒 Background Grants** box:
- ASI allocation (2024: choose +2/+1 or +1/+1/+1 across any abilities). Interactive sliders.
- Skill proficiencies (selectable where choices exist)
- Tool proficiency
- Languages
- Starting feat (2024 backgrounds grant an Origin Feat)

**Important:** If using 2014 backgrounds (no ASI), the ASI section should still appear with a note: "This background does not grant ability increases under 2014 rules. Use manual adjustment if needed."

### 10.5 Step 4: Class

**Left pane:** Searchable list of classes.
**Right pane:** Class detail with **⚔️ Class Grants** box:
- Hit Die
- Saving throw proficiencies
- Armor and weapon proficiencies
- Skill choices (checkboxes, limited to class's allowed picks and count)
- Starting HP input: `HD max + CON mod = ___`
- Level 1 features checklist (with descriptions expandable inline)
- Spellcasting ability (if applicable)

### 10.6 Step 5: Starting Equipment (NEW)

**Purpose:** Replace the blank equipment list that new characters start with.

**Two modes:**
1. **Class Starting Equipment** — Display the class's standard starting equipment package. Auto-populate with a single button.
2. **Manual** — Open the compendium item picker to add items individually.

**Implementation note:** Starting equipment data is available in the 5etools class data under `startingEquipment`. The parser should extract this. If not available, this step shows only the manual option.

### 10.7 Step 6: Review

Full summary of all choices. Shows:
- Final ability scores (with all bonuses applied)
- Calculated derived stats (AC, HP, saves, skills)
- Features gained
- Equipment list
- Spells known/prepared (if applicable)

**[Create Character]** button finalizes and saves.

---

## 11. Leveling Up

### 11.1 Entry Point

"Level Up" button on the character sheet header (existing). Opens the level-up modal.

### 11.2 Flow

```
Step 1: Choose Class    → Which class to advance (or new class for multiclass)
Step 2: Level Details   → HP, subclass (if L3), ASI (if ASI level), new features
Step 3: Review & Apply  → Summary of what changes, confirm
```

### 11.3 Step 1: Choose Class

**Single-class:** Auto-selected, skip to Step 2.
**Multiclass:** Show current classes with levels. Option to advance an existing class or add a new one. When adding a new class:
- Show multiclass prerequisites check (informational only — no blocking)
- Show multiclass proficiency grants

### 11.4 Step 2: Level Details

**HP Gain:**
- Default: `HD average + CON mod` (pre-calculated, shown prominently).
- Override: "I rolled: [___]" manual entry.

**Subclass Selection (if reaching subclass level):**
- Subclass picker with full detail pane.
- Shows subclass features gained at this level.

**ASI / Feat (if ASI level):**
- Two-mode toggle: "Ability Score Improvement" or "Feat"
- ASI: +2 to one score or +1 to two scores. Interactive grid with current scores shown.
- Feat: Opens feat picker from compendium. Shows feat prerequisites and grants.

**New Features:**
- Checklist of features gained at this level from both class and subclass.
- Each feature expandable to read full description.
- Optional features shown with a toggle (opt-in).

### 11.5 Step 3: Review & Apply

Summary:
```
Level Up: Fighter 11 → Fighter 12 (Total Level 15)
  HP: +7 (4 + 3 CON)    New Max: 101
  ASI: +2 STR (16 → 18)
  New Features:
    • Extra Attack (3 attacks)
  Counters updated:
    • Indomitable: 2/3 → 3/3 (max increased)
```

**[Apply Level Up]** saves all changes and re-renders the sheet.

### 11.6 Level-Down / Rebuild

A separate "Edit Level History" option in Sheet Settings allows:
- Removing the most recent level (undo last level-up).
- Respeccing a level (change ASI/feat choices).

This is a destructive operation with confirmation dialog.

---

## 12. Homebrew & Customization

### 12.1 Custom Item Creation

Available on every list via `[+ Create Custom]`. Opens a creation modal with fields appropriate to the item type:

**Custom Spell:**
```
Name: [____________]
Level: [0-9 dropdown]
School: [dropdown]
Casting Time: [____________]
Range: [____________]
Components: [V] [S] [M: ________]
Duration: [____________]  [Concentration checkbox]
Description: [large text area, supports markdown]
At Higher Levels: [text area]
Modifiers: [+ Add Modifier]
```

**Custom Equipment:**
```
Name: [____________]
Type: [Weapon / Armor / Wondrous / Potion / Other]
  If Weapon: Damage [____], Type [S/P/B/etc], Properties [checkboxes]
  If Armor: Base AC [___], Max DEX bonus [___], Stealth Disadvantage [checkbox]
Weight: [___] lbs
Cost: [___] gp
Requires Attunement: [checkbox]
Description: [large text area]
Modifiers: [+ Add Modifier]
```

**Custom Feature:**
```
Name: [____________]
Source: [____________]  (free text, e.g. "Homebrew", "DM Grant")
Description: [large text area]
Has Counter: [checkbox] → Max [___], Resets on: [Short] [Long]
Modifiers: [+ Add Modifier]
```

### 12.2 Editing Existing Items

Any item on the sheet — whether from compendium or custom — can be edited via the `[✏️ Edit]` button in its expanded view.

- Opens the same creation modal, pre-populated with current values.
- Shows a warning banner: "This item was imported from the Compendium. Edits are local to this character."
- `[🔄 Sync with Compendium]` button is always available to revert to the original compendium data.

### 12.3 Modifier Editor

The modifier editor is a reusable component that appears within any item creation/edit modal.

```
Modifiers:
┌─────────────────────────────────────────────────────────────┐
│  Target: [AC ▾]          Type: [Add ▾]     Value: [+2]    │
│  [Remove]                                                    │
├─────────────────────────────────────────────────────────────┤
│  Target: [Speed ▾]       Type: [Add ▾]     Value: [10]    │
│  [Remove]                                                    │
├─────────────────────────────────────────────────────────────┤
│  [+ Add Modifier]                                            │
└─────────────────────────────────────────────────────────────┘

Target dropdown options:
  AC, HP Max, Speed, Initiative
  STR/DEX/CON/INT/WIS/CHA Score
  STR/DEX/CON/INT/WIS/CHA Save
  Spell DC, Spell Attack
  Melee Attack, Melee Damage, Ranged Attack, Ranged Damage
  Proficiency Bonus
  Any Skill (sub-dropdown)
  Save All
  Custom: [free text target key]

Type dropdown: Add, Set, Min, Max

Value: Number input, or formula toggle for advanced:
  Formula mode allows: {char.level}, {prof_bonus}, {str.mod}, etc.
  Shows syntax help tooltip.
```

### 12.4 Class Resync

When viewing a class overview in the Features tab, a `[🔄 Resync Class Features]` button is available.

**Behavior:**
1. Compares current character features for that class against the compendium class/subclass data.
2. Shows a diff: features to add (new in compendium), features to update (changed text), features to remove (no longer in compendium at character's level).
3. User selects which changes to apply.
4. Does NOT touch user-created custom features.

---

## 13. Compendium Integration (In-Sheet Reference)

### 13.1 Inline Compendium Lookup

Any spell, item, feat, or monster name displayed on the character sheet should be a **tappable link** that opens the full compendium entry in a slide-over panel.

**Behavior:**
- Tap "Fireball" on the spells list → slide-over panel shows the full compendium detail for Fireball.
- The panel has a `[Add to Sheet]` / `[Already on Sheet]` indicator.
- Panel can be dismissed by swiping or tapping outside.

**This replaces the need to switch to the compendium.** The player stays on their character sheet.

### 13.2 Picker Mode (Existing, Enhanced)

When `[+ Add from Compendium]` is tapped on any list, the compendium opens in picker mode (existing `pickerActive` behavior).

**Enhancements:**
- The picker should filter to the relevant category automatically (spells for spell lists, items for inventory, monsters for bestiary, feats for features).
- A floating "Back to Sheet" button is always visible.
- Multiple items can be selected before returning to the sheet (batch add).

---

## 14. Functional Changes Required

### 14.1 Data Model Additions

| Field | Location | Type | Purpose |
|-------|----------|------|---------|
| `pinnedActions` | `character` | `Array<{sourceList, sourceId}>` | Quick Actions panel on Combat tab |
| `conditions` | `character` | `Array<{name, effects?, isConcentration?, spellName?}>` | Active conditions with optional mechanical notes |
| `attunementMax` | `character` | `number` (default: 3) | Override for attunement limit |
| `toolProficiencies` | `character` | `Array<{name, attr, profLevel}>` | Tool proficiency tracking with associated skill-like behavior |
| `weightTrackingEnabled` | `character` | `boolean` (default: true) | Toggle carry weight display |
| `collapsedLists` | `character` | `Object<listId, boolean>` | Persist collapsed/expanded state of feature/spell/item lists |
| `startingEquipment` | class records | parsed from 5etools | Starting gear packages for creation wizard |
| `levelHistory` | `character` | `Array<{level, class, choices}>` | Audit trail for level-down/respec |

### 14.2 Engine Enhancements

| Change | Description |
|--------|-------------|
| **Concentration tracking** | When a spell with concentration is toggled Active, auto-add "Concentrating" condition. When toggling a new concentration spell, prompt to drop existing concentration. |
| **Finesse weapon detection** | Attack calculations for weapons with the Finesse property should show both STR and DEX options and auto-use the higher modifier. |
| **Tool proficiency as skill** | Tool proficiencies need skill-like calculation: `ATTR_MOD + PROF * profLevel`. Engine currently only handles the 18 standard skills. |
| **Armor AC calculation** | Engine currently uses `10 + DEX` as base AC. Should detect equipped armor and use its base AC formula instead (e.g., Chain Mail = 16, no DEX; Half Plate = 15 + DEX max 2). This requires parsing armor `ac` field from equipment items. |
| **Multi-ability spellcasting** | Engine uses a single `spellcastingAbility`. Multiclass characters with different casting abilities need per-spell-list DC/attack calculations (already supported via `spellLists[].spellcastingAbility`). |

### 14.3 Parser Enhancements

| Change | Description |
|--------|-------------|
| **Starting equipment** | Extract `startingEquipment` from 5etools class data and store on class records. |
| **Weapon properties** | Ensure weapon properties (Finesse, Light, Heavy, Thrown, Versatile, etc.) are parsed and stored in a structured `properties[]` array, not just embedded in description text. |
| **Armor type detection** | Items with armor AC formulas should have a structured `armorAC` field (base AC, max DEX bonus, stealth disadvantage flag). |
| **Spell tags** | Ensure Ritual and Concentration tags are parsed as boolean flags (`isRitual`, `isConcentration`), not just in description text. |
| **Condition list** | Parse the standard D&D conditions list (Blinded, Charmed, Deafened, etc.) with their mechanical descriptions for the conditions picker. |

### 14.4 UI Component Changes

| Component | Change |
|-----------|--------|
| **HP Modal** | New: dedicated HP adjustment modal with number pad, +/−/set modes, and overflow to temp HP logic. |
| **Calculation Breakdown Popup** | New: generic popup component that shows a breakdown of how any derived value was calculated. Triggered on tap of AC, Initiative, Speed, saves, skills, attack bonuses, etc. |
| **Condition Bar** | New: horizontal scrolling chip bar below header. |
| **Quick Actions Panel** | New: configurable pinned-action cards at top of Combat tab. |
| **Rest Wizard** | New: checklist modal for short/long rest actions. |
| **Item Creation Modal** | New: generic creation/edit modal with type-specific field sets and modifier editor. |
| **Batch Picker** | Enhancement: picker mode supports selecting multiple items before returning to sheet. |
| **Feature List Collapse** | Enhancement: feature lists can be collapsed/expanded with persisted state. |
| **Spell Slot Tracker** | Enhancement: visual slot tracker integrated into spell list headers (partially exists, needs refinement). |

---

## 15. Mobile Responsiveness

### 15.1 Layout Adaptations

| Viewport | Behavior |
|----------|----------|
| **Desktop (≥1024px)** | Character sheet uses the full detail pane area. Tabs as vertical sidebar on the left. Compendium picker opens in a side panel without covering the sheet. |
| **Tablet (768–1023px)** | Full-screen overlay. Bottom tab bar. Picker opens as a modal overlay. |
| **Mobile (<768px)** | Full-screen overlay. Bottom tab bar (icons only, no labels). All sections stack vertically. Horizontal scrolling for slot/counter rows. |

### 15.2 Touch Targets

- All interactive elements must be at minimum 44×44px (Apple HIG).
- +/− buttons for HP, counters, and slots should be large and spaced for thumb use.
- Swipe gestures: left/right between tabs (optional, can coexist with bottom bar).

---

## 16. Performance Considerations

### 16.1 Render Strategy

- **Only re-render the active tab** when state changes. Avoid re-rendering all tabs on every save.
- **Calculation breakdown popups** should be computed on-demand (tap), not pre-rendered.
- **Compendium lookups** (inline detail expansion) should lazy-load from `allRecordsCache` — not re-fetch from IndexedDB.
- **Debounced saves**: Already implemented via `scheduleDebouncedSync()`. Maintain this pattern.

### 16.2 Data Efficiency

- Character objects are self-contained (deep-copied items). This is correct — do not change to references.
- Feature text can be large (class features have multi-paragraph descriptions). Use virtualized/lazy rendering for the Features tab if >50 features.

---

## 17. Implementation Priority

### Phase 1: Combat UX Overhaul
- Calculation breakdown popup component
- HP adjustment modal
- Conditions bar
- Rest wizard (short/long rest)
- Quick Actions panel
- Active Modifiers section improvements

### Phase 2: Stats & Skills Polish
- Ability score expansion with full breakdown
- Skill proficiency cycling
- Tool proficiency tracking
- Attribute override for skills

### Phase 3: Inventory Improvements
- Item state tiers (Equipped/Carried/Stored) with drag
- Attunement tracking
- Carrying capacity display
- Quantity management

### Phase 4: Spells Tab Refinement
- Per-list spell DC/attack display
- Spell slot visual tracker
- Concentration tracking integration
- Spell filters (prepared/school/level)

### Phase 5: Homebrew & Editing
- Custom item creation modal (all types)
- Modifier editor component
- Edit existing items
- Class resync

### Phase 6: Creation & Leveling
- Starting equipment step in wizard
- Level-up review step
- Level-down/respec
- Level history audit trail

### Phase 7: Integration & Polish
- Inline compendium lookup panel
- Batch picker mode
- Feature list collapse/reorder persistence
- Mobile gesture refinements
