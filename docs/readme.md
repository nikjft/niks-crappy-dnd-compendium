# Developer Orientation & Getting Started Guide

This guide compiles the key information needed for developers and AI agents to orient themselves on the codebase of **Nik's Crappy D&D Compendium** and get started with modifications.

---

## 1. Application Philosophy

1. **Digital Paper, Not a VTT**: The app tracks state and math but does not roll dice or automate gameplay decisions. Trust the player.
2. **Calculation Transparency**: The app's core value proposition is showing *why* a derived stat is what it is. Derived statistics on the sheet display exact mathematical breakdowns showing each contribution (e.g. `AC = 14 (studded leather) + 2 (DEX) + 2 (shield) = 18`).
3. **No Heavy Rule Enforcement**: Do not block illegal player actions (e.g., preparing too many spells). Inform the player, but never restrict them.

---

## 2. Technical Architecture Snapshot

- **Frontend Core**: Preact (`preact` + `@preact/signals`) for reactivity. Vite for building and HMR. No backend server.
- **Data Persistence**: IndexedDB (via `db.js`) serves as the local database. Bidirectional Dropbox integration (via `sync.js`) enables optional cloud synchronization.
- **Routing & Navigation**: Client-side single-page UI panels shown/hidden via state changes. Deep linking is supported by encoding category and item keys in URL query parameters.
- **Deployment**: Static file output in `dist/` configured with a base path of `/niks-crappy-dnd-compendium/` for hosting on GitHub Pages.

---

## 3. Data Flow & Calculations

### Ingesting Compendium Data
1. Importer fetches JSON payloads from a 5etools mirror (configurable in settings).
2. Data is parsed and normalized by `parser-5etools.js`.
3. Records are stored in IndexedDB stores (spells, items, monsters, classes, backgrounds, races, feats, options, etc.).

### Stat Engine Calculation Loop
1. When a character is selected, the engine (`src/engine/engine.ts`) receives the character state.
2. It processes active equipment, spells, features, options, and direct modifiers.
3. It evaluates formula strings (e.g., `2 * {char.level}`) using a safe evaluator.
4. It outputs a map of derived keys to `Breakdown` structures containing the total and all contributing parts.

---

## 4. How to Extend the Application

- **UI Components**: UI tabs live in `src/components/` (e.g., `src/components/combat/CombatTab.tsx`). Styles are located in tab-specific CSS files in `src/`.
- **Typings**: Consult `src/data/types.ts` for unified TypeScript definitions of all characters, equipment, features, and level-ups.
- **Calculations**: Add custom rules math to `src/engine/engine.ts`. Use static overrides in `feature-modifiers.js` for hardcoding calculations of complex rules not extractable from text descriptions.
- **Bridge to Legacy Panels**: For sections of the application still running on the legacy `app.js` loop (e.g., the compendium browser or the character creator wizard), interact with the reactive Preact state via the global `window.__dndStore` bridge.
