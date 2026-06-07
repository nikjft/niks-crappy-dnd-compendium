import { openDB, saveRecords, saveRecord, getAllRecords, clearDatabase, clearCompendium, exportAllData, importAllData, STORES, getAppSetting, saveAppSetting, getCustomRecordsForStore, saveCustomRecord, deleteCustomRecord } from './db.js';
import { ITEM_TYPES, SPELL_SCHOOLS, MONSTER_SIZES, DAMAGE_TYPES } from './parser.js';
import { initStorage, storageHealth, getStorageQuota, onQuotaWarning, onPersistenceResult } from './storage.js';
import { initSync, syncNow, scheduleDebouncedSync, syncState, onSyncStatusChange, startDropboxOAuth, unlinkDropbox, isDropboxLinked, refreshAccessToken } from './sync.js';
import { handleSyncStateChange, showConflictModal, renderSyncStatusBadge, renderStorageBadge } from './ui-sync.js';
import { calculateCharacterState } from './engine.js';
import { 
  parse5etoolsText, 
  render5etoolsEntries, 
  parse5etoolsSpell, 
  parse5etoolsItem, 
  parse5etoolsMonster, 
  parse5etoolsFeat, 
  parse5etoolsBackground, 
  parse5etoolsRace, 
  parse5etoolsOption, 
  normalize5etoolsClass, 
  suffixDuplicateNames,
  getSourceRank,
  sourceRanksRegistry
} from './parser-5etools.js';

// Application State
let currentCategory = 'races';
let currentRecords = []; // Records for the currently selected browsing category
let allRecordsCache = {}; // Cache of all records across all categories for universal search
if (typeof window !== 'undefined') window.allRecordsCache = allRecordsCache;
let selectedFacet1 = 'All';
let selectedFacet2 = 'All';
let searchChits = []; // e.g. [{ field: 'school', value: 'conjuration' }]
let selectedItem = null;
let currentCharacter = null; // Currently open character

// 5eTools Import Directory State
let importFilesMap = {}; // Maps relative path (lowercase) to File object
let foundBooks = [];
let foundAdventures = [];

const SOURCE_MAP = {
  "PHB": "Player's Handbook",
  "XPHB": "Player's Handbook (2024)",
  "DMG": "Dungeon Master's Guide",
  "XDMG": "Dungeon Master's Guide (2024)",
  "MM": "Monster Manual",
  "XMM": "Monster Manual (2024)",
  "TCE": "Tasha's Cauldron of Everything",
  "XGE": "Xanathar's Guide to Everything",
  "VGM": "Volo's Guide to Monsters",
  "MTOF": "Mordenkainen's Tome of Foes",
  "MToF": "Mordenkainen's Tome of Foes",
  "FTD": "Fizban's Treasury of Dragons",
  "MPMM": "Mordenkainen Presents: Monsters of the Multiverse",
  "SCAG": "Sword Coast Adventurer's Guide",
  "ERLW": "Eberron: Rising from the Last War",
  "GGR": "Guildmasters' Guide to Ravnica",
  "MOT": "Mythic Odysseys of Theros",
  "VRG": "Van Richten's Guide to Ravenloft",
  "SCC": "Strixhaven: A Curriculum of Chaos",
  "AAG": "Astral Adventurer's Guide",
  "BAM": "Boo's Astral Menagerie",
  "BGG": "Bigby Presents: Glory of the Giants",
  "COS": "Curse of Strahd",
  "CoS": "Curse of Strahd",
  "TOA": "Tomb of Annihilation",
  "ToA": "Tomb of Annihilation",
  "WDH": "Waterdeep: Dragon Heist",
  "WDMM": "Waterdeep: Mad Mage",
  "GOS": "Ghosts of Saltmarsh",
  "GoS": "Ghosts of Saltmarsh",
  "DIA": "Baldur's Gate: Descent Into Avernus",
  "DiA": "Baldur's Gate: Descent Into Avernus",
  "ROT": "The Rise of Tiamat",
  "RoT": "The Rise of Tiamat",
  "HOTDQ": "Hoard of the Dragon Queen",
  "HotDQ": "Hoard of the Dragon Queen",
  "POTA": "Princes of the Apocalypse",
  "PotA": "Princes of the Apocalypse",
  "OOTA": "Out of the Abyss",
  "OotA": "Out of the Abyss",
  "SKT": "Storm King's Thunder",
  "TYP": "Tales from the Yawning Portal",
  "ACI": "Acquisitions Incorporated",
  "AcI": "Acquisitions Incorporated",
  "IDROTF": "Icewind Dale: Rime of the Frostmaiden",
  "IDRotF": "Icewind Dale: Rime of the Frostmaiden",
  "WBTW": "The Wild Beyond the Witchlight",
  "WBtW": "The Wild Beyond the Witchlight",
  "SJD": "Spelljammer: Light of Xaryxis",
  "LOX": "Light of Xaryxis",
  "LoX": "Light of Xaryxis",
  "KFTGV": "Keys from the Golden Vault",
  "KftGV": "Keys from the Golden Vault",
  "PHAND": "Phandelver and Below: The Shattered Obelisk",
  "PhAnd": "Phandelver and Below: The Shattered Obelisk",
  "BOMT": "The Book of Many Things",
  "BoMT": "The Book of Many Things",
  "GOTG": "Glory of the Giants",
  "GotG": "Glory of the Giants",
  "SATO": "Shadow of the Dragon Queen",
  "SatO": "Shadow of the Dragon Queen",
  "DSOTDQ": "Dragonlance: Shadow of the Dragon Queen",
  "DSotDQ": "Dragonlance: Shadow of the Dragon Queen",
  "VEOR": "Vecna: Eve of Ruin",
  "VEoR": "Vecna: Eve of Ruin",
  "QFTIS": "Quests from the Infinite Staircase",
  "QftIS": "Quests from the Infinite Staircase",
  "TTP": "The Tortle Package",
  "AL": "Adventurers League",
  "EEPC": "Elemental Evil Player's Companion",
  "UA": "Unearthed Arcana",
  "PSA": "Plane Shift: Amonkhet",
  "PSI": "Plane Shift: Innistrad",
  "PSK": "Plane Shift: Kaladesh",
  "PSD": "Plane Shift: Zendikar",
  "PSX": "Plane Shift: Ixalan",
  "EET": "Elemental Evil: Temple of Elemental Evil",
  "LMOP": "Lost Mine of Phandelver",
  "LMoP": "Lost Mine of Phandelver",
  "DOIP": "Dragon of Icespire Peak",
  "DoIP": "Dragon of Icespire Peak",
  "LLK": "Lost Laboratory of Kwalish",
  "KK": "Krenko's Way",
  "LR": "Locathah Rising",
  "SDW": "Storm Lord's Wrath",
  "SLW": "Storm Lord's Wrath",
  "DIP": "Divine Contention",
  "DC": "Divine Contention",
  "EGW": "Explorer's Guide to Wildemount",
  "EGtW": "Explorer's Guide to Wildemount",
  "LDR": "Legendary Dragons",
  "Od": "Odyssey of the Dragonlords",
  "TC": "Tasha's Crucible of Everything Else",
  "BFT": "Bigby's Friendly Guide to the Multiverse",
  "TftYP": "Tales from the Yawning Portal",
  "AftO": "Adventure from the Ooze",
  "SC": "Spelljammer: Light of Xaryxis"
};

function getFullSourceName(sourceAbv) {
  if (!sourceAbv) return '';
  const abvUpper = sourceAbv.toUpperCase();
  for (const [key, val] of Object.entries(SOURCE_MAP)) {
    if (key.toUpperCase() === abvUpper) {
      return val;
    }
  }
  if (Array.isArray(foundBooks)) {
    const book = foundBooks.find(b => b.id.toUpperCase() === abvUpper || b.source?.toUpperCase() === abvUpper);
    if (book) return book.name;
  }
  if (Array.isArray(foundAdventures)) {
    const adv = foundAdventures.find(a => a.id.toUpperCase() === abvUpper || a.source?.toUpperCase() === abvUpper);
    if (adv) return adv.name;
  }
  return sourceAbv;
}

function applyImportOverrides(category, records, activeSources) {
  const overrides = [
    {
      condition: (cat, sources) => cat === 'options' && sources.includes('EFTA'),
      apply: (recs) => {
        return recs.filter(r => {
          const isInfusion = r.classes && r.classes.includes('Artificer Infusion');
          if (isInfusion && r.source !== 'EFTA') {
            return false;
          }
          return true;
        });
      }
    }
  ];

  let result = [...records];
  overrides.forEach(rule => {
    if (rule.condition(category, activeSources)) {
      result = rule.apply(result);
    }
  });
  return result;
}

function formatTableCellValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string' || typeof val === 'number') {
    return parseInlineMarkdown(parse5etoolsText(val.toString(), true));
  }
  if (typeof val === 'object') {
    if (val.type === 'bonus') {
      return (val.value >= 0 ? '+' : '') + val.value;
    }
    if (val.type === 'dice') {
      return (val.toRoll ? val.toRoll.map(r => r.number + 'd' + r.faces).join('+') : '') || (val.number ? val.number + 'd' + val.faces : '');
    }
    return val.value !== undefined ? parseInlineMarkdown(parse5etoolsText(val.value.toString(), true)) : JSON.stringify(val);
  }
  return '';
}
let importSourceType = 'github'; // 'github' or 'local'
let githubRepoUrl = 'https://github.com/5etools-mirror-3/5etools-src';
let githubBaseUrl = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/';

// Helper to convert Github Repo URL to raw content base URL
function updateGithubBaseUrl() {
  let url = githubRepoUrl.trim().replace(/\/$/, '');
  const ghRegex = /github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/;
  const match = url.match(ghRegex);
  if (match) {
    const user = match[1];
    const repo = match[2];
    const branch = match[3] || 'main';
    githubBaseUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/`;
  } else {
    if (url.includes('raw.githubusercontent.com')) {
      githubBaseUrl = url.endsWith('/') ? url : url + '/';
    } else {
      const simpleRegex = /^([^\/]+)\/([^\/]+)$/;
      const simpleMatch = url.match(simpleRegex);
      if (simpleMatch) {
        githubBaseUrl = `https://raw.githubusercontent.com/${simpleMatch[1]}/${simpleMatch[2]}/main/`;
      } else {
        githubBaseUrl = url.endsWith('/') ? url : url + '/';
      }
    }
  }
}

// Mobile View State
let currentMobilePane = 'facet-1'; // 'facet-1', 'facet-2', 'list', 'detail'

// History Navigation State
let isFirstLoad = true;
let isNavigatingHistory = false;
let lastHistoryState = null;

// DOM Elements
const menuItems = document.querySelectorAll('.menu-item');
const btnSettings = document.getElementById('btn-settings');
const fileInput = document.getElementById('file-input');
const dirInput = document.getElementById('5etools-dir-input');
const dbStatus = document.getElementById('db-status');
const loadingOverlay = document.getElementById('loading-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');

const paneFacet1 = document.getElementById('pane-facet-1');
const paneFacet2 = document.getElementById('pane-facet-2');
const paneList = document.getElementById('pane-list');
const paneDetail = document.getElementById('pane-detail');

const facetTitle1 = document.getElementById('facet-title-1');
const facetTitle2 = document.getElementById('facet-title-2');
const listTitle = document.getElementById('list-title');

const facetList1 = document.getElementById('facet-list-1');
const facetList2 = document.getElementById('facet-list-2');
const itemList = document.getElementById('item-list');
const detailPaneContent = document.getElementById('detail-pane-content');

const searchInput = document.getElementById('search-input');
const filterDropdownContainer = document.getElementById('filter-dropdown-container');

// Mobile Back Buttons
const backFacet1 = document.getElementById('back-facet-1');
const backFacet2 = document.getElementById('back-facet-2');
const backList = document.getElementById('back-list');
const backDetail = document.getElementById('back-detail');
const btnFavorite = document.getElementById('btn-favorite');
const btnEditRecord = document.getElementById('btn-edit-record');
const btnSyncCompendium = document.getElementById('btn-sync-compendium');
const btnAddCustom = document.getElementById('btn-add-custom');

const FAVORITES_GROUP_NAMES = {
  'spells': 'Spells',
  'items': 'Equipment',
  'monsters': 'Bestiary',
  'classes': 'Classes',
  'backgrounds': 'Backgrounds',
  'races': 'Races',
  'options': 'Options',
  'feats': 'Feats',
  'features': 'Class Features'
};

function getStoreNameForCategory(category) {
  if (category === 'spell') return 'spells';
  if (category === 'item') return 'items';
  if (category === 'monster') return 'monsters';
  if (category === 'feat') return 'feats';
  if (category === 'background') return 'backgrounds';
  if (category === 'race') return 'races';
  if (category === 'option') return 'options';
  if (category === 'class' || category === 'class-overview' || category === 'classes') return 'classes';
  if (category === 'class-feature') return 'classes';
  return category;
}

function getFavoriteKey(item, category) {
  const store = getStoreNameForCategory(category);
  if (category === 'class-feature') {
    return `features:${item.className}:${item.name}`;
  }
  const name = item.name || item.itemName;
  return `${store}:${name}`;
}

function isItemFavorited(item, category) {
  if (!item) return false;
  const key = getFavoriteKey(item, category);
  const fav = allRecordsCache['favorites']?.find(f => f.name === key);
  return fav && !fav._deleted;
}

function resolveFavoriteItem(fav) {
  if (fav.category === 'classes' && fav.featureName) {
    const cls = allRecordsCache['classes']?.find(c => c.name === fav.className);
    if (cls) {
      const feature = cls.features?.find(f => f.name === fav.featureName);
      if (feature) {
        return {
          ...feature,
          className: cls.name,
          categoryType: 'class-feature',
          favoriteNameKey: fav.name
        };
      }
    }
    return null;
  }
  
  if (fav.category === 'features') {
    const cls = allRecordsCache['classes']?.find(c => c.name === fav.className);
    if (cls) {
      const feature = cls.features?.find(f => f.name === fav.featureName);
      if (feature) {
        return {
          ...feature,
          className: cls.name,
          categoryType: 'class-feature',
          favoriteNameKey: fav.name
        };
      }
    }
    return null;
  }

  const full = allRecordsCache[fav.category]?.find(item => item.name === fav.itemName);
  if (full) {
    let catType = fav.category.substring(0, fav.category.length - 1);
    if (fav.category === 'classes') catType = 'class-overview';
    return {
      ...full,
      categoryType: catType,
      favoriteNameKey: fav.name
    };
  }
  return null;
}

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Load GitHub repository URL setting
  const savedRepoUrl = await getAppSetting('github_repo_url');
  if (savedRepoUrl) {
    githubRepoUrl = savedRepoUrl;
    updateGithubBaseUrl();
  }

  // 1. Initialize storage persistence + quota monitoring
  await initStorage();
  onQuotaWarning((pct) => {
    console.warn(`[app] Storage quota at ${Math.round(pct * 100)}% — warning user.`);
    updateDBStatus(`⚠ Storage ${Math.round(pct * 100)}% Full`);
  });
  onPersistenceResult(({ granted }) => {
    console.log(`[app] Storage persistence: ${granted ? 'granted' : 'best-effort'}`);
  });

  // 2. Initialize Dropbox sync engine (binds lifecycle triggers)
  await initSync();
  onSyncStatusChange((state) => {
    handleSyncStateChange(state);
    // Re-render the sync badge in settings if visible
    const badgeEl = document.getElementById('sync-badge-container');
    if (badgeEl) renderSyncStatusBadge(badgeEl, state);
  });

  // 3. Seed and load data
  await checkAndSeedDatabase();
  await loadAllRecordsCache();

  // Parse URL search parameters on load to restore state from deep links
  const params = new URLSearchParams(window.location.search);
  if (params.has('category')) {
    const category = params.get('category');
    const pane = params.get('pane') || 'facet-1';
    const facet1 = params.get('facet1') || 'All';
    let facet2 = params.get('facet2') || 'All';
    if (facet2 !== 'All' && !isNaN(facet2)) {
      facet2 = parseInt(facet2, 10);
    }
    const itemName = params.get('item') || null;

    const targetState = {
      category,
      pane,
      selectedFacet1: facet1,
      selectedFacet2: facet2,
      selectedItemName: itemName
    };

    isFirstLoad = false;
    await restoreState(targetState);
    pushCurrentState(true);

    // Synchronize sidebar active menu item highlights
    menuItems.forEach(mi => {
      if (mi.getAttribute('data-category') === category) {
        mi.classList.add('active');
      } else {
        mi.classList.remove('active');
      }
    });
  } else {
    await loadCategory(currentCategory);
  }
});

// Event Listeners Setup
function setupEventListeners() {
  // Category switching
  menuItems.forEach(item => {
    item.addEventListener('click', async () => {
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');
      const cat = item.getAttribute('data-category');
      
      if (pickerActive) {
        if (cat === 'characters') {
          pickerActive = false;
          pickerTargetListId = null;
          updateSidebarVisibility();
          const sidebarBackBtn = document.getElementById('sidebar-back-to-sheet');
          if (sidebarBackBtn) sidebarBackBtn.style.display = 'none';
          const footer = document.getElementById('pane-detail-footer');
          if (footer) footer.style.display = 'none';
        } else {
          updateDetailFooterUI();
        }
      }
      
      await loadCategory(cat);
    });
  });

  // Imports
  btnSettings.addEventListener('click', showSettingsPanel);
  fileInput.addEventListener('change', handleImportFile);
  dirInput.addEventListener('change', handle5eToolsDirectorySelect);

  // Search input change
  searchInput.addEventListener('input', () => {
    applyFilters();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });

  // Mobile navigation back buttons
  backFacet1.addEventListener('click', () => {
    // Left sidebar is always visible as icons on mobile
  });
  backFacet2.addEventListener('click', () => window.history.back());
  backList.addEventListener('click', () => window.history.back());
  backDetail.addEventListener('click', () => window.history.back());

  // History popstate navigation
  window.addEventListener('popstate', async (e) => {
    if (e.state) {
      lastHistoryState = e.state;
      isNavigatingHistory = true;
      try {
        await restoreState(e.state);
      } catch (err) {
        console.error('Error restoring navigation state:', err);
      } finally {
        isNavigatingHistory = false;
      }
    }
  });

  // Touch Swiping Gestures (Left-to-Right to go back)
  let touchStartX = 0;
  let touchStartY = 0;
  const panesContainer = document.querySelector('.panes-container');

  panesContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  panesContainer.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Swipe Right (Left-to-Right gesture to go Back)
    if (deltaX > 75 && Math.abs(deltaY) < 40) {
      const isMobile = window.innerWidth < 900;
      if (isMobile) {
        if (currentMobilePane === 'detail') {
          backDetail.click();
        } else if (currentMobilePane === 'list') {
          backList.click();
        } else if (currentMobilePane === 'facet-2') {
          backFacet2.click();
        } else if (currentMobilePane === 'facet-1') {
          backFacet1.click();
        }
      } else {
        // On desktop/tablet, if detail is open, close it
        if (document.querySelector('.app-container').classList.contains('has-detail')) {
          backDetail.click();
        }
      }
    }
  }, { passive: true });

  // Favorite toggle button click handler
  if (btnFavorite) {
    btnFavorite.addEventListener('click', async () => {
      if (!selectedItem) return;
      const isFav = isItemFavorited(selectedItem, selectedItem.categoryType);
      const key = getFavoriteKey(selectedItem, selectedItem.categoryType);
      
      let favRecord;
      if (isFav) {
        // Soft delete (tombstone)
        const store = getStoreNameForCategory(selectedItem.categoryType);
        favRecord = {
          name: key,
          category: store === 'classes' && selectedItem.categoryType === 'class-feature' ? 'features' : store,
          itemName: selectedItem.name,
          className: selectedItem.className || '',
          featureName: selectedItem.categoryType === 'class-feature' ? selectedItem.name : '',
          _deleted: true,
          _modified_at: new Date().toISOString()
        };
      } else {
        // Create/restore favorite
        const store = getStoreNameForCategory(selectedItem.categoryType);
        favRecord = {
          name: key,
          category: store === 'classes' && selectedItem.categoryType === 'class-feature' ? 'features' : store,
          itemName: selectedItem.name,
          className: selectedItem.className || '',
          featureName: selectedItem.categoryType === 'class-feature' ? selectedItem.name : '',
          _deleted: false,
          _modified_at: new Date().toISOString()
        };
      }
      
      // Save to DB and memory cache
      await saveRecord('favorites', favRecord);
      
      // Update cache
      if (!allRecordsCache['favorites']) {
        allRecordsCache['favorites'] = [];
      }
      const existingIdx = allRecordsCache['favorites'].findIndex(f => f.name === key);
      if (existingIdx >= 0) {
        allRecordsCache['favorites'][existingIdx] = favRecord;
      } else {
        allRecordsCache['favorites'].push(favRecord);
      }

      // Update button appearance
      updateFavoriteButtonUI();

      // If currentCategory is favorites, reload the category to update the lists
      if (currentCategory === 'favorites') {
        const prevFacet1 = selectedFacet1;
        await loadCategory('favorites');
        selectedFacet1 = prevFacet1;
        renderFacet1();
        applyFilters();
      }

      // Sync changes
      scheduleDebouncedSync();
    });
  }
  // Edit record button
  if (btnEditRecord) {
    btnEditRecord.addEventListener('click', () => {
      if (!selectedItem) return;
      openCustomElementDialog(currentCategory, selectedItem);
    });
  }

  // Sync from compendium button (resets custom override)
  if (btnSyncCompendium) {
    btnSyncCompendium.addEventListener('click', async () => {
      if (!selectedItem || !selectedItem._custom || !selectedItem._overrides_compendium) return;
      if (!confirm(`Reset "${selectedItem.name}" to the original compendium version? Your customizations will be permanently lost.`)) return;
      const store = getStoreNameForCategory(currentCategory);
      await deleteCustomRecord(store, selectedItem.name);
      // Reload cache for this store and re-render
      allRecordsCache[store] = await getAllRecords(store);
      const customs = await getCustomRecordsForStore(store);
      customs.forEach(cr => {
        if (!allRecordsCache[store].find(r => r.name === cr.name)) allRecordsCache[store].push(cr);
      });
      currentRecords = allRecordsCache[store] || [];
      const restored = currentRecords.find(r => r.name === selectedItem.name);
      if (restored) {
        selectedItem = restored;
        renderDetails(restored);
      }
      applyFilters();
    });
  }

  // Add custom record button (list pane "+")
  if (btnAddCustom) {
    btnAddCustom.addEventListener('click', () => {
      openCustomElementDialog(currentCategory, null);
    });
  }

  setupCharacterSheetEvents();

  // Intercept relative link clicks for single-page app (SPA) internal navigation
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    
    if (href.startsWith('?') || href.startsWith('/') || href.includes('category=')) {
      e.preventDefault();
      
      const urlParams = new URLSearchParams(href.substring(href.indexOf('?')));
      const category = urlParams.get('category');
      const itemName = urlParams.get('item');
      const pane = urlParams.get('pane') || 'detail';
      const facet1 = urlParams.get('facet1') || 'All';
      const facet2 = urlParams.get('facet2') || 'All';
      
      if (category) {
        const newState = {
          category: category,
          pane: pane,
          selectedItemName: itemName,
          selectedFacet1: facet1,
          selectedFacet2: facet2
        };
        
        pushCurrentState(false);
        
        isNavigatingHistory = true;
        try {
          await restoreState(newState);
          window.history.pushState(newState, '', '?' + urlParams.toString());
          lastHistoryState = newState;
        } catch (err) {
          console.error('Error navigating via link:', err);
        } finally {
          isNavigatingHistory = false;
        }
      }
    }
  });
}

function updateFavoriteButtonUI() {
  if (!btnFavorite) return;
  const noItem = !selectedItem || currentCategory === 'settings' || currentCategory === 'search';
  if (noItem) {
    btnFavorite.style.display = 'none';
    if (btnEditRecord) btnEditRecord.style.display = 'none';
    if (btnSyncCompendium) btnSyncCompendium.style.display = 'none';
    return;
  }

  // Show button and check if active
  btnFavorite.style.display = 'flex';
  const isFav = isItemFavorited(selectedItem, selectedItem.categoryType);
  if (isFav) {
    btnFavorite.classList.add('active');
  } else {
    btnFavorite.classList.remove('active');
  }

  // Edit button — shown for all compendium items (not characters/favorites/settings)
  const editableCategories = ['spells', 'items', 'monsters', 'feats', 'options', 'backgrounds', 'races', 'classes', 'subclasses'];
  if (btnEditRecord) {
    btnEditRecord.style.display = editableCategories.includes(currentCategory) ? 'flex' : 'none';
  }

  // Sync button — only for custom records that override a compendium entry
  if (btnSyncCompendium) {
    btnSyncCompendium.style.display = (selectedItem._custom && selectedItem._overrides_compendium) ? 'flex' : 'none';
  }
}

// Show/hide the "+" add custom button in the list pane header
function updateAddCustomButtonUI() {
  if (!btnAddCustom) return;
  const noCustom = ['characters', 'favorites', 'search', 'settings'].includes(currentCategory);
  btnAddCustom.style.display = noCustom || pickerActive ? 'none' : 'flex';
}

// Load all records across all stores into local memory cache
async function loadAllRecordsCache() {
  for (const store of STORES) {
    allRecordsCache[store] = await getAllRecords(store);
  }

  // Dynamically reconstruct class features and subclassEntities for backward compatibility in UI
  if (allRecordsCache['classes'] && allRecordsCache['subclasses']) {
    allRecordsCache['classes'].forEach(cls => {
      const classSubclasses = allRecordsCache['subclasses'].filter(s => s.parentClass === cls.name);
      
      // 1. Populate subclasses name list
      cls.subclasses = classSubclasses.map(s => s.name);
      
      // 2. Populate subclassEntities
      cls.subclassEntities = classSubclasses;
      
      // 3. Reconstruct features (flat array of base + subclass features)
      const featuresList = [];
      
      // Base class features
      if (cls.autolevels) {
        cls.autolevels.forEach(al => {
          if (al.features) {
            al.features.forEach(f => {
              featuresList.push({
                ...f,
                level: al.level,
                subclass: null
              });
            });
          }
        });
      }
      
      // Subclass features
      classSubclasses.forEach(sub => {
        if (sub.autolevels) {
          sub.autolevels.forEach(al => {
            if (al.features) {
              al.features.forEach(f => {
                featuresList.push({
                  ...f,
                  level: al.level,
                  subclass: sub.name
                });
              });
            }
          });
        }
      });
      
      cls.features = featuresList;
    });
  }

  // Merge user custom records into each store's in-memory cache
  const compendiumStores = STORES.filter(s => s !== 'favorites' && s !== 'characters');
  for (const store of compendiumStores) {
    const customs = await getCustomRecordsForStore(store);
    if (customs.length === 0) continue;
    if (!allRecordsCache[store]) allRecordsCache[store] = [];
    customs.forEach(cr => {
      if (cr._overrides_compendium) {
        const idx = allRecordsCache[store].findIndex(r => r.name === cr.name);
        if (idx >= 0) {
          allRecordsCache[store][idx] = cr;
        } else {
          allRecordsCache[store].push(cr);
        }
      } else {
        // New custom record — append only if not already present
        if (!allRecordsCache[store].find(r => r.name === cr.name)) {
          allRecordsCache[store].push(cr);
        }
      }
    });
  }
}

// Check if IndexedDB is empty — if so, auto-import XPHB, XDMG, XMM from GitHub
async function checkAndSeedDatabase() {
  try {
    const spells = await getAllRecords('spells');
    if (spells.length === 0) {
      updateDBStatus('Importing default sources…');
      console.log('[app] DB empty — auto-importing XPHB, XDMG, XMM from GitHub');
      importSourceType = 'github';
      try {
        await execute5eToolsImport(['XPHB', 'XDMG', 'XMM']);
        updateDBStatus('Compendium Ready');
      } catch (err) {
        console.error('[app] Auto-import failed:', err);
        updateDBStatus('Auto-import failed — import manually in Settings');
      }
    } else {
      updateDBStatus('Compendium Ready');
    }
  } catch (error) {
    console.error('Error checking database status:', error);
    updateDBStatus('Compendium (Error)');
  }
}


// Handle XML or JSON import files
async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isJson = file.name.toLowerCase().endsWith('.json');

  if (!isJson) {
    alert('Please select a .json backup file.');
    fileInput.value = '';
    return;
  }

  showOverlay('Importing JSON backup...', `Parsing and upserting records from ${file.name}...`);

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      // JSON backup import
      const data = JSON.parse(event.target.result);
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON backup file.');
      let importedCount = 0;
      for (const store of STORES) {
        if (data[store] && Array.isArray(data[store])) {
          importedCount += data[store].length;
        }
      }
      await importAllData(data, { merge: true });
      hideOverlay();
      alert(`Successfully imported ${importedCount} records from JSON backup!`);
      updateDBStatus(`Imported ${file.name}`);

      await loadAllRecordsCache();
      if (currentCategory === 'settings') {
        renderSettingsPage();
      } else {
        await loadCategory(currentCategory);
      }

      // Trigger sync after import
      scheduleDebouncedSync();

    } catch (error) {
      console.error('Error importing file:', error);
      hideOverlay();
      alert('Error importing JSON: ' + error.message);
    }
  };

  reader.readAsText(file);
  fileInput.value = ''; // Reset input

}

// Recursively traverse directory handle using modern File System Access API
async function scanDirectoryHandle(dirHandle, pathAccumulator = '') {
  const filesList = [];
  for await (const entry of dirHandle.values()) {
    // Performance optimization: skip hidden folders/files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      const relativePath = pathAccumulator ? `${pathAccumulator}/${entry.name}` : entry.name;
      // Define webkitRelativePath dynamically so it behaves exactly like input file lists
      Object.defineProperty(file, 'webkitRelativePath', {
        value: relativePath,
        writable: true,
        configurable: true
      });
      filesList.push(file);
    } else if (entry.kind === 'directory') {
      const subDirPath = pathAccumulator ? `${pathAccumulator}/${entry.name}` : entry.name;
      const subFiles = await scanDirectoryHandle(entry, subDirPath);
      filesList.push(...subFiles);
    }
  }
  return filesList;
}

// Process selection from modern File System Access API
async function handleDirectoryHandleSelect(dirHandle) {
  importSourceType = 'local';
  showOverlay('Scanning 5eTools...', 'Traversing folder structure...');
  try {
    const files = await scanDirectoryHandle(dirHandle, dirHandle.name);
    await handle5eToolsFilesList(files);
  } catch (err) {
    console.error(err);
    hideOverlay();
    alert('Failed to scan directory: ' + err.message);
  }
}

// Common logic to process files list from either directory picker or input element
async function handle5eToolsFilesList(files) {
  if (files.length === 0) {
    throw new Error("No files found in the selected folder.");
  }

  // Find books.json to determine the relative prefix path dynamically
  const booksFileEntry = files.find(f => f.name.toLowerCase() === 'books.json');
  if (!booksFileEntry) {
    throw new Error("Could not find 'books.json' in the selected folder. Please make sure you selected the 5eTools folder (either the repository root or the 'data' folder).");
  }

  const booksPath = booksFileEntry.webkitRelativePath.toLowerCase();
  // Determine prefix to strip: everything before 'books.json' (e.g. "5etools-src/data/" or "data/" or "")
  const prefix = booksPath.substring(0, booksPath.length - 'books.json'.length);

  importFilesMap = {};
  files.forEach(f => {
    const relativePath = f.webkitRelativePath.toLowerCase();
    if (relativePath.startsWith(prefix)) {
      const subPath = relativePath.substring(prefix.length);
      // Map it under 'data/' internally so the rest of the application references it consistently
      importFilesMap[`data/${subPath}`] = f;
    }
  });

  // 1. Read books.json
  const booksFile = importFilesMap['data/books.json'];
  if (!booksFile) {
    throw new Error("Could not find 'data/books.json' in selected folder. Make sure you selected the 5eTools data folder.");
  }
  const booksText = await booksFile.text();
  const booksJson = JSON.parse(booksText);
  foundBooks = booksJson.book || [];

  // 2. Read adventures.json (if present)
  const adventuresFile = importFilesMap['data/adventures.json'];
  if (adventuresFile) {
    const advText = await adventuresFile.text();
    const advJson = JSON.parse(advText);
    foundAdventures = advJson.adventure || [];
  } else {
    foundAdventures = [];
  }

  hideOverlay();
  showSourceSelectionModal();
}

// Connect to 5eTools GitHub and fetch index files
async function handle5eToolsGitHubImport() {
  importSourceType = 'github';
  showOverlay('Connecting to GitHub...', 'Fetching 5eTools index files...');
  try {
    // 1. Fetch books.json
    const booksRes = await fetch(`${githubBaseUrl}data/books.json`);
    if (!booksRes.ok) throw new Error(`Failed to fetch books.json (HTTP ${booksRes.status})`);
    const booksJson = await booksRes.json();
    foundBooks = booksJson.book || [];

    // 2. Fetch adventures.json
    try {
      const advRes = await fetch(`${githubBaseUrl}data/adventures.json`);
      if (advRes.ok) {
        const advJson = await advRes.json();
        foundAdventures = advJson.adventure || [];
      } else {
        foundAdventures = [];
      }
    } catch (e) {
      console.warn('Failed to fetch adventures.json', e);
      foundAdventures = [];
    }

    hideOverlay();
    showSourceSelectionModal();
  } catch (err) {
    console.error(err);
    hideOverlay();
    alert('Failed to connect to 5eTools GitHub repository:\n' + err.message + '\n\nPlease check your internet connection or use a local folder instead.');
  }
}

// Handle 5eTools Directory Selection via input element (Legacy/Fallback)
async function handle5eToolsDirectorySelect(e) {
  importSourceType = 'local';
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  showOverlay('Scanning 5eTools...', 'Indexing books and data files...');
  try {
    await handle5eToolsFilesList(files);
  } catch (err) {
    console.error(err);
    hideOverlay();
    alert('Failed to scan 5eTools directory: ' + err.message + '\n\nTip: If you selected the repository root, try selecting the "data" subfolder instead. This avoids security blocks on hidden folders (like .git).');
  } finally {
    dirInput.value = ''; // Reset input
  }
}

// Show Source Selection Checklist Modal
function showSourceSelectionModal() {
  const modal = document.getElementById('5etools-source-modal');
  const listContainer = document.getElementById('5etools-source-list');
  if (!modal || !listContainer) return;

  // Group books by type
  const groups = {
    'core': { name: 'Core Rulebooks', items: [] },
    'supplement': { name: 'Supplements & Rules Expansions', items: [] },
    'setting': { name: 'Campaign Settings', items: [] },
    'adventure': { name: 'Adventures', items: [] },
    'other': { name: 'Other Publications', items: [] }
  };

  // Group books
  foundBooks.forEach(b => {
    const grp = b.group || 'other';
    const groupKey = ['core', 'supplement', 'setting', 'setting-alt'].includes(grp) 
      ? (grp === 'setting-alt' ? 'setting' : grp) 
      : 'other';
    groups[groupKey].items.push({ id: b.source || b.id, name: b.name, type: 'book' });
  });

  // Group adventures
  foundAdventures.forEach(a => {
    groups['adventure'].items.push({ id: a.source || a.id, name: a.name, type: 'adventure' });
  });

  // Retrieve saved selection
  let lastSelection = [];
  try {
    const saved = localStorage.getItem('lastImportSources');
    if (saved) lastSelection = JSON.parse(saved);
  } catch (err) {
    console.error('Failed to parse lastImportSources', err);
  }

  // Render HTML
  let html = '';
  for (const [key, grp] of Object.entries(groups)) {
    if (grp.items.length === 0) continue;
    
    // Sort items alphabetically
    grp.items.sort((a, b) => a.name.localeCompare(b.name));

    html += `
      <div class="source-group-section" style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: bold; color: var(--accent-color); border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 8px; font-family: var(--font-header);">${grp.name}</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;">
          ${grp.items.map(item => {
            const isChecked = lastSelection.length === 0 || lastSelection.includes(item.id);
            return `
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); cursor: pointer;">
                <input type="checkbox" class="source-checkbox" data-id="${item.id}" data-type="${item.type}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; margin: 0;">
                <span>${item.name}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  listContainer.innerHTML = html;
  modal.style.display = 'flex';

  // Modal event wiring
  const btnSelectAll = document.getElementById('5etools-source-btn-select-all');
  const btnDeselectAll = document.getElementById('5etools-source-btn-deselect-all');
  const btnCancel = document.getElementById('5etools-source-btn-cancel');
  const btnImport = document.getElementById('5etools-source-btn-import');

  btnSelectAll.onclick = () => {
    listContainer.querySelectorAll('.source-checkbox').forEach(cb => cb.checked = true);
  };
  btnDeselectAll.onclick = () => {
    listContainer.querySelectorAll('.source-checkbox').forEach(cb => cb.checked = false);
  };
  btnCancel.onclick = () => {
    modal.style.display = 'none';
  };
  btnImport.onclick = async () => {
    const checkedBoxes = Array.from(listContainer.querySelectorAll('.source-checkbox:checked'));
    const selectedSources = checkedBoxes.map(cb => cb.getAttribute('data-id'));
    
    // Save last selection set
    localStorage.setItem('lastImportSources', JSON.stringify(selectedSources));

    modal.style.display = 'none';
    
    if (selectedSources.length === 0) {
      alert('No sources selected. Import aborted.');
      return;
    }

    await execute5eToolsImport(selectedSources);
  };
}

