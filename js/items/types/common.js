// Movimiento compartido de proyectiles: avance, seguimiento del suelo, caída y rebote en muros.
import { PHYSICS } from '../../config.js';

const g = {};
const col = {};
const STEP = 1.3;

/**
 * Mueve una entidad que "rueda/flota" sobre el suelo.
 * Devuelve {wall: bool, nx, nz} si chocó con un muro en este paso.
 */
export function moveOnGround(ent, dt, world, track, opts = {}) {
  const hover = opts.hover ?? ent.radius;
  const res = { wall: false, nx: 0, nz: 0, fell: false };
  const px = ent.pos.x;
  const pz = ent.pos.z;
  ent.pos.x += ent.vel.x * dt;
  ent.pos.z += ent.vel.z * dt;
  const baseY = ent.pos.y - hover;

  // Escalón demasiado alto → como un muro
  world.groundAt(ent.pos.x, ent.pos.z, baseY + 3, g);
  if (g.hit && g.y > baseY + STEP) {
    const mx = ent.pos.x - px;
    const mz = ent.pos.z - pz;
    const ml = Math.hypot(mx, mz) || 1;
    ent.pos.x = px;
    ent.pos.z = pz;
    res.wall = true;
    res.nx = -mx / ml;
    res.nz = -mz / ml;
    world.groundAt(ent.pos.x, ent.pos.z, baseY + STEP, g);
  }

  if (!ent.airborne) {
    if (g.hit && g.y >= baseY - 0.9) {
      ent.pos.y = g.y + hover;
      ent.vel.y = 0;
      ent.surface = g.surface;
    } else {
      ent.airborne = true;
      ent.vel.y = Math.min(ent.vel.y, 0);
    }
  }
  if (ent.airborne) {
    ent.vel.y -= PHYSICS.GRAVITY * dt * (opts.gravityScale ?? 1);
    ent.pos.y += ent.vel.y * dt;
    if (g.hit && ent.vel.y <= 0 && ent.pos.y - hover <= g.y) {
      ent.airborne = false;
      ent.pos.y = g.y + hover;
      ent.vel.y = 0;
      ent.surface = g.surface;
      if (opts.onLand) opts.onLand(g);
    }
  }

  // Muros
  const p = { x: ent.pos.x, y: ent.pos.y - hover, z: ent.pos.z };
  if (world.collideCircle(p, ent.radius, 1.2, col, opts.dynamic !== false) > 0) {
    ent.pos.x = p.x;
    ent.pos.z = p.z;
    res.wall = true;
    res.nx = col.nx;
    res.nz = col.nz;
  }
  if (res.wall && opts.bounce !== false) {
    const vn = ent.vel.x * res.nx + ent.vel.z * res.nz;
    if (vn < 0) {
      ent.vel.x -= 2 * vn * res.nx;
      ent.vel.z -= 2 * vn * res.nz;
    }
  }

  // Caídas y líquidos
  if (ent.pos.y < track.killY || (track.waterLevel !== null && ent.pos.y < track.waterLevel - 0.5) || (track.lavaLevel !== null && ent.pos.y < track.lavaLevel + 0.3)) {
    res.fell = true;
  }
  return res;
}

/** Dirección hacia delante (o atrás) de un kart con una velocidad inicial. */
export function launchVelocity(kart, speed, aim) {
  const dir = aim < 0 ? -1 : 1;
  const fx = Math.sin(kart.yaw) * dir;
  const fz = Math.cos(kart.yaw) * dir;
  const base = aim < 0 ? 0 : Math.max(0, kart.forwardSpeed);
  return { x: fx * (speed + base * 0.6), z: fz * (speed + base * 0.6) };
}

/** Busca un kart dentro de un cono delantero: devuelve el más cercano o null. */
export function kartInCone(kart, karts, maxDist, maxAngle, backwards = false) {
  let best = null;
  let bd = maxDist;
  const dir = backwards ? -1 : 1;
  const fx = Math.sin(kart.yaw) * dir;
  const fz = Math.cos(kart.yaw) * dir;
  for (const o of karts) {
    if (o === kart || o.respawn.active || o.isGhost) continue;
    const dx = o.pos.x - kart.pos.x;
    const dz = o.pos.z - kart.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bd || d < 0.5) continue;
    if (Math.abs(o.pos.y - kart.pos.y) > 4) continue;
    const cos = (dx * fx + dz * fz) / d;
    if (cos < Math.cos(maxAngle)) continue;
    best = o;
    bd = d;
  }
  return best;
}
