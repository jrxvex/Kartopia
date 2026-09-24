// Cometa Veloz (recuperación): el kart se convierte en un cometa con piloto automático que sigue
// la línea de carrera a gran velocidad y arrolla a los rivales.
import { ItemBehaviour } from '../Item.js';
import { endDrift } from '../../physics/KartPhysics.js';

export class CometRushItem extends ItemBehaviour {
  use(kart) {
    if (kart.respawn.active) return false;
    endDrift(kart, this.system.race.ctx, false);
    if (kart.held && kart.held.holdable) {
      kart.held.drop(0);
      kart.held = null;
    }
    kart.comet = 6;
    kart.cometS = kart.progress.s;
    kart.boostTime = 0;
    this.system.events.emit('item:use', { kart, id: this.id });
    this.system.events.emit('item:comet', { kart });
    return true;
  }

  aiDecide(kart, race, ai) {
    if (kart.grounded && kart.itemHeldTime > 0.6) return { use: true };
    return null;
  }
}
