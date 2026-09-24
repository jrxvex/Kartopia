// Aura Prisma (recuperación): invencibilidad, más velocidad y sin penalización fuera de pista.
import { ItemBehaviour } from '../Item.js';

export class PrismAuraItem extends ItemBehaviour {
  use(kart) {
    kart.starTime = 7.5;
    kart.stun.type = null;
    kart.stun.time = 0;
    kart.frozen = 0;
    this.system.events.emit('item:use', { kart, id: this.id });
    this.system.events.emit('item:star', { kart });
    return true;
  }

  aiDecide(kart, race, ai) {
    if (kart.itemHeldTime > 0.7) return { use: true };
    return null;
  }
}
