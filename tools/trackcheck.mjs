// Análisis estático de circuitos: curvas demasiado cerradas, pendientes excesivas, tramos que se
// solapan sin altura suficiente, longitud de los saltos, ganancia de los atajos y tiempo de vuelta
// estimado. Opcionalmente genera un mapa SVG en planta (alturas, muros, rampas, turbos, cajas…).
// Uso:  node --import ./tools/register.mjs tools/trackcheck.mjs [trackId|all] [carpetaSVG]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadTrackDef } from '../js/tracks/index.js';
import { buildTrack, FLAG } from '../js/track/TrackBuilder.js';
import { SURFACE } from '../js/physics/Surfaces.js';
import { formatTime } from '../js/core/MathUtils.js';

const root = new URL('../', import.meta.url);
const meta = JSON.parse(await readFile(new URL('data/tracks.json', root), 'utf8')).tracks;
const which = process.argv[2] || 'all';
const svgDir = process.argv[3] || null;

const CLEARANCE = 6.5; // separación vertical mínima entre tramos que se cruzan

function analyse(track) {
  const N = track.N;
  const sp = track.spacing;
  const issues = [];
  const uAt = (i) => track.u[i].toFixed(2);

  // Curvatura: radio mínimo frente a la media anchura
  let minR = Infinity;
  let minRi = 0;
  for (let i = 0; i < N; i++) {
    const r = 1 / Math.max(1e-6, Math.abs(track.curv[i]));
    if (r < minR) {
      minR = r;
      minRi = i;
    }
  }
  for (let i = 0; i < N; i++) {
    const r = 1 / Math.max(1e-6, Math.abs(track.curv[i]));
    const hw = track.width[i] * 0.5 + track.curbWidth;
    if (r < hw + 3) {
      issues.push(`curva demasiado cerrada en u=${uAt(i)} (radio ${r.toFixed(1)} m, media anchura ${hw.toFixed(1)} m)`);
      i += 10;
    }
  }

  // Pendientes (suavizadas en 6 m)
  let maxUp = 0;
  let maxUpI = 0;
  let maxDown = 0;
  let maxDownI = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 3) % N;
    if ((track.flags[i] | track.flags[j]) & (FLAG.GAP | FLAG.RAMP)) continue;
    const g = (track.py[j] - track.py[i]) / (3 * sp);
    if (g > maxUp) {
      maxUp = g;
      maxUpI = i;
    }
    if (-g > maxDown) {
      maxDown = -g;
      maxDownI = i;
    }
  }
  if (maxUp > 0.3) issues.push(`subida muy empinada en u=${uAt(maxUpI)} (${(maxUp * 100).toFixed(0)} %)`);
  if (maxDown > 0.36) issues.push(`bajada muy empinada en u=${uAt(maxDownI)} (${(maxDown * 100).toFixed(0)} %)`);

  // Solapamientos: tramos no consecutivos demasiado cerca en planta y en altura
  const minSep = Math.ceil(50 / sp);
  const reported = [];
  for (let i = 0; i < N; i += 1) {
    if (track.flags[i] & FLAG.GAP) continue;
    for (let j = i + minSep; j < N; j++) {
      if (N - (j - i) < minSep) break;
      if (track.flags[j] & FLAG.GAP) continue;
      const dx = track.px[i] - track.px[j];
      const dz = track.pz[i] - track.pz[j];
      const lim = track.width[i] * 0.5 + track.width[j] * 0.5 + 2 * track.curbWidth + 2.5;
      if (dx * dx + dz * dz > lim * lim) continue;
      const dy = Math.abs(track.py[i] - track.py[j]);
      if (dy >= CLEARANCE) continue;
      if (reported.some(([a, b]) => Math.abs(a - i) < 15 && Math.abs(b - j) < 15)) continue;
      reported.push([i, j]);
      issues.push(`solapamiento entre u=${uAt(i)} y u=${uAt(j)} (dist ${Math.hypot(dx, dz).toFixed(1)} m, Δy ${dy.toFixed(1)} m)`);
    }
  }

  // Saltos
  const gaps = track.gapZones.map((g) => {
    const len = track.forwardDistance(track.s[g.i0], track.s[g.i1]);
    const dy = track.py[g.i1] - track.py[g.i0];
    return { u0: uAt(g.i0), u1: uAt(g.i1), len, dy };
  });
  for (const g of gaps) if (g.len > 26) issues.push(`salto largo en u=${g.u0}: ${g.len.toFixed(1)} m`);

  // Atajos
  const shortcuts = track.shortcuts.map((sc) => {
    let len = 0;
    for (let i = 1; i < sc.N; i++) len += Math.hypot(sc.px[i] - sc.px[i - 1], sc.pz[i] - sc.pz[i - 1]);
    const main = track.forwardDistance(sc.sMap[0], sc.sMap[sc.N - 1]);
    return { len, main };
  });

  // Tiempo de vuelta de referencia
  let lap = 0;
  for (let i = 0; i < N; i++) lap += sp / Math.max(4, track.lineSpeed[i] * 0.78);

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    minY = Math.min(minY, track.py[i]);
    maxY = Math.max(maxY, track.py[i]);
  }
  return { issues, minR, minRu: uAt(minRi), maxUp, maxUpU: uAt(maxUpI), maxDown, maxDownU: uAt(maxDownI), gaps, shortcuts, lap, minY, maxY };
}

