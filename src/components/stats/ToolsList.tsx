import { useState } from 'preact/hooks';
import type { Character, CharacterState, Breakdown } from '../../data/types.js';
import { patchCharacter } from '../../state/stores.js';

interface Props {
  character: Character;
  state: CharacterState;
}

const DEFAULT_TOOLS = [
  { name: 'Thieves\' Tools', attr: 'dex' },
  { name: 'Alchemist\'s Supplies', attr: 'int' },
  { name: 'Brewer\'s Supplies', attr: 'wis' },
  { name: 'Cook\'s Utensils', attr: 'wis' },
  { name: 'Disguise Kit', attr: 'cha' },
  { name: 'Forgery Kit', attr: 'int' },
  { name: 'Herbalism Kit', attr: 'int' },
  { name: 'Navigator\'s Tools', attr: 'wis' },
  { name: 'Poisoner\'s Kit', attr: 'int' },
];

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export function ToolsList({ character, state }: Props) {
  const tools = character.toolProficiencies ?? [];
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAttr, setNewAttr] = useState('int');
  const [newProfLevel, setNewProfLevel] = useState(1);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  function cycleProficiency(index: number) {
    const current = tools[index];
    const currentProf = parseFloat(String(current.profLevel)) || 0;
    let nextProf = 0;
    if (currentProf === 0) nextProf = 1;
    else if (currentProf === 1) nextProf = 2;
    else if (currentProf === 2) nextProf = 0;

    const newTools = [...tools];
    newTools[index] = { ...current, profLevel: nextProf };
    patchCharacter({ toolProficiencies: newTools });
  }

  function handleAttrChange(index: number, attr: string) {
    const newTools = [...tools];
    newTools[index] = { ...tools[index], attr };
    patchCharacter({ toolProficiencies: newTools });
  }

  function handleRemove(index: number, e: MouseEvent) {
    e.stopPropagation();
    const newTools = tools.filter((_, i) => i !== index);
    patchCharacter({ toolProficiencies: newTools });
  }

  function handleAddTool() {
    const name = newName.trim();
    if (!name) return;
    if (tools.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      alert('Tool already exists!');
      return;
    }

    const newTools = [
      ...tools,
      { name, attr: newAttr, profLevel: newProfLevel },
    ];
    patchCharacter({ toolProficiencies: newTools });

    setNewName('');
    setIsAdding(false);
  }

  return (
    <div class="cs-combat-card tools-card">
      <div class="cs-card-header">
        <h3>Tool Proficiencies</h3>
      </div>

      {tools.length === 0 ? (
        <p class="empty-hint">No tool proficiencies. Add one below.</p>
      ) : (
        <div class="skills-table">
          <div class="skills-table-header">
            <span class="col-prof">Prof</span>
            <span class="col-name">Tool</span>
            <span class="col-attr">Attr</span>
            <span class="col-val">Total</span>
            <span class="col-action"></span>
          </div>
          <div class="skills-table-body">
            {tools.map((tool, idx) => {
              const prof = parseFloat(String(tool.profLevel)) || 0;
              const toolKey = `tool.${tool.name.toLowerCase().replace(/\s+/g, '_')}`;
              const toolVal = state[toolKey]?.total ?? 0;
              const bd = state[toolKey] as Breakdown;
              const isExpanded = expandedTool === tool.name;

              let profClass = '';
              let profTitle = 'Not Proficient';
              if (prof === 1) {
                profClass = 'prof';
                profTitle = 'Proficient';
              } else if (prof === 2) {
                profClass = 'double';
                profTitle = 'Expertise';
              }

              return (
                <div key={tool.name} class={`skill-row-group ${isExpanded ? 'expanded' : ''}`}>
                  <div
                    class="skill-table-row"
                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                    aria-label={`${tool.name} details`}
                  >
                    <span class="col-prof" onClick={e => e.stopPropagation()}>
                      <button
                        class={`cs-prof-indicator ${profClass}`}
                        onClick={() => cycleProficiency(idx)}
                        title={`${profTitle}. Click to cycle.`}
                        aria-label={`Cycle proficiency for ${tool.name}`}
                      />
                    </span>
                    <span class="col-name">{tool.name}</span>
                    <span class="col-attr" onClick={e => e.stopPropagation()}>
                      <select
                        class="skill-attr-select"
                        value={tool.attr}
                        onChange={e => handleAttrChange(idx, (e.target as HTMLSelectElement).value)}
                        aria-label={`${tool.name} attribute`}
                      >
                        <option value="str">STR</option>
                        <option value="dex">DEX</option>
                        <option value="con">CON</option>
                        <option value="int">INT</option>
                        <option value="wis">WIS</option>
                        <option value="cha">CHA</option>
                      </select>
                    </span>
                    <span class="col-val">{sign(toolVal)}</span>
                    <span class="col-action" onClick={e => e.stopPropagation()}>
                      <button
                        class="cs-btn-trash"
                        onClick={e => handleRemove(idx, e)}
                        aria-label={`Delete ${tool.name}`}
                      >
                        <span class="material-icons-outlined" style="font-size: 16px;">delete</span>
                      </button>
                    </span>
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
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdding ? (
        <div class="tool-add-form" style="margin-top: 12px; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px;">
          <h4 style="margin-bottom: 8px;">Add Tool Proficiency</h4>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
            <input
              type="text"
              class="hp-modal-input"
              placeholder="Tool Name (e.g. Disguise Kit)"
              value={newName}
              onInput={e => setNewName((e.target as HTMLInputElement).value)}
              list="default-tools-list"
              autoFocus
            />
            <datalist id="default-tools-list">
              {DEFAULT_TOOLS.map(t => (
                <option key={t.name} value={t.name} />
              ))}
            </datalist>
            <div style="display: flex; gap: 8px;">
              <div style="flex: 1;">
                <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Attribute</label>
                <select
                  class="hp-modal-input"
                  style="width: 100%;"
                  value={newAttr}
                  onChange={e => setNewAttr((e.target as HTMLSelectElement).value)}
                  aria-label="New tool attribute"
                >
                  <option value="str">Strength (STR)</option>
                  <option value="dex">Dexterity (DEX)</option>
                  <option value="con">Constitution (CON)</option>
                  <option value="int">Intelligence (INT)</option>
                  <option value="wis">Wisdom (WIS)</option>
                  <option value="cha">Charisma (CHA)</option>
                </select>
              </div>
              <div style="flex: 1;">
                <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Proficiency</label>
                <select
                  class="hp-modal-input"
                  style="width: 100%;"
                  value={newProfLevel}
                  onChange={e => setNewProfLevel(parseFloat((e.target as HTMLSelectElement).value))}
                  aria-label="New tool proficiency"
                >
                  <option value="0">None</option>
                  <option value="1">Proficient</option>
                  <option value="2">Expertise (Double Proficient)</option>
                </select>
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="cs-btn-small secondary" onClick={() => setIsAdding(false)}>Cancel</button>
            <button class="cs-btn-small" onClick={handleAddTool}>Add</button>
          </div>
        </div>
      ) : (
        <button
          class="chip-add"
          onClick={() => setIsAdding(true)}
          style="margin-top: 12px; width: 100%; display: block; text-align: center;"
        >
          + Add Tool
        </button>
      )}
    </div>
  );
}
