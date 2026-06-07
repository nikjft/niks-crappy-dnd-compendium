# Compendium Sub-System

**Parent doc:** [architecture.md](./architecture.md)

The compendium is the primary browsing interface — a four-pane reader for spells, items, monsters, races, backgrounds, classes, feats, options, and bestiary entries.

---

## UI Layout (Four-Pane Model)

```
┌──────────┬──────────────┬──────────────────┬──────────────────────────────────┐
│ Sidebar  │  Facet 1     │  Facet 2         │  Detail Pane                     │
│ (nav)    │  (primary    │  (secondary      │  (e-reader / character sheet)    │
│          │   filter)    │   filter)        │                                  │
└──────────┴──────────────┴──────────────────┴──────────────────────────────────┘
```

On **mobile**, the four panes collapse into a single-column drilldown: `facet-1` → `facet-2` → `list` → `detail`. The active pane is tracked in `currentMobilePane`.

### DOM IDs

| Element | ID |
|---------|----|
| Sidebar navigation items | `.menu-item` |
| Facet 1 pane | `#pane-facet-1` |
| Facet 2 pane | `#pane-facet-2` |
| List pane | `#pane-list` |
| Detail pane | `#pane-detail` |
| Detail content area | `#detail-pane-content` |
| Search input | `#search-input` |

---

## Category Navigation

Clicking a sidebar item sets `currentCategory` and calls the category load sequence:

```
setCategory(category)
  → allRecordsCache[store] loaded from IndexedDB (or already cached)
  → renderFacet1()   — primary filter sidebar (e.g. spell level, monster type)
  → renderFacet2()   — secondary filter (e.g. school of magic, rarity)
  → applyFilters()   — applies selectedFacet1 + selectedFacet2 + searchChits
  → renderList()     — renders the filtered item list
```

### Categories and their stores

| `currentCategory` | IndexedDB store | Facet 1 | Facet 2 |
|-------------------|----------------|---------|---------|
| `spells` | `spells` | Level | School |
| `items` | `items` | Type | Rarity |
| `monsters` | `monsters` | CR | Type |
| `classes` | `classes` | — | — |
| `backgrounds` | `backgrounds` | — | — |
| `races` | `races` | — | — |
| `feats` | `feats` | Prerequisite | — |
| `options` | `options` | Type | — |
| `favorites` | `favorites` | Category | — |
| `characters` | `characters` | — | — |

### `getStoreNameForCategory(category)` (app.js L282)

Normalizes singular/plural aliases: `'spell'` → `'spells'`, `'race'` → `'races'`, etc.

---

## Facet Filtering

### State

```js
let selectedFacet1 = 'All';
let selectedFacet2 = 'All';
let searchChits = [];  // [{ field: 'school', value: 'conjuration' }, ...]
```

### `applyFilters()` (app.js L2336)

1. Starts from `allRecordsCache[store]`.
2. Applies `selectedFacet1` and `selectedFacet2` predicates (category-specific logic).
3. Applies text search from `searchInput.value`.
4. Applies any `searchChits` (advanced filter chips).
5. Passes result to `renderList()`.

### Search Chits

Filter chips that appear below the search bar. Each chit has a `field` and `value`. They can be added by clicking facet items or via the search bar. Rendered by `renderChits()`, applied in `applyFilters()`.

---

## List Rendering (`renderList` — app.js L2499)

Renders items as list rows in `#item-list`. Each row shows:
- Name (bolded)
- A subtitle (category-dependent: spell level + school, item type, CR, etc.)
- Source badge

Clicking a row calls `selectItem(item)` → `renderDetails(item)`.

For **global search** (cross-category), `renderList(items, isGlobalSearch=true)` adds a category badge to each row.

---

## Detail Rendering

### `getDetailHTML(item, category)` (app.js L2936)

Returns the full HTML string for the right pane. Each category has a dedicated template block:

