// Spline Catmull-Rom centrípeta (cerrada o abierta) y muestreo uniforme por longitud de arco.

export class CatmullRom3 {
  /**
   * @param {{x:number,y:number,z:number}[]} points
   * @param {boolean} closed
   */
  constructor(points, closed = true, alpha = 0.5) {
    this.pts = points;
    this.closed = closed;
    this.alpha = alpha;
  }

  get segmentCount() {
    return this.closed ? this.pts.length : this.pts.length - 1;
  }

  _ctrl(i) {
    const n = this.pts.length;
    if (this.closed) return this.pts[((i % n) + n) % n];
    if (i < 0) {
      const a = this.pts[0];
      const b = this.pts[1];
      return { x: 2 * a.x - b.x, y: 2 * a.y - b.y, z: 2 * a.z - b.z };
    }
    if (i >= n) {
      const a = this.pts[n - 1];
      const b = this.pts[n - 2];
      return { x: 2 * a.x - b.x, y: 2 * a.y - b.y, z: 2 * a.z - b.z };
    }
    return this.pts[i];
  }

  /** Punto en el parámetro u (índice de punto de control + fracción). */
  point(u, out = { x: 0, y: 0, z: 0 }) {
    const segs = this.segmentCount;
    if (this.closed) {
      u = ((u % segs) + segs) % segs;
    } else {
      u = Math.max(0, Math.min(segs, u));
    }
    let i = Math.floor(u);
    if (i >= segs) i = segs - 1;
    const t = u - i;
    const p0 = this._ctrl(i - 1);
    const p1 = this._ctrl(i);
    const p2 = this._ctrl(i + 1);
    const p3 = this._ctrl(i + 2);
    const a = this.alpha;
    const knot = (p, q) => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const dz = q.z - p.z;
      return Math.max(1e-4, Math.pow(dx * dx + dy * dy + dz * dz, a * 0.5));
    };
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const tt = t1 + (t2 - t1) * t;
    const mix = (pA, pB, tA, tB) => {
      const wA = (tB - tt) / (tB - tA);
      const wB = (tt - tA) / (tB - tA);
      return { x: pA.x * wA + pB.x * wB, y: pA.y * wA + pB.y * wB, z: pA.z * wA + pB.z * wB };
    };
    const A1 = mix(p0, p1, t0, t1);
    const A2 = mix(p1, p2, t1, t2);
    const A3 = mix(p2, p3, t2, t3);
    const B1 = mix(A1, A2, t0, t2);
    const B2 = mix(A2, A3, t1, t3);
    const C = mix(B1, B2, t1, t2);
    out.x = C.x;
    out.y = C.y;
    out.z = C.z;
    return out;
  }
}

/**
 * Muestrea la spline a intervalos de longitud de arco (casi) constantes.
 * Devuelve arrays con posición, parámetro u y distancia acumulada.
 */
export function sampleSpline(spline, spacing, subdivisions = 48) {
  const segs = spline.segmentCount;
  const fineN = segs * subdivisions;
  const fu = new Float64Array(fineN + 1);
  const fl = new Float64Array(fineN + 1);
  const tmp = { x: 0, y: 0, z: 0 };
  let prev = spline.point(0, { x: 0, y: 0, z: 0 });
  fu[0] = 0;
  fl[0] = 0;
  for (let k = 1; k <= fineN; k++) {
    const u = (k / fineN) * segs;
    spline.point(u, tmp);
    const dx = tmp.x - prev.x;
    const dy = tmp.y - prev.y;
    const dz = tmp.z - prev.z;
    fu[k] = u;
    fl[k] = fl[k - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
    prev = { x: tmp.x, y: tmp.y, z: tmp.z };
  }
  const total = fl[fineN];
  let count;
  let step;
  if (spline.closed) {
    count = Math.max(8, Math.round(total / spacing));
    step = total / count;
  } else {
    count = Math.max(2, Math.round(total / spacing) + 1);
    step = total / (count - 1);
  }
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const z = new Float64Array(count);
  const u = new Float64Array(count);
  const s = new Float64Array(count);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (k < fineN - 1 && fl[k + 1] < target) k++;
    const span = fl[k + 1] - fl[k];
    const f = span > 1e-9 ? (target - fl[k]) / span : 0;
    const uu = fu[k] + (fu[k + 1] - fu[k]) * Math.max(0, Math.min(1, f));
    spline.point(uu, tmp);
    x[i] = tmp.x;
    y[i] = tmp.y;
    z[i] = tmp.z;
    u[i] = uu;
    s[i] = target;
  }
  return { x, y, z, u, s, count, length: total, spacing: step };
}
