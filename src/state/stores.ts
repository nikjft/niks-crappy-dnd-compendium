import { signal, computed } from '@preact/signals';
import { calculateCharacterState } from '../engine/engine.js';
import type { Character, CharacterState, CompendiumRecord } from '../data/types.js';

// ─── Core character state ─────────────────────────────────────────────────────

export const currentCharacter = signal<Character | null>(null);

/** Re-derived whenever currentCharacter changes. */
export const charState = computed<CharacterState | null>(() => {
  const c = currentCharacter.value;
  return c ? calculateCharacterState(c) : null;
});

// ─── UI state ─────────────────────────────────────────────────────────────────

/** Active top-level tab (mirrors legacy app.js activeTab). */
export const activeTab = signal<string>('character');

/** Expanded row id in any list table (only one expanded at a time). */
export const expandedRowId = signal<string | null>(null);

// ─── Compendium records ───────────────────────────────────────────────────────

export const allRecords = signal<CompendiumRecord[]>([]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Partially update the current character and trigger recompute. */
export function patchCharacter(patch: Partial<Character>): void {
  const prev = currentCharacter.value;
  if (!prev) return;
  const next = { ...prev, ...patch, _modified_at: new Date().toISOString() };
  currentCharacter.value = next;
  // Keep legacy app.js global in sync so other tabs see updated data
  if (typeof window !== 'undefined') (window as any).currentCharacter = next;
}
