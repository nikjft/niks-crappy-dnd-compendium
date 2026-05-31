import { openDB, saveRecords, getAllRecords, clearDatabase, STORES } from './db.js';
import { parseCompendiumXML, ITEM_TYPES, SPELL_SCHOOLS, MONSTER_SIZES, DAMAGE_TYPES } from './parser.js';

// Application State
let currentCategory = 'spells';
let currentRecords = []; // Records for the currently selected browsing category
let allRecordsCache = {}; // Cache of all records across all categories for universal search
let selectedFacet1 = 'All';
let selectedFacet2 = 'All';
let searchChits = []; // e.g. [{ field: 'school', value: 'conjuration' }]
let selectedItem = null;

// Mobile View State
let currentMobilePane = 'facet-1'; // 'facet-1', 'facet-2', 'list', 'detail'

// DOM Elements
const menuItems = document.querySelectorAll('.menu-item');
const btnSettings = document.getElementById('btn-settings');
const fileInput = document.getElementById('file-input');
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

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkAndSeedDatabase();
  await loadAllRecordsCache();
  await loadCategory(currentCategory);
});

// Event Listeners Setup
function setupEventListeners() {
  // Category switching
  menuItems.forEach(item => {
    item.addEventListener('click', async () => {
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');
      const cat = item.getAttribute('data-category');
      await loadCategory(cat);
    });
  });

  // XML Import
  btnSettings.addEventListener('click', showSettingsPanel);
  fileInput.addEventListener('change', handleImportFile);

  // Search input change
  searchInput.addEventListener('input', () => {
    const value = searchInput.value;
    // Check if user typed a colon-delimited facet
    const chitRegex = /(\w+):([\w/+-]+)/i;
    const match = value.match(chitRegex);
    if (match && value.endsWith(' ')) {
      // User typed a chit followed by space, extract it!
      const field = match[1].toLowerCase();
      const val = match[2].toLowerCase();
      addSearchChit(field, val);
      searchInput.value = value.replace(match[0], '').trim();
    } else {
      applyFilters();
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = searchInput.value;
      const chitRegex = /(\w+):([\w/+-]+)/i;
      const match = value.match(chitRegex);
      if (match) {
        const field = match[1].toLowerCase();
        const val = match[2].toLowerCase();
        addSearchChit(field, val);
        searchInput.value = value.replace(match[0], '').trim();
      } else {
        applyFilters();
      }
    }
  });

  // Mobile navigation back buttons
  backFacet1.addEventListener('click', () => {
    // Left sidebar is always visible as icons on mobile
  });
  backFacet2.addEventListener('click', () => showMobilePane('facet-1'));
  backList.addEventListener('click', () => {
    const query = searchInput.value.toLowerCase().trim();
    const isGlobalSearch = query !== '' || searchChits.length > 0;
    
    if (isGlobalSearch) {
      // Back button in search goes to category selection
      if (hasFacet1()) showMobilePane('facet-1');
      else showMobilePane('list');
    } else {
      if (hasFacet2()) {
        showMobilePane('facet-2');
      } else if (hasFacet1()) {
        showMobilePane('facet-1');
      }
    }
  });
  backDetail.addEventListener('click', () => {
    if (currentCategory === 'settings') {
      loadCategory('spells');
    } else {
      showMobilePane('list');
    }
  });
}

// Load all records across all stores into local memory cache
async function loadAllRecordsCache() {
  for (const store of STORES) {
    allRecordsCache[store] = await getAllRecords(store);
  }
}

