// Constructor lógico de circuitos: a partir de la definición de un circuito (js/tracks/*.js)
// genera la línea central muestreada, los atributos por muestra, la geometría de colisión
// (carretera, bordillos, rampas, paneles turbo, atajos), los muros, el terreno, la línea de
// carrera de la IA, checkpoints, parrilla de salida, cajas de objetos, decoración y obstáculos.
// No depende del DOM: se puede ejecutar en Node para validar circuitos.
import { CatmullRom3, sampleSpline } from './Spline.js';
import { Track, FLAG } from './Track.js';
import { Heightfield } from './Heightfield.js';
import { buildStrip, contiguousRuns } from './RoadStrip.js';
import { computeRacingLine } from './RacingLine.js';
import { createHazard } from './Hazards.js';
import { PROP_TYPES } from './PropTypes.js';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { SURFACE, surfaceId, surfaceDef } from '../physics/Surfaces.js';
import { Random, fbm2, ridged2, hashString } from '../core/Random.js';
import { clamp, lerp, smoothstep, wrapAngle, wrapIndex, DEG, TAU } from '../core/MathUtils.js';

const DEFAULT_SPACING = 2;
const SHOULDER = 3.5;
const TERRAIN_DROP = 0.3;

export function buildTrack(def) {
  const track = new Track(def);
  const rng = new Random(def.seed ?? def.id ?? 'track');
  track.rng = rng;
  buildCenterline(track, def);
  applyAttributes(track, def);
  computeFrames(track, def);
  applyFeatures(track, def);
  const world = new CollisionWorld(12);
  track.collision = world;
  buildShortcuts(track, def);
  buildRoad(track, def, world);
  buildRamps(track, def, world);
  buildPads(track, def, world);
  buildWalls(track, def, world);
  buildTerrain(track, def, world);
  prepareLineConstraints(track, def);
  computeRacingLine(track, def.ai || {});
  buildCheckpoints(track, def);
  buildSpawns(track, def);
  buildItemBoxes(track, def);
  placeProps(track, def, world, rng);
  buildHazards(track, def, world);
  world.finalize();
  return track;
}

// ------------------------------------------------------------------------------------------
function inURange(u, from, to, n) {
  if (to - from >= n) return true;
  from = ((from % n) + n) % n;
  to = ((to % n) + n) % n;
  if (from <= to) return u >= from && u < to;
  return u >= from || u < to;
}

function samplePoint(src, i, lat, out = { x: 0, y: 0, z: 0 }) {
  const b = src.bank[i];
  const cb = Math.cos(b);
  out.x = src.px[i] + src.rx[i] * cb * lat;
  out.y = src.py[i] + Math.sin(b) * lat;
  out.z = src.pz[i] + src.rz[i] * cb * lat;
  return out;
}

// ------------------------------------------------------------------------------------------
function buildCenterline(track, def) {
  const pts = def.points.map((p) => ({ x: p[0], y: p[1], z: p[2], o: p[3] || {} }));
  const spline = new CatmullRom3(pts, true);
  const smp = sampleSpline(spline, def.spacing || DEFAULT_SPACING);
  track.allocate(smp.count);
  for (let i = 0; i < smp.count; i++) {
    track.px[i] = smp.x[i];
    track.py[i] = smp.y[i];
    track.pz[i] = smp.z[i];
    track.u[i] = smp.u[i];
    track.s[i] = smp.s[i];
  }
  track.length = smp.length;
  track.spacing = smp.spacing;
  track.controlPoints = pts;
  track.controlCount = pts.length;
  track.spline = spline;
}

function applyAttributes(track, def) {
  const N = track.N;
  const n = track.controlCount;
  const pts = track.controlPoints;
  const defW = def.width ?? 16;
  const defSurface = surfaceId(def.roadSurface || 'road');
  const wallsDefault = def.walls ?? true;
  const curbsDefault = def.curbs ?? true;
  const blendDefault = def.terrain?.blend ?? 22;
  track.wallStyles = [def.wallStyle || 'barrier'];
  track.wallStyle = new Uint8Array(N);
  track.roadStyles = [def.roadStyle || 'asphalt'];
  track.roadStyle = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    const u = track.u[i];
    const a = Math.floor(u) % n;
    const b = (a + 1) % n;
    const t = smoothstep(0, 1, u - Math.floor(u));
    const wA = pts[a].o.w ?? defW;
    const wB = pts[b].o.w ?? defW;
    track.width[i] = lerp(wA, wB, t);
    let f = 0;
    if (wallsDefault) f |= FLAG.WALL_L | FLAG.WALL_R;
    if (curbsDefault) f |= FLAG.CURBS;
    track.flags[i] = f;
    track.surface[i] = defSurface;
    track.blend[i] = blendDefault;
  }

  for (const sec of def.sections || []) {
    let styleIdx = -1;
    if (sec.wallStyle) {
      styleIdx = track.wallStyles.indexOf(sec.wallStyle);
      if (styleIdx < 0) {
        track.wallStyles.push(sec.wallStyle);
        styleIdx = track.wallStyles.length - 1;
      }
    }
    let roadIdx = -1;
    if (sec.roadStyle) {
      roadIdx = track.roadStyles.indexOf(sec.roadStyle);
      if (roadIdx < 0) {
        track.roadStyles.push(sec.roadStyle);
        roadIdx = track.roadStyles.length - 1;
      }
    }
    for (let i = 0; i < N; i++) {
      if (!inURange(track.u[i], sec.from, sec.to, n)) continue;
      let f = track.flags[i];
      if ('walls' in sec) f = sec.walls ? f | FLAG.WALL_L | FLAG.WALL_R : f & ~(FLAG.WALL_L | FLAG.WALL_R);
      if ('wallL' in sec) f = sec.wallL ? f | FLAG.WALL_L : f & ~FLAG.WALL_L;
      if ('wallR' in sec) f = sec.wallR ? f | FLAG.WALL_R : f & ~FLAG.WALL_R;
      if ('curbs' in sec) f = sec.curbs ? f | FLAG.CURBS : f & ~FLAG.CURBS;
      if (sec.bridge) f |= FLAG.BRIDGE | FLAG.NO_TERRAIN;
      if (sec.noTerrain) f |= FLAG.NO_TERRAIN;
      if (sec.tunnel) f |= FLAG.TUNNEL;
      if (sec.noDrift) f |= FLAG.NO_DRIFT;
      track.flags[i] = f;
      if (sec.surface) track.surface[i] = surfaceId(sec.surface);
      if (sec.blend !== undefined) track.blend[i] = sec.blend;
      if (sec.width !== undefined) track.width[i] = sec.width;
      if (styleIdx >= 0) track.wallStyle[i] = styleIdx;
      if (roadIdx >= 0) track.roadStyle[i] = roadIdx;
    }
  }
  // Suaviza los cambios de anchura
  const w = Float64Array.from(track.width);
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < N; i++) {
      track.width[i] = (w[wrapIndex(i - 1, N)] + w[i] * 2 + w[wrapIndex(i + 1, N)]) / 4;
    }
    w.set(track.width);
  }
}

