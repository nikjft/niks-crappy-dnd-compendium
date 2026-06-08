import { patchCharacter } from '../../state/stores.js';
import type { Character } from '../../data/types.js';

interface Counter {
  id: string;
  name: string;
  value: number;
  max: number;
  reset_short?: boolean;
  reset_long?: boolean;
}

interface Props {
  character: Character;
}

function pip(filled: boolean, key: number) {
  return <span key={key} class={`counter-pip${filled ? ' filled' : ''}`} />;
}

function CounterRow({ counter, counters, character }: { counter: Counter; counters: Counter[]; character: Character }) {
  function patch(newVal: number) {
    const updated = counters.map(c => c.id === counter.id ? { ...c, value: Math.max(0, Math.min(c.max, newVal)) } : c);
    patchCharacter({ counters: updated } as Partial<Character>);
  }

  const pips = Math.min(counter.max, 10);
  const resetLabel = counter.reset_short ? 'S' : counter.reset_long ? 'L' : '';

  return (
    <div class="counter-row">
      <div class="counter-info">
        <span class="counter-name">{counter.name}</span>
        {resetLabel && <span class="counter-reset-badge">{resetLabel}</span>}
      </div>
      <div class="counter-pips">
        {Array.from({ length: pips }, (_, i) => pip(i < counter.value, i))}
        {counter.max > 10 && <span class="counter-overflow">{counter.value}/{counter.max}</span>}
      </div>
      <div class="counter-controls">
        <button class="cs-hp-btn sm" onClick={() => patch(counter.value - 1)} aria-label={`Decrease ${counter.name}`}>−</button>
        <button class="cs-hp-btn sm" onClick={() => patch(counter.value + 1)} aria-label={`Increase ${counter.name}`}>+</button>
        <button class="counter-reset-btn" onClick={() => patch(counter.max)} aria-label={`Reset ${counter.name}`} title="Reset to max">↺</button>
      </div>
    </div>
  );
}

// Counters that are tracked elsewhere on the Combat tab (spell slots) or are
// not meaningful as pip-style usage counters on this screen.
const COMBAT_COUNTER_BLOCKLIST = new Set([
  'spells', 'spell slots', 'spell level', 'slot level', 'cantrips',
  'weapon mastery', 'unarmored movement',
  'eldritch invocations', 'type=ei', // type=ei is a 5etools import artifact for Eldritch Invocations
]);

export function CountersSection({ character }: Props) {
  const counters = ((character.counters ?? []) as Counter[])
    .filter(c => !c.id?.startsWith('_'))
    .filter(c => !COMBAT_COUNTER_BLOCKLIST.has(c.name?.toLowerCase?.() ?? ''));

  if (counters.length === 0) {
    return (
      <div class="cs-combat-card">
        <div class="cs-card-header">
          <h3>Usage Counters</h3>
          <button class="cs-btn-small" onClick={() => (window as any).__legacyOpenCounterModal?.()}>+ Add</button>
        </div>
        <p class="empty-hint">No counters yet.</p>
      </div>
    );
  }

  return (
    <div class="cs-combat-card">
      <div class="cs-card-header">
        <h3>Usage Counters</h3>
        <button class="cs-btn-small" onClick={() => (window as any).__legacyOpenCounterModal?.()}>+ Add</button>
      </div>
      <div class="counters-list">
        {counters.map(c => (
          <CounterRow key={c.id} counter={c} counters={counters} character={character} />
        ))}
      </div>
    </div>
  );
}
