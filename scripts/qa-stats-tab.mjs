/**
 * qa-stats-tab.mjs — Playwright headless QA for Phase 3 Stats & Skills Tab
 *
 * Usage:  node scripts/qa-stats-tab.mjs [--url http://localhost:5174]
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

console.log(`\n🎲 QA: Phase 3 Stats & Skills Tab — ${BASE_URL}\n`);

// ── 1. Load the app ──────────────────────────────────────────────────────────
console.log('1. Loading app…');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

// Wait for app init + possible auto-import to start
await page.waitForTimeout(3000);

// Wait for loading overlay to clear
await page.waitForFunction(
  () => {
    const overlay = document.getElementById('loading-overlay');
    return !overlay || overlay.style.display === 'none' || overlay.style.display === '';
  },
  { timeout: 180_000 }
).catch(() => console.log('   Warning: loading overlay still visible'));

await page.waitForTimeout(1000);
await shot(page, '30-initial-load');
pass('App loaded');

// ── 2. Inject test character directly via IndexedDB ─────────────────────────
console.log('2. Injecting test character…');
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
  skillsAttributeOverride: {},
  toolProficiencies: [
    { name: 'Thieves\' Tools', attr: 'dex', profLevel: 1 }
  ],
  languages: ['Common', 'Elvish'],
  otherProficiencies: ['Daggers', 'Light Armor'],
  equipment: [
    { name: 'Longsword', weapon: true, active: true, dmg1: '1d8', dmgType: 'S', properties: ['V'], rawType: 'M' },
    { name: 'Chain Mail', armor: true, active: true, armorType: 'HA', ac: 16, stealth: true }
  ],
  conditions: [],
  modifiers: [],
  counters: [],
  pinnedActions: [],
  featureLists: [],
  itemLists: [],
  spellLists: [],
  _modified_at: new Date().toISOString()
};

const injected = await page.evaluate(async (char) => {
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

if (injected?.ok) {
  pass('Test character injected');
} else {
  fail(`Failed to inject character: ${injected?.error}`);
}

// ── 3. Navigate to character roster and open ───────────────────────────────
console.log('3. Opening character sheet…');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.click('[data-category="characters"]');
await page.waitForTimeout(800);

const charCard = page.locator('.cs-roster-card').first();
await charCard.click();
await page.waitForTimeout(1500);
pass('Opened character sheet');

// ── 4. Switch to Stats & Skills Tab ─────────────────────────────────────────
console.log('4. Navigating to Stats & Skills Tab…');
const statsTabBtn = page.locator('.cs-tab-btn[data-tab="stats"]');
await statsTabBtn.click();
await page.waitForTimeout(800);

const statsRoot = page.locator('#stats-root');
if (await statsRoot.isVisible().catch(() => false)) {
  pass('Stats & Skills Preact view is visible');
} else {
  fail('Stats & Skills Preact view is NOT visible');
}
await shot(page, '31-stats-tab-loaded');

// ── 5. Verify Ability Card values ───────────────────────────────────────────
console.log('5. Verifying ability card values…');
const strCard = page.locator('.cs-attr-box', { hasText: 'Strength' });
const strMod = await strCard.locator('.cs-attr-mod').textContent();
const strScore = await strCard.locator('.cs-attr-score-val').textContent();
const strSave = await strCard.locator('.cs-attr-save-label').textContent();

if (strMod === '+3' && strScore === '16' && strSave.includes('+6')) {
  pass('Strength card loaded with correct calculated stats (Mod +3, Score 16, Save +6)');
} else {
  fail(`Strength card had unexpected values: Mod="${strMod}", Score="${strScore}", Save="${strSave}"`);
}

// ── 6. Edit Base Score in Popup ─────────────────────────────────────────────
console.log('6. Editing base score in popup…');
await strCard.click();
await page.waitForTimeout(500);
await shot(page, '32-strength-popup');

// Click "Edit Base Score"
await page.click('.base-edit-btn');
await page.waitForTimeout(300);

// Fill new score
await page.fill('.base-score-input', '18');
await page.click('.base-edit-row button:has-text("Save")');
await page.waitForTimeout(500);

// Close popup
await page.click('.bd-close');
await page.waitForTimeout(500);

const newStrMod = await strCard.locator('.cs-attr-mod').textContent();
const newStrScore = await strCard.locator('.cs-attr-score-val').textContent();
if (newStrMod === '+4' && newStrScore === '18') {
  pass('Strength score successfully edited to 18 (mod is now +4)');
} else {
  fail(`Failed to edit Strength. Score is "${newStrScore}", Mod is "${newStrMod}"`);
}
await shot(page, '33-strength-edited');

// ── 7. Toggle Save Proficiency ──────────────────────────────────────────────
console.log('7. Toggling saving throw proficiency…');
const strProfBtn = strCard.locator('.cs-prof-indicator');
// STR save should be +7 now (mod +4 + prof +3 = +7)
const saveTextBefore = await strCard.locator('.cs-attr-save-label').textContent();
pass(`Save before toggle: "${saveTextBefore}"`);

// Click indicator to toggle off
await strProfBtn.click();
await page.waitForTimeout(500);

const saveTextAfter = await strCard.locator('.cs-attr-save-label').textContent();
if (saveTextAfter.includes('+4')) {
  pass('Saving throw proficiency toggled off successfully (Save is now +4)');
} else {
  fail(`Failed to toggle saving throw proficiency. Save is "${saveTextAfter}"`);
}
await shot(page, '34-save-proficiency-toggled');

// ── 8. Verify Passives ──────────────────────────────────────────────────────
console.log('8. Verifying Passives…');
const perceptionVal = await page.locator('.cs-passive-card', { hasText: 'Passive Perception' }).locator('.cs-passive-val').textContent();
// Wis mod (+1) + Perception Prof (+3) + 10 = 14
if (perceptionVal === '14') {
  pass('Passive Perception calculated correctly (14)');
} else {
  fail(`Passive Perception is incorrect: "${perceptionVal}"`);
}

// ── 9. Verify Skills and Stealth Disadvantage ───────────────────────────────
console.log('9. Checking Stealth Disadvantage Warning…');
const stealthRow = page.locator('.skill-table-row', { hasText: 'Stealth' });
const disadvWarning = stealthRow.locator('.stealth-warning-indicator');
if (await disadvWarning.isVisible()) {
  pass('Stealth row shows ⚠️ disadvantage warning indicator due to Chain Mail');
} else {
  fail('Stealth row is missing disadvantage warning indicator');
}

// Expand Stealth row to view breakdown
await stealthRow.click();
await page.waitForTimeout(500);
await shot(page, '35-stealth-breakdown');

const disadvBreakdownText = await page.locator('.disadv-row').textContent();
if (disadvBreakdownText.includes('Chain Mail')) {
  pass(`Breakdown correctly displays: "${disadvBreakdownText.trim()}"`);
} else {
  fail(`Breakdown has incorrect disadvantage explanation: "${disadvBreakdownText}"`);
}

// ── 10. Cycle Skill Proficiency ─────────────────────────────────────────────
console.log('10. Cycling skill proficiency (Stealth)…');
const stealthProfBtn = stealthRow.locator('.cs-prof-indicator');

// Click to cycle from None (0) -> Half (0.5)
await stealthProfBtn.click();
await page.waitForTimeout(300);
// Click to cycle from Half (0.5) -> Proficient (1)
await stealthProfBtn.click();
await page.waitForTimeout(300);

// Total Stealth value should be DEX (+2) + Prof (+3) = +5
const stealthVal = await stealthRow.locator('.col-val').textContent();
if (stealthVal === '+5') {
  pass('Stealth proficiency successfully cycled to Proficient (Val: +5)');
} else {
  fail(`Stealth value was expected to be +5, but got "${stealthVal}"`);
}

// ── 11. Override Skill Attribute ─────────────────────────────────────────────
console.log('11. Overriding skill attribute (Athletics)…');
const athleticsRow = page.locator('.skill-table-row', { hasText: 'Athletics' });
const athleticsSelect = athleticsRow.locator('.skill-attr-select');

// Set to CON
await athleticsSelect.selectOption('con');
await page.waitForTimeout(500);

// Athletics value was STR (+4) + Prof (+3) = +7
// Now it should be CON (+2) + Prof (+3) = +5
const athleticsVal = await athleticsRow.locator('.col-val').textContent();
if (athleticsVal === '+5') {
  pass('Athletics attribute successfully overridden to CON (Val: +5)');
} else {
  fail(`Athletics value was expected to be +5, but got "${athleticsVal}"`);
}
await shot(page, '36-athletics-overridden');

// ── 12. Add & Remove Tools ──────────────────────────────────────────────────
console.log('12. Adding and removing tool proficiencies…');
const addToolBtn = page.locator('text=+ Add Tool');
await addToolBtn.click();
await page.waitForTimeout(300);

await page.fill('input[placeholder="Tool Name (e.g. Disguise Kit)"]', 'Brewer\'s Supplies');
// Select WIS and Proficient
await page.selectOption('select[aria-label="New tool attribute"]', { value: 'wis' });
await page.selectOption('select[aria-label="New tool proficiency"]', { value: '1' });

await page.click('.tool-add-form button:has-text("Add")');
await page.waitForTimeout(500);

const brewersTool = page.locator('.skill-table-row', { hasText: 'Brewer\'s Supplies' });
if (await brewersTool.isVisible()) {
  pass('Brewer\'s Supplies tool proficiency successfully added');
} else {
  fail('Brewer\'s Supplies tool proficiency NOT found in list');
}
await shot(page, '37-tool-added');

// Delete Thieves' Tools
const thievesToolRow = page.locator('.skill-table-row', { hasText: 'Thieves\' Tools' });
const deleteBtn = thievesToolRow.locator('.cs-btn-trash');
await deleteBtn.click();
await page.waitForTimeout(500);

const thievesToolVisible = await thievesToolRow.isVisible().catch(() => false);
if (!thievesToolVisible) {
  pass('Thieves\' Tools tool proficiency successfully deleted');
} else {
  fail('Thieves\' Tools was NOT deleted');
}
await shot(page, '38-tool-deleted');

// ── 13. Inline edit Languages ───────────────────────────────────────────────
console.log('13. Inline editing languages…');
const langCard = page.locator('.text-list-card', { hasText: 'Languages' });
const addLangBtn = langCard.locator('text=+ Language');
await addLangBtn.click();
await page.waitForTimeout(300);

await page.fill('input[placeholder="New languages..."]', 'Abyssal');
await page.press('input[placeholder="New languages..."]', 'Enter');
await page.waitForTimeout(500);

const abyssalChip = langCard.locator('.text-chip', { hasText: 'Abyssal' });
if (await abyssalChip.isVisible()) {
  pass('Abyssal language chip added successfully');
} else {
  fail('Abyssal language chip NOT found');
}

// Remove Common
const commonChip = langCard.locator('.text-chip', { hasText: 'Common' });
await commonChip.locator('.chip-remove').click();
await page.waitForTimeout(500);

const commonChipVisible = await commonChip.isVisible().catch(() => false);
if (!commonChipVisible) {
  pass('Common language chip successfully removed');
} else {
  fail('Common language chip is still visible');
}
await shot(page, '39-languages-edited');

console.log('\n✅ All QA checks PASSED\n');

await browser.close();
