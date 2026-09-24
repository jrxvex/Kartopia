// IA de los rivales: sigue una línea de carrera optimizada con "pure pursuit", planifica la
// velocidad según la curvatura, derrapa en curvas largas para cargar mini-turbos, adelanta y
// esquiva karts/trampas, recoge cajas, usa objetos, comete errores ocasionales y se recupera
// si se queda atascada o va en sentido contrario.
import { PHYSICS } from '../config.js';
import { Random } from '../core/Random.js';
import { clamp, damp, wrapDelta, wrapIndex } from '../core/MathUtils.js';
import { maxYawRate } from '../physics/KartPhysics.js';
import { FLAG } from '../track/Track.js';

const P = PHYSICS;

export class AIController {
  constructor(kart, race, skill, seed = 1) {
    this.kart = kart;
    this.race = race;
    this.track = race.track;
    this.skill = skill;
    this.isAI = true;
    this.rng = new Random(seed * 7919 + 13);
    this.personality = {
      aggression: this.rng.range(0.4, 1.0),
      laneBias: this.rng.range(-1, 1) * 1.2 * skill.lineNoise,
      boxLove: this.rng.range(0.4, 1.0),
    };
    this.lane = this.personality.laneBias;
    this.laneTarget = this.lane;
    this.laneTimer = this.rng.range(1, 4);
    this.avoid = 0;
    this.avoidTarget = 0;
    this.avoidTimer = 0;
    this.mistake = null;
    this.stuckTimer = 0;
    this.reverseTimer = 0;
    this.reverseSteer = 0;
    this.stuckCount = 0;
    this.stuckWindow = 0;
    this.drift = { pending: 0, dir: 0, targetLevel: 1 };
    this.itemTimer = this.rng.range(0.4, 1.5);
    this.holdTimer = 0;
    this.wobblePhase = this.rng.range(0, 10);
    this.tmp = { x: 0, y: 0, z: 0 };
    this.lastSteer = 0;
  }

  update(dt) {
    const k = this.kart;
    const inp = k.input;
    const tr = this.track;
    const prog = k.progress;
    if (k.respawn.active || k.stun.type) {
      inp.throttle = 1;
      inp.steer = 0;
      inp.drift = false;
      this.drift.pending = 0;
      return;
    }
    const speed = k.forwardSpeed;
    const s = prog.s;
    const i = Math.max(0, prog.index);

    // ---- Carril propio (varía con el tiempo) y errores
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = this.rng.range(2, 6);
      this.laneTarget = this.personality.laneBias + this.rng.range(-1.5, 1.5) * this.skill.lineNoise;
    }
    this.lane = damp(this.lane, this.laneTarget, 0.8, dt);
    this.updateMistakes(dt);

    // ---- Esquivar (a 20 Hz)
    this.avoidTimer -= dt;
    if (this.avoidTimer <= 0) {
      this.avoidTimer = 0.05;
      this.avoidTarget = this.computeAvoidance(speed);
    }
    this.avoid = damp(this.avoid, this.avoidTarget, 4, dt);

    let extra = this.lane + this.avoid;
    if (this.mistake && this.mistake.type === 'wide') extra += this.mistake.offset;

    // ---- Punto objetivo (pure pursuit sobre la línea de carrera)
    const Ld = clamp(7 + Math.abs(speed) * 0.5, 9, 30);
    const sT = s + Ld;
    const iT = tr.indexAtS(sT);
    let hw = tr.width[iT] * 0.5 - 1.5;
    if (tr.flags[iT] & (FLAG.GAP | FLAG.RAMP)) hw = Math.min(hw, 1.5);
    const latT = clamp(tr.lineOffset[iT] + extra, -hw, hw);
    const target = tr.pointAt(sT, latT, this.tmp);
    const dx = target.x - k.pos.x;
    const dz = target.z - k.pos.z;
    const fx = Math.sin(k.yaw);
    const fz = Math.cos(k.yaw);
    const xr = dx * -fz + dz * fx; // proyección sobre el vector derecho (-cos, sin)
    const zf = dx * fx + dz * fz;
    const alpha = Math.atan2(xr, zf);
    const dist = Math.max(4, Math.hypot(dx, dz));
    const v = Math.max(3, Math.abs(speed));
    const desiredRight = (2 * v * Math.sin(alpha)) / dist; // rad/s girando a la derecha
    const wMax = Math.max(0.4, maxYawRate(k.params, v));
    let steer = clamp(desiredRight / wMax, -1, 1);
    if (zf < 0 && Math.abs(alpha) > 1.9) steer = Math.sign(alpha) || 1;

    // ---- Velocidad objetivo
    const cap = k.params.handling;
    let targetSpeed = Infinity;
    for (let n = 0; n <= 8; n++) {
      const j = wrapIndex(i + n, tr.N);
      targetSpeed = Math.min(targetSpeed, tr.lineSpeed[j] * cap * (k.drift.active ? 1.12 : 1));
    }
    let throttle = 1;
    if (speed > targetSpeed + 2.5) throttle = -0.7;
    else if (speed > targetSpeed + 0.5) throttle = 0.2;
    if (this.mistake && this.mistake.type === 'lift') throttle = 0;
    if (this.mistake && this.mistake.type === 'wobble') {
      steer = clamp(steer + Math.sin(this.race.time * 9 + this.wobblePhase) * 0.55, -1, 1);
    }

