// test_5etools_parser.js — Unit tests for the 5eTools Parser Normalizer
// Run with: node test_5etools_parser.js

import { 
  parse5etoolsText, 
  render5etoolsEntries, 
  parse5etoolsSpell, 
  parse5etoolsItem, 
  normalize5etoolsClass, 
  suffixDuplicateNames,
  parse5etoolsFeat,
  parse5etoolsOption
} from './parser-5etools.js';

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

function assertDeepEqual(actual, expected, message) {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${eStr}\n  Actual:   ${aStr}`);
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
console.log('║                 5ETOOLS PARSER UNIT TESTS                ║');
console.log('╚══════════════════════════════════════════════════════════╝');

// --- Test 1: Tag parsing ---
await test('parse5etoolsText tag cleaning', () => {
  assertEqual(parse5etoolsText('Cast {@spell mage hand|phb}'), 'Cast mage hand', 'Spell link tag');
  assertEqual(parse5etoolsText('A {@item thieves\' tools|PHB}'), 'A thieves\' tools', 'Item link tag');
  assertEqual(parse5etoolsText('Target is {@condition invisible}'), 'Target is invisible', 'Condition link tag');
  assertEqual(parse5etoolsText('Roll {@dice 2d6+4} damage'), 'Roll 2d6+4 damage', 'Dice roll tag');
  assertEqual(parse5etoolsText('Deals {@damage 1d10} fire damage'), 'Deals 1d10 fire damage', 'Damage roll tag');
  assertEqual(parse5etoolsText('This is {@b bold} text'), 'This is **bold** text', 'Bold tag');
});

// --- Test 2: Recursive Entries Rendering ---
await test('render5etoolsEntries formatting', () => {
  const sampleEntries = [
    "Line 1",
    {
      "type": "list",
      "items": [
        "Item A",
        "Item B"
      ]
    },
    {
      "type": "entries",
      "name": "Subheader",
      "entries": [
        "Subsection content"
      ]
    }
  ];

  const expectedLines = [
    "Line 1",
    "* Item A",
    "* Item B",
    "### Subheader",
    "Subsection content"
  ];

  assertDeepEqual(render5etoolsEntries(sampleEntries), expectedLines, 'Recursive entries converted to markdown');
});

// --- Test 3: Spell Parser ---
await test('parse5etoolsSpell mapping', () => {
  const rawSpell = {
    name: "Air Bubble",
    source: "AAG",
    level: 2,
    school: "V", // Evocation
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "feet", amount: 60 } },
    components: { s: true },
    duration: [{ type: "timed", duration: { type: "hour", amount: 24 } }],
    entries: ["Creates air bubble"],
    meta: { ritual: true }
  };

  const parsed = parse5etoolsSpell(rawSpell, "AAG");

  assertEqual(parsed.name, "Air Bubble", "Spell name");
  assertEqual(parsed.level, 2, "Spell level");
  assertEqual(parsed.school, "Evocation", "Spell school mapping");
  assertEqual(parsed.ritual, true, "Spell ritual flag");
  assertEqual(parsed.time, "1 action", "Spell casting time");
  assertEqual(parsed.range, "60 feet", "Spell range");
  assertEqual(parsed.components, "S", "Spell components string");
  assertEqual(parsed.duration, "24 hours", "Spell duration string");
  assertDeepEqual(parsed.texts, ["Creates air bubble"], "Spell entries");

  // Verify Cure Wounds-style touch range and Enchantment school
  const rawCure = {
    name: "Cure Wounds",
    source: "PHB",
    level: 1,
    school: "E", // Enchantment
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "touch" } },
    entries: ["Heals target"]
  };
  const parsedCure = parse5etoolsSpell(rawCure, "PHB");
  assertEqual(parsedCure.school, "Enchantment", "Enchantment school mapping");
  assertEqual(parsedCure.range, "Touch", "Touch range mapping");
});

// --- Test 4: Item Parser ---
await test('parse5etoolsItem mapping', () => {
  const rawItem = {
    name: "Gauntlets of Ogre Power",
    source: "DMG",
    type: "W",
    rarity: "uncommon",
    weight: 2,
    value: 50000,
    entries: ["Your strength becomes 19"]
  };

  const parsed = parse5etoolsItem(rawItem, "DMG");

  assertEqual(parsed.name, "Gauntlets of Ogre Power", "Item name");
  assertEqual(parsed.type, "Wondrous Item", "Item type mapping");
  assertEqual(parsed.detail, "uncommon", "Item rarity detail");
  assertEqual(parsed.magic, true, "Item magic status");
  assertEqual(parsed.weight, 2, "Item weight");
  assertEqual(parsed.value, 500, "Item value CP converted to GP");
  assertDeepEqual(parsed.texts, ["Your strength becomes 19"], "Item description entries");
});

// --- Test 5: Class/Subclass Normalizer ---
await test('normalize5etoolsClass mapping', () => {
  const rawClass = {
    name: "Rogue",
    source: "XPHB",
    hd: { number: 1, faces: 8 },
    proficiency: ["dex", "int"],
    startingProficiencies: {
      armor: ["light"],
      weapons: ["simple"],
      skills: [
        {
          choose: {
            from: ["acrobatics", "athletics"],
            count: 2
          }
        }
      ]
    },
    classTableGroups: [
      {
        title: "Spell Slots per Spell Level",
        rowsSpellProgression: [
          [0, 0],
          [2, 0]
        ]
      }
    ]
  };

  const rawSubclass = [
    {
      name: "Arcane Trickster",
      shortName: "Arcane Trickster",
      className: "Rogue",
      source: "PHB"
    }
  ];

  const rawClassFeatures = [
    {
      name: "Expertise",
      className: "Rogue",
      level: 1,
      source: "XPHB",
      entries: ["Choose two skill proficiencies"]
    }
  ];

  const rawSubclassFeatures = [
    {
      name: "Spellcasting",
      className: "Rogue",
      subclassShortName: "Arcane Trickster",
      level: 3,
      source: "PHB",
      entries: ["You cast spells"]
    }
  ];

  const normalized = normalize5etoolsClass(rawClass, rawSubclass, rawClassFeatures, rawSubclassFeatures, "XPHB");

  assertEqual(normalized.classRecord.name, "Rogue", "Class Name");
  assertEqual(normalized.classRecord.hd, 8, "Hit Dice");
  assertEqual(normalized.classRecord.proficiency, "Dexterity, Intelligence, Acrobatics, Athletics", "Saving Throw & Skill Proficiencies");
  assertEqual(normalized.classRecord.autolevels.length, 20, "Autolevel rows");
  assertEqual(normalized.classRecord.autolevels[1].slots, "2,0", "Level 2 spell slots parsed");
  
  assertEqual(normalized.subclassRecords.length, 1, "Subclass count");
  assertEqual(normalized.subclassRecords[0].name, "Arcane Trickster", "Subclass name");
  assertEqual(normalized.subclassRecords[0].parentClass, "Rogue", "Subclass parent class");
  assertEqual(normalized.subclassRecords[0].autolevels[0].level, 3, "Subclass autolevel level");
  assertEqual(normalized.subclassRecords[0].autolevels[0].features[0].name, "Spellcasting", "Subclass feature name");
});

// --- Test 6: Name Collision & Suffixing ---
await test('suffixDuplicateNames resolution', () => {
  const records = [
    { name: "Rogue", source: "PHB" },
    { name: "Rogue", source: "XPHB" },
    { name: "Fighter", source: "PHB" }
  ];

  suffixDuplicateNames(records, "classes");

  assertEqual(records[0].name, "Rogue (PHB)", "Duplicate suffixed");
  assertEqual(records[1].name, "Rogue (XPHB)", "Duplicate suffixed");
  assertEqual(records[2].name, "Fighter", "Unique item untouched");
});

// --- Test 7: Spell Lookup Parsing ---
await test('parse5etoolsSpell with lookup map', () => {
  const rawSpell = {
    name: "Guidance",
    source: "xphb",
    level: 0,
    school: "D",
    entries: ["You touch a creature..."]
  };
  
  const mockLookup = {
    "xphb": {
      "guidance": {
        "class": {
          "cleric": { "Cleric": true },
          "druid": { "Druid": true }
        },
        "subclass": {
          "xphb": {
            "Cleric": {
              "xphb": {
                "Life Domain": { "name": "Life Domain" }
              }
            }
          }
        }
      }
    }
  };

  const parsed = parse5etoolsSpell(rawSpell, "xphb", mockLookup);
  assertEqual(parsed.classes.length, 3, "Guidance classes length");
  assertDeepEqual(parsed.classes, ["Cleric", "Cleric (Life Domain)", "Druid"], "Guidance classes lists subclass");
});

// --- Test 8: Feat Parser with Origin/General Categories ---
await test('parse5etoolsFeat category mapping', () => {
  const rawOriginFeat = {
    name: "Alert",
    source: "XPHB",
    category: "O",
    entries: ["Gain initiative bonus"]
  };
  const parsedOrigin = parse5etoolsFeat(rawOriginFeat, "XPHB");
  assertEqual(parsedOrigin.category, "Origin", "O mapping to Origin");

  const rawGeneralFeat = {
    name: "Actor",
    source: "XPHB",
    category: "G",
    entries: ["Mimicry"]
  };
  const parsedGeneral = parse5etoolsFeat(rawGeneralFeat, "XPHB");
  assertEqual(parsedGeneral.category, "General", "G mapping to General");
});

// --- Test 9: Optional Feature Parser featureType mapping ---
await test('parse5etoolsOption featureType mapping', () => {
  const rawOption = {
    name: "Agonizing Blast",
    source: "PHB",
    featureType: ["EI"],
    entries: ["Add charisma mod to eldritch blast"]
  };
  const parsed = parse5etoolsOption(rawOption, "PHB");
  assertDeepEqual(parsed.classes, ["Eldritch Invocation"], "EI maps to Eldritch Invocation");
});

// --- Test 10: Spell Lookup subclass source filter (e.g. PSA bleed prevention) ---
await test('parse5etoolsSpell activeSources check with lookup', () => {
  const rawSpell = {
    name: "Aid",
    source: "XPHB",
    level: 2,
    school: "A",
    entries: ["Aid entries"]
  };

  const mockLookup = {
    "phb": {
      "aid": {
        "class": {
          "PHB": { "Cleric": true }
        },
        "subclass": {
          "XPHB": {
            "Cleric": {
              "PSA": {
                "Solidarity (PSA)": { "name": "Solidarity Domain (PSA)" }
              },
              "TCE": {
                "Peace": { "name": "Peace Domain" }
              }
            }
          }
        }
      }
    }
  };

  const activeSources = ["XPHB", "TCE"];
  const parsed = parse5etoolsSpell(rawSpell, "XPHB", mockLookup, activeSources);

  const hasPSA = parsed.classes.some(c => c.includes("PSA") || c.includes("Solidarity"));
  assertEqual(hasPSA, false, "Solidarity Domain (PSA) subclass was filtered out");

  const hasPeace = parsed.classes.includes("Cleric (Peace Domain)");
  assertEqual(hasPeace, true, "Peace Domain subclass is included");
});

console.log('\n══════════════════════════════════════════════════════════');
if (failCount === 0) {
  console.log(`✅  ALL ${passCount} PARSER TESTS PASSED`);
  process.exit(0);
} else {
  console.log(`Results: ${passCount} passed, ${failCount} FAILED`);
  process.exit(1);
}
