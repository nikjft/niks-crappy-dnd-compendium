import { useState } from 'preact/hooks';

interface Props {
  label: string;
  items: string[];
  onUpdate: (newItems: string[]) => void;
}

export function SimpleTextList({ label, items, onUpdate }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  function handleAdd() {
    const val = newValue.trim();
    if (val && !items.includes(val)) {
      onUpdate([...items, val]);
    }
    setNewValue('');
    setIsAdding(false);
  }

  function handleRemove(item: string) {
    onUpdate(items.filter(i => i !== item));
  }

  return (
    <div class="cs-combat-card text-list-card">
      <div class="cs-card-header">
        <h3>{label}</h3>
      </div>
      <div class="text-list-content">
        <div class="text-list-chips">
          {items.map(item => (
            <span key={item} class="text-chip">
              {item}
              <button
                class="chip-remove"
                onClick={() => handleRemove(item)}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
          {isAdding ? (
            <div class="text-list-add-form">
              <input
                type="text"
                class="hp-modal-input text-list-input"
                placeholder={`New ${label.toLowerCase()}...`}
                value={newValue}
                onInput={e => setNewValue((e.target as HTMLInputElement).value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                autoFocus
              />
              <button class="cs-btn-small" onClick={handleAdd}>Add</button>
              <button class="cs-btn-small secondary" onClick={() => setIsAdding(false)}>Cancel</button>
            </div>
          ) : (
            <button
              class="chip-add"
              onClick={() => setIsAdding(true)}
              aria-label={`Add ${label.toLowerCase()}`}
            >
              + {label === 'Languages' ? 'Language' : 'Proficiency'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
