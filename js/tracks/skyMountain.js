// Circuito 4 — Montaña Celeste: una montaña nevada que emerge de un mar de nubes. Se sube por
// tres rampas enlazadas con curvas de herradura, se cruza la cumbre por una galería excavada en
// la roca, se recorre una cresta afilada con un salto entre dos picos y se baja a toda
// velocidad junto al precipicio, con una placa de hielo y bolas de nieve rodando por la ladera.
import { smoothstep, clamp } from '../core/MathUtils.js';

// Tramo de cresta (sin muros): el terreno cae a ambos lados.
const RIDGE = [[-88, 325], [-60, 346], [-20, 352], [30, 352], [70, 340]];
// Bajada por la cara este: precipicio por fuera de la curva.
const DESCENT = [[105, 310], [128, 270], [140, 225], [150, 180], [155, 135], [150, 90]];

function polyInfo(x, z, pts) {
  let best = Infinity;
  let bi = 0;
  let bt = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k];
    const bx = pts[k + 1][0] - ax;
    const bz = pts[k + 1][1] - az;
    const t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1);
    const d = Math.hypot(x - (ax + bx * t), z - (az + bz * t));
    if (d < best) {
      best = d;
      bi = k;
      bt = t;
    }
  }
  return { d: best, k: bi, t: bt };
}

