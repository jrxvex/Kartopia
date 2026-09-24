// Obstáculos dinámicos del circuito: vehículos/criaturas que se mueven, apisonadoras,
// péndulos y barras de fuego. La lógica funciona sin render (simulación); la parte visual
// se construye solo en el navegador con buildVisual().
import * as THREE from 'three';
import { TAU } from '../core/MathUtils.js';

function pingPong(t, len) {
  const m = t % (2 * len);
  return m < len ? m : 2 * len - m;
}

class Hazard {
  constructor(track, params, world) {
    this.track = track;
    this.params = params;
    this.world = world;
    this.colliders = [];
    this.object = null;
    this.time = 0;
  }

  addCollider(r, hit, kind = 'hazard', soft = false) {
    const c = { active: true, x: 0, z: 0, r, y0: 0, y1: 0, kind, hit, hazard: this, soft };
    this.world.addDynamic(c);
    this.colliders.push(c);
    return c;
  }

  update() {}
  buildVisual() {
    return null;
  }
  syncVisual() {}
  /** Puntos que la IA debería esquivar: [{x, z, r}] */
  avoidPoints(out) {
    for (const c of this.colliders) if (c.active) out.push({ x: c.x, z: c.z, r: c.r + 1.2 });
  }
}

// ---------------------------------------------------------------------------------------
// Móvil: recorre el circuito (carril) o una ruta propia. Coches, cangrejos, rodadoras...
class MoverHazard extends Hazard {
  constructor(track, p, world) {
    super(track, p, world);
    this.pos = { x: 0, y: 0, z: 0 };
    this.heading = 0;
    this.spin = 0;
    this.radius = p.radius ?? (p.model === 'car' ? 1.4 : p.model === 'bus' ? 1.5 : 1.6);
    // Vehículos largos: varios colisionadores repartidos a lo largo de la carrocería
    const len = p.length ?? (p.model === 'bus' ? 7.5 : p.model === 'car' ? 4.2 : 0);
    const n = len > this.radius * 2.2 ? Math.ceil(len / (this.radius * 2)) : 1;
    this.parts = [];
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : -len / 2 + this.radius + ((len - 2 * this.radius) * k) / (n - 1);
      this.parts.push({ off, c: this.addCollider(this.radius, p.hit || 'tumble', p.model || 'mover', p.soft ?? p.model === 'tumbleweed') });
    }
    this.collider = this.parts[0].c;
    this.speed = p.speed ?? 10;
    this.phase = p.phase ?? 0;
    if (p.path) {
      this.path = p.path;
      this.pathLen = [];
      let acc = 0;
      for (let i = 0; i < p.path.length; i++) {
        this.pathLen.push(acc);
        if (i < p.path.length - 1) acc += Math.hypot(p.path[i + 1][0] - p.path[i][0], p.path[i + 1][1] - p.path[i][1]);
      }
      if (p.loop) acc += Math.hypot(p.path[0][0] - p.path[p.path.length - 1][0], p.path[0][1] - p.path[p.path.length - 1][1]);
      this.total = acc;
    } else {
      this.sA = p.from !== undefined ? track.sAtU(p.from) : 0;
      this.sB = p.to !== undefined ? track.sAtU(p.to) : track.length;
      this.span = p.to !== undefined ? track.forwardDistance(this.sA, this.sB) : track.length;
    }
    this.update(0);
  }

  update(time) {
    const p = this.params;
    const d = time * this.speed + this.phase * (this.total || this.span || 1);
    let hx;
    let hz;
    if (this.path) {
      const len = this.total;
      let dist = p.loop ? d % len : pingPong(d, len);
      const forward = p.loop ? true : d % (2 * len) < len;
      const pts = this.path;
      let i = 0;
      while (i < pts.length - 2 && this.pathLen[i + 1] < dist) i++;
      let a = pts[i];
      let b = pts[i + 1] || pts[0];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const t = Math.min(1, Math.max(0, (dist - this.pathLen[i]) / segLen));
      this.pos.x = a[0] + (b[0] - a[0]) * t;
      this.pos.z = a[1] + (b[1] - a[1]) * t;
      hx = (b[0] - a[0]) * (forward ? 1 : -1);
      hz = (b[1] - a[1]) * (forward ? 1 : -1);
      const hf = this.track.heightfield;
      const g = this.world.groundAt(this.pos.x, this.pos.z, 1e6, {});
      this.pos.y = g.hit ? g.y : hf ? hf.heightAt(this.pos.x, this.pos.z) || 0 : 0;
      this.heading = Math.atan2(hx, hz);
    } else {
      const dir = p.direction ?? 1;
      let s;
      if (p.pingpong) {
        const m = pingPong(d, this.span);
        s = this.sA + m;
        this.heading = this.track.headingAt(s) + (d % (2 * this.span) < this.span ? 0 : Math.PI);
      } else {
        s = this.sA + ((dir * d) % this.span + this.span) % this.span;
        this.heading = this.track.headingAt(s) + (dir < 0 ? Math.PI : 0);
      }
      const pt = this.track.pointAt(s, p.lateral ?? 0);
      this.pos.x = pt.x;
      this.pos.y = pt.y;
      this.pos.z = pt.z;
      this.s = s;
    }
    this.spin = time * this.speed / Math.max(0.3, this.radius);
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    for (const part of this.parts) {
      const c = part.c;
      c.x = this.pos.x + fx * part.off;
      c.z = this.pos.z + fz * part.off;
      c.y0 = this.pos.y - 0.5;
      c.y1 = this.pos.y + (p.height ?? 2.2);
    }
  }

  buildVisual() {
    const m = this.params.model || 'car';
    const g = new THREE.Group();
    if (m === 'car' || m === 'bus') {
      const bus = m === 'bus';
      const color = new THREE.Color(this.params.color || (bus ? '#ffb300' : '#e53935'));
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, bus ? 2.2 : 1.0, bus ? 7.5 : 4.2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 }),
      );
      body.position.y = bus ? 1.6 : 0.85;
      body.castShadow = true;
      g.add(body);
      if (!bus) {
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 0.8, 2.2),
          new THREE.MeshStandardMaterial({ color: '#1b2a3a', roughness: 0.1, metalness: 0.8 }),
        );
        cabin.position.set(0, 1.7, -0.3);
        g.add(cabin);
      } else {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(2.32, 0.7, 6.6),
          new THREE.MeshStandardMaterial({ color: '#16222e', roughness: 0.1, metalness: 0.7, emissive: '#223344', emissiveIntensity: 0.4 }),
        );
        win.position.set(0, 2.1, 0);
        g.add(win);
      }
      const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 });
      const zs = bus ? [-2.6, 2.6] : [-1.35, 1.35];
      for (const z of zs) {
        for (const x of [-1.1, 1.1]) {
          const w = new THREE.Mesh(wheelGeo, wheelMat);
          w.position.set(x, 0.42, z);
          g.add(w);
        }
      }
      const lightGeo = new THREE.BoxGeometry(0.5, 0.25, 0.1);
      const head = new THREE.MeshBasicMaterial({ color: '#fff6c8' });
      const tail = new THREE.MeshBasicMaterial({ color: '#ff1744' });
      const len = bus ? 3.76 : 2.11;
      for (const x of [-0.75, 0.75]) {
        const h = new THREE.Mesh(lightGeo, head);
        h.position.set(x, bus ? 1.0 : 0.95, len);
        g.add(h);
        const t = new THREE.Mesh(lightGeo, tail);
        t.position.set(x, bus ? 1.0 : 0.95, -len);
        g.add(t);
      }
    } else if (m === 'crab') {
      const shell = new THREE.MeshStandardMaterial({ color: '#ff5722', roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), shell);
      body.scale.set(1.3, 0.6, 1);
      body.position.y = 1.0;
      body.castShadow = true;
      g.add(body);
      const eyeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
      const pupil = new THREE.MeshBasicMaterial({ color: '#111' });
      for (const x of [-0.35, 0.35]) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6), shell);
        stalk.position.set(x, 1.7, 0.6);
        g.add(stalk);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), eyeMat);
        eye.position.set(x, 2.0, 0.65);
        g.add(eye);
        const pp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pupil);
        pp.position.set(x, 2.02, 0.84);
        g.add(pp);
      }
      for (const side of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), shell);
        claw.scale.set(1, 0.7, 1.4);
        claw.position.set(side * 1.6, 1.1, 0.9);
        g.add(claw);
        for (let k = 0; k < 3; k++) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.2), shell);
          leg.position.set(side * 1.3, 0.5, -0.5 + k * 0.45);
          leg.rotation.z = side * 0.9;
          g.add(leg);
        }
      }
    } else if (m === 'tumbleweed') {
      const geo = new THREE.IcosahedronGeometry(this.radius, 1);
      const mat = new THREE.MeshStandardMaterial({ color: '#a1887f', wireframe: true });
      const ball = new THREE.Mesh(geo, mat);
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(this.radius * 0.7, 0), new THREE.MeshStandardMaterial({ color: '#8d6e63', wireframe: true }));
      ball.add(inner);
      ball.position.y = this.radius;
      ball.name = 'roll';
      g.add(ball);
    } else if (m === 'cube') {
      const size = this.radius * 1.5;
      const color = new THREE.Color(this.params.color || '#00e5ff');
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshStandardMaterial({ color: '#0b0b1a', emissive: color, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.6, transparent: true, opacity: 0.88 }),
      );
      core.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size * 1.03, size * 1.03, size * 1.03)), new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(3) })));
      const inner = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.28, 0), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5) }));
      core.add(inner);
      core.position.y = size / 2 + 0.7;
      core.castShadow = true;
      core.name = 'hover';
      g.add(core);
    } else if (m === 'boulder') {
      const geo = new THREE.DodecahedronGeometry(this.radius, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const f = 0.85 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.25;
        pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
      }
      geo.computeVertexNormals();
      const ball = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: this.params.color || '#8d7b68', roughness: 0.95, flatShading: true }));
      ball.position.y = this.radius;
      ball.castShadow = true;
      ball.name = 'roll';
      g.add(ball);
    }
    this.object = g;
    return g;
  }

  syncVisual() {
    if (!this.object) return;
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.object.rotation.y = this.heading;
    const roll = this.object.getObjectByName('roll');
    if (roll) roll.rotation.x = this.spin;
    const hover = this.object.getObjectByName('hover');
    if (hover) {
      hover.rotation.set(this.spin * 0.15, this.spin * 0.35, 0);
      hover.position.y = this.radius * 0.75 + 0.7 + Math.sin(this.spin * 0.5) * 0.25;
    }
    if (this.params.model === 'crab') this.object.position.y += Math.abs(Math.sin(this.spin * 3)) * 0.15;
  }
}

