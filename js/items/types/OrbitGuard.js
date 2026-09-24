// Guardia Orbital (defensivo): tres cristales giran alrededor del kart bloqueando ataques y
// golpeando a quien se acerque. Cada pulsación posterior dispara un cristal hacia delante.
import { ItemBehaviour, ItemEntity } from '../Item.js';
import { moveOnGround, kartInCone } from './common.js';

export class OrbitCrystalEntity extends ItemEntity {
  constructor(system, owner, slot, total) {
    super(system, owner, { visualType: 'orbit-crystal', radius: 0.6, isProjectile: false, itemId: 'orbit-guard', hitType: 'tumble', armTime: 0.4 });
    this.held = true;
    this.angle = (slot / total) * Math.PI * 2;
    this.life = 8;
    this.airborne = false;
    this.bounces = 0;
    this.orbit();
  }

  orbit() {
    const o = this.owner;
    this.pos.set(o.pos.x + Math.cos(this.angle) * 2.3, o.pos.y + 0.8, o.pos.z + Math.sin(this.angle) * 2.3);
  }

  canHit(kart) {
    if (this.dead) return false;
    if (kart === this.owner) return !this.held && this.age > this.armTime;
    return true;
  }

  update(dt) {
    super.update(dt);
    this.spin += dt * 6;
    if (this.held) {
      if (!this.owner || this.owner.respawn.active) {
        this.destroy('lost');
        return;
      }
      this.angle += dt * 5;
      this.orbit();
      return;
    }
    const r = moveOnGround(this, dt, this.system.world, this.system.track, { hover: 0.6 });
    if (r.wall) {
      this.bounces++;
      if (this.bounces > 2) this.destroy('bounces');
    }
    if (r.fell || this.age > this.life) this.destroy('expire');
  }

  fire() {
    const o = this.owner;
    this.held = false;
    this.isProjectile = true;
    this.age = 0;
    this.pos.set(o.pos.x + Math.sin(o.yaw) * 2.6, o.pos.y + 0.6, o.pos.z + Math.cos(o.yaw) * 2.6);
    const sp = 42 + Math.max(0, o.forwardSpeed) * 0.6;
    this.vel.set(Math.sin(o.yaw) * sp, 0, Math.cos(o.yaw) * sp);
  }

  destroy(reason) {
    if (this.dead) return;
    super.destroy(reason);
    const o = this.owner;
    if (this.held && o && o.item && o.item.id === 'orbit-guard' && o.orbit) {
      o.item.uses--;
      o.orbit = o.orbit.filter((c) => c !== this);
      if (o.item.uses <= 0) {
        o.item = null;
        o.orbit = null;
      }
    }
  }
}

export class OrbitGuardItem extends ItemBehaviour {
  use(kart) {
    const item = kart.item;
    if (!item.active) {
      item.active = true;
      kart.orbit = [];
      for (let i = 0; i < item.uses; i++) {
        const c = new OrbitCrystalEntity(this.system, kart, i, item.uses);
        kart.orbit.push(c);
        this.system.spawn(c);
      }
      this.system.events.emit('item:use', { kart, id: this.id, activate: true });
      return false;
    }
    const c = kart.orbit && kart.orbit.find((e) => !e.dead && e.held);
    if (!c) {
      kart.item = null;
      kart.orbit = null;
      return false;
    }
    c.fire();
    kart.orbit = kart.orbit.filter((e) => e !== c);
    this.system.events.emit('item:use', { kart, id: this.id, throw: true });
    return true;
  }

  aiDecide(kart, race, ai) {
    if (!kart.item.active) return { use: true };
    if (kartInCone(kart, race.karts, 45, 0.14)) return { use: true, aim: 1 };
    if (kart.itemHeldTime > 25) return { use: true, aim: 1 };
    return null;
  }
}
