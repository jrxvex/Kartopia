// Renderizador WebGL: tone mapping ACES, sombras, post-procesado (bloom) y escalado según la
// calidad gráfica elegida. Gestiona el redimensionado para cualquier resolución/aspecto.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY_PRESETS } from '../config.js';

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x87b5e8, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.2, 2500);
    this.baseFov = 70;
    this.width = 1;
    this.height = 1;
    this.bloomParams = { strength: 0.3, threshold: 0.9, radius: 0.4 };
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.info = this.renderer.info;
    this.composer = null;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.applySettings(settings);
  }

  get preset() {
    return QUALITY_PRESETS[this.settings.quality] || QUALITY_PRESETS.high;
  }

  applySettings(settings = this.settings) {
    this.settings = settings;
    const pr = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio) * (settings.resolutionScale || 1);
    this.pixelRatio = Math.max(0.4, pr);
    this.renderer.setPixelRatio(this.pixelRatio);
    const shadows = !!settings.shadows;
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse((o) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.needsUpdate = true;
        }
      });
    }
    this.bloomEnabled = !!settings.bloom;
    this.buildComposer();
    this.resize();
  }

  buildComposer() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (!this.bloomEnabled) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: this.preset.antialias ? 4 : 0,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    const res = new THREE.Vector2(Math.max(1, this.width), Math.max(1, this.height)).multiplyScalar(0.5);
    this.bloomPass = new UnrealBloomPass(res, this.bloomParams.strength, this.bloomParams.radius, this.bloomParams.threshold);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  setBloom(params = {}) {
    Object.assign(this.bloomParams, params);
    if (this.bloomPass) {
      this.bloomPass.strength = this.bloomParams.strength;
      this.bloomPass.threshold = this.bloomParams.threshold;
      this.bloomPass.radius = this.bloomParams.radius;
    }
  }

  setExposure(v) {
    this.renderer.toneMappingExposure = v;
  }

  setScene(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    if (this.renderPass) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
    }
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
    }
    this.updateCameraAspect(this.camera);
  }

  /** Ajusta el FOV para mantener un campo horizontal razonable en pantallas estrechas o ultrapanorámicas. */
  updateCameraAspect(camera, fov = null) {
    if (!camera || !camera.isPerspectiveCamera) return;
    const aspect = this.width / this.height;
    camera.aspect = aspect;
    const base = fov ?? camera.userData.baseFov ?? this.baseFov;
    let vfov = base;
    if (aspect < 1.3) {
      // pantallas estrechas: conservar campo horizontal
      const h = 2 * Math.atan(Math.tan((base * Math.PI) / 360) * (16 / 9));
      vfov = (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI;
      vfov = Math.min(vfov, 100);
    } else if (aspect > 2.4) {
      // ultrapanorámicas: reducir levemente el FOV vertical para no deformar
      vfov = base * 0.92;
    }
    camera.fov = vfov;
    camera.updateProjectionMatrix();
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Renderiza una escena en un render target (para retratos) y devuelve un dataURL. */
  renderToDataURL(scene, camera, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    const prevTarget = this.renderer.getRenderTarget();
    const prevClear = new THREE.Color();
    this.renderer.getClearColor(prevClear);
    const prevAlpha = this.renderer.getClearAlpha();
    const prevTone = this.renderer.toneMapping;
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    const pixels = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClear, prevAlpha);
    this.renderer.toneMapping = prevTone;
    rt.dispose();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      img.data.set(pixels.subarray(src, src + w * 4), y * w * 4);
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
  }
}
