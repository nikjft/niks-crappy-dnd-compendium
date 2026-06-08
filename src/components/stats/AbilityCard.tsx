import { useState, useRef, useEffect } from 'preact/hooks';
import type { Character, CharacterState, Breakdown } from '../../data/types.js';
import { patchCharacter } from '../../state/stores.js';

interface Props {
  attr: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  character: Character;
  state: CharacterState;
}

const ATTR_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export function AbilityCard({ attr, character, state }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const scoreBreakdown = state[`${attr}.score`] as Breakdown;
  const modBreakdown = state[`${attr}.mod`] as Breakdown;
  const saveBreakdown = state[`save.${attr}`] as Breakdown;

  const score = scoreBreakdown?.total ?? 10;
  const mod = modBreakdown?.total ?? 0;
  const save = saveBreakdown?.total ?? 0;
  const isSaveProf = !!character.savesProficiency?.[attr];

  const [editVal, setEditVal] = useState(String(character.baseStats?.[attr] ?? 10));

  // Sync state if base stats change outside
  useEffect(() => {
    setEditVal(String(character.baseStats?.[attr] ?? 10));
  }, [character.baseStats?.[attr]]);

  // Click outside popup handler
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditMode(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function toggleSaveProf(e: MouseEvent) {
    e.stopPropagation();
    const newSaves = { ...(character.savesProficiency ?? {}) };
    newSaves[attr] = isSaveProf ? 0 : 1;
    patchCharacter({ savesProficiency: newSaves });
  }

  function handleSaveBaseScore() {
    const val = parseInt(editVal) || 10;
    const newBase = { ...(character.baseStats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) };
    newBase[attr] = val;
    patchCharacter({ baseStats: newBase });
    setEditMode(false);
  }

  return (
    <>
      <div
        class="cs-attr-box"
        onClick={() => setIsOpen(true)}
        style="cursor: pointer;"
        aria-label={`${ATTR_NAMES[attr]} details`}
      >
        <span class="cs-attr-label">{ATTR_NAMES[attr]}</span>
        <span class="cs-attr-score-val">{score}</span>
        <span class="cs-attr-mod">{sign(mod)}</span>
        <div class="cs-attr-save-row" onClick={e => e.stopPropagation()}>
          <button
            class={`cs-prof-indicator ${isSaveProf ? 'prof' : ''}`}
            onClick={toggleSaveProf}
            title={`${isSaveProf ? 'Proficient' : 'Not proficient'} in ${ATTR_NAMES[attr]} Saving Throws. Click to toggle.`}
            aria-label={`Toggle save proficiency for ${ATTR_NAMES[attr]}`}
          />
          <span class="cs-attr-save-label">Save {sign(save)}</span>
        </div>
      </div>

      {isOpen && (
        <div class="bd-overlay">
          <div class="bd-popup ability-popup" ref={popupRef} role="dialog" aria-modal="true" aria-label={`${ATTR_NAMES[attr]} Details`}>
            <div class="bd-header">
              <span class="bd-title">{ATTR_NAMES[attr]} Details</span>
              <button
                class="bd-close"
                onClick={() => {
                  setIsOpen(false);
                  setEditMode(false);
                }}
              >
                ×
              </button>
            </div>

            <div class="ability-popup-section">
              <h4>Score Breakdown</h4>
              <div class="bd-rows">
                {editMode ? (
                  <div class="bd-row base-edit-row">
                    <span class="bd-row-label">Base Score:</span>
                    <input
                      type="number"
                      class="hp-modal-input base-score-input"
                      value={editVal}
                      onInput={e => setEditVal((e.target as HTMLInputElement).value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveBaseScore();
                        if (e.key === 'Escape') setEditMode(false);
                      }}
                      autoFocus
                    />
                    <button class="cs-btn-small" onClick={handleSaveBaseScore}>Save</button>
                    <button class="cs-btn-small secondary" onClick={() => setEditMode(false)}>Cancel</button>
                  </div>
                ) : (
                  <div class="bd-row bd-base">
                    <span class="bd-row-label">{scoreBreakdown?.base?.label ?? 'Base'}</span>
                    <span class="bd-row-val">{scoreBreakdown?.base?.value ?? 10}</span>
                  </div>
                )}
                {scoreBreakdown?.parts?.map((part, i) => (
                  <div class="bd-row" key={i}>
                    <span class="bd-row-label">{part.label}</span>
                    <span class="bd-row-val bd-row-part">
                      {part.op === 'set' ? '→' : part.value >= 0 ? '+' : '−'} {Math.abs(part.value)}
                    </span>
                  </div>
                ))}
              </div>
              <div class="bd-total">
                <span>Final Score</span>
                <span class="bd-total-val">{score}</span>
              </div>
              {!editMode && (
                <button class="cs-btn-small base-edit-btn" onClick={() => setEditMode(true)}>
                  Edit Base Score
                </button>
              )}
            </div>

            <div class="ability-popup-section" style="margin-top: 16px;">
              <h4>Saving Throw Breakdown</h4>
              <div class="bd-rows">
                <div class="bd-row bd-base">
                  <span class="bd-row-label">{saveBreakdown?.base?.label ?? `${ATTR_NAMES[attr]} Mod`}</span>
                  <span class="bd-row-val">{saveBreakdown?.base?.value ?? 0}</span>
                </div>
                {saveBreakdown?.parts?.map((part, i) => (
                  <div class="bd-row" key={i}>
                    <span class="bd-row-label">{part.label}</span>
                    <span class="bd-row-val bd-row-part">
                      {part.op === 'set' ? '→' : part.value >= 0 ? '+' : '−'} {Math.abs(part.value)}
                    </span>
                  </div>
                ))}
              </div>
              <div class="bd-total">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button
                    class={`cs-prof-indicator ${isSaveProf ? 'prof' : ''}`}
                    onClick={toggleSaveProf}
                    aria-label={`Toggle save proficiency for ${ATTR_NAMES[attr]}`}
                  />
                  <span>Saving Throw</span>
                </div>
                <span class="bd-total-val">{sign(save)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
