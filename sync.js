// sync.js — Dropbox OAuth PKCE + Bidirectional Sync Engine
// Implements spec §3: Dropbox Flat-File Sync & Conflict Engine

import {
  STORES, exportAllData, saveRecords, getSyncMeta, saveSyncMeta,
  getAppSetting, saveAppSetting, deleteAppSetting
} from './db.js';
import { mergeStates, buildEnvelope, validateEnvelope } from './conflict.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const DROPBOX_AUTH_URL  = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DROPBOX_DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const DROPBOX_GET_METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata';

const SYNC_FILE_PATH    = '/sync_state.json';
const CONFLICT_FILE_PATH = '/sync_state_conflict_copy.json';
const SCHEMA_VERSION    = 1;

// Sync debounce delay (ms) — batches rapid local writes before uploading
const DEBOUNCE_MS = 15_000;

// ─── Internal State ──────────────────────────────────────────────────────────

export const syncState = {
  status: 'idle',          // 'idle' | 'syncing' | 'error' | 'offline' | 'unlinked'
  lastSyncAt: null,        // ISO timestamp of last successful sync
  lastError: null,         // error message string or null
  isLinked: false,         // whether Dropbox is connected
  pendingUpload: false,    // local changes not yet pushed
};

let _statusCallbacks = [];
let _debounceTimer = null;

// ─── Status Notifications ────────────────────────────────────────────────────

export function onSyncStatusChange(cb) {
  _statusCallbacks.push(cb);
}

function _emit(status, extra = {}) {
  syncState.status = status;
  if (extra.lastError !== undefined) syncState.lastError = extra.lastError;
  if (extra.lastSyncAt !== undefined) syncState.lastSyncAt = extra.lastSyncAt;
  _statusCallbacks.forEach(cb => cb({ ...syncState }));
}

// ─── PKCE Utilities ──────────────────────────────────────────────────────────

function _generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function _sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function _base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a PKCE code verifier and challenge pair.
 */
export async function generatePKCE() {
  const codeVerifier = _generateRandomString(96); // 43-128 chars per spec
  const hashed = await _sha256(codeVerifier);
  const codeChallenge = _base64URLEncode(hashed);
  return { codeVerifier, codeChallenge };
}

// ─── Device Identity ─────────────────────────────────────────────────────────

async function _getOrCreateDeviceId() {
  let deviceId = await getAppSetting('device_id');
  if (!deviceId) {
    deviceId = _generateRandomString(32);
    await saveAppSetting('device_id', deviceId);
  }
  return deviceId;
}

async function _getSequenceNumber() {
  const meta = await getSyncMeta('global');
  return meta ? (meta.sequence_number || 0) + 1 : 1;
}

// ─── OAuth PKCE Flow ─────────────────────────────────────────────────────────

/**
 * Start the Dropbox OAuth PKCE flow.
 * Opens a popup/redirect to Dropbox authorization page.
 * @param {string} appKey - Dropbox App Key (public)
 * @param {string} redirectUri - Must match Dropbox App settings
 */
export async function startDropboxOAuth(appKey, redirectUri) {
  if (!appKey || !appKey.trim()) {
    throw new Error('Dropbox App Key is required.');
  }

  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = _generateRandomString(16);

  // Persist verifier and state so the callback can use them
  await saveAppSetting('pkce_verifier', codeVerifier);
  await saveAppSetting('oauth_state', state);
  await saveAppSetting('dropbox_app_key', appKey.trim());
  await saveAppSetting('oauth_redirect_uri', redirectUri);

  const params = new URLSearchParams({
    client_id: appKey.trim(),
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state,
    token_access_type: 'offline', // request refresh token
  });

  const authUrl = `${DROPBOX_AUTH_URL}?${params.toString()}`;

  // Store current page URL so the callback page can return here
  await saveAppSetting('oauth_return_url', window.location.href);

  window.location.href = authUrl;
}

/**
 * Handle the OAuth callback after user authorizes.
 * Extracts the code from the URL, exchanges for tokens.
 * @param {string} callbackUrl - The full URL the browser was redirected to
 * @returns {{ success: boolean, error?: string }}
 */
