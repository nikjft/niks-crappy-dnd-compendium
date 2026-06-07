import { useEffect, useRef, useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import type { Character, CharacterCondition } from '../../data/types.js';

const STANDARD_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

const CONDITION_EFFECTS: Record<string, string[]> = {
  Blinded: [
    'Automatically fails checks that require sight.',
    'Attack rolls against you have advantage.',
    'Your attack rolls have disadvantage.',
  ],
  Charmed: [
    "Can't attack the charmer or target them with harmful abilities.",
    'Charmer has advantage on social interaction checks against you.',
  ],
  Deafened: [
    'Automatically fails checks that require hearing.',
  ],
  Exhaustion: [
    'Level 1: Disadvantage on ability checks.',
    'Level 2: Speed halved.',
    'Level 3: Disadvantage on attack rolls and saving throws.',
    'Level 4: Hit point maximum halved.',
    'Level 5: Speed reduced to 0.',
    'Level 6: Death.',
  ],
  Frightened: [
    'Disadvantage on ability checks and attack rolls while source of fear is in sight.',
    "Can't willingly move closer to the source of fear.",
  ],
  Grappled: [
    'Speed becomes 0.',
    'Ends if the grappler is incapacitated or you are moved out of reach.',
  ],
  Incapacitated: [
    "Can't take actions or reactions.",
  ],
  Invisible: [
    'Impossible to see without magic or special senses.',
    'Considered heavily obscured for hiding.',
    'Attack rolls against you have disadvantage.',
    'Your attack rolls have advantage.',
  ],
  Paralyzed: [
    'Incapacitated; can\'t move or speak.',
    'Automatically fails STR and DEX saving throws.',
    'Attack rolls against you have advantage.',
    'Any attack that hits is a critical hit if within 5 ft.',
  ],
  Petrified: [
    'Transformed to stone; incapacitated, can\'t move or speak.',
    'Automatically fails STR and DEX saving throws.',
    'Resistance to all damage.',
    'Immune to poison and disease (existing don\'t progress).',
    'Attack rolls against you have advantage.',
  ],
  Poisoned: [
    'Disadvantage on attack rolls.',
    'Disadvantage on ability checks.',
  ],
  Prone: [
    'Movement costs double to stand up.',
    'Your attack rolls have disadvantage.',
    'Attacks against you have advantage within 5 ft, disadvantage beyond.',
  ],
  Restrained: [
    'Speed becomes 0.',
    'Attack rolls against you have advantage.',
    'Your attack rolls have disadvantage.',
    'Disadvantage on DEX saving throws.',
  ],
  Stunned: [
    'Incapacitated; can\'t move; can speak only falteringly.',
    'Automatically fails STR and DEX saving throws.',
    'Attack rolls against you have advantage.',
  ],
  Unconscious: [
    'Incapacitated; can\'t move or speak; unaware of surroundings.',
    'Drops held items; falls prone.',
    'Automatically fails STR and DEX saving throws.',
    'Attack rolls against you have advantage.',
    'Any attack that hits is a critical hit if within 5 ft.',
  ],
};

// ── Condition detail popup ────────────────────────────────────────────────────

interface ConditionPopupProps {
  condition: CharacterCondition;
  onClose: () => void;
  onRemove: () => void;
}

function ConditionPopup({ condition, onClose, onRemove }: ConditionPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const effects = CONDITION_EFFECTS[condition.name] ?? (condition.effects ? [condition.effects] : []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div class="bd-overlay">
      <div class="bd-popup cond-popup" ref={ref} role="dialog" aria-modal="true">
        <div class="bd-header">
          <span class="bd-title">{condition.name}</span>
          <button class="bd-close" onClick={onClose}>×</button>
        </div>

        {condition.spellName && (
          <p class="cond-spell-note">Concentrating on: <em>{condition.spellName}</em></p>
        )}

        {effects.length > 0 ? (
          <ul class="cond-effects-list">
            {effects.map((eff, i) => <li key={i}>{eff}</li>)}
          </ul>
        ) : (
          <p class="cond-effects-list" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No mechanical effects recorded.
          </p>
        )}

        <div class="form-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
          <button
            class="cs-btn-small"
            style={{ background: 'none', border: '1px solid var(--border-color)' }}
            onClick={onClose}
          >
            Close
          </button>
          <button
            class="cs-btn-small"
            style={{ background: 'var(--error-color)', color: '#fff', border: 'none' }}
            onClick={() => { onRemove(); onClose(); }}
          >
            Remove Condition
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  character: Character;
}

export function ConditionsBar({ character }: Props) {
  const conditions = character.conditions ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailCondition, setDetailCondition] = useState<CharacterCondition | null>(null);
  const [customName, setCustomName] = useState('');

  function removeCondition(name: string) {
    patchCharacter({ conditions: conditions.filter(c => c.name !== name) });
  }

  function addCondition(name: string) {
    if (conditions.some(c => c.name === name)) return;
    patchCharacter({ conditions: [...conditions, { name }] });
    setPickerOpen(false);
    setCustomName('');
  }

  function addCustom() {
    const n = customName.trim();
    if (n) addCondition(n);
  }

  const available = STANDARD_CONDITIONS.filter(c => !conditions.some(x => x.name === c));

  return (
    <div class="conditions-bar">
      <div class="conditions-chips">
        {conditions.map(c => (
          <span key={c.name} class={`condition-chip${c.isConcentration ? ' concentration' : ''}`}>
            {c.isConcentration && <span class="conc-dot" title="Concentration" />}
            <button
              class="cond-chip-name"
              onClick={() => setDetailCondition(c)}
              title="View condition effects"
            >
              {c.name}
              {c.spellName && <span class="conc-spell"> ({c.spellName})</span>}
            </button>
            <button class="chip-remove" onClick={() => removeCondition(c.name)} aria-label={`Remove ${c.name}`}>×</button>
          </span>
        ))}
        <button class="chip-add" onClick={() => setPickerOpen(true)} aria-label="Add condition">+ Condition</button>
      </div>

      {pickerOpen && (
        <div class="bd-overlay" onClick={() => setPickerOpen(false)}>
          <div class="condition-picker" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add condition">
            <div class="bd-header">
              <span class="bd-title">Add Condition</span>
              <button class="bd-close" onClick={() => setPickerOpen(false)}>×</button>
            </div>
            <div class="condition-picker-list">
              {available.map(c => (
                <button key={c} class="condition-picker-item" onClick={() => addCondition(c)}>{c}</button>
              ))}
            </div>
            <div class="condition-picker-custom">
              <input
                class="hp-modal-input"
                placeholder="Custom condition…"
                value={customName}
                onInput={e => setCustomName((e.target as HTMLInputElement).value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(); }}
              />
              <button class="cs-btn-small" onClick={addCustom}>Add</button>
            </div>
          </div>
        </div>
      )}

      {detailCondition && (
        <ConditionPopup
          condition={detailCondition}
          onClose={() => setDetailCondition(null)}
          onRemove={() => removeCondition(detailCondition.name)}
        />
      )}
    </div>
  );
}
