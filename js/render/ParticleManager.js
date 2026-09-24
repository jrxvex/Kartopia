// Sistema de partículas en GPU (THREE.Points con shader propio) con dos grupos: aditivo
// (chispas, fuego, turbo, brillo) y normal (humo, polvo, salpicaduras, confeti). Incluye
// preajustes para derrape, turbo, explosiones, golpes, cajas, agua, nieve, etc.
import * as THREE from 'three';
import { Random } from '../core/Random.js';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
    vAlpha = aAlpha;
    vColor = aColor;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform float uSoft;
  varying float vAlpha;
  varying vec3 vColor;
  #include <fog_pars_fragment>
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, uSoft, d);
    if (a * vAlpha < 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha * a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

class Pool {
  constructor(max, additive) {
    this.max = max;
    this.additive = additive;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3);
    this.c1 = new Float32Array(max * 3);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    this.alive = 0;
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aColor', this.aCol);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aSize', this.aSize);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 600 }, uSoft: { value: additive ? 0.0 : 0.12 } }]);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
  }

  spawn(x, y, z, vx, vy, vz, life, s0, s1, a0, r0, g0, b0, r1, g1, b1, grav, drag) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = s0;
    this.size1[i] = s1;
    this.alpha0[i] = a0;
    this.c0[i3] = r0;
    this.c0[i3 + 1] = g0;
    this.c0[i3 + 2] = b0;
    this.c1[i3] = r1;
    this.c1[i3 + 1] = g1;
    this.c1[i3 + 2] = b1;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  update(dt) {
    let alive = 0;
    const P = this.pos;
    const V = this.vel;
    for (let i = 0; i < this.max; i++) {
      let l = this.life[i];
      if (l <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      l -= dt;
      this.life[i] = l;
      if (l <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      alive++;
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      V[i3] *= d;
      V[i3 + 1] = V[i3 + 1] * d - this.grav[i] * dt;
      V[i3 + 2] *= d;
      P[i3] += V[i3] * dt;
      P[i3 + 1] += V[i3 + 1] * dt;
      P[i3 + 2] += V[i3 + 2] * dt;
      const t = 1 - l / this.maxLife[i];
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      const fade = t < 0.1 ? t / 0.1 : t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
      this.alpha[i] = this.alpha0[i] * fade;
      this.col[i3] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
      this.col[i3 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
      this.col[i3 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
    }
    this.alive = alive;
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }
}

const tmpC0 = new THREE.Color();
const tmpC1 = new THREE.Color();

export const DRIFT_COLORS = ['#ffffff', '#4fc3ff', '#ff9f1c', '#c77dff'];

export class ParticleManager {
  constructor(scene, density = 1) {
    this.density = density;
    const max = Math.floor(3500 * Math.max(0.3, density));
    this.add = new Pool(max, true);
    this.norm = new Pool(Math.floor(max * 0.8), false);
    scene.add(this.add.points);
    scene.add(this.norm.points);
    this.rng = new Random(99);
    this.budget = 1;
  }

  setViewport(height, fovDeg) {
    const scale = height / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.add.uniforms.uScale.value = scale;
    this.norm.uniforms.uScale.value = scale;
  }

  count(n) {
    const v = n * this.density;
    const base = Math.floor(v);
    return base + (this.rng.next() < v - base ? 1 : 0);
  }

  /**
   * Emite partículas genéricas.
   * o: {count, pos, spread, vel, velSpread, life:[a,b], size:[s0,s1], alpha, color, color2, gravity, drag, additive}
   */
  burst(o) {
    const pool = o.additive ? this.add : this.norm;
    const n = this.count(o.count ?? 10);
    const r = this.rng;
    tmpC0.set(o.color || '#ffffff');
    tmpC1.set(o.color2 || o.color || '#ffffff');
    if (o.intensity) {
      tmpC0.multiplyScalar(o.intensity);
      tmpC1.multiplyScalar(o.intensity);
    }
    const sp = o.spread ?? 0.3;
    const vs = o.velSpread ?? 1;
    const v = o.vel || { x: 0, y: 0, z: 0 };
    for (let i = 0; i < n; i++) {
      const life = o.life ? r.range(o.life[0], o.life[1]) : 0.6;
      const s0 = o.size ? o.size[0] * r.range(0.8, 1.2) : 0.5;
      const s1 = o.size ? o.size[1] * r.range(0.8, 1.2) : 0.5;
      let vx = v.x + r.range(-vs, vs);
      let vy = v.y + r.range(-vs, vs) * (o.vyScale ?? 1);
      let vz = v.z + r.range(-vs, vs);
      if (o.radial) {
        const a = r.range(0, Math.PI * 2);
        const e = r.range(-0.2, 1);
        const sp2 = r.range(o.radial * 0.5, o.radial);
        vx = Math.cos(a) * Math.cos(e) * sp2 + v.x;
        vz = Math.sin(a) * Math.cos(e) * sp2 + v.z;
        vy = Math.sin(e) * sp2 * (o.vyScale ?? 1) + v.y;
      }
      pool.spawn(
        o.pos.x + r.range(-sp, sp),
        o.pos.y + r.range(-sp, sp) * 0.5,
        o.pos.z + r.range(-sp, sp),
        vx,
        vy,
        vz,
        life,
        s0,
        s1,
        o.alpha ?? 1,
        tmpC0.r,
        tmpC0.g,
        tmpC0.b,
        tmpC1.r,
        tmpC1.g,
        tmpC1.b,
        o.gravity ?? 0,
        o.drag ?? 0.5,
      );
    }
  }

  // ------------------------------------------------------------ Preajustes
  driftSparks(pos, level, back) {
    const col = DRIFT_COLORS[level] || '#ffffff';
    this.burst({
      count: level === 0 ? 1 : 3,
      pos,
      spread: 0.12,
      vel: { x: back.x * 4, y: 3.5, z: back.z * 4 },
      velSpread: 2.5,
      life: [0.18, 0.38],
      size: [0.32, 0.05],
      color: col,
      color2: '#ffffff',
      intensity: level === 0 ? 0.8 : 2.2,
      gravity: 14,
      drag: 1.5,
      additive: true,
    });
  }

  boostFlame(pos, back, strong = 1) {
    this.burst({
      count: 2 * strong,
      pos,
      spread: 0.06,
      vel: { x: back.x * 7, y: 0.4, z: back.z * 7 },
      velSpread: 0.9,
      life: [0.12, 0.24],
      size: [0.75, 0.15],
      color: '#ffe082',
      color2: '#ff3d00',
      intensity: 2.4,
      gravity: -1,
      drag: 2,
      additive: true,
    });
  }

  exhaustSmoke(pos, back) {
    this.burst({
      count: 1,
      pos,
      spread: 0.05,
      vel: { x: back.x * 1.5, y: 0.8, z: back.z * 1.5 },
      velSpread: 0.3,
      life: [0.5, 0.9],
      size: [0.3, 1.2],
      alpha: 0.25,
      color: '#9e9e9e',
      color2: '#e0e0e0',
      gravity: -0.8,
      drag: 1.2,
    });
  }

  surfaceSpray(kind, pos, back, speed) {
    const presets = {
      grass: { color: '#6fbf4a', color2: '#3f7f2a', size: [0.22, 0.12], gravity: 16, alpha: 0.9 },
      dust: { color: '#c8a878', color2: '#e8d8b8', size: [0.6, 2.2], gravity: -0.5, alpha: 0.35 },
      sand: { color: '#e8d49a', color2: '#f5ead0', size: [0.6, 2.4], gravity: -0.3, alpha: 0.4 },
      snow: { color: '#ffffff', color2: '#dfefff', size: [0.35, 1.2], gravity: 4, alpha: 0.8 },
      mud: { color: '#5d4037', color2: '#3e2723', size: [0.25, 0.15], gravity: 16, alpha: 0.9 },
      splash: { color: '#e1f5fe', color2: '#81d4fa', size: [0.4, 1.3], gravity: 12, alpha: 0.75 },
      ice: { color: '#e0f7fa', color2: '#80deea', size: [0.2, 0.1], gravity: 10, alpha: 0.9, additive: true },
      fire: { color: '#ffcc80', color2: '#ff3d00', size: [0.8, 0.2], gravity: -3, alpha: 1, additive: true, intensity: 2 },
    };
    const p = presets[kind];
    if (!p) return;
    const k = Math.min(1, speed / 20);
    this.burst({
      count: 1 + k * 2,
      pos,
      spread: 0.3,
      vel: { x: back.x * 3 * k, y: 2 + 2.5 * k, z: back.z * 3 * k },
      velSpread: 1.4,
      life: [0.35, 0.75],
      size: p.size,
      alpha: p.alpha,
      color: p.color,
      color2: p.color2,
      gravity: p.gravity,
      drag: 1.2,
      additive: !!p.additive,
      intensity: p.intensity,
    });
  }

  landingDust(pos, color = '#d7c4a0', amount = 1) {
    this.burst({ count: 14 * amount, pos, spread: 0.6, radial: 5, vyScale: 0.2, life: [0.4, 0.8], size: [0.7, 2.2], alpha: 0.4, color, color2: '#ffffff', gravity: -0.4, drag: 3 });
  }

  wallSparks(pos, amount = 1) {
    this.burst({ count: 12 * amount, pos, spread: 0.2, radial: 7, life: [0.15, 0.4], size: [0.25, 0.05], color: '#ffe57f', color2: '#ff6d00', intensity: 2.5, gravity: 14, drag: 1, additive: true });
  }

  hitStars(pos) {
    this.burst({ count: 16, pos, spread: 0.4, radial: 5, vyScale: 0.6, life: [0.5, 0.9], size: [0.55, 0.1], color: '#fff176', color2: '#ffffff', intensity: 2.2, gravity: 2, drag: 2, additive: true });
  }

  explosion(pos, radius = 9) {
    const k = radius / 9;
    this.burst({ count: 70 * k, pos, spread: 1.2, radial: 14 * k, life: [0.35, 0.8], size: [3.4 * k, 1.2], color: '#fff3c4', color2: '#ff3d00', intensity: 3, gravity: -2, drag: 3, additive: true });
    this.burst({ count: 45 * k, pos, spread: 2, radial: 7 * k, vyScale: 0.8, life: [1.0, 2.0], size: [2.5 * k, 7 * k], alpha: 0.55, color: '#5d5d5d', color2: '#bdbdbd', gravity: -2.5, drag: 1.8 });
    this.burst({ count: 40 * k, pos, spread: 0.5, radial: 22 * k, life: [0.4, 0.9], size: [0.35, 0.05], color: '#ffe082', intensity: 3, gravity: 18, drag: 0.6, additive: true });
  }

  boxBreak(pos) {
    const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'];
    for (const c of cols) this.burst({ count: 5, pos, spread: 0.5, radial: 7, life: [0.4, 0.8], size: [0.45, 0.1], color: c, intensity: 2, gravity: 12, drag: 1, additive: true });
  }

  shieldPop(pos) {
    this.burst({ count: 36, pos, spread: 1.4, radial: 6, life: [0.3, 0.6], size: [0.5, 0.1], color: '#80deea', color2: '#ffffff', intensity: 2.2, gravity: 0, drag: 3, additive: true });
  }

  iceBurst(pos) {
    this.burst({ count: 26, pos, spread: 0.8, radial: 5, life: [0.5, 1.0], size: [0.45, 0.1], color: '#e0f7fa', color2: '#4fc3f7', intensity: 1.8, gravity: 6, drag: 1.5, additive: true });
  }

  sparkle(pos, color = null) {
    const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'];
    this.burst({ count: 2, pos, spread: 0.9, vel: { x: 0, y: 1.5, z: 0 }, velSpread: 1, life: [0.3, 0.6], size: [0.4, 0.05], color: color || cols[Math.floor(this.rng.next() * cols.length)], intensity: 2.5, gravity: 0, drag: 1, additive: true });
  }

  trail(pos, color = '#ff9100', size = 1.2, intensity = 2) {
    this.burst({ count: 2, pos, spread: 0.25, velSpread: 0.4, life: [0.2, 0.4], size: [size, 0.1], color, color2: '#ff1744', intensity, gravity: 0, drag: 1, additive: true });
  }

  confetti(pos) {
    const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ffffff'];
    for (const c of cols) this.burst({ count: 10, pos, spread: 3, vel: { x: 0, y: 7, z: 0 }, velSpread: 4, life: [1.5, 2.8], size: [0.3, 0.3], color: c, gravity: 4, drag: 1.4 });
  }

  respawnSparkle(pos) {
    this.burst({ count: 20, pos, spread: 1.2, vel: { x: 0, y: 2, z: 0 }, velSpread: 1.5, life: [0.4, 0.9], size: [0.4, 0.05], color: '#ffffff', color2: '#80d8ff', intensity: 2, gravity: -1, drag: 1, additive: true });
  }

  ambient(kind, center, dt) {
    const presets = {
      pollen: { rate: 18, color: '#fffde7', size: [0.12, 0.12], alpha: 0.8, life: [3, 6], vel: { x: 0.4, y: 0.1, z: 0.2 }, gravity: 0, additive: true, intensity: 1.2, box: 40, yMin: 0.5, yMax: 8 },
      snow: { rate: 90, color: '#ffffff', size: [0.18, 0.18], alpha: 0.9, life: [3, 5], vel: { x: 0.6, y: -2.2, z: 0.3 }, gravity: 0, box: 45, yMin: 4, yMax: 22 },
      ember: { rate: 40, color: '#ffab40', color2: '#ff3d00', size: [0.2, 0.05], alpha: 1, life: [2, 4], vel: { x: 0, y: 2.5, z: 0 }, gravity: -0.3, additive: true, intensity: 2.5, box: 50, yMin: -2, yMax: 6 },
      firefly: { rate: 10, color: '#d4ff6b', size: [0.25, 0.25], alpha: 1, life: [2, 4], vel: { x: 0, y: 0.3, z: 0 }, gravity: 0, additive: true, intensity: 3, box: 35, yMin: 0.5, yMax: 5 },
      leaves: { rate: 10, color: '#8bc34a', color2: '#cddc39', size: [0.3, 0.3], alpha: 0.9, life: [3, 5], vel: { x: 1.2, y: -1.2, z: 0.5 }, gravity: 0, box: 35, yMin: 3, yMax: 14 },
      data: { rate: 30, color: '#00e5ff', color2: '#d500f9', size: [0.22, 0.05], alpha: 1, life: [1.5, 3], vel: { x: 0, y: 3, z: 0 }, gravity: 0, additive: true, intensity: 2.5, box: 50, yMin: -6, yMax: 4 },
      dust: { rate: 26, color: '#e9cf98', size: [0.16, 0.12], alpha: 0.55, life: [2, 4], vel: { x: 3.2, y: 0.25, z: 0.8 }, gravity: 0, box: 45, yMin: 0.3, yMax: 6 },
      sparkle: { rate: 16, color: '#ffffff', size: [0.18, 0.05], alpha: 1, life: [1, 2], vel: { x: 0, y: 0.5, z: 0 }, gravity: 0, additive: true, intensity: 2, box: 40, yMin: 1, yMax: 12 },
    };
    const p = presets[kind];
    if (!p) return;
    this._ambAcc = (this._ambAcc || 0) + p.rate * dt * this.density;
    const n = Math.floor(this._ambAcc);
    this._ambAcc -= n;
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      this.burst({
        count: 1 / this.density,
        pos: { x: center.x + r.range(-p.box, p.box), y: center.y + r.range(p.yMin, p.yMax), z: center.z + r.range(-p.box, p.box) },
        spread: 0,
        vel: p.vel,
        velSpread: 0.5,
        life: p.life,
        size: p.size,
        alpha: p.alpha,
        color: p.color,
        color2: p.color2,
        gravity: p.gravity,
        drag: 0.1,
        additive: p.additive,
        intensity: p.intensity,
      });
    }
  }

  update(dt) {
    this.add.update(dt);
    this.norm.update(dt);
  }

  clear() {
    this.add.clear();
    this.norm.clear();
  }

  dispose() {
    for (const p of [this.add, this.norm]) {
      p.points.geometry.dispose();
      p.points.material.dispose();
      p.points.removeFromParent();
    }
  }
}
