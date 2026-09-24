// Escaparate 3D de los menús: plataforma giratoria con el kart y el piloto seleccionados,
// focos, cajas de objetos flotantes y confeti. Se usa como fondo del título y de la selección.
import * as THREE from 'three';
import { KartModel } from '../models/KartModel.js';
import { CharacterModel } from '../models/CharacterModel.js';
import { TextureFactory } from '../render/TextureFactory.js';
import { ParticleManager } from '../render/ParticleManager.js';
import { Sky } from '../render/Sky.js';
import { damp } from '../core/MathUtils.js';

const MENU_THEME = {
  sky: { top: '#1a1147', horizon: '#6a3fb5', bottom: '#2a1a5e', sunColor: '#ffd6f5', clouds: 0.35, cloudColor: '#c9a6ff', stars: 0.8 },
  sun: { dir: [0.3, 0.5, 0.8] },
};

export class Showcase {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#2a1a5e', 40, 140);
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 3000);
    this.camera.userData.baseFov = 40;
    this.sky = new Sky(MENU_THEME);
    this.scene.add(this.sky.mesh);

    this.scene.add(new THREE.HemisphereLight('#b39ddb', '#311b92', 1.2));
    const key = new THREE.DirectionalLight('#fff3e0', 2.6);
    key.position.set(6, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#80d8ff', 1.6);
    rim.position.set(-8, 5, -6);
    this.scene.add(rim);
    this.spot = new THREE.SpotLight('#ff80ab', 80, 30, 0.5, 0.6, 1.5);
    this.spot.position.set(-6, 9, 4);
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    // Plataforma
    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.4, 48),
      new THREE.MeshStandardMaterial({ map: TextureFactory.checker(16, 16), roughness: 0.35, metalness: 0.3 }),
    );
    top.position.y = -0.2;
    top.receiveShadow = true;
    this.turntable.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.12, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4fd8').multiplyScalar(2.5) }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.02;
    this.scene.add(ring);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 1.2, 48), new THREE.MeshStandardMaterial({ color: '#2a1f4f', roughness: 0.6, metalness: 0.5 }));
    base.position.y = -1.0;
    this.scene.add(base);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: '#241654', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Cajas flotantes decorativas
    this.boxes = [];
    const boxTex = TextureFactory.itemBox();
    const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, transparent: true, opacity: 0.85, emissive: new THREE.Color('#ffffff'), emissiveMap: boxTex, emissiveIntensity: 0.8 });
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), boxMat);
      const a = (i / 7) * Math.PI * 2;
      b.position.set(Math.cos(a) * 9, 2 + (i % 3) * 1.6, Math.sin(a) * 9 - 3);
      b.userData.phase = i;
      this.scene.add(b);
      this.boxes.push(b);
    }
    this.particles = new ParticleManager(this.scene, 0.6);
    this.models = new Map();
    this.current = null;
    this.extras = [];
    this.mode = 'title';
    this.camT = 0;
    this.camPos = new THREE.Vector3(0, 3, 11);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.angle = 0;
    this.time = 0;
    this.setupEnvironment();
  }

  setupEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.game.renderer.renderer);
      const env = new THREE.Scene();
      const sky = new Sky(MENU_THEME);
      sky.mesh.scale.setScalar(0.1);
      env.add(sky.mesh);
      this.envRT = pmrem.fromScene(env, 0.02, 0.1, 1000);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 0.8;
      pmrem.dispose();
    } catch (e) {
      /* opcional */
    }
  }

  buildCombo(characterId, kartId) {
    const key = `${characterId}:${kartId}`;
    if (this.models.has(key)) return this.models.get(key);
    const data = this.game.data;
    const ch = data.character(characterId);
    const kd = data.kart(kartId);
    const group = new THREE.Group();
    const kart = new KartModel(kd, ch);
    const spec = kart.spec;
    const hand = new THREE.Vector3(spec.wheel[0] - spec.seat[0], spec.wheel[1] - spec.seat[1] + 0.02, spec.wheel[2] - spec.seat[2] - 0.05);
    const char = new CharacterModel(ch, hand);
    char.root.position.copy(kart.seat);
    kart.body.add(char.root);
    group.add(kart.root);
    group.scale.setScalar(1.9);
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    const entry = { group, kart, char };
    this.models.set(key, entry);
    return entry;
  }

  setSelection(characterId, kartId, burst = true) {
    const entry = this.buildCombo(characterId, kartId);
    if (this.current === entry) return;
    if (this.current) this.turntable.remove(this.current.group);
    this.current = entry;
    this.turntable.add(entry.group);
    if (burst) this.particles.confetti({ x: 0, y: 2, z: 0 });
  }

  /** Título: tres karts. Menú: uno. */
  activate(mode = 'menu') {
    this.mode = mode;
    const s = this.game.settings;
    this.setSelection(s.lastCharacter, s.lastKart, false);
    for (const e of this.extras) this.turntable.remove(e.group);
    this.extras = [];
    if (mode === 'title') {
      const others = this.game.data.characters.filter((c) => c.id !== s.lastCharacter).slice(0, 2);
      others.forEach((c, i) => {
        const e = this.buildCombo(c.id, this.game.data.karts[(i + 3) % this.game.data.karts.length].id);
        e.group.position.set(i === 0 ? -3.1 : 3.1, 0, -2.2);
        e.group.rotation.y = i === 0 ? 0.5 : -0.5;
        this.turntable.add(e.group);
        this.extras.push(e);
      });
    }
    if (this.current) this.current.group.position.set(0, 0, 0.6);
    if (!this.active) {
      this.active = true;
      this.game.renderer.setScene(this.scene, this.camera);
      this.game.renderer.setBloom({ strength: 0.55, threshold: 0.82, radius: 0.5 });
      this.game.renderer.setExposure(1.05);
    }
  }

  deactivate() {
    this.active = false;
  }

  setMode(mode) {
    this.mode = mode;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const t = this.time;
    const spin = this.mode === 'select' ? 0.35 : 0.22;
    this.turntable.rotation.y += dt * spin;
    for (const b of this.boxes) {
      b.rotation.x += dt * 0.6;
      b.rotation.y += dt * 0.9;
      b.position.y += Math.sin(t * 1.5 + b.userData.phase) * dt * 0.4;
    }
    const all = [this.current, ...this.extras].filter(Boolean);
    for (const e of all) {
      e.kart.animate(dt, { speed: 0, steer: Math.sin(t * 0.8) * 0.4, boost: 0, time: t });
      e.char.animate(dt, { steer: Math.sin(t * 0.8) * 0.4, speed: 0, victory: this.mode === 'title' && Math.sin(t * 0.5) > 0.7, time: t });
    }
    // Cámara según el modo
    let pos;
    let look;
    if (this.mode === 'title') {
      const a = t * 0.12;
      pos = new THREE.Vector3(Math.sin(a) * 2.5, 3.2, 12.5);
      look = new THREE.Vector3(0, 1.4, 0);
    } else if (this.mode === 'select') {
      pos = new THREE.Vector3(-3.2, 2.6, 7.6);
      look = new THREE.Vector3(-1.6, 1.2, 0);
    } else if (this.mode === 'track') {
      pos = new THREE.Vector3(3, 6, 14);
      look = new THREE.Vector3(0, 1, 0);
    } else {
      pos = new THREE.Vector3(-4.2, 3, 10);
      look = new THREE.Vector3(-2.4, 1.3, 0);
    }
    this.camPos.x = damp(this.camPos.x, pos.x, 2.5, dt);
    this.camPos.y = damp(this.camPos.y, pos.y, 2.5, dt);
    this.camPos.z = damp(this.camPos.z, pos.z, 2.5, dt);
    this.camLook.x = damp(this.camLook.x, look.x, 2.5, dt);
    this.camLook.y = damp(this.camLook.y, look.y, 2.5, dt);
    this.camLook.z = damp(this.camLook.z, look.z, 2.5, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.spot.target.position.set(0, 0, 0);
    this.sky.update(dt, this.camera);
    if (Math.random() < dt * 1.5) this.particles.sparkle({ x: (Math.random() - 0.5) * 12, y: 1 + Math.random() * 4, z: (Math.random() - 0.5) * 6 });
    this.particles.setViewport(this.game.renderer.height * this.game.renderer.pixelRatio, this.camera.fov);
    this.particles.update(dt);
  }

  render() {
    this.game.renderer.render();
  }
}
