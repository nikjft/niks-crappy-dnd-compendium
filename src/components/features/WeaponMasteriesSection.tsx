import { useState } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import type { Character } from '../../data/types.js';

// ─── Weapon mastery data (2024 Player's Handbook) ─────────────────────────────

type MasteryKey = 'Cleave' | 'Graze' | 'Nick' | 'Push' | 'Sap' | 'Slow' | 'Topple' | 'Vex';

const MASTERY_DESCRIPTIONS: Record<MasteryKey, string> = {
  Cleave:
    'If you hit with a melee attack using this weapon on your turn, you can make an attack roll ' +
    'against a second creature within 5 feet of the first, using the same weapon. Do not add your ' +
    'Ability Modifier to the damage of this extra attack unless that modifier is negative.',
  Graze:
    'If your attack roll misses a creature, you can deal damage to it equal to the Ability Modifier ' +
    'you used to make the attack roll. This damage is the same type dealt by the weapon, and it can\'t ' +
    'be increased by any means other than increasing that Ability Modifier.',
  Nick:
    'When you make the extra attack of the Light property, you can make it as part of the Attack action ' +
    'instead of as a Bonus Action. You can make this extra attack only once per turn.',
  Push:
    'If you hit a creature that is Large or smaller, you can push the creature up to 10 feet ' +
    'straight away from yourself.',
  Sap:
    'If you hit a creature, that creature has Disadvantage on its next attack roll before the ' +
    'start of your next turn.',
  Slow:
    'If you hit a creature, that creature\'s Speed decreases by 10 feet until the start of your ' +
    'next turn. If the creature is hit more than once by weapons that have this property, the Speed ' +
    'reduction doesn\'t exceed 10 feet.',
  Topple:
    'If you hit a creature, you can force the creature to make a Constitution saving throw ' +
    '(DC 8 + your Proficiency Bonus + the Ability Modifier used to make the attack roll). On a ' +
    'failed save, the creature has the Prone condition.',
  Vex:
    'If you hit a creature, you have Advantage on your next attack roll against that creature ' +
    'before the end of your next turn.',
};

interface WeaponEntry {
  weapon: string;
  mastery: MasteryKey;
}

const WEAPON_MASTERIES: WeaponEntry[] = [
  { weapon: 'Battleaxe',      mastery: 'Topple' },
  { weapon: 'Club',           mastery: 'Slow'   },
  { weapon: 'Dagger',         mastery: 'Nick'   },
  { weapon: 'Dart',           mastery: 'Vex'    },
  { weapon: 'Flail',          mastery: 'Sap'    },
  { weapon: 'Glaive',         mastery: 'Graze'  },
  { weapon: 'Greataxe',       mastery: 'Cleave' },
  { weapon: 'Greatclub',      mastery: 'Push'   },
  { weapon: 'Greatsword',     mastery: 'Graze'  },
  { weapon: 'Halberd',        mastery: 'Cleave' },
  { weapon: 'Hand Crossbow',  mastery: 'Vex'    },
  { weapon: 'Handaxe',        mastery: 'Vex'    },
  { weapon: 'Heavy Crossbow', mastery: 'Push'   },
  { weapon: 'Javelin',        mastery: 'Slow'   },
  { weapon: 'Lance',          mastery: 'Topple' },
  { weapon: 'Light Crossbow', mastery: 'Slow'   },
  { weapon: 'Longsword',      mastery: 'Sap'    },
  { weapon: 'Mace',           mastery: 'Sap'    },
  { weapon: 'Maul',           mastery: 'Topple' },
  { weapon: 'Morningstar',    mastery: 'Sap'    },
  { weapon: 'Net',            mastery: 'Slow'   },
  { weapon: 'Pike',           mastery: 'Push'   },
  { weapon: 'Quarterstaff',   mastery: 'Topple' },
  { weapon: 'Rapier',         mastery: 'Vex'    },
  { weapon: 'Scimitar',       mastery: 'Nick'   },
  { weapon: 'Shortbow',       mastery: 'Vex'    },
  { weapon: 'Shortsword',     mastery: 'Vex'    },
  { weapon: 'Sickle',         mastery: 'Nick'   },
  { weapon: 'Sling',          mastery: 'Slow'   },
  { weapon: 'Spear',          mastery: 'Sap'    },
  { weapon: 'Trident',        mastery: 'Topple' },
  { weapon: 'War Pick',       mastery: 'Sap'    },
  { weapon: 'Warhammer',      mastery: 'Push'   },
  { weapon: 'Whip',           mastery: 'Slow'   },
  { weapon: 'Yklwa',          mastery: 'Push'   },
];

