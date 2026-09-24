// Circuito 6 — Castillo de Lava: se sale del patio de una fortaleza por la puerta fortificada,
// se cruza el foso de lava por un puente sin barandillas, se rodea un volcán humeante, se
// atraviesa un lago de lava por una larga pasarela con barras de fuego giratorias, se salta un
// río de lava y se vuelve al castillo por el gran salón, vigilado por apisonadoras de piedra.
import { smoothstep } from '../core/MathUtils.js';

const VOLCANO = { x: 240, z: 70 };

export default {
  seed: 6606,
  width: 16,
  walls: true,
  curbs: true,
  wallStyle: 'lava',
  roadStyle: 'stone',
  autoBank: 90,
  points: [
    [20, 2, 0], // 0 meta (patio del castillo)
    [60, 2, 0], // puerta fortificada
    [95, 2, 0], // puente sobre el foso
    [140, 2.5, -10],
    [178, 3, -42],
    [222, 3.5, -52], // 5 campo de lava
    [264, 4, -30],
    [294, 5, 10], // rodeo del volcán
    [310, 6, 60],
    [295, 6.5, 110],
    [255, 6, 140], // 10
    [200, 5, 152, { w: 20 }], // pasarela del lago de lava
    [150, 4, 155, { w: 20 }],
    [100, 3.5, 152, { w: 18 }],
    [70, 3, 150], // rampa sobre el río de lava
    [30, 2.5, 152], // 15
    [-12, 3, 172],
    [-58, 3.5, 182],
    [-98, 3, 162],
    [-108, 2.5, 125],
    [-82, 2, 96], // 20
    [-62, 2, 62], // gran salón
    [-60, 2, 30],
    [-45, 2, 8],
    [-15, 2, 0],
  ],
  sections: [
    { from: 0.45, to: 1.35, tunnel: true, curbs: false, wallStyle: 'stone' },
    { from: 1.7, to: 2.45, bridge: true, walls: false, curbs: false },
    { from: 10.75, to: 13.3, bridge: true, walls: false, curbs: false },
    { from: 20.55, to: 21.8, curbs: false, wallStyle: 'stone' },
    { from: 22.2, to: 0.45, wallStyle: 'stone' },
  ],
  ramps: [{ at: 14.02, length: 7, height: 1.9, width: 10, style: 'stone' }],
  gaps: [{ from: 14.24, to: 14.5, depth: 14, fill: 'lava', respawnAfter: 10 }],
  boostPads: [
    { at: 13.8, lateral: 0, width: 7, length: 4 },
    { at: 3.4, lateral: -3, width: 4.5, length: 5 },
    { at: 8.3, lateral: 3, width: 4.5, length: 5 },
    { at: 17.2, lateral: 0, width: 5, length: 5 },
  ],
  itemBoxes: [{ at: 0.3 }, { at: 3.6 }, { at: 7.8, count: 5 }, { at: 10.3 }, { at: 15.4 }, { at: 18.5 }, { at: 22.6 }],
  hazards: [
    // barras de fuego en la pasarela
    { type: 'firebar', at: 11.55, lateral: 0, length: 7.5, balls: 6, speed: 1.2 },
    { type: 'firebar', at: 12.45, lateral: 0, length: 7.5, balls: 6, speed: -1.35, phase: 0.5 },
    // apisonadoras del gran salón
    { type: 'crusher', at: 20.9, lateral: -3.6, size: 5, height: 6.5, period: 3.6, phase: 0 },
    { type: 'crusher', at: 21.2, lateral: 3.6, size: 5, height: 6.5, period: 3.6, phase: 0.5 },
    { type: 'crusher', at: 21.5, lateral: -3.6, size: 5, height: 6.5, period: 3.6, phase: 0.25 },
  ],
  terrain: {
    base: 3,
    amp: 4,
    scale: 0.014,
    follow: 0.85,
    blend: 20,
    surface: 'dirt',
    rockSlope: 0.72,
    mountains: { start: 200, rise: 260, height: 95 },
    // volcán con cráter
    height: (x, z, h) => {
      const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
      return h + 46 * (1 - smoothstep(0, 58, d)) - 22 * (1 - smoothstep(0, 13, d));
    },
    lakes: [
      { x: 150, z: 160, r: 50, depth: 8 },
      { x: -58, z: 140, r: 22, depth: 6 },
    ],
    rivers: [
      // foso del castillo
      { points: [[100, -130], [99, -40], [101, 40], [96, 110]], width: 24, depth: 7 },
      // río de lava bajo el salto
      { points: [[54, 70], [55, 150], [50, 260]], width: 18, depth: 7 },
    ],
  },
  theme: {
    night: true,
    sky: { top: '#140404', horizon: '#6b1d0e', bottom: '#2a0a05', sunColor: '#ff7043', clouds: 0.55, stars: 0.15 },
    sun: { dir: [0.3, 0.55, -0.5], color: '#ff9e70', intensity: 1.3 },
    hemi: { sky: '#8a3a22', ground: '#1b0f0c', intensity: 0.75 },
    ambientColor: '#ff8a65',
    ambientIntensity: 0.16,
    envIntensity: 0.45,
    fog: { color: '#3a0f08', near: 130, far: 850 },
    exposure: 1.12,
    bloom: { strength: 0.7, threshold: 0.7, radius: 0.55 },
    lava: { level: -1.2 },
    ground: { rock: '#3d302c', dirt: '#4a3b35', detail: 'rock', outer: 'ROCK', bed: '#2a1d18' },
    road: { color: '#4a4442', line: '#ff7043', stone: '#6b605a' },
    curb: ['#ff5722', '#212121'],
    stoneColor: '#5b5350',
    rockColor: '#3d3230',
    skirt: '#3a302c',
    bridge: '#4e4440',
    tunnel: 'stone',
    tunnelLight: '#ffab40',
    gateColor: '#4e4440',
    bannerColor: '#b71c1c',
    horizon: { color: '#4a1f18', repeat: 4 },
    ambient: 'ember',
    killY: -30,
  },
  checkpoints: 8,
  props(api) {
    const { track } = api;
    api.scatter('lavaRock', 70, { min: 5, max: 100, scale: [0.7, 1.6] });
    api.scatter('skullRock', 14, { min: 10, max: 80, scale: [0.9, 1.4] });
    api.scatter('rock', 40, { min: 6, max: 90, scale: [0.8, 1.8] });
    api.scatter('crystal', 18, { min: 8, max: 60, color: '#ff6d00', collide: false });
    // Antorchas en el patio, el salón y la puerta
    api.line('torch', { from: 22.3, to: 0.4, every: 14, offset: 1.4, collide: false });
    api.line('torch', { from: 20.55, to: 21.8, every: 12, offset: 0.6, collide: false });
    for (const pr of track.props) if (pr.type === 'torch') api.light(pr.x, pr.y + 3.4, pr.z, '#ff9e40', 0.9, 16);
    // Estandartes del castillo
    api.line('banner', { from: 15.2, to: 20.2, every: 18, offset: 3, collide: false, color: '#b71c1c' });
    // Muralla exterior (colisión y visual en landmarks)
    const wall = [[-120, -35], [45, -35], [45, -12], [45, 12], [45, 40], [45, 100], [-20, 100], [-35, 100], [-80, 100], [-120, 100], [-120, 30], [-120, -35]];
    api.marker('castleWall', wall.map(([x, z]) => ({ x, z, y: api.groundY(x, z) })));
    api.marker('lavaPool', { x: 240, z: 70, y: api.groundY(240, 70) });
  },
  landmarks(kit) {
    const tr = kit.track;
    kit.passage(0.45, 1.35, { style: 'castle', color: '#5b5350', height: 14, thickness: 6, glow: '#ff3d00', torchColor: '#ff9e40' });
    kit.passage(20.55, 21.8, { style: 'castle', color: '#4e4643', height: 16, roofY: 12.5, thickness: 6, torches: true, torchColor: '#ffab40' });
    // Murallas y torres (se omiten los tramos que tocarían la pista)
    const boxes = [];
    const pts = kit.markers.castleWall || [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(len / 8));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const q = tr.nearestRoad(x, z, 30);
        if (q.any.d < q.any.hw + 6) continue;
        boxes.push({ x, y: kit.ground(x, z) - 1, z, w: 3, h: 14, d: len / n + 0.4, rot: Math.atan2(b.x - a.x, b.z - a.z) });
      }
    }
    kit.mergedBoxes(boxes, 'castle', '#5b5350');
    for (const [x, z] of [[-120, -35], [45, -35], [45, 100], [-120, 100], [-25, 100]]) {
      kit.tower(x, z, 6, 26, { roofColor: '#4a148c', flag: '#ff5722', window: '#ff9100' });
    }
    kit.tower(-30, 40, 9, 40, { roofColor: '#311b92', flag: '#ff3d00', window: '#ffab00' });
    // Lava del cráter y resplandor
    const lp = kit.markers.lavaPool;
    if (lp) {
      const THREE = kit.THREE;
      const geo = new THREE.CircleGeometry(12, 32);
      geo.rotateX(-Math.PI / 2);
      geo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(6), 1));
      const pool = new THREE.Mesh(geo, kit.tr.mats.lava());
      pool.position.set(lp.x, lp.y + 1.5, lp.z);
      kit.add(pool, false);
      kit.light(lp.x, lp.y + 10, lp.z, '#ff5722', 3, 90);
    }
    kit.overheadSign(13.6, '¡SALTA!', '#ff6d00', 9);
  },
};
