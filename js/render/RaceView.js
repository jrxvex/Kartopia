// Vista 3D de una carrera: escena, iluminación (sol con sombras que siguen al jugador, luz
// hemisférica, farolas dinámicas por proximidad), mapa de entorno para reflejos, circuito,
// karts, objetos, partículas, marcas de derrape, efectos por eventos y cámara.
import * as THREE from 'three';
import { MaterialLibrary } from './Materials.js';
import { Sky } from './Sky.js';
import { ParticleManager } from './ParticleManager.js';
import { SkidMarks } from './SkidMarks.js';
import { CameraController } from './CameraController.js';
import { KartVisual } from './KartVisual.js';
import { TrackRenderer } from '../track/TrackRenderer.js';
import { ItemBoxesMesh, createItemMesh } from '../models/ItemModels.js';
import { surfaceDef, SURFACE } from '../physics/Surfaces.js';
import { DRIFT_COLORS } from './ParticleManager.js';
import { GhostPlayer } from '../race/Ghost.js';
import { Kart } from '../race/Kart.js';
import { clamp } from '../core/MathUtils.js';

const _v = new THREE.Vector3();

export class RaceView {
  constructor(game, race) {
    this.game = game;
    this.race = race;
    this.renderer = game.renderer;
    this.settings = game.save.settings;
    const preset = this.renderer.preset;
    this.preset = preset;
    const def = race.trackDef;
    const theme = def.theme || {};
    this.theme = theme;
    this.scene = new THREE.Scene();
    this.scene.name = 'race';
    const fog = theme.fog || {};
    const fogColor = new THREE.Color(fog.color || '#cfe7ff');
    const far = Math.min(fog.far ?? 1000, preset.drawDistance * 1.25);
    this.scene.fog = new THREE.Fog(fogColor, Math.min(fog.near ?? 200, far * 0.6), far);
    this.scene.background = fogColor.clone();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov || 70, 16 / 9, 0.25, 3000);
    this.camera.userData.baseFov = this.settings.fov || 70;

    this.materials = new MaterialLibrary(theme);
    this.sky = new Sky(theme);
    this.scene.add(this.sky.mesh);
    this.setupLights(theme);
    this.setupEnvironment(theme);

    this.trackRenderer = new TrackRenderer(race.track, def, this.materials, preset);
    this.scene.add(this.trackRenderer.build());

    this.particles = new ParticleManager(this.scene, preset.particles);
    this.skids = new SkidMarks(this.scene);
    const blob = !this.settings.shadows;
    this.visuals = race.karts.map((k) => {
      const v = new KartVisual(k, this.scene, { blobShadow: blob });
      k.visual = v;
      return v;
    });
    this.itemBoxes = race.items.boxes.length ? new ItemBoxesMesh(race.items.boxes.length) : null;
    if (this.itemBoxes) this.scene.add(this.itemBoxes.group);
    this.entityMeshes = new Map();

    this.cameraCtl = new CameraController(this.camera, this.renderer, this.settings);
    this.cameraCtl.setWorld(race.track.collision, race.track);
    this.focus = race.player || race.karts[0];
    this.cameraCtl.snapTo(this.focus);

