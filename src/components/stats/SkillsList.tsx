import { useState } from 'preact/hooks';
import type { Character, CharacterState, Breakdown, EquipmentItem } from '../../data/types.js';
import { patchCharacter } from '../../state/stores.js';

interface Props {
  character: Character;
  state: CharacterState;
}

const SKILLS = [
  { name: 'athletics', label: 'Athletics', defaultAttr: 'str' },
  { name: 'acrobatics', label: 'Acrobatics', defaultAttr: 'dex' },
  { name: 'sleight_of_hand', label: 'Sleight of Hand', defaultAttr: 'dex' },
  { name: 'stealth', label: 'Stealth', defaultAttr: 'dex' },
  { name: 'arcana', label: 'Arcana', defaultAttr: 'int' },
  { name: 'history', label: 'History', defaultAttr: 'int' },
  { name: 'investigation', label: 'Investigation', defaultAttr: 'int' },
  { name: 'nature', label: 'Nature', defaultAttr: 'int' },
  { name: 'religion', label: 'Religion', defaultAttr: 'int' },
  { name: 'animal_handling', label: 'Animal Handling', defaultAttr: 'wis' },
  { name: 'insight', label: 'Insight', defaultAttr: 'wis' },
  { name: 'medicine', label: 'Medicine', defaultAttr: 'wis' },
  { name: 'perception', label: 'Perception', defaultAttr: 'wis' },
  { name: 'survival', label: 'Survival', defaultAttr: 'wis' },
  { name: 'deception', label: 'Deception', defaultAttr: 'cha' },
  { name: 'intimidation', label: 'Intimidation', defaultAttr: 'cha' },
  { name: 'performance', label: 'Performance', defaultAttr: 'cha' },
  { name: 'persuasion', label: 'Persuasion', defaultAttr: 'cha' },
];

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export function SkillsList({ character, state }: Props) {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const skillsProf = character.skillsProficiency ?? {};
  const skillsAttrOverride = character.skillsAttributeOverride ?? {};

  // Check for stealth disadvantage from equipped armor
  const equipped = (character.equipment ?? []) as EquipmentItem[];
  const stealthDisadvArmor = equipped.find(e => e.active && e.stealth);

  function cycleProficiency(skillName: string, e: MouseEvent) {
    e.stopPropagation();
    const currentProf = parseFloat(String(skillsProf[skillName])) || 0;
    let nextProf = 0;
    if (currentProf === 0) nextProf = 0.5;
    else if (currentProf === 0.5) nextProf = 1;
    else if (currentProf === 1) nextProf = 2;
    else if (currentProf === 2) nextProf = 0;

    const newProf = { ...skillsProf };
    newProf[skillName] = nextProf;
    patchCharacter({ skillsProficiency: newProf });
  }

  function handleAttrOverride(skillName: string, attr: string) {
    const newOverrides = { ...skillsAttrOverride };
    if (attr === '') {
      delete newOverrides[skillName];
    } else {
      newOverrides[skillName] = attr;
    }
    patchCharacter({ skillsAttributeOverride: newOverrides });
  }

  return (
    <div class="cs-combat-card skills-card">
      <div class="cs-card-header">
        <h3>Passives</h3>
      </div>
      <div class="cs-passives-row" style="margin-bottom: 16px;">
        <div class="cs-passive-card">
          <span class="cs-passive-label">Passive Perception</span>
          <span class="cs-passive-val">{state['passive.perception']?.total ?? 10}</span>
        </div>
        <div class="cs-passive-card">
          <span class="cs-passive-label">Passive Investigation</span>
          <span class="cs-passive-val">{state['passive.investigation']?.total ?? 10}</span>
        </div>
        <div class="cs-passive-card">
          <span class="cs-passive-label">Passive Insight</span>
          <span class="cs-passive-val">{state['passive.insight']?.total ?? 10}</span>
        </div>
      </div>

      <div class="cs-card-header">
        <h3>Skills</h3>
      </div>

      <div class="skills-table">
        <div class="skills-table-header">
          <span class="col-prof">Prof</span>
          <span class="col-name">Skill</span>
          <span class="col-attr">Attr</span>
          <span class="col-val">Total</span>
        </div>
        <div class="skills-table-body">
          {SKILLS.map(skill => {
            const prof = parseFloat(String(skillsProf[skill.name])) || 0;
            const overriddenAttr = skillsAttrOverride[skill.name] ?? skill.defaultAttr;
            const skillVal = state[`skill.${skill.name}`]?.total ?? 0;
            const bd = state[`skill.${skill.name}`] as Breakdown;
            const isExpanded = expandedSkill === skill.name;

            let profClass = '';
            let profTitle = 'Not Proficient';
            if (prof === 0.5) {
              profClass = 'half';
              profTitle = 'Jack of All Trades';
            } else if (prof === 1) {
              profClass = 'prof';
              profTitle = 'Proficient';
            } else if (prof === 2) {
              profClass = 'double';
              profTitle = 'Expertise';
            }

            const hasDisadv = skill.name === 'stealth' && !!stealthDisadvArmor;

            return (
              <div key={skill.name} class={`skill-row-group ${isExpanded ? 'expanded' : ''}`}>
                <div
                  class="skill-table-row"
                  onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}
                  aria-label={`${skill.label} details`}
                >
                  <span class="col-prof" onClick={e => e.stopPropagation()}>
                    <button
                      class={`cs-prof-indicator ${profClass}`}
                      onClick={e => cycleProficiency(skill.name, e)}
                      title={`${profTitle}. Click to cycle.`}
                      aria-label={`Cycle proficiency for ${skill.label}`}
                    />
                  </span>
                  <span class="col-name">
                    {skill.label}
                    {hasDisadv && (
                      <span class="stealth-warning-indicator" title="Disadvantage from armor">
                        ⚠️
                      </span>
                    )}
                  </span>
                  <span class="col-attr" onClick={e => e.stopPropagation()}>
                    <select
                      class="skill-attr-select"
                      value={overriddenAttr}
                      onChange={e => handleAttrOverride(skill.name, (e.target as HTMLSelectElement).value)}
                      aria-label={`${skill.label} governing attribute`}
                    >
                      <option value="str">STR</option>
                      <option value="dex">DEX</option>
                      <option value="con">CON</option>
                      <option value="int">INT</option>
                      <option value="wis">WIS</option>
                      <option value="cha">CHA</option>
                    </select>
                  </span>
                  <span class="col-val">{sign(skillVal)}</span>
                </div>
                {isExpanded && (
                  <div class="skill-row-breakdown">
                    <div class="bd-rows">
                      <div class="bd-row bd-base">
                        <span class="bd-row-label">{bd?.base?.label ?? 'Base'}</span>
                        <span class="bd-row-val">{bd?.base?.value ?? 0}</span>
                      </div>
                      {bd?.parts?.map((part, i) => (
                        <div class="bd-row" key={i}>
                          <span class="bd-row-label">{part.label}</span>
                          <span class="bd-row-val bd-row-part">
                            {part.op === 'set' ? '→' : part.value >= 0 ? '+' : '−'} {Math.abs(part.value)}
                          </span>
                        </div>
                      ))}
                      {hasDisadv && (
                        <div class="bd-row disadv-row" style="color: var(--error-color); font-weight: bold;">
                          <span class="bd-row-label">⚠️ Disadvantage:</span>
                          <span class="bd-row-val" style="font-size: 11px;">{stealthDisadvArmor?.name ?? 'Heavy Armor'} equipped</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
