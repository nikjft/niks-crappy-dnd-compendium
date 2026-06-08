import { useState, useEffect, useRef } from 'preact/hooks';
import type { Character, CharacterClass } from '../../data/types.js';

interface Props {
  character: Character;
}

function ClassOverviewCard({ cls }: { cls: CharacterClass }) {
  const [html, setHtml] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load HTML once when expanded
  useEffect(() => {
    if (!expanded || html !== null) return;
    const result = (window as any).__legacyGetClassOverviewHTML?.(
      cls.name,
      cls.subclass ?? null,
      cls.level ?? null,
    );
    setHtml(result ?? '<p style="color:var(--text-muted)">No data available.</p>');
  }, [expanded, cls.name, cls.subclass]);

  const label = cls.subclass
    ? `${cls.name} · ${cls.subclass} (Level ${cls.level})`
    : `${cls.name} Overview (Level ${cls.level})`;

  return (
    <div class="class-overview-card">
      <button
        class="start-equip-toggle"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span class="material-icons-outlined" style="font-size:13px; margin-right:4px;">menu_book</span>
        <span>{label}</span>
        <span style="margin-left:auto;">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && html !== null && (
        <div
          class="class-overview-body"
          ref={containerRef}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

export function ClassOverviewSection({ character }: Props) {
  const classes = (character.classes ?? []) as CharacterClass[];
  if (classes.length === 0) return null;

  return (
    <>
      {classes.map(cls => (
        <ClassOverviewCard key={`${cls.name}-${cls.subclass ?? ''}`} cls={cls} />
      ))}
    </>
  );
}
