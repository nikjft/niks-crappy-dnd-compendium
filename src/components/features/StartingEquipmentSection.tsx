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

function ClassEquipmentLine({ cls }: { cls: CharacterClass }) {
  const [data, setData] = useState<StartingEquipmentData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const result = (window as any).__legacyGetStartingEquipment?.(cls.name);
    if (result) setData(result);
  }, [cls.name]);

  if (!data || data.lines.length === 0) return null;

  return (
    <div class="start-equip-inline">
      <button
        class="start-equip-toggle"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span class="material-icons-outlined" style="font-size: 13px; margin-right: 4px;">backpack</span>
        <span>Starting Equipment — {cls.name}</span>
        <span class="feat-collapse-icon" style="margin-left: auto;">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
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
    <>
      {classes.map(cls => (
        <ClassEquipmentLine key={cls.name} cls={cls} />
      ))}
    </>
  );
}
