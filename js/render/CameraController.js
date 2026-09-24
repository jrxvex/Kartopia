// Cámara en tercera persona: seguimiento suave, inclinación en curvas, vibración por impactos,
// FOV y distancia dinámicos según la velocidad y los turbos, adaptación a saltos y rampas,
// vista trasera, vuelo de presentación del circuito y órbita al cruzar la meta.
import * as THREE from 'three';
import { clamp, damp, dampAngle, easeInOutQuad, lerp } from '../core/MathUtils.js';

const g = {};
const tmp = new THREE.Vector3();

export class CameraController {
  constructor(camera, renderer, settings) {
    this.camera = camera;
    this.renderer = renderer;
    this.settings = settings;
    this.pos = new THREE.Vector3(0, 5, -10);
    this.look = new THREE.Vector3();
    this.yaw = 0;
    this.y = 0;
    this.trauma = 0;
    this.time = 0;
    this.roll = 0;
    this.fov = settings.fov || 70;
    this.mode = 'chase';
    this.world = null;
    this.track = null;
    this.landDip = 0;
    this.orbitAngle = 0;
    this.intro = null;
  }

  setWorld(world, track) {
    this.world = world;
    this.track = track;
  }

  shake(amount) {
    if (!this.settings.cameraShake) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  dip(amount) {
    this.landDip = Math.max(this.landDip, amount);
  }

  snapTo(kart) {
    this.yaw = kart.yaw;
    this.y = kart.pos.y;
    this.computeChase(kart, kart.pos, kart.yaw, 0, 1, true);
    this.pos.copy(this._desired);
    this.look.copy(this._look);
    this.apply(0);
  }

  startIntro(track, grid) {
    this.mode = 'intro';
    this.intro = { t: 0, duration: 4.2, sEnd: grid.s, track };
  }

  startOrbit(kart) {
    this.mode = 'orbit';
    this.orbitAngle = kart.yaw + Math.PI * 0.75;
  }

  computeChase(kart, kp, kyaw, dt, alpha, instant = false) {
    const speed = Math.abs(kart.forwardSpeed || 0);
    const sf = clamp(speed / 30, 0, 1.3);
    const boosting = kart.boostTime > 0 || kart.comet > 0;
    const lookBack = kart.input && kart.input.lookBack && !kart.respawn.active;
    let targetYaw = kyaw;
    if (kart.drift && kart.drift.active) targetYaw += kart.drift.dir * 0.1;
    if (lookBack) targetYaw += Math.PI;
    if (instant) this.yaw = targetYaw;
    else this.yaw = dampAngle(this.yaw, targetYaw, lookBack ? 30 : 6.5, dt);
    if (instant) this.y = kp.y;
    else this.y = damp(this.y, kp.y, kart.grounded ? 9 : 2.6, dt);
    this.y = clamp(this.y, kp.y - 2.5, kp.y + 3.5);
    const dist = 6.2 + sf * 1.3 + (boosting ? 0.7 : 0) - (kart.input && kart.input.throttle < 0 && speed > 3 ? 0.4 : 0);
    const height = 2.3 + sf * 0.25 - this.landDip;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const d = (this._desired = this._desired || new THREE.Vector3());
    d.set(kp.x - fx * dist, this.y + height, kp.z - fz * dist);
    if (this.world) {
      // solo el suelo cercano: un tablero superior (paso elevado, hélice) no debe atraer la cámara
      this.world.groundAt(d.x, d.z, Math.max(d.y, kp.y) + 4, g);
      if (g.hit && d.y < g.y + 1.3) d.y = g.y + 1.3;
    }
    const l = (this._look = this._look || new THREE.Vector3());
    l.set(kp.x + fx * 4, kp.y + 1.15, kp.z + fz * 4);
    this._sf = sf;
    this._boost = boosting;
  }

  update(dt, alpha, kart) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    this.landDip = Math.max(0, this.landDip - dt * 1.4);
    if (this.mode === 'intro' && this.intro) {
      this.updateIntro(dt, kart, alpha);
      return;
    }
    if (!kart) return;
    tmp.lerpVectors(kart.prevPos, kart.pos, alpha);
    const ky = kart.prevYaw + wrap(kart.yaw - kart.prevYaw) * alpha;
    if (this.mode === 'orbit') {
      this.orbitAngle += dt * 0.35;
      const r = 7.5;
      const des = new THREE.Vector3(tmp.x + Math.cos(this.orbitAngle) * r, tmp.y + 2.6, tmp.z + Math.sin(this.orbitAngle) * r);
      if (this.world) {
        this.world.groundAt(des.x, des.z, Math.max(des.y, tmp.y) + 4, g);
        if (g.hit && des.y < g.y + 1.2) des.y = g.y + 1.2;
      }
      this.pos.lerp(des, 1 - Math.exp(-4 * dt));
      this.look.lerp(tmp.clone().add(new THREE.Vector3(0, 1, 0)), 1 - Math.exp(-8 * dt));
      this.roll = damp(this.roll, 0, 4, dt);
      this.fov = damp(this.fov, this.settings.fov || 70, 3, dt);
      this.apply(dt);
      return;
    }
    this.computeChase(kart, tmp, ky, dt, alpha);
    const k = 1 - Math.exp(-15 * dt);
    this.pos.lerp(this._desired, k);
    this.look.lerp(this._look, 1 - Math.exp(-20 * dt));
    const rollTarget = clamp((kart.yawRate || 0) * 0.035, -0.09, 0.09);
    this.roll = damp(this.roll, rollTarget, 5, dt);
    const base = this.settings.fov || 70;
    const fovTarget = base + this._sf * 8 + (this._boost ? 7 : 0);
    this.fov = damp(this.fov, fovTarget, 4, dt);
    this.apply(dt);
  }

