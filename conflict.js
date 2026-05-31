// conflict.js — Last-Write-Wins (LWW) Deterministic Merge Strategy
// Implements spec §3.4: Conflict Resolution Engine

// Records that differ by less than this many ms are considered a "tie"
const TIE_THRESHOLD_MS = 1000;

/**
 * Merge two sync state payloads using LWW rules.
 *
 * Rules:
 *  1. Non-overlapping records (different names): union merge — keep all.
 *  2. Overlapping records (same name key):
 *     - Compare _modified_at ISO-8601 timestamps
 *     - Newer timestamp wins.
 *     - Tie (within TIE_THRESHOLD_MS): local wins (conservative).
 *     - Missing timestamps: prefer remote if only remote has one, else prefer local.
 *  3. If any ties occur within TIE_THRESHOLD_MS, they are reported in `conflicts`.
 *
 * @param {Object} localPayload  - { spells: [], items: [], ... }
 * @param {Object} remotePayload - { spells: [], items: [], ... }
 * @param {string[]} storeNames  - list of store names to merge
 * @returns {{ merged: Object, conflicts: Array<{store, name, localRecord, remoteRecord}> }}
 */
export function mergeStates(localPayload, remotePayload, storeNames) {
  const merged = {};
  const conflicts = [];

  for (const store of storeNames) {
    const localRecords = localPayload[store] || [];
    const remoteRecords = remotePayload[store] || [];

    // Build maps keyed by record name for O(n) merge
    const localMap = new Map(localRecords.map(r => [r.name, r]));
    const remoteMap = new Map(remoteRecords.map(r => [r.name, r]));

    const resultMap = new Map();

    // Add all local records first
    for (const [name, local] of localMap) {
      const remote = remoteMap.get(name);
      if (!remote) {
        // Non-overlapping: local only — keep it
        resultMap.set(name, local);
      } else {
        // Overlapping: apply LWW
        const winner = _lwwPick(local, remote);
        if (winner.isConflict) {
          conflicts.push({ store, name, localRecord: local, remoteRecord: remote });
          resultMap.set(name, winner.record); // still stores the winner (local wins on tie)
        } else {
          resultMap.set(name, winner.record);
        }
      }
    }

    // Add remote records that aren't in local (non-overlapping: remote only)
    for (const [name, remote] of remoteMap) {
      if (!localMap.has(name)) {
        resultMap.set(name, remote);
      }
    }

    merged[store] = Array.from(resultMap.values());
  }

  return { merged, conflicts };
}

/**
 * Pick the winner between two versions of the same record.
 * @returns {{ record: Object, isConflict: boolean }}
 */
function _lwwPick(local, remote) {
  const localTs = _parseTs(local._modified_at);
  const remoteTs = _parseTs(remote._modified_at);

  // Neither has a timestamp: prefer local
  if (localTs === null && remoteTs === null) {
    return { record: local, isConflict: false };
  }

  // Only remote has timestamp: remote wins
  if (localTs === null) {
    return { record: remote, isConflict: false };
  }

  // Only local has timestamp: local wins
  if (remoteTs === null) {
    return { record: local, isConflict: false };
  }

  const diff = Math.abs(localTs - remoteTs);

  // Clear winner
  if (diff >= TIE_THRESHOLD_MS) {
    return { record: localTs > remoteTs ? local : remote, isConflict: false };
  }

  // Tie — local wins (conservative), flag as conflict
  return { record: local, isConflict: true };
}

function _parseTs(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  return isNaN(t) ? null : t;
}

/**
 * Validate that a sync envelope has the required structure.
 * @param {Object} envelope
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEnvelope(envelope) {
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

/**
 * Build a sync envelope from a data payload.
 * @param {string} deviceId
 * @param {Object} payload - { spells: [], ... }
 * @param {number} sequenceNumber
 * @returns {Object} The envelope ready to JSON.stringify
 */
export function buildEnvelope(deviceId, payload, sequenceNumber) {
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
