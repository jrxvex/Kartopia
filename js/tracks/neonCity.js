// Circuito 2 — Ciudad Neón: avenidas nocturnas en forma de ocho. La avenida central pasa por
// debajo de un paso elevado con barandillas de cristal, hay un callejón en obras que ataja la
// primera curva, una chicane, una rampa de obra para hacer trucos y tráfico que circula por la
// pista. Asfalto mojado que refleja los neones, farolas y rascacielos iluminados.
import { SURFACE } from '../physics/Surfaces.js';
import { buildingRow, buildingBlock } from './helpers.js';

const SIGNS = ['KARTOPIA', 'NEÓN', 'TURBO 24H', 'RAMEN', 'ARCADE', 'HOTEL', 'CAFÉ', 'CINE', 'PIZZA', 'DISCO', 'GARAJE', 'KARAOKE'];
const SIGN_COLORS = ['#ff2bd6', '#00e5ff', '#ffea00', '#76ff03', '#ff6d00', '#b388ff'];

export default {
  seed: 2202,
  width: 18,
  walls: true,
  curbs: true,
  wallStyle: 'neon',
  roadStyle: 'asphalt',
  autoBank: 40,
  maxBank: 5,
  points: [
    [0, 0, -60], // 0 meta
    [0, 0, 0], // 1 paso inferior
    [0, 0, 70],
    [0, 0, 138],
    [9.4, 0, 160.6],
    [32, 0, 170], // 5
    [95, 0, 170],
    [158, 0, 170],
    [180.6, 0, 160.6],
    [190, 0, 138],
    [190, 0, 108], // 10 chicane
    [179, 0, 82],
    [190, 0, 56],
    [190, 0, 32],
    [180.6, 0, 9.4],
    [158, 0, 0], // 15
    [115, 0.3, 0], // subida al paso elevado
    [75, 5, 0],
    [40, 9, 0],
    [0, 9, 0], // paso elevado sobre la avenida
    [-40, 9, 0], // 20
    [-75, 5, 0],
    [-115, 0.3, 0],
    [-148, 0, 0],
    [-170.6, 0, -9.4],
    [-180, 0, -32], // 25
    [-180, 0, -85],
    [-180, 0, -138],
    [-170.6, 0, -160.6],
    [-148, 0, -170],
    [-104, 0, -177], // 30 bulevar
    [-66, 0, -167],
    [-32, 0, -170],
    [-9.4, 0, -160.6],
    [0, 0, -138],
    [0, 0, -100], // 35
  ],
  sections: [
    { from: 15.55, to: 22.45, bridge: true, wallStyle: 'glass', curbs: false, width: 16 },
    // boca del callejón (lado izquierdo de la avenida y de la calle norte)
    { from: 2.17, to: 2.42, wallL: false },
    { from: 5.55, to: 5.86, wallL: false },
  ],
  ramps: [{ at: 26.25, lateral: -5, length: 6, height: 1.4, width: 6, style: 'metal' }],
  boostPads: [
    { at: 1.45, lateral: -4.5, width: 4.5, length: 5 },
    { at: 6.25, lateral: 0, width: 5, length: 5 },
    { at: 19.25, lateral: -4.5, width: 4, length: 5 },
    { at: 19.25, lateral: 4.5, width: 4, length: 5 },
    { at: 30.4, lateral: 0, width: 5, length: 5 },
  ],
  itemBoxes: [{ at: 2.0, count: 5 }, { at: 6.8 }, { at: 10.3 }, { at: 17.5 }, { at: 26.9 }, { at: 31.3, count: 5 }],
  shortcuts: [
    {
      // callejón en obras que corta la primera curva
      points: [[11.5, null, 87], [28, null, 105], [47, null, 127], [64, null, 146], [79, null, 158.5]],
      width: 8,
      surface: 'dirt',
      style: 'dirt',
      walls: true,
    },
  ],
  hazards: [
    { type: 'mover', model: 'car', lateral: -4.5, speed: 12.5, phase: 0.08, color: '#ffeb3b' },
    { type: 'mover', model: 'bus', lateral: 4.5, speed: 10, phase: 0.3, color: '#ff9100' },
    { type: 'mover', model: 'car', lateral: 4.5, speed: 13, phase: 0.52, color: '#29b6f6' },
    { type: 'mover', model: 'car', lateral: -4.5, speed: 11.5, phase: 0.74, color: '#e53935' },
  ],
  terrain: {
    base: -0.35,
    amp: 0,
    follow: 0,
    blend: 8,
    surface: 'dirt',
    rock: false,
    margin: 80,
    // parque con césped en el interior del bloque suroeste
    surfaceFn: (x, z, h, s, nearD) => (x > -160 && x < -22 && z > -152 && z < -20 && nearD > 4 ? SURFACE.GRASS : s),
  },
  theme: {
    night: true,
    sky: { top: '#07021a', horizon: '#3b1456', bottom: '#12061f', sunColor: '#d6ddff', clouds: 0.2, stars: 0.9 },
    sun: { dir: [-0.35, 0.8, 0.45], color: '#9aa8ff', intensity: 0.6 },
    hemi: { sky: '#40308a', ground: '#1a1026', intensity: 0.6 },
    ambientColor: '#b39ddb',
    ambientIntensity: 0.18,
    envIntensity: 0.5,
    fog: { color: '#1d0f33', near: 140, far: 900 },
    exposure: 1.15,
    bloom: { strength: 0.8, threshold: 0.6, radius: 0.55 },
    neon: '#ff2bd6',
    lampColor: '#ffd9a0',
    windowTint: '#ffd98a',
    gateColor: '#263238',
    bannerColor: '#6a1b9a',
    road: { color: '#3b3e48', line: '#ffe082', wet: true },
    curb: ['#ff2bd6', '#2a1840'],
    skirt: '#2b2b33',
    bridge: '#4a4f5a',
    ground: { dirt: '#34343c', grass: ['#2e5a2a', '#284f24', '#376b30'], rock: '#3a3942', detail: 'pavement' },
    ambient: 'sparkle',
    killY: -30,
  },
  checkpoints: 8,
  props(api) {
    const { rng, track } = api;
    // Farolas a ambos lados con luz dinámica cada dos
    api.line('streetLight', { every: 34, offset: 2.4, faceRoad: true, collide: false });
    let n = 0;
    for (const pr of track.props) {
      if (pr.type !== 'streetLight') continue;
      if (n++ % 2) continue;
      api.light(pr.x + Math.sin(pr.rot) * 1.2, pr.y + 7.4, pr.z + Math.cos(pr.rot) * 1.2, '#ffd9a0', 1.1, 24);
    }
    // Obras junto al callejón
    for (const [x, z] of [[20, 90], [16, 99], [74, 150], [84, 152], [40, 110], [58, 130]]) api.place('cone', x, z);
    for (const [x, z] of [[33, 98], [52, 120], [70, 140]]) api.place('barrel', x, z, { collide: true });
    api.place('crate', 24, 116, { collide: true });
    api.place('crate', 58, 142, { collide: true });
    // Parque
    api.scatter('tree', 24, { region: { x: -92, z: -86, r: 58 }, min: 6, max: 80, scale: [0.9, 1.3] });
    api.scatter('bush', 30, { region: { x: -92, z: -86, r: 62 }, min: 3, max: 80 });
    api.scatter('flowers', 40, { region: { x: -92, z: -86, r: 55 }, min: 3, max: 80 });
    api.place('statue', -95, -88, { scale: 1.3, rot: 0.6 });
    // Rótulos de neón sueltos
    api.scatter('neonSign', 26, { min: 3, max: 9, collide: false, filter: (x, z) => !(x > -160 && x < -22 && z > -152 && z < -20) });
    // Edificios a lo largo de las calles (dentro y fuera de los bloques)
    const rows = [
      [34.3, 3.0], [5.0, 7.0], [9.0, 13.0], [15.0, 16.2], [22.2, 23.0], [25.0, 27.0], [29.0, 32.0],
    ];
    const buildings = [];
    for (const [from, to] of rows) {
      for (const side of [-1, 1]) {
        buildingRow(api, { from, to, side, setback: 5, length: [14, 26], depth: [14, 24], height: [16, 58], gap: [3, 7], avoid: buildings });
      }
    }
    // Manzanas interiores y exteriores (los huecos junto a las calles ya están ocupados)
    const blocks = [
      { x: -95, z: 95, w: 130, d: 120, cols: 3, rows: 3 },
      { x: 95, z: -90, w: 130, d: 130, cols: 3, rows: 3 },
      { x: 120, z: 75, w: 90, d: 90, cols: 2, rows: 2 },
      { x: 95, z: 245, w: 200, d: 80, cols: 4, rows: 1 },
      { x: -95, z: -245, w: 200, d: 80, cols: 4, rows: 1 },
      { x: 265, z: 85, w: 80, d: 200, cols: 1, rows: 4 },
      { x: -255, z: -85, w: 80, d: 200, cols: 1, rows: 4 },
    ];
    for (const b of blocks) buildingBlock(api, { ...b, height: [22, 75], skip: 0.15, clearance: 6, avoid: buildings });
    // Rótulos en algunas fachadas
    const pool = [...SIGNS];
    for (const b of buildings) {
      if (pool.length && rng.next() < 0.3) {
        b.sign = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        b.signColor = rng.pick(SIGN_COLORS);
      }
    }
    api.marker('buildings', buildings);
  },
  landmarks(kit) {
    const tr = kit.track;
    kit.cityBuildings(kit.markers.buildings || []);
    kit.skyline(tr.center.x, tr.center.z, 380, 650, 56, { hMin: 50, hMax: 160 });
    kit.hologramRing(0, 30, 0, 15, '#00e5ff', { rot: [Math.PI / 2, 0, 0], speed: 0.5 });
    kit.hologramRing(0, 36, 0, 10, '#ff2bd6', { rot: [Math.PI / 2, 0, 0], speed: -0.7 });
    kit.overheadSign(6.6, 'CIUDAD NEÓN', '#ff2bd6', 8);
    kit.overheadSign(30.8, '¡A FONDO!', '#00e5ff', 8);
    kit.billboard(215, 195, -Math.PI * 0.75, 'KARTOPIA', '#ffea00', 16, 12);
    kit.billboard(-205, -195, Math.PI * 0.25, 'NEÓN 24H', '#ff2bd6', 16, 12);
    kit.billboard(-40, 190, Math.PI, 'TURBO', '#00e5ff', 14, 10);
  },
};
