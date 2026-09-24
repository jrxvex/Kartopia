// Modelos procedurales de karts (8 carrocerías originales). Devuelve un objeto con el grupo
// raíz, ruedas (con pivote de dirección y giro), volante, llamas del escape y posición del asiento.
import * as THREE from 'three';
import { ModelBuilder, sharedMaterials, G, profileExtrude, roundedBox, tireGeometry } from './ModelBuilder.js';

const DARK = '#23262b';
const CHROME = '#e8ecf0';
const SEAT = '#2b2b33';

function wheelModel(radius, width, rimColor, style = 'normal') {
  const b = new ModelBuilder();
  b.add(tireGeometry(radius, width, style === 'knobby'), 'rubber', '#1b1b1f');
  if (style === 'knobby') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.add(G.box(width * 0.95, 0.06, 0.08), 'rubber', '#151518', {
        pos: [0, Math.cos(a) * radius * 0.98, Math.sin(a) * radius * 0.98],
        rot: [a, 0, 0],
      });
    }
  }
  if (style === 'whitewall') {
    const ring = G.torus(radius * 0.74, radius * 0.07, 6, 24);
    ring.rotateY(Math.PI / 2);
    for (const s of [-1, 1]) b.add(ring, 'matte', '#f5f5f5', { pos: [s * width * 0.46, 0, 0] });
  }
  const rim = G.cyl(radius * 0.6, radius * 0.6, width * 0.82, 16);
  rim.rotateZ(Math.PI / 2);
  b.add(rim, style === 'neon' ? 'glow' : 'chrome', rimColor, {}, style === 'neon' ? 2.5 : 1);
  const hub = G.cyl(radius * 0.22, radius * 0.22, width * 0.95, 10);
  hub.rotateZ(Math.PI / 2);
  b.add(hub, 'metal', '#3a3f45');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const s of [-1, 1]) {
      b.add(G.box(0.02, radius * 0.5, 0.05), 'metal', '#4a5058', {
        pos: [s * width * 0.42, Math.cos(a) * radius * 0.32, Math.sin(a) * radius * 0.32],
        rot: [a, 0, 0],
      });
    }
  }
  const mats = sharedMaterials();
  const group = b.build(mats);
  return group;
}

/** Especificación geométrica común por carrocería. */
const SPECS = {
  standard: { wb: 1.28, track: 1.28, rf: 0.27, rr: 0.31, wf: 0.26, wr: 0.34, seat: [0, 0.4, -0.18], wheel: [0, 0.74, 0.3], exhaust: [[0.22, 0.46, -1.08], [-0.22, 0.46, -1.08]] },
  speedster: { wb: 1.45, track: 1.3, rf: 0.25, rr: 0.31, wf: 0.24, wr: 0.36, seat: [0, 0.34, -0.25], wheel: [0, 0.66, 0.22], exhaust: [[0, 0.44, -1.2]] },
  buggy: { wb: 1.3, track: 1.42, rf: 0.36, rr: 0.4, wf: 0.3, wr: 0.36, seat: [0, 0.56, -0.12], wheel: [0, 0.9, 0.34], exhaust: [[0.3, 0.72, -0.95], [-0.3, 0.72, -0.95]], wheelStyle: 'knobby' },
  tank: { wb: 1.35, track: 1.45, rf: 0.31, rr: 0.34, wf: 0.36, wr: 0.42, seat: [0, 0.48, -0.2], wheel: [0, 0.82, 0.3], exhaust: [[0.45, 1.05, -0.8], [-0.45, 1.05, -0.8]] },
  feather: { wb: 1.2, track: 1.2, rf: 0.23, rr: 0.26, wf: 0.18, wr: 0.24, seat: [0, 0.36, -0.2], wheel: [0, 0.68, 0.3], exhaust: [[0, 0.36, -0.92]] },
  retro: { wb: 1.32, track: 1.26, rf: 0.28, rr: 0.31, wf: 0.24, wr: 0.3, seat: [0, 0.42, -0.22], wheel: [0, 0.76, 0.28], exhaust: [[0.18, 0.4, -1.12], [-0.18, 0.4, -1.12]], wheelStyle: 'whitewall' },
  sport: { wb: 1.36, track: 1.32, rf: 0.27, rr: 0.3, wf: 0.26, wr: 0.34, seat: [0, 0.36, -0.22], wheel: [0, 0.68, 0.26], exhaust: [[0.3, 0.42, -1.1], [-0.3, 0.42, -1.1]], wheelStyle: 'neon' },
  tub: { wb: 1.3, track: 1.36, rf: 0.27, rr: 0.3, wf: 0.24, wr: 0.28, seat: [0, 0.5, -0.22], wheel: [0, 0.86, 0.34], exhaust: [[0, 0.5, -1.05]] },
};

