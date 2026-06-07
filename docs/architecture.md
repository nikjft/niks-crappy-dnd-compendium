# Nik's Crappy D&D Compendium — Architecture Overview

> **For agents:** Read this file first, then follow links to sub-documents for the area you're working in. Do **not** begin editing until you have read the relevant sub-doc.

## What This App Is

A **client-only, offline-capable PWA** (Progressive Web App) for D&D 5e/5.5e. It has no backend server. All data lives in the browser's **IndexedDB**. Optional cloud sync is done via **Dropbox**.

The app serves two purposes:
1. **Compendium** — Browse spells, items, monsters, races, backgrounds, classes, feats, etc. imported from [5etools](https://github.com/5etools-mirror-3/5etools-src).
2. **Character Sheet** — Create and manage characters with a full stat engine.

---

## File Map

| File | Role |
|------|------|
| `index.html` | Single HTML shell. All panes are pre-defined in markup; JS shows/hides them. |
| `index.css` | All styling (~73 KB). CSS custom properties drive the dark theme. |
| `app.js` | Monolith UI controller (~6800 lines). Contains all rendering, event wiring, navigation, settings, character sheet, and wizard logic. |
| `db.js` | IndexedDB abstraction layer. All reads/writes go through here. Exports `clearCompendium()` (preserves characters/favorites) and `clearDatabase()` (wipes everything). |
| `engine.js` | Headless stat calculator. Reads a character object, returns a flat `state` dict of resolved numbers. |
| `parser-5etools.js` | Ingestion adapter. Converts raw 5etools JSON → normalized internal records. |
| `parser.js` | Re-exports type constants (ITEM_TYPES, SPELL_SCHOOLS, etc.) from parser-5etools. |
| `sync.js` | Dropbox OAuth PKCE + bidirectional sync cycle. |
| `conflict.js` | Last-Write-Wins (LWW) merge strategy for sync conflicts. |
| `storage.js` | `navigator.storage.persist()` + quota monitoring. |
| `ui-sync.js` | Sync/storage status banners and badges rendered in the UI. |
| `feature-modifiers.js` | Static lookup table: `"FeatureName\|Source"` → modifier array. Used by engine. |
| `sw.js` | Service worker. Cache-first with background network update. Bump `CACHE_NAME` version to force cache invalidation. |
| `source-data/` | Bundled SRD XML (fallback data source, not primary). |

---

## Sub-Documents

Detailed breakdowns for each major subsystem:

- **[importer.md](./importer.md)** — GitHub fetch pipeline, source selection modal, parser dispatch, IndexedDB write.
- **[sync-engine.md](./sync-engine.md)** — Dropbox OAuth PKCE, sync cycle, LWW conflict resolution, storage persistence.
- **[compendium.md](./compendium.md)** — UI layout (4-pane model), category navigation, facet filtering, detail rendering, favorites.
- **[character-sheet.md](./character-sheet.md)** — Character data model, stat engine, character wizard, level-up flow, sheet rendering.

---

## Runtime Data Flow

```
GitHub raw JSON
      │  (fetch in showSourceSelectionModal / importFromGithub)
      ▼
parser-5etools.js  ←─ normalizes to internal schema
      │
      ▼
db.js saveRecords()  ←─ upsert into IndexedDB (named store per category)
      │
      ▼
allRecordsCache{}  ←─ in-memory cache populated on loadCategory()
      │
      ▼
app.js renderFacet1/2 → renderList → selectItem → getDetailHTML
```

---

## Key Design Decisions

1. **No framework.** Vanilla JS ES modules. No build step. Served by any static file server or `python3 -m http.server 8085`.
2. **All state lives in IndexedDB.** `allRecordsCache` is an in-memory mirror populated at category load time, never the source of truth.
3. **`_modified_at` ISO timestamp** on every record enables LWW sync without a server clock.
4. **`app.js` is a monolith by design.** Do not split it without a clear plan; many functions share top-level state variables (`currentCategory`, `selectedItem`, `currentCharacter`, etc.).
5. **Service worker caches JS/CSS.** After editing JS/CSS, bump `CACHE_NAME` in `sw.js` (currently `v27`; increment to force cache invalidation). Users may also need to hard-reload (Cmd+Shift+R) or unregister the SW via DevTools.
6. **XPHB vs PHB data shape differs.** XPHB (2024 rules) races/backgrounds use free-form ability selection in nested `entries` rather than structured `ability[]` arrays. The parser normalizes both; XPHB ability/language fields may be empty strings when the data is inherently free-form.
7. **Two distinct clear operations exist.** `clearCompendium()` wipes only compendium content stores (spells, items, monsters, etc.) and preserves `characters` and `favorites`. `clearDatabase()` clears **all** STORES including characters. `importAllData()` calls `clearDatabase()` by default; be careful not to use it as a re-import path without understanding this.

---

## Development Server

```bash
cd /Users/inik/Documents/git/niks-crappy-dnd-compendium
python3 -m http.server 8085
# → http://localhost:8085
```

After edits, hard-reload (Cmd+Shift+R in Chrome) to bypass the SW cache. If stale content persists, open DevTools → Application → Service Workers → Unregister, then reload.

---

## Known Issues / Active Bugs

See [todo.md](../todo.md) for the full backlog. **Do not fix backlog items unless explicitly instructed.**

Active known issues:
- Categories in equipment list are abbreviated (e.g. "T" instead of "Tools", "AT", "MNT", etc.).
- Source display in compendium details should support full book names instead of just abbreviations (e.g., "Tasha's Cauldron of Everything" instead of just "TCE").
- Artificer magic items list options: Artificer item replicate plans should be browsable options with descriptions or links rather than just tables.
- Cross-reference hyperlinks in 5eTools entries are not clickable.
- Adding items to list shows incorrect categories in the picker sidebar.