    // ---- Derrape
    let driftHeld = false;
    const d = this.drift;
    if (k.drift.active) {
      d.pending = 0;
      const dir = k.drift.dir;
      const need = -desiredRight * -dir; // >0 si la curva sigue hacia el lado del derrape
      const needLeftward = -desiredRight; // rad/s hacia la izquierda
      const wantW = dir < 0 ? needLeftward : -needLeftward; // magnitud en la dirección del derrape
      const h = k.params.handling * clamp(speed / 10, 0.4, 1);
      let sd;
      const base = P.DRIFT_BASE * h;
      if (wantW >= base) sd = (wantW - base) / ((P.DRIFT_TIGHT - P.DRIFT_BASE) * h);
      else sd = (wantW - base) / ((P.DRIFT_BASE - P.DRIFT_WIDE) * h);
      steer = clamp(sd, -1, 1) * dir;
      const aheadCurv = this.curveAhead(s, 6, 26);
      const curveEnding = Math.abs(aheadCurv) < 0.018 || Math.sign(aheadCurv) !== -dir;
      const tooWide = wantW < P.DRIFT_WIDE * h * 0.55 || need < -0.2;
      const reachedLevel = k.drift.level >= d.targetLevel;
      const nearNoDrift = this.noDriftAhead(s, 20);
      let hold = !(tooWide || nearNoDrift || (curveEnding && k.drift.level >= 1) || (reachedLevel && curveEnding));
      if (this.mistake && this.mistake.type === 'earlyRelease' && k.drift.level >= 1) hold = false;
      if (k.drift.time > 4.5) hold = false;
      driftHeld = hold;
    } else if (d.pending > 0) {
      d.pending -= dt;
      driftHeld = true;
      steer = d.dir * 0.85;
    } else if (k.grounded && speed > 15 && this.rng.next() < this.skill.driftSkill * dt * 6) {
      const c = this.curveAhead(s, 4, 40);
      const sustained = this.sustainedCurve(s, 4, 40, Math.sign(c));
      if (Math.abs(c) > 0.028 && sustained > 0.62 && !this.noDriftAhead(s, 45)) {
        d.dir = c > 0 ? -1 : 1; // curvatura positiva = curva a la izquierda
        d.pending = 0.45;
        const len = sustained * 40 + Math.abs(c) * 400;
        d.targetLevel = Math.min(this.skill.maxDriftLevel, len > 55 ? 3 : len > 34 ? 2 : 1);
        k.input.driftPressed = true;
        driftHeld = true;
        steer = d.dir;
      }
    }

