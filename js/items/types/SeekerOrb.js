// Orbe Rastreador: sigue el circuito y persigue al kart que va justo delante.
import { ItemBehaviour, ItemEntity } from '../Item.js';
import { moveOnGround, kartInCone } from './common.js';
import { wrapDelta } from '../../core/MathUtils.js';

export class SeekerOrbEntity extends ItemEntity {
  constructor(system, owner, target, aim) {
    super(system, owner, { visualType: 'seeker-orb', radius: 0.7, isProjectile: true, itemId: 'seeker-orb', hitType: 'tumble', armTime: 0.6 });
    this.target = aim < 0 ? null : target;
    this.mode = this.target ? 'track' : 'straight';
    const f = aim < 0 ? -1 : 1;
    this.pos.set(owner.pos.x + Math.sin(owner.yaw) * 2.6 * f, owner.pos.y + 0.7, owner.pos.z + Math.cos(owner.yaw) * 2.6 * f);
    this.speed = 50;
    this.vel.set(Math.sin(owner.yaw) * this.speed * f, 0, Math.cos(owner.yaw) * this.speed * f);
    this.hint = owner.progress.index;
    this.s = owner.progress.s;
    this.proj = {};
    this.life = 14;
    this.airborne = false;
    this.bounces = 0;
  }

  update(dt) {
    super.update(dt);
    const tr = this.system.track;
    if (this.mode === 'track' && this.target) {
      tr.project(this.pos.x, this.pos.y, this.pos.z, this.hint, this.proj);
      this.hint = this.proj.index;
      this.s = this.proj.s;
      const t = this.target;
      const gap = wrapDelta(t.progress.s - this.s, tr.length);
      let ax;
      let az;
      if ((gap > -3 && gap < 26 && Math.abs(t.pos.y - this.pos.y) < 5) || Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) < 7) {
        ax = t.pos.x;
        az = t.pos.z;
      } else {
        const p = tr.linePointAt(this.s + 13, 0);
        ax = p.x;
        az = p.z;
      }
      const dx = ax - this.pos.x;
      const dz = az - this.pos.z;
      const want = Math.atan2(dx, dz);
      const cur = Math.atan2(this.vel.x, this.vel.z);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 6.5 * dt;
      const ang = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
      this.vel.x = Math.sin(ang) * this.speed;
      this.vel.z = Math.cos(ang) * this.speed;
    }
    const r = moveOnGround(this, dt, this.system.world, tr, { hover: 0.7, bounce: this.mode === 'straight' });
    if (r.wall) {
      if (this.mode === 'track' && this.age > 0.25) {
        this.destroy('wall');
        return;
      }
      this.bounces++;
      if (this.bounces > 3) this.destroy('bounces');
    }
    this.spin += dt * 10;
    if (r.fell || this.age > this.life) this.destroy('expire');
  }
}

export class SeekerOrbItem extends ItemBehaviour {
  use(kart) {
    const race = this.system.race;
    const target = kart.input.aim < 0 ? null : race.kartAhead(kart);
    const e = new SeekerOrbEntity(this.system, kart, target, kart.input.aim);
    this.system.spawn(e);
    this.system.events.emit('item:use', { kart, id: this.id, throw: true });
    if (target) this.system.events.emit('item:lock-on', { attacker: kart, target, entity: e });
    return true;
  }

  aiDecide(kart, race, ai) {
    if (kart.progress.position > 1) {
      const ahead = race.kartAhead(kart);
      if (ahead && race.gapBetween(kart, ahead) < 180) return { use: true, aim: 0 };
      return null;
    }
    const behind = kartInCone(kart, race.karts, 15, 0.3, true);
    if (behind) return { use: true, aim: -1 };
    if (kart.itemHeldTime > 20) return { use: true, aim: 1 };
    return null;
  }
}
