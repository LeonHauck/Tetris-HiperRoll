// Processo principal do Electron: cria a janela do jogo e guarda os dados
// (nome, telefone, pontuação e data) numa pasta "data" bem ao lado do
// próprio programa — pensado pra rodar de um pendrive ou pasta qualquer
// no evento, sem instalar nada e sem depender de internet.
//
// Estrutura gerada automaticamente na primeira vez que alguém joga:
//   data/hipertris-dados.json   (usado pelo próprio jogo pro ranking)
//   data/hipertris-dados.csv    (abre direto no Excel, sempre atualizado)

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Quando empacotado (o .exe de verdade), a pasta "data" fica ao lado do
// executável. Em desenvolvimento (`npm start`), fica na raiz do projeto.
const BASE_DIR = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.join(__dirname, '..');

const DATA_DIR = path.join(BASE_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'hipertris-dados.json');
const CSV_FILE = path.join(DATA_DIR, 'hipertris-dados.csv');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAllScores() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveAllScores(list) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function escapeCsv(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

// Reescreve o CSV inteiro a partir da lista atual — chamado toda vez que
// alguém termina uma partida, então o arquivo já fica pronto pra abrir
// no Excel a qualquer momento, sem precisar exportar nada manualmente.
function writeCsv(all) {
  ensureDataDir();
  const header = ['Nome', 'Telefone', 'Pontuação', 'Data'].map(escapeCsv).join(';');
  const rows = all.map(r => [r.name, r.phone, r.score, r.date].map(escapeCsv).join(';'));
  const csv = '﻿' + [header, ...rows].join('\r\n'); // BOM = acentuação certinha no Excel
  fs.writeFileSync(CSV_FILE, csv, 'utf-8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 480,
    minHeight: 720,
    backgroundColor: '#0a0e27',
    icon: path.join(__dirname, '..', 'icone', 'hipertris.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: ranking e persistência local ----------

ipcMain.handle('get-leaderboard', () => {
  const all = loadAllScores();
  return all
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ name, score }) => ({ name, score }));
});

ipcMain.handle('save-score', (event, entry) => {
  const all = loadAllScores();
  const record = {
    name: String((entry && entry.name) || '').slice(0, 40),
    phone: String((entry && entry.phone) || '').slice(0, 30),
    score: Math.max(0, parseInt(entry && entry.score, 10) || 0),
    date: new Date().toISOString(),
  };
  all.push(record);
  saveAllScores(all);
  writeCsv(all);

  const ranked = all.slice().sort((a, b) => b.score - a.score);
  const rankIdx = ranked.indexOf(record);
  const rank = rankIdx !== -1 && rankIdx < 10 ? rankIdx + 1 : null;
  const list = ranked.slice(0, 10).map(({ name, score }) => ({ name, score }));

  return { rank, list };
});

// Atalho Ctrl+Shift+E dentro do jogo: salva uma cópia extra do CSV onde
// você quiser (ex: levar só esse arquivo, sem mexer na pasta data/).
// O data/hipertris-dados.csv já fica sempre atualizado sozinho.
ipcMain.handle('export-csv', async () => {
  const all = loadAllScores();

  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Salvar cópia dos dados do HiperTris',
    defaultPath: `hipertris-dados-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });

  if (canceled || !filePath) return { ok: false };

  const header = ['Nome', 'Telefone', 'Pontuação', 'Data'].map(escapeCsv).join(';');
  const rows = all.map(r => [r.name, r.phone, r.score, r.date].map(escapeCsv).join(';'));
  const csv = '﻿' + [header, ...rows].join('\r\n');

  fs.writeFileSync(filePath, csv, 'utf-8');
  return { ok: true, filePath, count: all.length };
});
