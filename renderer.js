const selectFolderBtn = document.getElementById('select-folder');
const modListDiv = document.getElementById('mod-list');
const searchInput = document.getElementById('search');
const imcListDiv = document.getElementById('imc-list');

const typeOptions = ['Equipment', 'Accessory', 'Weapon'];
const slotOptions = {
  'Equipment': ['Head', 'Body', 'Hands', 'Legs', 'Feet', 'Unknown'],
  'Accessory': ['Earrings', 'Necklace', 'Bracelets', 'Left Ring', 'Right Ring', 'Unknown'],
  'Weapon': ['Unknown']
};

let state = {
  currentFolder: localStorage.getItem('penumbraModFolder') || null,
  currentMods: [],
  selectedMod: null,
  modItems: [], // All IMC items for selected mod
  openIndex: null, // Index of open row
  editItem: null, // Deep copy of item being edited
  search: ''
};

if (state.currentFolder) {
  loadMods(state.currentFolder);
}

selectFolderBtn.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectFolder();
  if (folder) {
    state.currentFolder = folder;
    localStorage.setItem('penumbraModFolder', folder);
    state.selectedMod = null;
    state.modItems = [];
    state.openIndex = null;
    state.editItem = null;
    imcListDiv.innerHTML = '';
    await loadMods(folder);
    renderMods();
  }
});

searchInput.addEventListener('input', () => {
  state.search = searchInput.value;
  renderMods();
});

async function loadMods(folder) {
  state.currentMods = await window.electronAPI.listMods(folder);
  renderMods();
}

function renderMods() {
  const mods = state.search
    ? state.currentMods.filter(name => name.toLowerCase().includes(state.search.toLowerCase()))
    : state.currentMods;
  if (mods.length) {
    modListDiv.innerHTML = mods.map(name => `<div class="mod-item" data-mod="${name}">${name}</div>`).join('');
  } else {
    modListDiv.innerHTML = '<em>No mods found.</em>';
  }
}

modListDiv.addEventListener('click', async (e) => {
  const item = e.target.closest('.mod-item');
  if (!item) return;
  const modName = item.getAttribute('data-mod');
  state.selectedMod = modName;
  searchInput.value = modName;
  state.search = modName;
  renderMods();
  await loadImcGearList(modName);
});

async function loadImcGearList(modName) {
  if (!state.currentFolder || !modName) return;
  imcListDiv.innerHTML = '<em>Loading IMC gear items...</em>';
  let modPath = state.currentFolder;
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
  state.modItems = items;
  state.openIndex = null;
  state.editItem = null;
  renderImcList();
}

function renderImcList() {
  let html = '';
  for (let i = 0; i < state.modItems.length; ++i) {
    if (state.openIndex === i) {
      html += renderOpenRow(state.editItem, i);
    } else {
      html += renderClosedRow(state.modItems[i], i);
    }
  }
  imcListDiv.innerHTML = html;
}

function getFieldVisibility(type) {
  return {
    showSecondary: type === 'Weapon',
    showBodySlot: type === 'Weapon',
    showSlot: type !== 'Weapon'
  };
}

function renderClosedRow(item, idx) {
  const type = item.ObjectType || 'Equipment';
  const { showSecondary, showBodySlot, showSlot } = getFieldVisibility(type);
  const secondaryId = item.SecondaryId !== undefined && item.SecondaryId !== '' ? `, <span class=\"port-secondaryid-label\" style=\"${showSecondary ? '' : 'display:none;'}\">Secondary: ${item.SecondaryId}</span>` : '';
  const bodySlot = item.BodySlot !== undefined && item.BodySlot !== '' ? `, <span class=\"port-bodyslot-label\" style=\"${showBodySlot ? '' : 'display:none;'}\">BodySlot: ${item.BodySlot}</span>` : '';
  const slot = showSlot ? `, <span class=\"port-slot-label\">Slot: ${item.EquipSlot}</span>` : `<span class=\"port-slot-label\" style=\"display:none;\">Slot: ${item.EquipSlot}</span>`;
  return `
    <div class=\"port-row-modern port-row-closed\" data-row-idx=\"${idx}\">\n      <div class=\"port-row-info\">\n        <div class=\"port-col-info\">\n          <div class=\"port-row-header\">\n            <span class=\"port-row-label\">${type}</span> ID: ${item.PrimaryId}${secondaryId}, Variant: ${item.Variant}${slot}${bodySlot}, VFX: ${item.VfxId}\n          </div>\n          <div class=\"port-row-path\">\n            <span class=\"port-row-label\">Path:</span> <span class=\"port-row-path-value\">${item.vfxPath}</span>\n          </div>\n        </div>\n        <div class=\"port-col-right\">\n            <button class=\"big-menu-button arrow open-port-btn\" data-row-idx=\"${idx}\" title=\"Port\">\n            <svg viewBox=\"0 0 32 32\" fill=\"none\"><path d=\"M7 11h18l-4-4\" stroke=\"#8fd1e8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M25 21H7l4 4\" stroke=\"#8fd1e8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n        </button>\n      </div>\n      </div>\n    </div>\n  `;
}

