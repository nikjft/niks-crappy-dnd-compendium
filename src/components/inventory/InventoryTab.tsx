import { useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { currentCharacter, charState, expandedRowId, patchCharacter } from '../../state/stores.js';
import { CurrencyEditor } from './CurrencyEditor.js';
import { SettingsPanel } from './SettingsPanel.js';
import type { Character, EquipmentItem } from '../../data/types.js';
import '../../inventory.css';

const generateId = () => Math.random().toString(36).substring(2, 11);

export function InventoryTab() {
  const characterVal = currentCharacter.value;
  const state = charState.value;

  if (!characterVal || !state) {
    return <div class="combat-placeholder">Open a character sheet to get started.</div>;
  }

  const char = characterVal;

  // Local UI toggle states
  const [showCurrencyEdit, setShowCurrencyEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomCreator, setShowCustomCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverTier, setDragOverTier] = useState<'equipped' | 'carried' | 'stored' | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemFields, setEditingItemFields] = useState<Partial<EquipmentItem> | null>(null);

  // Custom Item Creator form fields
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState(0);
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemType, setNewItemType] = useState('Gear');
  const [newItemAttune, setNewItemAttune] = useState(false);
  const [newItemListId, setNewItemListId] = useState(char.itemLists?.[0]?.id ?? 'default');

  const equipment = (char.equipment ?? []) as EquipmentItem[];
  const itemLists = char.itemLists ?? [];
  const weightEnabled = char.weightTrackingEnabled ?? false;
  const attuneMax = char.attunementMax ?? 3;

  // 1. Calculate active weight (Equipped + Carried items)
  let totalWeight = 0;
  equipment.forEach(item => {
    if (item.active || item.selected) {
      const w = parseFloat(String(item.weight)) || 0;
      const q = item.quantity ?? 1;
      totalWeight += w * q;
    }
  });

  const strScore = state['str.score']?.total ?? char.baseStats.str;
  const maxWeight = strScore * 15;
  const isOverburdened = totalWeight > maxWeight;

  // 2. Count active attuned items
  const attunedCount = equipment.filter(e => e.active && e.requiresAttunement).length;

  // 3. Filter items by search query
  const filteredEquipment = equipment.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (item.name ?? '').toLowerCase().includes(q);
    const textMatch = (item.texts ?? []).some(t => t.toLowerCase().includes(q));
    const typeMatch = (item.type ?? '').toLowerCase().includes(q);
    return nameMatch || textMatch || typeMatch;
  });

  // Tiers grouping
  const equippedItems = filteredEquipment.filter(item => item.active);
  const carriedItems = filteredEquipment.filter(item => !item.active && item.selected);
  const storedItems = filteredEquipment.filter(item => !item.active && !item.selected);

  // Helpers
  function cycleItemState(item: EquipmentItem) {
    const updated = equipment.map(i => {
      if (i.id !== item.id) return i;
      if (i.active) {
        // Equipped -> Carried
        return { ...i, active: false, selected: true };
      } else if (i.selected) {
        // Carried -> Stored
        return { ...i, active: false, selected: false };
      } else {
        // Stored -> Equipped
        return { ...i, active: true, selected: true };
      }
    });
    patchCharacter({ equipment: updated });
  }

  function handleUpdateQty(itemId: string, qty: number) {
    const val = Math.max(1, qty);
    const updated = equipment.map(i => (i.id === itemId ? { ...i, quantity: val } : i));
    patchCharacter({ equipment: updated });
  }

  function handleMoveItemToTier(itemId: string, tier: 'equipped' | 'carried' | 'stored') {
    const updated = equipment.map(i => {
      if (i.id !== itemId) return i;
      if (tier === 'equipped') {
        return { ...i, active: true, selected: true };
      } else if (tier === 'carried') {
        return { ...i, active: false, selected: true };
      } else {
        return { ...i, active: false, selected: false };
      }
    });
    patchCharacter({ equipment: updated });
  }

  function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to remove this item?')) return;
    const updated = equipment.filter(i => i.id !== itemId);
    patchCharacter({ equipment: updated });
  }

  function handleMoveToList(itemId: string, listId: string) {
    const updated = equipment.map(i => (i.id === itemId ? { ...i, listId } : i));
    patchCharacter({ equipment: updated });
  }

  function handleTogglePin(item: EquipmentItem) {
    const pinned = char.pinnedActions ?? [];
    const isPinned = pinned.some(p => p.sourceList === 'equipment' && p.sourceId === item.name);
    let updated;
    if (isPinned) {
      updated = pinned.filter(p => !(p.sourceList === 'equipment' && p.sourceId === item.name));
    } else {
      updated = [...pinned, { sourceList: 'equipment' as const, sourceId: item.name }];
    }
    patchCharacter({ pinnedActions: updated });
  }

  function handleSync(item: EquipmentItem) {
    if (typeof window !== 'undefined' && (window as any).syncLocalEntityWithCompendium) {
      (window as any).syncLocalEntityWithCompendium(item, 'items');
    }
  }

  function handleOpenPicker() {
    if (typeof window !== 'undefined' && (window as any).openPicker) {
      (window as any).openPicker('items', null);
    }
  }

  function handleCreateCustomItem() {
    const name = newItemName.trim();
    if (!name) return;

    const customId = generateId();
    const isWeapon = newItemType === 'Weapon';
    const isArmor = newItemType === 'Armor';
    const isShield = newItemType === 'Shield';

    const newItem: EquipmentItem = {
      id: customId,
      name,
      weight: newItemWeight,
      quantity: newItemQty,
      type: newItemType,
      requiresAttunement: newItemAttune,
      listId: newItemListId,
      active: false,
      selected: true, // starts in carried tier
      source: 'Custom',
      texts: ['Custom item created by player.'],
      weapon: isWeapon,
      armor: isArmor,
      shield: isShield
    };

    patchCharacter({
      equipment: [...equipment, newItem]
    });

    // Reset Form
    setNewItemName('');
    setNewItemWeight(0);
    setNewItemQty(1);
    setNewItemType('Gear');
    setNewItemAttune(false);
    setShowCustomCreator(false);
  }

  function handleStartEditing(item: EquipmentItem) {
    setEditingItemId(item.id!);
    setEditingItemFields({
      name: item.name,
      weight: item.weight,
      type: item.type,
      requiresAttunement: item.requiresAttunement
    });
  }

  function handleSaveProperties(itemId: string) {
    if (!editingItemFields) return;
    const updated = equipment.map(i => {
      if (i.id !== itemId) return i;
      const isWeapon = editingItemFields.type === 'Weapon';
      const isArmor = editingItemFields.type === 'Armor';
      const isShield = editingItemFields.type === 'Shield';
      return {
        ...i,
        ...editingItemFields,
        weapon: isWeapon,
        armor: isArmor,
        shield: isShield
      };
    });
    patchCharacter({ equipment: updated });
    setEditingItemId(null);
    setEditingItemFields(null);
  }

  // Drag and Drop Handlers
  const handleDragStart = (e: DragEvent, itemId: string) => {
    e.dataTransfer?.setData('text/plain', itemId);
  };

  const handleDragOver = (e: DragEvent, tier: 'equipped' | 'carried' | 'stored') => {
    e.preventDefault();
    if (dragOverTier !== tier) {
      setDragOverTier(tier);
    }
  };

  const handleDrop = (e: DragEvent, tier: 'equipped' | 'carried' | 'stored') => {
    e.preventDefault();
    const itemId = e.dataTransfer?.getData('text/plain');
    if (itemId) {
      handleMoveItemToTier(itemId, tier);
    }
    setDragOverTier(null);
  };

  // Display label helpers
  function getItemSubtext(item: EquipmentItem) {
    const parts: string[] = [];
    if (item.type) parts.push(item.type);
    if (item.ac) parts.push(`AC ${item.ac}`);
    if (item.bonusAc) parts.push(`AC +${item.bonusAc}`);
    if (item.dmg1) parts.push(`${item.dmg1} ${item.dmgType ?? ''}`);
    return parts.join(' · ');
  }

  function getDetailHTMLContent(item: EquipmentItem) {
    if (typeof window !== 'undefined' && (window as any).getDetailHTML) {
      return (window as any).getDetailHTML(item, 'items');
    }
    return `<p>${item.texts?.join('<br>') ?? 'No description.'}</p>`;
  }

  const currency = char.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  const listsMap = new Map(itemLists.map((l: any) => [l.id, l.name]));

  return (
    <div class="inventory-tab-root">
      
      {/* ── Currency Display & Edit Button ── */}
      <div class="currency-row">
        <div class="coins-display">
          <div class="coin-badge"><span class="coin-label pp">PP</span><span class="coin-val">{currency.pp ?? 0}</span></div>
          <div class="coin-badge"><span class="coin-label gp">GP</span><span class="coin-val">{currency.gp ?? 0}</span></div>
          <div class="coin-badge"><span class="coin-label ep">EP</span><span class="coin-val">{currency.ep ?? 0}</span></div>
          <div class="coin-badge"><span class="coin-label sp">SP</span><span class="coin-val">{currency.sp ?? 0}</span></div>
          <div class="coin-badge"><span class="coin-label cp">CP</span><span class="coin-val">{currency.cp ?? 0}</span></div>
        </div>
        <button class="btn-header-action" onClick={() => setShowCurrencyEdit(!showCurrencyEdit)}>
          {showCurrencyEdit ? 'Close Editor' : 'Edit Currency'}
        </button>
      </div>

      {showCurrencyEdit && <CurrencyEditor character={char} />}

      {/* ── Capacity & Attunement Status Bar ── */}
      <div class="load-attune-row">
        <div class={`load-display ${isOverburdened && weightEnabled ? 'overburdened' : ''}`}>
          ⚖️ Load:{' '}
          {weightEnabled ? (
            <>
              {totalWeight.toFixed(1)} / {maxWeight} lbs
              {isOverburdened && <span class="capacity-indicator">Overburdened</span>}
            </>
          ) : (
            'Disabled'
          )}
        </div>
        <div class="attune-display">
          <span>Attuned: {attunedCount} / {attuneMax}</span>
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

      {/* ── Tiers lists ── */}
      {(['equipped', 'carried', 'stored'] as const).map(tier => {
        const tierName = tier === 'equipped' ? 'Equipped (Active)'
                       : tier === 'carried' ? 'Carried (Selected)'
                       : 'Stored (in containers)';
        const items = tier === 'equipped' ? equippedItems
                    : tier === 'carried' ? carriedItems
                    : storedItems;

        const isOver = dragOverTier === tier;
        const totalItemsCount = items.reduce((acc, i) => acc + (i.quantity ?? 1), 0);
        const totalTierWeight = items.reduce((acc, i) => acc + (parseFloat(String(i.weight)) || 0) * (i.quantity ?? 1), 0);
        
        let metaLabel = `${totalItemsCount} item${totalItemsCount !== 1 ? 's' : ''}`;
        if (weightEnabled) {
          metaLabel = `${totalTierWeight.toFixed(1)} lbs · ${metaLabel}`;
        }

        return (
          <div
            key={tier}
            class={`inventory-tier-container ${isOver ? 'drag-over' : ''}`}
            onDragOver={e => handleDragOver(e, tier)}
            onDragLeave={() => setDragOverTier(null)}
            onDrop={e => handleDrop(e, tier)}
          >
            <div class="inventory-tier-header">
              <h3>
                {tier === 'equipped' ? '🛡️' : tier === 'carried' ? '🎒' : '📦'} {tierName}
              </h3>
              <span class="inventory-tier-header-meta">{metaLabel}</span>
            </div>

            <div class="inventory-tier-body">
              {items.length === 0 ? (
                <div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12px;">
                  {isOver ? 'Drop here!' : 'Empty. Drag items here to categorize.'}
                </div>
              ) : (
                items.map(item => {
                  const isExpanded = expandedRowId.value === item.id;
                  const isEditing = editingItemId === item.id;
                  const isPinned = (char.pinnedActions ?? []).some(
                    (p: any) => p.sourceList === 'equipment' && p.sourceId === item.name
                  );
                  const isAttunedRequired = !!item.requiresAttunement;

                  // State cyclist indicator label
                  let cyclistLabel = '○';
                  let cyclistClass = '';
                  if (item.active) {
                    if (isAttunedRequired) {
                      cyclistLabel = 'ⓐ';
                      cyclistClass = 'attuned';
                    } else {
                      cyclistLabel = 'ⓔ';
                      cyclistClass = 'equipped';
                    }
                  }

                  const containerName = listsMap.get(item.listId ?? '') ?? 'Inventory';

                  return (
                    <div
                      key={item.id}
                      class="item-row-group"
                      draggable
                      onDragStart={e => handleDragStart(e, item.id!)}
                    >
                      <div
                        class="item-table-row draggable-active"
                        onClick={() => expandedRowId.value = isExpanded ? null : (item.id ?? null)}
                      >
                        <div class="col-state-icon" onClick={e => e.stopPropagation()}>
                          <button
                            class={`state-toggle-btn ${cyclistClass}`}
                            onClick={() => cycleItemState(item)}
                            title="Cycle equipped state (Equipped -> Carried -> Stored)"
                            aria-label={`Cycle state for ${item.name}`}
                          >
                            {cyclistLabel}
                          </button>
                        </div>

                        <div class="col-item-details">
                          <div class="item-name-line">
                            <span style="font-weight: 600;">{item.name}</span>
                            {item.quantity && item.quantity > 1 && (
                              <span class="item-qty-badge">×{item.quantity}</span>
                            )}
                            {isAttunedRequired && (
                              <span class="item-badge-container">A</span>
                            )}
                          </div>
                          <div class="item-sub-line">
                            <span>{getItemSubtext(item)}</span>
                            {item.listId && item.listId !== 'default' && (
                              <span class="container-badge">({containerName})</span>
                            )}
                          </div>
                        </div>

                        <div class="col-item-meta">
                          {weightEnabled && item.weight != null && (
                            <span class="item-weight-display">
                              {((parseFloat(String(item.weight)) || 0) * (item.quantity ?? 1)).toFixed(1)} lbs
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded detail view */}
                      {isExpanded && (
                        <div class="item-row-breakdown">
                          
                          {/* Item Edit/Manage actions */}
                          <div class="item-detail-actions-row">
                            <div class="item-actions-left">
                              {isEditing ? (
                                <button
                                  class="cs-btn-small"
                                  onClick={() => handleSaveProperties(item.id!)}
                                >
                                  Save Properties
                                </button>
                              ) : (
                                <button
                                  class="cs-btn-small secondary"
                                  onClick={() => handleStartEditing(item)}
                                >
                                  ✏️ Edit
                                </button>
                              )}

                              {item.compendiumId && (
                                <button
                                  class="cs-btn-small secondary"
                                  onClick={() => handleSync(item)}
                                >
                                  🔄 Sync
                                </button>
                              )}

                              {(item.weapon || item.type === 'Consumable' || item.type === 'Gear') && (
                                <button
                                  class={`cs-btn-small secondary ${isPinned ? 'active' : ''}`}
                                  onClick={() => handleTogglePin(item)}
                                >
                                  {isPinned ? '📌 Pinned' : '📌 Pin'}
                                </button>
                              )}
                            </div>

                            <div class="item-actions-right">
                              <span style="font-size: 11px; color: var(--text-muted);">Container:</span>
                              <select
                                class="item-container-select"
                                value={item.listId ?? 'default'}
                                onChange={e => handleMoveToList(item.id!, (e.target as HTMLSelectElement).value)}
                                aria-label="Change item container"
                              >
                                {itemLists.map((l: any) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </select>
                              <button
                                class="cs-btn-small danger"
                                onClick={() => handleDeleteItem(item.id!)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>

                          {/* Inline properties editor */}
                          {isEditing && editingItemFields && (
                            <div style="padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px;">
                              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <div style="flex: 2; min-width: 150px;">
                                  <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Name</label>
                                  <input
                                    type="text"
                                    class="hp-modal-input"
                                    style="width: 100%; margin: 0;"
                                    value={editingItemFields.name ?? ''}
                                    onInput={e => setEditingItemFields({ ...editingItemFields, name: (e.target as HTMLInputElement).value })}
                                  />
                                </div>
                                <div style="flex: 1; min-width: 80px;">
                                  <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Weight (lbs)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    class="hp-modal-input"
                                    style="width: 100%; margin: 0;"
                                    value={editingItemFields.weight ?? 0}
                                    onInput={e => setEditingItemFields({ ...editingItemFields, weight: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                                  />
                                </div>
                                <div style="flex: 1; min-width: 80px;">
                                  <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Quantity</label>
                                  <div class="item-qty-adjuster" style="width: 100%; justify-content: space-between;">
                                    <button onClick={() => handleUpdateQty(item.id!, (item.quantity ?? 1) - 1)}>-</button>
                                    <input
                                      type="number"
                                      value={item.quantity ?? 1}
                                      onChange={e => handleUpdateQty(item.id!, parseInt((e.target as HTMLInputElement).value) || 1)}
                                    />
                                    <button onClick={() => handleUpdateQty(item.id!, (item.quantity ?? 1) + 1)}>+</button>
                                  </div>
                                </div>
                              </div>
                              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                <div style="flex: 1; min-width: 100px;">
                                  <label style="font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 2px;">Type</label>
                                  <select
                                    class="hp-modal-input"
                                    style="width: 100%; margin: 0;"
                                    value={editingItemFields.type ?? 'Gear'}
                                    onChange={e => setEditingItemFields({ ...editingItemFields, type: (e.target as HTMLSelectElement).value })}
                                  >
                                    <option value="Gear">Gear</option>
                                    <option value="Weapon">Weapon</option>
                                    <option value="Armor">Armor</option>
                                    <option value="Shield">Shield</option>
                                    <option value="Consumable">Consumable</option>
                                  </select>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; margin-top: 14px;">
                                  <input
                                    type="checkbox"
                                    checked={editingItemFields.requiresAttunement ?? false}
                                    onChange={e => setEditingItemFields({ ...editingItemFields, requiresAttunement: (e.target as HTMLInputElement).checked })}
                                    id={`attune-${item.id}`}
                                  />
                                  <label for={`attune-${item.id}`} style="font-size: 11px; color: var(--text-secondary);">Requires Attunement</label>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Full HTML Description from compendium details */}
                          <div
                            class="inline-html-content"
                            dangerouslySetInnerHTML={{ __html: getDetailHTMLContent(item) }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* ── Bottom Controls ── */}
      <div class="inventory-bottom-controls">
        <button class="cs-btn-main" onClick={handleOpenPicker}>
          + Add from Compendium
        </button>
        <button class="cs-btn-main" onClick={() => setShowCustomCreator(!showCustomCreator)}>
          {showCustomCreator ? 'Cancel Custom' : '+ Create Custom Item'}
        </button>
      </div>

      {/* ── Custom Item Creator ── */}
      {showCustomCreator && (
        <div class="custom-item-creator">
          <h4 style="margin: 0; font-size: 13px; color: var(--text-primary);">Create Custom Item</h4>
          <div class="custom-item-form-grid">
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Item Name</label>
              <input
                type="text"
                class="hp-modal-input"
                style="width: 100%; margin: 0;"
                placeholder="e.g. Iron Spike"
                value={newItemName}
                onInput={e => setNewItemName((e.target as HTMLInputElement).value)}
                autoFocus
              />
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                class="hp-modal-input"
                style="width: 100%; margin: 0;"
                placeholder="0.0"
                value={newItemWeight}
                onInput={e => setNewItemWeight(parseFloat((e.target as HTMLInputElement).value) || 0)}
              />
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Quantity</label>
              <input
                type="number"
                min="1"
                class="hp-modal-input"
                style="width: 100%; margin: 0;"
                placeholder="1"
                value={newItemQty}
                onInput={e => setNewItemQty(parseInt((e.target as HTMLInputElement).value) || 1)}
              />
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 120px;">
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Item Type</label>
              <select
                class="hp-modal-input"
                style="width: 100%; margin: 0;"
                value={newItemType}
                onChange={e => setNewItemType((e.target as HTMLSelectElement).value)}
              >
                <option value="Gear">Gear</option>
                <option value="Weapon">Weapon</option>
                <option value="Armor">Armor</option>
                <option value="Shield">Shield</option>
                <option value="Consumable">Consumable</option>
              </select>
            </div>
            <div style="flex: 1; min-width: 120px;">
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Assign to List</label>
              <select
                class="hp-modal-input"
                style="width: 100%; margin: 0;"
                value={newItemListId}
                onChange={e => setNewItemListId((e.target as HTMLSelectElement).value)}
              >
                {itemLists.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 14px;">
              <input
                type="checkbox"
                checked={newItemAttune}
                onChange={e => setNewItemAttune((e.target as HTMLInputElement).checked)}
                id="new-item-attune"
              />
              <label for="new-item-attune" style="font-size: 11px; color: var(--text-secondary);">Requires Attunement</label>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="cs-btn-small secondary" onClick={() => setShowCustomCreator(false)}>Cancel</button>
            <button class="cs-btn-small" onClick={handleCreateCustomItem}>Create</button>
          </div>
        </div>
      )}

    </div>
  );
}