function buildBody(type, b, colors) {
  const main = colors.main;
  const acc = colors.accent;
  const sp = SPECS[type];
  switch (type) {
    case 'speedster': {
      b.add(profileExtrude([[1.35, 0.2], [1.3, 0.3, 1.38, 0.26], [0.55, 0.46, 0.95, 0.42], [0.2, 0.44], [-0.1, 0.38], [-0.5, 0.42], [-0.95, 0.56, -0.7, 0.58], [-1.1, 0.4], [-1.1, 0.2]], 0.86, 0.07), 'paint', main);
      b.add(G.box(1.1, 0.08, 1.9), 'matte', DARK, { pos: [0, 0.2, 0.05] });
      b.add(G.box(1.45, 0.05, 0.32, 0.02), 'paint', acc, { pos: [0, 1.02, -1.02] });
      for (const s of [-1, 1]) {
        b.add(G.box(0.05, 0.5, 0.12), 'matte', DARK, { pos: [s * 0.45, 0.78, -0.98] });
        b.add(G.box(0.06, 0.34, 0.5), 'paint', acc, { pos: [s * 0.74, 1.02, -1.02] });
        b.add(G.box(0.22, 0.2, 0.7, 0.05), 'matte', DARK, { pos: [s * 0.5, 0.38, -0.2] });
      }
      b.add(G.cyl(0.11, 0.13, 0.35), 'chrome', CHROME, { pos: [0, 0.44, -1.05], rot: [Math.PI / 2, 0, 0] });
      for (const s of [-1, 1]) b.add(G.sphere(0.06), 'glow', '#fff5d6', { pos: [s * 0.25, 0.3, 1.33] }, 3);
      break;
    }
    case 'buggy': {
      b.add(G.box(1.0, 0.14, 1.9, 0.05), 'matte', DARK, { pos: [0, 0.4, 0] });
      b.add(profileExtrude([[0.95, 0.45], [0.8, 0.72, 0.95, 0.66], [0.3, 0.7], [0.25, 0.55], [-0.45, 0.55], [-0.6, 0.78], [-0.95, 0.75], [-0.95, 0.45]], 0.95, 0.05), 'paint', main);
      const bar = (x1, y1, z1, x2, y2, z2) => {
        const a = new THREE.Vector3(x1, y1, z1);
        const c = new THREE.Vector3(x2, y2, z2);
        const len = a.distanceTo(c);
        const geo = G.cyl(0.035, 0.035, len, 8);
        const mid = a.clone().add(c).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
        const e = new THREE.Euler().setFromQuaternion(q);
        b.add(geo, 'chrome', acc, { pos: mid.toArray(), rot: [e.x, e.y, e.z] });
      };
      for (const s of [-1, 1]) {
        bar(s * 0.42, 0.6, 0.25, s * 0.36, 1.45, -0.05);
        bar(s * 0.42, 0.6, -0.55, s * 0.36, 1.45, -0.35);
        bar(s * 0.36, 1.45, -0.05, s * 0.36, 1.45, -0.35);
      }
      bar(0.36, 1.45, -0.05, -0.36, 1.45, -0.05);
      bar(0.36, 1.45, -0.35, -0.36, 1.45, -0.35);
      b.add(G.box(1.1, 0.12, 0.2, 0.04), 'matte', '#555', { pos: [0, 0.35, 1.02] });
      for (const s of [-1, 1]) b.add(G.cyl(0.08, 0.08, 0.05), 'glow', '#fff3c4', { pos: [s * 0.28, 1.47, 0.02], rot: [Math.PI / 2, 0, 0] }, 3);
      for (const e of sp.exhaust) b.add(G.cyl(0.06, 0.07, 0.4), 'chrome', CHROME, { pos: [e[0], e[1] - 0.05, e[2] + 0.12], rot: [Math.PI / 2.4, 0, 0] });
      break;
    }
    case 'tank': {
      b.add(G.box(1.25, 0.22, 2.0, 0.06), 'matte', DARK, { pos: [0, 0.3, 0] });
      b.add(profileExtrude([[1.05, 0.28], [1.05, 0.62], [0.35, 0.72], [0.22, 0.6], [-0.5, 0.6], [-0.62, 0.9], [-1.05, 0.88], [-1.08, 0.28]], 1.18, 0.09, 4), 'paint', main);
      b.add(G.box(1.4, 0.3, 0.22, 0.06), 'metal', '#8a8f96', { pos: [0, 0.42, 1.12] });
      for (let i = 0; i < 3; i++) b.add(G.box(0.16, 0.12, 0.14), 'metal', '#6b7076', { pos: [-0.4 + i * 0.4, 0.62, 1.12] });
      for (const s of [-1, 1]) {
        b.add(G.box(0.12, 0.3, 1.1, 0.04), 'paint', acc, { pos: [s * 0.68, 0.55, -0.05] });
        b.add(G.cyl(0.09, 0.1, 0.8), 'chrome', CHROME, { pos: [s * 0.45, 0.82, -0.8] });
      }
      for (const s of [-1, 1]) b.add(G.box(0.2, 0.1, 0.05), 'glow', '#fff3c4', { pos: [s * 0.35, 0.58, 1.06] }, 3);
      break;
    }
    case 'feather': {
      const tube = (pts, r = 0.03) => {
        const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
        b.add(new THREE.TubeGeometry(curve, 24, r, 6, false), 'paint', main);
      };
      for (const s of [-1, 1]) {
        tube([[s * 0.38, 0.24, 0.95], [s * 0.45, 0.24, 0.3], [s * 0.45, 0.26, -0.5], [s * 0.35, 0.3, -0.9]]);
        tube([[s * 0.45, 0.25, 0.1], [s * 0.3, 0.7, -0.35], [s * 0.3, 0.75, -0.55]], 0.025);
      }
      tube([[0.38, 0.24, 0.95], [0, 0.26, 1.05], [-0.38, 0.24, 0.95]]);
      b.add(G.box(0.76, 0.04, 1.6, 0.02), 'matte', DARK, { pos: [0, 0.2, 0] });
      b.add(profileExtrude([[1.08, 0.24], [0.95, 0.44, 1.1, 0.38], [0.55, 0.46], [0.5, 0.24]], 0.5, 0.04), 'paint', acc);
      b.add(G.sphere(0.06), 'glow', '#fff5d6', { pos: [0, 0.34, 1.1] }, 3);
      b.add(G.cyl(0.05, 0.06, 0.35), 'chrome', CHROME, { pos: [0, 0.36, -0.9], rot: [Math.PI / 2, 0, 0] });
      break;
    }
    case 'retro': {
      const pts = [];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const z = -1.1 + t * 2.3;
        let r = 0.36 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (t > 0.85 ? 1 - (t - 0.85) / 0.15 * 0.55 : 1);
        if (t < 0.05) r = 0.2 + t * 3;
        pts.push(new THREE.Vector2(Math.max(0.02, r), z));
      }
      const hull = new THREE.LatheGeometry(pts, 20);
      hull.rotateX(Math.PI / 2);
      b.add(hull, 'paint', main, { pos: [0, 0.42, 0], scale: [1.15, 0.85, 1] });
      b.add(G.box(0.62, 0.3, 0.7, 0.08), 'matte', DARK, { pos: [0, 0.62, -0.2] });
      b.add(G.torus(0.2, 0.04, 8, 18), 'chrome', CHROME, { pos: [0, 0.42, 1.2] });
      b.add(G.cyl(0.19, 0.19, 0.04, 18), 'matte', '#333', { pos: [0, 0.42, 1.2], rot: [Math.PI / 2, 0, 0] });
      b.add(G.box(0.05, 0.42, 0.55), 'paint', acc, { pos: [0, 0.9, -0.85], rot: [-0.25, 0, 0] });
      for (const s of [-1, 1]) {
        b.add(G.box(0.08, 0.06, 1.3), 'chrome', CHROME, { pos: [s * 0.44, 0.42, 0] });
        b.add(G.sphere(0.07), 'glow', '#fff5d6', { pos: [s * 0.24, 0.55, 1.1] }, 3);
      }
      break;
    }
    case 'sport': {
      b.add(profileExtrude([[1.2, 0.2], [1.15, 0.3, 1.22, 0.26], [0.45, 0.5, 0.8, 0.46], [0.2, 0.47], [-0.4, 0.44], [-0.95, 0.56, -0.7, 0.58], [-1.12, 0.45], [-1.12, 0.2]], 1.02, 0.08), 'paint', main);
      b.add(G.box(1.2, 0.08, 2.0), 'matte', DARK, { pos: [0, 0.19, 0] });
      for (const s of [-1, 1]) {
        b.add(G.box(0.03, 0.04, 1.6), 'glow', acc, { pos: [s * 0.52, 0.34, 0.05] }, 3);
        b.add(G.box(0.2, 0.05, 0.3), 'glow', '#ffffff', { pos: [s * 0.3, 0.32, 1.19] }, 3);
      }
      b.add(G.box(1.1, 0.04, 0.26, 0.015), 'paint', acc, { pos: [0, 0.78, -1.02] });
      for (const s of [-1, 1]) b.add(G.box(0.04, 0.24, 0.1), 'matte', DARK, { pos: [s * 0.35, 0.66, -1.0] });
      b.add(G.box(0.9, 0.05, 0.05), 'glow', '#ff1744', { pos: [0, 0.45, -1.13] }, 3);
      break;
    }
    case 'tub': {
      const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.5, 0.02), new THREE.Vector2(0.62, 0.15), new THREE.Vector2(0.66, 0.45), new THREE.Vector2(0.6, 0.47), new THREE.Vector2(0.55, 0.2), new THREE.Vector2(0.001, 0.14)];
      const tub = new THREE.LatheGeometry(pts, 28);
      b.add(tub, 'paint', '#f7f9fb', { pos: [0, 0.3, -0.05], scale: [0.95, 1, 1.55] });
      b.add(G.torus(0.62, 0.05, 8, 32), 'paint', main, { pos: [0, 0.76, -0.05], rot: [Math.PI / 2, 0, 0], scale: [0.95, 1.55, 1] });
      for (const [x, z] of [[0.5, 0.75], [-0.5, 0.75], [0.5, -0.8], [-0.5, -0.8]]) b.add(G.sphere(0.1), 'chrome', '#ffd54f', { pos: [x, 0.28, z] });
      b.add(G.cyl(0.04, 0.04, 0.35), 'chrome', CHROME, { pos: [0, 0.9, 0.85] });
      b.add(G.cyl(0.035, 0.035, 0.22), 'chrome', CHROME, { pos: [0, 1.05, 0.95], rot: [Math.PI / 2, 0, 0] });
      b.add(G.sphere(0.12), 'paint', '#ffd600', { pos: [0.42, 0.9, 0.7] });
      b.add(G.sphere(0.08), 'paint', '#ffd600', { pos: [0.42, 1.05, 0.76] });
      b.add(G.cone(0.035, 0.08, 8), 'paint', '#ff6d00', { pos: [0.42, 1.04, 0.86], rot: [Math.PI / 2, 0, 0] });
      b.add(G.box(1.0, 0.1, 1.9), 'matte', DARK, { pos: [0, 0.22, 0] });
      break;
    }
    default: {
      // standard
      b.add(profileExtrude([[1.0, 0.22], [0.95, 0.34, 1.04, 0.3], [0.4, 0.55, 0.78, 0.52], [0.24, 0.5], [-0.28, 0.42], [-0.45, 0.62, -0.42, 0.56], [-0.85, 0.6], [-1.0, 0.46, -0.98, 0.56], [-1.0, 0.22]], 0.92, 0.08), 'paint', main);
      b.add(G.box(1.08, 0.1, 1.85, 0.03), 'matte', DARK, { pos: [0, 0.2, 0] });
      b.add(G.cyl(0.08, 0.08, 1.12, 12), 'matte', DARK, { pos: [0, 0.27, 1.02], rot: [0, 0, Math.PI / 2] });
      b.add(G.cyl(0.08, 0.08, 1.12, 12), 'matte', DARK, { pos: [0, 0.3, -1.05], rot: [0, 0, Math.PI / 2] });
      for (const s of [-1, 1]) {
        b.add(G.box(0.18, 0.18, 0.62, 0.05), 'paint', acc, { pos: [s * 0.56, 0.34, 0.0] });
        b.add(G.box(0.05, 0.34, 0.08), 'matte', DARK, { pos: [s * 0.36, 0.72, -0.88] });
        b.add(G.sphere(0.065), 'glow', '#fff5d6', { pos: [s * 0.24, 0.36, 1.01] }, 3);
      }
      b.add(G.box(1.0, 0.05, 0.3, 0.02), 'paint', acc, { pos: [0, 0.9, -0.9] });
      b.add(G.box(0.55, 0.22, 0.38, 0.05), 'metal', '#5f656d', { pos: [0, 0.62, -0.72] });
      for (const e of sp.exhaust) b.add(G.cyl(0.07, 0.08, 0.32), 'chrome', CHROME, { pos: [e[0], e[1], e[2] + 0.12], rot: [Math.PI / 2, 0, 0] });
      break;
    }
  }
  // Asiento común
  const [sx, sy, sz] = sp.seat;
  b.add(G.box(0.5, 0.1, 0.46, 0.04), 'matte', SEAT, { pos: [sx, sy - 0.02, sz] });
  b.add(G.box(0.5, 0.5, 0.1, 0.04), 'matte', SEAT, { pos: [sx, sy + 0.24, sz - 0.26], rot: [-0.18, 0, 0] });
  // Columna de dirección
  const [wx, wy, wz] = sp.wheel;
  b.add(G.cyl(0.025, 0.025, 0.42, 8), 'metal', '#777', { pos: [wx, wy - 0.16, wz + 0.16], rot: [-0.9, 0, 0] });
}

