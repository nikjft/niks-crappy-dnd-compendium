// db.js — IndexedDB layer
// Version history:
//   v1-v4: core compendium stores
//   v5: adds _sync_meta, _app_settings; adds _modified_at timestamps

const DB_NAME = 'dnd_compendium_db';
const DB_VERSION = 9;

export const STORES = ['spells', 'items', 'monsters', 'classes', 'subclasses', 'classFeatures', 'subclassFeatures', 'feats', 'backgrounds', 'races', 'options', 'favorites', 'characters'];
const META_STORE = '_sync_meta';
const SETTINGS_STORE = '_app_settings';

let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;

      // Create compendium stores if they don't exist
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          const keyPath = (storeName === 'classFeatures' || storeName === 'subclassFeatures') ? 'id' : 'name';
          db.createObjectStore(storeName, { keyPath });
        }
      });

      // Sync metadata store (per-store sync state)
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }

      // App settings store (Dropbox tokens, device ID, etc.)
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => {
      _dbPromise = null; // Allow retry on next call
      reject(e.target.error);
    };
  });
  return _dbPromise;
}

// Invalidate the cached promise (needed after upgrades / clears)
function _resetDBConnection() {
  _dbPromise = null;
}

// ─── Core Record Operations ──────────────────────────────────────────────────

/**
 * Upsert multiple records into a store.
 * @param {string} storeName
 * @param {Array<Object>} records
 * @param {{ skipIfNewer?: boolean }} [opts]
 *   skipIfNewer: if true, skip records where the stored _modified_at is newer.
 *   Used when merging incoming cloud data to protect local edits.
 */
export async function saveRecords(storeName, records, opts = {}) {
  const { skipIfNewer = false } = opts;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let pending = records.length;
    if (pending === 0) { resolve(); return; }

    records.forEach(record => {
      if (skipIfNewer) {
        // Read existing record first to compare timestamps
        const getReq = store.get(record.name);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing && existing._modified_at && record._modified_at) {
            const existingTs = new Date(existing._modified_at).getTime();
            const incomingTs = new Date(record._modified_at).getTime();
            if (existingTs > incomingTs) {
              // Local is newer — skip overwrite
              pending--;
              if (pending === 0) resolve();
              return;
            }
          }
          store.put(record);
          pending--;
          if (pending === 0) resolve();
        };
        getReq.onerror = () => {
          store.put(record);
          pending--;
          if (pending === 0) resolve();
        };
      } else {
        store.put(record);
        pending--;
      }
    });

    if (!skipIfNewer) {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    } else {
      transaction.onerror = (e) => reject(e.target.error);
    }
  });
}

/**
 * Upsert a single record, stamping _modified_at if not already set.
 * Caller is responsible for setting _modified_at before calling this for sync purposes.
 */
export async function saveRecord(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const rec = { ...record, _modified_at: record._modified_at || new Date().toISOString() };
    store.put(rec);
    transaction.oncomplete = () => resolve(rec);
    transaction.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllRecords(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function getRecord(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = (e) => resolve(e.target.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function clearDatabase() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES, 'readwrite');
    STORES.forEach(storeName => {
      transaction.objectStore(storeName).clear();
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

export async function clearCompendium() {
  const db = await openDB();
  const compendiumStores = STORES.filter(s => s !== 'favorites' && s !== 'characters');
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(compendiumStores, 'readwrite');
    compendiumStores.forEach(storeName => {
      transaction.objectStore(storeName).clear();
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

// ─── Sync Metadata ───────────────────────────────────────────────────────────

/**
 * Get sync metadata for a store (rev tokens, last sync time, etc.)
 * @param {string} id - e.g. 'global' or a store name
 */
export async function getSyncMeta(id = 'global') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, 'readonly');
    const store = transaction.objectStore(META_STORE);
    const request = store.get(id);
    request.onsuccess = (e) => resolve(e.target.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveSyncMeta(id = 'global', meta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, 'readwrite');
    const store = transaction.objectStore(META_STORE);
    store.put({ id, ...meta });
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

// ─── App Settings ────────────────────────────────────────────────────────────

export async function getAppSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    request.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveAppSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    store.put({ key, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteAppSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    store.delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

// ─── Data Portability ────────────────────────────────────────────────────────

/**
 * Export all compendium data as a plain object.
 * Does NOT export tokens/settings for security.
 */
export async function exportAllData() {
  const snapshot = {};
  for (const store of STORES) {
    snapshot[store] = await getAllRecords(store);
  }
  return snapshot;
}

/**
 * Import a data snapshot.
 * @param {Object} data - { spells: [], items: [], ... }
 * @param {{ merge?: boolean }} opts
 *   merge=true: upsert without clearing (skipIfNewer check disabled for import)
 *   merge=false (default): clear stores first, then insert
 */
export async function importAllData(data, opts = {}) {
  const { merge = false } = opts;
  if (!merge) {
    await clearDatabase();
  }
  for (const store of STORES) {
    if (data[store] && data[store].length > 0) {
      await saveRecords(store, data[store], { skipIfNewer: false });
    }
  }
}
