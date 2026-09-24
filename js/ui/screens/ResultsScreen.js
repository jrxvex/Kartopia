// Resultados de carrera: clasificación, tiempos, puntos del Gran Premio y récords.
import { Screen } from './Screen.js';
import { h, button, ICONS } from '../dom.js';
import { formatTime } from '../../core/MathUtils.js';

export class ResultsScreen extends Screen {
  build(summary) {
    this.keepInHistory = false;
    const g = this.game;
    const { mode, results, player } = summary;
    const meta = g.data.track(summary.trackId);
    const title = mode === 'timetrial' ? 'Contrarreloj' : player ? `¡Has quedado ${player.position}º!` : 'Resultados';
    const table = h(
      'div.results-table',
      h('div.results-row.head', h('span', 'Pos.'), h('span', 'Piloto'), h('span', 'Tiempo'), h('span', 'Mejor vuelta'), mode === 'grandprix' ? h('span', 'Puntos') : h('span', 'Kart')),
      ...results.map((r, i) =>
        h(
          `div.results-row${r.isPlayer ? '.me' : ''}`,
          { style: { animationDelay: `${i * 0.06}s` } },
          h('span.pos', `${r.position}º`),
          h('span.who', h('img.char-portrait.tiny', { src: g.portraits[r.characterId] || '', alt: '' }), r.name),
          h('span.time', `${r.estimated ? '~' : ''}${formatTime(r.time * 1000)}`),
          h('span.lap', Number.isFinite(r.bestLap) ? formatTime(r.bestLap * 1000) : '—'),
          mode === 'grandprix' ? h('span.pts', `+${r.points}`) : h('span.kart', g.data.kart(r.kartId).name),
        ),
      ),
    );
    const blocks = [table];
    if (mode === 'timetrial' && player) {
      const rec = summary.newRecord || {};
      const prev = summary.previousBest;
      blocks.unshift(
        h(
          'div.tt-summary',
          rec.total ? h('div.record-flash', '¡NUEVO RÉCORD!') : null,
          h('div.tt-big', formatTime(player.time * 1000)),
          h('div.tt-laps', ...player.lapTimes.map((t, i) => h(`span${Math.abs(t - player.bestLap) < 1e-6 ? '.best' : ''}`, `V${i + 1}: ${formatTime(t * 1000)}`))),
          prev && prev.total ? h('div.small', `Récord anterior: ${formatTime(prev.total)}`) : null,
          rec.lap ? h('div.small.good', '¡Nueva mejor vuelta!') : null,
          rec.total ? h('div.small.good', 'Fantasma guardado para la próxima vez.') : null,
        ),
      );
    }
    if (mode === 'grandprix' && summary.gp) {
      const gp = summary.gp;
      const sorted = [...gp.standings].sort((a, b) => b.points - a.points);
      blocks.push(
        h(
          'div.standings',
          h('h3', `Clasificación general · Carrera ${gp.index + 1}/${gp.tracks.length}`),
          ...sorted.map((r, i) =>
            h(
              `div.standing-row${r.isPlayer ? '.me' : ''}`,
              { style: { animationDelay: `${0.4 + i * 0.06}s` } },
              h('span.pos', `${i + 1}º`),
              h('img.char-portrait.tiny', { src: g.portraits[r.characterId] || '', alt: '' }),
              h('span.name', r.name),
              h('span.bar', h('span.fill', { style: { width: `${(r.points / Math.max(1, sorted[0].points)) * 100}%` } })),
              h('span.pts', `${r.points}`),
              h('span.plus', `+${r.last}`),
            ),
          ),
        ),
      );
    }
    const buttons = [];
    if (mode === 'grandprix') {
      const last = summary.gp.index + 1 >= summary.gp.tracks.length;
      buttons.push(button(last ? 'Ver resultado final' : 'Siguiente carrera', () => g.continueGP(), { icon: ICONS.next, default: true, cls: 'btn-primary' }));
    } else {
      buttons.push(button('Reintentar', () => g.restartRace(), { icon: ICONS.restart, default: true, cls: 'btn-primary' }));
      buttons.push(button('Cambiar circuito', () => this.changeTrack(), { icon: ICONS.flag }));
    }
    buttons.push(button('Menú principal', () => g.quitToMenu(), { icon: ICONS.home }));
    this.el.append(
      h('div.results-panel', { style: { '--accent': meta.color } }, h('div.results-head', h('h1', title), h('p', meta.name)), h('div.results-body', ...blocks), h('nav.results-buttons', ...buttons)),
      this.footer([['←→', 'Elegir'], ['Intro', 'Aceptar']]),
    );
  }

  changeTrack() {
    const g = this.game;
    g.quitToMenu();
    g.ui.show('play');
    g.ui.show('character');
    g.ui.show('kart');
    g.ui.show(g.session.mode === 'grandprix' ? 'cup' : 'track');
  }

  back() {}
}
