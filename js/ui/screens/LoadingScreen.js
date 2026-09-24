// Pantalla de carga del circuito con consejos.
import { Screen } from './Screen.js';
import { h } from '../dom.js';

const TIPS = [
  'Mantén pulsado Derrape mientras giras para cargar el mini-turbo: azul, naranja y ¡morado!',
  'Pulsa el acelerador justo cuando aparezca el "2" de la cuenta atrás para una salida turbo.',
  'Pulsa Derrape al salir de una rampa para hacer un truco y ganar un impulso al aterrizar.',
  'Mantén pulsado el botón de objeto con una Trampa Pegajosa para llevarla detrás como escudo.',
  'Mantén atrás al lanzar un Orbe Pulso o una Bomba para dispararlos hacia atrás.',
  'Los turbos ignoran la penalización de la hierba: úsalos para tomar atajos.',
  'Los karts pesados empujan más fuerte; los ligeros aceleran antes.',
  'Si te quedas atascado, pulsa R para pedir ayuda al dron de rescate.',
  'En la última vuelta la música se acelera... ¡no te relajes!',
  'La tracción reduce la pérdida de velocidad fuera de la pista.',
];

export class LoadingScreen extends Screen {
  build({ meta, config }) {
    this.keepInHistory = false;
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    const modeName = { grandprix: 'Gran Premio', single: 'Carrera individual', timetrial: 'Contrarreloj' }[config.mode] || '';
    let extra = '';
    if (config.mode === 'grandprix' && this.game.session?.gp) {
      const gp = this.game.session.gp;
      extra = ` · Carrera ${gp.index + 1} de ${gp.tracks.length}`;
    }
    this.el.style.setProperty('--accent', meta.color);
    this.el.style.setProperty('--accent2', meta.accent);
    this.el.append(
      h(
        'div.loading-wrap',
        h('div.loading-mode', modeName + extra),
        h('h1.loading-title', meta.name),
        h('p.loading-desc', meta.description),
        h('div.loading-spinner', h('span'), h('span'), h('span')),
        h('p.loading-tip', h('b', 'Consejo: '), tip),
      ),
    );
  }
}
