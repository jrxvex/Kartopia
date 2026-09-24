// Mundo de colisión: triángulos de suelo en rejilla espacial (carretera, rampas, plataformas),
// mapa de alturas del terreno, muros como segmentos 2D con rango vertical, cilindros estáticos
// (árboles, columnas...) y colisionadores dinámicos (obstáculos móviles).

const KEY_OFFSET = 4096;
const KEY_SPAN = 8192;

function cellKey(ix, iz) {
  return (ix + KEY_OFFSET) * KEY_SPAN + (iz + KEY_OFFSET);
}

class GrowableF64 {
  constructor(initial = 4096) {
    this.data = new Float64Array(initial);
    this.length = 0;
  }
  push(v) {
    if (this.length >= this.data.length) {
      const n = new Float64Array(this.data.length * 2);
      n.set(this.data);
      this.data = n;
    }
    this.data[this.length++] = v;
  }
}

export class CollisionWorld {
  constructor(cellSize = 12) {
    this.cellSize = cellSize;
    this.inv = 1 / cellSize;

    this.triV = new GrowableF64(9 * 2048); // 9 floats por triángulo
    this.triP = new GrowableF64(4 * 2048); // plano: nx, ny, nz, d
    this.triS = []; // superficie
    this.triCount = 0;
    this.triGrid = new Map();

    this.walls = [];
    this.wallGrid = new Map();
    this.wallStamp = null;

    this.circles = [];
    this.circleGrid = new Map();
    this.circleStamp = null;

    this.dynamic = [];
    this.heightfield = null;
    this.stamp = 0;
    this.finalized = false;
  }

