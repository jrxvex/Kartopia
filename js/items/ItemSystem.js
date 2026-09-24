// Sistema de objetos: cajas, ruleta con probabilidades según la posición, uso de objetos,
// entidades en el mundo (proyectiles, trampas, bombas...) y sus colisiones.
import { ItemBox } from './ItemBox.js';
import { ITEM_BEHAVIOURS } from './ItemRegistry.js';
import { Random } from '../core/Random.js';
import { wrapDelta } from '../core/MathUtils.js';

export class ItemSystem {
  constructor(race, data, { enabled = true } = {}) {
    this.race = race;
    this.track = race.track;
    this.world = race.track.collision;
    this.events = race.events;
    this.enabled = enabled;
    this.defs = data.items;
    this.defMap = new Map(this.defs.map((d) => [d.id, d]));
    this.settings = data.itemSettings || { rouletteTime: 1.5, boxRespawnTime: 2.4, positionBrackets: 8 };
    this.behaviours = {};
    for (const def of this.defs) {
      const Cls = ITEM_BEHAVIOURS[def.id];
      if (Cls) this.behaviours[def.id] = new Cls(def, this);
    }
    this.boxes = enabled ? this.track.itemBoxSpots.map((s, i) => new ItemBox(s, i)) : [];
    this.entities = [];
    this.rng = new Random((race.config.seed ?? 7) * 31 + 5);
    this._threats = [];
    this.offs = [
      this.events.on('kart:hit', ({ kart }) => this.onKartHit(kart)),
      this.events.on('kart:fall', ({ kart }) => this.onKartHit(kart)),
    ];
  }

  behaviourFor(id) {
    return this.behaviours[id];
  }

  itemDef(id) {
    return this.defMap.get(id);
  }

  giveItem(kart, id, silent = false) {
    const def = this.defMap.get(id);
    if (!def) return;
    kart.item = { id, uses: def.uses, active: false };
    kart.itemHeldTime = 0;
    if (!silent) this.events.emit('item:get', { kart, id });
  }

  /** Objeto aleatorio ponderado según la posición en carrera. */
  pickItem(kart) {
    const n = this.race.karts.length;
    const brackets = this.settings.positionBrackets || 8;
    const pos = kart.progress.position;
    const b = n <= 1 ? 0 : Math.round(((pos - 1) / (n - 1)) * (brackets - 1));
    const weights = this.defs.map((d) => {
      let w = d.weights[Math.min(b, d.weights.length - 1)] ?? 0;
      // Limitar objetos devastadores repetidos en pista
      if (d.id === 'frost-wave' && this.recentFrost > 0) w *= 0.15;
      if (d.id === 'comet-rush' && this.race.time < 15) w = 0;
      return w;
    });
    const idx = this.rng.weighted(weights);
    return this.defs[Math.max(0, idx)].id;
  }

  startRoulette(kart) {
    const result = this.pickItem(kart);
    if (result === 'frost-wave') this.recentFrost = 20;
    kart.roulette = { time: 0, duration: this.settings.rouletteTime, result };
    this.events.emit('item:roulette', { kart });
  }

  handleInputs(dt) {
    if (this.recentFrost > 0) this.recentFrost -= dt;
    const racing = this.race.phase === 'racing' || this.race.phase === 'finished';
    for (const k of this.race.karts) {
      const inp = k.input;
      if (k.roulette) {
        k.roulette.time += dt;
        if (k.roulette.time >= k.roulette.duration) {
          const id = k.roulette.result;
          k.roulette = null;
          this.giveItem(k, id);
        }
      }
      if (k.item) k.itemHeldTime = (k.itemHeldTime || 0) + dt;
      if (k.itemCooldown > 0) k.itemCooldown -= dt;
      const canUse = racing && !k.respawn.active && !k.stun.type && k.comet <= 0;
      if (inp.itemPressed && k.item && !k.roulette && canUse && k.itemCooldown <= 0 && !(k.held && k.held.held)) {
        const beh = this.behaviours[k.item.id];
        if (beh) {
          const id = k.item.id;
          const consumed = beh.use(k);
          if (consumed && k.item && k.item.id === id) {
            k.item.uses--;
            if (k.item.uses <= 0) {
              k.item = null;
              k.orbit = null;
            }
          }
          if (consumed) this.events.emit('item:used', { kart: k, id });
          k.itemCooldown = 0.3;
        }
      }
      if (k.held && k.held.holdable && k.held.held) {
        if (!inp.itemHeld || inp.itemReleased || !canUse) {
          const e = k.held;
          k.held = null;
          e.drop(canUse ? inp.aim : 0);
        }
      }
      inp.itemPressed = false;
      inp.itemReleased = false;
    }
  }