    // ---- Atasco y recuperación
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      throttle = -1;
      steer = this.reverseSteer;
      driftHeld = false;
    } else {
      if (throttle > 0.5 && Math.abs(speed) < 2.2 && k.grounded && this.race.phase === 'racing') this.stuckTimer += dt;
      else this.stuckTimer = Math.max(0, this.stuckTimer - dt * 0.5);
      if (this.stuckTimer > 1.2) {
        this.stuckTimer = 0;
        this.reverseTimer = 1.1;
        this.reverseSteer = -(Math.sign(alpha) || 1);
        this.stuckCount++;
        this.stuckWindow = 12;
        if (this.stuckCount >= 3) {
          k.input.respawn = true;
          this.stuckCount = 0;
        }
      }
    }
    if (this.stuckWindow > 0) {
      this.stuckWindow -= dt;
      if (this.stuckWindow <= 0) this.stuckCount = 0;
    }

    this.lastSteer = damp(this.lastSteer, steer, 22, dt);
    inp.throttle = throttle;
    inp.steer = this.lastSteer;
    inp.drift = driftHeld;
    inp.lookBack = false;

    this.updateItems(dt);
  }

  curveAhead(s, from, len) {
    const tr = this.track;
    const i0 = tr.indexAtS(s + from);
    const n = Math.max(1, Math.round(len / tr.spacing));
    let sum = 0;
    for (let k = 0; k < n; k++) sum += tr.lineCurv[wrapIndex(i0 + k, tr.N)];
    return sum / n;
  }

  sustainedCurve(s, from, len, sign) {
    const tr = this.track;
    const i0 = tr.indexAtS(s + from);
    const n = Math.max(1, Math.round(len / tr.spacing));
    let c = 0;
    for (let k = 0; k < n; k++) {
      const v = tr.lineCurv[wrapIndex(i0 + k, tr.N)];
      if (Math.sign(v) === sign && Math.abs(v) > 0.018) c++;
    }
    return c / n;
  }

  noDriftAhead(s, len) {
    const tr = this.track;
    const i0 = tr.indexAtS(s);
    const n = Math.round(len / tr.spacing);
    for (let k = 0; k < n; k++) if (tr.flags[wrapIndex(i0 + k, tr.N)] & FLAG.NO_DRIFT) return true;
    return false;
  }

  updateMistakes(dt) {
    if (this.mistake) {
      this.mistake.time -= dt;
      if (this.mistake.time <= 0) this.mistake = null;
      return;
    }
    if (this.race.phase !== 'racing') return;
    if (this.rng.next() < this.skill.mistakeRate * dt) {
      const r = this.rng.next();
      if (r < 0.3) this.mistake = { type: 'wobble', time: this.rng.range(0.5, 1.1) };
      else if (r < 0.6) {
        const c = this.curveAhead(this.kart.progress.s, 10, 30);
        const outward = c > 0 ? 1 : -1; // curva a la izquierda → se abre hacia la derecha
        this.mistake = { type: 'wide', time: this.rng.range(1.0, 2.0), offset: outward * this.rng.range(2.5, 4.5) };
      } else if (r < 0.8) this.mistake = { type: 'lift', time: this.rng.range(0.3, 0.7) };
      else this.mistake = { type: 'earlyRelease', time: 2.5 };
    }
  }

  /** Desplazamiento lateral para adelantar/esquivar karts, trampas, obstáculos y buscar cajas. */
  computeAvoidance(speed) {
    const k = this.kart;
    const tr = this.track;
    const race = this.race;
    const myS = k.progress.s;
    const myLat = k.progress.lateral;
    const i = Math.max(0, k.progress.index);
    const hw = tr.width[i] * 0.5 - 1.4;
    let desired = 0;
    const look = 14 + Math.abs(speed) * 0.3;
    for (const o of race.karts) {
      if (o === k || o.respawn.active || o.isGhost) continue;
      const ds = wrapDelta(o.progress.s - myS, tr.length);
      if (ds <= 0 || ds > look) continue;
      const dl = o.progress.lateral - myLat;
      if (Math.abs(dl) > 2.6) continue;
      // hacia el lado con más espacio
      const roomLeft = o.progress.lateral + hw;
      const roomRight = hw - o.progress.lateral;
      const side = roomRight > roomLeft ? 1 : -1;
      desired += side * (2.8 - Math.abs(dl)) * (1.2 - ds / look) * (0.8 + this.personality.aggression * 0.4);
    }
    // trampas, bombas y obstáculos
    const threats = race.items ? race.items.getThreats() : [];
    for (const h of tr.hazards) h.avoidPoints(threats);
    const proj = this._proj || (this._proj = {});
    for (const t of threats) {
      const dxs = t.x - k.pos.x;
      const dzs = t.z - k.pos.z;
      if (dxs * dxs + dzs * dzs > 45 * 45) continue;
      tr.project(t.x, t.y ?? k.pos.y, t.z, i, proj);
      const ds = wrapDelta(proj.s - myS, tr.length);
      if (ds <= 0 || ds > 30) continue;
      const dl = proj.lateral - (myLat + desired * 0.5);
      const r = (t.r ?? 1) + 1.6;
      if (Math.abs(dl) < r) desired += (dl > 0 ? -1 : 1) * (r - Math.abs(dl)) * 1.1;
    }
    threats.length = 0;
    // cajas de objetos
    if (!k.item && !k.roulette && race.items) {
      const box = race.items.nextBoxFor(k, 45);
      if (box) {
        const dl = box.lateral - (tr.lineOffset[i] + this.lane);
        desired += clamp(dl, -4, 4) * 0.6 * this.personality.boxLove;
      }
    }
    return clamp(desired, -5, 5);
  }

  updateItems(dt) {
    const k = this.kart;
    const race = this.race;
    const inp = k.input;
    if (!race.items || race.phase !== 'racing') return;
    this.itemTimer -= dt;
    // Soltar un objeto sostenido detrás
    if (k.held && k.held.holdable) {
      this.holdTimer -= dt;
      const threatBehind = race.items.kartBehindWithin(k, 12);
      const nearJump = this.track.flags[Math.max(0, k.progress.index)] & (FLAG.NO_DRIFT | FLAG.RAMP | FLAG.GAP);
      if ((threatBehind || this.holdTimer <= 0) && !nearJump) {
        inp.itemHeld = false;
        inp.itemReleased = true;
        inp.aim = 0;
      } else {
        inp.itemHeld = true;
      }
      return;
    }
    if (this.itemTimer > 0) return;
    this.itemTimer = 0.25;
    if (!k.item || k.roulette) return;
    const behaviour = race.items.behaviourFor(k.item.id);
    if (!behaviour) return;
    const decision = behaviour.aiDecide ? behaviour.aiDecide(k, race, this) : { use: true };
    if (!decision || !decision.use) return;
    if (this.rng.next() > 0.35 + this.skill.itemSkill * 0.65) {
      this.itemTimer = this.rng.range(0.4, 1.2);
      return;
    }
    inp.aim = decision.aim ?? 0;
    inp.itemPressed = true;
    if (decision.hold) {
      inp.itemHeld = true;
      this.holdTimer = this.rng.range(3, 12);
    } else {
      inp.itemHeld = false;
    }
  }
}
