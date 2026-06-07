// parser-5etools.js — Ingestion Adapter for 5eTools JSON format

// Mappings for 5eTools Abbreviations
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
  '$': 'Money',
  'SCF': 'Spellcasting Focus',
  'INS': 'Musical Instrument',
  'TAH': 'Tack and Harness',
  'TG': 'Trade Goods',
  'EXP': 'Explosive',
  'CUR': 'Currency',
  'T': 'Tools',
  'SA': 'Special Ability',
  'SG': 'Supernatural Gift',
  'AF': 'Ammunition (Futuristic)',
  'AIR': 'Vehicle (Air)',
  'AT': "Artisan's Tools",
  'FD': 'Food and Drink',
  'GS': 'Gaming Set',
  'MNT': 'Mount',
  'SHP': 'Vehicle (Water)',
  'SPC': 'Vehicle (Space)',
  'VEH': 'Vehicle (Land)',
  'TB': 'Trade Bar',
  'OTH': 'Other',
  'GV': 'Generic Variant',
  'IDG': 'Illegal Drug',
  '$A': 'Treasure (Art Object)',
  '$C': 'Treasure (Coinage)',
  '$G': 'Treasure (Gemstone)'
};

export const SPELL_SCHOOLS = {
  'A': 'Abjuration',
  'C': 'Conjuration',
  'D': 'Divination',
  'E': 'Enchantment',
  'EN': 'Enchantment',
  'V': 'Evocation',
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

// ─── Text Parsing & Markdown Generation ──────────────────────────────────────

/**
 * Strips 5eTools formatting tags and cleans them to plain readable text,
 * or optionally converts standard tags to internal Markdown links.
 * Example: {@spell Air Bubble} -> "[Air Bubble](?category=spells&item=Air+Bubble)"
 */
export function parse5etoolsText(text, keepPlain = true) {
  if (typeof text !== 'string') return text;
  
  // Format standard tags: {@tag value|source|label} or {@tag value}
  return text.replace(/\{@([a-z0-9]+) ([^}]+)\}/gi, (match, tag, contents) => {
    const parts = contents.split('|');
    let label = parts[0];
    
    const catMap = {
      'spell': 'spells',
      'item': 'items',
      'monster': 'monsters',
      'feat': 'feats',
      'background': 'backgrounds',
      'race': 'races',
      'class': 'classes',
      'optfeature': 'options',
      'optionalfeature': 'options'
    };
    
    // Spell/item/monster tag links can have label as third item
    if (['spell', 'item', 'monster', 'feat', 'condition', 'background', 'race', 'class', 'subclass', 'optfeature', 'optionalfeature'].includes(tag)) {
      label = parts[2] || parts[0];
      if (!keepPlain && catMap[tag]) {
        const cat = catMap[tag];
        let itemQuery = parts[0];
        if (tag === 'class') {
          itemQuery = parts[0] + ' Overview';
        }
        const encoded = encodeURIComponent(itemQuery).replace(/%20/g, '+');
        return `[${label}](?category=${cat}&item=${encoded})`;
      }
    } else if (tag === 'dice' || tag === 'damage') {
      label = parts[1] || parts[0];
    } else if (tag === 'bold' || tag === 'b') {
      return `**${parts[0]}**`;
    } else if (tag === 'italic' || tag === 'i') {
      return `*${parts[0]}*`;
    } else if (tag === 'filter') {
      label = parts[0];
    }
    
    return label;
  });
}

/**
 * Parses recursive entries arrays from 5eTools format into markdown string lines.
 */
