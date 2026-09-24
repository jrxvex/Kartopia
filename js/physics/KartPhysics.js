// Sistema de física arcade de los karts: aceleración, frenado, marcha atrás, giro, derrape con
// mini-turbos de 3 niveles, salto, control aéreo, trucos en rampas, gravedad, pendientes,
// fricción por superficie, turbos, colisiones con muros/obstáculos/karts, caídas y reaparición.
import { PHYSICS } from '../config.js';
import { SURFACE, surfaceDef } from './Surfaces.js';
import { clamp, approach, damp, wrapAngle, lerpAngle } from '../core/MathUtils.js';

const P = PHYSICS;
const g = { hit: false, y: 0, nx: 0, ny: 1, nz: 0, surface: 0 };
const col = { count: 0, nx: 0, nz: 0, depth: 0, kind: null, dynamic: null };
const fwd = { x: 0, y: 0, z: 1 };
const right = { x: -1, y: 0, z: 0 };

function basis(k, yaw) {
  const up = k.grounded ? k.groundNormal : { x: 0, y: 1, z: 0 };
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const d = fx * up.x + fz * up.z;
  let x = fx - up.x * d;
  let y = -up.y * d;
  let z = fz - up.z * d;
  let l = Math.hypot(x, y, z) || 1;
  fwd.x = x / l;
  fwd.y = y / l;
  fwd.z = z / l;
  // right = fwd × up
  x = fwd.y * up.z - fwd.z * up.y;
  y = fwd.z * up.x - fwd.x * up.z;
  z = fwd.x * up.y - fwd.y * up.x;
  l = Math.hypot(x, y, z) || 1;
  right.x = x / l;
  right.y = y / l;
  right.z = z / l;
  return up;
}

/** Velocidad angular máxima de giro a una velocidad dada (usada también por la IA). */
export function maxYawRate(params, speed) {
  const a = Math.abs(speed);
  const authority = clamp(a / P.LOW_SPEED_TURN, 0, 1);
  const highFall = 1 - 0.16 * clamp((a - 22) / 16, 0, 1);
  return P.TURN_RATE * params.handling * authority * highFall;
}

export function applyHit(k, type, source, ctx) {
  if (k.respawn.active) return false;
  if (k.invincible > 0 || k.starTime > 0 || k.comet > 0) return false;
  if (k.shield > 0) {
    k.shield = 0;
    k.invincible = 0.35;
    ctx.events.emit('kart:shield-pop', { kart: k, source });
    return false;
  }
  endDrift(k, ctx, false);
  if (type === 'freeze') {
    k.frozen = P.FREEZE_TIME;
    k.vel.multiplyScalar(0.7);
    k.boostTime = 0;
  } else if (type === 'spin') {
    k.stun.type = 'spin';
    k.stun.time = k.stun.duration = P.SPIN_TIME;
    k.vel.multiplyScalar(0.45);
    k.boostTime = 0;
    k.invincible = P.SPIN_TIME + 0.35;
  } else if (type === 'squash') {
    k.stun.type = 'squash';
    k.stun.time = k.stun.duration = 1.6;
    k.squash = 1.6;
    k.vel.multiplyScalar(0.1);
    k.boostTime = 0;
    k.invincible = 2.0;
  } else {
    k.stun.type = 'tumble';
    k.stun.time = k.stun.duration = P.TUMBLE_TIME;
    k.vel.multiplyScalar(0.18);
    if (k.grounded) {
      k.vel.y = 6.5;
      k.grounded = false;
    }
    k.boostTime = 0;
    k.invincible = P.TUMBLE_TIME + 0.4;
  }
  ctx.events.emit('kart:hit', { kart: k, type, source });
  return true;
}

export function endDrift(k, ctx, release = true) {
  const d = k.drift;
  if (!d.active) return;
  if (release && d.level > 0) {
    const t = P.MT_DURATIONS[d.level - 1] * k.params.mtMul;
    k.applyBoost(t, 1 + (d.level - 1) * 0.03, 'miniturbo');
    ctx.events.emit('kart:miniturbo', { kart: k, level: d.level });
  }
  d.active = false;
  d.dir = 0;
  d.charge = 0;
  d.level = 0;
  d.time = 0;
  ctx.events.emit('kart:drift-end', { kart: k });
}

