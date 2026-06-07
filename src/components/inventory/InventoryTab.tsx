import { useState } from 'preact/hooks';
import { currentCharacter, charState, expandedRowId, patchCharacter } from '../../state/stores.js';
import { CurrencyEditor } from './CurrencyEditor.js';
import { SettingsPanel } from './SettingsPanel.js';
import type { Character, EquipmentItem, Modifier } from '../../data/types.js';
import '../../inventory.css';

const generateId = () => Math.random().toString(36).substring(2, 11);

// ─── Weapon / armor / modifier types used by custom creator ──────────────────
const DAMAGE_TYPES = ['bludgeoning', 'piercing', 'slashing', 'fire', 'cold', 'lightning',
  'poison', 'acid', 'necrotic', 'radiant', 'psychic', 'thunder', 'force'];
const DAMAGE_DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d8', '2d12'];
const STAT_OPTIONS = [
  { key: 'str.score', label: 'STR Score' }, { key: 'dex.score', label: 'DEX Score' },
  { key: 'con.score', label: 'CON Score' }, { key: 'int.score', label: 'INT Score' },
  { key: 'wis.score', label: 'WIS Score' }, { key: 'cha.score', label: 'CHA Score' },
  { key: 'hp.max', label: 'HP Max' }, { key: 'ac', label: 'Armor Class' },
  { key: 'speed', label: 'Speed' },
];

// ─── Single item row ──────────────────────────────────────────────────────────

