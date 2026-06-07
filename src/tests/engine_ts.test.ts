import { describe, it, expect } from 'vitest';
import { calculateCharacterState, calcWeaponAttack } from '../engine/engine.js';
import type { Character, EquipmentItem } from '../data/types.js';

const BASE_CHAR: Character = {
  name: 'Test',
  level: 1,
  baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  baseHpMax: 8,
  hp: { current: 8, temp: 0 },
  speed: 30,
  savesProficiency: {},
  skillsProficiency: {},
};

describe('calculateCharacterState — attribute fundamentals', () => {
  it('derives zero modifiers for all-10 stats', () => {
    const S = calculateCharacterState(BASE_CHAR);
    expect(S['str.mod'].total).toBe(0);
    expect(S['dex.mod'].total).toBe(0);
  });

  it('computes modifier correctly for score 16 (+3)', () => {
    const S = calculateCharacterState({ ...BASE_CHAR, baseStats: { ...BASE_CHAR.baseStats, str: 16 } });
    expect(S['str.mod'].total).toBe(3);
  });

  it('proficiency bonus is 2 at level 1 and 3 at level 5', () => {
    const s1 = calculateCharacterState(BASE_CHAR);
    const s5 = calculateCharacterState({ ...BASE_CHAR, level: 5 });
    expect(s1['prof_bonus'].total).toBe(2);
    expect(s5['prof_bonus'].total).toBe(3);
  });
});

describe('calculateCharacterState — saving throws', () => {
  it('non-proficient save equals attribute modifier', () => {
    const S = calculateCharacterState({ ...BASE_CHAR, baseStats: { ...BASE_CHAR.baseStats, con: 14 } });
    expect(S['save.con'].total).toBe(2);
  });

  it('proficient save adds proficiency bonus', () => {
    const S = calculateCharacterState({
      ...BASE_CHAR,
      baseStats: { ...BASE_CHAR.baseStats, str: 16 },
      savesProficiency: { str: 1 },
    });
    expect(S['save.str'].total).toBe(5); // +3 mod + 2 prof
  });
});

describe('calculateCharacterState — skills', () => {
  it('Athletics = STR mod for non-proficient', () => {
    const S = calculateCharacterState({ ...BASE_CHAR, baseStats: { ...BASE_CHAR.baseStats, str: 14 } });
    expect(S['skill.athletics'].total).toBe(2);
  });

  it('Perception with expertise = WIS mod + 2×prof', () => {
    const S = calculateCharacterState({
      ...BASE_CHAR,
      baseStats: { ...BASE_CHAR.baseStats, wis: 14 },
      skillsProficiency: { perception: 2 },
    });
    expect(S['skill.perception'].total).toBe(2 + 4); // 2 mod + 2×2
  });
});

describe('calculateCharacterState — AC', () => {
  it('unarmored AC is 10 + DEX mod', () => {
    const S = calculateCharacterState({ ...BASE_CHAR, baseStats: { ...BASE_CHAR.baseStats, dex: 14 } });
    expect(S['ac'].total).toBe(12);
  });

  it('light armor uses full DEX mod', () => {
    const leatherArmor: EquipmentItem = {
      name: 'Leather Armor', source: 'PHB', active: true, armor: true, ac: 11,
      armorType: 'LA', rawType: 'LA',
    };
    const S = calculateCharacterState({
      ...BASE_CHAR,
      baseStats: { ...BASE_CHAR.baseStats, dex: 16 },
      equipment: [leatherArmor],
    });
    expect(S['ac'].total).toBe(14); // 11 + 3
  });

  it('medium armor caps DEX at +2', () => {
    const chainShirt: EquipmentItem = {
      name: 'Chain Shirt', source: 'PHB', active: true, armor: true, ac: 13,
      armorType: 'MA', rawType: 'MA',
    };
    const S = calculateCharacterState({
      ...BASE_CHAR,
      baseStats: { ...BASE_CHAR.baseStats, dex: 18 },
      equipment: [chainShirt],
    });
    expect(S['ac'].total).toBe(15); // 13 + 2 (capped)
  });

  it('heavy armor ignores DEX', () => {
    const chainMail: EquipmentItem = {
      name: 'Chain Mail', source: 'PHB', active: true, armor: true, ac: 16,
      armorType: 'HA', rawType: 'HA',
    };
    const S = calculateCharacterState({
      ...BASE_CHAR,
      baseStats: { ...BASE_CHAR.baseStats, dex: 20 },
      equipment: [chainMail],
    });
    expect(S['ac'].total).toBe(16);
  });

  it('shield adds 2 to armored AC', () => {
    const plate: EquipmentItem = {
      name: 'Plate Armor', source: 'PHB', active: true, armor: true, ac: 18,
      armorType: 'HA', rawType: 'HA',
    };
    const shield: EquipmentItem = {
      name: 'Shield', source: 'PHB', active: true, shield: true, ac: 2,
    };
    const S = calculateCharacterState({ ...BASE_CHAR, equipment: [plate, shield] });
    expect(S['ac'].total).toBe(20);
  });
});

