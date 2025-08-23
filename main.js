
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Handler to apply VFX port and update IMC in all JSON files in a mod folder
ipcMain.handle('apply-vfx-port', async (event, args) => {
  const { modFolderPath, originalVfxPath, newVfxPath, imcUpdate, originalImc = {} } = args;
  const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        walkSync(fullPath, filelist);
      } else if (dirent.isFile() && fullPath.endsWith('.json')) {
        filelist.push(fullPath);
      }
    });
    return filelist;
  };
  try {
    const files = walkSync(modFolderPath);
    console.log('[apply-vfx-port] Files found:', files);
    let anyChanged = false;
    for (const filePath of files) {
      let changed = false;
      let raw = fs.readFileSync(filePath, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      let newRaw = raw.split(originalVfxPath).join(newVfxPath);
      let data;
      try { data = JSON.parse(newRaw); } catch { console.log('[apply-vfx-port] Failed to parse JSON:', filePath); continue; }
      // Update IMC if needed
      const updateImc = (manips) => {
        if (!Array.isArray(manips)) return;
        for (const manip of manips) {
          if (manip.Type === 'Imc' && manip.Manipulation && manip.Manipulation.Entry) {
            const entry = manip.Manipulation;
            // Debug: print what we're checking
            console.log('[apply-vfx-port] Checking IMC:', {
              filePath,
              ObjectType: entry.ObjectType,
              PrimaryId: entry.PrimaryId,
              SecondaryId: entry.SecondaryId,
              Variant: entry.Variant,
              EquipSlot: entry.EquipSlot,
              BodySlot: entry.BodySlot,
              VfxId: entry.Entry.VfxId
            }, 'vs', originalImc);
            // Match against originalImc (not imcUpdate)
            if (
              entry.ObjectType === originalImc.ObjectType &&
              Number(entry.PrimaryId) === Number(originalImc.PrimaryId) &&
              Number(entry.SecondaryId || 0) === Number(originalImc.SecondaryId || 0) &&
              Number(entry.Variant) === Number(originalImc.Variant) &&
              String(entry.EquipSlot) === String(originalImc.EquipSlot) &&
              String(entry.BodySlot || 'Unknown') === String(originalImc.BodySlot || 'Unknown') &&
              Number(entry.Entry.VfxId) === Number(originalImc.Entry.VfxId)
            ) {
              console.log('[apply-vfx-port] IMC match found, updating Entry in', filePath);
              // Update only the specified fields
              entry.ObjectType = imcUpdate.ObjectType;
              entry.PrimaryId = imcUpdate.PrimaryId;
              entry.SecondaryId = imcUpdate.SecondaryId;
              entry.Variant = imcUpdate.Variant;
              entry.EquipSlot = imcUpdate.EquipSlot;
              entry.BodySlot = imcUpdate.BodySlot;
              if (entry.Entry) entry.Entry.VfxId = imcUpdate.Entry.VfxId;
              changed = true;
            }
          }
        }
      };
      if (Array.isArray(data.Options)) {
        for (const opt of data.Options) updateImc(opt.Manipulations);
      }
      if (Array.isArray(data.Manipulations)) updateImc(data.Manipulations);
      if (raw !== newRaw || changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log('[apply-vfx-port] File written:', filePath);
        anyChanged = true;
      }
    }
    if (!anyChanged) console.log('[apply-vfx-port] No files changed.');
    return true;
  } catch (e) {
    console.log('[apply-vfx-port] Error:', e);
    return false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile('index.html');

  // Remove the default menu/toolbar for a clean look
  win.setMenuBarVisibility(false);
  win.removeMenu();

  // Force all external links to open in the user's default browser
  const { shell } = require('electron');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('list-mods', async (event, folderPath) => {
  if (!folderPath) return [];
  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    return items.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
  } catch (e) {
    return [];
  }
});

// Handler to scan a mod folder for all IMC gear changes
ipcMain.handle('list-imc-gear', async (event, modFolderPath) => {
  if (!modFolderPath) return [];
  const path = require('path');
  const fs = require('fs');
  let allImc = [];
  try {
    const files = fs.readdirSync(modFolderPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(modFolderPath, file);
      let data;
      try {
        let raw = fs.readFileSync(filePath, 'utf8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        data = JSON.parse(raw);
      } catch (e) {
        continue;
      }
      let manipLists = [];
      if (Array.isArray(data.Options)) {
        for (const opt of data.Options) {
          if (Array.isArray(opt.Manipulations)) {
            manipLists.push(...opt.Manipulations);
          }
        }
      }
      if (Array.isArray(data.Manipulations)) {
        manipLists.push(...data.Manipulations);
      }
      for (const manip of manipLists) {
        if (manip.Type === 'Imc' && manip.Manipulation && manip.Manipulation.Entry) {
          const entry = manip.Manipulation;
          const entryData = entry.Entry || {};
          let vfxIdStr = String(entryData.VfxId).padStart(4, '0');
          let primaryIdStr = String(entry.PrimaryId).padStart(4, '0');
          let vfxPath = '';
          let secondaryIdStr = entry.SecondaryId !== undefined ? String(entry.SecondaryId).padStart(4, '0') : '';
          if (entry.ObjectType === 'Accessory') {
            vfxPath = `chara/accessory/a${primaryIdStr}/vfx/eff/va${vfxIdStr}.avfx`;
          } else if (entry.ObjectType === 'Equipment') {
            vfxPath = `chara/equipment/e${primaryIdStr}/vfx/eff/ve${vfxIdStr}.avfx`;
          } else {
            vfxPath = '(Unknown type)';
          }
          allImc.push({
            ObjectType: entry.ObjectType,
            PrimaryId: entry.PrimaryId,
            SecondaryId: entry.SecondaryId,
            Variant: entry.Variant,
            EquipSlot: entry.EquipSlot,
            BodySlot: entry.BodySlot,
            VfxId: entryData.VfxId,
            vfxPath
          });
        }
      }
    }
    // Count occurrences
    const imcCountMap = {};
    const pathCountMap = {};
    allImc.forEach(item => {
      const imcKey = [item.ObjectType, item.PrimaryId, item.SecondaryId, item.Variant, item.EquipSlot, item.BodySlot, item.VfxId].join('-');
      imcCountMap[imcKey] = (imcCountMap[imcKey] || 0) + 1;
      pathCountMap[item.vfxPath] = (pathCountMap[item.vfxPath] || 0) + 1;
    });
    // Only return unique IMC changes, with counts
    const seen = new Set();
    const results = [];
    allImc.forEach(item => {
      const imcKey = [item.ObjectType, item.PrimaryId, item.SecondaryId, item.Variant, item.EquipSlot, item.BodySlot, item.VfxId].join('-');
      if (!seen.has(imcKey)) {
        seen.add(imcKey);
        results.push({
          ...item,
          imcCount: imcCountMap[imcKey],
          pathCount: pathCountMap[item.vfxPath]
        });
      }
    });
    return results;
  } catch (e) {
    return [];
  }
});
