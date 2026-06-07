# Sync Engine Sub-System

**Parent doc:** [architecture.md](./architecture.md)

The sync engine provides optional cross-device cloud backup using **Dropbox** as a flat-file store. All logic is in `sync.js`, `conflict.js`, `storage.js`, and `ui-sync.js`.

---

## Overview

```
Local IndexedDB
      │
      │  exportAllData()  →  JSON snapshot
      │
      ▼
   sync.js
      │  Download remote  →  conflict.js mergeStates()  →  save merged back
      │  Upload merged   →  Dropbox /sync_state.json
      │
      ▼
  ui-sync.js  (banner + badge rendering)
```

Sync is **not automatic** unless Dropbox is linked. When linked, sync triggers automatically on:
- App load (2-second delay)
- Network restore (`online` event)
- Tab becoming visible again (`visibilitychange`)
- After local writes via `scheduleDebouncedSync()` (5-second debounce)

---

## Dropbox OAuth PKCE Flow (`sync.js`)

The app uses **PKCE (Proof Key for Code Exchange)** — no client secret is stored.

### Linking Flow

1. User enters Dropbox App Key in Settings.
2. `startDropboxOAuth(appKey, redirectUri)` is called:
   - Generates a `codeVerifier` (96-char random) and `codeChallenge` (SHA-256 of verifier, base64url).
   - Saves verifier + state nonce to `_app_settings` store in IndexedDB.
   - Redirects the browser to `https://www.dropbox.com/oauth2/authorize?...`.
3. Dropbox redirects back to the app URL with `?code=...&state=...`.
4. `initSync()` detects the callback via `_handleOAuthCallbackIfPresent()`.
5. `handleOAuthCallback(url)` validates the state nonce, exchanges the code for tokens via `https://api.dropboxapi.com/oauth2/token`.
6. `access_token`, `refresh_token`, `token_expires_at` are stored in `_app_settings`.

### Token Refresh

`_getValidAccessToken()` checks `token_expires_at` and auto-refreshes if within 5 minutes of expiry. On refresh failure, `unlinkDropbox()` is called to clear tokens.

### Unlinking

`unlinkDropbox()` deletes all three token keys from `_app_settings` and emits `'unlinked'` status.

---

## Sync File Format (Dropbox)

Dropbox stores a single file at `/sync_state.json` with this envelope structure:

```json
{
  "_metadata": {
    "device_id": "random-32-char-string",
    "last_modified_client": "2024-01-01T00:00:00.000Z",
    "schema_version": 1,
    "sequence_number": 42
  },
  "payload": {
    "spells": [...],
    "items": [...],
    "characters": [...],
    // all STORES
  }
}
```

A conflict copy is saved at `/sync_state_conflict_copy.json` when a rev-conflict is detected during upload.

---

## Full Sync Cycle (`syncNow()`)

```
1. Guard checks: online? linked? already syncing?
2. downloadState()  →  { envelope, rev } or null (first sync)
3. exportAllData()  →  local snapshot
4. if remote exists:
     validateEnvelope()
     mergeStates(local, remote, STORES)  →  { merged, conflicts }
   else:
     finalPayload = local
5. saveRecords(store, finalPayload, { skipIfNewer: true })  for each store
6. buildEnvelope(deviceId, finalPayload, seqNum)
7. uploadState(envelope, parentRev)
   ↳ on ConflictError: _uploadConflictCopy() then retry with null rev
8. saveSyncMeta('global', { last_sync_at, last_rev, sequence_number, device_id })
9. emit 'idle' status
```

---

## Conflict Resolution (`conflict.js`)

Strategy: **Last-Write-Wins (LWW)** per record.

### Rules

| Scenario | Winner |
|----------|--------|
| Record exists on one side only | Keep it (union merge) |
| Both sides have timestamps, diff > 1s | Newer `_modified_at` wins |
| Both sides, diff ≤ 1s ("tie") | Local wins; conflict logged |
| One or both missing `_modified_at` | Remote wins if only remote has one; else local wins |

Conflicts (ties) are surfaced as an array and shown to the user via `showConflictModal()` in `ui-sync.js`.

### `skipIfNewer` in `saveRecords`

When writing merged data back to IndexedDB, `saveRecords` is called with `{ skipIfNewer: true }`. This prevents overwriting records that were modified locally *after* the sync started.

---

## Storage Persistence (`storage.js`)

The browser can evict IndexedDB data under storage pressure unless the app has **persistent storage** granted.

On startup, `initStorage()`:
1. Calls `navigator.storage.persist()` — browser may silently grant or deny.
2. Starts a 30-second polling loop via `startQuotaMonitor()`.
3. If usage exceeds 80% of quota, fires registered `onQuotaWarning` callbacks.

### `storageHealth` state object

```js
storageHealth = {
  persistenceGranted: null | true | false,
  quotaUsage: number,   // bytes
  quotaTotal: number,   // bytes
  percentUsed: number,  // 0..1
  warningFired: boolean,
  apiSupported: boolean,
}
```

This object is read by `ui-sync.js` → `renderStorageBadge()` to display a storage health indicator in the Settings panel.

---

## UI Sync Components (`ui-sync.js`)

| Export | Purpose |
|--------|---------|
| `handleSyncStateChange(syncState)` | Called by sync listeners; shows/hides banners |
| `showOfflineBanner()` | "Working Offline" yellow banner |
| `showSyncingBanner()` | "Syncing..." banner |
| `showSyncSuccessBanner()` | "All changes saved" — auto-dismisses after 3s |
| `showSyncErrorBanner(msg)` | Persistent error banner |
| `showConflictModal(conflicts)` | Modal listing conflicting records; user chooses "keep mine" or "use other device" |
| `renderSyncStatusBadge(el, state)` | Renders small status pill in Settings |
| `renderStorageBadge(el)` | Renders storage usage bar + persistence status |

### Sync Status Values

`syncState.status` can be: `'idle'` | `'syncing'` | `'error'` | `'offline'` | `'unlinked'`

---

## Sync Settings (stored in `_app_settings`)

| Key | Value |
|-----|-------|
| `access_token` | Dropbox short-lived access token |
| `refresh_token` | Dropbox refresh token (long-lived) |
| `token_expires_at` | ISO timestamp |
| `dropbox_app_key` | User's Dropbox App Key |
| `oauth_redirect_uri` | Redirect URI registered in Dropbox |
| `oauth_return_url` | Page to return to after OAuth |
| `pkce_verifier` | Ephemeral PKCE verifier (deleted after exchange) |
| `oauth_state` | Ephemeral nonce (deleted after exchange) |
| `device_id` | Persistent random 32-char device identifier |
