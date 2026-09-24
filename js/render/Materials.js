// Biblioteca de materiales: carretera por estilo, bordillos, muros, rampas, paneles turbo,
// terreno y shaders personalizados de agua (fresnel, reflejo del sol, espuma en la orilla)
// y lava (flujo animado emisivo).
import * as THREE from 'three';
import { TextureFactory } from './TextureFactory.js';

const ROAD_COLORS = {
  asphalt: '#5b6066',
  planks: '#a0724a',
  dirt: '#9a7650',
  mud: '#6b4f33',
  sand: '#d8bf82',
  snow: '#e8eef5',
  ice: '#bfe3f5',
  stone: '#9b9189',
  metal: '#7d8791',
  neon: '#150a2a',
};

export class MaterialLibrary {
  constructor(theme = {}) {
    this.theme = theme;
    this.cache = new Map();
    this.animated = [];
    this.time = 0;
  }

  get(key, fn) {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key);
  }

  road(style = 'asphalt') {
    return this.get(`road:${style}`, () => {
      const t = this.theme.road || {};
      const color = style === 'asphalt' ? t.color || ROAD_COLORS.asphalt : t[style] || ROAD_COLORS[style] || ROAD_COLORS.asphalt;
      const lineColor = style === 'asphalt' || style === 'metal' ? t.line || '#ffffff' : style === 'neon' ? t.neonLine || '#00e5ff' : null;
      const map = TextureFactory.road(style, color, lineColor);
      const params = {
        map,
        roughness: style === 'ice' ? 0.15 : style === 'metal' ? 0.45 : style === 'neon' ? 0.35 : 0.88,
        metalness: style === 'metal' ? 0.55 : style === 'neon' ? 0.4 : 0.0,
      };
      if (style === 'neon') {
        params.emissive = new THREE.Color('#ffffff');
        params.emissiveMap = TextureFactory.roadEmissive(t.neonLine || '#00e5ff');
        params.emissiveIntensity = 2.2;
      }
      if (style === 'asphalt' && t.wet) {
        params.roughness = 0.38;
        params.metalness = 0.15;
      }
      return new THREE.MeshStandardMaterial(params);
    });
  }

  curb() {
    return this.get('curb', () => {
      const [a, b] = this.theme.curb || ['#e53935', '#ffffff'];
      return new THREE.MeshStandardMaterial({ map: TextureFactory.curb(a, b), roughness: 0.7 });
    });
  }

  skirt() {
    return this.get('skirt', () => new THREE.MeshStandardMaterial({ color: this.theme.skirt || '#6b5a4a', roughness: 0.95 }));
  }

  bridgeSide() {
    return this.get('bridgeSide', () => new THREE.MeshStandardMaterial({ color: this.theme.bridge || '#8d7b6a', roughness: 0.85, map: TextureFactory.rock('#9a8f84') }));
  }

  wall(style) {
    return this.get(`wall:${style}`, () => {
      switch (style) {
        case 'barrier':
          return new THREE.MeshStandardMaterial({ map: TextureFactory.stripes('#e53935', '#f5f5f5', 6), roughness: 0.7 });
        case 'fence':
        case 'woodRail':
          return new THREE.MeshStandardMaterial({ map: TextureFactory.wood('#a1754f'), roughness: 0.85 });
        case 'stone':
          return new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(this.theme.stoneColor || '#8f8578', '#4a433c'), roughness: 0.9 });
        case 'neon':
          return new THREE.MeshStandardMaterial({ color: '#1a1030', emissive: new THREE.Color(this.theme.neon || '#ff2bd6'), emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.6 });
        case 'glass':
          return new THREE.MeshStandardMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, emissive: new THREE.Color('#00b8d4'), emissiveIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
        case 'hedge':
          return new THREE.MeshStandardMaterial({ color: '#3f8f3a', map: TextureFactory.detail('grass'), roughness: 1 });
        case 'metal':
          return new THREE.MeshStandardMaterial({ color: '#b0bec5', roughness: 0.35, metalness: 0.85 });
        case 'rock':
          return new THREE.MeshStandardMaterial({ map: TextureFactory.rock(this.theme.rockColor || '#8a8278'), roughness: 1, flatShading: true });
        case 'ice':
          return new THREE.MeshStandardMaterial({ color: '#cdefff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 });
        case 'lava':
          return new THREE.MeshStandardMaterial({ map: TextureFactory.bricks('#3e2a28', '#1a0f0e'), roughness: 0.9, emissive: new THREE.Color('#ff5722'), emissiveIntensity: 0.12 });
        case 'tire':
          return new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.95 });
        default:
          return new THREE.MeshStandardMaterial({ map: TextureFactory.stripes('#e53935', '#f5f5f5', 6), roughness: 0.7 });
      }
    });
  }

  wallAccent(style) {
    return this.get(`wallAccent:${style}`, () => {
      if (style === 'neon') return new THREE.MeshBasicMaterial({ color: new THREE.Color(this.theme.neon || '#ff2bd6').multiplyScalar(2.5) });
      if (style === 'glass') return new THREE.MeshBasicMaterial({ color: new THREE.Color('#00e5ff').multiplyScalar(2.2) });
      return new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.9 });
    });
  }

  ramp(style = 'wood') {
    return this.get(`ramp:${style}`, () => {
      if (style === 'metal') return new THREE.MeshStandardMaterial({ map: TextureFactory.stripes('#ffca28', '#37474f', 6), roughness: 0.45, metalness: 0.6 });
      if (style === 'neon') return new THREE.MeshStandardMaterial({ map: TextureFactory.stripes('#00e5ff', '#140a2a', 6), emissive: new THREE.Color('#00e5ff'), emissiveMap: TextureFactory.stripes('#00e5ff', '#000000', 6), emissiveIntensity: 1.6, roughness: 0.35 });
      if (style === 'stone') return new THREE.MeshStandardMaterial({ map: TextureFactory.stripes('#ffb300', '#6d4c41', 6), roughness: 0.8 });
      return new THREE.MeshStandardMaterial({ map: TextureFactory.stripes('#ff9800', '#8d6e63', 6), roughness: 0.75 });
    });
  }

  rampSide(style = 'wood') {
    return this.get(`rampSide:${style}`, () => {
      if (style === 'metal' || style === 'neon') return new THREE.MeshStandardMaterial({ color: '#37474f', roughness: 0.5, metalness: 0.6 });
      if (style === 'stone') return new THREE.MeshStandardMaterial({ map: TextureFactory.bricks('#8f8578', '#4a433c'), roughness: 0.9 });
      return new THREE.MeshStandardMaterial({ map: TextureFactory.wood('#8d6e63'), roughness: 0.85 });
    });
  }

  boostPad() {
    return this.get('boostPad', () => {
      const map = TextureFactory.boostPad().clone();
      map.needsUpdate = true;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      const m = new THREE.MeshStandardMaterial({ map, emissive: new THREE.Color('#ffffff'), emissiveMap: map, emissiveIntensity: 1.35, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
      this.animated.push((t) => {
        map.offset.y = -t * 1.6;
      });
      return m;
    });
  }

  checker() {
    return this.get('checker', () => new THREE.MeshStandardMaterial({ map: TextureFactory.checker(12, 2), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
  }

  terrain() {
    return this.get('terrain', () => {
      const detail = TextureFactory.detail(this.theme.ground?.detail || 'grass');
      return new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 });
    });
  }

  water() {
    return this.get('water', () => createWaterMaterial(this.theme));
  }

  lava() {
    return this.get('lava', () => createLavaMaterial(this.theme));
  }

  vertexColored(opts = {}) {
    const key = `vc:${JSON.stringify(opts)}`;
    return this.get(key, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0, flatShading: !!opts.flat, side: opts.side ?? THREE.FrontSide }));
  }

  update(dt) {
    this.time += dt;
    for (const fn of this.animated) fn(this.time);
    for (const m of this.cache.values()) {
      if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = this.time;
    }
  }

  dispose() {
    for (const m of this.cache.values()) if (m.dispose) m.dispose();
    this.cache.clear();
  }
}