interface ItemRowProps {
  item: EquipmentItem;
  equipment: EquipmentItem[];
  itemLists: any[];
  isPinned: boolean;
  weightEnabled: boolean;
  onCycleState: (item: EquipmentItem) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onMoveToList: (id: string, listId: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (item: EquipmentItem) => void;
  onSync: (item: EquipmentItem) => void;
}

function ItemRow({
  item, equipment, itemLists, isPinned, weightEnabled,
  onCycleState, onUpdateQty, onMoveToList, onDelete, onTogglePin, onSync
}: ItemRowProps) {
  const isExpanded = expandedRowId.value === item.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Partial<EquipmentItem> | null>(null);

  const isAttunedRequired = !!item.requiresAttunement;
  const isEquipped = !!item.active;
  const isCarried = !item.active && !!item.selected;

  function getDetailHTMLContent(item: EquipmentItem) {
    if (typeof window !== 'undefined' && (window as any).getDetailHTML) {
      return (window as any).getDetailHTML(item, 'items');
    }
    return `<p>${item.texts?.join('<br>') ?? 'No description.'}</p>`;
  }

  function handleSaveProperties() {
    if (!editFields) return;
    const isWeapon = editFields.type === 'Weapon';
    const isArmor  = editFields.type === 'Armor';
    const isShield = editFields.type === 'Shield';
    const updated = equipment.map(i =>
      i.id !== item.id ? i : { ...i, ...editFields, weapon: isWeapon, armor: isArmor, shield: isShield }
    );
    patchCharacter({ equipment: updated });
    setIsEditing(false);
    setEditFields(null);
  }

  function getItemSubtext() {
    const parts: string[] = [];
    if (item.type) parts.push(item.type);
    if (item.ac) parts.push(`AC ${item.ac}`);
    if (item.bonusAc) parts.push(`AC +${item.bonusAc}`);
    if (item.dmg1) parts.push(`${item.dmg1} ${item.dmgType ?? ''}`);
    return parts.join(' · ');
  }

  // Render the cycling icon: Empty circle for not carried, filled circle for carried, shield for equipped
  function renderStateIcon() {
    if (isEquipped) {
      return (
        <span class="state-icon equipped-shield" title="Equipped">
          🛡️
        </span>
      );
    }
    return null;
  }

  return (
    <div class="item-row-group">
      <div
        class="item-table-row"
        onClick={() => { expandedRowId.value = isExpanded ? null : (item.id ?? null); }}
      >
        <div class="col-item-details">
          <div class="item-name-line">
            <span style="font-weight: 500;">{item.name}</span>
            {item.quantity && item.quantity > 1 && (
              <span class="item-qty-badge">×{item.quantity}</span>
            )}
            {isAttunedRequired && <span class="item-badge-container">a</span>}
          </div>
          <div class="item-sub-line">
            <span>{getItemSubtext()}</span>
          </div>
        </div>

        <div class="col-item-meta">
          {weightEnabled && item.weight != null && (
            <span class="item-weight-display">
              {((parseFloat(String(item.weight)) || 0) * (item.quantity ?? 1)).toFixed(1)} lbs
            </span>
          )}
          <div class="col-state-icon" onClick={e => e.stopPropagation()}>
            <button
              class={`item-cycle-btn ${isEquipped ? 'equipped' : isCarried ? 'carried' : 'uncarried'}`}
              onClick={() => onCycleState(item)}
              aria-label={`Cycle status for ${item.name}`}
            >
              {renderStateIcon()}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail view */}
      {isExpanded && (
        <div class="item-row-breakdown">
          <div class="item-detail-actions-row">
            <div class="item-actions-left">
              {isEditing ? (
                <button class="cs-btn-small" onClick={handleSaveProperties}>Save</button>
              ) : (
                <button class="cs-btn-small secondary" onClick={() => {
                  setEditFields({ name: item.name, weight: item.weight, type: item.type, requiresAttunement: item.requiresAttunement });
                  setIsEditing(true);
                }}>✏️ Edit</button>
              )}
              {item.compendiumId && (
                <button class="cs-btn-small secondary" onClick={() => onSync(item)}>🔄 Sync</button>
              )}
              {(item.weapon || item.type === 'Consumable' || item.type === 'Gear') && (
                <button class={`cs-btn-small secondary ${isPinned ? 'active' : ''}`} onClick={() => onTogglePin(item)}>
                  {isPinned ? '📌 Pinned' : '📌 Pin'}
                </button>
              )}
            </div>
            <div class="item-actions-right">
              <span style="font-size: 11px; color: var(--text-muted);">Container:</span>
              <select
                class="item-container-select"
                value={item.listId ?? 'default'}
                onChange={e => onMoveToList(item.id!, (e.target as HTMLSelectElement).value)}
                aria-label="Change item container"
              >
                {itemLists.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button class="cs-btn-small danger" onClick={() => onDelete(item.id!)}>🗑️ Delete</button>
            </div>
          </div>

          {isEditing && editFields && (
            <div class="item-edit-form">
              <div class="item-edit-row">
                <div class="item-edit-field flex2">
                  <label>Name</label>
                  <input type="text" class="hp-modal-input" value={editFields.name ?? ''} style="width:100%;margin:0;"
                    onInput={e => setEditFields({ ...editFields, name: (e.target as HTMLInputElement).value })} />
                </div>
                <div class="item-edit-field flex1">
                  <label>Weight (lbs)</label>
                  <input type="number" step="0.1" class="hp-modal-input" value={editFields.weight ?? 0} style="width:100%;margin:0;"
                    onInput={e => setEditFields({ ...editFields, weight: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
                </div>
                <div class="item-edit-field flex1">
                  <label>Quantity</label>
                  <div class="item-qty-adjuster">
                    <button onClick={() => onUpdateQty(item.id!, (item.quantity ?? 1) - 1)}>-</button>
                    <input type="number" value={item.quantity ?? 1}
                      onChange={e => onUpdateQty(item.id!, parseInt((e.target as HTMLInputElement).value) || 1)} />
                    <button onClick={() => onUpdateQty(item.id!, (item.quantity ?? 1) + 1)}>+</button>
                  </div>
                </div>
              </div>
              <div class="item-edit-row">
                <div class="item-edit-field flex1">
                  <label>Type</label>
                  <select class="hp-modal-input" value={editFields.type ?? 'Gear'} style="width:100%;margin:0;"
                    onChange={e => setEditFields({ ...editFields, type: (e.target as HTMLSelectElement).value })}>
                    <option value="Gear">Gear</option>
                    <option value="Weapon">Weapon</option>
                    <option value="Armor">Armor</option>
                    <option value="Shield">Shield</option>
                    <option value="Consumable">Consumable</option>
                  </select>
                </div>
                <div class="item-edit-field" style="justify-content:center; margin-top:14px;">
                  <input type="checkbox" id={`attune-edit-${item.id}`} checked={editFields.requiresAttunement ?? false}
                    onChange={e => setEditFields({ ...editFields, requiresAttunement: (e.target as HTMLInputElement).checked })} />
                  <label for={`attune-edit-${item.id}`} style="font-size:11px; color:var(--text-secondary);">Requires Attunement</label>
                </div>
              </div>
            </div>
          )}

          <div class="inline-html-content" dangerouslySetInnerHTML={{ __html: getDetailHTMLContent(item) }} />
        </div>
      )}
    </div>
  );
}

// ─── Per-list section ─────────────────────────────────────────────────────────

interface ItemListSectionProps {
  listDef: any;
  items: EquipmentItem[];
  allEquipment: EquipmentItem[];
  allLists: any[];
  weightEnabled: boolean;
  pinnedActions: any[];
  onCycleState: (item: EquipmentItem) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onMoveToList: (id: string, listId: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (item: EquipmentItem) => void;
  onSync: (item: EquipmentItem) => void;
  onAddFromCompendium: (listId: string) => void;
}

function ItemListSection({
  listDef, items, allEquipment, allLists, weightEnabled, pinnedActions,
  onCycleState, onUpdateQty, onMoveToList, onDelete, onTogglePin, onSync, onAddFromCompendium
}: ItemListSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const totalWeight = items.reduce((acc, i) => acc + (parseFloat(String(i.weight)) || 0) * (i.quantity ?? 1), 0);
  const equippedCount = items.filter(i => i.active).length;
  const carriedCount = items.filter(i => !i.active && i.selected).length;

  let meta = `${items.length} item${items.length !== 1 ? 's' : ''}`;
  if (weightEnabled) meta = `${totalWeight.toFixed(1)} lbs · ${meta}`;
  if (equippedCount > 0) meta += ` · ${equippedCount} equipped`;
  if (carriedCount > 0) meta += ` · ${carriedCount} carried`;

  return (
    <div class="item-list-section">
      <div class="item-list-section-header" onClick={() => setCollapsed(c => !c)}>
        <span class="item-list-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
        <h3 class="item-list-name">{listDef.name}</h3>
        <span class="item-list-meta">{meta}</span>
        <button
          class="cs-btn-small secondary"
          style="margin-left: auto; font-size: 11px; padding: 2px 8px;"
          onClick={e => { e.stopPropagation(); onAddFromCompendium(listDef.id); }}
          title="Add item from compendium to this list"
        >
          + Add
        </button>
      </div>

      {!collapsed && (
        <div class="item-list-body">
          {items.length === 0 ? (
            <div class="item-list-empty">Empty. Click + Add to search compendium.</div>
          ) : (
            items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                equipment={allEquipment}
                itemLists={allLists}
                isPinned={pinnedActions.some((p: any) => p.sourceList === 'equipment' && p.sourceId === item.name)}
                weightEnabled={weightEnabled}
                onCycleState={onCycleState}
                onUpdateQty={onUpdateQty}
                onMoveToList={onMoveToList}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
                onSync={onSync}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function InventoryTab() {
  const characterVal = currentCharacter.value;
  const state = charState.value;

  if (!characterVal || !state) {
    return <div class="combat-placeholder">Open a character sheet to get started.</div>;
  }

  const char = characterVal;

  const [showCurrencyEdit, setShowCurrencyEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Custom Item Creator fields
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState(0);
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemType, setNewItemType] = useState('Gear');
  const [newItemAttune, setNewItemAttune] = useState(false);
  const [newItemListId, setNewItemListId] = useState(char.itemLists?.[0]?.id ?? 'default');
  // Weapon fields
  const [newItemDmg, setNewItemDmg] = useState('1d6');
  const [newItemDmgType, setNewItemDmgType] = useState('piercing');
  const [newItemProps, setNewItemProps] = useState('');
  // Armor fields
  const [newItemAC, setNewItemAC] = useState(10);
  // Modifiers
  const [newItemMods, setNewItemMods] = useState<Modifier[]>([]);

  const equipment = (char.equipment ?? []) as EquipmentItem[];
  const itemLists = char.itemLists ?? [];
  const weightEnabled = char.weightTrackingEnabled ?? false;
  const attuneMax = char.attunementMax ?? 3;

  // Totals
  let totalWeight = 0;
  equipment.forEach(item => {
    if (item.active || item.selected) {
      totalWeight += (parseFloat(String(item.weight)) || 0) * (item.quantity ?? 1);
    }
  });

  const strScore = state['str.score']?.total ?? char.baseStats.str;
  const maxWeight = strScore * 15;
  const isOverburdened = totalWeight > maxWeight;
  const attunedCount = equipment.filter(e => e.active && e.requiresAttunement).length;

  // Filter by search query
  const filteredEquipment = equipment.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (item.name ?? '').toLowerCase().includes(q)
      || (item.type ?? '').toLowerCase().includes(q)
      || (item.texts ?? []).some(t => t.toLowerCase().includes(q));
  });

  // ── Mutation helpers ──────────────────────────────────────────────────────

  function handleCycleState(item: EquipmentItem) {
    const updated = equipment.map(i => {
      if (i.id !== item.id) return i;
      
      const isEquipped = !!i.active;
      const isCarried = !i.active && !!i.selected;
      
      if (!isEquipped && !isCarried) {
        // Not Carried (○) -> Carried (●)
        return { ...i, active: false, selected: true };
      } else if (isCarried) {
        // Carried (●) -> Equipped (🛡️)
        return { ...i, active: true, selected: true };
      } else {
        // Equipped (🛡️) -> Not Carried (○)
        return { ...i, active: false, selected: false };
      }
    });
    patchCharacter({ equipment: updated });
  }

  function handleUpdateQty(itemId: string, qty: number) {
    const updated = equipment.map(i => i.id === itemId ? { ...i, quantity: Math.max(1, qty) } : i);
    patchCharacter({ equipment: updated });
  }

  function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to remove this item?')) return;
    patchCharacter({ equipment: equipment.filter(i => i.id !== itemId) });
  }

  function handleMoveToList(itemId: string, listId: string) {
    patchCharacter({ equipment: equipment.map(i => i.id === itemId ? { ...i, listId } : i) });
  }

  function handleTogglePin(item: EquipmentItem) {
    const pinned = char.pinnedActions ?? [];
    const isPinned = pinned.some((p: any) => p.sourceList === 'equipment' && p.sourceId === item.name);
    const updated = isPinned
      ? pinned.filter((p: any) => !(p.sourceList === 'equipment' && p.sourceId === item.name))
      : [...pinned, { sourceList: 'equipment' as const, sourceId: item.name }];
    patchCharacter({ pinnedActions: updated });
  }

  function handleSync(item: EquipmentItem) {
    (window as any).syncLocalEntityWithCompendium?.(item, 'items');
  }

  function handleAddFromCompendium(listId: string | null) {
    (window as any).__legacyOpenPicker?.('items', listId);
  }

  function handleCreateCustomItem() {
    const name = newItemName.trim();
    if (!name) return;

    const isWeapon = newItemType === 'Weapon';
    const isArmor  = newItemType === 'Armor';
    const isShield = newItemType === 'Shield';

    const newItem: EquipmentItem = {
      id: generateId(),
      name,
      weight: newItemWeight,
      quantity: newItemQty,
      type: newItemType,
      requiresAttunement: newItemAttune,
      listId: newItemListId,
      active: false,
      selected: true,
      source: 'Custom',
      texts: ['Custom item.'],
      weapon: isWeapon,
      armor: isArmor,
      shield: isShield,
      ...(isWeapon && newItemDmg ? { dmg1: newItemDmg, dmgType: newItemDmgType } : {}),
      ...(isWeapon && newItemProps.trim() ? { properties: newItemProps.split(',').map(p => p.trim()).filter(Boolean) } : {}),
      ...(isArmor || isShield ? { ac: newItemAC } : {}),
      ...(newItemMods.length > 0 ? { modifiers: newItemMods } : {}),
    };

    patchCharacter({ equipment: [...equipment, newItem] });

    // Reset
    setNewItemName('');
    setNewItemWeight(0);
    setNewItemQty(1);
    setNewItemType('Gear');
    setNewItemAttune(false);
    setNewItemDmg('1d6');
    setNewItemDmgType('piercing');
    setNewItemProps('');
    setNewItemAC(10);
    setNewItemMods([]);
    setShowCustomCreator(false);
  }

  function addMod() {
    setNewItemMods([...newItemMods, { target: 'str.score', type: 'add', value: 0 }]);
  }

  function updateMod(idx: number, field: keyof Modifier, val: any) {
    setNewItemMods(newItemMods.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  }

  function removeMod(idx: number) {
    setNewItemMods(newItemMods.filter((_, i) => i !== idx));
  }

  const currency = char.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

  return (
    <div class="inventory-tab-root">

      {/* ── Currency Row ── */}
      <div class="currency-row">
        <div class="coins-display">
          {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map(k => (
            <div key={k} class="coin-badge">
              <span class={`coin-label ${k}`}>{k.toUpperCase()}</span>
              <span class="coin-val">{currency[k] ?? 0}</span>
            </div>
          ))}
        </div>
        <button class="btn-header-action" onClick={() => setShowCurrencyEdit(!showCurrencyEdit)}>
          {showCurrencyEdit ? 'Close Editor' : 'Edit Currency'}
        </button>
      </div>

      {showCurrencyEdit && <CurrencyEditor character={char} />}

      {/* ── Capacity & Attunement Bar ── */}
      <div class="load-attune-row">
        <div class={`load-display ${isOverburdened && weightEnabled ? 'overburdened' : ''}`}>
          ⚖️ Load:{' '}
          {weightEnabled
            ? <>{totalWeight.toFixed(1)} / {maxWeight} lbs{isOverburdened && <span class="capacity-indicator">Overburdened</span>}</>
            : 'Disabled'
          }
        </div>
        <div class="attune-display">
          Attuned: {attunedCount} / {attuneMax}
        </div>
        <button class="btn-header-action" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? 'Close Settings' : '⚙️ Settings'}
        </button>
      </div>

      {showSettings && <SettingsPanel character={char} />}

      {/* ── Search Bar ── */}
      <div class="cs-search-row" style="margin: 0;">
        <input
          type="text"
          class="cs-search-input"
          placeholder="Search inventory..."
          value={searchQuery}
          onInput={e => setSearchQuery((e.target as HTMLInputElement).value)}
          aria-label="Search inventory"
        />
      </div>

      {/* ── Per-list sections ── */}
      {itemLists.map((listDef: any) => {
        const listItems = filteredEquipment.filter(i =>
          i.listId === listDef.id || (!i.listId && listDef.id === (itemLists[0] as any)?.id)
        );
        return (
          <ItemListSection
            key={listDef.id}
            listDef={listDef}
            items={listItems}
            allEquipment={equipment}
            allLists={itemLists}
            weightEnabled={weightEnabled}
            pinnedActions={char.pinnedActions ?? []}
            onCycleState={handleCycleState}
            onUpdateQty={handleUpdateQty}
            onMoveToList={handleMoveToList}
            onDelete={handleDeleteItem}
            onTogglePin={handleTogglePin}
            onSync={handleSync}
            onAddFromCompendium={handleAddFromCompendium}
          />
        );
      })}

      {/* Items with no matching list (safety net) */}
      {(() => {
        const validListIds = new Set(itemLists.map((l: any) => l.id));
        const orphans = filteredEquipment.filter(i => i.listId && !validListIds.has(i.listId));
        return orphans.length > 0 ? (
          <ItemListSection
            listDef={{ id: '__orphan__', name: 'Uncategorized' }}
            items={orphans}
            allEquipment={equipment}
            allLists={itemLists}
            weightEnabled={weightEnabled}
            pinnedActions={char.pinnedActions ?? []}
            onCycleState={handleCycleState}
            onUpdateQty={handleUpdateQty}
            onMoveToList={handleMoveToList}
            onDelete={handleDeleteItem}
            onTogglePin={handleTogglePin}
            onSync={handleSync}
            onAddFromCompendium={handleAddFromCompendium}
          />
        ) : null;
      })()}

      {/* ── Bottom Controls ── */}
      <div class="inventory-bottom-controls">
        <button class="cs-btn-main" onClick={() => handleAddFromCompendium(null)}>
          + Add from Compendium
        </button>
        <button class="cs-btn-main" onClick={() => setShowCustomCreator(!showCustomCreator)}>
          {showCustomCreator ? 'Cancel' : '+ Create Custom Item'}
        </button>
      </div>

      {/* ── Custom Item Creator ── */}
      {showCustomCreator && (
        <div class="custom-item-creator">
          <h4 style="margin: 0 0 8px; font-size: 13px; color: var(--text-primary);">Create Custom Item</h4>

          {/* Basic fields */}
          <div class="custom-item-form-grid">
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Item Name *</label>
              <input type="text" class="hp-modal-input" style="width:100%;margin:0;" placeholder="e.g. Iron Spike"
                value={newItemName} onInput={e => setNewItemName((e.target as HTMLInputElement).value)} autoFocus />
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Weight (lbs)</label>
              <input type="number" step="0.1" class="hp-modal-input" style="width:100%;margin:0;" placeholder="0.0"
                value={newItemWeight} onInput={e => setNewItemWeight(parseFloat((e.target as HTMLInputElement).value) || 0)} />
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Quantity</label>
              <input type="number" min="1" class="hp-modal-input" style="width:100%;margin:0;" value={newItemQty}
                onInput={e => setNewItemQty(parseInt((e.target as HTMLInputElement).value) || 1)} />
            </div>
          </div>

          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-top:8px;">
            <div style="flex:1; min-width:120px;">
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Type</label>
              <select class="hp-modal-input" style="width:100%;margin:0;" value={newItemType}
                onChange={e => setNewItemType((e.target as HTMLSelectElement).value)}>
                <option value="Gear">Gear</option>
                <option value="Weapon">Weapon</option>
                <option value="Armor">Armor</option>
                <option value="Shield">Shield</option>
                <option value="Consumable">Consumable</option>
              </select>
            </div>
            <div style="flex:1; min-width:120px;">
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Assign to List</label>
              <select class="hp-modal-input" style="width:100%;margin:0;" value={newItemListId}
                onChange={e => setNewItemListId((e.target as HTMLSelectElement).value)}>
                {itemLists.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px; padding-bottom:4px;">
              <input type="checkbox" id="new-item-attune" checked={newItemAttune}
                onChange={e => setNewItemAttune((e.target as HTMLInputElement).checked)} />
              <label for="new-item-attune" style="font-size:11px; color:var(--text-secondary);">Requires Attunement</label>
            </div>
          </div>

          {/* Weapon-specific fields */}
          {newItemType === 'Weapon' && (
            <div style="margin-top:8px; padding:8px; background:rgba(0,0,0,0.15); border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:6px;">Weapon Properties</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <div style="flex:1; min-width:90px;">
                  <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:2px;">Damage Dice</label>
                  <select class="hp-modal-input" style="width:100%;margin:0;" value={newItemDmg}
                    onChange={e => setNewItemDmg((e.target as HTMLSelectElement).value)}>
                    {DAMAGE_DICE.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style="flex:1; min-width:110px;">
                  <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:2px;">Damage Type</label>
                  <select class="hp-modal-input" style="width:100%;margin:0;" value={newItemDmgType}
                    onChange={e => setNewItemDmgType((e.target as HTMLSelectElement).value)}>
                    {DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style="flex:2; min-width:150px;">
                  <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:2px;">Properties (comma-separated)</label>
                  <input type="text" class="hp-modal-input" style="width:100%;margin:0;" placeholder="e.g. Finesse, Light"
                    value={newItemProps} onInput={e => setNewItemProps((e.target as HTMLInputElement).value)} />
                </div>
              </div>
            </div>
          )}

          {/* Armor/Shield-specific fields */}
          {(newItemType === 'Armor' || newItemType === 'Shield') && (
            <div style="margin-top:8px; padding:8px; background:rgba(0,0,0,0.15); border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:6px;">Armor Properties</div>
              <div style="display:flex; gap:8px;">
                <div style="flex:1; min-width:80px;">
                  <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:2px;">
                    {newItemType === 'Shield' ? 'AC Bonus' : 'AC Base'}
                  </label>
                  <input type="number" min="0" max="30" class="hp-modal-input" style="width:100%;margin:0;"
                    value={newItemAC} onInput={e => setNewItemAC(parseInt((e.target as HTMLInputElement).value) || 0)} />
                </div>
              </div>
            </div>
          )}

          {/* Modifiers section */}
          <div style="margin-top:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <span style="font-size:11px; color:var(--text-muted); font-weight:600;">Modifiers (while equipped)</span>
              <button class="cs-btn-small secondary" onClick={addMod} style="font-size:10px; padding:2px 8px;">+ Add Modifier</button>
            </div>
            {newItemMods.map((mod, idx) => (
              <div key={idx} style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
                <select class="hp-modal-input" style="flex:2; margin:0; font-size:11px;" value={mod.target}
                  onChange={e => updateMod(idx, 'target', (e.target as HTMLSelectElement).value)}>
                  {STAT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <select class="hp-modal-input" style="flex:1; margin:0; font-size:11px;" value={mod.type}
                  onChange={e => updateMod(idx, 'type', (e.target as HTMLSelectElement).value as 'add' | 'set')}>
                  <option value="add">+/- (add)</option>
                  <option value="set">= (set to)</option>
                </select>
                <input type="number" class="hp-modal-input" style="flex:1; margin:0; font-size:11px;" value={mod.value as number}
                  onInput={e => updateMod(idx, 'value', parseInt((e.target as HTMLInputElement).value) || 0)} />
                <button class="cs-btn-small danger" style="padding:2px 6px;" onClick={() => removeMod(idx)}>✕</button>
              </div>
            ))}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
            <button class="cs-btn-small secondary" onClick={() => setShowCustomCreator(false)}>Cancel</button>
            <button class="cs-btn-small" onClick={handleCreateCustomItem}>Create Item</button>
          </div>
        </div>
      )}
    </div>
  );
}