// Main Import Execution Flow
async function execute5eToolsImport(sources) {
  showOverlay('Importing 5eTools...', 'Loading data files and processing records...');

  try {
    const importStats = {
      spells: 0,
      items: 0,
      monsters: 0,
      classes: 0,
      subclasses: 0,
      feats: 0,
      backgrounds: 0,
      races: 0,
      options: 0
    };

    // Keep arrays for classes/features compilation
    let allRawSubclasses = [];
    let allRawClassFeatures = [];
    let allRawSubclassFeatures = [];
    let allRawClasses = [];

    // Helper: Read a JSON file
    const readJsonFile = async (path) => {
      if (importSourceType === 'github') {
        const url = `${githubBaseUrl}${path}`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return await res.json();
        } catch (err) {
          console.warn(`Failed to fetch file: ${path}`, err);
          return null;
        }
      } else {
        const file = importFilesMap[path.toLowerCase()];
        if (!file) return null;
        try {
          const text = await file.text();
          return JSON.parse(text);
        } catch (err) {
          console.warn(`Failed to parse file: ${path}`, err);
          return null;
        }
      }
    };

    // Helper: Find all matching source files in directory based on file list
    const findPathsInDir = (dirPrefix, suffix) => {
      return Object.keys(importFilesMap).filter(p => 
        p.startsWith(dirPrefix.toLowerCase()) && p.endsWith(suffix.toLowerCase())
      );
    };

    // Fetch Index Maps for selective loading in GitHub mode
    let spellsIndex = {};
    let bestiaryIndex = {};
    let classIndex = {};

    if (importSourceType === 'github') {
      showOverlay('Importing 5eTools...', 'Loading indexes from GitHub...');
      const sIdx = await readJsonFile('data/spells/index.json');
      if (sIdx) spellsIndex = sIdx;
      const bIdx = await readJsonFile('data/bestiary/index.json');
      if (bIdx) bestiaryIndex = bIdx;
      const cIdx = await readJsonFile('data/class/index.json');
      if (cIdx) classIndex = cIdx;
    }
    // Load books.json to establish dynamic source ranking by publication date
    showOverlay('Importing 5eTools...', 'Loading source metadata...');
    const booksJson = await readJsonFile('data/books.json');
    if (booksJson && booksJson.book) {
      booksJson.book.forEach(b => {
        if (b.id && b.published) {
          const time = new Date(b.published).getTime();
          if (!isNaN(time)) {
            sourceRanksRegistry[b.id.toUpperCase()] = time;
          }
        }
      });
    }

    // Load spell source lookup map
    showOverlay('Importing 5eTools...', 'Loading spell source lookup...');
    const lookup = await readJsonFile('data/generated/gendata-spell-source-lookup.json') || null;

    const matchItemForVariant = (baseItem, variant) => {
      if (variant.requires && Array.isArray(variant.requires)) {
        let matchedAny = false;
        for (const req of variant.requires) {
          let reqMatch = true;
          for (const key in req) {
            if (key === 'type') {
              const reqType = req.type.includes('|') ? req.type.split('|')[0] : req.type;
              const baseType = baseItem.rawType.includes('|') ? baseItem.rawType.split('|')[0] : baseItem.rawType;
              if (baseType !== reqType) {
                reqMatch = false;
              }
            } else {
              if (baseItem[key] !== req[key]) {
                reqMatch = false;
              }
            }
          }
          if (reqMatch) {
            matchedAny = true;
            break;
          }
        }
        if (!matchedAny) return false;
      }
      
      if (variant.excludes) {
        for (const key in variant.excludes) {
          if (baseItem[key]) {
            return false;
          }
          if (baseItem.name && baseItem.name.toLowerCase() === key.toLowerCase()) {
            return false;
          }
        }
      }
      return true;
    };

    const deduplicateByRank = (records) => {
      const highest = {};
      for (const rec of records) {
        const name = rec.name;
        const currentRank = getSourceRank(rec.source);
        if (!highest[name]) {
          highest[name] = rec;
        } else {
          const existingRank = getSourceRank(highest[name].source);
          if (currentRank > existingRank) {
            highest[name] = rec;
          }
        }
      }
      return Object.values(highest);
    };

    // ─── 1. Spells Ingestion ───
    let allParsedSpells = [];
    for (const source of sources) {
      let spellPath;
      let hasSpellFile = false;

      if (importSourceType === 'github') {
        const fileMapped = spellsIndex[source.toUpperCase()];
        if (fileMapped) {
          spellPath = `data/spells/${fileMapped}`;
          hasSpellFile = true;
        }
      } else {
        spellPath = `data/spells/spells-${source}.json`.toLowerCase();
        if (importFilesMap[spellPath]) {
          hasSpellFile = true;
        }
      }

      if (hasSpellFile) {
        showOverlay('Importing 5eTools...', `Fetching spells for ${source}...`);
        const json = await readJsonFile(spellPath);
        if (json && json.spell) {
          const parsedSpells = json.spell.map(s => parse5etoolsSpell(s, source, lookup, sources));
          allParsedSpells.push(...parsedSpells);
        }
      }
    }
    const dedupedSpells = deduplicateByRank(allParsedSpells);
    if (dedupedSpells.length > 0) {
      await saveRecords('spells', dedupedSpells);
      importStats.spells += dedupedSpells.length;
    }

    // ─── 2. Items Ingestion ───
    showOverlay('Importing 5eTools...', 'Loading items data...');
    let allParsedItems = [];

    // Ingest base items (non-magical equipment)
    const baseItemsJson = await readJsonFile('data/items-base.json');
    if (baseItemsJson && baseItemsJson.baseitem) {
      const filteredBase = baseItemsJson.baseitem.filter(i => sources.includes(i.source));
      const parsedBase = filteredBase.map(i => parse5etoolsItem(i, i.source));
      allParsedItems.push(...parsedBase);
    }

    // Ingest standard items
    const itemsJson = await readJsonFile('data/items.json');
    if (itemsJson && itemsJson.item) {
      const filteredReg = itemsJson.item.filter(i => sources.includes(i.source));
      const parsedReg = filteredReg.map(i => parse5etoolsItem(i, i.source));
      allParsedItems.push(...parsedReg);
    }

    // Generate magic variants
    const magicVariantsJson = await readJsonFile('data/magicvariants.json');
    if (magicVariantsJson && magicVariantsJson.magicvariant) {
      const generatedVariants = [];
      for (const variant of magicVariantsJson.magicvariant) {
        const inherits = variant.inherits || {};
        const variantSource = inherits.source || variant.source;
        if (!variantSource || !sources.includes(variantSource)) {
          continue;
        }

        // Match against all parsed base items
        for (const baseItem of allParsedItems) {
          // Magic variants should only be created from base/non-magical items
          if (baseItem.magic) continue;
          
          // Skip tools, adventuring gear, and other non-combat items
          if (!baseItem.weapon && !baseItem.armor && !baseItem.shield && !baseItem.ammo) {
            continue;
          }

          // Restrict armor modifiers to armor/shields
          if (inherits.bonusAc && !baseItem.armor && !baseItem.shield) {
            continue;
          }

          // Restrict weapon modifiers to weapons/ammo
          if ((inherits.bonusWeapon || inherits.bonusWeaponAttack) && !baseItem.weapon && !baseItem.ammo) {
            continue;
          }
          
          if (matchItemForVariant(baseItem, variant)) {
            const namePrefix = inherits.namePrefix || '';
            const nameSuffix = inherits.nameSuffix || '';
            const newName = `${namePrefix}${baseItem.name}${nameSuffix}`;
            
            const bonusAc = inherits.bonusAc ? parseInt(inherits.bonusAc) : 0;
            const newAc = baseItem.ac !== null ? baseItem.ac + bonusAc : null;

            // Interpolate description entries
            const rawEntries = inherits.entries || variant.entries || [];
            const bonusWeapon = inherits.bonusWeapon || '';
            const bonusWeaponAttack = inherits.bonusWeaponAttack || '';
            const parsedEntries = rawEntries.map(entry => {
              if (typeof entry === 'string') {
                return entry
                  .replace(/\{=bonusWeapon\}/g, bonusWeapon)
                  .replace(/\{=bonusAc\}/g, inherits.bonusAc || '')
                  .replace(/\{=bonusWeaponAttack\}/g, bonusWeaponAttack);
              }
              return entry;
            });

            const variantTexts = render5etoolsEntries(parsedEntries);
            const combinedTexts = [...variantTexts, ...baseItem.texts];

            const rarity = inherits.rarity || baseItem.detail || 'Rare';

            // Construct new variant item
            const newVariant = {
              ...baseItem,
              name: newName,
              detail: rarity,
              magic: true,
              ac: newAc,
              texts: combinedTexts,
              source: variantSource,
              rawType: baseItem.rawType,
              armor: baseItem.armor,
              weapon: baseItem.weapon,
              shield: baseItem.shield,
              ammo: baseItem.ammo
            };
            generatedVariants.push(newVariant);
          }
        }
      }
      allParsedItems.push(...generatedVariants);
    }

    const dedupedItems = deduplicateByRank(allParsedItems);
    if (dedupedItems.length > 0) {
      await saveRecords('items', dedupedItems);
      importStats.items += dedupedItems.length;
    }

    // ─── 3. Bestiary Ingestion ───
    let monsterPaths = [];
    if (importSourceType === 'github') {
      sources.forEach(source => {
        const fileMapped = bestiaryIndex[source.toUpperCase()];
        if (fileMapped) {
          monsterPaths.push(`data/bestiary/${fileMapped}`);
        }
      });
    } else {
      monsterPaths = findPathsInDir('data/bestiary/', '.json');
    }

    let allParsedMonsters = [];
    for (const path of monsterPaths) {
      showOverlay('Importing 5eTools...', `Loading bestiary file: ${path.split('/').pop()}...`);
      const json = await readJsonFile(path);
      if (json && json.monster) {
        const filtered = json.monster.filter(m => sources.includes(m.source));
        if (filtered.length > 0) {
          const parsedMonsters = filtered.map(m => parse5etoolsMonster(m, m.source));
          allParsedMonsters.push(...parsedMonsters);
        }
      }
    }
    const dedupedMonsters = deduplicateByRank(allParsedMonsters);
    if (dedupedMonsters.length > 0) {
      await saveRecords('monsters', dedupedMonsters);
      importStats.monsters += dedupedMonsters.length;
    }

    // ─── 4. Feats, Backgrounds, Races, Options ───
    // Feats
    showOverlay('Importing 5eTools...', 'Loading feats data...');
    const featsJson = await readJsonFile('data/feats.json');
    let allParsedFeats = [];
    if (featsJson && featsJson.feat) {
      const filtered = featsJson.feat.filter(f => sources.includes(f.source));
      allParsedFeats = filtered.map(f => parse5etoolsFeat(f, f.source));
    }

    // Process optional features that are Fighting Styles and load them as Feats
    const optJsonForFeats = await readJsonFile('data/optionalfeatures.json');
    if (optJsonForFeats && optJsonForFeats.optionalfeature) {
      const hasXPHB = sources.includes('XPHB');
      optJsonForFeats.optionalfeature.forEach(o => {
        if (!sources.includes(o.source)) return;
        if (o.featureType && o.featureType.some(ft => ft === 'FS:F' || ft === 'FS:B' || ft === 'FS:P' || ft === 'FS:R')) {
          // Add override: if XPHB is loaded, do not import TCE Ranger and Paladin specific fighting styles
          if (hasXPHB && o.source.toUpperCase() === 'TCE') {
            const isRangerOrPaladin = o.featureType.some(ft => ft === 'FS:R' || ft === 'FS:P');
            const isFighter = o.featureType.some(ft => ft === 'FS:F');
            if (isRangerOrPaladin && !isFighter) {
              return; // Skip Paladin/Ranger specific TCE styles
            }
          }
          const featRecord = parse5etoolsFeat(o, o.source);
          featRecord.category = 'Fighting Style';
          allParsedFeats.push(featRecord);
        }
      });
    }

    const dedupedFeats = deduplicateByRank(allParsedFeats);
    if (dedupedFeats.length > 0) {
      await saveRecords('feats', dedupedFeats);
      importStats.feats += dedupedFeats.length;
    }

    // Backgrounds
    showOverlay('Importing 5eTools...', 'Loading backgrounds data...');
    const bgJson = await readJsonFile('data/backgrounds.json');
    if (bgJson && bgJson.background) {
      const filtered = bgJson.background.filter(b => sources.includes(b.source));
      const parsed = filtered.map(b => parse5etoolsBackground(b, b.source));
      const deduped = deduplicateByRank(parsed);
      if (deduped.length > 0) {
        await saveRecords('backgrounds', deduped);
        importStats.backgrounds += deduped.length;
      }
    }

    // Races
    showOverlay('Importing 5eTools...', 'Loading races data...');
    const raceJson = await readJsonFile('data/races.json');
    if (raceJson && raceJson.race) {
      const filtered = raceJson.race.filter(r => sources.includes(r.source));
      const parsed = filtered.map(r => parse5etoolsRace(r, r.source));
      const deduped = deduplicateByRank(parsed);
      if (deduped.length > 0) {
        await saveRecords('races', deduped);
        importStats.races += deduped.length;
      }
    }

    // Options
    showOverlay('Importing 5eTools...', 'Loading optional features data...');
    const optJson = await readJsonFile('data/optionalfeatures.json');
    if (optJson && optJson.optionalfeature) {
      const hasEFA = sources.includes('EFA');
      const filtered = optJson.optionalfeature.filter(o => {
        if (!sources.includes(o.source)) return false;
        // Skip Fighting Styles as they are imported under Feats
        if (o.featureType && o.featureType.some(ft => ft === 'FS:F' || ft === 'FS:B' || ft === 'FS:P' || ft === 'FS:R')) {
          return false;
        }
        // Skip TCE Artificer Infusions when EFA is loaded (EFA supersedes TCE Artificer)
        if (hasEFA && o.source.toUpperCase() === 'TCE' && o.featureType && o.featureType.includes('AI')) {
          return false;
        }
        return true;
      });
      const parsed = filtered.map(o => parse5etoolsOption(o, o.source));
      
      // Generate sub-options for "Replicate Magic Item"
      const replicateOptions = [];
      filtered.forEach(o => {
        if (o.name === 'Replicate Magic Item' && o.entries) {
          o.entries.forEach(entry => {
            if (entry.type === 'table' && entry.caption && entry.caption.includes('Replicable Items')) {
              const match = entry.caption.match(/(\d+)(?:st|nd|rd|th)-Level/i);
              const lvl = match ? parseInt(match[1]) : 0;
              if (entry.rows) {
                entry.rows.forEach(row => {
                  if (row && row[0]) {
                    const cleanName = parse5etoolsText(row[0], true);
                    replicateOptions.push({
                      name: `Replicate Magic Item: ${cleanName}`,
                      level: lvl,
                      texts: [`Using this infusion, you replicate a ${cleanName}.`],
                      modifiers: [],
                      classes: ['Artificer Infusion'],
                      source: o.source
                    });
                  }
                });
              }
            }
          });
        }
      });
      parsed.push(...replicateOptions);

      const finalRecords = applyImportOverrides('options', parsed, sources);
      const deduped = deduplicateByRank(finalRecords);
      if (deduped.length > 0) {
        await saveRecords('options', deduped);
        importStats.options += deduped.length;
      }
    }

    // ─── 5. Classes & Subclasses compilation ───
    let classPaths = [];
    if (importSourceType === 'github') {
      classPaths = Object.values(classIndex).map(filename => `data/class/${filename}`);
    } else {
      classPaths = findPathsInDir('data/class/', '.json');
    }

    for (const path of classPaths) {
      if (path.includes('fluff-class')) continue;
      showOverlay('Importing 5eTools...', `Loading class file: ${path.split('/').pop()}...`);
      const json = await readJsonFile(path);
      if (json) {
        if (json.class) allRawClasses.push(...json.class);
        if (json.subclass) allRawSubclasses.push(...json.subclass);
        if (json.classFeature) allRawClassFeatures.push(...json.classFeature);
        if (json.subclassFeature) allRawSubclassFeatures.push(...json.subclassFeature);
      }
    }

    // Deduplicate class/subclasses/features by source rank
    const classHighest = {};
    allRawClasses.forEach(c => {
      if (sources.includes(c.source)) {
        const rank = getSourceRank(c.source);
        if (!classHighest[c.name] || rank > classHighest[c.name].rank) {
          classHighest[c.name] = { rank, value: c };
        }
      }
    });
    const selectedClasses = Object.values(classHighest).map(x => x.value);

    const subclassHighest = {};
    allRawSubclasses.forEach(sub => {
      const keptClass = classHighest[sub.className];
      if (!keptClass) return;

      const subclassClassSource = sub.classSource || sub.source || "PHB";
      if (subclassClassSource !== keptClass.value.source) {
        return;
      }

      if (sources.includes(sub.source)) {
        const key = `${sub.className.toLowerCase()}|${sub.name.toLowerCase()}`;
        const rank = getSourceRank(sub.source);
        if (!subclassHighest[key] || rank > subclassHighest[key].rank) {
          subclassHighest[key] = { rank, value: sub };
        }
      }
    });
    const selectedSubclasses = Object.values(subclassHighest).map(x => x.value);

    const selectedClassFeatures = allRawClassFeatures.filter(f => {
      const keptClass = classHighest[f.className];
      return keptClass && keptClass.value.source === f.source;
    });

    const keptSubMap = new Map();
    selectedSubclasses.forEach(sub => {
      const k1 = `${sub.className.toLowerCase()}|${sub.name.toLowerCase()}`;
      const k2 = `${sub.className.toLowerCase()}|${sub.shortName.toLowerCase()}`;
      keptSubMap.set(k1, sub);
      keptSubMap.set(k2, sub);
    });

    const selectedSubclassFeatures = allRawSubclassFeatures.filter(f => {
      const subKey = `${f.className.toLowerCase()}|${f.subclassShortName.toLowerCase()}`;
      const keptSub = keptSubMap.get(subKey);
      return keptSub && keptSub.source === f.source;
    });

    // Normalization loop
    const normalizedClasses = [];
    const normalizedSubclasses = [];
    const classFeaturesToSave = [];
    const subclassFeaturesToSave = [];

    selectedClasses.forEach(c => {
      const normalized = normalize5etoolsClass(c, selectedSubclasses, selectedClassFeatures, selectedSubclassFeatures, c.source);
      normalizedClasses.push(normalized.classRecord);
      normalizedSubclasses.push(...normalized.subclassRecords);
      classFeaturesToSave.push(...normalized.features);
      subclassFeaturesToSave.push(...normalized.subclassFeatures);
    });

    // Save to DB
    if (normalizedClasses.length > 0) {
      await saveRecords('classes', normalizedClasses);
      importStats.classes += normalizedClasses.length;
    }
    if (normalizedSubclasses.length > 0) {
      await saveRecords('subclasses', normalizedSubclasses);
      importStats.subclasses += normalizedSubclasses.length;
    }
    if (classFeaturesToSave.length > 0) {
      await saveRecords('classFeatures', classFeaturesToSave);
    }
    if (subclassFeaturesToSave.length > 0) {
      await saveRecords('subclassFeatures', subclassFeaturesToSave);
    }

    // Extract Artificer Replicate Magic Item options from class features
    const extractedArtificerOptions = [];
    selectedClassFeatures.forEach(f => {
      if (f.className && f.className.toLowerCase() === 'artificer' && f.entries) {
        const checkEntries = (entries) => {
          if (!entries) return;
          if (Array.isArray(entries)) {
            entries.forEach(e => checkEntries(e));
          } else if (typeof entries === 'object') {
            if (entries.type === 'table') {
              const caption = entries.caption || '';
              if (caption.toLowerCase().includes('replicable items') || caption.toLowerCase().includes('magic item plans') || (f.name && f.name.toLowerCase().includes('replicate magic item'))) {
                const match = caption.match(/(\d+)(?:st|nd|rd|th)-level/i) || caption.match(/Level\s+(\d+)\+?/i);
                const level = match ? parseInt(match[1]) : 0;
                if (entries.rows) {
                  entries.rows.forEach(row => {
                    if (row && row[0]) {
                      const rawCell = typeof row[0] === 'string' ? row[0] : (row[0].value || '');
                      const cleanName = parse5etoolsText(rawCell.toString(), true);
                      if (cleanName && cleanName.toLowerCase() !== 'item' && cleanName.trim().length > 0) {
                        extractedArtificerOptions.push({
                          name: `Replicate Magic Item: ${cleanName}`,
                          level: level,
                          texts: [`Using this infusion, you replicate a ${cleanName}.`],
                          modifiers: [],
                          classes: ['Artificer Infusion'],
                          source: f.source
                        });
                      }
                    }
                  });
                }
              }
            }
            if (entries.entries) {
              checkEntries(entries.entries);
            }
          }
        };
        checkEntries(f.entries);
      }
    });

    if (extractedArtificerOptions.length > 0) {
      const existingOptions = await getAllRecords('options') || [];
      const combined = [...existingOptions, ...extractedArtificerOptions];
      const deduped = deduplicateByRank(combined);
      await saveRecords('options', deduped);
    }

    // ─── 6. Refresh and Finish ───
    await loadAllRecordsCache();
    
    hideOverlay();
    
    const summaryMsg = Object.entries(importStats)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');

    alert(`Import Complete!\n\nImported: ${summaryMsg || '0 records'}`);
    updateDBStatus(`Seeded from 5eTools`);
    
    if (currentCategory === 'settings') {
      renderSettingsPage();
    } else {
      await loadCategory(currentCategory);
    }

    scheduleDebouncedSync();

  } catch (err) {
    console.error(err);
    hideOverlay();
    alert('Import failed: ' + err.message);
  }
}

// Loader state overlay
function showOverlay(title, desc) {
  overlayTitle.textContent = title;
  overlayDesc.textContent = desc;
  loadingOverlay.style.display = 'flex';
}

function hideOverlay() {
  loadingOverlay.style.display = 'none';
}

function updateDBStatus(msg) {
  dbStatus.textContent = msg;
}

// Category Loader
async function loadCategory(category) {
  currentCategory = category;
  selectedFacet1 = (category === 'monsters') ? 'By CR' : 'All';
  selectedFacet2 = 'All';
  searchChits = [];
  renderChits();
  searchInput.value = '';
  selectedItem = null;
  
  // Clear details pane
  resetDetailsPane();
  const appContainer = document.querySelector('.app-container');
  appContainer.classList.remove('has-detail');
  appContainer.setAttribute('data-category', category);
  
  // Remove active highlight from settings button
  btnSettings.classList.remove('active');

  // Handle universal search panel visibility toggles
  const controls = document.getElementById('universal-search-controls');
  if (controls) {
    controls.style.display = 'none';
  }
  facetList1.style.display = 'block';

  if (category === 'search') {
    updatePaneVisibility();
    renderUniversalSearchPanel();
    if (!isNavigatingHistory) {
      if (isFirstLoad) {
        pushCurrentState(true);
        isFirstLoad = false;
      } else {
        pushCurrentState(false);
      }
    }
    return;
  }

  // Load records from DB cache
  if (category === 'favorites') {
    let rawFavorites = allRecordsCache[category];
    if (!rawFavorites) {
      rawFavorites = await getAllRecords(category);
      allRecordsCache[category] = rawFavorites;
    }
    let filtered = rawFavorites.filter(f => !f._deleted);
    if (pickerActive) {
      filtered = filtered.filter(f => {
        if (pickerCategory === 'items') {
          return f.category === 'items';
        } else if (pickerCategory === 'spells') {
          return f.category === 'spells';
        } else if (pickerCategory === 'feats' || pickerCategory === 'options') {
          return f.category === 'feats' || f.category === 'options' || f.category === 'features';
        } else if (pickerCategory === 'monsters') {
          return f.category === 'monsters';
        }
        return false;
      });
    }
    currentRecords = filtered;
  } else if (category === 'characters') {
    let rawCharacters = allRecordsCache[category];
    if (!rawCharacters) {
      rawCharacters = await getAllRecords(category);
      allRecordsCache[category] = rawCharacters;
    }
    currentRecords = rawCharacters.filter(c => !c._deleted);
  } else {
    currentRecords = allRecordsCache[category] || [];
    if (currentRecords.length === 0) {
      currentRecords = await getAllRecords(category);
      allRecordsCache[category] = currentRecords;
    }
  }
  
  // Render search filter dropdowns
  renderFilterDropdowns();

  // Adjust panes columns visibility based on category
  updatePaneVisibility();

  // Update lists
  renderFacet1();
  renderFacet2();
  applyFilters();
  updateAddCustomButtonUI();

  // On mobile, set initial view
  if (hasFacet1()) {
    showMobilePane('facet-1');
  } else {
    showMobilePane('list');
  }

  if (!isNavigatingHistory) {
    if (isFirstLoad) {
      pushCurrentState(true);
      isFirstLoad = false;
    } else {
      pushCurrentState(false);
    }
  }
}

function hasFacet1() {
  return currentCategory !== 'backgrounds' && currentCategory !== 'races' && currentCategory !== 'settings' && currentCategory !== 'characters';
}

function hasFacet2() {
  if (currentCategory === 'monsters') {
    return selectedFacet1 !== 'All';
  }
  if (currentCategory === 'favorites') {
    return selectedFacet1 === 'spells' || selectedFacet1 === 'items' || selectedFacet1 === 'monsters' || selectedFacet1 === 'classes';
  }
  return currentCategory === 'spells' || currentCategory === 'classes';
}

function updatePaneVisibility() {
  paneFacet1.style.display = hasFacet1() ? 'flex' : 'none';
  paneFacet2.style.display = hasFacet2() ? 'flex' : 'none';
  paneList.style.display = (currentCategory === 'settings') ? 'none' : 'flex';
  
  // Hide the search input box container in the list pane when in universal search mode
  const searchContainer = paneList.querySelector('.search-container');
  if (searchContainer) {
    searchContainer.style.display = (currentCategory === 'search') ? 'none' : 'block';
  }
}

function showMobilePane(paneName) {
  currentMobilePane = paneName;
  document.querySelector('.app-container').setAttribute('data-active-pane', paneName);
  const panes = [
    { name: 'facet-1', el: paneFacet1 },
    { name: 'facet-2', el: paneFacet2 },
    { name: 'list', el: paneList },
    { name: 'detail', el: paneDetail }
  ];
  
  panes.forEach(p => {
    if (p.name === paneName) {
      p.el.classList.add('active-pane');
    } else {
      p.el.classList.remove('active-pane');
    }
  });
}

function getPaneDepth(paneName) {
  if (paneName === 'facet-1') return 0;
  if (paneName === 'facet-2') return 1;
  if (paneName === 'list') return 2;
  if (paneName === 'detail') return 3;
  return 0;
}

function getURLFromState(state) {
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.pane) params.set('pane', state.pane);
  if (state.selectedFacet1 && state.selectedFacet1 !== 'All') params.set('facet1', state.selectedFacet1);
  if (state.selectedFacet2 && state.selectedFacet2 !== 'All') params.set('facet2', state.selectedFacet2);
  if (state.selectedItemName) params.set('item', state.selectedItemName);
  const q = params.toString();
  return q ? `?${q}` : window.location.pathname;
}

function pushCurrentState(replace = false) {
  const newPane = currentMobilePane;
  const newCategory = currentCategory;
  
  let shouldReplace = replace;
  
  if (!shouldReplace && lastHistoryState) {
    if (lastHistoryState.category === newCategory) {
      const prevDepth = getPaneDepth(lastHistoryState.pane);
      const newDepth = getPaneDepth(newPane);
      
      if (newDepth <= prevDepth) {
        shouldReplace = true;
      }
    }
  }

  const state = {
    category: newCategory,
    pane: newPane,
    selectedItemName: selectedItem ? selectedItem.name : null,
    selectedFacet1: selectedFacet1,
    selectedFacet2: selectedFacet2
  };
  
  lastHistoryState = state;
  const url = getURLFromState(state);
  
  if (shouldReplace) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
}

async function restoreState(state) {
  if (!state) return;
  
  const appContainer = document.querySelector('.app-container');
  appContainer.setAttribute('data-category', state.category);
  
  if (state.category === 'settings') {
    btnSettings.classList.add('active');
  } else {
    btnSettings.classList.remove('active');
  }
  
  // 1. If category changed, we need to load it (without pushing history!)
  if (currentCategory !== state.category) {
    currentCategory = state.category;
    
    // Update sidebar active highlight
    menuItems.forEach(mi => {
      if (mi.getAttribute('data-category') === state.category) {
        mi.classList.add('active');
      } else {
        mi.classList.remove('active');
      }
    });

    // Clear search chits/inputs if changing away
    searchChits = [];
    renderChits();
    searchInput.value = '';
    
    if (state.category === 'settings') {
      updatePaneVisibility();
      renderSettingsPage();
    } else if (state.category === 'search') {
      updatePaneVisibility();
      renderUniversalSearchPanel();
    } else {
      // Load records
      currentRecords = allRecordsCache[state.category] || [];
      if (currentRecords.length === 0) {
        currentRecords = await getAllRecords(state.category);
        allRecordsCache[state.category] = currentRecords;
      }
      renderFilterDropdowns();
      updatePaneVisibility();
    }
  }

  // 2. Restore facets
  selectedFacet1 = state.selectedFacet1;
  selectedFacet2 = state.selectedFacet2;

  if (state.category !== 'settings' && state.category !== 'search') {
    renderFacet1();
    renderFacet2();
    applyFilters();
  }

  // 3. Restore selected item
  if (state.selectedItemName) {
    // Find the item
    let item = null;
    if (state.category === 'classes') {
      if (state.selectedItemName.endsWith(' Overview')) {
        const className = state.selectedItemName.replace(' Overview', '');
        const cls = currentRecords.find(c => c.name === className);
        if (cls) {
          item = {
            name: `${cls.name} Overview`,
            isOverview: true,
            level: 0,
            classData: cls,
            categoryType: 'class-overview'
          };
        }
      } else {
        for (const cls of currentRecords) {
          if (cls.features) {
            const f = cls.features.find(feat => feat.name === state.selectedItemName);
            if (f) {
              item = {
                ...f,
                className: cls.name,
                categoryType: 'class-feature'
              };
              break;
            }
          }
        }
      }
    } else if (state.category === 'search') {
      for (const store of STORES) {
        if (store === 'classes') {
          const recs = allRecordsCache[store] || [];
          for (const cls of recs) {
            if (`${cls.name} Overview` === state.selectedItemName) {
              item = {
                name: `${cls.name} Overview`,
                isOverview: true,
                level: 0,
                classData: cls,
                categoryType: 'class-overview'
              };
              break;
            }
            if (cls.features) {
              const f = cls.features.find(feat => feat.name === state.selectedItemName);
              if (f) {
                item = {
                  ...f,
                  className: cls.name,
                  categoryType: 'class-feature'
                };
                break;
              }
            }
          }
          if (item) break;
        } else {
          const recs = allRecordsCache[store] || [];
          const found = recs.find(r => r.name === state.selectedItemName || r.originalName === state.selectedItemName);
          if (found) {
            item = { ...found, categoryType: store.substring(0, store.length - 1) };
            break;
          }
        }
      }
    } else {
      const rec = currentRecords.find(r => r.name === state.selectedItemName || r.originalName === state.selectedItemName);
      if (rec) {
        item = { ...rec, categoryType: state.category.substring(0, state.category.length - 1) };
      }
    }

    if (item) {
      selectedItem = item;
      renderDetails(item, item.categoryType);
      document.querySelector('.app-container').classList.add('has-detail');
      
      // Ensure active class on lists
      const listItems = itemList.querySelectorAll('.item-list-item');
      listItems.forEach(li => {
        const titleEl = li.querySelector('.item-title');
        if (titleEl && titleEl.textContent === item.name) {
          li.classList.add('active');
        } else {
          li.classList.remove('active');
        }
      });
    } else {
      selectedItem = null;
      resetDetailsPane();
      document.querySelector('.app-container').classList.remove('has-detail');
    }
  } else if (state.category === 'settings') {
    selectedItem = null;
    document.querySelector('.app-container').classList.add('has-detail');
  } else {
    selectedItem = null;
    resetDetailsPane();
    document.querySelector('.app-container').classList.remove('has-detail');
  }

  // 4. Restore mobile pane
  showMobilePane(state.pane);
}

// Render Drilldown Facet 1 (Class, Category, CR, Type)
function renderFacet1() {
  facetList1.innerHTML = '';
  if (!hasFacet1()) return;
  let facetName = 'Filter';
  let values = [];

  // Extract facet values based on category
  if (currentCategory === 'spells') {
    facetName = 'Class';
    const classes = new Set();
    currentRecords.forEach(s => {
      if (s.classes && Array.isArray(s.classes)) {
        s.classes.forEach(c => classes.add(c));
      }
    });
    values = Array.from(classes).sort();
  } else if (currentCategory === 'classes') {
    facetName = 'Class';
    values = currentRecords.map(c => c.name).sort();
  } else if (currentCategory === 'feats') {
    facetName = 'Category';
    const cats = new Set();
    currentRecords.forEach(f => {
      if (f.category) cats.add(f.category);
    });
    values = Array.from(cats).sort();
  } else if (currentCategory === 'items') {
    facetName = 'Type';
    const types = new Set();
    currentRecords.forEach(i => {
      if (i.type) types.add(i.type);
    });
    values = Array.from(types).sort();
  } else if (currentCategory === 'monsters') {
    facetName = 'Group By';
    values = ['By CR', 'By Type'];
  } else if (currentCategory === 'options') {
    facetName = 'Type';
    const types = new Set();
    currentRecords.forEach(o => {
      if (o.classes && Array.isArray(o.classes)) {
        o.classes.forEach(c => types.add(c));
      }
    });
    values = Array.from(types).sort();
  } else if (currentCategory === 'favorites') {
    facetName = 'Category';
    const cats = new Set();
    currentRecords.forEach(f => {
      if (f.category) cats.add(f.category);
    });
    values = Array.from(cats).sort();
  }

  facetTitle1.textContent = facetName;

  // Add "All" option
  if (currentCategory !== 'monsters') {
    const allCount = currentRecords.length;
    appendFacetItem(facetList1, 'All', 'All', allCount, selectedFacet1 === 'All', (val) => {
      selectedFacet1 = val;
      selectedFacet2 = 'All'; // Reset facet 2
      renderFacet1();
      renderFacet2();
      applyFilters();
      if (hasFacet2()) showMobilePane('facet-2');
      else showMobilePane('list');
      if (!isNavigatingHistory) pushCurrentState(false);
    });
  }

  // Add dynamic values
  values.forEach(val => {
    let count = 0;
    let displayVal = val;
    if (currentCategory === 'spells') {
      count = currentRecords.filter(s => s.classes && s.classes.includes(val)).length;
    } else if (currentCategory === 'classes') {
      const record = currentRecords.find(c => c.name === val);
      count = record && record.features ? record.features.length : 0;
    } else if (currentCategory === 'feats') {
      count = currentRecords.filter(f => f.category === val).length;
    } else if (currentCategory === 'items') {
      count = currentRecords.filter(i => i.type === val).length;
    } else if (currentCategory === 'monsters') {
      count = currentRecords.length;
    } else if (currentCategory === 'options') {
      count = currentRecords.filter(o => o.classes && o.classes.includes(val)).length;
    } else if (currentCategory === 'favorites') {
      count = currentRecords.filter(f => f.category === val).length;
      displayVal = FAVORITES_GROUP_NAMES[val] || (val.charAt(0).toUpperCase() + val.slice(1));
    }

    appendFacetItem(facetList1, val, displayVal, count, selectedFacet1 === val, (clickedVal) => {
      selectedFacet1 = clickedVal;
      selectedFacet2 = 'All'; // Reset facet 2
      renderFacet1();
      renderFacet2();
      applyFilters();
      if (hasFacet2()) showMobilePane('facet-2');
      else showMobilePane('list');
      if (!isNavigatingHistory) pushCurrentState(false);
    });
  });
}

// Render Drilldown Facet 2 (Level, Section/Subclass, Type)
function renderFacet2() {
  facetList2.innerHTML = '';
  if (!hasFacet2()) return;
  let facetName = 'Filter';
  let values = [];

  // Filter records by Facet 1 selection to calculate counts for Facet 2
  let recordsFacet1 = currentRecords;
  if (selectedFacet1 !== 'All') {
    if (currentCategory === 'spells') {
      recordsFacet1 = currentRecords.filter(s => s.classes && s.classes.includes(selectedFacet1));
    } else if (currentCategory === 'classes') {
      recordsFacet1 = currentRecords.filter(c => c.name === selectedFacet1);
    } else if (currentCategory === 'monsters') {
      recordsFacet1 = currentRecords;
    } else if (currentCategory === 'favorites') {
      recordsFacet1 = currentRecords.filter(f => f.category === selectedFacet1);
    }
  }

  if (currentCategory === 'spells') {
    facetName = 'Level';
    const levels = new Set();
    recordsFacet1.forEach(s => {
      if (s.level !== undefined && s.level !== null) levels.add(s.level);
    });
    values = Array.from(levels).sort((a, b) => a - b);
  } else if (currentCategory === 'classes') {
    facetName = 'Section';
    const sections = new Set();
    sections.add('Generic Features');
    recordsFacet1.forEach(c => {
      if (c.subclasses) c.subclasses.forEach(s => sections.add(s));
    });
    values = Array.from(sections).sort();
  } else if (currentCategory === 'monsters') {
    if (selectedFacet1 === 'By CR') {
      facetName = 'CR Range';
      values = ['< 1', '1', '2 - 5', '6 - 10', '11 - 16', '17 - 20', '21+'];
    } else {
      facetName = 'Type';
      const types = new Set();
      recordsFacet1.forEach(m => { if (m.type) types.add(m.type.toLowerCase()); });
      values = Array.from(types).sort();
    }
  } else if (currentCategory === 'favorites') {
    if (selectedFacet1 === 'spells') {
      facetName = 'Level';
      const levels = new Set();
      recordsFacet1.forEach(fav => {
        const item = resolveFavoriteItem(fav);
        if (item && item.level !== undefined) levels.add(item.level);
      });
      values = Array.from(levels).sort((a, b) => a - b);
    } else if (selectedFacet1 === 'items') {
      facetName = 'Type';
      const types = new Set();
      recordsFacet1.forEach(fav => {
        const item = resolveFavoriteItem(fav);
        if (item && item.type) types.add(item.type);
      });
      values = Array.from(types).sort();
    } else if (selectedFacet1 === 'monsters') {
      facetName = 'CR';
      const crs = new Set();
      recordsFacet1.forEach(fav => {
        const item = resolveFavoriteItem(fav);
        if (item && item.cr !== undefined) crs.add(item.cr.toString());
      });
      values = Array.from(crs).sort((a, b) => {
        const parseCR = (cr) => {
          if (cr && typeof cr === 'string' && cr.includes('/')) {
            const parts = cr.split('/');
            return parseFloat(parts[0]) / parseFloat(parts[1]);
          }
          return parseFloat(cr) || 0;
        };
        return parseCR(a) - parseCR(b);
      });
    } else if (selectedFacet1 === 'classes') {
      facetName = 'Class';
      const classes = new Set();
      recordsFacet1.forEach(fav => {
        if (fav.className) classes.add(fav.className);
        else if (fav.itemName) classes.add(fav.itemName);
      });
      values = Array.from(classes).sort();
    }
  }

  facetTitle2.textContent = facetName;

  // Add "All" option
  appendFacetItem(facetList2, 'All', 'All', recordsFacet1.length, selectedFacet2 === 'All', (val) => {
    selectedFacet2 = val;
    renderFacet2();
    applyFilters();
    showMobilePane('list');
    if (!isNavigatingHistory) pushCurrentState(false);
  });

  // Add dynamic values
  values.forEach(val => {
    let count = 0;
    let label = val;

    if (currentCategory === 'spells') {
      count = recordsFacet1.filter(s => s.level === val).length;
      label = val === 0 ? 'Cantrip' : `Level ${val}`;
    } else if (currentCategory === 'classes') {
      if (val === 'Generic Features') {
        if (selectedFacet1 === 'All') {
          count = recordsFacet1.reduce((sum, c) => sum + (c.features ? c.features.filter(f => !f.subclass).length : 0), 0);
        } else if (recordsFacet1.length > 0) {
          count = recordsFacet1[0].features ? recordsFacet1[0].features.filter(f => !f.subclass).length : 0;
        }
      } else {
        if (selectedFacet1 === 'All') {
          count = recordsFacet1.reduce((sum, c) => sum + (c.features ? c.features.filter(f => f.subclass === val).length : 0), 0);
        } else if (recordsFacet1.length > 0) {
          count = recordsFacet1[0].features ? recordsFacet1[0].features.filter(f => f.subclass === val).length : 0;
        }
      }
    } else if (currentCategory === 'monsters') {
      if (selectedFacet1 === 'By CR') {
        const parseCR = (crVal) => {
          if (crVal && typeof crVal === 'string' && crVal.includes('/')) {
            const parts = crVal.split('/');
            return parseFloat(parts[0]) / parseFloat(parts[1]);
          }
          return parseFloat(crVal) || 0;
        };
        const matchCRRange = (crVal, range) => {
          const v = parseCR(crVal);
          if (range === '< 1') return v < 1;
          if (range === '1') return v === 1;
          if (range === '2 - 5') return v >= 2 && v <= 5;
          if (range === '6 - 10') return v >= 6 && v <= 10;
          if (range === '11 - 16') return v >= 11 && v <= 16;
          if (range === '17 - 20') return v >= 17 && v <= 20;
          if (range === '21+') return v >= 21;
          return true;
        };
        count = recordsFacet1.filter(m => m.cr !== undefined && m.cr !== null && matchCRRange(m.cr, val)).length;
        label = `CR ${val}`;
      } else {
        count = recordsFacet1.filter(m => m.type && m.type.toLowerCase() === val.toLowerCase()).length;
        label = val.charAt(0).toUpperCase() + val.slice(1);
      }
    } else if (currentCategory === 'favorites') {
      if (selectedFacet1 === 'spells') {
        count = recordsFacet1.filter(fav => {
          const item = resolveFavoriteItem(fav);
          return item && item.level === val;
        }).length;
        label = val === 0 ? 'Cantrip' : `Level ${val}`;
      } else if (selectedFacet1 === 'items') {
        count = recordsFacet1.filter(fav => {
          const item = resolveFavoriteItem(fav);
          return item && item.type === val;
        }).length;
        label = val;
      } else if (selectedFacet1 === 'monsters') {
        count = recordsFacet1.filter(fav => {
          const item = resolveFavoriteItem(fav);
          return item && item.cr !== undefined && item.cr.toString() === val;
        }).length;
        label = `CR ${val}`;
      } else if (selectedFacet1 === 'classes') {
        count = recordsFacet1.filter(fav => {
          return fav.className === val || fav.itemName === val;
        }).length;
        label = val;
      }
    }

    appendFacetItem(facetList2, val, label, count, selectedFacet2 === val, (clickedVal) => {
      selectedFacet2 = clickedVal;
      renderFacet2();
      applyFilters();
      showMobilePane('list');
      if (!isNavigatingHistory) pushCurrentState(false);
    });
  });
}

