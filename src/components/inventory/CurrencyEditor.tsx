import type { Character } from '../../data/types.js';
import { patchCharacter } from '../../state/stores.js';

interface Props {
  character: Character;
}

export function CurrencyEditor({ character }: Props) {
  const currency = character.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  const denominations: ('pp' | 'gp' | 'ep' | 'sp' | 'cp')[] = ['pp', 'gp', 'ep', 'sp', 'cp'];

  function updateCoin(coin: 'pp' | 'gp' | 'ep' | 'sp' | 'cp', val: number) {
    const newVal = Math.max(0, val);
    patchCharacter({
      currency: {
        ...currency,
        [coin]: newVal
      }
    });
  }

  return (
    <div class="currency-editor-panel">
      <h4 style="margin: 0; font-size: 13px; color: var(--text-primary);">Edit Currency</h4>
      <div class="currency-edit-grid">
        {denominations.map(c => {
          const val = currency[c] ?? 0;
          return (
            <div key={c} class="currency-edit-card">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: var(--text-secondary);">{c}</span>
              <div class="currency-input-group">
                <button onClick={() => updateCoin(c, val - 1)} aria-label={`Decrease ${c}`}>-</button>
                <input
                  type="number"
                  min="0"
                  value={val}
                  onChange={e => updateCoin(c, parseInt((e.target as HTMLInputElement).value) || 0)}
                  aria-label={`Edit ${c} currency`}
                />
                <button onClick={() => updateCoin(c, val + 1)} aria-label={`Increase ${c}`}>+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