// ---------------------------------------------------------------------------------------
// Apisonadora: bloque que cae y aplasta. Solo bloquea cuando está abajo.
class CrusherHazard extends Hazard {
  constructor(track, p, world) {
    super(track, p, world);
    this.s = track.sAtU(p.at);
    const pt = track.pointAt(this.s, p.lateral ?? 0);
    this.base = pt;
    this.size = p.size ?? 5;
    this.top = p.height ?? 7;
    this.period = p.period ?? 3.8;
    this.phase = p.phase ?? 0;
    this.y = this.top;
    this.shake = 0;
    this.collider = this.addCollider(this.size * 0.56, null, 'crusher');
    this.collider.x = pt.x;
    this.collider.z = pt.z;
    this.update(0);
  }

  update(time) {
    const T = this.period;
    let t = (time + this.phase * T) % T;
    const upHold = T * 0.42;
    const fall = 0.28;
    const downHold = T * 0.2;
    const rise = T - upHold - fall - downHold;
    let y;
    this.shake = 0;
    let falling = false;
    if (t < upHold) {
      y = this.top;
      if (t > upHold - 0.5) this.shake = (t - (upHold - 0.5)) / 0.5;
    } else if ((t -= upHold) < fall) {
      const k = t / fall;
      y = this.top * (1 - k * k);
      falling = true;
    } else if ((t -= fall) < downHold) {
      y = 0;
      this.justLanded = t < 0.05;
    } else {
      t -= downHold;
      y = this.top * (t / rise);
    }
    this.y = y;
    const c = this.collider;
    c.active = y < 1.7;
    c.hit = falling ? 'squash' : null;
    c.y0 = this.base.y + y - 0.2;
    c.y1 = this.base.y + y + 6;
  }