function appendFacetItem(parent, value, label, count, isActive, onClick) {
  const li = document.createElement('li');
  li.className = `facet-item ${isActive ? 'active' : ''}`;
  
  const btn = document.createElement('button');
  btn.innerHTML = `<span>${label}</span> <span class="facet-count">${count}</span>`;
  btn.addEventListener('click', () => onClick(value));
  
  li.appendChild(btn);
  parent.appendChild(li);
}

// Render dynamic dropdown search helper controls
function renderFilterDropdowns() {
  filterDropdownContainer.innerHTML = '';
}

function renderChits() {
  const wrapper = document.getElementById('search-wrapper');
  if (wrapper) {
    const oldChits = wrapper.querySelectorAll('.search-chit');
    oldChits.forEach(c => c.remove());
  }
}

// Global Filtering and Score-based Search Sorting Engine
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  
  // Category Browsing Mode
  updatePaneVisibility();

  if (currentCategory === 'characters') {
    const filteredChars = currentRecords.filter(c => c.name.toLowerCase().includes(query));
    renderCharactersRoster(filteredChars);
    return;
  }

  // Filter current category's records
  const filteredRecords = currentRecords.filter(record => {
    // Drilldown Facet 1
    if (selectedFacet1 !== 'All') {
      if (currentCategory === 'spells') {
        if (!record.classes || !record.classes.includes(selectedFacet1)) return false;
      } else if (currentCategory === 'classes') {
        if (record.name !== selectedFacet1) return false;
      } else if (currentCategory === 'feats') {
        if (record.category !== selectedFacet1) return false;
      } else if (currentCategory === 'items') {
        if (record.type !== selectedFacet1) return false;
      } else if (currentCategory === 'monsters') {
        // Grouping choice, no filter on Facet 1
      } else if (currentCategory === 'options') {
        if (!record.classes || !record.classes.includes(selectedFacet1)) return false;
      } else if (currentCategory === 'favorites') {
        if (record.category !== selectedFacet1) return false;
      }
    }

    // Drilldown Facet 2
    if (selectedFacet2 !== 'All') {
      if (currentCategory === 'spells') {
        if (record.level !== parseInt(selectedFacet2)) return false;
      } else if (currentCategory === 'classes') {
        // Sections are flattened later
      } else if (currentCategory === 'monsters') {
        if (selectedFacet1 === 'By CR') {
          const parseCR = (crVal) => {
            if (crVal && typeof crVal === 'string' && crVal.includes('/')) {
              const parts = crVal.split('/');
              return parseFloat(parts[0]) / parseFloat(parts[1]);
            }
            return parseFloat(crVal) || 0;
          };
          const matchCRRange = (crVal, range) => {
            const v = parseCR(crVal);
            if (range === '< 1') return v < 1;
            if (range === '1') return v === 1;
            if (range === '2 - 5') return v >= 2 && v <= 5;
            if (range === '6 - 10') return v >= 6 && v <= 10;
            if (range === '11 - 16') return v >= 11 && v <= 16;
            if (range === '17 - 20') return v >= 17 && v <= 20;
            if (range === '21+') return v >= 21;
            return true;
          };
          if (record.cr === undefined || record.cr === null || !matchCRRange(record.cr, selectedFacet2)) return false;
        } else {
          if (!record.type || record.type.toLowerCase() !== selectedFacet2.toLowerCase()) return false;
        }
      } else if (currentCategory === 'favorites') {
        if (selectedFacet1 === 'spells') {
          const item = resolveFavoriteItem(record);
          if (!item || item.level !== parseInt(selectedFacet2)) return false;
        } else if (selectedFacet1 === 'items') {
          const item = resolveFavoriteItem(record);
          if (!item || item.type !== selectedFacet2) return false;
        } else if (selectedFacet1 === 'monsters') {
          const item = resolveFavoriteItem(record);
          if (!item || item.cr === undefined || item.cr.toString() !== selectedFacet2) return false;
        } else if (selectedFacet1 === 'classes') {
          if (record.className !== selectedFacet2 && record.itemName !== selectedFacet2) return false;
        }
      }
    }



    return true;
  });

  let itemsToRender = [];
  if (currentCategory === 'classes') {
    filteredRecords.forEach(cls => {
      // Always include Class Overview in the list
      itemsToRender.push({
        name: `${cls.name} Overview`,
        isOverview: true,
        level: 0,
        classData: cls,
        categoryType: 'class-overview'
      });
      if (cls.features) {
        cls.features.forEach(feat => {
          if (selectedFacet2 !== 'All') {
            if (selectedFacet2 === 'Generic Features' && feat.subclass) return;
            if (selectedFacet2 !== 'Generic Features' && feat.subclass !== selectedFacet2) return;
          }
          itemsToRender.push({
            ...feat,
            className: cls.name,
            categoryType: 'class-feature'
          });
        });
      }
    });
  } else if (currentCategory === 'favorites') {
    filteredRecords.forEach(fav => {
      const fullItem = resolveFavoriteItem(fav);
      if (fullItem) {
        itemsToRender.push(fullItem);
      }
    });
  } else {
    itemsToRender = filteredRecords.map(r => ({
      ...r,
      categoryType: currentCategory.substring(0, currentCategory.length - 1)
    }));
  }

  // Filter itemsToRender by local text query if present
  if (query) {
    itemsToRender = itemsToRender.filter(item => {
      const name = item.name.toLowerCase();
      if (name.includes(query)) return true;

      // Check text/descriptions
      let descText = '';
      if (item.texts) descText += item.texts.join(' ');
      if (item.description) descText += ' ' + item.description;
      if (item.detail) descText += ' ' + item.detail;
      if (item.traits) descText += ' ' + item.traits.map(t => t.name + ' ' + t.texts.join(' ')).join(' ');
      if (item.actions) descText += ' ' + item.actions.map(a => a.name + ' ' + a.texts.join(' ')).join(' ');
      if (item.classData) {
        const cd = item.classData;
        descText += ' ' + (cd.proficiency || '') + ' ' + (cd.armor || '') + ' ' + (cd.weapons || '');
      }
      
      return descText.toLowerCase().includes(query);
    });
  }

  // Default Sorting
  if (currentCategory === 'spells') {
    itemsToRender.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
  } else if (currentCategory === 'classes') {
    itemsToRender.sort((a, b) => {
      if (a.isOverview && !b.isOverview) return -1;
      if (!a.isOverview && b.isOverview) return 1;
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
  } else {
    itemsToRender.sort((a, b) => a.name.localeCompare(b.name));
  }

  renderList(itemsToRender, false);}




// Get human-readable rarity label from an item's detail field
function getItemRarity(item) {
  if (!item.detail) return item.magic ? 'Magic' : '';
  const d = item.detail.toLowerCase();
  if (d.includes('very rare')) return 'Very Rare';
  if (d.includes('uncommon')) return 'Uncommon';
  if (d.includes('legendary') && !d.includes('artifact')) return 'Legendary';
  if (d.includes('artifact')) return 'Artifact';
  if (d.includes('rare')) return 'Rare';
  if (d.includes('common')) return 'Common';
  return item.magic ? 'Magic' : '';
}

// Render the search results list
function renderList(items, isGlobalSearch = false) {
  itemList.innerHTML = '';
  let displayCategory = currentCategory;
  if (currentCategory === 'items') displayCategory = 'Equipment';
  else if (currentCategory === 'monsters') displayCategory = 'Bestiary';
  else if (currentCategory === 'favorites') displayCategory = 'Bookmarks';
  else displayCategory = displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1);

  listTitle.textContent = isGlobalSearch ? `Search Results (${items.length})` : `${displayCategory} (${items.length})`;

  if (items.length === 0) {
    itemList.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted)">No entries match your filters.</li>';
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = `item-list-item ${selectedItem && selectedItem.name === item.name ? 'active' : ''}`;
    
    const btn = document.createElement('button');
    
    let metaText = '';
    const type = item.categoryType;

    if (isGlobalSearch) {
      let displayType = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (displayType === 'Item') displayType = 'Equipment';
      if (displayType === 'Monster') displayType = 'Bestiary';
      metaText = `[${displayType}] `;
    }

    if (type === 'spell') {
      metaText += `${item.level === 0 ? 'Cantrip' : 'Level ' + item.level} • ${item.school}`;
    } else if (type === 'item') {
      const rarity = getItemRarity(item);
      metaText += `${item.type || 'Item'}${rarity ? ' • ' + rarity : ''}`;
    } else if (type === 'monster') {
      metaText += `CR ${item.cr || '0'} • ${item.type || 'Monster'} • ${item.size || 'M'}`;
    } else if (type === 'option') {
      metaText += `${item.classes ? item.classes.join(', ') : 'Option'}`;
    } else if (type === 'class-overview') {
      const cls = item.classData || item;
      metaText += `${cls.hd ? 'Hit Die d' + cls.hd : 'Overview'}`;
    } else if (type === 'class-feature') {
      metaText += `${item.className} Level ${item.level} ${item.subclass ? '• ' + item.subclass : ''}`;
    } else if (type === 'feat') {
      metaText += `${item.category || 'Feat'}`;
    } else if (type === 'race') {
      metaText += `${item.size || 'Medium'} • Speed ${item.speed || 30} ft.`;
    } else if (type === 'background') {
      metaText += `Background`;
    }

    btn.innerHTML = `<span class="item-title">${item.name}</span><span class="item-meta">${metaText}</span>`;
    btn.addEventListener('click', () => {
      const siblings = itemList.querySelectorAll('.item-list-item');
      siblings.forEach(s => s.classList.remove('active'));
      li.classList.add('active');
      
      selectItem(item);
    });

    li.appendChild(btn);
    itemList.appendChild(li);
  });
}

// Select and show details for an entry
function selectItem(item) {
  selectedItem = item;
  renderDetails(item, item.categoryType);
  updateFavoriteButtonUI();
  document.querySelector('.app-container').classList.add('has-detail');
  showMobilePane('detail');
  if (!isNavigatingHistory) pushCurrentState(false);
}

function resetDetailsPane() {
  selectedItem = null;
  updateFavoriteButtonUI();
  
  const isDbEmpty = !allRecordsCache['spells'] || allRecordsCache['spells'].length === 0;
  if (isDbEmpty) {
    detailPaneContent.innerHTML = `
      <div class="detail-view-container">
        <div style="text-align: center; margin-top: 80px; color: var(--text-muted); max-width: 450px; margin-left: auto; margin-right: auto; padding: 20px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; color: var(--accent-color);"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <h2 style="font-family: var(--font-header); color: var(--text-primary); margin-bottom: 8px;">Compendium is Empty</h2>
          <p style="margin-bottom: 24px; font-size: 14px; line-height: 1.5;">Welcome to the offline D&D compendium. To get started, load 5eTools sources directly from GitHub, or select a local data folder.</p>
          <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
            <button class="settings-action-btn" id="welcome-import-github-btn" style="width: auto; padding: 10px 24px; border-radius: 6px; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
              Load from GitHub (Recommended)
            </button>
            <button class="settings-action-btn secondary-btn" id="welcome-import-local-btn" style="width: auto; padding: 10px 24px; border-radius: 6px; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
              Select Local Folder
            </button>
          </div>
        </div>
      </div>
    `;
    const welcomeGithubBtn = document.getElementById('welcome-import-github-btn');
    if (welcomeGithubBtn) {
      welcomeGithubBtn.addEventListener('click', handle5eToolsGitHubImport);
    }
    const welcomeLocalBtn = document.getElementById('welcome-import-local-btn');
    if (welcomeLocalBtn) {
      welcomeLocalBtn.addEventListener('click', async () => {
        importSourceType = 'local';
        if (window.showDirectoryPicker) {
          try {
            const dirHandle = await window.showDirectoryPicker();
            await handleDirectoryHandleSelect(dirHandle);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error(err);
              alert('Failed to open directory: ' + err.message);
            }
          }
        } else {
          dirInput.click();
        }
      });
    }
  } else {
    detailPaneContent.innerHTML = `
      <div class="detail-view-container">
        <div style="text-align: center; margin-top: 80px; color: var(--text-muted)">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <p>Select an entry from the list to view its details.</p>
        </div>
      </div>
    `;
  }
  updateDetailFooterUI();
}

// Markdown parser helpers
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseInlineMarkdown(text) {
  if (!text) return '';
  let res = text.replace(/\t/g, '    ');
  res = escapeHtml(res);

  // Bold: **text** or __text__
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  res = res.replace(/_(.*?)_/g, '<em>$1</em>');

  // Inline code: `code`
  res = res.replace(/`(.*?)`/g, '<code>$1</code>');

  // Markdown links: [label](url)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const isRelative = url.startsWith('?') || url.startsWith('/') || !url.includes('://');
    if (isRelative) {
      return `<a href="${url}">${label}</a>`;
    } else {
      return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
    }
  });

  return res;
}

function preprocessCustomTables(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const processedLines = [];
  let inCodeBlock = false;
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      i++;
      continue;
    }

    if (inCodeBlock) {
      processedLines.push(line);
      i++;
      continue;
    }

    const isCustomTableRow = (l) => {
      const trimmed = l.trim();
      return trimmed.includes('|') && !(trimmed.startsWith('|') && trimmed.endsWith('|'));
    };

    if (isCustomTableRow(line)) {
      const tableLines = [];
      while (i < lines.length) {
        let currentLine = lines[i];
        if (currentLine.trim() === '') {
          let lookAhead = i + 1;
          while (lookAhead < lines.length && lines[lookAhead].trim() === '') {
            lookAhead++;
          }
          if (lookAhead < lines.length && isCustomTableRow(lines[lookAhead])) {
            i = lookAhead;
            currentLine = lines[i];
          } else {
            break;
          }
        }

        if (isCustomTableRow(currentLine)) {
          tableLines.push(currentLine);
          i++;
        } else {
          break;
        }
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0];
        const headerCells = headerRow.split('|').map(c => c.trim());
        const numCols = headerCells.length;

        processedLines.push('| ' + headerCells.join(' | ') + ' |');
        
        const separator = Array(numCols).fill('---').join(' | ');
        processedLines.push('| ' + separator + ' |');

        for (let k = 1; k < tableLines.length; k++) {
          const rowCells = tableLines[k].split('|').map(c => c.trim());
          while (rowCells.length < numCols) rowCells.push('');
          if (rowCells.length > numCols) rowCells.length = numCols;
          processedLines.push('| ' + rowCells.join(' | ') + ' |');
        }
      } else {
        for (const tl of tableLines) {
          processedLines.push(tl);
        }
      }
    } else {
      processedLines.push(line);
      i++;
    }
  }

  return processedLines.join('\n');
}

