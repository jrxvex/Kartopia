// Registro de comportamientos de objetos. Para añadir un objeto nuevo basta con crear su clase
// (extendiendo ItemBehaviour) y registrarla aquí con el mismo id que en data/items.json.
import { TurboItem } from './types/Turbo.js';
import { PulseOrbItem } from './types/PulseOrb.js';
import { SeekerOrbItem } from './types/SeekerOrb.js';
import { GooTrapItem } from './types/GooTrap.js';
import { BubbleShieldItem } from './types/BubbleShield.js';
import { OrbitGuardItem } from './types/OrbitGuard.js';
import { FrostWaveItem } from './types/FrostWave.js';
import { BlastBombItem } from './types/BlastBomb.js';
import { CometRushItem } from './types/CometRush.js';
import { PrismAuraItem } from './types/PrismAura.js';

export const ITEM_BEHAVIOURS = {
  turbo: TurboItem,
  'triple-turbo': TurboItem,
  'pulse-orb': PulseOrbItem,
  'seeker-orb': SeekerOrbItem,
  'goo-trap': GooTrapItem,
  'bubble-shield': BubbleShieldItem,
  'orbit-guard': OrbitGuardItem,
  'frost-wave': FrostWaveItem,
  'blast-bomb': BlastBombItem,
  'comet-rush': CometRushItem,
  'prism-aura': PrismAuraItem,
};

export function registerItem(id, BehaviourClass) {
  ITEM_BEHAVIOURS[id] = BehaviourClass;
}
