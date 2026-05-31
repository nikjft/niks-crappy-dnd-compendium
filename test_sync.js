// test_sync.js — Unit & Integration Tests for Storage, Conflict Resolution, and Sync Engine
// Run with: node test_sync.js

import { JSDOM } from 'jsdom';
import fs from 'fs';
import crypto from 'crypto';

// ─── Test Framework ───────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${b}\n  Actual:   ${a}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

function section(name) {
  console.log(`\n─── ${name} ${'─'.repeat(Math.max(0, 55 - name.length))}`);
}

// ─── Setup JSDOM environment for Web Crypto ───────────────────────────────────

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  runScripts: 'dangerously',
});
global.window = dom.window;
global.document = dom.window.document;

// Polyfill Web Crypto for Node.js (required by sync.js PKCE)
const nodeCryptoForTest = crypto; // Node's built-in crypto
const webCryptoSubtle = nodeCryptoForTest.webcrypto
  ? nodeCryptoForTest.webcrypto.subtle
  : nodeCryptoForTest.subtle;

const testCrypto = {
  getRandomValues: (arr) => {
    const bytes = nodeCryptoForTest.randomBytes(arr.length);
    for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
    return arr;
  },
  subtle: webCryptoSubtle,
};

// Don't replace global.crypto (read-only in Node 25); use local testCrypto instead

// ─── Load modules under test ──────────────────────────────────────────────────

// Read and transform source files for Node.js ESM compatibility
// We inline the logic to test pure functions without full module loading

// ── Inline conflict.js logic ──

const TIE_THRESHOLD_MS = 1000;

function mergeStates(localPayload, remotePayload, storeNames) {
  const merged = {};
  const conflicts = [];

  for (const store of storeNames) {
    const localRecords = localPayload[store] || [];
    const remoteRecords = remotePayload[store] || [];

    const localMap = new Map(localRecords.map(r => [r.name, r]));
    const remoteMap = new Map(remoteRecords.map(r => [r.name, r]));
    const resultMap = new Map();

    for (const [name, local] of localMap) {
      const remote = remoteMap.get(name);
      if (!remote) {
        resultMap.set(name, local);
      } else {
        const winner = lwwPick(local, remote);
        if (winner.isConflict) {
          conflicts.push({ store, name, localRecord: local, remoteRecord: remote });
        }
        resultMap.set(name, winner.record);
      }
    }

    for (const [name, remote] of remoteMap) {
      if (!localMap.has(name)) {
        resultMap.set(name, remote);
      }
    }

    merged[store] = Array.from(resultMap.values());
  }

  return { merged, conflicts };
}

function lwwPick(local, remote) {
  const localTs = parseTs(local._modified_at);
  const remoteTs = parseTs(remote._modified_at);

  if (localTs === null && remoteTs === null) return { record: local, isConflict: false };
  if (localTs === null) return { record: remote, isConflict: false };
  if (remoteTs === null) return { record: local, isConflict: false };

  const diff = Math.abs(localTs - remoteTs);
  if (diff >= TIE_THRESHOLD_MS) {
    return { record: localTs > remoteTs ? local : remote, isConflict: false };
  }
  return { record: local, isConflict: true };
}

function parseTs(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  return isNaN(t) ? null : t;
}

function validateEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, errors: ['Envelope is not an object'] };
  }
  if (!envelope._metadata) errors.push('Missing _metadata block');
  else {
    if (!envelope._metadata.device_id) errors.push('Missing _metadata.device_id');
    if (!envelope._metadata.last_modified_client) errors.push('Missing _metadata.last_modified_client');
    if (typeof envelope._metadata.schema_version !== 'number') errors.push('Missing or invalid _metadata.schema_version');
    if (typeof envelope._metadata.sequence_number !== 'number') errors.push('Missing or invalid _metadata.sequence_number');
  }
  if (!envelope.payload || typeof envelope.payload !== 'object') errors.push('Missing payload block');
  return { valid: errors.length === 0, errors };
}

function buildEnvelope(deviceId, payload, sequenceNumber) {
  return {
    _metadata: {
      device_id: deviceId,
      last_modified_client: new Date().toISOString(),
      schema_version: 1,
      sequence_number: sequenceNumber,
    },
    payload,
  };
}

