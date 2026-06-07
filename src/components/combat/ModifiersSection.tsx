import { useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import { ModifierModal, type ActiveModifier } from '../shared/ModifierModal.js';
import type { Character } from '../../data/types.js';

interface Props {
  character: Character;
}

export function ModifiersSection({ character }: Props) {
  const [showModal, setShowModal] = useState(false);
  const mods = ((character.modifiers ?? []) as ActiveModifier[]);

  function toggle(mod: ActiveModifier) {
    const updated = mods.map(m =>
      m === mod || (m.id && m.id === mod.id) ? { ...m, active: !m.active } : m
    );
    patchCharacter({ modifiers: updated } as Partial<Character>);
  }

  function remove(mod: ActiveModifier) {
    patchCharacter({ modifiers: mods.filter(m => m !== mod && m.id !== mod.id) } as Partial<Character>);
  }

  function handleAdd(mod: ActiveModifier) {
    patchCharacter({ modifiers: [...mods, mod] } as Partial<Character>);
    setShowModal(false);
  }

  return (
    <div class="cs-combat-card">
      <div class="cs-card-header">
        <h3>Active Modifiers</h3>
        <button class="cs-btn-small" onClick={() => setShowModal(true)}>+ Add</button>
      </div>
      {mods.length === 0 ? (
        <p class="empty-hint">No modifiers yet.</p>
      ) : (
        <div class="mods-list">
          {mods.map((m, i) => (
            <div key={m.id ?? i} class={`mod-row${m.active ? ' mod-row-active' : ''}`}>
              {/* Active toggle checkbox */}
              <label class="mod-toggle-label" title={m.active ? 'Deactivate' : 'Activate'}>
                <input
                  type="checkbox"
                  class="mod-toggle-cb"
                  checked={!!m.active}
                  onChange={() => toggle(m)}
                />
              </label>
              <div class="mod-row-body">
                <span class="mod-name">{m.name}</span>
                {(m.modifiers ?? []).map((sub, j) => (
                  <span key={j} class="mod-detail">{sub.target}: {sub.type} {sub.value}</span>
                ))}
              </div>
              <button class="chip-remove" onClick={() => remove(m)} aria-label={`Remove ${m.name}`}>×</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModifierModal onSave={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
