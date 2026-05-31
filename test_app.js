import fs from 'fs';
import { JSDOM } from 'jsdom';
import nodeCrypto from 'crypto';

// Read files
const htmlText = fs.readFileSync('./index.html', 'utf8');
let appJsText = fs.readFileSync('./app.js', 'utf8');
let parserJsText = fs.readFileSync('./parser.js', 'utf8');
let dbJsText = fs.readFileSync('./db.js', 'utf8');
let engineJsText = fs.readFileSync('./engine.js', 'utf8');

// Strip ES module imports/exports so we can run them in JSDOM VM
appJsText = appJsText.replace(/import\s+\{[^}]*\}\s+from\s+['"].*?['"];?\n?/g, '');
parserJsText = parserJsText.replace(/export\s+/g, '');
dbJsText = dbJsText.replace(/export\s+/g, '');
engineJsText = engineJsText.replace(/export\s+/g, '');

// Create JSDOM
const dom = new JSDOM(htmlText, { runScripts: "dangerously", url: "http://localhost/" });
const { window } = dom;
const { document } = window;

// Expose globals that app.js expects
global.window = window;
global.document = document;
global.localStorage = window.localStorage;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true });

// ── Mock navigator.storage (persistence + quota) ──
window.navigator.storage = {
  persist: () => Promise.resolve(true),
  persisted: () => Promise.resolve(false),
  estimate: () => Promise.resolve({ usage: 1024 * 1024 * 10, quota: 1024 * 1024 * 1000 }), // 10MB / 1GB
};

// ── Mock Web Crypto (PKCE generation) ──
const testWebCryptoSubtle = nodeCrypto.webcrypto
  ? nodeCrypto.webcrypto.subtle
  : nodeCrypto.subtle;

const testCryptoImpl = {
  getRandomValues: (arr) => {
    const bytes = nodeCrypto.randomBytes(arr.length);
    for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
    return arr;
  },
  subtle: testWebCryptoSubtle,
};

// window.crypto may be read-only in JSDOM — use Object.defineProperty
try {
  Object.defineProperty(window, 'crypto', { value: testCryptoImpl, configurable: true, writable: true });
} catch (e) {
  // already defined or read-only — ignore
}
try {
  Object.defineProperty(global, 'crypto', { value: testCryptoImpl, configurable: true, writable: true });
} catch (e) {
  // Node.js 25 has built-in crypto — that's fine, tests don't need PKCE in app integration tests
}

// Mock Fetch to return the actual XML content
const xmlData = fs.readFileSync('./source-data/System_Reference_Document_5.5e.xml', 'utf8');
window.fetch = (url) => {
  console.log(`[Mock Fetch] Fetching: ${url}`);
  if (url.includes('System_Reference_Document_5.5e.xml')) {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(xmlData)
    });
  }
  return Promise.reject(new Error(`Fetch not mocked for: ${url}`));
};

// In-memory IndexedDB mock
const mockDB = {};
const STORES = ['spells', 'items', 'monsters', 'classes', 'subclasses', 'feats', 'backgrounds', 'races', 'options', 'favorites', 'characters'];
STORES.forEach(store => { mockDB[store] = []; });

// App settings mock
const mockAppSettings = {};
// Sync meta mock
const mockSyncMeta = {};

window.STORES = STORES;

window.openDB = () => Promise.resolve({
  transaction: (stores, mode) => {
    const tx = {
      objectStore: (storeName) => ({
        clear: () => {
          if (mockDB[storeName]) mockDB[storeName] = [];
        }
      }),
      oncomplete: null,
      onerror: null
    };
    setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
    return tx;
  }
});
window.saveRecords = (storeName, records, opts = {}) => {
  console.log(`[Mock DB] saveRecords for ${storeName}: saving ${records.length} records`);
  mockDB[storeName] = records;
  return Promise.resolve();
};
window.saveRecord = (storeName, record) => {
  console.log(`[Mock DB] saveRecord for ${storeName}: saving record ${record.name}`);
  if (!mockDB[storeName]) mockDB[storeName] = [];
  const idx = mockDB[storeName].findIndex(r => r.name === record.name);
  if (idx >= 0) {
    mockDB[storeName][idx] = record;
  } else {
    mockDB[storeName].push(record);
  }
  return Promise.resolve(record);
};
window.getAllRecords = (storeName) => {
  console.log(`[Mock DB] getAllRecords for ${storeName}: returning ${mockDB[storeName] ? mockDB[storeName].length : 0} records`);
  return Promise.resolve(mockDB[storeName] || []);
};
window.clearDatabase = () => {
  console.log(`[Mock DB] clearDatabase called`);
  STORES.forEach(store => { mockDB[store] = []; });
  return Promise.resolve();
};
window.exportAllData = () => {
  console.log('[Mock DB] exportAllData called');
  const snap = {};
  STORES.forEach(s => { snap[s] = [...mockDB[s]]; });
  return Promise.resolve(snap);
};
window.importAllData = (data, opts = {}) => {
  console.log('[Mock DB] importAllData called');
  const { merge = false } = opts;
  if (!merge) STORES.forEach(s => { mockDB[s] = []; });
  STORES.forEach(s => { if (data[s]) mockDB[s] = [...data[s]]; });
  return Promise.resolve();
};
window.getSyncMeta = (id = 'global') => Promise.resolve(mockSyncMeta[id] || null);
window.saveSyncMeta = (id = 'global', meta) => { mockSyncMeta[id] = { id, ...meta }; return Promise.resolve(); };
window.getAppSetting = (key) => Promise.resolve(mockAppSettings[key] || null);
window.saveAppSetting = (key, value) => { mockAppSettings[key] = value; return Promise.resolve(); };
window.deleteAppSetting = (key) => { delete mockAppSettings[key]; return Promise.resolve(); };

// ── Mock sync module ──
window.syncState = { status: 'idle', lastSyncAt: null, isLinked: false, lastError: null, pendingUpload: false };
window.syncNow = () => { console.log('[Mock Sync] syncNow called'); return Promise.resolve({ success: true, conflicts: [], mergedRecords: 0 }); };
window.scheduleDebouncedSync = () => { console.log('[Mock Sync] scheduleDebouncedSync called'); };
window.onSyncStatusChange = (cb) => {};
window.startDropboxOAuth = (key, uri) => Promise.resolve();
window.unlinkDropbox = () => Promise.resolve();
window.isDropboxLinked = () => Promise.resolve(false);
window.refreshAccessToken = () => Promise.resolve(null);