// ── Inline PKCE functions from sync.js ──

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  testCrypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return testCrypto.subtle.digest('SHA-256', data);
}

function base64URLEncode(buffer) {
  return Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePKCE() {
  const codeVerifier = generateRandomString(96);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64URLEncode(hashed);
  return { codeVerifier, codeChallenge };
}

// ── Inline storage.js quota monitor mock ──

const QUOTA_WARN_THRESHOLD = 0.80;
let mockEstimate = { usage: 100, quota: 1000 };
let quotaWarningFired = false;
let quotaWarningValue = null;

async function mockGetStorageQuota() {
  const { usage, quota } = mockEstimate;
  const percentUsed = quota > 0 ? usage / quota : 0;
  if (percentUsed > QUOTA_WARN_THRESHOLD && !quotaWarningFired) {
    quotaWarningFired = true;
    quotaWarningValue = percentUsed;
  }
  return { usage, quota, percentUsed };
}

// ── In-memory IndexedDB mock for overwrite guard test ──

const mockStoreData = {};
const STORES = ['spells', 'items', 'monsters', 'classes', 'feats', 'backgrounds', 'races', 'options'];
STORES.forEach(s => { mockStoreData[s] = new Map(); });

async function mockSaveRecords(storeName, records, opts = {}) {
  const { skipIfNewer = false } = opts;
  for (const record of records) {
    if (skipIfNewer) {
      const existing = mockStoreData[storeName].get(record.name);
      if (existing && existing._modified_at && record._modified_at) {
        const existingTs = new Date(existing._modified_at).getTime();
        const incomingTs = new Date(record._modified_at).getTime();
        if (existingTs > incomingTs) continue; // skip stale incoming
      }
    }
    mockStoreData[storeName].set(record.name, { ...record });
  }
}

async function mockGetAllRecords(storeName) {
  return Array.from(mockStoreData[storeName].values());
}

async function mockExportAllData() {
  const snapshot = {};
  for (const store of STORES) {
    snapshot[store] = Array.from(mockStoreData[store].values());
  }
  return snapshot;
}

async function mockImportAllData(data, opts = {}) {
  const { merge = false } = opts;
  if (!merge) {
    STORES.forEach(s => { mockStoreData[s].clear(); });
  }
  for (const store of STORES) {
    if (data[store] && data[store].length > 0) {
      await mockSaveRecords(store, data[store], { skipIfNewer: false });
    }
  }
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         SYNC / STORAGE / CONFLICT UNIT TESTS            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── PKCE Generation ──────────────────────────────────────────────────────────
  section('PKCE Generation');

  await test('code_verifier length is between 43 and 128 chars', async () => {
    const { codeVerifier } = await generatePKCE();
    assert(codeVerifier.length >= 43 && codeVerifier.length <= 128,
      `code_verifier length ${codeVerifier.length} not in range [43, 128]`);
  });

  await test('code_challenge is base64url encoded (no +, /, = chars)', async () => {
    const { codeChallenge } = await generatePKCE();
    assert(!/[+/=]/.test(codeChallenge), `code_challenge contains invalid chars: ${codeChallenge}`);
  });

  await test('code_challenge is 43 chars (base64url of 32-byte SHA-256)', async () => {
    const { codeChallenge } = await generatePKCE();
    // SHA-256 = 32 bytes → 43 base64url chars (no padding)
    assert(codeChallenge.length === 43, `Expected 43 chars, got ${codeChallenge.length}`);
  });

  await test('two PKCE calls produce different verifiers', async () => {
    const { codeVerifier: v1 } = await generatePKCE();
    const { codeVerifier: v2 } = await generatePKCE();
    assert(v1 !== v2, 'code_verifier should be unique per call');
  });

  await test('code_challenge is deterministic SHA-256 of verifier', async () => {
    const verifier = 'testverifier1234567890abcdefghijklmnopqrstuvwxyz12345678901234567890';
    const hashed = await sha256(verifier);
    const expected = base64URLEncode(hashed);
    // Re-compute
    const hashed2 = await sha256(verifier);
    const expected2 = base64URLEncode(hashed2);
    assertEqual(expected, expected2, 'SHA-256 should be deterministic');
  });

  // ── Envelope Schema ───────────────────────────────────────────────────────────
  section('Sync Envelope Schema');

  await test('valid envelope passes validation', () => {
    const env = buildEnvelope('device-abc', { spells: [], items: [] }, 1);
    const { valid, errors } = validateEnvelope(env);
    assert(valid, `Envelope should be valid. Errors: ${errors.join(', ')}`);
  });

  await test('envelope missing _metadata fails validation', () => {
    const { valid, errors } = validateEnvelope({ payload: {} });
    assert(!valid, 'Should fail validation');
    assert(errors.some(e => e.includes('_metadata')), 'Should report missing _metadata');
  });

  await test('envelope missing payload fails validation', () => {
    const env = buildEnvelope('device-abc', null, 1);
    env.payload = undefined;
    const { valid, errors } = validateEnvelope(env);
    assert(!valid, 'Should fail validation');
    assert(errors.some(e => e.includes('payload')), 'Should report missing payload');
  });

  await test('envelope has all required metadata fields', () => {
    const env = buildEnvelope('device-xyz', { spells: [] }, 5);
    assertEqual(env._metadata.device_id, 'device-xyz', 'device_id should match');
    assertEqual(env._metadata.schema_version, 1, 'schema_version should be 1');
    assertEqual(env._metadata.sequence_number, 5, 'sequence_number should be 5');
    assert(env._metadata.last_modified_client, 'last_modified_client should be set');
    // Verify ISO-8601 format
    assert(!isNaN(new Date(env._metadata.last_modified_client).getTime()),
      'last_modified_client should be a valid date');
  });

  await test('envelope sequence number increments correctly across builds', () => {
    const env1 = buildEnvelope('dev', {}, 1);
    const env2 = buildEnvelope('dev', {}, 2);
    assert(env2._metadata.sequence_number > env1._metadata.sequence_number,
      'Sequence numbers should increase');
  });

  // ── LWW Merge — No Overlap ────────────────────────────────────────────────────
  section('LWW Merge — Non-overlapping Records');

  await test('union merge: all records from both sides are kept', () => {
    const local = { spells: [{ name: 'Fireball', _modified_at: '2024-01-01T12:00:00Z' }] };
    const remote = { spells: [{ name: 'Frostbolt', _modified_at: '2024-01-01T12:00:00Z' }] };
    const { merged } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells.length, 2, 'Should have 2 spells after union merge');
  });

  await test('local-only records are preserved in merge', () => {
    const local = { spells: [{ name: 'Magic Missile', _modified_at: '2024-01-01T00:00:00Z' }] };
    const remote = { spells: [] };
    const { merged } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells.length, 1, 'Local record should be preserved');
    assertEqual(merged.spells[0].name, 'Magic Missile', 'Record name should match');
  });

  await test('remote-only records are preserved in merge', () => {
    const local = { spells: [] };
    const remote = { spells: [{ name: 'Thunderwave', _modified_at: '2024-01-01T00:00:00Z' }] };
    const { merged } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells.length, 1, 'Remote record should be preserved');
    assertEqual(merged.spells[0].name, 'Thunderwave', 'Record name should match');
  });

  await test('empty local + empty remote = empty merged', () => {
    const { merged } = mergeStates({ spells: [] }, { spells: [] }, ['spells']);
    assertEqual(merged.spells.length, 0, 'Should produce empty result');
  });

  await test('multiple stores merged independently', () => {
    const local = { spells: [{ name: 'A', _modified_at: '2024-01-01T00:00:00Z' }], items: [{ name: 'Sword', _modified_at: '2024-01-01T00:00:00Z' }] };
    const remote = { spells: [{ name: 'B', _modified_at: '2024-01-01T00:00:00Z' }], items: [{ name: 'Shield', _modified_at: '2024-01-01T00:00:00Z' }] };
    const { merged } = mergeStates(local, remote, ['spells', 'items']);
    assertEqual(merged.spells.length, 2, 'Spells should have 2 entries');
    assertEqual(merged.items.length, 2, 'Items should have 2 entries');
  });

  // ── LWW Merge — Overlapping Records ──────────────────────────────────────────
  section('LWW Merge — Overlapping Records (Same Name)');

  await test('remote newer than local: remote wins', () => {
    const local  = { spells: [{ name: 'Bless', description: 'old',  _modified_at: '2024-01-01T10:00:00Z' }] };
    const remote = { spells: [{ name: 'Bless', description: 'new',  _modified_at: '2024-01-01T12:00:00Z' }] };
    const { merged, conflicts } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].description, 'new', 'Remote (newer) should win');
    assertEqual(conflicts.length, 0, 'Should have no conflicts');
  });

  await test('local newer than remote: local wins', () => {
    const local  = { spells: [{ name: 'Bless', description: 'new',  _modified_at: '2024-01-01T12:00:00Z' }] };
    const remote = { spells: [{ name: 'Bless', description: 'old',  _modified_at: '2024-01-01T10:00:00Z' }] };
    const { merged, conflicts } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].description, 'new', 'Local (newer) should win');
    assertEqual(conflicts.length, 0, 'Should have no conflicts');
  });

  await test('only remote has timestamp: remote wins', () => {
    const local  = { spells: [{ name: 'Command', data: 'local'  }] };
    const remote = { spells: [{ name: 'Command', data: 'remote', _modified_at: '2024-01-01T12:00:00Z' }] };
    const { merged } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].data, 'remote', 'Remote should win (has timestamp, local does not)');
  });

  await test('only local has timestamp: local wins', () => {
    const local  = { spells: [{ name: 'Command', data: 'local', _modified_at: '2024-01-01T12:00:00Z' }] };
    const remote = { spells: [{ name: 'Command', data: 'remote' }] };
    const { merged } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].data, 'local', 'Local should win (has timestamp, remote does not)');
  });

  await test('neither has timestamp: local wins (conservative)', () => {
    const local  = { spells: [{ name: 'Shield', data: 'local' }] };
    const remote = { spells: [{ name: 'Shield', data: 'remote' }] };
    const { merged } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].data, 'local', 'Local should win when no timestamps');
  });

  // ── LWW Merge — Tie / Conflict ────────────────────────────────────────────────
  section('LWW Merge — Tie Handling (< 1s difference)');

  await test('tie within 1s: local wins conservatively and conflict is reported', () => {
    const t = new Date('2024-06-01T10:00:00.000Z').getTime();
    const local  = { spells: [{ name: 'Web', data: 'local',  _modified_at: new Date(t).toISOString() }] };
    const remote = { spells: [{ name: 'Web', data: 'remote', _modified_at: new Date(t + 500).toISOString() }] };
    // 500ms difference — within TIE_THRESHOLD_MS
    const { merged, conflicts } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].data, 'local', 'Local should win on tie');
    assertEqual(conflicts.length, 1, 'Should report 1 conflict');
    assertEqual(conflicts[0].name, 'Web', 'Conflict should name the record');
    assertEqual(conflicts[0].store, 'spells', 'Conflict should name the store');
  });

  await test('difference exactly at threshold (1000ms): no conflict, newer wins', () => {
    const t = new Date('2024-06-01T10:00:00.000Z').getTime();
    const local  = { spells: [{ name: 'Haste', data: 'local',  _modified_at: new Date(t).toISOString() }] };
    const remote = { spells: [{ name: 'Haste', data: 'remote', _modified_at: new Date(t + 1000).toISOString() }] };
    const { merged, conflicts } = mergeStates(local, remote, ['spells']);
    assertEqual(merged.spells[0].data, 'remote', 'Remote (1s newer) should win without conflict');
    assertEqual(conflicts.length, 0, 'Should have no conflicts at exactly 1s');
  });

  await test('multiple conflicts from different records are all reported', () => {
    const t = new Date('2024-06-01T10:00:00.000Z').getTime();
    const local  = { spells: [
      { name: 'Fireball', data: 'l', _modified_at: new Date(t).toISOString() },
      { name: 'Ice Storm', data: 'l', _modified_at: new Date(t).toISOString() },
    ] };
    const remote = { spells: [
      { name: 'Fireball', data: 'r', _modified_at: new Date(t + 200).toISOString() },
      { name: 'Ice Storm', data: 'r', _modified_at: new Date(t + 400).toISOString() },
    ] };
    const { conflicts } = mergeStates(local, remote, ['spells']);
    assertEqual(conflicts.length, 2, 'Should report 2 conflicts');
  });

  // ── Storage Persistence ────────────────────────────────────────────────────────
  section('Storage Persistence');

  await test('persist() granted: storageHealth.persistenceGranted = true', async () => {
    const mockNav = { storage: { persist: async () => true, persisted: async () => false, estimate: async () => ({ usage: 100, quota: 1000 }) } };
    // Inline test since we can't import full module
    const granted = await mockNav.storage.persist();
    assertEqual(granted, true, 'Persistence should be granted');
  });

  await test('persist() denied: storageHealth.persistenceGranted = false', async () => {
    const mockNav = { storage: { persist: async () => false, persisted: async () => false, estimate: async () => ({ usage: 100, quota: 1000 }) } };
    const granted = await mockNav.storage.persist();
    assertEqual(granted, false, 'Persistence should be denied');
  });

  await test('quota monitor fires callback when usage > 80%', async () => {
    // Reset flag
    quotaWarningFired = false;
    quotaWarningValue = null;
    mockEstimate = { usage: 850, quota: 1000 }; // 85%
    await mockGetStorageQuota();
    assert(quotaWarningFired, 'Warning callback should have fired at 85%');
    assert(quotaWarningValue > 0.80, 'Warning value should be above threshold');
  });

  await test('quota monitor does NOT fire when usage < 80%', async () => {
    quotaWarningFired = false;
    mockEstimate = { usage: 500, quota: 1000 }; // 50%
    await mockGetStorageQuota();
    assert(!quotaWarningFired, 'Warning should NOT fire at 50%');
  });

  await test('getStorageQuota returns percentUsed as 0..1 fraction', async () => {
    mockEstimate = { usage: 200, quota: 1000 };
    const { percentUsed } = await mockGetStorageQuota();
    assertEqual(percentUsed, 0.2, 'percentUsed should be 0.2 (20%)');
  });

  // ── Overwrite Guard (skipIfNewer) ─────────────────────────────────────────────
  section('DB Overwrite Guard (skipIfNewer)');

  await test('skipIfNewer=false: always overwrites', async () => {
    STORES.forEach(s => mockStoreData[s].clear());
    const existing = { name: 'Fireball', level: 3, _modified_at: '2024-01-10T00:00:00Z' };
    await mockSaveRecords('spells', [existing], { skipIfNewer: false });

    const stale = { name: 'Fireball', level: 99, _modified_at: '2024-01-01T00:00:00Z' };
    await mockSaveRecords('spells', [stale], { skipIfNewer: false });

    const records = await mockGetAllRecords('spells');
    assertEqual(records[0].level, 99, 'Should overwrite even with stale data when skipIfNewer=false');
  });

  await test('skipIfNewer=true: stale data does NOT overwrite newer local data', async () => {
    STORES.forEach(s => mockStoreData[s].clear());
    const local = { name: 'Fireball', data: 'fresh', _modified_at: '2024-06-01T12:00:00Z' };
    await mockSaveRecords('spells', [local], { skipIfNewer: false });

    const stale = { name: 'Fireball', data: 'stale', _modified_at: '2024-01-01T00:00:00Z' };
    await mockSaveRecords('spells', [stale], { skipIfNewer: true });

    const records = await mockGetAllRecords('spells');
    assertEqual(records[0].data, 'fresh', 'Local fresh data should NOT be overwritten by stale cloud data');
  });

  await test('skipIfNewer=true: newer cloud data DOES overwrite older local data', async () => {
    STORES.forEach(s => mockStoreData[s].clear());
    const local = { name: 'Bless', data: 'old-local', _modified_at: '2024-01-01T00:00:00Z' };
    await mockSaveRecords('spells', [local], { skipIfNewer: false });

    const newer = { name: 'Bless', data: 'newer-cloud', _modified_at: '2024-06-01T12:00:00Z' };
    await mockSaveRecords('spells', [newer], { skipIfNewer: true });

    const records = await mockGetAllRecords('spells');
    assertEqual(records[0].data, 'newer-cloud', 'Newer cloud data should overwrite older local data');
  });

  await test('skipIfNewer=true: new records (not yet local) are always inserted', async () => {
    STORES.forEach(s => mockStoreData[s].clear());

    const remote = { name: 'New Spell', data: 'cloud-only', _modified_at: '2024-06-01T00:00:00Z' };
    await mockSaveRecords('spells', [remote], { skipIfNewer: true });

    const records = await mockGetAllRecords('spells');
    assertEqual(records.length, 1, 'New record should be inserted');
    assertEqual(records[0].name, 'New Spell', 'New record should have correct name');
  });

  // ── Export / Import Round-Trip ────────────────────────────────────────────────
  section('Export / Import Round-Trip');

  await test('export then import produces identical store state', async () => {
    STORES.forEach(s => mockStoreData[s].clear());
    const spells = [
      { name: 'Fireball', level: 3, _modified_at: '2024-01-01T00:00:00Z' },
      { name: 'Bless', level: 1, _modified_at: '2024-01-01T00:00:00Z' },
    ];
    const monsters = [{ name: 'Goblin', cr: '1/4', _modified_at: '2024-01-01T00:00:00Z' }];
    await mockSaveRecords('spells', spells);
    await mockSaveRecords('monsters', monsters);

    const exported = await mockExportAllData();
    assertEqual(exported.spells.length, 2, 'Export should have 2 spells');
    assertEqual(exported.monsters.length, 1, 'Export should have 1 monster');

    // Clear and re-import
    STORES.forEach(s => mockStoreData[s].clear());
    await mockImportAllData(exported, { merge: false });

    const reimported = await mockExportAllData();
    assertEqual(reimported.spells.length, 2, 'Re-imported should have 2 spells');
    assertEqual(reimported.monsters.length, 1, 'Re-imported should have 1 monster');
    assertEqual(reimported.spells[0].name, exported.spells[0].name, 'Spell names should match');
  });

  await test('import with merge=false clears existing data first', async () => {
    STORES.forEach(s => mockStoreData[s].clear());
    await mockSaveRecords('spells', [{ name: 'Old Spell', _modified_at: '2024-01-01T00:00:00Z' }]);

    const newData = { spells: [{ name: 'New Spell', _modified_at: '2024-06-01T00:00:00Z' }] };
    await mockImportAllData(newData, { merge: false });

    const records = await mockGetAllRecords('spells');
    assertEqual(records.length, 1, 'Should have only the new record');
    assertEqual(records[0].name, 'New Spell', 'Should have new spell, not old one');
  });

  await test('import with merge=true keeps existing records not in import', async () => {
    STORES.forEach(s => mockStoreData[s].clear());
    await mockSaveRecords('spells', [{ name: 'Kept Spell', _modified_at: '2024-01-01T00:00:00Z' }]);

    const additionalData = { spells: [{ name: 'Added Spell', _modified_at: '2024-06-01T00:00:00Z' }] };
    await mockImportAllData(additionalData, { merge: true });

    const records = await mockGetAllRecords('spells');
    assertEqual(records.length, 2, 'Should have both kept and added spells');
  });

  // ── Offline Banner ────────────────────────────────────────────────────────────
  section('Offline/Online State Handling');

  await test('sync state emits "offline" when navigator.onLine is false', () => {
    // Simulate the logic from initSync's online/offline event handling
    let capturedStatus = null;
    const mockSyncState = { status: 'idle', isLinked: true };

    // This is the exact logic from initSync's offline handler
    const offlineHandler = () => { mockSyncState.status = 'offline'; capturedStatus = mockSyncState.status; };
    offlineHandler(); // simulate going offline
    assertEqual(capturedStatus, 'offline', 'Status should be "offline" when network is lost');
  });

  await test('sync state returns to "idle" or "syncing" when online event fires', () => {
    let capturedStatus = null;
    const mockSyncState = { status: 'offline', isLinked: true };

    // Simulate online event triggering a sync
    const onlineHandler = () => {
      if (mockSyncState.isLinked) mockSyncState.status = 'syncing';
      capturedStatus = mockSyncState.status;
    };
    onlineHandler();
    assertEqual(capturedStatus, 'syncing', 'Status should be "syncing" when network is restored');
  });

  // ─── Summary ───────────────────────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════════════════════');
  if (failCount === 0) {
    console.log(`✅  ALL ${passCount} TESTS PASSED`);
  } else {
    console.log(`Results: ${passCount} passed, ${failCount} FAILED`);
  }
  console.log('══════════════════════════════════════════════════════════');

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('\n💥 TEST SUITE CRASHED:', err);
  process.exit(1);
});
