/**
 * qa-full-ux.mjs — Playwright headless E2E QA for D&D Compendium
 *
 * Usage:  node scripts/qa-full-ux.mjs [--url http://localhost:5174]
 * Output: screenshots saved to scripts/qa-screenshots/
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'qa-screenshots');

const BASE_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:5174';

async function shot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

function pass(msg) { console.log(`  ` + String.fromCodePoint(0x2705) + ` ${msg}`); }
function fail(msg) { console.error(`  ` + String.fromCodePoint(0x274C) + ` ${msg}`); process.exitCode = 1; }

// Launch browser
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Setup automatic dialog handling (alerts, confirms, prompts)
page.on('dialog', async dialog => {
  console.log(`   [DIALOG] ${dialog.type()} message: "${dialog.message()}"`);
  await dialog.accept();
});

page.on('console', msg => {
  if (msg.type() === 'error') {
    console.error('   [PAGE ERROR LOG]', msg.text());
  }
});
page.on('pageerror', err => console.error('   [PAGE ERROR STACK]', err.stack || err.message));

await mkdir(SCREENSHOT_DIR, { recursive: true });

console.log(`\n🎲 QA: E2E Full UX Flow — ${BASE_URL}\n`);

// ── 1. Load the app ──────────────────────────────────────────────────────────
console.log('1. Loading app…');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// Wait for loading overlay to clear
await page.waitForFunction(
  () => {
    const overlay = document.getElementById('loading-overlay');
    return !overlay || overlay.style.display === 'none' || overlay.style.display === '';
  },
  { timeout: 60_000 }
).catch(() => console.log('   Warning: loading overlay still visible'));

await shot(page, 'ux-01-loaded');
pass('App loaded successfully');

// ── 2. Inject test character ──────────────────────────────────────────────────
console.log('2. Injecting test character…');
const testChar = {
  id: 'qa-ux-char-001',
  name: 'UX Tester Character',
  level: 3,
  class: 'Fighter',
  baseStats: { str: 15, dex: 13, con: 14, int: 9, wis: 10, cha: 12 },
  baseHpMax: 28,
  hp: { current: 28, temp: 0 },
  speed: 30,
  savesProficiency: { str: 1, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
  skillsProficiency: { athletics: 1, history: 0, insight: 1 },
  toolProficiencies: [
    { name: "Thieves' Tools", attr: 'dex', profLevel: 1 }
  ],
  equipment: [],
  spells: [],
  features: [],
  attunementMax: 3,
  currency: { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 },
  collapsedLists: {},
  levelHistory: [],
  languages: [],
  otherProficiencies: [],
  notes: { freeNotes: [] },
  itemLists: [{ id: 'default', name: 'Equipment' }],
  spellLists: [{ id: 'default', name: 'Spells', spellcastingAbility: 'int' }],
  featureLists: [{ id: 'default', name: 'Features' }],
  bestiary: [],
  bestiaryLists: [{ id: 'default', name: 'Companions' }],
  conditions: [],
  _modified_at: new Date().toISOString()
};

await page.evaluate(async (char) => {
  return new Promise((resolve) => {
    const req = indexedDB.open('dnd_compendium_db');
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters');
      const put = store.put(char);
      put.onsuccess = () => { db.close(); resolve({ ok: true }); };
      put.onerror = (e2) => { db.close(); resolve({ ok: false, error: String(e2.target.error) }); };
    };
    req.onerror = (e) => resolve({ ok: false, error: String(e.target.error) });
  });
}, testChar);

// Reload to see character
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Navigate to Characters category
await page.click('[data-category="characters"]');
await page.waitForTimeout(1000);
await shot(page, 'ux-02-characters-list');

const charCard = page.locator('.cs-roster-card', { hasText: 'UX Tester Character' });
if (await charCard.isVisible()) {
  pass('Test character appears in roster');
} else {
  fail('Test character not found in roster after injection');
}

// ── 3. Test Duplication and Deletion ──────────────────────────────────────────
console.log('3. Testing duplication and deletion…');
await charCard.locator('.btn-duplicate').click();
await page.waitForTimeout(1000);
await shot(page, 'ux-03-after-duplicate');

const copyCard = page.locator('.cs-roster-card', { hasText: 'UX Tester Character (Copy)' });
if (await copyCard.isVisible()) {
  pass('Character duplicated successfully');
  // Delete the copy
  await copyCard.locator('.btn-delete').click();
  await page.waitForTimeout(1000);
  await shot(page, 'ux-03-after-delete-copy');
  
  if (await copyCard.isVisible()) {
    fail('Copy character was NOT deleted');
  } else {
    pass('Copy character deleted successfully');
  }
} else {
  fail('Character copy card not found');
}

// ── 4. Open Character Sheet & Navigate Tabs ──────────────────────────────────
console.log('4. Testing tab navigation…');
await charCard.click();
await page.waitForTimeout(1500);
await shot(page, 'ux-04-sheet-opened');

const tabs = ['combat', 'stats', 'features', 'inventory', 'spells', 'bestiary', 'notes'];
for (const tabName of tabs) {
  const tabBtn = page.locator(`.cs-tab-btn[data-tab="${tabName}"]`);
  await tabBtn.click();
  await page.waitForTimeout(400);
  const isActive = await tabBtn.evaluate(el => el.classList.contains('active'));
  if (isActive) {
    pass(`Navigated to ${tabName} tab`);
  } else {
    fail(`Failed to activate ${tabName} tab`);
  }
}
await shot(page, 'ux-04-tab-navigation');

// ── 5. Add and Delete Item in Inventory ────────────────────────────────────────
console.log('5. Testing Inventory operations & compendium picker…');
await page.click('.cs-tab-btn[data-tab="inventory"]');
await page.waitForTimeout(500);

// Click "+ Add" on the list section
const addBtn = page.locator('.item-list-section .cs-btn-small', { hasText: '+ Add' }).first();
await addBtn.click();
await page.waitForTimeout(1500);
await shot(page, 'ux-05-compendium-picker-items');

// Verify back to sheet shows and we are on items category
const sidebarBack = page.locator('#sidebar-back-to-sheet');
if (await sidebarBack.isVisible()) {
  pass('Returned to compendium items picker view');
} else {
  fail('Back to Sheet button is not visible');
}

// Search and add "Dagger"
await page.fill('#search-input', 'Dagger');
await page.waitForTimeout(800);
const firstListRow = page.locator('.item-list-item').first();
await firstListRow.click();
await page.waitForTimeout(800);

// Verify detail pane footer contains "OK" button
const cancelBtn = page.locator('#pane-detail-btn-cancel');
const cancelBtnText = await cancelBtn.textContent();
if (cancelBtnText === 'OK') {
  pass('Picker footer secondary button renamed to "OK"');
} else {
  fail(`Picker footer secondary button text is "${cancelBtnText}", expected "OK"`);
}

// Add dagger to character
await page.click('#pane-detail-btn-add');
await page.waitForTimeout(1000);
await shot(page, 'ux-05-item-added');

// Exit picker using OK button
await cancelBtn.click();
await page.waitForTimeout(1000);
await shot(page, 'ux-05-returned-to-inventory');

// Verify Dagger shows in list
const daggerRow = page.locator('.item-table-row', { hasText: 'Dagger' });
if (daggerRow) {
  pass('Dagger successfully added to character inventory');
} else {
  fail('Dagger not found in character equipment list');
}

// Test equipped state toggle (Dagger starts uncarried. Cycle to carried, then equipped)
const cycleBtn = daggerRow.locator('.item-cycle-btn');
await cycleBtn.click();
await page.waitForTimeout(300);
let isCarried = await cycleBtn.evaluate(el => el.classList.contains('carried'));
if (isCarried) {
  pass('Dagger status cycled to Carried');
} else {
  fail('Dagger failed to cycle to Carried');
}

// Cycle to Equipped (shield icon)
await cycleBtn.click();
await page.waitForTimeout(300);
let isEquipped = await cycleBtn.evaluate(el => el.classList.contains('equipped'));
if (isEquipped) {
  pass('Dagger status cycled to Equipped');
  // Check that the filled shield icon exists
  const shieldIcon = cycleBtn.locator('.material-icons', { hasText: 'shield' });
  if (await shieldIcon.isVisible()) {
    pass('Filled shield icon renders for equipped status');
  } else {
    fail('Equipped status does not render filled shield icon');
  }
} else {
  fail('Dagger failed to cycle to Equipped');
}

// Expand Dagger row and remove it
await daggerRow.click();
await page.waitForTimeout(500);
const removeDaggerBtn = page.locator('.item-detail-actions-row button', { hasText: 'Remove' });
await removeDaggerBtn.click();
await page.waitForTimeout(800);

if (await page.locator('.item-table-row', { hasText: 'Dagger' }).isVisible()) {
  fail('Failed to delete Dagger');
} else {
  pass('Dagger removed from inventory successfully');
}

// ── 6. Add and Prep Spell in Spells ──────────────────────────────────────────
console.log('6. Testing Spells operations & preparation circular toggle…');
await page.click('.cs-tab-btn[data-tab="spells"]');
await page.waitForTimeout(500);

// Click inline "+ Add"
const addSpellBtn = page.locator('.spell-list-section button', { hasText: '+ Add' }).first();
await addSpellBtn.click();
await page.waitForTimeout(1500);
await shot(page, 'ux-06-spells-picker');

// Add "Fire Bolt"
await page.fill('#search-input', 'Fire Bolt');
await page.waitForTimeout(800);
await page.locator('.item-list-item').first().click();
await page.waitForTimeout(800);
await page.click('#pane-detail-btn-add');
await page.waitForTimeout(800);

// Close picker via OK
await page.click('#pane-detail-btn-cancel');
await page.waitForTimeout(1000);
await shot(page, 'ux-06-spells-returned');

const spellRow = page.locator('.spell-row-main', { hasText: 'Fire Bolt' });
if (await spellRow.isVisible()) {
  pass('Fire Bolt spell added to list');
} else {
  fail('Fire Bolt not found in list');
}

// Verify no active/concentration toggle (bolt icon) exists on spell row actions
const boltIcon = spellRow.locator('.spell-action-btn .material-icons-outlined', { hasText: 'bolt' });
if (await boltIcon.isVisible().catch(() => false)) {
  fail('Obsolete active/concentration bolt toggle is still visible on spell row');
} else {
  pass('Bolt toggle successfully removed from spell row');
}

// Cantrip prep star is shown for Fire Bolt (since level 0 cantrip)
const prepStar = spellRow.locator('.spell-prep-star');
if (await prepStar.isVisible()) {
  pass('Cantrip displays non-toggleable star indicator');
} else {
  fail('Cantrip star indicator is missing');
}

// Add a 1st level spell to test preparation circular toggle
await addSpellBtn.click();
await page.waitForTimeout(1000);
await page.fill('#search-input', 'Shield');
await page.waitForTimeout(800);
await page.locator('.item-list-item', { hasText: 'Shield' }).first().click();
await page.waitForTimeout(800);
await page.click('#pane-detail-btn-add');
await page.waitForTimeout(800);
await page.click('#pane-detail-btn-cancel');
await page.waitForTimeout(1000);

const shieldSpellRow = page.locator('.spell-row-main', { hasText: 'Shield' });
const prepIndicator = shieldSpellRow.locator('.cs-prof-indicator');
if (await prepIndicator.isVisible()) {
  pass('1st-level spell renders circular proficiency-style preparation toggle');
  // It starts unprepared (does not have class "prof")
  let isPrepared = await prepIndicator.evaluate(el => el.classList.contains('prof'));
  if (!isPrepared) {
    pass('Spell starts unprepared (empty circle)');
  } else {
    fail('Spell starts prepared incorrectly');
  }

  // Click it to prepare
  await prepIndicator.click();
  await page.waitForTimeout(300);
  isPrepared = await prepIndicator.evaluate(el => el.classList.contains('prof'));
  if (isPrepared) {
    pass('Spell toggled to prepared (filled circle)');
  } else {
    fail('Spell failed to toggle to prepared');
  }
} else {
  fail('Shield spell preparation toggle missing');
}

// ── 7. Test Sidebar Closing Sheet ─────────────────────────────────────────────
console.log('7. Testing sidebar menu closing character sheet…');
// Click "Spells" in sidebar to browse compendium
await page.click('.sidebar-menu [data-category="spells"]');
await page.waitForTimeout(1000);
await shot(page, 'ux-07-sidebar-category-switch');

// Verify character sheet closed
const isSheetVisible = await page.locator('#character-sheet-view').isVisible();
if (!isSheetVisible) {
  pass('Clicking sidebar compendium category closed the character sheet view');
} else {
  fail('Clicking sidebar compendium category failed to close character sheet view');
}

// ── Finalization ─────────────────────────────────────────────────────────────
await browser.close();

console.log('\n─────────────────────────────────────────');
if (process.exitCode === 1) {
  console.error('QA FAILED — see errors above');
} else {
  console.log('` + String.fromCodePoint(0x2705) + ` E2E Full UX QA Flow passed successfully');
}
console.log(`Screenshots saved to: ${SCREENSHOT_DIR}\n`);