  buildVisual() {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#6d6a75', roughness: 0.85, flatShading: true });
    const block = new THREE.Mesh(new THREE.BoxGeometry(this.size, 4.2, this.size), stone);
    block.position.y = 2.1;
    block.castShadow = true;
    g.add(block);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff3d00' });
    for (const x of [-0.9, 0.9]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), eyeMat);
      eye.position.set(x, 2.6, this.size / 2 + 0.05);
      g.add(eye);
      const eye2 = eye.clone();
      eye2.position.z = -this.size / 2 - 0.05;
      g.add(eye2);
    }
    const spikeGeo = new THREE.ConeGeometry(0.35, 0.8, 6);
    spikeGeo.rotateX(Math.PI);
    const spikeMat = new THREE.MeshStandardMaterial({ color: '#9e9e9e', metalness: 0.6, roughness: 0.4 });
    const n = 3;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const sp = new THREE.Mesh(spikeGeo, spikeMat);
        sp.position.set(((i + 0.5) / n - 0.5) * this.size * 0.9, -0.35, ((j + 0.5) / n - 0.5) * this.size * 0.9);
        g.add(sp);
      }
    }
    // Cadenas
    const chainMat = new THREE.MeshStandardMaterial({ color: '#424242', metalness: 0.7, roughness: 0.5 });
    for (const x of [-this.size * 0.3, this.size * 0.3]) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 30, 6), chainMat);
      ch.position.set(x, 4.2 + 15, 0);
      g.add(ch);
    }
    this.object = g;
    return g;
  }

  syncVisual() {
    if (!this.object) return;
    const sh = this.shake * 0.12;
    this.object.position.set(
      this.base.x + (Math.random() - 0.5) * sh,
      this.base.y + this.y,
      this.base.z + (Math.random() - 0.5) * sh,
    );
    this.object.rotation.y = this.track.headingAt(this.s);
  }
}