  updateIntro(dt, kart, alpha) {
    const it = this.intro;
    it.t += dt;
    const tr = it.track;
    const f = Math.min(1, it.t / it.duration);
    const e = easeInOutQuad(f);
    const s = it.sEnd - 260 + 240 * e;
    const lat = lerp(24, 6, e);
    const p = tr.pointAt(s, lat);
    const h = lerp(16, 5, e);
    const look = tr.pointAt(s + 30, 0);
    const pos = new THREE.Vector3(p.x, p.y + h, p.z);
    if (this.world) {
      this.world.groundAt(pos.x, pos.z, pos.y + 6, g);
      if (g.hit && pos.y < g.y + 3) pos.y = g.y + 3;
    }
    const lk = new THREE.Vector3(look.x, look.y + 2, look.z);
    if (kart && f > 0.78) {
      // transición suave a la cámara de persecución
      this.yaw = kart.yaw;
      this.y = kart.pos.y;
      this.computeChase(kart, kart.pos, kart.yaw, dt, alpha, true);
      const b = (f - 0.78) / 0.22;
      const bb = b * b * (3 - 2 * b);
      pos.lerp(this._desired, bb);
      lk.lerp(this._look, bb);
    }
    this.pos.copy(pos);
    this.look.copy(lk);
    this.roll = 0;
    this.fov = damp(this.fov, this.settings.fov || 70, 3, dt);
    this.apply(dt);
    if (f >= 1) {
      this.mode = 'chase';
      this.intro = null;
    }
  }

  apply(dt) {
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 0.55;
      const t = this.time * 38;
      cam.position.x += Math.sin(t * 1.1) * s * 0.6;
      cam.position.y += Math.sin(t * 1.7 + 1.3) * s * 0.5;
      cam.position.z += Math.cos(t * 1.3 + 0.7) * s * 0.6;
    }
    cam.lookAt(this.look);
    cam.rotateZ(this.roll);
    if (Math.abs(cam.userData.baseFov - this.fov) > 0.05 || cam.userData.baseFov === undefined) {
      cam.userData.baseFov = this.fov;
      this.renderer.updateCameraAspect(cam, this.fov);
    }
  }
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
