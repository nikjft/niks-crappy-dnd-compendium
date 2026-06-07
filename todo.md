# This is a backlog of desired changes, to be tackled once higher priorities are managed.

**IMPORTANT: Agent should not execute any of these changes without specific instructions. These are for user's reference only.**

**DONE** ENHANCEMENT: Have separate options to clear compendium and clear database. The first will only clear compendium, the second will clear compendium and characters. If clearing characters, provide prompt to download and save first (which user would do manually).

**DONE** BUG: Adding a level to the character shouldn't be possible. You must use the level up process to increase level. Do not let counter be edited.

**DONE** BUG: Can select anything when adding item to list. Should limit only to only show relevant categories and hide others in the top level of the compendium bar.

**DONE** BUG: Not all equipment is in the database. Not seeing non-magical armor (e.g. leather armor), non magical weapons (e.g. Long Sword), or magic bonus weapons or armor (+1/2/+3) 



**DONE** BUG: Categories are duplicated for books. End up with categories like "S|XPHB" and "Shield", which should just be "Shield". Categories should never be book-specific and suffixed, only individual elements.

**DONE** ENHANCEMENT: Update parser to change how duplicates are handled. If there is a duplicated item, spell, feature, class or subclass between sources, we want to use the latest book's version. Eliminate all associated items from previous versions as well - e.g. if there's a Circle of Stars druid imported from multiple sources, include only the most recent, and also exclude the Circle of Stars spell list from the outdated book.

This may require a UX change of having users rank-order books in some fashion. (Unless publication date is available in the sources) For now, XPHB, XDMG, and XMM outrank everything. PHB, DMG, MM are lowest rank.