  update(dt) {
    // Cajas
    for (const box of this.boxes) {
      if (box.update(dt)) this.events.emit('item:box-respawn', { box });
      if (!box.active) continue;
      for (const k of this.race.karts) {
        if (k.respawn.active || k.isGhost) continue;
        if (box.touches(k)) {
          box.break(this.settings.boxRespawnTime);
          this.events.emit('item:box-break', { box, kart: k });
          if (!k.item && !k.roulette && !k.held) this.startRoulette(k);
          break;
        }
      }
    }
    // Entidades
    for (const e of this.entities) if (!e.dead) e.update(dt);
    const karts = this.race.karts;
    for (const e of this.entities) {
      if (e.dead) continue;
      for (const k of karts) {
        if (k.respawn.active || k.isGhost || !e.canHit(k)) continue;
        const dx = k.pos.x - e.pos.x;
        const dz = k.pos.z - e.pos.z;
        const dy = k.pos.y + 0.6 - e.pos.y;
        const r = e.radius + k.radius;
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < 1.9) {
          e.onKartContact(k);
          if (e.dead) break;
        }
      }
    }
    const ents = this.entities;
    for (let i = 0; i < ents.length; i++) {
      const a = ents[i];
      if (a.dead) continue;
      for (let j = i + 1; j < ents.length; j++) {
        const b = ents[j];
        if (b.dead) continue;
        if (!a.isProjectile && !b.isProjectile && !(a.held || b.held)) continue;
        if (!a.isProjectile && !b.isProjectile) continue;
        if (a.owner === b.owner && (a.held || b.held) && Math.min(a.age, b.age) < 0.6) continue;
        if (a.owner === b.owner && a.held && b.held) continue;
        const dx = a.pos.x - b.pos.x;
        const dz = a.pos.z - b.pos.z;
        const dy = a.pos.y - b.pos.y;
        const r = a.radius + b.radius;
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < 1.6) {
          if (b.visualType === 'blast-bomb') b.onEntityContact(a);
          else a.onEntityContact(b);
          if (a.dead) break;
        }
      }
    }
    if (ents.some((e) => e.dead)) this.entities = ents.filter((e) => !e.dead);
  }

  spawn(entity) {
    this.entities.push(entity);
    this.events.emit('item:spawn', { entity });
    return entity;
  }

  onKartHit(kart) {
    if (kart.held && kart.held.holdable) {
      const e = kart.held;
      kart.held = null;
      e.destroy('lost');
    }
    if (kart.item && kart.item.id === 'orbit-guard' && kart.item.active) {
      const crystals = kart.orbit || [];
      kart.item = null;
      kart.orbit = null;
      for (const c of crystals) c.destroy('lost');
    }
  }

  /** Trampas y bombas en el suelo que la IA debe esquivar. */
  getThreats() {
    const out = this._threats;
    out.length = 0;
    for (const e of this.entities) {
      if (e.dead || e.held) continue;
      if (e.isTrap) out.push({ x: e.pos.x, y: e.pos.y, z: e.pos.z, r: e.radius + 0.4 });
    }
    return out;
  }

  /** Próxima caja activa por delante (para que la IA la busque). */
  nextBoxFor(kart, range) {
    const L = this.track.length;
    let best = null;
    let bestScore = Infinity;
    for (const b of this.boxes) {
      if (!b.active) continue;
      const ds = wrapDelta(b.s - kart.progress.s, L);
      if (ds < 6 || ds > range) continue;
      const score = ds + Math.abs(b.lateral - kart.progress.lateral) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  kartBehindWithin(kart, dist) {
    for (const o of this.race.karts) {
      if (o === kart || o.respawn.active || o.isGhost) continue;
      const gap = kart.progress.raceDistance - o.progress.raceDistance;
      if (gap > 0 && gap < dist) return o;
    }
    return null;
  }

  dispose() {
    for (const off of this.offs) off();
    this.entities.length = 0;
  }
}
