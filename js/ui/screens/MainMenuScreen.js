// Menú principal.
import { Screen } from './Screen.js';
import { h, button, ICONS } from '../dom.js';
import { GAME_TITLE } from '../../config.js';

export class MainMenuScreen extends Screen {
  static resetsHistory = true;

  build() {
    const g = this.game;
    const st = g.save.stats;
    const trophies = Object.values(g.save.progress.cups || {}).reduce((n, c) => n + Object.keys(c).length, 0);
    this.el.append(
      h(
        'div.menu-layout',
        h(
          'div.menu-column',
          h('div.logo.logo-small', h('span.logo-main', GAME_TITLE)),
          h(
            'nav.menu-buttons',
            button('Jugar', () => this.ui.show('play'), { icon: ICONS.play, default: true, cls: 'btn-big btn-primary', sub: 'Gran Premio · Carrera · Contrarreloj' }),
            button('Opciones', () => this.ui.show('options'), { icon: ICONS.gear, cls: 'btn-big' }),
            button('Controles', () => this.ui.show('controls'), { icon: ICONS.pad, cls: 'btn-big' }),
            button('Estadísticas', () => this.ui.show('stats'), { icon: ICONS.chart, cls: 'btn-big' }),
            button('Créditos', () => this.ui.show('credits'), { icon: ICONS.info, cls: 'btn-big' }),
          ),
          h(
            'div.menu-summary',
            h('span', `🏁 ${st.racesPlayed} carreras`),
            h('span', `🥇 ${st.racesWon} victorias`),
            h('span', `🏆 ${trophies} trofeos`),
          ),
        ),
      ),
      this.footer([
        ['↑↓', 'Elegir'],
        ['Intro', 'Aceptar'],
      ]),
    );
  }

  back() {
    this.game.showTitle();
  }
}
