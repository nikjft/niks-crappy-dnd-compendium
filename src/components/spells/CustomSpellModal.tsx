import { useState } from 'preact/hooks';
import type { CharacterSpell, SpellList } from '../../data/types.js';

interface Props {
  spellLists: SpellList[];
  defaultListId?: string;
  editSpell?: CharacterSpell;
  onSave: (spell: CharacterSpell) => void;
  onClose: () => void;
}

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

export function CustomSpellModal({ spellLists, defaultListId, editSpell, onSave, onClose }: Props) {
  const isEdit = !!editSpell;
  const [name, setName] = useState(editSpell?.name ?? '');
  const [level, setLevel] = useState(editSpell?.level ?? 0);
  const [school, setSchool] = useState(editSpell?.school ?? '');
  const [time, setTime] = useState(editSpell?.time ?? '1 action');
  const [range, setRange] = useState(editSpell?.range ?? 'Self');
  const [components, setComponents] = useState(editSpell?.components ?? 'V, S');
  const [duration, setDuration] = useState(editSpell?.duration ?? 'Instantaneous');
  const [isConcentration, setIsConcentration] = useState(editSpell?.isConcentration ?? false);
  const [ritual, setRitual] = useState(editSpell?.ritual ?? false);
  const [description, setDescription] = useState(editSpell?.texts?.[0] ?? '');
  const [listId, setListId] = useState(editSpell?.listId ?? defaultListId ?? spellLists[0]?.id ?? '');
  const [error, setError] = useState('');

  function save() {
    if (!name.trim()) { setError('Name is required.'); return; }
    const spell: CharacterSpell = {
      ...(editSpell ?? {}),
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
      selected: editSpell ? (editSpell.selected ?? false) : false,
      active: editSpell ? (editSpell.active ?? false) : false,
      listId,
      source: editSpell ? (editSpell.source ?? 'Custom') : 'Custom',
    };
    onSave(spell);
  }

  return (
    <div class="bd-overlay" onClick={onClose}>
      <div class="custom-spell-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit spell' : 'Create custom spell'}>
        <div class="bd-header">
          <span class="bd-title">{isEdit ? 'Edit Spell' : 'New Spell'}</span>
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
          <button class="cs-btn-main" onClick={save}>{isEdit ? 'Save Changes' : 'Add Spell'}</button>
        </div>
      </div>
    </div>
  );
}
