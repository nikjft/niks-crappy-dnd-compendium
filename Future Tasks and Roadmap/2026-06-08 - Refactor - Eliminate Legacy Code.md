# Refactor Specification — Eliminate Legacy Code

## Context

`app.js` (8,902 lines) is the pre-Preact monolith. The five main character-sheet tabs (Combat, Stats, Inventory, Spells, Features) have been migrated to Preact and mount into root `<div>`s; app.js now only *shows/hides* those tab panels and bridges data via `window.__dndStore` + ~17 `window.__legacy*` functions.

A survey for this refactor found that **most of app.js is still live** (compendium browser, character roster, modals, sync) — those are "old" but not removable without rebuilding features. However, a meaningful amount of code is **genuinely dead or superseded**, and **two character-sheet tabs (Bestiary, Notes) are still rendered the old way** even though every other tab is Preact.

**Owner decision (scope):** *Dead code + back-compat shims + migrate Bestiary & Notes to Preact.* This makes the entire character sheet Preact-owned and lets us delete the last DOM-string renderers, without the much larger job of migrating the compendium browser / roster / modals. Breaking changes are acceptable — there are no legacy-format characters or content in the wild to preserve.

**Explicitly NOT in scope:** migrating the compendium browser, character roster, creation/level-up/import modals, or sync out of app.js; deleting app.js entirely. (Those remain a future "full elimination" effort.)

This spec is written for a lighter-weight implementation model. Steps are ordered; each has acceptance criteria. **Verify, don't assume** — several deletions are gated on confirming a DOM id is absent or a function has no remaining callers.

---

## Key Facts (from survey)

- **Tab switching** (app.js ~4807, ~8655–8665): app.js toggles `.active` on `.cs-tab-btn` / `.cs-tab-panel`. Preact tabs are always-mounted into their root divs; app.js just shows/hides panels. **New tabs follow the same pattern** — add a mount div, render once, let app.js keep handling show/hide. No tab-switching rewrite needed.
- **Combat/Stats list IDs are already gone from `index.html`** (`cs-attacks-list`, `cs-modifiers-list`, `cs-counters-list`, `cs-inventory-lists-container`, `cs-spells-lists-container` do not exist). So the app.js code writing to them is dead.
- **`renderListSection` (app.js ~7293) + `renderListRow` (~7174)** are called from exactly three places: the dead features block (8346), dead inventory block (8381), and the **live bestiary block (8410)**. Once the dead blocks are removed and Bestiary is migrated, **both functions become orphaned (~300 lines) and are deletable** — after confirming no other callers.
- **Bestiary data:** `character.bestiary` (array of companions w/ `hp_max`/`hp_current`, `type`, `size`, `cr`, `listId`) + `character.bestiaryLists` ([{id,name}]). Add list button `#cs-btn-add-beast-list` (8649); add-from-compendium uses existing bridge `__legacyOpenPicker('monsters', listId)`.
- **Notes data:** `character.notes` = `{ alignment, age, height, weight, freeNotes: [{title, content}] }`. Profile inputs bound at 8412–8423; freeform notes rendered + edited via `openNoteModal` (8463) and `#cs-note-modal`.
- **XML import is already removed** (`parser.js:82` "XML Legacy code removed"). Only remnants: a dead `sw.js` asset line and the abbreviation-constants file `parser.js` (still used as fallback by `parser-5etools.js` — keep, optional relocate).

---

## The Existing Preact Tab Pattern (mirror this)

Each tab: a component in `src/components/<tab>/`, reads `currentCharacter.value` from `src/state/stores.ts`, mutates via `patchCharacter({...})`, mounted once in `src/main.tsx` via `render(<Tab/>, document.getElementById('<tab>-root'))`. Use `MarkdownContent` (`src/components/shared/MarkdownContent.tsx`) for rich text, and material-icons for buttons. Follow `InventoryTab.tsx` for list-with-rows + add/delete, and `CountersSection.tsx` for +/− HP-style steppers.

---

