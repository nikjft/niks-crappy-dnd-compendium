import { useState } from 'preact/hooks';
import type { FeatureList, CharacterFeature, Modifier } from '../../data/types.js';

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

const STAT_OPTIONS = [
  { key: 'str.score', label: 'STR Score' }, { key: 'dex.score', label: 'DEX Score' },
  { key: 'con.score', label: 'CON Score' }, { key: 'int.score', label: 'INT Score' },
  { key: 'wis.score', label: 'WIS Score' }, { key: 'cha.score', label: 'CHA Score' },
  { key: 'hp.max', label: 'HP Max' },       { key: 'ac', label: 'Armor Class' },
  { key: 'speed', label: 'Speed' },          { key: 'prof_bonus', label: 'Prof. Bonus' },
  { key: 'initiative', label: 'Initiative' },
];

function extractMods(feature?: CharacterFeature): Modifier[] {
  if (!feature?.modifiers) return [];
  return (feature.modifiers as any[]).map(m => ({
    target: m.target ?? m.stat ?? m.key ?? 'str.score',
    type: (['add','set','min','max'].includes(m.type) ? m.type : 'add') as Modifier['type'],
    value: m.value ?? 0,
  }));
}

export function CustomFeatureModal({
  featureLists,
  defaultListId,
  editFeature,
  onSave,
  onClose,
}: CustomFeatureModalProps) {
  const isEdit = !!editFeature;

  const [name, setName]           = useState(editFeature?.name ?? '');
  const [category, setCategory]   = useState(editFeature?.category ?? '');
  const [description, setDescription] = useState(editFeature?.texts?.[0] ?? '');
  const [listId, setListId]       = useState(editFeature?.listId ?? defaultListId ?? featureLists[0]?.id ?? '');
  const [mods, setMods]           = useState<Modifier[]>(extractMods(editFeature));
  const [error, setError]         = useState('');

  function addMod() {
    setMods([...mods, { target: 'str.score', type: 'add', value: 0 }]);
  }

  function updateMod(idx: number, field: keyof Modifier, val: any) {
    setMods(mods.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  }

  function removeMod(idx: number) {
    setMods(mods.filter((_, i) => i !== idx));
  }

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
      ...(mods.length > 0 ? { modifiers: mods } : { modifiers: [] }),
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
              placeholder="Feature description (optional). Supports **bold**, *italic*, and lists."
              value={description}
              onInput={e => setDescription((e.target as HTMLTextAreaElement).value)}
            />
          </label>
        </div>

        {/* ── Modifiers ── */}
        <div class="feat-mods-section">
          <div class="feat-mods-header">
            <span class="feat-mods-title">Modifiers (when active)</span>
            <button class="cs-btn-small secondary" onClick={addMod} style="font-size:10px; padding:2px 8px;">
              + Add Modifier
            </button>
          </div>

          {mods.length === 0 && (
            <div style="font-size:11px; color:var(--text-muted); font-style:italic; padding:4px 0;">
              No modifiers. Click + Add Modifier to apply stat changes when this feature is active.
            </div>
          )}

          {mods.map((mod, idx) => (
            <div key={idx} class="feat-mod-row">
              <select
                class="form-input feat-mod-select"
                value={mod.target}
                onChange={e => updateMod(idx, 'target', (e.target as HTMLSelectElement).value)}
              >
                {STAT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <select
                class="form-input feat-mod-type"
                value={mod.type}
                onChange={e => updateMod(idx, 'type', (e.target as HTMLSelectElement).value as Modifier['type'])}
              >
                <option value="add">+/- (add)</option>
                <option value="set">= (set to)</option>
                <option value="min">min</option>
                <option value="max">max</option>
              </select>
              <input
                type="number"
                class="form-input feat-mod-value"
                value={mod.value as number}
                onInput={e => updateMod(idx, 'value', parseInt((e.target as HTMLInputElement).value) || 0)}
              />
              <button class="cs-btn-small danger" style="padding:2px 6px;" onClick={() => removeMod(idx)}>✕</button>
            </div>
          ))}
        </div>

        {error && <p class="form-error">{error}</p>}

        <div class="form-actions">
          <button class="cs-btn-small" onClick={onClose}>Cancel</button>
          <button class="cs-btn-main" onClick={handleSave}>{isEdit ? 'Save Changes' : 'Add Feature'}</button>
        </div>
      </div>
    </div>
  );
}
