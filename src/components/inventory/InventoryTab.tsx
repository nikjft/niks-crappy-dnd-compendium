import { useState, useRef } from 'preact/hooks';
import { currentCharacter, charState, expandedRowId, patchCharacter, jsonEditorState } from '../../state/stores.js';
import { CurrencyEditor } from './CurrencyEditor.js';
import type { Character, EquipmentItem } from '../../data/types.js';
import '../../inventory.css';

const generateId = () => Math.random().toString(36).substring(2, 11);


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

  const isAttunedRequired = !!item.requiresAttunement;
  const isWeapon = !!(item.weapon || (item.type && item.type.includes('Weapon')) || item.dmg1);
  const isEquipped = !!item.active;
  const isCarried = !item.active && !!item.selected;
  const isMainHand = isEquipped && isWeapon && item.equippedSlot !== 'off';
  const isOffHand = isEquipped && isWeapon && item.equippedSlot === 'off';

  function getDetailHTMLContent(item: EquipmentItem) {
    if (typeof window !== 'undefined' && (window as any).getDetailHTML) {
      return (window as any).getDetailHTML(item, 'items');
    }
    return `<p>${item.texts?.join('<br>') ?? 'No description.'}</p>`;
  }

  function openJsonEdit() {
    jsonEditorState.value = {
      title: `Edit: ${item.name}`,
      value: item,
      onSave: (updated) => {
        patchCharacter({ equipment: equipment.map(i => i.id === item.id ? { ...i, ...(updated as EquipmentItem) } : i) });
      },
    };
  }

  function getItemSubtext() {
    const parts: string[] = [];
    if (item.type) parts.push(item.type);
    if (item.ac) parts.push(`AC ${item.ac}`);
    if (item.bonusAc) parts.push(`AC +${item.bonusAc}`);
    if (item.dmg1) parts.push(`${item.dmg1} ${item.dmgType ?? ''}`);
    return parts.join(' · ');
  }

  // Render the cycling icon:
  //   • Not carried  → empty circle (CSS only, no icon element needed)
  //   • Carried      → filled circle (CSS only)
  //   • Non-weapon equipped → shield (filled)
  //   • Weapon main-hand   → sword icon
  //   • Weapon off-hand    → shield icon
  function renderStateIcon() {
    if (isMainHand) {
      return (
        <span class="material-icons-outlined state-icon"
          style="font-size: 14px; color: var(--accent-color); font-variation-settings: 'FILL' 1;">
          swords
        </span>
      );
    }
    if (isOffHand || (isEquipped && !isWeapon)) {
      return (
        <span class="material-icons-outlined state-icon"
          style="font-size: 14px; color: var(--accent-color); font-variation-settings: 'FILL' 1;">
          shield
        </span>
      );
    }
    return null;
  }

  // Title for the cycle button
  function cycleBtnTitle() {
    if (!isEquipped && !isCarried) return `${item.name}: not carried — click to carry`;
    if (isCarried) return isWeapon ? `${item.name}: carried — click to equip main-hand` : `${item.name}: carried — click to equip`;
    if (isMainHand) return `${item.name}: main-hand — click to equip off-hand`;
    if (isOffHand) return `${item.name}: off-hand — click to uncarry`;
    return `${item.name}: equipped — click to uncarry`;
  }

  return (
    <div class="item-row-group">
      <div
        class="item-table-row"
        onClick={() => { expandedRowId.value = isExpanded ? null : (item.id ?? null); }}
      >
        <div class="col-state-icon" onClick={e => e.stopPropagation()}>
          <button
            class={`item-cycle-btn ${isMainHand ? 'main-hand' : isOffHand ? 'off-hand' : isEquipped ? 'equipped' : isCarried ? 'carried' : 'uncarried'}`}
            onClick={() => onCycleState(item)}
            aria-label={cycleBtnTitle()}
            title={cycleBtnTitle()}
          >
            {renderStateIcon()}
          </button>
        </div>

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
        </div>
      </div>

      {/* Expanded detail view */}
      {isExpanded && (
        <div class="item-row-breakdown">
          <div class="item-detail-actions-row">
            <div class="item-actions-left">
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
            </div>
            <div class="item-actions-right">
              <button class="cs-btn-small" onClick={openJsonEdit}>
                <span class="material-icons-outlined" style="font-size: 11px;">edit</span> Edit
              </button>
              {item.compendiumId && (
                <button class="cs-btn-small" onClick={() => onSync(item)}>
                  <span class="material-icons-outlined" style="font-size: 11px;">sync</span> Sync
                </button>
              )}
              {(item.weapon || item.type === 'Consumable' || item.type === 'Gear') && (
                <button class={`cs-btn-small${isPinned ? ' active' : ''}`} onClick={() => onTogglePin(item)}>
                  <span class="material-icons-outlined" style="font-size: 11px;">push_pin</span> {isPinned ? 'Pinned' : 'Pin'}
                </button>
              )}
              <button class="cs-btn-small danger" onClick={() => onDelete(item.id!)}>
                <span class="material-icons-outlined" style="font-size: 11px;">delete</span> Delete
              </button>
            </div>
          </div>

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
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCycleState: (item: EquipmentItem) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onMoveToList: (id: string, listId: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (item: EquipmentItem) => void;
  onSync: (item: EquipmentItem) => void;
  onAddFromCompendium: (listId: string) => void;
  onConfigList?: (listDef: any) => void;
}

function ItemListSection({
  listDef, items, allEquipment, allLists, weightEnabled, pinnedActions,
  collapsed, onToggleCollapse,
  onCycleState, onUpdateQty, onMoveToList, onDelete, onTogglePin, onSync,
  onAddFromCompendium, onConfigList
}: ItemListSectionProps) {

  const totalWeight = items.reduce((acc, i) => acc + (parseFloat(String(i.weight)) || 0) * (i.quantity ?? 1), 0);
  const equippedCount = items.filter(i => i.active).length;
  const carriedCount = items.filter(i => !i.active && i.selected).length;

  let meta = `${items.length} item${items.length !== 1 ? 's' : ''}`;
  if (weightEnabled) meta = `${totalWeight.toFixed(1)} lbs · ${meta}`;
  if (equippedCount > 0) meta += ` · ${equippedCount} equipped`;
  if (carriedCount > 0) meta += ` · ${carriedCount} carried`;

  return (
    <div class="item-list-section">
      <div class="item-list-section-header" onClick={onToggleCollapse}>
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
        {onConfigList && listDef.id !== '__orphan__' && (
          <button
            class="cs-btn-small secondary"
            style="font-size: 11px; padding: 2px 8px;"
            onClick={e => { e.stopPropagation(); onConfigList(listDef); }}
            title="Rename or delete this list"
          >
            ⚙
          </button>
        )}
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
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const draggingListId = useRef<string | null>(null);

  const equipment = (char.equipment ?? []) as EquipmentItem[];
  const itemLists = char.itemLists ?? [];
  const weightEnabled = char.weightTrackingEnabled ?? false;
  const collapsedLists: Record<string, boolean> = (char as any).collapsedLists ?? {};

  function toggleItemListCollapse(listId: string) {
    patchCharacter({ collapsedLists: { ...collapsedLists, [listId]: !collapsedLists[listId] } });
  }

  // ── Mutation helpers ──────────────────────────────────────────────────────

  function handleCycleState(item: EquipmentItem) {
    const updated = equipment.map(i => {
      if (i.id !== item.id) return i;

      const itemIsWeapon = !!(i.weapon || (i.type && i.type.includes('Weapon')) || i.dmg1);
      const equipped = !!i.active;
      const carried = !i.active && !!i.selected;
      const mainHand = equipped && itemIsWeapon && i.equippedSlot !== 'off';
      const offHand = equipped && itemIsWeapon && i.equippedSlot === 'off';

      if (itemIsWeapon) {
        // Weapons: Not Carried → Carried → Main-hand → Off-hand → Not Carried
        if (!equipped && !carried) {
          return { ...i, active: false, selected: true, equippedSlot: undefined };
        } else if (carried) {
          return { ...i, active: true, selected: true, equippedSlot: 'main' as const };
        } else if (mainHand) {
          return { ...i, active: true, selected: true, equippedSlot: 'off' as const };
        } else {
          // offHand → Not Carried
          return { ...i, active: false, selected: false, equippedSlot: undefined };
        }
      } else {
        // Non-weapons: Not Carried → Carried → Equipped (shield) → Not Carried
        if (!equipped && !carried) {
          return { ...i, active: false, selected: true };
        } else if (carried) {
          return { ...i, active: true, selected: true };
        } else {
          return { ...i, active: false, selected: false };
        }
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

  function handleConfigList(listDef: any) {
    (window as any).__legacyOpenListConfig?.(listDef, 'item');
  }

  function handleAddList() {
    (window as any).__legacyAddItemList?.();
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

      {/* ── Per-list sections ── */}
      {itemLists.map((listDef: any) => {
        const listItems = equipment.filter(i =>
          i.listId === listDef.id || (!i.listId && listDef.id === (itemLists[0] as any)?.id)
        );
        return (
          <div
            key={listDef.id}
            class={dragOverListId === listDef.id ? 'list-drag-over' : undefined}
            draggable={true}
            onDragStart={e => {
              draggingListId.current = listDef.id;
              setTimeout(() => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }, 0);
            }}
            onDragEnd={e => {
              (e.currentTarget as HTMLElement).style.opacity = '';
              setDragOverListId(null);
              draggingListId.current = null;
            }}
            onDragOver={e => { e.preventDefault(); if (draggingListId.current !== listDef.id) setDragOverListId(listDef.id); }}
            onDragLeave={e => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOverListId(null); }}
            onDrop={e => {
              e.preventDefault();
              const fromId = draggingListId.current;
              if (!fromId || fromId === listDef.id) { setDragOverListId(null); return; }
              const lists = [...itemLists];
              const fromIdx = lists.findIndex((l: any) => l.id === fromId);
              const toIdx = lists.findIndex((l: any) => l.id === listDef.id);
              if (fromIdx < 0 || toIdx < 0) { setDragOverListId(null); return; }
              lists.splice(toIdx, 0, lists.splice(fromIdx, 1)[0]);
              patchCharacter({ itemLists: lists });
              setDragOverListId(null);
              draggingListId.current = null;
            }}
          >
            <ItemListSection
              listDef={listDef}
              items={listItems}
              allEquipment={equipment}
              allLists={itemLists}
              weightEnabled={weightEnabled}
              pinnedActions={char.pinnedActions ?? []}
              collapsed={!!collapsedLists[listDef.id]}
              onToggleCollapse={() => toggleItemListCollapse(listDef.id)}
              onCycleState={handleCycleState}
              onUpdateQty={handleUpdateQty}
              onMoveToList={handleMoveToList}
              onDelete={handleDeleteItem}
              onTogglePin={handleTogglePin}
              onSync={handleSync}
              onAddFromCompendium={handleAddFromCompendium}
              onConfigList={handleConfigList}
            />
          </div>
        );
      })}

      {/* Items with no matching list (safety net) */}
      {(() => {
        const validListIds = new Set(itemLists.map((l: any) => l.id));
        const orphans = equipment.filter(i => i.listId && !validListIds.has(i.listId));
        return orphans.length > 0 ? (
          <ItemListSection
            listDef={{ id: '__orphan__', name: 'Uncategorized' }}
            items={orphans}
            allEquipment={equipment}
            allLists={itemLists}
            weightEnabled={weightEnabled}
            pinnedActions={char.pinnedActions ?? []}
            collapsed={!!collapsedLists['__orphan__']}
            onToggleCollapse={() => toggleItemListCollapse('__orphan__')}
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

      {/* Bottom controls */}
      <div class="inventory-bottom-controls">
        <button class="cs-btn-small" onClick={handleAddList}>+ Add List</button>
      </div>

    </div>
  );
}
