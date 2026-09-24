// Decoración instanciada: cada tipo de objeto se construye una vez (geometría con color por
// vértice, estilo low-poly) y se dibuja con InstancedMesh (una llamada por capa y tipo).
import * as THREE from 'three';
import { ModelBuilder, G, sharedMaterials } from './ModelBuilder.js';
import { Random } from '../core/Random.js';

const geoCache = new Map();

function rockGeo(r, seed, detail = 1) {
  const geo = new THREE.DodecahedronGeometry(r, detail);
  const pos = geo.attributes.position;
  const rng = new Random(seed);
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, rng.range(0.78, 1.18));
    const f = map.get(key);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.8, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Devuelve capas [{geo, mat:'matte'|'glow'|..., shadow}] para un tipo. */
function build(type, theme) {
  const layers = [];
  const b = new ModelBuilder();
  const glow = new ModelBuilder();
  const g = theme.ground || {};
  const leaf = (g.grass && g.grass[1]) || '#3f8f3a';
  const leaf2 = (g.grass && g.grass[0]) || '#57a845';
  let mat = 'matte';
  let shadow = true;
  switch (type) {
    case 'tree': {
      b.add(G.cyl(0.28, 0.42, 3.6, 7), 'matte', '#6d4c35', { pos: [0, 1.8, 0] });
      b.add(G.ico(2.1, 1), 'matte', leaf, { pos: [0, 4.6, 0], scale: [1, 0.9, 1] });
      b.add(G.ico(1.6, 1), 'matte', leaf2, { pos: [0.9, 5.6, 0.3] });
      b.add(G.ico(1.5, 1), 'matte', leaf, { pos: [-0.8, 5.3, -0.5] });
      b.add(G.ico(1.3, 1), 'matte', leaf2, { pos: [0.1, 6.4, -0.2] });
      break;
    }
    case 'pine':
    case 'snowPine': {
      const snow = type === 'snowPine';
      b.add(G.cyl(0.22, 0.32, 2.4, 6), 'matte', '#5d4037', { pos: [0, 1.2, 0] });
      const col = snow ? '#2e6b4f' : '#2f7d4a';
      for (let i = 0; i < 4; i++) {
        const r = 2.2 - i * 0.45;
        b.add(G.cone(r, 2.6, 8), 'matte', col, { pos: [0, 2.6 + i * 1.6, 0] });
        if (snow) b.add(G.cone(r * 0.72, 1.2, 8), 'matte', '#f4f8fb', { pos: [0, 3.35 + i * 1.6, 0] });
      }
      break;
    }
    case 'palm': {
      let x = 0;
      let y = 0;
      for (let i = 0; i < 6; i++) {
        const seg = G.cyl(0.24 - i * 0.02, 0.28 - i * 0.02, 1.6, 7);
        b.add(seg, 'matte', i % 2 ? '#8d6e4f' : '#7a5c40', { pos: [x, y + 0.8, 0], rot: [0, 0, -0.08 - i * 0.03] });
        x += 0.12 + i * 0.05;
        y += 1.55;
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const lf = G.cone(0.5, 3.4, 4);
        lf.rotateX(Math.PI / 2);
        lf.translate(0, 0, 1.7);
        b.add(lf, 'matte', i % 2 ? '#43a047' : '#2e7d32', { pos: [x, y + 0.2, 0], rot: [0.45, a, 0], scale: [1, 0.25, 1] });
      }
      for (let i = 0; i < 3; i++) b.add(G.sphere(0.22, 8, 6), 'matte', '#6d4c2e', { pos: [x + Math.cos(i * 2) * 0.3, y - 0.2, Math.sin(i * 2) * 0.3] });
      break;
    }
    case 'jungleTree': {
      b.add(G.cyl(0.45, 0.8, 9, 8), 'matte', '#5a4030', { pos: [0, 4.5, 0] });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        b.add(G.cyl(0.14, 0.3, 2.6, 5), 'matte', '#5a4030', { pos: [Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7], rot: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6] });
      }
      b.add(G.sphere(3.6, 10, 8), 'matte', '#2e7d32', { pos: [0, 10, 0], scale: [1.3, 0.55, 1.3] });
      b.add(G.sphere(2.6, 10, 8), 'matte', '#388e3c', { pos: [1.8, 11.2, 0.8], scale: [1.2, 0.6, 1.2] });
      b.add(G.sphere(2.4, 10, 8), 'matte', '#1b5e20', { pos: [-1.6, 10.8, -1.2], scale: [1.2, 0.6, 1.2] });
      for (let i = 0; i < 5; i++) b.add(G.cyl(0.04, 0.04, 4, 4), 'matte', '#33691e', { pos: [Math.cos(i * 1.3) * 2.8, 7.2, Math.sin(i * 1.3) * 2.8] });
      break;
    }
    case 'bush': {
      shadow = false;
      b.add(G.ico(0.9, 1), 'matte', leaf, { pos: [0, 0.55, 0], scale: [1.2, 0.8, 1.1] });
      b.add(G.ico(0.7, 1), 'matte', leaf2, { pos: [0.6, 0.5, 0.2] });
      b.add(G.ico(0.65, 1), 'matte', leaf, { pos: [-0.5, 0.45, -0.3] });
      break;
    }
    case 'fern': {
      shadow = false;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const f = G.cone(0.25, 1.6, 4);
        f.rotateX(Math.PI / 2);
        f.translate(0, 0, 0.8);
        b.add(f, 'matte', i % 2 ? '#2e7d32' : '#43a047', { pos: [0, 0.3, 0], rot: [0.6, a, 0], scale: [1, 0.2, 1] });
      }
      break;
    }
    case 'grass': {
      shadow = false;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26;
        b.add(G.cone(0.07, 0.7, 3), 'matte', i % 2 ? leaf : leaf2, { pos: [Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15], rot: [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3] });
      }
      break;
    }
    case 'flowers': {
      shadow = false;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26;
        b.add(G.cyl(0.015, 0.015, 0.4, 3), 'matte', '#4caf50', { pos: [Math.cos(a) * 0.25, 0.2, Math.sin(a) * 0.25] });
        b.add(G.ico(0.1, 0), 'matte', '#ffffff', { pos: [Math.cos(a) * 0.25, 0.42, Math.sin(a) * 0.25] });
      }
      break;
    }
    case 'rock':
      b.add(rockGeo(1.5, 'rock'), 'matte', theme.rockColor || '#8c857b', { pos: [0, 0.8, 0] });
      mat = 'flat';
      break;
    case 'boulder':
      b.add(rockGeo(3.1, 'boulder'), 'matte', theme.rockColor || '#8c857b', { pos: [0, 1.8, 0] });
      mat = 'flat';
      break;
    case 'iceRock':
      b.add(rockGeo(1.6, 'ice'), 'matte', '#bfe9ff', { pos: [0, 0.9, 0] });
      mat = 'flat';
      break;
    case 'lavaRock': {
      b.add(rockGeo(1.6, 'lava'), 'matte', '#2d2320', { pos: [0, 0.8, 0] });
      glow.add(G.ico(0.5, 0), 'glow', '#ff6d00', { pos: [0.6, 0.6, 0.6] }, 2.5);
      mat = 'flat';
      break;
    }
    case 'skullRock': {
      b.add(rockGeo(2.2, 'skull', 1), 'matte', '#6d655e', { pos: [0, 1.6, 0], scale: [1, 1.1, 1] });
      for (const s of [-1, 1]) b.add(G.sphere(0.45, 8, 6), 'matte', '#1b1512', { pos: [s * 0.7, 2.0, 1.6] });
      glow.add(G.sphere(0.18, 8, 6), 'glow', '#ff3d00', { pos: [0.7, 2.0, 1.95] }, 3);
      glow.add(G.sphere(0.18, 8, 6), 'glow', '#ff3d00', { pos: [-0.7, 2.0, 1.95] }, 3);
      mat = 'flat';
      break;
    }
    case 'cactus': {
      const green = '#4a8f3c';
      b.add(G.capsule(0.4, 3.2, 4, 8), 'matte', green, { pos: [0, 2.0, 0] });
      b.add(G.capsule(0.25, 1.0, 4, 8), 'matte', green, { pos: [0.75, 2.2, 0], rot: [0, 0, Math.PI / 2] });
      b.add(G.capsule(0.25, 1.2, 4, 8), 'matte', green, { pos: [1.2, 3.0, 0] });
      b.add(G.capsule(0.22, 0.8, 4, 8), 'matte', green, { pos: [-0.6, 2.8, 0], rot: [0, 0, Math.PI / 2] });
      b.add(G.capsule(0.22, 0.9, 4, 8), 'matte', green, { pos: [-0.95, 3.4, 0] });
      b.add(G.sphere(0.2, 6, 4), 'matte', '#ff4081', { pos: [0, 3.95, 0] });
      break;
    }
    case 'mushroom': {
      b.add(G.cyl(0.4, 0.55, 3, 10), 'matte', '#f5ecd7', { pos: [0, 1.5, 0] });
      const cap = new THREE.SphereGeometry(1.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      b.add(cap, 'matte', '#e53935', { pos: [0, 2.9, 0], scale: [1, 0.75, 1] });
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        const e = 0.35 + (i % 3) * 0.25;
        b.add(G.sphere(0.28, 8, 6), 'matte', '#ffffff', { pos: [Math.cos(a) * Math.cos(e) * 1.7, 2.9 + Math.sin(e) * 1.3, Math.sin(a) * Math.cos(e) * 1.7], scale: [1, 0.4, 1] });
      }
      break;
    }
    case 'lamp':
    case 'streetLight': {
      const tall = type === 'streetLight';
      const h = tall ? 8 : 6.2;
      b.add(G.cyl(0.1, 0.16, h, 8), 'matte', tall ? '#37474f' : '#3e2f25', { pos: [0, h / 2, 0] });
      b.add(G.box(0.1, 0.1, 1.4), 'matte', tall ? '#37474f' : '#3e2f25', { pos: [0, h - 0.1, 0.6] });
      b.add(G.cone(0.38, 0.4, 8), 'matte', '#263238', { pos: [0, h - 0.15, 1.2] });
      glow.add(G.sphere(0.24, 10, 8), 'glow', theme.lampColor || '#fff1c1', { pos: [0, h - 0.4, 1.2] }, 3.2);
      break;
    }
    case 'cone':
      shadow = false;
      b.add(G.cone(0.3, 0.75, 10), 'matte', '#ff6d00', { pos: [0, 0.4, 0] });
      b.add(G.cyl(0.19, 0.24, 0.14, 10), 'matte', '#ffffff', { pos: [0, 0.4, 0] });
      b.add(G.box(0.7, 0.05, 0.7), 'matte', '#e65100', { pos: [0, 0.03, 0] });
      break;
    case 'crate':
      b.add(G.box(1.5, 1.5, 1.5), 'matte', '#a1754f', { pos: [0, 0.75, 0] });
      for (const s of [-1, 1]) {
        b.add(G.box(1.56, 0.16, 0.16), 'matte', '#6d4c35', { pos: [0, 0.75 + s * 0.67, 0.72] });
        b.add(G.box(1.56, 0.16, 0.16), 'matte', '#6d4c35', { pos: [0, 0.75 + s * 0.67, -0.72] });
      }
      break;
    case 'barrel':
      b.add(G.cyl(0.55, 0.6, 1.3, 14), 'matte', '#8d5a3a', { pos: [0, 0.65, 0] });
      for (const y of [0.2, 0.65, 1.1]) b.add(G.torus(0.58, 0.04, 4, 16), 'matte', '#424242', { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
      break;
    case 'hay':
      b.add(G.cyl(0.8, 0.8, 1.4, 14), 'matte', '#e0c060', { pos: [0, 0.8, 0], rot: [0, 0, Math.PI / 2] });
      for (const x of [-0.7, 0.7]) b.add(G.cyl(0.62, 0.62, 0.04, 14), 'matte', '#c9a845', { pos: [x, 0.8, 0], rot: [0, 0, Math.PI / 2] });
      break;
    case 'pillar':
    case 'brokenPillar': {
      const broken = type === 'brokenPillar';
      const h = broken ? 3.8 : 9;
      const stone = theme.stoneColor || '#d7c9a8';
      b.add(G.box(2.4, 0.6, 2.4), 'matte', stone, { pos: [0, 0.3, 0] });
      b.add(G.cyl(0.95, 1.05, h, 12), 'matte', stone, { pos: [0, 0.6 + h / 2, 0] });
      if (!broken) b.add(G.box(2.3, 0.6, 2.3), 'matte', stone, { pos: [0, 0.6 + h + 0.3, 0] });
      else {
        b.add(rockGeo(0.8, 'deb1'), 'matte', stone, { pos: [1.8, 0.4, 0.6] });
        b.add(rockGeo(0.6, 'deb2'), 'matte', stone, { pos: [-1.4, 0.3, -1.2] });
      }
      break;
    }
    case 'obelisk': {
      const stone = theme.stoneColor || '#d7c9a8';
      b.add(G.box(3, 1, 3), 'matte', stone, { pos: [0, 0.5, 0] });
      b.add(G.cyl(0.85, 1.35, 12, 4), 'matte', stone, { pos: [0, 7, 0], rot: [0, Math.PI / 4, 0] });
      b.add(G.cone(0.95, 1.4, 4), 'metal', '#ffca28', { pos: [0, 13.7, 0], rot: [0, Math.PI / 4, 0] });
      break;
    }
    case 'crystal': {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        glow.add(G.octa(0.5 + (i % 3) * 0.25), 'glow', '#ffffff', { pos: [Math.cos(a) * 0.5, 1.0 + (i % 2) * 0.6, Math.sin(a) * 0.5], scale: [0.6, 2.2, 0.6], rot: [Math.cos(a) * 0.3, a, Math.sin(a) * 0.3] }, 1.6);
      }
      b.add(rockGeo(0.9, 'cbase'), 'matte', '#3a3440', { pos: [0, 0.3, 0] });
      break;
    }
    case 'tireStack': {
      for (let i = 0; i < 3; i++) b.add(G.torus(0.5, 0.22, 8, 16), 'rubber', '#202020', { pos: [0, 0.22 + i * 0.4, 0], rot: [Math.PI / 2, 0, 0] });
      b.add(G.torus(0.5, 0.23, 8, 16), 'matte', '#ffffff', { pos: [0, 1.02, 0], rot: [Math.PI / 2, 0, 0] });
      break;
    }
    case 'flag':
    case 'banner': {
      shadow = type === 'banner';
      b.add(G.cyl(0.06, 0.07, 6, 6), 'matte', '#eeeeee', { pos: [0, 3, 0] });
      if (type === 'flag') {
        const tri = new THREE.BufferGeometry();
        tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 5.9, 0, 0, 4.7, 0, 0, 5.3, 1.6, 0, 5.3, 1.6, 0, 4.7, 0, 0, 5.9, 0], 3));
        tri.computeVertexNormals();
        b.add(tri, 'matte', '#ffffff');
      } else {
        b.add(G.box(0.05, 3.2, 1.4), 'matte', '#ffffff', { pos: [0, 3.8, 0.75] });
      }
      mat = 'double';
      break;
    }
    case 'torch': {
      b.add(G.cyl(0.12, 0.18, 2.6, 6), 'matte', '#4e342e', { pos: [0, 1.3, 0] });
      b.add(G.cyl(0.35, 0.2, 0.4, 8), 'metal', '#5d4037', { pos: [0, 2.7, 0] });
      glow.add(G.cone(0.28, 0.8, 8), 'glow', '#ff9100', { pos: [0, 3.2, 0] }, 3);
      glow.add(G.cone(0.15, 0.5, 6), 'glow', '#fff176', { pos: [0, 3.05, 0] }, 3);
      break;
    }
    case 'umbrella': {
      b.add(G.cyl(0.04, 0.04, 3, 6), 'matte', '#ffffff', { pos: [0, 1.5, 0] });
      b.add(G.cone(1.8, 0.7, 12), 'matte', '#ffffff', { pos: [0, 3.1, 0] });
      mat = 'double';
      break;
    }
    case 'beachChair': {
      shadow = false;
      b.add(G.box(0.7, 0.06, 1.6), 'matte', '#ffffff', { pos: [0, 0.4, 0] });
      b.add(G.box(0.7, 0.06, 0.8), 'matte', '#ffffff', { pos: [0, 0.7, -0.9], rot: [0.9, 0, 0] });
      for (const [x, z] of [[0.3, 0.7], [-0.3, 0.7], [0.3, -0.6], [-0.3, -0.6]]) b.add(G.cyl(0.03, 0.03, 0.4, 4), 'matte', '#90a4ae', { pos: [x, 0.2, z] });
      break;
    }
    case 'log':
      b.add(G.cyl(0.45, 0.5, 4, 10), 'matte', '#6d4c35', { pos: [0, 0.45, 0], rot: [0, 0, Math.PI / 2] });
      break;
    case 'stump':
      b.add(G.cyl(0.6, 0.75, 1, 10), 'matte', '#6d4c35', { pos: [0, 0.5, 0] });
      b.add(G.cyl(0.58, 0.58, 0.02, 10), 'matte', '#c8a578', { pos: [0, 1.0, 0] });
      break;
    case 'statue': {
      const stone = theme.stoneColor || '#b0a898';
      b.add(G.box(2.2, 1.2, 2.2), 'matte', stone, { pos: [0, 0.6, 0] });
      b.add(G.box(1.4, 2.6, 1.2), 'matte', stone, { pos: [0, 2.5, 0] });
      b.add(G.box(1.2, 1.3, 1.2), 'matte', stone, { pos: [0, 4.4, 0.05] });
      b.add(G.box(1.3, 0.25, 0.3), 'matte', '#6d655e', { pos: [0, 4.6, 0.62] });
      b.add(G.box(0.3, 0.6, 0.3), 'matte', '#6d655e', { pos: [0, 4.0, 0.65] });
      break;
    }
    case 'neonSign': {
      b.add(G.cyl(0.1, 0.1, 4.5, 6), 'metal', '#37474f', { pos: [0, 2.25, 0] });
      b.add(G.box(3.2, 1.6, 0.2), 'matte', '#141018', { pos: [0, 5.2, 0] });
      glow.add(G.box(2.9, 0.18, 0.24), 'glow', '#ffffff', { pos: [0, 5.75, 0] }, 2.6);
      glow.add(G.box(2.9, 0.18, 0.24), 'glow', '#ffffff', { pos: [0, 4.65, 0] }, 2.6);
      glow.add(G.box(0.8, 0.8, 0.24), 'glow', '#ffffff', { pos: [-0.8, 5.2, 0] }, 2.2);
      glow.add(G.torus(0.35, 0.08, 6, 16), 'glow', '#ffffff', { pos: [0.7, 5.2, 0.05] }, 2.2);
      break;
    }
    case 'hologram': {
      shadow = false;
      for (let i = 0; i < 4; i++) glow.add(G.torus(1.6 - i * 0.3, 0.05, 4, 24), 'glow', '#ffffff', { pos: [0, 2 + i * 1.6, 0], rot: [Math.PI / 2, 0, 0] }, 2);
      b.add(G.cyl(1.2, 1.4, 0.4, 16), 'metal', '#263238', { pos: [0, 0.2, 0] });
      break;
    }
    case 'coral': {
      shadow = false;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        b.add(G.cyl(0.08, 0.14, 1.2, 5), 'matte', '#ffffff', { pos: [Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3], rot: [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4] });
      }
      break;
    }
    case 'buoy':
      b.add(G.sphere(0.6, 12, 8), 'matte', '#ff1744', { pos: [0, 0.3, 0] });
      b.add(G.cyl(0.62, 0.62, 0.25, 12), 'matte', '#ffffff', { pos: [0, 0.3, 0] });
      b.add(G.cyl(0.05, 0.05, 1.2, 5), 'matte', '#9e9e9e', { pos: [0, 1.1, 0] });
      glow.add(G.sphere(0.12, 8, 6), 'glow', '#ffea00', { pos: [0, 1.75, 0] }, 3);
      break;
    case 'fencePost':
      b.add(G.box(0.18, 1.2, 0.18), 'matte', '#8d6e4f', { pos: [0, 0.6, 0] });
      break;
    case 'vine': {
      shadow = false;
      for (let i = 0; i < 4; i++) b.add(G.cyl(0.04, 0.03, 6, 4), 'matte', '#33691e', { pos: [i * 0.3 - 0.45, 3, (i % 2) * 0.2] });
      for (let i = 0; i < 10; i++) b.add(G.ico(0.18, 0), 'matte', '#558b2f', { pos: [(i % 4) * 0.3 - 0.45, 0.6 + i * 0.5, 0.1] });
      break;
    }
    default:
      b.add(G.box(1, 1, 1), 'matte', '#999999', { pos: [0, 0.5, 0] });
  }
  if (b.parts.size) layers.push({ geo: b.buildGeometry(), mat, shadow });
  if (glow.parts.size) layers.push({ geo: glow.buildGeometry(), mat: 'glow', shadow: false });
  return layers;
}

