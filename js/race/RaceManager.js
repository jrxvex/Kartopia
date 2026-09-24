// Gestor de carrera: crea circuito, karts y controladores; gestiona la presentación, la cuenta
// atrás (con salida turbo), el progreso/vueltas/checkpoints, las posiciones, el efecto goma de
// la IA, la meta y los resultados. Funciona sin render (headless) para simulaciones.
import { PHYSICS, GP_POINTS } from '../config.js';
import { EventBus } from '../core/EventBus.js';
import { Random } from '../core/Random.js';
import { clamp, wrapDelta } from '../core/MathUtils.js';
import { buildTrack } from '../track/TrackBuilder.js';
import { stepKart, resolveKartCollisions, applyHit } from '../physics/KartPhysics.js';
import { Kart } from './Kart.js';
import { PlayerController } from './PlayerController.js';
import { AIController } from './AIController.js';
import { ItemSystem } from '../items/ItemSystem.js';
import { GhostRecorder } from './Ghost.js';

const COUNTDOWN_TIME = 4;
const INTRO_TIME = 4.2;

export class RaceManager {
  /**
   * @param {object} o
   * @param {import('../core/DataStore.js').DataStore} o.data
   * @param {object} o.config  { mode, trackId, laps, difficulty, rivals, character, kart, items, gp, seed }
   * @param {object} o.trackDef definición del circuito (módulo js/tracks/*.js)
   * @param {object} [o.input]  InputManager (si hay jugador humano)
   * @param {EventBus} [o.events]
   */
  constructor({ data, config, trackDef, input = null, events = null, track = null }) {
    this.data = data;
    this.config = config;
    this.events = events || new EventBus();
    this.input = input;
    this.mode = config.mode || 'single';
    this.laps = config.laps ?? 3;
    this.rng = new Random(config.seed ?? Math.floor(Math.random() * 1e9));
    this.track = track || buildTrack(trackDef);
    this.trackDef = trackDef;
    this.phase = 'init';
    this.phaseTime = 0;
    this.clock = 0;
    this.time = 0;
    this.countdownValue = 4;
    this.finishCount = 0;
    this.playerFinished = false;
    this.resultsReady = false;
    this.resultsTimer = 0;
    this.results = null;
    this.rubberTimer = 0;
    this.karts = [];
    this.player = null;
    this.difficulty = data.difficultyPreset(this.mode === 'timetrial' ? data.difficulty.timeTrialDifficulty : config.difficulty || 'normal');
    this.ctx = { world: this.track.collision, track: this.track, events: this.events, time: 0, karts: this.karts };
    this.startPress = { down: false, since: 0 };
    this.createKarts();
    this.items = new ItemSystem(this, data, { enabled: this.mode !== 'timetrial' && config.items !== 'none' });
    this.ghostRecorder = this.mode === 'timetrial' && this.player ? new GhostRecorder(this.player, this.track.id) : null;
    if (this.mode === 'timetrial' && this.player) this.items.giveItem(this.player, 'triple-turbo', true);
    this.proj = {};
    this.updatePositions();
  }

