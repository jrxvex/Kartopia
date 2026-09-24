// Circuito 7 — Circuito Cibernético: una pista de neón que flota sobre el vacío digital. Curvas
// muy peraltadas, una chicane vigilada por cubos de datos, una hélice que sube vuelta y media,
// una recta elevada sin barandillas que cruza por encima del resto del circuito y un salto
// sobre el vacío antes de volver a la meta. Salirse de la pista significa caer a la cuadrícula.

const HELIX = { x: -160, z: -50, r: 40 };

/** Puntos de la hélice: vuelta y media en sentido horario, subiendo 10 m por vuelta. */
function helix() {
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = ((-45 * k) * Math.PI) / 180;
    pts.push([HELIX.x + Math.cos(a) * HELIX.r, 5 + (10 * k) / 8, HELIX.z + Math.sin(a) * HELIX.r]);
  }
  return pts;
}

export default {
  seed: 7707,
  width: 16,
  walls: true,
  curbs: true,
  wallStyle: 'glass',
  roadStyle: 'neon',
  autoBank: 170,
  maxBank: 22,
  wallHeight: 1.3,
  points: [
    [0, 0, 20], // 0 meta
    [0, 0, 70],
    [0, 1, 112],
    [-17.6, 3, 172], // gran curva peraltada
    [-60, 5, 190],
    [-102.4, 7, 172.4], // 5
    [-120, 8, 130],
    [-120, 7, 85], // chicane
    [-108, 6, 52],
    [-122, 5, 20],
    [-120, 4.5, -12], // 10
    ...helix(), // 11-23 hélice
    [-202, 20, -5],
    [-192, 20.5, 45], // 25
    [-160, 21, 88], // recta elevada
    [-100, 21, 98],
    [-40, 21, 98],
    [20, 20.5, 95],
    [62, 18.5, 78], // 30
    [84, 15.5, 40],
    [88, 12.5, 0], // salto
    [82, 9.5, -45],
    [60, 6.5, -82],
    [30, 3.5, -104], // 35
    [0, 1.5, -95],
    [-6, 0.5, -60],
    [0, 0, -25],
  ],
  sections: [
    { from: 0, to: 39, noTerrain: true },
    { from: 6.5, to: 10.6, wallStyle: 'neon' },
    { from: 36.2, to: 2.2, wallStyle: 'neon' },
    { from: 26.3, to: 29.1, walls: false },
    { from: 31.3, to: 33.6, walls: false },
  ],
  ramps: [{ at: 32.12, length: 7, height: 1.9, width: 10, style: 'neon' }],
  gaps: [{ from: 32.3, to: 32.52, depth: 30, fill: 'abyss', respawnAfter: 10 }],
  boostPads: [
    { at: 1.2, lateral: -4, width: 4.5, length: 5 },
    { at: 1.2, lateral: 4, width: 4.5, length: 5 },
    { at: 12.6, lateral: 0, width: 5, length: 5 },
    { at: 18.5, lateral: 0, width: 5, length: 5 },
    { at: 27.0, lateral: -4, width: 4.5, length: 5 },
    { at: 28.2, lateral: 4, width: 4.5, length: 5 },
    { at: 31.85, lateral: 0, width: 7, length: 4 },
    { at: 37.3, lateral: 0, width: 5, length: 5 },
  ],
  itemBoxes: [{ at: 1.8 }, { at: 6.9 }, { at: 11.5 }, { at: 19.5 }, { at: 25.2 }, { at: 29.6 }, { at: 34.6 }],
  terrain: { none: true },
  theme: {
    night: true,
    sky: { top: '#05010f', horizon: '#2a0b4a', bottom: '#070214', sunColor: '#b388ff', clouds: 0, stars: 1 },
    sun: { dir: [0.25, 0.9, 0.3], color: '#b39ddb', intensity: 0.8 },
    hemi: { sky: '#5e35b1', ground: '#0b0420', intensity: 0.75 },
    ambientColor: '#7c4dff',
    ambientIntensity: 0.22,
    envIntensity: 0.6,
    fog: { color: '#12052a', near: 200, far: 1100 },
    exposure: 1.1,
    bloom: { strength: 0.95, threshold: 0.55, radius: 0.6 },
    neon: '#00e5ff',
    road: { neon: '#0d0620', neonLine: '#00e5ff' },
    curb: ['#ff2bd6', '#1a0b33'],
    skirt: '#140a2a',
    bridge: '#1a1033',
    gateColor: '#1a1033',
    bannerColor: '#311b92',
    void: { type: 'grid', color: '#00e5ff', bg: '#05010f', y: -45, intensity: 1.4 },
    ambient: 'data',
    killY: -40,
  },
  checkpoints: 10,
  props(api) {
    // Cubos de datos que se deslizan de lado a lado
    const across = (u, half, extra = {}) => {
      const a = api.pointAt(u, -half);
      const b = api.pointAt(u, half);
      api.hazard({ type: 'mover', model: 'cube', path: [[a.x, a.z], [b.x, b.z]], hit: 'spin', radius: 1.6, height: 3, ...extra });
    };
    across(8.4, 5.5, { speed: 4.5, phase: 0.1, color: '#ff2bd6' });
    across(9.3, 5.5, { speed: 5, phase: 0.6, color: '#00e5ff' });
    across(27.6, 6, { speed: 5.5, phase: 0.3, color: '#76ff03' });
    across(28.6, 6, { speed: 5, phase: 0.8, color: '#ffea00' });
    // Luces de neón a lo largo de la recta de meta
    for (const u of [0.3, 1.0, 1.7, 37.6]) {
      for (const side of [-1, 1]) {
        const p = api.pointAt(u, side * 10);
        api.light(p.x, p.y + 3, p.z, side < 0 ? '#ff2bd6' : '#00e5ff', 1.2, 22);
      }
    }
  },
  landmarks(kit) {
    const tr = kit.track;
    // Anillos holográficos que envuelven la pista
    const colors = ['#00e5ff', '#ff2bd6', '#76ff03', '#ffea00', '#b388ff'];
    [1.5, 4.0, 13.0, 25.4, 30.4, 35.8].forEach((u, n) => {
      const s = tr.sAtU(u);
      const p = tr.pointAt(s, 0);
      const i = tr.indexAtS(s);
      kit.hologramRing(p.x, p.y + 2, p.z, tr.width[i] * 0.5 + 4, colors[n % colors.length], { rot: [0, tr.headingAt(s), 0], speed: 0.6 });
    });
    // Cristales flotando en el vacío
    const spots = [[80, 140], [-240, 40], [-60, -120], [150, -60], [-260, -150], [40, 250], [-180, 230], [180, 120]];
    spots.forEach(([x, z], n) => kit.crystalSpire(x, z, 26 + (n % 3) * 8, colors[n % colors.length], { y: -30 + (n % 4) * 6 }));
    // Anillo gigante en el centro de la hélice
    kit.hologramRing(HELIX.x, 12, HELIX.z, 18, '#ff2bd6', { rot: [Math.PI / 2, 0, 0], speed: 0.3 });
    kit.hologramRing(HELIX.x, 24, HELIX.z, 12, '#00e5ff', { rot: [Math.PI / 2, 0, 0], speed: -0.5 });
    kit.overheadSign(31.7, '¡SALTA!', '#00e5ff', 8);
    kit.overheadSign(10.3, 'HÉLICE', '#ff2bd6', 8);
  },
};
