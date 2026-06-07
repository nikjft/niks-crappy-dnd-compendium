import { useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import { calcWeaponAttack } from '../../engine/engine.js';
import { BreakdownPopup } from '../shared/BreakdownPopup.js';
import type {
  Character,
  CharacterState,
  EquipmentItem,
  PinnedAction,
  SpellRecord,
} from '../../data/types.js';

interface Props {
  character: Character;
  state: CharacterState;
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

// ── Individual card types ────────────────────────────────────────────────────

interface WeaponCardProps {
  item: EquipmentItem;
  state: CharacterState;
  onUnpin: () => void;
}

function WeaponCard({ item, state, onUnpin }: WeaponCardProps) {
  const [bdOpen, setBdOpen] = useState(false);
  const atk = calcWeaponAttack(item, state);
  return (
    <div class="qa-card">
      <div class="qa-card-header">
        <span class="qa-card-name">{atk.name}</span>
        <button class="qa-unpin-btn" onClick={onUnpin} aria-label={`Unpin ${atk.name}`} title="Remove from Quick Actions">×</button>
      </div>
      <div class="qa-card-stats">
        <button
          class="qa-stat-btn"
          onClick={() => setBdOpen(true)}
          aria-label={`${atk.name} attack bonus breakdown`}
        >
          <span class="qa-stat-label">ATK</span>
          <span class="qa-stat-val">{sign(atk.atkBonus.total)}</span>
        </button>
        <div class="qa-stat-divider" />
        <div class="qa-stat">
          <span class="qa-stat-label">DMG</span>
          <span class="qa-stat-val">{atk.damageFormula}{atk.damageType ? ` ${atk.damageType}` : ''}</span>
        </div>
      </div>
      {atk.properties.length > 0 && (
        <div class="qa-card-props">{atk.properties.join(', ')}</div>
      )}
      {bdOpen && (
        <BreakdownPopup
          label={`${atk.name} Attack`}
          breakdown={atk.atkBonus}
          onClose={() => setBdOpen(false)}
        />
      )}
    </div>
  );
}

interface SpellCardProps {
  spell: SpellRecord;
  onUnpin: () => void;
}

function SpellCard({ spell, onUnpin }: SpellCardProps) {
  return (
    <div class="qa-card">
      <div class="qa-card-header">
        <span class="qa-card-name">{spell.name}</span>
        <button class="qa-unpin-btn" onClick={onUnpin} aria-label={`Unpin ${spell.name}`} title="Remove from Quick Actions">×</button>
      </div>
      <div class="qa-card-stats">
        <div class="qa-stat">
          <span class="qa-stat-label">LVL</span>
          <span class="qa-stat-val">{spell.level === 0 ? 'Cantrip' : String(spell.level)}</span>
        </div>
        {spell.time && (
          <>
            <div class="qa-stat-divider" />
            <div class="qa-stat">
              <span class="qa-stat-label">TIME</span>
              <span class="qa-stat-val">{spell.time}</span>
            </div>
          </>
        )}
      </div>
      {(spell.isConcentration || spell.ritual) && (
        <div class="qa-card-props">
          {spell.isConcentration && <span class="qa-tag conc">Concentration</span>}
          {spell.ritual && <span class="qa-tag ritual">Ritual</span>}
        </div>
      )}
    </div>
  );
}

// ── Picker modal ──────────────────────────────────────────────────────────────

interface PickerProps {
  character: Character;
  state: CharacterState;
  onClose: () => void;
}

function QuickActionPicker({ character, onClose }: PickerProps) {
  const pinned = character.pinnedActions ?? [];
  const pinnedSet = new Set(pinned.map(p => `${p.sourceList}:${p.sourceId}`));

  function pin(list: PinnedAction['sourceList'], id: string) {
    if (pinnedSet.has(`${list}:${id}`)) return;
    patchCharacter({ pinnedActions: [...pinned, { sourceList: list, sourceId: id }] });
  }

  const weapons = ((character.equipment ?? []) as EquipmentItem[]).filter(e => e.weapon && e.name);
  const spells: SpellRecord[] = [];
  for (const sl of (character.spellLists ?? []) as Array<{ spells?: SpellRecord[] }>) {
    for (const s of sl.spells ?? []) {
      if (!spells.some(x => x.name === s.name)) spells.push(s);
    }
  }

  return (
    <div class="bd-overlay" onClick={onClose}>
      <div class="qa-picker" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pin Quick Action">
        <div class="bd-header">
          <span class="bd-title">Pin to Quick Actions</span>
          <button class="bd-close" onClick={onClose}>×</button>
        </div>

        {weapons.length > 0 && (
          <section class="qa-picker-section">
            <h4 class="qa-picker-section-title">Weapons</h4>
            {weapons.map(w => {
              const key = `equipment:${w.name}`;
              const isPinned = pinnedSet.has(key);
              return (
                <button
                  key={String(w.name)}
                  class={`qa-picker-item${isPinned ? ' pinned' : ''}`}
                  onClick={() => { if (!isPinned) { pin('equipment', String(w.name)); } }}
                  disabled={isPinned}
                >
                  {w.name}
                  {isPinned && <span class="qa-pinned-label">Pinned</span>}
                </button>
              );
            })}
          </section>
        )}

        {spells.length > 0 && (
          <section class="qa-picker-section">
            <h4 class="qa-picker-section-title">Spells</h4>
            {spells.map(s => {
              const key = `spells:${s.name}`;
              const isPinned = pinnedSet.has(key);
              return (
                <button
                  key={String(s.name)}
                  class={`qa-picker-item${isPinned ? ' pinned' : ''}`}
                  onClick={() => { if (!isPinned) { pin('spells', String(s.name)); } }}
                  disabled={isPinned}
                >
                  {s.name}
                  {s.level === 0 ? ' (Cantrip)' : ` (L${s.level})`}
                  {isPinned && <span class="qa-pinned-label">Pinned</span>}
                </button>
              );
            })}
          </section>
        )}

        {weapons.length === 0 && spells.length === 0 && (
          <p class="empty-hint" style={{ padding: '12px' }}>No weapons or spells found. Add some in the Inventory and Spells tabs.</p>
        )}
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

export function QuickActionsSection({ character, state }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pinned = character.pinnedActions ?? [];

  function unpin(list: PinnedAction['sourceList'], id: string) {
    patchCharacter({ pinnedActions: pinned.filter(p => !(p.sourceList === list && p.sourceId === id)) });
  }

  // Resolve each pinned action to its live data
  const weaponMap = new Map<string, EquipmentItem>();
  for (const e of (character.equipment ?? []) as EquipmentItem[]) {
    if (e.name) weaponMap.set(String(e.name), e);
  }

  const spellMap = new Map<string, SpellRecord>();
  for (const sl of (character.spellLists ?? []) as Array<{ spells?: SpellRecord[] }>) {
    for (const s of sl.spells ?? []) {
      if (s.name && !spellMap.has(String(s.name))) spellMap.set(String(s.name), s);
    }
  }

  return (
    <div class="qa-section">
      <div class="cs-card-header">
        <h3>Quick Actions</h3>
        <button class="cs-btn-small" onClick={() => setPickerOpen(true)}>+ Pin</button>
      </div>

      {pinned.length === 0 ? (
        <p class="qa-empty">
          Pin your most-used attacks, spells, and features here for fast combat access.{' '}
          <button class="qa-empty-link" onClick={() => setPickerOpen(true)}>+ Pin an action</button>
        </p>
      ) : (
        <div class="qa-cards">
          {pinned.map(p => {
            const key = `${p.sourceList}:${p.sourceId}`;
            if (p.sourceList === 'equipment') {
              const item = weaponMap.get(p.sourceId);
              if (!item || !item.weapon) return null;
              return <WeaponCard key={key} item={item} state={state} onUnpin={() => unpin(p.sourceList, p.sourceId)} />;
            }
            if (p.sourceList === 'spells') {
              const spell = spellMap.get(p.sourceId);
              if (!spell) return null;
              return <SpellCard key={key} spell={spell} onUnpin={() => unpin(p.sourceList, p.sourceId)} />;
            }
            return null;
          })}
        </div>
      )}

      {pickerOpen && (
        <QuickActionPicker
          character={character}
          state={state}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