function computeFrames(track, def) {
  const N = track.N;
  const heading = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = wrapIndex(i - 1, N);
    const b = wrapIndex(i + 1, N);
    let tx = track.px[b] - track.px[a];
    let ty = track.py[b] - track.py[a];
    let tz = track.pz[b] - track.pz[a];
    const l = Math.hypot(tx, ty, tz) || 1;
    tx /= l;
    ty /= l;
    tz /= l;
    track.tx[i] = tx;
    track.ty[i] = ty;
    track.tz[i] = tz;
    const hl = Math.hypot(tx, tz) || 1;
    const hx = tx / hl;
    const hz = tz / hl;
    track.rx[i] = -hz;
    track.rz[i] = hx;
    heading[i] = Math.atan2(hx, hz);
  }
  const raw = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    raw[i] = wrapAngle(heading[wrapIndex(i + 1, N)] - heading[wrapIndex(i - 1, N)]) / (2 * track.spacing);
  }
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let k = -4; k <= 4; k++) sum += raw[wrapIndex(i + k, N)];
    track.curv[i] = sum / 9;
  }
  // Peralte
  const autoBank = def.autoBank ?? 110;
  const maxBank = def.maxBank ?? 12;
  const pts = track.controlPoints;
  const n = track.controlCount;
  const bank = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const auto = clamp(track.curv[i] * autoBank, -maxBank, maxBank);
    const u = track.u[i];
    const a = Math.floor(u) % n;
    const b = (a + 1) % n;
    const t = smoothstep(0, 1, u - Math.floor(u));
    const bA = pts[a].o.bank;
    const bB = pts[b].o.bank;
    let deg = auto;
    if (bA !== undefined || bB !== undefined) deg = lerp(bA ?? auto, bB ?? auto, t);
    bank[i] = deg * DEG;
  }
  const tmp = new Float64Array(N);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += bank[wrapIndex(i + k, N)];
      tmp[i] = sum / 7;
    }
    bank.set(tmp);
  }
  for (let i = 0; i < N; i++) track.bank[i] = bank[i];
}

function markRange(track, i0, count, fn) {
  for (let k = 0; k < count; k++) fn(wrapIndex(i0 + k, track.N));
}

function applyFeatures(track, def) {
  const N = track.N;
  for (const gap of def.gaps || []) {
    const i0 = track.indexAtU(gap.from);
    const i1 = track.indexAtU(gap.to);
    const span = wrapIndex(i1 - i0, N) + 1;
    markRange(track, i0, span, (i) => {
      track.flags[i] |= FLAG.GAP | FLAG.NO_TERRAIN;
      track.flags[i] &= ~(FLAG.WALL_L | FLAG.WALL_R | FLAG.CURBS);
    });
    const lead = Math.round(30 / track.spacing);
    markRange(track, i0 - lead, lead, (i) => (track.flags[i] |= FLAG.NO_DRIFT));
    track.gapZones.push({
      i0,
      i1,
      s0: track.wrapS(track.s[i0] - 45),
      s1: track.s[i1],
      respawnS: track.wrapS(track.s[i1] + (gap.respawnAfter ?? 10)),
      depth: gap.depth ?? 30,
      fill: gap.fill || 'abyss',
      lineMin: gap.lineMin,
      lineMax: gap.lineMax,
    });
  }
  for (const r of def.ramps || []) {
    const i0 = track.indexAtU(r.at);
    const n = Math.max(2, Math.round((r.length ?? 7) / track.spacing));
    markRange(track, i0, n + 1, (i) => (track.flags[i] |= FLAG.RAMP | FLAG.NO_DRIFT));
    const lead = Math.round(24 / track.spacing);
    markRange(track, i0 - lead, lead, (i) => (track.flags[i] |= FLAG.NO_DRIFT));
  }
  for (const p of def.boostPads || []) {
    const i0 = track.indexAtU(p.at);
    const n = Math.max(1, Math.round((p.length ?? 5) / track.spacing));
    markRange(track, i0, n + 1, (i) => (track.flags[i] |= FLAG.PAD));
  }
}

