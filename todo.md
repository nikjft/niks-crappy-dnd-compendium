# This is a backlog of desired changes, to be tackled once higher priorities are managed.

# Using This Backlog

- **IMPORTANT:** Agent should not execute any of these changes without specific instructions. When completing items in this list prefix them with `*DONE*` as a record. Ignore complete items.
- **PROCESSES:** If making significant changes, create a github branch for making edits, test locally, and then merge into the main branch, commit, sync. For small edits, work in main branch.
- **DOCUMENTATION:** If making significant changes to the application's structure, edit architectural documentation in docs/* as appropriate
- **APPENDING TO BACKLOG:** If you are intentionally incurring technical debt/deferring changes, add them to the bottom of the backlog

# Backlog

- [ ] CRITICAL: Paths wrong on github pages when built. Looking for assets at https://nikjft.github.io/assets/manifest-_6nc69fN.json should be https://nikjft.github.io/niks-crappy-dnd-compendium/assets/manifest-_6nc69fN.json
- [ ] Update system documentation at /docs/* so that agents can understand structure and make app changes. Break into small files for low-token reads of specific features. Start with "Architecture Changes.md" as the base.
- [ ] Equipment lists incorrect. Should have multiple lists. Items added to list should have toggles for carried, equipped, or neither. Currently has multiple lists of different statuses which is incorrect. (Was correct prior to refactor to vite structure)
- [ ] Cannot edit elements from compendium. All feats, spells, items, abilities, species and class features should be editable, including modifier adding/editing. May require significant modal work, start with:
    - Weapons, be able to add attack, damage, modifiers, range, etc.
    - Features, be able to add description and modifiers
