// Selección de kart.
import { Screen } from './Screen.js';
import { h } from '../dom.js';
import { combineStats } from '../../race/Kart.js';
import { statsPanel } from './CharacterSelectScreen.js';

const BODY_ICONS = {
  standard: '🏎️',
  speedster: '🚀',
  buggy: '🛻',
  tank: '🚜',
  feather: '🪶',
  retro: '🚗',
  sport: '⚡',
  tub: '🛁',
};

export class KartSelectScreen extends Screen {
  build() {
    const g = this.game;
    const ss = g.session;
    const c = g.data.character(ss.character);
    this.info = h('div.select-info');
    const tiles = g.data.karts.map((k) =>
      h(
        'button.kart-tile.focusable',
        {
          type: 'button',
          'data-default': k.id === ss.kart ? '1' : null,
          style: { '--accent': c.colors.outfit },
          onClick: () => this.pick(k.id),
          onNavfocus: () => this.preview(k.id),
        },
        h('span.kart-icon', BODY_ICONS[k.body] || '🏎️'),
        h('span.kart-name', k.name),
      ),
    );
    this.el.append(
      this.header('Elige kart', null, this.wizardSteps('kart')),
      h('div.select-layout', h('div.kart-grid', ...tiles), this.info),
      this.footer([['←→↑↓', 'Elegir'], ['Intro', 'Aceptar'], ['Esc', 'Volver']]),
    );
    this.preview(ss.kart);
  }

  onShow() {
    this.game.showcase.setMode('select');
  }

  preview(id) {
    const g = this.game;
    const c = g.data.character(g.session.character);
    const k = g.data.kart(id);
    g.showcase.setSelection(c.id, k.id);
    const mods = Object.entries(k.stats)
      .filter(([, v]) => v !== 0)
      .map(([key, v]) => h(`span.mod${v > 0 ? '.up' : '.down'}`, `${v > 0 ? '+' : ''}${v} ${modLabel(key)}`));
    this.info.replaceChildren(
      h('div.info-card', { style: { '--accent': c.colors.outfit } }, h('h2', k.name), h('p', k.description), h('div.mods', ...(mods.length ? mods : [h('span.mod', 'Sin modificadores')])), statsPanel(combineStats(c, k), c.colors.outfit), h('p.small', `Pilotado por ${c.name}`)),
    );
  }

  pick(id) {
    const ss = this.game.session;
    ss.kart = id;
    this.ui.show(ss.mode === 'grandprix' ? 'cup' : 'track');
  }
}

function modLabel(k) {
  return { speed: 'velocidad', accel: 'aceleración', weight: 'peso', handling: 'manejo', traction: 'tracción', miniTurbo: 'mini-turbo' }[k] || k;
}
