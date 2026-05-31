// Mappings for XML abbreviations
export const ITEM_TYPES = {
  'LA': 'Light Armor',
  'MA': 'Medium Armor',
  'HA': 'Heavy Armor',
  'S': 'Shield',
  'M': 'Melee Weapon',
  'R': 'Ranged Weapon',
  'A': 'Ammunition',
  'RD': 'Rod',
  'ST': 'Staff',
  'WD': 'Wand',
  'RG': 'Ring',
  'P': 'Potion',
  'SC': 'Scroll',
  'W': 'Wondrous Item',
  'G': 'Adventuring Gear',
  '$': 'Money'
};

export const SPELL_SCHOOLS = {
  'A': 'Abjuration',
  'C': 'Conjuration',
  'D': 'Divination',
  'EN': 'Enchantment',
  'EV': 'Evocation',
  'I': 'Illusion',
  'N': 'Necromancy',
  'T': 'Transmutation'
};

export const MONSTER_SIZES = {
  'T': 'Tiny',
  'S': 'Small',
  'M': 'Medium',
  'L': 'Large',
  'H': 'Huge',
  'G': 'Gargantuan'
};

export const DAMAGE_TYPES = {
  'B': 'Bludgeoning',
  'P': 'Piercing',
  'S': 'Slashing',
  'A': 'Acid',
  'C': 'Cold',
  'F': 'Fire',
  'FC': 'Force',
  'L': 'Lightning',
  'N': 'Necrotic',
  'PS': 'Poison',
  'PY': 'Psychic',
  'R': 'Radiant',
  'T': 'Thunder'
};

// XML Parsing Helpers
function extractParenthesizedSuffix(str) {
  if (!str || !str.endsWith(')')) return null;
  
  let parenCount = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    if (str[i] === ')') {
      parenCount++;
    } else if (str[i] === '(') {
      parenCount--;
      if (parenCount === 0) {
        return str.substring(i + 1, str.length - 1).trim();
      }
    }
  }
  return null;
}

function getChildText(element, tagName, defaultValue = '') {
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1 && child.nodeName === tagName) {
      return child.textContent.trim();
    }
  }
  return defaultValue;
}

function getChildTexts(element, tagName) {
  const arr = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1 && child.nodeName === tagName) {
      arr.push(child.textContent.trim());
    }
  }
  return arr;
}

function getChildElements(element, tagName) {
  const arr = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1 && child.nodeName === tagName) {
      arr.push(child);
    }
  }
  return arr;
}

function parseTrait(element) {
  return {
    name: getChildText(element, 'name'),
    texts: getChildTexts(element, 'text'),
    attacks: getChildTexts(element, 'attack'),
    rolls: getChildTexts(element, 'roll'),
    recharge: getChildText(element, 'recharge')
  };
}

// Main parsing functions for each category
export function parseSpell(element) {
  const schoolAbbrev = getChildText(element, 'school');
  const school = SPELL_SCHOOLS[schoolAbbrev] || schoolAbbrev || 'Unknown';
  
  const classesRaw = getChildText(element, 'classes');
  const classesList = classesRaw ? classesRaw.split(',').map(c => c.trim()).filter(Boolean) : [];

  return {
    name: getChildText(element, 'name'),
    level: parseInt(getChildText(element, 'level')) || 0,
    school: school,
    ritual: getChildText(element, 'ritual') === 'YES',
    time: getChildText(element, 'time'),
    range: getChildText(element, 'range'),
    components: getChildText(element, 'components'),
    duration: getChildText(element, 'duration'),
    classes: classesList,
    source: getChildText(element, 'source'),
    texts: getChildTexts(element, 'text'),
    rolls: getChildTexts(element, 'roll')
  };
}

