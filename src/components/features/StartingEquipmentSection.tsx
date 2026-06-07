import { useState, useEffect } from 'preact/hooks';
import type { Character, CharacterClass } from '../../data/types.js';

interface StartingEquipmentData {
  lines: string[];
  goldAlt: string | null;
  fromBackground: boolean;
}

interface Props {
  character: Character;
}

function ClassEquipment({ cls }: { cls: CharacterClass }) {
  const [data, setData] = useState<StartingEquipmentData | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const result = (window as any).__legacyGetStartingEquipment?.(cls.name);
    if (result) setData(result);
  }, [cls.name]);

  if (!data || data.lines.length === 0) return null;

  return (
    <div class="start-equip-class">
      <button
        class="start-equip-class-header"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span class="start-equip-class-name">{cls.name}</span>
        <span class="feat-collapse-icon">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div class="start-equip-body">
          {data.fromBackground && (
            <p class="start-equip-note">+ Starting equipment from your Background.</p>
          )}
          <ul class="start-equip-list">
            {data.lines.map((line, i) => (
              <li key={i} class="start-equip-item">{line}</li>
            ))}
          </ul>
          {data.goldAlt && (
            <p class="start-equip-gold">Or take {data.goldAlt} gp to buy your own equipment.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function StartingEquipmentSection({ character }: Props) {
  const classes = (character.classes ?? []) as CharacterClass[];
  if (classes.length === 0) return null;

  return (
    <div class="start-equip-section cs-combat-card">
      <div class="cs-card-header">
        <h3>Starting Equipment</h3>
      </div>
      <div class="start-equip-classes">
        {classes.map(cls => (
          <ClassEquipment key={cls.name} cls={cls} />
        ))}
      </div>
      <p class="start-equip-footer-note">
        Reference only — equipment is managed in Inventory.
      </p>
    </div>
  );
}
