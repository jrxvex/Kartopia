// Generación de geometría "a lo largo del circuito": tiras de superficie (asfalto, bordillos,
// rampas, paneles turbo) y barridos de perfil (muros, faldones). Devuelve arrays planos que
// sirven tanto para la colisión (lógica) como para las mallas (visual).

/**
 * @param {object} src   fuente de marcos: {px, py, pz, rx, rz, bank}
 * @param {number[]} list  índices de muestra ordenados
 * @param {(k:number,i:number)=>number} latA  borde izquierdo (lateral menor)
 * @param {(k:number,i:number)=>number} latB  borde derecho
 * @param {object} opts  {across, y(k,i,lat), vScale, uScale, uMode:'unit'|'meters', vStart}
 */
export function buildStrip(src, list, latA, latB, opts = {}) {
  const across = opts.across || 1;
  const rows = list.length;
  const cols = across + 1;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const vScale = opts.vScale || 10;
  const uScale = opts.uScale || 1;
  let v = opts.vStart || 0;
  let prevX = 0;
  let prevZ = 0;
  let prevY = 0;
  for (let k = 0; k < rows; k++) {
    const i = list[k];
    const cxp = src.px[i];
    const cyp = src.py[i];
    const czp = src.pz[i];
    if (k > 0) v += Math.hypot(cxp - prevX, cyp - prevY, czp - prevZ);
    prevX = cxp;
    prevY = cyp;
    prevZ = czp;
    const b = src.bank[i];
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    const a = latA(k, i);
    const bb = latB(k, i);
    for (let c = 0; c < cols; c++) {
      const lat = a + ((bb - a) * c) / across;
      const o = (k * cols + c) * 3;
      positions[o] = cxp + src.rx[i] * cb * lat;
      positions[o + 1] = cyp + sb * lat + (opts.y ? opts.y(k, i, lat) : 0);
      positions[o + 2] = czp + src.rz[i] * cb * lat;
      const uo = (k * cols + c) * 2;
      uvs[uo] = opts.uMode === 'meters' ? (lat - a) / uScale : c / across;
      uvs[uo + 1] = v / vScale;
    }
  }
  const quads = (rows - 1) * across;
  const indices = new Uint32Array(Math.max(0, quads) * 6);
  let n = 0;
  for (let k = 0; k < rows - 1; k++) {
    for (let c = 0; c < across; c++) {
      const a = k * cols + c;
      const b = a + 1;
      const c2 = (k + 1) * cols + c;
      const d = c2 + 1;
      indices[n++] = a;
      indices[n++] = b;
      indices[n++] = c2;
      indices[n++] = b;
      indices[n++] = d;
      indices[n++] = c2;
    }
  }
  return { positions, uvs, indices, length: v };
}

/**
 * Barre un perfil 2D (lateral, vertical) a lo largo de la lista de muestras.
 * profile: [[dLat, dY], ...] relativo al punto base (lateral baseLat, altura de la superficie).
 * El perfil se recorre en orden; cada tramo genera una tira de quads.
 * `flip` invierte la orientación de las caras (para el lado opuesto).
 */
export function buildSweep(src, list, baseLat, profile, opts = {}) {
  const rows = list.length;
  const cols = profile.length;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const vScale = opts.vScale || 4;
  // longitud acumulada del perfil para la coordenada u
  const pl = [0];
  for (let c = 1; c < cols; c++) {
    pl.push(pl[c - 1] + Math.hypot(profile[c][0] - profile[c - 1][0], profile[c][1] - profile[c - 1][1]));
  }
  const totalP = pl[cols - 1] || 1;
  let v = 0;
  let prevX = 0;
  let prevZ = 0;
  for (let k = 0; k < rows; k++) {
    const i = list[k];
    const bl = baseLat(k, i);
    const b = src.bank[i];
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    const bx = src.px[i] + src.rx[i] * cb * bl;
    const by = src.py[i] + sb * bl + (opts.y ? opts.y(k, i) : 0);
    const bz = src.pz[i] + src.rz[i] * cb * bl;
    if (k > 0) v += Math.hypot(bx - prevX, bz - prevZ);
    prevX = bx;
    prevZ = bz;
    for (let c = 0; c < cols; c++) {
      const [dl, dy] = profile[c];
      const o = (k * cols + c) * 3;
      positions[o] = bx + src.rx[i] * dl;
      positions[o + 1] = by + dy;
      positions[o + 2] = bz + src.rz[i] * dl;
      const uo = (k * cols + c) * 2;
      uvs[uo] = opts.uByProfile === false ? c / (cols - 1) : pl[c] / totalP;
      uvs[uo + 1] = v / vScale;
    }
  }
  const quads = (rows - 1) * (cols - 1);
  const indices = new Uint32Array(Math.max(0, quads) * 6);
  let n = 0;
  for (let k = 0; k < rows - 1; k++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = k * cols + c;
      const b = a + 1;
      const c2 = (k + 1) * cols + c;
      const d = c2 + 1;
      if (opts.flip) {
        indices[n++] = a;
        indices[n++] = c2;
        indices[n++] = b;
        indices[n++] = b;
        indices[n++] = c2;
        indices[n++] = d;
      } else {
        indices[n++] = a;
        indices[n++] = b;
        indices[n++] = c2;
        indices[n++] = b;
        indices[n++] = d;
        indices[n++] = c2;
      }
    }
  }
  return { positions, uvs, indices, length: v };
}

/** Divide una lista circular de índices en tramos contiguos que cumplen `pred`. */
export function contiguousRuns(N, pred, closed = true) {
  const runs = [];
  let start = -1;
  for (let i = 0; i < N; i++) {
    if (pred(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, N - 1]);
  if (closed && runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === N - 1) {
    const last = runs.pop();
    runs[0] = [last[0], runs[0][1] + N]; // tramo que cruza el origen (índices > N se envuelven)
  } else if (closed && runs.length === 1 && runs[0][0] === 0 && runs[0][1] === N - 1) {
    runs[0] = [0, N]; // circuito completo: cierra el lazo repitiendo la muestra 0
  }
  return runs.map(([a, b]) => {
    const list = [];
    for (let i = a; i <= b; i++) list.push(i % N);
    return list;
  });
}
