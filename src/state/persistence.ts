/**
 * Debounced persistence: whenever currentCharacter changes, save it to IndexedDB
 * via the existing db.js layer after a 500 ms idle.
 */

import { effect } from '@preact/signals';
import { currentCharacter } from './stores.js';

// @ts-ignore — legacy JS module, types derived at call site
import { saveRecord } from '../../db.js';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Call once at app startup. Disposes itself when the returned fn is called. */
export function startPersistenceEffect(): () => void {
  return effect(() => {
    const character = currentCharacter.value;
    if (!character) return;

    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      saveRecord('characters', character).catch((err: unknown) => {
        console.error('[persistence] save failed:', err);
      });
    }, 500);
  });
}