export function render5etoolsEntries(entries, keepPlain = false) {
  if (entries === undefined || entries === null) return [];
  if (typeof entries === 'string') return [parse5etoolsText(entries, keepPlain)];
  if (Array.isArray(entries)) {
    return entries.flatMap(e => render5etoolsEntries(e, keepPlain));
  }
  if (typeof entries === 'object') {
    if (entries.type === 'list') {
      return (entries.items || []).flatMap(item => {
        const itemLines = render5etoolsEntries(item, keepPlain);
        if (itemLines.length > 0) {
          return [`* ${itemLines[0]}`, ...itemLines.slice(1).map(l => `  ${l}`)];
        }
        return [];
      });
    }
    if (entries.type === 'table') {
      const colLabels = entries.colLabels || [];
      const rows = entries.rows || [];
      const lines = [];
      if (entries.caption) {
        lines.push(`**${parse5etoolsText(entries.caption, keepPlain)}**`);
      }
      lines.push(colLabels.map(l => parse5etoolsText(l, keepPlain)).join(' | '));
      lines.push(colLabels.map(() => '---').join(' | '));
      rows.forEach(row => {
        const parsedRow = row.map(cell => render5etoolsEntries(cell, keepPlain).join(' '));
        lines.push(parsedRow.join(' | '));
      });
      return lines;
    }
    if (entries.type === 'entries') {
      const header = entries.name ? `### ${parse5etoolsText(entries.name, true)}` : '';
      const content = render5etoolsEntries(entries.entries, keepPlain);
      return header ? [header, ...content] : content;
    }
    // 'section' is a wrapper like 'entries' but typically without a prominent name
    if (entries.type === 'section') {
      const header = entries.name ? `### ${parse5etoolsText(entries.name, true)}` : '';
      const content = render5etoolsEntries(entries.entries, keepPlain);
      return header ? [header, ...content] : content;
    }
    if (entries.type === 'quote') {
      return render5etoolsEntries(entries.entries, keepPlain).map(l => `> ${l}`);
    }
    if (entries.type === 'inset' || entries.type === 'insetReadaloud') {
      const header = entries.name ? `**${parse5etoolsText(entries.name, true)}**` : '';
      const content = render5etoolsEntries(entries.entries, keepPlain).map(l => `  ${l}`);
      return header ? [header, ...content] : content;
    }
    // 'item' type = definition-list entry: {type:'item', name:'Term', entry:'...', entries:[...]}
    if (entries.type === 'item') {
      const nameStr = entries.name ? `**${parse5etoolsText(entries.name, true)}**` : '';
      // 'entry' (singular) or 'entries' (array) can both appear
      const body = entries.entries
        ? render5etoolsEntries(entries.entries, keepPlain)
        : entries.entry
          ? [parse5etoolsText(String(entries.entry), keepPlain)]
          : [];
      if (nameStr && body.length > 0) {
        return [`${nameStr}. ${body[0]}`, ...body.slice(1)];
      }
      return nameStr ? [nameStr, ...body] : body;
    }
  }
  return [];
}

// ─── Ingestion Normalization Mappers ─────────────────────────────────────────

export const sourceRanksRegistry = {
  'XPHB': 1726531200000,
  'XDMG': 1730160000000,
  'XMM': 1739836800000,
  'PHB': 1408406400000,
  'DMG': 1418083200000,
  'MM': 1411084800000
};

export function getSourceRank(source) {
  if (!source) return 0;
  const src = source.toUpperCase();
  if (sourceRanksRegistry[src] !== undefined) {
    return sourceRanksRegistry[src];
  }
  // Default fallback rank (e.g. 2015-01-01) which sits between 2014 core and 2024 core
  return 1420070400000;
}

