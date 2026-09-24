// Caja de objetos: se rompe al atravesarla, entrega una ruleta y reaparece tras unos segundos.

export class ItemBox {
  constructor(spot, index) {
    this.index = index;
    this.x = spot.x;
    this.y = spot.y;
    this.z = spot.z;
    this.s = spot.s;
    this.lateral = spot.lateral;
    this.active = true;
    this.respawn = 0;
    this.radius = 1.25;
    this.phase = index * 0.7;
  }

  update(dt) {
    if (!this.active) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        this.active = true;
        return true; // ha reaparecido
      }
    }
    return false;
  }

  touches(kart) {
    if (!this.active) return false;
    const dx = kart.pos.x - this.x;
    const dz = kart.pos.z - this.z;
    const dy = kart.pos.y + 0.6 - this.y;
    const r = this.radius + kart.radius;
    return dx * dx + dz * dz < r * r && Math.abs(dy) < 2.2;
  }

  break(respawnTime) {
    this.active = false;
    this.respawn = respawnTime;
  }
}
