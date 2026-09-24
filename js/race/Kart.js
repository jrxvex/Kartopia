// Entidad Kart: identidad, estadísticas combinadas (personaje + kart), estado físico,
// estado de carrera, objeto actual y referencias visuales/sonoras.
import * as THREE from 'three';
import { PHYSICS, STAT_SCALES } from '../config.js';
import { clamp } from '../core/MathUtils.js';

const STAT_KEYS = ['speed', 'accel', 'weight', 'handling', 'traction', 'miniTurbo'];

export function combineStats(character, kartDef) {
  const st = {};
  for (const k of STAT_KEYS) st[k] = clamp((character.stats[k] ?? 5) + (kartDef.stats[k] ?? 0), 0, 10);
  return st;
}

export function computeParams(character, kartDef, engineMul = 1) {
  const st = combineStats(character, kartDef);
  return {
    stats: st,
    maxSpeed: PHYSICS.BASE_MAX_SPEED * STAT_SCALES.speed(st.speed) * engineMul,
    accel: PHYSICS.BASE_ACCEL * STAT_SCALES.accel(st.accel) * (0.6 + 0.4 * engineMul),
    weight: STAT_SCALES.weight(st.weight),
    handling: STAT_SCALES.handling(st.handling) * (0.88 + 0.12 * engineMul),
    traction: STAT_SCALES.traction(st.traction),
    mtMul: STAT_SCALES.miniTurbo(st.miniTurbo),
    engineMul,
  };
}

export class Kart {
  constructor({ index, character, kartDef, isPlayer = false, engineMul = 1, name }) {
    this.index = index;
    this.id = `kart${index}`;
    this.character = character;
    this.kartDef = kartDef;
    this.name = name || character.name;
    this.isPlayer = isPlayer;
    this.params = computeParams(character, kartDef, engineMul);
    this.radius = PHYSICS.KART_RADIUS;
    this.height = PHYSICS.KART_HEIGHT;

    // --- Física
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.prevYaw = 0;
    this.yawRate = 0;
    this.grounded = true;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.smoothNormal = new THREE.Vector3(0, 1, 0);
    this.surface = 0;
    this.lastGroundSurface = 0;
    this.airTime = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.aiSpeedMul = 1;
    this.padCooldown = 0;
    this.bumpCooldown = 0;
    this.wallCooldown = 0;

    this.drift = { active: false, dir: 0, charge: 0, level: 0, time: 0 };
    this.hop = { active: false, time: 0 };
    this.trick = { window: 0, done: false, anim: 0, kind: 0 };
    this.boostTime = 0;
    this.boostPower = 1;
    this.boostSource = null;

    // --- Estados
    this.stun = { type: null, time: 0, duration: 0 };
    this.invincible = 0;
    this.shield = 0;
    this.frozen = 0;
    this.starTime = 0;
    this.comet = 0;
    this.cometS = 0;
    this.squash = 0;
    this.respawn = { active: false, phase: null, time: 0, target: null, reason: null };
    this.lastSafeS = 0;
    this.lastSafeLateral = 0;
    this.stuckTime = 0;
    this.ghostTime = 0;

    // --- Carrera
    this.progress = {
      s: 0,
      index: -1,
      lap: 0,
      nextCP: 0,
      lateral: 0,
      dist: 0,
      dy: 0,
      centerY: 0,
      raceDistance: 0,
      finished: false,
      finishTime: 0,
      lapTimes: [],
      lapStart: 0,
      bestLap: Infinity,
      wrongWay: 0,
      position: 1,
    };
    this.distanceTravelled = 0;

    // --- Entrada (la rellenan los controladores)
    this.input = {
      throttle: 0,
      steer: 0,
      drift: false,
      driftPressed: false,
      itemPressed: false,
      itemHeld: false,
      itemReleased: false,
      aim: 0,
      lookBack: false,
      respawn: false,
    };

    // --- Objetos
    this.item = null; // { id, uses }
    this.roulette = null; // { time, duration, result }
    this.held = null; // entidad sostenida (trampa detrás, guardia orbital...)
    this.itemCooldown = 0;

    this.controller = null;
    this.visual = null;
    this.engine = null;
  }

  get speed() {
    return this.vel.length();
  }

  get isStunned() {
    return this.stun.type !== null;
  }

  get isInvulnerable() {
    return this.invincible > 0 || this.starTime > 0 || this.comet > 0 || this.respawn.active;
  }

  /** Coloca el kart en una posición de salida. */
  placeAt(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.prevYaw = yaw;
    this.yawRate = 0;
    this.grounded = true;
    this.groundNormal.set(0, 1, 0);
    this.smoothNormal.set(0, 1, 0);
  }

  applyBoost(time, power = 1, source = 'boost') {
    this.boostTime = Math.max(this.boostTime, time);
    this.boostPower = Math.max(power, this.boostTime > time ? this.boostPower : power);
    this.boostSource = source;
  }

  /** Vector hacia delante (horizontal). */
  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}
