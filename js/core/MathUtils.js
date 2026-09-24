// Utilidades matemáticas compartidas por todos los sistemas (sin dependencias de DOM).

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Interpolación exponencial independiente del framerate. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Mueve `v` hacia `target` como máximo `delta`. */
export function approach(v, target, delta) {
  if (v < target) return Math.min(v + delta, target);
  return Math.max(v - delta, target);
}

/** Envuelve un ángulo al rango [-PI, PI). */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export function dampAngle(a, b, lambda, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
}

/** Distancia envuelta dentro de un circuito cerrado de longitud L (resultado en [-L/2, L/2)). */
export function wrapDelta(d, L) {
  d = (d + L / 2) % L;
  if (d < 0) d += L;
  return d - L / 2;
}

export function wrapIndex(i, n) {
  return ((i % n) + n) % n;
}

export function formatTime(ms, withMs = true) {
  if (!isFinite(ms) || ms < 0) return withMs ? '-:--.---' : '-:--';
  const total = Math.floor(ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const r = total % 1000;
  const ss = String(s).padStart(2, '0');
  return withMs ? `${m}:${ss}.${String(r).padStart(3, '0')}` : `${m}:${ss}`;
}

export function ordinal(n) {
  return `${n}º`;
}

/** Punto más cercano en el segmento AB (2D, plano XZ). Devuelve t en [0,1]. */
export function closestTOnSegment2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-9) return 0;
  return clamp01(((px - ax) * abx + (pz - az) * abz) / len2);
}

export function hexToRgb(hex) {
  const v = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