export class KartModel {
  constructor(kartDef, character) {
    const type = kartDef.body || 'standard';
    const spec = SPECS[type] || SPECS.standard;
    this.spec = spec;
    this.type = type;
    const c = character.colors;
    const colors = { main: c.outfit, accent: c.accent };
    const mats = sharedMaterials();
    this.root = new THREE.Group();
    this.root.name = `kart-${type}`;
    this.body = new THREE.Group();
    this.root.add(this.body);

    const b = new ModelBuilder();
    buildBody(type, b, colors);
    const bodyMeshes = b.build(mats);
    this.body.add(bodyMeshes);

    // Volante
    const sb = new ModelBuilder();
    sb.add(G.torus(0.16, 0.028, 8, 20), 'matte', '#222');
    sb.add(G.box(0.3, 0.03, 0.03), 'matte', '#333');
    sb.add(G.cyl(0.05, 0.05, 0.04, 10), 'paint', colors.accent, { rot: [Math.PI / 2, 0, 0] });
    this.steering = sb.build(mats);
    // El aro está en el plano XY (normal +Z); el pivote lo inclina hacia el piloto.
    this.steeringPivot = new THREE.Group();
    this.steeringPivot.position.set(...spec.wheel);
    this.steeringPivot.rotation.x = -2.44;
    this.steeringPivot.add(this.steering);
    this.body.add(this.steeringPivot);

    // Ruedas
    this.wheels = [];
    const style = spec.wheelStyle || 'normal';
    const rimColor = style === 'neon' ? c.accent : CHROME;
    const defs = [
      { x: spec.track / 2, z: spec.wb / 2, r: spec.rf, w: spec.wf, front: true },
      { x: -spec.track / 2, z: spec.wb / 2, r: spec.rf, w: spec.wf, front: true },
      { x: spec.track / 2, z: -spec.wb / 2, r: spec.rr, w: spec.wr, front: false },
      { x: -spec.track / 2, z: -spec.wb / 2, r: spec.rr, w: spec.wr, front: false },
    ];
    for (const d of defs) {
      const pivot = new THREE.Group();
      pivot.position.set(d.x, d.r, d.z);
      const spin = wheelModel(d.r, d.w, rimColor, style);
      pivot.add(spin);
      this.root.add(pivot);
      this.wheels.push({ pivot, spin, radius: d.r, front: d.front, baseY: d.r, x: d.x, z: d.z });
    }

    // Llamas de turbo en los escapes
    this.flames = [];
    const flameGeo = G.cone(0.13, 0.7, 10);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -0.35);
    const inner = G.cone(0.07, 0.45, 8);
    inner.rotateX(-Math.PI / 2);
    inner.translate(0, 0, -0.22);
    this.flameMatOuter = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6d00').multiplyScalar(2.2), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    this.flameMatInner = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3b0').multiplyScalar(2.6), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    this.exhausts = spec.exhaust.map((e) => new THREE.Vector3(e[0], e[1], e[2]));
    for (const e of this.exhausts) {
      const f = new THREE.Group();
      f.position.copy(e);
      f.add(new THREE.Mesh(flameGeo, this.flameMatOuter));
      f.add(new THREE.Mesh(inner, this.flameMatInner));
      f.visible = false;
      this.body.add(f);
      this.flames.push(f);
    }
    this.seat = new THREE.Vector3(...spec.seat);
    this.wheelSpin = 0;
    this.root.traverse((o) => {
      if (o.isMesh && o.material !== this.flameMatOuter && o.material !== this.flameMatInner) o.castShadow = true;
    });
  }

  /** Anima ruedas, dirección y llamas. */
  animate(dt, { speed = 0, steer = 0, boost = 0, boostColor = null, time = 0 }) {
    this.wheelSpin += (speed * dt) / 0.3;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin * (0.3 / w.radius);
      if (w.front) w.pivot.rotation.y = -steer * 0.42;
    }
    this.steering.rotation.z = steer * 1.2;
    const on = boost > 0;
    for (const f of this.flames) {
      f.visible = on;
      if (on) {
        const flick = 0.75 + Math.sin(time * 60 + f.position.x * 10) * 0.18 + Math.random() * 0.15;
        f.scale.set(0.9 + boost * 0.3, 0.9 + boost * 0.3, (0.8 + boost * 0.9) * flick);
      }
    }
    if (boostColor) {
      this.flameMatOuter.color.copy(boostColor);
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.flameMatOuter.dispose();
    this.flameMatInner.dispose();
  }
}

export { SPECS as KART_SPECS };