// -------------------------------------------------------------------------------- Agua
function createWaterMaterial(theme) {
  const w = theme.water || {};
  const sun = theme.sun?.dir || [0.4, 0.8, 0.3];
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(w.color || '#2c9bc4') },
      uDeep: { value: new THREE.Color(w.deep || '#0f4f72') },
      uSky: { value: new THREE.Color(theme.sky?.horizon || '#bfe3ff') },
      uSunDir: { value: new THREE.Vector3(...sun).normalize() },
      uSunColor: { value: new THREE.Color(theme.sun?.color || '#ffffff') },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float depth;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vDepth;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.13 + uTime * 1.2) * 0.07 + cos(wp.z * 0.11 + uTime * 0.9) * 0.07;
        vWorld = wp.xyz;
        vDepth = depth;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uSky;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWorld;
      varying float vDepth;
      #include <fog_pars_fragment>
      vec3 waveNormal(vec2 p) {
        float t = uTime;
        float dx = 0.0;
        float dz = 0.0;
        dx += cos(p.x * 0.35 + t * 1.3) * 0.12;
        dz += cos(p.y * 0.31 - t * 1.1) * 0.12;
        dx += cos((p.x + p.y) * 0.9 + t * 2.1) * 0.05;
        dz += cos((p.x - p.y) * 1.1 - t * 1.7) * 0.05;
        dx += cos(p.x * 2.3 - p.y * 1.7 + t * 3.1) * 0.025;
        dz += cos(p.y * 2.7 + p.x * 1.3 + t * 2.7) * 0.025;
        return normalize(vec3(-dx, 1.0, -dz));
      }
      void main() {
        vec3 n = waveNormal(vWorld.xz);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        float d = clamp(vDepth / 5.0, 0.0, 1.0);
        vec3 col = mix(uShallow, uDeep, d);
        col = mix(col, uSky, clamp(fres * 0.75, 0.0, 0.85));
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(n, H), 0.0), 160.0);
        col += uSunColor * spec * 2.5;
        float foamBand = smoothstep(0.9, 0.0, vDepth);
        float ripple = 0.5 + 0.5 * sin(vDepth * 9.0 - uTime * 2.4 + vWorld.x * 0.2);
        col = mix(col, vec3(1.0), foamBand * ripple * 0.55);
        float alpha = mix(0.55, 0.93, d) + fres * 0.05;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// -------------------------------------------------------------------------------- Lava
function createLavaMaterial(theme) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uHot: { value: new THREE.Color('#ffb300') },
      uMid: { value: new THREE.Color('#ff3d00') },
      uCrust: { value: new THREE.Color('#2a0700') },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.2 + uTime * 0.8) * 0.12 * cos(wp.z * 0.17 + uTime * 0.6);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uHot;
      uniform vec3 uMid;
      uniform vec3 uCrust;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vWorld.xz * 0.06;
        vec2 flow = vec2(uTime * 0.035, uTime * 0.02);
        float n = fbm(p + flow + fbm(p * 1.7 - flow * 1.3));
        float cracks = smoothstep(0.42, 0.62, n);
        vec3 col = mix(uCrust, uMid, cracks);
        col = mix(col, uHot, smoothstep(0.62, 0.8, n));
        float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + n * 12.0);
        col *= (1.0 + cracks * 1.8) * pulse;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}
