# Architecture Changes — Full Rebuild Plan

> **Status:** Proposal / decision record. No code has been changed by this document.
> **Author:** Architectural review pass (2026-06).
> **Scope:** Re-platform the application onto a compiled, component-based front end to support the
> [Character Sheet UX Spec](./FUTURE%20FEATURE%20-%20Character%20Sheet/UX%20Spec%20-%20Character%20Sheet.md)
> and [Game Reference UX Spec](./FUTURE%20FEATURE%20-%20Character%20Sheet/UX%20Spec%20-%20Game%20Reference.md).
> **Constraint:** Must still deploy as static files (offline-first PWA). A build/compile step before commit is acceptable.
> **CRITICAL: Work Process:** Manage progress by following Section 10.
 - Mark each step of section 10 as complete when done
  - As items are addressed in sections 2 - 9, add italicized comment on completion status
  - Any decisions which have been backlogged should be added to list in Section 13 and marked complete once addressed
  - Review section 13 backlog prior to starting work. If it is a dependency of current work, address it prior to continuing.
  - Prior to starting each section, create a feature branch for that step. Commit frequently. Once completed and tested, merge into main and sync to main.

---

## 1. Why this document exists

The two UX specs describe a redesign that roughly **doubles the interactive surface** of the character sheet:
calculation-breakdown popups on every derived number, a live conditions bar, a configurable Quick Actions panel,
a rest wizard, inline compendium expansion, drag-between-tier inventory, cross-reference links in description text,
and a homebrew/editing workflow.

A review of the current codebase concluded that the **data/logic core is healthy** but the **UI layer is not
structured to absorb this redesign cleanly**. This document records that finding, selects a target architecture,
and lays out a phased, low-risk migration. It is the only artifact produced in this pass — implementation is
deferred until the plan is approved.

---

## 2. Current architecture — assessment

### 2.1 What is healthy (keep, don't rewrite)

| Module | Lines | State |
|---|---|---|
| `engine.js` | 310 | Single-responsibility stat calculator. Pure function `calculateCharacterState(character)`. **Unit-tested** (`test_engine.js`). |
| `parser-5etools.js` | 991 | 5etools JSON → internal records. **Unit-tested** (`test_5etools_parser.js`). |
| `sync.js` | 601 | Dropbox LWW sync. **Unit-tested** (`test_sync.js`). |
| `db.js` | 323 | IndexedDB layer (now schema v10, incl. `custom_records`). Clean async API. |
| `conflict.js`, `storage.js`, `ui-sync.js` | 147 / 160 / 306 | Focused, small. |
| `docs/` | — | Accurate subsystem docs. |

These represent the genuinely hard parts of a D&D 5e app (rules math, data ingestion, offline sync) and they are
modular, tested, and documented. **The rebuild reuses them with minimal change.**

### 2.2 What is the liability

`app.js` — **8,443 lines, 119 functions, 24 module-level mutable globals.** The entire UI (compendium browser,
character roster, creation wizard, level-up flow, all 7 sheet tabs, every modal) lives in this one file.

| Problem | Evidence | Impact on the redesign |
|---|---|---|
| **Full re-render on every change** | `saveCurrentCharacterAndRefresh()` → `renderCharacterSheetUI()` rebuilds *all* tabs and re-binds ~81 `.onclick` handlers per render. | Directly violates spec §16.1 ("only re-render the active tab"). Inline expansions, drag state, scroll position, and focus are destroyed on every HP tick. The spec's interaction model is effectively impossible on this render loop. |
| **Global mutable UI state** | 24 top-level `let` bindings (`currentCharacter`, `selectedItem`, `pickerActive`, `wizardState`, `levelUpState`, …). | No encapsulation or change-tracking; any function can mutate any state. Adding pinned actions, conditions, collapsed-list state, etc. multiplies the implicit-coupling surface. |
| **String-templated HTML, incomplete escaping** | ~620 `${…}` interpolations into `innerHTML`; only 16 `escapeHtml()` calls. User-controlled fields (`character.name`, custom-record names, notes) are interpolated raw. | Stored-XSS vector. Low severity today (single-user/offline) but real now that names + custom records sync across a user's own devices via Dropbox. The homebrew workflow in the spec adds many more free-text fields. |
| **Engine returns totals, not breakdowns** | `engine.js` `resolveTarget()` sums contributions then **discards their provenance**; `calculateCharacterState` returns a flat `{ 'ac': 18, … }` dict. | **Calculation Transparency is the spec's stated #1 differentiator** (§0.1.3). It cannot be built on a flat-total engine without re-deriving every formula in the UI. The engine must return structured breakdowns. |
| **Engine correctness gaps** | AC hardcoded to `10 + DEX` (`engine.js:276`), ignoring equipped armor; no finesse-weapon handling; no tool proficiencies; no concentration model. | Spec §14.2 lists these as required. They belong in the tested engine, not the UI. |