// Check if IndexedDB is empty and seed it from System_Reference_Document_5.5e.xml
async function checkAndSeedDatabase() {
  try {
    if (localStorage.getItem('bypassAutoSeed') === 'true') {
      updateDBStatus('Compendium (Empty)');
      return;
    }
    const spells = await getAllRecords('spells');
    if (spells.length === 0) {
      showOverlay('Seeding Database...', 'Fetching and loading the default D&D System Reference Document. This takes a moment...');
      
      const response = await fetch('./source-data/System_Reference_Document_5.5e.xml');
      if (!response.ok) {
        throw new Error('Failed to fetch SRD XML file.');
      }
      const xmlText = await response.text();
      const parsed = parseCompendiumXML(xmlText);
      
      for (const store of STORES) {
        if (parsed[store] && parsed[store].length > 0) {
          await saveRecords(store, parsed[store]);
        }
      }
      hideOverlay();
      updateDBStatus('SRD Seeded Successfully');
    } else {
      updateDBStatus('Compendium Ready');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    hideOverlay();
    alert('Failed to initialize database: ' + error.message);
  }
}

// Handle XML import files
async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  showOverlay('Importing XML...', `Parsing and upserting records from ${file.name}...`);
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const xmlText = event.target.result;
      const parsed = parseCompendiumXML(xmlText);
      
      let importedCount = 0;
      for (const store of STORES) {
        if (parsed[store] && parsed[store].length > 0) {
          await saveRecords(store, parsed[store]);
          importedCount += parsed[store].length;
        }
      }
      
      hideOverlay();
      alert(`Successfully imported ${importedCount} records!`);
      updateDBStatus(`Imported ${file.name}`);
      await loadAllRecordsCache(); // Reload universal cache
      if (currentCategory === 'settings') {
        renderSettingsPage();
      } else {
        await loadCategory(currentCategory); // Reload current category
      }
    } catch (error) {
      console.error('Error importing XML:', error);
      hideOverlay();
      alert('Error parsing XML: ' + error.message);
    }
  };
  
  reader.readAsText(file);
  fileInput.value = ''; // Reset input
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
  selectedFacet1 = 'All';
  selectedFacet2 = 'All';
  searchChits = [];
  renderChits();
  searchInput.value = '';
  selectedItem = null;
  
  // Clear details pane
  resetDetailsPane();

  // Handle universal search panel visibility toggles
  const controls = document.getElementById('universal-search-controls');
  if (controls) {
    controls.style.display = 'none';
  }
  facetList1.style.display = 'block';

  if (category === 'search') {
    updatePaneVisibility();
    renderUniversalSearchPanel();
    return;
  }

  // Load records from DB cache
  currentRecords = allRecordsCache[category] || [];
  if (currentRecords.length === 0) {
    currentRecords = await getAllRecords(category);
    allRecordsCache[category] = currentRecords;
  }
  
  // Render search filter dropdowns
  renderFilterDropdowns();

  // Adjust panes columns visibility based on category
  updatePaneVisibility();

  // Update lists
  renderFacet1();
  renderFacet2();
  applyFilters();

  // On mobile, set initial view
  if (hasFacet1()) {
    showMobilePane('facet-1');
  } else {
    showMobilePane('list');
  }
}

function hasFacet1() {
  return currentCategory !== 'backgrounds' && currentCategory !== 'races' && currentCategory !== 'settings';
}

