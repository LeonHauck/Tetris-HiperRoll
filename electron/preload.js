// Ponte segura entre a janela do jogo (HTML/JS comum) e o processo principal
// do Electron. Só expõe as 3 funções que o jogo realmente usa.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getLeaderboard: () => ipcRenderer.invoke('get-leaderboard'),
  saveScore: (entry) => ipcRenderer.invoke('save-score', entry),
  exportCSV: () => ipcRenderer.invoke('export-csv'),
});