// ------------------------------------------------------------------------------------------
function nearestSample2D(track, x, z) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < track.N; i++) {
    const d = (track.px[i] - x) ** 2 + (track.pz[i] - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function buildShortcuts(track, def) {
  track.shortcuts = [];
  for (const sc of def.shortcuts || []) {
    const raw = sc.points.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    // Alturas automáticas (null): extremos desde la pista principal, interior interpolado
    const known = raw.map((p) => p.y !== null && p.y !== undefined);
    if (!known[0]) raw[0].y = track.py[nearestSample2D(track, raw[0].x, raw[0].z)];
    const last = raw.length - 1;
    if (!known[last]) raw[last].y = track.py[nearestSample2D(track, raw[last].x, raw[last].z)];
    known[0] = known[last] = true;
    for (let i = 1; i < last; i++) {
      if (known[i]) continue;
      let a = i - 1;
      let b = i + 1;
      while (!known[b]) b++;
      const t = (i - a) / (b - a);
      raw[i].y = raw[a].y + (raw[b].y - raw[a].y) * t;
    }
    const spline = new CatmullRom3(raw, false);
    const smp = sampleSpline(spline, 2);
    const N = smp.count;
    const src = {
      N,
      px: Float32Array.from(smp.x),
      py: Float32Array.from(smp.y),
      pz: Float32Array.from(smp.z),
      rx: new Float32Array(N),
      rz: new Float32Array(N),
      bank: new Float32Array(N),
      width: new Float32Array(N).fill(sc.width ?? 8),
      surface: surfaceId(sc.surface || 'dirt'),
      style: sc.style || sc.surface || 'dirt',
      walls: !!sc.walls,
      def: sc,
    };
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(N - 1, i + 1);
      const dx = src.px[b] - src.px[a];
      const dz = src.pz[b] - src.pz[a];
      const l = Math.hypot(dx, dz) || 1;
      src.rx[i] = -dz / l;
      src.rz[i] = dx / l;
    }
    // Progreso equivalente sobre la pista principal (interpolado entre las uniones)
    const sStart = track.s[nearestSample2D(track, src.px[0], src.pz[0])];
    const sEnd = track.s[nearestSample2D(track, src.px[N - 1], src.pz[N - 1])];
    const span = track.forwardDistance(sStart, sEnd);
    src.sMap = new Float32Array(N);
    for (let i = 0; i < N; i++) src.sMap[i] = track.wrapS(sStart + (span * i) / (N - 1));
    track.shortcuts.push(src);
  }
}

function buildRoad(track, def, world) {
  const N = track.N;
  const cw = track.curbWidth;
  const runs = contiguousRuns(N, (i) => !(track.flags[i] & FLAG.GAP), true);
  const hw = (k, i) => track.width[i] * 0.5;
  for (const run of runs) {
    // divide por superficie y estilo compartiendo la muestra frontera
    const pieces = [];
    let start = 0;
    const key = (i) => track.surface[i] * 256 + track.roadStyle[i];
    for (let k = 1; k < run.length; k++) {
      if (key(run[k]) !== key(run[start])) {
        pieces.push(run.slice(start, k + 1));
        start = k;
      }
    }
    pieces.push(run.slice(start));
    for (const piece of pieces) {
      if (piece.length < 2) continue;
      const surf = track.surface[piece[0]];
      const strip = buildStrip(track, piece, (k, i) => -hw(k, i), hw, { across: 2, vScale: 12 });
      world.addMesh(strip.positions, strip.indices, surf);
      track.geometry.runs.push({ list: piece, surface: surf, style: track.roadStyles[track.roadStyle[piece[0]]], strip });
    }
    // Bordillos
    let cur = null;
    const flush = () => {
      if (cur && cur.length >= 2) {
        for (const side of [-1, 1]) {
          const strip = buildStrip(
            track,
            cur,
            side < 0 ? (k, i) => -track.width[i] * 0.5 - cw : (k, i) => track.width[i] * 0.5,
            side < 0 ? (k, i) => -track.width[i] * 0.5 : (k, i) => track.width[i] * 0.5 + cw,
            { vScale: 4 },
          );
          world.addMesh(strip.positions, strip.indices, SURFACE.CURB);
          track.geometry.curbs.push({ list: cur, side, strip });
        }
      }
      cur = null;
    };
    for (const i of run) {
      if (track.flags[i] & FLAG.CURBS) {
        if (!cur) cur = [];
        cur.push(i);
      } else if (cur) {
        cur.push(i);
        flush();
      }
    }
    flush();
  }
  // Atajos
  for (const sc of track.shortcuts) {
    const list = Array.from({ length: sc.N }, (_, i) => i);
    const strip = buildStrip(sc, list, (k, i) => -sc.width[i] * 0.5, (k, i) => sc.width[i] * 0.5, { across: 1, vScale: 10 });
    world.addMesh(strip.positions, strip.indices, sc.surface);
    track.geometry.shortcuts.push({ src: sc, list, strip, surface: sc.surface, style: sc.style });
  }
}

function buildRamps(track, def, world) {
  for (const r of def.ramps || []) {
    const i0 = track.indexAtU(r.at);
    const n = Math.max(2, Math.round((r.length ?? 7) / track.spacing));
    const list = [];
    for (let k = 0; k <= n; k++) list.push(wrapIndex(i0 + k, track.N));
    const lat = r.lateral ?? 0;
    const hw = (r.width ?? 8) * 0.5;
    const h = r.height ?? 1.8;
    const yf = (k) => h * Math.pow(k / n, 1.35);
    const strip = buildStrip(track, list, () => lat - hw, () => lat + hw, { y: (k) => yf(k), vScale: 3, across: 1 });
    world.addMesh(strip.positions, strip.indices, SURFACE.RAMP);
    track.geometry.ramps.push({ list, lat, hw, height: h, strip, style: r.style || 'wood', yf, n });
  }
}

function buildPads(track, def, world) {
  for (const p of def.boostPads || []) {
    const i0 = track.indexAtU(p.at);
    const n = Math.max(1, Math.round((p.length ?? 5) / track.spacing));
    const list = [];
    for (let k = 0; k <= n; k++) list.push(wrapIndex(i0 + k, track.N));
    const lat = p.lateral ?? 0;
    const hw = (p.width ?? 4) * 0.5;
    const strip = buildStrip(track, list, () => lat - hw, () => lat + hw, { y: () => 0.04, vScale: (p.length ?? 5) + 0.01 });
    world.addMesh(strip.positions, strip.indices, SURFACE.BOOST);
    track.geometry.pads.push({ list, lat, hw, strip, s: track.s[i0] });
  }
}

function buildWalls(track, def, world) {
  const N = track.N;
  const cw = track.curbWidth;
  const wallH = def.wallHeight ?? 1.1;
  const pa = { x: 0, y: 0, z: 0 };
  const pb = { x: 0, y: 0, z: 0 };
  for (const side of [-1, 1]) {
    const flag = side < 0 ? FLAG.WALL_L : FLAG.WALL_R;
    const runs = contiguousRuns(N, (i) => (track.flags[i] & flag) !== 0 && !(track.flags[i] & FLAG.GAP), true);
    for (const run of runs) {
      if (run.length < 2) continue;
      // separar por estilo
      let start = 0;
      const pieces = [];
      for (let k = 1; k < run.length; k++) {
        if (track.wallStyle[run[k]] !== track.wallStyle[run[start]]) {
          pieces.push(run.slice(start, k + 1));
          start = k;
        }
      }
      pieces.push(run.slice(start));
      for (const list of pieces) {
        if (list.length < 2) continue;
        const off = (i) => track.width[i] * 0.5 + ((track.flags[i] & FLAG.CURBS) ? cw : 0) + 0.45;
        for (let k = 0; k < list.length - 1; k++) {
          const i = list[k];
          const j = list[k + 1];
          samplePoint(track, i, side * off(i), pa);
          samplePoint(track, j, side * off(j), pb);
          world.addWall(pa.x, pa.z, pb.x, pb.z, Math.min(pa.y, pb.y) - 3, Math.max(pa.y, pb.y) + wallH + 0.6, { kind: 'wall' });
        }
        track.geometry.walls.push({ side, list, height: wallH, style: track.wallStyles[track.wallStyle[list[0]]], offset: off });
      }
    }
  }
  // Muros en los atajos que lo pidan
  for (const sc of track.shortcuts) {
    if (!sc.walls) continue;
    for (const side of [-1, 1]) {
      for (let i = 0; i < sc.N - 1; i++) {
        samplePoint(sc, i, side * (sc.width[i] * 0.5 + 0.4), pa);
        samplePoint(sc, i + 1, side * (sc.width[i + 1] * 0.5 + 0.4), pb);
        world.addWall(pa.x, pa.z, pb.x, pb.z, Math.min(pa.y, pb.y) - 3, Math.max(pa.y, pb.y) + wallH + 0.6);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------
// Terreno
function buildRoadIndex(track) {
  const cell = 16;
  const inv = 1 / cell;
  const grid = new Map();
  const segs = [];
  const key = (ix, iz) => (ix + 4096) * 8192 + (iz + 4096);
  const add = (src, i, j, kind) => {
    const idx = segs.length;
    segs.push({ src, i, j, kind });
    const x0 = Math.min(src.px[i], src.px[j]);
    const x1 = Math.max(src.px[i], src.px[j]);
    const z0 = Math.min(src.pz[i], src.pz[j]);
    const z1 = Math.max(src.pz[i], src.pz[j]);
    for (let ix = Math.floor(x0 * inv); ix <= Math.floor(x1 * inv); ix++) {
      for (let iz = Math.floor(z0 * inv); iz <= Math.floor(z1 * inv); iz++) {
        const k = key(ix, iz);
        let arr = grid.get(k);
        if (!arr) grid.set(k, (arr = []));
        arr.push(idx);
      }
    }
  };
  const N = track.N;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const fi = track.flags[i];
    const fj = track.flags[j];
    let kind = 'follow';
    if ((fi | fj) & FLAG.GAP) kind = 'gap';
    else if ((fi | fj) & FLAG.NO_TERRAIN) kind = 'bridge';
    add(track, i, j, kind);
  }
  for (const sc of track.shortcuts) {
    for (let i = 0; i < sc.N - 1; i++) add(sc, i, i + 1, 'follow');
  }
  const cw = track.curbWidth;
  const res = {
    follow: { d: Infinity },
    gap: { d: Infinity },
    any: { d: Infinity },
  };
  let stamp = 0;
  const seen = new Int32Array(segs.length);
  function query(x, z, R) {
    stamp++;
    res.follow.d = Infinity;
    res.gap.d = Infinity;
    res.any.d = Infinity;
    const ix0 = Math.floor((x - R) * inv);
    const ix1 = Math.floor((x + R) * inv);
    const iz0 = Math.floor((z - R) * inv);
    const iz1 = Math.floor((z + R) * inv);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const arr = grid.get(key(ix, iz));
        if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const idx = arr[n];
          if (seen[idx] === stamp) continue;
          seen[idx] = stamp;
          const sg = segs[idx];
          const src = sg.src;
          const ax = src.px[sg.i];
          const az = src.pz[sg.i];
          const bx = src.px[sg.j] - ax;
          const bz = src.pz[sg.j] - az;
          const l2 = bx * bx + bz * bz;
          let t = l2 > 1e-9 ? ((x - ax) * bx + (z - az) * bz) / l2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = ax + bx * t;
          const cz = az + bz * t;
          const d = Math.hypot(x - cx, z - cz);
          const target = sg.kind === 'follow' ? res.follow : sg.kind === 'gap' ? res.gap : null;
          const hwv = src.width[sg.i] * 0.5 + (src.width[sg.j] - src.width[sg.i]) * 0.5 * t;
          if (d < res.any.d) {
            res.any.d = d;
            res.any.hw = hwv;
            res.any.kind = sg.kind;
          }
          if (!target || d >= target.d) continue;
          let rx = src.rx[sg.i] + (src.rx[sg.j] - src.rx[sg.i]) * t;
          let rz = src.rz[sg.i] + (src.rz[sg.j] - src.rz[sg.i]) * t;
          const rl = Math.hypot(rx, rz) || 1;
          rx /= rl;
          rz /= rl;
          const lat = (x - cx) * rx + (z - cz) * rz;
          const cy = src.py[sg.i] + (src.py[sg.j] - src.py[sg.i]) * t;
          const bank = src.bank[sg.i] + (src.bank[sg.j] - src.bank[sg.i]) * t;
          const lim = hwv + cw;
          target.d = d;
          target.lat = lat;
          target.hw = hwv;
          target.cy = cy;
          target.edgeY = cy + Math.sin(bank) * clamp(lat, -lim, lim);
          target.blend = src.blend ? src.blend[sg.i] : 16;
          target.src = src;
          target.i = sg.i;
        }
      }
    }
    return res;
  }
  return { query, segs };
}

function buildTerrain(track, def, world) {
  const tdef = def.terrain || {};
  const cw = track.curbWidth;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const extend = (src, n) => {
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, src.px[i]);
      maxX = Math.max(maxX, src.px[i]);
      minZ = Math.min(minZ, src.pz[i]);
      maxZ = Math.max(maxZ, src.pz[i]);
    }
  };
  extend(track, track.N);
  for (const sc of track.shortcuts) extend(sc, sc.N);
  track.bounds = { minX, maxX, minZ, maxZ };
  track.center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < track.N; i++) {
    minY = Math.min(minY, track.py[i]);
    maxY = Math.max(maxY, track.py[i]);
  }
  track.minY = minY;
  track.maxY = maxY;

  const index = buildRoadIndex(track);
  track.roadIndex = index;
  track.nearestRoad = (x, z, R = 60) => index.query(x, z, R);

  if (tdef.none) {
    track.heightfield = null;
    return;
  }

  const margin = tdef.margin ?? 110;
  const cell = tdef.cell ?? 3;
  const hf = new Heightfield(minX - margin, minZ - margin, maxX - minX + 2 * margin, maxZ - minZ + 2 * margin, cell);
  const seed = hashString(def.id || 'terrain') % 100000;

  // ---- Campo grueso: distancia a la pista y altura media suavizada de la carretera
  const cStep = 12;
  const cnx = Math.ceil((hf.maxX - hf.minX) / cStep) + 1;
  const cnz = Math.ceil((hf.maxZ - hf.minZ) / cStep) + 1;
  const cDist = new Float32Array(cnx * cnz);
  const cY = new Float32Array(cnx * cnz);
  const samples = [];
  for (let i = 0; i < track.N; i += 2) {
    const f = track.flags[i];
    samples.push(track.px[i], track.pz[i], track.py[i], f & (FLAG.NO_TERRAIN | FLAG.GAP) ? 0 : 1);
  }
  for (const sc of track.shortcuts) for (let i = 0; i < sc.N; i += 2) samples.push(sc.px[i], sc.pz[i], sc.py[i], 1);
  const base = tdef.base ?? 0;
  for (let j = 0; j < cnz; j++) {
    for (let i = 0; i < cnx; i++) {
      const x = hf.minX + i * cStep;
      const z = hf.minZ + j * cStep;
      let md = Infinity;
      let sw = 0;
      let swy = 0;
      for (let k = 0; k < samples.length; k += 4) {
        const dx = samples[k] - x;
        const dz = samples[k + 1] - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < md) md = d2;
        if (samples[k + 3]) {
          const w = 1 / (d2 + 900);
          sw += w;
          swy += w * samples[k + 2];
        }
      }
      cDist[j * cnx + i] = Math.sqrt(md);
      cY[j * cnx + i] = sw > 0 ? swy / sw : base;
    }
  }
  const coarse = (x, z, out) => {
    const fx = clamp((x - hf.minX) / cStep, 0, cnx - 1.001);
    const fz = clamp((z - hf.minZ) / cStep, 0, cnz - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = j * cnx + i;
    const b = a + 1;
    const c = a + cnx;
    const d = c + 1;
    out.dist = (cDist[a] * (1 - tx) + cDist[b] * tx) * (1 - tz) + (cDist[c] * (1 - tx) + cDist[d] * tx) * tz;
    out.y = (cY[a] * (1 - tx) + cY[b] * tx) * (1 - tz) + (cY[c] * (1 - tx) + cY[d] * tx) * tz;
    return out;
  };
  track.coarseField = coarse;

  const amp = tdef.amp ?? 6;
  const scale = tdef.scale ?? 0.012;
  const follow = tdef.follow ?? 0.85;
  const followNear = tdef.followNear ?? 40;
  const followFar = tdef.followFar ?? 260;
  const mountains = tdef.mountains;
  const hills = tdef.hills || [];
  const natural = (x, z, dist, smoothY) => {
    const ft = 1 - smoothstep(followNear, followFar, dist);
    let h = lerp(base, smoothY, follow * ft);
    const a = amp * (0.25 + 0.75 * smoothstep(12, 110, dist));
    h += fbm2(x * scale, z * scale, 4, seed) * a;
    if (mountains) {
      const st = mountains.start ?? 160;
      const k = smoothstep(st, st + (mountains.rise ?? 240), dist);
      if (k > 0) h += k * mountains.height * (0.5 + 0.5 * ridged2(x * 0.0055, z * 0.0055, 4, seed + 7));
    }
    for (const hl of hills) {
      const d = Math.hypot(x - hl.x, z - hl.z);
      if (d < hl.r) h += hl.h * (0.5 + 0.5 * Math.cos((d / hl.r) * Math.PI));
    }
    if (tdef.height) h = tdef.height(x, z, h, dist);
    return h;
  };
  track.naturalHeight = (x, z) => {
    const c = coarse(x, z, {});
    return natural(x, z, c.dist, c.y);
  };
  /** Altura del terreno lejano (fuera del mapa de alturas detallado). */
  track.farHeight = (x, z, rectDist) => {
    const edge = coarse(x, z, {});
    return natural(x, z, Math.max(edge.dist, rectDist + 40), lerp(edge.y, base, clamp(rectDist / 400, 0, 1)));
  };

  let maxHW = 0;
  for (let i = 0; i < track.N; i++) maxHW = Math.max(maxHW, track.width[i] * 0.5);
  let maxBlend = 0;
  for (let i = 0; i < track.N; i++) maxBlend = Math.max(maxBlend, track.blend[i]);
  const R = maxHW + cw + SHOULDER + maxBlend + 2;
  const nearD = new Float32Array(hf.vx * hf.vz).fill(1e9);
  hf.nearD = nearD;
  const rivers = tdef.rivers || [];
  const lakes = tdef.lakes || [];
  const wl = track.waterLevel ?? 0;
  const cOut = { dist: 0, y: 0 };

  for (let j = 0; j < hf.vz; j++) {
    const z = hf.minZ + j * cell;
    for (let i = 0; i < hf.vx; i++) {
      const x = hf.minX + i * cell;
      coarse(x, z, cOut);
      const nat = natural(x, z, cOut.dist, cOut.y);
      let h = nat;
      const idx = j * hf.vx + i;
      if (cOut.dist < R + 30) {
        const q = index.query(x, z, R);
        const f = q.follow;
        if (f.d < Infinity) {
          const inner = f.hw + cw + SHOULDER;
          const target = f.edgeY - TERRAIN_DROP;
          if (f.d <= inner) h = target;
          else if (f.d < inner + f.blend) h = lerp(target, nat, smoothstep(inner, inner + f.blend, f.d));
          nearD[idx] = f.d - f.hw;
        }
        if (q.any.d < Infinity) nearD[idx] = Math.min(nearD[idx], q.any.d - q.any.hw);
        const g = q.gap;
        if (g.d < Infinity && (f.d === Infinity || g.d < f.d)) {
          const zone = track.gapZones.find((zz) => {
            const span = wrapIndex(zz.i1 - zz.i0, track.N);
            return wrapIndex(g.i - zz.i0, track.N) <= span;
          });
          const depth = zone ? zone.depth : 30;
          const carveY = g.cy - depth;
          const t = smoothstep(g.hw + 12, g.hw + 34, g.d);
          h = Math.min(h, lerp(carveY, h, t));
        }
      }
      for (const rv of rivers) {
        const pts = rv.points;
        let md = Infinity;
        for (let k = 0; k < pts.length - 1; k++) {
          const ax = pts[k][0];
          const az = pts[k][1];
          const bx = pts[k + 1][0] - ax;
          const bz = pts[k + 1][1] - az;
          const l2 = bx * bx + bz * bz;
          let t = l2 > 0 ? ((x - ax) * bx + (z - az) * bz) / l2 : 0;
          t = clamp(t, 0, 1);
          md = Math.min(md, Math.hypot(x - (ax + bx * t), z - (az + bz * t)));
        }
        const hwr = rv.width / 2;
        if (md < hwr + 12) {
          const bed = wl - rv.depth * (1 - Math.min(1, (md / hwr) ** 2)) - 0.3;
          h = Math.min(h, lerp(bed, h, smoothstep(hwr - 1, hwr + 12, md)));
        }
      }
      for (const lk of lakes) {
        const d = Math.hypot(x - lk.x, z - lk.z);
        if (d < lk.r + 14) {
          const bed = wl - lk.depth * (1 - Math.min(1, (d / lk.r) ** 2)) - 0.3;
          h = Math.min(h, lerp(bed, h, smoothstep(lk.r - 2, lk.r + 14, d)));
        }
      }
      if (tdef.modify) h = tdef.modify(x, z, h, nearD[idx]);
      hf.heights[idx] = h;
    }
  }

  // Superficies
  const offroad = surfaceId(tdef.surface || 'grass');
  hf.defaultSurface = offroad;
  const shoulder = tdef.shoulderSurface ? surfaceId(tdef.shoulderSurface) : null;
  const rockSlope = tdef.rockSlope ?? 0.72;
  const lava = track.lavaLevel;
  const water = track.waterLevel;
  const H = hf.heights;
  for (let j = 0; j < hf.vz; j++) {
    for (let i = 0; i < hf.vx; i++) {
      const idx = j * hf.vx + i;
      const h = H[idx];
      let s = offroad;
      const hl = H[j * hf.vx + Math.max(0, i - 1)];
      const hr = H[j * hf.vx + Math.min(hf.vx - 1, i + 1)];
      const hd = H[Math.max(0, j - 1) * hf.vx + i];
      const hu = H[Math.min(hf.vz - 1, j + 1) * hf.vx + i];
      const dx = (hr - hl) / (2 * cell);
      const dz = (hu - hd) / (2 * cell);
      const ny = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
      if (tdef.rock !== false && ny < rockSlope) s = SURFACE.ROCK;
      if (shoulder !== null && nearD[idx] < cw + SHOULDER + 1) s = shoulder;
      if (water !== null) {
        if (h < water - 1.1) s = SURFACE.DEEP_WATER;
        else if (h < water - 0.05) s = SURFACE.SHALLOW_WATER;
        else if (tdef.beach && h < water + tdef.beach) s = SURFACE.SAND;
      }
      if (lava !== null && h < lava + 0.2) s = SURFACE.LAVA;
      if (tdef.surfaceFn) s = tdef.surfaceFn(hf.minX + i * cell, hf.minZ + j * cell, h, s, nearD[idx]);
      hf.surfaces[idx] = s;
    }
  }
  world.setHeightfield(hf);
  track.heightfield = hf;
}

