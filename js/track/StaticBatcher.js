// Agrupa la geometría estática de un circuito en pocas mallas: las piezas que comparten material
// (o materiales equivalentes) se fusionan por celdas del mapa, conservando el recorte por cámara.
// Los objetos animados se detectan solos ejecutando las animaciones con varios tiempos de prueba
// (o se marcan con userData.dynamic): sus piezas se fusionan solo entre ellas, dentro del propio
// objeto animado, así que se siguen moviendo igual. userData.noBatch deja un objeto intacto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SAMPLE_TIMES = [0.37, 1.23, 2.71, 4.19, 5.83, 7.07, 9.91, 13.3, 17.9, 23.5];
const _sphere = new THREE.Sphere();
const _inv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();

const materialsOf = (o) => (!o.material ? [] : Array.isArray(o.material) ? o.material : [o.material]);

function materialState(m) {
  return [m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.opacity, m.visible, m.map?.offset.x, m.map?.offset.y].join('|');
}

/** Objetos cuya transformación o visibilidad cambia (y materiales que cambian) al animar. */
function detectAnimated(root, animators) {
  const snap = new Map();
  const mats = new Map();
  root.traverse((o) => {
    snap.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), v: o.visible });
    for (const m of materialsOf(o)) if (!mats.has(m)) mats.set(m, materialState(m));
  });
  const moved = new Set();
  const animatedMats = new Set();
  for (const t of SAMPLE_TIMES) {
    for (const fn of animators) fn(0.21, t);
    for (const [o, st] of snap) {
      if (!o.position.equals(st.p) || !o.quaternion.equals(st.q) || !o.scale.equals(st.s) || o.visible !== st.v) moved.add(o);
    }
    for (const [m, st] of mats) if (materialState(m) !== st) animatedMats.add(m);
  }
  for (const [o, st] of snap) {
    o.position.copy(st.p);
    o.quaternion.copy(st.q);
    o.scale.copy(st.s);
    o.visible = st.v;
  }
  return { moved, animatedMats };
}

function colorKey(c) {
  return c ? `${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)}` : '-';
}

const MAT_PROPS = ['type', 'transparent', 'opacity', 'depthWrite', 'depthTest', 'side', 'vertexColors', 'flatShading', 'fog', 'blending', 'toneMapped', 'alphaTest', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'wireframe', 'roughness', 'metalness', 'emissiveIntensity', 'envMapIntensity', 'colorWrite', 'premultipliedAlpha', 'alphaToCoverage', 'visible'];
const MAT_TEX = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'lightMap', 'bumpMap', 'envMap'];

/** Clave de equivalencia de un material "normal" (dos materiales con la misma clave se dibujan igual). */
function materialKey(m, protectedMats) {
  if (protectedMats.has(m) || m.isShaderMaterial || m.isRawShaderMaterial || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.userData.noBatch) return `uuid:${m.uuid}`;
  const parts = [];
  for (const k of MAT_PROPS) parts.push(m[k]);
  parts.push(colorKey(m.color), colorKey(m.emissive), colorKey(m.specular));
  for (const k of MAT_TEX) parts.push(m[k] ? m[k].uuid : '-');
  return parts.join('|');
}

function attributeKey(g) {
  if (g.morphAttributes && Object.keys(g.morphAttributes).length) return null;
  const parts = [];
  for (const name of Object.keys(g.attributes).sort()) {
    const a = g.attributes[name];
    if (a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute) return null;
    parts.push(`${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`);
  }
  return parts.join(',');
}

/**
 * Fusiona las mallas estáticas bajo `root` (que debe estar en el origen del mundo).
 * @param {THREE.Object3D} root
 * @param {object} opts
 * @param {Function[]} opts.animators funciones (dt, t) que animan partes del circuito
 * @param {number} opts.cell tamaño de celda en metros para agrupar
 * @param {number} opts.maxRadius las piezas más grandes que esto se agrupan sin celdas
 * @returns {{before:number, after:number, merged:number}} número de mallas antes y después
 */
