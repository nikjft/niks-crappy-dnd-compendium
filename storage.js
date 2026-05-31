// storage.js — Browser Storage Persistence & Quota Monitor
// Implements spec §2: Storage Persistence & OS Defense

const QUOTA_WARN_THRESHOLD = 0.80; // 80% usage triggers warning
let _quotaMonitorTimer = null;

// Internal health state — read by UI to render badges
export const storageHealth = {
  persistenceGranted: null,   // null = unknown, true/false = result
  quotaUsage: 0,              // bytes used
  quotaTotal: 0,              // bytes available
  percentUsed: 0,             // 0..1
  warningFired: false,
  apiSupported: false,
};

// Callbacks registered via onQuotaWarning / onPersistenceResult
let _persistenceCallbacks = [];
let _quotaWarningCallbacks = [];

/**
 * Request persistent (eviction-resistant) storage from the browser.
 * Must be called on first app load.
 * @returns {{ granted: boolean, supported: boolean }}
 */
export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) {
    console.warn('[storage] StorageManager API not supported — degraded mode.');
    storageHealth.apiSupported = false;
    storageHealth.persistenceGranted = false;
    _notifyPersistenceCallbacks();
    return { granted: false, supported: false };
  }

  storageHealth.apiSupported = true;

  try {
    const already = await navigator.storage.persisted();
    if (already) {
      storageHealth.persistenceGranted = true;
      _notifyPersistenceCallbacks();
      return { granted: true, supported: true };
    }

    const granted = await navigator.storage.persist();
    storageHealth.persistenceGranted = granted;

    if (!granted) {
      console.warn('[storage] Browser denied persistent storage — data may be evicted under low-storage conditions.');
    } else {
      console.log('[storage] Persistent storage granted — data is eviction-protected.');
    }

    _notifyPersistenceCallbacks();
    return { granted, supported: true };
  } catch (err) {
    console.error('[storage] Error requesting persistent storage:', err);
    storageHealth.persistenceGranted = false;
    _notifyPersistenceCallbacks();
    return { granted: false, supported: true };
  }
}

/**
 * Get current storage quota estimate.
 * @returns {{ usage: number, quota: number, percentUsed: number }}
 */
export async function getStorageQuota() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { usage: 0, quota: 0, percentUsed: 0 };
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percentUsed = quota > 0 ? usage / quota : 0;
    storageHealth.quotaUsage = usage;
    storageHealth.quotaTotal = quota;
    storageHealth.percentUsed = percentUsed;
    return { usage, quota, percentUsed };
  } catch (err) {
    console.error('[storage] Error estimating quota:', err);
    return { usage: 0, quota: 0, percentUsed: 0 };
  }
}

/**
 * Start the background quota polling loop.
 * Calls registered warning callbacks when usage exceeds threshold.
 * @param {number} [intervalMs=30000]
 */
export function startQuotaMonitor(intervalMs = 30_000) {
  stopQuotaMonitor();
  _runQuotaCheck();
  _quotaMonitorTimer = setInterval(_runQuotaCheck, intervalMs);
}

export function stopQuotaMonitor() {
  if (_quotaMonitorTimer !== null) {
    clearInterval(_quotaMonitorTimer);
    _quotaMonitorTimer = null;
  }
}

async function _runQuotaCheck() {
  const { percentUsed } = await getStorageQuota();
  if (percentUsed > QUOTA_WARN_THRESHOLD) {
    if (!storageHealth.warningFired) {
      storageHealth.warningFired = true;
      _notifyQuotaWarningCallbacks(percentUsed);
    }
  } else {
    storageHealth.warningFired = false;
  }
}

/**
 * Register a callback to be called when quota warning fires.
 * @param {function} cb - receives percentUsed (0..1)
 */
export function onQuotaWarning(cb) {
  _quotaWarningCallbacks.push(cb);
}

/**
 * Register a callback to be called when persistence result is known.
 * @param {function} cb - receives { granted: boolean }
 */
export function onPersistenceResult(cb) {
  _persistenceCallbacks.push(cb);
  // If result already known, fire immediately
  if (storageHealth.persistenceGranted !== null) {
    cb({ granted: storageHealth.persistenceGranted });
  }
}

function _notifyPersistenceCallbacks() {
  _persistenceCallbacks.forEach(cb => cb({ granted: storageHealth.persistenceGranted }));
}

function _notifyQuotaWarningCallbacks(percentUsed) {
  _quotaWarningCallbacks.forEach(cb => cb(percentUsed));
}

/**
 * Initialize storage module. Call once on app startup.
 */
export async function initStorage() {
  await requestPersistentStorage();
  await getStorageQuota();
  startQuotaMonitor(30_000);
}

/**
 * Formats bytes into a human-readable string.
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