export async function handleOAuthCallback(callbackUrl) {
  try {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return { success: false, error: `Dropbox authorization denied: ${error}` };
    }

    if (!code) {
      return { success: false, error: 'No authorization code received.' };
    }

    const savedState = await getAppSetting('oauth_state');
    if (returnedState !== savedState) {
      return { success: false, error: 'OAuth state mismatch — possible CSRF attack.' };
    }

    const codeVerifier = await getAppSetting('pkce_verifier');
    const appKey = await getAppSetting('dropbox_app_key');
    const redirectUri = await getAppSetting('oauth_redirect_uri');

    if (!codeVerifier || !appKey) {
      return { success: false, error: 'Missing PKCE verifier or App Key.' };
    }

    const tokenResponse = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        client_id: appKey,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return { success: false, error: `Token exchange failed: ${errText}` };
    }

    const tokenData = await tokenResponse.json();
    await saveAppSetting('access_token', tokenData.access_token);
    if (tokenData.refresh_token) {
      await saveAppSetting('refresh_token', tokenData.refresh_token);
    }
    if (tokenData.expires_in) {
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      await saveAppSetting('token_expires_at', expiresAt);
    }

    // Clean up ephemeral PKCE state
    await deleteAppSetting('pkce_verifier');
    await deleteAppSetting('oauth_state');

    syncState.isLinked = true;
    _emit('idle');

    return { success: true };
  } catch (err) {
    console.error('[sync] OAuth callback error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get a valid access token, refreshing if necessary.
 */
async function _getValidAccessToken() {
  const accessToken = await getAppSetting('access_token');
  if (!accessToken) return null;

  const expiresAt = await getAppSetting('token_expires_at');
  if (expiresAt) {
    const expiresTs = new Date(expiresAt).getTime();
    // Refresh if within 5 minutes of expiry
    if (Date.now() > expiresTs - 5 * 60 * 1000) {
      return await _refreshToken();
    }
  }
  return accessToken;
}

export async function refreshAccessToken() {
  return _refreshToken();
}

async function _refreshToken() {
  const refreshToken = await getAppSetting('refresh_token');
  const appKey = await getAppSetting('dropbox_app_key');
  if (!refreshToken || !appKey) return null;

  try {
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
      }).toString(),
    });

    if (!response.ok) {
      console.error('[sync] Token refresh failed:', await response.text());
      // Token is invalid — unlink
      await unlinkDropbox();
      return null;
    }

    const data = await response.json();
    await saveAppSetting('access_token', data.access_token);
    if (data.expires_in) {
      const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
      await saveAppSetting('token_expires_at', expiresAt);
    }
    return data.access_token;
  } catch (err) {
    console.error('[sync] Token refresh error:', err);
    return null;
  }
}

/**
 * Check if Dropbox is currently linked.
 */
export async function isDropboxLinked() {
  const token = await getAppSetting('access_token');
  return !!token;
}

/**
 * Unlink Dropbox and clear all OAuth tokens.
 */
export async function unlinkDropbox() {
  await deleteAppSetting('access_token');
  await deleteAppSetting('refresh_token');
  await deleteAppSetting('token_expires_at');
  syncState.isLinked = false;
  _emit('unlinked');
}

// ─── Upload / Download ───────────────────────────────────────────────────────

/**
 * Download the sync state file from Dropbox.
 * @returns {{ envelope: Object, rev: string }|null}
 */
