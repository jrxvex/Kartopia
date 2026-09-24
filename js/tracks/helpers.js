// Utilidades compartidas por las definiciones de circuitos: filas de edificios a lo largo de la
// pista, bloques rellenos de edificios y comprobaciones de espacio libre respecto a la carretera.

/**
 * Coloca una fila de edificios junto a la pista entre `from` y `to` (parámetro u) en un lado
 * (-1 izquierda, 1 derecha). Añade el colisionador y devuelve los datos visuales para landmarks.
 */
export function buildingRow(api, opts) {
  const { rng, track } = api;
  const side = opts.side ?? 1;
  const setback = opts.setback ?? 4;
  const out = [];
  const s0 = api.sAtU(opts.from);
  const span = track.forwardDistance(s0, api.sAtU(opts.to));
  let d = opts.offset ?? 0;
  while (d < span) {
    const len = rng.range(...(opts.length || [14, 24]));
    const depth = rng.range(...(opts.depth || [12, 20]));
    const h = rng.range(...(opts.height || [14, 40]));
    const s = track.wrapS(s0 + d + len / 2);
    const i = track.indexAtS(s);
    const lat = side * (track.width[i] * 0.5 + track.curbWidth + setback + depth / 2);
    const p = track.pointAt(s, lat);
    const rot = track.headingAt(s) + side * Math.PI * 0.5;
    if (fits(api, p.x, p.z, len, depth, rot, opts.clearance ?? 2.5) && !overlaps(opts.avoid, p.x, p.z, len, depth)) {
      const y = api.groundY(p.x, p.z);
      api.box(p.x, p.z, len, depth, h, { rot, visual: false, y });
      const b = { x: p.x, y, z: p.z, w: len, d: depth, h, rot };
      out.push(b);
      if (opts.avoid) opts.avoid.push(b);
    }
    d += len + rng.range(...(opts.gap || [2, 6]));
  }
  return out;
}

/** Rellena una zona rectangular (centro, tamaño y giro) con edificios en cuadrícula. */
export function buildingBlock(api, opts) {
  const { rng } = api;
  const out = [];
  const cols = opts.cols ?? 2;
  const rows = opts.rows ?? 2;
  const rot = opts.rot ?? 0;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const cw = opts.w / cols;
  const cd = opts.d / rows;
  for (let a = 0; a < cols; a++) {
    for (let b = 0; b < rows; b++) {
      if (rng.next() < (opts.skip ?? 0)) continue;
      const lx = -opts.w / 2 + cw * (a + 0.5);
      const lz = -opts.d / 2 + cd * (b + 0.5);
      const x = opts.x + lx * c + lz * s;
      const z = opts.z - lx * s + lz * c;
      const w = cw * rng.range(0.62, 0.86);
      const d = cd * rng.range(0.62, 0.86);
      const h = rng.range(...(opts.height || [16, 50]));
      if (!fits(api, x, z, w, d, rot, opts.clearance ?? 3) || overlaps(opts.avoid, x, z, w, d)) continue;
      const y = api.groundY(x, z);
      api.box(x, z, w, d, h, { rot, visual: false, y });
      const bld = { x, y, z, w, d, h, rot };
      out.push(bld);
      if (opts.avoid) opts.avoid.push(bld);
    }
  }
  return out;
}

/** ¿Cabe un rectángulo (w a lo largo de X local, d a lo largo de Z local) sin tocar ninguna vía? */
export function fits(api, x, z, w, d, rot, clearance = 2) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const lx = (a * w) / 2;
    const lz = (b * d) / 2;
    const px = x + lx * c + lz * s;
    const pz = z - lx * s + lz * c;
    if (api.edgeDistance(px, pz) < clearance) return false;
  }
  return true;
}

/** ¿Se solapa (aproximando con círculos) con alguno de los edificios ya colocados? */
function overlaps(list, x, z, w, d) {
  if (!list) return false;
  const r = Math.max(w, d) * 0.5;
  for (const b of list) {
    const rb = Math.max(b.w, b.d) * 0.5;
    if (Math.hypot(b.x - x, b.z - z) < (r + rb) * 0.85) return true;
  }
  return false;
}

/** Puntos de una curva circular (ángulos en grados, x = cx + cos·r, z = cz + sin·r). */
export function arc(cx, cz, r, a0, a1, n, y0 = 0, y1 = y0, opts) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0 : k / (n - 1);
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    const p = [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
    if (opts) p.push({ ...opts });
    pts.push(p);
  }
  return pts;
}
