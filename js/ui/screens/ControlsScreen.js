// Controles: remapeo de teclado (dos teclas por acción) e información del mando.
import { Screen } from './Screen.js';
import { h, button } from '../dom.js';
import { ACTIONS, ACTION_LABELS } from '../../config.js';
import { keyLabel } from '../../input/KeyNames.js';

const PAD = [
  ['Acelerar', 'A / RT'],
  ['Frenar / marcha atrás', 'B / LT'],
  ['Girar', 'Stick izquierdo / cruceta'],
  ['Derrape / salto', 'RB / X'],
  ['Usar objeto', 'LB / Y'],
  ['Rescate', 'Select'],
  ['Pausa', 'Start'],
];

export class ControlsScreen extends Screen {
  build() {
    this.table = h('div.controls-table');
    this.capturing = false;
    this.el.append(
      this.header('Controles', 'Haz clic en una tecla (o pulsa Intro) y después pulsa la nueva tecla. Esc cancela.'),
      h(
        'div.controls-layout',
        this.table,
        h(
          'div.info-card.pad-card',
          h('h2', '🎮 Mando'),
          h('p.small', 'Compatible con mandos estándar (Xbox, PlayStation, genéricos).'),
          ...PAD.map(([a, b]) => h('div.pad-row', h('span', a), h('kbd', b))),
          button('Restablecer teclado', () => this.reset(), { cls: 'btn-wide' }),
        ),
      ),
      this.footer([['↑↓←→', 'Elegir'], ['Intro', 'Cambiar tecla'], ['Esc', 'Volver']]),
    );
    this.render();
  }

  render() {
    const c = this.game.save.controls;
    this.table.replaceChildren(
      h('div.controls-row.head', h('span', 'Acción'), h('span', 'Tecla principal'), h('span', 'Tecla secundaria')),
      ...ACTIONS.map((a, i) =>
        h(
          'div.controls-row',
          h('span.action', ACTION_LABELS[a]),
          ...[0, 1].map((slot) =>
            h('button.key-btn.focusable', { type: 'button', 'data-default': i === 0 && slot === 0 ? '1' : null, onClick: (e) => this.capture(a, slot, e.currentTarget) }, keyLabel(c[a][slot])),
          ),
        ),
      ),
    );
  }

  capture(action, slot, btn) {
    if (this.capturing) return;
    this.capturing = true;
    btn.classList.add('capturing');
    btn.textContent = 'Pulsa una tecla…';
    // Espera un instante para no capturar la propia pulsación de Intro
    setTimeout(() => {
      this.game.input.captureNextKey((code, cancelled) => {
        this.capturing = false;
        if (!cancelled && code) {
          this.game.save.setControl(action, slot, code);
          this.game.input.setControls(this.game.save.controls);
          this.game.audio.ui('select');
        }
        this.render();
        this.ui.nav.focusDefault();
      });
    }, 120);
  }

  handleMenu() {
    return this.capturing;
  }

  reset() {
    this.game.save.resetControls();
    this.game.input.setControls(this.game.save.controls);
    this.render();
    this.ui.toast('Controles restablecidos');
  }
}
