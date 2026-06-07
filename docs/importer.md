# Importer Sub-System

**Parent doc:** [architecture.md](./architecture.md)

The importer fetches 5etools JSON from GitHub (primary path) or a local file/folder (secondary path), normalizes the data, and writes it to IndexedDB.

---

## Entry Points

All importer logic lives in `app.js`. The two entry points are:

| Function | Trigger |
|----------|---------|
| `showSourceSelectionModal()` | "Load from GitHub" button in Settings panel |
| `dirInput` / `fileInput` change events | "Local Folder" / "Upload JSON" buttons in Settings |

---

## GitHub Import Flow

### 1. Source Discovery (`showSourceSelectionModal` — app.js L722)

1. Reads `githubRepoUrl` (default: `https://github.com/5etools-mirror-3/5etools-src`, user-configurable in Settings).
2. `updateGithubBaseUrl()` converts the repo URL to a raw content base URL (`https://raw.githubusercontent.com/...`).
3. Fetches `data/books.json` and `data/adventures.json` to get the list of available source books.
4. Renders a modal listing each source with checkboxes. "Select All" and "Import Selection" buttons.

### 2. Import Dispatch (`importFromGithub` or similar — app.js ~L800–1120)

For each selected source:
1. Fetches index files (e.g. `data/races.json`, `data/spells.json`, etc.) from `githubBaseUrl + path`.
2. For book/adventure content, fetches `data/book/book-{source}.json` or `data/adventure/adventure-{source}.json`.
3. Passes each raw JSON payload to the appropriate parser function (see Parser section below).
4. Writes normalized records to IndexedDB via `db.js saveRecords(storeName, records)`.

### 3. Progress & Overlay

- `showOverlay(title, desc)` / `hideOverlay()` display a full-screen loading state during import.
- `updateDBStatus(msg)` updates the small status line at the bottom of the sidebar.

---

## Local File Import Flow

The local path is a legacy/fallback path:
- `dirInput` (hidden `<input type="file" webkitdirectory>`) collects a directory tree into `importFilesMap`.
- `fileInput` (hidden `<input type="file" multiple>`) collects individual JSON files.
- Both paths then run the same parser dispatch as the GitHub path, just reading from `File` objects instead of fetch responses.

> **Note:** Chrome prompts an "upload" dialog for `webkitdirectory`, which can be confusing. The GitHub path is the recommended and better-tested flow.

---

## Parser (`parser-5etools.js`)

All normalization lives in `parser-5etools.js`. Each exported function takes a raw 5etools record + `source` string and returns an **internal record** with a consistent schema.

| Export | Input | Output store |
|--------|-------|-------------|
| `parse5etoolsSpell(spell, source)` | 5etools spell object | `spells` |
| `parse5etoolsItem(item, source)` | 5etools item object | `items` |
| `parse5etoolsMonster(monster, source)` | 5etools creature object | `monsters` |
| `parse5etoolsFeat(feat, source)` | 5etools feat object | `feats` |
| `parse5etoolsBackground(bg, source)` | 5etools background object | `backgrounds` |
| `parse5etoolsRace(race, source)` | 5etools race/species object | `races` |
| `parse5etoolsOption(opt, source)` | 5etools optionalfeature object | `options` |
| `normalize5etoolsClass(cls, source)` | 5etools class object | `classes` + `subclasses` + `classFeatures` + `subclassFeatures` |

### Helper utilities in parser-5etools.js

- `parse5etoolsText(text)` — strips `{@tag value}` formatting tags to plain text.
- `render5etoolsEntries(entries)` — recursively converts 5etools entries arrays (lists, tables, insets, quotes, etc.) to markdown lines.
- `suffixDuplicateNames(records)` — appends `(Source)` to disambiguate records with the same name from different sources.

### Internal Record Schema

All records share these base fields:

```js
{
  name: string,          // Primary key (for most stores)
  source: string,        // e.g. "XPHB", "PHB", "DMG"
  texts: string[],       // Main description paragraphs (markdown)
  traits: [{ name, texts, modifiers }],  // Named sub-entries
  modifiers: [],         // Engine modifier array (see engine.md)
  _modified_at: string,  // ISO timestamp — set at import time
}
```

**Race-specific fields:**
```js
{
  size: string,          // "Medium", "Small", etc.
  speed: number,         // Walk speed in feet
  speedStr: string,      // Human-readable e.g. "Walk 30 ft., Fly 50 ft."
  ability: string,       // e.g. "+2 Dexterity" or "" for XPHB free-form
  languages: string,     // e.g. "Common, Elvish" or "" for XPHB free-form
  proficiency: string,   // Skill proficiency names (comma-separated)
}
```

**Background-specific fields:**
```js
{
  ability: string,       // e.g. "+2/+1 distributed among: Int, Wis, Cha"
  proficiency: string,   // Skill names (comma-separated)
  tools: string,         // Tool proficiency name(s)
  languages: string,     // Language grants
  feats: string,         // Feat name(s)
}
```

### XPHB vs PHB Shape Difference

XPHB (2024 revised rules) data uses free-form ability selection described in `entries` text rather than structured `ability[]` arrays. The parser extracts what it can from structured fields; when none are present, `ability` and `languages` fields will be empty strings — this is correct, not a bug.

---

## IndexedDB Stores (STORES constant in db.js)

```
spells, items, monsters, classes, subclasses,
classFeatures, subclassFeatures, feats,
backgrounds, races, options, favorites, characters
```

Key paths:
- Most stores: `keyPath: 'name'`
- `classFeatures` and `subclassFeatures`: `keyPath: 'id'`
- `favorites`: `keyPath: 'name'` (uses a compound key string)
- `characters`: `keyPath: 'name'`

---

## After Import

After records are written, `app.js` calls `loadCategory(currentCategory)` which:
1. Calls `getAllRecords(storeName)` from `db.js`.
2. Populates `allRecordsCache[storeName]`.
3. Calls `renderFacet1()` → `renderFacet2()` → `renderList()` to refresh the UI.

The full `allRecordsCache` object is also exposed on `window.allRecordsCache` for debugging in the browser console.

---

## Re-Import Behavior

`db.js` exposes two distinct clear operations:

| Function | What it clears |
|----------|----------------|
| `clearCompendium()` | All compendium content stores (spells, items, monsters, classes, subclasses, classFeatures, subclassFeatures, feats, backgrounds, races, options). **Preserves** `characters` and `favorites`. |
| `clearDatabase()` | All STORES — including `characters` and `favorites`. **Destroys character data.** |

- **Clear Compendium then re-import:** Settings → "Clear Compendium" button calls `clearCompendiumAction()` → `clearCompendium()`, then re-import writes fresh compendium records via `saveRecords()`. Characters and favorites survive.
- **Clear Database (wipe everything):** Settings → "Clear Database" button calls `clearDatabaseAction()` → `clearDatabase()`. Characters are also wiped — users are prompted to back up first.
- **Import only (no clear):** `saveRecords()` upserts — existing records with the same key are overwritten regardless of timestamp (import uses `skipIfNewer: false`).
- **`importAllData(data)` (JSON import path):** Calls `clearDatabase()` by default (not `clearCompendium()`). Pass `{ merge: true }` to upsert without clearing.
