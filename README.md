# Kartopia · Turbo Grand Prix

Juego de carreras de karts en 3D hecho con **HTML, CSS y JavaScript** (módulos ES) y
**Three.js**. No necesita compilación ni dependencias externas: todo el código, la librería
gráfica y las fuentes están incluidos en el proyecto. Los modelos, texturas, música y efectos
de sonido se generan por código, así que no hay recursos con derechos de autor.

- 8 circuitos completos, cada uno en su propio archivo
- 10 personajes y 8 karts con estadísticas distintas
- 11 objetos: proyectiles, trampas, turbos, escudos, objetos de área y de remontada
- Gran Premio (3 copas), carrera individual y contrarreloj con fantasma
- IA con 4 niveles de dificultad (50cc, 100cc, 150cc y 200cc)
- Música y efectos generados en tiempo real con Web Audio
- Guardado automático en `localStorage`: opciones, controles, récords, trofeos y estadísticas

## Cómo ejecutarlo

El juego usa módulos ES y carga datos con `fetch`, así que **hay que servirlo con un servidor
local**: abrir `index.html` con doble clic no funciona. Desde la carpeta del proyecto, usa
cualquiera de estas opciones:

```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve -l 8080 .
```

Después abre <http://localhost:8080> en un navegador actual con WebGL 2 (Chrome, Edge, Firefox
o Safari 16 o posterior).

## Controles

| Acción | Teclado | Mando |
| --- | --- | --- |
| Acelerar | `W` / `↑` | A (Cruz) o gatillo derecho |
| Frenar / marcha atrás | `S` / `↓` | B (Círculo) o gatillo izquierdo |
| Girar | `A` `D` / `←` `→` | Stick izquierdo o cruceta |
| Derrape / salto | `Espacio` | RB o X (Cuadrado) |
| Usar objeto | `Shift` | LB o Y (Triángulo) |
| Mirar atrás | `C` | — |
| Rescate manual | `R` | Select |
| Pausa | `Esc` / `P` | Start |

Todas las teclas se pueden cambiar en **Opciones → Controles**. Los menús se manejan con
teclado, ratón o mando.

### Técnicas de conducción

- **Salida turbo:** empieza a mantener acelerar en la segunda mitad del «2» de la cuenta
  atrás. Si lo mantienes demasiado pronto, el motor se ahoga.
- **Derrape y mini-turbo:** mantén el botón de derrape mientras giras. Las chispas pasan de
  azul a naranja y después a morado. Al soltar el botón obtienes un impulso más largo cuanto
  mayor sea el nivel.
- **Trucos:** pulsa derrape justo al despegar de una rampa y recibirás un turbo al aterrizar.
- **Objetos:** mantén el botón de objeto para llevar una trampa detrás como escudo. Mantén
  frenar al usarlo para lanzar el orbe hacia atrás.
- **Paneles turbo y atajos:** los paneles dan un impulso y los atajos (barro, arena, callejones,
  pasarelas) acortan el recorrido; con un turbo compensan la pérdida de velocidad.

## Modos de juego

- **Gran Premio:** 4 carreras por copa con puntos (15-12-10-8-6-4-2-1), podio final y trofeos.
  - Copa Hoja: Valle Verde, Ruinas del Desierto, Resort Oceánico y Templo del Bosque.
  - Copa Rayo: Ciudad Neón, Montaña Celeste, Castillo de Lava y Circuito Cibernético.
  - Copa Suprema: los 8 circuitos seguidos.
- **Carrera individual:** eliges circuito, dificultad, vueltas, número de rivales y frecuencia
  de objetos.
- **Contrarreloj:** sin rivales, con tres turbos y un fantasma de tu mejor vuelta.

## Circuitos

| Circuito | Lo más destacado |
| --- | --- |
| Valle Verde | Colinas, molinos, puente de madera, salto sobre el río y atajo embarrado junto al lago |
| Ciudad Neón | Ocho nocturno con paso elevado, tráfico, chicane, callejón en obras y rascacielos iluminados |
| Ruinas del Desierto | Avenida de columnas, cañón de roca, salto sobre la garganta de un río, pasarela del oasis y túnel del templo |
| Montaña Celeste | Subida en herradura, galería de la cumbre, cresta con salto, placa de hielo y precipicio sobre las nubes |
| Resort Oceánico | Paseo marítimo al atardecer, muelle con salto a la isla del faro, atajo por la colina y cangrejos |
| Castillo de Lava | Foso y lago de lava sin barandillas, barras de fuego, volcán y gran salón con apisonadoras |
| Circuito Cibernético | Pista flotante de neón, peraltes extremos, hélice de vuelta y media, cubos de datos y salto al vacío |
| Templo del Bosque | Puente colgante, pasadizo del templo, péndulos de pinchos y troncos, tronco hueco y cascada |

## Objetos

| Objeto | Tipo | Efecto |
| --- | --- | --- |
| Turbo / Triple Turbo | Turbo | Impulso instantáneo que ignora la penalización fuera de pista |
| Orbe Pulso | Proyectil | Viaja recto y rebota en los muros; se puede lanzar hacia atrás |
| Orbe Rastreador | Proyectil | Persigue al rival que va justo delante |
| Trampa Pegajosa | Trampa | Hace trompear a quien la pisa; se puede llevar detrás como defensa |
| Burbuja Escudo | Escudo | Bloquea un impacto durante 10 segundos |
| Guardia Orbital | Defensivo | Tres cristales orbitan a tu alrededor y se pueden disparar |
| Onda Helada | Ralentización | Congela a todos los rivales que van por delante |
| Bomba Estallido | Área | Se lanza en parábola y explota en un radio amplio |
| Cometa Veloz | Remontada | Piloto automático a gran velocidad que arrolla a los rivales |
| Aura Prisma | Remontada | Invencibilidad y velocidad extra, incluso fuera de pista |

