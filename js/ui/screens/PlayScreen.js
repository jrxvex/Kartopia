// Selección de modo de juego.
import { Screen } from './Screen.js';
import { h, ICONS } from '../dom.js';

const MODES = [
  { id: 'grandprix', name: 'Gran Premio', icon: ICONS.trophy, desc: 'Cuatro u ocho carreras seguidas contra 7 rivales. Suma puntos y gana el trofeo de la copa.', color: 'var(--c-gold)' },
  { id: 'single', name: 'Carrera individual', icon: ICONS.flag, desc: 'Elige circuito, dificultad, vueltas y rivales para una carrera suelta.', color: 'var(--c-blue)' },
  { id: 'timetrial', name: 'Contrarreloj', icon: ICONS.clock, desc: 'Corre en solitario con tres turbos. Bate tus récords y compite contra tu fantasma.', color: 'var(--c-green)' },
];

export class PlayScreen extends Screen {
  build() {
    const cards = MODES.map((m, i) =>
      h(
        'button.mode-card.focusable',
        { type: 'button', 'data-default': i === 0 ? '1' : null, style: { '--accent': m.color }, onClick: () => this.pick(m.id) },
        h('span.mode-icon', { html: m.icon }),
        h('span.mode-name', m.name),
        h('span.mode-desc', m.desc),
      ),
    );
    this.el.append(this.header('Jugar', 'Elige un modo de juego'), h('div.mode-grid', ...cards), this.footer([['←→', 'Elegir'], ['Intro', 'Aceptar'], ['Esc', 'Volver']]));
  }

  onShow() {
    this.game.showcase.setMode('menu');
  }

  pick(mode) {
    this.game.newSession(mode);
    this.ui.show('character');
  }
}
