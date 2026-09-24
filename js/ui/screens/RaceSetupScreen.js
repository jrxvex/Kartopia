// Reglas de la carrera: dificultad (cilindrada), vueltas, rivales, objetos y fantasma.
import { Screen } from './Screen.js';
import { h, button, ICONS } from '../dom.js';
import { choiceRow, toggleRow } from '../controls.js';
import { DIFFICULTY_ORDER } from '../../config.js';
import { formatTime } from '../../core/MathUtils.js';

export class RaceSetupScreen extends Screen {
  build() {
    const g = this.game;
    const ss = g.session;
    const rows = [];
    if (ss.mode !== 'timetrial') {
      rows.push(
        choiceRow(
          'Dificultad',
          DIFFICULTY_ORDER.map((d) => ({ value: d, label: g.data.difficultyPreset(d).name, sub: g.data.difficultyPreset(d).cc })),
          ss.difficulty,
          (v) => (ss.difficulty = v),
          { default: true },
        ),
      );
      rows.push(choiceRow('Vueltas', [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: n, label: String(n) })), ss.laps, (v) => (ss.laps = v)));
      if (ss.mode === 'single') {
        rows.push(choiceRow('Rivales', [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) })), ss.rivals, (v) => (ss.rivals = v)));
      }
      rows.push(
        choiceRow(
          'Objetos',
          [
            { value: 'normal', label: 'Normales' },
            { value: 'none', label: 'Desactivados' },
          ],
          ss.items,
          (v) => (ss.items = v),
        ),
      );
    } else {
      rows.push(toggleRow('Correr contra tu fantasma', g.settings.ghost, (v) => g.updateSettings({ ghost: v })));
    }
    const ch = g.data.character(ss.character);
    const kd = g.data.kart(ss.kart);
    let where;
    if (ss.mode === 'grandprix') {
      const cup = g.data.cup(ss.cupId);
      where = h('div.summary-line', h('b', cup.name), ': ', cup.tracks.map((t) => g.data.track(t).name).join(' · '));
    } else {
      const t = g.data.track(ss.trackId);
      where = h('div.summary-line', h('b', 'Circuito: '), t.name);
    }
    const modeName = { grandprix: 'Gran Premio', single: 'Carrera individual', timetrial: 'Contrarreloj' }[ss.mode];
    const extra = [];
    if (ss.mode === 'timetrial') {
      const best = g.save.getBestTime(ss.trackId);
      extra.push(h('div.summary-line', h('b', 'Récord: '), best && best.total ? formatTime(best.total) : '—', ' · ', h('b', 'Vuelta: '), best && best.lap ? formatTime(best.lap) : '—'));
      extra.push(h('p.small', 'Empiezas con tres turbos. Categoría 150cc, 3 vueltas.'));
    }
    this.el.append(
      this.header('Reglas de la carrera', modeName, this.wizardSteps('setup')),
      h(
        'div.setup-layout',
        h('div.options-list', ...rows),
        h(
          'div.info-card.summary',
          { style: { '--accent': ch.colors.outfit } },
          h('div.summary-head', h('img.char-portrait.small', { src: g.portraits[ch.id] || '', alt: '' }), h('div', h('h2', ch.name), h('span', `Kart: ${kd.name}`))),
          where,
          ...extra,
          button('¡A correr!', () => this.go(), { icon: ICONS.flag, cls: 'btn-big btn-go', default: ss.mode === 'timetrial' }),
        ),
      ),
      this.footer([['↑↓', 'Elegir'], ['←→', 'Cambiar'], ['Intro', 'Aceptar'], ['Esc', 'Volver']]),
    );
  }

  go() {
    this.game.audio.ui('start');
    this.game.startSession();
  }
}
