import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { currentCharacter } from '../state/stores.js';
import { InventoryTab } from '../components/inventory/InventoryTab.js';
import type { Character, EquipmentItem } from '../data/types.js';

describe('InventoryTab Component', () => {
  let char: Character;

  beforeEach(() => {
    // Standard mock data for character
    char = {
      name: 'Test Fighter',
      level: 5,
      baseHpMax: 45,
      baseStats: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 11 },
      speed: 30,
      savesProficiency: {},
      skillsProficiency: {},
      attunementMax: 3,
      weightTrackingEnabled: true,
      currency: { pp: 2, gp: 100, ep: 0, sp: 20, cp: 50 },
      itemLists: [
        { id: 'default', name: 'Inventory' },
        { id: 'bag_of_holding', name: 'Bag of Holding' }
      ],
      equipment: [
        {
          id: 'item-1',
          name: 'Longsword +1',
          source: 'PHB',
          weight: 3,
          quantity: 1,
          type: 'Weapon',
          active: true,
          selected: true,
          listId: 'default',
          weapon: true
        },
        {
          id: 'item-2',
          name: 'Shield',
          source: 'PHB',
          weight: 6,
          quantity: 1,
          type: 'Shield',
          active: true,
          selected: true,
          listId: 'default',
          shield: true
        },
        {
          id: 'item-3',
          name: 'Rope, Hempen (50ft)',
          source: 'PHB',
          weight: 10,
          quantity: 1,
          type: 'Gear',
          active: false,
          selected: true,
          listId: 'default'
        },
        {
          id: 'item-4',
          name: 'Plate Armor',
          source: 'PHB',
          weight: 65,
          quantity: 1,
          type: 'Armor',
          active: false,
          selected: false,
          listId: 'bag_of_holding',
          armor: true
        },
        {
          id: 'item-5',
          name: 'Ring of Protection',
          source: 'PHB',
          weight: 0,
          quantity: 1,
          type: 'Gear',
          active: true,
          selected: true,
          requiresAttunement: true,
          listId: 'default'
        }
      ]
    };
    currentCharacter.value = char;

    // Mock window functions called by the component
    if (typeof window !== 'undefined') {
      (window as any).getDetailHTML = vi.fn().mockReturnValue('<div>Mock Item Details</div>');
      (window as any).syncLocalEntityWithCompendium = vi.fn();
      (window as any).openPicker = vi.fn();
    }
  });

  test('renders currencies correctly', () => {
    render(<InventoryTab />);
    expect(screen.getByText('100')).toBeInTheDocument(); // GP
    expect(screen.getByText('20')).toBeInTheDocument();  // SP
    expect(screen.getByText('50')).toBeInTheDocument();  // CP
    expect(screen.getByText('2')).toBeInTheDocument();   // PP
  });

  test('opens currency editor and updates currency', () => {
    render(<InventoryTab />);
    const editBtn = screen.getByText('Edit Currency');
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Currency')).toBeInTheDocument();

    const gpInput = screen.getByLabelText('Edit gp currency') as HTMLInputElement;
    expect(gpInput.value).toBe('100');

    fireEvent.change(gpInput, { target: { value: '150' } });
    expect(currentCharacter.value?.currency?.gp).toBe(150);
  });

  test('renders load (weight) and attunement status correctly', () => {
    render(<InventoryTab />);
    // Total weight should be: item-1 (3) + item-2 (6) + item-3 (10) + item-5 (0) = 19 lbs
    // plate armor (item-4) is stored (active=false, selected=false), so its 65 lbs is ignored!
    expect(screen.getByText(/Load:/)).toHaveTextContent('19.0 / 240 lbs');
    expect(screen.getByText(/Attuned:/)).toHaveTextContent('1 / 3');
  });

  test('cycles item state Equipped -> Carried -> Stored -> Equipped', () => {
    render(<InventoryTab />);
    const item = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(item.active).toBe(false);
    expect(item.selected).toBe(true); // initially carried

    // Tap to transition to Stored (active=false, selected=false)
    fireEvent.click(screen.getByLabelText('Cycle state for Rope, Hempen (50ft)'));
    const updated1 = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(updated1.active).toBe(false);
    expect(updated1.selected).toBe(false);

    // Tap to transition to Equipped (active=true, selected=true)
    fireEvent.click(screen.getByLabelText('Cycle state for Rope, Hempen (50ft)'));
    const updated2 = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(updated2.active).toBe(true);
    expect(updated2.selected).toBe(true);

    // Tap to transition to Carried (active=false, selected=true)
    fireEvent.click(screen.getByLabelText('Cycle state for Rope, Hempen (50ft)'));
    const updated3 = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(updated3.active).toBe(false);
    expect(updated3.selected).toBe(true);
  });

  test('filters items using the search bar', () => {
    render(<InventoryTab />);
    expect(screen.getByText('Longsword +1')).toBeInTheDocument();
    expect(screen.getByText('Rope, Hempen (50ft)')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search inventory...');
    fireEvent.input(searchInput, { target: { value: 'Sword' } });

    expect(screen.getByText('Longsword +1')).toBeInTheDocument();
    expect(screen.queryByText('Rope, Hempen (50ft)')).not.toBeInTheDocument();
  });

  test('toggles settings panel and updates weight tracking & attunement limit', () => {
    render(<InventoryTab />);
    const settingsBtn = screen.getByText('⚙️ Settings');
    fireEvent.click(settingsBtn);

    expect(screen.getByText('Inventory Settings')).toBeInTheDocument();

    const checkbox = screen.getByLabelText('Toggle weight tracking') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(currentCharacter.value?.weightTrackingEnabled).toBe(false);

    const attuneInput = screen.getByLabelText('Max attunement slots') as HTMLInputElement;
    expect(attuneInput.value).toBe('3');
    fireEvent.change(attuneInput, { target: { value: '4' } });
    expect(currentCharacter.value?.attunementMax).toBe(4);
  });

  test('adds, renames and deletes custom gear lists/containers in settings', () => {
    render(<InventoryTab />);
    fireEvent.click(screen.getByText('⚙️ Settings'));

    // Try adding a new list
    const listInput = screen.getByPlaceholderText('New List Name (e.g. Bag of Holding)');
    fireEvent.input(listInput, { target: { value: 'Haversack' } });
    fireEvent.click(screen.getByText('Add List'));

    expect(currentCharacter.value?.itemLists?.some((l: any) => l.name === 'Haversack')).toBe(true);

    const haversack = currentCharacter.value?.itemLists?.find((l: any) => l.name === 'Haversack');

    // Rename
    const renameInput = screen.getByLabelText(`Rename list Haversack`) as HTMLInputElement;
    fireEvent.change(renameInput, { target: { value: 'Handy Haversack' } });
    expect(currentCharacter.value?.itemLists?.some((l: any) => l.name === 'Handy Haversack')).toBe(true);

    // Delete Handy Haversack (it is empty, so it should succeed)
    const delBtn = screen.getByLabelText(`Delete list Handy Haversack`);
    fireEvent.click(delBtn);
    expect(currentCharacter.value?.itemLists?.some((l: any) => l.name === 'Handy Haversack')).toBe(false);
  });

  test('creates custom items', () => {
    render(<InventoryTab />);
    const addCustomBtn = screen.getByText('+ Create Custom Item');
    fireEvent.click(addCustomBtn);

    const nameInput = screen.getByPlaceholderText('e.g. Iron Spike');
    fireEvent.input(nameInput, { target: { value: 'Iron Spikes (10)' } });

    const weightInput = screen.getByPlaceholderText('0.0');
    fireEvent.input(weightInput, { target: { value: '5.0' } });

    const selectType = screen.getByText('Item Type').nextElementSibling as HTMLSelectElement;
    fireEvent.change(selectType, { target: { value: 'Gear' } });

    fireEvent.click(screen.getByText('Create'));

    expect(currentCharacter.value?.equipment?.some((e: any) => e.name === 'Iron Spikes (10)')).toBe(true);
    const addedItem = currentCharacter.value?.equipment?.find((e: any) => e.name === 'Iron Spikes (10)') as any;
    expect(addedItem.weight).toBe(5);
    expect(addedItem.type).toBe('Gear');
    expect(addedItem.selected).toBe(true); // starts carried
  });
});
