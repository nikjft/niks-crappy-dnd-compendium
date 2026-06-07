// Vitest port of test_engine.js
// Legacy node runner: node test_engine.js

import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — legacy JS module, typed incrementally in Phase 1
import { calculateCharacterState, evaluateFormula } from '../../engine.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CharState = Record<string, any>;

const baseChar = () => ({
  name: 'Test',
  level: 1,
  baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savesProficiency: {} as Record<string, number>,
  skillsProficiency: {} as Record<string, number>,
  speed: 30,
  baseHpMax: 10,
  spellcastingAbility: 'wis',
});

describe('evaluateFormula', () => {
  const state = { 'char.level': 5, 'str.mod': 3 };

  it('handles static numbers', () => {
    expect(evaluateFormula(10, state)).toBe(10);
    expect(evaluateFormula('15', state)).toBe(15);
  });

  it('resolves formula variables', () => {
    expect(evaluateFormula('2 * {char.level}', state)).toBe(10);
    expect(evaluateFormula('{str.mod} + 2', state)).toBe(5);
    expect(evaluateFormula('Math.min(2, {str.mod})', state)).toBe(2);
  });

  it('returns 0 for missing variables', () => {
    expect(evaluateFormula('invalid {nonexistent}', state)).toBe(0);
  });
});

describe('calculateCharacterState — defaults', () => {
  it('computes correct defaults for a level 1 character with 10s in all stats', () => {
    const state: CharState = calculateCharacterState(baseChar());
    expect(state['char.level']).toBe(1);
    expect(state['prof_bonus']).toBe(2);
    expect(state['str.score']).toBe(10);
    expect(state['str.mod']).toBe(0);
    expect(state['ac']).toBe(10);
    expect(state['initiative']).toBe(0);
    expect(state['speed']).toBe(30);
    expect(state['save.str']).toBe(0);
    expect(state['skill.athletics']).toBe(0);
    expect(state['passive.perception']).toBe(10);
    expect(state['hp.max']).toBe(10);
  });

  it('scales prof bonus correctly at level 5', () => {
    const char = {
      ...baseChar(),
      level: 5,
      baseStats: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
      savesProficiency: { dex: 1 },
      skillsProficiency: { stealth: 1 },
      baseHpMax: 20,
    };
    const state: CharState = calculateCharacterState(char);
    expect(state['char.level']).toBe(5);
    expect(state['prof_bonus']).toBe(3);
    expect(state['dex.mod']).toBe(2);
    expect(state['save.dex']).toBe(5); // 2 + 3
    expect(state['skill.stealth']).toBe(5); // 2 + 3
    expect(state['hp.max']).toBe(25); // 20 base + 1 con * 5 levels
  });
});

describe('calculateCharacterState — modifiers', () => {
  it('only applies active modifiers', () => {
    const char = {
      ...baseChar(),
      equipment: [
        {
          name: 'Ring of Protection',
          active: true,
          modifiers: [
            { target: 'ac', type: 'add', value: 1 },
            { target: 'save.all', type: 'add', value: 1 },
          ],
        },
        {
          name: 'Shield (inactive)',
          active: false,
          modifiers: [{ target: 'ac', type: 'add', value: 2 }],
        },
      ],
    };
    const state: CharState = calculateCharacterState(char);
    expect(state['ac']).toBe(11);
    expect(state['save.str']).toBe(1);
    expect(state['save.dex']).toBe(1);
  });

  it('resolves formula modifiers in dependency order', () => {
    const char = {
      ...baseChar(),
      level: 5,
      baseStats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      baseHpMax: 20,
      features: [
        {
          name: 'Tough Feat',
          active: true,
          modifiers: [{ target: 'hp.max', type: 'add', value: '2 * {char.level}' }],
        },
      ],
    };
    const state: CharState = calculateCharacterState(char);
    // 20 base + 2 con * 5 lvl = 30, plus Tough +10 = 40
    expect(state['hp.max']).toBe(40);
  });

  it('set modifiers override base calculations', () => {
    const char = {
      ...baseChar(),
      equipment: [
        {
          name: 'Gauntlets of Ogre Power',
          active: true,
          modifiers: [{ target: 'str.score', type: 'set', value: 19 }],
        },
      ],
      savesProficiency: { str: 1 },
      skillsProficiency: { athletics: 1 },
    };
    const state: CharState = calculateCharacterState(char);
    expect(state['str.score']).toBe(19);
    expect(state['str.mod']).toBe(4);
    expect(state['save.str']).toBe(6); // +4 + 2 prof
    expect(state['skill.athletics']).toBe(6);
  });

  it('handles expertise (×2) and jack-of-all-trades (×0.5) proficiency multipliers', () => {
    const char = {
      ...baseChar(),
      skillsProficiency: { perception: 2, athletics: 0.5 },
    };
    const state: CharState = calculateCharacterState(char);
    expect(state['skill.perception']).toBe(4); // 0 + 2 * 2 prof
    expect(state['skill.athletics']).toBe(1); // 0 + 0.5 * 2 prof
    expect(state['passive.perception']).toBe(14);
  });
});