export function batchStatic(root, { animators = [], cell = 320, maxRadius = 200 } = {}) {
  const { moved, animatedMats } = detectAnimated(root, animators);
  root.updateMatrixWorld(true);

  // Ancla de cada objeto: el antepasado animado más cercano (o la raíz). null = no tocar.
  const anchorOf = new Map();
  const walk = (o, anchor, skip) => {
    const a = o !== root && (moved.has(o) || o.userData.dynamic) ? o : anchor;
    const s = skip || !o.visible || !!o.userData.noBatch;
    anchorOf.set(o, s ? null : a);
    for (const c of o.children) walk(c, a, s);
  };
  walk(root, root, false);
  // Materiales que no deben sustituirse por equivalentes: los animados y los de objetos animados
  const protectedMats = new Set(animatedMats);
  root.traverse((o) => {
    if (anchorOf.get(o) !== root) for (const m of materialsOf(o)) protectedMats.add(m);
  });

  const groups = new Map();
  const canonical = new Map(); // clave de material → primer material con esa clave
  let before = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    before++;
    const anchor = anchorOf.get(o);
    if (!anchor || anchor === o) return;
    if (o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || Array.isArray(o.material) || !o.material || o.children.length) return;
    if (!o.frustumCulled || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || o.layers.mask !== 1) return;
    const m = o.material;
    // translúcidos con escritura de profundidad: el orden entre piezas importa, no se tocan
    if (m.transparent && m.depthWrite && m.blending !== THREE.AdditiveBlending) return;
    const g = o.geometry;
    if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return;
    const ak = attributeKey(g);
    if (!ak || !g.attributes.position) return;
    const inDynamic = anchor !== root;
    const mk = inDynamic ? `uuid:${m.uuid}` : materialKey(m, protectedMats);
    if (!canonical.has(mk)) canonical.set(mk, m);
    let where;
    if (inDynamic) where = `a${anchor.id}`;
    else {
      if (!g.boundingSphere) g.computeBoundingSphere();
      _sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      where = _sphere.radius > maxRadius ? 'big' : `${Math.floor(_sphere.center.x / cell)},${Math.floor(_sphere.center.z / cell)}`;
    }
    const key = `${mk}#${ak}#${o.castShadow}${o.receiveShadow}${o.renderOrder}#${where}`;
    let grp = groups.get(key);
    if (!grp) groups.set(key, (grp = { anchor, material: canonical.get(mk), meshes: [] }));
    grp.meshes.push(o);
  });

  let merged = 0;
  const center = new THREE.Vector3();
  for (const grp of groups.values()) {
    if (grp.meshes.length < 2) continue;
    const anchor = grp.anchor;
    _inv.copy(anchor.matrixWorld).invert();
    const geos = [];
    const box = new THREE.Box3();
    for (const o of grp.meshes) {
      const g = o.geometry.clone();
      _rel.multiplyMatrices(_inv, o.matrixWorld);
      g.applyMatrix4(_rel);
      if (!g.index) {
        const n = g.attributes.position.count;
        const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      // escala negativa: invertir el orden de los vértices para conservar la cara frontal
      if (_rel.determinant() < 0) {
        const ix = g.index;
        for (let i = 0; i < ix.count; i += 3) {
          const b = ix.getX(i + 1);
          ix.setX(i + 1, ix.getX(i + 2));
          ix.setX(i + 2, b);
        }
      }
      g.clearGroups();
      g.computeBoundingBox();
      box.union(g.boundingBox);
      geos.push(g);
    }
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!geo) continue;
    // Geometría relativa al centro del grupo (orden de transparencias y precisión)
    box.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    geo.computeBoundingSphere();
    const first = grp.meshes[0];
    const mesh = new THREE.Mesh(geo, grp.material);
    mesh.name = 'batch';
    mesh.position.copy(center);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    for (const o of grp.meshes) o.removeFromParent();
    anchor.add(mesh);
    merged++;
  }

  // Grupos vacíos que ya no contienen nada
  const prune = (o) => {
    for (const c of [...o.children]) prune(c);
    if (o !== root && o.type === 'Group' && o.children.length === 0 && anchorOf.get(o) === root) o.removeFromParent();
  };
  prune(root);
  root.updateMatrixWorld(true);

  let after = 0;
  root.traverse((o) => {
    if (o.isMesh) after++;
  });
  return { before, after, merged };
}
