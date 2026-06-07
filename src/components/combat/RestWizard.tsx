import { useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import type { Character, CharacterState } from '../../data/types.js';

interface Counter {
  id: string;
  name: string;
  value: number;
  max: number;
  reset_short?: boolean;
  reset: string;
  reset_long?: boolean;
}

interface Props {
  character: Character;
  state: CharacterState;
  type: 'short' | 'long';
  onClose: () => void;
}

export function RestWizard({ character, state, type, onClose }: Props) {
  const counters = (character.counters ?? []) as Counter[];
  const hpMax = state['hp.max']?.total ?? character.baseHpMax;
  const hpCurrent = character.hp?.current ?? 0;

  const shortResetCounters = counters.filter(c => c.reset_short || c.reset === 'S');
  const longResetCounters = counters.filter(c => c.reset_long || c.reset === 'L' || c.reset === 'S');
  const relevantCounters = type === 'short' ? shortResetCounters : longResetCounters;

  const [selected, setSelected] = useState<Set<string>>(() => new Set(relevantCounters.map(c => c.id)));
  const [hdHealing, setHdHealing] = useState('');

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function apply() {
    const updates: Partial<Character> = {};

    if (type === 'long') {
      updates.hp = { current: hpMax, temp: character.hp?.temp ?? 0 };
      updates.deathSaves = { successes: 0, failures: 0 };

      // Restore all spell slots to max
      if (character.spellSlots) {
        const restoredSlots: Record<number, { current: number; max: number }> = {};
        for (const [lvl, slot] of Object.entries(character.spellSlots)) {
          restoredSlots[Number(lvl)] = { current: slot.max, max: slot.max };
        }
        updates.spellSlots = restoredSlots;
      }
      // Restore Warlock Pact slots
      if (character.pactSlots) {
        updates.pactSlots = { ...character.pactSlots, current: character.pactSlots.max };
      }

      // Also call legacy to recalculate slot maximums from class table
      (window as any).__legacyRestoreSpellSlots?.();
    } else if (hdHealing) {
      const healed = parseInt(hdHealing) || 0;
      updates.hp = {
        current: Math.min(hpMax, hpCurrent + healed),
        temp: character.hp?.temp ?? 0,
      };
    }

    // Reset selected counters
    const updatedCounters = counters.map(c =>
      selected.has(c.id) ? { ...c, value: c.max } : c
    );
    updates.counters = updatedCounters;

    // Short rest: restore Warlock Pact Magic slots
    if (type === 'short' && character.pactSlots) {
      updates.pactSlots = { ...character.pactSlots, current: character.pactSlots.max };
    }

    patchCharacter(updates);
    onClose();
  }

  const title = type === 'short' ? 'Short Rest' : 'Long Rest';

  return (
    <div class="bd-overlay" onClick={onClose}>
      <div class="rest-wizard" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${title} wizard`}>
        <div class="bd-header">
          <span class="bd-title">{title}</span>
          <button class="bd-close" onClick={onClose}>×</button>
        </div>

        {type === 'short' && (
          <div class="rest-section">
            <label class="rest-label">Hit Dice Healing (enter HP regained)</label>
            <input
              class="hp-modal-input"
              type="number"
              min="0"
              placeholder="HP healed…"
              value={hdHealing}
              onInput={e => setHdHealing((e.target as HTMLInputElement).value)}
            />
          </div>
        )}

        {type === 'long' && (
          <div class="rest-section">
            <div class="rest-item">
              <span class="rest-item-check">✓</span>
              <span>HP restored to max ({hpCurrent} → {hpMax})</span>
            </div>
            <div class="rest-item">
              <span class="rest-item-check">✓</span>
              <span>All spell slots restored</span>
            </div>
            <div class="rest-item">
              <span class="rest-item-check">✓</span>
              <span>Death saves cleared</span>
            </div>
          </div>
        )}

        {relevantCounters.length > 0 && (
          <div class="rest-section">
            <p class="rest-label">Counters to reset:</p>
            {relevantCounters.map(c => (
              <label key={c.id} class="rest-item rest-item-check-label">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span>{c.name} ({c.value}/{c.max})</span>
              </label>
            ))}
          </div>
        )}

        <button class="cs-btn-main" onClick={apply}>Take {title}</button>
      </div>
    </div>
  );
}
