# UX Spec - Data Gap Analysis

> **Purpose:** Enumerate all data handling gaps — missing character fields, unparsed source data, engine blind spots, and absent database stores — that must be resolved before the Character Sheet and Game Reference specs can be fully implemented.
> **References:** UX Spec - Character Sheet.md §14 · UX Spec - Game Reference.md §6
> **Source data verified against:** `5etools-src/data/` (local mirror)

Legend: ✅ Fully present · ⚠️ Partial / needs extension · ❌ Absent

---

## 1. Character Data Model Gaps

Fields referenced in the specs that are absent from `createNewCharacterTemplate()` (app.js ~L4178).

| Field | Spec Reference | Status | Notes |
|-------|---------------|--------|-------|
| `conditions` | Sheet §2.3, §3.6 | ✅ | Already on character object as `conditions: []`. UI needs promotion from Notes tab to a first-class header bar. |
| `pinnedActions` | Sheet §3.2 | ❌ | Quick Actions panel. Array of `{ sourceList, sourceId, type }`. Not in template. |
| `attunementMax` | Sheet §6.6 | ❌ | Default 3, overridable (Artificer). Not tracked anywhere. |
| `toolProficiencies` | Sheet §4.4 | ❌ | Background parser extracts tool grants as a flat string (see `parseToolProficiencies` in parser-5etools.js:667). There is no structured `toolProficiencies: [{ name, attr, profLevel }]` array on the character object for the Stats tab to render or the engine to calculate against. |
| `weightTrackingEnabled` | Sheet §6.5 | ❌ | Toggle for carry weight display. Weight calculation code exists (app.js:8135) but no per-character toggle. |
| `collapsedLists` | Sheet §5.3 | ❌ | Persist collapsed/expanded state of feature/spell/item list groups. Not in template. |
| `levelHistory` | Sheet §11.6 | ❌ | Audit trail for level-down/respec. Not in template. `applyLevelUp` makes no record of choices. |
| `currentHp` on bestiary items | Game Ref §4.3 | ❌ | Independent HP tracking per companion. Bestiary list items carry no `currentHp` field. |

---

## 2. Parser Gaps

Data present in 5etools source JSON that is not extracted by `parser-5etools.js`.

### 2.1 Spells

| Field | Spec Reference | Status | Notes |
|-------|---------------|--------|-------|
| `isConcentration` boolean | Sheet §7.3, §14.3 | ⚠️ | The parser builds a `durStr` string that *begins* with `"Concentration, up to …"` when applicable (parser-5etools.js:268) but stores no separate boolean flag. The engine and conditions-tracking logic need a boolean, not a string parse. Source: `spell.duration[0].concentration`. |
| `isRitual` boolean | Sheet §7.3, §14.3 | ✅ | `ritual: !!spell.meta?.ritual` — already present (parser-5etools.js:365). |
| `materialComponent` structured | Sheet §12.1 | ⚠️ | Material component text is embedded into the components string (`M (text)`). Custom spell creation modal needs `m.text` and `m.consume` separately. Source: `spell.components.m`. |

### 2.2 Items / Equipment

| Field | Spec Reference | Status | Notes |
|-------|---------------|--------|-------|
| `properties` as structured array | Sheet §3.3, §14.3 | ⚠️ | Parser joins property abbreviations into a comma-string (`propertyStr = item.property.join(', ')`) at parser-5etools.js:409–411. The engine needs an array — specifically to detect `"F"` (Finesse), `"V"` (Versatile), `"L"` (Light), `"H"` (Heavy), `"T"` (Thrown). Source: `item.property` is already an array in the raw JSON; just stop joining it. |
| `armorFormula` structured | Sheet §14.2 (Armor AC) | ❌ | Current parser stores `ac: parseInt(item.ac)` — a single integer — sufficient for flat-AC armor (Chain Mail = 16). It does not capture: `maxDexBonus` (Half Plate caps DEX at +2; Light Armor has no cap), nor whether the armor's AC is a base (add DEX) or fixed (no DEX). This is needed for the engine's AC calculation (see §4 below). Source: `item.type` (`LA`/`MA`/`HA`) plus `item.ac` encodes the formula implicitly but is currently flattened. |
| `requiresAttunement` boolean | Sheet §6.2, §6.6 | ⚠️ | The raw `item.reqAttune` field (string `"optional"` or `true`) is copied through the catch-all `for (const k in item)` loop (parser-5etools.js:447) but is not normalized to a clean boolean `requiresAttunement` field. Attunement tracking UI needs a reliable boolean. |
| `startingEquipment` on class records | Sheet §10.6, §14.1 | ❌ | `normalize5etoolsClass()` does not extract `startingEquipment` from class JSON. The data exists in 5etools (e.g. `class-fighter.json` line 66: `startingEquipment.defaultData[]` + `startingEquipment.default[]` human-readable strings). The parser must extract and store this so the wizard Step 5 can populate it. The `defaultData` array contains structured item references; `default` contains display strings for the non-structured alternative selection UI. |