// ---------------------------------------------------------------------------------------
// Péndulo: tronco/bola con pinchos que oscila de lado a lado de la pista.
class PendulumHazard extends Hazard {
  constructor(track, p, world) {
    super(track, p, world);
    this.s = track.sAtU(p.at);
    this.center = track.pointAt(this.s, p.lateral ?? 0);
    const i = track.indexAtS(this.s);
    this.rx = track.rx[i];
    this.rz = track.rz[i];
    this.length = p.length ?? 9;
    this.pivotY = this.center.y + (p.pivotHeight ?? 11);
    this.amp = p.amplitude ?? 1.05;
    this.period = p.period ?? 3.4;
    this.phase = p.phase ?? 0;
    this.radius = p.radius ?? 1.4;
    this.angle = 0;
    this.bob = { x: 0, y: 0, z: 0 };
    this.collider = this.addCollider(this.radius, p.hit || 'tumble', 'pendulum');
    this.halfWidth = track.halfWidth(i);
    this.update(0);
  }

  update(time) {
    this.angle = this.amp * Math.sin((time / this.period) * TAU + this.phase * TAU);
    const lx = Math.sin(this.angle) * this.length;
    const ly = -Math.cos(this.angle) * this.length;
    this.bob.x = this.center.x + this.rx * lx;
    this.bob.y = this.pivotY + ly;
    this.bob.z = this.center.z + this.rz * lx;
    const c = this.collider;
    c.x = this.bob.x;
    c.z = this.bob.z;
    c.y0 = this.bob.y - this.radius;
    c.y1 = this.bob.y + this.radius;
  }

  buildVisual() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 0.9 });
    const hw = this.halfWidth + 2.5;
    const postGeo = new THREE.CylinderGeometry(0.45, 0.55, this.pivotY - this.center.y + 1.5, 8);
    const posts = [];
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, wood);
      post.position.set(side * hw, (this.pivotY - this.center.y + 1.5) / 2, 0);
      post.castShadow = true;
      g.add(post);
      posts.push(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 1.2, 0.8, 0.8), wood);
    beam.position.y = this.pivotY - this.center.y + 0.6;
    g.add(beam);
    // Brazo oscilante
    const arm = new THREE.Group();
    arm.position.y = this.pivotY - this.center.y;
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, this.length, 6),
      new THREE.MeshStandardMaterial({ color: '#bcaaa4', roughness: 1 }),
    );
    rope.position.y = -this.length / 2;
    arm.add(rope);
    let bob;
    if (this.params.model === 'spikeball') {
      bob = new THREE.Mesh(
        new THREE.IcosahedronGeometry(this.radius, 0),
        new THREE.MeshStandardMaterial({ color: '#37474f', metalness: 0.7, roughness: 0.35, flatShading: true }),
      );
      const spikeGeo = new THREE.ConeGeometry(0.25, 0.9, 6);
      const ico = new THREE.IcosahedronGeometry(this.radius, 0).attributes.position;
      const spikeMat = new THREE.MeshStandardMaterial({ color: '#cfd8dc', metalness: 0.8, roughness: 0.3 });
      const seen = new Set();
      for (let i = 0; i < ico.count; i++) {
        const v = new THREE.Vector3(ico.getX(i), ico.getY(i), ico.getZ(i));
        const key = v.toArray().map((n) => n.toFixed(2)).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const sp = new THREE.Mesh(spikeGeo, spikeMat);
        sp.position.copy(v.clone().multiplyScalar(1.05));
        sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
        bob.add(sp);
      }
    } else {
      bob = new THREE.Mesh(new THREE.CylinderGeometry(this.radius * 0.8, this.radius * 0.8, 4.2, 12), wood);
      bob.rotation.x = Math.PI / 2;
      const ringMat = new THREE.MeshStandardMaterial({ color: '#8d6e63', roughness: 0.8 });
      for (const z of [-2.1, 2.1]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(this.radius * 0.8, 12), ringMat);
        cap.position.y = z;
        cap.rotation.x = z > 0 ? -Math.PI / 2 : Math.PI / 2;
        bob.add(cap);
      }
    }
    bob.position.y = -this.length;
    bob.castShadow = true;
    arm.add(bob);
    g.add(arm);
    this.arm = arm;
    this.object = g;
    return g;
  }

  syncVisual() {
    if (!this.object) return;
    this.object.position.set(this.center.x, this.center.y, this.center.z);
    // El eje lateral local es -X (derecha = (-cos, 0, sin)) → orientamos el grupo con el rumbo.
    this.object.rotation.y = this.track.headingAt(this.s);
    this.arm.rotation.z = -this.angle;
  }
}

