import { describe, test, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { currentCharacter, charState } from '../state/stores.js';
import { calculateCharacterState } from '../engine/engine.js';
import { StatsTab } from '../components/stats/StatsTab.js';
import type { Character } from '../data/types.js';

describe('StatsTab Component', () => {
  let char: Character;

  beforeEach(() => {
    char = {
      name: 'Test Wizard',
      level: 5,
      baseHpMax: 30,
      baseStats: { str: 15, dex: 14, con: 12, int: 18, wis: 10, cha: 8 },
      speed: 30,
      savesProficiency: { int: 1, wis: 1 },
      skillsProficiency: { arcana: 1, history: 1 },
      toolProficiencies: [
        { name: 'Thieves\' Tools', attr: 'dex', profLevel: 1 }
      ],
      languages: ['Common', 'Elvish'],
      otherProficiencies: ['Daggers', 'Light Armor']
    };
    currentCharacter.value = char;
  });

  test('renders ability scores and modifiers correctly', () => {
    render(<StatsTab />);
    const strCard = screen.getByLabelText('Strength details');
    expect(strCard).toHaveTextContent('Strength');
    expect(strCard).toHaveTextContent('+2');
    expect(strCard).toHaveTextContent('15');
  });

  test('toggles saving throw proficiency when clicked', () => {
    render(<StatsTab />);
    // STR has no save proficiency initially
    expect(currentCharacter.value?.savesProficiency?.str).toBeFalsy();

    const strIndicator = screen.getByLabelText('Toggle save proficiency for Strength');
    fireEvent.click(strIndicator);

    expect(currentCharacter.value?.savesProficiency?.str).toBe(1);
  });

  test('cycles skill proficiency level on click', () => {
    render(<StatsTab />);
    // Arcana is proficient (1) initially
    expect(currentCharacter.value?.skillsProficiency?.arcana).toBe(1);

    const arcanaIndicator = screen.getByLabelText('Cycle proficiency for Arcana');
    fireEvent.click(arcanaIndicator); // cycle to expertise (2)
    expect(currentCharacter.value?.skillsProficiency?.arcana).toBe(2);

    fireEvent.click(arcanaIndicator); // cycle to none (0)
    expect(currentCharacter.value?.skillsProficiency?.arcana).toBe(0);
  });

  test('overrides skill governing attribute via dropdown select', () => {
    render(<StatsTab />);
    const select = screen.getByLabelText('Athletics governing attribute') as HTMLSelectElement;
    expect(select.value).toBe('str');

    fireEvent.change(select, { target: { value: 'con' } });
    expect(currentCharacter.value?.skillsAttributeOverride?.athletics).toBe('con');
  });

  test('adds and removes tool proficiencies', () => {
    render(<StatsTab />);
    expect(screen.getByText('Thieves\' Tools')).toBeInTheDocument();

    // Add a new tool
    const addBtn = screen.getByText('+ Add Tool');
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText('Tool Name (e.g. Disguise Kit)');
    fireEvent.input(input, { target: { value: 'Brewer\'s Supplies' } });

    const saveBtn = screen.getByText('Add');
    fireEvent.click(saveBtn);

    expect(currentCharacter.value?.toolProficiencies?.some(t => t.name === 'Brewer\'s Supplies')).toBe(true);

    // Remove Thieves' Tools
    const trashBtn = screen.getByLabelText('Delete Thieves\' Tools');
    fireEvent.click(trashBtn);

    expect(currentCharacter.value?.toolProficiencies?.some(t => t.name === 'Thieves\' Tools')).toBe(false);
  });

  test('adds and removes languages', () => {
    render(<StatsTab />);
    expect(screen.getByText('Common')).toBeInTheDocument();

    // Add language
    const addBtn = screen.getByLabelText('Add languages');
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText('New languages...');
    fireEvent.input(input, { target: { value: 'Draconic' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(currentCharacter.value?.languages).toContain('Draconic');

    // Remove Common
    const removeBtn = screen.getByLabelText('Remove Common');
    fireEvent.click(removeBtn);

    expect(currentCharacter.value?.languages).not.toContain('Common');
  });
});
