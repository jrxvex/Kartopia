// Marcas de derrape: tiras oscuras sobre el suelo en un búfer circular de quads.
import * as THREE from 'three';

const MAX_QUADS = 1600;

export class SkidMarks {
  constructor(scene) {
    this.pos = new Float32Array(MAX_QUADS * 4 * 3);
    this.col = new Float32Array(MAX_QUADS * 4 * 4);
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4;
      idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], q * 6);
    }
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.cursor = 0;
    this.last = new Map(); // clave (kart+rueda) → último punto
  }

  /** Añade un tramo de marca para una rueda. key identifica kart+rueda. */
  add(key, x, y, z, nx, ny, nz, dirX, dirZ, width = 0.28, alpha = 0.4, color = [0.05, 0.05, 0.05]) {
    const prev = this.last.get(key);
    const px = x + nx * 0.04;
    const py = y + ny * 0.04;
    const pz = z + nz * 0.04;
    // lateral perpendicular a la dirección (en el plano del suelo, aprox.)
    const lx = -dirZ * width;
    const lz = dirX * width;
    if (prev) {
      const d2 = (prev.x - px) ** 2 + (prev.z - pz) ** 2;
      if (d2 < 0.09) return;
      if (d2 > 9) {
        this.last.set(key, { x: px, y: py, z: pz, lx, lz });
        return;
      }
      const q = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_QUADS;
      const o = q * 12;
      const P = this.pos;
      P[o] = prev.x - prev.lx;
      P[o + 1] = prev.y;
      P[o + 2] = prev.z - prev.lz;
      P[o + 3] = prev.x + prev.lx;
      P[o + 4] = prev.y;
      P[o + 5] = prev.z + prev.lz;
      P[o + 6] = px - lx;
      P[o + 7] = py;
      P[o + 8] = pz - lz;
      P[o + 9] = px + lx;
      P[o + 10] = py;
      P[o + 11] = pz + lz;
      const c = q * 16;
      for (let k = 0; k < 4; k++) {
        this.col[c + k * 4] = color[0];
        this.col[c + k * 4 + 1] = color[1];
        this.col[c + k * 4 + 2] = color[2];
        this.col[c + k * 4 + 3] = alpha;
      }
      this.dirty = true;
    }
    this.last.set(key, { x: px, y: py, z: pz, lx, lz });
  }

  break(key) {
    this.last.delete(key);
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}
