
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listMods: (folderPath) => ipcRenderer.invoke('list-mods', folderPath),
  listImcGear: (modFolderPath) => ipcRenderer.invoke('list-imc-gear', modFolderPath),
  applyVfxPort: (args) => ipcRenderer.invoke('apply-vfx-port', args),
});
