// Fusiona un modelo jerárquico (kart + piloto) en una sola malla con esqueleto. Cada grupo que se
// anima por separado (ruedas, volante, torso, cabeza, brazos...) pasa a ser un hueso, así que el
// conjunto se dibuja con una única llamada en lugar de ~30 sin perder ninguna animación. Los
// parámetros de los materiales compartidos (rugosidad, metalicidad y brillo propio) viajan como
// atributos por vértice de un material "uber" común a todos los karts.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _rootInv = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _v = new THREE.Vector3();

const VERTEX_PARS = /* glsl */ `#include <common>
attribute vec4 pbr;
varying vec3 vPbr;`;

// Un solo hueso por vértice: 4 lecturas de la textura de huesos en lugar de 16.
const SKINBASE = /* glsl */ `#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
#endif`;
const SKINNORMAL = /* glsl */ `#ifdef USE_SKINNING
	mat4 skinMatrix = bindMatrixInverse * boneMatX * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`;
const SKINNING = /* glsl */ `#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	transformed = ( bindMatrixInverse * ( boneMatX * skinVertex ) ).xyz;
#endif`;

function patchUber(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTEX_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPbr = pbr.xyz;')
      .replace('#include <skinbase_vertex>', SKINBASE)
      .replace('#include <skinnormal_vertex>', SKINNORMAL)
      .replace('#include <skinning_vertex>', SKINNING);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPbr;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n\tvec3 glowColor = diffuseColor.rgb * vPbr.z;\n\tdiffuseColor.rgb *= 1.0 - vPbr.z;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vPbr.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = vPbr.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += glowColor;');
  };
  material.customProgramCacheKey = () => 'kartopia-uber-rig-1';
  return material;
}

const uberCache = new Map();
/** Material uber compartido (opaco, translúcido o fantasma). */
export function uberMaterial({ opacity = 1, ghost = false } = {}) {
  const key = `${opacity}|${ghost}`;
  let mat = uberCache.get(key);
  if (!mat) {
    const transparent = ghost || opacity < 1;
    mat = patchUber(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        transparent,
        opacity: ghost ? 0.38 : opacity,
        depthWrite: !ghost,
      }),
    );
    uberCache.set(key, mat);
  }
  return mat;
}

/** ¿Puede esta malla fusionarse? (materiales compartidos con color por vértice) */
function mergeable(o) {
  const m = o.material;
  return o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && m && !Array.isArray(m) && m.vertexColors && !m.map && o.geometry.attributes.color;
}

/**
 * Sustituye todas las mallas fusionables bajo `root` por una malla con esqueleto (más una segunda
 * para las piezas translúcidas, si las hay). Los grupos padre de cada pieza se convierten en huesos
 * y siguen animándose igual que antes. Las mallas nuevas cuelgan de `parent` (que debe estar en
 * reposo respecto a `root`, p. ej. el propio `root`). Devuelve las mallas creadas.
 */