export function parse5etoolsSpell(spell, source, lookup = null, activeSources = null) {
  const schoolAbbrev = spell.school;
  const school = SPELL_SCHOOLS[schoolAbbrev] || schoolAbbrev || 'Unknown';
  
  // Time
  let timeStr = '1 action';
  if (spell.time && spell.time.length > 0) {
    const t = spell.time[0];
    timeStr = `${t.number} ${t.unit}${t.number > 1 ? 's' : ''}`;
    if (t.condition) timeStr += ` (${parse5etoolsText(t.condition)})`;
  }

  // Range
  let rangeStr = 'Self';
  if (spell.range) {
    if (spell.range.type === 'touch' || (spell.range.distance && spell.range.distance.type === 'touch')) {
      rangeStr = 'Touch';
    } else if (spell.range.type === 'point' && spell.range.distance) {
      if (spell.range.distance.amount !== undefined) {
        rangeStr = `${spell.range.distance.amount} ${spell.range.distance.type}`;
      } else {
        rangeStr = spell.range.distance.type;
        if (typeof rangeStr === 'string' && rangeStr.length > 0) {
          rangeStr = rangeStr.charAt(0).toUpperCase() + rangeStr.slice(1);
        }
      }
    } else if (spell.range.type === 'special') {
      rangeStr = 'Special';
    } else if (spell.range.type === 'cone' && spell.range.distance) {
      rangeStr = `Self (${spell.range.distance.amount}-foot cone)`;
    } else if (spell.range.type === 'line' && spell.range.distance) {
      rangeStr = `Self (${spell.range.distance.amount}-foot line)`;
    } else if (spell.range.type === 'sphere' && spell.range.distance) {
      rangeStr = `Self (${spell.range.distance.amount}-foot sphere)`;
    }
  }

  // Components
  let compStr = '';
  if (spell.components) {
    const c = spell.components;
    const comps = [];
    if (c.v) comps.push('V');
    if (c.s) comps.push('S');
    if (c.m) {
      comps.push(`M (${parse5etoolsText(typeof c.m === 'object' ? c.m.text : c.m)})`);
    }
    compStr = comps.join(', ');
  }

  // Duration
  let durStr = 'Instantaneous';
  if (spell.duration && spell.duration.length > 0) {
    const d = spell.duration[0];
    if (d.type === 'instant') {
      durStr = 'Instantaneous';
    } else if (d.type === 'timed' && d.duration) {
      durStr = `${d.concentration ? 'Concentration, up to ' : ''}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
    } else if (d.type === 'permanent') {
      durStr = 'Permanent';
    } else if (d.type === 'special') {
      durStr = 'Special';
    }
  }

  // Classes list
  let classesList = [];
  if (lookup) {
    const spellSource = (spell.source || source || '').toLowerCase();
    const spellName = (spell.name || '').toLowerCase();
    let spellEntry = lookup[spellSource]?.[spellName];
    if (!spellEntry) {
      for (const src in lookup) {
        if (lookup[src]?.[spellName]) {
          spellEntry = lookup[src][spellName];
          break;
        }
      }
    }
    if (spellEntry) {
      const classesSet = new Set();
      // Parse main classes
      if (spellEntry.class) {
        for (const [classSource, classMap] of Object.entries(spellEntry.class)) {
          if (activeSources && !activeSources.includes(classSource.toUpperCase())) continue;
          Object.keys(classMap).forEach(clsName => classesSet.add(clsName));
        }
      }
      // Parse variant classes
      if (spellEntry.classVariant) {
        for (const [variantSource, classMap] of Object.entries(spellEntry.classVariant)) {
          if (activeSources && !activeSources.includes(variantSource.toUpperCase())) continue;
          Object.keys(classMap).forEach(clsName => classesSet.add(clsName));
        }
      }
      // Parse subclasses
      if (spellEntry.subclass) {
        const subclassHighestRank = {};
        for (const [classVersionSource, parentClassMap] of Object.entries(spellEntry.subclass)) {
          if (activeSources && !activeSources.includes(classVersionSource.toUpperCase())) continue;
          
          for (const [parentClass, classSourceMap] of Object.entries(parentClassMap)) {
            for (const [subclassSource, subclassMap] of Object.entries(classSourceMap)) {
              if (activeSources && !activeSources.includes(subclassSource.toUpperCase())) continue;
              
              for (const [subclassShort, subclassObj] of Object.entries(subclassMap)) {
                const subName = subclassObj.name || subclassShort;
                const subclassKey = `${parentClass} (${subName})`;
                const rank = getSourceRank(subclassSource);
                
                if (!subclassHighestRank[subclassKey] || rank > subclassHighestRank[subclassKey].rank) {
                  subclassHighestRank[subclassKey] = { rank, value: subclassKey };
                }
              }
            }
          }
        }
        Object.values(subclassHighestRank).forEach(item => {
          classesSet.add(item.value);
        });
      }
      classesList = Array.from(classesSet).sort();
    }
  }

  // Fallback to inline classes if classesList is still empty
  if (classesList.length === 0 && spell.classes) {
    const classesSet = new Set();
    if (spell.classes.fromClassList) {
      spell.classes.fromClassList.forEach(c => {
        if (activeSources && c.source && !activeSources.includes(c.source)) return;
        classesSet.add(c.name);
      });
    }
    if (spell.classes.fromSubclassList) {
      spell.classes.fromSubclassList.forEach(sc => {
        const parentClass = sc.class?.name || '';
        const subName = sc.subclass?.name || sc.subclass?.shortName || '';
        const subSource = sc.subclass?.source || '';
        if (activeSources && subSource && !activeSources.includes(subSource)) return;
        if (parentClass && subName) {
          classesSet.add(`${parentClass} (${subName})`);
        } else if (subName) {
          classesSet.add(subName);
        }
      });
    }
    classesList = Array.from(classesSet).sort();
  }

  const isConcentration = !!(spell.duration && spell.duration[0]?.concentration);

  return {
    name: spell.name,
    level: spell.level,
    school: school,
    ritual: !!spell.meta?.ritual,
    isConcentration,
    time: timeStr,
    range: rangeStr,
    components: compStr,
    duration: durStr,
    classes: classesList,
    source: spell.source || source,
    // Include the main description and the "At Higher Levels" / upcast section (entriesHigherLevel)
    texts: [
      ...render5etoolsEntries(spell.entries),
      ...render5etoolsEntries(spell.entriesHigherLevel || []),
    ],
    rolls: [],
    modifiers: []
  };
}

export function parse5etoolsItem(item, source) {
  let typeAbbrev = item.type || '';
  if (typeAbbrev.includes('|')) {
    typeAbbrev = typeAbbrev.split('|')[0];
  }
  const type = ITEM_TYPES[typeAbbrev] || typeAbbrev || 'Wondrous Item';
  
  // Rarity string
  const rarity = item.rarity || '';
  
  // Weight & Value
  const weight = item.weight || 0;
  // 5eTools values are in copper pieces (cp), need to convert to gold (gp)
  const value = item.value ? item.value / 100 : 0;

  // AC benefit
  let ac = null;
  if (item.ac) {
    ac = parseInt(item.ac) || null;
  }

  // Weapon details
  let dmg1 = '';
  let dmg2 = '';
  let dmgType = '';
  let propertyStr = '';

  if (item.dmg1) dmg1 = item.dmg1;
  if (item.dmg2) dmg2 = item.dmg2;
  if (item.dmgType) dmgType = DAMAGE_TYPES[item.dmgType] || item.dmgType;
  
  if (item.property && Array.isArray(item.property)) {
    propertyStr = item.property.join(', ');
  }
  // Structured properties array (abbreviations, e.g. ['F', 'L', 'T'])
  const properties = Array.isArray(item.property)
    ? item.property.map(p => (typeof p === 'string' ? p.split('|')[0] : p))
    : [];

  // Range
  let rangeStr = '';
  if (item.range) {
    rangeStr = item.range;
  }

  const parsed = {
    name: item.name,
    detail: rarity,
    type: type,
    magic: !!item.magic || ['uncommon', 'rare', 'very rare', 'legendary', 'artifact'].includes(rarity.toLowerCase()),
    weight: weight,
    value: value,
    ac: ac,
    strength: item.strength ? parseInt(item.strength) : null,
    stealth: !!item.stealth,
    dmg1: dmg1,
    dmg2: dmg2,
    dmgType: dmgType,
    property: propertyStr,
    range: rangeStr,
    texts: render5etoolsEntries(item.entries),
    modifiers: [], // Modifiers will be extracted dynamically at runtime by engine.js
    source: item.source || source,

    // Raw/Variant matching properties
    rawType: item.type || '',
    armor: !!item.armor || ['LA', 'MA', 'HA'].includes(typeAbbrev),
    weapon: !!item.weapon || ['M', 'R'].includes(typeAbbrev),
    shield: typeAbbrev === 'S' || !!item.shield,
    ammo: typeAbbrev === 'A' || !!item.ammo,
    // Armor type for AC calculation in the TypeScript engine
    armorType: ['LA', 'MA', 'HA', 'S'].includes(typeAbbrev) ? typeAbbrev : (item.armorType || null),
    // Structured weapon property abbreviations (e.g. ['F', 'L', 'T'])
    properties
  };

  // Copy other flags (like club, dagger, net, weaponCategory, etc.)
  for (const k in item) {
    if (!(k in parsed)) {
      parsed[k] = item[k];
    }
  }

  return parsed;
}

export function parse5etoolsMonster(monster, source) {
  const size = MONSTER_SIZES[monster.size] || monster.size || 'Medium';
  
  // Skill & Save summaries
  let saveStr = '';
  if (monster.save) {
    saveStr = Object.entries(monster.save)
      .map(([k, v]) => `${k.toUpperCase()} ${v}`)
      .join(', ');
  }

  let skillStr = '';
  if (monster.skill) {
    skillStr = Object.entries(monster.skill)
      .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`)
      .join(', ');
  }

  // Traits parsing helper
  const mapTraits = (list) => {
    if (!list) return [];
    return list.map(t => ({
      name: t.name,
      texts: render5etoolsEntries(t.entries),
      recharge: t.recharge || ''
    }));
  };

  // AC formatting
  let acStr = '10';
  if (monster.ac && monster.ac.length > 0) {
    const firstAc = monster.ac[0];
    acStr = typeof firstAc === 'object' ? `${firstAc.ac}` : `${firstAc}`;
  }

  // HP formatting
  let hpStr = '10';
  if (monster.hp) {
    hpStr = `${monster.hp.average || 10} (${monster.hp.formula || '2d8'})`;
  }

  // Speed formatting
  let speedStr = '30 ft.';
  if (monster.speed) {
    if (typeof monster.speed === 'object') {
      speedStr = Object.entries(monster.speed)
        .map(([k, v]) => `${k} ${v} ft.`)
        .join(', ');
    } else {
      speedStr = `${monster.speed}`;
    }
  }

  return {
    name: monster.name,
    size: size,
    type: typeof monster.type === 'object' ? monster.type.type : monster.type || 'monstrosity',
    alignment: monster.alignment ? monster.alignment.join(', ') : 'any alignment',
    ac: acStr,
    hp: hpStr,
    speed: speedStr,
    init: null,
    str: monster.str || 10,
    dex: monster.dex || 10,
    con: monster.con || 10,
    int: monster.int || 10,
    wis: monster.wis || 10,
    cha: monster.cha || 10,
    save: saveStr,
    skill: skillStr,
    vulnerable: monster.vulnerable ? monster.vulnerable.join(', ') : '',
    resist: monster.resist ? monster.resist.join(', ') : '',
    immune: monster.immune ? monster.immune.join(', ') : '',
    conditionImmune: monster.conditionImmune ? monster.conditionImmune.join(', ') : '',
    senses: monster.senses ? monster.senses.join(', ') : '',
    passive: monster.passive || 10,
    languages: monster.languages ? monster.languages.join(', ') : '',
    cr: monster.cr ? (typeof monster.cr === 'object' ? monster.cr.cr : monster.cr) : '0',
    traits: mapTraits(monster.trait),
    actions: mapTraits(monster.action),
    reactions: mapTraits(monster.reaction),
    legendary: mapTraits(monster.legendary),
    spells: '',
    description: monster.entries ? render5etoolsEntries(monster.entries).join('\n') : '',
    environment: monster.environment ? monster.environment.join(', ') : '',
    source: monster.source || source
  };
}