function parseMarkdown(text) {
  if (!text) return '';
  
  // Convert custom tables (e.g. "Cleric Level | Spells") to standard markdown tables
  text = preprocessCustomTables(text);

  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = ''; // 'ul' or 'ol'
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeBlockContent = [];
  let inTable = false;
  let tableRows = [];

  const flushList = () => {
    if (inList) {
      html += `</${listType}>`;
      inList = false;
      listType = '';
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      html += '</blockquote>';
      inBlockquote = false;
    }
  };

  const flushTable = () => {
    if (inTable) {
      html += '<table class="markdown-table">';
      if (tableRows.length > 0) {
        const hasDelimiter = tableRows.length > 1 && tableRows[1].every(cell => /^:?-+:?$/.test(cell));
        let startIndex = 0;
        
        if (hasDelimiter) {
          html += '<thead><tr>';
          tableRows[0].forEach(cell => {
            html += `<th>${parseInlineMarkdown(cell)}</th>`;
          });
          html += '</tr></thead>';
          startIndex = 2;
        }
        
        html += '<tbody>';
        for (let i = startIndex; i < tableRows.length; i++) {
          html += '<tr>';
          tableRows[i].forEach(cell => {
            html += `<td>${parseInlineMarkdown(cell)}</td>`;
          });
          html += '</tr>';
        }
        html += '</tbody>';
      }
      html += '</table>';
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code Block
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`;
        inCodeBlock = false;
        codeBlockContent = [];
      } else {
        flushList();
        flushBlockquote();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Horizontal Rule
    if (/^(?:---|\*\*\*|___)$/.test(line.trim())) {
      flushList();
      flushBlockquote();
      flushTable();
      html += '<hr>';
      continue;
    }

    // Table
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
    if (isTableRow) {
      flushList();
      flushBlockquote();
      inTable = true;
      const cells = line.split('|').map(c => c.trim()).slice(1, -1);
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      flushList();
      if (!inBlockquote) {
        html += '<blockquote>';
        inBlockquote = true;
      }
      line = line.trim().substring(1).trim();
    } else {
      flushBlockquote();
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const content = headingMatch[2].trim();
      html += `<h${level}>${parseInlineMarkdown(content)}</h${level}>`;
      continue;
    }

    // Unordered List
    const ulMatch = line.match(/^([*\-•])\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        flushList();
        html += '<ul class="markdown-ul">';
        inList = true;
        listType = 'ul';
      }
      const content = ulMatch[2].trim();
      html += `<li>${parseInlineMarkdown(content)}</li>`;
      continue;
    }

    // Ordered List
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        html += '<ol class="markdown-ol">';
        inList = true;
        listType = 'ol';
      }
      const content = olMatch[2].trim();
      html += `<li>${parseInlineMarkdown(content)}</li>`;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Paragraph
    flushList();
    html += `<p>${parseInlineMarkdown(line)}</p>`;
  }

  flushList();
  flushBlockquote();
  flushTable();

  return html;
}

// Get HTML for detailed view of an entry
function getDetailHTML(item, category = currentCategory) {
  if (item.isOverview || item.categoryType === 'class-overview' || category === 'class-overview') {
    category = 'class-overview';
  }
  let html = '';

  const formatText = (texts) => {
    if (!texts || texts.length === 0) return '';
    return parseMarkdown(texts.join('\n'));
  };

  const getAbilityMod = (score) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  if (category === 'spells' || category === 'spell') {
    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">${item.level === 0 ? 'Cantrip' : 'Level ' + item.level} Spell ${item.ritual ? '(Ritual)' : ''}</div>
          <h1>${item.name}</h1>
          <div style="font-style: italic; color: var(--accent-color); font-family: var(--font-header)">${item.school} School</div>
        </header>
        <div class="detail-meta-box">
          <div class="meta-entry">
            <span class="meta-label">Casting Time</span>
            <span class="meta-value">${item.time || '—'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Range</span>
            <span class="meta-value">${item.range || '—'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Components</span>
            <span class="meta-value">${item.components || '—'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Duration</span>
            <span class="meta-value">${item.duration || '—'}</span>
          </div>
        </div>
        <div class="detail-body">
          ${formatText(item.texts)}
          ${item.classes && item.classes.length > 0 ? `
            <div style="margin-top: 30px; border-top: 1px solid var(--border-color); padding-top: 16px;">
              <strong>Spell Lists:</strong> <span style="color: var(--accent-color)">${item.classes.join(', ')}</span>
            </div>
          ` : ''}
          ${item.source ? `
            <div style="margin-top: 10px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (category === 'items' || category === 'item') {
    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">${item.type}${(() => { const r = getItemRarity(item); return r ? ' • ' + r : ''; })()}</div>
          <h1>${item.name}</h1>
          ${item.detail ? `<div style="font-style: italic; color: var(--text-secondary)">${parseInlineMarkdown(item.detail)}</div>` : ''}
        </header>
        <div class="detail-meta-box">
          <div class="meta-entry">
            <span class="meta-label">Value</span>
            <span class="meta-value">${item.value ? item.value + ' gp' : '—'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Weight</span>
            <span class="meta-value">${item.weight ? item.weight + ' lbs.' : '—'}</span>
          </div>
          ${item.ac ? `
            <div class="meta-entry">
              <span class="meta-label">AC Benefit</span>
              <span class="meta-value">+${item.ac}</span>
            </div>
          ` : ''}
          ${item.dmg1 ? `
            <div class="meta-entry">
              <span class="meta-label">Damage</span>
              <span class="meta-value">${item.dmg1} ${item.dmgType} ${item.dmg2 ? '/ ' + item.dmg2 : ''}</span>
            </div>
          ` : ''}
        </div>
        <div class="detail-body">
          ${formatText(item.texts)}
          ${item.property ? `<p style="margin-top: 20px;"><strong>Properties:</strong> ${item.property}</p>` : ''}
          ${item.modifiers && item.modifiers.length > 0 ? `
            <div style="margin-top: 20px; padding: 12px; background-color: var(--panel-bg); border-radius: 6px;">
              <strong>Passive Modifiers:</strong>
              <ul style="margin-top: 8px; list-style-type: square; padding-left: 20px;">
                ${item.modifiers.map(m => `<li>${m.category}: ${m.value}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${item.source ? `
            <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (category === 'monsters' || category === 'monster') {
    const renderMonsterTraits = (title, list) => {
      if (!list || list.length === 0) return '';
      return `
        <div class="stat-section">
          <h3>${title}</h3>
          ${list.map(t => `
            <div class="trait-item">
              <span class="trait-title">${t.name} ${t.recharge ? `(${t.recharge})` : ''}.</span>
              <div class="trait-content">${parseMarkdown((t.texts || []).join('\n'))}</div>
            </div>
          `).join('')}
        </div>
      `;
    };

    html = `
      <div class="detail-view-container">
        <div class="stat-block">
          <header style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 12px;">
            <h1 style="font-size: 24px; color: var(--accent-color); margin-bottom: 4px;">${item.name}</h1>
            <div style="font-size: 13px; font-style: italic; color: var(--text-secondary)">${item.size} ${item.type}, ${item.alignment}</div>
          </header>

          <div style="margin-bottom: 12px;">
            <div><strong>Armor Class</strong> ${item.ac || '10'}</div>
            <div><strong>Hit Points</strong> ${item.hp || '1'}</div>
            <div><strong>Speed</strong> ${item.speed || '30 ft.'}</div>
          </div>

          <div class="stat-grid">
            <div class="stat-box">
              <span class="stat-name">STR</span>
              <span class="stat-val">${item.str}</span>
              <span class="stat-mod">(${getAbilityMod(item.str)})</span>
            </div>
            <div class="stat-box">
              <span class="stat-name">DEX</span>
              <span class="stat-val">${item.dex}</span>
              <span class="stat-mod">(${getAbilityMod(item.dex)})</span>
            </div>
            <div class="stat-box">
              <span class="stat-name">CON</span>
              <span class="stat-val">${item.con}</span>
              <span class="stat-mod">(${getAbilityMod(item.con)})</span>
            </div>
            <div class="stat-box">
              <span class="stat-name">INT</span>
              <span class="stat-val">${item.int}</span>
              <span class="stat-mod">(${getAbilityMod(item.int)})</span>
            </div>
            <div class="stat-box">
              <span class="stat-name">WIS</span>
              <span class="stat-val">${item.wis}</span>
              <span class="stat-mod">(${getAbilityMod(item.wis)})</span>
            </div>
            <div class="stat-box">
              <span class="stat-name">CHA</span>
              <span class="stat-val">${item.cha}</span>
              <span class="stat-mod">(${getAbilityMod(item.cha)})</span>
            </div>
          </div>

          <div style="margin-bottom: 16px; font-size: 14px;">
            ${item.save ? `<div><strong>Saving Throws</strong> ${item.save}</div>` : ''}
            ${item.skill ? `<div><strong>Skills</strong> ${item.skill}</div>` : ''}
            ${item.vulnerable ? `<div><strong>Vulnerabilities</strong> ${item.vulnerable}</div>` : ''}
            ${item.resist ? `<div><strong>Damage Resistances</strong> ${item.resist}</div>` : ''}
            ${item.immune ? `<div><strong>Damage Immunities</strong> ${item.immune}</div>` : ''}
            ${item.conditionImmune ? `<div><strong>Condition Immunities</strong> ${item.conditionImmune}</div>` : ''}
            <div><strong>Senses</strong> ${item.senses ? item.senses + ', ' : ''} Passive Perception ${item.passive}</div>
            <div><strong>Languages</strong> ${item.languages || '—'}</div>
            <div><strong>Challenge</strong> ${item.cr}</div>
          </div>

          ${renderMonsterTraits('Traits', item.traits)}
          ${renderMonsterTraits('Actions', item.actions)}
          ${renderMonsterTraits('Reactions', item.reactions)}
          ${renderMonsterTraits('Legendary Actions', item.legendary)}

          ${item.spells ? `
            <div class="stat-section">
              <h3>Spells</h3>
              <div class="trait-content">${parseMarkdown(item.spells)}</div>
            </div>
          ` : ''}

          ${item.description ? `
            <div class="stat-section" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 20px;">
              <div style="font-style: italic; color: var(--text-secondary)">${parseMarkdown(item.description)}</div>
            </div>
          ` : ''}
          ${item.source ? `
            <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (category === 'classes' || category === 'class' || category === 'class-overview' || category === 'class-feature') {
    if (item.isOverview || category === 'class-overview') {
      const cls = item.classData || item;
      
      const getProfBonus = (level) => {
        if (level <= 4) return '+2';
        if (level <= 8) return '+3';
        if (level <= 12) return '+4';
        if (level <= 16) return '+5';
        return '+6';
      };

      const levelFeatures = {};
      if (cls.features) {
        cls.features.forEach(f => {
          if (!levelFeatures[f.level]) levelFeatures[f.level] = [];
          levelFeatures[f.level].push(f.name);
        });
      } else if (cls.autolevels) {
        cls.autolevels.forEach(al => {
          if (!levelFeatures[al.level]) levelFeatures[al.level] = [];
          if (al.features) {
            al.features.forEach(f => {
              levelFeatures[al.level].push(f.name);
            });
          }
        });
      }

      // Identify custom columns from classTableGroups (excluding spell slots groups)
      const customCols = [];
      const customGroups = (cls.classTableGroups || []).filter(g => !g.title?.includes('Spell Slots') && !g.rowsSpellProgression);
      customGroups.forEach(g => {
        if (g.colLabels && g.rows) {
          g.colLabels.forEach((label, idx) => {
            const cleanLabel = label.replace(/\{@[^}]+ ([^|}]+)(?:\|[^}]+)?\}/gi, '$1').trim();
            const colRows = g.rows.map(row => row[idx]);
            customCols.push({ label: cleanLabel, rows: colRows });
          });
        }
      });

      // Split spell slots into individual columns if caster
      let maxSpellLvl = 0;
      const spellSlotsByLevel = [];
      for (let lvl = 1; lvl <= 20; lvl++) {
        const slotsRow = cls.slotsTable ? cls.slotsTable.find(st => st.level === lvl) : null;
        const slots = slotsRow && slotsRow.slots ? slotsRow.slots.split(',').map(Number) : [];
        spellSlotsByLevel.push(slots);
        if (slots.length > maxSpellLvl) {
          maxSpellLvl = slots.length;
        }
      }

      const spellLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

      // Build Headers
      let headerHtml = `
        <tr>
          <th style="width: 50px">Level</th>
          <th style="width: 50px">PB</th>
          <th>Class Features</th>
      `;
      customCols.forEach(col => {
        headerHtml += `<th>${col.label}</th>`;
      });
      if (maxSpellLvl > 0) {
        for (let i = 0; i < maxSpellLvl; i++) {
          headerHtml += `<th style="width: 45px">${spellLabels[i]}</th>`;
        }
      }
      headerHtml += `</tr>`;

      // Build Rows
      let tableRows = '';
      for (let lvl = 1; lvl <= 20; lvl++) {
        const feats = levelFeatures[lvl] || [];
        const pb = getProfBonus(lvl);
        
        let rowHtml = `
          <tr>
            <td>${lvl}</td>
            <td><strong>${pb}</strong></td>
            <td><strong>${feats.map(fName => parseInlineMarkdown(fName)).join(', ') || '—'}</strong></td>
        `;
        customCols.forEach(col => {
          const val = col.rows[lvl - 1];
          rowHtml += `<td>${formatTableCellValue(val)}</td>`;
        });
        if (maxSpellLvl > 0) {
          const slots = spellSlotsByLevel[lvl - 1];
          for (let i = 0; i < maxSpellLvl; i++) {
            const val = slots[i] || 0;
            rowHtml += `<td>${val > 0 ? val : '—'}</td>`;
          }
        }
        rowHtml += `</tr>`;
        tableRows += rowHtml;
      }

      html = `
        <div class="detail-view-container">
          <header class="detail-header">
            <div class="detail-subtitle">${cls.parentClass ? `${cls.parentClass} Subclass` : 'Character Class'}</div>
            <h1>${cls.name}</h1>
            <div style="font-style: italic; color: var(--accent-color)">Hit Die: d${cls.hd}</div>
          </header>
          <div class="detail-body">
            ${!cls.parentClass ? `<div class="detail-meta-box">
              <div class="meta-entry">
                <span class="meta-label">Primary Proficiencies</span>
                <span class="meta-value">${cls.proficiency || '—'}</span>
              </div>
              <div class="meta-entry">
                <span class="meta-label">Armor Training</span>
                <span class="meta-value">${cls.armor || 'None'}</span>
              </div>
              <div class="meta-entry">
                <span class="meta-label">Weapons</span>
                <span class="meta-value">${cls.weapons || 'Simple'}</span>
              </div>
              <div class="meta-entry">
                <span class="meta-label">Tools</span>
                <span class="meta-value">${cls.tools || 'None'}</span>
              </div>
            </div>` : ''}

            <h2 style="margin-top: 30px; margin-bottom: 12px; font-size: 20px; color: var(--accent-color)">${cls.parentClass ? 'Subclass' : 'Class'} Progression Table</h2>
            <table class="class-features-table">
              <thead>
                ${headerHtml}
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            ${cls.source ? `
              <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
                Source: <em>${escapeHtml(getFullSourceName(cls.source))}</em>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      html = `
        <div class="detail-view-container">
          <header class="detail-header">
            <div class="detail-subtitle">${item.className || 'Class'} Feature • Level ${item.level} ${item.subclass ? `(${item.subclass})` : ''}</div>
            <h1>${item.name}</h1>
          </header>
          <div class="detail-body">
            ${formatText(item.texts)}
            ${item.special ? `<p style="margin-top: 20px; color: var(--accent-color)"><strong>Special Note:</strong> ${parseInlineMarkdown(item.special)}</p>` : ''}
            ${item.modifiers && item.modifiers.length > 0 ? `
              <div style="margin-top: 20px; padding: 12px; background-color: var(--panel-bg); border-radius: 6px;">
                <strong>Feature Modifiers:</strong>
                <ul style="margin-top: 8px; list-style-type: square; padding-left: 20px;">
                  ${item.modifiers.map(m => `<li>${m.category}: ${m.value}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${item.source ? `
              <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
                Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  } else if (category === 'options' || category === 'option') {
    let extraDetail = '';
    if (item.name.startsWith('Replicate Magic Item:')) {
      const targetItemName = item.name.substring('Replicate Magic Item:'.length).trim();
      const items = allRecordsCache['items'] || [];
      const foundItem = items.find(i => i.name.toLowerCase() === targetItemName.toLowerCase() || i.originalName?.toLowerCase() === targetItemName.toLowerCase());
      if (foundItem) {
        extraDetail = `<div style="margin-top: 20px; border-top: 2px dashed var(--border-color); padding-top: 20px;">
          ${getDetailHTML(foundItem, 'items')}
        </div>`;
      }
    }
    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">${item.classes ? item.classes.join(', ') : 'Option'}</div>
          <h1>${item.name}</h1>
          ${item.level ? `<div style="font-weight: 500; color: var(--accent-color)">Prerequisite: Level ${item.level}</div>` : ''}
        </header>
        <div class="detail-body">
          ${formatText(item.texts)}
          ${extraDetail}
          ${item.source ? `
            <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (category === 'feats' || category === 'feat') {
    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">${item.category || 'Feat'}</div>
          <h1>${item.name}</h1>
          ${item.prerequisite ? `<div style="font-weight: 500; color: var(--accent-color)">Prerequisite: ${item.prerequisite}</div>` : ''}
        </header>
        <div class="detail-body">
          ${formatText(item.texts)}
          ${item.modifiers && item.modifiers.length > 0 ? `
            <div style="margin-top: 20px; padding: 12px; background-color: var(--panel-bg); border-radius: 6px;">
              <strong>Feat Modifiers:</strong>
              <ul style="margin-top: 8px; list-style-type: square; padding-left: 20px;">
                ${item.modifiers.map(m => `<li>${m.category}: ${m.value}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${item.source ? `
            <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (category === 'backgrounds' || category === 'background') {
    // Build a summary of what the background grants
    const grantRows = [];
    if (item.ability) grantRows.push({ label: 'Ability Score Increases', value: item.ability });
    if (item.proficiency) grantRows.push({ label: 'Skill Proficiencies', value: item.proficiency });
    if (item.tools) grantRows.push({ label: 'Tool Proficiencies', value: item.tools });
    if (item.languages) grantRows.push({ label: 'Languages', value: item.languages });
    if (item.feats) grantRows.push({ label: 'Feat', value: item.feats });

    const grantBoxHtml = grantRows.length > 0 ? `
      <div style="background: linear-gradient(135deg, var(--panel-bg), rgba(var(--accent-rgb, 139,92,246),0.08)); border: 1px solid var(--accent-color); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
        <div style="font-family: var(--font-header); font-size: 13px; font-weight: 700; color: var(--accent-color); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">🎒 Background Grants</div>
        ${grantRows.map(row => `
          <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted); min-width: 140px; padding-top: 1px;">${row.label}:</span>
            <span style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${row.value}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">Background</div>
          <h1>${item.name}</h1>
        </header>
        <div class="detail-body">
          ${grantBoxHtml}
          ${formatText(item.texts)}
          ${item.traits && item.traits.length > 0 ? `
            <h2 style="margin-top: 30px; margin-bottom: 12px; font-size: 20px; color: var(--accent-color)">Background Features</h2>
            ${item.traits.map(t => `
              <div style="margin-bottom: 16px;">
                <strong>${t.name}</strong>
                <div style="margin-top: 4px;">${parseMarkdown((t.texts || []).join('\n'))}</div>
              </div>
            `).join('')}
          ` : ''}
          ${item.source ? `
            <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
 } else if (category === 'races' || category === 'race') {
    // Build a summary of what the species grants
    const raceGrants = [];
    if (item.ability) raceGrants.push({ label: 'Ability Score Increases', value: item.ability });
    if (item.languages) raceGrants.push({ label: 'Languages', value: item.languages });
    if (item.proficiency) raceGrants.push({ label: 'Skill Proficiencies', value: item.proficiency });
    const speedDisplay = item.speedStr || `Walk ${item.speed || 30} ft.`;

    const raceGrantBoxHtml = raceGrants.length > 0 ? `
      <div style="background: linear-gradient(135deg, var(--panel-bg), rgba(var(--accent-rgb, 139,92,246),0.08)); border: 1px solid var(--accent-color); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
        <div style="font-family: var(--font-header); font-size: 13px; font-weight: 700; color: var(--accent-color); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">🧬 Species Grants</div>
        ${raceGrants.map(row => `
          <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted); min-width: 140px; padding-top: 1px;">${row.label}:</span>
            <span style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${row.value}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">Species</div>
          <h1>${item.name}</h1>
        </header>
        <div class="detail-meta-box">
          <div class="meta-entry">
            <span class="meta-label">Size</span>
            <span class="meta-value">${item.size || 'Medium'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Speed</span>
            <span class="meta-value">${speedDisplay}</span>
          </div>
          ${item.ability ? `
          <div class="meta-entry">
            <span class="meta-label">Ability Increases</span>
            <span class="meta-value">${item.ability}</span>
          </div>` : ''}
          <div class="meta-entry">
            <span class="meta-label">Languages</span>
            <span class="meta-value">${item.languages || 'Common'}</span>
          </div>
        </div>
        <div class="detail-body">
          ${raceGrantBoxHtml}
          ${item.proficiency ? `<p style="margin-bottom: 16px;"><strong>Skill/Tool Proficiencies:</strong> ${item.proficiency}</p>` : ''}
          ${item.traits && item.traits.length > 0 ? `
            <h2 style="margin-top: 30px; margin-bottom: 12px; font-size: 20px; color: var(--accent-color)">Traits</h2>
            ${item.traits.map(t => `
              <div style="margin-bottom: 16px;">
                <strong>${t.name}</strong>
                <div style="margin-top: 4px;">${parseMarkdown((t.texts || []).join('\n'))}</div>
              </div>
            `).join('')}
          ` : ''}
          ${item.source ? `
            <div style="margin-top: 20px; color: var(--text-muted); font-size: 13px;">
              Source: <em>${escapeHtml(getFullSourceName(item.source))}</em>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  return html;
}

// Render full detailed view for the e-Reader panel
function renderDetails(item, category = currentCategory) {
  detailPaneContent.innerHTML = getDetailHTML(item, category);
  updateFavoriteButtonUI();
  updateDetailFooterUI();
}

// ─── Custom Element Dialog ────────────────────────────────────────────────────

const MODIFIER_TARGETS = [
  'ac', 'initiative',
  'str.score', 'dex.score', 'con.score', 'int.score', 'wis.score', 'cha.score',
  'save.str', 'save.dex', 'save.con', 'save.int', 'save.wis', 'save.cha', 'save.all',
  'spell.attack', 'spell.dc',
  'melee.attack', 'melee.damage', 'ranged.attack', 'ranged.damage'
];

const MODIFIER_TYPES = ['add', 'set', 'min', 'max'];

function buildModifierRowHTML(mod = {}, idx) {
  const targetOpts = MODIFIER_TARGETS.map(t =>
    `<option value="${t}" ${mod.target === t ? 'selected' : ''}>${t}</option>`
  ).join('');
  const typeOpts = MODIFIER_TYPES.map(t =>
    `<option value="${t}" ${mod.type === t ? 'selected' : ''}>${t}</option>`
  ).join('');
  return `
    <div class="custom-mod-row" data-idx="${idx}" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <select class="custom-mod-target" style="flex:2;padding:6px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:13px;">
        ${targetOpts}
      </select>
      <select class="custom-mod-type" style="flex:1;padding:6px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:13px;">
        ${typeOpts}
      </select>
      <input class="custom-mod-value" type="text" value="${escapeHtml(String(mod.value ?? ''))}" placeholder="e.g. 2 or {prof_bonus}" style="flex:2;padding:6px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:13px;">
      <button type="button" class="custom-mod-delete" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px 6px;font-size:16px;" title="Remove modifier">✕</button>
    </div>
  `;
}

function getCategoryFields(category, item = {}) {
  const esc = (v) => escapeHtml(String(v ?? ''));
  const sel = (v, opts) => opts.map(o =>
    `<option value="${o}" ${v === o ? 'selected' : ''}>${o}</option>`
  ).join('');

  const fieldBlock = (label, content) =>
    `<div style="margin-bottom:14px;"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">${label}</label>${content}</div>`;

  const textInput = (name, val, placeholder = '') =>
    `<input name="${name}" type="text" value="${esc(val)}" placeholder="${placeholder}" style="width:100%;padding:8px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:14px;box-sizing:border-box;">`;

  const textArea = (name, val, rows = 6) =>
    `<textarea name="${name}" rows="${rows}" style="width:100%;padding:8px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:14px;box-sizing:border-box;resize:vertical;">${esc(val)}</textarea>`;

  const numInput = (name, val, placeholder = '') =>
    `<input name="${name}" type="number" value="${esc(val)}" placeholder="${placeholder}" style="width:100%;padding:8px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:14px;box-sizing:border-box;">`;

  const selectInput = (name, val, opts) =>
    `<select name="${name}" style="width:100%;padding:8px;background:var(--panel-bg);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;font-size:14px;">${sel(val, opts)}</select>`;

  const descVal = (item.texts && item.texts.length) ? item.texts.join('\n\n') : '';

  const common = fieldBlock('Description (Markdown)', textArea('description', descVal));
  const modifierSection = `
    <div style="margin-bottom:14px;">
      <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:8px;">MODIFIERS
        <span style="font-size:11px;color:var(--text-muted);font-weight:normal;"> — target · type · value (supports {prof_bonus}, {str.mod}, etc.)</span>
      </label>
      <div id="custom-mod-list">
        ${(item.modifiers || []).map((m, i) => buildModifierRowHTML(m, i)).join('')}
      </div>
      <button type="button" id="btn-add-modifier" style="background:none;border:1px solid var(--border-color);color:var(--accent-color);cursor:pointer;padding:6px 12px;border-radius:4px;font-size:13px;margin-top:4px;">+ Add Modifier</button>
    </div>
  `;

  if (category === 'spells') {
    const schools = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
    return [
      fieldBlock('Name', textInput('name', item.name, 'Spell name')),
      fieldBlock('Level (0 = Cantrip)', numInput('level', item.level ?? 1)),
      fieldBlock('School', selectInput('school', item.school, schools)),
      fieldBlock('Casting Time', textInput('time', item.time, 'e.g. 1 action')),
      fieldBlock('Range', textInput('range', item.range, 'e.g. 60 feet')),
      fieldBlock('Components', textInput('components', item.components, 'e.g. V, S, M (a pinch of dust)')),
      fieldBlock('Duration', textInput('duration', item.duration, 'e.g. Concentration, up to 1 minute')),
      fieldBlock('Spell Lists (comma-separated)', textInput('classes', (item.classes || []).join(', '), 'e.g. Wizard, Sorcerer')),
      common,
    ].join('');
  } else if (category === 'items') {
    const rarities = ['Common','Uncommon','Rare','Very Rare','Legendary','Artifact','Varies'];
    return [
      fieldBlock('Name', textInput('name', item.name, 'Item name')),
      fieldBlock('Type', textInput('type', item.type, 'e.g. Weapon, Armor, Wondrous Item')),
      fieldBlock('Rarity', selectInput('rarity', item.rarity || 'Common', rarities)),
      fieldBlock('Requires Attunement', `<input name="attunement" type="checkbox" ${item.attunement ? 'checked' : ''}>`),
      fieldBlock('Weight (lbs)', numInput('weight', item.weight, '0')),
      fieldBlock('Value (gp)', numInput('value', item.value, '0')),
      common,
      modifierSection,
    ].join('');
  } else if (category === 'feats') {
    return [
      fieldBlock('Name', textInput('name', item.name, 'Feat name')),
      fieldBlock('Prerequisite', textInput('prerequisite', item.prerequisite, 'e.g. Strength 13 or higher')),
      common,
      modifierSection,
    ].join('');
  } else if (category === 'options') {
    return [
      fieldBlock('Name', textInput('name', item.name, 'Option name')),
      fieldBlock('Class / Type (e.g. Artificer Infusion, Metamagic)', textInput('optionType', (item.classes || [])[0] || '', 'e.g. Eldritch Invocation')),
      fieldBlock('Prerequisite Level', numInput('level', item.level ?? 0, '0')),
      common,
      modifierSection,
    ].join('');
  } else if (category === 'monsters') {
    const sizes = ['Tiny','Small','Medium','Large','Huge','Gargantuan'];
    return [
      fieldBlock('Name', textInput('name', item.name, 'Monster name')),
      fieldBlock('Type', textInput('type', item.type, 'e.g. dragon, undead, beast')),
      fieldBlock('CR', textInput('cr', item.cr ?? '', 'e.g. 1, 1/2, 15')),
      fieldBlock('Size', selectInput('size', item.size || 'Medium', sizes)),
      fieldBlock('AC', numInput('ac', item.ac, '10')),
      fieldBlock('HP', textInput('hp', item.hp ?? '', 'e.g. 52 (8d8+16)')),
      common,
    ].join('');
  } else if (category === 'backgrounds') {
    return [
      fieldBlock('Name', textInput('name', item.name, 'Background name')),
      common,
      modifierSection,
    ].join('');
  } else if (category === 'races') {
    return [
      fieldBlock('Name', textInput('name', item.name, 'Species name')),
      common,
      modifierSection,
    ].join('');
  } else {
    return [
      fieldBlock('Name', textInput('name', item.name, 'Name')),
      common,
      modifierSection,
    ].join('');
  }
}

function openCustomElementDialog(category, existingItem) {
  const isEdit = !!existingItem;
  const title = isEdit ? `Edit: ${existingItem.name}` : `New ${category.slice(0, -1) || category}`;

  // Remove any existing dialog
  const old = document.getElementById('custom-element-dialog');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'custom-element-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

  overlay.innerHTML = `
    <div style="background:var(--panel-bg);border:1px solid var(--border-color);border-radius:12px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;">
        <h2 style="margin:0;font-size:18px;color:var(--text-primary);">${escapeHtml(title)}</h2>
        <button id="custom-dialog-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:4px 8px;">✕</button>
      </div>
      <form id="custom-element-form" style="overflow-y:auto;padding:20px 24px;flex:1;">
        <input type="hidden" name="source" value="${escapeHtml(existingItem?.source || 'Custom')}">
        ${getCategoryFields(category, existingItem || {})}
      </form>
      <div style="padding:16px 24px;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:10px;">
        ${isEdit && existingItem._custom && !existingItem._overrides_compendium ? `
          <button id="custom-dialog-delete" type="button" style="margin-right:auto;background:none;border:1px solid var(--danger-color,#e53e3e);color:var(--danger-color,#e53e3e);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;">Delete Custom Record</button>
        ` : ''}
        <button id="custom-dialog-cancel" type="button" style="background:var(--panel-bg-hover);border:1px solid var(--border-color);color:var(--text-secondary);padding:8px 20px;border-radius:6px;cursor:pointer;font-size:14px;">Cancel</button>
        <button id="custom-dialog-save" type="button" style="background:var(--accent-color);border:none;color:#000;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Modifier add/delete wiring
  let modCount = (existingItem?.modifiers || []).length;
  overlay.querySelector('#btn-add-modifier')?.addEventListener('click', () => {
    const list = overlay.querySelector('#custom-mod-list');
    if (!list) return;
    const div = document.createElement('div');
    div.innerHTML = buildModifierRowHTML({}, modCount++);
    list.appendChild(div.firstElementChild);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target.classList.contains('custom-mod-delete')) {
      e.target.closest('.custom-mod-row').remove();
    }
  });

  // Close handlers
  overlay.querySelector('#custom-dialog-close').onclick = () => overlay.remove();
  overlay.querySelector('#custom-dialog-cancel').onclick = () => overlay.remove();

  // Delete handler (only for purely-custom records)
  const deleteBtn = overlay.querySelector('#custom-dialog-delete');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm(`Permanently delete "${existingItem.name}"?`)) return;
      const store = getStoreNameForCategory(category);
      await deleteCustomRecord(store, existingItem.name);
      allRecordsCache[store] = (allRecordsCache[store] || []).filter(r => r.name !== existingItem.name);
      currentRecords = allRecordsCache[store] || [];
      selectedItem = null;
      detailPaneContent.innerHTML = '';
      updateFavoriteButtonUI();
      applyFilters();
      overlay.remove();
    };
  }

  // Save handler
  overlay.querySelector('#custom-dialog-save').onclick = async () => {
    const form = overlay.querySelector('#custom-element-form');
    const data = new FormData(form);
    const name = form.querySelector('[name="name"]')?.value?.trim();
    if (!name) { alert('Name is required.'); return; }

    // Collect modifiers from DOM
    const mods = [];
    overlay.querySelectorAll('.custom-mod-row').forEach(row => {
      const target = row.querySelector('.custom-mod-target')?.value;
      const type = row.querySelector('.custom-mod-type')?.value;
      const value = row.querySelector('.custom-mod-value')?.value?.trim();
      if (target && type && value !== '') {
        const numVal = parseFloat(value);
        mods.push({ target, type, value: isNaN(numVal) ? value : numVal });
      }
    });

    const store = getStoreNameForCategory(category);
    const isOverride = isEdit && !existingItem._custom;
    const wasCustomNew = isEdit && existingItem._custom && !existingItem._overrides_compendium;

    let record = { name, source: data.get('source') || 'Custom', modifiers: mods, texts: [] };

    // Description → texts array
    const desc = form.querySelector('[name="description"]')?.value?.trim();
    if (desc) record.texts = desc.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);

    // Category-specific field extraction
    if (category === 'spells') {
      record.level = parseInt(form.querySelector('[name="level"]')?.value) || 0;
      record.school = form.querySelector('[name="school"]')?.value || 'Evocation';
      record.time = form.querySelector('[name="time"]')?.value || '';
      record.range = form.querySelector('[name="range"]')?.value || '';
      record.components = form.querySelector('[name="components"]')?.value || '';
      record.duration = form.querySelector('[name="duration"]')?.value || '';
      const classesStr = form.querySelector('[name="classes"]')?.value || '';
      record.classes = classesStr.split(',').map(s => s.trim()).filter(Boolean);
    } else if (category === 'items') {
      record.type = form.querySelector('[name="type"]')?.value || 'Gear';
      record.rarity = form.querySelector('[name="rarity"]')?.value || 'Common';
      record.attunement = form.querySelector('[name="attunement"]')?.checked || false;
      record.weight = parseFloat(form.querySelector('[name="weight"]')?.value) || 0;
      record.value = parseFloat(form.querySelector('[name="value"]')?.value) || 0;
    } else if (category === 'feats') {
      record.prerequisite = form.querySelector('[name="prerequisite"]')?.value || '';
    } else if (category === 'options') {
      const optType = form.querySelector('[name="optionType"]')?.value || '';
      record.classes = optType ? [optType] : [];
      record.level = parseInt(form.querySelector('[name="level"]')?.value) || 0;
    } else if (category === 'monsters') {
      record.type = form.querySelector('[name="type"]')?.value || 'beast';
      record.cr = form.querySelector('[name="cr"]')?.value || '0';
      record.size = form.querySelector('[name="size"]')?.value || 'Medium';
      record.ac = parseInt(form.querySelector('[name="ac"]')?.value) || 10;
      record.hp = form.querySelector('[name="hp"]')?.value || '';
    }

    if (isOverride || wasCustomNew) {
      record._overrides_compendium = isOverride;
    } else if (!isEdit) {
      record._overrides_compendium = false;
    }

    const saved = await saveCustomRecord(store, record);

    // Merge into allRecordsCache
    if (!allRecordsCache[store]) allRecordsCache[store] = [];
    if (saved._overrides_compendium) {
      const idx = allRecordsCache[store].findIndex(r => r.name === saved.name);
      if (idx >= 0) allRecordsCache[store][idx] = saved;
      else allRecordsCache[store].push(saved);
    } else {
      const idx = allRecordsCache[store].findIndex(r => r.name === saved.name);
      if (idx >= 0) allRecordsCache[store][idx] = saved;
      else allRecordsCache[store].push(saved);
    }

    currentRecords = allRecordsCache[store] || [];
    selectedItem = saved;
    applyFilters();
    renderDetails(saved, category);
    overlay.remove();
  };

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// Settings Control Panel Handlers
function showSettingsPanel() {
  if (pickerActive) {
    pickerActive = false;
    pickerTargetListId = null;
    updateSidebarVisibility();
    const sidebarBackBtn = document.getElementById('sidebar-back-to-sheet');
    if (sidebarBackBtn) sidebarBackBtn.style.display = 'none';
    const footer = document.getElementById('pane-detail-footer');
    if (footer) footer.style.display = 'none';
  }

  currentCategory = 'settings';
  selectedFacet1 = 'All';
  selectedFacet2 = 'All';
  searchChits = [];
  renderChits();
  searchInput.value = '';
  selectedItem = null;

  // Clear active sidebar highlights
  menuItems.forEach(mi => mi.classList.remove('active'));
  btnSettings.classList.add('active');

  // Update layout pane visibility to hide lists/facets and expand settings to full width
  updatePaneVisibility();

  // Render the settings page view
  renderSettingsPage();

  // Switch to detail view on mobile
  showMobilePane('detail');

  // Ensure settings pane is shown on desktop/tablet by adding has-detail class
  const appContainer = document.querySelector('.app-container');
  appContainer.classList.add('has-detail');
  appContainer.setAttribute('data-category', 'settings');

  if (!isNavigatingHistory) pushCurrentState(false);
}

function renderSettingsPage() {
  detailPaneContent.innerHTML = `
    <div class="detail-view-container settings-panel">
      <header class="detail-header">
        <div class="detail-subtitle">Control Panel</div>
        <h1 style="font-size: 32px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Settings</h1>
        <p style="color: var(--text-secondary); margin-top: 8px;">Manage your offline compendium database, cloud sync, imports, and application cache.</p>
      </header>

      <div class="detail-body">

        <!-- ── CLOUD SYNC ─────────────────────────────────────────── -->
        <section class="settings-section" style="margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px;">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Cloud Sync (Dropbox)</h2>

          <div class="settings-option">
            <div class="settings-row">
              <h3 style="margin-bottom: 0;">Sync Status</h3>
              <div id="sync-badge-container"></div>
            </div>
            <p>Sync your compendium across devices via Dropbox. Your data is stored in your own Dropbox account in <code>/Apps/&lt;YourAppName&gt;/sync_state.json</code>.</p>
          </div>

          <div class="settings-option" id="dropbox-link-section">
            <div id="dropbox-config-fields">
              <h3>Dropbox App Key</h3>
              <p>Create a Dropbox App at <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener" style="color: var(--accent-color);">dropbox.com/developers/apps</a> with <strong>App folder</strong> access. Paste your <strong>App Key</strong> (not the secret) below.</p>
              <input type="text" class="settings-input" id="dropbox-app-key-input" placeholder="e.g. abc123xyz456" autocomplete="off" spellcheck="false" style="margin-bottom: 12px;">

              <h3>OAuth Redirect URI (Optional / Configurable)</h3>
              <p>Make sure this matches one of the <strong>Redirect URIs</strong> registered in your Dropbox App settings. Defaults to this application's current URL.</p>
              <input type="text" class="settings-input" id="dropbox-redirect-uri-input" placeholder="e.g. http://localhost:3000/" autocomplete="off" spellcheck="false" style="margin-bottom: 16px;">
            </div>
            <div class="settings-btn-row">
              <button class="settings-action-btn" id="settings-btn-link-dropbox">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 10l5.5 3.5L17.5 10 12 6.5zm5.5 5.5L6.5 12 2 14.5 12 21l10-6.5L17.5 12zm0-12L2 9.5 6.5 12 12 8.5 17.5 12 22 9.5z"/></svg>
                Link Dropbox
              </button>
              <button class="settings-action-btn danger-btn" id="settings-btn-unlink-dropbox" style="display:none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm1-4H8v2h8v-2z"/></svg>
                Unlink Dropbox
              </button>
            </div>
          </div>

          <div class="settings-option">
            <h3>Manual Sync</h3>
            <p>Force an immediate sync cycle to upload your local changes and download any remote updates.</p>
            <button class="settings-action-btn" id="settings-btn-sync-now">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
              Sync Now
            </button>
          </div>
        </section>

        <!-- ── DATABASE MANAGEMENT ───────────────────────────────── -->
        <section class="settings-section" style="margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px;">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Database Management</h2>

          <div class="settings-option">
            <h3>Import 5eTools Content</h3>
            <p>Load 5eTools content sources directly from GitHub or import from your local data folder.</p>
            <div style="margin-top: 12px; margin-bottom: 16px; max-width: 500px;">
              <label for="settings-github-repo" style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 6px; color: var(--text-primary);">GitHub Repository URL</label>
              <input type="text" class="settings-input" id="settings-github-repo" value="${githubRepoUrl}" style="margin: 0;" placeholder="https://github.com/5etools-mirror-3/5etools-src" autocomplete="off" spellcheck="false">
            </div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px;">
              <button class="settings-action-btn" id="settings-btn-import-github">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                Load from GitHub (Recommended)
              </button>
              <button class="settings-action-btn secondary-btn" id="settings-btn-import-local">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                Select Local Folder
              </button>
            </div>
          </div>

          <div class="settings-option" style="margin-top: 24px;">
            <h3>Restore Backup File</h3>
            <p>Restore your database from a previously exported <code>.json</code> backup file.</p>
            <button class="settings-action-btn" id="settings-btn-import-backup">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
              Import Backup File (.json)
            </button>
          </div>

          <div class="settings-option" style="margin-top: 24px;">
            <h3>Clear Database & Compendium</h3>
            <p>Wipe compendium data or clear all local data including your characters and favorites.</p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px;">
              <button class="settings-action-btn" id="settings-btn-clear-compendium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg>
                Clear Compendium Only
              </button>
              <button class="settings-action-btn danger-btn" id="settings-btn-clear-db">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg>
                Clear Entire Database
              </button>
            </div>
          </div>
        </section>

        <!-- ── DATA PORTABILITY ──────────────────────────────────── -->
        <section class="settings-section" style="margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px;">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Data Portability</h2>

          <div class="settings-option">
            <h3>Export Local Backup</h3>
            <p>Download a complete JSON snapshot of your entire compendium database. Store it as a backup or transfer it to another device.</p>
            <button class="settings-action-btn" id="settings-btn-export-json">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
              Download JSON Backup
            </button>
          </div>
        </section>

        <!-- ── STORAGE HEALTH ────────────────────────────────────── -->
        <section class="settings-section" style="margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px;">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Storage &amp; Health</h2>

          <div class="settings-option">
            <h3>Storage Classification</h3>
            <p>The browser can grant <strong>persistent</strong> (eviction-resistant) storage or operate in <strong>best-effort</strong> mode. Persistent storage prevents the OS from clearing your data under low-storage conditions.</p>
            <div id="storage-health-container"></div>
          </div>
        </section>

        <!-- ── APPLICATION CACHE ─────────────────────────────────── -->
        <section class="settings-section">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Application Cache</h2>

          <div class="settings-option">
            <h3>Reset App Cache</h3>
            <p>Clear the offline Service Worker cache to force download the latest application updates. This is useful if the app is not loading newer edits.</p>
            <button class="settings-action-btn" id="settings-btn-reset-cache">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
              Clear Cache &amp; Reload
            </button>
          </div>
        </section>

      </div>
    </div>
  `;

  // ── Attach event handlers ──

  document.getElementById('settings-btn-import-github').addEventListener('click', handle5eToolsGitHubImport);
  const repoInput = document.getElementById('settings-github-repo');
  if (repoInput) {
    repoInput.addEventListener('change', async () => {
      const url = repoInput.value.trim();
      if (url) {
        githubRepoUrl = url;
        updateGithubBaseUrl();
        await saveAppSetting('github_repo_url', url);
        console.log('[app] Saved custom GitHub repository URL:', url);
      }
    });
  }
  document.getElementById('settings-btn-import-local').addEventListener('click', async () => {
    importSourceType = 'local';
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        await handleDirectoryHandleSelect(dirHandle);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          alert('Failed to open directory: ' + err.message);
        }
      }
    } else {
      dirInput.click();
    }
  });
  document.getElementById('settings-btn-import-backup').addEventListener('click', () => fileInput.click());
  document.getElementById('settings-btn-clear-compendium').addEventListener('click', clearCompendiumAction);
  document.getElementById('settings-btn-clear-db').addEventListener('click', clearDatabaseAction);
  document.getElementById('settings-btn-reset-cache').addEventListener('click', resetServiceWorkerCache);

  // Sync Now
  document.getElementById('settings-btn-sync-now').addEventListener('click', async () => {
    const btn = document.getElementById('settings-btn-sync-now');
    if (btn) btn.disabled = true;
    await syncNow();
    if (btn) btn.disabled = false;
  });

  // Export JSON backup
  document.getElementById('settings-btn-export-json').addEventListener('click', async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnd-compendium-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  });

  // Dropbox link/unlink
  _setupDropboxLinkUI();

  // Storage health badge
  const storageContainer = document.getElementById('storage-health-container');
  if (storageContainer) {
    renderStorageBadge(storageContainer);
    // Refresh quota in case it changed
    getStorageQuota().then(() => renderStorageBadge(storageContainer));
  }

  // Sync badge
  const badgeEl = document.getElementById('sync-badge-container');
  if (badgeEl) renderSyncStatusBadge(badgeEl, syncState);
}

async function _setupDropboxLinkUI() {
  const linked = await isDropboxLinked();
  const linkBtn = document.getElementById('settings-btn-link-dropbox');
  const unlinkBtn = document.getElementById('settings-btn-unlink-dropbox');
  const keyInput = document.getElementById('dropbox-app-key-input');
  const redirectInput = document.getElementById('dropbox-redirect-uri-input');
  const configFields = document.getElementById('dropbox-config-fields');

  if (!linkBtn || !unlinkBtn || !keyInput || !redirectInput) return;

  // Pre-populate saved values if they exist
  const savedKey = await getAppSetting('dropbox_app_key');
  if (savedKey) {
    keyInput.value = savedKey;
  }

  const savedRedirect = await getAppSetting('oauth_redirect_uri');
  redirectInput.value = savedRedirect || (window.location.origin + window.location.pathname);

  if (linked) {
    linkBtn.style.display = 'none';
    unlinkBtn.style.display = '';
    if (configFields) configFields.style.display = 'none';
  } else {
    linkBtn.style.display = '';
    unlinkBtn.style.display = 'none';
    if (configFields) configFields.style.display = '';
  }

  linkBtn.addEventListener('click', async () => {
    const appKey = keyInput.value.trim();
    if (!appKey) {
      alert('Please enter your Dropbox App Key first.');
      return;
    }
    const redirectUri = redirectInput.value.trim() || (window.location.origin + window.location.pathname);
    try {
      await startDropboxOAuth(appKey, redirectUri);
      // Page will redirect to Dropbox — no further action needed here
    } catch (err) {
      alert('Failed to start Dropbox authorization: ' + err.message);
    }
  });

  unlinkBtn.addEventListener('click', async () => {
    if (confirm('Unlink Dropbox? Your local data will not be deleted.')) {
      await unlinkDropbox();
      renderSettingsPage(); // Re-render to show link UI
    }
  });
}

// resetDatabaseToDefault removed because auto XML seeding is deprecated.

async function clearDatabaseAction() {
  if (confirm('Warning: This will clear ALL database content including all characters and favorites. Have you downloaded and saved a backup file first? If not, please click Cancel and download your JSON backup.')) {
    showOverlay('Clearing Database...', 'Wiping all local database stores...');
    localStorage.setItem('bypassAutoSeed', 'true');
    await clearDatabase();
    await loadAllRecordsCache();
    await loadCategory('spells'); // Go back to spells after clearing
    hideOverlay();
    alert('Database successfully cleared!');
  }
}

async function clearCompendiumAction() {
  if (confirm('Are you sure you want to clear the compendium? This will remove all spells, items, monsters, etc., but will preserve your characters and favorites.')) {
    showOverlay('Clearing Compendium...', 'Wiping all compendium database stores...');
    await clearCompendium();
    await loadAllRecordsCache();
    await loadCategory('spells');
    hideOverlay();
    alert('Compendium successfully cleared!');
  }
}

async function resetServiceWorkerCache() {
  if (confirm('Are you sure you want to reset the application cache? The page will reload.')) {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (let key of keys) {
        await caches.delete(key);
      }
    }
    window.location.reload();
  }
}
// Universal Search Panel Renderer
function renderUniversalSearchPanel() {
  // Hide facet list inside Pane 1
  facetList1.style.display = 'none';

  let controls = document.getElementById('universal-search-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'universal-search-controls';
    controls.style.padding = '16px';
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '20px';

    controls.innerHTML = `
      <div class="search-group">
        <label for="universal-search-input" style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; display: block; margin-bottom: 8px;">Search Query</label>
        <div class="search-box-wrapper">
          <input type="text" id="universal-search-input" class="search-input" placeholder="Search all D&D..." style="width: 100%;">
        </div>
      </div>
      
      <div class="search-group">
        <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; display: block; margin-bottom: 12px;">Categories to Search</span>
        
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" id="search-cat-all" checked style="accent-color: var(--accent-color);">
            <span style="font-weight: 500;">All Categories</span>
          </label>
          
          <hr style="border: none; border-top: 1px solid var(--border-color); margin: 4px 0;">
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="spells" checked style="accent-color: var(--accent-color);">
            <span>Spells</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="items" checked style="accent-color: var(--accent-color);">
            <span>Items</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="monsters" checked style="accent-color: var(--accent-color);">
            <span>Bestiary (Monsters)</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="classes" checked style="accent-color: var(--accent-color);">
            <span>Classes</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="feats" checked style="accent-color: var(--accent-color);">
            <span>Feats</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="backgrounds" checked style="accent-color: var(--accent-color);">
            <span>Backgrounds</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="races" checked style="accent-color: var(--accent-color);">
            <span>Races</span>
          </label>
          
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" class="search-cat-cb" data-store="options" checked style="accent-color: var(--accent-color);">
            <span>Options</span>
          </label>
        </div>
      </div>
    `;

    paneFacet1.querySelector('.pane-content').appendChild(controls);

    // Bind event handlers
    const uniInput = controls.querySelector('#universal-search-input');
    const cbs = controls.querySelectorAll('.search-cat-cb');
    const allCb = controls.querySelector('#search-cat-all');

    uniInput.addEventListener('input', () => {
      applyUniversalSearch();
    });

    uniInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        showMobilePane('list'); // Hitting enter takes you to results list on mobile
        if (!isNavigatingHistory) pushCurrentState(false);
      }
    });

    allCb.addEventListener('change', () => {
      cbs.forEach(cb => cb.checked = allCb.checked);
      applyUniversalSearch();
    });

    cbs.forEach(cb => {
      cb.addEventListener('change', () => {
        const allChecked = Array.from(cbs).every(c => c.checked);
        allCb.checked = allChecked;
        applyUniversalSearch();
      });
    });
  } else {
    controls.style.display = 'flex';
  }

  // Clear inputs and search initially
  const inputEl = document.getElementById('universal-search-input');
  if (inputEl) {
    inputEl.value = '';
  }

  // Hide category selection when picking
  const searchGroups = controls.querySelectorAll('.search-group');
  if (searchGroups.length > 1) {
    searchGroups[1].style.display = pickerActive ? 'none' : '';
  }

  applyUniversalSearch();
}

function applyUniversalSearch() {
  const uniInput = document.getElementById('universal-search-input');
  if (!uniInput) return;
  const query = uniInput.value.toLowerCase().trim();

  // Get selected categories to search
  let selectedStores = [];
  if (pickerActive) {
    if (pickerCategory === 'items') {
      selectedStores = ['items'];
    } else if (pickerCategory === 'spells') {
      selectedStores = ['spells'];
    } else if (pickerCategory === 'feats' || pickerCategory === 'options') {
      selectedStores = ['feats', 'options', 'classes'];
    } else if (pickerCategory === 'monsters') {
      selectedStores = ['monsters'];
    }
  } else {
    const checkboxes = document.querySelectorAll('.search-cat-cb');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        selectedStores.push(cb.getAttribute('data-store'));
      }
    });
  }

  if (!query) {
    itemList.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted)">Type in the search box to find items.</li>';
    listTitle.textContent = 'Search Results (0)';
    return;
  }

  // Assemble unified search pool
  let searchPool = [];
  selectedStores.forEach(store => {
    const records = allRecordsCache[store] || [];
    if (store === 'classes') {
      records.forEach(cls => {
        searchPool.push({
          ...cls,
          categoryType: 'class-overview',
          name: `${cls.name} Overview`
        });
        if (cls.features) {
          cls.features.forEach(feat => {
            searchPool.push({
              ...feat,
              categoryType: 'class-feature',
              className: cls.name
            });
          });
        }
      });
    } else {
      records.forEach(rec => {
        searchPool.push({
          ...rec,
          categoryType: store.substring(0, store.length - 1)
        });
      });
    }
  });

  // Score and Rank based on search keywords
  const filtered = searchPool.map(item => {
    let score = 0;
    const name = item.name.toLowerCase();
    
    if (name === query) {
      score += 100;
    } else if (name.startsWith(query)) {
      score += 50;
    } else if (name.includes(query)) {
      score += 25;
    }

    // Full text match
    let fullText = '';
    const type = item.categoryType;
    if (type === 'spell' || type === 'item' || type === 'feat' || type === 'background' || type === 'race' || type === 'class-feature' || type === 'option') {
      fullText = (item.texts || []).join(' ') + ' ' + (item.detail || '');
    } else if (type === 'monster') {
      fullText = (item.description || '') + ' ' +
        (item.traits || []).map(t => t.name + ' ' + t.texts.join(' ')).join(' ') + ' ' +
        (item.actions || []).map(a => a.name + ' ' + a.texts.join(' ')).join(' ');
    } else if (type === 'class-overview') {
      fullText = (item.proficiency || '') + ' ' + (item.armor || '') + ' ' + (item.weapons || '');
    }

    if (fullText.toLowerCase().includes(query)) {
      score += 10;
    }

    return { item, score };
  })
  .filter(scored => scored.score > 0)
  .sort((a, b) => b.score - a.score)
  .map(scored => scored.item);

  renderList(filtered, true);
}

// ─── CHARACTER SHEET CORE FUNCTIONS ──────────────────────────────────────────

const attributes = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const skillAttrs = {
  athletics: 'str',
  acrobatics: 'dex',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  animal_handling: 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha'
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function formatModifier(val) {
  const num = parseInt(val) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}

async function saveCharacterToDb(char) {
  await saveRecord('characters', char);
  scheduleDebouncedSync();
}

async function saveCurrentCharacterAndRefresh() {
  if (!currentCharacter) return;
  currentCharacter._modified_at = new Date().toISOString();
  await saveCharacterToDb(currentCharacter);
  if (window.__dndStore?.currentCharacter) {
    window.__dndStore.currentCharacter.value = JSON.parse(JSON.stringify(currentCharacter));
  }
  renderCharacterSheetUI();
}

async function refreshCharactersList() {
  const rawCharacters = await getAllRecords('characters');
  allRecordsCache['characters'] = rawCharacters;
  currentRecords = rawCharacters.filter(c => !c._deleted);
  applyFilters();
}

function createNewCharacterTemplate(name, charClass, subclass, level, species, background, baseStats, spellcastingAbility, baseHpMax, speed) {
  return {
    name,
    class: charClass,
    subclass: subclass || '',
    level: parseInt(level) || 1,
    species: species || '',
    background: background || '',
    baseStats: baseStats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savesProficiency: {
      str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
    },
    skillsProficiency: {
      athletics: 0, acrobatics: 0, sleight_of_hand: 0, stealth: 0,
      arcana: 0, history: 0, investigation: 0, nature: 0, religion: 0,
      animal_handling: 0, insight: 0, medicine: 0, perception: 0, survival: 0,
      deception: 0, intimidation: 0, performance: 0, persuasion: 0
    },
    skillsAttributeOverride: {},
    hp: {
      current: parseInt(baseHpMax) || 10,
      temp: 0
    },
    baseHpMax: parseInt(baseHpMax) || 10,
    speed: parseInt(speed) || 30,
    spellcastingAbility: spellcastingAbility || 'wis',
    inspiration: false,
    deathSaves: { successes: 0, failures: 0 },
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spellSlots: {},
    counters: [],
    equipment: [],
    spells: [],
    features: [],
    options: [],
    bestiary: [],
    modifiers: [],
    classes: [],
    notes: {
      backstory: '',
      alignment: '',
      age: '',
      height: '',
      weight: '',
      allies: '',
      enemies: '',
      sessionNotes: ''
    },
    // Phase 1 additions
    conditions: [],
    pinnedActions: [],
    attunementMax: 3,
    toolProficiencies: [],
    weightTrackingEnabled: false,
    collapsedLists: {},
    levelHistory: [],

    _deleted: false,
    _modified_at: new Date().toISOString()
  };
}

function renderCharactersRoster(chars) {
  itemList.innerHTML = '';
  
  const grid = document.createElement('div');
  grid.className = 'cs-roster-grid';
  
  chars.forEach(char => {
    const card = document.createElement('div');
    card.className = 'cs-roster-card';
    
    const state = calculateCharacterState(char);
    
    card.innerHTML = `
      <div class="cs-roster-card-header">
        <div class="cs-roster-portrait">👤</div>
        <div class="cs-roster-info">
          <div class="cs-roster-name">${char.name}</div>
          <div class="cs-roster-sub">Level ${char.level} ${char.class || 'Fighter'}</div>
        </div>
      </div>
      <div class="cs-roster-stats">
        <div>
          <span class="cs-roster-stat-val">${state['ac']}</span>
          AC
        </div>
        <div>
          <span class="cs-roster-stat-val">${state['hp.max']}</span>
          Max HP
        </div>
        <div>
          <span class="cs-roster-stat-val">+${state['prof_bonus']}</span>
          Prof
        </div>
      </div>
      <div class="cs-roster-actions">
        <button class="cs-roster-btn btn-duplicate" title="Duplicate Character" aria-label="Duplicate Character">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="cs-roster-btn danger btn-delete" title="Delete Character" aria-label="Delete Character">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    
    card.addEventListener('click', (e) => {
      if (e.target.closest('.cs-roster-btn')) return;
      openCharacterSheet(char);
    });
    
    card.querySelector('.btn-duplicate').addEventListener('click', async (e) => {
      e.stopPropagation();
      const dup = JSON.parse(JSON.stringify(char));
      dup.name = `${char.name} (Copy)`;
      dup._modified_at = new Date().toISOString();
      dup._deleted = false;

      // Update memory cache synchronously first for instant UI response
      if (!allRecordsCache['characters']) allRecordsCache['characters'] = [];
      allRecordsCache['characters'].push(dup);
      currentRecords = allRecordsCache['characters'].filter(c => !c._deleted);
      applyFilters();

      await saveCharacterToDb(dup);
      await refreshCharactersList();
    });
    
    card.querySelector('.btn-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete ${char.name}?`)) {
        char._deleted = true;
        char._modified_at = new Date().toISOString();

        // Update memory cache synchronously first for instant UI response
        if (allRecordsCache['characters']) {
          const idx = allRecordsCache['characters'].findIndex(c => c.name === char.name);
          if (idx >= 0) allRecordsCache['characters'][idx]._deleted = true;
        }
        currentRecords = allRecordsCache['characters'].filter(c => !c._deleted);
        applyFilters();

        await saveCharacterToDb(char);
        await refreshCharactersList();
      }
    });
    
    grid.appendChild(card);
  });
  
  const createCard = document.createElement('div');
  createCard.className = 'cs-roster-card cs-create-card';
  createCard.innerHTML = `
    <div style="text-align: center; color: var(--accent-color);">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <div style="font-weight: 600; font-family: var(--font-header);">Create Character</div>
    </div>
  `;
  createCard.addEventListener('click', () => {
    openWizard();
  });
  grid.appendChild(createCard);
  
  itemList.appendChild(grid);
}

function openCharacterSheet(char) {
  currentCharacter = migrateCharacter(char);
  // Sync to Preact signal so combat tab renders immediately
  if (window.__dndStore?.currentCharacter) {
    window.__dndStore.currentCharacter.value = currentCharacter;
  }
  document.getElementById('character-sheet-view').style.display = 'flex';
  
  const tabs = document.querySelectorAll('.cs-tab-btn');
  tabs.forEach(t => {
    t.classList.remove('active');
    if (t.getAttribute('data-tab') === 'combat') t.classList.add('active');
  });
  document.querySelectorAll('.cs-tab-panel').forEach(p => {
    p.classList.remove('active');
    if (p.id === 'cs-tab-combat') p.classList.add('active');
  });
  
  renderCharacterSheetUI();
}

function closeCharacterSheet() {
  currentCharacter = null;
  document.getElementById('character-sheet-view').style.display = 'none';
  refreshCharactersList();
}

function populateCreatorDropdowns() {
  const classSelect = document.getElementById('cs-modal-class');
  const speciesSelect = document.getElementById('cs-modal-species');
  const backgroundSelect = document.getElementById('cs-modal-background');
  
  if (classSelect) {
    classSelect.innerHTML = '<option value="">-- Custom Class --</option>';
    const classes = allRecordsCache['classes'] || [];
    classes.forEach(c => {
      classSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
  }
  
  if (speciesSelect) {
    speciesSelect.innerHTML = '<option value="">-- Custom Species --</option>';
    const races = allRecordsCache['races'] || [];
    races.forEach(r => {
      speciesSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });
  }
  
  if (backgroundSelect) {
    backgroundSelect.innerHTML = '<option value="">-- Custom Background --</option>';
    const bgs = allRecordsCache['backgrounds'] || [];
    bgs.forEach(b => {
      backgroundSelect.innerHTML += `<option value="${b.name}">${b.name}</option>`;
    });
  }
}

let characterToEdit = null;
function showCharacterCreatorModal(char = null) {
  characterToEdit = char;
  const modal = document.getElementById('cs-creator-modal');
  const title = document.getElementById('cs-modal-title');
  
  populateCreatorDropdowns();
  
  if (char) {
    title.textContent = 'Edit Character Details';
    document.getElementById('cs-modal-name').value = char.name;
    document.getElementById('cs-modal-class').value = char.class || '';
    document.getElementById('cs-modal-subclass').value = char.subclass || '';
    document.getElementById('cs-modal-level').value = char.level;
    document.getElementById('cs-modal-level').disabled = true;
    document.getElementById('cs-modal-species').value = char.species || '';
    document.getElementById('cs-modal-background').value = char.background || '';
    document.getElementById('cs-modal-spellcasting').value = char.spellcastingAbility || 'wis';
    document.getElementById('cs-modal-base-hp').value = char.baseHpMax;
    document.getElementById('cs-modal-speed').value = char.speed;
    
    const stats = char.baseStats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    attributes.forEach(attr => {
      document.getElementById(`cs-modal-${attr}`).value = stats[attr];
    });
  } else {
    title.textContent = 'Create Character';
    document.getElementById('cs-modal-name').value = '';
    document.getElementById('cs-modal-class').value = '';
    document.getElementById('cs-modal-subclass').value = '';
    document.getElementById('cs-modal-level').value = 1;
    document.getElementById('cs-modal-level').disabled = false;
    document.getElementById('cs-modal-species').value = '';
    document.getElementById('cs-modal-background').value = '';
    document.getElementById('cs-modal-spellcasting').value = 'wis';
    document.getElementById('cs-modal-base-hp').value = 10;
    document.getElementById('cs-modal-speed').value = 30;
    
    attributes.forEach(attr => {
      document.getElementById(`cs-modal-${attr}`).value = 10;
    });
  }
  
  modal.style.display = 'flex';
}

async function saveCharacterCreatorModal() {
  const name = document.getElementById('cs-modal-name').value.trim();
  if (!name) {
    alert('Name is required.');
    return;
  }
  
  const charClass = document.getElementById('cs-modal-class').value;
  const subclass = document.getElementById('cs-modal-subclass').value.trim();
  const level = parseInt(document.getElementById('cs-modal-level').value) || 1;
  const species = document.getElementById('cs-modal-species').value;
  const background = document.getElementById('cs-modal-background').value;
  const spellcastingAbility = document.getElementById('cs-modal-spellcasting').value;
  const baseHpMax = parseInt(document.getElementById('cs-modal-base-hp').value) || 10;
  const speed = parseInt(document.getElementById('cs-modal-speed').value) || 30;
  
  const baseStats = {};
  attributes.forEach(attr => {
    baseStats[attr] = parseInt(document.getElementById(`cs-modal-${attr}`).value) || 10;
  });
  
  if (characterToEdit) {
    characterToEdit.name = name;
    characterToEdit.class = charClass;
    characterToEdit.subclass = subclass;
    characterToEdit.level = level;
    characterToEdit.species = species;
    characterToEdit.background = background;
    characterToEdit.spellcastingAbility = spellcastingAbility;
    characterToEdit.baseHpMax = baseHpMax;
    characterToEdit.speed = speed;
    characterToEdit.baseStats = baseStats;
    characterToEdit._modified_at = new Date().toISOString();
    
    // Sync the classes array structure
    if (!characterToEdit.classes) {
      characterToEdit.classes = [];
    }
    if (characterToEdit.classes.length <= 1) {
      const classRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === charClass.toLowerCase());
      characterToEdit.classes = [{
        name: charClass,
        level: level,
        subclass: subclass || null,
        hd: classRecord ? parseInt(classRecord.hd) || 8 : 8,
        spellAbility: classRecord ? classRecord.spellAbility || null : null,
        featureListId: characterToEdit.featureLists?.[0]?.id || generateId(),
        subclassListId: null,
        spellListId: characterToEdit.spellLists?.[0]?.id || null,
        subclassSpellListId: null
      }];
    } else {
      const firstClass = characterToEdit.classes[0];
      firstClass.name = charClass;
      firstClass.subclass = subclass || null;
      const otherClassesSum = characterToEdit.classes.slice(1).reduce((sum, c) => sum + c.level, 0);
      if (level > otherClassesSum) {
        firstClass.level = level - otherClassesSum;
      } else {
        firstClass.level = 1;
        characterToEdit.level = 1 + otherClassesSum;
      }
    }
    
    await saveCharacterToDb(characterToEdit);
    document.getElementById('cs-creator-modal').style.display = 'none';
    
    if (currentCharacter && currentCharacter.name === characterToEdit.name) {
      currentCharacter = characterToEdit;
      renderCharacterSheetUI();
    }
    await refreshCharactersList();
  } else {
    const newChar = createNewCharacterTemplate(name, charClass, subclass, level, species, background, baseStats, spellcastingAbility, baseHpMax, speed);
    
    // Copy background modifiers
    if (background) {
      const bgRecord = allRecordsCache['backgrounds']?.find(b => b.name === background);
      if (bgRecord && bgRecord.modifiers) {
        newChar.features.push({
          name: `Background Adjustments: ${background}`,
          active: true,
          favorite: false,
          selected: true,
          id: generateId(),
          texts: ['Ability adjustments from background.'],
          modifiers: JSON.parse(JSON.stringify(bgRecord.modifiers))
        });
      }
    }
    
    // Copy race modifiers
    if (species) {
      const raceRecord = allRecordsCache['races']?.find(r => r.name === species);
      if (raceRecord && raceRecord.modifiers) {
        newChar.features.push({
          name: `Species Traits: ${species}`,
          active: true,
          favorite: false,
          selected: true,
          id: generateId(),
          texts: ['Traits from species.'],
          modifiers: JSON.parse(JSON.stringify(raceRecord.modifiers))
        });
      }
    }
    
    await saveCharacterToDb(newChar);
    document.getElementById('cs-creator-modal').style.display = 'none';
    
    await refreshCharactersList();
    openCharacterSheet(newChar);
  }
}

// ─── Character Creation Wizard ───────────────────────────────────────────────
let wizardState = null;

function openWizard() {
  wizardState = {
    step: 1,
    basics: {
      name: '',
      alignment: 'Neutral',
      age: '',
      height: '',
      weight: '',
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    },
    species: null,
    speciesLanguages: [],
    speciesSkills: [],
    background: null,
    backgroundStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    backgroundSkills: [],
    backgroundLanguages: [],
    classRecord: null,
    classSkills: [],
    classHpGain: 10,
    classFeaturesChosen: []
  };

  const modal = document.getElementById('cs-wizard-modal');
  modal.style.display = 'flex';
  renderWizardStep(1);
}

function renderWizardStep(stepNum) {
  wizardState.step = stepNum;
  
  // Update step indicators
  const steps = document.querySelectorAll('#cs-wizard-steps .cs-wizard-step');
  steps.forEach((el, idx) => {
    const s = idx + 1;
    el.classList.remove('active', 'done');
    if (s === stepNum) {
      el.classList.add('active');
    } else if (s < stepNum) {
      el.classList.add('done');
    }
  });

  const stepLines = document.querySelectorAll('#cs-wizard-steps .cs-wizard-step-line');
  stepLines.forEach((el, idx) => {
    const s = idx + 1;
    el.classList.remove('done');
    if (s < stepNum) {
      el.classList.add('done');
    }
  });

  // Render step body
  const body = document.getElementById('cs-wizard-body');
  body.className = 'cs-wizard-body';
  body.innerHTML = '';

  if (stepNum === 1) renderWizardStep1(body);
  else if (stepNum === 2) renderWizardStep2(body);
  else if (stepNum === 3) renderWizardStep3(body);
  else if (stepNum === 4) renderWizardStep4(body);
  else if (stepNum === 5) renderWizardStep5(body);

  // Update footer nav buttons
  const prevBtn = document.getElementById('cs-wizard-btn-prev');
  const nextBtn = document.getElementById('cs-wizard-btn-next');

  prevBtn.disabled = stepNum === 1;
  nextBtn.textContent = stepNum === 5 ? 'Create Character' : 'Next →';
}

function renderWizardStep1(body) {
  body.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px; max-width: 800px; margin: 0 auto; width: 100%; box-sizing: border-box;">
      <h2 style="font-family: var(--font-header); font-size: 22px; color: var(--accent-color); margin-bottom: 8px;">Basic Character Info</h2>
      
      <div class="cs-form-group">
        <label for="wizard-basics-name" style="font-weight: 600;">Character Name <span style="color: var(--error-color);">*</span></label>
        <input type="text" id="wizard-basics-name" class="settings-input" placeholder="e.g. Katherine Ironheart" value="${wizardState.basics.name}" required>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="cs-form-group">
          <label for="wizard-basics-alignment">Alignment</label>
          <select id="wizard-basics-alignment" class="settings-input">
            <option value="Lawful Good" ${wizardState.basics.alignment === 'Lawful Good' ? 'selected' : ''}>Lawful Good</option>
            <option value="Neutral Good" ${wizardState.basics.alignment === 'Neutral Good' ? 'selected' : ''}>Neutral Good</option>
            <option value="Chaotic Good" ${wizardState.basics.alignment === 'Chaotic Good' ? 'selected' : ''}>Chaotic Good</option>
            <option value="Lawful Neutral" ${wizardState.basics.alignment === 'Lawful Neutral' ? 'selected' : ''}>Lawful Neutral</option>
            <option value="Neutral" ${wizardState.basics.alignment === 'Neutral' ? 'selected' : ''}>Neutral</option>
            <option value="Chaotic Neutral" ${wizardState.basics.alignment === 'Chaotic Neutral' ? 'selected' : ''}>Chaotic Neutral</option>
            <option value="Lawful Evil" ${wizardState.basics.alignment === 'Lawful Evil' ? 'selected' : ''}>Lawful Evil</option>
            <option value="Neutral Evil" ${wizardState.basics.alignment === 'Neutral Evil' ? 'selected' : ''}>Neutral Evil</option>
            <option value="Chaotic Evil" ${wizardState.basics.alignment === 'Chaotic Evil' ? 'selected' : ''}>Chaotic Evil</option>
          </select>
        </div>
        <div class="cs-form-group">
          <label for="wizard-basics-age">Age</label>
          <input type="text" id="wizard-basics-age" class="settings-input" placeholder="e.g. 25" value="${wizardState.basics.age}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="cs-form-group">
          <label for="wizard-basics-height">Height</label>
          <input type="text" id="wizard-basics-height" class="settings-input" placeholder="e.g. 5'11\\"" value="${wizardState.basics.height}">
        </div>
        <div class="cs-form-group">
          <label for="wizard-basics-weight">Weight</label>
          <input type="text" id="wizard-basics-weight" class="settings-input" placeholder="e.g. 165 lbs" value="${wizardState.basics.weight}">
        </div>
      </div>

      <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-family: var(--font-header); font-size: 18px; color: var(--accent-color); margin: 0;">Ability Scores</h3>
          <button type="button" class="cs-wizard-standard-array-btn" id="wizard-basics-std-array">Use Standard Array (15, 14, 13, 12, 10, 8)</button>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Manual entry. Use the point-buy budget as a guide if desired.</p>
        
        <div class="cs-wizard-stats-grid">
          ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => {
            const val = wizardState.basics.stats[attr];
            const mod = Math.floor((val - 10) / 2);
            return `
              <div class="cs-wizard-stat-cell">
                <span class="cs-wizard-stat-label">${attr}</span>
                <input type="number" class="cs-wizard-stat-input wizard-stat-input" data-attr="${attr}" min="1" max="30" value="${val}">
                <span class="cs-wizard-stat-mod" id="wizard-basics-mod-${attr}">${mod >= 0 ? '+' + mod : mod}</span>
              </div>
            `;
          }).join('')}
        </div>
        
        <div style="background: var(--panel-bg); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 600;">Point Buy Budget (27 Total):</span>
          <span id="wizard-basics-pointbuy-budget" style="font-family: var(--font-header); font-size: 16px; font-weight: 700; color: var(--accent-color);">27 points remaining</span>
        </div>
      </div>
    </div>
  `;

  // Wire up listeners
  const nameInput = body.querySelector('#wizard-basics-name');
  nameInput.oninput = () => { wizardState.basics.name = nameInput.value; };
  
  const alignSelect = body.querySelector('#wizard-basics-alignment');
  alignSelect.onchange = () => { wizardState.basics.alignment = alignSelect.value; };

  const ageInput = body.querySelector('#wizard-basics-age');
  ageInput.oninput = () => { wizardState.basics.age = ageInput.value; };

  const heightInput = body.querySelector('#wizard-basics-height');
  heightInput.oninput = () => { wizardState.basics.height = heightInput.value; };

  const weightInput = body.querySelector('#wizard-basics-weight');
  weightInput.oninput = () => { wizardState.basics.weight = weightInput.value; };

  const updateBudgetAndMods = () => {
    const budgetSpan = body.querySelector('#wizard-basics-pointbuy-budget');
    const remaining = calculatePointBuyRemaining(wizardState.basics.stats);
    budgetSpan.textContent = remaining >= 0 
      ? `${remaining} points remaining` 
      : `${Math.abs(remaining)} points over budget!`;
    budgetSpan.style.color = remaining >= 0 ? 'var(--accent-color)' : 'var(--error-color)';

    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(attr => {
      const val = wizardState.basics.stats[attr];
      const mod = Math.floor((val - 10) / 2);
      const modSpan = body.querySelector(`#wizard-basics-mod-${attr}`);
      if (modSpan) modSpan.textContent = mod >= 0 ? '+' + mod : mod;
    });
  };

  const statInputs = body.querySelectorAll('.wizard-stat-input');
  statInputs.forEach(input => {
    input.oninput = () => {
      const attr = input.getAttribute('data-attr');
      const val = Math.max(1, Math.min(30, parseInt(input.value) || 10));
      wizardState.basics.stats[attr] = val;
      updateBudgetAndMods();
    };
  });

  body.querySelector('#wizard-basics-std-array').onclick = () => {
    const arr = [15, 14, 13, 12, 10, 8];
    const attrs = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    attrs.forEach((attr, idx) => {
      wizardState.basics.stats[attr] = arr[idx];
      const inp = body.querySelector(`.wizard-stat-input[data-attr="${attr}"]`);
      if (inp) inp.value = arr[idx];
    });
    updateBudgetAndMods();
  };

  updateBudgetAndMods();
}

function renderWizardStep2(body) {
  const races = allRecordsCache['races'] || [];
  let selectedRace = wizardState.species;
  
  body.className = 'cs-wizard-body cs-wizard-two-pane';
  body.innerHTML = `
    <div class="cs-wizard-list-pane">
      <div class="cs-wizard-list-search">
        <input type="text" placeholder="Search Species..." class="settings-input" id="wizard-species-search" style="margin:0;">
      </div>
      <div class="cs-wizard-list-scroll" id="wizard-species-list"></div>
    </div>
    <div class="cs-wizard-detail-pane" id="wizard-species-detail"></div>
  `;

  const listContainer = body.querySelector('#wizard-species-list');
  const searchInput = body.querySelector('#wizard-species-search');

  const renderList = (query) => {
    listContainer.innerHTML = '';
    const filtered = races.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
    filtered.sort((a,b) => a.name.localeCompare(b.name));
    
    filtered.forEach(r => {
      const div = document.createElement('div');
      div.className = 'cs-wizard-list-item' + (selectedRace === r ? ' active' : '');
      div.innerHTML = `
        <div class="cs-wizard-list-item-name">${r.name}</div>
        <div class="cs-wizard-list-item-sub">Speed: ${r.speed} ft · Size: ${r.size || 'Medium'}</div>
      `;
      div.onclick = () => {
        selectedRace = r;
        wizardState.species = r;
        // Reset selections for this race
        wizardState.speciesLanguages = r.languages ? r.languages.split(',').map(s => s.trim()) : ['Common'];
        wizardState.speciesSkills = r.proficiency ? r.proficiency.split(',').map(s => s.trim()) : [];
        renderList(searchInput.value);
        renderDetail();
      };
      listContainer.appendChild(div);
    });
  };

  const renderDetail = () => {
    const detail = body.querySelector('#wizard-species-detail');
    if (!selectedRace) {
      detail.innerHTML = `
        <div class="cs-wizard-detail-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p>Select a species from the list to preview traits and choices.</p>
        </div>
      `;
      return;
    }

    const descTrait = selectedRace.traits?.find(t => t.name.toLowerCase() === 'description');
    const descText = descTrait ? parseMarkdown(descTrait.texts?.join('\n')) : '';
    const otherTraits = selectedRace.traits?.filter(t => t.name.toLowerCase() !== 'description') || [];

    const descriptionHtml = descText
      ? `<div style="font-size: 13.5px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 20px; font-style: italic;">${descText}</div>`
      : '';

    const traitsHtml = otherTraits.length > 0
      ? `
        <h4 class="cs-wizard-section-title">Species Traits</h4>
        <div class="cs-wizard-feature-list">
          ${otherTraits.map(t => `
            <div class="cs-wizard-feature-item">
              <div>
                <div class="cs-wizard-feature-item-name">${t.name}</div>
                <div class="cs-wizard-feature-item-desc">${t.texts ? parseMarkdown(t.texts.join('\n')) : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `
      : '';

    // Skills
    const skillList = ['athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history', 'investigation', 'nature', 'religion', 'animal_handling', 'insight', 'medicine', 'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion'];
    
    // Check if the race proficiency contains choices or is comma-separated
    const autoSkills = selectedRace.proficiency ? selectedRace.proficiency.split(',').map(s => s.trim().toLowerCase()) : [];
    
    const skillsHtml = `
      <h4 class="cs-wizard-section-title" style="margin-top:20px;">Species Skills & Languages</h4>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Toggle skills or languages as granted by species (pre-selected by default).</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
        <div>
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;">Skill Proficiencies</label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;border:1px solid var(--border-color);padding:8px;border-radius:6px;background:var(--panel-bg);">
            ${skillList.map(s => {
              const label = s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              const isChecked = wizardState.speciesSkills.some(x => x.toLowerCase() === s.toLowerCase() || x.toLowerCase() === label.toLowerCase());
              return `
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
                  <input type="checkbox" class="wizard-species-skill-chk" data-skill="${s}" ${isChecked ? 'checked' : ''}>
                  ${label}
                </label>
              `;
            }).join('')}
          </div>
        </div>
        <div>
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;">Languages</label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;border:1px solid var(--border-color);padding:8px;border-radius:6px;background:var(--panel-bg);">
            ${['Common', 'Elvish', 'Dwarvish', 'Halfling', 'Giant', 'Gnomish', 'Goblin', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Undercommon'].map(l => {
              const isChecked = wizardState.speciesLanguages.some(x => x.toLowerCase() === l.toLowerCase());
              return `
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
                  <input type="checkbox" class="wizard-species-lang-chk" data-lang="${l}" ${isChecked ? 'checked' : ''}>
                  ${l}
                </label>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Build grants summary for wizard
    const wizardRaceGrants = [];
    if (selectedRace.ability) wizardRaceGrants.push({ label: 'Ability Increases', value: selectedRace.ability });
    if (selectedRace.languages) wizardRaceGrants.push({ label: 'Languages', value: selectedRace.languages });
    if (selectedRace.proficiency) wizardRaceGrants.push({ label: 'Skill Proficiencies', value: selectedRace.proficiency });
    const wizardRaceGrantBox = wizardRaceGrants.length > 0 ? `
      <div style="background:linear-gradient(135deg,var(--panel-bg),rgba(139,92,246,0.08));border:1px solid var(--accent-color);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent-color);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">🧬 Species Grants</div>
        ${wizardRaceGrants.map(g => `
          <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">
            <span style="font-size:11px;font-weight:700;color:var(--text-muted);min-width:120px;padding-top:1px;">${g.label}:</span>
            <span style="font-size:12px;color:var(--text-primary);font-weight:500;">${g.value}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    detail.innerHTML = `
      <div style="border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:16px;">
        <h3 style="font-family:var(--font-header);font-size:20px;color:var(--text-primary);margin:0;">${selectedRace.name}</h3>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Size: ${selectedRace.size || 'Medium'} · Speed: ${selectedRace.speedStr || (selectedRace.speed + ' ft.')}</div>
      </div>
      
      ${wizardRaceGrantBox}
      ${descriptionHtml}
      ${traitsHtml}
      ${skillsHtml}
    `;

    // Wire listeners
    detail.querySelectorAll('.wizard-species-skill-chk').forEach(chk => {
      chk.onchange = () => {
        const skill = chk.getAttribute('data-skill');
        const label = skill.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (chk.checked) {
          if (!wizardState.speciesSkills.includes(label)) wizardState.speciesSkills.push(label);
        } else {
          wizardState.speciesSkills = wizardState.speciesSkills.filter(x => x.toLowerCase() !== skill.toLowerCase() && x.toLowerCase() !== label.toLowerCase());
        }
      };
    });

    detail.querySelectorAll('.wizard-species-lang-chk').forEach(chk => {
      chk.onchange = () => {
        const lang = chk.getAttribute('data-lang');
        if (chk.checked) {
          if (!wizardState.speciesLanguages.includes(lang)) wizardState.speciesLanguages.push(lang);
        } else {
          wizardState.speciesLanguages = wizardState.speciesLanguages.filter(x => x.toLowerCase() !== lang.toLowerCase());
        }
      };
    });
  };

  searchInput.oninput = (e) => renderList(e.target.value);
  renderList('');
  renderDetail();
}

function renderWizardStep3(body) {
  const bgs = allRecordsCache['backgrounds'] || [];
  let selectedBg = wizardState.background;

  body.className = 'cs-wizard-body cs-wizard-two-pane';
  body.innerHTML = `
    <div class="cs-wizard-list-pane">
      <div class="cs-wizard-list-search">
        <input type="text" placeholder="Search Backgrounds..." class="settings-input" id="wizard-bg-search" style="margin:0;">
      </div>
      <div class="cs-wizard-list-scroll" id="wizard-bg-list"></div>
    </div>
    <div class="cs-wizard-detail-pane" id="wizard-bg-detail"></div>
  `;

  const listContainer = body.querySelector('#wizard-bg-list');
  const searchInput = body.querySelector('#wizard-bg-search');

  const renderList = (query) => {
    listContainer.innerHTML = '';
    const filtered = bgs.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));
    filtered.sort((a,b) => a.name.localeCompare(b.name));

    filtered.forEach(b => {
      const div = document.createElement('div');
      div.className = 'cs-wizard-list-item' + (selectedBg === b ? ' active' : '');
      div.innerHTML = `
        <div class="cs-wizard-list-item-name">${b.name}</div>
        <div class="cs-wizard-list-item-sub">${b.proficiency ? 'Skills: ' + b.proficiency : ''}${b.tools ? (b.proficiency ? ' · ' : '') + b.tools : ''}</div>
      `;
      div.onclick = () => {
        selectedBg = b;
        wizardState.background = b;
        
        // Reset ASI to all 0s — user customizes freely using the +/- buttons below
        wizardState.backgroundStats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

        wizardState.backgroundSkills = b.proficiency ? b.proficiency.split(',').map(s => s.trim()) : [];
        wizardState.backgroundLanguages = b.languages ? b.languages.split(',').map(s => s.trim()) : [];
        
        renderList(searchInput.value);
        renderDetail();
      };
      listContainer.appendChild(div);
    });
  };

  const renderDetail = () => {
    const detail = body.querySelector('#wizard-bg-detail');
    if (!selectedBg) {
      detail.innerHTML = `
        <div class="cs-wizard-detail-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <p>Select a background from the list to preview details and customize attributes.</p>
        </div>
      `;
      return;
    }

    const descTrait = selectedBg.traits?.find(t => t.name.toLowerCase() === 'description');
    const descTextsArray = [];
    if (descTrait && descTrait.texts) descTextsArray.push(...descTrait.texts);
    if (selectedBg.texts) descTextsArray.push(...selectedBg.texts);
    const descText = descTextsArray.length > 0 ? parseMarkdown(descTextsArray.join('\n')) : '';
    const otherTraits = selectedBg.traits?.filter(t => t.name.toLowerCase() !== 'description') || [];

    const descriptionHtml = descText
      ? `<div style="font-size: 13.5px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 20px; font-style: italic;">${descText}</div>`
      : '';

    const traitHtml = otherTraits.length > 0
      ? `
        <h4 class="cs-wizard-section-title">Background Feat / Feature</h4>
        <div class="cs-wizard-feature-list">
          ${otherTraits.map(t => `
            <div class="cs-wizard-feature-item">
              <div>
                <div class="cs-wizard-feature-item-name">${t.name}</div>
                <div class="cs-wizard-feature-item-desc">${t.texts ? parseMarkdown(t.texts.join('\n')) : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `
      : '';

    // ASI customization (checkboxes/buttons, no policing of total points, as per user request)
    const statsASIHtml = `
      <h4 class="cs-wizard-section-title" style="margin-top:20px;">Attribute Adjustments (Background ASI)</h4>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Increase or decrease attributes as desired. No restrictions are policed.</p>
      <div class="cs-wizard-asi-grid">
        ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => {
          const val = wizardState.backgroundStats[attr] || 0;
          return `
            <div class="cs-wizard-asi-btn ${val > 0 ? 'selected' : ''}" id="wizard-bg-asi-btn-${attr}">
              <span class="cs-wizard-asi-btn-label">${attr}</span>
              <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:4px;">
                <button type="button" class="cs-btn-small btn-bg-asi-dec" data-attr="${attr}" style="padding:2px 8px;font-size:12px;">−</button>
                <span class="cs-wizard-asi-btn-val" id="wizard-bg-asi-val-${attr}">${val >= 0 ? '+' + val : val}</span>
                <button type="button" class="cs-btn-small btn-bg-asi-inc" data-attr="${attr}" style="padding:2px 8px;font-size:12px;">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Skills
    const skillList = ['athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history', 'investigation', 'nature', 'religion', 'animal_handling', 'insight', 'medicine', 'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion'];
    
    const skillsHtml = `
      <h4 class="cs-wizard-section-title" style="margin-top:20px;">Skill Proficiencies & Languages</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;">Skill Proficiencies</label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;border:1px solid var(--border-color);padding:8px;border-radius:6px;background:var(--panel-bg);">
            ${skillList.map(s => {
              const label = s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              const isChecked = wizardState.backgroundSkills.some(x => x.toLowerCase() === s.toLowerCase() || x.toLowerCase() === label.toLowerCase());
              return `
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
                  <input type="checkbox" class="wizard-bg-skill-chk" data-skill="${s}" ${isChecked ? 'checked' : ''}>
                  ${label}
                </label>
              `;
            }).join('')}
          </div>
        </div>
        <div>
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;">Languages / Tools</label>
          <div style="font-size:13px;color:var(--text-secondary);background:var(--panel-bg);border:1px solid var(--border-color);border-radius:6px;padding:12px;line-height:1.4;">
            <strong>Tools:</strong> ${selectedBg.tools || 'None'}<br>
            <strong>Languages:</strong> ${selectedBg.languages || 'None'}
            <div style="margin-top:10px;">
              <input type="text" placeholder="Enter custom language/tool..." class="settings-input" id="wizard-bg-lang-custom" style="margin:0;font-size:12px;padding:6px 10px;">
            </div>
          </div>
        </div>
      </div>
    `;

    // Build grants summary for wizard
    const wizardBgGrants = [];
    if (selectedBg.ability) wizardBgGrants.push({ label: 'Ability Increases', value: selectedBg.ability });
    if (selectedBg.proficiency) wizardBgGrants.push({ label: 'Skill Proficiencies', value: selectedBg.proficiency });
    if (selectedBg.tools) wizardBgGrants.push({ label: 'Tool Proficiency', value: selectedBg.tools });
    if (selectedBg.languages) wizardBgGrants.push({ label: 'Languages', value: selectedBg.languages });
    if (selectedBg.feats) wizardBgGrants.push({ label: 'Feat', value: selectedBg.feats });
    const wizardBgGrantBox = wizardBgGrants.length > 0 ? `
      <div style="background:linear-gradient(135deg,var(--panel-bg),rgba(139,92,246,0.08));border:1px solid var(--accent-color);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent-color);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">🎒 Background Grants</div>
        ${wizardBgGrants.map(g => `
          <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">
            <span style="font-size:11px;font-weight:700;color:var(--text-muted);min-width:130px;padding-top:1px;">${g.label}:</span>
            <span style="font-size:12px;color:var(--text-primary);font-weight:500;">${g.value}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    detail.innerHTML = `
      <div style="border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:16px;">
        <h3 style="font-family:var(--font-header);font-size:20px;color:var(--text-primary);margin:0;">${selectedBg.name}</h3>
      </div>
      
      ${wizardBgGrantBox}
      ${descriptionHtml}
      ${traitHtml}
      ${statsASIHtml}
      ${skillsHtml}
    `;


    // Wire listeners
    detail.querySelectorAll('.btn-bg-asi-dec').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const attr = btn.getAttribute('data-attr');
        wizardState.backgroundStats[attr] = Math.max(-5, (wizardState.backgroundStats[attr] || 0) - 1);
        const card = detail.querySelector(`#wizard-bg-asi-btn-${attr}`);
        const valSpan = detail.querySelector(`#wizard-bg-asi-val-${attr}`);
        valSpan.textContent = wizardState.backgroundStats[attr] >= 0 ? '+' + wizardState.backgroundStats[attr] : wizardState.backgroundStats[attr];
        card.classList.toggle('selected', wizardState.backgroundStats[attr] !== 0);
      };
    });

    detail.querySelectorAll('.btn-bg-asi-inc').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const attr = btn.getAttribute('data-attr');
        wizardState.backgroundStats[attr] = Math.min(10, (wizardState.backgroundStats[attr] || 0) + 1);
        const card = detail.querySelector(`#wizard-bg-asi-btn-${attr}`);
        const valSpan = detail.querySelector(`#wizard-bg-asi-val-${attr}`);
        valSpan.textContent = wizardState.backgroundStats[attr] >= 0 ? '+' + wizardState.backgroundStats[attr] : wizardState.backgroundStats[attr];
        card.classList.toggle('selected', wizardState.backgroundStats[attr] !== 0);
      };
    });

    detail.querySelectorAll('.wizard-bg-skill-chk').forEach(chk => {
      chk.onchange = () => {
        const skill = chk.getAttribute('data-skill');
        const label = skill.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (chk.checked) {
          if (!wizardState.backgroundSkills.includes(label)) wizardState.backgroundSkills.push(label);
        } else {
          wizardState.backgroundSkills = wizardState.backgroundSkills.filter(x => x.toLowerCase() !== skill.toLowerCase() && x.toLowerCase() !== label.toLowerCase());
        }
      };
    });

    const customLangInput = detail.querySelector('#wizard-bg-lang-custom');
    if (customLangInput) {
      customLangInput.value = wizardState.backgroundLanguages.join(', ');
      customLangInput.oninput = () => {
        wizardState.backgroundLanguages = customLangInput.value.split(',').map(s => s.trim()).filter(Boolean);
      };
    }
  };

  searchInput.oninput = (e) => renderList(e.target.value);
  renderList('');
  renderDetail();
}

function renderWizardStep4(body) {
  const classes = allRecordsCache['classes'] || [];
  let selectedClass = wizardState.classRecord;

  body.className = 'cs-wizard-body cs-wizard-two-pane';
  body.innerHTML = `
    <div class="cs-wizard-list-pane">
      <div class="cs-wizard-list-search">
        <input type="text" placeholder="Search Classes..." class="settings-input" id="wizard-class-search" style="margin:0;">
      </div>
      <div class="cs-wizard-list-scroll" id="wizard-class-list"></div>
    </div>
    <div class="cs-wizard-detail-pane" id="wizard-class-detail"></div>
  `;

  const listContainer = body.querySelector('#wizard-class-list');
  const searchInput = body.querySelector('#wizard-class-search');

  const renderList = (query) => {
    listContainer.innerHTML = '';
    const filtered = classes.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    filtered.sort((a,b) => a.name.localeCompare(b.name));

    filtered.forEach(c => {
      const div = document.createElement('div');
      div.className = 'cs-wizard-list-item' + (selectedClass === c ? ' active' : '');
      div.innerHTML = `
        <div class="cs-wizard-list-item-name">${c.name}</div>
        <div class="cs-wizard-list-item-sub">Hit Die: d${c.hd} · Saves: ${getClassSkillsAndSaves(c).saves.join(', ')}</div>
      `;
      div.onclick = () => {
        selectedClass = c;
        wizardState.classRecord = c;
        
        wizardState.classHpGain = c.hd;
        
        // Find level 1 features
        const lvl1Als = c.autolevels?.filter(al => al.level === 1) || [];
        const lvl1Features = lvl1Als.flatMap(al => al.features || []);
        wizardState.classFeaturesChosen = lvl1Features.filter(f => !f.optional).map(f => f.name);
        
        wizardState.classSkills = [];

        renderList(searchInput.value);
        renderDetail();
      };
      listContainer.appendChild(div);
    });
  };

  const renderDetail = () => {
    const detail = body.querySelector('#wizard-class-detail');
    if (!selectedClass) {
      detail.innerHTML = `
        <div class="cs-wizard-detail-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <p>Select a character class from the list to preview traits and configure skills.</p>
        </div>
      `;
      return;
    }

    const { saves, skills: classApprovedSkills } = getClassSkillsAndSaves(selectedClass);
    const numSkills = selectedClass.numSkills || 2;

    const hpPromptHtml = `
      <h4 class="cs-wizard-section-title">Hit Points at Level 1</h4>
      <div class="cs-wizard-hp-prompt">
        <div>
          <span class="cs-wizard-hp-die-label">Hit Die:</span>
          <span class="cs-wizard-hp-die">d${selectedClass.hd}</span>
        </div>
        <div class="cs-wizard-hp-input-wrap">
          <label style="font-size:12px;color:var(--text-muted);">Base HP Max:</label>
          <input type="number" class="cs-wizard-hp-input" id="wizard-class-hp-input" min="1" max="100" value="${wizardState.classHpGain}">
        </div>
      </div>
    `;

    // Skills selection: list only class-approved skills, letting them select numSkills (optional checkbox selection)
    const skillsHtml = classApprovedSkills.length > 0
      ? `
        <h4 class="cs-wizard-section-title" style="margin-top:20px;">Class Skills (Choose ${numSkills})</h4>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;" id="wizard-class-skills-selected-lbl">0 of ${numSkills} selected</p>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;background:var(--panel-bg);border:1px solid var(--border-color);border-radius:8px;padding:12px;">
          ${classApprovedSkills.map(s => {
            const key = getSkillKey(s);
            const isChecked = wizardState.classSkills.includes(s);
            return `
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                <input type="checkbox" class="wizard-class-skill-chk" data-skill="${s}" ${isChecked ? 'checked' : ''}>
                ${s}
              </label>
            `;
          }).join('')}
        </div>
      `
      : '';

    // Level 1 Features
    const lvl1Als = selectedClass.autolevels?.filter(al => al.level === 1) || [];
    const lvl1Features = lvl1Als.flatMap(al => al.features || []);
    const featuresHtml = lvl1Features.length > 0
      ? `
        <h4 class="cs-wizard-section-title" style="margin-top:20px;">Level 1 Features</h4>
        <div class="cs-wizard-feature-list">
          ${lvl1Features.map(f => {
            const isChecked = wizardState.classFeaturesChosen.includes(f.name);
            const badge = f.optional ? `<span class="cs-wizard-feature-badge optional-badge">Optional</span>` : '';
            return `
              <div class="cs-wizard-feature-item ${f.optional ? 'optional' : ''} ${isChecked ? 'checked' : ''}" id="wizard-class-feat-item-${f.name.replace(/[^a-zA-Z0-9]/g,'')}">
                <input type="checkbox" class="wizard-class-feature-chk" data-name="${f.name}" ${isChecked ? 'checked' : ''}>
                <div style="margin-left:4px;">
                  <div class="cs-wizard-feature-item-name">${f.name} ${badge}</div>
                  <div class="cs-wizard-feature-item-desc">${f.texts ? parseMarkdown(f.texts.join('\n')) : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `
      : '';

    const descTrait = selectedClass.traits?.find(t => t.name.toLowerCase() === 'description' || t.name.toLowerCase() === selectedClass.name.toLowerCase());
    const descText = descTrait ? parseMarkdown(descTrait.texts?.join('\n')) : '';
    const descriptionHtml = descText
      ? `<div style="font-size: 13.5px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 20px; font-style: italic;">${descText}</div>`
      : '';

    // Build class grants box
    const classGrantRows = [];
    classGrantRows.push({ label: 'Saving Throws', value: saves.join(', ') || '—' });
    if (selectedClass.armor) classGrantRows.push({ label: 'Armor Training', value: selectedClass.armor });
    if (selectedClass.weapons) classGrantRows.push({ label: 'Weapon Proficiencies', value: selectedClass.weapons });
    if (selectedClass.tools) classGrantRows.push({ label: 'Tool Proficiencies', value: selectedClass.tools });
    if (numSkills > 0 && classApprovedSkills.length > 0) {
      classGrantRows.push({ label: 'Skill Choices', value: `Choose ${numSkills} from: ${classApprovedSkills.join(', ')}` });
    }
    if (selectedClass.spellAbility) classGrantRows.push({ label: 'Spellcasting Ability', value: selectedClass.spellAbility });

    const classGrantBox = `
      <div style="background:linear-gradient(135deg,var(--panel-bg),rgba(139,92,246,0.08));border:1px solid var(--accent-color);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent-color);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">⚔️ Class Grants (Level 1)</div>
        ${classGrantRows.map(g => `
          <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">
            <span style="font-size:11px;font-weight:700;color:var(--text-muted);min-width:130px;padding-top:1px;">${g.label}:</span>
            <span style="font-size:12px;color:var(--text-primary);font-weight:500;">${g.value}</span>
          </div>
        `).join('')}
      </div>
    `;

    detail.innerHTML = `
      <div style="border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:16px;">
        <h3 style="font-family:var(--font-header);font-size:20px;color:var(--text-primary);margin:0;">${selectedClass.name}</h3>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Hit Die: d${selectedClass.hd} · ${saves.length > 0 ? 'Saves: ' + saves.join(', ') : ''}</div>
      </div>
      
      ${classGrantBox}
      ${descriptionHtml}
      ${hpPromptHtml}
      ${skillsHtml}
      ${featuresHtml}
    `;


    // Wire listeners
    const hpInput = detail.querySelector('#wizard-class-hp-input');
    hpInput.oninput = () => { wizardState.classHpGain = Math.max(1, parseInt(hpInput.value) || 1); };

    const updateSkillLabel = () => {
      const lbl = detail.querySelector('#wizard-class-skills-selected-lbl');
      if (lbl) {
        lbl.textContent = `${wizardState.classSkills.length} of ${numSkills} selected`;
        lbl.style.color = wizardState.classSkills.length === numSkills ? 'var(--success-color)' : 'var(--text-muted)';
      }
    };

    detail.querySelectorAll('.wizard-class-skill-chk').forEach(chk => {
      chk.onchange = () => {
        const skill = chk.getAttribute('data-skill');
        if (chk.checked) {
          if (!wizardState.classSkills.includes(skill)) wizardState.classSkills.push(skill);
        } else {
          wizardState.classSkills = wizardState.classSkills.filter(x => x !== skill);
        }
        updateSkillLabel();
      };
    });

    detail.querySelectorAll('.wizard-class-feature-chk').forEach(chk => {
      chk.onchange = () => {
        const name = chk.getAttribute('data-name');
        const card = detail.querySelector(`#wizard-class-feat-item-${name.replace(/[^a-zA-Z0-9]/g,'')}`);
        if (chk.checked) {
          if (!wizardState.classFeaturesChosen.includes(name)) wizardState.classFeaturesChosen.push(name);
          if (card) card.classList.add('checked');
        } else {
          wizardState.classFeaturesChosen = wizardState.classFeaturesChosen.filter(x => x !== name);
          if (card) card.classList.remove('checked');
        }
      };
    });

    updateSkillLabel();
  };

  searchInput.oninput = (e) => renderList(e.target.value);
  renderList('');
  renderDetail();
}

function renderWizardStep5(body) {
  body.innerHTML = `
    <div class="cs-wizard-review-grid" style="max-width: 900px; margin: 0 auto; width: 100%;">
      <div style="grid-column: 1 / -1; margin-bottom: 8px;">
        <h2 style="font-family: var(--font-header); font-size: 22px; color: var(--accent-color); margin: 0;">Review Character Details</h2>
        <p style="font-size:13px;color:var(--text-muted);margin-top:4px;">Look over your character info before finalized creation.</p>
      </div>

      <div class="cs-wizard-review-card">
        <h4>Identity & Profile</h4>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Name</span><span class="cs-wizard-review-val">${wizardState.basics.name}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Species</span><span class="cs-wizard-review-val">${wizardState.species ? wizardState.species.name : 'Custom Species'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Background</span><span class="cs-wizard-review-val">${wizardState.background ? wizardState.background.name : 'Custom Background'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Class</span><span class="cs-wizard-review-val">Level 1 ${wizardState.classRecord ? wizardState.classRecord.name : 'Custom Class'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Alignment</span><span class="cs-wizard-review-val">${wizardState.basics.alignment || 'Neutral'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Age/Height/Weight</span><span class="cs-wizard-review-val">${wizardState.basics.age || '—'} / ${wizardState.basics.height || '—'} / ${wizardState.basics.weight || '—'}</span></div>
      </div>

      <div class="cs-wizard-review-card">
        <h4>Base Ability Scores</h4>
        <div class="cs-wizard-review-stats">
          ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => {
            const base = wizardState.basics.stats[attr] || 10;
            const bgBonus = wizardState.backgroundStats[attr] || 0;
            const total = base + bgBonus;
            const mod = Math.floor((total - 10) / 2);
            return `
              <div class="cs-wizard-review-stat">
                <div class="cs-wizard-review-stat-label">${attr}</div>
                <div class="cs-wizard-review-stat-val">${total}</div>
                <div style="font-size:11px;color:var(--text-muted);">${mod >= 0 ? '+' + mod : mod} (${base}${bgBonus !== 0 ? (bgBonus > 0 ? '+' + bgBonus : bgBonus) : ''})</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="cs-wizard-review-row" style="margin-top:16px;"><span class="cs-wizard-review-key">HP at Level 1</span><span class="cs-wizard-review-val">${wizardState.classHpGain}</span></div>
      </div>

      <div class="cs-wizard-review-card" style="grid-column: 1 / -1;">
        <h4>Proficiencies & Features</h4>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Species Skills</span><span class="cs-wizard-review-val">${wizardState.speciesSkills.join(', ') || 'None'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Background Skills</span><span class="cs-wizard-review-val">${wizardState.backgroundSkills.join(', ') || 'None'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Class Skills</span><span class="cs-wizard-review-val">${wizardState.classSkills.join(', ') || 'None'}</span></div>
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Languages</span><span class="cs-wizard-review-val">${[...new Set([...wizardState.speciesLanguages, ...wizardState.backgroundLanguages])].join(', ') || 'None'}</span></div>
        ${wizardState.background && wizardState.background.tools ? `<div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Tool Proficiency</span><span class="cs-wizard-review-val">${wizardState.background.tools}</span></div>` : ''}
        ${wizardState.background && wizardState.background.feats ? `<div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Background Feat</span><span class="cs-wizard-review-val">${wizardState.background.feats}</span></div>` : ''}
        ${wizardState.background && wizardState.background.ability ? `<div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Background ASI</span><span class="cs-wizard-review-val">${wizardState.background.ability}</span></div>` : ''}
        <div class="cs-wizard-review-row"><span class="cs-wizard-review-key">Active Class Features</span><span class="cs-wizard-review-val">${wizardState.classFeaturesChosen.join(', ') || 'None'}</span></div>
      </div>
    </div>
  `;
}

function handleWizardNext() {
  if (wizardState.step === 1) {
    if (!wizardState.basics.name.trim()) {
      alert('Name is required.');
      return;
    }
    renderWizardStep(2);
  } else if (wizardState.step === 2) {
    if (!wizardState.species) {
      alert('Please select a species.');
      return;
    }
    renderWizardStep(3);
  } else if (wizardState.step === 3) {
    if (!wizardState.background) {
      alert('Please select a background.');
      return;
    }
    renderWizardStep(4);
  } else if (wizardState.step === 4) {
    if (!wizardState.classRecord) {
      alert('Please select a class.');
      return;
    }
    renderWizardStep(5);
  } else if (wizardState.step === 5) {
    applyWizardResult();
  }
}

function handleWizardBack() {
  if (wizardState.step > 1) {
    renderWizardStep(wizardState.step - 1);
  }
}

function closeWizard() {
  document.getElementById('cs-wizard-modal').style.display = 'none';
  wizardState = null;
}

async function applyWizardResult() {
  const name = wizardState.basics.name.trim();
  const baseStats = { ...wizardState.basics.stats };
  
  const speciesName = wizardState.species ? wizardState.species.name : '';
  const backgroundName = wizardState.background ? wizardState.background.name : '';
  const className = wizardState.classRecord ? wizardState.classRecord.name : '';
  const spellAbility = wizardState.classRecord ? (wizardState.classRecord.spellAbility || null) : null;
  const baseHp = parseInt(wizardState.classHpGain) || 10;
  
  const newChar = createNewCharacterTemplate(
    name,
    className,
    '',
    1,
    speciesName,
    backgroundName,
    baseStats,
    spellAbility ? spellAbility.toLowerCase() : 'wis',
    baseHp,
    wizardState.species ? parseInt(wizardState.species.speed) || 30 : 30
  );

  newChar.notes.alignment = wizardState.basics.alignment;
  newChar.notes.age = wizardState.basics.age;
  newChar.notes.height = wizardState.basics.height;
  newChar.notes.weight = wizardState.basics.weight;

  // Initialize character lists
  ensureCharacterLists(newChar);

  // 1. Create Species features and modifiers
  const speciesListId = newChar.featureLists.push({ id: generateId(), name: `Species: ${speciesName}` }) - 1;
  const speciesListDef = newChar.featureLists[speciesListId];
  
  if (wizardState.species) {
    // Add all traits
    if (wizardState.species.traits) {
      wizardState.species.traits.forEach(t => {
        newChar.features.push({
          name: t.name,
          active: true,
          favorite: false,
          selected: true,
          id: generateId(),
          listId: speciesListDef.id,
          texts: t.texts || [],
          modifiers: JSON.parse(JSON.stringify(t.modifiers || []))
        });
      });
    }

    // Add Species skills as active modifiers
    if (wizardState.speciesSkills.length > 0) {
      const skillMods = wizardState.speciesSkills.map(s => ({
        target: `skill.${getSkillKey(s)}.prof`,
        type: 'max',
        value: '1'
      }));
      newChar.features.push({
        name: `${speciesName} Proficiencies`,
        active: true,
        favorite: false,
        selected: true,
        id: generateId(),
        listId: speciesListDef.id,
        texts: [`Grants proficiency in: ${wizardState.speciesSkills.join(', ')}`],
        modifiers: skillMods
      });
    }

    // Add Languages
    if (wizardState.speciesLanguages.length > 0) {
      newChar.features.push({
        name: `${speciesName} Languages`,
        active: true,
        favorite: false,
        selected: true,
        id: generateId(),
        listId: speciesListDef.id,
        texts: [`Languages: ${wizardState.speciesLanguages.join(', ')}`]
      });
    }
  }

  // 2. Create Background features and modifiers
  const bgListId = newChar.featureLists.push({ id: generateId(), name: `Background: ${backgroundName}` }) - 1;
  const bgListDef = newChar.featureLists[bgListId];

  if (wizardState.background) {
    // Background traits
    if (wizardState.background.traits) {
      wizardState.background.traits.forEach(t => {
        newChar.features.push({
          name: t.name,
          active: true,
          favorite: false,
          selected: true,
          id: generateId(),
          listId: bgListDef.id,
          texts: t.texts || [],
          modifiers: JSON.parse(JSON.stringify(t.modifiers || []))
        });
      });
    }

    // Background ASI modifiers (based on what user entered)
    const asiMods = [];
    Object.keys(wizardState.backgroundStats).forEach(attr => {
      const val = wizardState.backgroundStats[attr];
      if (val !== 0) {
        asiMods.push({
          target: `${attr}.score`,
          type: 'add',
          value: val
        });
      }
    });

    if (asiMods.length > 0) {
      newChar.features.push({
        name: `Background Ability Adjustments`,
        active: true,
        favorite: false,
        selected: true,
        id: generateId(),
        listId: bgListDef.id,
        texts: ['Adjustments chosen during character creation.'],
        modifiers: asiMods
      });
    }

    // Background skills
    if (wizardState.backgroundSkills.length > 0) {
      const skillMods = wizardState.backgroundSkills.map(s => ({
        target: `skill.${getSkillKey(s)}.prof`,
        type: 'max',
        value: '1'
      }));
      newChar.features.push({
        name: `${backgroundName} Proficiencies`,
        active: true,
        favorite: false,
        selected: true,
        id: generateId(),
        listId: bgListDef.id,
        texts: [`Grants proficiency in: ${wizardState.backgroundSkills.join(', ')}`],
        modifiers: skillMods
      });
    }
  }

  // 3. Create Class features and modifiers
  const classListId = newChar.featureLists.push({ id: generateId(), name: `Class: ${className}` }) - 1;
  const classListDef = newChar.featureLists[classListId];

  // Set saving throw proficiencies
  const { saves: classSaves } = getClassSkillsAndSaves(wizardState.classRecord);
  classSaves.forEach(s => {
    const key = attrMap[s] || s.toLowerCase().slice(0,3);
    newChar.savesProficiency[key] = 1;
  });

  // Set class skills in skillsProficiency directly
  wizardState.classSkills.forEach(s => {
    const key = getSkillKey(s);
    newChar.skillsProficiency[key] = 1;
  });

  // Level 1 Features & Counters
  const lvl1Als = wizardState.classRecord.autolevels?.filter(al => al.level === 1) || [];
  lvl1Als.forEach(al => {
    if (al.features) {
      al.features.forEach(f => {
        if (wizardState.classFeaturesChosen.includes(f.name)) {
          newChar.features.push({
            name: f.name,
            active: true,
            favorite: false,
            selected: true,
            id: generateId(),
            listId: classListDef.id,
            texts: f.texts || [],
            modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
          });
        }
      });
    }

    // Copy counters
    if (al.counters) {
      al.counters.forEach(c => {
        newChar.counters.push({
          name: c.name,
          max: parseInt(c.value) || 1,
          value: parseInt(c.value) || 1,
          reset_short: c.reset === 'S',
          reset_long: c.reset === 'L' || c.reset === 'S',
          id: generateId(),
          classTag: className
        });
      });
    }
  });

  // If spellcaster class, create spell list
  let classSpellListId = null;
  if (spellAbility) {
    const listName = `${className} Spells`;
    newChar.spellLists.push({
      id: generateId(),
      name: listName,
      spellcastingAbility: spellAbility.toLowerCase()
    });
    classSpellListId = newChar.spellLists[newChar.spellLists.length - 1].id;
  }

  // Set classes array entry
  newChar.classes = [
    {
      name: className,
      level: 1,
      subclass: null,
      hd: wizardState.classRecord.hd || 8,
      spellAbility: spellAbility ? spellAbility.toLowerCase() : null,
      featureListId: classListDef.id,
      subclassListId: null,
      spellListId: classSpellListId,
      subclassSpellListId: null
    }
  ];

  await saveCharacterToDb(newChar);
  closeWizard();
  
  await refreshCharactersList();
  openCharacterSheet(newChar);
}

// Helper maps
const attrMap = { 'Strength': 'str', 'Dexterity': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Wisdom': 'wis', 'Charisma': 'cha' };
const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function getSkillKey(skillName) {
  return skillName.toLowerCase().replace(/[^a-z0-9]+/g, '_').trim();
}

function calculatePointBuyRemaining(stats) {
  let spent = 0;
  for (const attr of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    const score = stats[attr] || 8;
    if (score < 8) spent += 0;
    else if (score > 15) spent += 9;
    else spent += POINT_BUY_COSTS[score] || 0;
  }
  return 27 - spent;
}

function getClassSkillsAndSaves(classRecord) {
  if (!classRecord || !classRecord.proficiency) {
    return { saves: [], skills: [] };
  }
  const parts = classRecord.proficiency.split(',').map(s => s.trim());
  const attributesFull = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  const saves = parts.filter(p => attributesFull.includes(p));
  const skills = parts.filter(p => !attributesFull.includes(p));
  return { saves, skills };
}

// ─── Level Up Flow ───────────────────────────────────────────────────────────
let levelUpState = null;

function openLevelUpModal(char) {
  ensureCharacterLists(char);
  
  levelUpState = {
    char: char,
    step: 'choose_class', // 'choose_class' | 'level_details'
    selectedClassEntry: null,
    newMulticlassRecord: null,
    hpRoll: 5,
    chosenFeatures: [],
    selectedSubclass: null,
    statIncreases: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  };

  const modal = document.getElementById('cs-levelup-modal');
  modal.style.display = 'flex';
  renderLevelUpModal();
}

function renderLevelUpModal() {
  const body = document.getElementById('cs-levelup-body');
  body.innerHTML = '';

  const applyBtn = document.getElementById('cs-levelup-btn-apply');
  applyBtn.style.display = levelUpState.step === 'level_details' ? '' : 'none';

  if (levelUpState.step === 'choose_class') {
    renderLevelUpChooseClass(body);
  } else if (levelUpState.step === 'level_details') {
    renderLevelUpDetails(body);
  }
}

function renderLevelUpChooseClass(body) {
  const currentClasses = levelUpState.char.classes || [];
  const allClasses = allRecordsCache['classes'] || [];

  // Filter multiclass options to classes not already taken (or allow multiclassing into anything)
  const multiclassOptions = allClasses.filter(c => !currentClasses.some(cc => cc.name.toLowerCase() === c.name.toLowerCase()));

  body.innerHTML = `
    <h3 style="font-family:var(--font-header);font-size:18px;margin-bottom:12px;color:var(--text-primary);">Level Up / Multiclass Selection</h3>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">Choose a class to gain a level in, or select a new class to multiclass.</p>
    
    <h4 class="cs-levelup-section-title">Current Classes</h4>
    <div class="cs-levelup-classes">
      ${currentClasses.map(cc => `
        <div class="cs-levelup-class-card" data-class="${cc.name}">
          <div class="cs-levelup-class-name">${cc.name}</div>
          <div class="cs-levelup-class-level">Level ${cc.level}</div>
          <button type="button" class="cs-btn-main btn-lvlup-select" data-class="${cc.name}" style="margin-top:12px;padding:6px;width:100%;">Level Up (+1)</button>
        </div>
      `).join('')}
    </div>

    <h4 class="cs-levelup-section-title" style="margin-top:28px;">Multiclass (Add New Class)</h4>
    <div class="cs-levelup-classes">
      ${multiclassOptions.map(c => `
        <div class="cs-levelup-class-card cs-levelup-add-class-card" data-class="${c.name}">
          <div class="cs-levelup-class-name">+ ${c.name}</div>
          <div class="cs-levelup-class-level">Hit Die: d${c.hd}</div>
          <button type="button" class="cs-btn-small btn-lvlup-multi-select" data-class="${c.name}" style="margin-top:12px;padding:6px;width:100%;">Add Class</button>
        </div>
      `).join('')}
    </div>
  `;

  // Wire buttons
  body.querySelectorAll('.btn-lvlup-select').forEach(btn => {
    btn.onclick = () => {
      const clsName = btn.getAttribute('data-class');
      levelUpState.selectedClassEntry = currentClasses.find(cc => cc.name === clsName);
      levelUpState.newMulticlassRecord = null;
      
      const classRecord = allClasses.find(c => c.name.toLowerCase() === clsName.toLowerCase());
      levelUpState.hpRoll = Math.floor((classRecord ? classRecord.hd : 8) / 2) + 1;
      
      levelUpState.step = 'level_details';
      renderLevelUpModal();
    };
  });

  body.querySelectorAll('.btn-lvlup-multi-select').forEach(btn => {
    btn.onclick = () => {
      const clsName = btn.getAttribute('data-class');
      levelUpState.newMulticlassRecord = allClasses.find(c => c.name === clsName);
      levelUpState.selectedClassEntry = null;
      levelUpState.hpRoll = Math.floor(levelUpState.newMulticlassRecord.hd / 2) + 1;
      
      levelUpState.step = 'level_details';
      renderLevelUpModal();
    };
  });
}

function renderLevelUpDetails(body) {
  const isMulticlass = !!levelUpState.newMulticlassRecord;
  const classRecord = isMulticlass 
    ? levelUpState.newMulticlassRecord 
    : allRecordsCache['classes']?.find(c => c.name.toLowerCase() === levelUpState.selectedClassEntry.name.toLowerCase());
    
  const currentLevel = isMulticlass ? 0 : levelUpState.selectedClassEntry.level;
  const targetLevel = currentLevel + 1;
  const hd = classRecord ? classRecord.hd : 8;

  // Find autolevel details for target level (from base class and subclass)
  const baseAls = classRecord ? classRecord.autolevels?.filter(a => a.level === targetLevel) || [] : [];
  const baseFeatures = baseAls.flatMap(al => al.features || []);

  let subFeatures = [];
  const currentSubclassName = isMulticlass ? null : levelUpState.selectedClassEntry.subclass;
  if (currentSubclassName) {
    const subclassRecord = allRecordsCache['subclasses']?.find(s => s.name.toLowerCase() === currentSubclassName.toLowerCase());
    if (subclassRecord) {
      const subAls = subclassRecord.autolevels?.filter(a => a.level === targetLevel) || [];
      subFeatures = subAls.flatMap(al => al.features || []);
    }
  }

  const features = [...baseFeatures, ...subFeatures];
  
  // Update state with level up features (checked by default, excluding optional features)
  levelUpState.chosenFeatures = features.filter(f => !f.optional).map(f => f.name);

  // Check if subclass choice is required (typically level 3 and no subclass selected yet)
  const needsSubclass = targetLevel === 3 && (isMulticlass || !levelUpState.selectedClassEntry.subclass);

  // Check if level grants ASI (contains features like "Ability Score Improvement" or "Feat")
  const hasASI = features.some(f => f.name.includes('Ability Score') || f.name.includes('Feat') || f.name.includes('Improvement') || f.name.includes('Increase') || f.name.includes('ASI'));

  let subclassHtml = '';
  if (needsSubclass) {
    const subclasses = allRecordsCache['subclasses']?.filter(s => s.parentClass.toLowerCase() === classRecord.name.toLowerCase()) || [];
    subclassHtml = `
      <div class="cs-levelup-section">
        <h4 class="cs-levelup-section-title">Select Subclass / Archetype</h4>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">This class unlocks a subclass at Level 3. Select one from below:</p>
        <div class="cs-levelup-subclass-picker">
          <div class="cs-levelup-subclass-list">
            ${subclasses.map((s, idx) => `
              <div class="cs-levelup-subclass-item ${levelUpState.selectedSubclass === s ? 'active' : ''}" data-idx="${idx}">${s.name}</div>
            `).join('')}
          </div>
          <div class="cs-levelup-subclass-detail" id="levelup-subclass-detail-pane">
            <div style="text-align:center;color:var(--text-muted);padding-top:40px;">Select a subclass to view details.</div>
          </div>
        </div>
      </div>
    `;
  }

  const hpGainHtml = `
    <div class="cs-levelup-section">
      <h4 class="cs-levelup-section-title">Hit Point Increase</h4>
      <div class="cs-wizard-hp-prompt" style="margin-top:0;">
        <div>
          <span class="cs-wizard-hp-die-label">Hit Die:</span>
          <span class="cs-wizard-hp-die">d${hd}</span>
        </div>
        <div class="cs-wizard-hp-input-wrap">
          <label style="font-size:12px;color:var(--text-muted);">HP gained this level:</label>
          <input type="number" class="cs-wizard-hp-input" id="levelup-hp-input" min="1" max="100" value="${levelUpState.hpRoll}">
        </div>
      </div>
    </div>
  `;

  const featuresHtml = features.length > 0
    ? `
      <div class="cs-levelup-section">
        <h4 class="cs-levelup-section-title">Features Gained at Level ${targetLevel}</h4>
        <div class="cs-levelup-feature-list">
          ${features.map(f => {
            const isChecked = levelUpState.chosenFeatures.includes(f.name);
            const badge = f.optional ? `<span class="cs-levelup-feature-badge">Optional</span>` : '';
            return `
              <div class="cs-levelup-feature-item ${f.optional ? 'optional' : ''} ${isChecked ? 'checked' : ''}" id="levelup-feat-item-${f.name.replace(/[^a-zA-Z0-9]/g,'')}">
                <input type="checkbox" class="wizard-class-feature-chk" data-name="${f.name}" ${isChecked ? 'checked' : ''}>
                <div style="margin-left:4px;">
                  <div class="cs-levelup-feature-name">${f.name} ${badge}</div>
                  <div class="cs-levelup-feature-desc">${f.texts ? parseMarkdown(f.texts.join('\n')) : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `
    : '';

  // ASI Section (honor system, allows adding direct points to base stats or feat choice)
  const asiHtml = hasASI
    ? `
      <div class="cs-levelup-section">
        <h4 class="cs-levelup-section-title">Ability Score Improvement / Feat</h4>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">This level grants an Ability Score Improvement or Feat. You can adjust your base stats below directly, or leave them at 0 if you are taking a feat on your sheet.</p>
        <div class="cs-wizard-asi-grid">
          ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => {
            const val = levelUpState.statIncreases[attr] || 0;
            return `
              <div class="cs-wizard-asi-btn ${val > 0 ? 'selected' : ''}" id="levelup-asi-btn-${attr}">
                <span class="cs-wizard-asi-btn-label">${attr}</span>
                <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:4px;">
                  <button type="button" class="cs-btn-small btn-lvl-asi-dec" data-attr="${attr}" style="padding:2px 8px;font-size:12px;">−</button>
                  <span class="cs-wizard-asi-btn-val" id="levelup-asi-val-${attr}">${val >= 0 ? '+' + val : val}</span>
                  <button type="button" class="cs-btn-small btn-lvl-asi-inc" data-attr="${attr}" style="padding:2px 8px;font-size:12px;">+</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `
    : '';

  body.innerHTML = `
    <div style="border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h3 style="font-family:var(--font-header);font-size:20px;color:var(--text-primary);margin:0;">Level up to ${classRecord.name} Level ${targetLevel}</h3>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${isMulticlass ? 'Starting as a multiclass character.' : 'Advancing your class level.'}</div>
      </div>
      <button type="button" class="cs-btn-small" id="levelup-btn-back" style="font-size:12px;">← Back to Classes</button>
    </div>

    ${hpGainHtml}
    ${subclassHtml}
    ${asiHtml}
    ${featuresHtml}
  `;

  // Wire HP input
  const hpInput = body.querySelector('#levelup-hp-input');
  hpInput.oninput = () => { levelUpState.hpRoll = Math.max(1, parseInt(hpInput.value) || 1); };

  // Wire Back Button
  body.querySelector('#levelup-btn-back').onclick = () => {
    levelUpState.step = 'choose_class';
    renderLevelUpModal();
  };

  // Wire Subclass Picker
  if (needsSubclass) {
    const subclasses = allRecordsCache['subclasses']?.filter(s => s.parentClass.toLowerCase() === classRecord.name.toLowerCase()) || [];
    const items = body.querySelectorAll('.cs-levelup-subclass-item');
    const detailPane = body.querySelector('#levelup-subclass-detail-pane');

    const selectSubclass = (idx) => {
      const sub = subclasses[idx];
      levelUpState.selectedSubclass = sub;
      items.forEach((item, i) => {
        item.classList.toggle('active', i === idx);
      });

      // Show subclass features preview
      const subLvl3 = sub.autolevels?.find(al => al.level === 3);
      const subTraits = subLvl3 ? subLvl3.features : [];

      detailPane.innerHTML = `
        <h4 style="margin:0 0 4px 0;font-size:15px;color:var(--accent-color);font-family:var(--font-header);">${sub.name}</h4>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Subclass of ${classRecord.name}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${subTraits.map(t => `
            <div style="background:var(--panel-bg-hover);border:1px solid var(--border-color);border-radius:6px;padding:8px 12px;">
              <strong style="font-size:13px;display:block;color:var(--text-primary);">${t.name}</strong>
              <span style="font-size:12px;color:var(--text-secondary);line-height:1.4;margin-top:2px;display:block;">${t.texts ? parseMarkdown(t.texts.join('\n')) : ''}</span>
            </div>
          `).join('')}
        </div>
      `;
    };

    items.forEach(item => {
      item.onclick = () => {
        const idx = parseInt(item.getAttribute('data-idx'));
        selectSubclass(idx);
      };
    });

    if (levelUpState.selectedSubclass) {
      const activeIdx = subclasses.findIndex(s => s === levelUpState.selectedSubclass);
      if (activeIdx >= 0) selectSubclass(activeIdx);
    }
  }

  // Wire ASI Dec/Inc buttons
  if (hasASI) {
    body.querySelectorAll('.btn-lvl-asi-dec').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const attr = btn.getAttribute('data-attr');
        levelUpState.statIncreases[attr] = Math.max(-5, (levelUpState.statIncreases[attr] || 0) - 1);
        const card = body.querySelector(`#levelup-asi-btn-${attr}`);
        const valSpan = body.querySelector(`#levelup-asi-val-${attr}`);
        valSpan.textContent = levelUpState.statIncreases[attr] >= 0 ? '+' + levelUpState.statIncreases[attr] : levelUpState.statIncreases[attr];
        card.classList.toggle('selected', levelUpState.statIncreases[attr] !== 0);
      };
    });

    body.querySelectorAll('.btn-lvl-asi-inc').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const attr = btn.getAttribute('data-attr');
        levelUpState.statIncreases[attr] = Math.min(5, (levelUpState.statIncreases[attr] || 0) + 1);
        const card = body.querySelector(`#levelup-asi-btn-${attr}`);
        const valSpan = body.querySelector(`#levelup-asi-val-${attr}`);
        valSpan.textContent = levelUpState.statIncreases[attr] >= 0 ? '+' + levelUpState.statIncreases[attr] : levelUpState.statIncreases[attr];
        card.classList.toggle('selected', levelUpState.statIncreases[attr] !== 0);
      };
    });
  }

  // Wire feature chks
  body.querySelectorAll('.wizard-class-feature-chk').forEach(chk => {
    chk.onchange = () => {
      const name = chk.getAttribute('data-name');
      const card = body.querySelector(`#levelup-feat-item-${name.replace(/[^a-zA-Z0-9]/g,'')}`);
      if (chk.checked) {
        if (!levelUpState.chosenFeatures.includes(name)) levelUpState.chosenFeatures.push(name);
        if (card) card.classList.add('checked');
      } else {
        levelUpState.chosenFeatures = levelUpState.chosenFeatures.filter(x => x !== name);
        if (card) card.classList.remove('checked');
      }
    };
  });
}

function handleLevelUpApply() {
  if (!levelUpState || levelUpState.step !== 'level_details') return;

  const isMulticlass = !!levelUpState.newMulticlassRecord;
  const classRecord = isMulticlass 
    ? levelUpState.newMulticlassRecord 
    : allRecordsCache['classes']?.find(c => c.name.toLowerCase() === levelUpState.selectedClassEntry.name.toLowerCase());
    
  const currentLevel = isMulticlass ? 0 : levelUpState.selectedClassEntry.level;
  const targetLevel = currentLevel + 1;
  const hd = classRecord ? classRecord.hd : 8;

  // If level 3 subclass choice required, verify one is selected
  const needsSubclass = targetLevel === 3 && (isMulticlass || !levelUpState.selectedClassEntry.subclass);
  if (needsSubclass && !levelUpState.selectedSubclass) {
    alert('Please select a subclass.');
    return;
  }

  applyLevelUp(
    levelUpState.char,
    levelUpState.selectedClassEntry,
    classRecord,
    targetLevel,
    levelUpState.chosenFeatures,
    levelUpState.hpRoll,
    levelUpState.selectedSubclass,
    levelUpState.statIncreases
  );
}

async function applyLevelUp(char, existingEntry, classRecord, targetLevel, chosenFeatures, hpGain, selectedSubclass, statIncreases) {
  const isMulticlass = !existingEntry;
  const className = classRecord.name;

  // ── Delta tracking (for level history / respec) ───────────────────────────
  const delta = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    className,
    fromLevel: isMulticlass ? 0 : (existingEntry.level),
    toLevel: targetLevel,
    hpGain,
    addedFeatureIds: [],
    addedCounterIds: [],
    modifiedCounters: [],
    addedFeatureListIds: [],
    addedSpellListIds: [],
    statIncreases: statIncreases ? { ...statIncreases } : {},
    isMulticlass,
    addedSubclassName: selectedSubclass ? selectedSubclass.name : null,
    featureNames: [],
  };

  // Helper: push a feature and track its ID
  function pushFeature(feat) {
    char.features.push(feat);
    delta.addedFeatureIds.push(feat.id);
    delta.featureNames.push(feat.name);
  }

  // Helper: push a counter and track it
  function pushCounter(counterObj) {
    char.counters.push(counterObj);
    delta.addedCounterIds.push(counterObj.id);
  }

  // Helper: modify a counter and record the old values for revert
  function modifyCounter(existing, newMax) {
    delta.modifiedCounters.push({ id: existing.id, oldMax: existing.max, oldValue: existing.value });
    existing.max = newMax;
    existing.value = newMax;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Increment total level
  char.level = (char.level || 1) + 1;
  char.baseHpMax = (char.baseHpMax || 10) + hpGain;
  char.hp.current = (char.hp.current || 10) + hpGain;

  // 2. Adjust baseStats if any statIncreases selected (ASI / Feat)
  if (statIncreases) {
    Object.keys(statIncreases).forEach(attr => {
      const val = statIncreases[attr] || 0;
      if (val !== 0) {
        char.baseStats[attr] = (char.baseStats[attr] || 10) + val;
      }
    });
  }

  // 3. Find or create feature list for this class
  let classListId = existingEntry ? existingEntry.featureListId : null;
  let classSpellListId = existingEntry ? existingEntry.spellListId : null;

  if (isMulticlass) {
    const newList = { id: generateId(), name: `Class: ${className}` };
    char.featureLists.push(newList);
    classListId = newList.id;
    delta.addedFeatureListIds.push(classListId);

    if (classRecord.spellAbility) {
      const newSpellList = {
        id: generateId(),
        name: `${className} Spells`,
        spellcastingAbility: classRecord.spellAbility.toLowerCase()
      };
      char.spellLists.push(newSpellList);
      classSpellListId = newSpellList.id;
      delta.addedSpellListIds.push(classSpellListId);
    }
  }

  // 4. Add level features & counters (base class)
  const baseAls = classRecord.autolevels?.filter(a => a.level === targetLevel) || [];
  baseAls.forEach(al => {
    if (al.features) {
      al.features.forEach(f => {
        if (isMulticlass) {
          if (f.name.toLowerCase().includes('saving throw')) return;
          pushFeature({
            name: f.name, active: true, favorite: false, selected: true,
            id: generateId(), listId: classListId,
            texts: f.texts || [], modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
          });
        } else {
          if (chosenFeatures.includes(f.name)) {
            pushFeature({
              name: f.name, active: true, favorite: false, selected: true,
              id: generateId(), listId: classListId,
              texts: f.texts || [], modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
            });
          }
        }
      });
    }
    if (al.counters) {
      al.counters.forEach(c => {
        const existingCounter = char.counters?.find(cc => cc.name === c.name);
        const newMax = parseInt(c.value) || 1;
        if (!existingCounter) {
          pushCounter({
            name: c.name, max: newMax, value: newMax,
            reset_short: c.reset === 'S', reset_long: c.reset === 'L' || c.reset === 'S',
            id: generateId(), classTag: className
          });
        } else {
          modifyCounter(existingCounter, newMax);
        }
      });
    }
  });

  // 5. Handle subclass selection (declare early so step 4b can use it)
  let subclassFeatureListId = existingEntry ? existingEntry.subclassListId : null;
  let subclassSpellListId = existingEntry ? existingEntry.subclassSpellListId : null;

  // Subclass features of existing subclass (ongoing levels)
  const currentSubclassName = existingEntry ? existingEntry.subclass : null;
  if (currentSubclassName) {
    const subclassRecord = allRecordsCache['subclasses']?.find(s => s.name.toLowerCase() === currentSubclassName.toLowerCase());
    if (subclassRecord) {
      if (!subclassFeatureListId) {
        const newSubList = { id: generateId(), name: `Subclass: ${subclassRecord.name}` };
        char.featureLists.push(newSubList);
        subclassFeatureListId = newSubList.id;
        existingEntry.subclassListId = subclassFeatureListId;
        delta.addedFeatureListIds.push(subclassFeatureListId);
      }
      const subAls = subclassRecord.autolevels?.filter(a => a.level === targetLevel) || [];
      subAls.forEach(al => {
        if (al.features) {
          al.features.forEach(f => {
            if (chosenFeatures.includes(f.name)) {
              pushFeature({
                name: f.name, active: true, favorite: false, selected: true,
                id: generateId(), listId: subclassFeatureListId,
                texts: f.texts || [], modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
              });
            }
          });
        }
        if (al.counters) {
          al.counters.forEach(c => {
            const existingCounter = char.counters?.find(cc => cc.name === c.name);
            const newMax = parseInt(c.value) || 1;
            if (!existingCounter) {
              pushCounter({
                name: c.name, max: newMax, value: newMax,
                reset_short: c.reset === 'S', reset_long: c.reset === 'L' || c.reset === 'S',
                id: generateId(), classTag: className
              });
            } else {
              modifyCounter(existingCounter, newMax);
            }
          });
        }
      });
    }
  }

  // New subclass chosen at this level
  if (selectedSubclass) {
    const newSubList = { id: generateId(), name: `Subclass: ${selectedSubclass.name}` };
    char.featureLists.push(newSubList);
    subclassFeatureListId = newSubList.id;
    delta.addedFeatureListIds.push(subclassFeatureListId);

    const subLvl3Als = selectedSubclass.autolevels?.filter(a => a.level === 3) || [];
    subLvl3Als.forEach(al => {
      if (al.features) {
        al.features.forEach(f => {
          pushFeature({
            name: f.name, active: true, favorite: false, selected: true,
            id: generateId(), listId: subclassFeatureListId,
            texts: f.texts || [], modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
          });
        });
      }
    });

    char.subclass = selectedSubclass.name;

    const spellAbility = selectedSubclass.spellAbility || classRecord.spellAbility;
    if (spellAbility && !classSpellListId) {
      const newSpellList = {
        id: generateId(),
        name: `${selectedSubclass.name} Spells`,
        spellcastingAbility: spellAbility.toLowerCase()
      };
      char.spellLists.push(newSpellList);
      subclassSpellListId = newSpellList.id;
      delta.addedSpellListIds.push(subclassSpellListId);
    }
  }

  // 6. Update class entry inside classes array
  if (isMulticlass) {
    char.classes.push({
      name: className,
      level: 1,
      subclass: selectedSubclass ? selectedSubclass.name : null,
      hd: classRecord.hd || 8,
      spellAbility: classRecord.spellAbility ? classRecord.spellAbility.toLowerCase() : null,
      featureListId: classListId,
      subclassListId: subclassFeatureListId,
      spellListId: classSpellListId,
      subclassSpellListId: subclassSpellListId
    });
  } else {
    existingEntry.level = targetLevel;
    if (selectedSubclass) {
      existingEntry.subclass = selectedSubclass.name;
      existingEntry.subclassListId = subclassFeatureListId;
      existingEntry.subclassSpellListId = subclassSpellListId;
    }
  }

  // 7. Update top-level class/level for compatibility
  char.class = char.classes[0].name;
  char._modified_at = new Date().toISOString();

  // 8. Record delta in level history
  if (!char.levelHistory) char.levelHistory = [];
  char.levelHistory.push(delta);

  await saveCharacterToDb(char);
  document.getElementById('cs-levelup-modal').style.display = 'none';

  if (currentCharacter && currentCharacter.name === char.name) {
    currentCharacter = char;
    renderCharacterSheetUI();
  }
  await refreshCharactersList();
}

// ─── Picker State ────────────────────────────────────────────────────────────
let pickerActive = false;
let pickerCategory = '';         // 'feats' | 'items' | 'spells' | 'monsters'
let pickerTargetListId = null;   // listId to add into (null = default/first list)

const MULTICLASS_SLOTS = [
  [2], // 1
  [3], // 2
  [4, 2], // 3
  [4, 3], // 4
  [4, 3, 2], // 5
  [4, 3, 3], // 6
  [4, 3, 3, 1], // 7
  [4, 3, 3, 2], // 8
  [4, 3, 3, 3, 1], // 9
  [4, 3, 3, 3, 2], // 10
  [4, 3, 3, 3, 2, 1], // 11
  [4, 3, 3, 3, 2, 1], // 12
  [4, 3, 3, 3, 2, 1, 1], // 13
  [4, 3, 3, 3, 2, 1, 1], // 14
  [4, 3, 3, 3, 2, 1, 1, 1], // 15
  [4, 3, 3, 3, 2, 1, 1, 1], // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1]  // 20
];

const WARLOCK_PACT_SLOTS = {
  1: { count: 1, level: 1 },
  2: { count: 2, level: 1 },
  3: { count: 2, level: 2 },
  4: { count: 2, level: 2 },
  5: { count: 2, level: 3 },
  6: { count: 2, level: 3 },
  7: { count: 2, level: 4 },
  8: { count: 2, level: 4 },
  9: { count: 2, level: 5 },
  10: { count: 2, level: 5 },
  11: { count: 3, level: 5 },
  12: { count: 3, level: 5 },
  13: { count: 3, level: 5 },
  14: { count: 3, level: 5 },
  15: { count: 3, level: 5 },
  16: { count: 3, level: 5 },
  17: { count: 4, level: 5 },
  18: { count: 4, level: 5 },
  19: { count: 4, level: 5 },
  20: { count: 4, level: 5 }
};

function calculateCharacterSlots(char) {
  const slots = {};
  for (let l = 1; l <= 9; l++) {
    slots[l] = 0;
  }

  if (!char.classes || char.classes.length === 0) {
    return slots;
  }

  const activeWarlock = char.classes.find(cc => cc.name.toLowerCase() === 'warlock');

  if (char.classes.length === 1) {
    const cc = char.classes[0];
    const clsRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === cc.name.toLowerCase());
    if (clsRecord) {
      if (cc.name.toLowerCase() === 'warlock') {
        const pact = WARLOCK_PACT_SLOTS[cc.level];
        if (pact) {
          slots[pact.level] = pact.count;
        }
        return slots;
      }

      if (clsRecord.slotsTable) {
        const slotsRow = clsRecord.slotsTable.find(st => st.level === cc.level);
        if (slotsRow && slotsRow.slots) {
          const classSlots = slotsRow.slots.split(',').map(Number);
          for (let i = 0; i < classSlots.length; i++) {
            slots[i + 1] = classSlots[i];
          }
          return slots;
        }
      }
    }
  }

  // Sum effective caster levels
  let fullCasterLevels = 0;
  let halfCasterLevels = 0;
  let thirdCasterLevels = 0;

  char.classes.forEach(cc => {
    const nameLower = cc.name.toLowerCase();
    if (nameLower === 'warlock') {
      return;
    }

    const clsRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === nameLower);
    if (!clsRecord) return;

    const isFull = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(nameLower);
    const isHalf = ['artificer', 'paladin', 'ranger'].includes(nameLower);
    
    let isThird = false;
    if (cc.subclass) {
      const subNameLower = cc.subclass.toLowerCase();
      if (subNameLower === 'eldritch knight' || subNameLower === 'arcane trickster') {
        isThird = true;
      }
    }

    if (isFull) {
      fullCasterLevels += cc.level;
    } else if (isHalf) {
      halfCasterLevels += cc.level;
    } else if (isThird) {
      thirdCasterLevels += cc.level;
    } else {
      if (clsRecord.spellAbility) {
        fullCasterLevels += cc.level;
      }
    }
  });

  // Calculate standard effective caster level
  let effectiveLevel = fullCasterLevels;
  
  char.classes.forEach(cc => {
    const nameLower = cc.name.toLowerCase();
    if (['artificer', 'paladin', 'ranger'].includes(nameLower)) {
      effectiveLevel += Math.ceil(cc.level / 2);
    }
  });

  char.classes.forEach(cc => {
    if (cc.subclass) {
      const subNameLower = cc.subclass.toLowerCase();
      if (subNameLower === 'eldritch knight' || subNameLower === 'arcane trickster') {
        effectiveLevel += Math.floor(cc.level / 3);
      }
    }
  });

  if (effectiveLevel > 20) effectiveLevel = 20;

  if (effectiveLevel > 0) {
    const standardSlots = MULTICLASS_SLOTS[effectiveLevel - 1];
    if (standardSlots) {
      for (let i = 0; i < standardSlots.length; i++) {
        slots[i + 1] = standardSlots[i];
      }
    }
  }

  // Separately determine Warlock Pact Magic slots
  if (activeWarlock) {
    const pact = WARLOCK_PACT_SLOTS[activeWarlock.level];
    if (pact) {
      slots[pact.level] = (slots[pact.level] || 0) + pact.count;
    }
  }

  return slots;
}

// ─── List Helpers ─────────────────────────────────────────────────────────────
function ensureCharacterLists(char) {
  if (!char.featureLists) {
    char.featureLists = [{ id: generateId(), name: 'Feats' }];
  } else {
    char.featureLists.forEach(list => {
      if (list.name === 'Features & Traits' || list.name === 'Features and Traits') {
        list.name = 'Feats';
      }
    });
  }
  if (!char.itemLists)     char.itemLists     = [{ id: generateId(), name: 'Inventory' }];
  if (!char.spellLists)    char.spellLists    = [];
  if (!char.bestiaryLists) char.bestiaryLists = [{ id: generateId(), name: 'Companions & Summons' }];
  
  if (!char.classes) char.classes = [];
  if (char.classes.length === 0 && char.class) {
    const classRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === char.class.toLowerCase());
    char.classes.push({
      name: char.class,
      level: parseInt(char.level) || 1,
      subclass: char.subclass || null,
      hd: classRecord ? parseInt(classRecord.hd) || 8 : 8,
      spellAbility: classRecord ? classRecord.spellAbility || null : null,
      featureListId: char.featureLists[0]?.id || generateId(),
      subclassListId: null,
      spellListId: null,
      subclassSpellListId: null
    });
  }

  // Dynamically determine what spell lists the character should have
  const expectedLists = [];
  
  // 1. Classes and Subclasses
  if (char.classes) {
    char.classes.forEach(cc => {
      // Parent class spellcasting
      const classRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === cc.name.toLowerCase());
      if (classRecord && classRecord.spellAbility) {
        expectedLists.push({
          name: `${cc.name} Spells`,
          spellcastingAbility: classRecord.spellAbility.toLowerCase(),
          classEntry: cc,
          type: 'class'
        });
      }
      // Subclass spellcasting
      if (cc.subclass) {
        const subclassRecord = allRecordsCache['subclasses']?.find(s => 
          s.name.toLowerCase() === cc.subclass.toLowerCase() && 
          s.parentClass.toLowerCase() === cc.name.toLowerCase()
        );
        if (subclassRecord && subclassRecord.spellAbility) {
          expectedLists.push({
            name: `${cc.subclass} Spells`,
            spellcastingAbility: subclassRecord.spellAbility.toLowerCase(),
            classEntry: cc,
            type: 'subclass'
          });
        }
      }
    });
  }

  // 2. Species/Race
  if (char.species) {
    const raceRecord = allRecordsCache['races']?.find(r => r.name.toLowerCase() === char.species.toLowerCase());
    if (raceRecord && raceRecord.additionalSpells) {
      expectedLists.push({
        name: `${char.species} Spells`,
        spellcastingAbility: 'cha',
        type: 'species'
      });
    }
  }

  // 3. Feats
  if (char.features) {
    char.features.forEach(f => {
      const featRecord = allRecordsCache['feats']?.find(feat => 
        feat.name === f.compendiumId || feat.name === f.name
      );
      if (featRecord && featRecord.additionalSpells) {
        expectedLists.push({
          name: `${featRecord.name} Spells`,
          spellcastingAbility: 'cha',
          type: 'feat'
        });
      }
    });
  }

  // Reconcile spellLists
  const finalSpellLists = [];
  expectedLists.forEach(expected => {
    let existing = char.spellLists.find(l => l.name === expected.name);
    if (!existing) {
      existing = {
        id: generateId(),
        name: expected.name,
        spellcastingAbility: expected.spellcastingAbility
      };
      char.spellLists.push(existing);
    } else {
      if (!existing.spellcastingAbility) {
        existing.spellcastingAbility = expected.spellcastingAbility;
      }
    }
    finalSpellLists.push(existing);

    // Update class entry references
    if (expected.type === 'class' && expected.classEntry) {
      expected.classEntry.spellListId = existing.id;
    } else if (expected.type === 'subclass' && expected.classEntry) {
      expected.classEntry.subclassSpellListId = existing.id;
    }
  });

  // Keep any other lists that have spells in them or don't match the auto-generated naming convention
  char.spellLists.forEach(l => {
    if (finalSpellLists.some(fl => fl.id === l.id)) return;
    const hasSpells = char.spells && char.spells.some(s => s.listId === l.id);
    const isCustom = !l.name.endsWith(' Spells');
    if (hasSpells || isCustom) {
      finalSpellLists.push(l);
    }
  });

  char.spellLists = finalSpellLists;

  // Assign default listId to legacy items that lack one
  const assignListIds = (arr, lists) => {
    if (!arr || !lists.length) return;
    const defaultId = lists[0].id;
    arr.forEach(item => { if (!item.listId) item.listId = defaultId; });
  };
  assignListIds(char.features, char.featureLists);
  assignListIds(char.equipment, char.itemLists);
  assignListIds(char.spells, char.spellLists);
  assignListIds(char.bestiary, char.bestiaryLists);
}

