import { useSignal } from '@preact/signals';
import { currentCharacter, charState } from '../../state/stores.js';
import { StatCard } from './StatCard.js';
import { HpSection } from './HpSection.js';
import { ConditionsBar } from './ConditionsBar.js';
import { AttacksSection } from './AttacksSection.js';
import { CountersSection } from './CountersSection.js';
import { ModifiersSection } from './ModifiersSection.js';
import { RestWizard } from './RestWizard.js';
import { QuickActionsSection } from './QuickActionsSection.js';
import { SpellSlotsTracker } from '../spells/SpellSlotsTracker.js';

type RestType = 'short' | 'long' | null;

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export function CombatTab() {
  const restWizard = useSignal<RestType>(null);

  const character = currentCharacter.value;
  const state = charState.value;

  if (!character || !state) {
    return <div class="combat-placeholder">Open a character sheet to get started.</div>;
  }

  const hpMax = state['hp.max']?.total ?? character.baseHpMax;
  const ac = state['ac']?.total ?? 10;
  const initiative = state['initiative']?.total ?? 0;
  const speed = state['speed']?.total ?? 30;
  const profBonus = state['prof_bonus']?.total ?? 2;

  return (
    <div class="combat-tab-root">
      {/* HP Section */}
      <HpSection character={character} hpMax={hpMax} />

      {/* Conditions */}
      <ConditionsBar character={character} />

      {/* Quick Actions */}
      <QuickActionsSection character={character} state={state} />

      {/* Top stat cards */}
      <div class="cs-combat-stats-grid">
        <StatCard label="Armor Class" value={String(ac)} breakdown={state['ac']} />
        <StatCard label="Initiative" value={sign(initiative)} breakdown={state['initiative']} />
        <StatCard label="Speed" value={`${speed} ft`} breakdown={state['speed']} />
        <StatCard label="Prof Bonus" value={sign(profBonus)} breakdown={state['prof_bonus']} />
      </div>

      {/* Main layout */}
      <div class="cs-combat-main-layout">
        <div class="cs-combat-left">
          <AttacksSection character={character} state={state} />
          <SpellSlotsTracker character={character} />
          <CountersSection character={character} />
        </div>
        <div class="cs-combat-right">
          <ModifiersSection character={character} />
        </div>
      </div>

      {/* Rest wizard overlay */}
      {restWizard.value && (
        <RestWizard
          character={character}
          state={state}
          type={restWizard.value}
          onClose={() => { restWizard.value = null; }}
        />
      )}
    </div>
  );
}
