import { useState } from 'preact/hooks';

// ─── Common stat targets the modifier can apply to ────────────────────────────

const MODIFIER_TARGETS = [
  { label: 'Strength Score',        value: 'str' },
  { label: 'Dexterity Score',       value: 'dex' },
  { label: 'Constitution Score',    value: 'con' },
  { label: 'Intelligence Score',    value: 'int' },
  { label: 'Wisdom Score',          value: 'wis' },
  { label: 'Charisma Score',        value: 'cha' },
  { label: 'STR Modifier',          value: 'str.mod' },
  { label: 'DEX Modifier',          value: 'dex.mod' },
  { label: 'CON Modifier',          value: 'con.mod' },
  { label: 'INT Modifier',          value: 'int.mod' },
  { label: 'WIS Modifier',          value: 'wis.mod' },
  { label: 'CHA Modifier',          value: 'cha.mod' },
  { label: 'Armor Class',           value: 'ac' },
  { label: 'Initiative',            value: 'initiative' },
  { label: 'Speed',                 value: 'speed' },
  { label: 'Proficiency Bonus',     value: 'prof_bonus' },
  { label: 'Passive Perception',    value: 'passive_perception' },
  { label: 'HP Maximum',            value: 'hp_max' },
  { label: 'Spell DC',              value: 'spell.dc' },
  { label: 'Spell Attack',          value: 'spell.attack' },
];

const MODIFIER_OPS = [
  { label: 'Add (+)', value: 'add' },
  { label: 'Set (=)', value: 'set' },
  { label: 'Minimum', value: 'min' },
  { label: 'Maximum', value: 'max' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveModifier {
  id?: string;
  name: string;
  active?: boolean;
  selected?: boolean;
  favorite?: boolean;
  modifiers?: Array<{ target: string; type: string; value: number | string }>;
}

interface ModifierModalProps {
  onSave: (modifier: ActiveModifier) => void;
  onClose: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModifierModal({ onSave, onClose }: ModifierModalProps) {
  const [name, setName]     = useState('');
  const [target, setTarget] = useState('ac');
  const [op, setOp]         = useState('add');
  const [value, setValue]   = useState('');
  const [error, setError]   = useState('');

  function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    const num = Number(value);
    if (!value.trim() || isNaN(num)) { setError('Value must be a number.'); return; }

    onSave({
      id: generateId(),
      name: name.trim(),
      active: true,
      selected: true,
      favorite: false,
      modifiers: [{ target, type: op, value: num }],
    });
  }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('mod-modal-backdrop')) onClose();
  }

  return (
    <div class="mod-modal-backdrop" onClick={handleBackdrop}>
      <div class="mod-modal-box">
        <h3 class="modal-title">Add Modifier</h3>

        <div class="mod-form">
          <label class="form-label">
            Name *
            <input
              class="form-input"
              placeholder="e.g. Ring of Protection"
              value={name}
              onInput={e => setName((e.target as HTMLInputElement).value)}
              autoFocus
            />
          </label>

          <label class="form-label">
            Target Stat
            <select class="form-input" value={target} onChange={e => setTarget((e.target as HTMLSelectElement).value)}>
              {MODIFIER_TARGETS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label class="form-label">
            Operation
            <select class="form-input" value={op} onChange={e => setOp((e.target as HTMLSelectElement).value)}>
              {MODIFIER_OPS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label class="form-label">
            Value *
            <input
              class="form-input"
              type="number"
              placeholder="e.g. 1"
              value={value}
              onInput={e => setValue((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>

        {error && <p class="form-error">{error}</p>}

        <div class="form-actions">
          <button
            class="cs-btn-small"
            style={{ background: 'none', border: '1px solid var(--border-color)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            class="cs-btn-small"
            style={{ background: 'var(--accent-color)', color: '#000', border: 'none' }}
            onClick={handleSave}
          >
            Add Modifier
          </button>
        </div>
      </div>
    </div>
  );
}
