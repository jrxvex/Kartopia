// Selección de copa para el Gran Premio.
import { Screen } from './Screen.js';
import { h } from '../dom.js';
import { drawThumb } from '../trackPreview.js';
import { DIFFICULTY_ORDER } from '../../config.js';

const TROPHY = { gold: '🥇', silver: '🥈', bronze: '🥉' };

export class CupSelectScreen extends Screen {
  build() {
    const g = this.game;
    const ss = g.session;
    const cards = g.data.cups.map((cup) => {
      const thumbs = cup.tracks.map((id) => {
        const c = h('canvas.cup-thumb', { width: 90, height: 64 });
        drawThumb(c, g.data.track(id), '#ffffff').catch(() => {});
        return h('div.cup-track', c, h('span', g.data.track(id).name));
      });
      const trophies = DIFFICULTY_ORDER.map((d) => {
        const t = g.save.getCupTrophy(cup.id, d);
        return h(`span.cup-trophy${t ? '.won' : ''}`, { title: g.data.difficultyPreset(d).cc }, t ? TROPHY[t] : '·', h('small', g.data.difficultyPreset(d).cc));
      });
      return h(
        'button.cup-card.focusable',
        { type: 'button', 'data-default': cup.id === ss.cupId ? '1' : null, style: { '--accent': cup.color }, onClick: () => this.pick(cup.id) },
        h('span.cup-name', cup.name),
        h('span.cup-count', `${cup.tracks.length} carreras`),
        h('div.cup-tracks', ...thumbs),
        h('div.cup-trophies', ...trophies),
      );
    });
    this.el.append(this.header('Elige copa', null, this.wizardSteps('cup')), h('div.cup-grid', ...cards), this.footer([['←→', 'Elegir'], ['Intro', 'Aceptar'], ['Esc', 'Volver']]));
  }

  onShow() {
    this.game.showcase.setMode('track');
  }

  pick(id) {
    this.game.session.cupId = id;
    this.ui.show('setup');
  }
}