export default {
  seed: 4404,
  width: 16,
  walls: true,
  curbs: true,
  wallStyle: 'snow',
  roadStyle: 'asphalt',
  autoBank: 110,
  maxBank: 13,
  points: [
    [0, 0, 10], // 0 meta
    [0, 1, 55],
    [-8, 3, 92],
    [-40, 5, 112], // subida A
    [-90, 9, 118],
    [-135, 13, 116], // 5
    [-166, 15, 122, { w: 19 }], // herradura oeste
    [-175, 16.5, 141, { w: 20 }],
    [-166, 18, 160, { w: 19 }],
    [-130, 20, 168], // subida B
    [-80, 24, 172], // 10
    [-30, 27.5, 170],
    [15, 30, 166],
    [51, 31.5, 172, { w: 19 }], // herradura este
    [60, 33, 191, { w: 20 }],
    [51, 34.5, 210, { w: 19 }], // 15
    [15, 37, 218], // subida C
    [-30, 40, 222],
    [-70, 43, 230],
    [-92, 45, 255],
    [-96, 46, 290], // 20 galería de la cumbre
    [-88, 46, 325],
    [-60, 45.5, 346], // cresta
    [-20, 45, 352],
    [30, 43, 352],
    [70, 40, 340], // 25
    [105, 36, 310], // bajada junto al precipicio
    [128, 31, 270],
    [140, 26, 225],
    [150, 21, 180],
    [155, 16, 135], // 30
    [150, 11, 90],
    [135, 7, 48],
    [112, 4, 12],
    [80, 2, -22],
    [50, 1, -54], // 35
    [20, 0.3, -72],
    [1, 0, -50],
  ],
  sections: [
    { from: 19.35, to: 20.9, tunnel: true, wallStyle: 'rock', curbs: false },
    { from: 21.55, to: 25.35, walls: false },
    { from: 23.5, to: 24.25, walls: true },
    { from: 25.35, to: 31.5, wallR: false },
    { from: 28.25, to: 29.8, surface: 'ice', roadStyle: 'ice', curbs: false, wallR: true },
  ],
  ramps: [
    { at: 23.08, length: 7, height: 1.9, width: 10, style: 'metal' },
    { at: 30.35, lateral: -4.5, length: 5, height: 1.1, width: 5, style: 'wood' },
  ],
  gaps: [{ from: 23.26, to: 23.43, depth: 40, fill: 'abyss', respawnAfter: 10 }],
  boostPads: [
    { at: 16.4, lateral: 3, width: 4.5, length: 5 },
    { at: 22.75, lateral: 0, width: 7, length: 4 },
    { at: 31.6, lateral: -3, width: 4.5, length: 5 },
    { at: 35.4, lateral: 0, width: 5, length: 5 },
  ],
  itemBoxes: [{ at: 1.3 }, { at: 4.4 }, { at: 10.3, count: 5 }, { at: 17.0 }, { at: 22.3 }, { at: 27.2 }, { at: 33.2, count: 5 }],
  terrain: {
    base: -48,
    amp: 6,
    scale: 0.012,
    follow: 1,
    followNear: 22,
    followFar: 150,
    blend: 16,
    surface: 'snow',
    rockSlope: 0.6,
    margin: 140,
    mountains: { start: 260, rise: 320, height: 170 },
    hills: [
      { x: -96, z: 292, r: 75, h: 30 },
      { x: -70, z: 190, r: 110, h: 12 },
    ],
    modify: (x, z, h, nearD) => {
      // cresta afilada y precipicio exterior en la bajada
      const r = polyInfo(x, z, RIDGE);
      if (r.d < 70) h -= 34 * (1 - smoothstep(40, 70, r.d)) * smoothstep(3, 14, nearD);
      const d = polyInfo(x, z, DESCENT);
      if (d.d < 80) {
        const [ax, az] = DESCENT[d.k];
        const [bx, bz] = DESCENT[d.k + 1];
        // lado exterior (este) del tramo: producto vectorial con la dirección de bajada
        const side = (bx - ax) * (z - az) - (bz - az) * (x - ax);
        if (side > 0) h -= 30 * (1 - smoothstep(45, 80, d.d)) * smoothstep(4, 16, nearD);
      }
      return h;
    },
  },
  theme: {
    sky: { top: '#2a6fd6', horizon: '#d8ecff', bottom: '#eef6ff', sunColor: '#ffffff', clouds: 0.35, stars: 0 },
    sun: { dir: [0.4, 0.7, 0.5], color: '#fff6ea', intensity: 3.0 },
    hemi: { sky: '#d6ebff', ground: '#b8c8d8', intensity: 1.2 },
    fog: { color: '#e3f0fc', near: 220, far: 1400 },
    exposure: 0.98,
    bloom: { strength: 0.32, threshold: 0.86, radius: 0.45 },
    ground: { snow: '#f2f7fc', rock: '#7f7b87', dirt: '#8d8a92', detail: 'snow', outer: 'SNOW' },
    snowLine: -20,
    road: { color: '#5d646e', line: '#ffffff', ice: '#bfe3f5' },
    curb: ['#1e88e5', '#ffffff'],
    rockColor: '#7f7b87',
    stoneColor: '#8a8794',
    skirt: '#8d8a92',
    tunnel: 'rock',
    tunnelLight: '#e3f2ff',
    gateColor: '#eceff1',
    bannerColor: '#1565c0',
    void: { type: 'clouds', y: -30, color: '#ffffff', sea: '#dfeaf6' },
    horizon: { color: '#8aa6c8', snow: true, repeat: 3 },
    ambient: 'snow',
    killY: -38,
  },
  checkpoints: 9,
  props(api) {
    api.scatter('snowPine', 190, { min: 6, max: 110, scale: [0.8, 1.5] });
    api.scatter('iceRock', 40, { min: 5, max: 90, scale: [0.7, 1.5] });
    api.scatter('rock', 30, { min: 8, max: 90, scale: [0.8, 1.6] });
    api.line('flag', { from: 36.5, to: 1.8, every: 14, offset: 3, collide: false });
    api.line('banner', { from: 5.8, to: 8.4, every: 10, offset: 4.5, collide: false });
    api.line('banner', { from: 12.8, to: 15.4, every: 10, offset: 4.5, collide: false });
    // Balizas en el borde del precipicio
    api.line('cone', { from: 25.4, to: 31.4, every: 18, offset: 1.5, side: 'right', collide: false });
    // Bolas de nieve que ruedan ladera abajo cruzando la pista
    const across = (u, half, extra = {}) => {
      const a = api.pointAt(u, -half);
      const b = api.pointAt(u, half);
      api.hazard({ type: 'mover', model: 'boulder', color: '#f7fbff', path: [[a.x, a.z], [b.x, b.z]], hit: 'spin', soft: true, ...extra });
    };
    across(4.6, 9, { radius: 1.5, speed: 5, phase: 0.2, height: 3 });
    across(10.6, 9, { radius: 1.7, speed: 4.5, phase: 0.65, height: 3.3 });
    across(17.4, 9, { radius: 1.4, speed: 5.5, phase: 0.4, height: 2.8 });
    // Cabaña y remontes junto a la salida
    const hut = api.pointAt(0.5, 26);
    api.box(hut.x, hut.z, 10, 8, 6, { rot: api.headingAt(0.5), style: 'wood' });
    const hut2 = api.pointAt(36.8, -24);
    api.box(hut2.x, hut2.z, 8, 8, 5, { rot: api.headingAt(36.8) + 0.4, style: 'wood' });
    for (const [u, lat] of [[0.2, -12], [0.8, -12], [36.2, 12]]) api.placeAt('lamp', u, lat);
  },
  landmarks(kit) {
    kit.passage(19.35, 20.9, { style: 'rock', height: 13, thickness: 7, torches: true, torchColor: '#cfe8ff' });
    // Remonte: pilonas y cable entre la base y la cumbre
    const base = { x: -30, z: -40 };
    const top = { x: -110, z: 250 };
    const pylons = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const x = base.x + (top.x - base.x) * t;
      const z = base.z + (top.z - base.z) * t;
      const y = kit.ground(x, z);
      pylons.push({ x, y: y - 1, z, w: 1.2, h: 16, d: 1.2 });
      pylons.push({ x, y: y + 15, z, w: 6, h: 0.8, d: 0.8, rot: 0.27 });
    }
    kit.mergedBoxes(pylons, 'castle', '#5d6470', { uvScale: 2 });
    kit.overheadSign(22.5, '¡SALTO!', '#29b6f6', 9);
    kit.overheadSign(28.1, '¡HIELO!', '#80deea', 9);
    for (const [x, z, h] of [[-260, 150, 70], [260, 330, 60], [-180, 420, 85], [300, -80, 55], [-240, -160, 65]]) {
      kit.rockFormation(x, z, { height: h, radius: h * 0.35, layers: 5, taper: 0.55, color: '#8a8794', y: -60 });
    }
  },
};