  // --------------------------------------------------------------------------------- Setup
  createKarts() {
    const cfg = this.config;
    const data = this.data;
    const engine = this.difficulty.engine;
    const aiSkill = this.difficulty.ai;
    const participants = [];
    const humanChar = cfg.character ? data.character(cfg.character) : null;
    const humanKart = cfg.kart ? data.kart(cfg.kart) : null;

    let rivals = [];
    if (this.mode !== 'timetrial') {
      if (cfg.rivalsList) {
        rivals = cfg.rivalsList.map((r) => ({ character: data.character(r.character), kartDef: data.kart(r.kart) }));
      } else {
        const pool = data.characters.filter((c) => !humanChar || c.id !== humanChar.id);
        this.rng.shuffle(pool);
        const count = Math.min(cfg.rivals ?? 7, pool.length);
        rivals = pool.slice(0, count).map((c) => ({ character: c, kartDef: this.rng.pick(data.karts) }));
      }
    }
    this.rivalsList = rivals.map((r) => ({ character: r.character.id, kart: r.kartDef.id }));

    if (humanChar) participants.push({ character: humanChar, kartDef: humanKart || data.karts[0], isPlayer: true });
    for (const r of rivals) participants.push({ character: r.character, kartDef: r.kartDef, isPlayer: false });

    // Orden de parrilla
    const n = participants.length;
    let order;
    if (cfg.gridOrder) {
      // lista de ids de personaje del primero (pole) al último
      order = cfg.gridOrder.map((id) => participants.find((p) => p.character.id === id)).filter(Boolean);
      for (const p of participants) if (!order.includes(p)) order.push(p);
    } else if (this.mode === 'timetrial') {
      order = participants;
    } else {
      const ai = participants.filter((p) => !p.isPlayer);
      this.rng.shuffle(ai);
      order = [...ai];
      const human = participants.find((p) => p.isPlayer);
      if (human) {
        const slot = this.mode === 'grandprix' ? n - 1 : this.rng.int(Math.floor(n / 2), n - 1);
        order.splice(Math.min(slot, order.length), 0, human);
      }
    }

    order.forEach((p, idx) => {
      const kart = new Kart({
        index: idx,
        character: p.character,
        kartDef: p.kartDef,
        isPlayer: p.isPlayer,
        engineMul: engine,
      });
      const slot = this.track.spawnSlots[idx];
      kart.placeAt(slot.x, slot.y, slot.z, slot.yaw);
      kart.gridSlot = idx;
      kart.progress.s = slot.s;
      kart.progress.index = slot.index;
      kart.progress.lap = 0;
      kart.progress.nextCP = this.track.checkpoints.length;
      kart.lastSafeS = slot.s;
      if (p.isPlayer && this.input) {
        kart.controller = new PlayerController(kart, this.input);
        this.player = kart;
      } else {
        const skill = { ...aiSkill };
        const spread = aiSkill.spread ?? 0.03;
        kart.personalSpeed = 1 + this.rng.range(-spread, spread);
        kart.aiBaseMul = skill.speed * kart.personalSpeed;
        kart.aiSpeedMul = kart.aiBaseMul;
        kart.maxDriftLevel = skill.maxDriftLevel;
        kart.controller = new AIController(kart, this, skill, idx + 1 + (this.config.seed ?? 0));
        if (p.isPlayer) this.player = kart; // jugador sin entrada (simulación)
      }
      this.karts.push(kart);
    });
  }

  // --------------------------------------------------------------------------------- Flujo
  start({ skipIntro = false } = {}) {
    this.setPhase(skipIntro ? 'countdown' : 'intro');
  }

  setPhase(p) {
    this.phase = p;
    this.phaseTime = 0;
    this.events.emit('race:phase', { phase: p });
    if (p === 'countdown') this.countdownValue = 4;
  }

  skipIntro() {
    if (this.phase === 'intro') this.setPhase('countdown');
  }

  fixedUpdate(dt) {
    this.clock += dt;
    this.phaseTime += dt;
    this.ctx.time = this.clock;
    for (const h of this.track.hazards) h.update(this.clock, dt);

    if (this.phase === 'intro') {
      if (this.phaseTime >= INTRO_TIME) this.setPhase('countdown');
      this.idleControllers(dt);
      return;
    }
    if (this.phase === 'countdown') {
      this.updateCountdown(dt);
      return;
    }
    if (this.phase === 'init') return;

    if (!this.resultsReady || this.phase === 'finished') this.time += dt;
    const ctx = this.ctx;

    for (const k of this.karts) {
      if (k.controller) k.controller.update(dt);
    }
    this.items.handleInputs(dt);
    for (const k of this.karts) stepKart(k, dt, ctx);
    resolveKartCollisions(this.karts, ctx);
    this.items.update(dt);
    for (const k of this.karts) this.updateProgress(k, dt);
    this.updatePositions();

    this.rubberTimer -= dt;
    if (this.rubberTimer <= 0) {
      this.rubberTimer = 0.5;
      this.applyRubberBand();
    }
    if (this.ghostRecorder && this.phase === 'racing' && !this.player.progress.finished) this.ghostRecorder.record(this.time, dt);

    if (this.playerFinished && !this.resultsReady) {
      this.resultsTimer -= dt;
      const allDone = this.karts.every((k) => k.progress.finished);
      if (this.resultsTimer <= 0 || allDone) this.buildResults();
    }
    if (!this.player && !this.resultsReady && this.karts.every((k) => k.progress.finished)) this.buildResults();
  }

  idleControllers() {
    for (const k of this.karts) {
      k.input.throttle = 0;
      k.input.steer = 0;
    }
  }

  updateCountdown(dt) {
    const t = this.phaseTime;
    const v = 3 - Math.floor(t - 1);
    if (t >= 1 && v !== this.countdownValue && v >= 1 && v <= 3) {
      this.countdownValue = v;
      this.events.emit('race:countdown', { value: v });
    }
    // Entrada del jugador para la salida turbo
    if (this.player && this.player.controller && !this.player.controller.isAI) {
      this.player.controller.update(dt);
      const pressing = this.player.input.throttle > 0.5;
      if (pressing && !this.startPress.down) {
        this.startPress.down = true;
        this.startPress.since = t;
      } else if (!pressing) {
        this.startPress.down = false;
      }
      this.player.input.driftPressed = false;
      this.player.input.itemPressed = false;
      this.player.input.respawn = false;
    }
    for (const k of this.karts) k.revving = k.controller && !k.controller.isAI ? k.input.throttle > 0.5 : t > 2.2 && t < 3.9;
    if (t >= COUNTDOWN_TIME) {
      this.countdownValue = 0;
      this.events.emit('race:countdown', { value: 0 });
      this.setPhase('racing');
      this.time = 0;
      this.applyStartBoosts();
      this.events.emit('race:go', {});
    }
  }

