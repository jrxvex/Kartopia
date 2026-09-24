// Línea de carrera para la IA: relajación iterativa que minimiza la curvatura dentro de los
// límites de la pista, respetando restricciones (rampas, saltos). Calcula también la curvatura
// de la línea y un perfil de velocidad máxima de referencia.
import { clamp, wrapAngle, wrapIndex } from '../core/MathUtils.js';
import { PHYSICS } from '../config.js';
import { FLAG } from './Track.js';

export function computeRacingLine(track, opts = {}) {
  const N = track.N;
  const margin = opts.margin ?? 2.2;
  const iterations = opts.iterations ?? 240;
  const k = opts.neighbor ?? 5;
  const off = new Float64Array(N);
  const lo = new Float64Array(N);
  const hi = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const hw = Math.max(0.5, track.width[i] * 0.5 - margin);
    lo[i] = -hw;
    hi[i] = hw;
  }

  const restrict = (i0, count, a, b) => {
    for (let n = 0; n < count; n++) {
      const i = wrapIndex(i0 + n, N);
      lo[i] = Math.max(lo[i], a);
      hi[i] = Math.min(hi[i], b);
      if (lo[i] > hi[i]) {
        const m = (a + b) / 2;
        lo[i] = m;
        hi[i] = m;
      }
    }
  };

  // Rampas: la línea debe pasar por encima de la rampa (y llegar alineada).
  for (const r of track.geometry.ramps) {
    const i0 = r.list[0];
    const lead = Math.round(22 / track.spacing);
    const a = r.lat - r.hw + 1.2;
    const b = r.lat + r.hw - 1.2;
    restrict(i0 - lead, lead + r.list.length, a, b);
  }
  // Huecos: aproximación centrada y recta.
  for (const g of track.gapZones) {
    const lead = Math.round(24 / track.spacing);
    const span = wrapIndex(g.i1 - g.i0, N) + 1;
    restrict(g.i0 - lead, lead + span + 3, g.lineMin ?? -1.2, g.lineMax ?? 1.2);
  }
  // Restricciones manuales del circuito: [{from, to, min, max}] en índices de muestra
  for (const c of track.lineConstraints || []) {
    restrict(c.i0, c.count, c.min, c.max);
  }

  // Relajación (Gauss-Seidel)
  const px = track.px;
  const pz = track.pz;
  const rx = track.rx;
  const rz = track.rz;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < N; i++) {
      const a = wrapIndex(i - k, N);
      const b = wrapIndex(i + k, N);
      const ax = px[a] + rx[a] * off[a];
      const az = pz[a] + rz[a] * off[a];
      const bx = px[b] + rx[b] * off[b];
      const bz = pz[b] + rz[b] * off[b];
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      const target = (mx - px[i]) * rx[i] + (mz - pz[i]) * rz[i];
      off[i] = clamp(off[i] + (target - off[i]) * 0.6, lo[i], hi[i]);
    }
  }
  // Suavizado final ligero
  const tmp = new Float64Array(N);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      tmp[i] = clamp(
        (off[wrapIndex(i - 1, N)] + off[i] * 2 + off[wrapIndex(i + 1, N)]) / 4,
        lo[i],
        hi[i],
      );
    }
    off.set(tmp);
  }
  for (let i = 0; i < N; i++) track.lineOffset[i] = off[i];

  // Curvatura de la línea resultante
  const hx = new Float64Array(N);
  const hz = new Float64Array(N);
  const lx = new Float64Array(N);
  const lz = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    lx[i] = px[i] + rx[i] * off[i];
    lz[i] = pz[i] + rz[i] * off[i];
  }
  const heading = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const j = wrapIndex(i + 1, N);
    hx[i] = lx[j] - lx[i];
    hz[i] = lz[j] - lz[i];
    heading[i] = Math.atan2(hx[i], hz[i]);
  }
  const curv = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = wrapIndex(i - 2, N);
    const b = wrapIndex(i + 2, N);
    let d = 0;
    for (let n = -2; n < 2; n++) {
      const q = wrapIndex(i + n, N);
      d += Math.hypot(hx[q], hz[q]);
    }
    curv[i] = wrapAngle(heading[b] - heading[a]) / Math.max(0.5, d);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      tmp[i] = (curv[wrapIndex(i - 2, N)] + curv[wrapIndex(i - 1, N)] + curv[i] * 2 + curv[wrapIndex(i + 1, N)] + curv[wrapIndex(i + 2, N)]) / 6;
    }
    curv.set(tmp);
  }
  for (let i = 0; i < N; i++) track.lineCurv[i] = curv[i];

  // Perfil de velocidad de referencia (kart estándar a 150cc)
  const omega = PHYSICS.TURN_RATE * 1.0;
  const vmax = PHYSICS.BASE_MAX_SPEED * 1.35;
  const speed = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const c = Math.abs(curv[i]);
    speed[i] = c > 1e-4 ? Math.min(vmax, omega / c) : vmax;
  }
  const brake = PHYSICS.BRAKE_DECEL * 0.55;
  for (let pass = 0; pass < 2; pass++) {
    for (let n = N - 1; n >= 0; n--) {
      const i = n;
      const j = wrapIndex(i + 1, N);
      const lim = Math.sqrt(speed[j] * speed[j] + 2 * brake * track.spacing);
      if (speed[i] > lim) speed[i] = lim;
    }
  }
  for (let i = 0; i < N; i++) track.lineSpeed[i] = speed[i];

  // Marca zonas de no derrape (antes de rampas/huecos ya se marcan en el constructor)
  for (let i = 0; i < N; i++) {
    if (track.flags[i] & (FLAG.GAP | FLAG.RAMP)) track.flags[i] |= FLAG.NO_DRIFT;
  }
}
