// Orquestador principal: inicializa los sistemas, gestiona el flujo menús ↔ carrera, las
// sesiones (carrera individual, Gran Premio y contrarreloj), pausa, resultados, estadísticas
// y guardado. Coordina render, audio, entrada, UI y HUD.
import { GameLoop } from './GameLoop.js';
import { SaveManager } from './SaveManager.js';
import { InputManager } from '../input/InputManager.js';
import { Renderer } from '../render/Renderer.js';
import { TextureFactory } from '../render/TextureFactory.js';
import { SpeedLines } from '../render/SpeedLines.js';
import { RaceView } from '../render/RaceView.js';
import { generatePortraits } from '../render/Portraits.js';
import { AudioManager } from '../audio/AudioManager.js';
import { UIManager } from '../ui/UIManager.js';
import { HUD } from '../ui/HUD.js';
import { Showcase } from '../ui/Showcase.js';
import { RaceManager } from '../race/RaceManager.js';
import { loadTrackDef } from '../tracks/index.js';
import { GP_POINTS, DEFAULT_SETTINGS } from '../config.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class Game {
  constructor({ data, canvas, fxCanvas, uiRoot, hudRoot }) {
    this.data = data;
    this.canvas = canvas;
    this.fxCanvas = fxCanvas;
    this.uiRoot = uiRoot;
    this.hudRoot = hudRoot;
    this.state = 'boot';
    this.race = null;
    this.view = null;
    this.paused = false;
    this.session = null;
    this.fpsEl = document.getElementById('fps');
    this.flashEl = document.getElementById('flash');
    this.fadeEl = document.getElementById('fade');
  }

  async init(progress = () => {}) {
    this.save = new SaveManager();
    this.settings = this.save.settings;
    this.input = new InputManager(this.save.controls);
    progress(0.25, 'Iniciando gráficos…');
    this.renderer = new Renderer(this.canvas, this.settings);
    TextureFactory.init(this.renderer.renderer);
    this.speedLines = new SpeedLines(this.fxCanvas);
    progress(0.35, 'Iniciando audio…');
    this.audio = new AudioManager(this.settings, this.data.music);
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.input.onAnyKey(unlock);
    progress(0.45, 'Creando pilotos…');
    await nextFrame();
    this.portraits = generatePortraits(this.renderer, this.data.characters);
    progress(0.75, 'Preparando menús…');
    this.showcase = new Showcase(this);
    this.ui = new UIManager(this, this.uiRoot);
    this.hud = new HUD(this, this.hudRoot);
    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      update: (dt, alpha, raw) => this.update(dt, alpha, raw),
      render: (dt) => this.render(dt),
    });
    this.input.onMenu((action) => this.onMenuAction(action));
    this.applySettings();
    this.state = 'menu';
    this.loop.start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'race' && !this.paused && this.race && this.race.phase !== 'finished') this.pause();
    });
  }

  // ------------------------------------------------------------------------------ Ajustes
  applySettings() {
    const s = this.settings;
    this.renderer.applySettings(s);
    this.audio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
    this.input.setControls(this.save.controls);
    this.fpsEl.classList.toggle('hidden', !s.showFps);
    document.documentElement.style.setProperty('--hud-scale', String(s.hudScale || 1));
    if (this.view) {
      this.view.settings = s;
      this.view.sun.castShadow = !!s.shadows;
    }
  }

  updateSettings(patch) {
    this.save.updateSettings(patch);
    this.applySettings();
  }

  resetSettings() {
    const keep = { lastCharacter: this.settings.lastCharacter, lastKart: this.settings.lastKart, lastTrack: this.settings.lastTrack };
    this.save.updateSettings({ ...DEFAULT_SETTINGS, ...keep });
    this.applySettings();
  }

  // ------------------------------------------------------------------------------ Menús
  showTitle() {
    this.state = 'menu';
    this.showcase.activate('title');
    this.ui.show('title');
    this.audio.playMusic('menu');
  }

  showMainMenu() {
    this.state = 'menu';
    this.showcase.activate('menu');
    this.ui.show('main');
    this.audio.playMusic('menu');
  }

  onMenuAction(action) {
    if (this.state === 'race' && this.race) {
      if ((action === 'back' || action === 'start') && !this.ui.active) {
        if (this.race.phase === 'intro') this.race.skipIntro();
        else if (this.race.phase !== 'finished') this.pause();
        return;
      }
      if (action === 'confirm' && this.race.phase === 'intro' && !this.ui.active) {
        this.race.skipIntro();
        return;
      }
    }
    this.ui.handleMenu(action);
  }

  /** Inicia una nueva sesión de juego desde el menú. */
  newSession(mode) {
    const s = this.settings;
    this.session = {
      mode,
      character: s.lastCharacter,
      kart: s.lastKart,
      trackId: s.lastTrack,
      cupId: s.lastCup,
      difficulty: mode === 'timetrial' ? this.data.difficulty.timeTrialDifficulty : s.lastDifficulty,
      laps: mode === 'timetrial' ? 3 : s.lastLaps,
      rivals: s.lastRivals,
      items: s.lastItems || 'normal',
    };
    return this.session;
  }

  rememberSession() {
    const ss = this.session;
    if (!ss) return;
    this.save.updateSettings({
      lastCharacter: ss.character,
      lastKart: ss.kart,
      lastTrack: ss.trackId,
      lastCup: ss.cupId,
      lastDifficulty: ss.mode === 'timetrial' ? this.settings.lastDifficulty : ss.difficulty,
      lastLaps: ss.mode === 'timetrial' ? this.settings.lastLaps : ss.laps,
      lastRivals: ss.rivals,
      lastItems: ss.items,
    });
  }

  startSession() {
    const ss = this.session;
    this.rememberSession();
    if (ss.mode === 'grandprix') {
      const cup = this.data.cup(ss.cupId);
      ss.gp = { cupId: cup.id, tracks: cup.tracks, index: 0, standings: null, rivalsList: null };
      this.startGPRace();
    } else {
      this.startRace(this.raceConfigFromSession());
    }
  }

  raceConfigFromSession() {
    const ss = this.session;
    return {
      mode: ss.mode,
      trackId: ss.trackId,
      laps: ss.laps,
      difficulty: ss.difficulty,
      rivals: ss.rivals,
      character: ss.character,
      kart: ss.kart,
      items: ss.items,
      seed: Math.floor(Math.random() * 1e9),
    };
  }

  startGPRace() {
    const ss = this.session;
    const gp = ss.gp;
    const cfg = {
      mode: 'grandprix',
      trackId: gp.tracks[gp.index],
      laps: ss.laps,
      difficulty: ss.difficulty,
      rivals: 7,
      character: ss.character,
      kart: ss.kart,
      items: ss.items,
      seed: Math.floor(Math.random() * 1e9),
    };
    if (gp.rivalsList) cfg.rivalsList = gp.rivalsList;
    if (gp.standings) {
      // parrilla: el líder de la clasificación sale el último
      cfg.gridOrder = [...gp.standings].sort((a, b) => a.points - b.points).map((r) => r.characterId);
    }
    this.startRace(cfg);
  }

  quickRace(trackId, opts = {}) {
    this.session = this.newSession(opts.mode || 'single');
    Object.assign(this.session, {
      trackId: this.data.track(trackId).id,
      difficulty: opts.difficulty || 'normal',
      character: opts.character || this.settings.lastCharacter,
      kart: opts.kart || this.settings.lastKart,
      laps: opts.laps || 3,
    });
    const cfg = this.raceConfigFromSession();
    cfg.skipIntro = !!opts.skipIntro;
    cfg.autopilot = !!opts.autopilot;
    this.startRace(cfg);
  }

  // ------------------------------------------------------------------------------ Carrera
  async startRace(config) {
    const meta = this.data.track(config.trackId);
    this.state = 'loading';
    this.audio.stopMusic(0.4);
    this.ui.show('loading', { meta, config });
    await nextFrame();
    await nextFrame();
    this.disposeRace();
    try {
      const def = await loadTrackDef(meta);
      const race = new RaceManager({ data: this.data, config, trackDef: def, input: config.autopilot ? null : this.input });
      this.race = race;
      this.config = config;
      const view = new RaceView(this, race);
      this.view = view;
      if (config.mode === 'timetrial' && this.settings.ghost) {
        const ghost = this.save.loadGhost(meta.id);
        if (ghost && ghost.frames && ghost.frames.length) view.setGhost(ghost, this.data);
      }
      this.raceAudio = this.audio.attachRace(race, view);
      this.hud.attach(race, view);
      this.bindRaceEvents(race);
      this.showcase.deactivate();
      this.renderer.setScene(view.scene, view.camera);
      this.input.clearPressed();
      this.paused = false;
      this.state = 'race';
      this.ui.hideAll();
      this.hud.show();
      race.start({ skipIntro: !!config.skipIntro });
      this.audio.playMusic(def.music || meta.music);
      this.fade(0);
    } catch (err) {
      console.error(err);
      this.ui.toast(`Error al cargar el circuito: ${err.message}`);
      this.showMainMenu();
    }
  }

  bindRaceEvents(race) {
    const ev = race.events;
    const isPlayer = (k) => k && k === race.player && k.isPlayer;
    ev.on('kart:miniturbo', ({ kart, level }) => isPlayer(kart) && this.save.recordDriftBoost(level));
    ev.on('kart:trick', ({ kart }) => isPlayer(kart) && this.save.addStat('tricks'));
    ev.on('item:used', ({ kart }) => isPlayer(kart) && this.save.addStat('itemsUsed'));
    ev.on('item:hit', ({ attacker }) => isPlayer(attacker) && this.save.addStat('hitsLanded'));
    ev.on('kart:hit', ({ kart }) => isPlayer(kart) && this.save.addStat('timesHit'));
    ev.on('kart:fall', ({ kart, reason }) => isPlayer(kart) && reason !== 'manual' && this.save.addStat('falls'));
    ev.on('race:results', ({ results }) => this.onRaceResults(results));
  }

  onRaceResults(results) {
    const race = this.race;
    const cfg = this.config;
    const player = results.find((r) => r.isPlayer);
    const summary = { mode: cfg.mode, results, trackId: cfg.trackId, player, newRecord: null, gp: null };
    if (player) {
      this.save.recordRace({
        mode: cfg.mode,
        trackId: cfg.trackId,
        position: player.position,
        characterId: player.characterId,
        distance: race.player.distanceTravelled,
        time: race.time * 1000,
      });
    }
    if (cfg.mode === 'timetrial' && player && !player.estimated) {
      const total = player.time * 1000;
      const lap = player.bestLap * 1000;
      const prev = this.save.getBestTime(cfg.trackId);
      const rec = this.save.recordBestTime(cfg.trackId, total, lap, { character: player.characterId, kart: player.kartId });
      summary.newRecord = rec;
      summary.previousBest = prev;
      if (rec.total && race.ghostRecorder) this.save.saveGhost(cfg.trackId, race.ghostRecorder.toData(player.time, player.lapTimes));
    }
    if (cfg.mode === 'grandprix') {
      const gp = this.session.gp;
      if (!gp.rivalsList) gp.rivalsList = race.rivalsList;
      if (!gp.standings) {
        gp.standings = results.map((r) => ({ characterId: r.characterId, kartId: r.kartId, name: r.name, isPlayer: r.isPlayer, points: 0, last: 0 }));
      }
      for (const r of results) {
        const row = gp.standings.find((s) => s.characterId === r.characterId);
        if (row) {
          row.last = GP_POINTS[r.position - 1] ?? 0;
          row.points += row.last;
        }
      }
      summary.gp = gp;
    }
    this.lastSummary = summary;
    setTimeout(() => {
      if (this.race !== race) return;
      this.hud.hide();
      this.ui.show('results', summary);
    }, 600);
  }

  /** Tras los resultados: siguiente carrera del GP o final. */
  continueGP() {
    const gp = this.session.gp;
    gp.index++;
    if (gp.index >= gp.tracks.length) {
      const sorted = [...gp.standings].sort((a, b) => b.points - a.points);
      const pos = sorted.findIndex((r) => r.isPlayer) + 1;
      const trophy = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : null;
      this.save.recordCup(gp.cupId, this.session.difficulty, trophy);
      this.ui.show('gpFinal', { gp, sorted, position: pos, trophy });
      this.audio.jingle(trophy ? 'victory' : 'defeat');
      return;
    }
    this.startGPRace();
  }

  pause() {
    if (this.state !== 'race' || this.paused) return;
    this.paused = true;
    this.audio.setPaused(true);
    this.ui.show('pause');
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.audio.setPaused(false);
    this.input.clearPressed();
    this.ui.hideAll();
  }

  restartRace() {
    if (!this.config) return;
    this.paused = false;
    this.audio.setPaused(false);
    const cfg = { ...this.config, seed: Math.floor(Math.random() * 1e9), skipIntro: true };
    this.startRace(cfg);
  }

  quitToMenu() {
    this.paused = false;
    this.audio.setPaused(false);
    this.disposeRace();
    this.hud.hide();
    this.speedLines.clear();
    this.showMainMenu();
  }

  disposeRace() {
    if (this.raceAudio) {
      this.raceAudio.dispose();
      this.raceAudio = null;
    }
    this.hud.detach();
    if (this.view) {
      this.view.dispose();
      this.view = null;
    }
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
  }

  /** Solo para depuración/pruebas automáticas: acelera la simulación. */
  setTimeScale(s) {
    this.loop.timeScale = Math.max(0.1, Math.min(20, s || 1));
    this.loop.maxDt = 0.1 * this.loop.timeScale;
  }

  fade(target, time = 0.4) {
    this.fadeEl.style.transition = `opacity ${time}s`;
    this.fadeEl.style.opacity = String(target);
  }

  // ------------------------------------------------------------------------------ Bucle
  fixedUpdate(dt) {
    if (this.state === 'race' && this.race && !this.paused) this.race.fixedUpdate(dt);
  }

  update(dt, alpha, raw) {
    this.input.poll(raw);
    if (this.state === 'race' && this.view) {
      const a = this.paused ? 1 : alpha;
      if (!this.paused) this.view.update(dt, a);
      this.hud.update(dt);
      if (this.raceAudio) this.raceAudio.update(dt);
      const fx = this.paused ? { speedLines: 0, flash: 0 } : this.view.effects;
      this.speedLines.update(dt, fx.speedLines);
      this.flashEl.style.opacity = String(Math.min(0.8, fx.flash));
    } else if (this.state === 'menu' || this.state === 'loading') {
      this.showcase.update(dt);
      this.speedLines.update(dt, 0);
    }
    this.ui.update(dt);
    if (this.settings.showFps) {
      this._fpsT = (this._fpsT || 0) + raw;
      if (this._fpsT > 0.25) {
        this._fpsT = 0;
        const info = this.renderer.renderer.info.render;
        this.fpsEl.textContent = `${Math.round(this.loop.fps)} FPS · ${info.calls} draws · ${Math.round(info.triangles / 1000)}k tris`;
      }
    }
  }

  render() {
    if (this.state === 'race' && this.view) this.renderer.render();
    else if (this.showcase.active) this.showcase.render();
  }
}