function startDrift(k, dir, ctx) {
  const d = k.drift;
  d.active = true;
  d.dir = dir;
  d.charge = 0;
  d.level = 0;
  d.time = 0;
  ctx.events.emit('kart:drift-start', { kart: k, dir });
}

export function startRespawn(k, reason, ctx) {
  if (k.respawn.active) return;
  endDrift(k, ctx, false);
  k.boostTime = 0;
  k.comet = 0;
  k.stun.type = null;
  k.stun.time = 0;
  const target = ctx.track.respawnPoint(k.lastSafeS, k.lastSafeLateral * 0.4, k.progress.s);
  k.respawn.active = true;
  k.respawn.phase = 'fall';
  k.respawn.time = 0;
  k.respawn.reason = reason;
  k.respawn.target = target;
  if (reason === 'water' || reason === 'lava') k.vel.multiplyScalar(0.15);
  ctx.events.emit('kart:fall', { kart: k, reason });
}

function updateRespawn(k, dt, ctx) {
  const r = k.respawn;
  r.time += dt;
  if (r.phase === 'fall') {
    if (r.reason === 'water' || r.reason === 'lava') {
      k.vel.multiplyScalar(Math.exp(-4 * dt));
      k.vel.y = -1.5;
    } else {
      k.vel.y -= P.GRAVITY * dt;
    }
    k.pos.addScaledVector(k.vel, dt);
    if (r.time >= P.RESPAWN_FALL_TIME) {
      r.phase = 'carry';
      r.time = 0;
      const t = r.target;
      // Evita reaparecer encima de otro kart: desplazamiento lateral libre
      if (ctx.karts) {
        const tr = ctx.track;
        const hw = tr.width[t.index] * 0.5 - 2.2;
        for (const off of [0, 3.2, -3.2, 6, -6]) {
          const lat = Math.max(-hw, Math.min(hw, t.lateral + off));
          const pt = tr.pointAt(t.s, lat);
          const busy = ctx.karts.some((o) => o !== k && Math.hypot(o.pos.x - pt.x, o.pos.z - pt.z) < 2.6 && Math.abs(o.pos.y - pt.y) < 4);
          if (!busy) {
            t.x = pt.x;
            t.y = pt.y;
            t.z = pt.z;
            t.lateral = lat;
            break;
          }
        }
      }
      k.pos.set(t.x, t.y + 7, t.z);
      k.prevPos.copy(k.pos);
      k.vel.set(0, 0, 0);
      k.yaw = t.yaw;
      k.prevYaw = t.yaw;
      k.progress.index = t.index;
      ctx.events.emit('kart:carry', { kart: k });
    }
  } else if (r.phase === 'carry') {
    const t = r.target;
    const f = Math.min(1, r.time / P.RESPAWN_CARRY_TIME);
    const ease = 1 - Math.pow(1 - f, 2);
    k.pos.set(t.x, t.y + 7 - 6.4 * ease, t.z);
    k.yaw = t.yaw;
    if (f >= 1) {
      r.active = false;
      r.phase = null;
      k.grounded = false;
      k.airTime = 0;
      k.vel.set(0, -1, 0);
      k.invincible = P.RESPAWN_INVULN;
      k.ghostTime = P.RESPAWN_INVULN;
      k.stuckTime = 0;
      ctx.events.emit('kart:respawned', { kart: k });
    }
  }
}

/** Movimiento cinemático del Cometa Veloz: sigue la línea de carrera a gran velocidad. */
function stepComet(k, dt, ctx) {
  const tr = ctx.track;
  const speed = Math.max(k.params.maxSpeed * 1.6, 38);
  k.cometS = tr.wrapS(k.cometS + speed * dt);
  const lat = tr.lineOffset[tr.indexAtS(k.cometS)] * 0.6;
  const target = tr.pointAt(k.cometS, lat);
  const newYaw = tr.headingAt(k.cometS + 4);
  k.vel.set((target.x - k.pos.x) / dt, (target.y + 0.45 - k.pos.y) / dt, (target.z - k.pos.z) / dt);
  if (k.vel.length() > speed * 1.5) k.vel.setLength(speed);
  k.pos.set(target.x, target.y + 0.45, target.z);
  k.yaw = lerpAngle(k.yaw, newYaw, Math.min(1, dt * 12));
  k.yawRate = 0;
  k.grounded = true;
  k.groundNormal.set(0, 1, 0);
  k.forwardSpeed = speed;
  k.comet -= dt;
  if (k.comet <= 0) {
    k.comet = 0;
    k.vel.set(Math.sin(k.yaw) * k.params.maxSpeed, 0, Math.cos(k.yaw) * k.params.maxSpeed);
    k.applyBoost(0.8, 1, 'comet-end');
    k.invincible = Math.max(k.invincible, 0.8);
    ctx.events.emit('kart:comet-end', { kart: k });
  }
}

