// Registro de circuitos: carga dinámica del módulo de cada circuito (un archivo por circuito).

const cache = new Map();

export async function loadTrackDef(meta) {
  if (cache.has(meta.id)) return cache.get(meta.id);
  const mod = await import(`./${meta.module}`);
  const def = mod.default;
  def.id = meta.id;
  def.name = meta.name;
  def.music = def.music || meta.music;
  cache.set(meta.id, def);
  return def;
}
