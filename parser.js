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

function getRequiredLevel(name, texts) {
  const nameMatch = name.match(/\(Level\s+(\d+)\+?\)/i);
  if (nameMatch) {
    return parseInt(nameMatch[1]);
  }
  const fullText = (texts || []).join('\n');
  const lvlPlusMatch = fullText.match(/Level\s+(\d+)\+/i);
  if (lvlPlusMatch) {
    return parseInt(lvlPlusMatch[1]);
  }
  const thLevelMatch = fullText.match(/(\d+)(?:st|nd|rd|th)\s+level/i);
  if (thLevelMatch) {
    return parseInt(thLevelMatch[1]);
  }
  const prereqLvlMatch = fullText.match(/Prerequisite:\s*(?:Level\s*)?(\d+)/i);
  if (prereqLvlMatch) {
    return parseInt(prereqLvlMatch[1]);
  }
  return 0;
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

const LEGACY_TARGET_MAP = {
  'strength': 'str',
  'dexterity': 'dex',
  'constitution': 'con',
  'intelligence': 'int',
  'wisdom': 'wis',
  'charisma': 'cha',
  'strength score': 'str',
  'dexterity score': 'dex',
  'constitution score': 'con',
  'intelligence score': 'int',
  'wisdom score': 'wis',
  'charisma score': 'cha',
  'strength save': 'save.str',
  'dexterity save': 'save.dex',
  'constitution save': 'save.con',
  'intelligence save': 'save.int',
  'wisdom save': 'save.wis',
  'charisma save': 'save.cha',
  'saving throws': 'save.all',
  'athletics': 'skill.athletics',
  'acrobatics': 'skill.acrobatics',
  'sleight of hand': 'skill.sleight_of_hand',
  'stealth': 'skill.stealth',
  'arcana': 'skill.arcana',
  'history': 'skill.history',
  'investigation': 'skill.investigation',
  'nature': 'skill.nature',
  'religion': 'skill.religion',
  'animal handling': 'skill.animal_handling',
  'insight': 'skill.insight',
  'medicine': 'skill.medicine',
  'perception': 'skill.perception',
  'survival': 'skill.survival',
  'deception': 'skill.deception',
  'intimidation': 'skill.intimidation',
  'performance': 'skill.performance',
  'persuasion': 'skill.persuasion',
  'passive perception': 'passive.perception',
  'passive investigation': 'passive.investigation',
  'passive insight': 'passive.insight',
  'hp': 'hp.max',
  'hit points': 'hp.max',
  'ac': 'ac',
  'armor class': 'ac',
  'speed': 'speed',
  'initiative': 'initiative',
  'proficiency bonus': 'prof_bonus',
  'melee damage': 'melee.damage',
  'melee attacks': 'melee.attack',
  'weapon damage': 'melee.damage',
  'weapon attacks': 'melee.attack',
  'ranged damage': 'ranged.damage',
  'ranged attacks': 'ranged.attack',
  'spell attack': 'spell.attack',
  'spell dc': 'spell.dc'
};

function parseLegacyModifierText(category, textVal) {
  const match = textVal.match(/^([\w\s]+?)\s*([+-]?)\s*(\d+|%[0-9]+|prof)$/i);
  if (!match) return null;
  
  const rawTarget = match[1].toLowerCase().trim();
  const sign = match[2];
  let val = match[3];
  
  if (sign === '-') {
    val = `-${val}`;
  }
  
  let targetKey = LEGACY_TARGET_MAP[rawTarget] || rawTarget;
  if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(targetKey)) {
    if (category === 'ability modifier') {
      targetKey = `${targetKey}.mod`;
    } else {
      targetKey = `${targetKey}.score`;
    }
  }
  
  let modType = 'add';
  if (category === 'set') {
    modType = 'set';
  }
  
  return {
    target: targetKey,
    type: modType,
    value: val
  };
}