/**
 * Avanza la simulación de un kart un paso fijo.
 * ctx = { world, track, events, time }
 */
export function stepKart(k, dt, ctx) {
  const prm = k.params;
  k.prevPos.copy(k.pos);
  k.prevYaw = k.yaw;

  // --- temporizadores
  if (k.boostTime > 0) k.boostTime = Math.max(0, k.boostTime - dt);
  if (k.invincible > 0) k.invincible = Math.max(0, k.invincible - dt);
  if (k.shield > 0) {
    k.shield = Math.max(0, k.shield - dt);
    if (k.shield === 0) ctx.events.emit('kart:shield-end', { kart: k });
  }
  if (k.frozen > 0) k.frozen = Math.max(0, k.frozen - dt);
  if (k.starTime > 0) {
    k.starTime = Math.max(0, k.starTime - dt);
    if (k.starTime === 0) ctx.events.emit('kart:star-end', { kart: k });
  }
  if (k.squash > 0) k.squash = Math.max(0, k.squash - dt);
  if (k.ghostTime > 0) k.ghostTime = Math.max(0, k.ghostTime - dt);
  if (k.padCooldown > 0) k.padCooldown -= dt;
  if (k.bumpCooldown > 0) k.bumpCooldown -= dt;
  if (k.wallCooldown > 0) k.wallCooldown -= dt;
  if (k.trick.window > 0) k.trick.window -= dt;
  if (k.trick.anim > 0) k.trick.anim = Math.max(0, k.trick.anim - dt);
  if (k.stun.type) {
    k.stun.time -= dt;
    if (k.stun.time <= 0) {
      k.stun.type = null;
      k.stun.time = 0;
    }
  }

  if (k.respawn.active) {
    updateRespawn(k, dt, ctx);
    return;
  }
  if (k.comet > 0) {
    stepComet(k, dt, ctx);
    return;
  }

  const inp = k.input;
  const stunned = k.stun.type !== null;
  let throttle = stunned ? 0 : inp.throttle;
  let steer = stunned ? 0 : inp.steer;
  const driftHeld = !stunned && inp.drift;
  const driftPressed = !stunned && inp.driftPressed;
  inp.driftPressed = false;

  const up = basis(k, k.yaw);
  let vF = k.vel.x * fwd.x + k.vel.y * fwd.y + k.vel.z * fwd.z;
  let vR = k.vel.x * right.x + k.vel.y * right.y + k.vel.z * right.z;

  const surf = surfaceDef(k.surface);
  const boosting = k.boostTime > 0;
  const star = k.starTime > 0;
  let sMul = surf.speed;
  let aMul = surf.accel;
  let grip = surf.grip;
  if (surf.offroad) {
    sMul += (1 - sMul) * prm.traction * 0.42;
    aMul += (1 - aMul) * prm.traction * 0.4;
    if (boosting || star) {
      sMul = 1;
      aMul = 1;
    }
  }
  if (k.surface === SURFACE.ICE) grip += (1 - grip) * prm.traction * 0.5;
  let top = prm.maxSpeed * sMul * k.aiSpeedMul;
  if (k.frozen > 0) top *= 0.55;
  if (star) top *= 1.12;

  if (k.grounded) {
    // ----- Longitudinal
    if (throttle > 0.05) {
      if (vF < 0) vF = Math.min(0, vF + P.BRAKE_DECEL * throttle * dt);
      if (vF >= 0 && vF < top) {
        const r = clamp(vF / top, 0, 1);
        const a = prm.accel * aMul * (1 - 0.82 * Math.pow(r, 2.4));
        vF = Math.min(top, vF + a * throttle * dt);
      }
    } else if (throttle < -0.05) {
      if (vF > 0.5) vF = Math.max(0, vF - P.BRAKE_DECEL * -throttle * dt);
      else vF = Math.max(-P.REVERSE_MAX, vF - P.REVERSE_ACCEL * -throttle * dt);
    } else {
      vF = approach(vF, 0, P.COAST_DECEL * (surf.offroad ? 2.4 : 1) * dt);
    }
    if (vF > top && !boosting) {
      vF = Math.max(top, vF - (surf.offroad ? P.OFFROAD_OVERSPEED_DECAY : P.OVERSPEED_DECAY) * dt);
    }
    if (boosting) {
      const bTop = prm.maxSpeed * P.BOOST_MULT * k.boostPower * (k.frozen > 0 ? 0.7 : 1);
      if (vF < bTop) vF = Math.min(bTop, vF + P.BOOST_ACCEL * dt);
    }
    // gravedad a lo largo de la pendiente
    vF += -P.GRAVITY * fwd.y * P.SLOPE_FACTOR * dt;
    if (stunned) vF = approach(vF, 0, (k.stun.type === 'spin' ? 14 : 26) * dt);

    // ----- Salto / inicio de derrape
    if (driftPressed && !k.drift.active) {
      k.vel.set(fwd.x * vF + right.x * vR, fwd.y * vF + right.y * vR, fwd.z * vF + right.z * vR);
      k.vel.x += up.x * P.HOP_VELOCITY;
      k.vel.y += up.y * P.HOP_VELOCITY;
      k.vel.z += up.z * P.HOP_VELOCITY;
      k.grounded = false;
      k.hop.active = true;
      k.hop.time = 0;
      ctx.events.emit('kart:hop', { kart: k });
    }
  }

  if (k.grounded) {
    // ----- Derrape
    const d = k.drift;
    if (d.active) {
      d.time += dt;
      if (!driftHeld || vF < P.DRIFT_MIN_SPEED * 0.55) {
        endDrift(k, ctx, driftHeld === false && !stunned);
      } else {
        const sd = clamp(steer * d.dir, -1, 1);
        if (!surf.offroad) {
          d.charge += (0.8 + 0.5 * Math.max(0, sd)) * prm.mtMul * dt;
          const th = P.MT_THRESHOLDS;
          const lvl = d.charge >= th[2] ? 3 : d.charge >= th[1] ? 2 : d.charge >= th[0] ? 1 : 0;
          const maxLvl = k.maxDriftLevel ?? 3;
          const nl = Math.min(lvl, maxLvl);
          if (nl > d.level) {
            d.level = nl;
            ctx.events.emit('kart:drift-level', { kart: k, level: nl });
          }
        }
      }
    }

    // ----- Agarre lateral
    const gripRate = d.active ? P.DRIFT_GRIP : P.GRIP * grip;
    vR *= Math.exp(-gripRate * dt);
    if (d.active) vR += -d.dir * P.DRIFT_OUTWARD * dt * clamp(vF / 15, 0, 1);

    // ----- Giro
    let target;
    if (d.active) {
      const sd = clamp(steer * d.dir, -1, 1);
      const w = sd >= 0 ? P.DRIFT_BASE + (P.DRIFT_TIGHT - P.DRIFT_BASE) * sd : P.DRIFT_BASE + (P.DRIFT_BASE - P.DRIFT_WIDE) * sd;
      target = -d.dir * w * prm.handling * clamp(vF / 10, 0.4, 1);
    } else {
      const w = maxYawRate(prm, vF) * (surf.offroad ? 0.92 : 1);
      target = -steer * w * (vF < -0.3 ? -1 : 1);
    }
    k.yawRate = damp(k.yawRate, target, d.active ? 10 : 16, dt);
    k.yaw = wrapAngle(k.yaw + k.yawRate * dt);
    basis(k, k.yaw);
    k.vel.set(fwd.x * vF + right.x * vR, fwd.y * vF + right.y * vR, fwd.z * vF + right.z * vR);
    k.forwardSpeed = vF;
    k.lateralSpeed = vR;
  } else {
    // ----- En el aire
    k.airTime += dt;
    if (k.hop.active) k.hop.time += dt;
    k.vel.y -= P.GRAVITY * dt;
    // truco: pulsar salto tras despegar de una rampa
    if (driftPressed && k.trick.window > 0 && !k.trick.done) {
      k.trick.done = true;
      k.trick.anim = 0.55;
      k.trick.kind = (k.trick.kind + 1) % 3;
      ctx.events.emit('kart:trick', { kart: k });
    }
    let targetRate;
    if (k.drift.active) {
      const sd = clamp(steer * k.drift.dir, -1, 1);
      targetRate = -k.drift.dir * (P.DRIFT_BASE + 0.4 * sd) * 0.8;
    } else {
      targetRate = -steer * P.AIR_TURN_RATE;
    }
    k.yawRate = damp(k.yawRate, targetRate, 6, dt);
    k.yaw = wrapAngle(k.yaw + k.yawRate * dt);
    // control aéreo: la velocidad horizontal se orienta poco a poco hacia el morro
    const hv = Math.hypot(k.vel.x, k.vel.z);
    if (hv > 1) {
      const velYaw = Math.atan2(k.vel.x, k.vel.z);
      let diff = wrapAngle(k.yaw - velYaw);
      if (Math.abs(diff) < 1.6) {
        const maxRot = P.AIR_CONTROL * 0.3 * dt;
        const rot = clamp(diff, -maxRot, maxRot);
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const vx = k.vel.x * c + k.vel.z * s;
        const vz = -k.vel.x * s + k.vel.z * c;
        k.vel.x = vx;
        k.vel.z = vz;
      }
    }
    if (boosting) {
      const bTop = prm.maxSpeed * P.BOOST_MULT;
      if (hv < bTop) {
        k.vel.x += Math.sin(k.yaw) * 12 * dt;
        k.vel.z += Math.cos(k.yaw) * 12 * dt;
      }
    }
    k.vel.x *= 1 - 0.04 * dt;
    k.vel.z *= 1 - 0.04 * dt;
    k.forwardSpeed = k.vel.x * Math.sin(k.yaw) + k.vel.z * Math.cos(k.yaw);
  }

  // ----- Integración
  k.pos.x += k.vel.x * dt;
  k.pos.y += k.vel.y * dt;
  k.pos.z += k.vel.z * dt;

  // ----- Suelo
  const world = ctx.world;
  const wasGrounded = k.grounded;
  world.groundAt(k.pos.x, k.pos.z, k.pos.y + P.BLOCK_HEIGHT, g);
  if (g.hit && g.y > k.pos.y + P.STEP_UP) {
    // Escalón demasiado alto: se comporta como una pared.
    const mx = k.pos.x - k.prevPos.x;
    const mz = k.pos.z - k.prevPos.z;
    k.pos.x = k.prevPos.x;
    k.pos.z = k.prevPos.z;
    const ml = Math.hypot(mx, mz);
    if (ml > 1e-5) {
      const nx = -mx / ml;
      const nz = -mz / ml;
      const vn = k.vel.x * nx + k.vel.z * nz;
      if (vn < 0) {
        k.vel.x -= nx * vn * 1.3;
        k.vel.z -= nz * vn * 1.3;
        if (-vn > 4 && k.wallCooldown <= 0) {
          k.wallCooldown = 0.25;
          ctx.events.emit('kart:wall', { kart: k, impact: -vn, x: k.pos.x, y: k.pos.y + 0.5, z: k.pos.z });
        }
      }
    }
    world.groundAt(k.pos.x, k.pos.z, k.pos.y + P.STEP_UP, g);
  }

  let landed = false;
  if (g.hit) {
    const dist = k.pos.y - g.y;
    const vn = k.vel.x * g.nx + k.vel.y * g.ny + k.vel.z * g.nz;
    const snap = wasGrounded && !k.hop.active ? P.SNAP_DOWN : 0;
    if (dist <= snap + 1e-3 && (dist < 0 || vn < 3)) {
      if (!wasGrounded) landed = true;
      k.pos.y = g.y;
      k.grounded = true;
      k.groundNormal.set(g.nx, g.ny, g.nz);
      k.surface = g.surface;
      k.lastGroundSurface = g.surface;
      if (vn < 0) {
        k.vel.x -= g.nx * vn;
        k.vel.y -= g.ny * vn;
        k.vel.z -= g.nz * vn;
      }
    } else {
      k.grounded = false;
    }
  } else {
    k.grounded = false;
  }

  if (wasGrounded && !k.grounded && !k.hop.active) {
    // despegue: rampa o borde
    if (k.lastGroundSurface === SURFACE.RAMP) {
      k.vel.y += P.RAMP_LAUNCH;
      k.trick.window = P.TRICK_WINDOW;
      k.trick.done = false;
      ctx.events.emit('kart:ramp', { kart: k });
    } else if (k.vel.y > 3.5) {
      k.trick.window = P.TRICK_WINDOW * 0.8;
      k.trick.done = false;
    }
    k.airTime = 0;
  }

  if (landed) {
    const impact = Math.max(0, -Math.min(0, k.vel.y));
    ctx.events.emit('kart:land', { kart: k, airTime: k.airTime, impact });
    if (k.trick.done) {
      k.applyBoost(P.TRICK_BOOST_TIME, 1, 'trick');
      ctx.events.emit('kart:trick-boost', { kart: k });
    }
    k.trick.done = false;
    k.trick.window = 0;
    k.hop.active = false;
    // inicio del derrape al aterrizar (del salto o de cualquier salto manteniendo el botón)
    if (driftHeld && !k.drift.active && Math.abs(steer) > 0.3 && k.forwardSpeed > P.DRIFT_MIN_SPEED && !stunned) {
      startDrift(k, Math.sign(steer), ctx);
    }
    k.airTime = 0;
  }
  if (!k.grounded && k.drift.active && k.airTime > 0.6) endDrift(k, ctx, false);

  // Suavizado de la normal para el render
  const sn = k.smoothNormal;
  const tn = k.grounded ? k.groundNormal : { x: 0, y: 1, z: 0 };
  const f = 1 - Math.exp(-(k.grounded ? 14 : 3) * dt);
  sn.x += (tn.x - sn.x) * f;
  sn.y += (tn.y - sn.y) * f;
  sn.z += (tn.z - sn.z) * f;
  sn.normalize();

  // ----- Paneles turbo
  if (k.grounded && k.surface === SURFACE.BOOST && k.padCooldown <= 0) {
    k.applyBoost(P.PAD_BOOST_TIME, 1.05, 'pad');
    k.padCooldown = 0.35;
    ctx.events.emit('kart:boostpad', { kart: k });
  }

  // ----- Muros y obstáculos
  if (world.collideCircle(k.pos, k.radius, k.height, col) > 0) {
    const nx = col.nx;
    const nz = col.nz;
    const vn = k.vel.x * nx + k.vel.z * nz;
    if (vn < 0) {
      k.vel.x -= nx * vn * (1 + P.WALL_RESTITUTION);
      k.vel.z -= nz * vn * (1 + P.WALL_RESTITUTION);
      const impact = -vn;
      const fr = 1 - P.WALL_FRICTION * Math.min(1, impact / 10);
      k.vel.x *= fr;
      k.vel.z *= fr;
      if (impact > 4 && k.wallCooldown <= 0) {
        k.wallCooldown = 0.25;
        ctx.events.emit('kart:wall', { kart: k, impact, x: k.pos.x - nx * k.radius, y: k.pos.y + 0.5, z: k.pos.z - nz * k.radius, kind: col.kind });
      }
      if (impact > 11 && k.drift.active) endDrift(k, ctx, false);
      // desvío suave del morro a lo largo del muro (evita quedarse pegado)
      if (k.grounded && impact > 1.5) {
        const t1x = -nz;
        const t1z = nx;
        const fx = Math.sin(k.yaw);
        const fz = Math.cos(k.yaw);
        const sgn = fx * t1x + fz * t1z >= 0 ? 1 : -1;
        const tyaw = Math.atan2(t1x * sgn, t1z * sgn);
        const diff = wrapAngle(tyaw - k.yaw);
        if (Math.abs(diff) < 1.3) k.yaw = wrapAngle(k.yaw + diff * Math.min(0.35, impact * 0.03));
      }
    }
    if (col.dynamic && col.dynamic.hit) applyHit(k, col.dynamic.hit, col.dynamic.hazard || null, ctx);
  }
  if (col.soft && col.soft.hit) applyHit(k, col.soft.hit, col.soft.hazard || null, ctx);

  // ----- Muertes / caídas
  const tr = ctx.track;
  if (k.pos.y < tr.killY) {
    startRespawn(k, 'fall', ctx);
    return;
  }
  const sd = surfaceDef(k.surface);
  if (k.grounded && sd.kill && k.starTime <= 0) {
    startRespawn(k, sd.kill, ctx);
    return;
  }
  if (tr.waterLevel !== null && k.pos.y < tr.waterLevel - 0.9) {
    startRespawn(k, 'water', ctx);
    return;
  }
  if (tr.lavaLevel !== null && k.pos.y < tr.lavaLevel + 0.25) {
    startRespawn(k, 'lava', ctx);
    return;
  }
  if (!k.grounded && k.airTime > 0.35 && k.pos.y < k.progress.centerY - P.FALL_DEPTH) {
    startRespawn(k, 'fall', ctx);
    return;
  }
  if (k.progress.dist > P.OUT_OF_BOUNDS + tr.width[Math.max(0, k.progress.index)] * 0.5) {
    startRespawn(k, 'oob', ctx);
    return;
  }
  if (inp.respawn) {
    inp.respawn = false;
    startRespawn(k, 'manual', ctx);
    return;
  }

  k.distanceTravelled += Math.hypot(k.pos.x - k.prevPos.x, k.pos.z - k.prevPos.z);
}