// ─── Mastery Row ──────────────────────────────────────────────────────────────

interface MasteryRowProps {
  weaponName: string;
  mastery: MasteryKey;
  onRemove: () => void;
}

function MasteryRow({ weaponName, mastery, onRemove }: MasteryRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div class="mastery-row-group">
      <div class="mastery-row" onClick={() => setExpanded(v => !v)}>
        <div class="mastery-weapon-block">
          <span class="mastery-weapon-name">{weaponName}</span>
          <span class="mastery-property-badge">{mastery}</span>
        </div>
        <div class="mastery-row-actions" onClick={e => e.stopPropagation()}>
          <button
            class="feat-action-btn danger"
            title="Remove mastery"
            onClick={onRemove}
          >
            <span class="material-icons-outlined" style="font-size: 14px;">delete</span>
          </button>
        </div>
      </div>
      {expanded && (
        <div class="mastery-detail">
          <p class="mastery-effect-text">{MASTERY_DESCRIPTIONS[mastery]}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

interface Props {
  character: Character;
}

export function WeaponMasteriesSection({ character }: Props) {
  const masteries = character.weaponMasteries ?? [];
  const [collapsed, setCollapsed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const available = WEAPON_MASTERIES.filter(w => !masteries.includes(w.weapon));
  const filtered = pickerSearch
    ? available.filter(w =>
        w.weapon.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        w.mastery.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : available;

  function addMastery(weaponName: string) {
    patchCharacter({ weaponMasteries: [...masteries, weaponName] });
  }

  function removeMastery(weaponName: string) {
    patchCharacter({ weaponMasteries: masteries.filter(w => w !== weaponName) });
  }

  return (
    <div class="mastery-section">
      {/* Section header */}
      <div class="mastery-section-header" onClick={() => setCollapsed(c => !c)}>
        <span class="feat-list-collapse-icon">{collapsed ? '▶' : '▼'}</span>
        <span class="mastery-section-title">Weapon Masteries</span>
        <span class="feat-list-count">{masteries.length}</span>
        <div class="feat-list-header-actions" onClick={e => e.stopPropagation()}>
          <button
            class="cs-btn-small feat-add-btn"
            onClick={() => { setShowPicker(true); setPickerSearch(''); }}
            title="Add weapon mastery"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Rows */}
      {!collapsed && (
        <div class="mastery-section-body">
          {masteries.length === 0 ? (
            <p class="feat-empty-hint">No weapon masteries selected. Click + Add to choose a weapon.</p>
          ) : (
            masteries.map(weaponName => {
              const entry = WEAPON_MASTERIES.find(w => w.weapon === weaponName);
              if (!entry) return null;
              return (
                <MasteryRow
                  key={weaponName}
                  weaponName={weaponName}
                  mastery={entry.mastery}
                  onRemove={() => removeMastery(weaponName)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Picker modal */}
      {showPicker && (
        <div class="bd-overlay" onClick={() => setShowPicker(false)}>
          <div class="condition-picker mastery-picker" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div class="bd-header">
              <span class="bd-title">Add Weapon Mastery</span>
              <button class="bd-close" onClick={() => setShowPicker(false)}>×</button>
            </div>
            <div style="padding: 8px 16px;">
              <input
                class="hp-modal-input"
                style="width: 100%; margin-bottom: 8px;"
                placeholder="Search weapon or mastery…"
                value={pickerSearch}
                onInput={e => setPickerSearch((e.target as HTMLInputElement).value)}
                autoFocus
              />
            </div>
            <div class="condition-picker-list mastery-picker-list">
              {filtered.length === 0 ? (
                <p style="padding: 12px 16px; color: var(--text-muted); font-size: 13px;">
                  {available.length === 0 ? 'All weapons mastered.' : 'No matches.'}
                </p>
              ) : (
                filtered.map(w => (
                  <button
                    key={w.weapon}
                    class="condition-picker-item mastery-picker-item"
                    onClick={() => { addMastery(w.weapon); setShowPicker(false); }}
                  >
                    <span class="mastery-weapon-name">{w.weapon}</span>
                    <span class="mastery-property-badge">{w.mastery}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