    this.ghost = null;
    this.time = 0;
    this.emitAcc = 0;
    this.flash = 0;
    this.tmpWheels = [];
    this.tmpExhaust = [];
    this.bindEvents();
    this.renderer.setScene(this.scene, this.camera);
    this.renderer.setBloom(theme.bloom || { strength: 0.3, threshold: 0.9, radius: 0.4 });
    this.renderer.setExposure(theme.exposure ?? 1.0);
    this.particles.setViewport(this.renderer.height * this.renderer.pixelRatio, this.camera.fov);
  }

  setupLights(theme) {
    const sun = theme.sun || {};
    const dir = new THREE.Vector3(...(sun.dir || [0.4, 0.8, 0.3])).normalize();
    this.sunDir = dir;
    this.sun = new THREE.DirectionalLight(sun.color || '#fff2da', sun.intensity ?? 2.8);
    this.sun.castShadow = !!this.settings.shadows;
    const size = this.preset.shadowSize;
    this.sun.shadow.mapSize.set(size, size);
    const cam = this.sun.shadow.camera;
    const ext = 55;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 1;
    cam.far = 400;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.shadowExtent = ext;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const hemi = theme.hemi || {};
    this.hemi = new THREE.HemisphereLight(hemi.sky || '#cde6ff', hemi.ground || '#5d7f3c', hemi.intensity ?? 1.1);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(theme.ambientColor || '#ffffff', theme.ambientIntensity ?? 0.12);
    this.scene.add(this.ambient);
    // Farolas dinámicas (pool de luces puntuales reubicadas por cercanía a la cámara)
    this.lightPool = [];
    const n = Math.min(this.preset.lightPool, this.race.track.pointLights.length);
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight('#ffcc88', 0, 30, 2);
      this.scene.add(l);
      this.lightPool.push(l);
    }
    this.lightTimer = 0;
  }

  setupEnvironment(theme) {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer.renderer);
      const envScene = new THREE.Scene();
      const sky = new Sky(theme);
      sky.mesh.scale.setScalar(0.1);
      envScene.add(sky.mesh);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 16), new THREE.MeshBasicMaterial({ color: theme.hemi?.ground || '#5d7f3c' }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -8;
      envScene.add(ground);
      const rt = pmrem.fromScene(envScene, 0.02, 0.1, 1000);
      this.scene.environment = rt.texture;
      this.envRT = rt;
      this.scene.environmentIntensity = theme.envIntensity ?? 0.7;
      sky.dispose();
      pmrem.dispose();
    } catch (e) {
      console.warn('[RaceView] sin mapa de entorno', e);
    }
  }

  setGhost(ghostData, data) {
    if (!ghostData) return;
    const ch = data.character(ghostData.character);
    const kd = data.kart(ghostData.kart);
    const gk = new Kart({ index: 99, character: ch, kartDef: kd, isPlayer: false });
    gk.isGhost = true;
    this.ghost = { player: new GhostPlayer(ghostData), kart: gk, visual: new KartVisual(gk, this.scene, { ghost: true }), sample: {} };
  }

  bindEvents() {
    const ev = this.race.events;
    const on = (type, fn) => {
      this.offs = this.offs || [];
      this.offs.push(ev.on(type, fn));
    };
    const isFocus = (k) => k === this.focus;
    on('kart:wall', ({ kart, impact, x, y, z }) => {
      this.particles.wallSparks({ x, y, z }, Math.min(2, impact / 10));
      if (isFocus(kart)) this.cameraCtl.shake(Math.min(0.6, impact * 0.03));
    });
    on('kart:bump', ({ a, b, x, y, z, impact }) => {
      this.particles.wallSparks({ x, y, z }, 0.6);
      if (isFocus(a) || isFocus(b)) this.cameraCtl.shake(Math.min(0.5, 0.15 + impact * 0.02));
    });
    on('kart:land', ({ kart, airTime, impact }) => {
      if (airTime > 0.3) {
        kart.visual?.landed(impact);
        const sd = surfaceDef(kart.surface);
        this.particles.landingDust(kart.pos, sd.particle === 'snow' ? '#ffffff' : sd.particle === 'splash' ? '#e1f5fe' : '#d7c4a0', Math.min(1.5, airTime));
        if (isFocus(kart)) {
          this.cameraCtl.dip(Math.min(0.5, airTime * 0.4));
          this.cameraCtl.shake(Math.min(0.3, airTime * 0.25));
        }
      }
    });
    on('kart:hit', ({ kart, type }) => {
      _v.set(kart.pos.x, kart.pos.y + 1.2, kart.pos.z);
      if (type === 'freeze') this.particles.iceBurst(_v);
      else this.particles.hitStars(_v);
      if (isFocus(kart)) {
        this.cameraCtl.shake(0.55);
        this.flash = Math.max(this.flash, 0.35);
      }
    });
    on('kart:shield-pop', ({ kart }) => {
      _v.set(kart.pos.x, kart.pos.y + 0.8, kart.pos.z);
      this.particles.shieldPop(_v);
    });
    on('kart:miniturbo', ({ kart, level }) => {
      const ex = kart.visual ? kart.visual.exhaustPoints(this.tmpExhaust) : [kart.pos];
      for (const p of ex) this.particles.burst({ count: 10 + level * 6, pos: p, spread: 0.2, radial: 5, life: [0.2, 0.45], size: [0.5, 0.05], color: DRIFT_COLORS[level], intensity: 2.5, gravity: 4, drag: 2, additive: true });
    });
    on('kart:boostpad', ({ kart }) => {
      if (isFocus(kart)) this.cameraCtl.shake(0.15);
    });
    on('kart:fall', ({ kart, reason }) => {
      _v.copy(kart.pos);
      if (reason === 'water') this.particles.surfaceSpray('splash', _v, { x: 0, z: 0 }, 30), this.particles.burst({ count: 40, pos: _v, spread: 1, radial: 6, vyScale: 2, life: [0.5, 1], size: [0.6, 1.5], alpha: 0.8, color: '#e1f5fe', gravity: 14, drag: 0.5 });
      if (reason === 'lava') this.particles.burst({ count: 50, pos: _v, spread: 1, radial: 5, vyScale: 2, life: [0.4, 1], size: [1, 0.2], color: '#ffab40', color2: '#ff1744', intensity: 2.5, gravity: -2, drag: 1, additive: true });
    });
    on('kart:respawned', ({ kart }) => {
      _v.set(kart.pos.x, kart.pos.y + 1, kart.pos.z);
      this.particles.respawnSparkle(_v);
      this.skids.break(`${kart.index}:0`);
      this.skids.break(`${kart.index}:1`);
    });
    on('kart:carry', ({ kart }) => {
      if (isFocus(kart)) this.cameraCtl.snapTo(kart);
    });
    on('item:box-break', ({ box }) => {
      _v.set(box.x, box.y, box.z);
      this.particles.boxBreak(_v);
    });
    on('item:spawn', ({ entity }) => this.addEntity(entity));
    on('item:destroy', ({ entity, reason, x, y, z }) => {
      this.removeEntity(entity);
      if (reason === 'clash' || reason === 'wall' || reason === 'hit' || reason === 'bounces' || reason === 'explosion') {
        this.particles.burst({ count: 16, pos: { x, y, z }, spread: 0.3, radial: 5, life: [0.2, 0.5], size: [0.45, 0.05], color: entity.visualType === 'seeker-orb' ? '#ff5252' : entity.visualType === 'goo-trap' ? '#ce93d8' : '#b2ff59', intensity: 2, gravity: 8, drag: 1.5, additive: true });
      }
    });
    on('item:explosion', ({ x, y, z, radius }) => {
      this.particles.explosion({ x, y, z }, radius);
      const d = this.focus ? Math.hypot(this.focus.pos.x - x, this.focus.pos.z - z) : 99;
      this.cameraCtl.shake(clamp(1.1 - d / 40, 0, 0.9));
      if (d < radius * 1.5) this.flash = Math.max(this.flash, 0.6);
    });
    on('item:frost', ({ kart }) => {
      _v.set(kart.pos.x, kart.pos.y + 1, kart.pos.z);
      this.particles.burst({ count: 60, pos: _v, spread: 0.5, radial: 16, vyScale: 0.2, life: [0.4, 0.9], size: [0.6, 0.2], color: '#e0f7fa', color2: '#4fc3f7', intensity: 2, gravity: 0, drag: 1, additive: true });
    });
    on('item:star', ({ kart }) => {
      _v.set(kart.pos.x, kart.pos.y + 1, kart.pos.z);
      this.particles.confetti(_v);
    });
    on('race:countdown', ({ value }) => this.trackRenderer.setGateLights(value));
    on('race:go', () => {
      this.trackRenderer.setGateLights(0);
      setTimeout(() => this.trackRenderer.setGateLights(null), 3000);
    });
    on('race:finish', ({ kart }) => {
      if (isFocus(kart)) {
        _v.set(kart.pos.x, kart.pos.y + 2, kart.pos.z);
        this.particles.confetti(_v);
        this.cameraCtl.startOrbit(kart);
      }
    });
    on('race:phase', ({ phase }) => {
      if (phase === 'intro') {
        const slot = this.race.track.spawnSlots[this.focus.gridSlot ?? 0];
        this.cameraCtl.startIntro(this.race.track, slot);
      }
      if (phase === 'countdown' && this.cameraCtl.mode === 'intro') {
        this.cameraCtl.mode = 'chase';
        this.cameraCtl.snapTo(this.focus);
      }
    });
  }

  addEntity(e) {
    const mesh = createItemMesh(e.visualType);
    mesh.position.copy(e.pos);
    this.scene.add(mesh);
    this.entityMeshes.set(e, mesh);
  }

  removeEntity(e) {
    const m = this.entityMeshes.get(e);
    if (m) {
      m.removeFromParent();
      this.entityMeshes.delete(e);
    }
  }

  update(dt, alpha) {
    this.time += dt;
    const race = this.race;
    const t = this.time;
    this.materials.update(dt);
    this.trackRenderer.update(dt, race.clock);

    // Karts
    for (const v of this.visuals) v.update(dt, alpha, t, race);
    if (this.ghost) this.updateGhost(dt, alpha);

    // Entidades de objetos
    for (const [e, m] of this.entityMeshes) {
      m.position.copy(e.pos);
      const ring = m.getObjectByName('ring');
      if (ring) {
        ring.rotation.y = e.spin;
        ring.rotation.x = e.spin * 0.6;
      }
      if (e.visualType === 'blast-bomb') {
        const warn = m.getObjectByName('warn');
        if (warn && e.fuse !== null) warn.material.opacity = Math.max(0, Math.sin(t * (e.fuse < 0.8 ? 30 : 12))) * 0.55;
        const spark = m.getObjectByName('spark');
        if (spark) spark.scale.setScalar(0.7 + Math.random() * 0.8);
        m.rotation.y = e.spin * 0.3;
      }
      if (e.visualType === 'seeker-orb' && !e.dead) this.particles.trail(e.pos, '#ff5252', 0.9, 2.2);
      if (e.visualType === 'pulse-orb' && !e.dead && Math.random() < 0.5) this.particles.trail(e.pos, '#b2ff59', 0.7, 1.6);
    }
    if (this.itemBoxes) this.itemBoxes.update(race.items.boxes, t, dt);

    this.emitEffects(dt);
    this.particles.update(dt);
    this.skids.update();

    // Cámara
    this.cameraCtl.update(dt, alpha, this.focus);
    this.sky.update(dt, this.camera);
    this.particles.setViewport(this.renderer.height * this.renderer.pixelRatio, this.camera.fov);

    // Sol que sigue al foco (ajustado a la rejilla de texels para evitar parpadeo)
    const f = this.focus.pos;
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const cx = Math.round(f.x / texel) * texel;
    const cz = Math.round(f.z / texel) * texel;
    this.sun.target.position.set(cx, f.y, cz);
    this.sun.position.set(cx + this.sunDir.x * 180, f.y + this.sunDir.y * 180, cz + this.sunDir.z * 180);
    this.sun.target.updateMatrixWorld();

    // Pool de luces
    this.lightTimer -= dt;
    if (this.lightPool.length && this.lightTimer <= 0) {
      this.lightTimer = 0.2;
      const cam = this.camera.position;
      const sorted = race.track.pointLights
        .map((l) => ({ l, d: (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2 }))
        .sort((a, b) => a.d - b.d);
      this.lightPool.forEach((pl, i) => {
        const s = sorted[i];
        if (!s) {
          pl.intensity = 0;
          return;
        }
        pl.position.set(s.l.x, s.l.y, s.l.z);
        pl.color.set(s.l.color);
        pl.distance = s.l.distance;
        pl.intensity = s.l.intensity * 60;
      });
    }

    // Ambiente
    if (this.theme.ambient) this.particles.ambient(this.theme.ambient, this.camera.position, dt);
    this.flash = Math.max(0, this.flash - dt * 2);
  }

  emitEffects(dt) {
    this.emitAcc += dt;
    const step = 1 / 45;
    if (this.emitAcc < step) return;
    this.emitAcc = 0;
    const cam = this.camera.position;
    for (const k of this.race.karts) {
      const v = k.visual;
      if (!v || k.respawn.active) continue;
      const d2 = (k.pos.x - cam.x) ** 2 + (k.pos.z - cam.z) ** 2;
      if (d2 > 140 * 140) continue;
      const back = { x: -Math.sin(k.yaw), z: -Math.cos(k.yaw) };
      const speed = Math.abs(k.forwardSpeed);
      const wheels = v.rearWheels(this.tmpWheels);
      const sd = surfaceDef(k.surface);
      if (k.grounded && k.drift.active) {
        for (let n = 0; n < 2; n++) {
          if (k.drift.level > 0 || Math.random() < 0.5) this.particles.driftSparks(wheels[n], k.drift.level, back);
          this.skids.add(`${k.index}:${n}`, wheels[n].x, wheels[n].y, wheels[n].z, k.groundNormal.x, k.groundNormal.y, k.groundNormal.z, -back.x, -back.z, 0.24, sd.offroad ? 0.25 : 0.42, sd.offroad ? [0.2, 0.15, 0.08] : [0.04, 0.04, 0.04]);
        }
      } else {
        this.skids.break(`${k.index}:0`);
        this.skids.break(`${k.index}:1`);
      }
      if (k.grounded && sd.particle && speed > 4) {
        for (let n = 0; n < 2; n++) this.particles.surfaceSpray(sd.particle, wheels[n], back, speed);
      }
      if (k.boostTime > 0 || k.comet > 0) {
        const ex = v.exhaustPoints(this.tmpExhaust);
        for (const p of ex) this.particles.boostFlame(p, back, k.comet > 0 ? 2 : 1);
      } else if (speed < 3 && Math.random() < 0.15) {
        const ex = v.exhaustPoints(this.tmpExhaust);
        if (ex[0]) this.particles.exhaustSmoke(ex[0], back);
      }
      if (k.comet > 0) {
        _v.set(k.pos.x, k.pos.y + 0.8, k.pos.z);
        this.particles.trail(_v, '#ff9100', 2.4, 2.5);
      }
      if (k.starTime > 0) {
        _v.set(k.pos.x, k.pos.y + 0.8, k.pos.z);
        this.particles.sparkle(_v);
      }
      if (k.frozen > 0 && Math.random() < 0.3) {
        _v.set(k.pos.x, k.pos.y + 1, k.pos.z);
        this.particles.surfaceSpray('ice', _v, back, 10);
      }
      if (k.stun.type === 'tumble' && Math.random() < 0.5) {
        _v.set(k.pos.x, k.pos.y + 1.5, k.pos.z);
        this.particles.hitStars(_v);
      }
    }
  }

  updateGhost(dt, alpha) {
    const gh = this.ghost;
    const race = this.race;
    const t = race.phase === 'racing' || race.phase === 'finished' ? race.time : 0;
    const s = gh.player.sample(t, gh.sample);
    const k = gh.kart;
    k.prevPos.copy(k.pos);
    k.prevYaw = k.yaw;
    k.pos.set(s.x, s.y, s.z);
    k.yaw = s.yaw;
    k.boostTime = s.state & 1 ? 0.1 : 0;
    k.drift.active = !!(s.state & 6);
    k.drift.dir = s.state & 2 ? -1 : 1;
    k.grounded = !(s.state & 8);
    k.forwardSpeed = 20;
    gh.visual.update(dt, 1, this.time, race);
    gh.visual.root.visible = race.phase !== 'intro' && !s.done;
  }

  get effects() {
    const k = this.focus;
    const speed = Math.abs(k.forwardSpeed);
    const boosting = k.boostTime > 0 || k.comet > 0;
    return {
      speedLines: this.settings.speedLines ? clamp((speed - k.params.maxSpeed * 0.95) / 8, 0, 1) * 0.6 + (boosting ? 0.6 : 0) : 0,
      flash: this.flash,
    };
  }

  dispose() {
    if (this.offs) for (const off of this.offs) off();
    for (const v of this.visuals) v.dispose();
    if (this.ghost) this.ghost.visual.dispose();
    this.particles.dispose();
    this.skids.dispose();
    if (this.itemBoxes) this.itemBoxes.dispose();
    this.materials.dispose();
    this.sky.dispose();
    if (this.envRT) this.envRT.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.geometry?.dispose?.();
      }
    });
    this.scene.clear();
  }
}
