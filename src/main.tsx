import { render } from 'preact';
import { currentCharacter, patchCharacter } from './state/stores.js';
import { startPersistenceEffect } from './state/persistence.js';
import { CombatTab } from './components/combat/CombatTab.js';
import { StatsTab } from './components/stats/StatsTab.js';
import { InventoryTab } from './components/inventory/InventoryTab.js';
import { SpellsTab } from './components/spells/SpellsTab.js';
import './combat.css';
import './stats.css';
import './inventory.css';
import './spells.css';

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

// Mount inventory tab
const inventoryRoot = document.getElementById('inventory-root');
if (inventoryRoot) {
  render(<InventoryTab />, inventoryRoot);
}

// Mount spells tab
const spellsRoot = document.getElementById('spells-root');
if (spellsRoot) {
  render(<SpellsTab />, spellsRoot);
}

// Start debounced persistence
startPersistenceEffect();

// Bridge: expose to legacy app.js via window so it can set the character signal
// and Preact can write back to the legacy global on every patch.
(window as any).__dndStore = {
  currentCharacter,
  patchCharacter,
};
