# System Architecture & Infrastructure Design

This document describes the modern Preact + Vite architecture of **Nik's Crappy D&D Compendium**, detailing the toolchain, reactive state model, stat calculation engine, persistence flow, and the bridge between modern and legacy code.

---

## 1. Stack & Toolchain

The application is built as a compiled, offline-first client-only Progressive Web App (PWA). There is no backend server.

- **Build Tool**: **Vite** with Hot Module Replacement (HMR).
- **Core Library**: **Preact** (`preact` + `preact/compat`) for high performance and minimal runtime footprint (~4 KB).
- **Reactivity**: **`@preact/signals`** for fine-grained updates without complete tree re-renders.
- **Language**: **TypeScript** for type safety of complex D&D data structures.
- **PWA Tooling**: **`vite-plugin-pwa`** (Workbox) for content-hashed caching and automatic offline updates.
- **Testing**: **Vitest** for unit tests.

### Configuration & Deployment
- **Base Path**: The application is configured to deploy on GitHub Pages using `base: '/niks-crappy-dnd-compendium/'` in [vite.config.ts](file:///Users/inik/Documents/git/niks-crappy-dnd-compendium/vite.config.ts).
- **Output**: Built static assets are generated in the `dist/` directory via `npm run build`.

---

## 2. Project Directory Layout

```
src/
  main.tsx                     # Mounts Preact components to DOM anchors, hooks up global triggers
  combat.css, stats.css...     # Tab-specific CSS stylesheets
  components/
    combat/                    # Combat Tab components (CombatTab, QuickActions, HPModal, RestWizard)
    stats/                     # Stats & Skills Tab components (StatsTab, AbilityCards)
    inventory/                 # Inventory Tab components (InventoryTab, ItemRow)
    spells/                    # Spells Tab components (SpellsTab, SpellSlotTracker)
    features/                  # Features Tab components (FeaturesTab, ModifierEditor)
    shared/                    # Shared components (BreakdownPopup, TagText, MarkdownContent)
  data/
    types.ts                   # Unified TypeScript definitions (Character, EquipmentItem, SpellSpell...)
  engine/
    engine.ts                  # Headless rules calculation engine (returns breakdowns)
    engine.test.ts             # Vitest test suite for stat calculations
  state/
    stores.ts                  # Signals store (currentCharacter, activeTab, persistence triggers)
    persistence.ts             # Sync-to-IndexedDB persistence loops
  utils/
    parseTagMarkup.ts          # Cross-reference parser for {@spell name} style tags
docs/
  architecture.md              # Entrypoint documentation (this file)
  character-sheet.md           # Character state, wizard, and level-up details
  compendium.md                # Compendium browsing, search, and details layout
  importer.md                  # 5etools parser and IndexedDB seeder documentation
  sync-engine.md               # Dropbox synchronization protocols and LWW conflict resolution
```

---

## 3. Reactive State Model (Signals)

State management is driven by `@preact/signals`. Components subscribe to specific signals and re-render *only* when the referenced signal values change.

```typescript
// src/state/stores.ts
export const currentCharacter = signal<Character | null>(null);
export const activeTab = signal<string>('combat');

// Derived state (automatically re-computed when currentCharacter changes)
export const charState = computed(() => {
  const char = currentCharacter.value;
  return char ? calculateCharacterState(char) : null;
});
```

To modify character state, use helper actions that update `currentCharacter.value` in-place, which automatically triggers:
1. Re-calculation in `charState` (and UI updates in components reading it).
2. The debounced persistence effect in `src/state/persistence.ts` that saves the updated character to IndexedDB and schedules cloud synchronization.

---

## 4. Stat Calculation Engine & Breakdowns

The calculation engine ([src/engine/engine.ts](file:///Users/inik/Documents/git/niks-crappy-dnd-compendium/src/engine/engine.ts)) computes derived statistics (AC, HP, Initiative, Saves, Skills, Passive scores, Attack Bonuses) from a raw `Character` record.

Instead of discarding calculation steps, it returns a structured `Breakdown` for every statistic:

```typescript
export interface BreakdownPart {
  label: string;
  value: number;
  op: 'add' | 'set' | 'min' | 'max';
}

export interface Breakdown {
  total: number;
  base: { label: string; value: number };
  parts: BreakdownPart[];
}
```

This structural breakdown is rendered by the generic `<BreakdownPopup>` component when a player taps any derived stat in the UI.

---

## 5. Modern-Legacy Integration Bridge

Because parts of the compendium and settings sidebar still rely on the legacy `app.js` monolithic event loop, a bridge object is exposed on the global `window` object:

```typescript
// Exposed to legacy code from src/main.tsx
(window as any).__dndStore = {
  currentCharacter,
  patchCharacter,
};
```

This bridge allows the legacy roster view, creation wizard, and settings panels to set the active character, while Preact tabs can listen to character changes reactively. 

Additionally, helper functions like `window.__legacyOpenPicker` are utilized to let Preact components trigger the legacy compendium search and item/spell selection overlays.
