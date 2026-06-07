import { useState } from 'preact/hooks';
import type { CharacterSpell, SpellList } from '../../data/types.js';

interface Props {
  spellLists: SpellList[];
  defaultListId?: string;
  onSave: (spell: CharacterSpell) => void;
  onClose: () => void;
}

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

export function CustomSpellModal({ spellLists, defaultListId, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(0);
  const [school, setSchool] = useState('');
  const [time, setTime] = useState('1 action');
  const [range, setRange] = useState('Self');
  const [components, setComponents] = useState('V, S');
  const [duration, setDuration] = useState('Instantaneous');
  const [isConcentration, setIsConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState(defaultListId ?? spellLists[0]?.id ?? '');
  const [error, setError] = useState('');

  function save() {
    if (!name.trim()) { setError('Name is required.'); return; }
    const spell: CharacterSpell = {
      name: name.trim(),
      level,
      school: school.toLowerCase(),
      time,
      range,
      components,
      duration,
      isConcentration,
      ritual,
      texts: description ? [description] : [],
      selected: false,
      active: false,
      listId,
      source: 'Custom',
    };
    onSave(spell);
  }

  return (
    <div class="bd-overlay" onClick={onClose}>
      <div class="custom-spell-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create custom spell">
        <div class="bd-header">
          <span class="bd-title">New Spell</span>
          <button class="bd-close" onClick={onClose}>×</button>
        </div>

        {error && <p class="form-error">{error}</p>}

        <div class="spell-form-grid">
          <label class="form-label">Name *
            <input class="form-input" value={name} onInput={e => setName((e.target as HTMLInputElement).value)} placeholder="Fireball" />
          </label>

          <label class="form-label">Level
            <select class="form-input" value={level} onChange={e => setLevel(Number((e.target as HTMLSelectElement).value))}>
              <option value={0}>Cantrip</option>
              {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>

          <label class="form-label">School
            <select class="form-input" value={school} onChange={e => setSchool((e.target as HTMLSelectElement).value)}>
              <option value="">—</option>
              {SCHOOLS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </label>

          <label class="form-label">Casting Time
            <input class="form-input" value={time} onInput={e => setTime((e.target as HTMLInputElement).value)} />
          </label>

          <label class="form-label">Range
            <input class="form-input" value={range} onInput={e => setRange((e.target as HTMLInputElement).value)} />
          </label>

          <label class="form-label">Components
            <input class="form-input" value={components} onInput={e => setComponents((e.target as HTMLInputElement).value)} placeholder="V, S, M (…)" />
          </label>

          <label class="form-label">Duration
            <input class="form-input" value={duration} onInput={e => setDuration((e.target as HTMLInputElement).value)} />
          </label>

          {spellLists.length > 1 && (
            <label class="form-label">Spell List
              <select class="form-input" value={listId} onChange={e => setListId((e.target as HTMLSelectElement).value)}>
                {spellLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div class="spell-form-checks">
          <label class="check-label">
            <input type="checkbox" checked={isConcentration} onChange={e => setIsConcentration((e.target as HTMLInputElement).checked)} />
            Concentration
          </label>
          <label class="check-label">
            <input type="checkbox" checked={ritual} onChange={e => setRitual((e.target as HTMLInputElement).checked)} />
            Ritual
          </label>
        </div>

        <label class="form-label">Description
          <textarea
            class="form-input form-textarea"
            value={description}
            onInput={e => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Spell description…"
            rows={4}
          />
        </label>

        <div class="form-actions">
          <button class="cs-btn-small" onClick={onClose}>Cancel</button>
          <button class="cs-btn-main" onClick={save}>Add Spell</button>
        </div>
      </div>
    </div>
  );
}
