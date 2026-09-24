// Tipos de superficie: cada triángulo de colisión / celda de terreno tiene uno.
// speed: multiplicador de velocidad máxima · accel: multiplicador de aceleración
// grip: agarre lateral · offroad: penaliza (y la tracción lo compensa) · kill: reaparición

export const SURFACE = {
  ROAD: 0,
  CURB: 1,
  GRASS: 2,
  DIRT: 3,
  SAND: 4,
  SNOW: 5,
  SHALLOW_WATER: 6,
  ICE: 7,
  BOOST: 8,
  RAMP: 9,
  WOOD: 10,
  METAL: 11,
  MUD: 12,
  ABYSS: 13,
  DEEP_WATER: 14,
  LAVA: 15,
  ROCK: 16,
  NEON: 17,
};

const DEFS = [
  { key: 'road', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'road', rumble: 0 },
  { key: 'curb', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'curb', rumble: 0.25 },
  { key: 'grass', speed: 0.55, accel: 0.7, grip: 0.92, offroad: true, particle: 'grass', sound: 'offroad', rumble: 0.35 },
  { key: 'dirt', speed: 0.82, accel: 0.9, grip: 0.9, offroad: true, particle: 'dust', sound: 'offroad', rumble: 0.2 },
  { key: 'sand', speed: 0.5, accel: 0.65, grip: 0.85, offroad: true, particle: 'sand', sound: 'offroad', rumble: 0.35 },
  { key: 'snow', speed: 0.55, accel: 0.7, grip: 0.8, offroad: true, particle: 'snow', sound: 'offroad', rumble: 0.3 },
  { key: 'shallowWater', speed: 0.62, accel: 0.75, grip: 0.9, offroad: true, particle: 'splash', sound: 'water', rumble: 0.3 },
  { key: 'ice', speed: 1.0, accel: 0.85, grip: 0.28, offroad: false, particle: 'ice', sound: 'road', rumble: 0 },
  { key: 'boost', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'road', rumble: 0, boost: true },
  { key: 'ramp', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'wood', rumble: 0.1, ramp: true },
  { key: 'wood', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'wood', rumble: 0.12 },
  { key: 'metal', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'metal', rumble: 0.05 },
  { key: 'mud', speed: 0.45, accel: 0.6, grip: 0.8, offroad: true, particle: 'mud', sound: 'offroad', rumble: 0.4 },
  { key: 'abyss', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'road', rumble: 0, kill: 'fall' },
  { key: 'deepWater', speed: 0.5, accel: 0.5, grip: 0.8, offroad: true, particle: 'splash', sound: 'water', rumble: 0, kill: 'water' },
  { key: 'lava', speed: 0.5, accel: 0.5, grip: 0.8, offroad: true, particle: 'fire', sound: 'road', rumble: 0, kill: 'lava' },
  { key: 'rock', speed: 0.7, accel: 0.8, grip: 0.9, offroad: true, particle: 'dust', sound: 'offroad', rumble: 0.3 },
  { key: 'neon', speed: 1.0, accel: 1.0, grip: 1.0, offroad: false, particle: null, sound: 'metal', rumble: 0 },
];

DEFS.forEach((d, i) => (d.id = i));

export const SURFACE_DEFS = DEFS;

const BY_KEY = Object.fromEntries(DEFS.map((d) => [d.key, d.id]));

export function surfaceDef(id) {
  return DEFS[id] || DEFS[0];
}

/** Convierte un nombre ('grass', 'wood'...) en id numérico. */
export function surfaceId(keyOrId) {
  if (typeof keyOrId === 'number') return keyOrId;
  if (keyOrId in BY_KEY) return BY_KEY[keyOrId];
  return SURFACE.ROAD;
}
