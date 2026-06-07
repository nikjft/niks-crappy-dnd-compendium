import { useState } from 'preact/hooks';
import type { Character, LevelHistoryEntry } from '../../data/types.js';

interface Props {
  character: Character;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function StatDelta({ increases }: { increases: Record<string, number> }) {
  const entries = Object.entries(increases).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return (
    <span class="lvl-stat-delta">
      {entries.map(([k, v]) => (
        <span key={k} class="lvl-stat-chip">
          {k.toUpperCase()} {v > 0 ? '+' : ''}{v}
        </span>
      ))}
    </span>
  );
}

interface EntryRowProps {
  entry: LevelHistoryEntry;
  isLast: boolean;
}

function EntryRow({ entry, isLast }: EntryRowProps) {
  const [expanded, setExpanded] = useState(false);

  function handleRespec() {
    (window as any).__legacyRespecLastLevel?.();
  }

  const label = entry.fromLevel === 0
    ? `Added ${entry.className} (multiclass)`
    : `${entry.className} → Level ${entry.toLevel}`;

  return (
    <div class={`lvl-entry${isLast ? ' lvl-entry-latest' : ''}`}>
      <div class="lvl-entry-header">
        <button class="lvl-expand-btn" onClick={() => setExpanded(e => !e)} aria-label="Toggle details">
          {expanded ? '▾' : '▸'}
        </button>
        <span class="lvl-label">{label}</span>
        <span class="lvl-meta">
          +{entry.hpGain} HP
          <StatDelta increases={entry.statIncreases ?? {}} />
          {entry.addedSubclassName && (
            <span class="lvl-subclass-chip">{entry.addedSubclassName}</span>
          )}
        </span>
        <span class="lvl-date">{formatDate(entry.timestamp)}</span>
        {isLast && (
          <button class="lvl-respec-btn" onClick={handleRespec} title="Undo this level-up">
            ↩ Respec
          </button>
        )}
      </div>

      {expanded && entry.featureNames.length > 0 && (
        <ul class="lvl-feature-list">
          {entry.featureNames.map((name, i) => (
            <li key={i} class="lvl-feature-item">{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LevelHistorySection({ character }: Props) {
  const history = (character.levelHistory ?? []) as LevelHistoryEntry[];
  // Only show entries that have the new delta shape (have an id field)
  const richHistory = history.filter(e => e.id && e.timestamp);
  const [collapsed, setCollapsed] = useState(true);

  if (richHistory.length === 0) {
    return (
      <div class="lvl-history-section">
        <div class="feat-list-header" style={{ cursor: 'default' }}>
          <span class="feat-list-title">Level History</span>
          <span class="feat-list-count" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            No history yet — use Level Up to start tracking
          </span>
        </div>
      </div>
    );
  }

  // Reverse so most recent is first
  const displayed = [...richHistory].reverse();

  return (
    <div class="lvl-history-section">
      <button
        class="feat-list-header lvl-history-toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span class="feat-list-title">Level History</span>
        <span class="feat-list-count">{richHistory.length} event{richHistory.length !== 1 ? 's' : ''}</span>
        <span class="feat-collapse-icon">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div class="lvl-entries">
          {displayed.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isLast={i === 0}   // first in reversed list = last added
            />
          ))}
        </div>
      )}
    </div>
  );
}
