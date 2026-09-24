// Circuito 1 — Valle Verde: colinas suaves, molinos, un río con puente de madera, un salto sobre
// el río, un lago con un atajo embarrado y campos abiertos.
const S = 1.15; // escala del trazado
const p = (x, y, z, o) => [x * S, y, z * S, o];
const xz = (x, z) => [x * S, z * S];
const sp = (x, z) => [x * S, null, z * S]; // punto de atajo con altura automática

export default {
  seed: 1101,
  width: 17,
  walls: false,
  curbs: true,
  wallStyle: 'fence',
  roadStyle: 'asphalt',
  autoBank: 100,
  points: [
    p(0, 0, 0), // 0 meta
    p(0, 0, 60),
    p(5, 1, 105),
    p(28, 3, 140),
    p(65, 6, 155),
    p(105, 8, 152), // 5 cima de la colina
    p(140, 7, 138),
    p(163, 5, 112),
    p(172, 3, 82),
    p(164, 2, 52),
    p(175, 1.5, 22), // 10
    p(198, 1.5, 0),
    p(215, 2, -30),
    p(224, 3, -62), // rampa sobre el río
    p(225, 2, -95),
    p(212, 1, -128), // 15
    p(178, 0.5, -150),
    p(152, 0, -178), // entrada del lazo del lago
    p(150, 0, -215, { w: 16 }),
    p(125, 0, -240, { w: 16 }),
    p(95, 0, -232, { w: 16 }), // 20
    p(82, 0, -205),
    p(92, 0, -178), // salida del lazo
    p(72, 0.5, -152),
    p(42, 1, -142),
    p(15, 1, -128), // 25
    p(0, 0.5, -100),
    p(0, 0, -50),
  ],
  sections: [
    { from: 2.6, to: 8.6, wallR: true, wallStyle: 'fence' },
    { from: 13.9, to: 16.45, wallL: true, wallStyle: 'fence' },
    { from: 22.55, to: 26.1, wallL: true, wallStyle: 'fence' },
    { from: 26.18, to: 26.62, bridge: true, walls: true, wallStyle: 'woodRail', surface: 'wood', roadStyle: 'planks', curbs: false },
  ],
  ramps: [
    { at: 13.36, length: 7, height: 1.8, width: 9, style: 'wood' },
    { at: 19.35, length: 5, height: 1.1, width: 8, style: 'wood' },
  ],
  gaps: [{ from: 13.57, to: 13.83, depth: 9, fill: 'water', respawnAfter: 8 }],
  boostPads: [
    { at: 1.3, lateral: 0, width: 4.5, length: 5 },
    { at: 13.2, lateral: 0, width: 7, length: 4 },
    { at: 16.15, lateral: -2, width: 4.5, length: 5 },
    { at: 24.3, lateral: 2, width: 4.5, length: 5 },
  ],
  itemBoxes: [{ at: 2.0 }, { at: 7.5 }, { at: 12.2, count: 5 }, { at: 17.4 }, { at: 23.4 }],
  shortcuts: [
    {
      points: [sp(150, -183), sp(136, -178), sp(118, -176), sp(100, -181)],
      width: 7,
      surface: 'mud',
      style: 'mud',
    },
  ],
  terrain: {
    base: -0.5,
    amp: 7,
    scale: 0.011,
    follow: 0.9,
    blend: 24,
    surface: 'grass',
    beach: 0.8,
    mountains: { start: 170, rise: 260, height: 70 },
    hills: [
      { x: 95 * S, z: 215 * S, r: 95, h: 16 },
      { x: -70 * S, z: 60 * S, r: 70, h: 10 },
    ],
    rivers: [
      {
        points: [
          [-200, -70], [-60, -85], [0, -80], [60, -65], [120, -80], [180, -90], [226, -85], [280, -70], [420, -80],
        ].map(([x, z]) => xz(x, z)),
        width: 15,
        depth: 3.5,
      },
    ],
    lakes: [
      { x: 120 * S, z: -210 * S, r: 15, depth: 5 },
      { x: 110 * S, z: -40 * S, r: 12, depth: 3 },
    ],
  },
  theme: {
    sky: { top: '#2f79d8', horizon: '#bfe3ff', bottom: '#e8f6ff', sunColor: '#fff4d0', clouds: 0.55, stars: 0 },
    sun: { dir: [0.45, 0.82, 0.35], color: '#fff2da', intensity: 2.9 },
    hemi: { sky: '#cde6ff', ground: '#5d7f3c', intensity: 1.15 },
    fog: { color: '#cfe7ff', near: 220, far: 1100 },
    exposure: 1.0,
    bloom: { strength: 0.28, threshold: 0.9, radius: 0.4 },
    water: { level: -3, color: '#2c9bc4', deep: '#0f4f72' },
    ground: { grass: ['#5fae45', '#4c9837', '#7cc154'], rock: '#8c857b', sand: '#e3d397', dirt: '#8e6d45', mud: '#6b4f33' },
    curb: ['#e53935', '#ffffff'],
    road: { color: '#5b6066', line: '#ffffff' },
    ambient: 'pollen',
    killY: -40,
  },
  checkpoints: 8,
  props(api) {
    const { rng } = api;
    api.scatter('tree', 170, { min: 9, max: 115, scale: [0.85, 1.5] });
    api.scatter('pine', 45, { min: 25, max: 130, scale: [0.9, 1.4] });
    api.scatter('bush', 140, { min: 4, max: 70, scale: [0.7, 1.4] });
    api.scatter('flowers', 220, { min: 2.5, max: 45, scale: [0.8, 1.3] });
    api.scatter('grass', 520, { min: 1.5, max: 70 });
    api.scatter('rock', 26, { min: 6, max: 70, scale: [0.6, 1.4] });
    // Balas de paja en la colina
    api.line('hay', { from: 3.5, to: 7.5, every: 22, offset: 3.5, side: 'right', collide: true });
    api.line('flag', { from: 27.3, to: 0.9, every: 12, offset: 2.5, collide: false });
    // Valla que separa el lazo del lago del interior (el atajo embarrado queda al sur de ella)
    const hwA = api.halfWidthAt(16.55);
    const hwB = api.halfWidthAt(22.45);
    const a = api.pointAt(16.55, -(hwA + 1.7));
    const b = api.pointAt(22.45, -(hwB + 1.7));
    api.wall(
      [
        [a.x, a.z],
        [...xz(140, -166)],
        [...xz(120, -164)],
        [...xz(102, -167)],
        [b.x, b.z],
      ],
      1.3,
      { style: 'fence' },
    );
    // Árboles junto al atajo para marcarlo
    for (const [x, z] of [[160, -190], [140, -192], [106, -193], [88, -190]]) api.place('tree', ...xz(x, z), { scale: rng.range(0.9, 1.2) });
    // Molinos y granja (visual en landmarks; colisión aquí)
    const mills = [xz(70, 205), xz(112, 222), xz(150, 196)];
    for (const [x, z] of mills) api.circle(x, z, 3.2, 20);
    api.marker('windmills', mills.map(([x, z]) => ({ x, z, y: api.groundY(x, z) })));
    const barn = xz(95, 40);
    api.box(barn[0], barn[1], 16, 22, 11, { rot: 0.3, visual: false });
    api.marker('barn', { x: barn[0], z: barn[1], y: api.groundY(barn[0], barn[1]), rot: 0.3 });
    const stands = api.pointAt(0.55, -(api.halfWidthAt(0.55) + 16));
    api.marker('grandstand', { x: stands.x, z: stands.z, y: api.groundY(stands.x, stands.z), rot: api.headingAt(0.55) + Math.PI / 2 });
    api.box(stands.x, stands.z, 34, 10, 9, { rot: api.headingAt(0.55), visual: false });
    api.marker('balloons', [
      { x: 60 * S, y: 70, z: 20 * S, color: '#ff5252' },
      { x: 160 * S, y: 90, z: -120 * S, color: '#ffd740' },
      { x: -60 * S, y: 80, z: -160 * S, color: '#69f0ae' },
    ]);
  },
  landmarks(kit) {
    const m = kit.markers;
    for (const w of m.windmills || []) kit.windmill(w.x, w.z, { y: w.y, speed: 0.5 + kit.rng.next() * 0.4 });
    if (m.barn) kit.barn(m.barn.x, m.barn.z, m.barn.rot);
    if (m.grandstand) kit.grandstand(m.grandstand.x, m.grandstand.z, m.grandstand.rot, 34, { y: m.grandstand.y });
    for (const b of m.balloons || []) kit.balloon(b.x, b.y, b.z, b.color);
    kit.overheadSign(9.6, '¡A TODO GAS!', '#ffd740', 8);
  },
};