// ---------------------------------------------------------------------------------------
// Barra de fuego giratoria.
class FirebarHazard extends Hazard {
  constructor(track, p, world) {
    super(track, p, world);
    this.s = track.sAtU(p.at);
    this.center = track.pointAt(this.s, p.lateral ?? 0);
    this.length = p.length ?? 7;
    this.count = p.balls ?? 5;
    this.speed = p.speed ?? 1.3;
    this.phase = p.phase ?? 0;
    this.balls = [];
    for (let k = 0; k < this.count; k++) {
      // bolas "blandas": derriban al kart sin arrastrarlo (no lo empujan fuera de la pasarela)
      this.balls.push({ x: 0, z: 0, c: this.addCollider(0.6, 'tumble', 'fire', true) });
    }
    // poste central sólido (sin golpe)
    const post = this.addCollider(0.8, null, 'post');
    post.x = this.center.x;
    post.z = this.center.z;
    post.y0 = this.center.y - 0.5;
    post.y1 = this.center.y + 1.8;
    this.angle = 0;
    this.update(0);
  }

  update(time) {
    this.angle = time * this.speed + this.phase * TAU;
    const ca = Math.cos(this.angle);
    const sa = Math.sin(this.angle);
    for (let k = 0; k < this.count; k++) {
      const d = ((k + 1) / this.count) * this.length;
      const b = this.balls[k];
      b.x = this.center.x + ca * d;
      b.z = this.center.z + sa * d;
      b.c.x = b.x;
      b.c.z = b.z;
      b.c.y0 = this.center.y + 0.2;
      b.c.y1 = this.center.y + 2.4;
    }
  }

  buildVisual() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.8, 1.6, 10),
      new THREE.MeshStandardMaterial({ color: '#3e2723', roughness: 0.9 }),
    );
    post.position.y = 0.8;
    g.add(post);
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ff9100' });
    const coreMat = new THREE.MeshBasicMaterial({ color: '#fff176' });
    const geo = new THREE.SphereGeometry(0.55, 12, 10);
    const core = new THREE.SphereGeometry(0.3, 8, 6);
    this.ballMeshes = [];
    for (let k = 0; k < this.count; k++) {
      const m = new THREE.Mesh(geo, fireMat);
      m.add(new THREE.Mesh(core, coreMat));
      g.add(m);
      this.ballMeshes.push(m);
    }
    this.object = g;
    return g;
  }

  syncVisual(time) {
    if (!this.object) return;
    this.object.position.set(this.center.x, this.center.y, this.center.z);
    for (let k = 0; k < this.count; k++) {
      const b = this.balls[k];
      const m = this.ballMeshes[k];
      m.position.set(b.x - this.center.x, 1.3, b.z - this.center.z);
      const s = 1 + Math.sin(time * 12 + k) * 0.12;
      m.scale.setScalar(s);
    }
  }
}

const TYPES = {
  mover: MoverHazard,
  crusher: CrusherHazard,
  pendulum: PendulumHazard,
  firebar: FirebarHazard,
};

export function createHazard(track, params, world) {
  const Cls = TYPES[params.type];
  if (!Cls) throw new Error(`Obstáculo desconocido: ${params.type}`);
  return new Cls(track, params, world);
}
