// Persistencia en localStorage: configuración, controles, progreso, estadísticas y fantasmas.
import { SAVE_KEY, GHOST_KEY_PREFIX, DEFAULT_SETTINGS, DEFAULT_CONTROLS, ACTIONS } from '../config.js';

const SAVE_VERSION = 1;
const TROPHY_RANK = { gold: 3, silver: 2, bronze: 1 };

function createStorage() {
  try {
    const k = '__kartopia_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch (e) {
    // Modo privado / almacenamiento bloqueado: memoria volátil.
    const mem = new Map();
    return {
      getItem: (key) => (mem.has(key) ? mem.get(key) : null),
      setItem: (key, v) => mem.set(key, String(v)),
      removeItem: (key) => mem.delete(key),
      _volatile: true,
    };
  }
}

function defaultStats() {
  return {
    racesPlayed: 0,
    racesWon: 0,
    podiums: 0,
    gpPlayed: 0,
    gpWon: 0,
    timeTrials: 0,
    distance: 0,
    playTime: 0,
    driftBoosts: [0, 0, 0],
    tricks: 0,
    itemsUsed: 0,
    hitsLanded: 0,
    timesHit: 0,
    falls: 0,
    bestTimes: {},
    trackPlays: {},
    characterPlays: {},
  };
}

function defaultData() {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    controls: JSON.parse(JSON.stringify(DEFAULT_CONTROLS)),
    progress: { cups: {}, firstPlay: Date.now() },
    stats: defaultStats(),
  };
}

export class SaveManager {
  constructor(storage = null) {
    this.storage = storage || createStorage();
    this.data = defaultData();
    this._saveTimer = null;
    this.load();
  }

  get volatile() {
    return !!this.storage._volatile;
  }

  load() {
    let raw = null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const base = defaultData();
      this.data = {
        version: SAVE_VERSION,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        controls: { ...base.controls, ...(parsed.controls || {}) },
        progress: { ...base.progress, ...(parsed.progress || {}) },
        stats: { ...base.stats, ...(parsed.stats || {}) },
      };
      // Normaliza controles corruptos.
      for (const action of ACTIONS) {
        const binds = this.data.controls[action];
        if (!Array.isArray(binds) || binds.length !== 2) this.data.controls[action] = [...DEFAULT_CONTROLS[action]];
      }
      if (!Array.isArray(this.data.stats.driftBoosts)) this.data.stats.driftBoosts = [0, 0, 0];
    } catch (e) {
      console.warn('[SaveManager] datos guardados corruptos, se reinician', e);
      this.data = defaultData();
    }
  }

  save(immediate = false) {
    const write = () => {
      this._saveTimer = null;
      try {
        this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.warn('[SaveManager] no se pudo guardar', e);
      }
    };
    if (immediate) {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      write();
      return;
    }
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(write, 400);
  }

  get settings() {
    return this.data.settings;
  }
  get controls() {
    return this.data.controls;
  }
  get progress() {
    return this.data.progress;
  }
  get stats() {
    return this.data.stats;
  }

  updateSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
  }

  setControl(action, slot, code) {
    if (!this.data.controls[action]) return;
    // Un código solo puede estar asignado a una acción: se elimina de las demás.
    if (code) {
      for (const a of ACTIONS) {
        const binds = this.data.controls[a];
        for (let i = 0; i < binds.length; i++) if (binds[i] === code) binds[i] = null;
      }
    }
    this.data.controls[action][slot] = code;
    this.save();
  }

  resetControls() {
    this.data.controls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
    this.save();
  }

  addStat(key, amount = 1) {
    if (typeof this.data.stats[key] !== 'number') this.data.stats[key] = 0;
    this.data.stats[key] += amount;
    this.save();
  }

  recordDriftBoost(level) {
    const arr = this.data.stats.driftBoosts;
    if (level >= 1 && level <= 3) arr[level - 1]++;
    this.save();
  }

  /** Registra el resultado del jugador tras una carrera. */
  recordRace({ mode, trackId, position, characterId, distance = 0, time = 0 }) {
    const st = this.data.stats;
    st.racesPlayed++;
    if (mode === 'timetrial') st.timeTrials++;
    if (mode !== 'timetrial') {
      if (position === 1) st.racesWon++;
      if (position <= 3) st.podiums++;
    }
    st.distance += distance;
    st.playTime += time / 1000;
    st.trackPlays[trackId] = (st.trackPlays[trackId] || 0) + 1;
    if (characterId) st.characterPlays[characterId] = (st.characterPlays[characterId] || 0) + 1;
    this.save();
  }

  /** Guarda récords de contrarreloj. Devuelve qué récords se batieron. */
  recordBestTime(trackId, totalMs, bestLapMs, meta = {}) {
    const bt = this.data.stats.bestTimes;
    const cur = bt[trackId] || { total: Infinity, lap: Infinity };
    const res = { total: false, lap: false };
    if (totalMs > 0 && totalMs < (cur.total ?? Infinity)) {
      cur.total = totalMs;
      cur.totalMeta = meta;
      res.total = true;
    }
    if (bestLapMs > 0 && bestLapMs < (cur.lap ?? Infinity)) {
      cur.lap = bestLapMs;
      res.lap = true;
    }
    bt[trackId] = cur;
    this.save();
    return res;
  }

  getBestTime(trackId) {
    const bt = this.data.stats.bestTimes[trackId];
    if (!bt) return null;
    return {
      total: Number.isFinite(bt.total) ? bt.total : null,
      lap: Number.isFinite(bt.lap) ? bt.lap : null,
      meta: bt.totalMeta || null,
    };
  }

  /** Trofeo de copa: 'gold' | 'silver' | 'bronze' | null. Solo se guarda si mejora. */
  recordCup(cupId, difficulty, trophy) {
    const cups = this.data.progress.cups;
    if (!cups[cupId]) cups[cupId] = {};
    const prev = cups[cupId][difficulty];
    if (trophy && (!prev || TROPHY_RANK[trophy] > TROPHY_RANK[prev])) cups[cupId][difficulty] = trophy;
    this.data.stats.gpPlayed++;
    if (trophy === 'gold') this.data.stats.gpWon++;
    this.save();
  }

  getCupTrophy(cupId, difficulty) {
    return this.data.progress.cups[cupId]?.[difficulty] || null;
  }

  // --- Fantasmas de contrarreloj (claves separadas para no reescribir todo) ---
  saveGhost(trackId, ghost) {
    try {
      this.storage.setItem(GHOST_KEY_PREFIX + trackId, JSON.stringify(ghost));
      return true;
    } catch (e) {
      console.warn('[SaveManager] no se pudo guardar el fantasma', e);
      return false;
    }
  }

  loadGhost(trackId) {
    try {
      const raw = this.storage.getItem(GHOST_KEY_PREFIX + trackId);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  deleteGhosts(trackIds) {
    for (const id of trackIds) {
      try {
        this.storage.removeItem(GHOST_KEY_PREFIX + id);
      } catch (e) {
        /* ignorar */
      }
    }
  }

  resetProgress(trackIds = []) {
    const settings = this.data.settings;
    const controls = this.data.controls;
    this.data = defaultData();
    this.data.settings = settings;
    this.data.controls = controls;
    this.deleteGhosts(trackIds);
    this.save(true);
  }
}
