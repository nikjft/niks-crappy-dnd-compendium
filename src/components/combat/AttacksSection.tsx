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

  return (
    <div class="attack-row">
      <span class="atk-name">{atk.name}</span>
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
      <span class="atk-dmg">
        {atk.damageFormula}
        {atk.damageType ? ` ${atk.damageType}` : ''}
      </span>
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

export function AttacksSection({ character, state }: Props) {
  const weapons = ((character.equipment ?? []) as EquipmentItem[]).filter(
    e => e.active && e.weapon
  );

  if (weapons.length === 0) {
    return (
      <div class="cs-combat-card">
        <div class="cs-card-header"><h3>Attacks</h3></div>
        <p class="empty-hint">No active weapons. Equip a weapon in Inventory.</p>
      </div>
    );
  }

  return (
    <div class="cs-combat-card">
      <div class="cs-card-header"><h3>Attacks</h3></div>
      <div class="attacks-list">
        {weapons.map(w => (
          <WeaponRow key={String(w.name)} weapon={w} atk={calcWeaponAttack(w, state)} />
        ))}
      </div>
    </div>
  );
}
