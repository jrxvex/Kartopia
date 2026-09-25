// Construye la representación visual de un circuito a partir de los datos lógicos generados por
// TrackBuilder: carretera, bordillos, faldones, muros por estilo, rampas, paneles turbo, atajos,
// puentes con pilares, túneles, línea de meta con arco y semáforo, terreno con colores por
// superficie, agua, lava, horizonte, decoración instanciada, obstáculos y monumentos.
import * as THREE from 'three';
import { buildStrip, buildSweep, contiguousRuns } from './RoadStrip.js';
import { FLAG } from './Track.js';
import { SURFACE } from '../physics/Surfaces.js';
import { TextureFactory } from '../render/TextureFactory.js';
import { buildProps } from '../models/PropModels.js';
import { fbm2 } from '../core/Random.js';
import { clamp, lerp } from '../core/MathUtils.js';
import { LandmarkKit } from './LandmarkKit.js';
import { batchStatic } from './StaticBatcher.js';

function geoFromStrip(strip) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(strip.positions, 3));
  if (strip.uvs) g.setAttribute('uv', new THREE.BufferAttribute(strip.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(strip.indices, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const WALL_PROFILES = {
  barrier: [[0, -0.4], [0, 0.3], [0.12, 0.5], [0.12, 0.95], [0.42, 0.95], [0.42, 0.5], [0.54, 0.3], [0.54, -0.4]],
  stone: [[0, -0.6], [0, 1.35], [0.85, 1.35], [0.85, -0.6]],
  lava: [[0, -0.6], [0, 1.35], [0.85, 1.35], [0.85, -0.6]],
  hedge: [[0, -0.3], [0, 1.0], [0.2, 1.25], [0.8, 1.25], [1.0, 1.0], [1.0, -0.3]],
  rock: [[0, -0.6], [0.15, 0.9], [0.55, 1.5], [1.0, 1.2], [1.3, -0.6]],
  ice: [[0, -0.4], [0, 1.0], [0.25, 1.15], [0.6, 1.0], [0.6, -0.4]],
  snow: [[0, -0.5], [0.05, 0.55], [0.35, 0.95], [0.85, 1.08], [1.35, 0.8], [1.8, 0.2], [2.1, -0.5]],
  neon: [[0, -0.3], [0, 0.55], [0.3, 0.55], [0.3, -0.3]],
  glass: [[0, -0.2], [0, 0.25], [0.2, 0.25], [0.2, -0.2]],
};

export class TrackRenderer {
  constructor(track, def, materials, quality) {
    this.track = track;
    this.def = def;
    this.theme = def.theme || {};
    this.mats = materials;
    this.quality = quality;
    this.root = new THREE.Group();
    this.root.name = `track-${track.id}`;
    this.animators = [];
    this.gateLights = null;
    this.kit = new LandmarkKit(this);
  }

  add(obj, shadow = { cast: false, receive: true }) {
    obj.traverse((o) => {
      if (o.isMesh) {
        if (shadow.cast !== undefined) o.castShadow = shadow.cast;
        if (shadow.receive !== undefined) o.receiveShadow = shadow.receive;
      }
    });
    this.root.add(obj);
    return obj;
  }

  build() {
    this.buildRoad();
    this.buildWalls();
    this.buildRamps();
    this.buildPads();
    this.buildShortcuts();
    this.buildBridges();
    this.buildTunnels();
    this.buildStartLine();
    this.buildTerrain();
    this.buildFluids();
    this.buildVoid();
    this.buildHorizon();
    this.buildExtras();
    const props = buildProps(this.track.props, { ...this.theme, id: this.track.id }, this.quality.vegetation);
    this.add(props, {});
    for (const h of this.track.hazards) {
      const obj = h.buildVisual();
      if (obj) {
        obj.userData.dynamic = true;
        this.add(obj, { cast: true, receive: true });
      }
    }
    if (typeof this.def.landmarks === 'function') {
      this.def.landmarks(this.kit, THREE);
    }
    this.kit.finalize();
    // Todo lo estático, fusionado por material y zona: muchas menos llamadas de dibujo
    this.batchStats = batchStatic(this.root, { animators: this.animators });
    return this.root;
  }

  update(dt, time) {
    for (const fn of this.animators) fn(dt, time);
    for (const h of this.track.hazards) h.syncVisual(time);
  }

  // ---------------------------------------------------------------------------------- Carretera
  buildRoad() {
    const tr = this.track;
    const cw = tr.curbWidth;
    for (const run of tr.geometry.runs) {
      const mat = this.mats.road(run.style || 'asphalt');
      const mesh = new THREE.Mesh(geoFromStrip(run.strip), mat);
      mesh.receiveShadow = true;
      mesh.name = 'road';
      this.root.add(mesh);
      // Faldones laterales (grosor de la calzada / tablero de puente)
      for (const side of [-1, 1]) {
        const skirt = buildSweep(
          tr,
          run.list,
          (k, i) => side * (tr.width[i] * 0.5 + (tr.flags[i] & FLAG.CURBS ? cw : 0)),
          [[0, 0.01], [0, (tr.flags[run.list[0]] & FLAG.NO_TERRAIN) ? -1.2 : -3]],
          { flip: side < 0, vScale: 6 },
        );
        const sm = new THREE.Mesh(geoFromStrip(skirt), (tr.flags[run.list[0]] & FLAG.NO_TERRAIN) ? this.mats.bridgeSide() : this.mats.skirt());
        sm.receiveShadow = true;
        this.root.add(sm);
      }
      // Cara inferior en puentes/tramos elevados
      const elevated = run.list.filter((i) => tr.flags[i] & FLAG.NO_TERRAIN);
      if (elevated.length > 1) {
        for (const sub of splitContiguous(run.list, (i) => tr.flags[i] & FLAG.NO_TERRAIN)) {
          if (sub.length < 2) continue;
          const bottom = buildStrip(tr, sub, (k, i) => tr.width[i] * 0.5 + cw, (k, i) => -(tr.width[i] * 0.5 + cw), { y: () => -1.2, vScale: 8 });
          this.root.add(new THREE.Mesh(geoFromStrip(bottom), this.mats.bridgeSide()));
        }
      }
    }
    for (const c of tr.geometry.curbs) {
      const mesh = new THREE.Mesh(geoFromStrip(c.strip), this.mats.curb());
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }

  // ---------------------------------------------------------------------------------- Muros
  buildWalls() {
    const tr = this.track;
    for (const w of tr.geometry.walls) {
      this.sweepWall(tr, w.list, (k, i) => w.side * w.offset(i), w.side, w.style, w.height);
    }
  }

  /** Barre el perfil de un estilo de muro a lo largo de una lista de muestras. */
  sweepWall(src, list, baseLat, side, style, height = 1.1) {
    const flip = side < 0;
    const scaleY = height / 1.1;
    const prof = (p) => p.map(([d, y]) => [d * side, y * scaleY]);
    if (style === 'fence' || style === 'woodRail' || style === 'metal') {
      const thick = style === 'woodRail' ? 0.16 : 0.1;
      const rails = style === 'metal' ? [[0.45, 0.85]] : [[0.35, 0.5], [0.8, 0.98]];
      for (const [y0, y1] of rails) {
        const geo = geoFromStrip(buildSweep(src, list, baseLat, prof([[0, y0], [0, y1], [thick, y1], [thick, y0]]), { flip, vScale: 3 }));
        this.root.add(new THREE.Mesh(geo, style === 'metal' ? this.mats.wall('metal') : this.mats.wall('fence')));
      }
      // postes
      const posts = [];
      let acc = 0;
      for (let k = 0; k < list.length; k++) {
        if (k > 0) acc += 2;
        if (acc >= 3 || k === 0) {
          acc = 0;
          const i = list[k];
          const lat = baseLat(k, i) + side * thick * 0.5;
          const b = src.bank[i];
          posts.push([src.px[i] + src.rx[i] * Math.cos(b) * lat, src.py[i] + Math.sin(b) * lat, src.pz[i] + src.rz[i] * Math.cos(b) * lat]);
        }
      }
      const postGeo = new THREE.BoxGeometry(0.16, 1.4 * scaleY, 0.16);
      postGeo.translate(0, 0.45 * scaleY, 0);
      const inst = new THREE.InstancedMesh(postGeo, style === 'metal' ? this.mats.wall('metal') : this.mats.wallAccent('fence'), posts.length);
      const m = new THREE.Matrix4();
      posts.forEach((p, n) => {
        m.makeTranslation(p[0], p[1], p[2]);
        inst.setMatrixAt(n, m);
      });
      inst.castShadow = true;
      this.root.add(inst);
      return;
    }
    if (style === 'tire') {
      const pts = [];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        const lat = baseLat(k, i) + side * 0.5;
        pts.push([src.px[i] + src.rx[i] * lat, src.py[i], src.pz[i] + src.rz[i] * lat]);
      }
      const geo = new THREE.TorusGeometry(0.45, 0.2, 6, 12);
      geo.rotateX(Math.PI / 2);
      const inst = new THREE.InstancedMesh(geo, this.mats.wall('tire'), pts.length * 2);
      const m = new THREE.Matrix4();
      pts.forEach((p, n) => {
        m.makeTranslation(p[0], p[1] + 0.2, p[2]);
        inst.setMatrixAt(n * 2, m);
        m.makeTranslation(p[0], p[1] + 0.58, p[2]);
        inst.setMatrixAt(n * 2 + 1, m);
      });
      this.root.add(inst);
      return;
    }
    const profile = WALL_PROFILES[style] || WALL_PROFILES.barrier;
    const geo = geoFromStrip(buildSweep(src, list, baseLat, prof(profile), { flip, vScale: style === 'barrier' ? 4 : 3 }));
    const mesh = new THREE.Mesh(geo, this.mats.wall(style));
    mesh.castShadow = style !== 'glass';
    mesh.receiveShadow = true;
    this.root.add(mesh);
    if (style === 'neon' || style === 'glass') {
      const top = style === 'neon' ? [[0.06, 0.55], [0.06, 0.7], [0.24, 0.7], [0.24, 0.55]] : [[0.05, 1.15], [0.05, 1.28], [0.15, 1.28], [0.15, 1.15]];
      const g2 = geoFromStrip(buildSweep(src, list, baseLat, prof(top), { flip, vScale: 3 }));
      this.root.add(new THREE.Mesh(g2, this.mats.wallAccent(style)));
      if (style === 'glass') {
        const pane = geoFromStrip(buildSweep(src, list, baseLat, prof([[0.1, 0.25], [0.1, 1.15]]), { flip, vScale: 3 }));
        this.root.add(new THREE.Mesh(pane, this.mats.wall('glass')));
      }
    }
  }

  // ---------------------------------------------------------------------------------- Rampas
  buildRamps() {
    const tr = this.track;
    for (const r of tr.geometry.ramps) {
      const top = new THREE.Mesh(geoFromStrip(r.strip), this.mats.ramp(r.style));
      top.receiveShadow = true;
      top.castShadow = true;
      this.root.add(top);
      const sideMat = this.mats.rampSide(r.style);
      for (const s of [-1, 1]) {
        const pos = [];
        const idx = [];
        r.list.forEach((i, k) => {
          const lat = r.lat + s * r.hw;
          const b = tr.bank[i];
          const x = tr.px[i] + tr.rx[i] * Math.cos(b) * lat;
          const y = tr.py[i] + Math.sin(b) * lat;
          const z = tr.pz[i] + tr.rz[i] * Math.cos(b) * lat;
          pos.push(x, y - 0.05, z, x, y + r.yf(k), z);
          if (k > 0) {
            const a = (k - 1) * 2;
            if (s > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
            else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, sideMat);
        m.castShadow = true;
        this.root.add(m);
      }
      // cara trasera
      const iEnd = r.list[r.list.length - 1];
      const hEnd = r.yf(r.list.length - 1);
      const b = tr.bank[iEnd];
      const corners = [-1, 1].map((s) => {
        const lat = r.lat + s * r.hw;
        return [tr.px[iEnd] + tr.rx[iEnd] * Math.cos(b) * lat, tr.py[iEnd] + Math.sin(b) * lat, tr.pz[iEnd] + tr.rz[iEnd] * Math.cos(b) * lat];
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [...corners[0].map((v, n) => (n === 1 ? v - 0.05 : v)), ...corners[1].map((v, n) => (n === 1 ? v - 0.05 : v)), ...corners[0].map((v, n) => (n === 1 ? v + hEnd : v)), ...corners[1].map((v, n) => (n === 1 ? v + hEnd : v))],
          3,
        ),
      );
      g.setIndex([0, 1, 2, 1, 3, 2, 0, 2, 1, 1, 2, 3]);
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, sideMat));
    }
  }

  buildPads() {
    for (const p of this.track.geometry.pads) {
      const mesh = new THREE.Mesh(geoFromStrip(p.strip), this.mats.boostPad());
      mesh.renderOrder = 1;
      this.root.add(mesh);
    }
  }

  buildShortcuts() {
    for (const sc of this.track.geometry.shortcuts) {
      const mesh = new THREE.Mesh(geoFromStrip(sc.strip), this.mats.road(sc.style === 'mud' ? 'mud' : sc.style === 'sand' ? 'sand' : sc.style === 'planks' ? 'planks' : 'dirt'));
      mesh.receiveShadow = true;
      this.root.add(mesh);
      const src = sc.src;
      for (const side of [-1, 1]) {
        const skirt = buildSweep(src, sc.list, (k, i) => side * src.width[i] * 0.5, [[0, 0.01], [0, -2]], { flip: side < 0 });
        this.root.add(new THREE.Mesh(geoFromStrip(skirt), this.mats.skirt()));
        if (src.walls) this.sweepWall(src, sc.list, (k, i) => side * (src.width[i] * 0.5 + 0.4), side, this.track.wallStyles[0], 1.1);
      }
    }
  }

  // ---------------------------------------------------------------------------------- Puentes / túneles
  buildBridges() {
    const tr = this.track;
    const hf = tr.heightfield;
    const positions = [];
    const runs = contiguousRuns(tr.N, (i) => (tr.flags[i] & FLAG.BRIDGE) !== 0 && !(tr.flags[i] & FLAG.GAP), true);
    for (const run of runs) {
      for (let k = 2; k < run.length - 2; k += 6) {
        const i = run[k];
        for (const s of [-0.62, 0.62]) {
          const lat = s * tr.width[i] * 0.5;
          const x = tr.px[i] + tr.rx[i] * lat;
          const z = tr.pz[i] + tr.rz[i] * lat;
          const top = tr.py[i] + Math.sin(tr.bank[i]) * lat - 1.2;
          let bottom = hf ? hf.heightAt(x, z) : tr.killY;
          if (!(bottom === bottom)) bottom = top - 30;
          if (tr.waterLevel !== null) bottom = Math.min(bottom, tr.waterLevel - 2);
          if (top - bottom < 1.5) continue;
          const q = tr.nearestRoad(x, z, 20);
          if (q.follow.d < q.follow.hw + 1.5 && Math.abs(q.follow.cy - bottom) < 3) continue;
          positions.push([x, bottom - 1, z, top - bottom + 1]);
        }
      }
    }
    if (!positions.length) return;
    const geo = new THREE.CylinderGeometry(0.7, 0.9, 1, 10);
    geo.translate(0, 0.5, 0);
    const inst = new THREE.InstancedMesh(geo, this.mats.bridgeSide(), positions.length);
    const m = new THREE.Matrix4();
    positions.forEach(([x, y, z, h], n) => {
      m.makeScale(1, h, 1);
      m.setPosition(x, y, z);
      inst.setMatrixAt(n, m);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.root.add(inst);
  }

  buildTunnels() {
    const tr = this.track;
    const runs = contiguousRuns(tr.N, (i) => (tr.flags[i] & FLAG.TUNNEL) !== 0, true);
    for (const run of runs) {
      if (run.length < 3) continue;
      const hw = Math.max(...run.map((i) => tr.width[i])) * 0.5 + tr.curbWidth + 1.2;
      const arc = [];
      for (let a = 0; a <= 12; a++) {
        const t = (a / 12) * Math.PI;
        arc.push([-Math.cos(t) * hw, Math.sin(t) * 7.5 + 0.2]);
      }
      const inner = buildSweep(tr, run, () => 0, arc, { vScale: 6, flip: true });
      const mesh = new THREE.Mesh(geoFromStrip(inner), this.mats.wall(this.theme.tunnel || 'rock'));
      mesh.material.side = THREE.DoubleSide;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.root.add(mesh);
      // lámparas en el techo cada pocos metros
      const lampGeo = new THREE.BoxGeometry(0.9, 0.18, 2.2);
      const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.theme.tunnelLight || '#fff3c4').multiplyScalar(2.2) });
      const spots = run.filter((_, k) => k % 4 === 2);
      const lamps = new THREE.InstancedMesh(lampGeo, lampMat, spots.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      spots.forEach((i, n) => {
        q.setFromAxisAngle(up, Math.atan2(tr.tx[i], tr.tz[i]));
        m.compose(new THREE.Vector3(tr.px[i], tr.py[i] + 7.55, tr.pz[i]), q, new THREE.Vector3(1, 1, 1));
        lamps.setMatrixAt(n, m);
      });
      this.root.add(lamps);
    }
  }

  // ---------------------------------------------------------------------------------- Meta
  buildStartLine() {
    const tr = this.track;
    const hw = tr.width[0] * 0.5 + tr.curbWidth;
    const pts = [
      tr.pointAt(-1.2, -hw),
      tr.pointAt(-1.2, hw),
      tr.pointAt(1.2, -hw),
      tr.pointAt(1.2, hw),
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y + 0.03, p.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    g.computeVertexNormals();
    const line = new THREE.Mesh(g, this.mats.checker());
    line.receiveShadow = true;
    line.renderOrder = 1;
    this.root.add(line);

    // Arco de salida con pancarta y semáforo
    const gate = new THREE.Group();
    const p0 = tr.pointAt(0, 0);
    const yaw = tr.headingAt(0);
    gate.position.set(p0.x, p0.y, p0.z);
    gate.rotation.y = yaw;
    const span = hw + 1.6;
    const pillarMat = new THREE.MeshStandardMaterial({ color: this.theme.gateColor || '#eceff1', roughness: 0.4, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.5, 1.1), pillarMat);
      p.position.set(s * span, 4.25, 0);
      p.castShadow = true;
      gate.add(p);
    }
    // Pancarta: caja del color del arco + dos caras con la textura (una sola malla por material)
    const bannerTex = TextureFactory.banner(this.def.name || 'KARTOPIA', this.theme.bannerColor || '#1565c0');
    const bw = span * 2 + 1.1;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.8, 0.6), pillarMat);
    banner.position.y = 8.2;
    banner.castShadow = true;
    gate.add(banner);
    const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: bannerTex, emissiveIntensity: this.theme.night ? 0.6 : 0.08 });
    for (const side of [1, -1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(bw, 1.8), bannerMat);
      face.position.set(0, 8.2, side * 0.32);
      if (side < 0) face.rotation.y = Math.PI;
      gate.add(face);
    }
    // semáforo
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.5), new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.5 }));
    box.position.set(0, 6.6, -0.1);
    gate.add(box);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 4);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 4; i++) {
      bulbs.setMatrixAt(i, m.makeTranslation(-1.2 + i * 0.8, 6.6, -0.4));
      bulbs.setColorAt(i, new THREE.Color('#330000'));
    }
    bulbs.computeBoundingSphere();
    gate.add(bulbs);
    this.gateLights = bulbs;
    this.root.add(gate);
  }

  /** value: 3,2,1 (rojo progresivo), 0 (verde), null (apagado) */
  setGateLights(value) {
    const bulbs = this.gateLights;
    if (!bulbs) return;
    const c = new THREE.Color();
    for (let i = 0; i < 4; i++) {
      if (value === 0) c.set('#00e676').multiplyScalar(3);
      else if (value !== null && value !== undefined && i < 4 - value) c.set('#ff1744').multiplyScalar(3);
      else c.set('#330000');
      bulbs.setColorAt(i, c);
    }
    bulbs.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.kit.dispose();
  }

  // ---------------------------------------------------------------------------------- Terreno
  buildTerrain() {
    const tr = this.track;
    const hf = tr.heightfield;
    if (!hf) return;
    const g = this.theme.ground || {};
    const grass = (g.grass || ['#5fae45', '#4c9837', '#7cc154']).map((c) => new THREE.Color(c));
    const cols = {
      rock: new THREE.Color(g.rock || '#8c857b'),
      sand: new THREE.Color(g.sand || '#e3d397'),
      dirt: new THREE.Color(g.dirt || '#8e6d45'),
      mud: new THREE.Color(g.mud || '#6b4f33'),
      snow: new THREE.Color(g.snow || '#f1f5fa'),
      bed: new THREE.Color(g.bed || g.sand || '#c9b27a'),
      lava: new THREE.Color('#2a1d18'),
      neon: new THREE.Color('#1a1030'),
    };
    const baseFor = (s, n) => {
      switch (s) {
        case SURFACE.GRASS:
          return grass[0].clone().lerp(grass[n > 0.5 ? 2 : 1], Math.abs(n - 0.5) * 1.6);
        case SURFACE.SAND:
          return cols.sand.clone().multiplyScalar(0.92 + n * 0.16);
        case SURFACE.SNOW:
          return cols.snow.clone().multiplyScalar(0.94 + n * 0.08);
        case SURFACE.ROCK:
          return cols.rock.clone().multiplyScalar(0.85 + n * 0.3);
        case SURFACE.DIRT:
          return cols.dirt.clone().multiplyScalar(0.9 + n * 0.2);
        case SURFACE.MUD:
          return cols.mud.clone();
        case SURFACE.SHALLOW_WATER:
        case SURFACE.DEEP_WATER:
          return cols.bed.clone().multiplyScalar(0.85);
        case SURFACE.LAVA:
          return cols.lava.clone();
        case SURFACE.ICE:
          return new THREE.Color('#cdefff');
        case SURFACE.NEON:
          return cols.neon.clone();
        default:
          return grass[0].clone();
      }
    };
    const vx = hf.vx;
    const vz = hf.vz;
    const count = vx * vz;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const col = new Float32Array(count * 3);
    for (let j = 0; j < vz; j++) {
      for (let i = 0; i < vx; i++) {
        const idx = j * vx + i;
        const x = hf.minX + i * hf.cell;
        const z = hf.minZ + j * hf.cell;
        const h = hf.heights[idx];
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = h;
        pos[idx * 3 + 2] = z;
        uv[idx * 2] = x / 7;
        uv[idx * 2 + 1] = z / 7;
        const n = fbm2(x * 0.03, z * 0.03, 3, 5) * 0.5 + 0.5;
        const c = baseFor(hf.surfaces[idx], n);
        const nd = hf.nearD ? hf.nearD[idx] : 99;
        if (nd < tr.curbWidth + 3 && hf.surfaces[idx] === SURFACE.GRASS) c.lerp(cols.dirt, 0.35 * (1 - nd / (tr.curbWidth + 3)));
        if (this.theme.terrainTint) c.multiply(new THREE.Color(this.theme.terrainTint));
        col[idx * 3] = c.r;
        col[idx * 3 + 1] = c.g;
        col[idx * 3 + 2] = c.b;
      }
    }
    const index = new Uint32Array(hf.nx * hf.nz * 6);
    let k = 0;
    for (let j = 0; j < hf.nz; j++) {
      for (let i = 0; i < hf.nx; i++) {
        const a = j * vx + i;
        const b = a + 1;
        const c = a + vx;
        const d = c + 1;
        index[k++] = a;
        index[k++] = c;
        index[k++] = b;
        index[k++] = b;
        index[k++] = c;
        index[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.mats.terrain());
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.root.add(mesh);
    this.buildOuterTerrain(baseFor);
  }

  buildOuterTerrain(baseFor) {
    const tr = this.track;
    const hf = tr.heightfield;
    if (!tr.naturalHeight) return;
    const cell = 30;
    const cx = tr.center.x;
    const cz = tr.center.z;
    const R = 1500;
    const n = Math.ceil((R * 2) / cell);
    const minX = cx - R;
    const minZ = cz - R;
    const vx = n + 1;
    const pos = new Float32Array(vx * vx * 3);
    const col = new Float32Array(vx * vx * 3);
    const uv = new Float32Array(vx * vx * 2);
    const b = tr.bounds;
    const surf = this.theme.ground?.outer ? SURFACE[this.theme.ground.outer] : hf.defaultSurface;
    for (let j = 0; j < vx; j++) {
      for (let i = 0; i < vx; i++) {
        const x = minX + i * cell;
        const z = minZ + j * cell;
        const inside = hf.contains(x, z);
        const dx = Math.max(b.minX - x, 0, x - b.maxX);
        const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
        let h;
        if (inside) h = tr.naturalHeight(x, z) - 1.2;
        else h = tr.farHeight(x, z, Math.hypot(dx, dz));
        const idx = j * vx + i;
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = h;
        pos[idx * 3 + 2] = z;
        uv[idx * 2] = x / 7;
        uv[idx * 2 + 1] = z / 7;
        const nn = fbm2(x * 0.01, z * 0.01, 2, 9) * 0.5 + 0.5;
        let s = surf;
        if (tr.waterLevel !== null && h < tr.waterLevel) s = SURFACE.SHALLOW_WATER;
        const rockiness = clamp((h - (this.theme.snowLine ?? 1e9)) / 20, 0, 1);
        const c = baseFor(s, nn);
        if (this.theme.snowLine !== undefined && rockiness > 0) c.lerp(new THREE.Color('#f4f8fb'), rockiness);
        else if (h > (tr.maxY ?? 0) + 40) c.lerp(new THREE.Color(this.theme.ground?.rock || '#8c857b'), clamp((h - (tr.maxY ?? 0) - 40) / 60, 0, 0.7));
        col[idx * 3] = c.r;
        col[idx * 3 + 1] = c.g;
        col[idx * 3 + 2] = c.b;
      }
    }
    const index = [];
    const inner = (x, z) => x > hf.minX + cell && x < hf.maxX - cell && z > hf.minZ + cell && z < hf.maxZ - cell;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = minX + i * cell;
        const z0 = minZ + j * cell;
        if (inner(x0, z0) && inner(x0 + cell, z0) && inner(x0, z0 + cell) && inner(x0 + cell, z0 + cell)) continue;
        const a = j * vx + i;
        const bb = a + 1;
        const c = a + vx;
        const d = c + 1;
        index.push(a, c, bb, bb, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mats.terrain());
    mesh.receiveShadow = false;
    mesh.name = 'terrain-outer';
    this.root.add(mesh);
  }

  buildFluids() {
    const tr = this.track;
    const hf = tr.heightfield;
    const make = (level, mat, depthFn) => {
      const cx = tr.center.x;
      const cz = tr.center.z;
      const R = hf ? Math.max(hf.maxX - hf.minX, hf.maxZ - hf.minZ) * 0.6 + 60 : 900;
      const seg = 110;
      const geo = new THREE.PlaneGeometry(R * 2, R * 2, seg, seg);
      geo.rotateX(-Math.PI / 2);
      geo.translate(cx, level, cz);
      const p = geo.attributes.position;
      const depth = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) depth[i] = depthFn(p.getX(i), p.getZ(i));
      geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 3;
      this.root.add(mesh);
      // anillo lejano (horizonte)
      const far = new THREE.RingGeometry(R * 0.98, 2400, 48, 1);
      far.rotateX(-Math.PI / 2);
      far.translate(cx, level - 0.05, cz);
      const fd = new Float32Array(far.attributes.position.count).fill(12);
      far.setAttribute('depth', new THREE.BufferAttribute(fd, 1));
      const farMesh = new THREE.Mesh(far, mat);
      farMesh.renderOrder = 3;
      this.root.add(farMesh);
      return mesh;
    };
    const depthAt = (level) => (x, z) => {
      if (!hf || !hf.contains(x, z)) return 10;
      const h = hf.heightAt(x, z);
      return h === h ? clamp(level - h, -2, 12) : 10;
    };
    if (tr.waterLevel !== null) this.water = make(tr.waterLevel, this.mats.water(), depthAt(tr.waterLevel));
    if (tr.lavaLevel !== null) this.lava = make(tr.lavaLevel, this.mats.lava(), depthAt(tr.lavaLevel));
  }

  buildVoid() {
    const v = this.theme.void;
    if (!v) return;
    const tr = this.track;
    if (v.type === 'grid') {
      const tex = TextureFactory.grid(v.color || '#00e5ff', v.bg || '#05010f', 4).clone();
      tex.needsUpdate = true;
      tex.repeat.set(160, 160);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffffff').multiplyScalar(v.intensity ?? 1.4) });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(tr.center.x, v.y ?? tr.killY + 25, tr.center.z);
      this.root.add(plane);
      this.animators.push((dt, t) => {
        tex.offset.y = t * 0.05;
      });
    } else if (v.type === 'clouds') {
      const tex = TextureFactory.cloud();
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(v.color || '#ffffff'), fog: true });
      const geo = new THREE.PlaneGeometry(120, 60);
      geo.rotateX(-Math.PI / 2);
      const n = 90;
      const inst = new THREE.InstancedMesh(geo, mat, n);
      const m = new THREE.Matrix4();
      const rngSeed = 7;
      for (let i = 0; i < n; i++) {
        const a = ((i * 137.5) % 360) * (Math.PI / 180);
        const r = 60 + ((i * 97) % 700);
        const s = 1 + ((i * 31) % 10) / 6;
        m.makeScale(s, 1, s);
        m.setPosition(tr.center.x + Math.cos(a) * r, (v.y ?? tr.minY - 40) + ((i * 13) % 20) - rngSeed, tr.center.z + Math.sin(a) * r);
        inst.setMatrixAt(i, m);
      }
      this.root.add(inst);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: new THREE.Color(v.sea || '#dce9f5') }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(tr.center.x, (v.y ?? tr.minY - 40) - 15, tr.center.z);
      this.root.add(sea);
    }
  }

  buildHorizon() {
    const hz = this.theme.horizon;
    if (!hz) return;
    const tr = this.track;
    const tex = TextureFactory.horizon(hz.color || '#6d8fb3', tr.id, !!hz.snow).clone();
    tex.needsUpdate = true;
    tex.repeat.set(hz.repeat || 3, 1);
    const geo = new THREE.CylinderGeometry(1700, 1700, hz.height || 420, 64, 1, true);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: true, alphaTest: 0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(tr.center.x, (hz.y ?? tr.minY) + (hz.height || 420) / 2 - 60, tr.center.z);
    mesh.renderOrder = -5;
    this.root.add(mesh);
  }

  // ---------------------------------------------------------------------------------- Extras
  buildExtras() {
    for (const e of this.track.geometry.extra) {
      if (e.type === 'wall') {
        const src = polylineSource(e.points, e.closed);
        const list = Array.from({ length: src.N }, (_, i) => i);
        this.sweepWall(src, list, () => 0, 1, e.style, e.height);
      } else if (e.type === 'box') {
        const mesh = this.kit.styledBox(e.w, e.h, e.d, e.style, e.color);
        mesh.position.set(e.x, e.y + e.h / 2, e.z);
        mesh.rotation.y = e.rot;
        this.add(mesh, { cast: true, receive: true });
      }
    }
  }
}

