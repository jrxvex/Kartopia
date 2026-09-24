// Opciones: audio, gráficos, juego y datos guardados.
import { Screen } from './Screen.js';
import { h, button } from '../dom.js';
import { choiceRow, toggleRow, sliderRow } from '../controls.js';
import { QUALITY_PRESETS } from '../../config.js';

const TABS = [
  ['audio', 'Audio'],
  ['graphics', 'Gráficos'],
  ['game', 'Juego'],
  ['data', 'Datos'],
];

export class OptionsScreen extends Screen {
  build(params = {}) {
    this.inRace = !!params.inRace;
    this.tab = params.tab || 'audio';
    this.tabsEl = h('div.tabs');
    this.body = h('div.options-list.options-body');
    this.el.append(this.header('Opciones', this.inRace ? 'Los cambios se aplican al instante' : null), this.tabsEl, this.body, this.footer([['↑↓', 'Elegir'], ['←→', 'Cambiar'], ['Q/E', 'Pestaña'], ['Esc', 'Volver']]));
    this.renderTabs();
    this.renderBody();
    this.onKey = (e) => {
      if (e.code === 'KeyQ' || e.code === 'PageUp') this.cycleTab(-1);
      if (e.code === 'KeyE' || e.code === 'PageDown') this.cycleTab(1);
    };
    window.addEventListener('keydown', this.onKey);
  }

  onHide() {
    window.removeEventListener('keydown', this.onKey);
  }

  cycleTab(d) {
    const i = TABS.findIndex(([id]) => id === this.tab);
    this.tab = TABS[(i + d + TABS.length) % TABS.length][0];
    this.renderTabs();
    this.renderBody();
    this.ui.nav.focusDefault();
  }

  renderTabs() {
    this.tabsEl.replaceChildren(
      ...TABS.map(([id, label]) =>
        h(`button.tab.focusable${id === this.tab ? '.active' : ''}`, {
          type: 'button',
          onClick: () => {
            this.tab = id;
            this.renderTabs();
            this.renderBody();
          },
        }, label),
      ),
    );
  }

  renderBody() {
    const g = this.game;
    const s = g.settings;
    const set = (patch) => g.updateSettings(patch);
    const rows = [];
    if (this.tab === 'audio') {
      rows.push(sliderRow('Volumen general', s.masterVolume, 0, 1, 0.05, (v) => set({ masterVolume: v })));
      rows.push(sliderRow('Música', s.musicVolume, 0, 1, 0.05, (v) => set({ musicVolume: v })));
      rows.push(sliderRow('Efectos', s.sfxVolume, 0, 1, 0.05, (v) => set({ sfxVolume: v })));
      rows.push(h('p.small.hint-text', 'Toda la música y los efectos se sintetizan en tiempo real con Web Audio.'));
    } else if (this.tab === 'graphics') {
      rows.push(
        choiceRow(
          'Calidad',
          Object.entries(QUALITY_PRESETS).map(([k, p]) => ({ value: k, label: p.label })),
          s.quality,
          (v) => {
            const p = QUALITY_PRESETS[v];
            set({ quality: v, shadows: p.shadows, bloom: p.bloom });
            this.renderBody();
          },
          { default: true },
        ),
      );
      rows.push(toggleRow('Sombras dinámicas', s.shadows, (v) => set({ shadows: v })));
      rows.push(toggleRow('Resplandor (bloom)', s.bloom, (v) => set({ bloom: v })));
      rows.push(sliderRow('Escala de resolución', s.resolutionScale, 0.5, 1, 0.05, (v) => set({ resolutionScale: v })));
      rows.push(toggleRow('Líneas de velocidad', s.speedLines, (v) => set({ speedLines: v })));
      rows.push(toggleRow('Mostrar FPS', s.showFps, (v) => set({ showFps: v })));
      rows.push(h('p.small.hint-text', 'La densidad de vegetación y partículas se aplica al cargar el siguiente circuito.'));
    } else if (this.tab === 'game') {
      rows.push(sliderRow('Campo de visión', s.fov, 60, 85, 1, (v) => set({ fov: v }), (v) => `${Math.round(v)}°`));
      rows.push(toggleRow('Vibración de cámara', s.cameraShake, (v) => set({ cameraShake: v })));
      rows.push(choiceRow('Unidades de velocidad', [{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }], s.speedUnit, (v) => set({ speedUnit: v })));
      rows.push(sliderRow('Tamaño del HUD', s.hudScale, 0.75, 1.3, 0.05, (v) => set({ hudScale: v })));
      rows.push(toggleRow('Minimapa', s.showMinimap, (v) => set({ showMinimap: v })));
      rows.push(toggleRow('Clasificación en pantalla', s.showRanking, (v) => set({ showRanking: v })));
      rows.push(toggleRow('Fantasma en contrarreloj', s.ghost, (v) => set({ ghost: v })));
      rows.push(
        choiceRow(
          'Controles táctiles',
          [
            { value: 'auto', label: 'Automático', sub: 'al tocar la pantalla' },
            { value: 'on', label: 'Siempre' },
            { value: 'off', label: 'Nunca' },
          ],
          s.touchControls || 'auto',
          (v) => set({ touchControls: v }),
        ),
      );
      rows.push(toggleRow('Acelerar automáticamente (táctil)', s.autoAccelerate, (v) => set({ autoAccelerate: v })));
      rows.push(sliderRow('Tamaño de los botones táctiles', s.touchScale || 1, 0.75, 1.4, 0.05, (v) => set({ touchScale: v })));
      if (document.documentElement.requestFullscreen) rows.push(button('Pantalla completa', () => g.toggleFullscreen(), { cls: 'btn-wide' }));
    } else {
      const volatile = g.save.volatile;
      rows.push(h('p.small.hint-text', volatile ? 'Tu navegador no permite guardar datos (modo privado): el progreso se perderá al cerrar.' : 'Tus ajustes, controles, récords, fantasmas y estadísticas se guardan en este navegador (localStorage).'));
      rows.push(button('Restablecer ajustes', () => this.confirm('¿Restablecer todos los ajustes gráficos y de sonido?', () => (g.resetSettings(), this.renderBody())), { cls: 'btn-wide' }));
      rows.push(button('Borrar progreso y estadísticas', () => this.confirm('Se borrarán récords, fantasmas, trofeos y estadísticas. ¿Continuar?', () => (g.save.resetProgress(g.data.tracks.map((t) => t.id)), g.ui.toast('Progreso borrado'))), { cls: 'btn-wide btn-danger' }));
    }
    this.body.replaceChildren(...rows);
  }

  confirm(msg, fn) {
    const box = h('div.confirm', h('p', msg), h('div.confirm-buttons', button('Sí', () => (fn(), box.remove(), this.ui.nav.focusDefault()), { cls: 'btn-danger' }), button('No', () => (box.remove(), this.ui.nav.focusDefault()), { default: true })));
    this.body.appendChild(box);
    this.ui.nav.focus(box.querySelector('.focusable:last-child'));
  }
}