export function parseItem(element) {
  const typeAbbrev = getChildText(element, 'type');
  const type = ITEM_TYPES[typeAbbrev] || typeAbbrev || 'Unknown';
  
  const dmgTypeAbbrev = getChildText(element, 'dmgType');
  const dmgType = DAMAGE_TYPES[dmgTypeAbbrev] || dmgTypeAbbrev || '';

  return {
    name: getChildText(element, 'name'),
    detail: getChildText(element, 'detail'),
    type: type,
    magic: getChildText(element, 'magic') === 'YES',
    weight: parseFloat(getChildText(element, 'weight')) || 0,
    value: parseFloat(getChildText(element, 'value')) || 0,
    ac: parseInt(getChildText(element, 'ac')) || null,
    strength: parseInt(getChildText(element, 'strength')) || null,
    stealth: getChildText(element, 'stealth') === 'YES',
    dmg1: getChildText(element, 'dmg1'),
    dmg2: getChildText(element, 'dmg2'),
    dmgType: dmgType,
    property: getChildText(element, 'property'),
    range: getChildText(element, 'range'),
    texts: getChildTexts(element, 'text'),
    modifiers: getChildElements(element, 'modifier').map(m => ({
      category: m.getAttribute('category') || '',
      value: m.textContent.trim()
    })),
    rolls: getChildTexts(element, 'roll')
  };
}

export function parseMonster(element) {
  const sizeAbbrev = getChildText(element, 'size');
  const size = MONSTER_SIZES[sizeAbbrev] || sizeAbbrev || 'Medium';

  return {
    name: getChildText(element, 'name'),
    size: size,
    type: getChildText(element, 'type'),
    alignment: getChildText(element, 'alignment'),
    ac: getChildText(element, 'ac'),
    hp: getChildText(element, 'hp'),
    speed: getChildText(element, 'speed'),
    init: parseInt(getChildText(element, 'init')) || null,
    str: parseInt(getChildText(element, 'str')) || 10,
    dex: parseInt(getChildText(element, 'dex')) || 10,
    con: parseInt(getChildText(element, 'con')) || 10,
    int: parseInt(getChildText(element, 'int')) || 10,
    wis: parseInt(getChildText(element, 'wis')) || 10,
    cha: parseInt(getChildText(element, 'cha')) || 10,
    save: getChildText(element, 'save'),
    skill: getChildText(element, 'skill'),
    vulnerable: getChildText(element, 'vulnerable'),
    resist: getChildText(element, 'resist'),
    immune: getChildText(element, 'immune'),
    conditionImmune: getChildText(element, 'conditionImmune'),
    senses: getChildText(element, 'senses'),
    passive: parseInt(getChildText(element, 'passive')) || 10,
    languages: getChildText(element, 'languages'),
    cr: getChildText(element, 'cr') || '0',
    traits: getChildElements(element, 'trait').map(parseTrait),
    actions: getChildElements(element, 'action').map(parseTrait),
    reactions: getChildElements(element, 'reaction').map(parseTrait),
    legendary: getChildElements(element, 'legendary').map(parseTrait),
    spells: getChildText(element, 'spells'),
    description: getChildText(element, 'description'),
    environment: getChildText(element, 'environment')
  };
}

export function parseClass(element) {
  const className = getChildText(element, 'name');
  const autolevels = getChildElements(element, 'autolevel').map(a => {
    const level = parseInt(a.getAttribute('level')) || 1;
    const features = getChildElements(a, 'feature').map(f => {
      const fName = getChildText(f, 'name');
      return {
        name: fName,
        texts: getChildTexts(f, 'text'),
        special: getChildText(f, 'special'),
        optional: f.getAttribute('optional') === 'YES',
        modifiers: getChildElements(f, 'modifier').map(m => ({
          category: m.getAttribute('category') || '',
          value: m.textContent.trim()
        }))
      };
    });
    
    const slots = getChildText(a, 'slots');
    const counters = getChildElements(a, 'counter').map(c => ({
      name: getChildText(c, 'name'),
      value: getChildText(c, 'value'),
      reset: getChildText(c, 'reset'),
      subclass: getChildText(c, 'subclass')
    }));

    return { level, features, slots, counters };
  });

  // Extract subclasses list and tag subclass features
  const subclassesSet = new Set();
  const featuresList = [];

  autolevels.forEach(al => {
    // Extract subclasses from counters if specified
    al.counters.forEach(c => {
      if (c.subclass) {
        const sub = c.subclass.trim();
        if (sub.toLowerCase() !== className.toLowerCase()) {
          subclassesSet.add(sub);
        }
      }
    });

    al.features.forEach(feat => {
      let subclass = null;

      // 1. Check if this feature defines a subclass (e.g. "Barbarian Subclass: Path of the Berserker")
      const subDefMatch = feat.name.match(/Subclass:\s*(.+)$/i);
      if (subDefMatch) {
        const possibleSub = subDefMatch[1].trim();
        if (possibleSub.toLowerCase() !== className.toLowerCase()) {
          subclass = possibleSub;
          subclassesSet.add(subclass);
        }
      } else {
        // 2. Check if feature belongs to a subclass via parenthesis suffix (e.g. "Frenzy (Path of the Berserker)")
        const possibleSub = extractParenthesizedSuffix(feat.name);
        if (possibleSub) {
          if (possibleSub.toLowerCase() !== className.toLowerCase()) {
            subclass = possibleSub;
            subclassesSet.add(subclass);
          }
        }
      }

      featuresList.push({
        ...feat,
        level: al.level,
        subclass: subclass
      });
    });
  });

  return {
    name: className,
    hd: parseInt(getChildText(element, 'hd')) || 8,
    spellAbility: getChildText(element, 'spellAbility'),
    slotsReset: getChildText(element, 'slotsReset'),
    wealth: getChildText(element, 'wealth'),
    proficiency: getChildText(element, 'proficiency'),
    armor: getChildText(element, 'armor'),
    weapons: getChildText(element, 'weapons'),
    tools: getChildText(element, 'tools'),
    numSkills: parseInt(getChildText(element, 'numSkills')) || 0,
    subclasses: Array.from(subclassesSet),
    features: featuresList,
    slotsTable: autolevels.map(al => ({ level: al.level, slots: al.slots })).filter(al => al.slots)
  };
}

