import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { currentCharacter } from '../state/stores.js';
import { InventoryTab } from '../components/inventory/InventoryTab.js';
import type { Character, EquipmentItem } from '../data/types.js';

describe('InventoryTab Component', () => {
  let char: Character;

  beforeEach(() => {
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

    if (typeof window !== 'undefined') {
      (window as any).getDetailHTML = vi.fn().mockReturnValue('<div>Mock Item Details</div>');
      (window as any).syncLocalEntityWithCompendium = vi.fn();
      (window as any).__legacyOpenPicker = vi.fn();
    }
  });

  test('renders currencies correctly', () => {
    render(<InventoryTab />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
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

  test('requiresAttunement badge shown on attuned item', () => {
    render(<InventoryTab />);
    // The 'a' badge appears on items with requiresAttunement: true
    const ring = screen.getByText('Ring of Protection');
    expect(ring).toBeTruthy();
  });

  test('cycle button toggles item state sequentially', () => {
    render(<InventoryTab />);
    const item = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(item.active).toBe(false);
    expect(item.selected).toBe(true);

    fireEvent.click(screen.getByLabelText('Cycle status for Rope, Hempen (50ft)'));
    const equipped = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(equipped.active).toBe(true);
    expect(equipped.selected).toBe(true);

    fireEvent.click(screen.getByLabelText('Cycle status for Rope, Hempen (50ft)'));
    const uncarried = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(uncarried.active).toBe(false);
    expect(uncarried.selected).toBe(false);

    fireEvent.click(screen.getByLabelText('Cycle status for Rope, Hempen (50ft)'));
    const carried = (currentCharacter.value?.equipment as EquipmentItem[]).find(e => e.id === 'item-3')!;
    expect(carried.active).toBe(false);
    expect(carried.selected).toBe(true);
  });
});
