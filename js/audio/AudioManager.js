// Gestor de audio (Web Audio API): buses de música/efectos/motores con volúmenes guardados,
// desbloqueo tras la primera interacción, música procedural, efectos y audio de carrera.
import { SoundEffects } from './SoundEffects.js';
import { MusicPlayer } from './MusicPlayer.js';
import { EngineSound } from './EngineSound.js';

export class AudioManager {
  constructor(settings, musicData = {}) {
    this.settings = settings;
    this.songs = musicData.songs || {};
    this.jingles = musicData.jingles || {};
    this.ctx = null;
    this.pendingMusic = null;
    this.vol = { master: settings.masterVolume, music: settings.musicVolume, sfx: settings.sfxVolume };
    this.paused = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.engineBus = ctx.createGain();
      this.engineBus.connect(this.sfxBus);
      const len = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.sfx = new SoundEffects(this);
      this.music = new MusicPlayer(this);
      this.setVolumes(this.vol.master, this.vol.music, this.vol.sfx);
      if (this.pendingMusic) {
        const id = this.pendingMusic;
        this.pendingMusic = null;
        this.music.play(id);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx;
  }

  setVolumes(master, music, sfx) {
    this.vol = { master, music, sfx };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(music * (this.paused ? 0.35 : 1) * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
  }

  playMusic(id) {
    this.currentSong = id;
    if (!this.ctx) {
      this.pendingMusic = id;
      return;
    }
    this.music.play(id);
  }

  stopMusic(fade = 0.5) {
    this.pendingMusic = null;
    if (this.music) this.music.stop(fade);
  }

  setMusicTempo(mul) {
    if (this.music) this.music.setTempo(mul);
  }

  jingle(name) {
    if (!this.ctx || !this.jingles[name]) return 0;
    return this.music.jingle(this.jingles[name]);
  }

  play(name, ...args) {
    if (!this.ctx || !this.sfx || typeof this.sfx[name] !== 'function') return;
    this.sfx[name](...args);
  }

  ui(name) {
    if (this.ctx) this.sfx.ui(name);
  }

  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineBus.gain.setTargetAtTime(p ? 0 : 1, t, 0.05);
    this.setVolumes(this.vol.master, this.vol.music, this.vol.sfx);
  }

  attachRace(race, view) {
    return new RaceAudio(this, race, view);
  }
}

/** Audio específico de una carrera: motores, bucles de derrape/tierra y efectos por eventos. */
class RaceAudio {
  constructor(audio, race, view) {
    this.audio = audio;
    this.race = race;
    this.view = view;
    this.player = race.player && race.player.isPlayer ? race.player : null;
    this.engines = [];
    this.initialized = false;
    this.offs = [];
    this.tick = 0;
    this.wrongT = 0;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.starOn = false;
    this.bind();
  }

  init() {
    const a = this.audio;
    const ctx = a.ctx;
    for (const k of this.race.karts) {
      const near = k === this.player;
      this.engines.push(new EngineSound(a, k, near));
    }
    // Bucle de derrape (ruido filtrado)
    this.drift = this.loop(ctx, 'bandpass', 1400, 4);
    this.offroad = this.loop(ctx, 'lowpass', 260, 1);
    this.initialized = true;
  }

  loop(ctx, type, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = this.audio.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.audio.engineBus);
    src.start();
    return { src, f, g };
  }