**Verdict:** stable at its current size; **not** structured for a redesign of this magnitude. The required changes
are substantial, justifying a dedicated branch and a re-platform of the UI layer.

---

## 3. Target architecture

### 3.1 Stack

| Concern | Choice | Rationale |
|---|---|---|
| **Build tool** | **Vite** | Zero-config dev server with HMR; outputs plain static assets (`dist/`) that drop onto any static host — preserves the deploy constraint. First-class PWA support via plugin. |
| **UI library** | **Preact** (`preact` + `preact/compat`) | ~4 KB runtime; React-compatible mental model that is exhaustively documented (good for "ongoing support" — future contributors/agents already know the patterns). Components give the partial-render boundary the current code lacks. |
| **Reactivity** | **`@preact/signals`** | Fine-grained reactive primitives. A signal change re-renders only the components that *read* it — this is precisely the "re-render only what changed" behavior spec §16.1 demands, achieved declaratively instead of by hand. |
| **Language** | **TypeScript** (incremental, `allowJs: true`) | The character/record data model is the source of most latent bugs (optional fields, shape drift across 2014/2024 rules). Types make the data model explicit and refactors safe. Migrate file-by-file; JS and TS coexist during the transition. |
| **PWA / offline** | **`vite-plugin-pwa`** (Workbox) | Replaces the hand-written `sw.js` + manual `CACHE_NAME` bumping with content-hashed precaching and automatic cache invalidation — removes a recurring manual step and a class of stale-cache bugs. |
| **Testing** | **Vitest** (+ keep existing `node test_*.js`) | Vite-native, Jest-compatible API. Existing engine/parser/sync tests port with near-zero change; adds component testing via `@testing-library/preact`. |
| **Styling** | Keep `index.css` (CSS custom properties already in place) | No need to adopt a CSS framework. Optionally scope per-component later via CSS Modules (Vite-native). Out of scope for the rebuild. |

### 3.2 Alternatives considered

- **Stay vanilla, modularize only (no build).** Lowest risk, preserves zero-tooling deploy, but the hand-rolled
  re-render/handler-rebinding model remains the ceiling. The spec's interaction density would keep fighting it.
  Rejected as the *primary* path, but its module decomposition (§3.3) is adopted regardless.
- **Lit (web components).** Excellent, standards-based, even more incremental (mount a custom element into existing
  DOM). Strong second choice. Preact preferred for the larger documentation base and `signals`' ergonomic
  fine-grained reactivity, which maps directly onto the "tap any number for its breakdown" requirement.
- **Svelte / SvelteKit.** Smallest output, great DX, but a larger paradigm shift and more compiler "magic"; SvelteKit
  pulls toward SSR/routing this app doesn't need. Overkill for a client-only PWA maintained by a small team.
- **React (full).** Same model as Preact at ~10× the runtime size for no benefit here.

### 3.3 Project layout

```
src/
  main.tsx                     # mounts <App/>, registers SW
  app.tsx                      # shell: sidebar + router outlet
  state/
    stores.ts                  # signals: currentCharacter, ui state, caches
    persistence.ts             # debounced save → db.js; load on boot
  data/
    db.ts                      # (moved from db.js, typed)
    sync.ts                    # (moved from sync.js)
    conflict.ts  storage.ts
    parser-5etools.ts          # (moved, typed)
    types.ts                   # Character, CompendiumRecord, Modifier, Breakdown…
  engine/
    engine.ts                  # calculateCharacterState — returns breakdowns
    engine.test.ts
  compendium/                  # browser: facets, list, detail (migrated from app.js)
    CompendiumView.tsx  FacetPane.tsx  DetailPane.tsx  getDetailHTML.tsx
  sheet/
    CharacterSheet.tsx         # tab shell + persistent header
    Header.tsx  ConditionsBar.tsx
    tabs/
      CombatTab.tsx            # quick actions, attacks, modifiers, counters, rest
      StatsTab.tsx             # ability cards, skills, tools, languages
      FeaturesTab.tsx
      InventoryTab.tsx
      SpellsTab.tsx
    panels/
      BestiaryPanel.tsx  ProfilePanel.tsx  QuickLookupPanel.tsx
    wizard/                    # creation + level-up flows
  shared/
    Breakdown.tsx              # generic "tap a number → formula popup"
    ModifierEditor.tsx         # reusable, used by every create/edit modal
    HpModal.tsx  RestWizard.tsx  ItemEditModal.tsx
    markdown.tsx               # parseMarkdown w/ {@tag} → clickable refs
index.html                     # Vite entry (thin)
public/                        # icon, manifest, SRD xml, static assets
```