// ------------------------------------------------------------------------------------------
function prepareLineConstraints(track, def) {
  track.lineConstraints = [];
  for (const c of def.aiLine || []) {
    const i0 = track.indexAtU(c.from);
    const i1 = track.indexAtU(c.to);
    track.lineConstraints.push({ i0, count: wrapIndex(i1 - i0, track.N) + 1, min: c.min ?? -99, max: c.max ?? 99 });
  }
}

function buildCheckpoints(track, def) {
  const n = def.checkpoints ?? 8;
  track.checkpoints = [];
  for (let k = 1; k < n; k++) track.checkpoints.push((k * track.length) / n);
}

function buildSpawns(track, def) {
  const start = def.gridStart ?? 10;
  track.spawnSlots = [];
  for (let k = 0; k < 12; k++) {
    const row = Math.floor(k / 2);
    const col = k % 2;
    const s = track.wrapS(-(start + row * 7 + (col ? 3.5 : 0)));
    const i = track.indexAtS(s);
    const hw = track.width[i] * 0.5;
    const lat = (col === 0 ? -1 : 1) * Math.min(3.6, hw - 2.2);
    const p = track.pointAt(s, lat);
    track.spawnSlots.push({ x: p.x, y: p.y, z: p.z, yaw: track.headingAt(s), s, lateral: lat, index: i });
  }
}