  bind() {
    const ev = this.race.events;
    const a = this.audio;
    const P = (k) => k === this.player;
    const pos = (k) => (P(k) ? null : { x: k.pos.x, y: k.pos.y, z: k.pos.z });
    const on = (t, fn) => this.offs.push(ev.on(t, fn));
    on('race:countdown', ({ value }) => a.play('countdown', value));
    on('race:lap', ({ kart, lap }) => P(kart) && lap >= 2 && lap < this.race.laps && a.play('lap'));
    on('race:final-lap', ({ kart }) => {
      if (!P(kart)) return;
      a.jingle('finalLap');
      a.setMusicTempo(1.12);
    });
    on('race:finish', ({ kart, position }) => {
      if (!P(kart)) return;
      a.stopMusic(0.2);
      setTimeout(() => {
        a.jingle(position <= 3 ? 'finishGood' : 'finishBad');
        setTimeout(() => a.playMusic('results'), 3200);
      }, 250);
    });
    on('kart:hop', ({ kart }) => P(kart) && a.play('hop', null));
    on('kart:land', ({ kart, airTime, impact }) => airTime > 0.25 && a.play('land', pos(kart), Math.min(1.2, 0.4 + impact * 0.04)));
    on('kart:wall', ({ kart, impact }) => a.play('wall', pos(kart), impact));
    on('kart:bump', ({ a: k1, b: k2 }) => a.play('bump', P(k1) || P(k2) ? null : pos(k1)));
    on('kart:miniturbo', ({ kart, level }) => (P(kart) ? a.play('miniTurbo', level) : a.play('boost', pos(kart))));
    on('kart:drift-level', ({ kart, level }) => P(kart) && a.play('driftLevel', level));
    on('kart:boostpad', ({ kart }) => a.play('boostPad', pos(kart)));
    on('kart:item-boost', ({ kart }) => a.play('boost', pos(kart)));
    on('kart:trick-boost', ({ kart }) => P(kart) && a.play('boost', null));
    on('kart:start-boost', () => a.play('startBoost'));
    on('kart:burnout', () => a.play('burnout'));
    on('kart:trick', ({ kart }) => P(kart) && a.play('trick'));
    on('kart:hit', ({ kart, type }) => {
      if (type === 'freeze') return;
      if (type === 'spin') a.play('spin', pos(kart));
      else a.play('hit', pos(kart));
    });
    on('kart:shield-pop', ({ kart }) => a.play('shieldPop', pos(kart)));
    on('kart:fall', ({ kart, reason }) => reason !== 'manual' && a.play('fall', reason, pos(kart)));
    on('kart:carry', ({ kart }) => P(kart) && a.play('respawn'));
    on('item:box-break', ({ kart }) => a.play('itemBox', pos(kart)));
    on('item:get', ({ kart }) => P(kart) && a.play('itemGet'));
    on('item:use', ({ kart, throw: thrown }) => thrown && a.play('throw', pos(kart)));
    on('item:drop', ({ kart }) => a.play('drop', kart ? pos(kart) : null));
    on('item:explosion', ({ x, y, z }) => a.play('explosion', { x, y, z }));
    on('item:shield-up', ({ kart }) => P(kart) && a.play('shieldUp'));
    on('item:frost', () => a.play('freeze'));
    on('item:comet', ({ kart }) => P(kart) && a.play('comet'));
    on('item:lock-on', ({ target }) => P(target) && a.play('lockOn'));
    on('item:star', ({ kart }) => {
      if (!P(kart)) return;
      this.starOn = true;
      a.playMusic('star');
    });
    on('kart:star-end', ({ kart }) => {
      if (!P(kart) || !this.starOn) return;
      this.starOn = false;
      a.playMusic(this.race.trackDef.music || 'menu');
      if (this.player.progress.lap >= this.race.laps) a.setMusicTempo(1.12);
    });
  }

  update(dt) {
    const a = this.audio;
    if (!a.ctx) return;
    if (!this.initialized) this.init();
    const cam = this.view.camera;
    const dir = cam.getWorldDirection(this._dir || (this._dir = cam.position.clone()));
    this.listener.x = cam.position.x;
    this.listener.y = cam.position.y;
    this.listener.z = cam.position.z;
    this.listener.yaw = Math.atan2(dir.x, dir.z);
    a.sfx.setListener(this.listener.x, this.listener.y, this.listener.z, this.listener.yaw);
    for (const e of this.engines) e.update(dt, this.listener);
    const p = this.player;
    const now = a.ctx.currentTime;
    if (p) {
      const drifting = p.drift.active && p.grounded && !p.respawn.active;
      this.drift.g.gain.setTargetAtTime(drifting ? 0.06 + p.drift.level * 0.02 : 0, now, 0.04);
      this.drift.f.frequency.setTargetAtTime(1100 + p.drift.level * 450, now, 0.05);
      const sd = p.surface;
      const off = p.grounded && Math.abs(p.forwardSpeed) > 3 && [2, 3, 4, 5, 6, 12, 16].includes(sd);
      this.offroad.g.gain.setTargetAtTime(off ? Math.min(0.14, Math.abs(p.forwardSpeed) * 0.006) : 0, now, 0.06);
      if (p.roulette) {
        this.tick -= dt;
        if (this.tick <= 0) {
          this.tick = 0.07 + p.roulette.time * 0.05;
          a.play('rouletteTick');
        }
      }
      if (p.progress.wrongWay > 1.2 && !p.progress.finished) {
        this.wrongT -= dt;
        if (this.wrongT <= 0) {
          this.wrongT = 1.6;
          a.play('wrongWay');
        }
      } else this.wrongT = 0;
    }
  }

  dispose() {
    for (const off of this.offs) off();
    for (const e of this.engines) e.stop();
    for (const l of [this.drift, this.offroad]) {
      if (!l) continue;
      try {
        l.src.stop();
      } catch (e) {
        /* ignorar */
      }
      l.g.disconnect();
    }
    this.audio.setMusicTempo(1);
  }
}