The non-UI modules (`engine`, `data/*`) move largely intact; the UI sections currently delimited by banner
comments in `app.js` (Combat, Stats & Skills, Features, Inventory, Spells, Bestiary, Notes) become the files under
`sheet/`.

---

## 4. Key architectural patterns

### 4.1 State as signals (replaces 24 globals + full re-render)

```ts
// state/stores.ts
export const currentCharacter = signal<Character | null>(null);
export const activeTab        = signal<TabId>('combat');
export const expandedRowId    = signal<string | null>(null);   // inline expansion
export const allRecords       = signal<Record<string, CompendiumRecord[]>>({});

// Derived: recomputed only when currentCharacter changes; memoized.
export const charState = computed(() =>
  currentCharacter.value ? calculateCharacterState(currentCharacter.value) : null
);
```

- A component that renders `charState.value['ac']` re-renders **only** when AC changes — not when an unrelated
  counter ticks. This is the spec's §16.1 requirement, for free.
- Mutations go through small action helpers (`updateHp`, `toggleCondition`, …) that write the signal and trigger
  the debounced save. No more "any function mutates any global."

### 4.2 Persistence (reuse existing layers)

`db.js`, `sync.js`, `conflict.js`, `storage.js` are kept. A single effect subscribes to `currentCharacter` and
calls the existing debounced-save path; boot loads from IndexedDB into the signals. **The LWW sync rules,
`_modified_at` semantics, and the compendium-vs-character distinction do not change.**

### 4.3 Engine breakdown API (the load-bearing change)

The engine stops discarding provenance. Each resolved target returns the value **and** its contributions:

```ts
interface Breakdown {
  total: number;
  base: { label: string; value: number };
  parts: { label: string; value: number; op: 'add'|'set'|'min'|'max' }[];
}
// e.g. AC → { total: 18, base:{label:'Studded Leather',value:14},
//             parts:[{label:'DEX',value:2,op:'add'},{label:'Shield',value:2,op:'add'}] }
```

- `calculateCharacterState` returns `Record<string, Breakdown>` (a `.total` getter preserves the old flat-number
  call sites during migration).
- The shared `<Breakdown>` component renders any of these as the tap-to-expand popup the spec mandates — one
  component serves AC, initiative, speed, saves, skills, attack bonuses, spell DC/attack.
- This is **engine work, fully unit-testable**, not UI guesswork.

### 4.4 Cross-reference links (`{@tag}`)

`shared/markdown.tsx` parses 5etools `{@spell …}` / `{@condition …}` / `{@item …}` etc. into elements carrying
`data-ref-type` / `data-ref-name`. A delegated handler opens the referenced entity in the Quick Lookup panel.
(Game-Reference spec §5.) The detail HTML itself is the existing `getDetailHTML` output, reused verbatim inline.

*Completed in Phase 8: `src/utils/parseTagMarkup.ts` + `src/components/shared/TagText.tsx`. Applied to feature and spell description paragraphs. Quick Lookup panel (`QuickLookupPanel.tsx`) triggered by Ctrl/⌘+K or 🔍 header button; cross-store search via `__legacySearchCompendium` bridge.*

---

## 5. Data-model additions (spec §14.1) — typed

To be added to `data/types.ts` and the `Character` interface:

| Field | Type | Purpose |
|---|---|---|
| `pinnedActions` | `{ sourceList: string; sourceId: string }[]` | Quick Actions panel *(Completed in Phase 2)* |
| `conditions` | `{ name: string; effects?: string; isConcentration?: boolean; spellName?: string }[]` | Conditions bar *(Completed in Phase 2)* |
| `attunementMax` | `number` (default 3) | Attunement override *(Completed in Phase 4)* |
| `toolProficiencies` | `{ name: string; attr: string; profLevel: number }[]` | Tool prof tracking *(Completed in Phase 1)* |
| `weightTrackingEnabled` | `boolean` (default true) | Carry-weight toggle *(Completed in Phase 4)* |
| `collapsedLists` | `Record<string, boolean>` | Persist list collapse state |
| `levelHistory` | `LevelHistoryEntry[]` (full delta) | Level-down / respec audit *(Completed in Phase 7)* |

