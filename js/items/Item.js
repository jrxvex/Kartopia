// Clases base del sistema de objetos.
// - ItemBehaviour: lo que ocurre al usar un objeto desde la ranura del kart (+ decisión de la IA).
// - ItemEntity: objeto físico en el mundo (proyectiles, trampas, bombas, cristales orbitales).
// Para añadir un objeto nuevo: crea una clase en items/types/, regístrala en ItemRegistry.js
// y añade su entrada (con pesos por posición) en data/items.json.
import * as THREE from 'three';

export class ItemBehaviour {
  constructor(def, system) {
    this.def = def;
    this.system = system;
  }

  get id() {
    return this.def.id;
  }

  /** Usa el objeto. Devuelve true si se consumió una unidad. */
  use(kart) {
    return false;
  }

  /** Decisión de la IA: { use, aim (-1 atrás, 0, 1 delante), hold } o null. */
  aiDecide(kart, race, ai) {
    return { use: true };
  }
}

let nextEntityId = 1;

export class ItemEntity {
  constructor(system, owner, opts = {}) {
    this.id = nextEntityId++;
    this.system = system;
    this.owner = owner;
    this.visualType = opts.visualType || 'orb';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = opts.radius ?? 0.7;
    this.age = 0;
    this.dead = false;
    this.armTime = opts.armTime ?? 0.35; // tiempo antes de poder golpear a su dueño
    this.isProjectile = !!opts.isProjectile;
    this.isTrap = !!opts.isTrap;
    this.blocksProjectiles = opts.blocksProjectiles ?? true;
    this.held = false;
    this.holdable = false;
    this.hitType = opts.hitType || 'tumble';
    this.itemId = opts.itemId || 'unknown';
    this.spin = 0;
  }

  update(dt) {
    this.age += dt;
  }

  canHit(kart) {
    if (this.dead) return false;
    if (kart === this.owner && this.age < this.armTime) return false;
    if (kart === this.owner && this.held) return false;
    return true;
  }

  /** Contacto con un kart: por defecto golpea y se destruye. */
  onKartContact(kart) {
    const hit = this.system.race.hit(kart, this.hitType, this.owner);
    this.system.events.emit('item:impact', { entity: this, kart, hit, x: this.pos.x, y: this.pos.y, z: this.pos.z });
    if (hit && this.owner && kart !== this.owner) this.system.events.emit('item:hit', { attacker: this.owner, victim: kart, item: this.itemId });
    this.destroy('hit');
  }

  /** Contacto con otra entidad (proyectil contra trampa, etc.). */
  onEntityContact(other) {
    this.destroy('clash');
    other.destroy('clash');
  }

  destroy(reason = 'expire') {
    if (this.dead) return;
    this.dead = true;
    this.system.events.emit('item:destroy', { entity: this, reason, x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }
}