function splitContiguous(list, pred) {
  const out = [];
  let cur = null;
  for (const i of list) {
    if (pred(i)) {
      if (!cur) cur = [];
      cur.push(i);
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Crea una "fuente de marcos" (como la pista) a partir de una polilínea [[x,z,y],...]. */
export function polylineSource(points, closed = false) {
  const pts = [];
  const n = points.length;
  const segs = closed ? n : n - 1;
  for (let s = 0; s < segs; s++) {
    const a = points[s];
    const b = points[(s + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
    }
  }
  if (!closed) pts.push(points[n - 1]);
  else pts.push(points[0]);
  const N = pts.length;
  const src = {
    N,
    px: new Float32Array(N),
    py: new Float32Array(N),
    pz: new Float32Array(N),
    rx: new Float32Array(N),
    rz: new Float32Array(N),
    bank: new Float32Array(N),
  };
  for (let i = 0; i < N; i++) {
    src.px[i] = pts[i][0];
    src.pz[i] = pts[i][1];
    src.py[i] = pts[i][2];
  }
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(N - 1, i + 1);
    const dx = src.px[b] - src.px[a];
    const dz = src.pz[b] - src.pz[a];
    const l = Math.hypot(dx, dz) || 1;
    src.rx[i] = -dz / l;
    src.rz[i] = dx / l;
  }
  return src;
}
