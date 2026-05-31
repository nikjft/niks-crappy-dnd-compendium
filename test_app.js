import fs from 'fs';
import { JSDOM } from 'jsdom';
import nodeCrypto from 'crypto';

// Read files
const htmlText = fs.readFileSync('./index.html', 'utf8');
let appJsText = fs.readFileSync('./app.js', 'utf8');
let parserJsText = fs.readFileSync('./parser.js', 'utf8');
let dbJsText = fs.readFileSync('./db.js', 'utf8');

// Strip ES module imports/exports so we can run them in JSDOM VM
appJsText = appJsText.replace(/import\s+\{[^}]*\}\s+from\s+['"].*?['"];?\n?/g, '');
parserJsText = parserJsText.replace(/export\s+/g, '');
dbJsText = dbJsText.replace(/export\s+/g, '');

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
const STORES = ['spells', 'items', 'monsters', 'classes', 'feats', 'backgrounds', 'races', 'options'];
STORES.forEach(store => { mockDB[store] = []; });

// App settings mock
const mockAppSettings = {};
// Sync meta mock
const mockSyncMeta = {};

window.STORES = STORES;

window.openDB = () => Promise.resolve({});
window.saveRecords = (storeName, records, opts = {}) => {
  console.log(`[Mock DB] saveRecords for ${storeName}: saving ${records.length} records`);
  mockDB[storeName] = records;
  return Promise.resolve();
};
window.getAllRecords = (storeName) => {
  console.log(`[Mock DB] getAllRecords for ${storeName}: returning ${mockDB[storeName].length} records`);
  return Promise.resolve(mockDB[storeName]);
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

// Inject Parser and DB code
evalInWindow(parserJsText);

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
    if (mockDB[store].length === 0) {
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
  const barb = parsedSubRes.classes[0];
  console.log(`Parsed Barbarian subclasses: ${barb.subclasses.join(', ')}`);
  if (!barb.subclasses.includes("Path of the Storm Herald (Legacy)")) {
    throw new Error("Subclasses array does not include Path of the Storm Herald (Legacy)");
  }
  const feature = barb.features[0];
  console.log(`Parsed Feature subclass: "${feature.subclass}"`);
  if (feature.subclass !== "Path of the Storm Herald (Legacy)") {
    throw new Error(`Feature subclass attribute is incorrect. Got: "${feature.subclass}"`);
  }

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

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch(err => {
  console.error("\nTEST FAILED!");
  console.error(err);
  process.exit(1);
});
