import { useEffect, useRef } from 'preact/hooks';
import type { Breakdown, BreakdownPart } from '../../data/types.js';

interface ExtraRow {
  label: string;
  value: string;
}

interface Props {
  label: string;
  breakdown: Breakdown;
  onClose: () => void;
  /** Optional supplemental rows shown below the total (e.g. damage formula). */
  extras?: ExtraRow[];
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function opSymbol(part: BreakdownPart): string {
  if (part.op === 'set') return '→';
  if (part.op === 'min') return '↑ min';
  if (part.op === 'max') return '↓ max';
  return part.value >= 0 ? '+' : '−';
}

function opDisplay(part: BreakdownPart): string {
  if (part.op === 'set') return `${part.value}`;
  const abs = Math.abs(part.value);
  return `${opSymbol(part)} ${abs}`;
}

export function BreakdownPopup({ label, breakdown, onClose, extras }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div class="bd-overlay">
      <div class="bd-popup" ref={ref} role="dialog" aria-modal="true" aria-label={`${label} breakdown`}>
        <div class="bd-header">
          <span class="bd-title">{label}</span>
          <button class="bd-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div class="bd-rows">
          <div class="bd-row bd-base">
            <span class="bd-row-label">{breakdown.base.label}</span>
            <span class="bd-row-val">{breakdown.base.value}</span>
          </div>
          {breakdown.parts.map((part, i) => (
            <div class="bd-row" key={i}>
              <span class="bd-row-label">{part.label}</span>
              <span class="bd-row-val bd-row-part">{opDisplay(part)}</span>
            </div>
          ))}
        </div>
        <div class="bd-total">
          <span>Total</span>
          <span class="bd-total-val">{sign(breakdown.total)}</span>
        </div>
        {extras && extras.length > 0 && (
          <div class="bd-extras">
            {extras.map((ex, i) => (
              <div class="bd-extra-row" key={i}>
                <span class="bd-extra-label">{ex.label}</span>
                <span class="bd-extra-val">{ex.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
