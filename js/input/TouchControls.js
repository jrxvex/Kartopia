// Controles táctiles para móviles y tabletas: joystick flotante en la mitad izquierda para
// girar (y apuntar los objetos hacia delante o hacia atrás), botones de derrape, objeto y freno
// a la derecha, aceleración automática opcional y botón de pausa. Escriben en el InputManager
// como botones virtuales, así que el resto del juego no distingue el dispositivo.
import { h } from '../ui/dom.js';

const DEADZONE = 0.12;

export function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

export function isTouchPrimary() {
  try {
    return isTouchDevice() && window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
}

export class TouchControls {
  constructor(game, root) {
    this.game = game;
    this.input = game.input;
    this.root = root;
    this.touchDevice = isTouchDevice();
    this.visible = false;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.held = { drift: false, item: false, brake: false, gas: false };
    this.startGasId = null; // dedo que sujeta el botón durante la cuenta atrás (salida turbo)
    this.lastIcon = null;
    if (isTouchPrimary()) this.input.lastDevice = 'touch';
    document.documentElement.classList.toggle('touch-device', this.touchDevice);
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') this.input.lastDevice = 'touch';
      },
      true,
    );
    this.build();
  }

  build() {
    const r = this.root;
    this.knob = h('div.tc-knob');
    this.base = h('div.tc-stick', this.knob);
    this.zone = h('div.tc-steer-zone', this.base);
    this.btnDrift = h('div.tc-btn.tc-drift', h('span.tc-icon', '⤴'), (this.driftLabel = h('span.tc-label', 'SALTO')));
    this.itemIcon = h('img.tc-item-icon.hidden', { alt: '' });
    this.btnItem = h('div.tc-btn.tc-item.empty', this.itemIcon, h('span.tc-label', 'OBJETO'));
    this.btnBrake = h('div.tc-btn.tc-brake', h('span.tc-icon', '▼'), h('span.tc-label', 'FRENO'));
    this.btnGas = h('div.tc-btn.tc-gas', h('span.tc-icon', '▲'), h('span.tc-label', 'GAS'));
    this.btnPause = h('button.tc-pause', { type: 'button', 'aria-label': 'Pausa' }, '❚❚');
    r.append(this.zone, this.btnBrake, this.btnItem, this.btnDrift, this.btnGas, this.btnPause);

    // Saltar la presentación tocando en cualquier parte
    r.addEventListener(
      'pointerdown',
      (e) => {
        const race = this.game.race;
        if (race && race.phase === 'intro') {
          race.skipIntro();
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
    this.bindStick();
    this.bindButton(this.btnDrift, 'drift');
    this.bindButton(this.btnItem, 'item');
    this.bindButton(this.btnBrake, 'brake');
    this.bindButton(this.btnGas, 'gas');
    this.btnPause.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btnPause.addEventListener('click', () => {
      if (this.game.state === 'race' && this.game.race && this.game.race.phase !== 'finished') this.game.pause();
    });
    // Evitar menús contextuales y gestos del navegador sobre los controles
    r.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindStick() {
    const z = this.zone;
    const st = this.stick;
    z.addEventListener('pointerdown', (e) => {
      if (st.id !== null) return;
      e.preventDefault();
      st.id = e.pointerId;
      z.setPointerCapture?.(e.pointerId);
      const rect = z.getBoundingClientRect();
      st.ox = e.clientX - rect.left;
      st.oy = e.clientY - rect.top;
      st.x = 0;
      st.y = 0;
      this.base.style.left = `${st.ox}px`;
      this.base.style.top = `${st.oy}px`;
      this.base.classList.add('active');
      this.updateStick();
    });
    const move = (e) => {
      if (e.pointerId !== st.id) return;
      e.preventDefault();
      const rect = z.getBoundingClientRect();
      st.x = e.clientX - rect.left - st.ox;
      st.y = e.clientY - rect.top - st.oy;
      this.updateStick();
    };
    const end = (e) => {
      if (e.pointerId !== st.id) return;
      st.id = null;
      st.x = 0;
      st.y = 0;
      this.base.classList.remove('active');
      this.base.style.left = '';
      this.base.style.top = '';
      this.updateStick();
    };
    z.addEventListener('pointermove', move);
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
  }

  updateStick() {
    const st = this.stick;
    const R = this.base.offsetWidth * 0.5 || 60;
    let dx = st.x;
    let dy = st.y;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let sx = dx / R;
    let sy = dy / R;
    // zona muerta y curva suave para girar con precisión
    const ax = Math.abs(sx);
    sx = ax < DEADZONE ? 0 : Math.sign(sx) * Math.min(1, ((ax - DEADZONE) / (1 - DEADZONE)) ** 1.25);
    if (Math.abs(sy) < 0.35) sy = 0;
    this.input.setVirtualStick(sx, sy);
  }

  bindButton(el, name) {
    const ids = new Set();
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      ids.add(e.pointerId);
      el.classList.add('pressed');
      // Durante la cuenta atrás, el botón de derrape hace de acelerador para la salida turbo.
      const race = this.game.race;
      if (name === 'drift' && race && race.phase === 'countdown' && this.game.settings.autoAccelerate) {
        this.startGasId = e.pointerId;
        return;
      }
      this.setHeld(name, true);
    };
    const up = (e) => {
      if (!ids.has(e.pointerId)) return;
      ids.delete(e.pointerId);
      if (ids.size === 0) el.classList.remove('pressed');
      if (this.startGasId === e.pointerId) {
        this.startGasId = null;
        return;
      }
      if (ids.size === 0) this.setHeld(name, false);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  setHeld(name, v) {
    this.held[name] = v;
    if (name === 'drift' || name === 'item' || name === 'brake') this.input.setVirtual(name, v);
  }

  /** ¿Deben mostrarse los controles táctiles según los ajustes y el último dispositivo usado? */
  get wanted() {
    const mode = this.game.settings.touchControls || 'auto';
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return this.touchDevice && this.input.lastDevice === 'touch';
  }

  releaseAll() {
    for (const k of Object.keys(this.held)) if (this.held[k]) this.setHeld(k, false);
    this.startGasId = null;
    this.stick.id = null;
    this.stick.x = 0;
    this.stick.y = 0;
    this.base.classList.remove('active');
    this.base.style.left = '';
    this.base.style.top = '';
    this.knob.style.transform = '';
    for (const b of [this.btnDrift, this.btnItem, this.btnBrake, this.btnGas]) b.classList.remove('pressed');
    this.input.setVirtualStick(0, 0);
    this.input.setVirtual('accelerate', false);
  }

  update() {
    const g = this.game;
    const wanted = this.wanted;
    document.documentElement.classList.toggle('touch-ui', wanted);
    const race = g.race;
    const show = wanted && g.state === 'race' && !!race && !g.paused && !g.ui.active && race.phase !== 'finished';
    if (show !== this.visible) {
      this.visible = show;
      this.root.classList.toggle('hidden', !show);
      if (!show) this.releaseAll();
    }
    if (!show) return;
    const auto = !!g.settings.autoAccelerate;
    this.root.classList.toggle('manual-gas', !auto);
    const countdown = race.phase === 'countdown' || race.phase === 'intro';
    this.btnDrift.classList.toggle('start', auto && countdown);
    const label = auto && countdown ? 'TURBO' : 'SALTO';
    if (this.driftLabel.textContent !== label) this.driftLabel.textContent = label;
    // Aceleración: automática (salvo al frenar) o con el botón GAS
    let gas;
    if (auto) gas = countdown ? this.startGasId !== null : !this.held.brake;
    else gas = this.held.gas;
    this.input.setVirtual('accelerate', gas, false);
    // Icono del objeto actual en el botón
    const k = race.player;
    let icon = null;
    if (k && k.item) icon = race.items.itemDef(k.item.id)?.icon || null;
    else if (k && k.held) icon = race.items.itemDef('goo-trap')?.icon || null;
    if (icon !== this.lastIcon) {
      this.lastIcon = icon;
      if (icon) this.itemIcon.src = icon;
      this.itemIcon.classList.toggle('hidden', !icon);
      this.btnItem.classList.toggle('empty', !icon);
    }
    this.btnItem.classList.toggle('rolling', !!(k && k.roulette));
  }
}
