// Punto de entrada: comprueba WebGL, carga datos y fuentes, crea el juego y muestra el título.
import { DataStore } from './core/DataStore.js';
import { Game } from './core/Game.js';

const fill = document.getElementById('boot-fill');
const text = document.getElementById('boot-text');
const bootEl = document.getElementById('boot');

function progress(p, msg) {
  if (fill) fill.style.width = `${Math.round(p * 100)}%`;
  if (text && msg) text.textContent = msg;
}

function fatal(msg, err) {
  console.error(msg, err);
  if (text) {
    text.innerHTML = `<strong>No se pudo iniciar el juego.</strong><br>${msg}`;
    text.classList.add('boot-error');
  }
}

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (e) {
    return false;
  }
}

async function boot() {
  if (location.protocol === 'file:') {
    fatal('Abre el juego desde un servidor local (por ejemplo: <code>python -m http.server</code>) en lugar de hacer doble clic en index.html.');
    return;
  }
  if (!hasWebGL2()) {
    fatal('Tu navegador o tarjeta gráfica no soporta WebGL 2.');
    return;
  }
  try {
    progress(0.05, 'Cargando fuentes…');
    try {
      await Promise.race([
        Promise.all([document.fonts.load('32px "Lilita One"'), document.fonts.load('700 16px "Nunito"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) {
      /* fuentes opcionales */
    }
    progress(0.15, 'Cargando datos…');
    const data = await DataStore.load('./');
    const game = new Game({
      data,
      canvas: document.getElementById('game-canvas'),
      fxCanvas: document.getElementById('fx-canvas'),
      uiRoot: document.getElementById('ui-root'),
      hudRoot: document.getElementById('hud'),
    });
    window.__kartopia = game;
    await game.init(progress);
    progress(1, '¡Listo!');
    bootEl.classList.add('boot-hide');
    setTimeout(() => bootEl.remove(), 600);
    const params = new URLSearchParams(location.search);
    if (params.get('timescale')) game.setTimeScale(Number(params.get('timescale')));
    if (params.get('quick')) {
      game.quickRace(params.get('quick'), {
        mode: params.get('mode') || 'single',
        difficulty: params.get('difficulty') || 'normal',
        character: params.get('character') || undefined,
        kart: params.get('kart') || undefined,
        laps: Number(params.get('laps') || 3),
        skipIntro: params.has('skipIntro'),
        autopilot: params.has('autopilot'),
      });
    } else {
      game.showTitle();
    }
  } catch (err) {
    fatal(err && err.message ? err.message : String(err), err);
  }
}

boot();
