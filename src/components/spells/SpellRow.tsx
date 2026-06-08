import { useState } from 'preact/hooks';
import { MarkdownContent } from '../shared/MarkdownContent.js';
import type { CharacterSpell } from '../../data/types.js';

interface Props {
  spell: CharacterSpell;
  onCycleState: (spell: CharacterSpell) => void;
  onEdit: (spell: CharacterSpell) => void;
  onDelete: (spell: CharacterSpell) => void;
}

const SCHOOL_ABBR: Record<string, string> = {
  abjuration: 'Abj', conjuration: 'Con', divination: 'Div', enchantment: 'Enc',
  evocation: 'Evo', illusion: 'Ill', necromancy: 'Nec', transmutation: 'Trs',
};

/**
 * Spell state cycle (all spells including cantrips):
 *   unprepared (hollow)  →  prepared (filled)  →  active/concentrating (bolt)  →  unprepared
 */
function StateButton({ spell, onCycle }: { spell: CharacterSpell; onCycle: () => void }) {
  const isActive   = !!spell.active;
  const isPrepared = !!spell.selected;

  if (isActive) {
    return (
      <button
        class="spell-state-btn spell-state-active"
        onClick={e => { e.stopPropagation(); onCycle(); }}
        aria-label="Active — click to un-prepare"
        title="Active — click to un-prepare"
      >
        <span class="material-icons-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">bolt</span>
      </button>
    );
  }
  return (
    <button
      class={`cs-prof-indicator${isPrepared ? ' prof' : ''}`}
      onClick={e => { e.stopPropagation(); onCycle(); }}
      aria-label={isPrepared ? 'Prepared — click to mark active' : 'Not prepared — click to prepare'}
      title={isPrepared ? 'Prepared — click to mark active' : 'Not prepared — click to prepare'}
      style="margin-right: 8px;"
    />
  );
}

export function SpellRow({ spell, onCycleState, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const school = spell.school ? (SCHOOL_ABBR[spell.school.toLowerCase()] ?? spell.school.slice(0, 3)) : '';

  return (
    <div class={`spell-row${spell.selected ? ' spell-prepared' : ''}${spell.active ? ' spell-active' : ''}`}>
      <div class="spell-row-main" onClick={() => setExpanded(v => !v)}>
        {/* State indicator */}
        <StateButton spell={spell} onCycle={() => onCycleState(spell)} />

        <div class="spell-name-block">
          <span class="spell-name">{spell.name}</span>
          <span class="spell-meta">
            {school && <span class="spell-tag school">{school}</span>}
            {spell.ritual && <span class="spell-tag ritual">R</span>}
            {spell.isConcentration && <span class="spell-tag conc" title="Concentration">C</span>}
            <span class="spell-time">{spell.time ?? '1 Action'}</span>
          </span>
        </div>
      </div>

      {expanded && (
        <div class="spell-detail">
          {/* Edit / Sync / Delete actions — upper right */}
          <div class="spell-detail-actions">
            <button class="cs-btn-small" onClick={() => onEdit(spell)}>
              <span class="material-icons-outlined" style="font-size: 11px;">edit</span> Edit
            </button>
            {spell.compendiumId && (
              <button class="cs-btn-small" onClick={() => (window as any).__legacySyncEntity?.(spell, 'spells')}>
                <span class="material-icons-outlined" style="font-size: 11px;">sync</span> Sync
              </button>
            )}
            <button class="cs-btn-small danger" onClick={() => onDelete(spell)}>
              <span class="material-icons-outlined" style="font-size: 11px;">delete</span> Delete
            </button>
          </div>
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
