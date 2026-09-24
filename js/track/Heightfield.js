// Mapa de alturas regular. Se usa a la vez para la colisión del terreno y para su malla visual,
// con la misma triangulación, de modo que lo que se ve coincide exactamente con lo que se pisa.
import { SURFACE } from '../physics/Surfaces.js';

export class Heightfield {
  constructor(minX, minZ, width, depth, cell) {
    this.cell = cell;
    this.inv = 1 / cell;
    this.nx = Math.max(1, Math.ceil(width / cell));
    this.nz = Math.max(1, Math.ceil(depth / cell));
    this.vx = this.nx + 1;
    this.vz = this.nz + 1;
    this.minX = minX;
    this.minZ = minZ;
    this.maxX = minX + this.nx * cell;
    this.maxZ = minZ + this.nz * cell;
    this.heights = new Float32Array(this.vx * this.vz);
    this.surfaces = new Uint8Array(this.vx * this.vz).fill(SURFACE.GRASS);
    this.defaultSurface = SURFACE.GRASS;
  }

  index(i, j) {
    return j * this.vx + i;
  }

  vertexX(i) {
    return this.minX + i * this.cell;
  }

  vertexZ(j) {
    return this.minZ + j * this.cell;
  }

  contains(x, z) {
    return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ;
  }

  /** Altura interpolada según la misma partición en triángulos (diagonal b-c) que la malla. */
  heightAt(x, z) {
    const fx = (x - this.minX) * this.inv;
    const fz = (z - this.minZ) * this.inv;
    if (fx < 0 || fz < 0 || fx > this.nx || fz > this.nz) return NaN;
    let i = Math.floor(fx);
    let j = Math.floor(fz);
    if (i >= this.nx) i = this.nx - 1;
    if (j >= this.nz) j = this.nz - 1;
    const tx = fx - i;
    const tz = fz - j;
    const H = this.heights;
    const vx = this.vx;
    const h00 = H[j * vx + i];
    const h10 = H[j * vx + i + 1];
    const h01 = H[(j + 1) * vx + i];
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    const h11 = H[(j + 1) * vx + i + 1];
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  /** Normal del triángulo que contiene (x, z). */
  normalAt(x, z, out) {
    const fx = (x - this.minX) * this.inv;
    const fz = (z - this.minZ) * this.inv;
    let i = Math.min(this.nx - 1, Math.max(0, Math.floor(fx)));
    let j = Math.min(this.nz - 1, Math.max(0, Math.floor(fz)));
    const tx = fx - i;
    const tz = fz - j;
    const H = this.heights;
    const vx = this.vx;
    const h00 = H[j * vx + i];
    const h10 = H[j * vx + i + 1];
    const h01 = H[(j + 1) * vx + i];
    const h11 = H[(j + 1) * vx + i + 1];
    let dx;
    let dz;
    if (tx + tz <= 1) {
      dx = (h10 - h00) * this.inv;
      dz = (h01 - h00) * this.inv;
    } else {
      dx = (h11 - h01) * this.inv;
      dz = (h11 - h10) * this.inv;
    }
    const len = Math.sqrt(dx * dx + 1 + dz * dz);
    out.x = -dx / len;
    out.y = 1 / len;
    out.z = -dz / len;
    return out;
  }

  surfaceAt(x, z) {
    const i = Math.round((x - this.minX) * this.inv);
    const j = Math.round((z - this.minZ) * this.inv);
    if (i < 0 || j < 0 || i >= this.vx || j >= this.vz) return this.defaultSurface;
    return this.surfaces[j * this.vx + i];
  }
}
