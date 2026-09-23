// ============================================================
// HiperTris - Tetris da HiperRoll
// ============================================================

const COLS = 10;
const ROWS = 20;
const CELL = 32;

// Cada tipo de peça tem 2 tons neon possíveis, sorteados a cada peça nova
// (mais variedade visual sem mudar as 7 formas clássicas do Tetris).
const COLOR_VARIANTS = {
  I: ['#00F0FF', '#00B8FF'],
  O: ['#FFEA00', '#FFC400'],
  T: ['#D400FF', '#A600FF'],
  S: ['#00FF66', '#39FF14'],
  Z: ['#FF1744', '#FF0044'], // vermelho HiperRoll neon
  J: ['#2979FF', '#1F5CFF'],
  L: ['#FF9100', '#FF6D00']
};
// Cor "de referência" de cada tipo, usada nas prévias (próxima peça / guardada)
const COLORS = Object.fromEntries(
  Object.entries(COLOR_VARIANTS).map(([type, variants]) => [type, variants[0]])
);

// Shapes defined in a 4x4 (or smaller) grid, rotation 0
const SHAPES = {
  I: [
    [0,0,0,0],
    [1,1,1,1],
    [0,0,0,0],
    [0,0,0,0]
  ],
  O: [
    [1,1],
    [1,1]
  ],
  T: [
    [0,1,0],
    [1,1,1],
    [0,0,0]
  ],
  S: [
    [0,1,1],
    [1,1,0],
    [0,0,0]
  ],
  Z: [
    [1,1,0],
    [0,1,1],
    [0,0,0]
  ],
  J: [
    [1,0,0],
    [1,1,1],
    [0,0,0]
  ],
  L: [
    [0,0,1],
    [1,1,1],
    [0,0,0]
  ]
};

const PIECE_TYPES = Object.keys(SHAPES);

function rotateMatrix(matrix) {
  const n = matrix.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push([]);
    for (let j = 0; j < n; j++) {
      result[i][j] = matrix[n - 1 - j][i];
    }
  }
  return result;
}

function cloneMatrix(m) {
  return m.map(row => row.slice());
}

// ---------- Bag randomizer (7-bag) ----------
function makeBag() {
  const bag = PIECE_TYPES.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

class PieceQueue {
  constructor() {
    this.queue = [...makeBag(), ...makeBag()];
  }
  next() {
    if (this.queue.length <= 7) {
      this.queue.push(...makeBag());
    }
    return this.queue.shift();
  }
  peek(n) {
    return this.queue.slice(0, n);
  }
}

class Piece {
  constructor(type) {
    this.type = type;
    this.matrix = cloneMatrix(SHAPES[type]);
    const variants = COLOR_VARIANTS[type];
    this.color = variants[Math.floor(Math.random() * variants.length)];
    this.x = Math.floor((COLS - this.matrix.length) / 2);
    this.y = type === 'I' ? -1 : -2;
    if (type === 'O') this.y = -1;
  }
  cells() {
    const out = [];
    for (let r = 0; r < this.matrix.length; r++) {
      for (let c = 0; c < this.matrix[r].length; c++) {
        if (this.matrix[r][c]) out.push({ x: this.x + c, y: this.y + r });
      }
    }
    return out;
  }
}

// ---------- Board ----------
class Board {
  constructor() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }
  isValid(piece, offsetX = 0, offsetY = 0, matrix = null) {
    const mat = matrix || piece.matrix;
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (!mat[r][c]) continue;
        const x = piece.x + c + offsetX;
        const y = piece.y + r + offsetY;
        if (x < 0 || x >= COLS || y >= ROWS) return false;
        if (y >= 0 && this.grid[y][x]) return false;
      }
    }
    return true;
  }
  lock(piece) {
    piece.cells().forEach(({ x, y }) => {
      if (y >= 0) this.grid[y][x] = piece.color;
    });
  }
  getFullRows() {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.grid[r].every(cell => cell !== null)) rows.push(r);
    }
    return rows;
  }
  clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== null)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    return cleared;
  }
}