function getItemsForList(arr, listId) {
  return (arr || []).filter(i => i.listId === listId);
}

/**
 * Ensure a loaded character has all Phase 1 fields, backfilling defaults
 * for characters created before Phase 1 was deployed.
 * Safe to call multiple times — only fills missing keys.
 */
function migrateCharacter(char) {
  if (!char.conditions)            char.conditions            = [];
  if (!char.pinnedActions)         char.pinnedActions         = [];
  if (char.attunementMax == null)  char.attunementMax         = 3;
  if (!char.toolProficiencies)     char.toolProficiencies     = [];
  if (char.weightTrackingEnabled == null) char.weightTrackingEnabled = false;
  if (!char.collapsedLists)        char.collapsedLists        = {};
  if (!char.levelHistory)          char.levelHistory          = [];
  if (!char.languages)             char.languages             = [];
  if (!char.otherProficiencies)    char.otherProficiencies    = [];
  if (!char.currency)              char.currency              = { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 };
  if (!char.notes)                 char.notes                 = { freeNotes: [] };
  if (!char.notes.freeNotes)       char.notes.freeNotes       = [];
  if (!char.equipment)             char.equipment             = [];
  if (!char.spells)                char.spells                = [];
  if (!char.features)              char.features              = [];
  if (!char.classes)               char.classes               = [];
  if (!char.itemLists)             char.itemLists             = [];
  if (!char.spellLists)            char.spellLists            = [];
  if (!char.featureLists)          char.featureLists          = [];
  if (!char.bestiary)              char.bestiary              = [];
  if (!char.bestiaryLists)         char.bestiaryLists         = [];
  return char;
}

