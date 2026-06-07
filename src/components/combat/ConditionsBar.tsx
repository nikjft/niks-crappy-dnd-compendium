import { useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import type { Character, CharacterCondition } from '../../data/types.js';

const STANDARD_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

interface Props {
  character: Character;
}

export function ConditionsBar({ character }: Props) {
  const conditions = character.conditions ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  function removeCondition(name: string) {
    patchCharacter({ conditions: conditions.filter(c => c.name !== name) });
  }

  function addCondition(name: string) {
    if (conditions.some(c => c.name === name)) return;
    patchCharacter({ conditions: [...conditions, { name }] });
    setPickerOpen(false);
    setCustomName('');
  }

  function addCustom() {
    const n = customName.trim();
    if (n) addCondition(n);
  }

  const available = STANDARD_CONDITIONS.filter(c => !conditions.some(x => x.name === c));

  return (
    <div class="conditions-bar">
      <div class="conditions-chips">
        {conditions.map(c => (
          <span key={c.name} class={`condition-chip${c.isConcentration ? ' concentration' : ''}`}>
            {c.isConcentration && <span class="conc-dot" title="Concentration" />}
            {c.name}
            {c.spellName && <span class="conc-spell"> ({c.spellName})</span>}
            <button class="chip-remove" onClick={() => removeCondition(c.name)} aria-label={`Remove ${c.name}`}>×</button>
          </span>
        ))}
        <button class="chip-add" onClick={() => setPickerOpen(true)} aria-label="Add condition">+ Condition</button>
      </div>

      {pickerOpen && (
        <div class="bd-overlay" onClick={() => setPickerOpen(false)}>
          <div class="condition-picker" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add condition">
            <div class="bd-header">
              <span class="bd-title">Add Condition</span>
              <button class="bd-close" onClick={() => setPickerOpen(false)}>×</button>
            </div>
            <div class="condition-picker-list">
              {available.map(c => (
                <button key={c} class="condition-picker-item" onClick={() => addCondition(c)}>{c}</button>
              ))}
            </div>
            <div class="condition-picker-custom">
              <input
                class="hp-modal-input"
                placeholder="Custom condition…"
                value={customName}
                onInput={e => setCustomName((e.target as HTMLInputElement).value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(); }}
              />
              <button class="cs-btn-small" onClick={addCustom}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