  applyStartBoosts() {
    for (const k of this.karts) {
      k.progress.lapStart = 0;
      if (k === this.player && k.controller && !k.controller.isAI) {
        if (this.startPress.down) {
          const held = COUNTDOWN_TIME - this.startPress.since;
          if (held >= 0.85 && held <= 1.5) {
            k.applyBoost(PHYSICS.START_BOOST_TIME, 1.05, 'start');
            this.events.emit('kart:start-boost', { kart: k });
          } else if (held > 1.7) {
            k.stun.type = 'spin';
            k.stun.time = k.stun.duration = 0.9;
            this.events.emit('kart:burnout', { kart: k });
          }
        }
      } else {
        const chance = this.difficulty.ai.startBoostChance ?? 0.3;
        if (this.rng.next() < chance) k.applyBoost(PHYSICS.START_BOOST_TIME * this.rng.range(0.6, 1), 1, 'start');
      }
    }
  }

  // --------------------------------------------------------------------------------- Progreso
  updateProgress(k, dt) {
    const tr = this.track;
    const pr = k.progress;
    const L = tr.length;
    tr.project(k.pos.x, k.pos.y, k.pos.z, pr.index, this.proj);
    const q = this.proj;
    const prevS = pr.s;
    const newS = q.s;
    const ds = newS - prevS;
    const cps = tr.checkpoints;
    if (ds < -L / 2) {
      // cruce de meta hacia delante: solo cuenta si se pasó por todos los checkpoints
      if (pr.nextCP >= cps.length) {
        pr.lap++;
        pr.nextCP = 0;
        while (pr.nextCP < cps.length && newS >= cps[pr.nextCP]) pr.nextCP++;
        this.onLap(k);
      } else {
        pr.invalid = (pr.invalid || 0) + 1;
      }
    } else if (ds > L / 2) {
      // cruce hacia atrás
      if (pr.invalid > 0) {
        pr.invalid--;
      } else {
        pr.lap--;
        pr.nextCP = cps.length;
        while (pr.nextCP > 0 && newS < cps[pr.nextCP - 1]) pr.nextCP--;
      }
    } else if (ds > 0) {
      while (pr.nextCP < cps.length && prevS < cps[pr.nextCP] && newS >= cps[pr.nextCP]) pr.nextCP++;
    } else if (ds < 0) {
      while (pr.nextCP > 0 && newS < cps[pr.nextCP - 1] && prevS >= cps[pr.nextCP - 1]) pr.nextCP--;
    }
    pr.s = newS;
    pr.index = q.index;
    pr.lateral = q.lateral;
    pr.dist = q.dist;
    pr.dy = q.dy;
    pr.centerY = q.centerY;
    if (!pr.finished) pr.raceDistance = pr.lap * L + newS;

    // Punto seguro para reaparecer
    if (k.grounded && !k.respawn.active && !k.stun.type && q.dist < tr.width[q.index] * 0.5 + 4 && !tr.gapZoneAt(newS)) {
      k.lastSafeS = newS;
      k.lastSafeLateral = q.lateral;
    }

    // Sentido contrario
    if (!k.respawn.active) {
      const hx = tr.tx[q.index];
      const hz = tr.tz[q.index];
      const hl = Math.hypot(hx, hz) || 1;
      const sp = Math.hypot(k.vel.x, k.vel.z);
      const dot = sp > 1 ? (k.vel.x * hx + k.vel.z * hz) / (hl * sp) : Math.sin(k.yaw) * hx / hl + Math.cos(k.yaw) * hz / hl;
      if (dot < -0.35 && sp > 3) pr.wrongWay += dt;
      else pr.wrongWay = Math.max(0, pr.wrongWay - dt * 2);
    }
  }

  onLap(k) {
    const pr = k.progress;
    if (pr.finished) return;
    if (pr.lap <= 1) {
      this.events.emit('race:lap', { kart: k, lap: pr.lap, lapTime: 0 });
      return;
    }
    if (pr.lapTimes.length >= pr.lap - 1) return; // vuelta ya registrada (ida y vuelta por la meta)
    const lapTime = this.time - pr.lapStart;
    pr.lapTimes.push(lapTime);
    pr.bestLap = Math.min(pr.bestLap, lapTime);
    pr.lapStart = this.time;
    if (pr.lap > this.laps) {
      this.finishKart(k);
      return;
    }
    this.events.emit('race:lap', { kart: k, lap: pr.lap, lapTime });
    if (pr.lap === this.laps) this.events.emit('race:final-lap', { kart: k });
  }

