// Turbo / Triple Turbo: impulso instantáneo que además ignora la penalización fuera de pista.
import { ItemBehaviour } from '../Item.js';
import { surfaceDef } from '../../physics/Surfaces.js';

export class TurboItem extends ItemBehaviour {
  use(kart) {
    kart.applyBoost(1.25, 1.04, 'item');
    this.system.events.emit('item:use', { kart, id: this.id });
    this.system.events.emit('kart:item-boost', { kart });
    return true;
  }

  aiDecide(kart, race, ai) {
    const s = kart.progress.s;
    const offroad = surfaceDef(kart.surface).offroad;
    if (offroad && kart.forwardSpeed < kart.params.maxSpeed * 0.75) return { use: true };
    if (kart.forwardSpeed < kart.params.maxSpeed * 0.45 && race.phase === 'racing') return { use: true };
    const curve = Math.abs(ai.curveAhead(s, 0, 45));
    if (curve < 0.01) return { use: true };
    if (kart.itemHeldTime > 14) return { use: true };
    return null;
  }
}