/** Sort: active first → carried (selected) second → other; then alphabetical within each group */
function sortListItems(items) {
  return [...items].sort((a, b) => {
    const rank = i => i.active ? 0 : (i.selected ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (a.name || '').localeCompare(b.name || '');
  });
}

// ─── SVG icons ───────────────────────────────────────────────────────────────
const SVG_SHIELD = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const SVG_PACK   = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`;
const SVG_TRASH  = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const SVG_SYNC   = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>`;
const SVG_COG    = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const SVG_PLUS   = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// ─── Single row renderer ───────────────────────────────────────────────────────
/**
 * Renders a single-column list row with shield/pack toggles.
 * @param {object} item   - The item object from the character
 * @param {string} type   - 'feature' | 'item' | 'spell' | 'beast'
 * @param {object} opts   - { onActive, onCarried, onDelete, onSync, showSpellPrep, spellLevel }
 */
function renderListRow(item, type, opts = {}) {
  const isActive   = !!item.active;
  const isCarried  = !!item.selected;
  const row = document.createElement('div');
  row.className = 'cs-list-row cs-list-row-interactive';

  if (item.isDynamic) {
    row.innerHTML = `
      <div class="cs-list-row-info" style="cursor: default;">
        <div class="cs-list-row-name">${item.name}</div>
        <div class="cs-list-row-sub">${item.texts[0]}</div>
      </div>
      <div class="cs-list-row-actions"></div>
    `;
    row.querySelector('.cs-list-row-info').onclick = null;
    return row;
  }

  let sub = '';
  if (type === 'item') sub = `${item.weight || 0} lbs · ${item.type || 'Gear'}`;
  else if (type === 'spell') sub = `${item.level === 0 ? 'Cantrip' : 'Level ' + item.level} · ${item.time || '1 Action'}`;
  else if (type === 'feature') sub = `${item.category || ''}`;
  else if (type === 'beast') sub = item.size ? `${item.size} ${item.type || ''}` : (item.notes || '');

  const syncBtn  = (item.compendiumId || item.isOverview)
    ? `<button class="cs-list-row-btn btn-sync" title="${item.isOverview ? 'Resync class features from compendium' : 'Sync with Compendium'}">${SVG_SYNC}</button>`
    : '';

  // Shield toggle = equipped/active; Pack toggle = in carried pack
  // For spells: shield = active effect (concentration etc); pack = prepared
  const shieldActive = isActive  ? 'active equip' : '';
  const packActive   = isCarried ? 'active'        : '';

  row.innerHTML = `
    <div class="cs-list-row-info">
      <div class="cs-list-row-name">${item.name}</div>
      ${sub ? `<div class="cs-list-row-sub">${sub}</div>` : ''}
    </div>
    <div class="cs-list-row-actions">
      <button class="cs-toggle-btn btn-equip ${shieldActive}" title="${type === 'spell' ? 'Active/Concentration' : 'Equipped/Active'}">${SVG_SHIELD}</button>
      <button class="cs-toggle-btn btn-carry ${packActive}" title="${type === 'spell' ? 'Prepared' : 'In Pack/Carried'}">${SVG_PACK}</button>
      ${syncBtn}
      <button class="cs-list-row-btn danger btn-delete" title="Remove">${SVG_TRASH}</button>
    </div>
  `;

  // Click anywhere in the name area → open detail modal
  row.querySelector('.cs-list-row-info').onclick = () => {
    openItemDetailModal(item, type);
  };

  row.querySelector('.btn-equip').onclick = (e) => {
    e.stopPropagation();
    item.active = !item.active;
    if (item.active) item.selected = true; // equipping implies carrying
    if (opts.onActive) opts.onActive(item);
    else saveCurrentCharacterAndRefresh();
  };
  row.querySelector('.btn-carry').onclick = (e) => {
    e.stopPropagation();
    item.selected = !item.selected;
    if (!item.selected) item.active = false; // un-carrying unequips
    if (opts.onCarried) opts.onCarried(item);
    else saveCurrentCharacterAndRefresh();
  };
  if (item.compendiumId || item.isOverview) {
    row.querySelector('.btn-sync').onclick = (e) => {
      e.stopPropagation();
      if (item.isOverview && item.classData) {
        const className = item.classData.parentClass || item.classData.name;
        resyncClassFeatures(className);
      } else {
        const catMap = { feature: 'feats', item: 'items', spell: 'spells', beast: 'monsters' };
        syncLocalEntityWithCompendium(item, catMap[type]);
      }
    };
  }
  row.querySelector('.btn-delete').onclick = (e) => {
    e.stopPropagation();
    if (opts.onDelete) opts.onDelete(item);
    else saveCurrentCharacterAndRefresh();
  };

  return row;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
let detailModalItem = null;
let detailModalType = '';

function openItemDetailModal(item, type) {
  detailModalItem = item;
  detailModalType = type;
  const modal  = document.getElementById('cs-detail-modal');
  const title  = document.getElementById('cs-detail-title');
  const content = document.getElementById('cs-detail-content');

  title.textContent = item.name;
  // Reuse the compendium detail renderer
  const catMap = { feature: 'feats', item: 'items', spell: 'spells', beast: 'monsters' };
  content.innerHTML = getDetailHTML(item, catMap[type] || 'feats');

  // Show sync button only if it came from compendium
  const syncBtn = document.getElementById('cs-detail-btn-sync');
  syncBtn.style.display = item.compendiumId ? 'inline-flex' : 'none';

  modal.style.display = 'flex';
}

// ─── List Section Renderer ────────────────────────────────────────────────────
/**
 * Renders a named list section (card with header + rows) into a container.
 * @param {HTMLElement} container
 * @param {object} listDef      - { id, name, spellcastingAbility? }
 * @param {Array}  items        - All items in this list
 * @param {string} type         - 'feature' | 'item' | 'spell' | 'beast'
 * @param {object} state        - calculateCharacterState result
 * @param {object} opts         - { showSpellInfo }
 */
function renderListSection(container, listDef, items, type, state, opts = {}) {
  const sorted = sortListItems(items);
  const section = document.createElement('div');
  section.className = 'cs-list-section';

  // Build header meta
  let headerMeta = `${items.length} items`;
  if (type === 'spell' && listDef.spellcastingAbility) {
    const ab = listDef.spellcastingAbility;
    const mod = state[`${ab}.mod`] || 0;
    const pb  = state['prof_bonus'] || 2;
    const dc  = 8 + pb + mod;
    const atk = pb + mod;
    headerMeta = `DC ${dc} · Atk ${atk >= 0 ? '+' : ''}${atk} · ${items.length} spells`;
  }
  if (type === 'item') {
    let wt = 0;
    items.forEach(i => { if (i.active || i.selected) wt += (parseFloat(i.weight) || 0); });
    headerMeta = `${wt.toFixed(1)} lbs carried · ${items.length} items`;
  }

  section.innerHTML = `
    <div class="cs-list-section-header" data-list-id="${listDef.id}">
      <h3>${listDef.name}</h3>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="cs-list-section-header-meta">${headerMeta}</span>
        <button class="cs-list-row-btn btn-add-to-list" title="Add to List" data-list-id="${listDef.id}">${SVG_PLUS}</button>
        <button class="cs-list-row-btn btn-config-list" title="Configure List" data-list-id="${listDef.id}">${SVG_COG}</button>
      </div>
    </div>
    <div class="cs-list-section-body"></div>
  `;

  section.querySelector('.btn-add-to-list').onclick = (e) => {
    e.stopPropagation();
    const catMap = { feature: 'feats', item: 'items', spell: 'spells', beast: 'monsters' };
    openPicker(catMap[type], listDef.id);
  };

  section.querySelector('.btn-config-list').onclick = (e) => {
    e.stopPropagation();
    openListConfigModal(listDef, type);
  };

  const body = section.querySelector('.cs-list-section-body');
  if (sorted.length === 0) {
    body.innerHTML = `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">Empty. Click + Add to add from compendium.</div>`;
  } else {
    sorted.forEach(item => {
      const catArr = type === 'feature' ? currentCharacter.features
                   : type === 'item'    ? currentCharacter.equipment
                   : type === 'spell'   ? currentCharacter.spells
                   :                      currentCharacter.bestiary;
      const row = renderListRow(item, type, {
        onDelete: () => {
          const idx = catArr.findIndex(e => e.id === item.id);
          if (idx >= 0) catArr.splice(idx, 1);
          saveCurrentCharacterAndRefresh();
        }
      });
      body.appendChild(row);
    });
  }

  container.appendChild(section);
}

// ─── List Config Modal ────────────────────────────────────────────────────────
let listConfigTarget = null; // { listDef, type }

function openListConfigModal(listDef, type, isNew = false) {
  listConfigTarget = { listDef, type, isNew };
  const modal = document.getElementById('cs-list-config-modal');
  document.getElementById('cs-list-config-title').textContent = isNew ? 'New List' : 'Configure List';
  document.getElementById('cs-list-config-name-input').value = listDef.name;

  const abilityGroup = document.getElementById('cs-list-config-ability-group');
  if (type === 'spell') {
    abilityGroup.style.display = '';
    document.getElementById('cs-list-config-ability-select').value = listDef.spellcastingAbility || 'wis';
  } else {
    abilityGroup.style.display = 'none';
  }
  const delBtn = document.getElementById('cs-list-config-btn-delete');
  delBtn.style.display = isNew ? 'none' : '';

  modal.style.display = 'flex';
}

function saveListConfig() {
  if (!listConfigTarget) return;
  const { listDef, type, isNew } = listConfigTarget;
  const name = document.getElementById('cs-list-config-name-input').value.trim();
  if (!name) return;

  listDef.name = name;
  if (type === 'spell') {
    listDef.spellcastingAbility = document.getElementById('cs-list-config-ability-select').value;
  }

  if (isNew) {
    if (type === 'feature')  currentCharacter.featureLists.push(listDef);
    else if (type === 'item')  currentCharacter.itemLists.push(listDef);
    else if (type === 'spell') currentCharacter.spellLists.push(listDef);
    else if (type === 'beast') currentCharacter.bestiaryLists.push(listDef);
  }

  document.getElementById('cs-list-config-modal').style.display = 'none';
  listConfigTarget = null;
  saveCurrentCharacterAndRefresh();
}

function deleteListAndItems() {
  if (!listConfigTarget) return;
  const { listDef, type } = listConfigTarget;

  // Remove the list definition
  const listArrMap = { feature: 'featureLists', item: 'itemLists', spell: 'spellLists', beast: 'bestiaryLists' };
  const itemArrMap = { feature: 'features', item: 'equipment', spell: 'spells', beast: 'bestiary' };
  const listArr = currentCharacter[listArrMap[type]];
  const itemArr = currentCharacter[itemArrMap[type]];

  const listIdx = listArr.findIndex(l => l.id === listDef.id);
  if (listIdx >= 0) listArr.splice(listIdx, 1);

  // Remove all items in this list
  if (itemArr) {
    for (let i = itemArr.length - 1; i >= 0; i--) {
      if (itemArr[i].listId === listDef.id) itemArr.splice(i, 1);
    }
  }

  document.getElementById('cs-list-config-modal').style.display = 'none';
  listConfigTarget = null;
  saveCurrentCharacterAndRefresh();
}

function isItemRelevantForPicker(item) {
  if (!pickerActive) return true;
  if (!item) return false;
  let itemCategory = currentCategory;
  if (item.categoryType) {
    if (item.categoryType === 'class-feature') itemCategory = 'feats';
    else if (item.categoryType === 'class-overview') itemCategory = 'classes';
    else itemCategory = item.categoryType + 's';
  }
  
  if (pickerCategory === 'items') return itemCategory === 'items';
  if (pickerCategory === 'spells') return itemCategory === 'spells';
  if (pickerCategory === 'feats' || pickerCategory === 'options') {
    return itemCategory === 'feats' || itemCategory === 'options' || itemCategory === 'classes';
  }
  if (pickerCategory === 'monsters') return itemCategory === 'monsters';
  return false;
}

function updateSidebarVisibility() {
  menuItems.forEach(item => {
    const cat = item.getAttribute('data-category');
    if (!pickerActive) {
      item.style.display = '';
      return;
    }
    if (cat === 'favorites') {
      item.style.display = '';
      return;
    }
    
    let allowed = [];
    if (pickerCategory === 'items') allowed = ['items'];
    else if (pickerCategory === 'spells') allowed = ['spells'];
    else if (pickerCategory === 'feats' || pickerCategory === 'options') allowed = ['feats', 'options'];
    else if (pickerCategory === 'monsters') allowed = ['monsters'];
    
    if (allowed.includes(cat)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// ─── Picker & Add to Character Selection ──────────────────────────────────────
async function openPicker(category, targetListId = null) {
  pickerActive = true;
  pickerTargetListId = targetListId;
  pickerCategory = category;

  let mainCategory = category;
  if (category === 'feats' || category === 'options') {
    mainCategory = category;
  }

  // Highlight appropriate menu item in sidebar
  menuItems.forEach(mi => {
    mi.classList.toggle('active', mi.getAttribute('data-category') === mainCategory);
  });

  updateSidebarVisibility();

  // Load the category in the main Compendium
  await loadCategory(mainCategory);

  // Show "Back to Sheet" button on sidebar
  const sidebarBackBtn = document.getElementById('sidebar-back-to-sheet');
  if (sidebarBackBtn) {
    sidebarBackBtn.style.display = 'block';
  }

  // Hide character sheet view to reveal compendium
  document.getElementById('character-sheet-view').style.display = 'none';

  updateDetailFooterUI();
}

function closePickerAndReturn() {
  pickerActive = false;
  pickerTargetListId = null;

  updateSidebarVisibility();

  // Hide the back-to-sheet button
  const sidebarBackBtn = document.getElementById('sidebar-back-to-sheet');
  if (sidebarBackBtn) {
    sidebarBackBtn.style.display = 'none';
  }

  // Hide pane detail footer
  const footer = document.getElementById('pane-detail-footer');
  if (footer) {
    footer.style.display = 'none';
  }

  // Highlight Characters category in sidebar
  menuItems.forEach(mi => {
    mi.classList.toggle('active', mi.getAttribute('data-category') === 'characters');
  });

  // Re-open character sheet
  document.getElementById('character-sheet-view').style.display = 'flex';
  renderCharacterSheetUI();
}

function updateDetailFooterUI() {
  const footer = document.getElementById('pane-detail-footer');
  const addBtn = document.getElementById('pane-detail-btn-add');
  const statusDiv = document.getElementById('pane-detail-status');

  if (!footer) return;

  if (pickerActive && selectedItem && currentCharacter && isItemRelevantForPicker(selectedItem)) {
    footer.style.display = 'flex';

    // Status on character: Active/Carried/Stored
    const getItemState = (rec, category) => {
      if (!currentCharacter) return null;
      const arrMap = { feats: 'features', options: 'features', items: 'equipment', spells: 'spells', monsters: 'bestiary', 'class-feature': 'features' };
      const arr = currentCharacter[arrMap[category]] || [];
      const match = arr.find(i => i.compendiumId === rec.name || i.name === rec.name);
      if (!match) return null;
      if (match.active)   return 'Active';
      if (match.selected) return 'Carried';
      return 'Stored';
    };

    let statusCategory = currentCategory;
    if (selectedItem.categoryType) {
      if (selectedItem.categoryType === 'class-feature') statusCategory = 'feats';
      else if (selectedItem.categoryType === 'class-overview') statusCategory = 'classes';
      else statusCategory = selectedItem.categoryType + 's';
    }

    const stateStr = getItemState(selectedItem, statusCategory);
    if (stateStr) {
      statusDiv.innerHTML = `Status on character: <strong>${stateStr}</strong>`;
    } else {
      statusDiv.innerHTML = '';
    }

    // Set Add Button text
    let targetListName = '';
    if (pickerTargetListId) {
      const allLists = [
        ...(currentCharacter.featureLists || []),
        ...(currentCharacter.itemLists || []),
        ...(currentCharacter.spellLists || []),
        ...(currentCharacter.bestiaryLists || [])
      ];
      const matchLst = allLists.find(l => l.id === pickerTargetListId);
      if (matchLst) targetListName = matchLst.name;
    }

    if (targetListName) {
      addBtn.textContent = `Add to ${targetListName}`;
    } else {
      addBtn.textContent = 'Add to Character';
    }
  } else {
    footer.style.display = 'none';
  }
}

function addSelectedItemToCharacter() {
  if (!selectedItem || !currentCharacter) return;

  let category = currentCategory;
  if (selectedItem.categoryType) {
    if (selectedItem.categoryType === 'class-feature') category = 'feats';
    else if (selectedItem.categoryType === 'option') category = 'options';
    else if (selectedItem.categoryType === 'feat') category = 'feats';
    else if (selectedItem.categoryType === 'item') category = 'items';
    else if (selectedItem.categoryType === 'spell') category = 'spells';
    else if (selectedItem.categoryType === 'monster') category = 'monsters';
  }

  addCompendiumEntityToCharacter(selectedItem, category);
  updateDetailFooterUI();
}

function addCompendiumEntityToCharacter(record, category) {
  const clone = JSON.parse(JSON.stringify(record));
  clone.compendiumId = record.name;
  clone.favorite     = false;
  clone.selected     = true;
  clone.active       = false;
  clone.id           = generateId();

  ensureCharacterLists(currentCharacter);

  if (category === 'items') {
    const listId = pickerTargetListId || currentCharacter.itemLists[0]?.id;
    clone.listId = listId;
    currentCharacter.equipment.push(clone);
  } else if (category === 'spells') {
    clone.active = false;
    if (!currentCharacter.spellLists || currentCharacter.spellLists.length === 0) {
      currentCharacter.spellLists = [{ id: generateId(), name: 'Spells', spellcastingAbility: currentCharacter.spellcastingAbility || 'wis' }];
    }
    const listId = pickerTargetListId || currentCharacter.spellLists[0]?.id;
    clone.listId = listId;
    currentCharacter.spells.push(clone);
  } else if (category === 'feats' || category === 'options') {
    clone.active = true;
    const listId = pickerTargetListId || currentCharacter.featureLists[0]?.id;
    clone.listId = listId;
    currentCharacter.features.push(clone);
  } else if (category === 'monsters') {
    clone.hp_max     = record.hp || 10;
    clone.hp_current = clone.hp_max;
    const listId = pickerTargetListId || currentCharacter.bestiaryLists[0]?.id;
    clone.listId = listId;
    currentCharacter.bestiary.push(clone);
  }

  saveCurrentCharacterAndRefresh();
}

async function syncLocalEntityWithCompendium(entity, category) {
  let compRecord = null;
  if (category === 'feats') {
    compRecord = allRecordsCache['feats']?.find(r => r.name === entity.compendiumId) || 
                 allRecordsCache['options']?.find(r => r.name === entity.compendiumId);
  } else {
    compRecord = allRecordsCache[category]?.find(r => r.name === entity.compendiumId);
  }
  if (!compRecord) return; // silently do nothing if not found

  const { favorite, selected, active, id, compendiumId, listId } = entity;
  const synced = { ...JSON.parse(JSON.stringify(compRecord)), favorite, selected, active, id, compendiumId, listId };

  const arrMap = { feats: 'features', items: 'equipment', spells: 'spells', monsters: 'bestiary' };
  const list = currentCharacter[arrMap[category]] || [];
  const idx = list.findIndex(e => e.id === id);
  if (idx >= 0) {
    list[idx] = synced;
    await saveCurrentCharacterAndRefresh();
    // Close the detail modal after sync
    document.getElementById('cs-detail-modal').style.display = 'none';
  }
}

async function resyncClassFeatures(className) {
  if (!currentCharacter) return;
  const classEntry = currentCharacter.classes?.find(c => c.name.toLowerCase() === className.toLowerCase());
  if (!classEntry) { alert(`No class entry found for ${className}.`); return; }

  const classRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === className.toLowerCase());
  if (!classRecord) { alert(`${className} not found in compendium. Import it first.`); return; }

  if (!confirm(`Re-sync ${className} (levels 1–${classEntry.level}) from the current compendium?\n\nClass and subclass features will be replaced with the compendium versions. Your HP, stats, subclass selection, spells, and equipment are not affected.`)) return;

  const classListId = classEntry.featureListId;
  const subclassListId = classEntry.subclassListId;

  // Remove existing class and subclass features (preserve any user-created custom ones)
  currentCharacter.features = currentCharacter.features.filter(f => {
    if (f.listId === classListId) return !!f._custom;
    if (subclassListId && f.listId === subclassListId) return !!f._custom;
    return true;
  });

  // Remove counters tagged to this class
  currentCharacter.counters = (currentCharacter.counters || []).filter(c => c.classTag !== className);

  // Re-apply base class features and counters for all levels
  for (let lvl = 1; lvl <= classEntry.level; lvl++) {
    const als = classRecord.autolevels?.filter(a => a.level === lvl) || [];
    als.forEach(al => {
      (al.features || []).forEach(f => {
        currentCharacter.features.push({
          name: f.name, active: true, favorite: false, selected: true,
          id: generateId(), listId: classListId,
          texts: f.texts || [],
          modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
        });
      });
      (al.counters || []).forEach(c => {
        const existing = currentCharacter.counters.find(cc => cc.name === c.name);
        if (!existing) {
          currentCharacter.counters.push({
            name: c.name, max: parseInt(c.value) || 1, value: parseInt(c.value) || 1,
            reset_short: c.reset === 'S',
            reset_long: c.reset === 'L' || c.reset === 'S',
            id: generateId(), classTag: className
          });
        } else {
          existing.max = parseInt(c.value) || existing.max;
        }
      });
    });
  }

  // Re-apply subclass features if applicable
  if (classEntry.subclass && subclassListId) {
    const subRecord = allRecordsCache['subclasses']?.find(s =>
      s.name.toLowerCase() === classEntry.subclass.toLowerCase() &&
      s.parentClass.toLowerCase() === className.toLowerCase()
    );
    if (subRecord) {
      for (let lvl = 1; lvl <= classEntry.level; lvl++) {
        const subAls = subRecord.autolevels?.filter(a => a.level === lvl) || [];
        subAls.forEach(al => {
          (al.features || []).forEach(f => {
            currentCharacter.features.push({
              name: f.name, active: true, favorite: false, selected: true,
              id: generateId(), listId: subclassListId,
              texts: f.texts || [],
              modifiers: JSON.parse(JSON.stringify(f.modifiers || []))
            });
          });
          (al.counters || []).forEach(c => {
            const existing = currentCharacter.counters.find(cc => cc.name === c.name);
            if (!existing) {
              currentCharacter.counters.push({
                name: c.name, max: parseInt(c.value) || 1, value: parseInt(c.value) || 1,
                reset_short: c.reset === 'S',
                reset_long: c.reset === 'L' || c.reset === 'S',
                id: generateId(), classTag: className
              });
            } else {
              existing.max = parseInt(c.value) || existing.max;
            }
          });
        });
      }
    }
  }

  await saveCurrentCharacterAndRefresh();
}

function saveCustomModifierModal() {
  const name = document.getElementById('cs-mod-name-input').value.trim();
  if (!name) { document.getElementById('cs-mod-name-input').style.borderColor = 'var(--error-color)'; return; }
  const target = document.getElementById('cs-mod-target-select').value;
  const type   = document.getElementById('cs-mod-type-select').value;
  const value  = document.getElementById('cs-mod-value-input').value.trim();
  if (!value) { document.getElementById('cs-mod-value-input').style.borderColor = 'var(--error-color)'; return; }

  const mod = { name, active: true, favorite: false, selected: true, id: generateId(), modifiers: [{ target, type, value }] };
  if (!currentCharacter.modifiers) currentCharacter.modifiers = [];
  currentCharacter.modifiers.push(mod);
  document.getElementById('cs-modifier-modal').style.display = 'none';
  saveCurrentCharacterAndRefresh();
}

function saveCustomCounterModal() {
  const name = document.getElementById('cs-counter-name-input').value.trim();
  if (!name) { document.getElementById('cs-counter-name-input').style.borderColor = 'var(--error-color)'; return; }
  const max         = parseInt(document.getElementById('cs-counter-max-input').value) || 1;
  const reset_short = document.getElementById('cs-counter-reset-short').checked;
  const reset_long  = document.getElementById('cs-counter-reset-long').checked;

  const cnt = { name, max, value: max, reset_short, reset_long, id: generateId() };
  if (!currentCharacter.counters) currentCharacter.counters = [];
  currentCharacter.counters.push(cnt);
  document.getElementById('cs-counter-modal').style.display = 'none';
  saveCurrentCharacterAndRefresh();
}

function performShortRest() {
  if (!currentCharacter) return;
  (currentCharacter.counters || []).forEach(c => {
    if (c.reset_short || c.reset === 'S') c.value = c.max;
  });
  saveCurrentCharacterAndRefresh();
  // Visual feedback via the button itself
  const btn = document.getElementById('cs-btn-short-rest');
  if (btn) { btn.textContent = 'Rested!'; setTimeout(() => { btn.textContent = 'Short Rest'; }, 1500); }
}

function performLongRest() {
  if (!currentCharacter) return;
  const state = calculateCharacterState(currentCharacter);
  currentCharacter.hp.current = state['hp.max'];
  (currentCharacter.counters || []).forEach(c => {
    if (c.reset_long || c.reset === 'L' || c.reset === 'S') c.value = c.max;
  });
  
  const calculatedSlots = calculateCharacterSlots(currentCharacter);
  if (!currentCharacter.spellSlots) currentCharacter.spellSlots = {};
  for (let l = 1; l <= 9; l++) {
    const maxVal = calculatedSlots[l] || 0;
    currentCharacter.spellSlots[l] = { current: maxVal, max: maxVal };
  }

  saveCurrentCharacterAndRefresh();
  const btn = document.getElementById('cs-btn-long-rest');
  if (btn) { btn.textContent = 'Rested!'; setTimeout(() => { btn.textContent = 'Long Rest'; }, 1500); }
}


function renderCharacterSheetUI() {
  if (!currentCharacter) return;
  ensureCharacterLists(currentCharacter);
  const state = calculateCharacterState(currentCharacter);

  // Show/Hide Spells Tab Button dynamically
  const spellsTabBtn = document.querySelector('.cs-tab-btn[data-tab="spells"]');
  if (spellsTabBtn) {
    spellsTabBtn.style.display = '';
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  document.getElementById('cs-char-name').textContent = currentCharacter.name;
  let classText = '';
  if (currentCharacter.classes && currentCharacter.classes.length > 0) {
    if (currentCharacter.classes.length === 1) {
      const cc = currentCharacter.classes[0];
      classText = `Level ${cc.level} ${cc.name}${cc.subclass ? ' (' + cc.subclass + ')' : ''}`;
    } else {
      const totalLevel = currentCharacter.classes.reduce((sum, c) => sum + c.level, 0);
      classText = `Level ${totalLevel} ` + currentCharacter.classes.map(cc => `${cc.name} ${cc.level}${cc.subclass ? ' (' + cc.subclass + ')' : ''}`).join(' / ');
    }
  } else {
    classText = `Level ${currentCharacter.level} ${currentCharacter.class || 'Fighter'}${currentCharacter.subclass ? ' (' + currentCharacter.subclass + ')' : ''}`;
  }
  document.getElementById('cs-char-subtitle').textContent = classText;
  document.getElementById('cs-hp-current').textContent = currentCharacter.hp.current;
  document.getElementById('cs-hp-max').textContent = state['hp.max'];
  document.getElementById('cs-hp-temp-display').textContent = currentCharacter.hp.temp || 0;

  const insBtn = document.getElementById('cs-btn-inspiration');
  insBtn.classList.toggle('active', !!currentCharacter.inspiration);

  document.getElementById('cs-hp-plus').onclick = () => {
    currentCharacter.hp.current = Math.min(state['hp.max'], (currentCharacter.hp.current || 0) + 1);
    saveCurrentCharacterAndRefresh();
  };
  document.getElementById('cs-hp-minus').onclick = () => {
    currentCharacter.hp.current = Math.max(0, (currentCharacter.hp.current || 0) - 1);
    saveCurrentCharacterAndRefresh();
  };

  // ── Death Saves ─────────────────────────────────────────────────────────────
  [1, 2, 3].forEach(i => {
    const chk = document.getElementById(`cs-death-s-${i}`);
    if (chk) {
      chk.checked = currentCharacter.deathSaves.successes >= i;
      chk.onclick = () => {
        currentCharacter.deathSaves.successes = [1,2,3].filter(j => document.getElementById(`cs-death-s-${j}`)?.checked).length;
        saveCurrentCharacterAndRefresh();
      };
    }
  });
  [1, 2, 3].forEach(i => {
    const chk = document.getElementById(`cs-death-f-${i}`);
    if (chk) {
      chk.checked = currentCharacter.deathSaves.failures >= i;
      chk.onclick = () => {
        currentCharacter.deathSaves.failures = [1,2,3].filter(j => document.getElementById(`cs-death-f-${j}`)?.checked).length;
        saveCurrentCharacterAndRefresh();
      };
    }
  });

  // ── Tab 1: Combat ───────────────────────────────────────────────────────────
  const valAc = document.getElementById('cs-val-ac');
  if (valAc) valAc.textContent = state['ac'];
  const valInit = document.getElementById('cs-val-initiative');
  if (valInit) valInit.textContent = formatModifier(state['initiative']);
  const valSpeed = document.getElementById('cs-val-speed');
  if (valSpeed) valSpeed.textContent = `${state['speed']} ft`;
  const valProfBonus = document.getElementById('cs-val-prof-bonus');
  if (valProfBonus) valProfBonus.textContent = formatModifier(state['prof_bonus']);

  // Attacks list
  const attacksList = document.getElementById('cs-attacks-list');
  if (attacksList) {
    attacksList.innerHTML = '';
    const activeEquipment = (currentCharacter.equipment || []).filter(e => e.active);
    activeEquipment.forEach(item => {
      const isWeapon = item.type && (item.type.includes('Weapon') || item.dmg1);
      if (isWeapon) {
        const isRanged = item.type && item.type.includes('Ranged');
        const atkBonus = isRanged ? state['ranged.attack'] : state['melee.attack'];
        const dmgBonus = isRanged ? state['ranged.damage'] : state['melee.damage'];
        const row = document.createElement('div');
        row.className = 'cs-list-row';
        row.innerHTML = `
          <div class="cs-list-row-info">
            <div class="cs-list-row-name">${item.name}</div>
            <div class="cs-list-row-sub">Attack: ${formatModifier(atkBonus)} · Dmg: ${item.dmg1 || '1d4'} ${dmgBonus >= 0 ? '+' + dmgBonus : dmgBonus} ${item.dmgType || ''}</div>
          </div>
        `;
        attacksList.appendChild(row);
      }
    });
    const activeSpells = (currentCharacter.spells || []).filter(s => s.active);
    activeSpells.forEach(spell => {
      if (spell.rolls && spell.rolls.length > 0) {
        const row = document.createElement('div');
        row.className = 'cs-list-row';
        // Find which spell list this spell belongs to for per-list DC/attack
        const spellList = currentCharacter.spellLists?.find(l => l.id === spell.listId);
        const ab = spellList?.spellcastingAbility || currentCharacter.spellcastingAbility || 'wis';
        const mod = state[`${ab}.mod`] || 0;
        const pb  = state['prof_bonus'] || 2;
        const spellAtk = pb + mod;
        const spellDC  = 8 + pb + mod;
        row.innerHTML = `
          <div class="cs-list-row-info">
            <div class="cs-list-row-name">${spell.name} (Spell)</div>
            <div class="cs-list-row-sub">Atk: ${formatModifier(spellAtk)} · DC: ${spellDC} · ${spell.rolls.join(', ')}</div>
          </div>
        `;
        attacksList.appendChild(row);
      }
    });
    if (!attacksList.hasChildNodes()) {
      attacksList.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No active weapons or spells. Mark items active in Inventory/Spells tab.</div>';
    }
  }

  // Custom Modifiers
  const modifiersList = document.getElementById('cs-modifiers-list');
  if (modifiersList) {
    modifiersList.innerHTML = '';
    const mods = currentCharacter.modifiers || [];
    mods.forEach((mod, idx) => {
      const row = document.createElement('div');
      row.className = 'cs-list-row';
      const mDetails = mod.modifiers ? mod.modifiers.map(m => `${m.target}: ${m.type} ${m.value}`).join(', ') : '';
      row.innerHTML = `
        <input type="checkbox" class="cs-list-row-checkbox" ${mod.active ? 'checked' : ''}>
        <div class="cs-list-row-info">
          <div class="cs-list-row-name">${mod.name}</div>
          <div class="cs-list-row-sub">${mDetails}</div>
        </div>
        <div class="cs-list-row-actions">
          <button class="cs-list-row-btn danger btn-del-mod" title="Delete">${SVG_TRASH}</button>
        </div>
      `;
      row.querySelector('.cs-list-row-checkbox').onchange = (e) => {
        mod.active = e.target.checked;
        saveCurrentCharacterAndRefresh();
      };
      row.querySelector('.btn-del-mod').onclick = () => {
        mods.splice(idx, 1);
        saveCurrentCharacterAndRefresh();
      };
      modifiersList.appendChild(row);
    });
    if (!mods.length) modifiersList.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No custom modifiers.</div>';
  }

  // Dynamic counters synchronization and rendering
  if (!currentCharacter.counters) currentCharacter.counters = [];

  const dynamicCountersFound = new Set();
  const informativeStats = []; // { name, value }

  if (allRecordsCache['classes'] && allRecordsCache['classes'].length > 0) {
    currentCharacter.classes.forEach(cc => {
      const clsRecord = allRecordsCache['classes'].find(c => c.name.toLowerCase() === cc.name.toLowerCase());
      if (clsRecord && clsRecord.classTableGroups) {
        const customGroups = clsRecord.classTableGroups.filter(g => !g.title?.includes('Spell Slots') && !g.rowsSpellProgression);
        customGroups.forEach(g => {
          if (g.colLabels && g.rows) {
            const lvlIdx = cc.level - 1;
            if (g.rows[lvlIdx]) {
              g.colLabels.forEach((label, idx) => {
                const cleanLabel = label.replace(/\{@[^}]+ ([^|}]+)(?:\|[^}]+)?\}/gi, '$1').trim();
                const rawVal = g.rows[lvlIdx][idx];
                const valStr = formatTableCellValue(rawVal);
                if (valStr && valStr !== '—') {
                  if (/^\d+$/.test(valStr)) {
                    // It's a clean integer, synchronize to currentCharacter.counters
                    const numVal = parseInt(valStr);
                    dynamicCountersFound.add(cleanLabel);
                    
                    let existing = currentCharacter.counters.find(c => c.name === cleanLabel);
                    if (existing) {
                      existing.max = numVal;
                      existing.value = Math.min(existing.value, numVal);
                      existing.isDynamic = true;
                    } else {
                      currentCharacter.counters.push({
                        id: 'dynamic-' + cleanLabel.toLowerCase().replace(/\s+/g, '-'),
                        name: cleanLabel,
                        max: numVal,
                        value: numVal,
                        reset_long: true,
                        isDynamic: true
                      });
                    }
                  } else {
                    informativeStats.push({ name: cleanLabel, value: valStr });
                  }
                }
              });
            }
          }
        });
      }

      // Do the same for subclass
      if (cc.subclass && allRecordsCache['subclasses']) {
        const subRecord = allRecordsCache['subclasses'].find(s => 
          s.name.toLowerCase() === cc.subclass.toLowerCase() && 
          s.parentClass.toLowerCase() === cc.name.toLowerCase()
        );
        if (subRecord && subRecord.subclassTableGroups) {
          const customSubGroups = subRecord.subclassTableGroups.filter(g => !g.title?.includes('Spell Slots') && !g.rowsSpellProgression);
          customSubGroups.forEach(g => {
            if (g.colLabels && g.rows) {
              const lvlIdx = cc.level - 1;
              if (g.rows[lvlIdx]) {
                g.colLabels.forEach((label, idx) => {
                  const cleanLabel = label.replace(/\{@[^}]+ ([^|}]+)(?:\|[^}]+)?\}/gi, '$1').trim();
                  const rawVal = g.rows[lvlIdx][idx];
                  const valStr = formatTableCellValue(rawVal);
                  if (valStr && valStr !== '—') {
                    if (/^\d+$/.test(valStr)) {
                      const numVal = parseInt(valStr);
                      dynamicCountersFound.add(cleanLabel);
                      
                      let existing = currentCharacter.counters.find(c => c.name === cleanLabel);
                      if (existing) {
                        existing.max = numVal;
                        existing.value = Math.min(existing.value, numVal);
                        existing.isDynamic = true;
                      } else {
                        currentCharacter.counters.push({
                          id: 'dynamic-' + cleanLabel.toLowerCase().replace(/\s+/g, '-'),
                          name: cleanLabel,
                          max: numVal,
                          value: numVal,
                          reset_long: true,
                          isDynamic: true
                        });
                      }
                    } else {
                      informativeStats.push({ name: cleanLabel, value: valStr });
                    }
                  }
                });
              }
            }
          });
        }
      }
    });
  }

  // Remove any dynamic counters that are no longer active
  currentCharacter.counters = currentCharacter.counters.filter(c => {
    if (c.isDynamic) {
      return dynamicCountersFound.has(c.name);
    }
    return true;
  });

  // Usage Counters
  const countersList = document.getElementById('cs-counters-list');
  if (countersList) {
    countersList.innerHTML = '';
    const cnts = currentCharacter.counters || [];
    cnts.forEach((cnt, idx) => {
      const row = document.createElement('div');
      row.className = 'cs-list-row';
      row.innerHTML = `
        <div class="cs-list-row-info">
          <div class="cs-list-row-name">${cnt.name}</div>
          <div class="cs-list-row-sub">Resets: ${cnt.reset_short ? 'Short' : ''}${cnt.reset_short && cnt.reset_long ? '/' : ''}${cnt.reset_long ? 'Long' : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="cs-btn-small btn-dec" style="font-size:14px;padding:2px 8px">−</button>
          <span style="font-weight:bold;min-width:20px;text-align:center">${cnt.value}</span>
          <button class="cs-btn-small btn-inc" style="font-size:14px;padding:2px 8px">+</button>
          <span style="color:var(--text-muted);font-size:12px">/ ${cnt.max}</span>
        </div>
        <div class="cs-list-row-actions" style="margin-left:6px">
          ${cnt.isDynamic ? '' : `<button class="cs-list-row-btn danger btn-del-cnt" title="Delete">${SVG_TRASH}</button>`}
        </div>
      `;
      row.querySelector('.btn-dec').onclick = () => { cnt.value = Math.max(0, cnt.value - 1); saveCurrentCharacterAndRefresh(); };
      row.querySelector('.btn-inc').onclick = () => { cnt.value = Math.min(cnt.max, cnt.value + 1); saveCurrentCharacterAndRefresh(); };
      if (!cnt.isDynamic) {
        row.querySelector('.btn-del-cnt').onclick = () => { cnts.splice(idx, 1); saveCurrentCharacterAndRefresh(); };
      }
      countersList.appendChild(row);
    });

    informativeStats.forEach(stat => {
      const row = document.createElement('div');
      row.className = 'cs-list-row';
      row.innerHTML = `
        <div class="cs-list-row-info">
          <div class="cs-list-row-name">${stat.name}</div>
          <div class="cs-list-row-sub">Class Progression Stat</div>
        </div>
        <div style="font-weight:bold;margin-right:12px">${stat.value}</div>
      `;
      countersList.appendChild(row);
    });

    if (!cnts.length && !informativeStats.length) {
      countersList.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No counters.</div>';
    }
  }

  // ── Tab 2: Stats & Skills ────────────────────────────────────────────────────
  const scoreStrTest = document.getElementById('cs-score-str');
  if (scoreStrTest) {
    attributes.forEach(attr => {
      const scoreEl = document.getElementById(`cs-score-${attr}`);
      if (scoreEl) scoreEl.textContent = state[`${attr}.score`];
      const modEl = document.getElementById(`cs-mod-${attr}`);
      if (modEl) modEl.textContent   = formatModifier(state[`${attr}.mod`]);
    });
  }

  const passivePerceptionEl = document.getElementById('cs-passive-perception');
  if (passivePerceptionEl) passivePerceptionEl.textContent = state['passive.perception'];
  const passiveInvestigationEl = document.getElementById('cs-passive-investigation');
  if (passiveInvestigationEl) passiveInvestigationEl.textContent = state['passive.investigation'];
  const passiveInsightEl = document.getElementById('cs-passive-insight');
  if (passiveInsightEl) passiveInsightEl.textContent = state['passive.insight'];

  const savesList = document.getElementById('cs-saves-list');
  if (savesList) {
    savesList.innerHTML = '';
    const attrNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    attributes.forEach(attr => {
      const isProf = currentCharacter.savesProficiency[attr] ? 'prof' : '';
      const row = document.createElement('div');
      row.className = 'cs-item-prof-row';
      row.innerHTML = `
        <div class="cs-prof-indicator ${isProf}" title="Proficient?"></div>
        <span class="cs-item-prof-label">${attrNames[attr]}</span>
        <span class="cs-item-prof-val">${formatModifier(state[`save.${attr}`])}</span>
      `;
      row.querySelector('.cs-prof-indicator').onclick = () => {
        currentCharacter.savesProficiency[attr] = currentCharacter.savesProficiency[attr] ? 0 : 1;
        saveCurrentCharacterAndRefresh();
      };
      savesList.appendChild(row);
    });
  }

  const skillsList = document.getElementById('cs-skills-list');
  if (skillsList) {
    skillsList.innerHTML = '';
    const skillsProf          = currentCharacter.skillsProficiency || {};
    const skillsAttrOverride  = currentCharacter.skillsAttributeOverride || {};
    Object.keys(skillAttrs).forEach(skill => {
      const defaultAttr    = skillAttrs[skill];
      const overriddenAttr = skillsAttrOverride[skill] || defaultAttr;
      const prof = parseFloat(skillsProf[skill]) || 0;
      let profClass = '';
      if (prof === 1) profClass = 'prof'; else if (prof === 2) profClass = 'double'; else if (prof === 0.5) profClass = 'half';
      const skillName = skill.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const row = document.createElement('div');
      row.className = 'cs-item-prof-row';
      row.innerHTML = `
        <div class="cs-prof-indicator ${profClass}" title="Cycle Proficiency"></div>
        <span class="cs-item-prof-label" style="cursor:pointer" title="Click to change attribute">${skillName} <span style="font-size:9px;color:var(--text-muted)">(${overriddenAttr.toUpperCase()})</span></span>
        <span class="cs-item-prof-val">${formatModifier(state[`skill.${skill}`])}</span>
      `;
      row.querySelector('.cs-prof-indicator').onclick = () => {
        let nextProf = 0;
        if (prof === 0) nextProf = 1; else if (prof === 1) nextProf = 2; else if (prof === 2) nextProf = 0;
        currentCharacter.skillsProficiency[skill] = nextProf;
        saveCurrentCharacterAndRefresh();
      };
      row.querySelector('.cs-item-prof-label').onclick = () => {
        const nextAttr = prompt(`Override attribute for ${skillName} (currently ${overriddenAttr.toUpperCase()}). Enter str/dex/con/int/wis/cha, or blank to reset:`);
        if (nextAttr === '') { delete currentCharacter.skillsAttributeOverride[skill]; saveCurrentCharacterAndRefresh(); }
        else if (nextAttr && attributes.includes(nextAttr.toLowerCase().trim())) {
          currentCharacter.skillsAttributeOverride[skill] = nextAttr.toLowerCase().trim();
          saveCurrentCharacterAndRefresh();
        }
      };
      skillsList.appendChild(row);
    });
  }

  // ── Tab 3: Features ──────────────────────────────────────────────────────────
  document.getElementById('cs-summary-species').textContent    = currentCharacter.species    || '—';
  document.getElementById('cs-summary-background').textContent = currentCharacter.background || '—';
  document.getElementById('cs-summary-subclass').textContent   = currentCharacter.subclass   || '—';

  const featuresContainer = document.getElementById('cs-features-lists-container');
  featuresContainer.innerHTML = '';

  if (!allRecordsCache['classes'] || allRecordsCache['classes'].length === 0) {
    getAllRecords('classes').then(clsList => {
      allRecordsCache['classes'] = clsList;
    }).catch(err => console.error("Error loading classes for features list", err));
  }

  currentCharacter.featureLists.forEach(listDef => {
    let items = getItemsForList(currentCharacter.features, listDef.id);
    
    // Inject level-based progression features if it's a Class feature list
    if (listDef.name.startsWith('Class: ')) {
      const clsName = listDef.name.substring(7).trim();
      const charClass = currentCharacter.classes?.find(c => c.name.toLowerCase() === clsName.toLowerCase());
      if (charClass) {
        const matchingClass = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === clsName.toLowerCase());
        if (matchingClass) {
          // Prepend class overview row
          items.unshift({
            id: `overview-${clsName}`,
            name: `${clsName} Overview`,
            texts: [`Click to view the complete progression table, proficiencies, and details of the ${clsName} class.`],
            isOverview: true,
            classData: matchingClass,
            categoryType: 'class-overview'
          });

          if (matchingClass.classTableGroups) {
            const customGroups = matchingClass.classTableGroups.filter(g => !g.title?.includes('Spell Slots') && !g.rowsSpellProgression);
            customGroups.forEach(g => {
              if (g.colLabels && g.rows) {
                const lvlIdx = charClass.level - 1;
                if (g.rows[lvlIdx]) {
                  g.colLabels.forEach((label, idx) => {
                    const cleanLabel = label.replace(/\{@[^}]+ ([^|}]+)(?:\|[^}]+)?\}/gi, '$1').trim();
                    const val = formatTableCellValue(g.rows[lvlIdx][idx]);
                    if (val && val !== '—') {
                      // Create a read-only dynamic item
                      items.push({
                        id: `dynamic-${clsName}-${cleanLabel}`,
                        name: `${cleanLabel}: ${val}`,
                        texts: [`This value is determined by your Level ${charClass.level} ${charClass.name} class progression.`],
                        isDynamic: true
                      });
                    }
                  });
                }
              }
            });
          }
        }
      }
    } else if (listDef.name.startsWith('Subclass: ')) {
      const subclassName = listDef.name.substring(10).trim();
      const charClass = currentCharacter.classes?.find(cc =>
        cc.subclass && cc.subclass.toLowerCase() === subclassName.toLowerCase()
      );
      if (charClass && allRecordsCache['subclasses']) {
        const subRecord = allRecordsCache['subclasses'].find(s =>
          s.name.toLowerCase() === subclassName.toLowerCase() &&
          s.parentClass.toLowerCase() === charClass.name.toLowerCase()
        );
        const parentClassRecord = allRecordsCache['classes']?.find(c =>
          c.name.toLowerCase() === charClass.name.toLowerCase()
        );
        if (subRecord) {
          items.unshift({
            id: `overview-subclass-${subclassName}`,
            name: `${subclassName} Overview`,
            texts: [`Click to view the ${subclassName} subclass progression and features.`],
            isOverview: true,
            classData: {
              name: subRecord.name,
              parentClass: charClass.name,
              hd: parentClassRecord?.hd || 8,
              classTableGroups: subRecord.subclassTableGroups || [],
              autolevels: subRecord.autolevels || [],
              source: subRecord.source
            },
            categoryType: 'class-overview'
          });

          if (subRecord.subclassTableGroups) {
            const customSubGroups = subRecord.subclassTableGroups.filter(g =>
              !g.title?.includes('Spell Slots') && !g.rowsSpellProgression
            );
            customSubGroups.forEach(g => {
              if (g.colLabels && g.rows) {
                const lvlIdx = charClass.level - 1;
                if (g.rows[lvlIdx]) {
                  g.colLabels.forEach((label, idx) => {
                    const cleanLabel = label.replace(/\{@[^}]+ ([^|}]+)(?:\|[^}]+)?\}/gi, '$1').trim();
                    const val = formatTableCellValue(g.rows[lvlIdx][idx]);
                    if (val && val !== '—') {
                      items.push({
                        id: `dynamic-subclass-${subclassName}-${cleanLabel}`,
                        name: `${cleanLabel}: ${val}`,
                        texts: [`This value is determined by your Level ${charClass.level} ${subclassName} subclass progression.`],
                        isDynamic: true
                      });
                    }
                  });
                }
              }
            });
          }
        }
      }
    }

    renderListSection(featuresContainer, listDef, items, 'feature', state);
  });

  // ── Tab 4: Inventory ─────────────────────────────────────────────────────────
  const coins = ['gp', 'sp', 'cp', 'ep', 'pp'];
  coins.forEach(c => {
    const input = document.getElementById(`cs-coin-${c}`);
    if (input) {
      input.value = currentCharacter.currency[c] || 0;
      input.onchange = () => {
        currentCharacter.currency[c] = Math.max(0, parseInt(input.value) || 0);
        saveCurrentCharacterAndRefresh();
      };
    }
  });
  let totalWeight = 0;
  (currentCharacter.equipment || []).forEach(item => {
    if (item.active || item.selected) totalWeight += (parseFloat(item.weight) || 0);
  });
  const maxWeight = state['str.score'] * 15;
  
  const elWeight = document.getElementById('cs-inventory-weight');
  if (elWeight) elWeight.textContent = totalWeight.toFixed(1);
  
  const elMaxWeight = document.getElementById('cs-max-weight');
  if (elMaxWeight) elMaxWeight.textContent = maxWeight;
  
  const elCarryCapacity = document.getElementById('cs-carry-capacity');
  if (elCarryCapacity) elCarryCapacity.classList.toggle('overburdened', totalWeight > maxWeight);

  const inventoryContainer = document.getElementById('cs-inventory-lists-container');
  if (inventoryContainer) {
    inventoryContainer.innerHTML = '';
    currentCharacter.itemLists.forEach(listDef => {
      const items = getItemsForList(currentCharacter.equipment, listDef.id);
      renderListSection(inventoryContainer, listDef, items, 'item', state);
    });
  }

  // ── Tab 5: Spells ────────────────────────────────────────────────────────────
  // Slot data is kept current so Preact SpellsTab can read character.spellSlots
  const calculatedSlots = calculateCharacterSlots(currentCharacter);
  if (!currentCharacter.spellSlots) currentCharacter.spellSlots = {};
  for (let _l = 1; _l <= 9; _l++) {
    const _maxVal = calculatedSlots[_l] || 0;
    if (_maxVal === 0) { delete currentCharacter.spellSlots[_l]; continue; }
    if (!currentCharacter.spellSlots[_l]) currentCharacter.spellSlots[_l] = { current: 0, max: 0 };
    currentCharacter.spellSlots[_l].max = _maxVal;
    currentCharacter.spellSlots[_l].current = Math.min(currentCharacter.spellSlots[_l].current, _maxVal);
  }
  // Sync updated slots to Preact signal (Preact renders the slot tracker)
  if (window.__dndStore?.currentCharacter?.value) {
    window.__dndStore.currentCharacter.value = Object.assign({}, currentCharacter);
  }
  // Legacy slot grid removed — SpellsTab Preact component renders slot tracker
  // Legacy spell lists removed — SpellsTab Preact component renders them
  const spellsContainer = document.getElementById('cs-spells-lists-container');
  if (spellsContainer) spellsContainer.innerHTML = '';

  // ── Tab 6: Bestiary (Compendium Monster Picker) ───────────────────────────────
  const bestiaryContainer = document.getElementById('cs-bestiary-lists-container');
  bestiaryContainer.innerHTML = '';
  currentCharacter.bestiaryLists.forEach(listDef => {
    const items = getItemsForList(currentCharacter.bestiary, listDef.id);
    renderListSection(bestiaryContainer, listDef, items, 'beast', state);
  });

  // ── Tab 7: Notes & Profile ───────────────────────────────────────────────────
  const profileFields = ['alignment', 'age', 'height', 'weight'];
  profileFields.forEach(field => {
    const el = document.getElementById(`cs-profile-${field}`);
    if (el) {
      el.value = currentCharacter.notes[field] || '';
      el.onchange = () => {
        currentCharacter.notes[field] = el.value;
        saveCurrentCharacterAndRefresh();
      };
    }
  });

  // Freeform notes
  const notesList = document.getElementById('cs-freeform-notes-list');
  notesList.innerHTML = '';
  const freeNotes = currentCharacter.notes.freeNotes || [];
  freeNotes.forEach((note, idx) => {
    const card = document.createElement('div');
    card.className = 'cs-note-card';
    // Render markdown-ish (replace \n with <br>, **bold**, *italic*)
    const rendered = (note.content || '')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    card.innerHTML = `
      <div class="cs-note-header">
        <span class="cs-note-title">${note.title || 'Note'}</span>
        <div style="display:flex;gap:6px">
          <button class="cs-list-row-btn btn-edit-note" title="Edit">${SVG_COG}</button>
          <button class="cs-list-row-btn danger btn-del-note" title="Delete">${SVG_TRASH}</button>
        </div>
      </div>
      <div class="cs-note-content">${rendered}</div>
    `;
    card.querySelector('.btn-edit-note').onclick = () => openNoteModal(note, idx);
    card.querySelector('.btn-del-note').onclick  = () => {
      freeNotes.splice(idx, 1);
      saveCurrentCharacterAndRefresh();
    };
    notesList.appendChild(card);
  });
  if (!freeNotes.length) {
    notesList.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No notes yet. Click + Add Note to create one.</div>';
  }
}

