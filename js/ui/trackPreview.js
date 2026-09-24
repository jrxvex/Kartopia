// Siluetas de circuitos para miniaturas (solo la línea central, sin construir el circuito).
import { CatmullRom3, sampleSpline } from '../track/Spline.js';
import { loadTrackDef } from '../tracks/index.js';
import { drawTrackShape } from './dom.js';

const cache = new Map();

export async function trackOutline(meta) {
  if (cache.has(meta.id)) return cache.get(meta.id);
  const def = await loadTrackDef(meta);
  const pts = def.points.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
  const smp = sampleSpline(new CatmullRom3(pts, true), 6, 16);
  const out = [];
  // vista cenital: +Z arriba y +X a la izquierda (coherente con la cámara del juego)
  for (let i = 0; i < smp.count; i++) out.push([-smp.x[i], -smp.z[i]]);
  const res = { points: out, def };
  cache.set(meta.id, res);
  return res;
}

export async function drawThumb(canvas, meta, color = '#ffffff') {
  const { points } = await trackOutline(meta);
  drawTrackShape(canvas, points, { pad: 12, lineColor: color, width: Math.max(4, canvas.width * 0.045) });
}