### 2.3 Cross-Reference Tags

| Feature | Spec Reference | Status | Notes |
|---------|---------------|--------|-------|
| `{@tag reference}` → clickable link | Game Ref §5 | ❌ | `parse5etoolsText()` (parser-5etools.js:93) currently strips or flattens `{@spell X}`, `{@condition X}`, `{@creature X}`, etc. to plain text. The Game Reference spec requires these to become `<a data-ref-type="spell" data-ref-name="X">X</a>` elements wired to the Quick Lookup system. Preserving the semantics requires either: (a) emitting HTML with data attributes during parse, or (b) leaving the raw `{@tag}` syntax in stored text and resolving it at render time in `parseMarkdown`. Option (b) is safer (avoids re-import after the parser changes). |

---

## 3. New Database Stores Required

These categories of reference data exist in `5etools-src/data/` but have no corresponding IndexedDB store and no parser function.

| Store | Source File | Spec Reference | Content Needed |
|-------|------------|---------------|----------------|
| `conditions` | `data/conditionsdiseases.json` → `condition[]` | Sheet §2.3, §14.3 · Game Ref §3.5 | All standard conditions (Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious) with mechanical descriptions. Also `status[]` entries (Concentrating, Surprised, etc.). Need: `name`, `source`, `entries` (rendered HTML). |
| `actions` | `data/actions.json` → `action[]` | Game Ref §3.5 | Standard combat actions (Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object, and variants). Quick Access button in the Quick Lookup panel. Need: `name`, `time`, `entries`. |
| `variantrules` | `data/variantrules.json` | Game Ref §3.5 | Cover rules, Exhaustion table, and other commonly referenced rules tables. Quick Access button targets. A subset is sufficient — filter to SRD/Basic Rules entries. Need: `name`, `source`, `entries`. |

**`db.js` change:** Add the three store names to the `STORES` constant (db.js:9) and to the compendium clear list (`clearCompendium()`). These stores should be treated as compendium data (clearable on re-import, no `_modified_at`).

**Import pipeline:** `showSourceSelectionModal` / `importFromGithub` in app.js must be extended to fetch and ingest these files. They are standalone JSON files (not split by source like spells/monsters), so a single fetch per file suffices.

---

## 4. Engine Gaps (`engine.js`)

The stat calculator (`calculateCharacterState`) returns flat final numbers with no intermediate trace. The following logic is absent.

### 4.1 Armor AC Formula

**Current behavior (engine.js:276):**
```js
const acBase = 10 + state['dex.mod'];
state['ac'] = resolveTarget('ac', acBase);
```
This is always the unarmored formula. Equipped armor items are not detected.

**Required behavior:** Scan `character.equipment` for items where `item.active === true` and `item.armor === true`. If found, use the armor's formula instead of `10 + DEX`:
- Light Armor (`LA`): `item.ac + dex.mod`
- Medium Armor (`MA`): `item.ac + Math.min(dex.mod, 2)`
- Heavy Armor (`HA`): `item.ac` (no DEX)
- Shield (`S`): add `+2` on top of armor base

This requires the parser change in §2.2 (`armorFormula` structured field) — or a simpler lookup by `item.rawType` which is already stored.

### 4.2 Finesse Weapon Detection

**Current behavior (engine.js:297–298):**
```js
const meleeAttackBase = state['prof_bonus'] + state['str.mod'];
state['melee.attack'] = resolveTarget('melee.attack', meleeAttackBase);
```
Finesse weapons (Rapier, Shortsword, Dagger, etc.) should allow using `max(STR, DEX)` for both attack and damage. Engine has no awareness of weapon properties.

**Required:** When rendering attack rows for weapons with `"F"` in their properties array, the engine (or the combat tab renderer) must emit both the STR-based and DEX-based attack bonuses and indicate which is higher. The spec shows this in the breakdown popup: `Finesse: Using DEX (+4) instead → +10`.

This requires the parser fix (§2.2: properties as array, not string) so `item.property.includes('F')` is reliable.

### 4.3 Tool Proficiency Calculation

No current engine path for tool proficiencies. The engine handles exactly 18 named skills. Tool proficiencies from `character.toolProficiencies[]` need the same `ATTR_MOD + PROF * profLevel` calculation, but the attribute varies by tool (Thieves' Tools → DEX, Smith's Tools → STR, etc.).

