// Menú de pausa.
import { Screen } from './Screen.js';
import { h, button, ICONS } from '../dom.js';

export class PauseScreen extends Screen {
  build() {
    this.keepInHistory = true;
    const g = this.game;
    const meta = g.data.track(g.config.trackId);
    this.confirm = h('div.confirm.hidden');
    this.el.append(
      h(
        'div.pause-panel',
        h('h1.pause-title', 'PAUSA'),
        h('p.pause-sub', meta.name),
        h(
          'nav.menu-buttons',
          button('Continuar', () => g.resume(), { icon: ICONS.play, default: true, cls: 'btn-primary' }),
          button('Reiniciar carrera', () => g.restartRace(), { icon: ICONS.restart }),
          button('Opciones', () => this.ui.show('options', { inRace: true }), { icon: ICONS.gear }),
          button('Controles', () => this.ui.show('controls', { inRace: true }), { icon: ICONS.pad }),
          button('Salir al menú', () => this.askQuit(), { icon: ICONS.home }),
        ),
        this.confirm,
      ),
      this.footer([['↑↓', 'Elegir'], ['Intro', 'Aceptar'], ['Esc', 'Continuar']]),
    );
  }

  askQuit() {
    this.confirm.replaceChildren(
      h('p', '¿Seguro que quieres abandonar la carrera?'),
      h('div.confirm-buttons', button('Sí, salir', () => this.game.quitToMenu(), { cls: 'btn-danger' }), button('No', () => this.hideConfirm(), { default: true })),
    );
    this.confirm.classList.remove('hidden');
    this.ui.nav.focus(this.confirm.querySelector('.focusable:last-child'));
  }

  hideConfirm() {
    this.confirm.classList.add('hidden');
    this.ui.nav.focusDefault();
  }

  back() {
    if (!this.confirm.classList.contains('hidden')) this.hideConfirm();
    else this.game.resume();
  }
}
