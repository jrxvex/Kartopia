// Selección de personaje con vista previa 3D y estadísticas combinadas con el kart actual.
import { Screen } from './Screen.js';
import { h, statBar } from '../dom.js';
import { combineStats } from '../../race/Kart.js';

export const STAT_LABELS = [
  ['speed', 'Velocidad'],
  ['accel', 'Aceleración'],
  ['weight', 'Peso'],
  ['handling', 'Manejo'],
  ['traction', 'Tracción'],
  ['miniTurbo', 'Mini-turbo'],
];

export function statsPanel(stats, color) {
  return h('div.stats-panel', ...STAT_LABELS.map(([k, label]) => statBar(label, stats[k], 10, color)));
}

export class CharacterSelectScreen extends Screen {
  build() {
    const g = this.game;
    const ss = g.session;
    this.info = h('div.select-info');
    const tiles = g.data.characters.map((c) =>
      h(
        'button.char-tile.focusable',
        {
          type: 'button',
          'data-default': c.id === ss.character ? '1' : null,
          'data-id': c.id,
          style: { '--accent': c.colors.outfit },
          onClick: (e) => this.touchPick(e, () => this.pick(c.id)),
          onNavfocus: () => this.preview(c.id),
        },
        h('img.char-portrait', { src: g.portraits[c.id] || '', alt: c.name, draggable: 'false' }),
        h('span.char-name', c.name),
      ),
    );
    this.el.append(
      this.header('Elige piloto', null, this.wizardSteps('character')),
      h('div.select-layout', h('div.char-grid', ...tiles), this.info),
      this.footer([['←→↑↓', 'Elegir'], ['Intro', 'Aceptar'], ['Esc', 'Volver']], this.pickButton(() => this.pick(this.selectedId))),
    );
    this.preview(ss.character);
  }

  onShow() {
    this.game.showcase.setMode('select');
  }

  preview(id) {
    this.selectedId = id;
    const g = this.game;
    const c = g.data.character(id);
    const kart = g.data.kart(g.session.kart);
    g.showcase.setSelection(c.id, kart.id);
    this.info.replaceChildren(
      h('div.info-card', { style: { '--accent': c.colors.outfit } }, h('h2', c.name), h('span.badge', `Peso ${c.weightClass}`), h('p', c.description), statsPanel(combineStats(c, kart), c.colors.outfit), h('p.small', `Con el kart «${kart.name}»`)),
    );
  }

  pick(id) {
    this.game.session.character = id;
    this.ui.show('kart');
  }
}
