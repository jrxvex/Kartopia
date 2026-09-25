// Modelos de objetos: cajas de objetos (instanciadas), orbes, trampa, bomba, cristales,
// burbuja escudo (shader fresnel) y dron de rescate.
import * as THREE from 'three';
import { TextureFactory } from '../render/TextureFactory.js';
import { ModelBuilder, sharedMaterials, G } from './ModelBuilder.js';

export class ItemBoxesMesh {
  constructor(count) {
    const tex = TextureFactory.itemBox();
    this.outerMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: tex,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.innerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.6), transparent: true, opacity: 0.6, depthWrite: false });
    const outerGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const innerGeo = new THREE.IcosahedronGeometry(0.42, 0);
    this.outer = new THREE.InstancedMesh(outerGeo, this.outerMat, count);
    this.inner = new THREE.InstancedMesh(innerGeo, this.innerMat, count);
    this.outer.renderOrder = 5;
    this.inner.renderOrder = 4;
    this.group = new THREE.Group();
    this.group.add(this.inner, this.outer);
    this.group.name = 'item-boxes';
    this.scales = new Float32Array(count).fill(1);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  update(boxes, time, dt) {
    boxes.forEach((b, i) => {
      const target = b.active ? 1 : 0;
      const sc = this.scales[i] + (target - this.scales[i]) * Math.min(1, dt * (b.active ? 5 : 18));
      this.scales[i] = sc;
      const bob = Math.sin(time * 2 + b.phase) * 0.18;
      this.p.set(b.x, b.y + bob, b.z);
      this.e.set(time * 0.7 + b.phase, time * 1.1 + b.phase, 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(Math.max(0.0001, sc));
      this.m.compose(this.p, this.q, this.s);
      this.outer.setMatrixAt(i, this.m);
      this.e.set(-time * 1.6, time * 2.2, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p, this.q, this.s);
      this.inner.setMatrixAt(i, this.m);
      this.c.setHSL((time * 0.25 + i * 0.13) % 1, 0.9, 0.6);
      this.inner.setColorAt(i, this.c);
    });
    this.outer.instanceMatrix.needsUpdate = true;
    this.inner.instanceMatrix.needsUpdate = true;
    if (this.inner.instanceColor) this.inner.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.outer.geometry.dispose();
    this.inner.geometry.dispose();
    this.outerMat.dispose();
    this.innerMat.dispose();
  }
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

const templates = new Map();

/**
 * Crea el mesh visual de una entidad de objeto según su visualType. Cada tipo se construye una
 * vez y después se clona (geometrías y materiales compartidos: nada nuevo que subir a la GPU).
 */
export function createItemMesh(type) {
  if (!templates.has(type)) {
    const t = buildItemMesh(type);
    t.traverse((o) => {
      if (o.isMesh) o.geometry.userData.shared = true;
    });
    templates.set(type, t);
  }
  return templates.get(type).clone();
}

/** Tipos de objeto con modelo propio (para precompilar sus shaders). */
export const ITEM_VISUALS = ['pulse-orb', 'seeker-orb', 'goo-trap', 'blast-bomb', 'orbit-crystal'];

function buildItemMesh(type) {
  const mats = sharedMaterials();
  const g = new THREE.Group();
  switch (type) {
    case 'pulse-orb': {
      const core = cached('pulseCore', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#76ff03').multiplyScalar(2.2) }));
      const shell = cached('pulseShell', () => new THREE.MeshStandardMaterial({ color: '#1b5e20', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.3, emissive: new THREE.Color('#64dd17'), emissiveIntensity: 0.6 }));
      g.add(new THREE.Mesh(G.ico(0.32, 1), core));
      g.add(new THREE.Mesh(G.ico(0.62, 1), shell));
      const ring = new THREE.Mesh(G.torus(0.72, 0.05, 6, 24), core);
      ring.name = 'ring';
      g.add(ring);
      break;
    }
    case 'seeker-orb': {
      const core = cached('seekCore', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1744').multiplyScalar(2.2) }));
      const shell = cached('seekShell', () => new THREE.MeshStandardMaterial({ color: '#b71c1c', roughness: 0.25, metalness: 0.5, emissive: new THREE.Color('#ff1744'), emissiveIntensity: 0.5 }));
      g.add(new THREE.Mesh(G.ico(0.36, 1), core));
      const sh = new THREE.Mesh(G.ico(0.62, 0), shell);
      sh.name = 'ring';
      g.add(sh);
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(G.cone(0.12, 0.4, 6), shell);
        const a = (i / 6) * Math.PI * 2;
        sp.position.set(Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65);
        sp.rotation.z = -Math.PI / 2;
        sp.rotation.y = -a;
        sh.add(sp);
      }
      break;
    }
    case 'goo-trap': {
      const goo = cached('goo', () => new THREE.MeshStandardMaterial({ color: '#8e24aa', roughness: 0.15, metalness: 0.1, emissive: new THREE.Color('#4a148c'), emissiveIntensity: 0.4 }));
      const geo = cached('gooGeo', () => {
        const gg = new THREE.SphereGeometry(1, 20, 12);
        const p = gg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          const z = p.getZ(i);
          const f = 1 + Math.sin(x * 5) * 0.08 + Math.cos(z * 6) * 0.08;
          p.setXYZ(i, x * f, p.getY(i) * 0.35, z * f);
        }
        gg.computeVertexNormals();
        return gg;
      });
      const blob = new THREE.Mesh(geo, goo);
      blob.scale.setScalar(1.05);
      blob.name = 'ring';
      g.add(blob);
      const b = new ModelBuilder();
      for (const s of [-1, 1]) {
        b.add(G.sphere(0.2, 12, 8), 'eye', '#ffffff', { pos: [s * 0.3, 0.38, 0.35] });
        b.add(G.sphere(0.09, 8, 6), 'eye', '#111111', { pos: [s * 0.3, 0.4, 0.52] });
      }
      g.add(b.build(mats, { castShadow: false }));
      break;
    }
    case 'blast-bomb': {
      const b = new ModelBuilder();
      b.add(G.sphere(0.72, 18, 14), 'paint', '#1c1c24');
      b.add(G.torus(0.72, 0.06, 6, 24), 'chrome', '#b0bec5', { rot: [Math.PI / 2, 0, 0] });
      b.add(G.cyl(0.18, 0.2, 0.25, 10), 'metal', '#90a4ae', { pos: [0, 0.75, 0] });
      b.add(G.cyl(0.03, 0.03, 0.35, 5), 'matte', '#d7ccc8', { pos: [0.05, 1.0, 0], rot: [0, 0, -0.3] });
      for (const s of [-1, 1]) b.add(G.sphere(0.12, 8, 6), 'eye', '#ffffff', { pos: [s * 0.24, 0.15, 0.64] });
      g.add(b.build(mats));
      const spark = new THREE.Mesh(G.sphere(0.12, 8, 6), cached('spark', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffea00').multiplyScalar(3) })));
      spark.position.set(0.12, 1.18, 0);
      spark.name = 'spark';
      g.add(spark);
      const warn = new THREE.Mesh(G.sphere(0.76, 16, 12), cached('bombWarn', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1744').multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false })));
      warn.name = 'warn';
      g.add(warn);
      break;
    }
    case 'orbit-crystal': {
      const m = cached('crystal', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#18ffff').multiplyScalar(2.2) }));
      const c = new THREE.Mesh(G.octa(0.45), m);
      c.scale.set(0.8, 1.4, 0.8);
      c.name = 'ring';
      g.add(c);
      break;
    }
    default:
      g.add(new THREE.Mesh(G.sphere(0.5), mats.matte));
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

/** Burbuja del escudo con efecto fresnel. */
export function createShieldBubble() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#40c4ff') }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
        float bands = 0.5 + 0.5 * sin(vN.y * 18.0 + uTime * 4.0);
        vec3 col = uColor * (f * 2.2 + bands * 0.12);
        gl_FragColor = vec4(col, (f * 0.9 + 0.08) * uAlpha);
      }
    `,
  });
  if (!shieldGeo) {
    shieldGeo = new THREE.SphereGeometry(1.7, 28, 18);
    shieldGeo.userData.shared = true;
  }
  const mesh = new THREE.Mesh(shieldGeo, mat);
  mesh.position.y = 0.75;
  mesh.renderOrder = 10;
  return mesh;
}
let shieldGeo = null;

/** Dron de rescate que recoge al kart tras una caída. */
let droneTemplate = null;
/** Dron de rescate (una sola geometría compartida por todos los karts). */
export function createRescueDrone() {
  if (!droneTemplate) {
    droneTemplate = buildRescueDrone();
    droneTemplate.traverse((o) => {
      if (o.isMesh) o.geometry.userData.shared = true;
    });
  }
  return droneTemplate.clone();
}

function buildRescueDrone() {
  const b = new ModelBuilder();
  b.add(G.sphere(0.5, 16, 12), 'paint', '#ffca28', { scale: [1.2, 0.7, 1.2] });
  b.add(G.box(0.9, 0.08, 0.08), 'matte', '#37474f', { pos: [0, 0.3, 0] });
  b.add(G.box(0.08, 0.08, 0.9), 'matte', '#37474f', { pos: [0, 0.3, 0] });
  for (const [x, z] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) b.add(G.cyl(0.35, 0.35, 0.02, 12), 'glass', '#b0bec5', { pos: [x, 0.36, z] });
  b.add(G.cyl(0.02, 0.02, 1.4, 4), 'matte', '#424242', { pos: [0, -0.9, 0] });
  b.add(G.torus(0.2, 0.03, 6, 12), 'chrome', '#cfd8dc', { pos: [0, -1.6, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(G.sphere(0.12, 8, 6), 'glow', '#76ff03', { pos: [0, -0.1, 0.55] }, 3);
  const g = b.build(sharedMaterials());
  return g;
}
