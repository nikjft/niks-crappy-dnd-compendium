// Vitest port of test_5etools_parser.js
// Legacy node runner: node test_5etools_parser.js

import { describe, it, expect } from 'vitest';
// @ts-ignore — legacy JS module
import {
  parse5etoolsText,
  render5etoolsEntries,
  parse5etoolsSpell,
  parse5etoolsItem,
  normalize5etoolsClass,
  suffixDuplicateNames,
} from '../../parser-5etools.js';

describe('parse5etoolsText', () => {
  it('strips inline tag wrappers to plain text', () => {
    expect(parse5etoolsText('Cast {@spell mage hand|phb}')).toBe('Cast mage hand');
    expect(parse5etoolsText("A {@item thieves' tools|PHB}")).toBe("A thieves' tools");
    expect(parse5etoolsText('Target is {@condition invisible}')).toBe('Target is invisible');
    expect(parse5etoolsText('Roll {@dice 2d6+4} damage')).toBe('Roll 2d6+4 damage');
    expect(parse5etoolsText('Deals {@damage 1d10} fire damage')).toBe('Deals 1d10 fire damage');
    expect(parse5etoolsText('This is {@b bold} text')).toBe('This is **bold** text');
  });
});

describe('render5etoolsEntries', () => {
  it('converts nested entries to markdown lines', () => {
    const entries = [
      'Line 1',
      { type: 'list', items: ['Item A', 'Item B'] },
      { type: 'entries', name: 'Subheader', entries: ['Subsection content'] },
    ];
    const result = render5etoolsEntries(entries);
    expect(result).toContain('Line 1');
    expect(result).toContain('* Item A');
    expect(result).toContain('* Item B');
    expect(result).toContain('### Subheader');
    expect(result).toContain('Subsection content');
  });
});

describe('parse5etoolsSpell', () => {
  it('maps raw 5etools spell to internal record', () => {
    const raw = {
      name: 'Air Bubble',
      source: 'AAG',
      level: 2,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } },
      components: { s: true },
      duration: [{ type: 'timed', duration: { type: 'hour', amount: 24 } }],
      entries: ['Creates air bubble'],
      meta: { ritual: true },
    };
    const parsed = parse5etoolsSpell(raw, 'AAG');
    expect(parsed.name).toBe('Air Bubble');
    expect(parsed.level).toBe(2);
    expect(parsed.school).toBe('Evocation');
    expect(parsed.ritual).toBe(true);
    expect(parsed.time).toBe('1 action');
    expect(parsed.range).toBe('60 feet');
    expect(parsed.components).toBe('S');
  });

  it('maps Enchantment school and Touch range', () => {
    const raw = {
      name: 'Cure Wounds',
      source: 'PHB',
      level: 1,
      school: 'E',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'touch' } },
      entries: ['Heals target'],
    };
    const parsed = parse5etoolsSpell(raw, 'PHB');
    expect(parsed.school).toBe('Enchantment');
    expect(parsed.range).toBe('Touch');
  });
});

describe('parse5etoolsItem', () => {
  it('maps raw 5etools item to internal record', () => {
    const raw = {
      name: 'Gauntlets of Ogre Power',
      source: 'DMG',
      type: 'W',
      rarity: 'uncommon',
      weight: 2,
      value: 50000,
      entries: ['Your strength becomes 19'],
    };
    const parsed = parse5etoolsItem(raw, 'DMG');
    expect(parsed.name).toBe('Gauntlets of Ogre Power');
    expect(parsed.type).toBe('Wondrous Item');
    expect(parsed.detail).toBe('uncommon');
    expect(parsed.magic).toBe(true);
    expect(parsed.weight).toBe(2);
    expect(parsed.value).toBe(500); // 50000 cp → 500 gp
  });
});

describe('suffixDuplicateNames', () => {
  it('appends source suffix to disambiguate same-name records (mutates in place)', () => {
    const records = [
      { name: 'Fireball', source: 'PHB' },
      { name: 'Fireball', source: 'XPHB' },
      { name: 'Shield', source: 'PHB' },
    ];
    // suffixDuplicateNames mutates in place, returns undefined
    suffixDuplicateNames(records as any[], 'spells');
    const names = records.map((r: any) => r.name);
    expect(names.filter((n: string) => n === 'Fireball').length).toBe(0); // both renamed
    expect(names.some((n: string) => n.includes('PHB') || n.includes('XPHB'))).toBe(true);
    expect(names.some((n: string) => n === 'Shield')).toBe(true); // unique, unchanged
  });
});

describe('normalize5etoolsClass', () => {
  it('extracts name and hit die from raw class data', () => {
    const raw = {
      name: 'Rogue',
      source: 'XPHB',
      hd: { number: 1, faces: 8 },
      proficiency: ['dex', 'int'],
      classFeatures: [],
    };
    // returns { classRecord, subclassRecords, features, subclassFeatures }
    const { classRecord } = normalize5etoolsClass(raw, [], [], [], 'XPHB');
    expect(classRecord.name).toBe('Rogue');
    expect(classRecord.hd).toBe(8);
  });
});