| Category | What's shown |
|----------|-------------|
| `spells` | Level, school, cast time, range, components, duration, description, higher levels, classes |
| `items` | Type, rarity, attunement, weight, cost, properties, description |
| `monsters` | CR, type, size, AC, HP, speed, ability scores table, traits, actions, legendary actions |
| `classes` | HD, saves, equipment, class table (autolevels), features |
| `subclasses` | Parent class, level-by-level features |
| `feats` | Prerequisites, grants box (ability scores, skills, etc.), description |
| `backgrounds` | Description, traits, Background Grants box (ability, skills, tools, languages, feat) |
| `races` | Size, speed, Species Grants box (ability increases, languages, proficiencies), traits |
| `options` | Type, prerequisite level, description |
| `favorites` | Delegates to the item's own category renderer |

### Class & Subclass Overview Rendering

`class-overview` is a synthetic category applied whenever `item.isOverview === true`. It renders a full progression table (levels 1–20) using `item.classData`:

- For **classes**: `item.classData` is the full class record. Shows subtitle "Character Class", HD, proficiency meta box, and class table with custom columns (`classTableGroups`) and spell slots.
- For **subclasses**: `item.classData` is a slimmed object `{ name, parentClass, hd, classTableGroups, autolevels }` derived from the subclass record. Shows subtitle "[ClassName] Subclass", hides the proficiency meta box, shows "Subclass Progression Table".

### Grants Boxes

Races, backgrounds, feats, and classes show a prominent **Grants** info box at the top of the detail pane and in the wizard. These use inline styles with `linear-gradient` background + accent border. Fields shown vary by category:

- **🧬 Species Grants** — Ability Score Increases, Languages, Skill Proficiencies
- **🎒 Background Grants** — Ability Increases, Skill Proficiencies, Tool Proficiency, Languages, Feat
- **⚔️ Class Grants (Level 1)** — Saving Throws, Armor Training, Weapon Proficiencies, Skill Choices, Spellcasting Ability

### `parseMarkdown(text)` (app.js L2340 area)

Converts markdown (headings, bold, italic, lists, tables, horizontal rules, code blocks) to HTML. Used for `texts[]` arrays in records. Also handles a custom table syntax `=col1|col2|col3=`.

### `parseInlineMarkdown(text)`

Inline-only subset: bold, italic, code, links. Used for single-line fields.

### Link Styling

All links in `.detail-body` use `color: var(--accent-color)` (gold `#d4af37`) with `text-decoration: underline`, matching the category heading color.

---

## Favorites

Favorites are stored in the `favorites` IndexedDB store. A favorite record mirrors the original item with a `_favGroup` field for categorization.

- `isItemFavorited(item, category)` — checks `allRecordsCache.favorites`.
- Toggling: adds or removes from both `allRecordsCache.favorites` and IndexedDB.
- The `favorites` sidebar category loads all favorites and groups them by `_favGroup`.

---

## Universal Search (`renderUniversalSearchPanel` — app.js L3851)

Accessible via the 🔍 sidebar icon. Searches `allRecordsCache` across all loaded categories simultaneously. Results are rendered grouped by category. Clicking a result navigates to that item's category and selects it.

---

## URL / History State

The compendium URL encodes state as query parameters for deep-linking and back/forward navigation:

```
http://localhost:8085/?category=spells&pane=detail&item=Fireball+(XPHB)
```

- `pushCurrentState()` / `replaceState()` — write current nav state to browser history.
- `popstate` event handler restores state on back/forward.
- State includes: `category`, `item`, `pane`, `facet1`, `facet2`, `search`.

---

## Settings Panel (`renderSettingsPage` — app.js L3534)

Rendered in the detail pane when Settings is clicked. Sections:
1. **Import from GitHub** — repo URL, source selection modal trigger.
2. **Import from Local** — file/directory picker buttons.
3. **Data Management** — Two separate clear actions:
   - **Clear Compendium** (`clearCompendiumAction` → `clearCompendium()`) — wipes all content stores; characters and favorites are preserved.
   - **Clear Database** (`clearDatabaseAction` → `clearDatabase()`) — wipes everything including characters; prompts user to back up first.
   - Export JSON / Import JSON (full data portability via `exportAllData` / `importAllData`).
4. **Dropbox Sync** — App Key input, link/unlink, sync status badge, conflict history.
5. **Storage Health** — Persistence status, quota usage bar.