export function mergeRig(root, { ghost = false, castShadow = true, parent = root } = {}) {
  root.updateMatrixWorld(true);
  _rootInv.copy(root.matrixWorld).invert();
  const meshes = [];
  root.traverse((o) => {
    if (mergeable(o)) meshes.push(o);
  });
  if (!meshes.length) return [];

  const bones = [];
  const boneIndex = new Map();
  const buckets = new Map(); // opacidad → piezas
  for (const mesh of meshes) {
    const bone = mesh.parent;
    if (!boneIndex.has(bone)) {
      boneIndex.set(bone, bones.length);
      bones.push(bone);
    }
    const mat = mesh.material;
    const opacity = mat.transparent ? mat.opacity : 1;
    if (!buckets.has(opacity)) buckets.set(opacity, []);
    buckets.get(opacity).push(mesh);
  }
  // Inversas de los huesos en el espacio de la raíz (pose de reposo)
  const boneInverses = bones.map((b) => new THREE.Matrix4().multiplyMatrices(_rootInv, b.matrixWorld).invert());
  const skeleton = new THREE.Skeleton(bones, boneInverses);

  const out = [];
  for (const [opacity, list] of buckets) {
    let vcount = 0;
    let icount = 0;
    for (const mesh of list) {
      const g = mesh.geometry;
      vcount += g.attributes.position.count;
      icount += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(vcount * 3);
    const nor = new Float32Array(vcount * 3);
    const col = new Float32Array(vcount * 3);
    const pbr = new Uint8Array(vcount * 4);
    const skinIndex = new Uint8Array(vcount * 4);
    const skinWeight = new Uint8Array(vcount * 4);
    const index = new (vcount > 65535 ? Uint32Array : Uint16Array)(icount);
    let v = 0;
    let ii = 0;
    for (const mesh of list) {
      const g = mesh.geometry;
      const P = g.attributes.position;
      const N = g.attributes.normal;
      const C = g.attributes.color;
      const idx = g.index;
      const base = v;
      _m.multiplyMatrices(_rootInv, mesh.matrixWorld);
      _n.getNormalMatrix(_m);
      const mat = mesh.material;
      const glow = mat.isMeshBasicMaterial ? 1 : 0;
      const rough = Math.round((glow ? 1 : mat.roughness ?? 1) * 255);
      const metal = Math.round((glow ? 0 : mat.metalness ?? 0) * 255);
      const bi = boneIndex.get(mesh.parent);
      for (let i = 0; i < P.count; i++, v++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(_m);
        pos[v * 3] = _v.x;
        pos[v * 3 + 1] = _v.y;
        pos[v * 3 + 2] = _v.z;
        if (N) {
          _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
          nor[v * 3] = _v.x;
          nor[v * 3 + 1] = _v.y;
          nor[v * 3 + 2] = _v.z;
        }
        col[v * 3] = C.getX(i);
        col[v * 3 + 1] = C.getY(i);
        col[v * 3 + 2] = C.getZ(i);
        pbr[v * 4] = rough;
        pbr[v * 4 + 1] = metal;
        pbr[v * 4 + 2] = glow * 255;
        skinIndex[v * 4] = bi;
        skinWeight[v * 4] = 255;
      }
      const n = idx ? idx.count : P.count;
      const flip = _m.determinant() < 0;
      for (let i = 0; i < n; i += 3) {
        const a = idx ? idx.getX(i) : i;
        const b = idx ? idx.getX(i + 1) : i + 1;
        const c = idx ? idx.getX(i + 2) : i + 2;
        index[ii++] = base + a;
        index[ii++] = base + (flip ? c : b);
        index[ii++] = base + (flip ? b : c);
      }
      mesh.removeFromParent();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('pbr', new THREE.BufferAttribute(pbr, 4, true));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4, true));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(geo, uberMaterial({ opacity, ghost }));
    mesh.name = opacity < 1 ? 'rig-glass' : 'rig';
    mesh.userData.rig = true;
    mesh.castShadow = castShadow && !ghost;
    mesh.bind(skeleton, new THREE.Matrix4());
    // Esfera de recorte generosa (saltos, trucos y volteos mueven los huesos respecto al reposo)
    mesh.boundingSphere = geo.boundingSphere.clone();
    mesh.boundingSphere.radius += 1.6;
    if (opacity < 1) mesh.renderOrder = 2;
    parent.add(mesh);
    out.push(mesh);
  }
  return out;
}

/**
 * Une los esqueletos de varios modelos fusionados (p. ej. todos los karts de la carrera) en uno
 * solo: una única textura de huesos que subir a la GPU por frame en lugar de una por modelo.
 * @param {THREE.SkinnedMesh[][]} rigs mallas devueltas por mergeRig para cada modelo
 */
export function shareSkeleton(rigs) {
  const list = rigs.filter((meshes) => meshes && meshes.length);
  const count = list.reduce((n, meshes) => n + meshes[0].skeleton.bones.length, 0);
  if (count > 255 || list.length < 2) return null; // skinIndex es Uint8
  const bones = [];
  const inverses = [];
  const old = new Set();
  for (const meshes of list) {
    const sk = meshes[0].skeleton;
    const offset = bones.length;
    bones.push(...sk.bones);
    inverses.push(...sk.boneInverses);
    old.add(sk);
    for (const m of meshes) {
      const si = m.geometry.attributes.skinIndex;
      if (offset) {
        for (let i = 0; i < si.count; i++) si.setX(i, si.getX(i) + offset);
        si.needsUpdate = true;
      }
    }
  }
  const shared = new THREE.Skeleton(bones, inverses);
  for (const meshes of list) for (const m of meshes) m.bind(shared, m.bindMatrix);
  for (const sk of old) sk.dispose();
  return shared;
}

/** Libera la geometría y el esqueleto de las mallas creadas por mergeRig. */
export function disposeRig(meshes) {
  const skeletons = new Set();
  for (const m of meshes) {
    m.geometry.dispose();
    if (m.skeleton) skeletons.add(m.skeleton);
    m.removeFromParent();
  }
  for (const s of skeletons) s.dispose();
}
