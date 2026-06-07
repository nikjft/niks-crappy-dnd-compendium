import { useState, useCallback } from 'preact/hooks';
import { patchCharacter } from '../../state/stores.js';
import type { Character, DeathSaves } from '../../data/types.js';

interface Props {
  character: Character;
  hpMax: number;
}

type HpMode = 'damage' | 'heal' | 'set';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function HpSection({ character, hpMax }: Props) {
  const current = character.hp?.current ?? 0;
  const temp = character.hp?.temp ?? 0;
  const isDead = current <= 0;
  const ds: DeathSaves = character.deathSaves ?? { successes: 0, failures: 0 };

  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<HpMode>('damage');

  const setHp = useCallback((val: number) => {
    patchCharacter({ hp: { current: clamp(val, 0, hpMax), temp } });
  }, [hpMax, temp]);

  const setTemp = useCallback((val: number) => {
    patchCharacter({ hp: { current, temp: Math.max(0, val) } });
  }, [current]);

  function applyModal() {
    const n = parseInt(amount) || 0;
    if (mode === 'heal') setHp(clamp(current + n, 0, hpMax));
    else if (mode === 'damage') {
      const fromTemp = Math.min(n, temp);
      const leftover = n - fromTemp;
      patchCharacter({ hp: { current: clamp(current - leftover, 0, hpMax), temp: temp - fromTemp } });
    } else {
      setHp(clamp(n, 0, hpMax));
    }
    setAmount('');
    setModalOpen(false);
  }

  function toggleDeathSave(type: 'successes' | 'failures', idx: number) {
    const count = ds[type];
    patchCharacter({
      deathSaves: { ...ds, [type]: count > idx ? idx : idx + 1 },
    });
  }

  const pct = hpMax > 0 ? Math.max(0, (current / hpMax) * 100) : 0;
  const hpColor = pct > 50 ? 'var(--success-color)' : pct > 25 ? 'var(--accent-color)' : 'var(--error-color)';

  return (
    <div class="hp-section">
      {/* HP bar row */}
      <div class="hp-row">
        <button class="cs-hp-btn" onClick={() => setHp(current - 1)} aria-label="Decrease HP">−</button>
        <div class="hp-bar-wrap" onClick={() => setModalOpen(true)} role="button" aria-label="Adjust HP">
          <div class="hp-bar-track">
            <div class="hp-bar-fill" style={{ width: `${pct}%`, background: hpColor }} />
          </div>
          <div class="hp-bar-label">
            <span class="hp-current">{current}</span>
            <span class="hp-slash">/</span>
            <span class="hp-max">{hpMax}</span>
            {temp > 0 && <span class="hp-temp">+{temp} tmp</span>}
          </div>
        </div>
        <button class="cs-hp-btn" onClick={() => setHp(current + 1)} aria-label="Increase HP">+</button>
      </div>

      {/* Temp HP row */}
      <div class="hp-temp-row">
        <span class="hp-temp-label">Temp HP</span>
        <button class="cs-hp-btn sm" onClick={() => setTemp(temp - 1)}>−</button>
        <span class="hp-temp-val">{temp}</span>
        <button class="cs-hp-btn sm" onClick={() => setTemp(temp + 1)}>+</button>
      </div>

      {/* Death saves — only when at 0 HP */}
      {isDead && (
        <div class="death-saves">
          <div class="death-row">
            <span class="death-label">Successes</span>
            {[0, 1, 2].map(i => (
              <button
                key={i}
                class={`death-pip success${i < ds.successes ? ' filled' : ''}`}
                onClick={() => toggleDeathSave('successes', i)}
                aria-label={`Success ${i + 1}`}
              />
            ))}
          </div>
          <div class="death-row">
            <span class="death-label">Failures</span>
            {[0, 1, 2].map(i => (
              <button
                key={i}
                class={`death-pip failure${i < ds.failures ? ' filled' : ''}`}
                onClick={() => toggleDeathSave('failures', i)}
                aria-label={`Failure ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* HP adjustment modal */}
      {modalOpen && (
        <div class="bd-overlay" onClick={() => setModalOpen(false)}>
          <div class="hp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Adjust HP">
            <div class="hp-modal-header">
              <span>HP: {current} / {hpMax}</span>
              <button class="bd-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div class="hp-modal-modes">
              {(['damage', 'heal', 'set'] as HpMode[]).map(m => (
                <button
                  key={m}
                  class={`hp-mode-btn${mode === m ? ' active' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'damage' ? 'Damage' : m === 'heal' ? 'Heal' : 'Set'}
                </button>
              ))}
            </div>
            <input
              class="hp-modal-input"
              type="number"
              min="0"
              value={amount}
              placeholder="Amount"
              onInput={e => setAmount((e.target as HTMLInputElement).value)}
              onKeyDown={e => { if (e.key === 'Enter') applyModal(); }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autofocus
            />
            <button class="cs-btn-main" onClick={applyModal}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