describe('calculateCharacterState — spellcasting', () => {
  it('spell DC = 8 + prof + WIS mod for WIS caster', () => {
    const S = calculateCharacterState({
      ...BASE_CHAR,
      baseStats: { ...BASE_CHAR.baseStats, wis: 16 },
      spellcastingAbility: 'wis',
    });
    expect(S['spell.dc'].total).toBe(13); // 8+2+3
  });
});

describe('calcWeaponAttack', () => {
  it('longsword uses STR for attack', () => {
    const char: Character = { ...BASE_CHAR, baseStats: { ...BASE_CHAR.baseStats, str: 16, dex: 12 } };
    const S = calculateCharacterState(char);
    const longsword: EquipmentItem = {
      name: 'Longsword', source: 'PHB', active: true, weapon: true,
      rawType: 'M', dmg1: '1d8', dmgType: 'S',
    };
    const result = calcWeaponAttack(longsword, S);
    expect(result.atkBonus.total).toBe(5); // 2 prof + 3 STR
    expect(result.atkBonusAlt).toBeUndefined();
  });

  it('rapier (finesse) offers both STR and DEX options when they differ', () => {
    const char: Character = { ...BASE_CHAR, baseStats: { ...BASE_CHAR.baseStats, str: 10, dex: 16 } };
    const S = calculateCharacterState(char);
    const rapier: EquipmentItem = {
      name: 'Rapier', source: 'PHB', active: true, weapon: true,
      rawType: 'M', dmg1: '1d8', dmgType: 'P', properties: ['F'],
    };
    const result = calcWeaponAttack(rapier, S);
    // Primary should be DEX (higher, +3) → total 5
    expect(result.atkBonus.total).toBe(5);
    // Alt should be STR (+0) → total 2
    expect(result.atkBonusAlt).toBeDefined();
    expect(result.atkBonusAlt!.total).toBe(2);
  });

  it('+2 magic weapon adds bonus to attack', () => {
    const char: Character = { ...BASE_CHAR };
    const S = calculateCharacterState(char);
    const sword: EquipmentItem = {
      name: '+2 Longsword', source: 'DMG', active: true, weapon: true,
      rawType: 'M', dmg1: '1d8', dmgType: 'S', bonusWeapon: '+2',
    };
    const result = calcWeaponAttack(sword, S);
    expect(result.atkBonus.total).toBe(4); // 2 prof + 0 STR + 2 magic
  });
});

describe('breakdown structure', () => {
  it('Breakdown has total, base, and parts array', () => {
    const S = calculateCharacterState(BASE_CHAR);
    const bd = S['prof_bonus'];
    expect(typeof bd.total).toBe('number');
    expect(bd.base).toHaveProperty('label');
    expect(bd.base).toHaveProperty('value');
    expect(Array.isArray(bd.parts)).toBe(true);
  });
});
