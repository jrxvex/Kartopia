// Fantasma de contrarreloj: graba la trayectoria del jugador y la reproduce interpolada.
import { lerpAngle } from '../core/MathUtils.js';

const INTERVAL = 0.05;
const STRIDE = 5; // x, y, z, yaw, estado

export class GhostRecorder {
  constructor(kart, trackId) {
    this.kart = kart;
    this.trackId = trackId;
    this.frames = [];
    this.acc = INTERVAL; // graba el primer fotograma inmediatamente
    this.last = 0;
  }

  record(time, dt) {
    this.acc += dt;
    if (this.acc < INTERVAL) return;
    this.acc -= INTERVAL;
    const k = this.kart;
    let state = 0;
    if (k.boostTime > 0) state |= 1;
    if (k.drift.active && k.drift.dir < 0) state |= 2;
    if (k.drift.active && k.drift.dir > 0) state |= 4;
    if (!k.grounded) state |= 8;
    this.frames.push(
      Math.round(k.pos.x * 100) / 100,
      Math.round(k.pos.y * 100) / 100,
      Math.round(k.pos.z * 100) / 100,
      Math.round(k.yaw * 1000) / 1000,
      state,
    );
  }

  toData(totalTime, lapTimes) {
    return {
      v: 1,
      trackId: this.trackId,
      character: this.kart.character.id,
      kart: this.kart.kartDef.id,
      time: totalTime,
      lapTimes,
      interval: INTERVAL,
      frames: this.frames,
      date: Date.now(),
    };
  }
}

export class GhostPlayer {
  constructor(data) {
    this.data = data;
    this.frames = data.frames;
    this.count = Math.floor(this.frames.length / STRIDE);
    this.interval = data.interval || INTERVAL;
  }

  get duration() {
    return this.count * this.interval;
  }

  /** Estado interpolado en el instante t (segundos desde la salida). */
  sample(t, out) {
    const f = Math.max(0, t / this.interval);
    let i = Math.floor(f);
    if (i >= this.count - 1) {
      i = this.count - 1;
      const o = i * STRIDE;
      out.x = this.frames[o];
      out.y = this.frames[o + 1];
      out.z = this.frames[o + 2];
      out.yaw = this.frames[o + 3];
      out.state = this.frames[o + 4];
      out.done = true;
      return out;
    }
    const a = f - i;
    const o = i * STRIDE;
    const p = o + STRIDE;
    const F = this.frames;
    out.x = F[o] + (F[p] - F[o]) * a;
    out.y = F[o + 1] + (F[p + 1] - F[o + 1]) * a;
    out.z = F[o + 2] + (F[p + 2] - F[o + 2]) * a;
    out.yaw = lerpAngle(F[o + 3], F[p + 3], a);
    out.state = F[o + 4];
    out.done = false;
    return out;
  }
}
