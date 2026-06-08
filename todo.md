# This is a backlog of desired changes, to be tackled once higher priorities are managed.

# Using This Backlog

- **IMPORTANT:** Agent should not execute any of these changes without specific instructions. When completing items in this list prefix them with `*DONE*` as a record. Ignore complete items.
- **PROCESSES:** If making significant changes, create a github branch for making edits, test locally, and then merge into the main branch, commit, sync. For small edits, work in main branch.
- **DOCUMENTATION:** If making significant changes to the application's structure, edit architectural documentation in docs/* as appropriate
- **APPENDING TO BACKLOG:** If you are intentionally incurring technical debt/deferring changes, add them to the bottom of the backlog

# Backlog

- [x] *DONE* CRITICAL: Paths wrong on github pages when built. Looking for assets at https://nikjft.github.io/assets/manifest-_6nc69fN.json should be https://nikjft.github.io/niks-crappy-dnd-compendium/assets/manifest-_6nc69fN.json
- [x] *DONE* Update system documentation at /docs/* so that agents can understand structure and make app changes. Break into small files for low-token reads of specific features. Start with "Architecture Changes.md" as the base.
- [x] *DONE* Equipment lists incorrect. Should have multiple lists. Items added to list should have toggles for carried, equipped, or neither. Currently has multiple lists of different statuses which is incorrect. (Was correct prior to refactor to vite structure)
- [x] *DONE* ENHANCEMENT: Equipment list should follow structure of other lists. Toggle to change status should be on the right-side of the list. Follow standard of empty circle for not carried, filled-in circle for carried (same as skills iconography) and shield icon when equipped. Click to cycle through each state.
- [x] *DONE* ENHANCEMENT: Gray-on-black text hard to read. Increase brightness of gray descriptive text and subtitles. Meet general accessibility standards for contrast.
- [x] *DONE* ENHANCEMENT: Update icons so all are outlined material icons - no emojis, minimal coloring. https://fonts.google.com/icons
- [x] *DONE* BUG: Adding a spell to spell list doesn't show it until you refresh the page
- [x] *DONE* ENHANCEMENT: When adding items from compendium (spells, items, feats, options, beasts, etc.), do not leave compendium/picker view immediately so users can add multiple things at a time.
- [x] *DONE* ENHANCEMENT: Cannot edit elements from compendium. All feats, spells, items, abilities, species and class features should be editable, including modifier adding/editing. May require significant modal work, start with:
    - Weapons, be able to add attack, damage, modifiers, range, etc.
    - Features, be able to add description and modifiers
- [x] *DONE* BUG: Bestiary in compendium should have its first facet be "By CR" and "By Type". Clicking on By Type provides a list of creature types. Clicking on a type finds matching creatures. By CR does the same with CR. Clicking on By CR will show CRs in the following groupings: < 1, 1, 2 - 5, 6 - 10, 11 - 16, 17 - 20, 21+. Clicking on a CR range will reveal a list of creatures within that range.
- [x] *DONE* enhancement: Have URLs for individual characters and tabs so you can reload browser without losing state
- [x] *DO NOT DO* BUG: Sometimes navigating between sections will cause the Characters list to disappear or individual characters to sometimes not show up. Unclear root cause. Also cannot delete characters.
- [x] *DONE* Eliminate attunement slots tracker in inventory
- [x] *DONE* Eliminate inventory search box (was not present in Preact InventoryTab)
- [x] *Done* Enhancement: Shield indicating equipped items should be filled in, not outline.
- [x] *DONE* Enhancement: Eliminate the big add from compendium/add custom item buttons from equipment list. The + in each list is sufficient. (Only per-list + Add buttons remain)
- [x] *DONE* BUG: There are two icons indicating whether a spell is prepared. Replace with a single circle, empty by default, filled if clicked on. Similar to proficiencies. Eliminate "prepared" eliminate any code creating meaning from "active" spells. (Spells tab is fully Preact with single cs-prof-indicator circle; legacy two-icon rendering is dead code)
- [x] *DONE* Enhancement: Add "Concentrating" to condition list with appropriate description
- [x] *DONE* Enhancement: Add exhaustion levels to conditions (1, 2, 3, 4, 5)
- [x] *DONE* ENHANCEMENT: When adding spells/items/etc from compendium/picker view, replace cancel button with "OK". (Already "OK" in index.html)
- [x] *DONE* ENHANCEMENT: Eliminate "half proficiency" from proficiencies/skills list. Only options are proficient (empty circle), proficient (full circle), expert (filled circle with dot). (Preact SkillsList and ToolsList cycle 0→1→2 only; no user-settable 0.5)
- [x] *DONE* ENHANCEMENT: Add test suite to test full UX with headless browser. Importing, clearing db, browsing compendium, adding and deleting characters, updating each tab, adding each type of entity, deleting each type of entity
- [ ] Enhancement: Add character option for Weapon Masteries. Just category with an entry for each base weapon (Longsword, short sword, etc.). Each one should list the mastery property and effect for that weapon.
- [ ] *BACKLOG - do not do* Enhancement: UX clean-up. Fix odd sized buttons, varying text size, odd colors, just make consistent
- [ ] Enhancement: Update equipping of weapons (and only weapons) to on-hand and off-hand. Must respect rules around two weapon fighting and related feats:
    - Do not add your ability modifier (Typically STR, for finesse weapons it will be the greater of STR or DEX)to the off-hand attack's to hit or damage unless it is negative
    - If you have the two weapon fighting style active, you can add your ability modifier
- [x] *DONE* Enhancement: Update abilities view so that the score is larger than the bonus (swap position of bonus and score)
- [ ] BUG: Attunement requirements not getting mapped to items. Suspect import parser.
- [ ] Refactor: Eliminate legacy code, no longer required. No legacy content or characters.