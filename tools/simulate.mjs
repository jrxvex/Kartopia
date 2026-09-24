// Simulación sin render de carreras completas con IA para validar circuitos, física e IA.
// Uso:  node --import ./tools/register.mjs tools/simulate.mjs [trackId|all] [dificultad] [vueltas]
import { readFile } from 'node:fs/promises';
import { DataStore } from '../js/core/DataStore.js';
import { loadTrackDef } from '../js/tracks/index.js';
import { buildTrack } from '../js/track/TrackBuilder.js';
import { RaceManager } from '../js/race/RaceManager.js';
import { PHYSICS } from '../js/config.js';
import { formatTime } from '../js/core/MathUtils.js';

const root = new URL('../', import.meta.url);
const loader = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

async function simulateTrack(data, meta, difficulty, laps, seed) {
  const def = await loadTrackDef(meta);
  const t0 = performance.now();
  const track = buildTrack(def);
  const buildMs = performance.now() - t0;
  const race = new RaceManager({
    data,
    config: { mode: 'single', trackId: meta.id, laps, difficulty, rivals: 7, character: 'blaze', kart: 'standard', seed },
    trackDef: def,
    track,
  });
  const falls = new Map();
  const hits = { count: 0 };
  const items = new Map();
  let wallHits = 0;
  race.events.on('kart:fall', ({ kart, reason }) => {
    const key = `${kart.name}:${reason}@${Math.round(kart.progress.s)}`;
    falls.set(key, (falls.get(key) || 0) + 1);
  });
  race.events.on('kart:hit', () => hits.count++);
  race.events.on('item:used', ({ id }) => items.set(id, (items.get(id) || 0) + 1));
  race.events.on('kart:wall', () => wallHits++);
  race.start({ skipIntro: true });
  const dt = PHYSICS.FIXED_DT;
  let steps = 0;
  const maxTime = 60 * 8;
  const t1 = performance.now();
  const stuck = new Map();
  const lastPos = new Map();
  while (race.phase !== 'finished' && race.clock < maxTime) {
    race.fixedUpdate(dt);
    steps++;
    if (steps % 240 === 0) {
      for (const k of race.karts) {
        const lp = lastPos.get(k);
        const d = lp ? Math.hypot(k.pos.x - lp.x, k.pos.z - lp.z) : 99;
        if (d < 3 && race.phase === 'racing' && !k.progress.finished) {
          const key = `${k.name}@${Math.round(k.progress.s)}`;
          stuck.set(key, (stuck.get(key) || 0) + 1);
        }
        lastPos.set(k, { x: k.pos.x, z: k.pos.z });
      }
    }
  }
  const simMs = performance.now() - t1;
  console.log(`\n=== ${meta.name} (${meta.id}) — ${difficulty}, ${laps} vueltas ===`);
  console.log(`longitud ${track.length.toFixed(0)} m · muestras ${track.N} · triángulos ${track.collision.triCount} · muros ${track.collision.walls.length} · props ${track.props.length} · build ${buildMs.toFixed(0)} ms · sim ${simMs.toFixed(0)} ms (${(race.clock / (simMs / 1000)).toFixed(0)}x)`);
  if (race.phase !== 'finished') console.log('!! la carrera NO terminó en el tiempo máximo');
  const res = race.results || race.standings.map((k) => ({ name: k.name, time: NaN, kart: k, estimated: true, bestLap: k.progress.bestLap }));
  for (const r of res) {
    const k = r.kart;
    console.log(
      `${String(r.position ?? k.progress.position).padStart(2)}. ${r.name.padEnd(7)} ${r.estimated ? '~' : ' '}${formatTime(r.time * 1000)}  mejor vuelta ${formatTime(k.progress.bestLap * 1000)}  vueltas ${k.progress.lapTimes.map((t) => formatTime(t * 1000)).join(' ')}  kart ${k.kartDef.id}`,
    );
  }
  if (falls.size) console.log('caídas:', [...falls.entries()].map(([k, v]) => `${k}×${v}`).join(', '));
  if (stuck.size) console.log('atascos (>2s sin moverse):', [...stuck.entries()].map(([k, v]) => `${k}×${v}`).join(', '));
  console.log(`golpes: ${hits.count} · choques con muros: ${wallHits} · objetos: ${[...items.entries()].map(([k, v]) => `${k}:${v}`).join(' ')}`);
  return { finished: race.phase === 'finished', falls: falls.size, stuck: stuck.size };
}

const data = await DataStore.load('', loader);
const arg = process.argv[2] || 'green-valley';
const difficulty = process.argv[3] || 'hard';
const laps = Number(process.argv[4] || 3);
const tracks = arg === 'all' ? data.tracks : [data.track(arg)];
for (const meta of tracks) {
  try {
    await simulateTrack(data, meta, difficulty, laps, 4242);
  } catch (err) {
    console.error(`Error en ${meta.id}:`, err);
    process.exitCode = 1;
  }
}
