import { useState } from 'preact/hooks';
import { currentCharacter, charState, expandedRowId, patchCharacter } from '../../state/stores.js';
import { CurrencyEditor } from './CurrencyEditor.js';
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
  { key: 'speed', label: 'Speed' }, { key: 'prof_bonus', label: 'Prof. Bonus' },
  { key: 'initiative', label: 'Initiative' },
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

  function addMod() {
    if (!editFields) return;
    const currentMods = editFields.modifiers ?? [];
    setEditFields({
      ...editFields,
      modifiers: [...currentMods, { target: 'str.score', type: 'add', value: 0 }]
    });
  }

  function updateMod(idx: number, field: string, val: any) {
    if (!editFields) return;
    const currentMods = editFields.modifiers ?? [];
    const updatedMods = currentMods.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    setEditFields({
      ...editFields,
      modifiers: updatedMods
    });
  }

  function removeMod(idx: number) {
    if (!editFields) return;
    const currentMods = editFields.modifiers ?? [];
    const updatedMods = currentMods.filter((_, i) => i !== idx);
    setEditFields({
      ...editFields,
      modifiers: updatedMods
    });
  }

  function handleSaveProperties() {
    if (!editFields) return;
    const isWeapon = editFields.type === 'Weapon';
    const isArmor  = editFields.type === 'Armor';
    const isShield = editFields.type === 'Shield';

    // Clean up properties depending on type
    const cleanedFields = { ...editFields };
    if (!isWeapon) {
      delete cleanedFields.dmg1;
      delete cleanedFields.dmg2;
      delete cleanedFields.dmgType;
      delete cleanedFields.bonusWeapon;
    }
    if (!isArmor && !isShield) {
      delete cleanedFields.ac;
      delete cleanedFields.bonusAc;
    }

    const updated = equipment.map(i =>
      i.id !== item.id ? i : { ...i, ...cleanedFields, weapon: isWeapon, armor: isArmor, shield: isShield }
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
        <span class="material-icons state-icon" style="font-size: 14px; color: var(--accent-color);">
          shield
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
                  setEditFields({
                    name: item.name,
                    weight: item.weight,
                    type: item.type,
                    requiresAttunement: item.requiresAttunement,
                    ac: item.ac,
                    bonusAc: item.bonusAc,
                    dmg1: item.dmg1,
                    dmg2: item.dmg2,
                    dmgType: item.dmgType,
                    bonusWeapon: item.bonusWeapon,
                    modifiers: item.modifiers ? JSON.parse(JSON.stringify(item.modifiers)) : []
                  });
                  setIsEditing(true);
                }}>
                  <span class="material-icons-outlined" style="font-size: 11px;">edit</span> Edit
                </button>
              )}
              {item.compendiumId && (
                <button class="cs-btn-small secondary" onClick={() => onSync(item)}>
                  <span class="material-icons-outlined" style="font-size: 11px;">sync</span> Sync
                </button>
              )}
              {(item.weapon || item.type === 'Consumable' || item.type === 'Gear') && (
                <button class={`cs-btn-small secondary ${isPinned ? 'active' : ''}`} onClick={() => onTogglePin(item)}>
                  <span class="material-icons-outlined" style="font-size: 11px;">push_pin</span> {isPinned ? 'Pinned' : 'Pin'}
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
              <button class="cs-btn-small danger" onClick={() => onDelete(item.id!)}>
                <span class="material-icons-outlined" style="font-size: 11px;">delete</span> Delete
              </button>
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

              {/* Weapon Specific Fields */}
              {editFields.type === 'Weapon' && (
                <div class="item-edit-row">
                  <div class="item-edit-field flex1">
                    <label>Weapon Bonus</label>
                    <input type="text" class="hp-modal-input" value={editFields.bonusWeapon ?? ''} placeholder="e.g. +1" style="width:100%;margin:0;"
                      onInput={e => setEditFields({ ...editFields, bonusWeapon: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div class="item-edit-field flex1">
                    <label>Damage 1</label>
                    <input type="text" class="hp-modal-input" value={editFields.dmg1 ?? ''} placeholder="e.g. 1d8" style="width:100%;margin:0;"
                      onInput={e => setEditFields({ ...editFields, dmg1: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div class="item-edit-field flex1">
                    <label>Damage 2</label>
                    <input type="text" class="hp-modal-input" value={editFields.dmg2 ?? ''} placeholder="e.g. 1d10" style="width:100%;margin:0;"
                      onInput={e => setEditFields({ ...editFields, dmg2: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div class="item-edit-field flex1">
                    <label>Damage Type</label>
                    <input type="text" class="hp-modal-input" value={editFields.dmgType ?? ''} placeholder="e.g. slashing" style="width:100%;margin:0;"
                      onInput={e => setEditFields({ ...editFields, dmgType: (e.target as HTMLInputElement).value })} />
                  </div>
                </div>
              )}

              {/* Armor / Shield Specific Fields */}
              {(editFields.type === 'Armor' || editFields.type === 'Shield') && (
                <div class="item-edit-row">
                  <div class="item-edit-field flex1">
                    <label>Base AC</label>
                    <input type="number" class="hp-modal-input" value={editFields.ac ?? 0} style="width:100%;margin:0;"
                      onInput={e => setEditFields({ ...editFields, ac: parseInt((e.target as HTMLInputElement).value) || 0 })} />
                  </div>
                  <div class="item-edit-field flex1">
                    <label>AC Bonus</label>
                    <input type="text" class="hp-modal-input" value={editFields.bonusAc ?? ''} placeholder="e.g. +2" style="width:100%;margin:0;"
                      onInput={e => setEditFields({ ...editFields, bonusAc: (e.target as HTMLInputElement).value })} />
                  </div>
                </div>
              )}

              {/* Modifiers Section */}
              <div class="feat-mods-section" style="margin-top:12px;">
                <div class="feat-mods-header" style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="feat-mods-title" style="font-size:11px; font-weight:600; color:var(--text-secondary);">Modifiers (when equipped)</span>
                  <button class="cs-btn-small secondary" onClick={addMod} style="font-size:10px; padding:2px 8px;">
                    + Add Modifier
                  </button>
                </div>
                {(editFields.modifiers ?? []).length === 0 && (
                  <div style="font-size:11px; color:var(--text-muted); font-style:italic; padding:4px 0;">
                    No modifiers. Click + Add Modifier to apply stat changes when equipped.
                  </div>
                )}
                {(editFields.modifiers ?? []).map((mod: any, idx: number) => (
                  <div key={idx} class="feat-mod-row" style="display:flex; gap:6px; margin-top:6px;">
                    <select
                      class="hp-modal-input"
                      style="flex:2; margin:0;"
                      value={mod.target}
                      onChange={e => updateMod(idx, 'target', (e.target as HTMLSelectElement).value)}
                    >
                      {STAT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <select
                      class="hp-modal-input"
                      style="flex:1.5; margin:0;"
                      value={mod.type}
                      onChange={e => updateMod(idx, 'type', (e.target as HTMLSelectElement).value)}
                    >
                      <option value="add">+/- (add)</option>
                      <option value="set">= (set to)</option>
                      <option value="min">min</option>
                      <option value="max">max</option>
                    </select>
                    <input
                      type="number"
                      class="hp-modal-input"
                      style="flex:1; margin:0; text-align:center;"
                      value={mod.value}
                      onInput={e => updateMod(idx, 'value', parseInt((e.target as HTMLInputElement).value) || 0)}
                    />
                    <button class="cs-btn-small danger" style="padding:2px 6px;" onClick={() => removeMod(idx)}>✕</button>
                  </div>
                ))}
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

  const equipment = (char.equipment ?? []) as EquipmentItem[];
  const itemLists = char.itemLists ?? [];
  const weightEnabled = char.weightTrackingEnabled ?? false;
  const attuneMax = char.attunementMax ?? 3;

  const attunedCount = equipment.filter(e => e.active && e.requiresAttunement).length;

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

      {/* ── Attunement Bar ── */}
      <div class="load-attune-row" style="justify-content: flex-start;">
        <div class="attune-display" style="margin: 0;">
          Attuned: {attunedCount} / {attuneMax}
        </div>
      </div>

      {/* ── Per-list sections ── */}
      {itemLists.map((listDef: any) => {
        const listItems = equipment.filter(i =>
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
        const orphans = equipment.filter(i => i.listId && !validListIds.has(i.listId));
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

    </div>
  );
}
