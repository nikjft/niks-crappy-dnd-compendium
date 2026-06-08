import { useState, useMemo } from 'preact/hooks';
import { currentCharacter, charState, patchCharacter } from '../../state/stores.js';
import { BreakdownPopup } from '../shared/BreakdownPopup.js';
import { SpellSlotsTracker } from './SpellSlotsTracker.js';
import { SpellRow } from './SpellRow.js';
import { CustomSpellModal } from './CustomSpellModal.js';
import type { CharacterSpell, SpellList, Breakdown } from '../../data/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sign(n: number): string { return n >= 0 ? `+${n}` : String(n); }

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function levelLabel(n: number) { return LEVEL_LABELS[n] ?? `${n}th`; }

function makeSpellDCBreakdown(abilityMod: number, profBonus: number, abilityName: string, extra: number): Breakdown {
  const parts = [];
  if (extra !== 0) parts.push({ label: 'Modifiers', value: extra, op: 'add' as const });
  return {
    total: 8 + profBonus + abilityMod + extra,
    base: { label: `8 + Prof + ${abilityName.toUpperCase()} Mod`, value: 8 + profBonus + abilityMod },
    parts,
  };
}

function makeSpellAtkBreakdown(abilityMod: number, profBonus: number, abilityName: string, extra: number): Breakdown {
  const parts = [];
  if (extra !== 0) parts.push({ label: 'Modifiers', value: extra, op: 'add' as const });
  return {
    total: profBonus + abilityMod + extra,
    base: { label: `Prof + ${abilityName.toUpperCase()} Mod`, value: profBonus + abilityMod },
    parts,
  };
}

// ─── List section header ──────────────────────────────────────────────────────

const ABILITY_OPTIONS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface ListHeaderProps {
  listDef: SpellList;
  profBonus: number;
  flatState: Record<string, number>;
  onChangeAbility: (listId: string, ability: string) => void;
}

