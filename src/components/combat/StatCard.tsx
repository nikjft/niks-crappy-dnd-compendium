import { useState } from 'preact/hooks';
import { BreakdownPopup } from '../shared/BreakdownPopup.js';
import type { Breakdown } from '../../data/types.js';

interface Props {
  label: string;
  value: string;
  breakdown?: Breakdown;
}

export function StatCard({ label, value, breakdown }: Props) {
  const [open, setOpen] = useState(false);
  const clickable = !!breakdown;

  return (
    <>
      <div
        class={`cs-combat-stat-card${clickable ? ' clickable' : ''}`}
        onClick={clickable ? (e) => { e.stopPropagation(); setOpen(true); } : undefined}
        onMouseDown={clickable ? (e) => e.stopPropagation() : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); } : undefined}
        aria-label={clickable ? `${label}: ${value}. Tap for breakdown.` : undefined}
      >
        <span class="cs-combat-stat-label">{label}</span>
        <span class="cs-combat-stat-val">{value}</span>
      </div>
      {open && breakdown && (
        <BreakdownPopup
          label={label}
          breakdown={breakdown}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