export function parse5etoolsFeat(feat, source) {
  let prereq = '';
  if (feat.prerequisite && Array.isArray(feat.prerequisite)) {
    prereq = feat.prerequisite.map(p => {
      if (p.other) return p.other;
      if (p.ability) {
        return Object.entries(p.ability[0]).map(([k, v]) => `${k.toUpperCase()} ${v}+`).join(' or ');
      }
      if (p.level) return `Level ${p.level}`;
      return '';
    }).filter(Boolean).join(', ');
  }

  let category = 'Standard';
  if (feat.category === 'EB' || (feat.prerequisite && feat.prerequisite.some(p => p.level === 19))) {
    category = 'Epic Boon';
  } else if (feat.category === 'FS' || (feat.category && feat.category.startsWith('FS'))) {
    category = 'Fighting Style';
  } else if (feat.category === 'OR' || feat.category === 'O') {
    category = 'Origin';
  } else if (feat.category === 'G') {
    category = 'General';
  }

  return {
    name: feat.name,
    prerequisite: prereq,
    category: category,
    texts: render5etoolsEntries(feat.entries),
    proficiency: '',
    modifiers: [],
    additionalSpells: feat.additionalSpells || null,
    source: feat.source || source
  };
}

// Helper: parse ability array [{str:2}, {choose:{from:[...], count:1}}] -> human string
function parseAbilityArray(abilityArr) {
  if (!abilityArr || !Array.isArray(abilityArr)) return '';
  const ATTR_NAMES = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' };
  const parts = [];
  for (const entry of abilityArr) {
    if (entry.choose) {
      const weighted = entry.choose.weighted;
      if (weighted) {
        const attrs = (weighted.from || []).map(a => ATTR_NAMES[a] || a).join(', ');
        const weights = weighted.weights || [];
        if (weights.length > 0) {
          // e.g. weights [2,1] means +2 to one, +1 to another from the same pool
          const maxW = Math.max(...weights);
          const minW = Math.min(...weights.filter(w => w > 0));
          if (maxW === minW) {
            parts.push(`+${maxW} to one of: ${attrs}`);
          } else {
            parts.push(`+${maxW}/+${minW} distributed among: ${attrs}`);
          }
        } else {
          const count = entry.choose.count || 1;
          parts.push(`+1 to ${count} of: ${attrs}`);
        }
      } else if (entry.choose.from) {
        const attrs = entry.choose.from.map(a => ATTR_NAMES[a] || a).join(', ');
        const count = entry.choose.count || 1;
        parts.push(`+1 to ${count} of: ${attrs}`);
      } else {
        parts.push('Choose an ability score increase');
      }
    } else {
      // Fixed bonuses like {str:2, dex:1}
      for (const [k, v] of Object.entries(entry)) {
        if (ATTR_NAMES[k] && v) {
          parts.push(`${v > 0 ? '+' : ''}${v} ${ATTR_NAMES[k]}`);
        }
      }
    }
  }
  return parts.join('; ');
}