// ------------------------------------------------------------------------------------ SVG
function heightColor(t) {
  const stops = [
    [0, [40, 90, 200]],
    [0.35, [40, 180, 120]],
    [0.65, [240, 200, 60]],
    [1, [220, 60, 40]],
  ];
  t = Math.max(0, Math.min(1, t));
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const [t0, a] = stops[k - 1];
      const [t1, b] = stops[k];
      const f = (t - t0) / (t1 - t0);
      return `rgb(${a.map((v, n) => Math.round(v + (b[n] - v) * f)).join(',')})`;
    }
  }
  return 'rgb(220,60,40)';
}

const SURF_COLORS = {
  [SURFACE.GRASS]: '#4f8f3a',
  [SURFACE.DIRT]: '#8e6d45',
  [SURFACE.SAND]: '#d9c38b',
  [SURFACE.SNOW]: '#e9eef3',
  [SURFACE.SHALLOW_WATER]: '#5fb8d8',
  [SURFACE.DEEP_WATER]: '#1d5f8a',
  [SURFACE.LAVA]: '#ff6a00',
  [SURFACE.ROCK]: '#8a8278',
  [SURFACE.MUD]: '#6b4f33',
  [SURFACE.ICE]: '#bfe6f7',
  [SURFACE.NEON]: '#25123f',
  [SURFACE.ROAD]: '#555',
};

