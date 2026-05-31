# This is a backlog of desired changes, to be tackled once higher priorities are managed.

**IMPORTANT: Agent should not execute any of these changes without specific instructions. These are for user's reference only.**

## Display Tables

There are many <text> areas that contain tables like these:

Cleric Level | Spells

3 | Command, Comprehend Languages, Detect Magic, Detect Thoughts, Identify, Mind Spike*

5 | Dispel Magic, Nondetection, Tongues*

7 | Arcane Eye*, Banishment, Confusion

9 | Legend Lore, Scrying, Synaptic Static

These should be rendered visually as tables with a header row, even though they are non-standard markdown. It is acceptable to transform these on import into regular markdown.

## Robust PWA Storage & Local-First Sync Architecture

Functional Specification

### 1. System Architecture & Data Flow

+-----------------------------------------------------------------------------------+

|                                  CLIENT LAYER (PWA)                               |
|                                                                                   |
|  +-----------------------+      +-------------------+      +-------------------+  |
|  |     User Interface    | <--> |   Local Replica   | <--> |  Storage Manager  |  |
|  |  (Instant UI Updates) |      |    (IndexedDB)    |      | (Persistent Mode) |  |
|  +-----------------------+      +---------+---------+      +-------------------+  |
+-------------------------------------------|---------------------------------------+

                                            |
                                  Background Sync Queue
                             (Immediate Sync / On-App-Launch)
                                            |
+-------------------------------------------v---------------------------------------+

|                               CLOUD CLOUD STORAGE LAYER                           |
|                                                                                   |
|  +-----------------------+                             +-----------------------+  |
|  |     Dropbox API       | <-------------------------> |  Remote Storage File  |  |
|  |   (Authentication)    |                             |      (JSON / State)   |  |
|  +-----------------------+                             +-----------------------+  |
+-----------------------------------------------------------------------------------+

### 1.1 Local-First Architecture

* State Operations: The application must read and write exclusively to the local client database (IndexedDB).
* UI decoupling: The User Interface (UI) must never block or wait for network responses. All data modifications are instantly committed to local storage and reflected in the UI immediately.

### 1.2 Data Serialization & Synchronicity

* Delta Tracking: The system must track changes locally using incremental state flags or revision numbers.
* Bi-directional Pipeline: The synchronization pipeline runs bidirectionally between the local database and the cloud file storage system, capturing updates, deletes, and insertions.

------------------------------
### 2. Storage Persistence & OS Defense## 2.1 Storage Classification Request

* Persistence Flag: On initial app load, the system must query and programmatically request persistent storage status from the browser's storage manager engine.
* Graceful Degradation: If the browser denies the request, the application must function normally but flags the status inside the internal health logging subsystem.

#### 2.2 Storage Eviction Defenses

* Storage Monitor: The system must actively inspect remaining storage quotas before initiating large write operations.
* Telemetry Reporting: Low available space thresholds must be piped straight to the application's internal alert state to warn the user before the browser forces an emergency cache purge.

------------------------------
### 3. Dropbox Flat-File Sync & Conflict Engine## 3.1 Authentication & Scope

* Authentication Flow: Integration via the OAuth 2.0 PKCE flow to securely fetch access and refresh tokens.
* Scope Isolation: Request limited access scopes strictly restricted to the application's private app folder (/Apps/YourAppName/).

#### 3.2 File Schema Strategy

* App State Payload: The system saves data as a structured flat-file format (e.g., sync_state.json).
* Metadata Envelope: Every sync file must contain an envelope metadata block:

{
  "_metadata": {
    "device_id": "string",
    "last_modified_client": "ISO-8601-Timestamp",
    "schema_version": "integer",
    "sequence_number": "integer"
  },
  "payload": {}
}

#### 3.3 Execution & Operational Lifecycle

* Sync Triggers: Execution fires immediately upon network status transitions (Offline $\rightarrow$ Online) and during application visibility lifecycle changes (App Resume / Tab Focus).
* Batch Operations: To minimize Dropbox API rate limit pressure, local edits must be debounced and batched into single-file overwrite transactions.