Class records gain a parsed `startingEquipment` (spec §14.3). All additions are backward-compatible (optional,
defaulted on load) so existing saved characters keep working.

---

## 6. Engine & parser enhancements (spec §14.2 / §14.3)

**Engine (`engine/engine.ts`):**
- Breakdown return type (§4.3). *(Completed in Phase 1)*
- **Armor AC**: detect equipped armor's `armorAC` (base + max-DEX + stealth flag) instead of `10 + DEX`. *(Completed in Phase 1)*
- **Finesse**: weapons with the Finesse property compute both STR and DEX lines and use the higher. *(Completed in Phase 1)*
- **Tool proficiency** as skill-like: `attrMod + profLevel × profBonus`. *(Completed in Phase 1)*
- **Concentration**: toggling a concentration spell to Active sets the `Concentrating` condition (prompt to drop an existing one). No rule *enforcement* — trust the player (§0.1.2). *(Completed in Phase 2)*
- Multi-ability spellcasting already supported via `spellLists[].spellcastingAbility`; formalize per-list DC/attack.

**Parser (`data/parser-5etools.ts`):**
- Extract `startingEquipment` from class data. *(Completed in Phase 1)*
- Structured `properties[]` for weapons (Finesse/Light/Heavy/Thrown/Versatile…). *(Completed in Phase 1)*
- Structured `armorAC` for armor items. *(Completed in Phase 1)*
- Boolean `isRitual` / `isConcentration` spell flags. *(Completed in Phase 1)*
- Standard conditions list (parse or bundle as static SRD data) for the conditions picker + reference. *(Completed in Phase 2)*

Each is covered by a unit test in the existing `node`/Vitest harness.

---

## 7. Build, deploy & offline

- `npm run dev` → Vite dev server with HMR (replaces `python3 -m http.server 8085`).
- `npm run build` → static, content-hashed `dist/`. **Commit the source; build is part of the release step**
  (CI or a pre-commit/pre-release script can run `vite build`). The hosted artifact remains pure static files.
- `vite-plugin-pwa` (Workbox) generates the service worker with precache manifests and automatic invalidation,
  **retiring the manual `CACHE_NAME` version bumps** in `sw.js` and the stale-cache failure mode they cause.
- Offline behavior is preserved/improved: app shell + assets precached; IndexedDB data layer unchanged; Dropbox
  calls stay network-only (existing rule in `sw.js` carries over to the Workbox runtime-caching config).

---

## 8. Testing strategy

- Port `test_engine.js`, `test_5etools_parser.js`, `test_sync.js` to Vitest (Jest-compatible — minimal edits). They remain runnable under `node` during the transition. *(Completed in Phase 0)*
- **Add engine breakdown tests** as the safety net for the §4.3 change (golden-value assertions per target). *(Completed in Phase 1)*
- Component tests via `@testing-library/preact` for the high-risk interactive pieces: Breakdown popup, ModifierEditor, HP modal, Rest wizard. *(Completed in Phase 2)*
- CI gate: typecheck (`tsc --noEmit`) + `vitest run` + `vite build` must pass.

---

## 9. Migration strategy — incremental "strangler", not big-bang

The goal is to **never have a long-lived broken state**. The existing `app.js` keeps running while pieces move
behind it.

1. **Scaffold.** Add Vite + TS + Preact + plugins. Wrap the *current* app as-is so it builds and runs under Vite (the monolith can be imported as a side-effecting module initially). Ship nothing new yet; prove the toolchain and PWA output. *(Completed in Phase 0)*
2. **Foundation.** Move `engine`, `db`, `sync`, `parser`, etc. into `src/` and add types + the **breakdown engine** with tests. No UI change yet — old UI consumes `.total`. *(Completed in Phase 1)*
3. **State layer.** Stand up `state/stores.ts` signals + persistence effect; have the legacy sheet read/write through them. This decouples state from the render loop before touching components. *(Completed in Phase 1)*
4. **Tab-by-tab replacement.** Replace one sheet tab at a time with a Preact component mounted into the existing shell slot, newest spec behavior included. Order follows the spec's own phasing (Combat → Stats → Inventory → Spells → Features), each behind the new state layer. The compendium browser migrates last (it's stable and self-contained). *(Combat Tab completed in Phase 2, Stats & Skills Tab completed in Phase 3)*
5. **Shell + panels.** Replace the app shell, conditions bar, slide-out panels (Bestiary, Profile, Quick Lookup), and wizards.
6. **Delete `app.js`.** Once every section is migrated, remove the monolith and the hand-written `sw.js`.