Los objetos que salen de las cajas dependen de tu posición: los últimos reciben objetos más
potentes.

## Estructura del proyecto

```
index.html              Página única: lienzos, capas de interfaz y mapa de importación
css/                    Estilos: base y pantalla de carga, menús y HUD
data/                   JSON: personajes, karts, objetos, dificultades, circuitos y música
assets/                 Fuentes (licencia OFL), iconos SVG de objetos y favicon
vendor/three/           Three.js r186 (licencia MIT) y los complementos de postprocesado
js/main.js              Arranque: comprueba WebGL, carga datos y crea el juego
js/config.js            Constantes de física, calidad gráfica, controles y puntuación
js/core/                Bucle de paso fijo, eventos, guardado, datos y la clase Game
js/input/               InputManager: teclado, mando, reasignación de teclas
js/physics/             Superficies, mundo de colisión y física arcade del kart
js/track/               Spline, constructor lógico, terreno, línea de carrera, obstáculos y render
js/tracks/              Un archivo por circuito y utilidades comunes
js/race/                Kart, controladores del jugador y de la IA, RaceManager y fantasma
js/items/               Sistema de objetos, cajas, registro y un archivo por objeto
js/render/              Renderizador, cielo, materiales, partículas, cámara y vista de carrera
js/models/              Modelos procedurales de karts, personajes, decoración y objetos
js/audio/               Sintetizador, secuenciador musical, efectos y motores
js/ui/                  Interfaz: pantallas de menú, HUD, minimapa y navegación
tools/                  Herramientas de desarrollo en Node (simulación y análisis)
```

### Clases principales

- `Game` (`js/core/Game.js`): estados del juego, sesiones de GP, carreras y guardado.
- `RaceManager` (`js/race/RaceManager.js`): cuenta atrás, vueltas, checkpoints, posiciones y resultados.
- `Kart`, `PlayerController`, `AIController`: entidad del kart y quién lo conduce.
- `KartPhysics` (`js/physics/KartPhysics.js`): aceleración, derrape, mini-turbos, saltos,
  rampas, control aéreo, pendientes, muros, colisiones entre karts y rescate.
- `Track` y `buildTrack` (`js/track/`): muestreo del trazado, colisión y progreso.
- `ItemSystem` y `Item` (`js/items/`): reparto, uso y comportamiento de los objetos.
- `CameraController`, `ParticleManager`, `RaceView` (`js/render/`): cámara, efectos y escena.
- `AudioManager` (`js/audio/`): música, motores con volumen según la velocidad y efectos.
- `UIManager` y `HUD` (`js/ui/`): menús y datos de carrera en pantalla.

## Cómo ampliarlo

**Añadir un circuito:** crea `js/tracks/miCircuito.js` exportando la definición: puntos de
control `[x, y, z, {w, bank}]`, secciones (muros, puentes, túneles, superficies), rampas,
huecos, paneles turbo, cajas, atajos, terreno, tema visual, obstáculos, decoración con
`props(api)` y monumentos con `landmarks(kit)`. Después regístralo en `data/tracks.json`
(y, si quieres, añádelo a una copa). Los ocho circuitos incluidos sirven de ejemplo.

**Añadir un objeto:** crea una clase en `js/items/types/` que herede de `Item`, regístrala en
`js/items/ItemRegistry.js` junto con su heurística para la IA y añade su entrada (con las
probabilidades por posición) a `data/items.json`.

**Añadir un personaje o un kart:** añade una entrada en `data/characters.json` o
`data/karts.json` con sus colores y estadísticas.

## Herramientas de desarrollo

Requieren Node.js 20.6 o posterior y se ejecutan desde la raíz del proyecto:

```bash
# Simula carreras completas con 8 karts controlados por la IA (sin gráficos)
node --import ./tools/register.mjs tools/simulate.mjs all normal 3

# Analiza la geometría (curvas, pendientes, solapes, saltos, atajos) y genera mapas SVG
node --import ./tools/register.mjs tools/trackcheck.mjs all mapas/
```

Parámetros de URL útiles para probar:
`?quick=neon-city&difficulty=hard&laps=1&skipIntro&autopilot&timescale=2`

## Rendimiento y resoluciones

En **Opciones → Gráficos** se elige la calidad (baja, media, alta o ultra), que ajusta la
resolución interna, las sombras, el bloom, las partículas, la vegetación y las luces dinámicas.
También se pueden cambiar por separado las sombras, el resplandor (bloom), la escala de
resolución, las líneas de velocidad y el contador de FPS. La interfaz se adapta a 1366×768, 1920×1080, 2560×1440 y a pantallas
ultrapanorámicas: el HUD se mantiene dentro de una zona segura de 21:9.

## Licencias

- Código del juego: original de este proyecto.
- [Three.js](https://threejs.org): licencia MIT (`vendor/three/LICENSE`).
- Fuentes Lilita One y Nunito: SIL Open Font License (`assets/fonts/OFL-*.txt`).
- Modelos, texturas, música y efectos: generados por código en tiempo de ejecución.