**Required:** Engine should accept `character.toolProficiencies` and emit `state['tool.<toolName>']` values. The attribute mapping either needs to be a static lookup or stored on each tool proficiency entry.

### 4.4 Calculation Breakdown / Trace

**Current behavior:** Engine returns final values only (e.g. `state['ac'] = 18`). The spec's "Calculation Transparency" tenet requires every derived value to show its formula on tap.

**Required:** Engine (or a parallel function) must return a breakdown object alongside each value, e.g.:
```js
{
  'ac': { value: 18, steps: [
    { label: 'Plate Armor', value: 16, type: 'base' },
    { label: 'Shield',      value: 2,  type: 'add'  },
    { label: 'Cloak of Protection', value: 2, type: 'add' }
  ]}
}
```
This is the most architecturally significant engine change. Options:
- Add a `breakdown` parallel dictionary to the return value of `calculateCharacterState`.
- Or compute breakdowns lazily in a separate `getBreakdown(character, target)` call triggered on tap.

The lazy option avoids bloating every render and is recommended given the "computed on-demand" performance note in Sheet §16.1.

### 4.5 Concentration Auto-Condition

When a spell with `isConcentration: true` is toggled Active on the sheet, the `conditions` array should automatically gain a `{ name: 'Concentrating', isConcentration: true, spellName: '...' }` entry. When toggling a second concentration spell Active, the UI must prompt to drop the existing one.

This is currently unimplemented. The spec marks it as an engine enhancement (Sheet §14.2), but it's more accurately a sheet-save-path concern — the logic sits in the spell toggle handler in app.js, not in engine.js itself.

---

## 5. Quick Lookup Panel — Data Dependencies

The Quick Lookup Panel (Game Ref §3) is a new UI component. Its data dependencies are:

| Dependency | Source | Status |
|-----------|--------|--------|
| Cross-category search | `allRecordsCache` + `renderUniversalSearchPanel` (app.js:4227) | ✅ Exists — needs to be invokable without navigating away |
| Conditions list | `conditions` store (§3 above) | ❌ Store doesn't exist |
| Combat actions list | `actions` store (§3 above) | ❌ Store doesn't exist |
| Cover / Exhaustion rules | `variantrules` store (§3 above) | ❌ Store doesn't exist |
| Favorites section | `favorites` store + `allRecordsCache['favorites']` | ✅ Exists |
| Recent lookups history | `sessionStorage` or character field | ❌ Not implemented |

---

## 6. Item State Model — Current vs. Required

The spec defines three item tiers: Equipped (Active), Carried (Selected), Stored (Neither). The current implementation uses two boolean flags per item:

| State | Current encoding | Weight counted? | Modifiers apply? |
|-------|-----------------|----------------|-----------------|
| Equipped | `active: true, selected: true` | ✅ | ✅ |
| Carried | `active: false, selected: true` | ✅ | ❌ |
| Stored | `active: false, selected: false` | ❌ | ❌ |

**Status: ✅ The three-tier model already works via the two booleans.** The gap is in UI labeling: the inventory list currently renders two groups ("Equipped" and the rest) rather than three ("Equipped", "Carried", "Stored"). No data model change needed — this is a rendering gap only. The weight calculation already correctly excludes items where both flags are false (app.js:8135).

---

## 7. Summary by Implementation Phase

Ordered by the spec's Phase plan (Sheet §17), noting which data gaps block each phase.

| Phase | Blocking Data Gap |
|-------|------------------|
| Phase 1 — Combat UX | `isConcentration` boolean (§2.1) · Armor AC formula parser field (§2.2) · Armor AC engine logic (§4.1) · Calculation breakdown/trace from engine (§4.4) · `pinnedActions` character field (§1) · `conditions` store (§3) |
| Phase 2 — Stats & Skills | `toolProficiencies` character field (§1) · Tool proficiency engine calculation (§4.3) |
| Phase 3 — Inventory | `attunementMax` character field (§1) · `requiresAttunement` normalized boolean (§2.2) · `weightTrackingEnabled` character field (§1) |
| Phase 4 — Spells | `isConcentration` boolean on spells (§2.1) |
| Phase 5 — Homebrew | `properties` as structured array (§2.2) · `armorFormula` structured (§2.2) |
| Phase 6 — Creation/Leveling | `startingEquipment` in class parser (§2.2) · `levelHistory` character field (§1) |
| Phase 7 — Integration/Polish | Cross-reference `{@tag}` link rendering (§2.3) · Quick Lookup panel with all three new stores (§5) · `currentHp` on bestiary items (§1) · `collapsedLists` character field (§1) |