function buildItemBoxes(track, def) {
  track.itemBoxSpots = [];
  for (const row of def.itemBoxes || []) {
    const s0 = track.sAtU(row.at);
    const i = track.indexAtS(s0);
    const count = row.count ?? 4;
    const hw = track.width[i] * 0.5 * (row.spread ?? 0.72);
    const off = row.lateral ?? 0;
    for (let c = 0; c < count; c++) {
      const lat = count === 1 ? off : lerp(-hw, hw, c / (count - 1)) + off;
      const p = track.pointAt(s0, lat);
      track.itemBoxSpots.push({ x: p.x, y: p.y + 1.15, z: p.z, s: s0, lateral: lat });
    }
  }
}

// ------------------------------------------------------------------------------------------
// Decoración y colisionadores estáticos
function placeProps(track, def, world, rng) {
  const hf = track.heightfield;
  const cw = track.curbWidth;
  const groundY = (x, z) => {
    if (hf) {
      const h = hf.heightAt(x, z);
      if (h === h) return h;
    }
    const g = world.groundAt(x, z, 1e6, {});
    return g.hit ? g.y : 0;
  };
  const edgeDistance = (x, z, R = 120) => {
    const q = track.nearestRoad(x, z, R);
    return q.any.d < Infinity ? q.any.d - q.any.hw - cw : 1e9;
  };
  track.props = [];
  track.geometry.extra = [];
  const hazardsExtra = [];

  const api = {
    rng,
    track,
    SURFACE,
    groundY,
    edgeDistance,
    sAtU: (u) => track.sAtU(u),
    pointAt: (u, lateral = 0) => track.pointAt(track.sAtU(u), lateral),
    headingAt: (u) => track.headingAt(track.sAtU(u)),
    halfWidthAt: (u) => track.width[track.indexAtU(u)] * 0.5,
    place(type, x, z, opts = {}) {
      const pt = PROP_TYPES[type] || { radius: 0, height: 2 };
      const scale = opts.scale ?? 1;
      const y = opts.y ?? groundY(x, z) + (opts.yOffset ?? 0);
      const rot = opts.rot ?? rng.range(0, TAU);
      const prop = { type, x, y, z, rot, scale, color: opts.color, variant: opts.variant ?? rng.int(0, 3), tilt: opts.tilt || 0 };
      track.props.push(prop);
      const r = (opts.radius ?? pt.radius) * scale;
      if (r > 0 && opts.collide !== false) {
        const ed = opts.edgeKnown ?? edgeDistance(x, z);
        if (ed < 75) world.addCircle(x, z, r, y - 2, y + pt.height * scale, { kind: type });
      }
      return prop;
    },
    placeAt(type, u, lateral, opts = {}) {
      const p = track.pointAt(track.sAtU(u), lateral);
      return api.place(type, p.x, p.z, { ...opts, y: opts.onRoad ? p.y + (opts.yOffset ?? 0) : opts.y });
    },
    scatter(type, count, opts = {}) {
      const min = opts.min ?? 6;
      const max = opts.max ?? 90;
      const b = track.bounds;
      const m = opts.margin ?? 90;
      const reg = opts.region;
      let placed = 0;
      let tries = 0;
      const maxTries = count * (opts.tries ?? 8);
      const minSpacing2 = (opts.spacing ?? 0) ** 2;
      const mine = [];
      while (placed < count && tries < maxTries) {
        tries++;
        let x;
        let z;
        if (reg) {
          const a = rng.range(0, TAU);
          const r = Math.sqrt(rng.next()) * reg.r;
          x = reg.x + Math.cos(a) * r;
          z = reg.z + Math.sin(a) * r;
        } else {
          x = rng.range(b.minX - m, b.maxX + m);
          z = rng.range(b.minZ - m, b.maxZ + m);
        }
        const ed = edgeDistance(x, z, max + 40);
        if (ed < min || ed > max) continue;
        const y = groundY(x, z);
        if (track.waterLevel !== null && y < track.waterLevel + (opts.water ? -3 : 0.3)) continue;
        if (opts.water && y > track.waterLevel - 0.3) continue;
        if (track.lavaLevel !== null && y < track.lavaLevel + 1) continue;
        if (hf && !hf.contains(x, z)) continue;
        if (opts.filter && !opts.filter(x, z, y, ed)) continue;
        if (minSpacing2 > 0 && mine.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < minSpacing2)) continue;
        const sc = opts.scale ? rng.range(opts.scale[0], opts.scale[1]) : 1;
        mine.push(api.place(type, x, z, { scale: sc, color: opts.color, edgeKnown: ed, collide: opts.collide }));
        placed++;
      }
      return placed;
    },
    line(type, opts = {}) {
      const from = opts.from !== undefined ? track.sAtU(opts.from) : 0;
      const span = opts.to !== undefined ? track.forwardDistance(from, track.sAtU(opts.to)) : track.length;
      const every = opts.every ?? 25;
      const sides = opts.side === 'left' ? [-1] : opts.side === 'right' ? [1] : [-1, 1];
      for (let d = opts.startOffset ?? 0; d < span; d += every) {
        const s = track.wrapS(from + d);
        const i = track.indexAtS(s);
        if (track.flags[i] & FLAG.GAP && !opts.onGap) continue;
        if (opts.skipRamps !== false && track.flags[i] & FLAG.RAMP) continue;
        for (const side of sides) {
          const extra = (track.flags[i] & FLAG.CURBS ? cw : 0) + (opts.offset ?? 3);
          const lat = side * (track.width[i] * 0.5 + extra) + (opts.jitter ? rng.range(-opts.jitter, opts.jitter) : 0);
          const p = track.pointAt(s, lat);
          const onDeck = (track.flags[i] & FLAG.NO_TERRAIN) || opts.onRoad;
          const y = onDeck ? p.y : groundY(p.x, p.z);
          const heading = track.headingAt(s);
          const rot = opts.rot === 'random' ? rng.range(0, TAU) : heading + (opts.faceRoad ? (side < 0 ? -Math.PI / 2 : Math.PI / 2) : 0) + (opts.rotOffset ?? 0);
          api.place(type, p.x, p.z, {
            y: y + (opts.yOffset ?? 0),
            rot,
            scale: opts.scale ? rng.range(opts.scale[0], opts.scale[1]) : 1,
            color: opts.color,
            collide: opts.collide,
            variant: opts.variant,
          });
        }
      }
    },
    /** Muro de colisión con representación visual opcional. points: [[x, z], ...] */
    wall(points, height, opts = {}) {
      const pts = points.map(([x, z, y]) => [x, z, y ?? groundY(x, z)]);
      world.addWallPolyline(pts, height, { closed: opts.closed, kind: opts.kind || 'wall' });
      if (opts.visual !== false) track.geometry.extra.push({ type: 'wall', points: pts, height, style: opts.style || 'stone', closed: !!opts.closed, thickness: opts.thickness ?? 1 });
    },
    /** Caja sólida (edificio, bloque). */
    box(x, z, w, d, h, opts = {}) {
      const y = opts.y ?? groundY(x, z);
      const rot = opts.rot ?? 0;
      world.addBox(x, z, w / 2, d / 2, rot, y - 3, y + h, { kind: opts.kind || 'box' });
      if (opts.visual !== false) track.geometry.extra.push({ type: 'box', x, y, z, w, d, h, rot, style: opts.style || 'stone', color: opts.color });
    },
    /** Solo colisionador cilíndrico. */
    circle(x, z, r, h = 5, opts = {}) {
      const y = opts.y ?? groundY(x, z);
      world.addCircle(x, z, r, y - 2, y + h, { kind: opts.kind || 'post' });
    },
    light(x, y, z, color = '#ffcc88', intensity = 1, distance = 30) {
      track.pointLights.push({ x, y, z, color, intensity, distance });
    },
    hazard(params) {
      hazardsExtra.push(params);
    },
    marker(name, data) {
      if (!track.markers) track.markers = {};
      track.markers[name] = data;
    },
  };
  track.propApi = api;

  for (const sc of def.scatter || []) api.scatter(sc.type, sc.count, sc);
  for (const ln of def.lineProps || []) api.line(ln.type, ln);
  if (typeof def.props === 'function') def.props(api);
  track.extraHazards = hazardsExtra;
}

function buildHazards(track, def, world) {
  track.hazards = [];
  for (const h of [...(def.hazards || []), ...(track.extraHazards || [])]) {
    track.hazards.push(createHazard(track, h, world));
  }
}

export { FLAG };
