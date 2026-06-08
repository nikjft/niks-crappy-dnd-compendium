import { patchCharacter } from '../../state/stores.js';
import type { Character, CharacterClass } from '../../data/types.js';

interface Props {
  character: Character;
}

const WARLOCK_PACT_SLOTS: Record<number, { count: number; level: number }> = {
  1: { count: 1, level: 1 }, 2: { count: 2, level: 1 }, 3: { count: 2, level: 2 },
  4: { count: 2, level: 2 }, 5: { count: 2, level: 3 }, 6: { count: 2, level: 3 },
  7: { count: 2, level: 4 }, 8: { count: 2, level: 4 }, 9: { count: 2, level: 5 },
  10: { count: 2, level: 5 }, 11: { count: 3, level: 5 }, 12: { count: 3, level: 5 },
  13: { count: 3, level: 5 }, 14: { count: 3, level: 5 }, 15: { count: 3, level: 5 },
  16: { count: 3, level: 5 }, 17: { count: 4, level: 5 }, 18: { count: 4, level: 5 },
  19: { count: 4, level: 5 }, 20: { count: 4, level: 5 },
};

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

function SlotPips({
  current, max, onToggle,
}: { current: number; max: number; onToggle: (idx: number) => void }) {
  return (
    <div class="slot-pips">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          class={`slot-pip${i < current ? ' filled' : ''}`}
          onClick={() => onToggle(i)}
          aria-label={i < current ? `Expend slot ${i + 1}` : `Recover slot ${i + 1}`}
          title={i < current ? 'Click to expend' : 'Click to recover'}
        />
      ))}
    </div>
  );
}

export function SpellSlotsTracker({ character }: Props) {
  const slots = character.spellSlots ?? {};
  const pactSlots = character.pactSlots;

  // Detect warlock level for pact slot display
  const warlockEntry = (character.classes as CharacterClass[] | undefined)
    ?.find(c => c.name.toLowerCase() === 'warlock');
  const warlockLevel = warlockEntry?.level ?? 0;
  const pactTemplate = warlockLevel > 0 ? WARLOCK_PACT_SLOTS[warlockLevel] : null;

  // For a single-class Warlock every slot in spellSlots IS a pact slot — suppress
  // the pact level from the standard grid so it only shows under Pact Magic.
  // For multiclass, calculateCharacterSlots no longer merges pact slots into the
  // standard pool, so the grid shows real class slots correctly at every level.
  const classes = (character.classes as CharacterClass[] | undefined) ?? [];
  const isSingleClassWarlock = classes.length === 1 && warlockLevel > 0;

  const slotLevels = Object.keys(slots)
    .map(Number)
    .filter(l => slots[l]?.max > 0 && !(isSingleClassWarlock && l === pactTemplate?.level))
    .sort((a, b) => a - b);

  function toggleStandardSlot(level: number, idx: number) {
    const current = slots[level]?.current ?? 0;
    const max = slots[level]?.max ?? 0;
    const newCurrent = idx < current ? idx : Math.min(idx + 1, max);
    patchCharacter({
      spellSlots: { ...slots, [level]: { current: newCurrent, max } },
    });
  }

  function togglePactSlot(idx: number) {
    if (!pactSlots) return;
    const newCurrent = idx < pactSlots.current ? idx : Math.min(idx + 1, pactSlots.max);
    patchCharacter({ pactSlots: { ...pactSlots, current: newCurrent } });
  }

  // Initialize pact slots from template if missing
  if (pactTemplate && !pactSlots) {
    // Fire-once initializer — side-effect during render, deferred to avoid cycle
    setTimeout(() => {
      patchCharacter({
        pactSlots: { current: pactTemplate.count, max: pactTemplate.count, level: pactTemplate.level },
      });
    }, 0);
  }

  if (slotLevels.length === 0 && !pactTemplate) {
    return null; // Non-caster, show nothing
  }

  return (
    <div class="slots-tracker">
      {/* Standard slots */}
      {slotLevels.length > 0 && (
        <div class="slots-grid">
          {slotLevels.map(level => {
            const slot = slots[level];
            return (
              <div key={level} class="slot-card">
                <span class="slot-label">{ordinal(level)}</span>
                <SlotPips
                  current={slot.current}
                  max={slot.max}
                  onToggle={idx => toggleStandardSlot(level, idx)}
                />
                <span class="slot-count">{slot.current}/{slot.max}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pact Magic slots */}
      {pactTemplate && (
        <div class="pact-slots-row">
          <span class="pact-label">Pact Magic</span>
          <SlotPips
            current={pactSlots?.current ?? pactTemplate.count}
            max={pactSlots?.max ?? pactTemplate.count}
            onToggle={togglePactSlot}
          />
          <span class="slot-count pact-level">
            {pactSlots?.current ?? pactTemplate.count}/{pactSlots?.max ?? pactTemplate.count}
            {' '}(Lvl {pactTemplate.level})
          </span>
        </div>
      )}
    </div>
  );
}
