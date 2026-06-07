import { useState } from 'preact/hooks';
import { currentCharacter, patchCharacter } from '../../state/stores.js';
import type { FeatureList, CharacterFeature } from '../../data/types.js';

// ─── Feature Row ──────────────────────────────────────────────────────────────

interface FeatureRowProps {
  feature: CharacterFeature;
  onToggleActive: (f: CharacterFeature) => void;
  onDelete: (f: CharacterFeature) => void;
}

function FeatureRow({ feature, onToggleActive, onDelete }: FeatureRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (feature.isDynamic) {
    // Read-only derived row from class progression table
    return (
      <div class="feat-row feat-row-dynamic">
        <div class="feat-row-main" style={{ cursor: 'default' }}>
          <span class="feat-name">{feature.name}</span>
        </div>
      </div>
    );
  }

  if (feature.isOverview) {
    // Class / subclass overview row — clicking opens legacy detail modal
    return (
      <div class="feat-row feat-row-overview">
        <div class="feat-row-main" onClick={() => (window as any).__legacyOpenFeatureDetail?.(feature)}>
          <span class="feat-overview-icon">📋</span>
          <div class="feat-name-block">
            <span class="feat-name">{feature.name}</span>
            {feature.texts?.[0] && (
              <span class="feat-sub">{feature.texts[0]}</span>
            )}
          </div>
          <button
            class="feat-action-btn"
            title="Resync from compendium"
            onClick={e => {
              e.stopPropagation();
              (window as any).__legacyResyncClass?.(feature);
            }}
          >
            🔄
          </button>
        </div>
      </div>
    );
  }

  const texts = feature.texts ?? [];

  return (
    <div class={`feat-row${feature.active ? ' feat-active' : ''}`}>
      <div class="feat-row-main" onClick={() => setExpanded(e => !e)}>
        <div class="feat-name-block">
          <span class="feat-name">{feature.name}</span>
          {feature.category && <span class="feat-category">{feature.category}</span>}
        </div>
        <div class="feat-row-actions" onClick={e => e.stopPropagation()}>
          {/* Active toggle */}
          <button
            class={`feat-action-btn${feature.active ? ' feat-btn-active' : ''}`}
            title={feature.active ? 'Deactivate' : 'Activate'}
            onClick={() => onToggleActive(feature)}
          >
            ⚡
          </button>
          {/* Delete */}
          <button
            class="feat-action-btn danger"
            title="Remove"
            onClick={() => {
              if (window.confirm(`Remove "${feature.name}"?`)) onDelete(feature);
            }}
          >
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <div class="feat-detail">
          {texts.length > 0
            ? texts.map((t, i) => <p key={i} class="feat-detail-text">{t}</p>)
            : <p class="feat-detail-text" style={{ color: 'var(--text-muted)' }}>No description.</p>
          }
        </div>
      )}
    </div>
  );
}

// ─── Feature List Section ─────────────────────────────────────────────────────

interface FeatureListSectionProps {
  listDef: FeatureList;
  features: CharacterFeature[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleActive: (f: CharacterFeature) => void;
  onDelete: (f: CharacterFeature) => void;
}

function FeatureListSection({
  listDef,
  features,
  collapsed,
  onToggleCollapse,
  onToggleActive,
  onDelete,
}: FeatureListSectionProps) {
  const sorted = [...features].sort((a, b) => {
    const rank = (i: CharacterFeature) => i.active ? 0 : (i.selected ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div class="feat-list-section">
      <div class="feat-list-header" onClick={onToggleCollapse}>
        <span class="feat-list-collapse-icon">{collapsed ? '▶' : '▼'}</span>
        <span class="feat-list-name">{listDef.name}</span>
        <span class="feat-list-count">{features.length}</span>
        <div class="feat-list-header-actions" onClick={e => e.stopPropagation()}>
          <button
            class="cs-btn-small feat-add-btn"
            title="Add from compendium"
            onClick={() => (window as any).__legacyOpenPicker?.('feats', listDef.id)}
          >
            + Add
          </button>
        </div>
      </div>

      {!collapsed && (
        <div class="feat-list-body">
          {sorted.length === 0 ? (
            <p class="feat-empty-hint">Empty. Click + Add to add features.</p>
          ) : (
            sorted.map((f, i) => (
              <FeatureRow
                key={f.id ?? `${f.name}-${i}`}
                feature={f}
                onToggleActive={onToggleActive}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function FeaturesTab() {
  const character = currentCharacter.value;

  if (!character) {
    return <div class="combat-placeholder">Open a character sheet to get started.</div>;
  }

  const char = character;
  const featureLists: FeatureList[] = (char.featureLists as FeatureList[]) ?? [];
  const features: CharacterFeature[] = (char.features as CharacterFeature[]) ?? [];
  const collapsedLists: Record<string, boolean> = char.collapsedLists ?? {};

  function getListFeatures(listId: string): CharacterFeature[] {
    return features.filter(f => f.listId === listId);
  }

  function toggleCollapse(listId: string) {
    patchCharacter({
      collapsedLists: {
        ...collapsedLists,
        [listId]: !collapsedLists[listId],
      },
    });
  }

  function handleToggleActive(feature: CharacterFeature) {
    const updated = features.map(f =>
      (f.id ? f.id === feature.id : f === feature)
        ? { ...f, active: !f.active }
        : f
    );
    patchCharacter({ features: updated });
  }

  function handleDelete(feature: CharacterFeature) {
    const updated = features.filter(f =>
      f.id ? f.id !== feature.id : f !== feature
    );
    patchCharacter({ features: updated });
  }

  return (
    <div class="features-tab-root">
      {/* Build summary bar */}
      <div class="feat-build-summary">
        <span class="feat-summary-item">
          <span class="feat-summary-label">Species</span>
          <span class="feat-summary-value">{(char as any).species || (char as any).race || '—'}</span>
        </span>
        <span class="feat-summary-sep">·</span>
        <span class="feat-summary-item">
          <span class="feat-summary-label">Background</span>
          <span class="feat-summary-value">{char.background || '—'}</span>
        </span>
        <span class="feat-summary-sep">·</span>
        <span class="feat-summary-item">
          <span class="feat-summary-label">Subclass</span>
          <span class="feat-summary-value">
            {(char.classes as any[])?.find(c => c.subclass)?.subclass || '—'}
          </span>
        </span>
      </div>

      {/* Feature lists */}
      {featureLists.length === 0 ? (
        <div class="feat-empty-state">
          <p>No feature lists yet. Create a character or add a feature list below.</p>
        </div>
      ) : (
        <div class="feat-lists-container">
          {featureLists.map(listDef => (
            <FeatureListSection
              key={listDef.id}
              listDef={listDef}
              features={getListFeatures(listDef.id)}
              collapsed={!!collapsedLists[listDef.id]}
              onToggleCollapse={() => toggleCollapse(listDef.id)}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div class="feat-bottom-controls">
        <button
          class="cs-btn-small"
          onClick={() => (window as any).__legacyAddFeatureList?.()}
        >
          + Feature List
        </button>
      </div>
    </div>
  );
}
