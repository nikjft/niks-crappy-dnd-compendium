// test_engine.js — Unit tests for the 5.5e Calculation Engine
// Run with: node test_engine.js

import { calculateCharacterState, evaluateFormula } from './engine.js';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║               CHARACTER STATE ENGINE TESTS               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// --- Test Formula Evaluation ---
await test('evaluateFormula with numbers and placeholders', () => {
  const state = { 'char.level': 5, 'str.mod': 3 };
  assertEqual(evaluateFormula(10, state), 10, 'Static number');
  assertEqual(evaluateFormula('15', state), 15, 'Static string number');
  assertEqual(evaluateFormula('2 * {char.level}', state), 10, 'Formula with level');
  assertEqual(evaluateFormula('{str.mod} + 2', state), 5, 'Formula with attribute modifier');
  assertEqual(evaluateFormula('Math.min(2, {str.mod})', state), 2, 'Math.min check');
  assertEqual(evaluateFormula('invalid placeholder {nonexistent}', state), 0, 'Missing variable returns 0');
});

// --- Test Default Character State ---
await test('Default Level 1 Character Calculations', () => {
  const character = {
    name: 'Grog',
    level: 1,
    baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savesProficiency: {},
    skillsProficiency: {},
    speed: 30,
    baseHpMax: 10,
    spellcastingAbility: 'wis'
  };

  const state = calculateCharacterState(character);

  assertEqual(state['char.level'], 1, 'Level is 1');
  assertEqual(state['prof_bonus'], 2, 'Prof bonus is 2');
  assertEqual(state['str.score'], 10, 'STR score is 10');
  assertEqual(state['str.mod'], 0, 'STR modifier is 0');
  assertEqual(state['ac'], 10, 'Base AC is 10');
  assertEqual(state['initiative'], 0, 'Initiative is 0');
  assertEqual(state['speed'], 30, 'Speed is 30');
  assertEqual(state['save.str'], 0, 'STR save is 0');
  assertEqual(state['skill.athletics'], 0, 'Athletics is 0');
  assertEqual(state['passive.perception'], 10, 'Passive perception is 10');
  assertEqual(state['hp.max'], 10, 'HP max base is 10 (10 + 0 con * 1 lvl)');
});

// --- Test Level Up & Prof Bonus ---
await test('Character Level Up Calculations', () => {
  const character = {
    level: 5, // level 5 should give prof bonus 3
    baseStats: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    savesProficiency: { dex: 1 },
    skillsProficiency: { stealth: 1 },
    baseHpMax: 20
  };

  const state = calculateCharacterState(character);

  assertEqual(state['char.level'], 5, 'Level 5');
  assertEqual(state['prof_bonus'], 3, 'Prof bonus 3');
  assertEqual(state['dex.mod'], 2, 'DEX mod 2');
  assertEqual(state['save.dex'], 5, 'DEX save: 2 mod + 3 prof = 5');
  assertEqual(state['skill.stealth'], 5, 'Stealth skill: 2 mod + 3 prof = 5');
  assertEqual(state['hp.max'], 25, 'HP Max: 20 base + 1 con * 5 level = 25');
});

// --- Test Active vs Inactive Modifiers ---
await test('Only active modifiers apply to calculations', () => {
  const character = {
    level: 1,
    baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [
      {
        name: 'Ring of Protection',
        active: true,
        modifiers: [
          { target: 'ac', type: 'add', value: 1 },
          { target: 'save.all', type: 'add', value: 1 }
        ]
      },
      {
        name: 'Shield of Awesomeness',
        active: false,
        modifiers: [
          { target: 'ac', type: 'add', value: 2 }
        ]
      }
    ]
  };

  const state = calculateCharacterState(character);

  assertEqual(state['ac'], 11, 'AC includes Ring (+1) but not Shield (inactive)');
  assertEqual(state['save.str'], 1, 'STR Save gets +1 from Ring');
  assertEqual(state['save.dex'], 1, 'DEX Save gets +1 from Ring');
});

// --- Test Modifier Math Formulas ---
await test('Modifiers with formulas resolve in dependency order', () => {
  const character = {
    level: 5,
    baseStats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    baseHpMax: 20,
    features: [
      {
        name: 'Tough Feat',
        active: true,
        modifiers: [
          { target: 'hp.max', type: 'add', value: '2 * {char.level}' }
        ]
      }
    ]
  };

  const state = calculateCharacterState(character);

  // Base HP = 20 (base) + 2 con * 5 level = 30
  // Tough bonus = 2 * 5 level = 10
  // Total HP = 40
  assertEqual(state['hp.max'], 40, 'Tough feat adds 2 * level to HP max');
});

// --- Test Overrides (Set Modifiers) ---
await test('Set Modifiers override previous calculations', () => {
  const character = {
    level: 1,
    baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [
      {
        name: 'Gauntlets of Ogre Power',
        active: true,
        modifiers: [
          { target: 'str.score', type: 'set', value: 19 }
        ]
      }
    ],
    savesProficiency: { str: 1 },
    skillsProficiency: { athletics: 1 }
  };

  const state = calculateCharacterState(character);

  assertEqual(state['str.score'], 19, 'STR score set to 19');
  assertEqual(state['str.mod'], 4, 'STR modifier is now +4');
  assertEqual(state['save.str'], 6, 'STR Save: +4 mod + 2 prof = 6');
  assertEqual(state['skill.athletics'], 6, 'Athletics: +4 mod + 2 prof = 6');
});

// --- Test Skill Multipliers (Expertise & Jack of all Trades) ---
await test('Skill proficiencies (Expertise=2, JackOfAllTrades=0.5) calculate correctly', () => {
  const character = {
    level: 1,
    baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skillsProficiency: {
      perception: 2, // Expertise
      athletics: 0.5 // Jack of All Trades / Half Prof
    }
  };

  const state = calculateCharacterState(character);

  // Perception = 0 wis.mod + 2 * 2 prof = 4
  assertEqual(state['skill.perception'], 4, 'Expertise perception gets double prof bonus (+4)');
  // Athletics = 0 str.mod + 0.5 * 2 prof = 1
  assertEqual(state['skill.athletics'], 1, 'Jack of all trades gets half prof bonus (+1)');
  // Passive perception = 10 + 4 perception = 14
  assertEqual(state['passive.perception'], 14, 'Passive perception is 10 + resolved perception (14)');
});

console.log('\n══════════════════════════════════════════════════════════');
if (failCount === 0) {
  console.log(`✅  ALL ${passCount} ENGINE TESTS PASSED`);
  process.exit(0);
} else {
  console.log(`Results: ${passCount} passed, ${failCount} FAILED`);
  process.exit(1);
}