#### 3.4 Conflict Resolution Engine

* Conflict Detection: The system detects conflicts using Dropbox's native file revision markers (rev). The client must provide its known parent revision token on every write operation.
* Resolution Logic: If a conflict occurs (a 409 conflict error or mismatched revision token), the system applies a Deterministic Merge Strategy:
* Non-overlapping fields: Merge automatically.
   * Overlapping fields: Resolve using a Last-Write-Wins (LWW) rule based on the absolute UTC timestamp embedded inside the metadata envelope.
   * Fallback Safetynet: If merging risks data corruption, create a parallel duplicate file (e.g., sync_state_conflict_copy.json) and flag it for user review.

------------------------------
### 4. Platform-Specific Synchronicity Fallbacks## 4.1 Chromium-Based Systems (Desktop, Android)

* Native Sync API: Use standard background sync managers where available. Edits are queued, and the browser handles scheduling and transmission even if the tab closes.

#### 4.2 WebKit-Based Systems (iOS, macOS Safari)

* Foreground-Only Fallback Engine: Because background execution loops are constrained on iOS, synchronization tasks must execute aggressively when the application is active.
* Lifecycle Hooks: The sync pipeline must explicitly bind to the following application states:
* pageshow / visibilitychange (App opened or tab brought into focus).
   * online (Network connectivity re-established).
   * beforeunload (User attempting to navigate away or close the viewport context).

------------------------------
### 5. User Experience (UX) Affordances## 5.1 Storage & Sync Settings Panel

* Persistence Indicator: Visual badge showing storage classification status (e.g., Storage Status: Protected or Storage Status: Best Effort).
* Cloud Link Switch: A simple toggle interface allowing users to Link / Unlink their Dropbox profile.
* Manual Override: A prominent "Sync Now" button that overrides automated sync timers to run immediate state reconciliations.
* Data Portability Port: Backup management buttons allowing users to manually Trigger Local Backup (Generates and downloads a local .json file copy) and Import Database from File.

#### 5.2 Contextual UI Sync Notifications
Because Push Notifications are disabled, all notifications must be managed using non-obtrusive, application-injected HTML components.

* Connection State Banners:
* Offline Mode: When connection is lost, present an elegant inline system banner: "Working Offline — Changes saved safely to device."
   * Online Reconnect: On network restoration: "Network found. Syncing changes..." turning green upon success.
* Database Progress Indicators:
* In-Flight Transfers: A subtle spinner or progress track visible during active cloud uploads/downloads.
   * Success Confirmation: A brief, self-dismissing indicator showing: "All changes saved to cloud."
* Conflict Warning Overlays:
* Alert Triggers: If a conflict fallback creates a parallel file copy, display an explicit modal notification on-screen: "Sync Note: Modifications were made on another device. Please confirm which changes to preserve." Provide side-by-side selection panels before merging state payloads.

------------------------------
To ensure your development agent produces an optimal integration, let me know if you would like me to expand on the exact data schema your app uses, or define how to handle schema version migrations when your PWA receives feature updates.

## Update Source Data Scheme

Current data import XML schema is specifically for the unsupported Fight Club 5e and Gamemaster's Companion 5e.

There should be non-breaking enhancements to that schema to support required features in this app, including:

Explicit subclasses and subclass feature inheritance

Prerequisites for character options

More advanced bonus management

Linking counters with specific subclass features, options, feats, etc.

Character options rather than overloading spells for those select lists

## Import 5eTools JSON schema

Support import of 5eTools in addition to Fight Club for universal support of new features.

## Multiple Databases

Be able to switch between different databases.

## Bookmarks/favorites

Ability to bookmark or favorite any item and have it appear in a bookmarks section, broken down by type.

## Rules reference

Basic conditions or rules, steal what's at the back of the player's handbook

## Character Sheets

Major update: Support creation of characters within the system