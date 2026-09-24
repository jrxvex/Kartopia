// Circuito 8 — Templo del Bosque: una calzada de piedra se adentra en la selva con curvas
// enlazadas, cruza la garganta del río por un puente colgante, sube a la meseta del templo y lo
// atraviesa por un pasadizo. A la salida esperan bolas de pinchos y troncos que se balancean;
// un tronco hueco sirve de atajo y un salto sobre el río lleva de vuelta a la salida.
import { smoothstep } from '../core/MathUtils.js';

const LOG_A = [-221, 8];
const LOG_B = [-186, -69];

export default {
  seed: 8808,
  width: 16,
  walls: false,
  curbs: false,
  wallStyle: 'woodRail',
  roadStyle: 'stone',
  roadSurface: 'road',
  autoBank: 90,
  points: [
    [0, 4, 0], // 0 meta (claro de la selva)
    [0, 4, 55],
    [-14, 4.5, 102], // curvas enlazadas
    [8, 5, 148],
    [-4, 5.5, 192],
    [-36, 6, 222], // 5
    [-85, 6.5, 234],
    [-130, 6.8, 236], // puente colgante sobre el río
    [-175, 7.2, 232],
    [-212, 9, 212],
    [-232, 11.5, 175], // 10 meseta del templo
    [-236, 13, 135], // pasadizo del templo
    [-232, 13, 95],
    [-222, 11, 55], // bajada con troncos oscilantes
    [-230, 8.5, 15],
    [-236, 6, -25], // 15
    [-218, 5, -62],
    [-180, 4.5, -78],
    [-150, 4.6, -80], // salto sobre el río
    [-110, 4.2, -80],
    [-70, 4, -84], // 20
    [-35, 4, -90],
    [-6, 4, -72],
    [0, 4, -40],
  ],
  sections: [
    { from: 6.55, to: 7.55, bridge: true, walls: true, surface: 'wood', roadStyle: 'planks' },
    { from: 10.55, to: 11.5, tunnel: true, walls: true, wallStyle: 'stone' },
    { from: 17.72, to: 18.85, bridge: true, walls: true, surface: 'wood', roadStyle: 'planks' },
  ],
  ramps: [{ at: 17.93, length: 7, height: 1.9, width: 10, style: 'wood' }],
  gaps: [{ from: 18.1, to: 18.34, depth: 10, fill: 'water', respawnAfter: 10 }],
  boostPads: [
    { at: 17.72, lateral: 0, width: 7, length: 4 },
    { at: 3.5, lateral: 3, width: 4.5, length: 5 },
    { at: 9.55, lateral: -2, width: 4.5, length: 5 },
    { at: 21.2, lateral: 0, width: 5, length: 5 },
  ],
  itemBoxes: [{ at: 1.3 }, { at: 5.3 }, { at: 8.5, count: 5 }, { at: 12.75 }, { at: 16.4 }, { at: 20.2 }, { at: 22.6 }],
  hazards: [
    // bolas de pinchos a la salida del templo
    { type: 'pendulum', model: 'spikeball', at: 11.85, radius: 1.5, length: 9, pivotHeight: 11, amplitude: 1.0, period: 3.0, phase: 0.1 },
    { type: 'pendulum', model: 'spikeball', at: 12.25, radius: 1.5, length: 9, pivotHeight: 11, amplitude: 1.0, period: 3.0, phase: 0.6 },
    // troncos oscilantes en la bajada
    { type: 'pendulum', at: 13.4, radius: 1.3, length: 9, pivotHeight: 11, amplitude: 1.0, period: 3.4, phase: 0 },
    { type: 'pendulum', at: 13.85, radius: 1.3, length: 9, pivotHeight: 11, amplitude: 1.0, period: 3.4, phase: 0.5 },
    { type: 'pendulum', at: 14.35, radius: 1.3, length: 9, pivotHeight: 11, amplitude: 1.0, period: 3.6, phase: 0.25 },
  ],
  shortcuts: [
    {
      // tronco hueco que corta la curva de la bajada
      points: [[LOG_A[0], null, LOG_A[1]], [(LOG_A[0] + LOG_B[0]) / 2, null, (LOG_A[1] + LOG_B[1]) / 2], [LOG_B[0], null, LOG_B[1]]],
      width: 6,
      surface: 'dirt',
      style: 'dirt',
      walls: true,
    },
  ],
  terrain: {
    base: 4,
    amp: 7,
    scale: 0.013,
    follow: 0.8,
    blend: 22,
    surface: 'grass',
    shoulderSurface: 'dirt',
    beach: 0.6,
    mountains: { start: 170, rise: 240, height: 85 },
    hills: [
      { x: -245, z: 140, r: 75, h: 8 },
      { x: -128, z: 385, r: 65, h: 42 },
    ],
    rivers: [
      {
        points: [[-128, 360], [-132, 240], [-127, 120], [-133, 0], [-130, -80], [-126, -200]],
        width: 22,
        depth: 5,
      },
    ],
    // barranco más profundo bajo el puente colgante
    modify: (x, z, h) => {
      const d = Math.hypot((x + 130) * 1.6, (z - 236) * 0.6);
      return h - 9 * (1 - smoothstep(6, 30, d));
    },
  },
  theme: {
    sky: { top: '#2f6f5f', horizon: '#b8d8a0', bottom: '#d7e8c0', sunColor: '#fff0c0', clouds: 0.45, stars: 0 },
    sun: { dir: [0.35, 0.65, 0.45], color: '#ffe9b0', intensity: 2.4 },
    hemi: { sky: '#a8d8a0', ground: '#2f4f1f', intensity: 1.05 },
    fog: { color: '#9cc49a', near: 110, far: 760 },
    exposure: 1.0,
    bloom: { strength: 0.35, threshold: 0.85, radius: 0.5 },
    water: { level: 0, color: '#3a8f7a', deep: '#0f4a3a' },
    ground: { grass: ['#3f7f2f', '#346f26', '#4f8f3a'], mud: '#5a4028', dirt: '#6d5236', rock: '#6f7568', detail: 'grass', bed: '#6d6a50' },
    road: { color: '#6b6258', line: '#e8e2c8', stone: '#8a8d78', planks: '#9c6b43' },
    stoneColor: '#7b8570',
    rockColor: '#6f7568',
    skirt: '#5d4a36',
    bridge: '#6d4c33',
    tunnel: 'stone',
    tunnelLight: '#c6ff8a',
    gateColor: '#7b8570',
    bannerColor: '#2e7d32',
    horizon: { color: '#3f6f4a', repeat: 4 },
    ambient: 'firefly',
    killY: -30,
  },
  checkpoints: 9,
  props(api) {
    const { track } = api;
    api.scatter('jungleTree', 150, { min: 7, max: 110, scale: [0.8, 1.35] });
    api.scatter('tree', 50, { min: 10, max: 120, scale: [1.0, 1.5] });
    api.scatter('fern', 230, { min: 2.5, max: 70, scale: [0.8, 1.5] });
    api.scatter('bush', 110, { min: 3, max: 80, scale: [0.8, 1.4] });
    api.scatter('flowers', 90, { min: 2.5, max: 40 });
    api.scatter('mushroom', 30, { min: 4, max: 50, scale: [0.7, 1.4] });
    api.scatter('vine', 50, { min: 3, max: 30, collide: false });
    api.scatter('stump', 24, { min: 5, max: 60 });
    api.scatter('log', 18, { min: 5, max: 60 });
    api.scatter('rock', 30, { min: 5, max: 80, scale: [0.8, 1.6] });
    api.scatter('brokenPillar', 14, { region: { x: -250, z: 130, r: 70 }, min: 5, max: 60 });
    api.scatter('statue', 4, { region: { x: -250, z: 130, r: 55 }, min: 8, max: 40, scale: [1.2, 1.6] });
    // Antorchas en la meseta del templo
    api.line('torch', { from: 10.0, to: 12.6, every: 12, offset: 1.5, collide: false });
    let n = 0;
    for (const pr of track.props) {
      if (pr.type !== 'torch') continue;
      if (n++ % 2 === 0) api.light(pr.x, pr.y + 3.3, pr.z, '#ffb74d', 0.9, 16);
    }
    // Postes del puente colgante (cuerdas visuales en landmarks)
    const ropes = [];
    for (const u of [6.55, 7.55]) for (const side of [-1, 1]) ropes.push(api.pointAt(u, side * 9.5));
    api.marker('ropes', ropes);
    api.marker('log', { a: LOG_A, b: LOG_B, y: (api.groundY(...LOG_A) + api.groundY(...LOG_B)) / 2 });
  },
  landmarks(kit) {
    const tr = kit.track;
    const THREE = kit.THREE;
    kit.passage(10.55, 11.5, { style: 'stone', color: '#7b8570', accent: '#6b7560', height: 15, thickness: 7, glow: '#76ff03', torchColor: '#ffb74d' });
    // Pirámide escalonada junto al pasadizo
    const t = tr.pointAt(tr.sAtU(11.0), -34);
    kit.temple(t.x, t.z, tr.headingAt(tr.sAtU(11.0)) + Math.PI / 2, 40, { levels: 6, glow: '#76ff03' });
    // Torres de cuerda del puente colgante
    const posts = (kit.markers.ropes || []).map((p) => ({ x: p.x, y: p.y - 2, z: p.z, w: 0.8, h: 9, d: 0.8 }));
    kit.mergedBoxes(posts, 'wood', '#5d4037', { uvScale: 2 });
    // Tronco hueco del atajo
    const lg = kit.markers.log;
    if (lg) {
      const dx = lg.b[0] - lg.a[0];
      const dz = lg.b[1] - lg.a[1];
      const len = Math.hypot(dx, dz) * 0.55;
      const geo = new THREE.CylinderGeometry(5.2, 5.4, len, 18, 1, true);
      geo.rotateX(Math.PI / 2);
      const bark = new THREE.MeshStandardMaterial({ map: kit.blockMaterial('wood', '#6d4c33').map, color: '#8d6e4f', roughness: 0.95, side: THREE.DoubleSide });
      const log = new THREE.Mesh(geo, bark);
      log.position.set((lg.a[0] + lg.b[0]) / 2, lg.y + 3.2, (lg.a[1] + lg.b[1]) / 2);
      log.rotation.y = Math.atan2(dx, dz);
      kit.add(log);
      const ringGeo = new THREE.TorusGeometry(5.3, 0.45, 8, 24);
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(ringGeo, kit.mat('#c8a27a'));
        ring.position.set(log.position.x + Math.sin(log.rotation.y) * s * len * 0.5, log.position.y, log.position.z + Math.cos(log.rotation.y) * s * len * 0.5);
        ring.rotation.y = log.rotation.y;
        kit.add(ring);
      }
    }
    // Cascada río arriba, entre dos peñascos
    for (const [x, z, h, r] of [[-152, 362, 40, 20], [-104, 364, 38, 18], [-300, 230, 30, 16], [60, 300, 34, 18]]) {
      kit.rockFormation(x, z, { height: h, radius: r, layers: 4, taper: 0.25, color: '#6f7568' });
    }
    kit.waterfall(-129, 356, 18, 30);
    kit.overheadSign(17.6, '¡SALTA!', '#76ff03', 8);
  },
};
