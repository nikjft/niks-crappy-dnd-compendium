# This is a backlog of desired changes, to be tackled once higher priorities are managed.

**IMPORTANT: Agent should not execute any of these changes without specific instructions. When completing items in this list prefix them with `*DONE*` as a record. Ignore complete items.**

*DONE* BUG: Bestiary shows types (e.g. Dragon, Aberration, Beast) but the filter by type is blank. Ensure it shows all types in the list for easy filtering.

*DONE* BUG: Imported TCE and EFA Artificer, ended up with Arcane Infusions in features even though that's TCE Artificer which should be superseded by EFA. Additionally artificer magic item plans should be in options per the subclass abilities. This has been marked complete before, bug may still exist.

*DONE* ENHANCEMENT: Add custom elements to any list (spells, items, features, etc). 

Provide dialog to enter common attributes for that item type. 

Add "Modifiers" list to this dialog to let people add modifiers. Provide dropdowns to make modifiers easy, or option to ender modifier notation per internal system, along with guide for syntax.

Add option to edit any existing element with same structure. This will require clicking a pencil button in the item detail.

Sync with compendium will be a sync button in the detail view (and nowhere else). This should warn that it will overwrite any customizations.

ENHANCEMENT: Following above enhancement, enable class resync. Syncing a class overview with a compendium will offer an option to re-sync class and subclass features, in which case it will update everything to match current compendium as though leveling up and making same selections where possible. This will ensure that new features are added, and out of data features are deleted.





*DONE* ENHANCEMENTS: Counters and increases by level should also appear for sub-classes where they have level-based tables. (e.g. Fighter psi warrior subclass dice and dice type) These counters should be named based on their table name.

*DONE* BUG: Class overview should also be in Class"Barbarian features. (Same with other classes/subclasses)

*DONE* ENHANCEMENT: Options: Fighting Style should go under Feats: Fighting Style and be merged with other fighting styles. (Note some are duplicated between XPHB and TCE, so XPHB should take precedence due to pub date)

*DONE* ENHANCEMENT: Add override so if XPHB is loaded, do not import TCE Ranger and Paladin specific fighting styles. (Fighter fighting styles still import)

*DONE* ENHANCEMENT: "Spells" tab should exist in character sheet regardless of character type/class, but there should be no default spell list under spells.

*DONE* ENHANCEMENT: Hyperlink color is hard to see. Make it orange and underlined, matching category heading color but not different font/weight.

*DONE* ENHANCEMENT: Change name of default "Features and Traits" list to just "Feats"

*DONE* ENHANCEMENT: Make forge of the Artificer Artificer-class magic item plans available as Options based on tables in class description. Include sub-title of prerequisite level based on tables. Do not create individual item plans for "Uncommon items of X rarity" or "+1 weapons" for each individual potential item, just include that option.

This may need to be a special override case, determine right approach.

*DONE* ENHANCEMENT: Where there are counters or other special increases in class descriptions, also include in counters section on first page of sheet if they are simple counters or if they apply damage (Rages, damage, metamagic points). Do not include spells known, plans known, etc.

*DONE* ENHANCEMENT: Calculate spell slots available based on class mix. Note odd rules for pact slots for Warlocks (all slots are highest available pact magic spell level). `https://5e.tools/book.html#xphb,2,multiclassing,0`
