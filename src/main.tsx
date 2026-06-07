import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { currentCharacter, patchCharacter } from './state/stores.js';
import { startPersistenceEffect } from './state/persistence.js';
import { CombatTab } from './components/combat/CombatTab.js';
import { StatsTab } from './components/stats/StatsTab.js';
import { InventoryTab } from './components/inventory/InventoryTab.js';
import { SpellsTab } from './components/spells/SpellsTab.js';
import { FeaturesTab } from './components/features/FeaturesTab.js';
import { QuickLookupPanel } from './components/shared/QuickLookupPanel.js';
import './combat.css';
import './stats.css';
import './inventory.css';
import './spells.css';
import './features.css';

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

// Mount features tab
const featuresRoot = document.getElementById('features-root');
if (featuresRoot) {
  render(<FeaturesTab />, featuresRoot);
}

// Mount Quick Lookup panel root (global — lives outside any tab)
function QuickLookupRoot() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Expose to legacy so the sheet header button can open it
  (window as any).__openQuickLookup = () => setOpen(true);

  return open ? <QuickLookupPanel onClose={() => setOpen(false)} /> : null;
}

const qlRoot = document.getElementById('quick-lookup-root');
if (qlRoot) {
  render(<QuickLookupRoot />, qlRoot);
}

// Start debounced persistence
startPersistenceEffect();

// Bridge: expose to legacy app.js via window so it can set the character signal
// and Preact can write back to the legacy global on every patch.
(window as any).__dndStore = {
  currentCharacter,
  patchCharacter,
};
