# Game Reference UX Specification

> **Companion to:** UX Spec - Character Sheet.md
> **Scope:** The in-sheet game reference system — how the character sheet integrates with compendium data for quick lookups during play.
> **This is NOT a redesign of the compendium browser.** It specifies how compendium data surfaces within the character sheet context.

---

## 1. Purpose

An expert player needs two things during a session:
1. **Their character sheet** — stats, features, resources.
2. **Quick reference** — "What does this spell actually do?" / "What's a Beholder's AC?" / "What are the Grappled condition rules?"

Today, those are separate views requiring full context switches. This spec unifies them so the player **never leaves their character sheet** to look something up.

---

## 2. Inline Detail Expansion

### 2.1 Behavior

Every entity name on the character sheet is a **tappable link**. Tapping opens the entity's full compendium detail **inline** (expanded below the row) or in a **slide-over panel** on mobile.

**Applies to:**
- Spell names (Spells tab)
- Item/weapon names (Inventory tab, Combat tab attacks)
- Feature names (Features tab)
- Companion/monster names (Bestiary slide-out)
- Class/subclass names (Feature list headers)
- Feat names (Features tab, Feats list)

### 2.2 Detail Content

The inline detail renders the **same HTML** as `getDetailHTML(item, category)` in the compendium's detail pane. This is already implemented — it just needs to be invoked in the character sheet context.

### 2.3 Dismissal

- Tap the expanded row again to collapse.
- Tap a different row to switch focus.
- On mobile, slide-over panel has a close button and can be swiped away.

---

## 3. Quick Lookup Panel

### 3.1 Purpose

For looking up things NOT on the character sheet — enemy stats, rule references, condition details.

### 3.2 Trigger

A floating `🔍` button (or keyboard shortcut on desktop) opens the Quick Lookup Panel while the character sheet remains visible underneath.

### 3.3 Layout

```
┌──────────────────────────────────────────┐
│  🔍 Quick Lookup                [Close] │
│  [Search across all compendium...]      │
│                                          │
│  Recent:                                 │
│    Beholder (Monster, CR 13)            │
│    Grappled (Condition)                 │
│    Counterspell (Spell, 3rd)            │
│                                          │
│  Quick Access:                           │
│    [Conditions]  [Actions in Combat]    │
│    [Cover Rules] [Exhaustion]           │
│                                          │
│  ─────────────────────────────────────  │
│  [search results appear here]           │
│                                          │
└──────────────────────────────────────────┘
```

### 3.4 Search

- Cross-category search (same as existing `renderUniversalSearchPanel`).
- Results grouped by category with category badges.
- Selecting a result shows its full detail within the panel.
- **Does not navigate away from the character sheet.** The sheet stays open underneath.

### 3.5 Quick Access Buttons

Pre-configured shortcuts to commonly referenced rules:
- **Conditions** — opens the full conditions list (Blinded, Charmed, etc.) with descriptions.
- **Actions in Combat** — Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object.
- **Cover Rules** — Half, Three-quarters, Full.
- **Exhaustion** — level table with effects.

These can be populated from a static reference data set (SRD rules text) or from 5etools rule entries if parsed.

### 3.6 Favorites Integration

Items favorited in the compendium (`favorites` store) appear as a "Favorites" section in Quick Lookup for fast access to frequently referenced material.

---

## 4. Monster Quick Reference

### 4.1 Use Case

DM asks: "What's your familiar's AC?" or player wants to reference a summoned creature's abilities.

### 4.2 In-Sheet Access

Bestiary entries (slide-out panel) show a **condensed stat block** by default:

```
┌──────────────────────────────────────────────────────────────────┐
│  Giant Spider                          CR 1        [Expand ▼]   │
│  Medium Beast, Unaligned                                        │
│  AC 14 (natural armor)   HP 26   Speed 30ft, Climb 30ft       │
│  STR 14 (+2) DEX 16 (+3) CON 12 (+1) INT 2 (-4) WIS 11 (+0) CHA 4 (-3)│
│  Skills: Stealth +7                                             │
│  Senses: Blindsight 10ft, Darkvision 60ft, PP 10               │
└──────────────────────────────────────────────────────────────────┘
```

**[Expand]** shows the full stat block with actions, traits, and abilities.

### 4.3 HP Tracking

Each bestiary entry has independent HP tracking:
```
  HP: [−] ████████░░ 18/26 [+]
```

This is session state — persists until the character is saved, resets are manual.

---

## 5. Cross-Reference Links in Descriptions

### 5.1 Problem

5etools entries contain cross-references (e.g., "See the {@spell Fireball} spell" or "as per the {@condition Frightened} condition"). Currently these are rendered as plain text.

### 5.2 Solution

The `parseMarkdown` function should detect `{@tag reference}` patterns (already in 5etools data) and render them as **tappable links** that open the referenced entity's detail in the inline expansion or Quick Lookup panel.

**Tag types to support:**
- `{@spell SpellName}` → opens spell detail
- `{@item ItemName}` → opens item detail
- `{@creature CreatureName}` → opens monster detail
- `{@condition ConditionName}` → opens condition detail
- `{@class ClassName}` → opens class detail
- `{@feat FeatName}` → opens feat detail
- `{@action ActionName}` → opens action rules

### 5.3 Implementation Note

The 5etools parser (`parser-5etools.js`) already encounters these tags. Currently they're either stripped or rendered as plain text. The change is to:
1. Preserve the tag semantics during parsing (store as a data attribute or special markup).
2. In `parseMarkdown`, render them as `<a>` tags with `data-ref-type` and `data-ref-name` attributes.
3. Attach a click handler that opens the referenced entity via the Quick Lookup system.

---

## 6. Functional Changes Required

| Change | Description |
|--------|-------------|
| **Inline detail renderer** | Reuse `getDetailHTML()` within character sheet context. Render in expandable section or slide-over panel. |
| **Quick Lookup Panel** | New overlay component with search, recent history, and quick access buttons. Uses existing `allRecordsCache` for search. |
| **Cross-reference link rendering** | Update `parseMarkdown()` to handle `{@tag}` patterns as clickable links. |
| **Conditions reference data** | Ensure all standard D&D conditions are available in the compendium data (parse from 5etools or bundle as static data). |
| **Combat actions reference** | Bundle or parse the standard combat actions list as reference data. |
| **Recent lookups** | Store last 10 lookups in `sessionStorage` or character-level state for the "Recent" section. |
| **Bestiary HP tracking** | Add `currentHp` field to bestiary list items (independent from character HP). |
