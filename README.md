# Nik's Crappy D&D Compendium

An offline-first PWA for browsing D&D 5e/5.5e content and managing character sheets.
Data is sourced from [5etools](https://github.com/5etools-mirror-3/5etools-src) and stored locally in IndexedDB.
Optional cloud sync via Dropbox.

---

## Running locally

**Prerequisites:** Node.js ≥ 20, npm ≥ 9.

```bash
npm install
npm run dev
# → http://localhost:5173
```

The dev server has hot-module reload. After editing JS/CSS, the browser refreshes automatically.
No service worker runs in dev mode — use `npm run preview` to test the PWA offline behaviour.

## Building for production

```bash
npm run build
# Output: dist/
```

`dist/` is a self-contained static site. Deploy it to any static host or test locally:

```bash
npm run preview
# → http://localhost:4173
```

## Running tests

```bash
npm test               # Vitest (unit tests in src/tests/)
npm run test:legacy    # Legacy node test scripts (test_engine.js, etc.)
npm run test:watch     # Vitest in watch mode during development
```

## Project structure

| Path | Purpose |
|------|---------|
| `index.html` | App shell — all panes defined in markup, JS shows/hides them |
| `app.js` | Monolith UI controller (~8 000 lines). Legacy; being migrated to `src/` |
| `engine.js` | Headless stat calculator. Pure function `calculateCharacterState(character)` |
| `parser-5etools.js` | Converts raw 5etools JSON → internal records |
| `db.js` | IndexedDB abstraction layer |
| `sync.js` | Dropbox OAuth PKCE + bidirectional sync |
| `conflict.js` | Last-Write-Wins merge strategy |
| `src/` | New Preact + TypeScript components (added per phase) |
| `public/` | Static assets copied as-is to `dist/` (manifest, icon, SRD XML) |
| `docs/` | Architecture documentation |

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for a full overview.
Active re-platform plan: Vite + Preact + TypeScript + `@preact/signals`, migrating `app.js` tab-by-tab.

## Deploying

Push to `main` — GitHub Actions runs tests, builds `dist/`, and deploys to GitHub Pages automatically.

## Importing compendium data

Open the app → Settings → Import from 5etools. Select sources and click **Import Selection**.
Data is fetched from the 5etools GitHub mirror and stored in IndexedDB (no server required).
