// Trampa Pegajosa: se lleva detrás como defensa (bloquea proyectiles) y se suelta o se lanza.
// Quien la pisa hace un trompo.
import { ItemBehaviour, ItemEntity } from '../Item.js';
import { moveOnGround } from './common.js';

export class GooTrapEntity extends ItemEntity {
  constructor(system, owner) {
    super(system, owner, { visualType: 'goo-trap', radius: 1.05, isTrap: true, itemId: 'goo-trap', hitType: 'spin', armTime: 0.7 });
    this.holdable = true;
    this.held = true;
    this.life = 120;
    this.airborne = false;
    this.follow();
  }

  follow() {
    const o = this.owner;
    this.pos.set(o.pos.x - Math.sin(o.yaw) * 2.4, o.pos.y + 0.35, o.pos.z - Math.cos(o.yaw) * 2.4);
  }

  update(dt) {
    super.update(dt);
    if (this.held) {
      if (!this.owner || this.owner.respawn.active) {
        this.destroy('lost');
        return;
      }
      this.follow();
      return;
    }
    if (this.airborne || this.vel.lengthSq() > 0.01) {
      const r = moveOnGround(this, dt, this.system.world, this.system.track, {
        hover: 0.3,
        bounce: true,
        onLand: () => {
          this.vel.x *= 0.3;
          this.vel.z *= 0.3;
        },
      });
      if (!this.airborne) {
        this.vel.x *= Math.exp(-6 * dt);
        this.vel.z *= Math.exp(-6 * dt);
      }
      if (r.fell) this.destroy('fell');
    }
    if (this.age > this.life) this.destroy('expire');
  }

  drop(aim) {
    const o = this.owner;
    this.held = false;
    this.age = 0;
    if (o && o.held === this) o.held = null;
    if (aim > 0) {
      this.pos.set(o.pos.x + Math.sin(o.yaw) * 2.5, o.pos.y + 1.2, o.pos.z + Math.cos(o.yaw) * 2.5);
      const sp = Math.max(0, o.forwardSpeed) + 12;
      this.vel.set(Math.sin(o.yaw) * sp, 9, Math.cos(o.yaw) * sp);
      this.airborne = true;
      this.armTime = 0.3;
    } else {
      this.follow();
      this.vel.set(0, 0, 0);
      this.airborne = true; // cae al suelo
    }
    this.system.events.emit('item:drop', { entity: this, kart: o, thrown: aim > 0 });
  }
}

export class GooTrapItem extends ItemBehaviour {
  use(kart) {
    const e = new GooTrapEntity(this.system, kart);
    kart.held = e;
    this.system.spawn(e);
    this.system.events.emit('item:use', { kart, id: this.id });
    return true;
  }

  aiDecide(kart, race, ai) {
    return { use: true, hold: true, aim: 0 };
  }
}
