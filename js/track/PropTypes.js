// Parámetros físicos de los objetos decorativos. La geometría visual está en models/PropModels.js.
// radius: radio del colisionador cilíndrico (0 = sin colisión) · height: altura aproximada.

export const PROP_TYPES = {
  tree: { radius: 0.75, height: 9 },
  pine: { radius: 0.65, height: 11 },
  snowPine: { radius: 0.65, height: 11 },
  palm: { radius: 0.45, height: 10 },
  jungleTree: { radius: 1.0, height: 14 },
  bush: { radius: 0, height: 1.6 },
  fern: { radius: 0, height: 1.2 },
  grass: { radius: 0, height: 0.6 },
  flowers: { radius: 0, height: 0.5 },
  rock: { radius: 1.5, height: 2.2 },
  boulder: { radius: 3.2, height: 4.5 },
  cactus: { radius: 0.5, height: 4 },
  mushroom: { radius: 0.9, height: 5 },
  lamp: { radius: 0.25, height: 7 },
  streetLight: { radius: 0.3, height: 8 },
  cone: { radius: 0, height: 0.8 },
  crate: { radius: 0.85, height: 1.5 },
  barrel: { radius: 0.6, height: 1.3 },
  pillar: { radius: 1.2, height: 10 },
  brokenPillar: { radius: 1.2, height: 4.5 },
  obelisk: { radius: 1.5, height: 14 },
  crystal: { radius: 0.9, height: 4 },
  tireStack: { radius: 0.9, height: 1.3 },
  flag: { radius: 0, height: 6 },
  torch: { radius: 0.3, height: 3.2 },
  umbrella: { radius: 0.2, height: 3 },
  beachChair: { radius: 0, height: 0.8 },
  log: { radius: 0, height: 1 },
  stump: { radius: 0.6, height: 1 },
  statue: { radius: 1.3, height: 6 },
  neonSign: { radius: 0.3, height: 7 },
  hologram: { radius: 0, height: 8 },
  iceRock: { radius: 1.6, height: 2.6 },
  lavaRock: { radius: 1.6, height: 2.4 },
  skullRock: { radius: 2.2, height: 3.5 },
  coral: { radius: 0, height: 1.5 },
  buoy: { radius: 0, height: 1.5 },
  hay: { radius: 0.9, height: 1.2 },
  fencePost: { radius: 0, height: 1.2 },
  banner: { radius: 0.2, height: 5 },
  cloud: { radius: 0, height: 0 },
  vine: { radius: 0, height: 6 },
  firefly: { radius: 0, height: 0 },
};

export function propRadius(type) {
  return PROP_TYPES[type]?.radius ?? 0;
}

export function propHeight(type) {
  return PROP_TYPES[type]?.height ?? 2;
}
