// Final del Gran Premio: trofeo y clasificación definitiva.
import { Screen } from './Screen.js';
import { h, button, ICONS } from '../dom.js';

const TROPHY_NAME = { gold: 'Trofeo de Oro', silver: 'Trofeo de Plata', bronze: 'Trofeo de Bronce' };

export class GPFinalScreen extends Screen {
  build({ gp, sorted, position, trophy }) {
    this.keepInHistory = false;
    const g = this.game;
    const cup = g.data.cup(gp.cupId);
    const podium = sorted.slice(0, 3);
    this.el.append(
      h(
        'div.final-panel',
        { style: { '--accent': cup.color } },
        h('h1', cup.name),
        h('p.final-sub', `${g.data.difficultyPreset(g.session.difficulty).name} · ${g.data.difficultyPreset(g.session.difficulty).cc}`),
        trophy ? h(`div.trophy.${trophy}`, h('span.trophy-cup', '🏆'), h('span.trophy-name', TROPHY_NAME[trophy])) : h('div.trophy.none', h('span.trophy-cup', '🏁'), h('span.trophy-name', `Has terminado ${position}º. ¡Inténtalo de nuevo!`)),
        h(
          'div.podium',
          ...[1, 0, 2].map((i) => {
            const r = podium[i];
            if (!r) return h('div.podium-step');
            return h(`div.podium-step.p${i + 1}${r.isPlayer ? '.me' : ''}`, h('img.char-portrait', { src: g.portraits[r.characterId] || '', alt: '' }), h('span.name', r.name), h('span.pts', `${r.points} pts`), h('div.block', `${i + 1}`));
          }),
        ),
        h('div.final-list', ...sorted.slice(3).map((r, i) => h(`div.standing-row${r.isPlayer ? '.me' : ''}`, h('span.pos', `${i + 4}º`), h('img.char-portrait.tiny', { src: g.portraits[r.characterId] || '', alt: '' }), h('span.name', r.name), h('span.pts', `${r.points}`)))),
        h('nav.results-buttons', button('Jugar otra copa', () => this.again(), { icon: ICONS.trophy, default: true, cls: 'btn-primary' }), button('Menú principal', () => g.quitToMenu(), { icon: ICONS.home })),
      ),
    );
    if (trophy) setTimeout(() => this.game.view && this.game.view.particles.confetti(this.game.view.focus.pos), 200);
  }

  again() {
    const g = this.game;
    const mode = g.session.mode;
    g.quitToMenu();
    g.newSession(mode);
    g.ui.show('play');
    g.ui.show('character');
  }

  back() {}
}