function parseEngineModifiers(element) {
  const modifiers = [];
  
  // 1. Prioritize new <engine_modifier> tags
  const engineMods = getChildElements(element, 'engine_modifier');
  if (engineMods.length > 0) {
    engineMods.forEach(em => {
      modifiers.push({
        target: em.getAttribute('target') || '',
        type: em.getAttribute('type') || 'add',
        value: em.getAttribute('value') || ''
      });
    });
  } else {
    // 2. Fallback to legacy <modifier> tags
    const legacyMods = getChildElements(element, 'modifier');
    legacyMods.forEach(m => {
      const category = m.getAttribute('category') || '';
      const typeAttr = m.getAttribute('type') || '';
      const textVal = m.textContent.trim();
      
      if (typeAttr) {
        const normType = typeAttr.toLowerCase().trim();
        let targetKey = LEGACY_TARGET_MAP[normType] || normType;
        if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(targetKey)) {
          if (category === 'ability modifier') {
            targetKey = `${targetKey}.mod`;
          } else {
            targetKey = `${targetKey}.score`;
          }
        }
        
        let modType = 'add';
        if (category === 'set') {
          modType = 'set';
        } else if (category === 'ignore') {
          modType = 'ignore';
        }
        
        modifiers.push({
          target: targetKey,
          type: modType,
          value: textVal
        });
      } else {
        const parsed = parseLegacyModifierText(category, textVal);
        if (parsed) {
          modifiers.push(parsed);
        }
      }
    });
  }
  
  return modifiers;
}

function subclassFromRel(rel) {
  if (!rel || !rel.startsWith('subclass.')) return null;
  const parts = rel.substring(9).split(/[_-]/);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function getAutolevelSubclass(al, className) {
  if (al.rel && al.rel.startsWith('subclass.')) {
    return subclassFromRel(al.rel);
  }
  
  for (const c of al.counters) {
    if (c.subclass) {
      const sub = c.subclass.trim();
      if (sub.toLowerCase() !== className.toLowerCase()) {
        return sub;
      }
    }
  }
  
  for (const feat of al.features) {
    const subDefMatch = feat.name.match(/Subclass:\s*(.+)$/i);
    if (subDefMatch) {
      const possibleSub = subDefMatch[1].trim();
      if (possibleSub.toLowerCase() !== className.toLowerCase()) {
        return possibleSub;
      }
    }
    
    const archetypeMatch = feat.name.match(/(?:Martial Archetype|Primal Path|Divine Domain|Bard College|Druid Circle|Monastic Tradition|Sacred Oath|Ranger Archetype|Roguish Archetype|Sorcerous Origin|Otherworldly Patron|Arcane Tradition):\s*(.+)$/i);
    if (archetypeMatch) {
      const possibleSub = archetypeMatch[1].trim();
      if (possibleSub.toLowerCase() !== className.toLowerCase()) {
        return possibleSub;
      }
    }
    
    const possibleSub = extractParenthesizedSuffix(feat.name);
    if (possibleSub) {
      if (possibleSub.toLowerCase() !== className.toLowerCase()) {
        return possibleSub;
      }
    }
  }
  
  return null;
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
    modifiers: parseEngineModifiers(element),
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
    modifiers: parseEngineModifiers(element),
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
    const rel = a.getAttribute('rel') || '';
    const optional = a.getAttribute('optional') === 'YES' || getChildText(a, 'optional') === 'true';
    
    const features = getChildElements(a, 'feature').map(f => {
      const fName = getChildText(f, 'name');
      return {
        name: fName,
        texts: getChildTexts(f, 'text'),
        special: getChildText(f, 'special'),
        optional: f.getAttribute('optional') === 'YES',
        modifiers: parseEngineModifiers(f)
      };
    });
    
    const slots = getChildText(a, 'slots');
    
    const parseCounterEl = c => ({
      name: getChildText(c, 'name'),
      value: getChildText(c, 'value'),
      reset: getChildText(c, 'reset'),
      subclass: getChildText(c, 'subclass'),
      rel: c.getAttribute('rel') || ''
    });
    const counters = [
      ...getChildElements(a, 'counter').map(parseCounterEl),
      ...getChildElements(a, 'usage_counter').map(parseCounterEl)
    ];

    return { level, features, slots, counters, rel, optional };
  });

  // Extract subclasses list and tag subclass features
  const subclassesSet = new Set();
  const subclassAutolevelsMap = {};
  const baseAutolevels = [];
  const featuresList = [];

  autolevels.forEach(al => {
    const subName = getAutolevelSubclass(al, className);
    
    if (subName) {
      subclassesSet.add(subName);
      if (!subclassAutolevelsMap[subName]) {
        subclassAutolevelsMap[subName] = [];
      }
      subclassAutolevelsMap[subName].push(al);
    } else {
      baseAutolevels.push(al);
    }

    // Still populate featuresList for backward compatibility in UI rendering!
    al.features.forEach(feat => {
      let featureSubclass = subName || null;
      if (!featureSubclass) {
        const subMatch = feat.name.match(/Subclass:\s*(.+)$/i) || 
                         feat.name.match(/(?:Martial Archetype|Primal Path|Divine Domain|Bard College|Druid Circle|Monastic Tradition|Sacred Oath|Ranger Archetype|Roguish Archetype|Sorcerous Origin|Otherworldly Patron|Arcane Tradition):\s*(.+)$/i);
        if (subMatch) {
          featureSubclass = subMatch[1].trim();
        } else {
          featureSubclass = extractParenthesizedSuffix(feat.name);
        }
        if (featureSubclass && featureSubclass.toLowerCase() === className.toLowerCase()) {
          featureSubclass = null;
        }
      }

      if (featureSubclass) {
        subclassesSet.add(featureSubclass);
      }

      featuresList.push({
        ...feat,
        level: al.level,
        subclass: featureSubclass
      });
    });
  });

  // Construct subclass entities
  const subclassEntities = Array.from(subclassesSet).map(subName => {
    return {
      name: subName,
      parentClass: className,
      autolevels: subclassAutolevelsMap[subName] || []
    };
  });

  return {
    classRecord: {
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
      traits: getChildElements(element, 'trait').map(parseTrait),
      autolevels: baseAutolevels,
      slotsTable: autolevels.map(al => ({ level: al.level, slots: al.slots })).filter(al => al.slots)
    },
    subclassRecords: subclassEntities
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
    modifiers: parseEngineModifiers(element)
  };
}

