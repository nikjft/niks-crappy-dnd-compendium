import { useState } from 'preact/hooks';
import { calcWeaponAttack } from '../../engine/engine.js';
import { BreakdownPopup } from '../shared/BreakdownPopup.js';
import type { Character, CharacterState, EquipmentItem, WeaponAttack } from '../../data/types.js';

interface Props {
  character: Character;
  state: CharacterState;
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

interface WeaponRowProps {
  weapon: EquipmentItem;
  atk: WeaponAttack;
}

function WeaponRow({ weapon: _weapon, atk }: WeaponRowProps) {
  const [bdTarget, setBdTarget] = useState<'primary' | 'alt' | null>(null);

  const openBd = (e: MouseEvent) => { e.stopPropagation(); setBdTarget('primary'); };
  const openAlt = (e: MouseEvent) => { e.stopPropagation(); setBdTarget('alt'); };

  // Build the damage string: formula + bonus (if non-zero)
  const dmgBonus = atk.damageBonus ?? 0;
  const dmgSuffix = dmgBonus !== 0 ? ` ${sign(dmgBonus)}` : '';
  const dmgLabel = `${atk.damageFormula}${dmgSuffix}${atk.damageType ? ` ${atk.damageType}` : ''}`;

  return (
    <div class={`attack-row${atk.isOffhand ? ' atk-offhand' : ''}`}>
      <div class="atk-name-group">
        <span class="atk-name">{atk.name}</span>
        {atk.isOffhand && <span class="atk-hand-badge" title="Off-hand attack">off</span>}
      </div>
      <div class="atk-bonus-group">
        <button class="atk-bonus-btn" onClick={openBd} aria-label={`${atk.name} attack bonus breakdown`}>
          {sign(atk.atkBonus.total)} atk
        </button>
        {atk.atkBonusAlt && (
          <button class="atk-bonus-btn alt" onClick={openAlt} aria-label={`Alternate attack bonus`}>
            / {sign(atk.atkBonusAlt.total)}
          </button>
        )}
      </div>
      <span class="atk-dmg">{dmgLabel}</span>
      {atk.properties.length > 0 && (
        <span class="atk-props">{atk.properties.join(', ')}</span>
      )}

      {bdTarget === 'primary' && (
        <BreakdownPopup
          label={`${atk.name} Attack`}
          breakdown={atk.atkBonus}
          extras={[{ label: 'Damage', value: `${atk.damageFormula}${atk.damageType ? ` ${atk.damageType}` : ''}` }]}
          onClose={() => setBdTarget(null)}
        />
      )}
      {bdTarget === 'alt' && atk.atkBonusAlt && (
        <BreakdownPopup
          label={`${atk.name} (Alt) Attack`}
          breakdown={atk.atkBonusAlt}
          extras={[{ label: 'Damage', value: `${atk.damageFormula}${atk.damageType ? ` ${atk.damageType}` : ''}` }]}
          onClose={() => setBdTarget(null)}
        />
      )}
    </div>
  );
}

/** Check if the character has the Two-Weapon Fighting style active. */
function hasTwoWeaponFighting(character: Character): boolean {
  const features = (character.features ?? []) as Array<{ name?: string; active?: boolean }>;
  return features.some(f =>
    f.active && typeof f.name === 'string' &&
    f.name.toLowerCase().includes('two-weapon fighting')
  );
}

export function AttacksSection({ character, state }: Props) {
  const weapons = ((character.equipment ?? []) as EquipmentItem[]).filter(
    e => e.active && (e.weapon || (e.type && e.type.includes('Weapon')) || e.dmg1)
  );

  if (weapons.length === 0) {
    return (
      <div class="cs-combat-card">
        <div class="cs-card-header"><h3>Attacks</h3></div>
        <p class="empty-hint">No active weapons. Equip a weapon in Inventory.</p>
      </div>
    );
  }

  const hasTWF = hasTwoWeaponFighting(character);

  return (
    <div class="cs-combat-card">
      <div class="cs-card-header"><h3>Attacks</h3></div>
      <div class="attacks-list">
        {weapons.map(w => {
          const isOffhand = w.equippedSlot === 'off';
          return (
            <WeaponRow
              key={`${w.id ?? w.name}-${isOffhand ? 'off' : 'main'}`}
              weapon={w}
              atk={calcWeaponAttack(w, state, { isOffhand, hasTWF })}
            />
          );
        })}
      </div>
    </div>
  );
}
