import { useState } from 'preact/hooks';
import type { Character } from '../../data/types.js';
import { patchCharacter } from '../../state/stores.js';

interface Props {
  character: Character;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export function SettingsPanel({ character }: Props) {
  const itemLists = character.itemLists ?? [];
  const equipment = character.equipment ?? [];
  const [newListName, setNewListName] = useState('');

  const weightEnabled = character.weightTrackingEnabled ?? false;
  const attuneMax = character.attunementMax ?? 3;

  function toggleWeight() {
    patchCharacter({ weightTrackingEnabled: !weightEnabled });
  }

  function handleAttuneMaxChange(val: number) {
    patchCharacter({ attunementMax: Math.max(0, val) });
  }

  function handleAddList() {
    const name = newListName.trim();
    if (!name) return;
    const newList = { id: generateId(), name };
    patchCharacter({
      itemLists: [...itemLists, { id: newList.id, name: newList.name }]
    });
    setNewListName('');
  }

  function handleRenameList(id: string, name: string) {
    const updated = itemLists.map((l: any) => (l.id === id ? { ...l, name } : l));
    patchCharacter({ itemLists: updated });
  }

  function handleDeleteList(id: string) {
    // Check if it's the last list
    if (itemLists.length <= 1) {
      alert('Cannot delete the only gear list.');
      return;
    }
    // Check if it's the default (first) list
    if ((itemLists[0] as any).id === id) {
      alert('Cannot delete the default gear list.');
      return;
    }
    // Check if empty
    const hasItems = equipment.some((i: any) => i.listId === id);
    if (hasItems) {
      alert('Cannot delete a gear list that contains items. Move or delete the items first.');
      return;
    }

    const updated = itemLists.filter((l: any) => l.id !== id);
    patchCharacter({ itemLists: updated });
  }

  return (
    <div class="settings-drawer">
      <h4 style="margin: 0; font-size: 13px; color: var(--text-primary);">Inventory Settings</h4>
      
      {/* Weight display toggle */}
      <div class="settings-toggle-row">
        <span style="font-size: 12px; color: var(--text-secondary);">Enable Weight & Carry Capacity Tracking</span>
        <input
          type="checkbox"
          checked={weightEnabled}
          onChange={toggleWeight}
          aria-label="Toggle weight tracking"
        />
      </div>

      {/* Attunement slots */}
      <div class="settings-input-row">
        <span style="font-size: 12px; color: var(--text-secondary);">Maximum Attunement Slots</span>
        <input
          type="number"
          min="0"
          value={attuneMax}
          onChange={e => handleAttuneMaxChange(parseInt((e.target as HTMLInputElement).value) || 0)}
          class="hp-modal-input"
          style="width: 60px; text-align: center; margin: 0;"
          aria-label="Max attunement slots"
        />
      </div>

      {/* Gear lists management */}
      <div class="gear-lists-management">
        <span style="font-size: 12px; font-weight: bold; color: var(--text-secondary); margin-bottom: 4px; display: block;">
          Gear Containers / Lists
        </span>
        {itemLists.map((list: any, idx: number) => {
          const isDefault = idx === 0;
          const itemCount = equipment.filter((i: any) => i.listId === list.id).length;
          return (
            <div key={list.id} class="gear-list-mgmt-row">
              <input
                type="text"
                value={list.name}
                onChange={e => handleRenameList(list.id, (e.target as HTMLInputElement).value)}
                aria-label={`Rename list ${list.name}`}
              />
              <span style="font-size: 11px; color: var(--text-muted); margin-right: 8px;">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </span>
              {!isDefault && itemCount === 0 && (
                <button
                  class="btn-icon-only danger"
                  onClick={() => handleDeleteList(list.id)}
                  title="Delete gear list"
                  aria-label={`Delete list ${list.name}`}
                >
                  🗑️
                </button>
              )}
            </div>
          );
        })}

        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <input
            type="text"
            class="hp-modal-input"
            style="flex: 1; margin: 0;"
            placeholder="New List Name (e.g. Bag of Holding)"
            value={newListName}
            onInput={e => setNewListName((e.target as HTMLInputElement).value)}
            aria-label="New gear list name"
          />
          <button class="cs-btn-small" onClick={handleAddList}>
            Add List
          </button>
        </div>
      </div>
    </div>
  );
}
