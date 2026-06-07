import { render } from 'preact';
import { currentCharacter, patchCharacter } from './state/stores.js';
import { startPersistenceEffect } from './state/persistence.js';
import { CombatTab } from './components/combat/CombatTab.js';
import { StatsTab } from './components/stats/StatsTab.js';
import './combat.css';

// Mount combat tab
const combatRoot = document.getElementById('combat-root');
if (combatRoot) {
  render(<CombatTab />, combatRoot);
}

// Mount stats tab
const statsRoot = document.getElementById('stats-root');
if (statsRoot) {
  render(<StatsTab />, statsRoot);
}

// Start debounced persistence
startPersistenceEffect();

// Bridge: expose to legacy app.js via window so it can set the character signal
// and Preact can write back to the legacy global on every patch.
(window as any).__dndStore = {
  currentCharacter,
  patchCharacter,
};