// ── Mock storage module ──
window.storageHealth = { persistenceGranted: true, quotaUsage: 10 * 1024 * 1024, quotaTotal: 1024 * 1024 * 1024, percentUsed: 0.01, apiSupported: true };
window.initStorage = () => Promise.resolve();
window.getStorageQuota = () => Promise.resolve({ usage: 10 * 1024 * 1024, quota: 1024 * 1024 * 1024, percentUsed: 0.01 });
window.onQuotaWarning = (cb) => {};
window.onPersistenceResult = (cb) => { cb({ granted: true }); };
window.formatBytes = (bytes) => `${bytes} B`;

// ── Mock ui-sync module ──
window.handleSyncStateChange = (state) => {};
window.showConflictModal = (conflicts) => Promise.resolve('local');
window.renderSyncStatusBadge = (el, state) => { if (el) el.innerHTML = '<div class="sync-status-badge badge--muted">Mock Badge</div>'; };
window.renderStorageBadge = (el) => { if (el) el.innerHTML = '<div class="storage-health-block">Mock Storage</div>'; };

// ── Mock initSync ──
window.initSync = () => { console.log('[Mock Sync] initSync called'); return Promise.resolve(); };

// Evaluate parser.js and db.js in window context
const evalInWindow = (code) => {
  const scriptEl = document.createElement("script");
  scriptEl.textContent = code;
  document.body.appendChild(scriptEl);
};

// Log redirect
window.console.error = (...args) => console.error("[Browser Console Error]", ...args);
window.console.log = (...args) => console.log("[Browser Console Log]", ...args);

// Inject Parser, DB, and Engine code
evalInWindow(parserJsText);
evalInWindow(engineJsText);

// Inject App code
evalInWindow(appJsText);

