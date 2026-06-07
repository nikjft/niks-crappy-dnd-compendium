// Vitest port of test_sync.js (LWW conflict resolution tests)
// Legacy node runner: node test_sync.js

import { describe, it, expect } from 'vitest';
// @ts-ignore — legacy JS module
import { mergeStates, validateEnvelope, buildEnvelope } from '../../conflict.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MergeResult = { merged: any; conflicts: any[] };

const ts = (offsetMs = 0) =>
  new Date(1700000000000 + offsetMs).toISOString();

describe('LWW mergeStates — non-overlapping records', () => {
  it('keeps all records when local and remote have no overlap', () => {
    const local = { characters: [{ name: 'Alice', _modified_at: ts() }] };
    const remote = { characters: [{ name: 'Bob', _modified_at: ts() }] };
    const { merged, conflicts }: MergeResult = mergeStates(local, remote, ['characters']);
    expect(merged.characters).toHaveLength(2);
    expect(conflicts).toHaveLength(0);
  });
});

describe('LWW mergeStates — overlapping records', () => {
  it('picks the more recently modified record', () => {
    const local = { characters: [{ name: 'Alice', _modified_at: ts(0) }] };
    const remote = { characters: [{ name: 'Alice', _modified_at: ts(5000) }] };
    const { merged, conflicts }: MergeResult = mergeStates(local, remote, ['characters']);
    expect(merged.characters).toHaveLength(1);
    expect(merged.characters[0]._modified_at).toBe(ts(5000));
    expect(conflicts).toHaveLength(0);
  });

  it('flags a conflict when timestamps are within 1 second of each other', () => {
    const local = { characters: [{ name: 'Alice', _modified_at: ts(0) }] };
    const remote = { characters: [{ name: 'Alice', _modified_at: ts(500) }] };
    const { conflicts }: MergeResult = mergeStates(local, remote, ['characters']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('Alice');
  });
});

describe('validateEnvelope', () => {
  it('accepts a valid envelope', () => {
    const env = buildEnvelope('device-1', { characters: [] }, 1);
    const result = validateEnvelope(env);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an envelope missing _metadata', () => {
    const result = validateEnvelope({ payload: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('_metadata'))).toBe(true);
  });

  it('rejects a non-object', () => {
    const result = validateEnvelope(null as any);
    expect(result.valid).toBe(false);
  });
});
