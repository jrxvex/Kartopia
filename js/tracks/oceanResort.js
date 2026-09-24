// Circuito 5 — Resort Oceánico: paseo marítimo al atardecer con hoteles y palmeras, un largo
// muelle de madera que termina en una rampa para saltar a la isla del faro, un atajo que trepa
// por la colina de la isla, una pasarela de vuelta a tierra y una carretera de playa junto a la
// orilla, con cangrejos que cruzan la calzada y barcos fondeados en la bahía.
import { smoothstep, lerp } from '../core/MathUtils.js';
import { buildingRow } from './helpers.js';

const ISLAND = { x: -56, z: -115 };

export default {
  seed: 5505,
  width: 16,
  walls: false,
  curbs: true,
  wallStyle: 'metal',
  roadStyle: 'asphalt',
  autoBank: 100,
  points: [
    [-50, 2.5, 40], // 0 meta (paseo marítimo)
    [10, 2.5, 42],
    [65, 2.5, 40],
    [108, 2.3, 30],
    [130, 2, 5],
    [134, 1.7, -30], // 5 muelle
    [128, 1.7, -72],
    [106, 1.7, -104],
    [70, 1.9, -118],
    [38, 2.4, -122], // rampa al final del muelle
    [0, 3, -126], // 10 isla
    [-30, 4, -142],
    [-62, 5, -160],
    [-98, 5.5, -150],
    [-112, 5, -118],
    [-102, 4.5, -86], // 15
    [-80, 3.5, -62], // pasarela a tierra
    [-70, 2.6, -30],
    [-82, 2, 0], // playa
    [-125, 1.8, 8],
    [-175, 2, 6], // 20
    [-222, 2, 18],
    [-240, 2.3, 48],
    [-215, 2.5, 72],
    [-165, 2.6, 66],
    [-110, 2.5, 50], // 25
  ],
  sections: [
    // muelle de madera sobre el mar
    { from: 4.55, to: 8.95, bridge: true, walls: true, wallStyle: 'woodRail', surface: 'wood', roadStyle: 'planks', curbs: false },
    // pasarela de vuelta a tierra
    { from: 16.2, to: 17.75, bridge: true, walls: true, wallStyle: 'woodRail', surface: 'wood', roadStyle: 'planks', curbs: false },
    // paseo marítimo con barandilla
    { from: 23.2, to: 3.3, walls: true, wallStyle: 'metal' },
  ],
  ramps: [{ at: 8.52, length: 7, height: 1.8, width: 9, style: 'wood' }],
  gaps: [{ from: 8.8, to: 9.1, depth: 8, fill: 'water', respawnAfter: 8 }],
  boostPads: [
    { at: 8.25, lateral: 0, width: 6, length: 4 },
    { at: 1.4, lateral: -3, width: 4.5, length: 5 },
    { at: 17.9, lateral: 0, width: 5, length: 5 },
    { at: 23.8, lateral: 2.5, width: 4.5, length: 5 },
  ],
  itemBoxes: [{ at: 1.0 }, { at: 6.0 }, { at: 11.0 }, { at: 15.3 }, { at: 19.0, count: 5 }, { at: 21.6 }, { at: 24.4 }],
  shortcuts: [
    {
      // sendero que trepa por la colina del faro
      points: [[-27, 4.2, -134], [-44, 8.5, -124], [-66, 10, -110], [-86, 7.5, -98], [-100, 4.6, -90]],
      width: 7,
      surface: 'sand',
      style: 'sand',
    },
  ],
  terrain: {
    base: 0,
    amp: 1.6,
    scale: 0.012,
    follow: 0,
    blend: 18,
    surface: 'sand',
    beach: 1.4,
    rockSlope: 0.7,
    margin: 150,
    height: (x, z, h) => {
      // Costa: tierra firme al norte, playa y mar al sur
      const zc = 10 + 8 * Math.sin(x * 0.018);
      const t = z - zc;
      let g = t > 0 ? lerp(0.4, 3.4, smoothstep(0, 45, t)) : lerp(0.4, -10, smoothstep(0, 75, -t));
      // Isla del faro: plataforma, colina central y orilla
      const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
      const island = lerp(3.2, -10, smoothstep(44, 88, di)) + 10 * (1 - smoothstep(0, 34, di));
      g = Math.max(g, island);
      return g + h * 0.5;
    },
  },
  theme: {
    sky: { top: '#34438a', horizon: '#ff9f6e', bottom: '#ffd0a0', sunColor: '#ffb36b', clouds: 0.45, stars: 0.1 },
    sun: { dir: [-0.75, 0.3, -0.55], color: '#ffb47a', intensity: 2.5 },
    hemi: { sky: '#ffcaa6', ground: '#6d5a4a', intensity: 1.0 },
    ambientColor: '#ffd1b0',
    ambientIntensity: 0.16,
    fog: { color: '#f5b38e', near: 220, far: 1200 },
    exposure: 1.02,
    bloom: { strength: 0.42, threshold: 0.84, radius: 0.5 },
    water: { level: 0, color: '#2a93b5', deep: '#0b4568' },
    ground: { sand: '#efd29a', grass: ['#6fae4b', '#5f9e3f', '#83bf5b'], rock: '#9a8a7c', dirt: '#b18d62', detail: 'sand', bed: '#d8c089' },
    road: { color: '#5e6168', line: '#ffffff', planks: '#b07a4c' },
    curb: ['#00acc1', '#ffffff'],
    skirt: '#b89468',
    bridge: '#8d6e4f',
    lampColor: '#ffe0b2',
    gateColor: '#fafafa',
    bannerColor: '#00838f',
    windowTint: '#ffcc80',
    horizon: { color: '#8f6f8f', repeat: 5 },
    ambient: 'sparkle',
    killY: -30,
  },
  checkpoints: 8,
  props(api) {
    const { rng, track } = api;
    // Paseo: palmeras y farolas
    api.line('palm', { from: 23.3, to: 3.2, every: 20, offset: 4.5, side: 'left', scale: [0.9, 1.25] });
    api.line('palm', { from: 23.6, to: 3.0, every: 26, offset: 5, side: 'right', scale: [1.0, 1.3], startOffset: 10 });
    api.line('lamp', { from: 23.4, to: 3.2, every: 30, offset: 2.2, side: 'right', faceRoad: true });
    // Muelle: farolillos
    api.line('lamp', { from: 4.7, to: 8.4, every: 22, offset: 0.3, faceRoad: true, collide: false });
    let n = 0;
    for (const pr of track.props) {
      if (pr.type !== 'lamp') continue;
      if (n++ % 2) continue;
      api.light(pr.x + Math.sin(pr.rot) * 1.2, pr.y + 5.8, pr.z + Math.cos(pr.rot) * 1.2, '#ffcc80', 0.9, 20);
    }
    // Playa: sombrillas y tumbonas
    const colors = ['#ff5252', '#ffd740', '#40c4ff', '#69f0ae', '#e040fb', '#ff9100'];
    api.scatter('umbrella', 34, { min: 5, max: 40, collide: false, filter: (x, z, y) => y > 0.5 && y < 2.2 && z < 30 && z > -20, spacing: 6 });
    for (const pr of track.props) if (pr.type === 'umbrella') pr.color = rng.pick(colors);
    api.scatter('beachChair', 40, { min: 4, max: 40, filter: (x, z, y) => y > 0.5 && y < 2.2 && z < 30 && z > -20 });
    api.scatter('palm', 60, { min: 8, max: 100, scale: [0.8, 1.3], filter: (x, z, y) => y > 1 });
    api.scatter('bush', 50, { min: 5, max: 70, filter: (x, z, y) => y > 1.4 });
    api.scatter('grass', 120, { min: 3, max: 60, filter: (x, z, y) => y > 2 });
    api.scatter('rock', 30, { min: 5, max: 70, scale: [0.8, 1.8], filter: (x, z, y) => y > -1 && y < 1.5 });
    api.scatter('coral', 50, { min: 6, max: 80, water: true });
    api.scatter('buoy', 26, { min: 8, max: 90, water: true, collide: false });
    for (const pr of track.props) if (pr.type === 'buoy') pr.y = track.waterLevel;
    // Cangrejos que cruzan la calzada
    const across = (u, half, extra = {}) => {
      const a = api.pointAt(u, -half);
      const b = api.pointAt(u, half);
      api.hazard({ type: 'mover', model: 'crab', path: [[a.x, a.z], [b.x, b.z]], hit: 'spin', radius: 1.4, height: 2, ...extra });
    };
    across(19.4, 10, { speed: 3.5, phase: 0.1 });
    across(20.5, 10, { speed: 4, phase: 0.6 });
    across(11.6, 9, { speed: 3.2, phase: 0.35 });
    across(14.6, 9, { speed: 3.6, phase: 0.8 });
    // Hoteles frente al mar
    const hotels = [];
    buildingRow(api, { from: 23.6, to: 3.0, side: 1, setback: 12, length: [22, 34], depth: [16, 22], height: [18, 46], gap: [8, 16], avoid: hotels });
    api.marker('hotels', hotels);
    // Chiringuitos
    for (const u of [1.9, 24.7]) {
      const p = api.pointAt(u, -16);
      api.box(p.x, p.z, 8, 6, 3.5, { rot: api.headingAt(u), style: 'wood' });
    }
  },
  landmarks(kit) {
    const pastel = ['#ffccbc', '#fff9c4', '#b2ebf2', '#f8bbd0', '#dcedc8', '#d1c4e9'];
    kit.cityBuildings(kit.markers.hotels || [], { colors: pastel, variants: 2 });
    kit.lighthouse(ISLAND.x - 4, ISLAND.z - 8, { height: 24, y: kit.ground(ISLAND.x - 4, ISLAND.z - 8) - 0.5 });
    for (const [x, z, r, c] of [[60, -60, 0.7, '#1565c0'], [-10, -60, -0.4, '#c62828'], [190, -120, 1.2, '#2e7d32'], [-170, -80, 2.2, '#f9a825'], [40, -200, 0.1, '#6a1b9a']]) {
      kit.boat(x, z, r, c);
    }
    kit.overheadSign(8.1, '¡SALTA!', '#00e5ff', 7.5);
    kit.billboard(20, 78, Math.PI, 'RESORT', '#ff6e40', 16, 10);
  },
};
