// ui-sync.js — Sync UX Components
// Implements spec §5: User Experience Affordances

import { formatBytes, storageHealth } from './storage.js';

// ─── Banner System ────────────────────────────────────────────────────────────

let _activeBanner = null;
let _bannerDismissTimer = null;

function _getBannerContainer() {
  let container = document.getElementById('sync-banner-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sync-banner-container';
    // Insert before the app container so it's outside the panes layout
    const appContainer = document.querySelector('.app-container');
    if (appContainer && appContainer.parentNode) {
      appContainer.parentNode.insertBefore(container, appContainer);
    } else {
      document.body.prepend(container);
    }
  }
  return container;
}

/**
 * Show the offline banner.
 */
export function showOfflineBanner() {
  _showBanner('offline', '⚡ Working Offline — Changes saved safely to device.', false);
}

/**
 * Show the syncing in progress banner.
 */
export function showSyncingBanner() {
  _showBanner('syncing', '☁ Syncing changes...', false);
}

/**
 * Show the sync success banner (auto-dismisses after 3s).
 */
export function showSyncSuccessBanner() {
  _showBanner('success', '✓ All changes saved to cloud.', true, 3000);
}

/**
 * Show a sync error banner. Persists until dismissed or next status change.
 * @param {string} msg
 */
export function showSyncErrorBanner(msg) {
  _showBanner('error', `✕ Sync failed: ${msg}`, false);
}

export function hideAllBanners() {
  const container = document.getElementById('sync-banner-container');
  if (container) {
    container.innerHTML = '';
  }
  if (_bannerDismissTimer) {
    clearTimeout(_bannerDismissTimer);
    _bannerDismissTimer = null;
  }
  _activeBanner = null;
}

function _showBanner(type, message, autoDismiss, dismissMs = 3000) {
  const container = _getBannerContainer();

  // Clear previous dismiss timer
  if (_bannerDismissTimer) {
    clearTimeout(_bannerDismissTimer);
    _bannerDismissTimer = null;
  }

  container.innerHTML = `
    <div class="sync-banner sync-banner--${type}" role="status" aria-live="polite">
      <span class="sync-banner__message">${message}</span>
      <button class="sync-banner__dismiss" aria-label="Dismiss" onclick="this.parentElement.parentElement.innerHTML=''">✕</button>
    </div>
  `;
  _activeBanner = type;

  if (autoDismiss) {
    _bannerDismissTimer = setTimeout(() => {
      hideAllBanners();
    }, dismissMs);
  }
}

/**
 * React to sync state changes and update banners accordingly.
 * @param {{ status: string, lastError: string|null }} syncState
 */
export function handleSyncStateChange(syncState) {
  switch (syncState.status) {
    case 'offline':
      showOfflineBanner();
      break;
    case 'syncing':
      showSyncingBanner();
      break;
    case 'idle':
      if (_activeBanner === 'syncing') {
        showSyncSuccessBanner();
      } else if (_activeBanner === 'offline') {
        hideAllBanners();
      }
      break;
    case 'error':
      showSyncErrorBanner(syncState.lastError || 'Unknown error');
      break;
    case 'unlinked':
      hideAllBanners();
      break;
  }
}

// ─── Conflict Resolution Modal ────────────────────────────────────────────────

/**
 * Show the conflict resolution modal.
 * @param {Array<{store, name, localRecord, remoteRecord}>} conflicts
 * @returns {Promise<'local'|'remote'|'dismiss'>}
 */
export function showConflictModal(conflicts) {
  return new Promise((resolve) => {
    // Remove any existing modal
    const existing = document.getElementById('sync-conflict-modal');
    if (existing) existing.remove();

    const conflictItems = conflicts.map((c, i) => `
      <div class="conflict-item">
        <div class="conflict-item__header">
          <span class="conflict-item__store">${c.store}</span>
          <span class="conflict-item__name">${c.name}</span>
        </div>
        <div class="conflict-item__panels">
          <div class="conflict-panel conflict-panel--local">
            <div class="conflict-panel__label">Your version</div>
            <div class="conflict-panel__ts">${c.localRecord._modified_at ? new Date(c.localRecord._modified_at).toLocaleString() : 'Unknown time'}</div>
          </div>
          <div class="conflict-panel conflict-panel--remote">
            <div class="conflict-panel__label">Other device</div>
            <div class="conflict-panel__ts">${c.remoteRecord._modified_at ? new Date(c.remoteRecord._modified_at).toLocaleString() : 'Unknown time'}</div>
          </div>
        </div>
      </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'sync-conflict-modal';
    modal.className = 'conflict-modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'conflict-modal-title');

    modal.innerHTML = `
      <div class="conflict-modal">
        <div class="conflict-modal__header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--accent-color)"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
          <h2 id="conflict-modal-title">Sync Note: Concurrent Modifications Detected</h2>
        </div>
        <p class="conflict-modal__desc">
          Changes were made on another device at nearly the same time. Your local changes have been preserved (Last-Write-Wins applied).
          ${conflicts.length} record${conflicts.length !== 1 ? 's were' : ' was'} affected:
        </p>
        <div class="conflict-modal__list">
          ${conflictItems}
        </div>
        <div class="conflict-modal__actions">
          <button class="settings-action-btn" id="conflict-modal-dismiss">Keep My Changes &amp; Close</button>
          <button class="settings-action-btn danger-btn" id="conflict-modal-use-remote">Use Other Device's Version</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('conflict-modal-dismiss').addEventListener('click', () => {
      modal.remove();
      resolve('local');
    });

    document.getElementById('conflict-modal-use-remote').addEventListener('click', () => {
      modal.remove();
      resolve('remote');
    });

    // Backdrop click dismisses
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve('dismiss');
      }
    });
  });
}