Each step is independently shippable and reviewable. A feature flag or route can gate "new sheet" vs "legacy sheet"
until parity is reached.

---

## 10. Phased execution (maps to spec §17)

| Phase | Deliverable | Depends on |
|---|---|---|
| **DONE: 0 — Toolchain** | Vite + TS + Preact + PWA scaffold; legacy app runs under build; tests ported to Vitest.; update github action to build under new model (keep up to date with current actions) | — |
| **DONE: 1 — Foundation** | Typed data layer; **breakdown engine** + armor AC + finesse + tool-prof + concentration; signal state store; persistence effect; escaping handled by component rendering (no raw `innerHTML`). | 0 |
| **DONE: 2 — Combat tab** (spec Phase 1) | Breakdown popup, HP modal, conditions bar, rest wizard, quick actions, active-modifiers section. | 1 |
| **DONE: 3 — Stats & Skills** (spec Phase 2) | Ability cards w/ breakdowns, skill proficiency cycling, tool proficiencies, attribute override. | 1 |
| **DONE: 4 — Inventory** (spec Phase 3) | Equipped/Carried/Stored tiers + drag, attunement, carry capacity, quantity. | 1 |
| **DONE: 5 — Spells** (spec Phase 4) | Per-list DC/attack, slot tracker, concentration integration, filters, custom spell creation, pact slot tracker, concentration interlocking with conditions bar. | 1 |
| **DONE: 6 — Features + Homebrew** (spec Phase 5) | Feature lists, collapse persistence, ModifierEditor, create/edit modals, class resync diff. | 1 |
| **DONE: 7 — Creation & Leveling** (spec Phase 6) | Starting-equipment step, level-up review, level-down/respec, level history. | 3,4,5,6 |
| **DONE: 8 — Integration & Reference** (spec Phase 7 + Game-Reference spec) | Inline compendium expansion, Quick Lookup panel, `{@tag}` cross-ref links, batch picker. | 2–6 |
| **9 — Backlog** | Address any tracked backlogged or deferred items which are not already fixed. | 
| **10 — Cutover** | Migrate compendium browser; delete `app.js`/`sw.js`; remove legacy flag. | all |
| **11 - Technical Documentation** | Update Architecture.md and related documents to match revised architecture to support future changes. |


---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Re-platform stalls half-done | Strangler approach keeps the app shippable after every phase; legacy sheet stays behind a flag until parity. |
| Engine breakdown change regresses math | Golden-value unit tests written *before* the refactor; `.total` shim keeps old call sites working. |
| Build step disrupts the "just static files" workflow | Output is still static; document a one-command release (`vite build`) and optionally a pre-commit hook. Source-of-truth stays in git. |
| Saved-character incompatibility | All new fields optional + defaulted on load; add a tiny load-time `migrateCharacter()` that backfills. |
| Dropbox sync subtleties | `sync.js`/`conflict.js` reused unchanged; no change to `_modified_at` / LWW semantics. |
| Scope creep from "trust the player" violations | Re-affirm §0.1.2: no rule enforcement; calculations inform, never block. |
| TypeScript slows initial velocity | `allowJs` + incremental adoption; type the data model first (highest ROI), loosen elsewhere. |

---

## 12. Open decisions (for sign-off before Phase 0)

1. **Confirm the stack** (Vite + Preact + Signals + TypeScript + vite-plugin-pwa + Vitest), or swap Preact→Lit.
2. **TypeScript now or later** — recommended now (incremental); acceptable to defer to JS-only if preferred.
3. **Release workflow** — CI builds `dist/` vs. committing `dist/` vs. a pre-commit build hook.
4. **Legacy flag duration** — keep both sheets switchable until Phase 9, or hard-cut per tab.
5. **Conditions/rules reference data** — parse from 5etools vs. bundle a small static SRD set.
6. **Enriched Data/Rules** - Some data may be unavailable in 5etools raw data - how should this be managed?

