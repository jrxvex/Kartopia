// Clase base de las pantallas de menú.
import { h, button } from '../dom.js';

export class Screen {
  constructor(ui, name) {
    this.ui = ui;
    this.game = ui.game;
    this.name = name;
    this.keepInHistory = true;
    this.el = h(`section.screen.screen-${name}`);
  }

  build() {}
  onShow() {}
  onHide() {}
  update() {}

  /** Devuelve true si consume la acción de menú. */
  handleMenu() {
    return false;
  }

  back() {
    this.ui.back();
  }

  header(title, subtitle = null, step = null) {
    return h(
      'header.screen-header',
      h('div.screen-title-wrap', h('h1.screen-heading', title), subtitle ? h('p.screen-subtitle', subtitle) : null),
      step ? h('div.steps', ...step.map((s, i) => h(`span.step${s.active ? '.active' : ''}${s.done ? '.done' : ''}`, `${i + 1}. ${s.label}`))) : null,
    );
  }

  footer(hints = [['Intro', 'Aceptar'], ['Esc', 'Volver']], ...extra) {
    // La pista de «Esc» es además un botón (ratón y pantallas táctiles)
    return h(
      'footer.screen-footer',
      ...extra,
      ...hints.map(([k, l]) =>
        k === 'Esc'
          ? h('button.hint.hint-back', { type: 'button', onClick: () => this.ui.handleMenu('back') }, h('kbd', k), h('span.hint-back-arrow', '‹'), ' ', l)
          : h('span.hint', h('kbd', k), ' ', l),
      ),
    );
  }

  /** En pantallas táctiles, el primer toque muestra la vista previa y el segundo confirma. */
  touchPick(e, fn) {
    const el = e && e.currentTarget;
    if (this.game.touch?.wanted && el && this.ui.nav.current !== el) {
      this.ui.nav.focus(el);
      return;
    }
    fn();
  }

  /** Botón para confirmar la selección con el dedo (solo visible con controles táctiles). */
  pickButton(fn, label = 'Elegir') {
    return button(`${label} ›`, fn, { cls: 'btn-pick btn-go' });
  }

  /** Pasos del asistente de selección según el modo. */
  wizardSteps(current) {
    const mode = this.game.session?.mode;
    const steps = ['Piloto', 'Kart', mode === 'grandprix' ? 'Copa' : 'Circuito', 'Reglas'];
    const idx = { character: 0, kart: 1, track: 2, cup: 2, setup: 3 }[current] ?? 0;
    return steps.map((label, i) => ({ label, active: i === idx, done: i < idx }));
  }
}
