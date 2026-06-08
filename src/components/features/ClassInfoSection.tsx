import { useState, useEffect } from 'preact/hooks';
import type { Character, CharacterClass } from '../../data/types.js';

interface ClassData {
  name: string;
  hd: number;
  proficiency: string | null;
  armor: string | null;
  weapons: string | null;
  tools: string | null;
  savingThrows: string | null;
  skills: string | null;
  spellAbility: string | null;
}

interface Props {
  character: Character;
}

function ClassInfoCard({ cls, isMulticlass }: { cls: CharacterClass; isMulticlass: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const result = (window as any).__legacyGetClassData?.(cls.name);
    if (result) setData(result);
  }, [cls.name]);

  if (!data) return null;

  const rows: Array<{ label: string; value: string; multiclassNote?: string }> = [];

  if (data.savingThrows) {
    rows.push({ label: 'Saving Throws', value: data.savingThrows });
  }
  if (data.armor) {
    rows.push({
      label: 'Armor',
      value: data.armor,
      multiclassNote: isMulticlass ? 'Multiclass: may not gain armor proficiencies' : undefined,
    });
  }
  if (data.weapons) {
    rows.push({
      label: 'Weapons',
      value: data.weapons,
      multiclassNote: isMulticlass ? 'Multiclass: may not gain all weapon proficiencies' : undefined,
    });
  }
  if (data.tools) {
    rows.push({ label: 'Tools', value: data.tools });
  }
  if (data.proficiency) {
    rows.push({ label: 'Skills', value: data.proficiency });
  }
  if (data.spellAbility) {
    rows.push({ label: 'Spellcasting', value: `${data.spellAbility.toUpperCase()} modifier` });
  }

  if (rows.length === 0) return null;

  return (
    <div class="class-info-card">
      <button
        class="start-equip-toggle"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span class="material-icons-outlined" style="font-size: 13px; margin-right: 4px;">school</span>
        <span>{cls.name} Proficiencies{cls.subclass ? ` · ${cls.subclass}` : ''}</span>
        {isMulticlass && (
          <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(multiclass)</span>
        )}
        <span class="feat-collapse-icon" style="margin-left: auto;">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div class="class-info-body">
          <table class="class-info-table">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td class="class-info-label">{row.label}</td>
                  <td class="class-info-value">
                    {row.value}
                    {row.multiclassNote && (
                      <span class="class-info-multiclass-note"> — {row.multiclassNote}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ClassInfoSection({ character }: Props) {
  const classes = (character.classes ?? []) as CharacterClass[];
  if (classes.length === 0) return null;
  const isMulticlass = classes.length > 1;

  return (
    <>
      {classes.map(cls => (
        <ClassInfoCard key={cls.name} cls={cls} isMulticlass={isMulticlass} />
      ))}
    </>
  );
}