export function parseBackground(element) {
  return {
    name: getChildText(element, 'name'),
    proficiency: getChildText(element, 'proficiency'),
    tools: getChildText(element, 'tools'),
    languages: getChildText(element, 'languages'),
    texts: getChildTexts(element, 'text'),
    traits: getChildElements(element, 'trait').map(parseTrait),
    modifiers: parseEngineModifiers(element)
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
    traits: getChildElements(element, 'trait').map(parseTrait),
    modifiers: parseEngineModifiers(element)
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
    subclasses: [],
    feats: [],
    backgrounds: [],
    races: [],
    options: []
  };

  const compendiumNode = xmlDoc.getElementsByTagName('compendium')[0];
  if (!compendiumNode) {
    throw new Error('Invalid XML: No <compendium> root element found.');
  }

  const optionClassesMap = {
    "eldritch invocations": "Eldritch Invocations",
    "fighter (rune knight)": "Rune Knight Runes",
    "magic item plans": "Magic Item Plans",
    "maneuver options": "Maneuver Options",
    "metamagic options": "Metamagic Options"
  };

  for (let i = 0; i < compendiumNode.childNodes.length; i++) {
    const node = compendiumNode.childNodes[i];
    if (node.nodeType !== 1) continue; // skip text/comment nodes

    switch (node.nodeName) {
      case 'spell': {
        const parsedSpell = parseSpell(node);
        let isOption = false;
        
        parsedSpell.classes = parsedSpell.classes.map(c => {
          const lowerC = c.toLowerCase().trim();
          if (optionClassesMap[lowerC]) {
            isOption = true;
            return optionClassesMap[lowerC];
          }
          return c;
        });

        if (isOption) {
          const reqLevel = getRequiredLevel(parsedSpell.name, parsedSpell.texts);
          parsedSpell.level = reqLevel;
          parsedSpell.requiredLevel = reqLevel;
          result.options.push(parsedSpell);
        } else {
          result.spells.push(parsedSpell);
        }
        break;
      }
      case 'item':
        result.items.push(parseItem(node));
        break;
      case 'monster':
        result.monsters.push(parseMonster(node));
        break;
      case 'class': {
        const parsed = parseClass(node);
        result.classes.push(parsed.classRecord);
        if (parsed.subclassRecords && parsed.subclassRecords.length > 0) {
          result.subclasses.push(...parsed.subclassRecords);
        }
        break;
      }
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