function toSVG(track, info) {
  const b = track.bounds;
  const pad = 30;
  const W = b.maxX - b.minX + pad * 2;
  const H = b.maxZ - b.minZ + pad * 2;
  const scale = 1400 / Math.max(W, H);
  // Convención del minimapa: x de pantalla = -x del mundo, y de pantalla = -z del mundo
  const X = (x) => ((b.maxX + pad - x) * scale).toFixed(1);
  const Y = (z) => ((b.maxZ + pad - z) * scale).toFixed(1);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * scale)}" height="${Math.round(H * scale) + 40}" viewBox="0 0 ${Math.round(W * scale)} ${Math.round(H * scale) + 40}" font-family="monospace">`);
  out.push(`<rect width="100%" height="100%" fill="#1b1b1b"/>`);
  // Terreno
  const hf = track.heightfield;
  if (hf) {
    const step = 6;
    for (let z = b.minZ - pad; z < b.maxZ + pad; z += step) {
      for (let x = b.minX - pad; x < b.maxX + pad; x += step) {
        if (!hf.contains(x, z)) continue;
        const s = hf.surfaceAt(x + step / 2, z + step / 2);
        const h = hf.heightAt(x + step / 2, z + step / 2);
        let col = SURF_COLORS[s] || '#4f8f3a';
        const shade = Math.max(0.55, Math.min(1.25, 0.85 + (h - info.minY) / 120));
        col = shadeHex(col, shade);
        out.push(`<rect x="${X(x + step)}" y="${Y(z + step)}" width="${(step * scale + 0.6).toFixed(1)}" height="${(step * scale + 0.6).toFixed(1)}" fill="${col}"/>`);
      }
    }
  }
  // Atajos
  for (const sc of track.shortcuts) {
    const pts = [];
    for (let i = 0; i < sc.N; i++) pts.push(`${X(sc.px[i])},${Y(sc.pz[i])}`);
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#b07a3a" stroke-width="${(sc.width[0] * scale).toFixed(1)}" stroke-linecap="round" opacity="0.9"/>`);
  }
  // Carretera coloreada por altura
  const range = Math.max(1, info.maxY - info.minY);
  for (let i = 0; i < track.N; i++) {
    const j = (i + 1) % track.N;
    const f = track.flags[i];
    const col = f & FLAG.GAP ? '#000' : heightColor((track.py[i] - info.minY) / range);
    const w = (track.width[i] + (f & FLAG.CURBS ? 2 * track.curbWidth : 0)) * scale;
    out.push(`<line x1="${X(track.px[i])}" y1="${Y(track.pz[i])}" x2="${X(track.px[j])}" y2="${Y(track.pz[j])}" stroke="${col}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" ${f & FLAG.GAP ? 'stroke-dasharray="3 3"' : ''}/>`);
    if (f & FLAG.BRIDGE) out.push(`<line x1="${X(track.px[i])}" y1="${Y(track.pz[i])}" x2="${X(track.px[j])}" y2="${Y(track.pz[j])}" stroke="#fff" stroke-width="1" opacity="0.8"/>`);
    if (f & FLAG.TUNNEL) out.push(`<line x1="${X(track.px[i])}" y1="${Y(track.pz[i])}" x2="${X(track.px[j])}" y2="${Y(track.pz[j])}" stroke="#000" stroke-width="3" opacity="0.6"/>`);
  }
  // Línea de carrera
  const lp = [];
  for (let i = 0; i < track.N; i += 2) {
    const p = track.linePointAt(track.s[i]);
    lp.push(`${X(p.x)},${Y(p.z)}`);
  }
  out.push(`<polyline points="${lp.join(' ')}" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.5"/>`);
  // Muros
  for (const w of track.geometry.walls) {
    const pts = w.list.map((i) => {
      const p = track.pointAt(track.s[i], w.side * w.offset(i));
      return `${X(p.x)},${Y(p.z)}`;
    });
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#ff4040" stroke-width="1.6"/>`);
  }
  for (const e of track.geometry.extra) {
    if (e.type === 'wall') out.push(`<polyline points="${e.points.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#ff9090" stroke-width="1.6"/>`);
    else if (e.type === 'box') {
      const c = Math.cos(e.rot);
      const s = Math.sin(e.rot);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, bb]) => {
        const lx = (a * e.w) / 2;
        const lz = (bb * e.d) / 2;
        return `${X(e.x + lx * c + lz * s)},${Y(e.z - lx * s + lz * c)}`;
      });
      out.push(`<polygon points="${corners.join(' ')}" fill="#666" stroke="#ccc" stroke-width="0.8"/>`);
    }
  }
  // Edificios u otros bloques registrados como marcadores
  for (const b of track.markers?.buildings || []) {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, bb]) => {
      const lx = (a * b.w) / 2;
      const lz = (bb * b.d) / 2;
      return `${X(b.x + lx * c + lz * s)},${Y(b.z - lx * s + lz * c)}`;
    });
    out.push(`<polygon points="${corners.join(' ')}" fill="#555a66" stroke="#9aa" stroke-width="0.8"/>`);
  }
  // Rampas y turbos
  for (const r of track.geometry.ramps) {
    const i = r.list[0];
    const p = track.pointAt(track.s[i], r.lat);
    out.push(`<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="5" fill="#ff9800" stroke="#000"/>`);
  }
  for (const p of track.geometry.pads) {
    const q = track.pointAt(p.s, p.lat);
    out.push(`<rect x="${(X(q.x) - 3).toFixed(1)}" y="${(Y(q.z) - 3).toFixed(1)}" width="6" height="6" fill="#00e5ff" stroke="#000"/>`);
  }
  for (const it of track.itemBoxSpots) out.push(`<circle cx="${X(it.x)}" cy="${Y(it.z)}" r="2.2" fill="#ffd740"/>`);
  // Decoración
  for (const pr of track.props) {
    if (pr.type === 'grass' || pr.type === 'flowers') continue;
    const col = /tree|pine|palm|bush|fern|jungle/.test(pr.type) ? '#123d12' : '#999';
    out.push(`<circle cx="${X(pr.x)}" cy="${Y(pr.z)}" r="${(1.2 * pr.scale).toFixed(1)}" fill="${col}" opacity="0.8"/>`);
  }
  // Obstáculos
  for (const h of track.hazards) {
    for (const c of h.colliders) out.push(`<circle cx="${X(c.x)}" cy="${Y(c.z)}" r="${Math.max(2, c.r * scale).toFixed(1)}" fill="none" stroke="#ff00ff" stroke-width="1.5"/>`);
  }
  // Parrilla y meta
  for (const sp of track.spawnSlots.slice(0, 8)) out.push(`<circle cx="${X(sp.x)}" cy="${Y(sp.z)}" r="2" fill="#fff"/>`);
  const a = track.pointAt(0, -track.width[0] * 0.6);
  const c = track.pointAt(0, track.width[0] * 0.6);
  out.push(`<line x1="${X(a.x)}" y1="${Y(a.z)}" x2="${X(c.x)}" y2="${Y(c.z)}" stroke="#fff" stroke-width="3"/>`);
  // Checkpoints
  for (const s of track.checkpoints) {
    const i = track.indexAtS(s);
    const p0 = track.pointAt(s, -track.width[i] * 0.5);
    const p1 = track.pointAt(s, track.width[i] * 0.5);
    out.push(`<line x1="${X(p0.x)}" y1="${Y(p0.z)}" x2="${X(p1.x)}" y2="${Y(p1.z)}" stroke="#7cf" stroke-width="1"/>`);
  }
  // Etiquetas de puntos de control (u)
  for (let c2 = 0; c2 < track.controlCount; c2++) {
    const p = track.pointAt(track.sAtU(c2), 0);
    out.push(`<text x="${X(p.x)}" y="${Y(p.z)}" fill="#fff" font-size="12" stroke="#000" stroke-width="3" paint-order="stroke">${c2}</text>`);
  }
  // Dirección de la marcha
  const d0 = track.pointAt(8, 0);
  const d1 = track.pointAt(22, 0);
  out.push(`<line x1="${X(d0.x)}" y1="${Y(d0.z)}" x2="${X(d1.x)}" y2="${Y(d1.z)}" stroke="#fff" stroke-width="2.5" marker-end="url(#arr)"/>`);
  out.splice(1, 0, `<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#fff"/></marker></defs>`);
  out.push(`<text x="10" y="${Math.round(H * scale) + 28}" fill="#fff" font-size="16">${track.name} · ${track.length.toFixed(0)} m · y ${info.minY.toFixed(0)}…${info.maxY.toFixed(0)} · vuelta ≈ ${formatTime(info.lap * 1000)}</text>`);
  out.push('</svg>');
  return out.join('\n');
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// ------------------------------------------------------------------------------------ main
const list = which === 'all' ? meta : meta.filter((m) => m.id === which);
if (!list.length) {
  console.error(`Circuito desconocido: ${which}`);
  process.exit(1);
}
if (svgDir) await mkdir(svgDir, { recursive: true });
let failures = 0;
for (const m of list) {
  let def;
  try {
    def = await loadTrackDef(m);
  } catch (e) {
    console.log(`\n=== ${m.name}: no se pudo cargar (${e.message})`);
    failures++;
    continue;
  }
  const t0 = performance.now();
  const track = buildTrack(def);
  const ms = performance.now() - t0;
  const info = analyse(track);
  console.log(`\n=== ${m.name} (${m.id}) ===`);
  console.log(
    `longitud ${track.length.toFixed(0)} m · muestras ${track.N} · build ${ms.toFixed(0)} ms · altura ${info.minY.toFixed(1)}…${info.maxY.toFixed(1)} m · radio mín ${info.minR.toFixed(1)} m (u=${info.minRu}) · subida máx ${(info.maxUp * 100).toFixed(0)} % (u=${info.maxUpU}) · bajada máx ${(info.maxDown * 100).toFixed(0)} % (u=${info.maxDownU})`,
  );
  console.log(`props ${track.props.length} · cajas ${track.itemBoxSpots.length} · turbos ${track.geometry.pads.length} · rampas ${track.geometry.ramps.length} · obstáculos ${track.hazards.length} · luces ${track.pointLights.length} · vuelta ≈ ${formatTime(info.lap * 1000)}`);
  for (const g of info.gaps) console.log(`salto u=${g.u0}→${g.u1}: ${g.len.toFixed(1)} m, Δy ${g.dy.toFixed(1)} m`);
  for (const s of info.shortcuts) console.log(`atajo: ${s.len.toFixed(0)} m frente a ${s.main.toFixed(0)} m por la pista`);
  if (info.issues.length) {
    failures++;
    for (const is of info.issues) console.log(`  ⚠ ${is}`);
  } else console.log('  ✓ sin problemas geométricos');
  if (svgDir) await writeFile(`${svgDir}/${m.id}.svg`, toSVG(track, info));
}
process.exit(failures ? 1 : 0);
