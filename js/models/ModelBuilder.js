// Utilidad para construir modelos procedurales: acumula piezas con color por vértice y las
// fusiona en una malla por material (pocas llamadas de dibujo por modelo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export class ModelBuilder {
  constructor() {
    this.parts = new Map();
  }

  /**
   * Añade una geometría.
   * @param {THREE.BufferGeometry} geo
   * @param {string} key material ('paint','matte','chrome','rubber','glow','skin','eye',...)
   * @param {string|number|THREE.Color} color
   * @param {object} t {pos:[x,y,z], rot:[x,y,z], scale:number|[x,y,z]}
   * @param {number} intensity multiplicador del color (colores HDR para brillo)
   */
  add(geo, key, color, t = {}, intensity = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (!g.attributes.normal) g.computeVertexNormals();
    _p.set(...(t.pos || [0, 0, 0]));
    _e.set(...(t.rot || [0, 0, 0]));
    _q.setFromEuler(_e);
    if (Array.isArray(t.scale)) _s.set(...t.scale);
    else _s.setScalar(t.scale ?? 1);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (t.matrix) g.applyMatrix4(t.matrix);
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r * intensity;
      col[i * 3 + 1] = _c.g * intensity;
      col[i * 3 + 2] = _c.b * intensity;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return g;
  }

  /** Construye un grupo con una malla por material. */
  build(materials, { castShadow = true, receiveShadow = false } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mat = materials[key] || materials.default;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow && key !== 'glow';
      mesh.receiveShadow = receiveShadow;
      mesh.name = key;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }

  /** Devuelve la geometría fusionada (para InstancedMesh). */
  buildGeometry() {
    const all = [];
    for (const list of this.parts.values()) all.push(...list);
    const merged = mergeGeometries(all, false);
    for (const g of all) g.dispose();
    this.parts.clear();
    return merged;
  }
}

/** Materiales compartidos para modelos con color por vértice. */
let shared = null;
export function sharedMaterials() {
  if (shared) return shared;
  shared = {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.3 }),
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 1.0 }),
    rubber: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }),
    skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 }),
    fur: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
  };
  shared.default = shared.matte;
  return shared;
}

// Geometrías base reutilizables
export const G = {
  box: (w, h, d, r = 0) => (r > 0 ? roundedBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d)),
  sphere: (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs),
  cyl: (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg),
  cone: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg),
  torus: (r, t, rs = 8, ts = 20) => new THREE.TorusGeometry(r, t, rs, ts),
  capsule: (r, l, cs = 6, rs = 12) => new THREE.CapsuleGeometry(r, l, cs, rs),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dodeca: (r, d = 0) => new THREE.DodecahedronGeometry(r, d),
  octa: (r) => new THREE.OctahedronGeometry(r, 0),
};

/** Caja con aristas redondeadas (extrusión con bisel). */
export function roundedBox(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const shape = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  const ww = w - 2 * r;
  const hh = h - 2 * r;
  shape.moveTo(x, y - r);
  shape.lineTo(x + ww, y - r);
  shape.quadraticCurveTo(x + ww + r, y - r, x + ww + r, y);
  shape.lineTo(x + ww + r, y + hh);
  shape.quadraticCurveTo(x + ww + r, y + hh + r, x + ww, y + hh + r);
  shape.lineTo(x, y + hh + r);
  shape.quadraticCurveTo(x - r, y + hh + r, x - r, y + hh);
  shape.lineTo(x - r, y);
  shape.quadraticCurveTo(x - r, y - r, x, y - r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * r,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r * 0.98,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.translate(0, 0, -(d - 2 * r) / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Extruye un perfil lateral (z,y) a lo ancho (eje X), centrado. */
export function profileExtrude(points, width, bevel = 0.06, curveSegments = 10) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.length === 4) shape.quadraticCurveTo(p[2], p[3], p[0], p[1]);
    else shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  const depth = Math.max(0.01, width - 2 * bevel);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments,
  });
  // forma en (x=z_mundo, y) extruida en z → rotar para que la extrusión vaya en X
  geo.rotateY(-Math.PI / 2);
  geo.translate(depth / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Neumático por revolución (perfil redondeado) orientado en el eje X. */
export function tireGeometry(radius, width, knobby = false) {
  const pts = [];
  const r0 = radius * 0.62;
  const hw = width / 2;
  const bulge = width * 0.28;
  pts.push(new THREE.Vector2(r0, -hw));
  pts.push(new THREE.Vector2(radius - bulge, -hw));
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(radius - bulge + Math.cos(a) * bulge, Math.sin(a) * hw));
  }
  pts.push(new THREE.Vector2(r0, hw));
  const geo = new THREE.LatheGeometry(pts, knobby ? 16 : 22);
  geo.rotateZ(Math.PI / 2);
  return geo;
}