  _insert(grid, x0, z0, x1, z1, idx) {
    const ix0 = Math.floor(x0 * this.inv);
    const ix1 = Math.floor(x1 * this.inv);
    const iz0 = Math.floor(z0 * this.inv);
    const iz1 = Math.floor(z1 * this.inv);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = cellKey(ix, iz);
        let arr = grid.get(k);
        if (!arr) {
          arr = [];
          grid.set(k, arr);
        }
        arr.push(idx);
      }
    }
  }

  // ------------------------------------------------------------------ Triángulos
  addTriangle(ax, ay, az, bx, by, bz, cx, cy, cz, surface) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-9) return;
    nx /= len;
    ny /= len;
    nz /= len;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    if (ny < 0.2) return; // caras casi verticales: no son suelo
    const d = nx * ax + ny * ay + nz * az;
    const V = this.triV;
    V.push(ax);
    V.push(ay);
    V.push(az);
    V.push(bx);
    V.push(by);
    V.push(bz);
    V.push(cx);
    V.push(cy);
    V.push(cz);
    const P = this.triP;
    P.push(nx);
    P.push(ny);
    P.push(nz);
    P.push(d);
    this.triS.push(surface);
    const idx = this.triCount++;
    this._insert(
      this.triGrid,
      Math.min(ax, bx, cx),
      Math.min(az, bz, cz),
      Math.max(ax, bx, cx),
      Math.max(az, bz, cz),
      idx,
    );
  }

  /** Añade una malla indexada (posiciones planas xyz). */
  addMesh(positions, indices, surface) {
    const p = positions;
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;
        this.addTriangle(p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2], surface);
      }
    } else {
      for (let i = 0; i < p.length; i += 9) {
        this.addTriangle(p[i], p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], p[i + 6], p[i + 7], p[i + 8], surface);
      }
    }
  }

  setHeightfield(hf) {
    this.heightfield = hf;
  }

  /**
   * Busca la superficie más alta en (x, z) con altura <= yTop.
   * Rellena `out` con {hit, y, nx, ny, nz, surface, terrain}.
   */
  groundAt(x, z, yTop, out) {
    let bestY = -Infinity;
    let best = -1;
    const cell = this.triGrid.get(cellKey(Math.floor(x * this.inv), Math.floor(z * this.inv)));
    if (cell) {
      const V = this.triV.data;
      const P = this.triP.data;
      for (let n = 0; n < cell.length; n++) {
        const t = cell[n];
        const o = t * 9;
        const ax = V[o];
        const az = V[o + 2];
        const bx = V[o + 3];
        const bz = V[o + 5];
        const cx = V[o + 6];
        const cz = V[o + 8];
        const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
        const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
        const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
        const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
        if (hasNeg && hasPos) continue;
        const po = t * 4;
        const y = (P[po + 3] - P[po] * x - P[po + 2] * z) / P[po + 1];
        if (y <= yTop && y > bestY) {
          bestY = y;
          best = t;
        }
      }
    }
    let terrain = false;
    const hf = this.heightfield;
    if (hf) {
      const h = hf.heightAt(x, z);
      if (h === h && h <= yTop && h > bestY) {
        bestY = h;
        terrain = true;
      }
    }
    if (terrain) {
      hf.normalAt(x, z, out);
      out.nx = out.x;
      out.ny = out.y;
      out.nz = out.z;
      out.hit = true;
      out.y = bestY;
      out.surface = hf.surfaceAt(x, z);
      out.terrain = true;
      return out;
    }
    if (best >= 0) {
      const P = this.triP.data;
      const po = best * 4;
      out.hit = true;
      out.y = bestY;
      out.nx = P[po];
      out.ny = P[po + 1];
      out.nz = P[po + 2];
      out.surface = this.triS[best];
      out.terrain = false;
      return out;
    }
    out.hit = false;
    out.y = -Infinity;
    out.nx = 0;
    out.ny = 1;
    out.nz = 0;
    out.surface = 0;
    out.terrain = false;
    return out;
  }

  // ------------------------------------------------------------------ Muros
  addWall(x1, z1, x2, z2, y0, y1, opts = {}) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-6) return -1;
    const w = { x1, z1, x2, z2, dx, dz, len2, y0, y1, kind: opts.kind || 'wall', bouncy: opts.bouncy || 0 };
    const idx = this.walls.length;
    this.walls.push(w);
    const pad = 0.01;
    this._insert(this.wallGrid, Math.min(x1, x2) - pad, Math.min(z1, z2) - pad, Math.max(x1, x2) + pad, Math.max(z1, z2) + pad, idx);
    return idx;
  }

  /** Polilínea de muros; points = [[x, z, yBase], ...] */
  addWallPolyline(points, height, opts = {}) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const yb = Math.min(a[2] ?? 0, b[2] ?? 0);
      const yt = Math.max(a[2] ?? 0, b[2] ?? 0);
      this.addWall(a[0], a[1], b[0], b[1], yb - (opts.below ?? 2), yt + height, opts);
    }
    if (opts.closed && points.length > 2) {
      const a = points[points.length - 1];
      const b = points[0];
      const yb = Math.min(a[2] ?? 0, b[2] ?? 0);
      const yt = Math.max(a[2] ?? 0, b[2] ?? 0);
      this.addWall(a[0], a[1], b[0], b[1], yb - (opts.below ?? 2), yt + height, opts);
    }
  }

  /** Caja orientada (en planta) como 4 muros. */
  addBox(cx, cz, halfW, halfD, rotY, y0, y1, opts = {}) {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const corners = [
      [-halfW, -halfD],
      [halfW, -halfD],
      [halfW, halfD],
      [-halfW, halfD],
    ].map(([lx, lz]) => [cx + lx * c + lz * s, cz - lx * s + lz * c]);
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      this.addWall(a[0], a[1], b[0], b[1], y0, y1, opts);
    }
  }

  addCircle(x, z, r, y0, y1, opts = {}) {
    const c = { x, z, r, y0, y1, kind: opts.kind || 'post' };
    const idx = this.circles.length;
    this.circles.push(c);
    this._insert(this.circleGrid, x - r, z - r, x + r, z + r, idx);
    return idx;
  }

  addDynamic(collider) {
    this.dynamic.push(collider);
    return collider;
  }

  removeDynamic(collider) {
    const i = this.dynamic.indexOf(collider);
    if (i >= 0) this.dynamic.splice(i, 1);
  }

  finalize() {
    this.wallStamp = new Int32Array(this.walls.length);
    this.circleStamp = new Int32Array(this.circles.length);
    this.finalized = true;
  }

  /**
   * Resuelve la colisión de un cilindro vertical (posición `p` = base) contra muros,
   * cilindros y colisionadores dinámicos. Modifica p.x / p.z.
   * out: {count, nx, nz, depth, kind, dynamic}
   */
  collideCircle(p, radius, height, out, includeDynamic = true) {
    if (!this.finalized) this.finalize();
    out.count = 0;
    out.nx = 0;
    out.nz = 0;
    out.depth = 0;
    out.kind = null;
    out.dynamic = null;
    out.soft = null;
    const stamp = ++this.stamp;
    const inv = this.inv;
    const ix0 = Math.floor((p.x - radius) * inv);
    const ix1 = Math.floor((p.x + radius) * inv);
    const iz0 = Math.floor((p.z - radius) * inv);
    const iz1 = Math.floor((p.z + radius) * inv);
    const r2 = radius * radius;
    const top = p.y + height;

    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const key = cellKey(ix, iz);
        const wcell = this.wallGrid.get(key);
        if (wcell) {
          for (let n = 0; n < wcell.length; n++) {
            const idx = wcell[n];
            if (this.wallStamp[idx] === stamp) continue;
            this.wallStamp[idx] = stamp;
            const w = this.walls[idx];
            if (p.y > w.y1 || top < w.y0) continue;
            let t = ((p.x - w.x1) * w.dx + (p.z - w.z1) * w.dz) / w.len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ddx = p.x - (w.x1 + w.dx * t);
            const ddz = p.z - (w.z1 + w.dz * t);
            const d2 = ddx * ddx + ddz * ddz;
            if (d2 >= r2) continue;
            const d = Math.sqrt(d2);
            let nx;
            let nz;
            if (d > 1e-5) {
              nx = ddx / d;
              nz = ddz / d;
            } else {
              const l = Math.sqrt(w.len2);
              nx = -w.dz / l;
              nz = w.dx / l;
            }
            const depth = radius - d;
            p.x += nx * depth;
            p.z += nz * depth;
            out.nx += nx * depth;
            out.nz += nz * depth;
            if (depth > out.depth) {
              out.depth = depth;
              out.kind = w.kind;
            }
            out.count++;
          }
        }
        const ccell = this.circleGrid.get(key);
        if (ccell) {
          for (let n = 0; n < ccell.length; n++) {
            const idx = ccell[n];
            if (this.circleStamp[idx] === stamp) continue;
            this.circleStamp[idx] = stamp;
            const c = this.circles[idx];
            if (p.y > c.y1 || top < c.y0) continue;
            this._resolveCircle(p, radius, c, out);
          }
        }
      }
    }

    if (includeDynamic) {
      for (let i = 0; i < this.dynamic.length; i++) {
        const c = this.dynamic[i];
        if (!c.active) continue;
        if (p.y > c.y1 || top < c.y0) continue;
        if (c.soft) {
          // obstáculo ligero (rodadora…): golpea pero no empuja
          const dx = p.x - c.x;
          const dz = p.z - c.z;
          const rr = radius + c.r;
          if (dx * dx + dz * dz < rr * rr) out.soft = c;
          continue;
        }
        if (this._resolveCircle(p, radius, c, out)) out.dynamic = c;
      }
    }

    if (out.count > 0) {
      const l = Math.sqrt(out.nx * out.nx + out.nz * out.nz);
      if (l > 1e-6) {
        out.nx /= l;
        out.nz /= l;
      }
    }
    return out.count;
  }

  _resolveCircle(p, radius, c, out) {
    const ddx = p.x - c.x;
    const ddz = p.z - c.z;
    const rr = radius + c.r;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 >= rr * rr) return false;
    const d = Math.sqrt(d2);
    const nx = d > 1e-5 ? ddx / d : 1;
    const nz = d > 1e-5 ? ddz / d : 0;
    const depth = rr - d;
    p.x += nx * depth;
    p.z += nz * depth;
    out.nx += nx * depth;
    out.nz += nz * depth;
    if (depth > out.depth) {
      out.depth = depth;
      out.kind = c.kind;
    }
    out.count++;
    return true;
  }

  /** Comprueba si un punto está dentro de algún colisionador (para colocar objetos). */
  isBlocked(x, y, z, radius) {
    const p = { x, y, z };
    const out = {};
    return this.collideCircle(p, radius, 1.0, out, false) > 0;
  }
}
