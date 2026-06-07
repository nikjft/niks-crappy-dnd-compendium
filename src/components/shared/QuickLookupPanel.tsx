/**
 * QuickLookupPanel — global search overlay (Ctrl+K / ⌘K or clicking a button).
 *
 * Searches spell, item, monster, feat, and class compendium records by name.
 * Clicking a result opens the legacy detail modal.
 * Press Escape to close.
 */
import { useState, useEffect, useRef } from 'preact/hooks';

interface SearchResult {
  name: string;
  type: string;
  record: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  spell:   'Spell',
  item:    'Item',
  monster: 'Monster',
  feat:    'Feat',
  class:   'Class',
};

const TYPE_ICONS: Record<string, string> = {
  spell:   '✨',
  item:    '🗡',
  monster: '🐲',
  feat:    '⭐',
  class:   '📖',
};

interface Props {
  onClose: () => void;
}

export function QuickLookupPanel({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard: Escape closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Outside click closes
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const tid = setTimeout(() => {
      const found: SearchResult[] = (window as any).__legacySearchCompendium?.(query, 24) ?? [];
      setResults(found);
    }, 120);
    return () => clearTimeout(tid);
  }, [query]);

  function openResult(r: SearchResult) {
    (window as any).__legacyOpenDetailForRecord?.(r.record, r.type);
    onClose();
  }

  return (
    <div class="ql-overlay">
      <div class="ql-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Quick Lookup">
        <div class="ql-search-row">
          <span class="ql-search-icon">🔍</span>
          <input
            ref={inputRef}
            class="ql-input"
            type="text"
            placeholder="Search spells, items, monsters, feats…"
            value={query}
            onInput={e => setQuery((e.target as HTMLInputElement).value)}
            autocomplete="off"
            spellcheck={false}
          />
          {query && (
            <button class="ql-clear-btn" onClick={() => setQuery('')} aria-label="Clear search">×</button>
          )}
        </div>

        {results.length > 0 ? (
          <ul class="ql-results">
            {results.map((r, i) => (
              <li key={i}>
                <button class="ql-result-item" onClick={() => openResult(r)}>
                  <span class="ql-result-icon" aria-hidden="true">
                    {TYPE_ICONS[r.type] ?? '📄'}
                  </span>
                  <span class="ql-result-name">{r.name}</span>
                  <span class="ql-result-type">{TYPE_LABELS[r.type] ?? r.type}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.length >= 2 ? (
          <p class="ql-no-results">No results for "{query}"</p>
        ) : (
          <p class="ql-hint">Start typing to search the compendium…</p>
        )}

        <div class="ql-footer">
          <span>↑↓ navigate</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
