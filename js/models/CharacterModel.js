// Personajes procedurales originales (estilo "chibi"): zorro, pingüino, oso, gata, dinosaurio,
// coneja, rana, robot, alienígena y mono. Cabeza, torso y brazos animables.
import * as THREE from 'three';
import { ModelBuilder, sharedMaterials, G } from './ModelBuilder.js';

function eyes(b, c, { spread = 0.11, y = 0.05, z = 0.245, size = 0.085, pupil = 0.045, color = null, glow = false } = {}) {
  for (const s of [-1, 1]) {
    b.add(G.sphere(size, 14, 10), 'eye', '#ffffff', { pos: [s * spread, y, z], scale: [1, 1.15, 0.7] });
    b.add(G.sphere(pupil, 12, 8), glow ? 'glow' : 'eye', color || c.eyes, { pos: [s * spread, y - 0.005, z + size * 0.6] }, glow ? 3 : 1);
    b.add(G.sphere(pupil * 0.38, 8, 6), 'glow', '#ffffff', { pos: [s * spread + 0.018, y + 0.022, z + size * 0.62 + pupil * 0.4] }, 1.2);
  }
}

function headBase(b, color, r = 0.3, sy = 0.93) {
  b.add(G.sphere(r, 22, 16), 'fur', color, { scale: [1.0, sy, 0.95] });
}

