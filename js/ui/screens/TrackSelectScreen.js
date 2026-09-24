// Selección de circuito (carrera individual y contrarreloj).
import { Screen } from './Screen.js';
import { h } from '../dom.js';
import { drawThumb } from '../trackPreview.js';
import { formatTime } from '../../core/MathUtils.js';

export class TrackSelectScreen extends Screen {
  build() {
    const g = this.game;
    const ss = g.session;
    this.info = h('div.track-info');
    const cards = g.data.tracks.map((t) => {
      const canvas = h('canvas.track-thumb', { width: 220, height: 150 });
      drawThumb(canvas, t, '#ffffff').catch(() => {});
      const best = g.save.getBestTime(t.id);
      return h(
        'button.track-card.focusable',
        {
          type: 'button',
          'data-default': t.id === ss.trackId ? '1' : null,
          style: { '--accent': t.color, '--accent2': t.accent },
          onClick: (e) => this.touchPick(e, () => this.pick(t.id)),
          onNavfocus: () => this.preview(t.id),
        },
        canvas,
        h('span.track-name', t.name),
        h('span.track-diff', '★'.repeat(t.difficulty) + '☆'.repeat(3 - t.difficulty)),
        ss.mode === 'timetrial' && best && best.total ? h('span.track-record', `⏱ ${formatTime(best.total)}`) : null,
      );
    });
    this.el.append(
      this.header(ss.mode === 'timetrial' ? 'Contrarreloj · Circuito' : 'Elige circuito', null, this.wizardSteps('track')),
      h('div.track-layout', h('div.track-grid', ...cards), this.info),
      this.footer([['←→↑↓', 'Elegir'], ['Intro', 'Aceptar'], ['Esc', 'Volver']], this.pickButton(() => this.pick(this.selectedId))),
    );
    this.preview(ss.trackId);
  }

  onShow() {
    this.game.showcase.setMode('track');
  }

  preview(id) {
    this.selectedId = id;
    const g = this.game;
    const t = g.data.track(id);
    const best = g.save.getBestTime(t.id);
    const plays = g.save.stats.trackPlays[t.id] || 0;
    this.info.replaceChildren(
      h(
        'div.info-card',
        { style: { '--accent': t.color } },
        h('h2', t.name),
        h('p', t.description),
        h('div.track-meta', h('span', `Dificultad: ${'★'.repeat(t.difficulty)}`), h('span', `Jugado ${plays} ${plays === 1 ? 'vez' : 'veces'}`)),
        h('div.records', h('div', h('b', 'Mejor tiempo: '), best && best.total ? formatTime(best.total) : '—'), h('div', h('b', 'Mejor vuelta: '), best && best.lap ? formatTime(best.lap) : '—')),
      ),
    );
  }

  pick(id) {
    this.game.session.trackId = id;
    this.ui.show('setup');
  }
}
