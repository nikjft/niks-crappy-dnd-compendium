import { useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import { calcWeaponAttack } from '../../engine/engine.js';
import { BreakdownPopup } from '../shared/BreakdownPopup.js';
import type {
  Character,
  CharacterState,
  EquipmentItem,
  PinnedAction,
  CharacterSpell,
  CharacterFeature,
} from '../../data/types.js';

interface Props {
  character: Character;
  state: CharacterState;
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

interface Counter {
  id: string;
  name: string;
  value: number;
  max: number;
  reset_short?: boolean;
  reset_long?: boolean;
}

// ── Individual card types ────────────────────────────────────────────────────

interface WeaponCardProps {
  item: EquipmentItem;
  state: CharacterState;
  onUnpin: () => void;
}

function WeaponCard({ item, state, onUnpin }: WeaponCardProps) {
  const [bdOpen, setBdOpen] = useState(false);
  const isOffhand = item.equippedSlot === 'off';
  const atk = calcWeaponAttack(item, state, { isOffhand });
  const dmgBonus = atk.damageBonus ?? 0;
  const dmgSuffix = dmgBonus !== 0 ? ` ${sign(dmgBonus)}` : '';
  const dmgLabel = `${atk.damageFormula}${dmgSuffix}${atk.damageType ? ` ${atk.damageType}` : ''}`;

  return (
    <div class="qa-card">
      <div class="qa-card-header">
        <span class="qa-card-name">
          {atk.name}
          {isOffhand && <span class="atk-hand-badge" style="margin-left: 5px;" title="Off-hand">off</span>}
        </span>
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
          <span class="qa-stat-val">{dmgLabel}</span>
        </div>
      </div>
      {atk.properties.length > 0 && (
        <div class="qa-card-props">{atk.properties.join(', ')}</div>
      )}
      {bdOpen && (
        <BreakdownPopup
          label={`${atk.name} Attack`}
          breakdown={atk.atkBonus}
          extras={[{ label: 'Damage', value: dmgLabel }]}
          onClose={() => setBdOpen(false)}
        />
      )}
    </div>
  );
}

interface SpellCardProps {
  spell: CharacterSpell;
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

interface FeatureCardProps {
  feature: CharacterFeature;
  onUnpin: () => void;
}

function FeatureCard({ feature, onUnpin }: FeatureCardProps) {
  const [expanded, setExpanded] = useState(false);
  const desc = feature.texts?.[0];
  return (
    <div class="qa-card">
      <div class="qa-card-header">
        <button class="qa-card-name qa-card-name-btn" onClick={() => setExpanded(e => !e)} title="Toggle description">
          {feature.name}
        </button>
        <button class="qa-unpin-btn" onClick={onUnpin} aria-label={`Unpin ${feature.name}`} title="Remove from Quick Actions">×</button>
      </div>
      {feature.category && (
        <div class="qa-card-props">
          <span class="qa-tag">{feature.category}</span>
        </div>
      )}
      {expanded && desc && (
        <p class="qa-card-desc">{desc}</p>
      )}
    </div>
  );
}

interface CounterCardProps {
  counter: Counter;
  counters: Counter[];
  onUnpin: () => void;
}

function CounterCard({ counter, counters, onUnpin }: CounterCardProps) {
  function patch(newVal: number) {
    const updated = counters.map(c => c.id === counter.id ? { ...c, value: Math.max(0, Math.min(c.max, newVal)) } : c);
    patchCharacter({ counters: updated } as Partial<Character>);
  }

  const pips = Math.min(counter.max, 8);
  const resetLabel = counter.reset_short ? 'Short Rest' : counter.reset_long ? 'Long Rest' : '';

  return (
    <div class="qa-card">
      <div class="qa-card-header">
        <span class="qa-card-name">{counter.name}</span>
        <button class="qa-unpin-btn" onClick={onUnpin} aria-label={`Unpin ${counter.name}`} title="Remove from Quick Actions">×</button>
      </div>
      <div class="qa-counter-row">
        <div class="qa-counter-pips">
          {Array.from({ length: pips }, (_, i) => (
            <span key={i} class={`qa-counter-pip${i < counter.value ? ' filled' : ''}`} />
          ))}
          {counter.max > 8 && <span class="qa-counter-num">{counter.value}/{counter.max}</span>}
        </div>
        <div class="qa-counter-btns">
          <button class="cs-hp-btn sm" onClick={() => patch(counter.value - 1)} title="Use one">−</button>
          <button class="cs-hp-btn sm" onClick={() => patch(counter.value + 1)} title="Recover one">+</button>
          <button class="qa-reset-btn" onClick={() => patch(counter.max)} title={`Reset (${resetLabel || 'manual'})`}>↺</button>
        </div>
      </div>
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
  // Spells come from the flat character.spells array
  const spells = ((character.spells ?? []) as CharacterSpell[]).filter(s => s.name);
  // Non-dynamic features only
  const features = ((character.features ?? []) as CharacterFeature[]).filter(f => f.name && !f.isDynamic && !f.isOverview);
  // Counters (exclude internal _-prefixed ones)
  const counters = ((character.counters ?? []) as Counter[]).filter(c => c.id && !c.id.startsWith('_'));

  const isEmpty = weapons.length === 0 && spells.length === 0 && features.length === 0 && counters.length === 0;

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
                  onClick={() => { if (!isPinned) pin('equipment', String(w.name)); }}
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
                  onClick={() => { if (!isPinned) pin('spells', String(s.name)); }}
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

        {features.length > 0 && (
          <section class="qa-picker-section">
            <h4 class="qa-picker-section-title">Features</h4>
            {features.map(f => {
              const key = `features:${f.id ?? f.name}`;
              const isPinned = pinnedSet.has(key);
              return (
                <button
                  key={String(f.id ?? f.name)}
                  class={`qa-picker-item${isPinned ? ' pinned' : ''}`}
                  onClick={() => { if (!isPinned) pin('features', String(f.id ?? f.name)); }}
                  disabled={isPinned}
                >
                  {f.name}
                  {f.category && <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11px' }}>({f.category})</span>}
                  {isPinned && <span class="qa-pinned-label">Pinned</span>}
                </button>
              );
            })}
          </section>
        )}

        {counters.length > 0 && (
          <section class="qa-picker-section">
            <h4 class="qa-picker-section-title">Counters</h4>
            {counters.map(c => {
              const key = `counters:${c.id}`;
              const isPinned = pinnedSet.has(key);
              return (
                <button
                  key={c.id}
                  class={`qa-picker-item${isPinned ? ' pinned' : ''}`}
                  onClick={() => { if (!isPinned) pin('counters', c.id); }}
                  disabled={isPinned}
                >
                  {c.name} ({c.value}/{c.max})
                  {isPinned && <span class="qa-pinned-label">Pinned</span>}
                </button>
              );
            })}
          </section>
        )}

        {isEmpty && (
          <p class="empty-hint" style={{ padding: '12px' }}>
            No weapons, spells, features, or counters found yet.
          </p>
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

  // Build lookup maps
  const weaponMap = new Map<string, EquipmentItem>();
  for (const e of (character.equipment ?? []) as EquipmentItem[]) {
    if (e.name) weaponMap.set(String(e.name), e);
  }

  // Spells from the flat character.spells array (not from list objects — those have no spells property)
  const spellMap = new Map<string, CharacterSpell>();
  for (const s of (character.spells ?? []) as CharacterSpell[]) {
    if (s.name && !spellMap.has(String(s.name))) spellMap.set(String(s.name), s);
  }

  const featureMap = new Map<string, CharacterFeature>();
  for (const f of (character.features ?? []) as CharacterFeature[]) {
    const key = String(f.id ?? f.name);
    if (!featureMap.has(key)) featureMap.set(key, f);
  }

  const counterMap = new Map<string, Counter>();
  for (const c of (character.counters ?? []) as Counter[]) {
    if (c.id) counterMap.set(c.id, c);
  }
  const allCounters = [...counterMap.values()].filter(c => !c.id.startsWith('_'));

  return (
    <div class="qa-section">
      <div class="cs-card-header">
        <h3>Quick Actions</h3>
        <button class="cs-btn-small" onClick={() => setPickerOpen(true)}>+ Pin</button>
      </div>

      {pinned.length === 0 ? (
        <p class="qa-empty">
          Pin your most-used attacks, spells, features, and counters here for fast combat access.{' '}
          <button class="qa-empty-link" onClick={() => setPickerOpen(true)}>+ Pin an action</button>
        </p>
      ) : (
        <div class="qa-cards">
          {pinned.map(p => {
            const key = `${p.sourceList}:${p.sourceId}`;
            const unpinFn = () => unpin(p.sourceList, p.sourceId);

            if (p.sourceList === 'equipment') {
              const item = weaponMap.get(p.sourceId);
              if (!item || !item.weapon) return null;
              return <WeaponCard key={key} item={item} state={state} onUnpin={unpinFn} />;
            }
            if (p.sourceList === 'spells') {
              const spell = spellMap.get(p.sourceId);
              if (!spell) return null;
              return <SpellCard key={key} spell={spell} onUnpin={unpinFn} />;
            }
            if (p.sourceList === 'features') {
              const feature = featureMap.get(p.sourceId);
              if (!feature) return null;
              return <FeatureCard key={key} feature={feature} onUnpin={unpinFn} />;
            }
            if (p.sourceList === 'counters') {
              const counter = counterMap.get(p.sourceId);
              if (!counter) return null;
              return <CounterCard key={key} counter={counter} counters={allCounters} onUnpin={unpinFn} />;
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