// ─── Settings Panel Widgets ───────────────────────────────────────────────────

/**
 * Render the sync status badge into a container element.
 * @param {HTMLElement} container
 * @param {{ status: string, lastSyncAt: string|null, isLinked: boolean }} syncState
 */
export function renderSyncStatusBadge(container, syncState) {
  const { status, lastSyncAt, isLinked } = syncState;

  let icon = '';
  let label = '';
  let cssClass = '';

  if (!isLinked) {
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm1-4H8v2h8v-2z"/></svg>`;
    label = 'Not connected';
    cssClass = 'badge--muted';
  } else if (status === 'syncing') {
    icon = `<div class="badge-spinner"></div>`;
    label = 'Syncing...';
    cssClass = 'badge--syncing';
  } else if (status === 'offline') {
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.99 5.8l-1.63-1.63c-.55-.55-1.44-.55-1.99 0L17 6.55 15.62 5.18A10.96 10.96 0 0 0 5.91 2.01l1.47 1.47C8.43 3.18 9.69 3 11 3c2.76 0 5.26 1.04 7.14 2.73l-1.42 1.42C15.3 5.81 13.24 5 11 5c-1.5 0-2.9.38-4.13 1.04l1.48 1.48C9.14 7.19 10.04 7 11 7c1.75 0 3.33.65 4.55 1.71l-1.42 1.42a4.97 4.97 0 0 0-3.13-.88l1.49 1.49L11 12l-8.99-9-1.41 1.41 2.55 2.55A10.956 10.956 0 0 0 .01 12c0 2.88 1.11 5.5 2.92 7.46l1.42-1.42A9 9 0 0 1 2 12c0-2.12.73-4.07 1.95-5.62L5.7 8.13A6.964 6.964 0 0 0 4 12c0 1.88.74 3.58 1.94 4.84L4.52 18.26A8.99 8.99 0 0 1 2 12zm9-7c1.07 0 2.1.17 3.06.49l-2.35 2.35L11 13l-3-3 2.74-2.74L8.06 4.49C8.68 4.18 9.33 4 10 4z"/></svg>`;
    label = 'Offline';
    cssClass = 'badge--offline';
  } else if (status === 'error') {
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    label = 'Sync error';
    cssClass = 'badge--error';
  } else {
    icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    label = lastSyncAt ? `Synced ${_formatRelativeTime(lastSyncAt)}` : 'Synced';
    cssClass = 'badge--success';
  }

  container.innerHTML = `
    <div class="sync-status-badge ${cssClass}">
      ${icon}
      <span>${label}</span>
    </div>
  `;
}

/**
 * Render the storage health badge into a container element.
 * @param {HTMLElement} container
 */
export function renderStorageBadge(container) {
  const { persistenceGranted, percentUsed, quotaUsage, quotaTotal, apiSupported } = storageHealth;

  const statusLabel = !apiSupported
    ? 'API Unavailable'
    : persistenceGranted === null
      ? 'Checking...'
      : persistenceGranted
        ? 'Protected'
        : 'Best Effort';

  const statusClass = persistenceGranted
    ? 'badge--success'
    : persistenceGranted === false
      ? 'badge--offline'
      : 'badge--muted';

  const usedPct = Math.round(percentUsed * 100);
  const barClass = usedPct > 80 ? 'storage-bar--warn' : usedPct > 60 ? 'storage-bar--caution' : '';

  container.innerHTML = `
    <div class="storage-health-block">
      <div class="storage-status-row">
        <span class="meta-label">Storage Classification</span>
        <span class="sync-status-badge ${statusClass}" style="font-size: 11px; padding: 2px 8px;">
          ${persistenceGranted ? '🔒' : '⚠️'} ${statusLabel}
        </span>
      </div>
      ${apiSupported ? `
        <div class="storage-bar-row" style="margin-top: 10px;">
          <div class="storage-bar-label">
            <span class="meta-label">Storage Used</span>
            <span style="font-size: 11px; color: var(--text-muted);">
              ${formatBytes(quotaUsage)} / ${formatBytes(quotaTotal)} (${usedPct}%)
            </span>
          </div>
          <div class="storage-bar">
            <div class="storage-bar__fill ${barClass}" style="width: ${Math.min(usedPct, 100)}%"></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`;
  return new Date(isoString).toLocaleDateString();
}
