// Circuito en tiempo de ejecución: muestras de la línea central, proyección de posiciones,
// progreso, checkpoints, zonas de caída y puntos de reaparición.
import { wrapAngle, wrapIndex } from '../core/MathUtils.js';

export const FLAG = {
  WALL_L: 1,
  WALL_R: 2,
  BRIDGE: 4,
  GAP: 8,
  NO_TERRAIN: 16,
  CURBS: 32,
  NO_DRIFT: 64,
  RAMP: 128,
  TUNNEL: 256,
  PAD: 512,
};

const PROJECT_WINDOW = 45;

export class Track {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.theme = def.theme || {};
    this.N = 0;
    this.length = 0;
    this.spacing = 2;
    this.collision = null;
    this.heightfield = null;
    this.checkpoints = [];
    this.gapZones = [];
    this.itemBoxSpots = [];
    this.spawnSlots = [];
    this.props = [];
    this.hazards = [];
    this.pointLights = [];
    this.geometry = { runs: [], curbs: [], ramps: [], pads: [], shortcuts: [], walls: [], extra: [] };
    this.killY = this.theme.killY ?? -80;
    this.waterLevel = this.theme.water ? this.theme.water.level : null;
    this.lavaLevel = this.theme.lava ? this.theme.lava.level : null;
    this.bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    this.curbWidth = def.curbWidth ?? 1.2;
  }

  /** Reserva los arrays por muestra. */
  allocate(N) {
    this.N = N;
    const f = () => new Float32Array(N);
    this.px = f();
    this.py = f();
    this.pz = f();
    this.tx = f();
    this.ty = f();
    this.tz = f();
    this.rx = f();
    this.rz = f();
    this.bank = f();
    this.width = f();
    this.u = f();
    this.s = f();
    this.curv = f();
    this.blend = f();
    this.flags = new Uint16Array(N);
    this.surface = new Uint8Array(N);
    this.lineOffset = f();
    this.lineCurv = f();
    this.lineSpeed = f();
  }

  wrapS(s) {
    const L = this.length;
    return ((s % L) + L) % L;
  }

  indexAtS(s) {
    return Math.floor(this.wrapS(s) / this.spacing) % this.N;
  }

  halfWidth(i) {
    return this.width[i] * 0.5;
  }

  /** Índice de la primera muestra cuyo parámetro de spline es >= u. */
  indexAtU(u) {
    const n = this.controlCount;
    u = ((u % n) + n) % n;
    const U = this.u;
    let lo = 0;
    let hi = this.N - 1;
    if (u <= U[0]) return 0;
    if (u > U[hi]) return 0;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (U[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Distancia a lo largo del circuito correspondiente al parámetro u (interpolada). */
  sAtU(u) {
    const n = this.controlCount;
    u = ((u % n) + n) % n;
    const U = this.u;
    const N = this.N;
    if (u <= U[0]) return this.s[0];
    const i = this.indexAtU(u);
    let u0;
    let u1;
    let s0;
    if (i === 0) {
      u0 = U[N - 1];
      u1 = n + U[0];
      s0 = this.s[N - 1];
    } else {
      u0 = U[i - 1];
      u1 = U[i];
      s0 = this.s[i - 1];
    }
    const t = u1 > u0 ? (u - u0) / (u1 - u0) : 0;
    return this.wrapS(s0 + t * this.spacing);
  }

  /** Posición sobre la superficie (peraltada) a distancia s y desplazamiento lateral. */
  pointAt(s, lateral = 0, out = { x: 0, y: 0, z: 0 }) {
    s = this.wrapS(s);
    const f = s / this.spacing;
    const i = Math.floor(f) % this.N;
    const j = (i + 1) % this.N;
    const t = f - Math.floor(f);
    let rx = this.rx[i] + (this.rx[j] - this.rx[i]) * t;
    let rz = this.rz[i] + (this.rz[j] - this.rz[i]) * t;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    const b = this.bank[i] + (this.bank[j] - this.bank[i]) * t;
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    out.x = this.px[i] + (this.px[j] - this.px[i]) * t + rx * cb * lateral;
    out.y = this.py[i] + (this.py[j] - this.py[i]) * t + sb * lateral;
    out.z = this.pz[i] + (this.pz[j] - this.pz[i]) * t + rz * cb * lateral;
    return out;
  }

  /** Punto de la línea de carrera (IA) a distancia s con un desplazamiento adicional. */
  linePointAt(s, extraLateral = 0, out = { x: 0, y: 0, z: 0 }) {
    s = this.wrapS(s);
    const f = s / this.spacing;
    const i = Math.floor(f) % this.N;
    const j = (i + 1) % this.N;
    const t = f - Math.floor(f);
    const off = this.lineOffset[i] + (this.lineOffset[j] - this.lineOffset[i]) * t;
    return this.pointAt(s, off + extraLateral, out);
  }

  headingAt(s) {
    s = this.wrapS(s);
    const f = s / this.spacing;
    const i = Math.floor(f) % this.N;
    const j = (i + 1) % this.N;
    const t = f - Math.floor(f);
    const a = Math.atan2(this.tx[i], this.tz[i]);
    const b = Math.atan2(this.tx[j], this.tz[j]);
    return a + wrapAngle(b - a) * t;
  }

  headingAtIndex(i) {
    return Math.atan2(this.tx[i], this.tz[i]);
  }

  /**
   * Proyecta una posición sobre la línea central. Usa una ventana alrededor de `hint`
   * (índice previo) para distinguir tramos superpuestos (puentes, cruces).
   */
  project(x, y, z, hint, out) {
    const N = this.N;
    const px = this.px;
    const py = this.py;
    const pz = this.pz;
    let best = -1;
    let bestD = Infinity;
    if (hint >= 0 && hint < N) {
      for (let k = -PROJECT_WINDOW; k <= PROJECT_WINDOW; k++) {
        const i = hint + k < 0 ? hint + k + N : hint + k >= N ? hint + k - N : hint + k;
        const dx = px[i] - x;
        const dz = pz[i] - z;
        const dy = (py[i] - y) * 1.5;
        const d = dx * dx + dz * dz + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    if (best < 0 || bestD > 70 * 70) {
      const prevBest = best;
      const prevD = bestD;
      for (let i = 0; i < N; i++) {
        const dx = px[i] - x;
        const dz = pz[i] - z;
        const dy = (py[i] - y) * 1.5;
        const d = dx * dx + dz * dz + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (prevBest >= 0 && bestD > prevD * 0.5) best = prevBest; // solo salta si es claramente mejor
    }

    // Atajos: si el kart está más cerca de un atajo, su progreso se interpola sobre él.
    if (this.shortcuts && this.shortcuts.length) {
      let sc = null;
      let si = -1;
      let sd = bestD;
      for (const src of this.shortcuts) {
        for (let k = 0; k < src.N; k++) {
          const dx = src.px[k] - x;
          const dz = src.pz[k] - z;
          const dy = (src.py[k] - y) * 1.5;
          const d = dx * dx + dz * dz + dy * dy;
          if (d < sd) {
            sd = d;
            sc = src;
            si = k;
          }
        }
      }
      if (sc && sd < bestD * 0.8) {
        const s = sc.sMap[si];
        const dx = x - sc.px[si];
        const dz = z - sc.pz[si];
        out.index = this.indexAtS(s);
        out.s = s;
        out.lateral = dx * sc.rx[si] + dz * sc.rz[si];
        out.dist = Math.sqrt(dx * dx + dz * dz);
        out.dy = y - sc.py[si];
        out.centerY = sc.py[si];
        out.shortcut = true;
        return out;
      }
    }
    out.shortcut = false;

    // Refinado sobre los dos segmentos adyacentes (en planta)
    const iPrev = best === 0 ? N - 1 : best - 1;
    const iNext = best === N - 1 ? 0 : best + 1;
    let segA = best;
    let segB = iNext;
    let t = this._segT(x, z, best, iNext);
    if (t <= 0) {
      const t2 = this._segT(x, z, iPrev, best);
      if (t2 < 1) {
        segA = iPrev;
        segB = best;
        t = t2;
      }
    }
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = px[segA] + (px[segB] - px[segA]) * t;
    const cy = py[segA] + (py[segB] - py[segA]) * t;
    const cz = pz[segA] + (pz[segB] - pz[segA]) * t;
    let rx = this.rx[segA] + (this.rx[segB] - this.rx[segA]) * t;
    let rz = this.rz[segA] + (this.rz[segB] - this.rz[segA]) * t;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    const dx = x - cx;
    const dz = z - cz;
    let s = this.s[segA] + t * this.spacing;
    if (s >= this.length) s -= this.length;
    out.index = t > 0.5 ? segB : segA;
    out.s = s;
    out.lateral = dx * rx + dz * rz;
    out.dist = Math.sqrt(dx * dx + dz * dz);
    out.dy = y - cy;
    out.centerY = cy;
    return out;
  }

  _segT(x, z, a, b) {
    const ax = this.px[a];
    const az = this.pz[a];
    const bx = this.px[b] - ax;
    const bz = this.pz[b] - az;
    const len2 = bx * bx + bz * bz;
    if (len2 < 1e-9) return 0;
    return ((x - ax) * bx + (z - az) * bz) / len2;
  }

  /** ¿Está la distancia s dentro de una zona de salto/abismo? Devuelve la zona. */
  gapZoneAt(s) {
    s = this.wrapS(s);
    for (const g of this.gapZones) {
      if (g.s0 <= g.s1) {
        if (s >= g.s0 && s <= g.s1) return g;
      } else if (s >= g.s0 || s <= g.s1) return g;
    }
    return null;
  }

  /** Punto seguro de reaparición cercano a s (nunca dentro de un hueco). */
  respawnPoint(s, lateral = 0, fallS = null) {
    let target = this.wrapS(s - 4);
    const zone = (fallS !== null && this.gapZoneAt(fallS)) || this.gapZoneAt(target) || this.gapZoneAt(s);
    if (zone) {
      target = zone.respawnS;
      lateral = 0;
    }
    // Evitar muestras sin suelo (huecos)
    for (let tries = 0; tries < 40; tries++) {
      const i = this.indexAtS(target);
      if (!(this.flags[i] & (FLAG.GAP | FLAG.RAMP))) break;
      target = this.wrapS(target + this.spacing * 2);
    }
    const i = this.indexAtS(target);
    const hw = this.halfWidth(i) - 2.5;
    const lat = Math.max(-hw, Math.min(hw, lateral));
    const p = this.pointAt(target, lat);
    return { x: p.x, y: p.y, z: p.z, yaw: this.headingAt(target), s: target, index: i, lateral: lat };
  }

  /** Distancia envuelta de un índice a otro hacia delante. */
  forwardDistance(fromS, toS) {
    let d = toS - fromS;
    if (d < 0) d += this.length;
    return d;
  }

  /** Curvatura media absoluta de la línea de carrera en [s, s+dist]. */
  curvatureAhead(s, dist, stepSamples = 2) {
    const i0 = this.indexAtS(s);
    const n = Math.max(1, Math.round(dist / this.spacing));
    let maxAbs = 0;
    let sum = 0;
    for (let k = 0; k <= n; k += stepSamples) {
      const c = this.lineCurv[wrapIndex(i0 + k, this.N)];
      sum += c;
      if (Math.abs(c) > maxAbs) maxAbs = Math.abs(c);
    }
    return { max: maxAbs, mean: sum / (Math.floor(n / stepSamples) + 1) };
  }
}
