const selectFolderBtn = document.getElementById('select-folder');
const modListDiv = document.getElementById('mod-list');
const searchInput = document.getElementById('search');
const imcListDiv = document.getElementById('imc-list');

// Load saved mod folder from localStorage on startup
let currentFolder = localStorage.getItem('penumbraModFolder') || null;
if (currentFolder) {
  loadMods(currentFolder);
}
let currentMods = [];
let selectedMod = null;

const typeOptions = ['Equipment', 'Accessory'];
const slotOptions = {
  'Equipment': ['Head', 'Body', 'Hands', 'Legs', 'Feet'],
  'Accessory': ['Earrings', 'Necklace', 'Bracelets', 'Left Ring', 'Right Ring']
};

selectFolderBtn.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectFolder();
  if (folder) {
    currentFolder = folder;
    localStorage.setItem('penumbraModFolder', folder); // Save to localStorage
    selectedMod = null;
    imcListDiv.innerHTML = '';
    loadMods(folder);
  }
});

searchInput.addEventListener('input', () => {
  renderMods(searchInput.value);
});

async function loadMods(folder) {
  currentMods = await window.electronAPI.listMods(folder);
  renderMods(searchInput.value);
}

function renderMods(filter) {
  const mods = filter
    ? currentMods.filter(name => name.toLowerCase().includes(filter.toLowerCase()))
    : currentMods;
  if (mods.length) {
    modListDiv.innerHTML = mods.map(name => `<div class="mod-item" data-mod="${name}">${name}</div>`).join('');
  } else {
    modListDiv.innerHTML = '<em>No mods found.</em>';
  }
  document.querySelectorAll('.mod-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      const modName = e.currentTarget.getAttribute('data-mod');
      selectedMod = modName;
      searchInput.value = modName;
      renderMods(modName); // Only show the selected mod
      showImcGearList(modName);
    });
  });
}

async function showImcGearList(modName) {
  if (!currentFolder || !modName) return;
  imcListDiv.innerHTML = '<em>Loading IMC gear items...</em>';
  let modPath = currentFolder;
  if (!modPath.endsWith('\\') && !modPath.endsWith('/')) modPath += '\\';
  modPath += modName;
  let items = [];
  try {
    items = await window.electronAPI.listImcGear(modPath);
  } catch (e) {
    imcListDiv.innerHTML = '<em>Error loading IMC gear items.</em>';
    return;
  }
  if (!items.length) {
    imcListDiv.innerHTML = '<em>No IMC gear items found in this mod.</em>';
    return;
  }
  let html = '';
  items.forEach((item, idx) => {
    html += renderClosedRow(item, idx);
  });
  imcListDiv.innerHTML = html;
  console.log('showImcGearList: rendered items', items);
  bindPortRowEvents(items);
}

function renderClosedRow(item, idx) {
  return `
    <div class="port-row-modern port-row-closed" data-row-idx="${idx}">
      <div class="port-row-info">
        <div class="port-col-info">
          <div class="port-row-header">
            <span class="port-row-label">${item.ObjectType || 'Equipment'}</span> ID: ${item.PrimaryId}, Variant: ${item.Variant}, Slot: ${item.EquipSlot}, VFX: ${item.VfxId}
          </div>
          <div class="port-row-path">
            <span class="port-row-label">Path:</span> <span class="port-row-path-value">${item.vfxPath}</span>
          </div>
        </div>
        <div class="port-col-right">
            <button class="big-menu-button arrow open-port-btn" data-row-idx="${idx}" title="Port">
            <svg viewBox="0 0 32 32" fill="none"><path d="M7 11h18l-4-4" stroke="#8fd1e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 21H7l4 4" stroke="#8fd1e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      </div>
    </div>
  `;
}

