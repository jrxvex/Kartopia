// Bomba Estallido (área): se lanza en parábola (o se suelta detrás), rueda y explota
// alcanzando a todos los karts dentro de su radio.
import { ItemBehaviour, ItemEntity } from '../Item.js';
import { moveOnGround, kartInCone } from './common.js';

const RADIUS = 9.5;

export class BlastBombEntity extends ItemEntity {
  constructor(system, owner, aim) {
    super(system, owner, { visualType: 'blast-bomb', radius: 0.85, isTrap: true, itemId: 'blast-bomb', hitType: 'tumble', armTime: 0.5 });
    const fx = Math.sin(owner.yaw);
    const fz = Math.cos(owner.yaw);
    if (aim < 0) {
      this.pos.set(owner.pos.x - fx * 2.6, owner.pos.y + 0.9, owner.pos.z - fz * 2.6);
      this.vel.set(-fx * 3, 2, -fz * 3);
    } else {
      this.pos.set(owner.pos.x + fx * 2.2, owner.pos.y + 1.4, owner.pos.z + fz * 2.2);
      const sp = Math.max(0, owner.forwardSpeed) * 0.8 + 16;
      this.vel.set(fx * sp, 10.5, fz * sp);
    }
    this.airborne = true;
    this.fuse = null;
    this.life = 25;
    this.exploded = false;
  }

  update(dt) {
    super.update(dt);
    const r = moveOnGround(this, dt, this.system.world, this.system.track, {
      hover: 0.85,
      onLand: () => {
        if (this.fuse === null) this.fuse = 1.6;
        this.system.events.emit('item:bomb-land', { entity: this });
      },
    });
    if (!this.airborne) {
      this.vel.x *= Math.exp(-2.8 * dt);
      this.vel.z *= Math.exp(-2.8 * dt);
      if (this.fuse === null) this.fuse = 1.6;
    }
    if (this.fuse !== null) {
      this.fuse -= dt;
      if (this.fuse <= 0) {
        this.explode();
        return;
      }
    }
    this.spin += dt * Math.hypot(this.vel.x, this.vel.z) * 0.8;
    if (r.fell || this.age > this.life) this.destroy('fell');
  }

  onKartContact() {
    this.explode();
  }

  onEntityContact(other) {
    other.destroy('clash');
    this.explode();
  }

  explode() {
    if (this.exploded || this.dead) return;
    this.exploded = true;
    const sys = this.system;
    const race = sys.race;
    sys.events.emit('item:explosion', { x: this.pos.x, y: this.pos.y, z: this.pos.z, radius: RADIUS, owner: this.owner });
    for (const k of race.karts) {
      if (k.respawn.active || k.isGhost) continue;
      const dx = k.pos.x - this.pos.x;
      const dy = k.pos.y - this.pos.y;
      const dz = k.pos.z - this.pos.z;
      if (dx * dx + dz * dz < RADIUS * RADIUS && Math.abs(dy) < 5) {
        if (race.hit(k, 'tumble', this.owner) && k !== this.owner) {
          sys.events.emit('item:hit', { attacker: this.owner, victim: k, item: this.itemId });
        }
      }
    }
    for (const e of sys.entities) {
      if (e === this || e.dead || e.held) continue;
      const d2 = (e.pos.x - this.pos.x) ** 2 + (e.pos.z - this.pos.z) ** 2;
      if (d2 < RADIUS * RADIUS * 0.6) e.destroy('explosion');
    }
    this.destroy('explode');
  }
}

export class BlastBombItem extends ItemBehaviour {
  use(kart) {
    this.system.spawn(new BlastBombEntity(this.system, kart, kart.input.aim));
    this.system.events.emit('item:use', { kart, id: this.id, throw: true });
    return true;
  }

  aiDecide(kart, race, ai) {
    const ahead = kartInCone(kart, race.karts, 42, 0.3);
    if (ahead) {
      const d = Math.hypot(ahead.pos.x - kart.pos.x, ahead.pos.z - kart.pos.z);
      if (d > 14) return { use: true, aim: 1 };
    }
    if (kartInCone(kart, race.karts, 10, 0.5, true)) return { use: true, aim: -1 };
    if (kart.itemHeldTime > 14) return { use: true, aim: 1 };
    return null;
  }
}