// Helper: parse languageProficiencies [{common:true, elvish:true, anyStandard:1}] -> string
function parseLanguageProficiencies(langArr) {
  if (!langArr || !Array.isArray(langArr)) return '';
  const langs = [];
  for (const entry of langArr) {
    for (const [k, v] of Object.entries(entry)) {
      if (!v) continue;
      if (k === 'anyStandard') {
        langs.push(`${v} standard language${v > 1 ? 's' : ''} of your choice`);
      } else if (k === 'any') {
        langs.push(`${v} language${v > 1 ? 's' : ''} of your choice`);
      } else if (k === 'other') {
        langs.push('one additional language of your choice');
      } else {
        langs.push(k.charAt(0).toUpperCase() + k.slice(1));
      }
    }
  }
  return langs.join(', ');
}

// Helper: parse skillProficiencies [{insight:true, religion:true}] -> string
function parseSkillProficiencies(skillArr) {
  if (!skillArr || !Array.isArray(skillArr)) return '';
  const skills = [];
  for (const entry of skillArr) {
    for (const [k, v] of Object.entries(entry)) {
      if (!v) continue;
      if (k === 'choose') {
        const from = (entry.choose?.from || []).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
        const count = entry.choose?.count || 1;
        skills.push(`Choose ${count} from: ${from}`);
      } else if (k === 'any') {
        skills.push(`${v} skill${v > 1 ? 's' : ''} of your choice`);
      } else {
        skills.push(k.charAt(0).toUpperCase() + k.slice(1));
      }
    }
  }
  return skills.join(', ');
}

