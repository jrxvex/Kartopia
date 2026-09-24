// Orbe Pulso (proyectil): viaja en línea recta sobre el terreno y rebota en los muros.
import { ItemBehaviour, ItemEntity } from '../Item.js';
import { moveOnGround, launchVelocity, kartInCone } from './common.js';

export class PulseOrbEntity extends ItemEntity {
  constructor(system, owner, aim, opts = {}) {
    super(system, owner, {
      visualType: opts.visualType || 'pulse-orb',
      radius: 0.65,
      isProjectile: true,
      itemId: opts.itemId || 'pulse-orb',
      hitType: 'tumble',
      armTime: 0.45,
    });
    const f = aim < 0 ? -1 : 1;
    const start = opts.from || owner.pos;
    this.pos.set(start.x + Math.sin(owner.yaw) * 2.6 * f, owner.pos.y + 0.65, start.z + Math.cos(owner.yaw) * 2.6 * f);
    this.speed = opts.speed ?? 44;
    const v = launchVelocity(owner, this.speed, aim);
    this.vel.set(v.x, 0, v.z);
    this.speed = Math.hypot(v.x, v.z);
    this.bounces = 0;
    this.maxBounces = opts.maxBounces ?? 6;
    this.life = opts.life ?? 9;
    this.airborne = false;
  }

  update(dt) {
    super.update(dt);
    const r = moveOnGround(this, dt, this.system.world, this.system.track, { hover: 0.65 });
    if (r.wall) {
      this.bounces++;
      this.system.events.emit('item:bounce', { entity: this, x: this.pos.x, y: this.pos.y, z: this.pos.z });
      if (this.bounces > this.maxBounces) this.destroy('bounces');
    }
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > 0.1) {
      this.vel.x *= this.speed / hv;
      this.vel.z *= this.speed / hv;
    }
    this.spin += dt * 14;
    if (r.fell || this.age > this.life) this.destroy('expire');
  }
}

export class PulseOrbItem extends ItemBehaviour {
  use(kart) {
    this.system.spawn(new PulseOrbEntity(this.system, kart, kart.input.aim));
    this.system.events.emit('item:use', { kart, id: this.id, throw: true });
    return true;
  }

  aiDecide(kart, race, ai) {
    if (kartInCone(kart, race.karts, 55, 0.13)) return { use: true, aim: 1 };
    const behind = kartInCone(kart, race.karts, 16, 0.22, true);
    if (behind && ai.rng.next() < 0.4) return { use: true, aim: -1 };
    if (kart.itemHeldTime > 16) return { use: true, aim: 1 };
    return null;
  }
}