  finishKart(k) {
    const pr = k.progress;
    if (pr.finished) return;
    pr.finished = true;
    pr.finishTime = this.time;
    pr.raceDistance = (this.laps + 1) * this.track.length + 1000 - this.finishCount;
    this.finishCount++;
    pr.finishOrder = this.finishCount;
    this.updatePositions();
    this.events.emit('race:finish', { kart: k, position: pr.position, time: pr.finishTime });
    if (k === this.player) {
      this.playerFinished = true;
      this.resultsTimer = 4.5;
      if (k.controller && !k.controller.isAI) {
        const skill = { ...this.data.difficultyPreset('hard').ai, mistakeRate: 0, itemSkill: 0.6 };
        k.controller = new AIController(k, this, skill, 999);
        k.aiSpeedMul = 0.97;
        k.maxDriftLevel = 2;
      }
    }
  }

  updatePositions() {
    const sorted = [...this.karts].sort((a, b) => {
      const pa = a.progress;
      const pb = b.progress;
      if (pa.finished && pb.finished) return pa.finishOrder - pb.finishOrder;
      if (pa.finished) return -1;
      if (pb.finished) return 1;
      return pb.raceDistance - pa.raceDistance;
    });
    sorted.forEach((k, i) => (k.progress.position = i + 1));
    this.standings = sorted;
  }

  applyRubberBand() {
    const ref = this.player && !this.player.isGhost ? this.player : null;
    const rb = this.difficulty.ai.rubberBand ?? 0.05;
    const leader = this.standings[0];
    for (const k of this.karts) {
      if (!k.controller || !k.controller.isAI || k === this.player) continue;
      let mul = k.aiBaseMul ?? 1;
      if (ref) {
        const diff = ref.progress.raceDistance - k.progress.raceDistance;
        mul *= 1 + clamp(diff / 260, -1, 1) * rb;
      } else if (leader && leader !== k) {
        const diff = leader.progress.raceDistance - k.progress.raceDistance;
        mul *= 1 + clamp(diff / 400, 0, 1) * rb * 0.5;
      }
      k.aiSpeedMul = mul;
    }
  }

  // --------------------------------------------------------------------------------- Resultados
  buildResults() {
    const L = this.track.length;
    const target = (this.laps + 1) * L;
    const rows = this.standings.map((k) => {
      const pr = k.progress;
      let time = pr.finishTime;
      let estimated = false;
      if (!pr.finished) {
        const travelled = Math.max(1, pr.raceDistance - (L - 20));
        const avg = travelled / Math.max(1, this.time);
        const remaining = Math.max(0, target - pr.raceDistance);
        time = this.time + remaining / Math.max(8, avg);
        estimated = true;
      }
      return {
        kart: k,
        characterId: k.character.id,
        kartId: k.kartDef.id,
        name: k.name,
        isPlayer: k.isPlayer,
        time,
        estimated,
        bestLap: pr.bestLap,
        lapTimes: [...pr.lapTimes],
      };
    });
    // Los no terminados se reordenan por tiempo estimado (manteniendo a los terminados delante)
    const done = rows.filter((r) => !r.estimated);
    const est = rows.filter((r) => r.estimated).sort((a, b) => a.time - b.time);
    const all = [...done, ...est];
    all.forEach((r, i) => {
      r.position = i + 1;
      r.points = this.mode === 'grandprix' ? GP_POINTS[i] ?? 0 : 0;
    });
    this.results = all;
    this.resultsReady = true;
    this.setPhase('finished');
    this.events.emit('race:results', { results: all });
  }

  getPlayerResult() {
    return this.results ? this.results.find((r) => r.kart === this.player) : null;
  }

  // --------------------------------------------------------------------------------- Ayudas
  kartAhead(k) {
    const pos = k.progress.position;
    return this.standings[pos - 2] || null;
  }

  kartBehind(k) {
    return this.standings[k.progress.position] || null;
  }

  /** Distancia a lo largo del circuito de a hasta b (positiva si b va delante). */
  gapBetween(a, b) {
    return b.progress.raceDistance - a.progress.raceDistance;
  }

  hit(kart, type, source) {
    return applyHit(kart, type, source, this.ctx);
  }

  dispose() {
    this.items.dispose();
    this.events.emit('race:dispose', {});
  }
}

export { wrapDelta };