// ── Note Modal ────────────────────────────────────────────────────────────────
let noteEditIndex = -1;

function openNoteModal(note = null, idx = -1) {
  noteEditIndex = idx;
  const modal = document.getElementById('cs-note-modal');
  document.getElementById('cs-note-modal-title').textContent = note ? 'Edit Note' : 'Add Note';
  document.getElementById('cs-note-title-input').value   = note?.title   || '';
  document.getElementById('cs-note-content-input').value = note?.content || '';
  modal.style.display = 'flex';
}

function saveNote() {
  const title   = document.getElementById('cs-note-title-input').value.trim() || 'Note';
  const content = document.getElementById('cs-note-content-input').value;
  if (!currentCharacter.notes.freeNotes) currentCharacter.notes.freeNotes = [];
  if (noteEditIndex >= 0) {
    currentCharacter.notes.freeNotes[noteEditIndex] = { title, content };
  } else {
    currentCharacter.notes.freeNotes.push({ title, content });
  }
  document.getElementById('cs-note-modal').style.display = 'none';
  saveCurrentCharacterAndRefresh();
}

// ── Events ────────────────────────────────────────────────────────────────────
function setupCharacterSheetEvents() {
  document.getElementById('cs-btn-back').onclick = () => closeCharacterSheet();
  document.getElementById('cs-btn-edit-char').onclick = () => { if (currentCharacter) showCharacterCreatorModal(currentCharacter); };
  
  const levelUpBtn = document.getElementById('cs-btn-level-up');
  if (levelUpBtn) {
    levelUpBtn.onclick = () => { if (currentCharacter) openLevelUpModal(currentCharacter); };
  }

  // Wizard modal event listeners
  document.getElementById('cs-wizard-btn-cancel').onclick = () => closeWizard();
  document.getElementById('cs-wizard-btn-prev').onclick   = () => handleWizardBack();
  document.getElementById('cs-wizard-btn-next').onclick   = () => handleWizardNext();

  // Level Up modal event listeners
  document.getElementById('cs-levelup-btn-close').onclick  = () => { document.getElementById('cs-levelup-modal').style.display = 'none'; };
  document.getElementById('cs-levelup-btn-cancel').onclick = () => { document.getElementById('cs-levelup-modal').style.display = 'none'; };
  document.getElementById('cs-levelup-btn-apply').onclick  = () => handleLevelUpApply();

  // These buttons may be absent when Preact has replaced the combat tab
  const insBtn2 = document.getElementById('cs-btn-inspiration');
  if (insBtn2) insBtn2.onclick = () => {
    if (currentCharacter) { currentCharacter.inspiration = !currentCharacter.inspiration; saveCurrentCharacterAndRefresh(); }
  };
  const shortRestBtn = document.getElementById('cs-btn-short-rest');
  if (shortRestBtn) shortRestBtn.onclick = () => performShortRest();
  const longRestBtn = document.getElementById('cs-btn-long-rest');
  if (longRestBtn) longRestBtn.onclick = () => performLongRest();

  // Creator / modal cancel/save
  document.getElementById('cs-modal-btn-cancel').onclick = () => { document.getElementById('cs-creator-modal').style.display = 'none'; };
  document.getElementById('cs-modal-btn-save').onclick   = () => saveCharacterCreatorModal();

  // Pane detail footer buttons
  const paneDetailBtnAdd = document.getElementById('pane-detail-btn-add');
  if (paneDetailBtnAdd) {
    paneDetailBtnAdd.onclick = () => {
      addSelectedItemToCharacter();
    };
  }
  const paneDetailBtnCancel = document.getElementById('pane-detail-btn-cancel');
  if (paneDetailBtnCancel) {
    paneDetailBtnCancel.onclick = () => {
      closePickerAndReturn();
    };
  }
  const sidebarBackToSheet = document.getElementById('sidebar-back-to-sheet');
  if (sidebarBackToSheet) {
    sidebarBackToSheet.onclick = (e) => {
      e.preventDefault();
      closePickerAndReturn();
    };
  }
  const paneDetailBtnCustom = document.getElementById('pane-detail-btn-custom');
  if (paneDetailBtnCustom) {
    paneDetailBtnCustom.onclick = () => {
      const name = prompt(`Enter custom ${pickerCategory === 'monsters' ? 'companion' : (pickerCategory === 'options' ? 'option' : pickerCategory.slice(0,-1))} name:`);
      if (!name) return;
      ensureCharacterLists(currentCharacter);
      const clone = { name, favorite: false, selected: true, active: false, id: generateId(), texts: ['Custom entry.'] };
      if (pickerCategory === 'items') {
        clone.weight = 0; clone.type = 'Gear';
        clone.listId = pickerTargetListId || currentCharacter.itemLists[0]?.id;
        currentCharacter.equipment.push(clone);
      } else if (pickerCategory === 'spells') {
        clone.level = 0; clone.school = 'Transmutation';
        clone.listId = pickerTargetListId || currentCharacter.spellLists[0]?.id;
        currentCharacter.spells.push(clone);
      } else if (pickerCategory === 'feats' || pickerCategory === 'options') {
        clone.active = true; clone.category = pickerCategory === 'feats' ? 'Feature' : 'Option';
        clone.listId = pickerTargetListId || currentCharacter.featureLists[0]?.id;
        currentCharacter.features.push(clone);
      } else if (pickerCategory === 'monsters') {
        clone.hp_max = 10; clone.hp_current = 10;
        clone.listId = pickerTargetListId || currentCharacter.bestiaryLists[0]?.id;
        currentCharacter.bestiary.push(clone);
      }
      saveCurrentCharacterAndRefresh();
    };
  }

  // Detail modal
  document.getElementById('cs-detail-btn-close').onclick = () => { document.getElementById('cs-detail-modal').style.display = 'none'; };
  document.getElementById('cs-detail-btn-sync').onclick  = () => {
    if (detailModalItem) {
      const catMap = { feature: 'feats', item: 'items', spell: 'spells', beast: 'monsters' };
      syncLocalEntityWithCompendium(detailModalItem, catMap[detailModalType]);
    }
  };

  // List config modal
  document.getElementById('cs-list-config-btn-cancel').onclick = () => { document.getElementById('cs-list-config-modal').style.display = 'none'; listConfigTarget = null; };
  document.getElementById('cs-list-config-btn-save').onclick   = () => saveListConfig();
  document.getElementById('cs-list-config-btn-delete').onclick = () => {
    if (listConfigTarget && !listConfigTarget.isNew) deleteListAndItems();
  };

  // Note modal
  document.getElementById('cs-btn-add-note').onclick    = () => openNoteModal();
  document.getElementById('cs-note-btn-cancel').onclick = () => { document.getElementById('cs-note-modal').style.display = 'none'; };
  document.getElementById('cs-note-btn-save').onclick   = () => saveNote();

  // Modifier modal
  document.getElementById('cs-mod-btn-cancel').onclick = () => { document.getElementById('cs-modifier-modal').style.display = 'none'; };
  document.getElementById('cs-mod-btn-save').onclick   = () => saveCustomModifierModal();
  const btnAddModifier = document.getElementById('cs-btn-add-modifier');
  if (btnAddModifier) {
    btnAddModifier.onclick = () => {
      document.getElementById('cs-mod-name-input').value  = '';
      document.getElementById('cs-mod-value-input').value = '';
      document.getElementById('cs-mod-name-input').style.borderColor  = '';
      document.getElementById('cs-mod-value-input').style.borderColor = '';
      document.getElementById('cs-modifier-modal').style.display = 'flex';
    };
  }

  // Counter modal
  document.getElementById('cs-counter-btn-cancel').onclick = () => { document.getElementById('cs-counter-modal').style.display = 'none'; };
  document.getElementById('cs-counter-btn-save').onclick   = () => saveCustomCounterModal();
  const btnAddCounter = document.getElementById('cs-btn-add-counter');
  if (btnAddCounter) {
    btnAddCounter.onclick = () => {
      document.getElementById('cs-counter-name-input').value = '';
      document.getElementById('cs-counter-max-input').value  = '4';
      document.getElementById('cs-counter-reset-short').checked = true;
      document.getElementById('cs-counter-reset-long').checked  = true;
      document.getElementById('cs-counter-name-input').style.borderColor = '';
      document.getElementById('cs-counter-modal').style.display = 'flex';
    };
  }

  // Temp HP modal — cs-hp-temp-btn may be absent when Preact has replaced the combat tab
  const tempHpBtn = document.getElementById('cs-hp-temp-btn');
  if (tempHpBtn) tempHpBtn.onclick = () => {
    const inp = document.getElementById('cs-temp-hp-input'); if (inp) inp.value = currentCharacter.hp.temp || 0;
    const m = document.getElementById('cs-temp-hp-modal'); if (m) m.style.display = 'flex';
  };
  const tempHpSave = document.getElementById('cs-hp-temp-save');
  if (tempHpSave) tempHpSave.onclick = () => {
    currentCharacter.hp.temp = Math.max(0, parseInt(document.getElementById('cs-temp-hp-input')?.value) || 0);
    const m = document.getElementById('cs-temp-hp-modal'); if (m) m.style.display = 'none';
    saveCurrentCharacterAndRefresh();
  };
  const tempHpCancel = document.getElementById('cs-temp-hp-cancel');
  if (tempHpCancel) tempHpCancel.onclick = () => { const m = document.getElementById('cs-temp-hp-modal'); if (m) m.style.display = 'none'; };

  // Add new list buttons
  document.getElementById('cs-btn-add-feature-list').onclick = () => {
    ensureCharacterLists(currentCharacter);
    openListConfigModal({ id: generateId(), name: 'New Feature List' }, 'feature', true);
  };
  // cs-btn-add-item-list is inside the Preact-managed Inventory tab — guard
  const addItemListBtn = document.getElementById('cs-btn-add-item-list');
  if (addItemListBtn) addItemListBtn.onclick = () => {
    ensureCharacterLists(currentCharacter);
    openListConfigModal({ id: generateId(), name: 'New Gear List' }, 'item', true);
  };
  // cs-btn-add-spell-list is inside the Preact-managed Spells tab — guard
  const addSpellListBtn = document.getElementById('cs-btn-add-spell-list');
  if (addSpellListBtn) addSpellListBtn.onclick = () => {
    ensureCharacterLists(currentCharacter);
    openListConfigModal({ id: generateId(), name: 'New Spell List', spellcastingAbility: currentCharacter.spellcastingAbility || 'wis' }, 'spell', true);
  };
  document.getElementById('cs-btn-add-beast-list').onclick = () => {
    ensureCharacterLists(currentCharacter);
    openListConfigModal({ id: generateId(), name: 'New Companion List' }, 'beast', true);
  };

  // Tab switching
  const tabs = document.querySelectorAll('.cs-tab-btn');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.cs-tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`cs-tab-${target}`).classList.add('active');
    };
  });
}

