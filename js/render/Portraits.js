// Retratos de los personajes renderizados desde sus modelos 3D (para menús, HUD y resultados).
import * as THREE from 'three';
import { CharacterModel } from '../models/CharacterModel.js';

export function generatePortraits(renderer, characters, size = 192) {
  const out = {};
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#ffffff', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 1.9);
  key.position.set(1.2, 2, 2.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9ad7ff', 1.2);
  rim.position.set(-2, 1.5, -1.5);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0.35, 0.95, 1.75);
  camera.lookAt(0, 0.72, 0);
  for (const ch of characters) {
    try {
      const model = new CharacterModel(ch);
      model.root.rotation.y = 0.35;
      model.headPivot.rotation.y = 0.1;
      model.animate(0, { steer: 0, speed: 0 });
      scene.add(model.root);
      out[ch.id] = renderer.renderToDataURL(scene, camera, size, size);
      scene.remove(model.root);
      model.dispose();
    } catch (e) {
      console.warn('[Portraits] error con', ch.id, e);
      out[ch.id] = '';
    }
  }
  return out;
}