const SPECIES = {
  fox(b, c) {
    headBase(b, c.fur);
    b.add(G.sphere(0.2, 16, 12), 'fur', c.light, { pos: [0, -0.1, 0.13], scale: [1.25, 0.7, 1] });
    b.add(G.cone(0.1, 0.24, 12), 'fur', c.fur, { pos: [0, -0.04, 0.33], rot: [Math.PI / 2, 0, 0] });
    b.add(G.cone(0.075, 0.1, 10), 'fur', c.light, { pos: [0, -0.07, 0.36], rot: [Math.PI / 2, 0, 0] });
    b.add(G.sphere(0.045), 'eye', '#1a1a1a', { pos: [0, -0.02, 0.45] });
    for (const s of [-1, 1]) {
      b.add(G.cone(0.1, 0.26, 4), 'fur', c.fur, { pos: [s * 0.17, 0.3, -0.02], rot: [0, Math.PI / 4, s * -0.35] });
      b.add(G.cone(0.055, 0.15, 4), 'fur', '#2b1b12', { pos: [s * 0.175, 0.36, 0.0], rot: [0, Math.PI / 4, s * -0.35] });
    }
    eyes(b, c, { y: 0.07, z: 0.22 });
    // gafas en la frente
    b.add(G.torus(0.25, 0.03, 6, 24), 'matte', '#333', { pos: [0, 0.14, 0.02], rot: [Math.PI / 2 - 0.25, 0, 0] });
    for (const s of [-1, 1]) b.add(G.cyl(0.07, 0.07, 0.05, 14), 'glass', c.accent, { pos: [s * 0.1, 0.2, 0.24], rot: [Math.PI / 2 - 0.5, 0, 0] });
  },
  penguin(b, c) {
    headBase(b, c.fur, 0.3, 0.95);
    b.add(G.sphere(0.24, 18, 14), 'fur', c.light, { pos: [0, -0.04, 0.1], scale: [1, 0.9, 0.9] });
    b.add(G.cone(0.08, 0.2, 10), 'skin', c.accent, { pos: [0, -0.06, 0.37], rot: [Math.PI / 2, 0, 0], scale: [1.2, 1, 0.6] });
    eyes(b, c, { y: 0.05, z: 0.25, spread: 0.1 });
    b.add(G.cone(0.05, 0.14, 8), 'fur', c.fur, { pos: [0.02, 0.33, 0], rot: [0, 0, -0.3] });
    b.add(G.cone(0.04, 0.12, 8), 'fur', c.fur, { pos: [-0.04, 0.32, 0.03], rot: [0, 0, 0.4] });
  },
  bear(b, c) {
    headBase(b, c.fur, 0.31);
    b.add(G.sphere(0.13, 14, 10), 'fur', c.light, { pos: [0, -0.08, 0.24], scale: [1.2, 0.85, 1] });
    b.add(G.sphere(0.055), 'eye', '#1a1a1a', { pos: [0, -0.03, 0.36], scale: [1.3, 0.9, 1] });
    for (const s of [-1, 1]) {
      b.add(G.sphere(0.1, 12, 10), 'fur', c.fur, { pos: [s * 0.22, 0.24, -0.02] });
      b.add(G.sphere(0.06, 10, 8), 'fur', c.light, { pos: [s * 0.22, 0.24, 0.04] });
    }
    eyes(b, c, { y: 0.07, z: 0.24, spread: 0.12, size: 0.07, pupil: 0.042 });
    b.add(G.cyl(0.27, 0.3, 0.12, 20), 'paint', c.accent, { pos: [0, 0.21, -0.03], rot: [-0.25, 0, 0] });
    b.add(G.box(0.3, 0.03, 0.2), 'paint', c.accent, { pos: [0, 0.18, -0.3], rot: [-0.3, 0, 0] });
  },
  cat(b, c) {
    headBase(b, c.fur, 0.3, 0.9);
    b.add(G.sphere(0.1, 12, 10), 'fur', c.light, { pos: [0, -0.09, 0.24], scale: [1.4, 0.8, 1] });
    b.add(G.sphere(0.035), 'skin', '#ff80ab', { pos: [0, -0.04, 0.3] });
    for (const s of [-1, 1]) {
      b.add(G.cone(0.11, 0.2, 4), 'fur', c.fur, { pos: [s * 0.16, 0.28, 0], rot: [0, Math.PI / 4, s * -0.3] });
      b.add(G.cone(0.06, 0.12, 4), 'skin', '#ffb3cf', { pos: [s * 0.162, 0.28, 0.03], rot: [0, Math.PI / 4, s * -0.3] });
      for (const k of [-1, 1]) b.add(G.cyl(0.006, 0.006, 0.22, 4), 'matte', '#555', { pos: [s * 0.17, -0.07 + k * 0.02, 0.24], rot: [0, 0, Math.PI / 2 + k * 0.15 * s] });
    }
    eyes(b, c, { y: 0.06, z: 0.23, spread: 0.115, size: 0.09, pupil: 0.05 });
    b.add(G.torus(0.06, 0.03, 6, 12), 'paint', c.outfit, { pos: [0.16, 0.24, 0.12], rot: [0, 0.6, 0] });
    b.add(G.sphere(0.04), 'paint', c.outfit, { pos: [0.16, 0.24, 0.14] });
  },
  dino(b, c) {
    b.add(G.sphere(0.3, 20, 14), 'fur', c.fur, { scale: [1, 0.9, 1] });
    b.add(G.sphere(0.24, 18, 12), 'fur', c.fur, { pos: [0, -0.08, 0.2], scale: [1.05, 0.75, 1.1] });
    b.add(G.sphere(0.2, 16, 10), 'fur', c.light, { pos: [0, -0.16, 0.22], scale: [1.05, 0.5, 1.05] });
    for (const s of [-1, 1]) b.add(G.sphere(0.025), 'eye', '#1a1a1a', { pos: [s * 0.08, -0.02, 0.44] });
    eyes(b, c, { y: 0.1, z: 0.19, spread: 0.13, size: 0.08, pupil: 0.045 });
    for (let i = 0; i < 4; i++) b.add(G.cone(0.06 - i * 0.008, 0.14, 6), 'paint', c.accent, { pos: [0, 0.27 - i * 0.02, -0.02 - i * 0.12], rot: [-0.4 - i * 0.3, 0, 0] });
  },
  bunny(b, c) {
    headBase(b, c.fur, 0.3, 0.94);
    b.add(G.sphere(0.11, 12, 10), 'fur', '#ffffff', { pos: [0, -0.09, 0.23], scale: [1.4, 0.8, 1] });
    b.add(G.sphere(0.035), 'skin', '#ff6f91', { pos: [0, -0.04, 0.31] });
    b.add(G.box(0.05, 0.05, 0.02), 'eye', '#ffffff', { pos: [0, -0.14, 0.29] });
    for (const s of [-1, 1]) {
      b.add(G.capsule(0.06, 0.34, 6, 10), 'fur', c.fur, { pos: [s * 0.11, 0.46, -0.04], rot: [-0.15, 0, s * -0.18], scale: [1, 1, 0.55] });
      b.add(G.capsule(0.035, 0.28, 6, 8), 'skin', c.light, { pos: [s * 0.112, 0.46, -0.01], rot: [-0.15, 0, s * -0.18], scale: [1, 1, 0.4] });
    }
    eyes(b, c, { y: 0.05, z: 0.24, spread: 0.115, size: 0.085, pupil: 0.05 });
    b.add(G.sphere(0.06), 'paint', c.accent, { pos: [0, 0.3, 0.02], scale: [1.6, 0.7, 0.7] });
  },
  frog(b, c) {
    b.add(G.sphere(0.32, 20, 14), 'fur', c.fur, { scale: [1.15, 0.72, 0.95] });
    b.add(G.sphere(0.26, 18, 12), 'fur', c.light, { pos: [0, -0.1, 0.07], scale: [1.2, 0.5, 1] });
    b.add(G.torus(0.2, 0.012, 6, 20, Math.PI), 'matte', '#3a2a1a', { pos: [0, -0.05, 0.2], rot: [0.3, 0, Math.PI] });
    for (const s of [-1, 1]) {
      b.add(G.sphere(0.12, 14, 10), 'fur', c.fur, { pos: [s * 0.15, 0.2, 0.08] });
    }
    eyes(b, c, { y: 0.22, z: 0.17, spread: 0.15, size: 0.09, pupil: 0.05 });
    b.add(G.torus(0.3, 0.035, 6, 24), 'paint', c.accent, { pos: [0, 0.06, -0.02], rot: [Math.PI / 2, 0, 0], scale: [1.15, 0.95, 1] });
  },
  robot(b, c) {
    b.add(G.box(0.52, 0.46, 0.46, 0.1), 'metal', c.fur);
    b.add(G.box(0.42, 0.15, 0.06, 0.03), 'glass', '#101820', { pos: [0, 0.03, 0.22] });
    for (const s of [-1, 1]) {
      b.add(G.sphere(0.045), 'glow', c.eyes, { pos: [s * 0.1, 0.03, 0.25], scale: [1.4, 0.8, 0.5] }, 3.5);
      b.add(G.cyl(0.07, 0.07, 0.06, 14), 'metal', '#78909c', { pos: [s * 0.29, 0.0, 0], rot: [0, 0, Math.PI / 2] });
    }
    b.add(G.box(0.2, 0.03, 0.02), 'glow', c.accent, { pos: [0, -0.12, 0.235] }, 2);
    b.add(G.cyl(0.015, 0.015, 0.22, 6), 'metal', '#90a4ae', { pos: [0, 0.34, 0] });
    b.add(G.sphere(0.05), 'glow', c.accent, { pos: [0, 0.47, 0] }, 3);
  },
  alien(b, c) {
    b.add(G.sphere(0.33, 22, 16), 'fur', c.fur, { scale: [1.05, 1.0, 0.95] });
    b.add(G.sphere(0.18, 16, 10), 'fur', c.fur, { pos: [0, -0.18, 0.1], scale: [1, 0.8, 1] });
    for (const s of [-1, 1]) {
      b.add(G.sphere(0.11, 16, 12), 'eye', '#0b0b18', { pos: [s * 0.13, 0.02, 0.24], scale: [0.9, 1.3, 0.6], rot: [0, 0, s * 0.35] });
      b.add(G.sphere(0.025), 'glow', '#ffffff', { pos: [s * 0.13 + 0.03, 0.07, 0.3] }, 1.3);
      b.add(G.cyl(0.012, 0.012, 0.3, 6), 'fur', c.fur, { pos: [s * 0.12, 0.42, -0.02], rot: [0, 0, s * -0.35] });
      b.add(G.sphere(0.05), 'glow', c.accent, { pos: [s * 0.175, 0.56, -0.02] }, 2.5);
    }
    b.add(G.torus(0.04, 0.008, 4, 10, Math.PI), 'matte', '#402060', { pos: [0, -0.16, 0.26], rot: [0, 0, Math.PI] });
  },
  monkey(b, c) {
    headBase(b, c.fur, 0.3, 0.95);
    b.add(G.sphere(0.2, 16, 12), 'skin', c.light, { pos: [0, -0.03, 0.14], scale: [1.15, 1.0, 0.9] });
    b.add(G.sphere(0.12, 12, 10), 'skin', c.light, { pos: [0, -0.1, 0.26], scale: [1.3, 0.75, 0.8] });
    for (const s of [-1, 1]) {
      b.add(G.sphere(0.1, 12, 10), 'fur', c.fur, { pos: [s * 0.3, 0.02, 0], scale: [0.5, 1, 1] });
      b.add(G.sphere(0.065, 10, 8), 'skin', c.light, { pos: [s * 0.33, 0.02, 0.02], scale: [0.4, 1, 1] });
      b.add(G.sphere(0.018), 'eye', '#3a2210', { pos: [s * 0.03, -0.08, 0.35] });
    }
    eyes(b, c, { y: 0.05, z: 0.26, spread: 0.095, size: 0.075, pupil: 0.042 });
    b.add(G.cyl(0.27, 0.3, 0.1, 20), 'paint', c.outfit, { pos: [0, 0.2, -0.02], rot: [0.25, 0, 0] });
    b.add(G.box(0.3, 0.025, 0.2), 'paint', c.outfit, { pos: [0, 0.16, 0.26], rot: [0.2, 0, 0] });
  },
};

