// Hook de resolución de módulos para ejecutar el código del juego en Node (herramientas de
// desarrollo): mapea 'three' y 'three/addons/' a la copia local en vendor/.
const THREE_URL = new URL('../vendor/three/build/three.module.min.js', import.meta.url).href;
const ADDONS_URL = new URL('../vendor/three/addons/', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: THREE_URL, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) {
    return { url: ADDONS_URL + specifier.slice('three/addons/'.length), shortCircuit: true };
  }
  return next(specifier, context);
}
