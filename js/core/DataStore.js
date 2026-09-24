// Carga de datos JSON del juego (personajes, karts, objetos, circuitos, dificultad, música).

const FILES = {
  characters: 'data/characters.json',
  karts: 'data/karts.json',
  items: 'data/items.json',
  tracks: 'data/tracks.json',
  difficulty: 'data/difficulty.json',
  music: 'data/music.json',
};

export class DataStore {
  constructor() {
    this.characters = [];
    this.karts = [];
    this.items = [];
    this.tracks = [];
    this.cups = [];
    this.difficulty = {};
    this.music = {};
  }

  static async load(baseUrl = './', loader = null) {
    const store = new DataStore();
    const fetchJson =
      loader ||
      (async (path) => {
        const res = await fetch(baseUrl + path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
        return res.json();
      });
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, path]) => [key, await fetchJson(path)]),
    );
    const raw = Object.fromEntries(entries);
    store.characters = raw.characters.characters;
    store.karts = raw.karts.karts;
    store.items = raw.items.items;
    store.itemSettings = raw.items;
    store.tracks = raw.tracks.tracks;
    store.cups = raw.tracks.cups;
    store.difficulty = raw.difficulty;
    store.music = raw.music;
    return store;
  }

  character(id) {
    return this.characters.find((c) => c.id === id) || this.characters[0];
  }
  kart(id) {
    return this.karts.find((k) => k.id === id) || this.karts[0];
  }
  item(id) {
    return this.items.find((i) => i.id === id);
  }
  track(id) {
    return this.tracks.find((t) => t.id === id) || this.tracks[0];
  }
  cup(id) {
    return this.cups.find((c) => c.id === id) || this.cups[0];
  }
  difficultyPreset(id) {
    return this.difficulty.presets[id] || this.difficulty.presets.normal;
  }
}