function renderOpenRow(item, idx) {
  const type = item.ObjectType || 'Equipment';
  const { showSecondary, showBodySlot, showSlot } = getFieldVisibility(type);
  const slotList = slotOptions[type] || [];
  const secondaryId = item.SecondaryId !== undefined && item.SecondaryId !== '' ? item.SecondaryId : '';
  const bodySlot = item.BodySlot !== undefined && item.BodySlot !== '' ? item.BodySlot : 'Unknown';
  const projectedPath = getProjectedPath(type, item.PrimaryId, item.VfxId, secondaryId);
  return `
    <div class=\"port-row-modern port-row-open\" data-row-idx=\"${idx}\">\n      <div class=\"port-row-info\">\n        <div class=\"port-col-info\">\n          <div class=\"port-row-header\">\n            <span class=\"port-row-label\">${type}</span> ID: ${item.PrimaryId}${showSecondary && secondaryId !== '' ? `, <span class=\"port-secondaryid-label\">Secondary: ${secondaryId}</span>` : `<span class=\"port-secondaryid-label\" style=\"display:none;\">Secondary: ${secondaryId}</span>`}, Variant: ${item.Variant}${showSlot ? `, <span class=\"port-slot-label\">Slot: ${item.EquipSlot}</span>` : `<span class=\"port-slot-label\" style=\"display:none;\">Slot: ${item.EquipSlot}</span>`}${showBodySlot ? `, <span class=\"port-bodyslot-label\">BodySlot: ${bodySlot}</span>` : `<span class=\"port-bodyslot-label\" style=\"display:none;\">BodySlot: ${bodySlot}</span>`}, VFX: ${item.VfxId}\n          </div>\n          <div class=\"port-row-path\">\n            <span class=\"port-row-label\">Path:</span> <span class=\"port-row-path-value\">${item.vfxPath}</span>\n          </div>\n          <div class=\"port-to-arrow\">\n            <svg viewBox=\"0 0 32 32\" fill=\"none\"><path d=\"M7 11h18l-4-4\" stroke=\"#8fd1e8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M25 21H7l4 4\" stroke=\"#8fd1e8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n          </div>\n          <div class=\"port-row-fields\">\n            <select class=\"port-type\" title=\"Type\">\n              ${typeOptions.map(opt => `<option value=\"${opt}\"${opt === type ? ' selected' : ''}>${opt}</option>`).join('')}\n            </select>\n            <input type=\"text\" class=\"port-equipid\" value=\"${item.PrimaryId}\" title=\"Primary ID\" />\n            <input type=\"text\" class=\"port-secondaryid\" value=\"${secondaryId}\" title=\"Secondary ID\" style=\"${showSecondary ? '' : 'display:none;'}\" />\n            <input type=\"text\" class=\"port-variant\" value=\"${item.Variant}\" title=\"Variant ID\" />\n            <select class=\"port-slot\" title=\"Equip Slot\" style=\"${showSlot ? '' : 'display:none;'}\">\n              ${slotList.map(opt => `<option value=\"${opt}\"${opt === item.EquipSlot ? ' selected' : ''}>${opt}</option>`).join('')}\n            </select>\n            <select class=\"port-bodyslot\" title=\"Body Slot\" style=\"${showBodySlot ? '' : 'display:none;'}\">\n              ${['Unknown', 'Body'].map(opt => `<option value=\"${opt}\"${opt === bodySlot ? ' selected' : ''}>${opt}</option>`).join('')}\n            </select>\n            <input type=\"text\" class=\"port-vfxid\" value=\"${item.VfxId}\" title=\"VFX ID\"/>\n          </div>\n          <div class=\"port-row-projected\">\n            <span class=\"port-row-label\">Path:</span> <span class=\"port-row-path-value projected-path\">${projectedPath}</span>\n          </div>\n        </div>\n        <div class=\"port-col-right\">\n          <button class=\"big-menu-button up close-port-btn\" data-row-idx=\"${idx}\" title=\"Close\">\n            <svg viewBox=\"0 0 32 32\" fill=\"none\"><path d=\"M8 20l8-8 8 8\" stroke=\"#8fd1e8\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n          </button>\n          <button class=\"big-menu-button submit submit-port-btn\" data-row-idx=\"${idx}\" title=\"Submit\">\n            <svg viewBox=\"0 0 32 32\" fill=\"none\"><path d=\"M8 16h16M18 10l6 6-6 6\" stroke=\"#a6e14a\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n          </button>\n        </div>\n      </div>\n    </div>\n  `;
}

function getProjectedPath(type, primaryId, vfxId, secondaryId) {
  const pId = String(primaryId).padStart(4, '0');
  const sId = String(secondaryId).padStart(4, '0');
  const vId = String(vfxId).padStart(4, '0');
  if (type === 'Accessory') {
    return `chara/accessory/a${pId}/vfx/eff/va${vId}.avfx`;
  } else if (type === 'Weapon') {
    return `chara/weapon/w${pId}/obj/body/b${sId}/vfx/eff/vw${vId}.avfx`;
  } else {
    // Default to Equipment
    return `chara/equipment/e${pId}/vfx/eff/ve${vId}.avfx`;
  }
}