// ---------- Sound ----------
// Melodia e efeitos gerados por síntese (Web Audio API) para não depender de
// arquivos de áudio externos. Loop curto e suave para não cansar em uso contínuo.
const MUSIC_LEAD = [
  523.25, 659.25, 783.99, 659.25, 440.00, 523.25, 659.25, 523.25,
  349.23, 440.00, 523.25, 440.00, 392.00, 493.88, 587.33, 493.88
];
const MUSIC_BASS = [130.81, 110.00, 174.61, 196.00];

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('hipertris_muted') === 'true';
    this.musicPlaying = false;
    this.musicStep = 0;
    this.musicTimer = null;
    this.stepMs = 260;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playTone(freq, duration, type = 'square', vol = 0.12, when = 0) {
    if (this.muted) return;
    this.ensureContext();
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  move() { this.playTone(220, 0.05, 'square', 0.05); }
  rotate() { this.playTone(330, 0.06, 'square', 0.07); }
  softDrop() { this.playTone(140, 0.04, 'square', 0.04); }
  hardDrop() { this.playTone(90, 0.12, 'square', 0.09); }
  lock() { this.playTone(160, 0.08, 'triangle', 0.07); }
  hold() { this.playTone(300, 0.08, 'sine', 0.07); }
  lineClear(count) {
    // Arpejo ascendente "de bônus" + brilho no topo — quanto mais linhas, mais festa.
    const arpeggio = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    for (let i = 0; i < count; i++) {
      this.playTone(arpeggio[Math.min(i, arpeggio.length - 1)], 0.16, 'square', 0.13, i * 0.06);
    }
    this.playTone(1567.98, 0.22, 'sine', 0.09, count * 0.06 + 0.04); // sparkle
    if (count >= 4) this.playTone(2093.0, 0.26, 'sine', 0.1, count * 0.06 + 0.14); // bônus extra no Tetris
  }
  levelUp() { [523, 659, 784].forEach((f, i) => this.playTone(f, 0.13, 'square', 0.09, i * 0.09)); }
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.playTone(f, 0.28, 'triangle', 0.1, i * 0.18)); }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('hipertris_muted', this.muted);
    if (this.muted) this.stopMusic(); else this.startMusic();
    return this.muted;
  }

  startMusic() {
    if (this.muted || this.musicPlaying) return;
    this.ensureContext();
    this.musicPlaying = true;
    this._tickMusic();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  _tickMusic() {
    if (!this.musicPlaying) return;
    const step = this.musicStep % MUSIC_LEAD.length;
    this.playTone(MUSIC_LEAD[step], 0.22, 'sine', 0.035);
    if (step % 4 === 0) {
      const bassNote = MUSIC_BASS[(step / 4) % MUSIC_BASS.length];
      this.playTone(bassNote, 0.9, 'triangle', 0.05);
    }
    this.musicStep++;
    this.musicTimer = setTimeout(() => this._tickMusic(), this.stepMs);
  }
}

// ---------- Game ----------
class Game {
  constructor() {
    this.boardCanvas = document.getElementById('board-canvas');
    this.boardCtx = this.boardCanvas.getContext('2d');
    this.nextCtx = document.getElementById('next-canvas').getContext('2d');
    this.next2Ctx = document.getElementById('next-canvas-2').getContext('2d');
    this.next3Ctx = document.getElementById('next-canvas-3').getContext('2d');
    this.holdCtx = document.getElementById('hold-canvas').getContext('2d');

    this.scoreEl = document.getElementById('score');
    this.levelEl = document.getElementById('level');
    this.linesEl = document.getElementById('lines');
    this.highscoreEl = document.getElementById('highscore');
    this.finalScoreEl = document.getElementById('final-score');
    this.scoreBreakdownEl = document.getElementById('score-breakdown');
    this.newRecordEl = document.getElementById('new-record');

    this.pauseOverlay = document.getElementById('pause-overlay');
    this.pauseMainBox = document.getElementById('pause-main-box');
    this.pauseRankingBox = document.getElementById('pause-ranking-box');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.rankMsgEl = document.getElementById('rank-msg');
    this.playerNameDisplayEl = document.getElementById('player-name-display');

    this.sound = new SoundManager();
    this.playerName = '';
    this.playerPhone = '';

    this.leaderboardService = createLeaderboardService();
    this.leaderboard = [];
    this.highscore = 0;
    this.refreshLeaderboard();

    this.reset();
    this.bindInput();
  }

