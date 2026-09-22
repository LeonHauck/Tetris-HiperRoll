// ============================================================
// Persistência do ranking do HiperTris
// ============================================================
// Três estratégias intercambiáveis, escolhidas automaticamente em
// createLeaderboardService() conforme o ambiente:
//
//  - LocalLeaderboardService    -> localStorage do navegador (padrão)
//  - RemoteLeaderboardService   -> API PHP/MySQL (site publicado, ranking global)
//  - ElectronLeaderboardService -> arquivo local via Electron (app .exe, offline)
//
// Todas expõem a mesma interface:
//   fetchTop()      -> Promise<Array<{name, score}>>
//   submit(entry)   -> Promise<{ rank: number|null, list: Array }>
// "entry" é { name, phone, score }. O telefone nunca é exibido na tela,
// só fica guardado para quem organiza o evento usar depois (ex: sorteio,
// contato de marketing) — nunca aparece no ranking público.

class LocalLeaderboardService {
  constructor() {
    this.key = 'hipertris_leaderboard';
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch (e) {
      return [];
    }
  }

  _save(list) {
    localStorage.setItem(this.key, JSON.stringify(list));
  }

  async fetchTop() {
    return this._load();
  }

  async submit(entry) {
    const list = this._load();
    const record = {
      name: entry.name,
      phone: entry.phone || '',
      score: entry.score,
      date: new Date().toISOString()
    };
    list.push(record);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, 10);
    this._save(trimmed);
    const idx = trimmed.indexOf(record);
    return { rank: idx === -1 ? null : idx + 1, list: trimmed };
  }
}

class RemoteLeaderboardService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fallback = new LocalLeaderboardService();
  }

  async fetchTop() {
    try {
      const res = await fetch(`${this.baseUrl}/leaderboard.php`, { cache: 'no-store' });
      if (!res.ok) throw new Error('resposta inválida do servidor');
      const list = await res.json();
      localStorage.setItem('hipertris_leaderboard_cache', JSON.stringify(list));
      return list;
    } catch (e) {
      // sem internet ou API fora do ar: mostra o último ranking conhecido
      const cached = localStorage.getItem('hipertris_leaderboard_cache');
      return cached ? JSON.parse(cached) : [];
    }
  }

  async submit(entry) {
    try {
      const res = await fetch(`${this.baseUrl}/score.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!res.ok) throw new Error('resposta inválida do servidor');
      const data = await res.json();
      return { rank: data.rank, list: data.leaderboard };
    } catch (e) {
      // sem internet no momento de enviar: guarda local pra não perder a pontuação
      return this.fallback.submit(entry);
    }
  }
}

class ElectronLeaderboardService {
  async fetchTop() {
    return await window.electronAPI.getLeaderboard();
  }

  async submit(entry) {
    return await window.electronAPI.saveScore(entry);
  }
}

function createLeaderboardService() {
  if (window.electronAPI) return new ElectronLeaderboardService();
  const cfg = window.HIPERTRIS_CONFIG || {};
  if (cfg.apiBaseUrl) return new RemoteLeaderboardService(cfg.apiBaseUrl);
  return new LocalLeaderboardService();
}
