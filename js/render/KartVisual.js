// Representación visual de un kart: modelo + personaje, orientación según la normal del suelo,
// ángulo de derrape, animaciones de salto/truco/trompo/volteo, escudo, aura prisma, hielo,
// cometa, parpadeo de invulnerabilidad y dron de rescate.
import * as THREE from 'three';
import { PHYSICS } from '../config.js';
import { KartModel } from '../models/KartModel.js';
import { CharacterModel } from '../models/CharacterModel.js';
import { createShieldBubble, createRescueDrone } from '../models/ItemModels.js';
import { clamp, damp, lerpAngle } from '../core/MathUtils.js';
import { TextureFactory } from './TextureFactory.js';

const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _pos = new THREE.Vector3();

export class KartVisual {
  constructor(kart, scene, opts = {}) {
    this.kart = kart;
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = `kart-visual-${kart.index}`;
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.model = new KartModel(kart.kartDef, kart.character);
    this.body.add(this.model.root);
    const spec = this.model.spec;
    const hand = new THREE.Vector3(spec.wheel[0] - spec.seat[0], spec.wheel[1] - spec.seat[1] + 0.02, spec.wheel[2] - spec.seat[2] - 0.05);
    this.character = new CharacterModel(kart.character, hand);
    this.character.root.position.copy(this.model.seat);
    this.model.body.add(this.character.root);
    scene.add(this.root);

    this.shield = createShieldBubble();
    this.shield.visible = false;
    this.root.add(this.shield);

    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.aura.position.y = 0.7;
    this.aura.visible = false;
    this.root.add(this.aura);

    this.ice = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.8, 2.8),
      new THREE.MeshStandardMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, emissive: new THREE.Color('#4fc3f7'), emissiveIntensity: 0.4, depthWrite: false }),
    );
    this.ice.position.y = 0.8;
    this.ice.visible = false;
    this.body.add(this.ice);

    const cometGeo = new THREE.ConeGeometry(1.6, 6, 18, 1, true);
    cometGeo.rotateX(-Math.PI / 2);
    cometGeo.translate(0, 0, -1.8);
    this.cometShell = new THREE.Mesh(
      cometGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9100').multiplyScalar(2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.cometShell.position.y = 0.7;
    this.cometShell.visible = false;
    this.root.add(this.cometShell);

    this.drone = createRescueDrone();
    this.drone.visible = false;
    scene.add(this.drone);

    this.blob = null;
    if (opts.blobShadow) {
      this.blob = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 3.2),
        new THREE.MeshBasicMaterial({ map: TextureFactory.softDot(), color: '#000000', transparent: true, opacity: 0.45, depthWrite: false }),
      );
      this.blob.rotation.x = -Math.PI / 2;
      this.blob.renderOrder = 1;
      scene.add(this.blob);
    }

    this.ghost = !!opts.ghost;
    if (this.ghost) this.makeGhost();

    this.driftVis = 0;
    this.rollVis = 0;
    this.pitchVis = 0;
    this.squashT = 0;
    this.hue = 0;
    this.wheelContact = [];
  }

  makeGhost() {
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.38;
        o.material.depthWrite = false;
        o.castShadow = false;
      }
    });
  }

  landed(impact) {
    this.squashT = Math.min(0.3, 0.12 + impact * 0.01);
  }

  update(dt, alpha, time, race) {
    const k = this.kart;
    const pos = _pos.lerpVectors(k.prevPos, k.pos, alpha);
    const yaw = lerpAngle(k.prevYaw, k.yaw, alpha);
    const r = k.respawn;

    // --- dron de rescate
    if (r.active && r.phase === 'carry') {
      this.drone.visible = true;
      this.drone.position.set(pos.x, pos.y + 3.4, pos.z);
      this.drone.rotation.y += dt * 3;
    } else if (this.drone.visible) {
      this.drone.position.y += dt * 8;
      if (!r.active && this.drone.position.y > pos.y + 12) this.drone.visible = false;
    }
    const hidden = r.active && r.phase === 'fall' && r.time > 0.35 && (r.reason === 'water' || r.reason === 'lava' || r.reason === 'fall');
    this.root.visible = !hidden;

    // --- ángulo visual de derrape
    const driftTarget = k.drift.active ? -k.drift.dir * PHYSICS.DRIFT_VISUAL_ANGLE : 0;
    this.driftVis = damp(this.driftVis, driftTarget, 9, dt);
    let visYaw = yaw + this.driftVis;
    // trompo
    if (k.stun.type === 'spin') {
      const p = 1 - k.stun.time / k.stun.duration;
      visYaw += p * Math.PI * 4;
    }
    // orientación a partir de la normal suavizada
    const up = k.smoothNormal;
    _fwd.set(Math.sin(visYaw), 0, Math.cos(visYaw));
    _fwd.addScaledVector(up, -_fwd.dot(up)).normalize();
    _x.crossVectors(up, _fwd).normalize();
    _m.makeBasis(_x, up, _fwd);
    this.root.position.copy(pos);
    this.root.quaternion.setFromRotationMatrix(_m);

    // --- cabeceo en el aire, alabeo en curvas
    const pitchTarget = k.grounded ? 0 : clamp(-k.vel.y * 0.028, -0.4, 0.35);
    this.pitchVis = damp(this.pitchVis, pitchTarget, 5, dt);
    const rollTarget = clamp(-(k.yawRate || 0) * 0.06, -0.12, 0.12);
    this.rollVis = damp(this.rollVis, rollTarget, 8, dt);
    this.body.rotation.set(this.pitchVis, 0, this.rollVis);
    this.body.position.set(0, 0, 0);

    // truco
    if (k.trick.anim > 0) {
      const p = 1 - k.trick.anim / 0.55;
      const e = p * p * (3 - 2 * p);
      if (k.trick.kind === 0) this.body.rotation.x += e * Math.PI * 2;
      else if (k.trick.kind === 1) this.body.rotation.z += e * Math.PI * 2;
      else this.body.rotation.y += e * Math.PI * 2;
    }
    // volteo por impacto
    if (k.stun.type === 'tumble') {
      const p = 1 - k.stun.time / k.stun.duration;
      this.body.rotation.x += Math.min(1, p * 1.6) * Math.PI * 2;
      this.body.position.y = Math.sin(Math.min(1, p * 1.6) * Math.PI) * 1.2;
    }
    // aplastado / aterrizaje / salto
    let sy = 1;
    let sxz = 1;
    if (k.squash > 0) {
      sy = 0.35;
      sxz = 1.25;
    } else if (this.squashT > 0) {
      this.squashT = Math.max(0, this.squashT - dt);
      const s = Math.sin((this.squashT / 0.3) * Math.PI) * 0.18;
      sy = 1 - s;
      sxz = 1 + s * 0.5;
    } else if (k.hop.active) {
      const s = Math.sin(Math.min(1, k.hop.time / 0.3) * Math.PI) * 0.1;
      sy = 1 + s;
      sxz = 1 - s * 0.4;
    }
    this.body.scale.set(sxz, sy, sxz);

    // --- modelo: ruedas, volante, llamas
    const boosting = k.boostTime > 0 || k.comet > 0;
    let steerVis = k.input.steer;
    if (k.drift.active) steerVis = clamp(k.input.steer * 0.6 + k.drift.dir * 0.35, -1, 1);
    this.model.animate(dt, { speed: k.forwardSpeed, steer: k.stun.type ? 0 : steerVis, boost: boosting ? (k.boostSource === 'miniturbo' ? 0.8 : 1) : 0, time });
    const finished = k.progress.finished;
    this.character.animate(dt, {
      steer: k.stun.type ? 0 : steerVis,
      speed: Math.abs(k.forwardSpeed),
      hurt: !!k.stun.type,
      victory: finished && k.progress.position <= 3,
      air: !k.grounded,
      drift: k.drift.active ? k.drift.dir : 0,
      time,
    });

    // --- efectos de estado
    this.shield.visible = k.shield > 0;
    if (this.shield.visible) {
      this.shield.material.uniforms.uTime.value = time;
      this.shield.material.uniforms.uAlpha.value = k.shield < 2 ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
    }
    this.aura.visible = k.starTime > 0;
    if (this.aura.visible) {
      this.hue = (this.hue + dt * 1.6) % 1;
      this.aura.material.color.setHSL(this.hue, 1, 0.6).multiplyScalar(2);
      this.aura.scale.setScalar(1 + Math.sin(time * 14) * 0.06);
    }
    this.ice.visible = k.frozen > 0;
    this.cometShell.visible = k.comet > 0;
    if (this.cometShell.visible) this.cometShell.scale.set(1 + Math.sin(time * 30) * 0.08, 1 + Math.cos(time * 25) * 0.08, 1 + Math.sin(time * 18) * 0.15);
    const blink = (k.invincible > 0 && !k.stun.type && k.starTime <= 0 && k.comet <= 0 && k.ghostTime > 0) || (r.active && r.phase === 'carry');
    this.body.visible = !blink || Math.sin(time * 40) > -0.2;

    if (this.blob) {
      const hit = race.track.collision.groundAt(pos.x, pos.z, pos.y + 1, {});
      this.blob.visible = hit.hit && pos.y - hit.y < 8 && !hidden;
      if (this.blob.visible) {
        this.blob.position.set(pos.x, hit.y + 0.05, pos.z);
        this.blob.rotation.z = -yaw;
        this.blob.material.opacity = 0.45 * clamp(1 - (pos.y - hit.y) / 8, 0, 1);
      }
    }
  }

  /** Posiciones de mundo útiles para emitir partículas. */
  rearWheels(out) {
    const w = this.model.wheels;
    for (let n = 0; n < 2; n++) {
      const wh = w[2 + n];
      out[n] = out[n] || new THREE.Vector3();
      out[n].set(wh.x, 0.05, wh.z - 0.1);
      this.root.localToWorld(out[n]);
    }
    return out;
  }

  exhaustPoints(out) {
    this.model.exhausts.forEach((e, n) => {
      out[n] = out[n] || new THREE.Vector3();
      out[n].copy(e);
      out[n].z -= 0.2;
      this.model.body.localToWorld(out[n]);
    });
    out.length = this.model.exhausts.length;
    return out;
  }

  dispose() {
    this.model.dispose();
    this.character.dispose();
    this.root.removeFromParent();
    this.drone.removeFromParent();
    if (this.blob) this.blob.removeFromParent();
  }
}

export { _qa, _q, UP };