export class CharacterModel {
  constructor(character, handTarget = new THREE.Vector3(0, 0.34, 0.46)) {
    const c = character.colors;
    const mats = sharedMaterials();
    this.character = character;
    this.root = new THREE.Group();
    this.root.name = `char-${character.id}`;
    this.torso = new THREE.Group();
    this.root.add(this.torso);

    // Torso
    const tb = new ModelBuilder();
    const species = character.species;
    const bodyColor = species === 'penguin' ? c.fur : c.outfit;
    tb.add(G.capsule(0.19, 0.22, 6, 14), species === 'robot' ? 'metal' : 'matte', bodyColor, { pos: [0, 0.24, 0], scale: [1.1, 1, 0.9] });
    if (species === 'penguin') tb.add(G.sphere(0.17, 14, 10), 'fur', c.light, { pos: [0, 0.22, 0.08], scale: [0.95, 1.25, 0.6] });
    else tb.add(G.box(0.22, 0.14, 0.05, 0.02), 'paint', c.accent, { pos: [0, 0.26, 0.16] });
    tb.add(G.torus(0.14, 0.05, 8, 18), 'paint', species === 'penguin' ? c.outfit : c.accent, { pos: [0, 0.43, 0], rot: [Math.PI / 2, 0, 0] });
    if (species === 'penguin') tb.add(G.box(0.1, 0.22, 0.04, 0.02), 'paint', c.outfit, { pos: [0.12, 0.3, 0.16], rot: [0, 0, -0.2] });
    // colas
    if (species === 'fox') {
      tb.add(G.capsule(0.1, 0.35, 6, 10), 'fur', c.fur, { pos: [0.18, 0.15, -0.3], rot: [1.1, 0, -0.6] });
      tb.add(G.sphere(0.1, 10, 8), 'fur', c.light, { pos: [0.32, 0.36, -0.47] });
    } else if (species === 'dino') {
      tb.add(G.cone(0.14, 0.6, 10), 'fur', c.fur, { pos: [0, 0.1, -0.42], rot: [-1.4, 0, 0] });
    } else if (species === 'monkey') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, -0.18), new THREE.Vector3(0.1, 0.2, -0.45), new THREE.Vector3(0.25, 0.5, -0.45), new THREE.Vector3(0.2, 0.62, -0.3)]);
      tb.add(new THREE.TubeGeometry(curve, 16, 0.035, 6), 'fur', c.fur);
    } else if (species === 'cat') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, -0.18), new THREE.Vector3(-0.15, 0.25, -0.45), new THREE.Vector3(-0.1, 0.6, -0.5)]);
      tb.add(new THREE.TubeGeometry(curve, 16, 0.04, 6), 'fur', c.fur);
    }
    this.torso.add(tb.build(mats));

    // Cabeza
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.46, 0.02);
    this.torso.add(this.headPivot);
    const hb = new ModelBuilder();
    (SPECIES[species] || SPECIES.fox)(hb, c);
    this.head = hb.build(mats);
    this.head.position.set(0, 0.27, 0.02);
    this.headPivot.add(this.head);

    // Brazos (del hombro al volante)
    this.arms = [];
    const armColor = species === 'robot' ? c.fur : species === 'penguin' ? c.fur : c.outfit;
    const handColor = species === 'robot' ? '#90a4ae' : ['frog', 'dino', 'alien'].includes(species) ? c.fur : species === 'penguin' ? c.fur : c.light;
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.2, 0.38, 0.02);
      this.torso.add(shoulder);
      const ab = new ModelBuilder();
      ab.add(G.capsule(0.06, 0.28, 4, 8), 'matte', armColor, { pos: [0, 0, 0.17], rot: [Math.PI / 2, 0, 0] });
      ab.add(G.sphere(0.075, 10, 8), 'skin', handColor, { pos: [0, 0, 0.36] });
      const arm = ab.build(mats);
      shoulder.add(arm);
      this.arms.push({ side: s, shoulder, arm });
    }
    this.handTarget = handTarget.clone();
    this.wheelRadius = 0.15;
    this.anim = { t: 0, bounce: 0, victory: 0, hurt: 0 };
    this._v = new THREE.Vector3();
    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.updateArms(0);
  }

  updateArms(steer) {
    const ang = steer * 1.2;
    this.torso.updateMatrix();
    const inv = (this._inv = this._inv || new THREE.Matrix4()).copy(this.torso.matrix).invert();
    const Z = (this._z = this._z || new THREE.Vector3(0, 0, 1));
    for (const a of this.arms) {
      // mano sobre el aro del volante, rotando con la dirección
      const ang2 = a.side * 0.9 - ang;
      this._v.set(Math.sin(ang2) * this.wheelRadius, Math.cos(ang2) * this.wheelRadius * 0.6 - 0.02, 0);
      this._v.add(this.handTarget);
      if (this.anim.victory > 0.5) this._v.set(a.side * 0.38, 1.0, 0.12);
      // al espacio del torso y orientación del hombro hacia la mano
      this._v.applyMatrix4(inv).sub(a.shoulder.position);
      const len = this._v.length();
      a.shoulder.quaternion.setFromUnitVectors(Z, this._v.normalize());
      a.arm.scale.set(1, 1, Math.min(1.3, Math.max(0.6, len / 0.36)));
    }
  }

  animate(dt, { steer = 0, speed = 0, hurt = false, victory = false, air = false, drift = 0, time = 0 }) {
    const a = this.anim;
    a.t += dt;
    a.victory = victory ? Math.min(1, a.victory + dt * 3) : Math.max(0, a.victory - dt * 3);
    a.hurt = hurt ? Math.min(1, a.hurt + dt * 5) : Math.max(0, a.hurt - dt * 3);
    const lean = -steer * 0.16 - drift * 0.12;
    this.torso.rotation.z += (lean - this.torso.rotation.z) * Math.min(1, dt * 8);
    this.torso.rotation.x = -Math.min(0.15, speed * 0.004) + (air ? -0.1 : 0);
    this.headPivot.rotation.y += (-steer * 0.35 - this.headPivot.rotation.y) * Math.min(1, dt * 6);
    this.headPivot.rotation.z = a.hurt * Math.sin(a.t * 30) * 0.3 + a.victory * Math.sin(a.t * 6) * 0.15;
    this.headPivot.rotation.x = a.victory * -0.2;
    this.torso.position.y = Math.abs(Math.sin(a.t * 14)) * Math.min(0.02, speed * 0.0008) + a.victory * Math.abs(Math.sin(a.t * 5)) * 0.08;
    this.updateArms(steer);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}
