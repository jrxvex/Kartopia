// Cúpula celeste con degradado, disco solar HDR (produce bloom), nubes procedurales y estrellas.
import * as THREE from 'three';

export class Sky {
  constructor(theme = {}) {
    const s = theme.sky || {};
    const sun = theme.sun?.dir || [0.4, 0.8, 0.3];
    this.uniforms = {
      uTop: { value: new THREE.Color(s.top || '#2f79d8') },
      uHorizon: { value: new THREE.Color(s.horizon || '#bfe3ff') },
      uBottom: { value: new THREE.Color(s.bottom || s.horizon || '#e8f6ff') },
      uSunDir: { value: new THREE.Vector3(...sun).normalize() },
      uSunColor: { value: new THREE.Color(s.sunColor || '#fff4d0') },
      uSunSize: { value: s.sunSize ?? 0.018 },
      uClouds: { value: s.clouds ?? 0.5 },
      uCloudColor: { value: new THREE.Color(s.cloudColor || '#ffffff') },
      uStars: { value: s.stars ?? 0 },
      uTime: { value: 0 },
      uAurora: { value: s.aurora ?? 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunSize;
        uniform float uClouds; uniform vec3 uCloudColor; uniform float uStars; uniform float uTime; uniform float uAurora;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.35));
          // Estrellas
          if (uStars > 0.0 && h > 0.0) {
            vec3 q = floor(d * 420.0);
            float st = step(0.9975, hash3(q)) * (0.6 + 0.4 * sin(uTime * 3.0 + hash3(q + 1.0) * 30.0));
            col += vec3(st) * uStars * smoothstep(0.0, 0.25, h);
          }
          // Aurora (cielos nocturnos especiales)
          if (uAurora > 0.0 && h > 0.05) {
            float a = fbm(vec2(d.x * 3.0 + uTime * 0.02, d.z * 3.0)) ;
            float band = smoothstep(0.35, 0.0, abs(h - 0.35 - 0.1 * sin(d.x * 4.0 + uTime * 0.1)));
            col += mix(vec3(0.1, 1.0, 0.6), vec3(0.6, 0.2, 1.0), a) * band * a * uAurora;
          }
          // Sol
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          float disk = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, sd);
          col += uSunColor * (disk * 6.0 + pow(sd, 90.0) * 0.8 + pow(sd, 8.0) * 0.18);
          // Nubes
          if (uClouds > 0.0 && h > 0.0) {
            vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.004, uTime * 0.002);
            float n = fbm(uv * 1.3);
            float c = smoothstep(1.0 - uClouds * 0.75, 1.05 - uClouds * 0.35, n);
            float lit = 0.75 + 0.35 * pow(sd, 3.0);
            col = mix(col, uCloudColor * lit, c * smoothstep(0.0, 0.2, h) * 0.9);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'sky';
  }

  update(dt, camera) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(camera.position);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