function renderOpenRow(item, idx) {
  const type = item.ObjectType || 'Equipment';
  const slotList = slotOptions[type] || [];
  // Use a placeholder for projected path, will be updated live
  const projectedPath = getProjectedPath(type, item.PrimaryId, item.VfxId);
  return `
    <div class="port-row-modern port-row-open" data-row-idx="${idx}">
      <div class="port-row-info">
        <div class="port-col-info">
          <div class="port-row-header">
            <span class="port-row-label">${item.ObjectType || 'Equipment'}</span> ID: ${item.PrimaryId}, Variant: ${item.Variant}, Slot: ${item.EquipSlot}, VFX: ${item.VfxId}
          </div>
          <div class="port-row-path">
            <span class="port-row-label">Path:</span> <span class="port-row-path-value">${item.vfxPath}</span>
          </div>
          <div class="port-to-arrow">
            <svg viewBox="0 0 32 32" fill="none"><path d="M7 11h18l-4-4" stroke="#8fd1e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 21H7l4 4" stroke="#8fd1e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="port-row-fields">
            <select class="port-type" title="Type">
              ${typeOptions.map(opt => `<option value="${opt}"${opt === type ? ' selected' : ''}>${opt}</option>`).join('')}
            </select>
            <input type="text" class="port-equipid" value="${item.PrimaryId}" title="Primary ID" />
            <input type="text" class="port-variant" value="${item.Variant}" title="Variant ID" />
            <select class="port-slot" title="Equip Slot">
              ${slotList.map(opt => `<option value="${opt}"${opt === item.EquipSlot ? ' selected' : ''}>${opt}</option>`).join('')}
            </select>
            <input type="text" class="port-vfxid" value="${item.VfxId}" title="VFX ID"/>
          </div>
          <div class="port-row-projected">
            <span class="port-row-label">Path:</span> <span class="port-row-path-value projected-path">${projectedPath}</span>
          </div>
        </div>
        <div class="port-col-right">
          <button class="big-menu-button up close-port-btn" data-row-idx="${idx}" title="Close">
            <svg viewBox="0 0 32 32" fill="none"><path d="M8 20l8-8 8 8" stroke="#8fd1e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="big-menu-button submit submit-port-btn" data-row-idx="${idx}" title="Submit">
            <svg viewBox="0 0 32 32" fill="none"><path d="M8 16h16M18 10l6 6-6 6" stroke="#a6e14a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function getProjectedPath(type, primaryId, vfxId) {
  if (type === 'Accessory') {
    return `chara/accessory/a${primaryId}/vfx/eff/va${vfxId}.avfx`;
  } else {
    // Default to Equipment
    return `chara/equipment/e${primaryId}/vfx/eff/ve${vfxId}.avfx`;
  }
}


function bindPortRowEvents(items) {
  console.log('bindPortRowEvents: binding to', document.querySelectorAll('.open-port-btn').length, 'open-port-btns', items);
  document.querySelectorAll('.open-port-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      console.log('Port button clicked', btn.getAttribute('data-row-idx'));
      const idx = btn.getAttribute('data-row-idx');
      // Only one open at a time
      imcListDiv.innerHTML = items.map((item, i) => i == idx ? renderOpenRow(item, i) : renderClosedRow(item, i)).join('');
      bindPortRowEvents(items);
    });
  });
  document.querySelectorAll('.close-port-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = btn.getAttribute('data-row-idx');
      imcListDiv.innerHTML = items.map((item, i) => renderClosedRow(item, i)).join('');
      bindPortRowEvents(items);
    });
  });
  // Live update projected path and slot options on input/select change
  const openRow = document.querySelector('.port-row-open');
  if (openRow) {
    const typeEl = openRow.querySelector('.port-type');
    const idEl = openRow.querySelector('.port-equipid');
    const vfxEl = openRow.querySelector('.port-vfxid');
    const slotEl = openRow.querySelector('.port-slot');
    const projectedPathEl = openRow.querySelector('.projected-path');
    function updateProjectedPath() {
      const type = typeEl.value;
      const id = idEl.value.padStart(4, '0');
      const vfx = vfxEl.value.padStart(4, '0');
      projectedPathEl.textContent = getProjectedPath(type, id, vfx);
    }
    // Update slot options when type changes
    function updateSlotOptions() {
      const type = typeEl.value;
      const slotList = slotOptions[type] || [];
      const currentSlot = slotEl.value;
      slotEl.innerHTML = slotList.map(opt => `<option value="${opt}"${opt === currentSlot ? ' selected' : ''}>${opt}</option>`).join('');
      // If currentSlot is not in new slotList, select the first
      if (!slotList.includes(currentSlot) && slotList.length > 0) {
        slotEl.value = slotList[0];
      }
    }
    typeEl.addEventListener('change', () => {
      updateSlotOptions();
      updateProjectedPath();
    });
    [typeEl, idEl, vfxEl].forEach(el => {
      el.addEventListener('input', updateProjectedPath);
      el.addEventListener('change', updateProjectedPath);
    });
    updateSlotOptions();
    updateProjectedPath();
  }
  // Submit logic for .submit-port-btn
  document.querySelectorAll('.submit-port-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const openRow = btn.closest('.port-row-open');
      if (!openRow) return;
      const idx = btn.getAttribute('data-row-idx');
      const item = items[idx];
      // Get current field values
      const type = openRow.querySelector('.port-type').value;
      const primaryId = openRow.querySelector('.port-equipid').value.padStart(4, '0');
      const variant = openRow.querySelector('.port-variant').value;
      const equipSlot = openRow.querySelector('.port-slot').value;
      const vfxId = openRow.querySelector('.port-vfxid').value.padStart(4, '0');
      const originalVfxPath = item.vfxPath;
      const newVfxPath = getProjectedPath(type, primaryId, vfxId);
      // Build IMC update object (new values)
      const imcUpdate = {
        ObjectType: type,
        PrimaryId: primaryId,
        Variant: variant,
        EquipSlot: equipSlot,
        Entry: { VfxId: vfxId }
      };
      // Build originalImc object (from the original item)
      const originalImc = {
        ObjectType: item.ObjectType,
        PrimaryId: item.PrimaryId,
        Variant: item.Variant,
        EquipSlot: item.EquipSlot,
        Entry: { VfxId: item.VfxId }
      };
      // Call backend
      if (!currentFolder || !selectedMod) return;
      let modFolderPath = currentFolder;
      if (!modFolderPath.endsWith("/") && !modFolderPath.endsWith("\\")) modFolderPath += "/";
      modFolderPath += selectedMod;
      const result = await window.electronAPI.applyVfxPort({
        modFolderPath,
        originalVfxPath,
        newVfxPath,
        imcUpdate,
        originalImc
      });
      if (result) {
        alert('VFX port applied successfully!');
        showImcGearList(selectedMod);
      } else {
        alert('Failed to apply VFX port.');
      }
    });
  });
}
