// Circuito 3 — Ruinas del Desierto: avenida de columnas milenarias, subida a la cresta de una
// duna, un cañón estrecho entre paredes de roca, un gran salto sobre la garganta de un río, un oasis con una
// pasarela de madera sin barandillas (atajo arriesgado) y un túnel que atraviesa un templo.
// Rodadoras y una roca que rueda por las dunas complican la carrera.
import { smoothstep, clamp } from '../core/MathUtils.js';

// Eje del cañón: el terreno se levanta en forma de acantilados a su alrededor.
const CANYON = [[190, 140], [200, 110], [188, 78], [205, 44], [197, 8]];

function polyDistance(x, z, pts) {
  let best = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k];
    const bx = pts[k + 1][0] - ax;
    const bz = pts[k + 1][1] - az;
    const l2 = bx * bx + bz * bz;
    const t = clamp(((x - ax) * bx + (z - az) * bz) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - (ax + bx * t), z - (az + bz * t)));
  }
  return best;
}

export default {
  seed: 3303,
  width: 16,
  walls: false,
  curbs: true,
  roadStyle: 'stone',
  wallStyle: 'stone',
  autoBank: 90,
  points: [
    [0, 2, 15], // 0 meta
    [0, 2, 65],
    [0, 2, 110],
    [12, 4, 148],
    [48, 8, 176],
    [100, 12, 188], // 5 cresta de la duna
    [150, 10, 178],
    [186, 7, 150], // entrada del cañón
    [200, 5.5, 112],
    [188, 5, 78],
    [205, 4.5, 44], // 10
    [196, 4, 10],
    [201, 4, -24], // recta de la rampa
    [203, 3.5, -52],
    [204, 2, -90], // aterrizaje
    [198, 1.5, -130], // 15 curva del oasis
    [174, 1, -166],
    [130, 1, -186],
    [84, 1, -176],
    [60, 1.2, -148],
    [30, 1.5, -138], // 20 templo
    [-10, 1.5, -138],
    [-36, 1.8, -122],
    [-38, 2, -88],
    [-18, 2, -58],
    [0, 2, -30], // 25
  ],
  sections: [
    { from: 7.25, to: 11.9, width: 14, walls: true, wallStyle: 'rock', curbs: false },
    { from: 11.9, to: 12.85, walls: true, wallStyle: 'stone' },
    { from: 20.1, to: 21.0, tunnel: true, walls: true, wallStyle: 'stone', curbs: false },
    { from: 0.2, to: 2.3, roadStyle: 'stone' },
  ],
  ramps: [
    { at: 12.48, length: 7, height: 1.9, width: 10, style: 'stone' },
    { at: 2.55, lateral: 5, length: 5, height: 1.1, width: 5, style: 'wood' },
  ],
  gaps: [{ from: 12.77, to: 13.12, depth: 24, fill: 'water', respawnAfter: 10 }],
  boostPads: [
    { at: 12.2, lateral: 0, width: 7, length: 4 },
    { at: 6.35, lateral: 3, width: 4.5, length: 5 },
    { at: 24.4, lateral: -2, width: 4.5, length: 5 },
  ],
  itemBoxes: [{ at: 1.2 }, { at: 5.25, count: 5 }, { at: 11.25 }, { at: 15.2 }, { at: 18.3 }, { at: 23.1 }],
  shortcuts: [
    {
      // pasarela de madera sobre el oasis: estrecha y sin barandillas
      points: [[189, null, -121], [160, null, -126], [128, null, -130], [97, null, -134], [69, null, -141]],
      width: 6,
      surface: 'wood',
      style: 'planks',
    },
  ],
  terrain: {
    base: 2.5,
    amp: 8,
    scale: 0.009,
    follow: 0.85,
    blend: 26,
    surface: 'sand',
    beach: 0.7,
    rockSlope: 0.66,
    mountains: { start: 190, rise: 260, height: 60 },
    // dunas onduladas lejos de la pista, sin bajar al nivel del agua
    height: (x, z, h, dist) => Math.max(0.9, h + 3.4 * Math.sin(x * 0.045 + Math.sin(z * 0.021) * 2.3) * smoothstep(25, 90, dist)),
    lakes: [{ x: 128, z: -128, r: 27, depth: 6 }],
    // río que ha excavado la garganta bajo el gran salto
    rivers: [{ points: [[110, -74], [160, -64], [203, -58], [250, -52], [340, -62]], width: 16, depth: 4 }],
    // acantilados del cañón
    modify: (x, z, h, nearD) => {
      const k = 1 - smoothstep(22, 42, polyDistance(x, z, CANYON));
      if (k <= 0) return h;
      const ridge = 0.8 + 0.2 * Math.sin(x * 0.21) * Math.cos(z * 0.17);
      return h + 24 * k * ridge * smoothstep(1.2, 7, nearD);
    },
  },
  theme: {
    sky: { top: '#3a8ad4', horizon: '#f6dcae', bottom: '#f3e2bf', sunColor: '#fff1c9', clouds: 0.12, stars: 0 },
    sun: { dir: [0.5, 0.72, -0.4], color: '#ffe8c0', intensity: 3.1 },
    hemi: { sky: '#bcd9f5', ground: '#c9a86a', intensity: 1.05 },
    fog: { color: '#f0dcb4', near: 240, far: 1250 },
    exposure: 1.0,
    bloom: { strength: 0.22, threshold: 0.92, radius: 0.4 },
    water: { level: 0, color: '#27b3bf', deep: '#0b5d6b' },
    ground: { sand: '#e0bf7d', rock: '#b9855a', dirt: '#b08a5a', detail: 'sand', bed: '#c8a867', outer: 'SAND' },
    road: { color: '#8f7d68', line: '#fff3d6', stone: '#b59a74' },
    curb: ['#d84315', '#fff3e0'],
    stoneColor: '#c9a877',
    rockColor: '#b47c52',
    skirt: '#9c7a52',
    bridge: '#8d6e4f',
    tunnel: 'stone',
    tunnelLight: '#ffcc80',
    gateColor: '#d7b98a',
    bannerColor: '#e65100',
    horizon: { color: '#c28e5c', repeat: 4 },
    ambient: 'dust',
    killY: -40,
  },
  checkpoints: 8,
  props(api) {
    const { rng, track } = api;
    // Avenida de columnas
    api.line('pillar', { from: 0.25, to: 2.3, every: 17, offset: 4, collide: true, rot: 'random' });
    api.line('brokenPillar', { from: 0.4, to: 2.2, every: 17, offset: 11, collide: true, rot: 'random', startOffset: 8 });
    for (const side of [-1, 1]) {
      api.placeAt('obelisk', 0.05, side * 15, { rot: 0 });
      api.placeAt('statue', 20.05, side * 17, { scale: 2.2, rot: api.headingAt(20.05) + Math.PI });
    }
    // Desierto
    api.scatter('cactus', 70, { min: 8, max: 95, scale: [0.8, 1.5] });
    api.scatter('rock', 45, { min: 6, max: 90, scale: [0.7, 1.6] });
    api.scatter('boulder', 12, { min: 14, max: 90, scale: [0.8, 1.4] });
    api.scatter('brokenPillar', 16, { min: 6, max: 45 });
    api.scatter('bush', 40, { min: 5, max: 70, scale: [0.6, 1.0] });
    // Oasis
    api.scatter('palm', 26, { region: { x: 128, z: -128, r: 50 }, min: 4, max: 60, scale: [0.9, 1.3] });
    api.scatter('fern', 30, { region: { x: 128, z: -128, r: 42 }, min: 3, max: 60 });
    api.scatter('grass', 90, { region: { x: 128, z: -128, r: 40 }, min: 2, max: 60 });
    // Campamento de excavación junto a la avenida
    for (const [x, z] of [[-22, 60], [-26, 66], [-19, 70], [-30, 58]]) api.place('crate', x, z, { rot: rng.range(0, 6) });
    for (const [x, z] of [[-24, 52], [-32, 70]]) api.place('barrel', x, z);
    api.place('umbrella', -28, 63, { collide: false, color: '#ff7043' });
    api.place('torch', -20, 50);
    // Antorchas en la entrada y salida del templo
    for (const u of [20.08, 21.02]) for (const side of [-1, 1]) api.placeAt('torch', u, side * 10.5, { rot: 0 });
    // Rodadoras que cruzan la pista empujadas por el viento y una roca en el cañón
    const across = (u, half, extra = {}) => {
      const a = api.pointAt(u, -half);
      const b = api.pointAt(u, half);
      api.hazard({ type: 'mover', path: [[a.x, a.z], [b.x, b.z]], ...extra });
    };
    across(4.55, 11, { model: 'tumbleweed', radius: 1.1, speed: 6, phase: 0.1, hit: 'spin', height: 2.2 });
    across(18.55, 12, { model: 'tumbleweed', radius: 1.2, speed: 5, phase: 0.55, hit: 'spin', height: 2.4 });
    across(22.6, 11, { model: 'tumbleweed', radius: 1.0, speed: 6.5, phase: 0.3, hit: 'spin', height: 2 });
    across(16.35, 9, { model: 'boulder', radius: 1.9, speed: 3.6, phase: 0.2, hit: 'tumble', height: 3.8, color: '#a0785a' });
    // Marcadores para los monumentos
    const posts = [];
    const sc = track.shortcuts[0];
    for (let i = 2; i < sc.N - 2; i += 3) {
      for (const side of [-1, 1]) {
        const x = sc.px[i] + sc.rx[i] * side * (sc.width[i] * 0.5 - 0.2);
        const z = sc.pz[i] + sc.rz[i] * side * (sc.width[i] * 0.5 - 0.2);
        const g = api.groundY(x, z);
        if (sc.py[i] - g > 0.6) posts.push({ x, z, y: g - 0.5, h: sc.py[i] - g + 0.5 });
      }
    }
    api.marker('posts', posts);
  },
  landmarks(kit) {
    const tr = kit.track;
    kit.passage(20.1, 21.0, { style: 'sand', color: '#d4b27a', accent: '#c49a5c', glow: '#40c4ff', height: 13, thickness: 6 });
    const a = tr.pointAt(tr.sAtU(1.5), 0);
    kit.arch(a.x, a.z, tr.headingAt(tr.sAtU(1.5)), 22, 11, 'sand', { thickness: 3.2, y: a.y - 0.3, color: '#d9bd8a' });
    kit.pyramid(-170, 150, 120, 78, { color: '#dcbc80' });
    kit.pyramid(-235, -40, 90, 58, { color: '#d6b274', rot: 0.4 });
    kit.pyramid(330, 250, 100, 66, { color: '#dcbc80', rot: 0.2 });
    for (const [x, z, h, r] of [[300, -120, 34, 16], [270, 60, 24, 10], [-110, 250, 30, 14], [80, 320, 38, 20], [-120, -230, 26, 12], [150, -300, 34, 18]]) {
      kit.rockFormation(x, z, { height: h, radius: r, layers: 4, taper: 0.2 });
    }
    // Pilotes de la pasarela del oasis
    const posts = (kit.markers.posts || []).map((p) => ({ x: p.x, y: p.y, z: p.z, w: 0.45, h: p.h, d: 0.45 }));
    kit.mergedBoxes(posts, 'wood', '#6d4c33', { uvScale: 2 });
    kit.overheadSign(11.6, '¡SALTA!', '#ffb300', 9);
  },
};
