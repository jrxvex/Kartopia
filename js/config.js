// Configuración global: constantes de física, presets gráficos y valores por defecto.

export const GAME_TITLE = 'KARTOPIA';
export const GAME_SUBTITLE = 'Turbo Grand Prix';
export const SAVE_KEY = 'kartopia.save.v1';
export const GHOST_KEY_PREFIX = 'kartopia.ghost.v1.';

/** Constantes de la física arcade (unidades: metros, segundos, radianes). */
export const PHYSICS = {
  FIXED_DT: 1 / 120,
  MAX_STEPS_PER_FRAME: 12,
  GRAVITY: 34,
  KART_RADIUS: 1.0,
  KART_HEIGHT: 1.5,
  STEP_UP: 0.55, // escalón máximo que el kart puede subir sin chocar
  BLOCK_HEIGHT: 2.8, // por encima de esto una superficie se considera "techo" (puente)
  SNAP_DOWN: 0.6, // distancia máxima para mantenerse pegado al suelo

  BASE_MAX_SPEED: 25.5,
  BASE_ACCEL: 15,
  BRAKE_DECEL: 30,
  REVERSE_MAX: 9,
  REVERSE_ACCEL: 14,
  COAST_DECEL: 3.2,
  OVERSPEED_DECAY: 8,
  OFFROAD_OVERSPEED_DECAY: 30,
  SLOPE_FACTOR: 0.6,

  TURN_RATE: 2.05,
  LOW_SPEED_TURN: 6, // velocidad a la que se alcanza la autoridad de giro completa
  AIR_TURN_RATE: 1.25,
  AIR_CONTROL: 2.2, // cuánto se reorienta la velocidad horizontal en el aire
  GRIP: 11,
  DRIFT_GRIP: 2.6,

  HOP_VELOCITY: 5.4,
  DRIFT_MIN_SPEED: 9,
  DRIFT_BASE: 1.3,
  DRIFT_TIGHT: 2.3,
  DRIFT_WIDE: 0.72,
  DRIFT_VISUAL_ANGLE: 0.42,
  DRIFT_OUTWARD: 2.4,
  MT_THRESHOLDS: [0.72, 1.55, 2.5],
  MT_DURATIONS: [0.8, 1.35, 2.0],

  BOOST_MULT: 1.32,
  BOOST_ACCEL: 44,
  START_BOOST_TIME: 1.1,
  PAD_BOOST_TIME: 1.0,
  RAMP_LAUNCH: 3.5,
  TRICK_WINDOW: 0.5,
  TRICK_BOOST_TIME: 0.95,

  WALL_RESTITUTION: 0.32,
  WALL_FRICTION: 0.12,
  KART_RESTITUTION: 0.45,
  KART_BUMP: 3.2,

  FALL_DEPTH: 14,
  OUT_OF_BOUNDS: 70,
  RESPAWN_FALL_TIME: 0.7,
  RESPAWN_CARRY_TIME: 1.1,
  RESPAWN_INVULN: 1.6,

  SPIN_TIME: 1.05,
  TUMBLE_TIME: 1.45,
  FREEZE_TIME: 3.0,
};

/** Tabla de estadísticas (1..10) → parámetros físicos. */
export const STAT_SCALES = {
  speed: (s) => 0.9 + s * 0.022,
  accel: (s) => 0.72 + s * 0.062,
  weight: (s) => 0.75 + s * 0.075,
  handling: (s) => 0.84 + s * 0.034,
  traction: (s) => s / 10,
  miniTurbo: (s) => 0.8 + s * 0.045,
};

export const QUALITY_PRESETS = {
  low: {
    label: 'Baja',
    pixelRatio: 0.75,
    shadows: false,
    shadowSize: 1024,
    bloom: false,
    particles: 0.45,
    vegetation: 0.4,
    antialias: false,
    lightPool: 2,
    drawDistance: 500,
    terrainRes: 3.6,
  },
  medium: {
    label: 'Media',
    pixelRatio: 1.0,
    shadows: true,
    shadowSize: 1024,
    bloom: true,
    particles: 0.7,
    vegetation: 0.7,
    antialias: true,
    lightPool: 4,
    drawDistance: 700,
    terrainRes: 3.0,
  },
  high: {
    label: 'Alta',
    pixelRatio: 1.25,
    shadows: true,
    shadowSize: 2048,
    bloom: true,
    particles: 1.0,
    vegetation: 1.0,
    antialias: true,
    lightPool: 6,
    drawDistance: 950,
    terrainRes: 2.6,
  },
  ultra: {
    label: 'Ultra',
    pixelRatio: 2.0,
    shadows: true,
    shadowSize: 4096,
    bloom: true,
    particles: 1.0,
    vegetation: 1.35,
    antialias: true,
    lightPool: 8,
    drawDistance: 1300,
    terrainRes: 2.2,
  },
};

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.85,
  quality: 'high',
  shadows: true,
  bloom: true,
  resolutionScale: 1.0,
  showFps: false,
  cameraShake: true,
  speedLines: true,
  speedUnit: 'kmh',
  fov: 70,
  hudScale: 1.0,
  showMinimap: true,
  showRanking: true,
  ghost: true,
  lastCharacter: 'blaze',
  lastKart: 'standard',
  lastTrack: 'green-valley',
  lastCup: 'leaf',
  lastDifficulty: 'normal',
  lastLaps: 3,
  lastRivals: 7,
  lastItems: 'normal',
};

export const ACTIONS = ['accelerate', 'brake', 'left', 'right', 'drift', 'item', 'lookBack', 'respawn', 'pause'];

export const DEFAULT_CONTROLS = {
  accelerate: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  drift: ['Space', null],
  item: ['ShiftLeft', 'ShiftRight'],
  lookBack: ['KeyC', null],
  respawn: ['KeyR', null],
  pause: ['Escape', 'KeyP'],
};

export const ACTION_LABELS = {
  accelerate: 'Acelerar',
  brake: 'Frenar / Marcha atrás',
  left: 'Girar a la izquierda',
  right: 'Girar a la derecha',
  drift: 'Derrape / Salto',
  item: 'Usar objeto',
  lookBack: 'Mirar atrás',
  respawn: 'Rescate manual',
  pause: 'Pausa',
};

/** Mapeo de mando estándar (Gamepad API, "standard mapping"). */
export const GAMEPAD_BINDINGS = {
  accelerate: [0, 7],
  brake: [1, 6],
  drift: [5, 2],
  item: [4, 3],
  lookBack: [],
  respawn: [8],
  pause: [9],
};

export const GP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'expert'];
