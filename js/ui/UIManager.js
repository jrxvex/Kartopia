// Gestor de pantallas de la interfaz: historial (volver), navegación por foco, avisos (toasts)
// y sonidos de menú.
import { FocusNavigator } from './FocusNavigator.js';
import { h } from './dom.js';
import { TitleScreen } from './screens/TitleScreen.js';
import { MainMenuScreen } from './screens/MainMenuScreen.js';
import { PlayScreen } from './screens/PlayScreen.js';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen.js';
import { KartSelectScreen } from './screens/KartSelectScreen.js';
import { TrackSelectScreen } from './screens/TrackSelectScreen.js';
import { CupSelectScreen } from './screens/CupSelectScreen.js';
import { RaceSetupScreen } from './screens/RaceSetupScreen.js';
import { LoadingScreen } from './screens/LoadingScreen.js';
import { PauseScreen } from './screens/PauseScreen.js';
import { ResultsScreen } from './screens/ResultsScreen.js';
import { GPFinalScreen } from './screens/GPFinalScreen.js';
import { OptionsScreen } from './screens/OptionsScreen.js';
import { ControlsScreen } from './screens/ControlsScreen.js';
import { StatsScreen } from './screens/StatsScreen.js';
import { CreditsScreen } from './screens/CreditsScreen.js';

const SCREENS = {
  title: TitleScreen,
  main: MainMenuScreen,
  play: PlayScreen,
  character: CharacterSelectScreen,
  kart: KartSelectScreen,
  track: TrackSelectScreen,
  cup: CupSelectScreen,
  setup: RaceSetupScreen,
  loading: LoadingScreen,
  pause: PauseScreen,
  results: ResultsScreen,
  gpFinal: GPFinalScreen,
  options: OptionsScreen,
  controls: ControlsScreen,
  stats: StatsScreen,
  credits: CreditsScreen,
};

export class UIManager {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.nav = new FocusNavigator();
    this.current = null;
    this.currentName = null;
    this.history = [];
    this.toastRoot = document.getElementById('toast-root');
    root.addEventListener('mousemove', (e) => {
      const f = e.target.closest && e.target.closest('.focusable');
      if (f && f !== this.nav.current && this.current && this.current.el.contains(f)) this.nav.focus(f, false);
    });
    root.addEventListener(
      'click',
      (e) => {
        const f = e.target.closest && e.target.closest('.focusable');
        if (f) this.game.audio.ui('select');
      },
      true,
    );
  }

  get active() {
    return !!this.current;
  }

  /** Muestra una pantalla. opts.replace: no añade al historial; opts.reset: vacía el historial. */
  show(name, params = {}, opts = {}) {
    const Cls = SCREENS[name];
    if (!Cls) throw new Error(`Pantalla desconocida: ${name}`);
    if (this.current) {
      if (!opts.replace && !opts.fromBack && this.current.keepInHistory) this.history.push({ name: this.currentName, params: this.currentParams });
      this.detachCurrent();
    }
    if (opts.reset || Cls.resetsHistory) this.history = [];
    const screen = new Cls(this, name);
    this.current = screen;
    this.currentName = name;
    this.currentParams = params;
    screen.el.classList.add('screen-enter');
    this.root.appendChild(screen.el);
    screen.build(params);
    this.nav.setScope(screen.el);
    requestAnimationFrame(() => {
      screen.el.classList.remove('screen-enter');
      if (this.current === screen) {
        this.nav.focusDefault();
        screen.onShow(params);
      }
    });
    return screen;
  }

  detachCurrent() {
    const s = this.current;
    if (!s) return;
    s.onHide();
    s.el.remove();
    this.current = null;
  }

  back() {
    const prev = this.history.pop();
    this.game.audio.ui('back');
    if (prev) this.show(prev.name, prev.params, { fromBack: true });
    return !!prev;
  }

  hideAll() {
    this.detachCurrent();
    this.currentName = null;
  }

  clearHistory() {
    this.history = [];
  }

  handleMenu(action) {
    const s = this.current;
    if (!s) return;
    if (s.handleMenu(action)) return;
    const cur = this.nav.current;
    if ((action === 'left' || action === 'right') && cur && cur.dataset.adjust) {
      cur.dispatchEvent(new CustomEvent('adjust', { detail: action === 'left' ? -1 : 1 }));
      this.game.audio.ui('move');
      return;
    }
    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        if (this.nav.move(action)) this.game.audio.ui('move');
        break;
      case 'confirm':
        this.nav.activate();
        break;
      case 'back':
        s.back();
        break;
      default:
        break;
    }
  }

  update(dt) {
    if (this.current) this.current.update(dt);
  }

  toast(msg, time = 2600) {
    const t = h('div.toast', msg);
    this.toastRoot.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, time);
  }
}
