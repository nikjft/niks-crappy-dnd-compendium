# This is a backlog of desired changes, to be tackled once higher priorities are managed.

**IMPORTANT: Agent should not execute any of these changes without specific instructions. When completing items in this list prefix them with `*DONE*` as a record. Ignore complete items.**

ENHANCEMENT: Make class overviews more complete. Review 5e.tools rendering such as https://5e.tools/classes.html#artificer_efa where the full table of spell slots and other counters are visible. This should also be available on character sheet.

ENHANCEMENTS: Add counters and level-based features to class features

For things like artificer plans known, barbarian rages and rage damage, rogue sneak attack damage, etc., have these listed as discrete items under class features and automatically updated as level changes.

ENHANCEMENT: Counters for these things. But only where it is possible to know that it is a counter and on what basis it resets. For example, Artificer magic item plans are not counters, but Fighter Second Wind is a counter. Determine if source data can make this determination. If not, keep counters manual as-is.

ENHANCEMENT: There are going to be some very specific rules associated with parsing or display of individual features, books, etc. Create a conditional override system of hard coded rules we can apply. First such rule is that if EFTA is loaded, do not load Artificer Infusions from other sources (e.g. TCE or ERLW). Make this easy to extend.

**DONE** BUG: Add to list shows incorrect categories.

Current behavior...

Click add on equipment list.

See on sidebar:

Items,
Characters,
Search,
Bookmarks

Expected: Only show Equipment, bookmarks

**DONE** ENHANCEMENT: Filter irrelevant categories from being selectable in bookmarks and search.

Current behavior...

Add equipment to character

Go to bookmarks

Click on non-equipment bookmark (e.g. spell) or search and click on something irrelevant.

Get button "Add to inventory"

Desired...

 Do not show button for incorrect context

Do not show irrelevant bookmarks or search results.

**DONE** BUG: Categories in equipment list abbreviated

In equipment, see "T" as a category, should be "Tools". Also have categories of SA, SG, AF, AIR, AT, FD, GS, MNT, etc... all should be full readable words. 

**DONE** ENHANCEMENT: Show source for all elements. Just `*Source: TCE*` is sufficient, although full name of book is preferred `*Source: Tasha's Cauldron of Everything*`

**DONE** ENHANCEMENT: Artificer magic items plans should show up as an option, not only as a table. These should include the full description of the related items or a hyperlink to it.

**DONE** ENHANCEMENT: Hyperlinks from source 5etools data that cross-references  should be clickable and lead to the correct entry. (E.g. hyperlinks between tables)

**DONE** ENHANCEMENT: Have separate options to clear compendium and clear database. The first will only clear compendium, the second will clear compendium and characters. If clearing characters, provide prompt to download and save first (which user would do manually).

**DONE** BUG: Adding a level to the character shouldn't be possible. You must use the level up process to increase level. Do not let counter be edited.

**DONE** BUG: Can select anything when adding item to list. Should limit only to only show relevant categories and hide others in the top level of the compendium bar.

**DONE** BUG: Not all equipment is in the database. Not seeing non-magical armor (e.g. leather armor), non magical weapons (e.g. Long Sword), or magic bonus weapons or armor (+1/2/+3) 



**DONE** BUG: Categories are duplicated for books. End up with categories like "S|XPHB" and "Shield", which should just be "Shield". Categories should never be book-specific and suffixed, only individual elements.

**DONE** ENHANCEMENT: Update parser to change how duplicates are handled. If there is a duplicated item, spell, feature, class or subclass between sources, we want to use the latest book's version. Eliminate all associated items from previous versions as well - e.g. if there's a Circle of Stars druid imported from multiple sources, include only the most recent, and also exclude the Circle of Stars spell list from the outdated book.

This may require a UX change of having users rank-order books in some fashion. (Unless publication date is available in the sources) For now, XPHB, XDMG, and XMM outrank everything. PHB, DMG, MM are lowest rank.

