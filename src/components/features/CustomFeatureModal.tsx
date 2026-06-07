import { useState } from 'preact/hooks';
import type { FeatureList, CharacterFeature } from '../../data/types.js';

interface CustomFeatureModalProps {
  featureLists: FeatureList[];
  defaultListId?: string;
  editFeature?: CharacterFeature;  // if provided, we're editing an existing feature
  onSave: (feature: CharacterFeature) => void;
  onClose: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function CustomFeatureModal({
  featureLists,
  defaultListId,
  editFeature,
  onSave,
  onClose,
}: CustomFeatureModalProps) {
  const isEdit = !!editFeature;

  const [name, setName] = useState(editFeature?.name ?? '');
  const [category, setCategory] = useState(editFeature?.category ?? '');
  const [description, setDescription] = useState(editFeature?.texts?.[0] ?? '');
  const [listId, setListId] = useState(editFeature?.listId ?? defaultListId ?? featureLists[0]?.id ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const texts: string[] = description.trim() ? [description.trim()] : [];
    const feature: CharacterFeature = {
      ...(editFeature ?? {}),
      id: editFeature?.id ?? generateId(),
      name: name.trim(),
      category: category.trim() || undefined,
      texts,
      listId,
    };
    onSave(feature);
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('feat-modal-backdrop')) {
      onClose();
    }
  }

  return (
    <div class="feat-modal-backdrop" onClick={handleBackdropClick}>
      <div class="custom-feat-modal">
        <h3 class="modal-title">{isEdit ? 'Edit Feature' : 'Create Custom Feature'}</h3>

        <div class="feat-form-grid">
          <label class="form-label" style={{ gridColumn: '1/-1' }}>
            Name *
            <input
              class="form-input"
              placeholder="Feature name"
              value={name}
              onInput={e => setName((e.target as HTMLInputElement).value)}
              autoFocus
            />
          </label>

          <label class="form-label">
            Category
            <input
              class="form-input"
              placeholder="e.g. Species Trait, Class Feature"
              value={category}
              onInput={e => setCategory((e.target as HTMLInputElement).value)}
            />
          </label>

          <label class="form-label">
            List
            <select
              class="form-input"
              value={listId}
              onChange={e => setListId((e.target as HTMLSelectElement).value)}
            >
              {featureLists.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>

          <label class="form-label" style={{ gridColumn: '1/-1' }}>
            Description
            <textarea
              class="form-input form-textarea"
              placeholder="Feature description (optional)"
              value={description}
              onInput={e => setDescription((e.target as HTMLTextAreaElement).value)}
            />
          </label>
        </div>

        {error && <p class="form-error">{error}</p>}

        <div class="form-actions">
          <button class="cs-btn-small" style={{ background: 'none', border: '1px solid var(--border-color)' }} onClick={onClose}>
            Cancel
          </button>
          <button class="cs-btn-small" style={{ background: 'var(--accent-color)', color: '#000', border: 'none' }} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Add Feature'}
          </button>
        </div>
      </div>
    </div>
  );
}
