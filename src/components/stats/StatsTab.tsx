import { currentCharacter, charState } from '../../state/stores.js';
import { AbilityCard } from './AbilityCard.js';
import { SkillsList } from './SkillsList.js';
import { ToolsList } from './ToolsList.js';
import { SimpleTextList } from './SimpleTextList.js';
import { patchCharacter } from '../../state/stores.js';
import '../../stats.css';

export function StatsTab() {
  const character = currentCharacter.value;
  const state = charState.value;

  if (!character || !state) {
    return <div class="combat-placeholder">Open a character sheet to get started.</div>;
  }

  const attrs: ('str' | 'dex' | 'con' | 'int' | 'wis' | 'cha')[] = [
    'str', 'dex', 'con', 'int', 'wis', 'cha'
  ];

  function handleUpdateLanguages(newLangs: string[]) {
    patchCharacter({ languages: newLangs });
  }

  function handleUpdateOtherProf(newProfs: string[]) {
    patchCharacter({ otherProficiencies: newProfs });
  }

  return (
    <div class="stats-tab-root">
      {/* 6 Core Attributes Grid */}
      <div class="cs-attributes-grid stats-grid">
        {attrs.map(attr => (
          <AbilityCard key={attr} attr={attr} character={character} state={state} />
        ))}
      </div>

      {/* Main Layout: Skills and Tools/Proficiencies */}
      <div class="stats-main-layout">
        <div class="stats-left">
          <SkillsList character={character} state={state} />
        </div>
        <div class="stats-right">
          <ToolsList character={character} state={state} />
          <SimpleTextList
            label="Languages"
            items={character.languages ?? []}
            onUpdate={handleUpdateLanguages}
          />
          <SimpleTextList
            label="Other Proficiencies"
            items={character.otherProficiencies ?? []}
            onUpdate={handleUpdateOtherProf}
          />
        </div>
      </div>
    </div>
  );
}