/** Colisiones kart-kart (empujones con masa según el peso). */
export function resolveKartCollisions(karts, ctx) {
  const n = karts.length;
  for (let i = 0; i < n; i++) {
    const a = karts[i];
    if (a.respawn.active || a.isGhost || a.ghostTime > 0) continue;
    for (let j = i + 1; j < n; j++) {
      const b = karts[j];
      if (b.respawn.active || b.isGhost || b.ghostTime > 0) continue;
      if (Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const minD = a.radius + b.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD) continue;
      const d = Math.sqrt(d2);
      const nx = d > 1e-4 ? dx / d : 1;
      const nz = d > 1e-4 ? dz / d : 0;
      const overlap = minD - d;
      const ma = a.params.weight * (a.starTime > 0 || a.comet > 0 ? 6 : 1);
      const mb = b.params.weight * (b.starTime > 0 || b.comet > 0 ? 6 : 1);
      const wa = mb / (ma + mb);
      const wb = ma / (ma + mb);
      a.pos.x -= nx * overlap * wa;
      a.pos.z -= nz * overlap * wa;
      b.pos.x += nx * overlap * wb;
      b.pos.z += nz * overlap * wb;
      const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
      if (rv < 0) {
        const jImp = (-(1 + P.KART_RESTITUTION) * rv) / (1 / ma + 1 / mb);
        a.vel.x -= (nx * jImp) / ma;
        a.vel.z -= (nz * jImp) / ma;
        b.vel.x += (nx * jImp) / mb;
        b.vel.z += (nz * jImp) / mb;
        if (a.bumpCooldown <= 0 && b.bumpCooldown <= 0) {
          a.vel.x -= nx * P.KART_BUMP * wa;
          a.vel.z -= nz * P.KART_BUMP * wa;
          b.vel.x += nx * P.KART_BUMP * wb;
          b.vel.z += nz * P.KART_BUMP * wb;
          a.bumpCooldown = b.bumpCooldown = 0.3;
          ctx.events.emit('kart:bump', {
            a,
            b,
            impact: -rv,
            x: (a.pos.x + b.pos.x) / 2,
            y: (a.pos.y + b.pos.y) / 2 + 0.6,
            z: (a.pos.z + b.pos.z) / 2,
          });
        }
      }
      if (a.starTime > 0 || a.comet > 0) {
        if (applyHit(b, 'tumble', a, ctx)) ctx.events.emit('item:hit', { attacker: a, victim: b, item: a.comet > 0 ? 'comet-rush' : 'prism-aura' });
      }
      if (b.starTime > 0 || b.comet > 0) {
        if (applyHit(a, 'tumble', b, ctx)) ctx.events.emit('item:hit', { attacker: b, victim: a, item: b.comet > 0 ? 'comet-rush' : 'prism-aura' });
      }
    }
  }
}