export async function downloadState() {
  const token = await _getValidAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(DROPBOX_DOWNLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: SYNC_FILE_PATH }),
      },
    });

    if (response.status === 409) {
      // File not found — first sync
      return null;
    }

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${await response.text()}`);
    }

    const rev = response.headers.get('dropbox-api-result')
      ? JSON.parse(response.headers.get('dropbox-api-result')).rev
      : null;

    const envelope = await response.json();
    return { envelope, rev };
  } catch (err) {
    console.error('[sync] Download error:', err);
    throw err;
  }
}

/**
 * Upload the sync state envelope to Dropbox.
 * @param {Object} envelope - The full sync envelope
 * @param {string|null} parentRev - Known parent rev for conflict detection
 */
export async function uploadState(envelope, parentRev = null) {
  const token = await _getValidAccessToken();
  if (!token) throw new Error('Not authenticated with Dropbox.');

  const apiArg = {
    path: SYNC_FILE_PATH,
    mode: parentRev ? { '.tag': 'update', update: parentRev } : { '.tag': 'overwrite' },
    autorename: false,
    mute: true,
    strict_conflict: false,
  };

  const response = await fetch(DROPBOX_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify(apiArg),
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 409) {
      throw new ConflictError(`Version conflict detected. ${errText}`);
    }
    throw new Error(`Upload failed: ${response.status} ${errText}`);
  }

  const result = await response.json();
  return result.rev; // Return new rev for future uploads
}

/**
 * Upload a conflict copy for safetynet preservation.
 */
async function _uploadConflictCopy(envelope) {
  const token = await _getValidAccessToken();
  if (!token) return;

  try {
    await fetch(DROPBOX_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: CONFLICT_FILE_PATH,
          mode: { '.tag': 'overwrite' },
          mute: true,
        }),
      },
      body: JSON.stringify(envelope),
    });
    console.log('[sync] Conflict copy preserved at', CONFLICT_FILE_PATH);
  } catch (err) {
    console.error('[sync] Failed to write conflict copy:', err);
  }
}

// ─── Full Sync Cycle ──────────────────────────────────────────────────────────

/**
 * Run a full bidirectional sync cycle.
 * Returns a result object describing what happened.
 */
export async function syncNow() {
  if (!navigator.onLine) {
    _emit('offline');
    return { success: false, reason: 'offline' };
  }

  const linked = await isDropboxLinked();
  if (!linked) {
    syncState.isLinked = false;
    _emit('unlinked');
    return { success: false, reason: 'unlinked' };
  }

  if (syncState.status === 'syncing') {
    return { success: false, reason: 'already_syncing' };
  }

  syncState.isLinked = true;
  _emit('syncing', { lastError: null });

  try {
    const deviceId = await _getOrCreateDeviceId();
    const seqNum = await _getSequenceNumber();

    // 1. Download remote state
    let remoteResult = null;
    try {
      remoteResult = await downloadState();
    } catch (err) {
      throw new Error(`Failed to download remote state: ${err.message}`);
    }

    // 2. Export local state
    const localPayload = await exportAllData();

    let finalPayload;
    let parentRev = null;
    let conflicts = [];

    if (remoteResult) {
      const { envelope: remoteEnvelope, rev } = remoteResult;
      parentRev = rev;

      // Validate envelope
      const { valid, errors } = validateEnvelope(remoteEnvelope);
      if (!valid) {
        console.warn('[sync] Remote envelope is invalid, overwriting:', errors);
        finalPayload = localPayload;
      } else {
        // 3. Merge local + remote using LWW
        const { merged, conflicts: foundConflicts } = mergeStates(
          localPayload,
          remoteEnvelope.payload,
          STORES
        );
        finalPayload = merged;
        conflicts = foundConflicts;
      }
    } else {
      // No remote file yet — use local as canonical state
      finalPayload = localPayload;
    }

    // 4. Write merged data back to local DB (protecting local-newer records)
    for (const store of STORES) {
      if (finalPayload[store] && finalPayload[store].length > 0) {
        await saveRecords(store, finalPayload[store], { skipIfNewer: true });
      }
    }

    // 5. Build new envelope and upload
    const newEnvelope = buildEnvelope(deviceId, finalPayload, seqNum);

    let newRev;
    try {
      newRev = await uploadState(newEnvelope, parentRev);
    } catch (err) {
      if (err instanceof ConflictError) {
        // Safetynet: preserve a conflict copy before retrying
        console.warn('[sync] Rev conflict — writing conflict copy and retrying without rev check.');
        await _uploadConflictCopy(newEnvelope);
        newRev = await uploadState(newEnvelope, null); // Overwrite
      } else {
        throw err;
      }
    }

    // 6. Update sync metadata
    const now = new Date().toISOString();
    await saveSyncMeta('global', {
      last_sync_at: now,
      last_rev: newRev,
      sequence_number: seqNum,
      device_id: deviceId,
    });

    syncState.pendingUpload = false;
    _emit('idle', { lastSyncAt: now });

    return { success: true, conflicts, mergedRecords: Object.values(finalPayload).flat().length };
  } catch (err) {
    console.error('[sync] Sync failed:', err);
    _emit('error', { lastError: err.message });
    return { success: false, reason: 'error', error: err.message };
  }
}

/**
 * Schedule a debounced sync after local writes.
 * Multiple rapid calls collapse into a single sync after DEBOUNCE_MS.
 */
export function scheduleDebouncedSync() {
  syncState.pendingUpload = true;
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    syncNow();
  }, DEBOUNCE_MS);
}

// ─── Lifecycle Triggers ───────────────────────────────────────────────────────

/**
 * Initialize sync module and bind lifecycle event triggers.
 * Call once on app startup.
 */
export async function initSync() {
  syncState.isLinked = await isDropboxLinked();

  if (!navigator.onLine) {
    _emit('offline');
  } else {
    _emit(syncState.isLinked ? 'idle' : 'unlinked');
  }

  // Network restored
  window.addEventListener('online', () => {
    console.log('[sync] Network restored — triggering sync.');
    syncNow();
  });

  window.addEventListener('offline', () => {
    _emit('offline');
  });

  // Tab visibility changes (WebKit foreground-only fallback)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      console.log('[sync] Tab focused — triggering sync.');
      syncNow();
    }
  });

  // Best-effort before unload
  window.addEventListener('beforeunload', () => {
    if (syncState.pendingUpload && navigator.onLine) {
      // Synchronous beacon for lightweight notification (data too large for beacon)
      // Best effort — sync happens on next load instead
      console.log('[sync] beforeunload: pending upload, will sync on next load.');
    }
  });

  // Trigger initial sync on app load
  if (navigator.onLine && syncState.isLinked) {
    setTimeout(() => syncNow(), 2000); // Small delay to let DB init finish
  }

  // Handle OAuth callback if this page load includes a callback code
  _handleOAuthCallbackIfPresent();
}

/**
 * Check if the current URL is an OAuth callback and handle it.
 */
async function _handleOAuthCallbackIfPresent() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') && url.searchParams.has('state')) {
    console.log('[sync] OAuth callback detected — exchanging code...');
    const result = await handleOAuthCallback(window.location.href);

    // Clean up the URL without reloading
    const returnUrl = await getAppSetting('oauth_return_url') || window.location.pathname;
    window.history.replaceState({}, '', returnUrl);

    if (result.success) {
      console.log('[sync] Dropbox linked successfully!');
      syncNow();
    } else {
      console.error('[sync] OAuth callback failed:', result.error);
    }
  }
}

// ─── Custom Error Types ───────────────────────────────────────────────────────

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}