## 13. Backlog

*Running list of all items that need to be addressed. Should be reviewed prior to dev of each step in case it is a dependency. Review at stage 9 of section 10 for open items. As items are completed, mark complete*

- [x] Magic bonus (e.g. +1 Club) not applying to total combat bonus
- [x] Clicking on item for popup of how things are added up does not show damage, only attack. Should show both. *Fixed: BreakdownPopup now accepts `extras` prop; attack popups include damage formula row.*
- [x] Applied conditions should have popup when clicked on show the effect of the condition. *Fixed: clicking a condition chip name opens ConditionPopup with full mechanical effects list; × still removes directly.*
- [x] LOW PRIORITY: Jack of All Trades should be applied as a bonus to all non-proficient skills based on class feature, not toggled manually in skills. *Fixed: engine.ts detects Bard level ≥ 2 (or feature named "Jack of All Trades") and auto-applies half-prof (floor) to non-proficient skills.*
- [ ] Supernatural boon for Goliath doesn't appear in character creator. Should be able to select as an ability. *Deferred — requires changes to the legacy creation wizard; out of scope until Phase 10 cutover.*
- [x] Make all entities available for pinning - beasts, items, spells, in addition to things on the Combat tab already. *Fixed: QuickActionsSection picker now includes Spells (from character.spells flat array, fixing prior bug), Features, and Counters. Feature and Counter cards added.*
- [x] CRITICAL: Cannot navigate between tabs in character sheet. *Root cause: setupCharacterSheetEvents() in app.js threw TypeError on null elements (cs-btn-inspiration, cs-btn-short-rest, cs-btn-long-rest, cs-hp-temp-btn, cs-btn-add-item-list, cs-btn-add-spell-list) that were removed when Preact replaced those tabs. Tab onclick wiring at the bottom of the function never ran. Fix: guarded all Preact-replaced elements with null checks.*
- [x] Items regressed. Instead of multiple items lists with toggles for carried/equipped, there are now multiple lists. Rever to prior behavior, common to all lists. *Fixed (2026-06): InventoryTab rebuilt with per-named-list sections. Each item row has separate equip (🛡️) and carry (🎒) toggle buttons. Items stay in their named list; buttons independently set `active`/`selected`.*
- [x] Spells - add back edit to spell list to change which attribute is used for spell casting. *Fixed (2026-06): `ListHeader` in SpellsTab now shows the ability badge as a clickable button; clicking reveals an inline `<select>` dropdown (STR/DEX/CON/INT/WIS/CHA); selecting saves via `patchCharacter({ spellLists: [...] })`.*
- [x] Items - cannot add from compendium. Revert to prior approach with add button on each individual equipment list. *Fixed (2026-06): `handleOpenPicker` was calling `window.openPicker` (undefined) instead of `window.__legacyOpenPicker`. Fixed; each list section also has its own `+ Add` button calling `__legacyOpenPicker('items', listId)`.*
- [ ] Bestiary - cannot add pets/mounts/etc from bestiary. Click add, does nothing. *Needs investigation — bestiary is still legacy DOM; `openPicker('monsters', listId)` should work but user reports it does nothing. Likely requires running the app to test.*
- [x] Adding custom item does not let me set properties for weapons or armor, no modifiers for magical effects. Should be able to add multiple modifiers to items, feats, abilities. *Fixed (2026-06): Custom item creator now has weapon section (damage dice, damage type, comma-separated properties), armor/shield section (AC value), and a dynamic modifier list (target stat, type add/set, value). Modifiers use the `Modifier` type from `types.ts`.*
- [x] Custom feats won't let me add modifiers. Should let me add multiple modifiers to anything custom. *Fixed (2026-06): `CustomFeatureModal` now has a `Modifiers (when active)` section with + Add Modifier button. Each modifier row: stat select, type select (add/set/min/max), value input, remove button.*
- [x] Display semi-formatted markdown tables as tables, example from Augury spell. *Fixed (2026-06): Created `MarkdownContent` Preact component that calls `window.__parseMarkdown` (newly exposed from app.js). `SpellRow` and `FeaturesTab` now use `MarkdownContent` instead of `TagText` — spell texts are joined with `\n` and fully parsed (tables, bold, italic, links, lists, headers).*

```

Omen | For Results That Will Be...

--- | ---

Weal | Good

Woe | Bad

Weal and woe | Good and bad

Indifference | Neither good nor bad


```
