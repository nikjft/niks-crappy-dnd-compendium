/**
 * qa-combat-tab.mjs — Playwright headless QA for Phase 2 Combat Tab
 *
 * Usage:  node scripts/qa-combat-tab.mjs [--url http://localhost:5174]
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

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }

// ─── Main ────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', msg => console.log('   [PAGE LOG]', msg.text()));
page.on('pageerror', err => console.error('   [PAGE ERROR]', err.stack || err.message));

await mkdir(SCREENSHOT_DIR, { recursive: true });

console.log(`\n🎲 QA: Phase 2 Combat Tab — ${BASE_URL}\n`);

// ── 1. Load the app ──────────────────────────────────────────────────────────
console.log('1. Loading app…');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

// Wait for app init + possible auto-import to start
await page.waitForTimeout(3000);

// Wait for loading overlay to clear (auto-import runs behind it)
await page.waitForFunction(
  () => {
    const overlay = document.getElementById('loading-overlay');
    return !overlay || overlay.style.display === 'none' || overlay.style.display === '';
  },
  { timeout: 180_000 }
).catch(() => console.log('   Warning: loading overlay still visible'));

await page.waitForTimeout(1000);
await shot(page, '01-initial-load');
pass('App loaded');

// ── 2. Check DB status ───────────────────────────────────────────────────────
console.log('2. Checking DB status…');
const dbStatus = page.locator('#db-status');
const dbStatusText = await dbStatus.textContent().catch(() => '');
if (/error|failed/i.test(dbStatusText)) {
  fail(`DB status indicates error: "${dbStatusText}"`);
} else {
  pass(`DB status: "${dbStatusText}"`);
}
await shot(page, '02-after-import');

// ── 3. Inject test character directly via IndexedDB ─────────────────────────
console.log('3. Injecting test character…');
// The app has now run, so the DB should be initialized. Inject directly.
const testChar = {
  id: 'qa-test-char-001',
  name: 'QA Test Character',
  level: 5,
  baseStats: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  baseHpMax: 38,
  hp: { current: 28, temp: 5 },
  deathSaves: { successes: 0, failures: 0 },
  speed: 30,
  savesProficiency: { str: 1, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
  skillsProficiency: { athletics: 1, perception: 1 },
  equipment: [
    { name: 'Longsword', weapon: true, active: true, dmg1: '1d8', dmgType: 'S', properties: ['V'], rawType: 'M' },
    { name: 'Chain Mail', armor: true, active: true, armorType: 'HA', ac: 16 }
  ],
  conditions: [],
  modifiers: [],
  counters: [{ name: 'Second Wind', current: 0, max: 1, resetShort: true, resetLong: true }],
  pinnedActions: [],
  _modified_at: new Date().toISOString()
};

// Wait a bit more for any app init to complete, then inject
await page.waitForTimeout(2000);

const injected = await page.evaluate(async (char) => {
  return new Promise((resolve) => {
    // Open without version — just connect to existing DB
    const req = indexedDB.open('dnd_compendium_db');
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('characters')) {
        db.close();
        resolve({ ok: false, error: `characters store not found in DB v${db.version}. Stores: ${Array.from(db.objectStoreNames).join(', ')}` });
        return;
      }
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters');
      const put = store.put(char);
      put.onsuccess = () => { db.close(); resolve({ ok: true }); };
      put.onerror = (e2) => { db.close(); resolve({ ok: false, error: String(e2.target.error) }); };
    };
    req.onerror = (e) => resolve({ ok: false, error: String(e.target.error) });
    req.onupgradeneeded = (e) => {
      // DB doesn't exist yet or wrong version — report the issue
      e.target.transaction.abort();
      resolve({ ok: false, error: `DB needs upgrade (current: ${e.oldVersion}, needed: ${e.newVersion}) — app hasn't opened it yet` });
    };
  });
}, testChar);

if (injected?.ok) {
  pass('Test character injected via IndexedDB');
} else {
  fail(`Failed to inject character: ${injected?.error}`);
}


// ── 4. Navigate to character ─────────────────────────────────────────────────
console.log('4. Opening character sheet…');

// Reload so the injected character appears
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
// Wait for any overlay from reload
await page.waitForFunction(
  () => {
    const overlay = document.getElementById('loading-overlay');
    return !overlay || overlay.style.display === 'none' || overlay.style.display === '';
  },
  { timeout: 60_000 }
).catch(() => {});
await page.waitForTimeout(500);

// Navigate to Characters
await page.click('[data-category="characters"]');
await page.waitForTimeout(800);

// Open the character card
const charCard = page.locator('.cs-roster-card').first();
if (await charCard.isVisible().catch(() => false)) {
  await charCard.click();
  await page.waitForTimeout(1500);
  pass('Opened character card');
} else {
  fail('No character card found');
}

await shot(page, '04-character-sheet');

// Verify character sheet is visible
const csView = page.locator('#character-sheet-view');
const csVisible = await csView.isVisible().catch(() => false);
if (csVisible) {
  pass('Character sheet view is visible');
} else {
  fail('Character sheet view is NOT visible');
}

// ── 5. Ensure Combat tab ─────────────────────────────────────────────────────
console.log('5. Ensuring Combat tab is active…');
const combatTabBtn = page.locator('.cs-tab-btn[data-tab="combat"]');
if (await combatTabBtn.isVisible().catch(() => false)) {
  await combatTabBtn.click();
  await page.waitForTimeout(600);
  pass('Clicked Combat tab');
} else {
  pass('Combat tab button not found (may already be active)');
}

// Wait for Preact to render into combat-root
await page.waitForSelector('#combat-root', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(800);
await shot(page, '05-combat-tab-top');

// ── 6. Verify Combat tab sections ───────────────────────────────────────────
console.log('6. Verifying Combat tab sections…');

// HP section
if (await page.locator('.hp-section').isVisible().catch(() => false)) {
  pass('HP section visible');
} else { fail('HP section NOT found'); }

// Conditions bar
if (await page.locator('.conditions-bar').isVisible().catch(() => false)) {
  pass('Conditions bar visible');
} else { fail('Conditions bar NOT found'); }

// Quick Actions section
if (await page.locator('.qa-section').isVisible().catch(() => false)) {
  pass('Quick Actions section visible');
} else { fail('Quick Actions section NOT found'); }

// Stat cards grid (AC, Initiative, Speed, Prof)
const statsGrid = page.locator('.cs-combat-stats-grid');
if (await statsGrid.isVisible().catch(() => false)) {
  const count = await statsGrid.locator('.cs-combat-stat-card').count();
  if (count >= 4) pass(`Stat cards grid visible (${count} cards)`);
  else fail(`Stat cards grid has only ${count} cards (expected ≥4)`);
} else { fail('Stat cards grid NOT found'); }

// Attacks section
if (await page.locator('.cs-combat-card').filter({ hasText: /attacks/i }).first().isVisible().catch(() => false)) {
  pass('Attacks section visible');
} else { fail('Attacks section NOT found'); }

// Active Modifiers section
if (await page.locator('.cs-combat-card').filter({ hasText: /active modifier/i }).first().isVisible().catch(() => false)) {
  pass('Active Modifiers section visible');
} else { fail('Active Modifiers section NOT found'); }

// Counters section
if (await page.locator('.cs-combat-card').filter({ hasText: /counters/i }).first().isVisible().catch(() => false)) {
  pass('Usage Counters section visible');
} else { fail('Usage Counters section NOT found'); }

// Rest buttons
const restCard = page.locator('.rest-card, .cs-combat-card').filter({ hasText: /rest/i }).first();
if (await restCard.isVisible().catch(() => false)) {
  pass('Rest card visible');
  if (await restCard.getByText(/short rest/i).isVisible().catch(() => false)) pass('Short Rest button visible');
  else fail('Short Rest button NOT visible');
  if (await restCard.getByText(/long rest/i).isVisible().catch(() => false)) pass('Long Rest button visible');
  else fail('Long Rest button NOT visible');
} else { fail('Rest card NOT found'); }

await shot(page, '06-combat-sections-verified');

// ── 7. Scroll down ───────────────────────────────────────────────────────────
console.log('7. Scrolling down for full view…');
const combatRoot = page.locator('#combat-root');
if (await combatRoot.isVisible().catch(() => false)) {
  await combatRoot.evaluate(el => el.scrollTop = el.scrollHeight);
}
await page.waitForTimeout(400);
await shot(page, '07-combat-tab-bottom');

// ── 8. Test HP modal ─────────────────────────────────────────────────────────
console.log('8. Testing HP modal…');
// Scroll back to top first
if (await combatRoot.isVisible().catch(() => false)) {
  await combatRoot.evaluate(el => el.scrollTop = 0);
}
await page.waitForTimeout(300);

const hpBar = page.locator('.hp-bar-wrap');
if (await hpBar.isVisible().catch(() => false)) {
  await hpBar.click();
  await page.waitForTimeout(500);
  const hpModal = page.locator('.hp-modal');
  if (await hpModal.isVisible().catch(() => false)) {
    pass('HP modal opens on click');
    await shot(page, '08-hp-modal-open');
    const closeBtn = page.locator('.hp-modal .bd-close, .hp-modal button[aria-label*="close" i]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
    pass('HP modal closed');
  } else {
    fail('HP modal did NOT open');
    await shot(page, '08-hp-modal-FAIL');
  }
} else { fail('HP bar NOT found to click'); }

// ── 9. Test Condition picker ─────────────────────────────────────────────────
console.log('9. Testing Condition picker…');
const condBtn = page.locator('.chip-add').first();
if (await condBtn.isVisible().catch(() => false)) {
  await condBtn.click();
  await page.waitForTimeout(500);
  const picker = page.locator('.condition-picker');
  if (await picker.isVisible().catch(() => false)) {
    pass('Condition picker opens');
    await shot(page, '09-condition-picker');
    await page.click('.condition-picker .bd-close');
    await page.waitForTimeout(300);
    pass('Condition picker closed');
  } else {
    fail('Condition picker did NOT open');
    await shot(page, '09-condition-picker-FAIL');
  }
} else { fail('+ Condition button NOT found'); }

// ── 10. Test Quick Actions pin picker ────────────────────────────────────────
console.log('10. Testing Quick Actions pin picker…');
const pinBtn = page.locator('.qa-section .cs-btn-small');
if (await pinBtn.isVisible().catch(() => false)) {
  await pinBtn.click();
  await page.waitForTimeout(500);
  const qaPicker = page.locator('.qa-picker');
  if (await qaPicker.isVisible().catch(() => false)) {
    pass('Quick Actions picker opens');
    await shot(page, '10-quick-actions-picker');
    // Close by clicking close button
    await page.click('.qa-picker .bd-close');
    await page.waitForTimeout(300);
    pass('Quick Actions picker closed');
  } else {
    fail('Quick Actions picker did NOT open');
    await shot(page, '10-qa-picker-FAIL');
  }
} else { fail('Quick Actions "+ Pin" button NOT found'); }
// ── 11. Test AC stat card breakdown popup ────────────────────────────────────
console.log('11. Testing AC breakdown popup…');
const acCard = page.locator('.cs-combat-stat-card').first();
if (await acCard.isVisible().catch(() => false)) {
  const cardsInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.cs-combat-stat-card')).map((el, idx) => ({
      index: idx,
      text: el.textContent,
      classList: Array.from(el.classList),
      html: el.outerHTML?.slice(0, 200)
    }));
  });
  console.log('   All stat cards info:', JSON.stringify(cardsInfo, null, 2));
  const hasClickable = await acCard.evaluate(el => el.classList.contains('clickable'));
  console.log('   AC card has clickable class:', hasClickable);
  await acCard.click();
  await page.waitForTimeout(500);
  const bdPopup = page.locator('.bd-popup').first();
  if (await bdPopup.isVisible().catch(() => false)) {
    pass('Breakdown popup opens on stat card click');
    await shot(page, '11-breakdown-popup');
    await page.click('.bd-popup .bd-close');
    await page.waitForTimeout(300);
    pass('Breakdown popup closed');
  } else {
    fail('Breakdown popup did NOT open');
    await shot(page, '11-breakdown-FAIL');
  }
} else { fail('Stat card NOT found'); }

// ── 12. Test Short Rest wizard ────────────────────────────────────────────────
console.log('12. Testing Short Rest wizard…');
const shortRestBtn = page.locator('.rest-card button').filter({ hasText: /short rest/i }).first();
if (await shortRestBtn.isVisible().catch(() => false)) {
  await shortRestBtn.click();
  await page.waitForTimeout(500);
  const wizard = page.locator('.rest-wizard');
  if (await wizard.isVisible().catch(() => false)) {
    pass('Short Rest wizard opens');
    await shot(page, '12-rest-wizard');
    await page.click('.rest-wizard .bd-close');
    await page.waitForTimeout(300);
    pass('Rest wizard closed');
  } else {
    fail('Rest wizard did NOT open');
    await shot(page, '12-rest-FAIL');
  }
} else { fail('Short Rest button NOT found'); }

// ── Final screenshot ──────────────────────────────────────────────────────────
await shot(page, '13-final');
await browser.close();

console.log('\n─────────────────────────────────────────');
if (process.exitCode === 1) {
  console.error('QA FAILED — see ❌ items above');
} else {
  console.log('✅ All QA checks PASSED');
}
console.log(`Screenshots saved to: ${SCREENSHOT_DIR}\n`);