## Implementation Sequence

### Workstream 1 — Delete genuinely dead code (no behavior change) ✅ COMPLETE (2026-06-08)
1. **app.js dead render blocks** inside `renderCharacterSheetUI` — remove:
   - Features list block (~8234–8347) — writes to hidden, Preact-owned `#cs-features-lists-container`.
   - Inventory list block (~8376–8383) — target id absent.
   - Spells list block (~8402–8403) — target id absent.
   - Legacy summary-field writes (~8230–8232) for `cs-summary-species/background/subclass`.
2. **Verify-then-remove other dead branches** in `renderCharacterSheetUI`: for every `document.getElementById('X')` in the function, grep `X` against `index.html`. If absent (e.g. `cs-attacks-list`, `cs-modifiers-list`, `cs-counters-list`, and the skills/saves containers — **verify each**), the branch is dead → remove it. **Keep** branches whose ids exist in the legacy `cs-header` (HP `cs-hp-current`/`cs-hp-max`/`cs-hp-temp`, death-save checkboxes, inspiration, the `spells` tab-button show/hide at ~7849).
3. **`__legacyOpenModifierModal`** (app.js ~8688) — unused by Preact (Modifiers uses Preact's own `ModifierModal`). Remove the function and, after confirming nothing else opens it, the `#cs-modifier-modal` markup in `index.html`.
4. **`sw.js`** — remove the dead `'./source-data/System_Reference_Document_5.5e.xml'` cache entry (file doesn't exist).
5. **Legacy Node test runners** — delete `test_engine.js`, `test_5etools_parser.js`, `test_sync.js` (superseded by Vitest in `src/tests/`), and remove the `test:legacy` script from `package.json` if present.
6. **Remove now-orphaned hidden DOM** in `index.html`: `#cs-features-lists-container` and the three `cs-summary-*` spans (once their writers from step 1 are gone).

**Acceptance:** app build runs; opening a character sheet shows all five existing tabs identically; no console errors; `grep -n "getElementById" app.js` inside `renderCharacterSheetUI` returns only ids that exist in `index.html`.

**Implementation notes (2026-06-08):**
- All six acceptance steps completed and verified: build ✅, 63/63 tests ✅
- Death-save checkbox IDs (`cs-death-s-*`, `cs-death-f-*`) are absent from index.html (were never added to the migrated header) but code is guarded by `if (chk)` null checks — silent no-ops, not errors. Left for W2 or later cleanup.
- `cs-btn-add-feature-list` retained in index.html — still live in `setupCharacterSheetEvents` (app.js line ~8248).
- `saveCustomModifierModal()` function removed (dead after Preact ModifierModal owns modifiers).

### Workstream 2 — Back-compat shims for data that no longer exists
1. **`parser.js`** — the file is now only XML-era abbreviation constants (`ITEM_TYPES`, `SPELL_SCHOOLS`, `MONSTER_SIZES`, `DAMAGE_TYPES`) used as fallbacks by `parser-5etools.js`. **Keep the constants** (still referenced). *Optional:* relocate them into `parser-5etools.js` and delete `parser.js`, updating the import. Mark optional — low value, do last if at all.
2. **`migrateCharacter` (app.js ~7124) + `assignListIds` (~7104)** — these backfill defaults for pre-existing characters. Since there are "no legacy characters," they are defensive only. **Recommended: KEEP** (cheap insurance; a missing field would crash a tab). If the owner insists on removal, that is a separate, riskier change — leave it for now and note in the backlog.
3. Remove the stale "removed" comments that no longer add value (e.g. app.js ~4287, ~8400–8401) as you touch those areas.

**Acceptance:** existing saved characters open without error after the changes.

### Workstream 3 — Migrate Bestiary to Preact
1. **Types** (`src/data/types.ts`): replace `bestiaryLists?: unknown[]` and add proper shapes:
   ```ts
   export interface BestiaryList { id: string; name: string; }
   export interface Companion {
     id?: string; name: string; listId?: string;
     hp_max?: number; hp_current?: number;
     type?: string; size?: string; cr?: string;
     compendiumId?: string; texts?: string[];
     [key: string]: unknown;
   }
   ```
   Update `Character` to `bestiary?: Companion[]; bestiaryLists?: BestiaryList[];`.
2. **`src/components/bestiary/BestiaryTab.tsx`** (new): read `currentCharacter.value`; group `bestiary` by `bestiaryLists`; render each companion as a row with name/type/size/CR, an HP stepper (mirror `CountersSection` +/−, writing `hp_current`), expand for `texts` via `MarkdownContent`, and a delete button. Per-list "+ Add Companion" → `window.__legacyOpenPicker('monsters', listDef.id)` (existing bridge). Bottom "+ Add Companion List" → `patchCharacter` appending a new `BestiaryList` (replicate the logic from app.js `#cs-btn-add-beast-list` handler ~8649, but inline via `patchCharacter`). New `src/bestiary.css` (mirror existing tab CSS).
3. **`index.html`**: inside `#cs-tab-bestiary`, replace the legacy header + `#cs-bestiary-lists-container` markup with a single `<div id="bestiary-root"></div>`.
4. **`src/main.tsx`**: `import { BestiaryTab }` and `render(<BestiaryTab/>, document.getElementById('bestiary-root'))`.
5. **app.js cleanup**: remove the bestiary render block (~8405–8410), the `#cs-btn-add-beast-list` handler (~8649), and any beast-only modal/handler now unused.

**Acceptance:** Bestiary tab renders companions, HP +/− works and persists, add-from-compendium adds a companion that appears immediately, add/rename/delete companion list works, delete companion works — all with no page reload.

### Workstream 4 — Migrate Notes to Preact
1. **Types** (`src/data/types.ts`): 
   ```ts
   export interface NoteEntry { title: string; content: string; }
   export interface CharacterNotes {
     alignment?: string; age?: string; height?: string; weight?: string;
     freeNotes?: NoteEntry[]; [key: string]: unknown;
   }
   ```
   Update `Character.notes?: CharacterNotes`.
2. **`src/components/notes/NotesTab.tsx`** (new): a Profile card with four text inputs (alignment/age/height/weight) bound to `notes.*` via `patchCharacter({ notes: { ...notes, [field]: val } })`; and a Notes card listing `notes.freeNotes` as cards with title + rendered content (use `MarkdownContent` or the existing bold/italic/newline transform), each with edit/delete. "+ Add Note" and edit open a small Preact modal (mirror `CustomFeatureModal.tsx`); save writes back through `patchCharacter`. New `src/notes.css`.
3. **`index.html`**: replace the entire `.cs-notes-layout` markup inside `#cs-tab-notes` with `<div id="notes-root"></div>`.
4. **`src/main.tsx`**: mount `NotesTab` into `notes-root`.
5. **app.js cleanup**: remove the notes/profile block (~8412–8456), `openNoteModal` (~8463), `noteEditIndex`, the note-modal wiring (~8584–8585), and the `#cs-note-modal` markup in `index.html`.

**Acceptance:** Profile fields load existing values, edits persist; notes add/edit/delete works with markdown rendering; no reload needed; no console errors.

### Workstream 5 — Remove shared orphans exposed by the migration
1. **`renderListSection` (~7293) + `renderListRow` (~7174)**: after Workstreams 1 & 3, grep both names across `app.js` — if the only remaining references are their own definitions, delete both functions (~300 lines) and any beast/feature/item-only helpers they call that are now unused.
2. **Legacy CSS**: in `index.css`, remove rules that styled the just-removed legacy markup (bestiary list rows, `.cs-note-card`/note modal, the dead list containers) — **only after confirming** the class names are not used by the new Preact components or any still-live app.js DOM (grep each class across `src/` and `app.js`).
3. **Bridge audit**: confirm no `window.__legacy*` function became unreferenced (grep each name across `src/`). Remove any that did. `__legacyOpenPicker` stays (still used by Inventory/Spells/Features/Bestiary).

**Acceptance:** no dead references; build clean; bundle smaller; every `window.__legacy*` definition has at least one `src/` caller.

---

## Files To Create / Modify / Delete

| File | Action |
|---|---|
| `app.js` | Remove dead render blocks (W1), dead branches (W1), `__legacyOpenModifierModal` (W1), bestiary render + add-list handler (W3), notes render + `openNoteModal` + note-modal wiring (W4), `renderListSection`/`renderListRow` (W5), stale comments |
| `index.html` | Replace `#cs-tab-bestiary` body with `#bestiary-root`; replace `#cs-tab-notes` body with `#notes-root`; remove `#cs-features-lists-container`, `cs-summary-*`, `#cs-modifier-modal`, `#cs-note-modal` |
| `src/main.tsx` | Mount `BestiaryTab` → `bestiary-root`, `NotesTab` → `notes-root`; import their CSS |
| `src/data/types.ts` | Add `BestiaryList`, `Companion`, `NoteEntry`, `CharacterNotes`; tighten `Character.bestiary*` / `notes` |
| `src/components/bestiary/BestiaryTab.tsx` | **New** |
| `src/bestiary.css` | **New** |
| `src/components/notes/NotesTab.tsx` (+ note modal) | **New** |
| `src/notes.css` | **New** |
| `index.css` | Remove orphaned legacy-tab CSS (W5, verify-first) |
| `sw.js` | Remove dead XML asset line (W1) |
| `package.json` | Remove `test:legacy` script if present (W1) |
| `test_engine.js`, `test_5etools_parser.js`, `test_sync.js` | **Delete** (W1) |
| `parser.js` | Keep (optional relocate+delete, W2) |
| `docs/*` | Update architecture docs to note Bestiary/Notes are now Preact and the listed legacy code is gone |

---

## Out Of Scope
- Compendium browser, character roster, creation/level-up/import modals, sync — stay in app.js.
- Deleting app.js.
- Removing `migrateCharacter`/`assignListIds` (kept as insurance; revisit separately).
- Changing IndexedDB schema or the `Character` data shape on disk (types are tightened, not restructured).

---

## Test & Build Impact
- Deleting `test_*.js` removes the legacy Node runners only; the Vitest suite (`src/tests/`) is unaffected.
- New components may warrant tests mirroring `inventory.test.tsx` (companion HP stepper; note add/edit/delete) — add if time allows.
- Run `npm test -- --run` and `npm run build`; fix any TS errors from the tightened types (some `as any` casts around `bestiary`/`notes` may now type-check properly or need adjustment).

## Verification (end-to-end)
1. `npm run build` — succeeds, no TS errors.
2. `npm test -- --run` — all pass.
3. Launch the app (use the `run` skill) and, on an **existing** character:
   - All seven tabs switch correctly (Combat, Stats, Features, Inventory, Spells, **Bestiary**, **Notes**).
   - **Bestiary:** add a companion list; add a monster from the compendium (appears without reload); adjust its HP +/−; expand details; delete it; delete the list.
   - **Notes:** profile fields show saved values and persist on edit; add/edit/delete a freeform note with **bold**/*italic*/newlines rendering.
   - Combat/Stats/Inventory/Spells/Features unchanged.
   - Reload the page — Bestiary and Notes state persisted.
4. Confirm cleanup: `grep -rn "renderListSection\|renderListRow\|openNoteModal\|__legacyOpenModifierModal\|cs-bestiary-lists-container\|cs-freeform-notes-list" app.js index.html` returns nothing; every `window.__legacy*` definition has a `src/` caller.

## Process
Significant change → create a branch, implement, test locally, merge to main, commit, sync. Update `todo.md` (mark the "Eliminate legacy code" item `*DONE*`). Update `docs/*` architecture notes. If any sub-item is deferred (e.g. the optional `parser.js` relocate, or `migrateCharacter` removal), append it to the bottom of the backlog with rationale.
