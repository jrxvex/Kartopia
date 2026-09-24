// Burbuja Escudo: absorbe un impacto durante 10 segundos.
import { ItemBehaviour } from '../Item.js';

export class BubbleShieldItem extends ItemBehaviour {
  use(kart) {
    kart.shield = 10;
    this.system.events.emit('item:use', { kart, id: this.id });
    this.system.events.emit('item:shield-up', { kart });
    return true;
  }

  aiDecide(kart, race, ai) {
    const sys = this.system;
    const targeted = sys.entities.some((e) => e.target === kart && !e.dead);
    if (targeted) return { use: true };
    for (const o of race.karts) {
      if (o === kart) continue;
      if ((o.starTime > 0 || o.comet > 0) && race.gapBetween(o, kart) > 0 && race.gapBetween(o, kart) < 30) return { use: true };
    }
    if (kart.itemHeldTime > 3 + (kart.index % 4)) return { use: true };
    return null;
  }
}
