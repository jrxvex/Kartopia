// Kit de monumentos y elementos singulares para decorar los circuitos (solo visual): molinos,
// graneros, gradas con público, globos, edificios con ventanas y neones, pirámides, torres de
// castillo, faros, templos, arcos, barcos, cristales gigantes, hologramas y carteles.
import * as THREE from 'three';
import { TextureFactory } from '../render/TextureFactory.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ModelBuilder, sharedMaterials, G, roundedBox } from '../models/ModelBuilder.js';
import { Random } from '../core/Random.js';

export class LandmarkKit {
  constructor(trackRenderer) {
    this.tr = trackRenderer;
    this.track = trackRenderer.track;
    this.THREE = THREE;
    this.rng = new Random(`${this.track.id}-landmarks`);
    this.matCache = new Map();
  }

  get markers() {
    return this.track.markers || {};
  }

  get theme() {
    return this.tr.theme;
  }

  add(obj, cast = true) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = cast;
        o.receiveShadow = true;
      }
    });
    this.tr.root.add(obj);
    return obj;
  }

  animate(fn) {
    this.tr.animators.push(fn);
  }

  ground(x, z) {
    const hf = this.track.heightfield;
    if (hf) {
      const h = hf.heightAt(x, z);
      if (h === h) return h;
    }
    return 0;
  }

  mat(color, opts = {}) {
    const key = `${color}:${JSON.stringify(opts)}`;
    if (!this.matCache.has(key)) this.matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts }));
    return this.matCache.get(key);
  }

  glow(color, intensity = 2.5) {
    const key = `glow:${color}:${intensity}`;
    if (!this.matCache.has(key)) this.matCache.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    return this.matCache.get(key);
  }

  light(x, y, z, color = '#ffcc88', intensity = 1, distance = 30) {
    this.track.pointLights.push({ x, y, z, color, intensity, distance });
  }

  styledBox(w, h, d, style = 'stone', color = null) {
    let mat;
    switch (style) {
      case 'building': {
        const tex = TextureFactory.windows(`${this.track.id}-${Math.floor(this.rng.next() * 6)}`, this.theme.night ? 0.5 : 0.25, this.theme.windowTint || '#ffd98a');
        const map = tex.map.clone();
        const em = tex.emissive.clone();
        map.needsUpdate = em.needsUpdate = true;
        map.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 24)));
        em.repeat.copy(map.repeat);
        mat = new THREE.MeshStandardMaterial({ map, color: color || '#ffffff', emissive: new THREE.Color('#ffffff'), emissiveMap: em, emissiveIntensity: this.theme.night ? 1.4 : 0.15, roughness: 0.6, metalness: 0.2 });
        break;
      }
      case 'brick':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || '#a1664a', '#5d3a2a'), roughness: 0.9 });
        break;
      case 'wood':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.wood(color || '#8d6e4f'), roughness: 0.85 });
        break;
      case 'metal':
        mat = this.mat(color || '#90a4ae', { metalness: 0.7, roughness: 0.35 });
        break;
      case 'neon':
        mat = new THREE.MeshStandardMaterial({ color: '#140a24', emissive: new THREE.Color(color || '#ff2bd6'), emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 });
        break;
      case 'sand':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || '#e0c48a', '#b89a62'), roughness: 0.95 });
        break;
      case 'ice':
        mat = this.mat(color || '#cdefff', { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
        break;
      default:
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || this.theme.stoneColor || '#8f8578', '#4a433c'), roughness: 0.9 });
    }
    const geo = new THREE.BoxGeometry(w, h, d);
    if (style !== 'neon' && style !== 'metal' && style !== 'ice') {
      // UV proporcionales al tamaño para que la textura no se estire
      const uv = geo.attributes.uv;
      const p = geo.attributes.position;
      const nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(nrm.getX(i));
        const ny = Math.abs(nrm.getY(i));
        const a = nx > 0.5 ? p.getZ(i) : p.getX(i);
        const b = ny > 0.5 ? p.getZ(i) : p.getY(i);
        const sc = style === 'building' ? 1 : 4;
        uv.setXY(i, style === 'building' ? uv.getX(i) : a / sc, style === 'building' ? uv.getY(i) : b / sc);
      }
    }
    return new THREE.Mesh(geo, mat);
  }

  // ------------------------------------------------------------------------------ Campo
  windmill(x, z, opts = {}) {
    const y = opts.y ?? this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = opts.rot ?? this.rng.range(0, Math.PI * 2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 14, 10), this.mat(opts.color || '#f5f0e6'));
    tower.position.y = 7;
    g.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.4, 10), this.mat('#b23a2a'));
    roof.position.y = 15.6;
    g.add(roof);
    const hub = new THREE.Group();
    hub.position.set(0, 13.2, 2.1);
    const bladeMat = this.mat('#fafafa');
    const frame = this.mat('#6d4c41');
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8, 0.2), frame);
      beam.position.y = 4;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.2, 0.08), bladeMat);
      sail.position.set(0.9, 4.6, 0);
      arm.add(beam, sail);
      hub.add(arm);
    }
    hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), frame));
    g.add(hub);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), this.mat('#6d4c41'));
    door.position.set(0, 1.2, 2.45);
    g.add(door);
    const speed = opts.speed ?? 0.6;
    this.animate((dt) => {
      hub.rotation.z += dt * speed;
    });
    return this.add(g);
  }

  barn(x, z, rot = 0) {
    const y = this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 20), this.mat('#b8352b'));
    body.position.y = 4;
    g.add(body);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-7.6, 0);
    roofShape.lineTo(0, 5);
    roofShape.lineTo(7.6, 0);
    roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 21, bevelEnabled: false }), this.mat('#5d4037'));
    roof.position.set(0, 8, -10.5);
    g.add(roof);
    const trim = this.mat('#ffffff');
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.3), this.mat('#8e2a22'));
      door.position.set(0, 3, s * 10.05);
      g.add(door);
      const x1 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 0.35), trim);
      x1.position.set(0, 3, s * 10.1);
      x1.rotation.z = 0.75;
      const x2 = x1.clone();
      x2.rotation.z = -0.75;
      g.add(x1, x2);
    }
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 14), this.mat('#b0bec5', { metalness: 0.5, roughness: 0.4 }));
    silo.position.set(10, 7, -4);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('#90a4ae', { metalness: 0.6, roughness: 0.3 }));
    cap.position.set(10, 14, -4);
    g.add(silo, cap);
    return this.add(g);
  }

  grandstand(x, z, rot = 0, length = 34, opts = {}) {
    const y = opts.y ?? this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    const seatMat = this.mat(opts.color || '#1e88e5');
    for (let r = 0; r < 5; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(length, 1, 2), r % 2 ? seatMat : this.mat('#eceff1'));
      step.position.set(0, 0.5 + r * 1.1, -r * 1.8);
      g.add(step);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(length, 7, 0.6), this.mat('#90a4ae'));
    back.position.set(0, 3.5, -9.4);
    g.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(length + 2, 0.4, 11), this.mat(opts.roof || '#e53935'));
    roof.position.set(0, 9.5, -4.6);
    roof.rotation.x = -0.08;
    g.add(roof);
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9.5, 8), this.mat('#cfd8dc'));
      col.position.set(s * (length / 2 - 0.5), 4.75, 0.2);
      g.add(col);
    }
    // público (instanciado, anima saltos)
    const n = Math.floor(length * 2.2);
    const fanGeo = new THREE.CapsuleGeometry(0.3, 0.5, 4, 6);
    const fans = new THREE.InstancedMesh(fanGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const palette = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ffffff', '#ff9100'];
    const base = [];
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const r = i % 5;
      const px = -length / 2 + 1 + this.rng.next() * (length - 2);
      base.push([px, 1.55 + r * 1.1, -r * 1.8, this.rng.range(0, 6)]);
      m.makeTranslation(px, 1.55 + r * 1.1, -r * 1.8);
      fans.setMatrixAt(i, m);
      c.set(palette[i % palette.length]);
      fans.setColorAt(i, c);
    }
    g.add(fans);
    this.animate((dt, t) => {
      for (let i = 0; i < n; i++) {
        const [px, py, pz, ph] = base[i];
        m.makeTranslation(px, py + Math.max(0, Math.sin(t * 6 + ph)) * 0.35, pz);
        fans.setMatrixAt(i, m);
      }
      fans.instanceMatrix.needsUpdate = true;
    });
    return this.add(g);
  }

  balloon(x, y, z, color = '#ff5252') {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const env = new THREE.Mesh(new THREE.SphereGeometry(6, 18, 14), this.mat(color, { roughness: 0.5 }));
    env.scale.set(1, 1.2, 1);
    g.add(env);
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(6.05, 18, 14, (i * Math.PI) / 3, 0.25), this.mat('#ffffff', { roughness: 0.5 }));
      stripe.scale.set(1, 1.2, 1);
      g.add(stripe);
    }
    const basket = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), this.mat('#8d6e4f'));
    basket.position.y = -9.5;
    g.add(basket);
    for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 4), this.mat('#5d4037'));
      rope.position.set(a * 0.9, -7.2, b * 0.9);
      g.add(rope);
    }
    const ph = this.rng.range(0, 6);
    this.animate((dt, t) => {
      g.position.y = y + Math.sin(t * 0.4 + ph) * 2;
      g.rotation.y += dt * 0.05;
    });
    return this.add(g, false);
  }

  // ------------------------------------------------------------------------------ Ciudad
  building(x, z, w, d, h, opts = {}) {
    const y = opts.y ?? this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = opts.rot || 0;
    const body = this.styledBox(w, h, d, 'building', opts.color);
    body.position.y = h / 2;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 2, d * 0.6), this.mat('#37474f'));
    roof.position.y = h + 1;
    g.add(roof);
    if (opts.antenna) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 10, 6), this.mat('#b0bec5'));
      ant.position.y = h + 7;
      g.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), this.glow('#ff1744', 4));
      tip.position.y = h + 12.2;
      g.add(tip);
      const ph = this.rng.range(0, 3);
      this.animate((dt, t) => {
        tip.visible = Math.sin(t * 3 + ph) > 0;
      });
    }
    if (opts.sign) {
      const tex = TextureFactory.neonSign(opts.sign, opts.signColor || '#ff4081');
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 18), Math.min(w * 0.9, 18) * 0.375), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffffff').multiplyScalar(1.6) }));
      sign.position.set(0, h * (opts.signHeight ?? 0.7), d / 2 + 0.3);
      g.add(sign);
    }
    if (opts.stripe) {
      for (const hh of [0.33, 0.66]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2), this.glow(opts.stripe, 2.2));
        s.position.y = h * hh;
        g.add(s);
      }
    }
    return this.add(g);
  }

  /**
   * Edificios fusionados por variante de fachada (pocas llamadas de dibujo). Cada edificio:
   * {x, y, z, w, d, h, rot, color?, sign?, signColor?}; su cara +Z local mira hacia la pista.
   * Las ventanas mantienen su tamaño real (≈4 × 3.5 m) sea cual sea el edificio.
   */
  cityBuildings(list, opts = {}) {
    if (!list.length) return null;
    const night = !!this.theme.night;
    const variants = opts.variants ?? 3;
    const palette = opts.colors || (night ? ['#626b78', '#58607a', '#6d6470', '#4f6766', '#707884'] : ['#b0bec5', '#9fa8da', '#bcaaa4', '#80cbc4', '#cfd8dc']);
    const neon = opts.neon || ['#ff2bd6', '#00e5ff', '#ffea00', '#76ff03'];
    const buckets = Array.from({ length: variants }, () => []);
    const deco = new ModelBuilder();
    const col = new THREE.Color();
    const root = new THREE.Group();
    const m = new THREE.Matrix4();
    list.forEach((b, n) => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const uv = geo.attributes.uv;
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(nrm.getY(i)) > 0.5) {
          uv.setXY(i, 0.01, 0.995);
          continue;
        }
        const a = Math.abs(nrm.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i);
        uv.setXY(i, a / 15 + n * 0.37, (pos.getY(i) + b.h / 2) / 50);
      }
      col.set(b.color || palette[n % palette.length]);
      const c = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        c[i * 3] = col.r;
        c[i * 3 + 1] = col.g;
        c[i * 3 + 2] = col.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geo.rotateY(b.rot || 0);
      geo.translate(b.x, b.y + b.h / 2, b.z);
      buckets[n % variants].push(geo);
      if (opts.roof === false) return;
      m.makeRotationY(b.rot || 0).setPosition(b.x, b.y, b.z);
      deco.add(G.box(b.w + 0.6, 0.8, b.d + 0.6), 'matte', '#455a64', { pos: [0, b.h + 0.4, 0], matrix: m });
      deco.add(G.box(b.w * 0.35, 1.8, b.d * 0.3), 'metal', '#90a4ae', { pos: [b.w * 0.18, b.h + 1.7, -b.d * 0.15], matrix: m });
      if (n % 3 === 0) deco.add(G.cyl(1.6, 1.6, 3, 10), 'matte', '#6d4c41', { pos: [-b.w * 0.25, b.h + 2.3, b.d * 0.2], matrix: m });
      if (b.h > 34) {
        deco.add(G.cyl(0.15, 0.3, 9, 6), 'metal', '#b0bec5', { pos: [0, b.h + 5.3, 0], matrix: m });
        deco.add(G.sphere(0.45, 8, 6), 'glow', '#ff1744', { pos: [0, b.h + 10, 0], matrix: m }, 4);
      }
      if (night && n % 2 === 1) {
        const nc = neon[n % neon.length];
        deco.add(G.box(b.w + 0.3, 0.35, b.d + 0.3), 'glow', nc, { pos: [0, b.h * 0.62, 0], matrix: m }, 2.6);
        deco.add(G.box(b.w + 0.35, 0.3, b.d + 0.35), 'glow', nc, { pos: [0, b.h - 0.2, 0], matrix: m }, 2.6);
      }
    });
    for (let v = 0; v < variants; v++) {
      if (!buckets[v].length) continue;
      const tex = TextureFactory.windows(`${this.track.id}-v${v}`, night ? 0.36 : 0.25, opts.tint || this.theme.windowTint || '#ffd98a');
      const map = tex.map.clone();
      const em = tex.emissive.clone();
      for (const t of [map, em]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.needsUpdate = true;
      }
      const mat = new THREE.MeshStandardMaterial({ map, vertexColors: true, emissive: new THREE.Color('#ffffff'), emissiveMap: em, emissiveIntensity: night ? 0.95 : 0.1, roughness: 0.55, metalness: 0.25 });
      const merged = mergeGeometries(buckets[v], false);
      for (const g of buckets[v]) g.dispose();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = 'buildings';
      root.add(mesh);
    }
    if (deco.parts.size) root.add(deco.build(sharedMaterials(), { castShadow: false }));
    // Rótulos luminosos en la fachada que da a la pista
    for (const b of list) {
      if (!b.sign) continue;
      const tex = TextureFactory.neonSign(b.sign, b.signColor || '#ff4081');
      const w = Math.min(b.w * 0.8, 16);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffffff').multiplyScalar(1.6) }));
      const g = new THREE.Group();
      g.position.set(b.x, b.y, b.z);
      g.rotation.y = b.rot || 0;
      sign.position.set(0, Math.min(b.h * 0.55, 18), b.d / 2 + 0.3);
      g.add(sign);
      root.add(g);
    }
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = opts.shadows !== false && o.name === 'buildings';
        o.receiveShadow = o.name === 'buildings';
      }
    });
    this.tr.root.add(root);
    return root;
  }

  /** Horizonte urbano: anillo de rascacielos lejanos sin colisión. */
  skyline(cx, cz, rMin, rMax, count, opts = {}) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(rMin, rMax);
      list.push({
        x: cx + Math.cos(a) * r,
        z: cz + Math.sin(a) * r,
        y: opts.y ?? -2,
        w: this.rng.range(22, 48),
        d: this.rng.range(22, 48),
        h: this.rng.range(opts.hMin ?? 45, opts.hMax ?? 150),
        rot: this.rng.range(0, Math.PI),
      });
    }
    return this.cityBuildings(list, { ...opts, shadows: false });
  }

  billboard(x, z, rot, text, color = '#ff4081', size = 14, height = 10) {
    const y = this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, height, 8), this.mat('#455a64', { metalness: 0.6 }));
      post.position.set(s * size * 0.3, height / 2, 0);
      g.add(post);
    }
    const tex = TextureFactory.neonSign(text, color);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.375), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffffff').multiplyScalar(1.5), side: THREE.DoubleSide }));
    panel.position.y = height + size * 0.19;
    g.add(panel);
    return this.add(g);
  }

  // ------------------------------------------------------------------------------ Bloques fusionados
  /** Material de bloque por estilo (compartido entre llamadas). */
  blockMaterial(style = 'stone', color = null) {
    const key = `block:${style}:${color}`;
    if (this.matCache.has(key)) return this.matCache.get(key);
    let mat;
    switch (style) {
      case 'sand':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || '#e0c48a', '#b89a62'), roughness: 0.95 });
        break;
      case 'brick':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || '#a1664a', '#5d3a2a'), roughness: 0.9 });
        break;
      case 'castle':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || '#5b5350', '#2b2523'), roughness: 0.9 });
        break;
      case 'rock':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.rock(color || this.theme.rockColor || '#8a8278'), roughness: 1, flatShading: true });
        break;
      case 'wood':
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.wood(color || '#8d6e4f'), roughness: 0.85 });
        break;
      default:
        mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(color || this.theme.stoneColor || '#8f8578', '#4a433c'), roughness: 0.9 });
    }
    this.matCache.set(key, mat);
    return mat;
  }

  /**
   * Fusiona muchas cajas texturizadas en una sola malla (UV proporcionales al tamaño).
   * boxes: [{x, y, z, w, h, d, rot}] con y en la base de la caja.
   */
  mergedBoxes(boxes, style = 'stone', color = null, opts = {}) {
    if (!boxes.length) return null;
    const geos = boxes.map((b) => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const uv = geo.attributes.uv;
      const p = geo.attributes.position;
      const nrm = geo.attributes.normal;
      const sc = opts.uvScale ?? 4;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(nrm.getX(i));
        const ny = Math.abs(nrm.getY(i));
        const a = nx > 0.5 ? p.getZ(i) : p.getX(i);
        const c = ny > 0.5 ? p.getZ(i) : p.getY(i);
        uv.setXY(i, a / sc, c / sc);
      }
      if (b.rx || b.rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.rx || 0, 0, b.rz || 0)));
      geo.rotateY(b.rot || 0);
      geo.translate(b.x, b.y + b.h / 2, b.z);
      return geo;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, this.blockMaterial(style, color));
    return this.add(mesh, opts.shadow !== false);
  }

  /**
   * Pasaje cubierto (templo, salón de castillo) alrededor de un tramo de la pista entre u0 y u1:
   * muros laterales, techo y portadas con columnas en ambos extremos. Pensado para tramos con
   * el indicador de túnel, cuyo arco interior dibuja TrackRenderer.
   */
  passage(u0, u1, opts = {}) {
    const tr = this.track;
    const s0 = tr.sAtU(u0);
    const span = tr.forwardDistance(s0, tr.sAtU(u1));
    const thick = opts.thickness ?? 5;
    const height = opts.height ?? 12;
    const roofY = opts.roofY ?? 8.2;
    const step = 6;
    const boxes = [];
    let maxHW = 0;
    for (let d = 0; d <= span; d += 2) maxHW = Math.max(maxHW, tr.width[tr.indexAtS(s0 + d)] * 0.5);
    const inner = maxHW + tr.curbWidth + 1.3;
    for (let d = 0; d < span; d += step) {
      const s = tr.wrapS(s0 + d + step / 2);
      const c = tr.pointAt(s, 0);
      const rot = tr.headingAt(s);
      for (const side of [-1, 1]) {
        const p = tr.pointAt(s, side * (inner + thick / 2));
        boxes.push({ x: p.x, y: c.y - 1, z: p.z, w: thick, h: height + 1, d: step + 0.6, rot });
      }
      boxes.push({ x: c.x, y: c.y + roofY, z: c.z, w: inner * 2 + thick * 2, h: Math.max(1.2, height - roofY + 0.8), d: step + 0.6, rot });
    }
    // Portadas
    const fronts = [];
    for (const [s, dir] of [[s0, -1], [tr.wrapS(s0 + span), 1]]) {
      const c = tr.pointAt(s, 0);
      const rot = tr.headingAt(s);
      const fx = Math.sin(rot) * dir;
      const fz = Math.cos(rot) * dir;
      for (const side of [-1, 1]) {
        const p = tr.pointAt(s, side * (inner + thick * 0.35));
        fronts.push({ x: p.x + fx * 1.2, y: c.y - 1, z: p.z + fz * 1.2, w: thick * 0.9, h: height + 4, d: 3, rot });
        const q = tr.pointAt(s, side * (inner + thick + 3));
        fronts.push({ x: q.x + fx * 0.5, y: c.y - 1, z: q.z + fz * 0.5, w: 4, h: height * 0.75, d: 4, rot });
      }
      fronts.push({ x: c.x + fx * 1.4, y: c.y + height, z: c.z + fz * 1.4, w: inner * 2 + thick * 2.6, h: 3.2, d: 3.6, rot });
      if (opts.glow) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), this.glow(opts.glow, 3));
        eye.position.set(c.x + fx * 3.3, c.y + height + 1.6, c.z + fz * 3.3);
        this.add(eye, false);
      }
      if (opts.torches !== false) {
        for (const side of [-1, 1]) {
          const p = tr.pointAt(s, side * (inner - 0.6));
          this.light(p.x + fx * 2, c.y + 4, p.z + fz * 2, opts.torchColor || '#ffb74d', 1.2, 22);
        }
      }
    }
    this.mergedBoxes(boxes, opts.style || 'stone', opts.color);
    this.mergedBoxes(fronts, opts.style || 'stone', opts.accent || opts.color);
    return { inner, span };
  }

  /** Formación rocosa (pila de rocas facetadas) — mesas, agujas y peñascos. */
  rockFormation(x, z, opts = {}) {
    const y = opts.y ?? this.ground(x, z) - 1;
    const h = opts.height ?? 18;
    const r = opts.radius ?? 7;
    const layers = opts.layers ?? 4;
    const b = new ModelBuilder();
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const rr = r * (1 - t * (opts.taper ?? 0.35)) * this.rng.range(0.85, 1.1);
      const lh = (h / layers) * 1.25;
      b.add(G.dodeca(1, 0), 'matte', opts.color || this.theme.rockColor || '#9c8068', {
        pos: [this.rng.range(-0.8, 0.8), (i + 0.5) * (h / layers), this.rng.range(-0.8, 0.8)],
        scale: [rr, lh * 0.7, rr * this.rng.range(0.8, 1.15)],
        rot: [0, this.rng.range(0, 6), 0],
      });
    }
    const g = b.build(sharedMaterials(), { castShadow: true, receiveShadow: true });
    g.position.set(x, y, z);
    g.traverse((o) => {
      if (o.isMesh) o.material = this.rockMat || (this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    });
    return this.add(g);
  }

  // ------------------------------------------------------------------------------ Desierto / templos
  pyramid(x, z, base = 60, h = 40, opts = {}) {
    const y = opts.y ?? this.ground(x, z) - 1;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = opts.rot ?? Math.PI / 4;
    const steps = opts.steps ?? 8;
    const color = opts.color || '#d9b779';
    for (let i = 0; i < steps; i++) {
      const s = base * (1 - i / steps);
      const block = this.styledBox(s, h / steps, s, 'sand', color);
      block.position.y = (i + 0.5) * (h / steps);
      g.add(block);
    }
    if (opts.cap !== false) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(base / steps * 0.75, h / steps * 1.5, 4), this.mat('#ffd54f', { metalness: 0.8, roughness: 0.25 }));
      cap.position.y = h + h / steps * 0.5;
      cap.rotation.y = Math.PI / 4;
      g.add(cap);
    }
    return this.add(g);
  }

  arch(x, z, rot, w = 20, h = 12, style = 'stone', opts = {}) {
    const y = opts.y ?? this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    const t = opts.thickness ?? 3;
    for (const s of [-1, 1]) {
      const p = this.styledBox(t, h, t, style, opts.color);
      p.position.set(s * (w / 2 + t / 2), h / 2, 0);
      g.add(p);
    }
    const top = this.styledBox(w + t * 2 + 1, t, t + 0.6, style, opts.color);
    top.position.y = h + t / 2;
    g.add(top);
    if (opts.glow) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.3), this.glow(opts.glow, 3));
      strip.position.set(0, h - 0.1, t / 2 + 0.2);
      g.add(strip);
    }
    return this.add(g);
  }

  temple(x, z, rot = 0, size = 30, opts = {}) {
    const y = opts.y ?? this.ground(x, z) - 0.5;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    const color = opts.color || '#8f9a7a';
    const levels = opts.levels ?? 5;
    for (let i = 0; i < levels; i++) {
      const s = size * (1 - i * 0.16);
      const b = this.styledBox(s, 4, s, 'stone', color);
      b.position.y = 2 + i * 4;
      g.add(b);
    }
    const shrine = this.styledBox(size * 0.3, 6, size * 0.3, 'stone', '#7a846a');
    shrine.position.y = levels * 4 + 3;
    g.add(shrine);
    const stairs = this.styledBox(size * 0.18, levels * 4, size * 0.7, 'stone', '#a3ad8c');
    stairs.position.set(0, levels * 2, size * 0.4);
    stairs.rotation.x = -0.55;
    g.add(stairs);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), this.glow(opts.glow || '#76ff03', 3));
    eye.position.set(0, levels * 4 + 3.5, size * 0.15 + 0.3);
    g.add(eye);
    this.animate((dt, t) => {
      eye.scale.setScalar(1 + Math.sin(t * 2) * 0.12);
    });
    // vegetación colgante
    const vineMat = this.mat('#33691e');
    for (let i = 0; i < 12; i++) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, this.rng.range(3, 8), 4), vineMat);
      const a = (i / 12) * Math.PI * 2;
      v.position.set(Math.cos(a) * size * 0.45, levels * 3, Math.sin(a) * size * 0.45);
      g.add(v);
    }
    return this.add(g);
  }

  // ------------------------------------------------------------------------------ Castillo
  tower(x, z, r = 5, h = 22, opts = {}) {
    const y = opts.y ?? this.ground(x, z) - 0.5;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshStandardMaterial({ map: TextureFactory.bricks(opts.color || '#5b5350', '#2b2523'), roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 14), mat);
    body.position.y = h / 2;
    g.add(body);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.2), mat);
      merlon.position.set(Math.cos(a) * r * 0.95, h + 0.8, Math.sin(a) * r * 0.95);
      merlon.rotation.y = -a;
      g.add(merlon);
    }
    if (opts.roof !== false) {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, r * 1.8, 14), this.mat(opts.roofColor || '#4a148c'));
      roof.position.y = h + r * 0.9 + 1.2;
      g.add(roof);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 2.2), this.mat(opts.flag || '#ff5722', { side: THREE.DoubleSide }));
      flag.position.set(0, h + r * 1.8 + 2.8, 1.1);
      g.add(flag);
    }
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.3), this.glow(opts.window || '#ff9100', 2.2));
      const a = i * 2.1;
      win.position.set(Math.cos(a) * r * 1.0, h * (0.35 + i * 0.2), Math.sin(a) * r * 1.0);
      win.rotation.y = -a + Math.PI / 2;
      g.add(win);
    }
    return this.add(g);
  }

  lighthouse(x, z, opts = {}) {
    const y = opts.y ?? this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const h = opts.height ?? 26;
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const r0 = 3.4 - (i / segs) * 1.3;
      const r1 = 3.4 - ((i + 1) / segs) * 1.3;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h / segs, 16), this.mat(i % 2 ? '#e53935' : '#fafafa'));
      seg.position.y = (i + 0.5) * (h / segs);
      g.add(seg);
    }
    const room = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3, 12), this.mat('#b3e5fc', { transparent: true, opacity: 0.5, roughness: 0.05 }));
    room.position.y = h + 1.5;
    g.add(room);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.4, 12), this.mat('#263238'));
    top.position.y = h + 4.2;
    g.add(top);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), this.glow('#fff59d', 4));
    lamp.position.y = h + 1.5;
    g.add(lamp);
    const beamGeo = new THREE.ConeGeometry(6, 60, 20, 1, true);
    beamGeo.rotateZ(Math.PI / 2);
    beamGeo.translate(31, 0, 0);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff9c4').multiplyScalar(1.5), transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const pivot = new THREE.Group();
    pivot.position.y = h + 1.5;
    pivot.add(beam);
    g.add(pivot);
    this.animate((dt) => {
      pivot.rotation.y += dt * 0.8;
    });
    this.light(x, y + h + 2, z, '#fff59d', 2, 60);
    return this.add(g);
  }

  boat(x, z, rot = 0, color = '#1565c0') {
    const y = (this.track.waterLevel ?? 0) - 0.2;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    const hull = new THREE.Mesh(roundedBox(4, 1.6, 11, 0.6), this.mat(color));
    hull.position.y = 0.6;
    g.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 9.5), this.mat('#d7ccc8'));
    deck.position.y = 1.45;
    g.add(deck);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 3.4), this.mat('#fafafa'));
    cabin.position.set(0, 2.5, -1.5);
    g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 6), this.mat('#8d6e4f'));
    mast.position.set(0, 5.5, 1.5);
    g.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 7.5);
    sailShape.lineTo(4, 0.5);
    sailShape.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), this.mat('#ffffff', { side: THREE.DoubleSide }));
    sail.position.set(0, 2, 1.5);
    sail.rotation.y = Math.PI / 2;
    g.add(sail);
    const ph = this.rng.range(0, 6);
    this.animate((dt, t) => {
      g.position.y = y + Math.sin(t * 1.2 + ph) * 0.25;
      g.rotation.z = Math.sin(t * 0.9 + ph) * 0.05;
    });
    return this.add(g);
  }

  crystalSpire(x, z, h = 20, color = '#18ffff', opts = {}) {
    const y = opts.y ?? this.ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 5; i++) {
      const hh = h * (1 - i * 0.15);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
      c.scale.set(h * 0.1, hh * 0.5, h * 0.1);
      const a = i * 1.3;
      c.position.set(Math.cos(a) * i * 1.2, hh * 0.45, Math.sin(a) * i * 1.2);
      c.rotation.set(Math.cos(a) * 0.2, a, Math.sin(a) * 0.2);
      g.add(c);
    }
    this.light(x, y + h * 0.4, z, color, 1.5, 40);
    return this.add(g);
  }

  hologramRing(x, y, z, r = 14, color = '#00e5ff', opts = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (opts.rot) g.rotation.set(...opts.rot);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 8, 64), mat);
    g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, 0.15, 6, 48), mat);
    g.add(ring2);
    const speed = opts.speed ?? 0.4;
    this.animate((dt) => {
      ring.rotation.z += dt * speed;
      ring2.rotation.z -= dt * speed * 1.5;
    });
    return this.add(g, false);
  }

  /** Cartel luminoso colgado sobre la pista (en u, lateral 0). */
  overheadSign(u, text, color = '#ff4081', height = 9) {
    const tr = this.track;
    const s = tr.sAtU(u);
    const i = tr.indexAtS(s);
    const p = tr.pointAt(s, 0);
    const hw = tr.width[i] * 0.5 + 2.5;
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = tr.headingAt(s);
    const frame = this.mat('#37474f', { metalness: 0.6, roughness: 0.4 });
    for (const sd of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, height + 2, 0.6), frame);
      post.position.set(sd * hw, (height + 2) / 2, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.6, 0.6, 0.6), frame);
    beam.position.y = height + 2;
    g.add(beam);
    const tex = TextureFactory.neonSign(text, color);
    const w = Math.min(hw * 1.6, 16);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffffff').multiplyScalar(1.5), side: THREE.DoubleSide }));
    panel.position.set(0, height, -0.4);
    panel.rotation.y = Math.PI;
    g.add(panel);
    return this.add(g);
  }
}
