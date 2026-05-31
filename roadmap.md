**IMPORTANT: IGNORE THIS FILE UNLESS SPECIFICALLY DIRECTED**

# Comprehensive PWA Architecture & Feature Roadmap

**Architectural Goal:** Build a robust, local-first foundation that
supports complex data models (Character Sheets) and remote sync without
blocking UI threads. Avoid rewriting logic by ensuring state management
and data schemas are finalized *before* building complex user
interfaces.

## Phase 1: The Robust Storage Foundation (Local-First Sync)

*Why here? Building character sheets relies heavily on saving state. If
we build characters on standard `localStorage` now, we will have to
rewrite all state-management code when we move to IndexedDB and Dropbox
sync.*

1.  **IndexedDB Migration:** Migrate the core app state from
    memory/localStorage to IndexedDB (e.g., using `idb` or Dexie.js).

2.  **Storage Persistence:** Implement the browser storage persistence
    request (`navigator.storage.persist()`) and quota monitors.

3.  **Dropbox Sync Engine:** Build the bidirectional sync pipeline.

    - Implement OAuth PKCE flow.

    - Create the `sync_state.json` envelope schema (metadata + payload).

    - Implement the Last-Write-Wins (LWW) deterministic merge strategy
      for conflict resolution.

4.  **Sync UX/UI:** Add the offline/online banners, sync settings panel,
    and manual backup overrides.

## Phase 2: Data Schema & Ingestion Pipeline

*Why here? The Character Sheet's calculation engine needs specific data
(modifiers, subclass relationships). We must update how the app reads
data before we build the engine that calculates it.*

1.  **XML Schema Enhancements (Non-breaking):** Implement the
    `Data Model Gap Analysis` updates. Add `<engine_modifier>`,
    `<usage_counter rel="...">`, and explicit `<autolevel rel="...">`
    tags to your source XML.

2.  **Parser Update:** Update the ingestion script to map these new XML
    tags into a strictly typed JSON schema.

3.  **5eTools JSON Support (Optional parallel track):** Build the
    ingestion adapter for 5eTools JSON, normalizing it into the *same*
    internal JSON schema used by the XML parser.

4.  **Multiple Database Support:** Implement the UI and routing logic to
    switch between active compendium databases (e.g., switching between
    a "Standard 5e" db and a "Homebrew 5.5e" db).

## Phase 3: Global Compendium Features

*Why here? These features validate the Phase 1 storage and Phase 2 data
structures using simpler, read-only UI components before tackling the
complex math of Character Sheets.*

1.  **Global Bookmarks/Favorites:** Implement the UI to favorite *any*
    item/spell/feature and view them in a consolidated list. (This paves
    the way for the "Lists" architecture needed for characters).

2.  **Rules Reference:** Add the static UI tab for standard conditions
    and rules.

3.  **Display Tables Markdown:** Update the text parser to convert the
    custom `<text>` table formats (e.g., `Cleric Level | Spells`) into
    standard markdown/HTML tables.

## Phase 4: Character Sheet Logic Engine (Headless)

*Why here? The data is clean and stored securely. Now we build the
"brain" of the character sheet in total isolation, ensuring it works
perfectly before drawing a single UI component.*

1.  **Initialize Character Store:** Set up the isolated state for
    characters inside IndexedDB.

2.  **The Calculation Engine:** Build the string-parsing engine that
    handles standard D&D variables (`{str.mod}`, `{ac}`,
    `{char.level}`).

3.  **Modifier Resolution:** Program the engine to resolve order of
    operations: Base Attribute -&gt; Universal Variables -&gt; Derived
    Stats -&gt; Additive Modifiers -&gt; Caps/Overrides.

4.  **Unit Testing:** Feed dummy objects (e.g., a background giving +2
    STR, an item giving +1 AC) into the headless engine and assert the
    final state dictionary is mathematically perfect.

## Phase 5: Character Sheet Architecture & UI

*Why here? The engine is bulletproof, and the data is ready. Building
the UI is now just wiring components to a finished logic board.*

1.  **Character Roster View:** Build the gallery and basic CRUD (Create,
    Read, Update, Delete) operations for characters, syncing via the
    Phase 1 Dropbox engine.

2.  **The "Lists" Architecture:** Implement the deep-copy mechanic.
    Allow users to add Spells, Equipment, and Features from the main
    Compendium to their local Character List.

3.  **State Flags & Wiring:** Wire up `active`, `selected`, and
    `favorite` toggles on list items, ensuring that toggling an item
    instantly recalculates the Phase 4 engine.

4.  **Read-Only UI (The View):** Build the Stats, Skills, and Combat
    tabs. Bind them directly to the engine's output dictionary.

## Phase 6: Character Sheet Advanced Mechanics

*Why here? These are the finishing touches that make the app feel like a
premium tool rather than just a digital piece of paper.*

1.  **Custom Modifiers UI:** Build the interface for players to add
    arbitrary modifiers and string formulas directly to their sheet.

2.  **Compendium Sync Button:** Add the functionality to overwrite a
    locally modified character list item with a fresh fetch from the
    Compendium database.

3.  **Counters & Rests:** Map the explicit `<counter rel="...">` tags to
    UI checkboxes/trackers, and implement Short/Long rest reset
    functions.

4.  **Bestiary:** Add the final list type for tracking summons and
    temporary forms.