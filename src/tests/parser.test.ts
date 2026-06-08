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

  it('handles section type (like entries but no required name)', () => {
    const entries = [{ type: 'section', name: 'Construction Details', entries: ['You can customize it.'] }];
    const result = render5etoolsEntries(entries);
    expect(result).toContain('### Construction Details');
    expect(result).toContain('You can customize it.');
  });

  it('handles item type (definition list: Term. definition)', () => {
    const entries = [
      { type: 'item', name: 'Finesse', entries: ['Use STR or DEX for attack.'] },
      { type: 'item', name: 'Light', entry: 'Can dual-wield.' },
    ];
    const result = render5etoolsEntries(entries);
    expect(result.some((l: string) => l.includes('**Finesse**') && l.includes('Use STR or DEX'))).toBe(true);
    expect(result.some((l: string) => l.includes('**Light**') && l.includes('Can dual-wield'))).toBe(true);
  });

  it('handles insetReadaloud type like inset', () => {
    const entries = [{ type: 'insetReadaloud', name: 'Scene', entries: ['You enter a dark room.'] }];
    const result = render5etoolsEntries(entries);
    expect(result.some((l: string) => l.includes('**Scene**'))).toBe(true);
    expect(result.some((l: string) => l.includes('dark room'))).toBe(true);
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

  it('includes entriesHigherLevel in texts (At Higher Levels)', () => {
    const raw = {
      name: 'Fireball',
      source: 'PHB',
      level: 3,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 150 } },
      components: { v: true, s: true, m: 'a ball of bat guano and sulfur' },
      duration: [{ type: 'instant' }],
      entries: ['A bright streak of fire blossoms into a 20-foot-radius sphere.'],
      entriesHigherLevel: [
        {
          type: 'entries',
          name: 'At Higher Levels',
          entries: ['The damage increases by 1d6 for each slot level above 3rd.'],
        },
      ],
    };
    const parsed = parse5etoolsSpell(raw, 'PHB');
    expect(parsed.texts.some((t: string) => t.includes('At Higher Levels'))).toBe(true);
    expect(parsed.texts.some((t: string) => t.includes('1d6 for each slot level'))).toBe(true);
  });

  it('does not add spurious entries when entriesHigherLevel is absent', () => {
    const raw = {
      name: 'Mage Hand',
      source: 'PHB',
      level: 0,
      school: 'C',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 30 } },
      components: { v: true, s: true },
      duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 } }],
      entries: ['A spectral, floating hand appears.'],
    };
    const parsed = parse5etoolsSpell(raw, 'PHB');
    expect(parsed.texts).toHaveLength(1);
    expect(parsed.texts[0]).toContain('spectral');
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

  it('maps reqAttune boolean to requiresAttunement', () => {
    const raw = {
      name: 'Ring of Protection',
      source: 'DMG',
      type: 'RG',
      rarity: 'uncommon',
      reqAttune: true,
      entries: ['You gain a +1 bonus to AC and saving throws'],
    };
    const parsed = parse5etoolsItem(raw, 'DMG');
    expect(parsed.requiresAttunement).toBe(true);
  });

  it('maps reqAttune string to requiresAttunement', () => {
    const raw = {
      name: 'Staff of the Magi',
      source: 'DMG',
      type: 'ST',
      rarity: 'legendary',
      reqAttune: 'by a sorcerer, warlock, or wizard',
      entries: ['A potent magical staff'],
    };
    const parsed = parse5etoolsItem(raw, 'DMG');
    expect(parsed.requiresAttunement).toBe(true);
  });

  it('sets requiresAttunement to false when reqAttune is absent', () => {
    const raw = {
      name: 'Bag of Holding',
      source: 'DMG',
      type: 'W',
      rarity: 'uncommon',
      entries: ['A bag with an extradimensional space'],
    };
    const parsed = parse5etoolsItem(raw, 'DMG');
    expect(parsed.requiresAttunement).toBe(false);
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
