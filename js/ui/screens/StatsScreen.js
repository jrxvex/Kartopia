// Estadísticas del jugador, récords y trofeos.
import { Screen } from './Screen.js';
import { h } from '../dom.js';
import { formatTime } from '../../core/MathUtils.js';
import { DIFFICULTY_ORDER } from '../../config.js';

const TROPHY = { gold: '🥇', silver: '🥈', bronze: '🥉' };

export class StatsScreen extends Screen {
  build() {
    const g = this.game;
    const st = g.save.stats;
    const hours = Math.floor(st.playTime / 3600);
    const mins = Math.floor((st.playTime % 3600) / 60);
    const fav = Object.entries(st.characterPlays || {}).sort((a, b) => b[1] - a[1])[0];
    const cards = [
      ['Carreras', st.racesPlayed],
      ['Victorias', st.racesWon],
      ['Podios', st.podiums],
      ['Grandes Premios', st.gpPlayed],
      ['Copas de oro', st.gpWon],
      ['Contrarrelojes', st.timeTrials],
      ['Distancia', `${(st.distance / 1000).toFixed(1)} km`],
      ['Tiempo en pista', `${hours} h ${mins} min`],
      ['Mini-turbos azules', st.driftBoosts[0]],
      ['Mini-turbos naranjas', st.driftBoosts[1]],
      ['Mini-turbos morados', st.driftBoosts[2]],
      ['Trucos', st.tricks],
      ['Objetos usados', st.itemsUsed],
      ['Impactos acertados', st.hitsLanded],
      ['Veces golpeado', st.timesHit],
      ['Caídas', st.falls],
      ['Piloto favorito', fav ? g.data.character(fav[0]).name : '—'],
    ];
    const records = g.data.tracks.map((t) => {
      const b = g.save.getBestTime(t.id);
      return h('div.record-row', h('span.name', t.name), h('span', b && b.total ? formatTime(b.total) : '—'), h('span', b && b.lap ? formatTime(b.lap) : '—'));
    });
    const cups = g.data.cups.map((c) =>
      h('div.record-row', h('span.name', c.name), ...DIFFICULTY_ORDER.map((d) => h('span', { title: g.data.difficultyPreset(d).cc }, TROPHY[g.save.getCupTrophy(c.id, d)] || '·'))),
    );
    this.el.append(
      this.header('Estadísticas'),
      h(
        'div.stats-layout',
        h('div.stat-cards', ...cards.map(([l, v]) => h('div.stat-card', h('span.v', String(v)), h('span.l', l)))),
        h(
          'div.info-card.records-card',
          h('h2', 'Récords de contrarreloj'),
          h('div.record-row.head', h('span.name', 'Circuito'), h('span', 'Total'), h('span', 'Vuelta')),
          ...records,
          h('h2', 'Trofeos'),
          h('div.record-row.head', h('span.name', 'Copa'), ...DIFFICULTY_ORDER.map((d) => h('span', g.data.difficultyPreset(d).cc))),
          ...cups,
          h('div.focusable.invisible-focus', { tabindex: '0', 'data-default': '1' }),
        ),
      ),
      this.footer([['Esc', 'Volver']]),
    );
  }
}