export function parseFeat(element) {
  // Categorize feat based on name and prerequisites
  const name = getChildText(element, 'name');
  const prerequisite = getChildText(element, 'prerequisite');
  
  let category = 'Standard';
  if (name.startsWith('Origin:')) {
    category = 'Origin';
  } else if (name.startsWith('Fighting Style:')) {
    category = 'Fighting Style';
  } else if (name.startsWith('Boon of') || prerequisite.includes('Level 19')) {
    category = 'Epic Boon';
  }

  return {
    name: name,
    prerequisite: prerequisite,
    category: category,
    texts: getChildTexts(element, 'text'),
    proficiency: getChildText(element, 'proficiency'),
    modifiers: getChildElements(element, 'modifier').map(m => ({
      category: m.getAttribute('category') || '',
      value: m.textContent.trim()
    }))
  };
}

export function parseBackground(element) {
  return {
    name: getChildText(element, 'name'),
    proficiency: getChildText(element, 'proficiency'),
    tools: getChildText(element, 'tools'),
    languages: getChildText(element, 'languages'),
    texts: getChildTexts(element, 'text'),
    traits: getChildElements(element, 'trait').map(parseTrait)
  };
}

export function parseRace(element) {
  return {
    name: getChildText(element, 'name'),
    size: MONSTER_SIZES[getChildText(element, 'size')] || getChildText(element, 'size') || 'Medium',
    speed: parseInt(getChildText(element, 'speed')) || 30,
    proficiency: getChildText(element, 'proficiency'),
    spellAbility: getChildText(element, 'spellAbility'),
    ability: getChildText(element, 'ability'),
    languages: getChildText(element, 'languages'),
    traits: getChildElements(element, 'trait').map(parseTrait)
  };
}

// Parses a complete XML string and returns arrays of categorized records
export function parseCompendiumXML(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const result = {
    spells: [],
    items: [],
    monsters: [],
    classes: [],
    feats: [],
    backgrounds: [],
    races: []
  };

  const compendiumNode = xmlDoc.getElementsByTagName('compendium')[0];
  if (!compendiumNode) {
    throw new Error('Invalid XML: No <compendium> root element found.');
  }

  for (let i = 0; i < compendiumNode.childNodes.length; i++) {
    const node = compendiumNode.childNodes[i];
    if (node.nodeType !== 1) continue; // skip text/comment nodes

    switch (node.nodeName) {
      case 'spell':
        result.spells.push(parseSpell(node));
        break;
      case 'item':
        result.items.push(parseItem(node));
        break;
      case 'monster':
        result.monsters.push(parseMonster(node));
        break;
      case 'class':
        result.classes.push(parseClass(node));
        break;
      case 'feat':
        result.feats.push(parseFeat(node));
        break;
      case 'background':
        result.backgrounds.push(parseBackground(node));
        break;
      case 'race':
        result.races.push(parseRace(node));
        break;
    }
  }

  return result;
}