function hasFacet2() {
  return currentCategory === 'spells' || currentCategory === 'classes' || currentCategory === 'monsters';
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
    facetName = 'CR';
    const crs = new Set();
    currentRecords.forEach(m => {
      if (m.cr !== undefined && m.cr !== null) crs.add(m.cr.toString());
    });
    // Sort CR values numerically
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
  }

  facetTitle1.textContent = facetName;

  // Add "All" option
  const allCount = currentRecords.length;
  appendFacetItem(facetList1, 'All', 'All', allCount, selectedFacet1 === 'All', (val) => {
    selectedFacet1 = val;
    selectedFacet2 = 'All'; // Reset facet 2
    renderFacet1();
    renderFacet2();
    applyFilters();
    if (hasFacet2()) showMobilePane('facet-2');
    else showMobilePane('list');
  });

  // Add dynamic values
  values.forEach(val => {
    let count = 0;
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
      count = currentRecords.filter(m => m.cr && m.cr.toString() === val).length;
    }

    appendFacetItem(facetList1, val, val, count, selectedFacet1 === val, (clickedVal) => {
      selectedFacet1 = clickedVal;
      selectedFacet2 = 'All'; // Reset facet 2
      renderFacet1();
      renderFacet2();
      applyFilters();
      if (hasFacet2()) showMobilePane('facet-2');
      else showMobilePane('list');
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
      recordsFacet1 = currentRecords.filter(m => m.cr && m.cr.toString() === selectedFacet1);
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
    facetName = 'Type';
    const types = new Set();
    recordsFacet1.forEach(m => {
      if (m.type) types.add(m.type.toLowerCase());
    });
    values = Array.from(types).sort();
  }

  facetTitle2.textContent = facetName;

  // Add "All" option
  appendFacetItem(facetList2, 'All', 'All', recordsFacet1.length, selectedFacet2 === 'All', (val) => {
    selectedFacet2 = val;
    renderFacet2();
    applyFilters();
    showMobilePane('list');
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
      count = recordsFacet1.filter(m => m.type && m.type.toLowerCase() === val).length;
    }

    appendFacetItem(facetList2, val, label, count, selectedFacet2 === val, (clickedVal) => {
      selectedFacet2 = clickedVal;
      renderFacet2();
      applyFilters();
      showMobilePane('list');
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

  const addDropdown = (placeholder, field, options) => {
    const select = document.createElement('select');
    select.className = 'filter-select';
    select.innerHTML = `<option value="">${placeholder}</option>` +
      options.map(opt => `<option value="${opt.val || opt}">${opt.label || opt}</option>`).join('');
    
    select.addEventListener('change', () => {
      if (select.value) {
        addSearchChit(field, select.value);
        select.value = ''; // Reset select
      }
    });
    filterDropdownContainer.appendChild(select);
  };

  if (currentCategory === 'spells') {
    addDropdown('School', 'school', Object.values(SPELL_SCHOOLS));
    addDropdown('Level', 'level', [
      { label: 'Cantrip', val: '0' },
      ...Array.from({ length: 9 }, (_, i) => ({ label: `Level ${i+1}`, val: (i+1).toString() }))
    ]);
    addDropdown('Ritual', 'ritual', ['Yes', 'No']);
  } else if (currentCategory === 'items') {
    addDropdown('Type', 'type', Object.values(ITEM_TYPES));
    addDropdown('Magic', 'magic', ['Yes', 'No']);
  } else if (currentCategory === 'monsters') {
    addDropdown('Size', 'size', Object.values(MONSTER_SIZES));
    addDropdown('Alignment', 'alignment', ['Unaligned', 'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']);
  } else if (currentCategory === 'feats') {
    addDropdown('Category', 'category', ['Origin', 'Epic Boon', 'Fighting Style', 'Standard']);
  } else if (currentCategory === 'races') {
    addDropdown('Size', 'size', Object.values(MONSTER_SIZES));
  }
}

// Search chit management
function addSearchChit(field, value) {
  if (!searchChits.some(c => c.field === field && c.value === value)) {
    searchChits.push({ field, value });
    renderChits();
    applyFilters();
  }
}

function renderChits() {
  const wrapper = document.getElementById('search-wrapper');
  const input = document.getElementById('search-input');
  
  const oldChits = wrapper.querySelectorAll('.search-chit');
  oldChits.forEach(c => c.remove());
  
  searchChits.forEach((chit, index) => {
    const chitEl = document.createElement('span');
    chitEl.className = 'search-chit';
    chitEl.innerHTML = `${chit.field}:${chit.value} <button>&times;</button>`;
    
    chitEl.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      searchChits.splice(index, 1);
      renderChits();
      applyFilters();
    });
    
    wrapper.insertBefore(chitEl, input);
  });
}

// Global Filtering and Score-based Search Sorting Engine
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  
  // Category Browsing Mode
  updatePaneVisibility();

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
        if (record.cr !== selectedFacet1) return false;
      }
    }

    // Drilldown Facet 2
    if (selectedFacet2 !== 'All') {
      if (currentCategory === 'spells') {
        if (record.level !== parseInt(selectedFacet2)) return false;
      } else if (currentCategory === 'classes') {
        // Sections are flattened later
      } else if (currentCategory === 'monsters') {
        if (!record.type || record.type.toLowerCase() !== selectedFacet2.toLowerCase()) return false;
      }
    }

    // Filter by search chits
    for (const chit of searchChits) {
      if (!recordMatchesChit(record, chit)) {
        return false;
      }
    }

    return true;
  });

  let itemsToRender = [];
  if (currentCategory === 'classes') {
    filteredRecords.forEach(cls => {
      if (selectedFacet2 === 'All' || selectedFacet2 === 'Generic Features') {
        itemsToRender.push({
          name: `${cls.name} Overview`,
          isOverview: true,
          level: 0,
          classData: cls,
          categoryType: 'class-overview'
        });
      }
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

function recordMatchesChit(record, chit) {
  const val = chit.value.toLowerCase();
  const type = record.categoryType;
  const field = chit.field.toLowerCase();

  if (type === 'spell') {
    if (field === 'school') {
      return record.school && record.school.toLowerCase() === val;
    } else if (field === 'level') {
      return record.level !== undefined && record.level.toString() === val;
    } else if (field === 'class') {
      return record.classes && record.classes.map(c => c.toLowerCase()).includes(val);
    } else if (field === 'ritual') {
      const isRitual = val === 'yes' || val === 'true';
      return record.ritual === isRitual;
    }
    return false;
  } else if (type === 'item') {
    if (field === 'type') {
      return record.type && record.type.toLowerCase() === val;
    } else if (field === 'magic') {
      const isMagic = val === 'yes' || val === 'true';
      return record.magic === isMagic;
    }
    return false;
  } else if (type === 'monster') {
    if (field === 'size') {
      return record.size && record.size.toLowerCase() === val;
    } else if (field === 'type') {
      return record.type && record.type.toLowerCase().includes(val);
    } else if (field === 'cr') {
      return record.cr !== undefined && record.cr.toString() === val;
    } else if (field === 'alignment') {
      return record.alignment && record.alignment.toLowerCase().includes(val);
    }
    return false;
  } else if (type === 'feat') {
    if (field === 'category') {
      return record.category && record.category.toLowerCase() === val;
    }
    return false;
  } else if (type === 'race') {
    if (field === 'size') {
      return record.size && record.size.toLowerCase() === val;
    }
    return false;
  }
  return false;
}

// Render the search results list
function renderList(items, isGlobalSearch = false) {
  itemList.innerHTML = '';
  listTitle.textContent = isGlobalSearch ? `Search Results (${items.length})` : `${currentCategory} (${items.length})`;

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
      const displayType = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      metaText = `[${displayType}] `;
    }

    if (type === 'spell') {
      metaText += `${item.level === 0 ? 'Cantrip' : 'Level ' + item.level} • ${item.school}`;
    } else if (type === 'item') {
      metaText += `${item.type || 'Item'} ${item.magic ? '• Magic' : ''}`;
    } else if (type === 'monster') {
      metaText += `CR ${item.cr || '0'} • ${item.type || 'Monster'} • ${item.size || 'M'}`;
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
  showMobilePane('detail');
}

function resetDetailsPane() {
  detailPaneContent.innerHTML = `
    <div class="detail-view-container">
      <div style="text-align: center; margin-top: 80px; color: var(--text-muted)">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
        <p>Select an entry from the list to view its details.</p>
      </div>
    </div>
  `;
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
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return res;
}

function parseMarkdown(text) {
  if (!text) return '';

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

// Render full detailed view for the e-Reader panel
function renderDetails(item, category = currentCategory) {
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
              Source: ${parseInlineMarkdown(item.source)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (category === 'items' || category === 'item') {
    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">${item.type} ${item.magic ? '• Magic' : ''}</div>
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
        </div>
      </div>
    `;
  } else if (category === 'classes' || category === 'class' || category === 'class-overview' || category === 'class-feature') {
    if (item.isOverview || category === 'class-overview') {
      const cls = item.classData || item;
      let tableRows = '';
      const levelFeatures = {};
      if (cls.features) {
        cls.features.forEach(f => {
          if (!levelFeatures[f.level]) levelFeatures[f.level] = [];
          levelFeatures[f.level].push(f.name);
        });
      }

      for (let lvl = 1; lvl <= 20; lvl++) {
        const feats = levelFeatures[lvl] || [];
        const slotsRow = cls.slotsTable ? cls.slotsTable.find(st => st.level === lvl) : null;
        const slotsText = slotsRow ? slotsRow.slots : '—';
        
        tableRows += `
          <tr>
            <td>${lvl}</td>
            <td><strong>${feats.join(', ') || '—'}</strong></td>
            <td>${slotsText}</td>
          </tr>
        `;
      }

      html = `
        <div class="detail-view-container">
          <header class="detail-header">
            <div class="detail-subtitle">Character Class</div>
            <h1>${cls.name}</h1>
            <div style="font-style: italic; color: var(--accent-color)">Hit Die: d${cls.hd}</div>
          </header>
          <div class="detail-body">
            <div class="detail-meta-box">
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
            </div>

            <h2 style="margin-top: 30px; margin-bottom: 12px; font-size: 20px; color: var(--accent-color)">Class Progression Table</h2>
            <table class="class-features-table">
              <thead>
                <tr>
                  <th style="width: 60px">Level</th>
                  <th>Features</th>
                  <th style="width: 140px">Spell Slots</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
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
          </div>
        </div>
      `;
    }
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
        </div>
      </div>
    `;
  } else if (category === 'backgrounds' || category === 'background') {
    html = `
      <div class="detail-view-container">
        <header class="detail-header">
          <div class="detail-subtitle">Background</div>
          <h1>${item.name}</h1>
        </header>
        <div class="detail-meta-box">
          <div class="meta-entry">
            <span class="meta-label">Skill Proficiencies</span>
            <span class="meta-value">${item.proficiency || '—'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Tools</span>
            <span class="meta-value">${item.tools || '—'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Languages</span>
            <span class="meta-value">${item.languages || '—'}</span>
          </div>
        </div>
        <div class="detail-body">
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
        </div>
      </div>
    `;
  } else if (category === 'races' || category === 'race') {
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
            <span class="meta-value">${item.speed || 30} ft.</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Ability Score Increases</span>
            <span class="meta-value">${item.ability || 'Choose and increase stats'}</span>
          </div>
          <div class="meta-entry">
            <span class="meta-label">Primary Languages</span>
            <span class="meta-value">${item.languages || 'Common'}</span>
          </div>
        </div>
        <div class="detail-body">
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
        </div>
      </div>
    `;
  }

  detailPaneContent.innerHTML = html;
}

// Settings Control Panel Handlers
function showSettingsPanel() {
  currentCategory = 'settings';
  selectedFacet1 = 'All';
  selectedFacet2 = 'All';
  searchChits = [];
  renderChits();
  searchInput.value = '';
  selectedItem = null;

  // Clear active sidebar highlights
  menuItems.forEach(mi => mi.classList.remove('active'));

  // Update layout pane visibility to hide lists/facets and expand settings to full width
  updatePaneVisibility();

  // Render the settings page view
  renderSettingsPage();

  // Switch to detail view on mobile
  showMobilePane('detail');
}

function renderSettingsPage() {
  detailPaneContent.innerHTML = `
    <div class="detail-view-container settings-panel">
      <header class="detail-header">
        <div class="detail-subtitle">Control Panel</div>
        <h1 style="font-size: 32px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Settings</h1>
        <p style="color: var(--text-secondary); margin-top: 8px;">Manage your offline compendium database, imports, and application cache.</p>
      </header>
      
      <div class="detail-body">
        <section class="settings-section" style="margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 24px;">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Database Management</h2>
          
          <div class="settings-option">
            <h3>Import XML Content</h3>
            <p>
              Import a D&D compendium XML file. New records will be added, and existing records with the same name will be updated.
            </p>
            <button class="settings-action-btn" id="settings-btn-import">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
              Choose XML File & Import
            </button>
          </div>

          <div class="settings-option" style="margin-top: 24px;">
            <h3>Reset Database</h3>
            <p>
              Wipe all custom imports and revert your local database back to the default System Reference Document (SRD 5.5e) data.
            </p>
            <button class="settings-action-btn danger-btn" id="settings-btn-reset-db">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              Reset Database to Default
            </button>
          </div>

          <div class="settings-option" style="margin-top: 24px;">
            <h3>Clear Database</h3>
            <p>
              Wipe all content from the database. This leaves the database completely empty, allowing you to import your own custom XML compendium files.
            </p>
            <button class="settings-action-btn danger-btn" id="settings-btn-clear-db">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg>
              Clear All Content
            </button>
          </div>
        </section>

        <section class="settings-section">
          <h2 style="font-size: 18px; color: var(--accent-color); margin-bottom: 16px; font-family: var(--font-header)">Application Cache</h2>
          
          <div class="settings-option">
            <h3>Reset App Cache</h3>
            <p>
              Clear the offline Service Worker cache to force download the latest application updates. This is useful if the app is not loading newer edits.
            </p>
            <button class="settings-action-btn" id="settings-btn-reset-cache">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
              Clear Cache & Reload
            </button>
          </div>
        </section>
      </div>
    </div>
  `;

  // Attach event handlers
  document.getElementById('settings-btn-import').addEventListener('click', () => {
    fileInput.click();
  });
  document.getElementById('settings-btn-reset-db').addEventListener('click', resetDatabaseToDefault);
  document.getElementById('settings-btn-clear-db').addEventListener('click', clearDatabaseAction);
  document.getElementById('settings-btn-reset-cache').addEventListener('click', resetServiceWorkerCache);
}

async function resetDatabaseToDefault() {
  if (confirm('Are you sure you want to reset the database? This will delete all custom imported items and restore the default System Reference Document.')) {
    showOverlay('Resetting Database...', 'Wiping local database stores...');
    localStorage.removeItem('bypassAutoSeed');
    await clearDatabase();
    showOverlay('Seeding Database...', 'Re-fetching and loading the default D&D System Reference Document...');
    // Re-seed the database
    await checkAndSeedDatabase();
    await loadAllRecordsCache();
    await loadCategory('spells'); // Go back to spells after resetting
    hideOverlay();
    alert('Database reset successful!');
  }
}

async function clearDatabaseAction() {
  if (confirm('Are you sure you want to clear the entire database? All content will be deleted, and the database will be left empty.')) {
    showOverlay('Clearing Database...', 'Wiping all local database stores...');
    localStorage.setItem('bypassAutoSeed', 'true');
    await clearDatabase();
    await loadAllRecordsCache();
    await loadCategory('spells'); // Go back to spells after clearing
    hideOverlay();
    alert('Database successfully cleared!');
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
  applyUniversalSearch();
}

function applyUniversalSearch() {
  const uniInput = document.getElementById('universal-search-input');
  if (!uniInput) return;
  const query = uniInput.value.toLowerCase().trim();

  // Get selected categories to search
  const selectedStores = [];
  const checkboxes = document.querySelectorAll('.search-cat-cb');
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedStores.push(cb.getAttribute('data-store'));
    }
  });

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
    if (type === 'spell' || type === 'item' || type === 'feat' || type === 'background' || type === 'race' || type === 'class-feature') {
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