// Run tests
async function runTests() {
  console.log("Simulating DOMContentLoaded...");
  const event = new window.Event('DOMContentLoaded');
  window.dispatchEvent(event);

  // Wait for async seeding to finish
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("\n--- Checking database seeding ---");
  STORES.forEach(store => {
    console.log(`Store '${store}': ${mockDB[store].length} records loaded.`);
    if (store !== 'favorites' && store !== 'characters' && mockDB[store].length === 0) {
      throw new Error(`Seeding failed for store: ${store}`);
    }
  });

  console.log("\n--- Simulating navigation & facet interaction ---");

  // Helper to click menu item
  const clickMenu = async (category) => {
    console.log(`\nNavigating to category: ${category}`);
    const menuItem = document.querySelector(`.menu-item[data-category="${category}"]`);
    if (!menuItem) throw new Error(`Menu item not found for category: ${category}`);
    menuItem.click();
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  // Test Spells Facets & Selection
  await clickMenu('spells');
  const spellFacetItems = document.querySelectorAll('#facet-list-1 .facet-item button');
  console.log(`Found ${spellFacetItems.length} spells facets.`);
  if (spellFacetItems.length === 0) throw new Error("No spell facets rendered.");
  
  // Click a spell class facet (e.g. Wizard)
  const wizardFacet = Array.from(spellFacetItems).find(btn => btn.textContent.includes('Wizard'));
  if (wizardFacet) {
    console.log(`Clicking wizard spell facet: ${wizardFacet.textContent.trim()}`);
    wizardFacet.click();
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Check items list
  let listItems = document.querySelectorAll('#item-list .item-list-item button');
  console.log(`Found ${listItems.length} spells in active list.`);
  if (listItems.length === 0) throw new Error("No spells rendered in list.");

  // Click first spell to verify detail pane rendering
  console.log(`Clicking first spell: ${listItems[0].querySelector('.item-title').textContent}`);
  listItems[0].click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const detailTitle = document.querySelector('#detail-pane-content h1');
  console.log(`Detail panel header: ${detailTitle ? detailTitle.textContent : 'NOT FOUND'}`);
  if (!detailTitle) throw new Error("Spell detail pane failed to render.");

  // Test Spells Typeahead Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    console.log("Typing 'Fire' in spells list search...");
    searchInput.value = 'Fire';
    const inputEvent = new window.Event('input');
    searchInput.dispatchEvent(inputEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const searchedItems = document.querySelectorAll('#item-list .item-list-item button');
    console.log(`Found ${searchedItems.length} spells after searching 'Fire'.`);
    if (searchedItems.length === 0) throw new Error("No spells found for 'Fire' search.");
    
    // Clear search
    searchInput.value = '';
    searchInput.dispatchEvent(inputEvent);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Test Items
  await clickMenu('items');
  const itemFacetItems = document.querySelectorAll('#facet-list-1 .facet-item button');
  console.log(`Found ${itemFacetItems.length} items facets.`);
  if (itemFacetItems.length === 0) throw new Error("No item facets rendered.");
  
  // Click first item facet (e.g. Light Armor or Melee Weapon)
  const firstItemFacet = itemFacetItems[1]; // Index 0 is 'All'
  console.log(`Clicking item facet: ${firstItemFacet.textContent.trim()}`);
  firstItemFacet.click();
  await new Promise(resolve => setTimeout(resolve, 50));

  listItems = document.querySelectorAll('#item-list .item-list-item button');
  console.log(`Found ${listItems.length} items in active list.`);
  if (listItems.length === 0) throw new Error("No items rendered in list.");

  console.log(`Clicking first item: ${listItems[0].querySelector('.item-title').textContent}`);
  listItems[0].click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const itemDetailTitle = document.querySelector('#detail-pane-content h1');
  console.log(`Detail panel header: ${itemDetailTitle ? itemDetailTitle.textContent : 'NOT FOUND'}`);
  if (!itemDetailTitle) throw new Error("Item detail pane failed to render.");

  // Test Bestiary
  await clickMenu('monsters');
  const monsterFacetItems = document.querySelectorAll('#facet-list-1 .facet-item button');
  console.log(`Found ${monsterFacetItems.length} monster facets.`);
  if (monsterFacetItems.length !== 3) throw new Error(`Expected 3 monster facets in Facet 1, got ${monsterFacetItems.length}`);
  
  const crFacet = monsterFacetItems[1]; // Index 1 is 'By CR'
  console.log(`Clicking monster CR facet: ${crFacet.textContent.trim()}`);
  crFacet.click();
  await new Promise(resolve => setTimeout(resolve, 50));

  const monsterFacet2Items = document.querySelectorAll('#facet-list-2 .facet-item button');
  console.log(`Found ${monsterFacet2Items.length} CR sub-facets.`);
  if (monsterFacet2Items.length === 0) throw new Error("No CR sub-facets rendered.");

  const cr0Facet = Array.from(monsterFacet2Items).find(btn => btn.textContent.includes('0 '));
  if (cr0Facet) {
    console.log(`Clicking CR 0 sub-facet: ${cr0Facet.textContent.trim()}`);
    cr0Facet.click();
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  listItems = document.querySelectorAll('#item-list .item-list-item button');
  console.log(`Found ${listItems.length} monsters in list.`);
  if (listItems.length === 0) throw new Error("No monsters rendered in list.");

  console.log(`Clicking first monster: ${listItems[0].querySelector('.item-title').textContent}`);
  listItems[0].click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const monsterDetailTitle = document.querySelector('#detail-pane-content h1');
  console.log(`Detail panel monster header: ${monsterDetailTitle ? monsterDetailTitle.textContent : 'NOT FOUND'}`);
  if (!monsterDetailTitle) throw new Error("Monster detail pane failed to render.");

  // Test Races
  await clickMenu('races');
  listItems = document.querySelectorAll('#item-list .item-list-item button');
  console.log(`Found ${listItems.length} races in list.`);
  if (listItems.length === 0) throw new Error("No races rendered in list.");

  console.log(`Clicking first race: ${listItems[0].querySelector('.item-title').textContent}`);
  listItems[0].click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const raceDetailTitle = document.querySelector('#detail-pane-content h1');
  console.log(`Detail panel race header: ${raceDetailTitle ? raceDetailTitle.textContent : 'NOT FOUND'}`);
  if (!raceDetailTitle) throw new Error("Race detail pane failed to render.");

  // Test Options
  await clickMenu('options');
  const optionFacetItems = document.querySelectorAll('#facet-list-1 .facet-item button');
  console.log(`Found ${optionFacetItems.length} option facets.`);
  if (optionFacetItems.length === 0) throw new Error("No option facets rendered.");

  listItems = document.querySelectorAll('#item-list .item-list-item button');
  console.log(`Found ${listItems.length} options in list.`);
  if (listItems.length === 0) throw new Error("No options rendered in list.");

  console.log(`Clicking first option: ${listItems[0].querySelector('.item-title').textContent}`);
  listItems[0].click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const optionDetailTitle = document.querySelector('#detail-pane-content h1');
  console.log(`Detail panel option header: ${optionDetailTitle ? optionDetailTitle.textContent : 'NOT FOUND'}`);
  if (!optionDetailTitle) throw new Error("Option detail pane failed to render.");

  // Test Universal Search
  await clickMenu('search');
  const uniSearchInput = document.getElementById('universal-search-input');
  if (!uniSearchInput) throw new Error("Universal search input not found.");
  
  console.log("Typing 'Dragon' in universal search...");
  uniSearchInput.value = 'Dragon';
  const inputEvent = new window.Event('input');
  uniSearchInput.dispatchEvent(inputEvent);
  await new Promise(resolve => setTimeout(resolve, 100));

  listItems = document.querySelectorAll('#item-list .item-list-item button');
  console.log(`Found ${listItems.length} search results for 'Dragon'.`);
  if (listItems.length === 0) throw new Error("No search results found.");

  console.log(`Clicking first search result: ${listItems[0].querySelector('.item-title').textContent}`);
  listItems[0].click();
  await new Promise(resolve => setTimeout(resolve, 50));
  const searchDetailTitle = document.querySelector('#detail-pane-content h1');
  console.log(`Detail panel search result header: ${searchDetailTitle ? searchDetailTitle.textContent : 'NOT FOUND'}`);
  if (!searchDetailTitle) throw new Error("Search result detail pane failed to render.");

  // Test Settings Page
  console.log("\nClicking Settings...");
  const settingsBtn = document.getElementById('btn-settings');
  if (!settingsBtn) throw new Error("Settings button not found.");
  settingsBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));

  const settingsHeader = document.querySelector('#detail-pane-content h1');
  console.log(`Settings page header: ${settingsHeader ? settingsHeader.textContent : 'NOT FOUND'}`);
  if (!settingsHeader || settingsHeader.textContent !== 'Settings') throw new Error("Settings page failed to render.");

  // Assert clear database option exists and functions
  const clearDbBtn = document.getElementById('settings-btn-clear-db');
  if (!clearDbBtn) throw new Error("Clear Database button not found in Settings panel.");
  console.log("Clear Database button found!");

  // Mock window.confirm to return true for clear database test
  const originalConfirm = window.confirm;
  window.confirm = () => true;

  console.log("Triggering Clear Database action...");
  clearDbBtn.click();
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(`localStorage 'bypassAutoSeed' value: ${window.localStorage.getItem('bypassAutoSeed')}`);
  if (window.localStorage.getItem('bypassAutoSeed') !== 'true') {
    throw new Error("bypassAutoSeed was not set to true after clearing database.");
  }
  
  // Verify database stores are now empty in memory mock
  STORES.forEach(store => {
    if (mockDB[store].length !== 0) {
      throw new Error(`Store '${store}' was not cleared.`);
    }
  });
  console.log("All IndexedDB stores successfully verified as empty!");

  // Restore confirm mock
  window.confirm = originalConfirm;

  // Test History State Navigation and Back Gestures
  console.log("\n--- Running History Navigation and Back Gesture Tests ---");
  
  // Re-seed DB first since settings clear test cleared it
  console.log("Re-seeding database for history tests...");
  window.localStorage.removeItem('bypassAutoSeed');
  await window.checkAndSeedDatabase();
  await window.loadAllRecordsCache();
  
  // Reset navigation to spells
  await clickMenu('spells');
  
  console.log("Initial state after loading spells category:");
  console.log(`History length: ${window.history.length}`);
  console.log("History state:", window.history.state);
  
  if (!window.history.state) {
    throw new Error("No history state replaced on loadCategory");
  }
  if (window.history.state.category !== 'spells') {
    throw new Error(`Expected category 'spells', got '${window.history.state.category}'`);
  }
  
  const initialHistoryLength = window.history.length;

  // Reset navigation to spells
  await clickMenu('spells');
  const baseHistoryLength = window.history.length;
  
  // 1. Click Wizard
  const spellFacetItemsAfterReset = document.querySelectorAll('#facet-list-1 .facet-item button');
  const wizardFacetBtn = Array.from(spellFacetItemsAfterReset).find(btn => btn.textContent.includes('Wizard'));
  if (!wizardFacetBtn) throw new Error("Wizard facet button not found");
  console.log("Clicking Wizard facet...");
  wizardFacetBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const historyLenAfterWizard = window.history.length;
  if (historyLenAfterWizard <= baseHistoryLength) {
    throw new Error("Wizard click did not push state");
  }
  const wizardState = window.history.state;
  if (wizardState.selectedFacet1 !== 'Wizard' || wizardState.pane !== 'facet-2') {
    throw new Error("Wizard state is incorrect");
  }
  
  // 2. Click Cleric (sibling to Wizard)
  const clericFacetBtn = Array.from(document.querySelectorAll('#facet-list-1 .facet-item button')).find(btn => btn.textContent.includes('Cleric'));
  if (!clericFacetBtn) throw new Error("Cleric facet button not found");
  console.log("Clicking Cleric facet (sibling of Wizard)...");
  clericFacetBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (window.history.length !== historyLenAfterWizard) {
    throw new Error("Cleric click should have replaced the state (no length increase)");
  }
  const clericState = window.history.state;
  if (clericState.selectedFacet1 !== 'Cleric' || clericState.pane !== 'facet-2') {
    throw new Error("Cleric state is incorrect");
  }
  
  // 3. Click Level 2
  const level2FacetBtn = Array.from(document.querySelectorAll('#facet-list-2 .facet-item button')).find(btn => btn.textContent.includes('Level 2'));
  if (!level2FacetBtn) throw new Error("Level 2 facet button not found");
  console.log("Clicking Level 2 facet...");
  level2FacetBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const historyLenAfterLevel2 = window.history.length;
  if (historyLenAfterLevel2 <= historyLenAfterWizard) {
    throw new Error("Level 2 click did not push state");
  }
  const level2State = window.history.state;
  if (level2State.selectedFacet2 !== 2 || level2State.pane !== 'list') {
    throw new Error("Level 2 state is incorrect");
  }
  
  // 4. Click Level 1 (sibling to Level 2)
  const level1FacetBtn = Array.from(document.querySelectorAll('#facet-list-2 .facet-item button')).find(btn => btn.textContent.includes('Level 1'));
  if (!level1FacetBtn) throw new Error("Level 1 facet button not found");
  console.log("Clicking Level 1 facet (sibling of Level 2)...");
  level1FacetBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (window.history.length !== historyLenAfterLevel2) {
    throw new Error("Level 1 click should have replaced the state (no length increase)");
  }
  const level1State = window.history.state;
  if (level1State.selectedFacet2 !== 1 || level1State.pane !== 'list') {
    throw new Error("Level 1 state is incorrect");
  }

  // 5. Click Bless (detail view)
  const blessItemBtn = Array.from(document.querySelectorAll('#item-list .item-list-item button')).find(btn => btn.querySelector('.item-title').textContent === 'Bless');
  if (!blessItemBtn) throw new Error("Bless spell button not found");
  console.log("Clicking Bless spell item...");
  blessItemBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const historyLenAfterBless = window.history.length;
  if (historyLenAfterBless <= historyLenAfterLevel2) {
    throw new Error("Bless click did not push state");
  }
  const blessState = window.history.state;
  if (blessState.selectedItemName !== 'Bless' || blessState.pane !== 'detail') {
    throw new Error("Bless state is incorrect");
  }
  
  // 6. Click Command (sibling detail view)
  const commandItemBtn = Array.from(document.querySelectorAll('#item-list .item-list-item button')).find(btn => btn.querySelector('.item-title').textContent === 'Command');
  if (!commandItemBtn) throw new Error("Command spell button not found");
  console.log("Clicking Command spell item (sibling of Bless)...");
  commandItemBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (window.history.length !== historyLenAfterBless) {
    throw new Error("Command click should have replaced the state (no length increase)");
  }
  const commandState = window.history.state;
  if (commandState.selectedItemName !== 'Command' || commandState.pane !== 'detail') {
    throw new Error("Command state is incorrect");
  }
  
  // 7. Click back to verify back sequence goes through hierarchy
  console.log("\nGoing back from Command (detail)...");
  const backDetailBtn = document.getElementById('back-detail');
  backDetailBtn.click();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log("Active pane after back from detail:", window.history.state.pane);
  console.log("Active state:", window.history.state);
  if (window.history.state.pane !== 'list' || window.history.state.selectedFacet2 !== 1 || window.history.state.selectedItemName !== null) {
    throw new Error("Expected to go back to Level 1 list view");
  }
  
  console.log("\nGoing back from Level 1 (list)...");
  const backListBtn = document.getElementById('back-list');
  backListBtn.click();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log("Active pane after back from list:", window.history.state.pane);
  console.log("Active state:", window.history.state);
  if (window.history.state.pane !== 'facet-2' || window.history.state.selectedFacet1 !== 'Cleric' || window.history.state.selectedFacet2 !== 'All') {
    throw new Error("Expected to go back to Cleric facet-2 view");
  }

  console.log("\nGoing back from Cleric (facet-2)...");
  const backFacet2Btn = document.getElementById('back-facet-2');
  backFacet2Btn.click();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log("Active pane after back from facet-2:", window.history.state.pane);
  console.log("Active state:", window.history.state);
  if (window.history.state.pane !== 'facet-1' || window.history.state.selectedFacet1 !== 'All') {
    throw new Error("Expected to go back to All Spells facet-1 view");
  }
  
  console.log("Back hierarchy sequence verified successfully!");

  // Test Markdown Parser Unit Tests
  console.log("\n--- Running Markdown Parser Unit Tests ---");
  const testMarkdown = `
# Heading 1
## Heading 2
### Heading 3

This is **bold** text and _italic_ text.
Here is inline \`code\`.

- Item 1
- Item 2
- Item 3

1. First
2. Second

> This is a blockquote.

| Header 1 | Header 2 |
|---|---|
| Cell 1 | Cell 2 |
| Cell 3 | Cell 4 |

\`\`\`javascript
const x = 10;
\`\`\`
  `;
  const resultHtml = window.parseMarkdown(testMarkdown.trim());
  console.log("Generated HTML from Markdown:\n", resultHtml);
  
  if (!resultHtml.includes('<h1>Heading 1</h1>')) throw new Error("Markdown h1 parsing failed.");
  if (!resultHtml.includes('<h2>Heading 2</h2>')) throw new Error("Markdown h2 parsing failed.");
  if (!resultHtml.includes('<h3>Heading 3</h3>')) throw new Error("Markdown h3 parsing failed.");
  if (!resultHtml.includes('<strong>bold</strong>')) throw new Error("Markdown bold parsing failed.");
  if (!resultHtml.includes('<em>italic</em>')) throw new Error("Markdown italic parsing failed.");
  if (!resultHtml.includes('<code>code</code>')) throw new Error("Markdown inline code parsing failed.");
  if (!resultHtml.includes('<ul class="markdown-ul">')) throw new Error("Markdown unordered list parsing failed.");
  if (!resultHtml.includes('<ol class="markdown-ol">')) throw new Error("Markdown ordered list parsing failed.");
  if (!resultHtml.includes('<blockquote>')) throw new Error("Markdown blockquote parsing failed.");
  if (!resultHtml.includes('<table class="markdown-table">')) throw new Error("Markdown table parsing failed.");
  if (!resultHtml.includes('<th>Header 1</th>')) throw new Error("Markdown table headers parsing failed.");
  if (!resultHtml.includes('<td>Cell 1</td>')) throw new Error("Markdown table cells parsing failed.");
  if (!resultHtml.includes('<pre><code>const x = 10;</code></pre>')) throw new Error("Markdown code block parsing failed.");

  // Test Nested Parenthesis Subclass Suffix Unit Tests
  console.log("\n--- Running Subclass Parenthesis Suffix Unit Tests ---");
  const testSubName1 = "Level 6: Storm Soul (Path of the Storm Herald (Legacy))";
  const extracted1 = window.extractParenthesizedSuffix(testSubName1);
  console.log(`Input: "${testSubName1}" -> Extracted: "${extracted1}"`);
  if (extracted1 !== "Path of the Storm Herald (Legacy)") {
    throw new Error(`Subclass suffix extraction failed. Got: "${extracted1}"`);
  }

  const testSubXml = `
    <compendium>
      <class>
        <name>Barbarian</name>
        <hd>12</hd>
        <autolevel level="6">
          <feature>
            <name>Level 6: Storm Soul (Path of the Storm Herald (Legacy))</name>
            <text>Your aura protects you.</text>
          </feature>
        </autolevel>
      </class>
    </compendium>
  `;
  const parsedSubRes = window.parseCompendiumXML(testSubXml);
  const subclasses = parsedSubRes.subclasses;
  console.log(`Parsed Barbarian subclasses: ${subclasses.map(s => s.name).join(', ')}`);
  const subRecord = subclasses.find(s => s.name === "Path of the Storm Herald (Legacy)");
  if (!subRecord) {
    throw new Error("Subclasses array does not include Path of the Storm Herald (Legacy)");
  }
  const feature = subRecord.autolevels[0].features[0];
  if (feature.name !== "Level 6: Storm Soul (Path of the Storm Herald (Legacy))") {
    throw new Error(`Feature name is incorrect. Got: "${feature.name}"`);
  }

  // Test Step 1: XML Schema & Ingestion Pipeline parser updates
  console.log("\n--- Running Step 1: XML Schema & Ingestion Pipeline Tests ---");
  
  // Test 1: Background engine_modifier parsing
  const testBgXml = `
    <compendium>
      <background>
        <name>Acolyte Test</name>
        <proficiency>Insight</proficiency>
        <engine_modifier target="wis.score" type="add" value="2"/>
        <engine_modifier target="cha.score" type="add" value="1"/>
      </background>
    </compendium>
  `;
  const parsedBgRes = window.parseCompendiumXML(testBgXml);
  const acolyteTest = parsedBgRes.backgrounds[0];
  console.log("Parsed Background:", JSON.stringify(acolyteTest));
  if (!acolyteTest) throw new Error("Acolyte Test background not parsed.");
  if (!acolyteTest.modifiers || acolyteTest.modifiers.length !== 2) {
    throw new Error(`Expected 2 modifiers, got: ${acolyteTest.modifiers ? acolyteTest.modifiers.length : 0}`);
  }
  if (acolyteTest.modifiers[0].target !== 'wis.score' || acolyteTest.modifiers[0].value !== '2' || acolyteTest.modifiers[0].type !== 'add') {
    throw new Error(`Incorrect first modifier parsed: ${JSON.stringify(acolyteTest.modifiers[0])}`);
  }
  if (acolyteTest.modifiers[1].target !== 'cha.score' || acolyteTest.modifiers[1].value !== '1' || acolyteTest.modifiers[1].type !== 'add') {
    throw new Error(`Incorrect second modifier parsed: ${JSON.stringify(acolyteTest.modifiers[1])}`);
  }
  
  // Test 2: Legacy modifier translation and parsing
  const testItemXml = `
    <compendium>
      <item>
        <name>Test Sword</name>
        <type>M</type>
        <modifier category="bonus">melee damage +2</modifier>
        <modifier category="ability score">strength +1</modifier>
        <modifier category="set" type="strength">19</modifier>
      </item>
    </compendium>
  `;
  const parsedItemRes = window.parseCompendiumXML(testItemXml);
  const testSword = parsedItemRes.items[0];
  console.log("Parsed Item modifiers:", JSON.stringify(testSword.modifiers));
  if (!testSword || testSword.modifiers.length !== 3) {
    throw new Error(`Expected 3 modifiers on Test Sword, got: ${testSword ? testSword.modifiers.length : 0}`);
  }
  if (testSword.modifiers[0].target !== 'melee.damage' || testSword.modifiers[0].value !== '2' || testSword.modifiers[0].type !== 'add') {
    throw new Error(`Incorrect translated modifier 1: ${JSON.stringify(testSword.modifiers[0])}`);
  }
  if (testSword.modifiers[1].target !== 'str.score' || testSword.modifiers[1].value !== '1' || testSword.modifiers[1].type !== 'add') {
    throw new Error(`Incorrect translated modifier 2: ${JSON.stringify(testSword.modifiers[1])}`);
  }
  if (testSword.modifiers[2].target !== 'str.score' || testSword.modifiers[2].value !== '19' || testSword.modifiers[2].type !== 'set') {
    throw new Error(`Incorrect translated modifier 3: ${JSON.stringify(testSword.modifiers[2])}`);
  }

  // Test 3: Class & Subclass explicit relations and inheritance schema
  const testClassXml = `
    <compendium>
      <class>
        <name>Test Fighter</name>
        <hd>10</hd>
        <autolevel level="1">
          <feature>
            <name>Level 1: Fighting Style</name>
            <text>Choose style.</text>
          </feature>
          <usage_counter rel="class.fighter.second_wind">
            <name>Second Wind</name>
            <value>1</value>
            <reset>S</reset>
          </usage_counter>
        </autolevel>
        <autolevel level="3" rel="subclass.champion" optional="YES">
          <feature>
            <name>Improved Critical</name>
            <text>Crit on 19-20.</text>
            <engine_modifier target="weapon.crit_range" type="set" value="19"/>
          </feature>
        </autolevel>
      </class>
    </compendium>
  `;
  const parsedClassRes = window.parseCompendiumXML(testClassXml);
  const testFighter = parsedClassRes.classes[0];
  console.log("Parsed Class:", JSON.stringify(testFighter));
  if (!testFighter) throw new Error("Test Fighter class not parsed.");
  
  // Assert subclasses contains "Champion" in parsed subclasses
  const championSub = parsedClassRes.subclasses.find(s => s.name === "Champion");
  if (!championSub) {
    throw new Error("subclasses missing 'Champion'");
  }
  
  if (championSub.parentClass !== "Test Fighter") {
    throw new Error(`Champion parentClass incorrect: ${championSub.parentClass}`);
  }
  
  // Assert subclass autolevels extracted
  if (championSub.autolevels.length !== 1 || championSub.autolevels[0].level !== 3) {
    throw new Error(`Expected 1 level 3 autolevel on subclass Champion, got: ${JSON.stringify(championSub.autolevels)}`);
  }
  
  // Assert class direct autolevels contains base level 1 autolevel and excludes subclass autolevels
  if (testFighter.autolevels.length !== 1 || testFighter.autolevels[0].level !== 1) {
    throw new Error(`Expected 1 base autolevel, got: ${JSON.stringify(testFighter.autolevels)}`);
  }
  
  // Assert usage_counter parsed correctly
  const lvl1Counters = testFighter.autolevels[0].counters;
  if (!lvl1Counters || lvl1Counters.length !== 1 || lvl1Counters[0].rel !== 'class.fighter.second_wind') {
    throw new Error(`usage_counter rel missing or incorrect: ${JSON.stringify(lvl1Counters)}`);
  }
  
  // Assert subclass autolevel optional parsed correctly
  if (!championSub.autolevels[0].optional) {
    throw new Error("Expected subclass autolevel to be marked as optional: true");
  }
  
  // Assert engine_modifier inside feature parsed correctly
  const champFeat = championSub.autolevels[0].features[0];
  if (!champFeat.modifiers || champFeat.modifiers.length !== 1 || champFeat.modifiers[0].target !== 'weapon.crit_range') {
    throw new Error(`engine_modifier inside feature incorrect: ${JSON.stringify(champFeat.modifiers)}`);
  }

  console.log("Step 1 unit tests passed successfully!");

  // Test New Settings Panel Sections
  console.log("\n--- Running New Settings Panel Tests ---");

  // Navigate to settings
  console.log("Clicking Settings...");
  const settingsBtn2 = document.getElementById('btn-settings');
  settingsBtn2.click();
  await new Promise(resolve => setTimeout(resolve, 200));

  // Verify Cloud Sync section
  console.log("Verifying Cloud Sync section...");
  const syncBadgeContainer = document.getElementById('sync-badge-container');
  if (!syncBadgeContainer) throw new Error("sync-badge-container not found in Settings panel.");
  console.log("  ✓ sync-badge-container present");

  const syncNowBtn = document.getElementById('settings-btn-sync-now');
  if (!syncNowBtn) throw new Error("settings-btn-sync-now not found in Settings panel.");
  console.log("  ✓ Sync Now button present");

  const dropboxKeyInput = document.getElementById('dropbox-app-key-input');
  if (!dropboxKeyInput) throw new Error("dropbox-app-key-input not found in Settings panel.");
  console.log("  ✓ Dropbox App Key input present");

  const dropboxRedirectInput = document.getElementById('dropbox-redirect-uri-input');
  if (!dropboxRedirectInput) throw new Error("dropbox-redirect-uri-input not found in Settings panel.");
  console.log("  ✓ Dropbox Redirect URI input present");

  const linkDropboxBtn = document.getElementById('settings-btn-link-dropbox');
  if (!linkDropboxBtn) throw new Error("settings-btn-link-dropbox not found in Settings panel.");
  console.log("  ✓ Link Dropbox button present");

  const unlinkDropboxBtn = document.getElementById('settings-btn-unlink-dropbox');
  if (!unlinkDropboxBtn) throw new Error("settings-btn-unlink-dropbox not found in Settings panel.");
  console.log("  ✓ Unlink Dropbox button present");

  // Verify Data Portability section
  console.log("Verifying Data Portability section...");
  const exportJsonBtn = document.getElementById('settings-btn-export-json');
  if (!exportJsonBtn) throw new Error("settings-btn-export-json not found in Settings panel.");
  console.log("  ✓ Export JSON Backup button present");

  const importBackupBtn = document.getElementById('settings-btn-import-backup');
  if (!importBackupBtn) throw new Error("settings-btn-import-backup not found in Settings panel.");
  console.log("  ✓ Import from File button present");

  // Verify Storage Health section
  console.log("Verifying Storage Health section...");
  const storageContainer = document.getElementById('storage-health-container');
  if (!storageContainer) throw new Error("storage-health-container not found in Settings panel.");
  console.log("  ✓ storage-health-container present");

  // Trigger Sync Now (should call mock and not throw)
  console.log("Triggering Sync Now...");
  syncNowBtn.click();
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log("  ✓ Sync Now button clickable without errors");

  // Test exportAllData mock produces valid structure
  console.log("Testing exportAllData mock...");
  const exportedData = await window.exportAllData();
  if (!exportedData || typeof exportedData !== 'object') throw new Error("exportAllData did not return an object.");
  if (!Array.isArray(exportedData.spells)) throw new Error("exportAllData.spells is not an array.");
  console.log(`  ✓ exportAllData returns valid structure (${exportedData.spells.length} spells)`);

  // Verify existing Settings buttons still work after refactor
  console.log("Verifying existing settings buttons still present...");
  const importBtn = document.getElementById('settings-btn-import');
  if (!importBtn) throw new Error("settings-btn-import not found after refactor.");
  console.log("  ✓ Import XML button present");
  const resetDbBtn = document.getElementById('settings-btn-reset-db');
  if (!resetDbBtn) throw new Error("settings-btn-reset-db not found after refactor.");
  console.log("  ✓ Reset Database button present");
  const clearDbBtn2 = document.getElementById('settings-btn-clear-db');
  if (!clearDbBtn2) throw new Error("settings-btn-clear-db not found after refactor.");
  console.log("  ✓ Clear Database button present");
  const resetCacheBtn = document.getElementById('settings-btn-reset-cache');
  if (!resetCacheBtn) throw new Error("settings-btn-reset-cache not found after refactor.");
  console.log("  ✓ Reset Cache button present");

  // --- Running Phase 3: Global Bookmarks & Display Tables Tests ---
  console.log("\n--- Running Phase 3: Bookmarks & Table Markdown Unit Tests ---");

  // 1. Test Custom Table Preprocessing and Parsing
  const customTableMarkdown = `
Cleric Level | Prepared Spells
3 | Aid, Bless, Cure Wounds
5 | Mass Healing Word, Revivify
  `;
  const parsedTableHtml = window.parseMarkdown(customTableMarkdown.trim());
  console.log("Parsed custom table HTML:\n", parsedTableHtml);
  if (!parsedTableHtml.includes('<table class="markdown-table">')) throw new Error("Custom table parsing failed to create table element.");
  if (!parsedTableHtml.includes('<th>Cleric Level</th>')) throw new Error("Custom table header parsing failed.");
  if (!parsedTableHtml.includes('<td>Aid, Bless, Cure Wounds</td>')) throw new Error("Custom table cell parsing failed.");

  // Test custom table parsing with blank lines
  const customTableWithBlanks = `
Level | Prepared Spells

3 | Aid, Bless

5 | Revivify
  `;
  const parsedBlanksHtml = window.parseMarkdown(customTableWithBlanks.trim());
  console.log("Parsed custom table with blanks HTML:\n", parsedBlanksHtml);
  if (!parsedBlanksHtml.includes('<table class="markdown-table">')) throw new Error("Custom table with blanks failed to parse.");
  if (!parsedBlanksHtml.includes('<th>Level</th>')) throw new Error("Custom table with blanks header failed.");
  if (!parsedBlanksHtml.includes('<td>Aid, Bless</td>')) throw new Error("Custom table with blanks cell failed.");

  // 2. Test Bookmarks/Favorites toggling & caching
  console.log("Testing bookmarks functionality...");
  
  // Set up dummy spell and test active state
  const testSpell = {
    name: "Test Fireball Spell",
    level: 3,
    school: "Evocation",
    categoryType: "spell"
  };

  // Mock allRecordsCache initialization
  window.allRecordsCache['favorites'] = [];
  window.allRecordsCache['spells'] = [testSpell];
  
  // Navigate to spells category so currentCategory is set correctly
  await window.loadCategory('spells');
  
  // Simulate selecting the item
  window.selectItem(testSpell);
  
  // Verify favorite toggle button is shown and not active
  const favoriteBtn = document.getElementById('btn-favorite');
  if (!favoriteBtn) throw new Error("Favorite button not found in detail header.");
  if (favoriteBtn.style.display === 'none') throw new Error("Favorite button should be visible when an item is selected.");
  if (favoriteBtn.classList.contains('active')) throw new Error("Favorite button should not be active initially.");
  
  // Simulate clicking favorite
  favoriteBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Verify it is favorited
  if (!favoriteBtn.classList.contains('active')) throw new Error("Favorite button should be active after clicking.");
  const isFav = window.isItemFavorited(testSpell, "spell");
  if (!isFav) throw new Error("isItemFavorited returned false after favoriting.");
  
  // Check that the favorite record is saved in mockDB
  const favStore = mockDB['favorites'];
  if (!favStore || favStore.length === 0) throw new Error("Favorite record not saved to database.");
  const savedFav = favStore.find(f => f.name === "spells:Test Fireball Spell");
  if (!savedFav) throw new Error("Favorite record key is incorrect.");
  if (savedFav._deleted) throw new Error("Favorite record should not be marked as deleted.");
  
  // Simulate clicking favorite again to unfavorite (soft delete)
  favoriteBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Verify it is soft-deleted
  if (favoriteBtn.classList.contains('active')) throw new Error("Favorite button should not be active after unfavoriting.");
  if (window.isItemFavorited(testSpell, "spell")) throw new Error("isItemFavorited returned true after soft delete.");
  const updatedFav = favStore.find(f => f.name === "spells:Test Fireball Spell");
  if (!updatedFav || !updatedFav._deleted) throw new Error("Favorite record should be soft-deleted in database.");

  // Test resolving favorites in applyFilters
  // Let's create a favorite record that is active
  const activeFav = {
    name: "spells:Test Fireball Spell",
    category: "spells",
    itemName: "Test Fireball Spell",
    className: "",
    featureName: "",
    _deleted: false,
    _modified_at: new Date().toISOString()
  };
  mockDB['favorites'] = [activeFav];
  window.allRecordsCache['favorites'] = [activeFav];
  
  // Navigate to favorites category
  await window.loadCategory('favorites');
  
  // Verify Facet 1 is populated with "Spells"
  const facetItems = Array.from(document.getElementById('facet-list-1').querySelectorAll('.facet-item'));
  const spellFacet = facetItems.find(item => item.textContent.includes('Spells'));
  if (!spellFacet) throw new Error("Facet 1 does not contain 'Spells' category for favorites.");
  
  // Verify list has our favorited spell
  let favListItems = Array.from(document.getElementById('item-list').querySelectorAll('.item-list-item'));
  let spellListItem = favListItems.find(item => item.textContent.includes('Test Fireball Spell'));
  if (!spellListItem) throw new Error("Item list does not contain favorited spell.");

  // Simulate selecting "Spells" in Facet 1
  spellFacet.querySelector('button').click();
  await new Promise(resolve => setTimeout(resolve, 50));

  // Facet 2 should be active now (since spells has Level hierarchy)
  const facet2Pane = document.getElementById('pane-facet-2');
  if (facet2Pane.style.display === 'none') throw new Error("Facet 2 pane should be visible when Spells is selected in favorites.");

  // Facet 2 should have "Level 3" option
  const facet2Items = Array.from(document.getElementById('facet-list-2').querySelectorAll('.facet-item'));
  const lvl3Facet = facet2Items.find(item => item.textContent.includes('Level 3'));
  if (!lvl3Facet) throw new Error("Facet 2 does not contain Level 3 for favorited spells.");

  // Verify selecting Level 3 retains item
  lvl3Facet.querySelector('button').click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  favListItems = Array.from(document.getElementById('item-list').querySelectorAll('.item-list-item'));
  spellListItem = favListItems.find(item => item.textContent.includes('Test Fireball Spell'));
  if (!spellListItem) throw new Error("Spell item should be visible when Level 3 is selected.");

  // Add dummy equipment and check hierarchy as well
  const testItem = {
    name: "Test Chain Mail",
    type: "Heavy Armor",
    categoryType: "item",
    value: 75
  };
  window.allRecordsCache['items'] = [testItem];

  const itemFav = {
    name: "items:Test Chain Mail",
    category: "items",
    itemName: "Test Chain Mail",
    className: "",
    featureName: "",
    _deleted: false,
    _modified_at: new Date().toISOString()
  };
  mockDB['favorites'].push(itemFav);
  window.allRecordsCache['favorites'].push(itemFav);

  // Reload category
  await window.loadCategory('favorites');

  // Select Equipment in Facet 1
  const facetItemsEq = Array.from(document.getElementById('facet-list-1').querySelectorAll('.facet-item'));
  const eqFacet = facetItemsEq.find(item => item.textContent.includes('Equipment'));
  if (!eqFacet) throw new Error("Facet 1 does not contain Equipment for favorites.");
  eqFacet.querySelector('button').click();
  await new Promise(resolve => setTimeout(resolve, 50));

  // Facet 2 should show "Heavy Armor"
  const facet2ItemsEq = Array.from(document.getElementById('facet-list-2').querySelectorAll('.facet-item'));
  const heavyArmorFacet = facet2ItemsEq.find(item => item.textContent.includes('Heavy Armor'));
  if (!heavyArmorFacet) throw new Error("Facet 2 does not contain Heavy Armor for favorited equipment.");

  heavyArmorFacet.querySelector('button').click();
  await new Promise(resolve => setTimeout(resolve, 50));

  favListItems = Array.from(document.getElementById('item-list').querySelectorAll('.item-list-item'));
  const eqListItem = favListItems.find(item => item.textContent.includes('Test Chain Mail'));
  if (!eqListItem) throw new Error("Chain Mail should be visible under Heavy Armor facet.");

  // Test URL Deep-Linking & State Restoration
  console.log("\n--- Running URL Deep-Linking & State Restoration Unit Tests ---");
  
  // Reconfigure JSDOM URL to simulate opening a deep link
  dom.reconfigure({ url: "http://localhost/?category=spells&pane=detail&facet1=Cleric&facet2=1&item=Bless" });
  console.log(`Current JSDOM URL search: ${window.location.search}`);
  
  // Trigger DOMContentLoaded event again to parse URL
  console.log("Triggering DOMContentLoaded for deep link URL parsing...");
  const dlEvent = new window.Event('DOMContentLoaded');
  window.dispatchEvent(dlEvent);
  
  // Wait for parsing, database check, and restoreState to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log("Asserting history state after deep-link load...");
  const dlState = window.history.state;
  if (!dlState) {
    throw new Error("No history state replaced on deep-link load");
  }
  if (dlState.category !== 'spells') {
    throw new Error(`Expected category 'spells', got: '${dlState.category}'`);
  }
  if (dlState.selectedFacet1 !== 'Cleric') {
    throw new Error(`Expected selectedFacet1 'Cleric', got: '${dlState.selectedFacet1}'`);
  }
  if (dlState.selectedFacet2 !== 1) {
    throw new Error(`Expected selectedFacet2 1, got: '${dlState.selectedFacet2}'`);
  }
  if (dlState.selectedItemName !== 'Bless') {
    throw new Error(`Expected selectedItemName 'Bless', got: '${dlState.selectedItemName}'`);
  }
  if (dlState.pane !== 'detail') {
    throw new Error(`Expected pane 'detail', got: '${dlState.pane}'`);
  }
  
  console.log("Deep link URL state restoration verified successfully!");

  // Test Character Sheet & Roster Integration
  console.log("\n--- Running Character Sheet & Roster Unit Tests ---");

  // Navigate to characters category
  await clickMenu('characters');

  // Verify "Create Character" card is present
  const rosterItems = Array.from(document.getElementById('item-list').querySelectorAll('.cs-roster-card'));
  const createCard = rosterItems.find(card => card.textContent.includes('Create Character'));
  if (!createCard) throw new Error("Character roster does not contain 'Create Character' card.");

  // Test character structure rendering
  const char = {
    name: "Aelfric",
    class: "Fighter",
    level: 3,
    species: "Elf",
    background: "Noble",
    baseStats: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    savesProficiency: { str: 1, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
    skillsProficiency: { athletics: 1, perception: 1 },
    skillsAttributeOverride: {},
    hp: { current: 28, temp: 0 },
    baseHpMax: 10,
    speed: 30,
    spellcastingAbility: 'int',
    inspiration: false,
    deathSaves: { successes: 0, failures: 0 },
    currency: { cp: 10, sp: 5, ep: 0, gp: 50, pp: 0 },
    spellSlots: {},
    counters: [],
    equipment: [],
    spells: [],
    features: [],
    options: [],
    bestiary: [],
    modifiers: [],
    notes: { backstory: 'A brave noble.' },
    _deleted: false,
    _modified_at: new Date().toISOString()
  };

  // Open the character sheet
  window.openCharacterSheet(char);

  // Verify the persistent header displays correct details
  if (document.getElementById('cs-char-name').textContent !== 'Aelfric') {
    throw new Error("Character sheet header name does not match 'Aelfric'");
  }
  if (!document.getElementById('cs-char-subtitle').textContent.includes('Level 3 Fighter')) {
    throw new Error("Character sheet subtitle does not match 'Level 3 Fighter'");
  }

  // Verify state calculation in JSDOM: STR is 15 -> mod is +2. Con is 13 -> mod is +1.
  // baseHpMax = 10, conMod = +1, level = 3 -> hpMax = 10 + 1 * 3 = 13.
  if (document.getElementById('cs-hp-max').textContent !== '13') {
    throw new Error(`Expected calculated HP max to be 13, got ${document.getElementById('cs-hp-max').textContent}`);
  }

  // Verify AC calculation: Base 10 + dex.mod (+2) = 12.
  if (document.getElementById('cs-val-ac').textContent !== '12') {
    throw new Error(`Expected calculated AC to be 12, got ${document.getElementById('cs-val-ac').textContent}`);
  }

  // Verify proficiency bonus: Level 3 -> +2.
  if (document.getElementById('cs-val-prof-bonus').textContent !== '+2') {
    throw new Error(`Expected calculated proficiency bonus to be +2, got ${document.getElementById('cs-val-prof-bonus').textContent}`);
  }

  // Close the sheet
  window.closeCharacterSheet();
  console.log("Character Sheet & Roster verified successfully!");

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch(err => {
  console.error("\nTEST FAILED!");
  console.error(err);
  process.exit(1);
});
