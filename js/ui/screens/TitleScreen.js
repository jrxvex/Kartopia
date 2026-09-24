// Pantalla de título.
import { Screen } from './Screen.js';
import { h } from '../dom.js';
import { GAME_TITLE, GAME_SUBTITLE } from '../../config.js';

export class TitleScreen extends Screen {
  static resetsHistory = true;

  build() {
    this.keepInHistory = false;
    this.el.append(
      h(
        'div.title-wrap',
        h('div.logo', h('span.logo-main', GAME_TITLE), h('span.logo-sub', GAME_SUBTITLE)),
        h('div.press-start.focusable', { 'data-default': '1', onClick: () => this.start(), tabindex: '0' }, 'Pulsa cualquier tecla o haz clic para empezar'),
        h('p.title-note', 'Juego original de karts · HTML5 · WebGL · Web Audio'),
      ),
    );
    this.el.addEventListener('click', () => this.start());
    this.started = false;
  }

  handleMenu() {
    this.start();
    return true;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.game.audio.unlock();
    this.game.audio.ui('start');
    this.game.showMainMenu();
  }
}