// Helper: parse toolProficiencies [{"calligrapher's supplies":true}] -> string
function parseToolProficiencies(toolArr) {
  if (!toolArr || !Array.isArray(toolArr)) return '';
  const tools = [];
  for (const entry of toolArr) {
    for (const [k, v] of Object.entries(entry)) {
      if (!v) continue;
      if (k === 'choose') {
        const from = (entry.choose?.from || []).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
        const count = entry.choose?.count || 1;
        tools.push(`Choose ${count} from: ${from}`);
      } else if (k === 'any') {
        tools.push(`${v} tool${v > 1 ? 's' : ''} of your choice`);
      } else {
        // Capitalize tool name
        tools.push(k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    }
  }
  return tools.join(', ');
}

// Helper: parse feats [{"magic initiate; cleric|xphb":true}] -> string
function parseFeats(featArr) {
  if (!featArr || !Array.isArray(featArr)) return '';
  const feats = [];
  for (const entry of featArr) {
    for (const [k, v] of Object.entries(entry)) {
      if (!v) continue;
      // Strip source suffix (|xphb etc.)
      const featName = k.split('|')[0];
      feats.push(featName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    }
  }
  return feats.join(', ');
}

export function parse5etoolsBackground(bg, source) {
  const abilityStr = parseAbilityArray(bg.ability);
  const skillsStr = parseSkillProficiencies(bg.skillProficiencies);
  const toolsStr = parseToolProficiencies(bg.toolProficiencies);
  const langsStr = parseLanguageProficiencies(bg.languageProficiencies);
  const featsStr = parseFeats(bg.feats);

  return {
    name: bg.name,
    proficiency: skillsStr,
    tools: toolsStr,
    languages: langsStr,
    ability: abilityStr,
    feats: featsStr,
    texts: render5etoolsEntries(bg.entries),
    traits: [],
    modifiers: [],
    source: bg.source || source
  };
}

export function parse5etoolsRace(race, source) {
  let size = 'Medium';
  if (race.size && race.size.length > 0) {
    size = MONSTER_SIZES[race.size[0]] || race.size[0] || 'Medium';
  }

  let speedVal = 30;
  let speedStr = '';
  if (race.speed) {
    if (typeof race.speed === 'object') {
      speedVal = race.speed.walk || 30;
      const speedParts = [];
      for (const [k, v] of Object.entries(race.speed)) {
        if (v === true) speedParts.push(k.charAt(0).toUpperCase() + k.slice(1));
        else if (v) speedParts.push(`${k.charAt(0).toUpperCase() + k.slice(1)} ${v} ft.`);
      }
      speedStr = speedParts.join(', ');
    } else {
      speedVal = parseInt(race.speed) || 30;
      speedStr = `Walk ${speedVal} ft.`;
    }
  }
  if (!speedStr) speedStr = `Walk ${speedVal} ft.`;

  const abilityStr = parseAbilityArray(race.ability);
  const langsStr = parseLanguageProficiencies(race.languageProficiencies);
  const skillsStr = parseSkillProficiencies(race.skillProficiencies);

  // Filter out entries that have no name (raw text entries) as well as non-object entries
  const traits = (race.entries || []).filter(e => typeof e === 'object' && e !== null).map(e => ({
    name: parse5etoolsText(e.name || ''),
    texts: render5etoolsEntries(e.entries || (typeof e === 'string' ? [e] : []))
  })).filter(t => t.name);

  return {
    name: race.name,
    size: size,
    speed: speedVal,
    speedStr: speedStr,
    proficiency: skillsStr,
    spellAbility: '',
    ability: abilityStr,
    languages: langsStr,
    traits: traits,
    modifiers: [],
    additionalSpells: race.additionalSpells || null,
    source: race.source || source
  };
}

const OPT_FEATURE_TYPE_TO_FULL = {
  "AI": "Artificer Infusion",
  "ED": "Elemental Discipline",
  "EI": "Eldritch Invocation",
  "MM": "Metamagic",
  "MV": "Maneuver",
  "MV:B": "Maneuver, Battle Master",
  "MV:C2-UA": "Maneuver, Cavalier V2 (UA)",
  "AS:V1-UA": "Arcane Shot, V1 (UA)",
  "AS:V2-UA": "Arcane Shot, V2 (UA)",
  "AS": "Arcane Shot",
  "OTH": "Other",
  "FS:F": "Fighting Style; Fighter",
  "FS:B": "Fighting Style; Bard",
  "FS:P": "Fighting Style; Paladin",
  "FS:R": "Fighting Style; Ranger",
  "PB": "Pact Boon",
  "OR": "Onomancy Resonant",
  "RN": "Rune Knight Rune",
  "AF": "Alchemical Formula",
  "TT": "Traveler's Trick",
  "RP": "Renown Perk"
};

export function parse5etoolsOption(option, source) {
  const classesList = option.featureType ? option.featureType.map(ft => OPT_FEATURE_TYPE_TO_FULL[ft] || ft) : ['Other'];
  return {
    name: option.name,
    level: option.prerequisite ? parseInt(option.prerequisite.find(p => p.level)?.level) || 0 : 0,
    texts: render5etoolsEntries(option.entries),
    modifiers: [],
    classes: classesList,
    source: option.source || source
  };
}

// Helper: Extract spell slot arrays from 5eTools progression table
function getSlotsForClassAndLevel(classObj, lvl) {
  if (!classObj.classTableGroups) return '';
  const group = classObj.classTableGroups.find(g => g.title === 'Spell Slots per Spell Level' || g.rowsSpellProgression);
  if (group && group.rowsSpellProgression) {
    const slotsArr = group.rowsSpellProgression[lvl - 1];
    if (slotsArr) return slotsArr.join(',');
  }
  return '';
}

/**
 * Standard normalizer to turn 5eTools classes/subclasses data structures into IndexedDB models.
 */
export function normalize5etoolsClass(classObj, rawSubclasses = [], rawClassFeatures = [], rawSubclassFeatures = [], source) {
  const className = classObj.name;
  
  // Extract saving throw proficiencies and map to full names
  const ABBREV_TO_FULL = {
    'str': 'Strength',
    'dex': 'Dexterity',
    'con': 'Constitution',
    'int': 'Intelligence',
    'wis': 'Wisdom',
    'cha': 'Charisma'
  };
  const savingThrows = (classObj.proficiency || []).map(s => ABBREV_TO_FULL[s.toLowerCase()] || s);

  // Extract starting chooseable skills
  let startingSkills = [];
  if (classObj.startingProficiencies?.skills) {
    const skillChoose = classObj.startingProficiencies.skills[0]?.choose;
    if (skillChoose && Array.isArray(skillChoose.from)) {
      startingSkills = skillChoose.from.map(s => {
        return s.split(' ').map(word => {
          if (word.toLowerCase() === 'of') return 'of';
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      });
    }
  }

  // Group class features by level
  const classFeatures = rawClassFeatures.filter(f => f.className.toLowerCase() === className.toLowerCase());
  
  const autolevels = [];
  for (let lvl = 1; lvl <= 20; lvl++) {
    const levelFeatures = classFeatures.filter(f => f.level === lvl);
    const counters = []; // Reconstructed as empty/populated dynamically

    // If slots are defined
    const slots = getSlotsForClassAndLevel(classObj, lvl);

    autolevels.push({
      level: lvl,
      features: levelFeatures.map(f => ({
        name: f.name,
        texts: render5etoolsEntries(f.entries),
        special: '',
        optional: !!f.optional,
        modifiers: []
      })),
      slots: slots,
      counters: counters,
      rel: '',
      optional: false
    });
  }

  // Construct Class DB Record
  const classRecord = {
    name: className,
    hd: classObj.hd ? classObj.hd.faces : 8,
    spellAbility: classObj.spellcastingAbility || '',
    slotsReset: 'Long Rest',
    wealth: '',
    proficiency: [...savingThrows, ...startingSkills].join(', '),
    armor: classObj.startingProficiencies?.armor ? classObj.startingProficiencies.armor.join(', ') : '',
    weapons: classObj.startingProficiencies?.weapons ? classObj.startingProficiencies.weapons.map(w => parse5etoolsText(w)).join(', ') : '',
    tools: classObj.startingProficiencies?.tools ? classObj.startingProficiencies.tools.map(t => parse5etoolsText(t)).join(', ') : '',
    numSkills: classObj.startingProficiencies?.skills ? classObj.startingProficiencies.skills[0]?.choose?.count || 0 : 0,
    traits: [],
    autolevels: autolevels,
    slotsTable: autolevels.map(al => ({ level: al.level, slots: al.slots })).filter(al => al.slots),
    classTableGroups: classObj.classTableGroups || [],
    source: classObj.source || source
  };

  // Construct Subclasses
  const classSubclasses = rawSubclasses.filter(s => s.className.toLowerCase() === className.toLowerCase());
  const subclassRecords = classSubclasses.map(sub => {
    const subName = sub.name;
    const subFeatures = rawSubclassFeatures.filter(f => 
      f.className.toLowerCase() === className.toLowerCase() && 
      f.subclassShortName.toLowerCase() === sub.shortName.toLowerCase()
    );

    const subAutolevels = [];
    for (let lvl = 1; lvl <= 20; lvl++) {
      const levelFeatures = subFeatures.filter(f => f.level === lvl);
      if (levelFeatures.length > 0) {
        subAutolevels.push({
          level: lvl,
          features: levelFeatures.map(f => ({
            name: f.name,
            texts: render5etoolsEntries(f.entries),
            special: '',
            optional: !!f.optional,
            modifiers: []
          })),
          slots: '',
          counters: [],
          rel: `subclass.${sub.shortName.toLowerCase().replace(/\s+/g, '_')}`,
          optional: false
        });
      }
    }
    // Extract subclassTableGroups matching this subclass name and source
    const subTableGroups = (classObj.subclassTableGroups || []).filter(g => 
      g.subclasses && g.subclasses.some(sc => sc.name.toLowerCase() === subName.toLowerCase() && (sc.source || 'PHB').toUpperCase() === (sub.source || 'PHB').toUpperCase())
    );

    return {
      name: subName,
      parentClass: className,
      spellAbility: sub.spellcastingAbility || '',
      autolevels: subAutolevels,
      subclassTableGroups: subTableGroups,
      source: sub.source || source
    };
  });

  return {
    classRecord,
    subclassRecords,
    features: classFeatures.map(f => ({
      id: `${f.name}|${className}|${f.source || source}`,
      name: f.name,
      className: className,
      level: f.level,
      texts: render5etoolsEntries(f.entries),
      source: f.source || source
    })),
    subclassFeatures: rawSubclassFeatures.filter(f => f.className.toLowerCase() === className.toLowerCase()).map(f => ({
      id: `${f.name}|${className}|${f.subclassShortName}|${f.source || source}`,
      name: f.name,
      className: className,
      subclassShortName: f.subclassShortName,
      level: f.level,
      texts: render5etoolsEntries(f.entries),
      source: f.source || source
    }))
  };
}

// ─── Name Collision & Suffixer Helper ────────────────────────────────────────

/**
 * Utility to identify duplicate items across active sources and suffix them to prevent primary key collision.
 * Example: Rogue in PHB and Rogue in XPHB -> "Rogue (XPHB)" and "Rogue (PHB)"
 */
export function suffixDuplicateNames(records, storeName) {
  // 1. Group records by name
  const groupByName = {};
  records.forEach(rec => {
    if (!rec.name) return;
    if (!groupByName[rec.name]) groupByName[rec.name] = [];
    groupByName[rec.name].push(rec);
  });

  // 2. If there are duplicates, append the source alias in parentheses
  for (const [name, list] of Object.entries(groupByName)) {
    if (list.length > 1) {
      list.forEach(rec => {
        const suffix = rec.source || 'Unknown';
        // Keep original name in a different property for referencing if needed
        rec.originalName = rec.name;
        rec.name = `${name} (${suffix})`;
      });
    }
  }
}
