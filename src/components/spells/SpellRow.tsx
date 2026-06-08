import { useState } from 'preact/hooks';
import { MarkdownContent } from '../shared/MarkdownContent.js';
import type { CharacterSpell } from '../../data/types.js';

interface Props {
  spell: CharacterSpell;
  onTogglePrepared: (spell: CharacterSpell) => void;
  onEdit: (spell: CharacterSpell) => void;
  onDelete: (spell: CharacterSpell) => void;
}

const SCHOOL_ABBR: Record<string, string> = {
  abjuration: 'Abj', conjuration: 'Con', divination: 'Div', enchantment: 'Enc',
  evocation: 'Evo', illusion: 'Ill', necromancy: 'Nec', transmutation: 'Trs',
};

export function SpellRow({ spell, onTogglePrepared, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isCantrip = spell.level === 0;
  const school = spell.school ? (SCHOOL_ABBR[spell.school.toLowerCase()] ?? spell.school.slice(0, 3)) : '';

  return (
    <div class={`spell-row${spell.selected ? ' spell-prepared' : ''}`}>
      <div class="spell-row-main" onClick={() => setExpanded(v => !v)}>
        {/* Prepared indicator / cantrip star */}
        {isCantrip ? (
          <span class="spell-prep-star" title="Cantrip" style="margin-right: 8px;">✦</span>
        ) : (
          <button
            class={`cs-prof-indicator${spell.selected ? ' prof' : ''}`}
            onClick={e => { e.stopPropagation(); onTogglePrepared(spell); }}
            aria-label={spell.selected ? 'Un-prepare spell' : 'Prepare spell'}
            title={spell.selected ? 'Prepared' : 'Not prepared'}
            style="margin-right: 8px;"
          />
        )}

        <div class="spell-name-block">
          <span class="spell-name">{spell.name}</span>
          <span class="spell-meta">
            {school && <span class="spell-tag school">{school}</span>}
            {spell.ritual && <span class="spell-tag ritual">R</span>}
            {spell.isConcentration && <span class="spell-tag conc" title="Concentration">C</span>}
            <span class="spell-time">{spell.time ?? '1 Action'}</span>
          </span>
        </div>

        <div class="spell-row-actions" onClick={e => e.stopPropagation()}>
          {/* Sync from compendium (only for compendium-sourced spells) */}
          {spell.compendiumId && (
            <button
              class="spell-action-btn"
              onClick={() => (window as any).__legacySyncEntity?.(spell, 'spells')}
              title="Resync from compendium"
            >
              <span class="material-icons-outlined" style="font-size: 14px;">sync</span>
            </button>
          )}
          {/* Edit spell */}
          <button
            class="spell-action-btn"
            onClick={() => onEdit(spell)}
            title="Edit spell properties"
          >
            <span class="material-icons-outlined" style="font-size: 14px;">edit</span>
          </button>
          <button
            class="spell-action-btn danger"
            onClick={() => onDelete(spell)}
            title="Remove from list"
          >
            <span class="material-icons-outlined" style="font-size: 14px;">delete</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div class="spell-detail">
          <div class="spell-detail-stats">
            {spell.range && <span><b>Range:</b> {spell.range}</span>}
            {spell.components && <span><b>Components:</b> {spell.components}</span>}
            {spell.duration && <span><b>Duration:</b> {spell.duration}</span>}
          </div>
          <MarkdownContent texts={spell.texts ?? []} class="spell-detail-text" />
        </div>
      )}
    </div>
  );
}
