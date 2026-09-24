// Onda Helada (ralentiza): congela a todos los rivales que van por delante durante 3 s.
import { ItemBehaviour } from '../Item.js';

export class FrostWaveItem extends ItemBehaviour {
  use(kart) {
    const race = this.system.race;
    const victims = [];
    for (const k of race.standings) {
      if (k === kart || k.progress.finished || k.isGhost) continue;
      if (k.progress.position < kart.progress.position) {
        if (race.hit(k, 'freeze', kart)) {
          victims.push(k);
          this.system.events.emit('item:hit', { attacker: kart, victim: k, item: this.id });
        }
      }
    }
    this.system.events.emit('item:use', { kart, id: this.id });
    this.system.events.emit('item:frost', { kart, victims });
    return true;
  }

  aiDecide(kart, race, ai) {
    if (kart.progress.position > 1 && kart.itemHeldTime > 0.8) return { use: true };
    if (kart.itemHeldTime > 20) return { use: true };
    return null;
  }
}