  // ---------- Leaderboard ----------
  async refreshLeaderboard() {
    this.leaderboard = await this.leaderboardService.fetchTop();
    this.highscore = this.leaderboard.length ? this.leaderboard[0].score : 0;
    this.highscoreEl.textContent = this.highscore;
    this.renderLeaderboard();
  }

  renderLeaderboard() {
    this.renderLeaderboardInto('leaderboard-list');
    this.renderLeaderboardInto('pause-leaderboard-list');
  }

  renderLeaderboardInto(listElId) {
    const listEl = document.getElementById(listElId);
    if (!listEl) return;
    listEl.innerHTML = '';
    if (this.leaderboard.length === 0) {
      const li = document.createElement('li');
      li.className = 'leaderboard-empty';
      li.textContent = 'Seja o primeiro a jogar!';
      listEl.appendChild(li);
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    this.leaderboard.forEach((entry, i) => {
      const li = document.createElement('li');
      if (i < 3) li.classList.add(`rank-${i + 1}`);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = medals[i] ? `${medals[i]} ${entry.name}` : entry.name;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'lb-score';
      scoreSpan.textContent = entry.score;
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      listEl.appendChild(li);
    });
  }

  reset() {
    this.board = new Board();
    this.queue = new PieceQueue();
    this.current = new Piece(this.queue.next());
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.lastTime = null;
    this.paused = false;
    this.gameOver = false;
    this.softDropping = false;
    this.flashRows = null;
    this.flashUntil = 0;

    this.scoreEl.textContent = '0';
    this.levelEl.textContent = '1';
    this.linesEl.textContent = '0';
    this.pauseOverlay.classList.add('hidden');
    this.gameoverOverlay.classList.add('hidden');
    this.newRecordEl.classList.add('hidden');
    this.rankMsgEl.classList.add('hidden');
    this.scoreBreakdownEl.textContent = '';
  }

  bindInput() {
    document.addEventListener('keydown', (e) => {
      if (this.gameOver) return;
      if (document.getElementById('game-screen').classList.contains('hidden')) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.move(-1); e.preventDefault(); break;
        case 'ArrowRight': case 'KeyD': this.move(1); e.preventDefault(); break;
        case 'ArrowDown': case 'KeyS': this.softDrop(); e.preventDefault(); break;
        case 'ArrowUp': case 'KeyW': case 'KeyX': this.rotate(1); e.preventDefault(); break;
        case 'KeyZ': this.rotate(-1); e.preventDefault(); break;
        case 'Space': this.hardDrop(); e.preventDefault(); break;
        case 'KeyC': this.holdPiece(); e.preventDefault(); break;
        case 'KeyP': this.togglePause(); e.preventDefault(); break;
      }
    });

    const bindHold = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('click', fn);
    };
    bindHold('mc-left', () => this.move(-1));
    bindHold('mc-right', () => this.move(1));
    bindHold('mc-rotate', () => this.rotate(1));
    bindHold('mc-down', () => this.softDrop());
    bindHold('mc-drop', () => this.hardDrop());
    bindHold('mc-hold', () => this.holdPiece());

    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());

    document.getElementById('pause-restart-btn').addEventListener('click', () => this.start());
    document.getElementById('pause-ranking-btn').addEventListener('click', () => this.showPauseRanking());
    document.getElementById('pause-ranking-close-btn').addEventListener('click', () => this.hidePauseRanking());
  }

  showPauseRanking() {
    this.pauseMainBox.classList.add('hidden');
    this.pauseRankingBox.classList.remove('hidden');
  }

  hidePauseRanking() {
    this.pauseRankingBox.classList.add('hidden');
    this.pauseMainBox.classList.remove('hidden');
  }

  get isBusy() {
    // "Busy" = não pode receber comando: pausado, fim de jogo, ou peça
    // ainda brilhando antes de sumir da linha completada.
    return this.paused || this.gameOver || !!this.flashRows;
  }

  move(dx) {
    if (this.isBusy) return;
    if (this.board.isValid(this.current, dx, 0)) {
      this.current.x += dx;
      this.sound.move();
    }
  }

  softDrop() {
    if (this.isBusy) return;
    if (this.board.isValid(this.current, 0, 1)) {
      this.current.y += 1;
      this.score += 1;
      this.sound.softDrop();
      this.updateScore();
    } else {
      this.lockPiece();
    }
    this.dropCounter = 0;
  }

  hardDrop() {
    if (this.isBusy) return;
    let dist = 0;
    while (this.board.isValid(this.current, 0, 1)) {
      this.current.y += 1;
      dist++;
    }
    this.score += dist * 2;
    this.sound.hardDrop();
    this.updateScore();
    this.lockPiece();
  }

  rotate(dir) {
    if (this.isBusy) return;
    const piece = this.current;
    if (piece.type === 'O') return;
    const original = piece.matrix;
    let rotated = original;
    if (dir === 1) rotated = rotateMatrix(original);
    else { rotated = rotateMatrix(rotateMatrix(rotateMatrix(original))); }

    const kicks = [0, -1, 1, -2, 2];
    for (const kx of kicks) {
      if (this.board.isValid(piece, kx, 0, rotated)) {
        piece.matrix = rotated;
        piece.x += kx;
        this.sound.rotate();
        return;
      }
    }
  }

  holdPiece() {
    if (this.isBusy || !this.canHold) return;
    const currentType = this.current.type;
    if (this.hold === null) {
      this.hold = currentType;
      this.current = new Piece(this.queue.next());
    } else {
      const swap = this.hold;
      this.hold = currentType;
      this.current = new Piece(swap);
    }
    this.canHold = false;
    this.sound.hold();
    if (!this.board.isValid(this.current, 0, 0)) {
      this.triggerGameOver();
    }
  }

  lockPiece() {
    this.board.lock(this.current);
    const fullRows = this.board.getFullRows();
    if (fullRows.length > 0) {
      // Segura a peça brilhando por um instante antes de sumir de verdade —
      // a limpeza (pontos, próxima peça etc.) acontece em finalizeLineClear().
      this.sound.lineClear(fullRows.length);
      this.flashRows = fullRows;
      this.flashUntil = performance.now() + 180 + fullRows.length * 25;
    } else {
      this.sound.lock();
      this.current = new Piece(this.queue.next());
      this.canHold = true;
      if (!this.board.isValid(this.current, 0, 0)) {
        this.triggerGameOver();
      }
    }
  }

  finalizeLineClear() {
    const cleared = this.board.clearLines();
    const points = [0, 100, 300, 500, 800][cleared] * this.level;
    this.score += points;
    this.lines += cleared;
    const prevLevel = this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 80);
    this.updateScore();
    if (this.level > prevLevel) this.sound.levelUp();

    this.flashRows = null;
    this.current = new Piece(this.queue.next());
    this.canHold = true;
    if (!this.board.isValid(this.current, 0, 0)) {
      this.triggerGameOver();
    }
  }

  updateScore() {
    this.scoreEl.textContent = this.score;
    this.levelEl.textContent = this.level;
    this.linesEl.textContent = this.lines;
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.pauseOverlay.classList.toggle('hidden', !this.paused);
    if (this.paused) {
      this.hidePauseRanking();
      this.refreshLeaderboard();
      this.sound.stopMusic();
    } else {
      this.sound.startMusic();
    }
  }

  triggerGameOver() {
    this.gameOver = true;
    this.sound.stopMusic();
    this.sound.gameOver();

    // Pontuação final = pontos feitos x quantidade de linhas completadas.
    // Sem nenhuma linha completada não faz sentido zerar quem já pontuou:
    // nesse caso vale só a pontuação feita, sem multiplicar por zero.
    const baseScore = this.score;
    const finalScore = this.lines > 0 ? baseScore * this.lines : baseScore;
    this.score = finalScore;

    this.finalScoreEl.textContent = finalScore;
    this.scoreBreakdownEl.textContent = this.lines > 0
      ? `${baseScore} pontos × ${this.lines} linha${this.lines === 1 ? '' : 's'} = ${finalScore}`
      : `${baseScore} pontos (nenhuma linha completada)`;
    this.gameoverOverlay.classList.remove('hidden');

    this.leaderboardService.submit({
      name: this.playerName,
      phone: this.playerPhone,
      score: finalScore
    }).then(result => {
      if (result.list) {
        this.leaderboard = result.list;
        this.renderLeaderboard();
      }
      if (result.rank) {
        this.rankMsgEl.textContent = `${this.playerName}, você ficou em Nº ${result.rank} no ranking!`;
        this.rankMsgEl.classList.remove('hidden');
        if (result.rank === 1) {
          this.highscore = this.score;
          this.highscoreEl.textContent = this.highscore;
          this.newRecordEl.classList.remove('hidden');
        }
      }
    }).catch(() => {
      // pontuação já está na tela; se o envio falhar, o jogador não perde o resultado local
    });
  }

  ghostY() {
    let gy = this.current.y;
    while (this.board.isValid(this.current, 0, gy - this.current.y + 1)) {
      gy++;
    }
    return gy;
  }

  drawCell(ctx, x, y, color, size, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 9;
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.globalAlpha = 1;
  }

  // Brilho branco pulsante nas linhas completadas, antes de sumirem de vez.
  drawFlashCell(ctx, x, y, time) {
    const pulse = 0.65 + 0.35 * Math.sin(time / 40);
    ctx.globalAlpha = 1;
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 22;
    ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.shadowBlur = 0;
  }

  drawBoard() {
    const ctx = this.boardCtx;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }

    // locked cells (linhas completadas piscam em branco antes de sumir)
    const now = performance.now();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.board.grid[r][c]) {
          if (this.flashRows && this.flashRows.includes(r)) {
            this.drawFlashCell(ctx, c, r, now);
          } else {
            this.drawCell(ctx, c, r, this.board.grid[r][c], CELL);
          }
        }
      }
    }

    if (!this.flashRows) {
      // ghost piece
      const gy = this.ghostY();
      this.current.cells().forEach(({ x, y }) => {
        const dy = y + (gy - this.current.y);
        if (dy >= 0) this.drawCell(ctx, x, dy, this.current.color, CELL, 0.2);
      });

      // current piece
      this.current.cells().forEach(({ x, y }) => {
        if (y >= 0) this.drawCell(ctx, x, y, this.current.color, CELL);
      });
    }
  }

  drawMini(ctx, type, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!type) return;
    const mat = SHAPES[type];
    const color = COLORS[type];
    const size = Math.min(canvas.width, canvas.height) / 4.4;
    let minX = mat[0].length, maxX = 0, minY = mat.length, maxY = 0;
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (mat[r][c]) {
          minX = Math.min(minX, c); maxX = Math.max(maxX, c);
          minY = Math.min(minY, r); maxY = Math.max(maxY, r);
        }
      }
    }
    const w = (maxX - minX + 1) * size;
    const h = (maxY - minY + 1) * size;
    const offsetX = (canvas.width - w) / 2;
    const offsetY = (canvas.height - h) / 2;
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (mat[r][c]) {
          const x = offsetX + (c - minX) * size;
          const y = offsetY + (r - minY) * size;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fillStyle = color;
          ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
        }
      }
    }
  }

  drawSidebars() {
    const upcoming = this.queue.peek(3);
    this.drawMini(this.nextCtx, upcoming[0], document.getElementById('next-canvas'));
    this.drawMini(this.next2Ctx, upcoming[1], document.getElementById('next-canvas-2'));
    this.drawMini(this.next3Ctx, upcoming[2], document.getElementById('next-canvas-3'));
    this.drawMini(this.holdCtx, this.hold, document.getElementById('hold-canvas'));
  }

  loop(time = 0) {
    if (this.gameOver) return; // stop this animation chain; start() begins a fresh one on restart

    if (this.lastTime === null) this.lastTime = time;
    const delta = time - this.lastTime;
    this.lastTime = time;
    if (!this.paused) {
      if (this.flashRows) {
        if (time >= this.flashUntil) this.finalizeLineClear();
      } else {
        this.dropCounter += delta;
        if (this.dropCounter > this.dropInterval) {
          if (this.board.isValid(this.current, 0, 1)) {
            this.current.y += 1;
          } else {
            this.lockPiece();
          }
          this.dropCounter = 0;
        }
      }
      this.drawBoard();
      this.drawSidebars();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  start() {
    this.reset();
    this.sound.startMusic();
    requestAnimationFrame((t) => this.loop(t));
  }
}

// ---------- Screen management ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

const game = new Game();

// O campo de telefone só existe no app desktop (Electron) — no site/navegador
// só se pede o nome. O leaderboard.js já escolhe o back-end certo sozinho.
const isDesktopApp = !!window.electronAPI;

const nameInput = document.getElementById('player-name');
const phoneInput = document.getElementById('player-phone');
const phoneField = document.getElementById('phone-field');
const nameError = document.getElementById('name-error');
const savedName = localStorage.getItem('hipertris_playername');
if (savedName) nameInput.value = savedName;

if (isDesktopApp) {
  const savedPhone = localStorage.getItem('hipertris_playerphone');
  if (savedPhone) phoneInput.value = savedPhone;
  nameError.textContent = 'Preencha nome e telefone para jogar!';
} else {
  phoneField.classList.add('hidden');
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
phoneInput.addEventListener('input', () => {
  // Preserva a posição do cursor (contando a partir do fim) ao reformatar,
  // senão digitar rápido faz o cursor pular e embaralha os dígitos.
  const cursorFromEnd = phoneInput.value.length - (phoneInput.selectionStart ?? phoneInput.value.length);
  phoneInput.value = formatPhone(phoneInput.value);
  const newPos = Math.max(0, phoneInput.value.length - cursorFromEnd);
  phoneInput.setSelectionRange(newPos, newPos);
  nameError.classList.add('hidden');
});

function updateMuteButtons(muted) {
  const label = muted ? 'Som: Mudo' : 'Som: Ligado';
  document.getElementById('mute-btn').textContent = label;
  document.getElementById('mute-btn-start').textContent = label;
}
updateMuteButtons(game.sound.muted);

function toggleMuteGlobal() {
  const muted = game.sound.toggleMute();
  updateMuteButtons(muted);
}
document.getElementById('mute-btn').addEventListener('click', toggleMuteGlobal);
document.getElementById('mute-btn-start').addEventListener('click', toggleMuteGlobal);

function tryStartGame() {
  const name = nameInput.value.trim();
  const phoneDigits = phoneInput.value.replace(/\D/g, '');
  const phoneMissing = isDesktopApp && phoneDigits.length < 8;
  if (!name || phoneMissing) {
    nameError.classList.remove('hidden');
    const invalidEl = !name ? nameInput : phoneInput;
    invalidEl.classList.add('input-error');
    invalidEl.focus();
    setTimeout(() => invalidEl.classList.remove('input-error'), 300);
    return;
  }
  nameError.classList.add('hidden');
  localStorage.setItem('hipertris_playername', name);
  if (isDesktopApp) localStorage.setItem('hipertris_playerphone', phoneInput.value);

  showScreen('game-screen');
  game.playerName = name;
  game.playerPhone = isDesktopApp ? phoneInput.value : '';
  document.getElementById('player-name-display').textContent = `Jogador: ${name}`;
  game.start();
}

document.getElementById('start-btn').addEventListener('click', tryStartGame);
[nameInput, phoneInput].forEach(el => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryStartGame();
  });
  el.addEventListener('input', () => nameError.classList.add('hidden'));
});

document.getElementById('restart-btn').addEventListener('click', () => {
  game.start();
});

document.getElementById('menu-btn').addEventListener('click', () => {
  showScreen('start-screen');
  game.refreshLeaderboard();
});

// Atalho só disponível no app desktop (Electron): exporta nome, telefone,
// pontuação e data de todo mundo que já jogou nesse computador em um CSV,
// para quem organiza o evento usar depois. Não aparece em nenhum botão.
if (window.electronAPI) {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
      e.preventDefault();
      window.electronAPI.exportCSV();
    }
  });
}