function ListHeader({ listDef, profBonus, flatState, onChangeAbility }: ListHeaderProps) {
  const [dcBd, setDcBd] = useState(false);
  const [atkBd, setAtkBd] = useState(false);
  const [editingAbility, setEditingAbility] = useState(false);

  const ab = (listDef.spellcastingAbility ?? 'wis').toLowerCase();
  const abilityMod = flatState[`${ab}.mod`] ?? 0;
  const globalDcExtra = (flatState['spell.dc'] ?? (8 + profBonus + abilityMod)) - (8 + profBonus + abilityMod);
  const globalAtkExtra = (flatState['spell.attack'] ?? (profBonus + abilityMod)) - (profBonus + abilityMod);

  const dcBreakdown = makeSpellDCBreakdown(abilityMod, profBonus, ab, globalDcExtra);
  const atkBreakdown = makeSpellAtkBreakdown(abilityMod, profBonus, ab, globalAtkExtra);

  return (
    <div class="spell-list-header">
      <span class="spell-list-name">{listDef.name}</span>
      <div class="spell-list-stats">
        {editingAbility ? (
          <span style="display:flex;align-items:center;gap:4px;">
            <select
              class="spell-ab-select"
              value={ab}
              onChange={e => {
                onChangeAbility(listDef.id, (e.target as HTMLSelectElement).value);
                setEditingAbility(false);
              }}
              onBlur={() => setEditingAbility(false)}
              autoFocus
            >
              {ABILITY_OPTIONS.map(a => (
                <option key={a} value={a}>{a.toUpperCase()}</option>
              ))}
            </select>
          </span>
        ) : (
          <button
            class="spell-ab-badge"
            title="Click to change spellcasting ability"
            onClick={() => setEditingAbility(true)}
            style="display: inline-flex; align-items: center;"
          >
            {ab.toUpperCase()} <span class="material-icons-outlined" style="font-size: 11px; margin-left: 2px;">edit</span>
          </button>
        )}
        <button class="spell-stat-btn" onClick={() => setDcBd(true)}>
          DC {dcBreakdown.total}
        </button>
        <button class="spell-stat-btn" onClick={() => setAtkBd(true)}>
          Atk {sign(atkBreakdown.total)}
        </button>
        <button class="spell-list-add-btn cs-btn-small" onClick={() => (window as any).__legacyOpenPicker?.('spells', listDef.id)}>
          + Add
        </button>
      </div>

      {dcBd && <BreakdownPopup label={`${listDef.name} Spell DC`} breakdown={dcBreakdown} onClose={() => setDcBd(false)} />}
      {atkBd && <BreakdownPopup label={`${listDef.name} Spell Attack`} breakdown={atkBreakdown} onClose={() => setAtkBd(false)} />}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function SpellsTab() {
  const character = currentCharacter.value;
  const state = charState.value;

  const [query, setQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'prepared'>('all');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customModalListId, setCustomModalListId] = useState<string | undefined>();
  const [editingSpell, setEditingSpell] = useState<CharacterSpell | undefined>();

  if (!character || !state) {
    return <div class="combat-placeholder">Open a character sheet to get started.</div>;
  }

  const char = character; // narrowed non-null reference for use in closures
  const spells: CharacterSpell[] = (char.spells as CharacterSpell[]) ?? [];
  const spellLists: SpellList[] = (character.spellLists as SpellList[]) ?? [];
  const profBonus = state['prof_bonus']?.total ?? 2;
  const flatState = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.total]));

  // ── Spell mutation helpers ────────────────────────────────────────────────

  function setSpells(updated: CharacterSpell[]) {
    patchCharacter({ spells: updated });
  }



  function handleCycleState(spell: CharacterSpell) {
    // Cycle: unprepared → prepared → active → unprepared (all spells including cantrips)
    setSpells(spells.map(s => {
      if (s !== spell) return s;
      if (!s.selected && !s.active) return { ...s, selected: true, active: false };
      if (s.selected && !s.active)  return { ...s, selected: true, active: true };
      return { ...s, selected: false, active: false };
    }));
  }

  function handleDelete(spell: CharacterSpell) {
    setSpells(spells.filter(s => s !== spell));
  }

  function handleEdit(spell: CharacterSpell) {
    setEditingSpell(spell);
    setCustomModalListId(spell.listId);
    setShowCustomModal(true);
  }

  function handleSaveSpell(spell: CharacterSpell) {
    let updated: CharacterSpell[];
    if (editingSpell) {
      updated = spells.map(s => s === editingSpell ? spell : s);
    } else {
      updated = [...spells, spell];
    }
    setSpells(updated);
    setShowCustomModal(false);
    setEditingSpell(undefined);
  }

  function handleChangeListAbility(listId: string, ability: string) {
    const updated = spellLists.map(l =>
      l.id === listId ? { ...l, spellcastingAbility: ability } : l
    );
    patchCharacter({ spellLists: updated });
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const q = query.toLowerCase();
  const filteredSpells = useMemo(() => spells.filter(s => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (schoolFilter && (s.school ?? '').toLowerCase() !== schoolFilter.toLowerCase()) return false;
    if (stateFilter === 'prepared' && !s.selected && s.level !== 0) return false;
    return true;
  }), [spells, q, schoolFilter, stateFilter]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div class="spells-tab-root">
      {/* Slot tracker */}
      <SpellSlotsTracker character={character} />

      {/* Filter bar */}
      <div class="spell-filter-bar">
        <input
          class="spell-search"
          placeholder="Search spells…"
          value={query}
          onInput={e => setQuery((e.target as HTMLInputElement).value)}
        />
        <select class="spell-filter-select" value={schoolFilter} onChange={e => setSchoolFilter((e.target as HTMLSelectElement).value)}>
          <option value="">All schools</option>
          {SCHOOLS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
        </select>
        <select class="spell-filter-select" value={stateFilter} onChange={e => setStateFilter((e.target as HTMLSelectElement).value as 'all' | 'prepared')}>
          <option value="all">All</option>
          <option value="prepared">Prepared</option>
        </select>
      </div>

      {/* Level jump bar */}
      <div class="level-jump-bar">
        {LEVEL_LABELS.map((lbl, i) => {
          const hasSpells = filteredSpells.some(s => s.level === i);
          return hasSpells ? (
            <button
              key={i}
              class="level-jump-btn"
              onClick={() => {
                const el = document.getElementById(`spell-level-${i}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {lbl}
            </button>
          ) : null;
        })}
      </div>

      {/* Spell lists */}
      {spellLists.length === 0 ? (
        <div class="empty-hint" style={{ padding: '24px', textAlign: 'center' }}>
          No spellcasting features. Add a spellcasting class to unlock spell slots.
        </div>
      ) : (
        spellLists.map(listDef => {
          const listSpells = filteredSpells.filter(s => s.listId === listDef.id || (!s.listId && spellLists.indexOf(listDef) === 0));

          return (
            <div key={listDef.id} class="spell-list-section">
              <ListHeader listDef={listDef} profBonus={profBonus} flatState={flatState} onChangeAbility={handleChangeListAbility} />

              {/* Group by level */}
              {([0,1,2,3,4,5,6,7,8,9] as const).map(level => {
                const levelSpells = listSpells.filter(s => s.level === level);
                if (levelSpells.length === 0) return null;
                return (
                  <div key={level} id={`spell-level-${level}`} class="spell-level-group">
                    <div class="spell-level-header">{levelLabel(level)}</div>
                    {levelSpells.map((spell, i) => (
                      <SpellRow
                        key={`${spell.name}-${i}`}
                        spell={spell}
                        onCycleState={handleCycleState}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                );
              })}

              {listSpells.length === 0 && (
                <p class="empty-hint">No spells match filters.</p>
              )}
            </div>
          );
        })
      )}

      {/* Bottom controls */}
      <div class="spells-bottom-controls">
        <button class="cs-btn-small" onClick={() => (window as any).__legacyAddSpellList?.()}>
          + Spell List
        </button>
        <button class="cs-btn-small" onClick={() => {
          setEditingSpell(undefined);
          setCustomModalListId(spellLists[0]?.id);
          setShowCustomModal(true);
        }}>
          + Custom Spell
        </button>
      </div>

      {showCustomModal && (
        <CustomSpellModal
          spellLists={spellLists}
          defaultListId={customModalListId}
          editSpell={editingSpell}
          onSave={handleSaveSpell}
          onClose={() => {
            setShowCustomModal(false);
            setEditingSpell(undefined);
          }}
        />
      )}
    </div>
  );
}