imcListDiv.addEventListener('click', (e) => {
  const openBtn = e.target.closest('.open-port-btn');
  if (openBtn) {
    const idx = Number(openBtn.getAttribute('data-row-idx'));
    state.openIndex = idx;
    state.editItem = JSON.parse(JSON.stringify(state.modItems[idx]));
    renderImcList();
    return;
  }
  const closeBtn = e.target.closest('.close-port-btn');
  if (closeBtn) {
    state.openIndex = null;
    state.editItem = null;
    renderImcList();
    return;
  }
});

imcListDiv.addEventListener('input', (e) => {
  if (state.openIndex === null) return;
  const openRow = imcListDiv.querySelector('.port-row-open');
  if (!openRow) return;
  state.editItem.ObjectType = openRow.querySelector('.port-type').value;
  state.editItem.PrimaryId = openRow.querySelector('.port-equipid').value;
  state.editItem.SecondaryId = openRow.querySelector('.port-secondaryid').value;
  state.editItem.Variant = openRow.querySelector('.port-variant').value;
  state.editItem.EquipSlot = openRow.querySelector('.port-slot').value;
  state.editItem.BodySlot = openRow.querySelector('.port-bodyslot').value;
  state.editItem.VfxId = openRow.querySelector('.port-vfxid').value;
  const { showSecondary, showBodySlot, showSlot } = getFieldVisibility(state.editItem.ObjectType);

  // Set default values for hidden fields
  if (!showSlot) {
    state.editItem.EquipSlot = 'Unknown';
    openRow.querySelector('.port-slot').value = 'Unknown';
  }
  if (!showSecondary) {
    state.editItem.SecondaryId = '0';
    openRow.querySelector('.port-secondaryid').value = '0';
  }
  if (!showBodySlot) {
    state.editItem.BodySlot = 'Unknown';
    openRow.querySelector('.port-bodyslot').value = 'Unknown';
  }

  // Update projected path
  const projectedPathEl = openRow.querySelector('.projected-path');
  projectedPathEl.textContent = getProjectedPath(
    state.editItem.ObjectType,
    state.editItem.PrimaryId,
    state.editItem.VfxId,
    state.editItem.SecondaryId
  );
  // Update field visibility
  openRow.querySelector('.port-secondaryid').style.display = showSecondary ? '' : 'none';
  openRow.querySelector('.port-bodyslot').style.display = showBodySlot ? '' : 'none';
  openRow.querySelector('.port-slot').style.display = showSlot ? '' : 'none';
});

imcListDiv.addEventListener('change', (e) => {
  if (state.openIndex === null) return;
  const openRow = imcListDiv.querySelector('.port-row-open');
  if (!openRow) return;
  if (e.target.classList.contains('port-type')) {
    const slotEl = openRow.querySelector('.port-slot');
    const type = openRow.querySelector('.port-type').value;
    const slotList = slotOptions[type] || [];
    const currentSlot = slotEl.value;
    slotEl.innerHTML = slotList.map(opt => `<option value=\"${opt}\"${opt === currentSlot ? ' selected' : ''}>${opt}</option>`).join('');
    if (!slotList.includes(currentSlot) && slotList.length > 0) {
      slotEl.value = slotList[0];
    }
  }
});

imcListDiv.addEventListener('click', async (e) => {
  const submitBtn = e.target.closest('.submit-port-btn');
  if (!submitBtn || state.openIndex === null) return;
  const idx = state.openIndex;
  const item = state.modItems[idx];
  const edit = state.editItem;
  const imcUpdate = {
    ObjectType: edit.ObjectType,
    PrimaryId: edit.PrimaryId,
    SecondaryId: edit.SecondaryId,
    Variant: edit.Variant,
    EquipSlot: edit.EquipSlot,
    BodySlot: edit.BodySlot,
    Entry: { VfxId: edit.VfxId }
  };
  const originalImc = {
    ObjectType: item.ObjectType,
    PrimaryId: item.PrimaryId,
    SecondaryId: item.SecondaryId,
    Variant: item.Variant,
    EquipSlot: item.EquipSlot,
    BodySlot: item.BodySlot,
    Entry: { VfxId: item.VfxId }
  };
  if (!state.currentFolder || !state.selectedMod) return;
  let modFolderPath = state.currentFolder;
  if (!modFolderPath.endsWith("/") && !modFolderPath.endsWith("\\")) modFolderPath += "/";
  modFolderPath += state.selectedMod;
  const originalVfxPath = item.vfxPath;
  const newVfxPath = getProjectedPath(edit.ObjectType, edit.PrimaryId, edit.VfxId, edit.SecondaryId);
  const result = await window.electronAPI.applyVfxPort({
    modFolderPath,
    originalVfxPath,
    newVfxPath,
    imcUpdate,
    originalImc
  });
  if (result) {
    alert('VFX port applied successfully!');
    await loadImcGearList(state.selectedMod);
  } else {
    alert('Failed to apply VFX port.');
  }
});