// Expose globally for tests
if (typeof window !== 'undefined') {
  window.openCharacterSheet    = openCharacterSheet;
  window.closeCharacterSheet   = closeCharacterSheet;
  window.refreshCharactersList = refreshCharactersList;
  window.calculateCharacterState = calculateCharacterState;
  window.calculateCharacterSlots = calculateCharacterSlots;
  window.getDetailHTML         = getDetailHTML;
  window.syncLocalEntityWithCompendium = syncLocalEntityWithCompendium;

  // Bridge: let Preact components open legacy modals (counter/modifier add forms)
  window.__legacyOpenCounterModal = () => {
    const modal = document.getElementById('cs-counter-modal');
    if (!modal) return;
    document.getElementById('cs-counter-name-input').value = '';
    document.getElementById('cs-counter-max-input').value  = '4';
    document.getElementById('cs-counter-reset-short').checked = true;
    document.getElementById('cs-counter-reset-long').checked  = true;
    modal.style.display = 'flex';
  };
  window.__legacyOpenModifierModal = () => {
    const modal = document.getElementById('cs-modifier-modal');
    if (!modal) return;
    document.getElementById('cs-mod-name-input').value  = '';
    document.getElementById('cs-mod-value-input').value = '';
    modal.style.display = 'flex';
  };
  // Expose picker and spell-list functions for Preact components
  window.__legacyOpenPicker = (category, targetListId) => {
    openPicker(category, targetListId);
  };
  // Expose markdown renderer so Preact components can render rich descriptions
  window.__parseMarkdown = (text) => parseMarkdown(text);
  window.__legacyAddSpellList = () => {
    if (!currentCharacter) return;
    const name = window.prompt('Spell list name:', 'Custom Spells');
    if (!name) return;
    const list = { id: generateId(), name, spellcastingAbility: currentCharacter.spellcastingAbility || 'wis' };
    if (!currentCharacter.spellLists) currentCharacter.spellLists = [];
    currentCharacter.spellLists.push(list);
    saveCurrentCharacterAndRefresh();
  };

  window.__legacyAddFeatureList = () => {
    if (!currentCharacter) return;
    const name = window.prompt('Feature list name:', 'Custom Features');
    if (!name) return;
    if (!currentCharacter.featureLists) currentCharacter.featureLists = [];
    currentCharacter.featureLists.push({ id: generateId(), name });
    saveCurrentCharacterAndRefresh();
  };

  window.__legacyOpenFeatureDetail = (feature) => {
    if (!feature) return;
    openItemDetailModal(feature, 'feature');
  };

  window.__legacyResyncClass = (feature) => {
    if (!feature) return;
    if (feature.classData) {
      const className = feature.classData.parentClass || feature.classData.name;
      if (className) resyncClassFeatures(className);
    }
  };

  /**
   * Returns starting equipment strings for a given class name, stripping {@tag} markup.
   * Used by the Preact LevelHistorySection / StartingEquipment display.
   */
  /**
   * Search across all compendium stores by name fragment.
   * Returns up to `limit` results with { name, type, record } shape.
   */
  window.__legacySearchCompendium = (query, limit = 20) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const STORE_TYPES = [
      { key: 'spells',    type: 'spell' },
      { key: 'items',     type: 'item' },
      { key: 'monsters',  type: 'monster' },
      { key: 'feats',     type: 'feat' },
      { key: 'classes',   type: 'class' },
    ];
    const results = [];
    for (const { key, type } of STORE_TYPES) {
      const records = allRecordsCache[key] || [];
      for (const rec of records) {
        if (results.length >= limit) break;
        if (rec.name && rec.name.toLowerCase().includes(q)) {
          results.push({ name: rec.name, type, record: rec });
        }
      }
      if (results.length >= limit) break;
    }
    return results;
  };

  /**
   * Open the legacy detail modal for a compendium record.
   * type = 'spell' | 'item' | 'monster' | 'feat' | 'class' | 'feature'
   */
  window.__legacyOpenDetailForRecord = (record, type) => {
    if (!record) return;
    openItemDetailModal(record, type);
  };

  /**
   * Look up a compendium entry by tag type + name (for {@spell Name} cross-refs).
   * tagType = 'spell' | 'item' | 'condition' | 'creature' | 'feat' | 'class'
   */
  window.__legacyOpenTagRef = (tagType, name) => {
    const storeMap = {
      spell: 'spells', item: 'items', creature: 'monsters',
      monster: 'monsters', feat: 'feats', class: 'classes',
      condition: null, // conditions shown inline, no full modal needed
    };
    const storeKey = storeMap[tagType];
    if (!storeKey) return;
    const records = allRecordsCache[storeKey] || [];
    const found = records.find(r => r.name && r.name.toLowerCase() === name.toLowerCase());
    if (found) openItemDetailModal(found, tagType);
  };

  window.__legacyGetStartingEquipment = (className) => {
    const classRecord = allRecordsCache['classes']?.find(c => c.name.toLowerCase() === className.toLowerCase());
    if (!classRecord || !classRecord.startingEquipment) return null;
    const se = classRecord.startingEquipment;
    // Strip {@tag ...} markup to plain text
    function stripTags(str) {
      return str.replace(/\{@\w+\s+([^|}]+)[^}]*\}/g, (_, inner) => {
        // For filter tags: just use the first part before |
        return inner.split('|')[0];
      });
    }
    return {
      lines: (se.default || []).map(stripTags),
      goldAlt: se.goldAlternative ? stripTags(se.goldAlternative) : null,
      fromBackground: !!se.additionalFromBackground,
    };
  };

  window.__legacyRespecLastLevel = async () => {
    const char = currentCharacter;
    if (!char) return;
    if (!char.levelHistory || char.levelHistory.length === 0) {
      alert('No level history found — nothing to respec.');
      return;
    }
    const last = char.levelHistory[char.levelHistory.length - 1];
    const confirmMsg = `Remove ${last.className} level ${last.toLevel}?\n\nThis will:\n• Remove ${last.addedFeatureIds.length} feature(s): ${last.featureNames.slice(0,3).join(', ')}${last.featureNames.length > 3 ? '…' : ''}\n• Reverse +${last.hpGain} HP\n• Restore any modified counters\n\nThis cannot be undone automatically.`;
    if (!confirm(confirmMsg)) return;

    // Reverse HP
    char.level = Math.max(1, (char.level || 1) - 1);
    char.baseHpMax = Math.max(1, (char.baseHpMax || 10) - last.hpGain);
    char.hp = char.hp || { current: char.baseHpMax, temp: 0 };
    char.hp.current = Math.min(char.hp.current, char.baseHpMax);

    // Reverse stat increases
    if (last.statIncreases) {
      Object.keys(last.statIncreases).forEach(attr => {
        const val = last.statIncreases[attr] || 0;
        if (val !== 0) char.baseStats[attr] = (char.baseStats[attr] || 10) - val;
      });
    }

    // Remove added features
    const removedFeatureSet = new Set(last.addedFeatureIds);
    char.features = (char.features || []).filter(f => !removedFeatureSet.has(f.id));

    // Remove added counters / restore modified ones
    const removedCounterSet = new Set(last.addedCounterIds);
    char.counters = (char.counters || []).filter(c => !removedCounterSet.has(c.id));
    (last.modifiedCounters || []).forEach(delta => {
      const c = (char.counters || []).find(cc => cc.id === delta.id);
      if (c) { c.max = delta.oldMax; c.value = delta.oldValue; }
    });

    // Remove added feature/spell lists
    const removedListSet = new Set([...last.addedFeatureListIds, ...last.addedSpellListIds]);
    char.featureLists = (char.featureLists || []).filter(l => !removedListSet.has(l.id));
    char.spellLists = (char.spellLists || []).filter(l => !removedListSet.has(l.id));

    // Reverse class entry
    if (last.isMulticlass) {
      char.classes = (char.classes || []).filter(c => !(c.name === last.className && c.level === 1));
    } else {
      const classEntry = (char.classes || []).find(c => c.name === last.className);
      if (classEntry) {
        classEntry.level = last.fromLevel;
        if (last.addedSubclassName) {
          classEntry.subclass = null;
          classEntry.subclassListId = null;
          classEntry.subclassSpellListId = null;
          if (char.subclass === last.addedSubclassName) char.subclass = null;
        }
      }
    }

    // Update top-level class for compat
    if (char.classes && char.classes.length > 0) {
      char.class = char.classes[0].name;
    }

    // Pop the last history entry
    char.levelHistory = char.levelHistory.slice(0, -1);
    char._modified_at = new Date().toISOString();

    await saveCharacterToDb(char);
    if (currentCharacter && currentCharacter.name === char.name) {
      currentCharacter = char;
      renderCharacterSheetUI();
    }
    await refreshCharactersList();
  };

  window.__legacyRestoreSpellSlots = () => {
    if (!currentCharacter) return;
    const calculatedSlots = calculateCharacterSlots(currentCharacter);
    if (!currentCharacter.spellSlots) currentCharacter.spellSlots = {};
    for (let l = 1; l <= 9; l++) {
      const maxVal = calculatedSlots[l] || 0;
      currentCharacter.spellSlots[l] = { current: maxVal, max: maxVal };
    }
  };
}