const COLORFUL = new Set(['flowers', 'crystal', 'umbrella', 'flag', 'banner', 'neonSign', 'hologram', 'coral']);
const PALETTE = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ff9100', '#ffffff'];
const DECORATIVE = new Set(['grass', 'flowers', 'bush', 'fern', 'coral', 'beachChair', 'vine']);

/** Crea los InstancedMesh para todas las decoraciones del circuito. */
export function buildProps(props, theme, vegetation = 1) {
  const group = new THREE.Group();
  group.name = 'props';
  const byType = new Map();
  const rng = new Random('props-visual');
  for (const p of props) {
    if (DECORATIVE.has(p.type) && rng.next() > vegetation) continue;
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type).push(p);
  }
  const mats = sharedMaterials();
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const dbl = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const matFor = (k) => (k === 'flat' ? flat : k === 'double' ? dbl : k === 'glow' ? mats.glow : mats.matte);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  for (const [type, list] of byType) {
    const key = `${type}:${theme.id || ''}`;
    if (!geoCache.has(key)) geoCache.set(key, build(type, theme));
    const layers = geoCache.get(key);
    for (const layer of layers) {
      const mesh = new THREE.InstancedMesh(layer.geo, matFor(layer.mat), list.length);
      mesh.castShadow = layer.shadow;
      mesh.receiveShadow = false;
      list.forEach((p, i) => {
        pos.set(p.x, p.y, p.z);
        e.set(p.tilt || 0, p.rot, 0);
        q.setFromEuler(e);
        s.setScalar(p.scale);
        m4.compose(pos, q, s);
        mesh.setMatrixAt(i, m4);
        if (COLORFUL.has(type)) col.set(p.color || PALETTE[(i * 7 + (p.variant || 0)) % PALETTE.length]);
        else {
          const v = 0.86 + ((i * 37) % 29) / 100;
          col.setRGB(v, v, v);
          if (p.color) col.set(p.color);
        }
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `props-${type}`;
      group.add(mesh);
    }
  }
  return group;
}

export function clearPropCache() {
  for (const layers of geoCache.values()) for (const l of layers) l.geo.dispose();
  geoCache.clear();
}
