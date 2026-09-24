// Gestor de entrada: teclado (remapeable), mando (Gamepad API) y botones virtuales de los
// controles táctiles, con detección de pulsaciones segura para el bucle de paso fijo y
// navegación de menús.
import { ACTIONS, GAMEPAD_BINDINGS } from '../config.js';

const MENU_KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
  Backspace: 'back',
};

const PREVENT_DEFAULT = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
  'ShiftLeft',
  'ShiftRight',
]);

const STICK_DEADZONE = 0.18;

export class InputManager {
  constructor(controls) {
    this.controls = controls; // referencia viva a los controles guardados
    this.keysDown = new Set();
    this.pressed = new Set(); // acciones pulsadas pendientes de consumir (juego)
    this.released = new Set();
    this.menuListeners = new Set();
    this.anyKeyListeners = new Set();
    this.captureCallback = null;
    this.enabled = true;

    this.gamepadIndex = null;
    this.padButtons = [];
    this.padAxes = [0, 0];
    this.padActionDown = {};
    this.menuRepeat = { dir: null, timer: 0 };
    this.lastDevice = 'keyboard';
    // Controles táctiles: botones virtuales y joystick (x: giro, y: apuntar objetos)
    this.virtualDown = {};
    this.virtualStick = [0, 0];

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.lastDevice = 'gamepad';
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
    });
  }

  setControls(controls) {
    this.controls = controls;
  }

  /** Captura la próxima tecla (para remapear). Esc cancela. */
  captureNextKey(callback) {
    this.captureCallback = callback;
  }

  cancelCapture() {
    this.captureCallback = null;
  }

  onMenu(fn) {
    this.menuListeners.add(fn);
    return () => this.menuListeners.delete(fn);
  }

  onAnyKey(fn) {
    this.anyKeyListeners.add(fn);
    return () => this.anyKeyListeners.delete(fn);
  }

  actionForCode(code) {
    for (const action of ACTIONS) {
      const binds = this.controls[action];
      if (binds && (binds[0] === code || binds[1] === code)) return action;
    }
    return null;
  }

  _onKeyDown(e) {
    this.lastDevice = 'keyboard';
    if (this.captureCallback) {
      e.preventDefault();
      const cb = this.captureCallback;
      this.captureCallback = null;
      cb(e.code === 'Escape' ? null : e.code, e.code === 'Escape');
      return;
    }
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' && e.target.type === 'text') return;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();

    for (const fn of this.anyKeyListeners) fn(e.code);

    if (!e.repeat) {
      this.keysDown.add(e.code);
      const action = this.actionForCode(e.code);
      if (action) this.pressed.add(action);
    }
    const menu = MENU_KEYS[e.code];
    if (menu) this._emitMenu(menu, e.repeat);
  }

  _onKeyUp(e) {
    this.keysDown.delete(e.code);
    const action = this.actionForCode(e.code);
    if (action) this.released.add(action);
  }

  _onBlur() {
    this.keysDown.clear();
    this.pressed.clear();
    for (const a of Object.keys(this.virtualDown)) this.virtualDown[a] = false;
    this.virtualStick[0] = 0;
    this.virtualStick[1] = 0;
  }

  // ---------------------------------------------------------------- Táctil
  /** Estado de un botón virtual de los controles táctiles. */
  setVirtual(action, down, markDevice = true) {
    const was = !!this.virtualDown[action];
    if (down === was) return;
    this.virtualDown[action] = down;
    if (down) this.pressed.add(action);
    else this.released.add(action);
    if (down && markDevice) this.lastDevice = 'touch';
  }

  /** Joystick táctil: x en [-1, 1] para girar; y > 0 hacia abajo (apuntar atrás). */
  setVirtualStick(x, y) {
    this.virtualStick[0] = x;
    this.virtualStick[1] = y;
  }

  _emitMenu(action, repeat = false) {
    for (const fn of Array.from(this.menuListeners)) fn(action, repeat);
  }

  // ---------------------------------------------------------------- Mando
  _getPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.gamepadIndex !== null && pads[this.gamepadIndex]) return pads[this.gamepadIndex];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Debe llamarse una vez por frame (antes de las actualizaciones). */
  poll(dt) {
    const pad = this._getPad();
    if (!pad) {
      this.padAxes[0] = 0;
      this.padAxes[1] = 0;
      return;
    }
    const prev = this.padButtons;
    const now = pad.buttons.map((b) => (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5));
    let ax = pad.axes[0] || 0;
    let ay = pad.axes[1] || 0;
    if (Math.abs(ax) < STICK_DEADZONE) ax = 0;
    else ax = Math.sign(ax) * ((Math.abs(ax) - STICK_DEADZONE) / (1 - STICK_DEADZONE));
    if (Math.abs(ay) < STICK_DEADZONE) ay = 0;
    this.padAxes[0] = ax;
    this.padAxes[1] = ay;

    const anyNew = now.some((v, i) => v && !prev[i]);
    if (anyNew || ax !== 0 || ay !== 0) this.lastDevice = 'gamepad';
    if (anyNew) for (const fn of this.anyKeyListeners) fn('Gamepad');

    // Acciones de juego
    for (const action of ACTIONS) {
      const idxs = GAMEPAD_BINDINGS[action] || [];
      const down = idxs.some((i) => now[i]);
      const was = !!this.padActionDown[action];
      if (down && !was) this.pressed.add(action);
      if (!down && was) this.released.add(action);
      this.padActionDown[action] = down;
    }

    // Menús (A = confirmar, B = volver, cruceta/stick = navegar)
    const edge = (i) => now[i] && !prev[i];
    if (edge(0)) this._emitMenu('confirm');
    if (edge(1)) this._emitMenu('back');
    if (edge(9)) this._emitMenu('start');
    let dir = null;
    if (now[12] || ay < -0.6) dir = 'up';
    else if (now[13] || ay > 0.6) dir = 'down';
    else if (now[14] || ax < -0.6) dir = 'left';
    else if (now[15] || ax > 0.6) dir = 'right';
    if (dir) {
      if (this.menuRepeat.dir !== dir) {
        this.menuRepeat.dir = dir;
        this.menuRepeat.timer = 0.38;
        this._emitMenu(dir);
      } else {
        this.menuRepeat.timer -= dt;
        if (this.menuRepeat.timer <= 0) {
          this.menuRepeat.timer = 0.11;
          this._emitMenu(dir, true);
        }
      }
    } else {
      this.menuRepeat.dir = null;
    }
    this.padButtons = now;
  }

  // ---------------------------------------------------------------- Consultas de juego
  isDown(action) {
    const binds = this.controls[action];
    if (binds) {
      if (binds[0] && this.keysDown.has(binds[0])) return true;
      if (binds[1] && this.keysDown.has(binds[1])) return true;
    }
    return !!this.padActionDown[action] || !!this.virtualDown[action];
  }

  /** Devuelve true una sola vez por pulsación (seguro con paso fijo). */
  consumePressed(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action);
      return true;
    }
    return false;
  }

  consumeReleased(action) {
    if (this.released.has(action)) {
      this.released.delete(action);
      return true;
    }
    return false;
  }

  clearPressed() {
    this.pressed.clear();
    this.released.clear();
  }

  getSteer() {
    let s = 0;
    if (this.isDown('left')) s -= 1;
    if (this.isDown('right')) s += 1;
    if (s === 0 && this.padAxes[0] !== 0) s = this.padAxes[0];
    if (s === 0 && this.padButtons) {
      // cruceta del mando
      if (this.padButtons[14]) s -= 1;
      if (this.padButtons[15]) s += 1;
    }
    if (s === 0 && this.virtualStick[0] !== 0) s = this.virtualStick[0];
    return s;
  }

  getThrottle() {
    let t = 0;
    if (this.isDown('accelerate')) t += 1;
    if (this.isDown('brake')) t -= 1;
    return t;
  }

  /** Dirección vertical del stick/teclas para lanzar objetos (-1 atrás, 1 delante). */
  getAim() {
    if (this.isDown('brake') || this.padAxes[1] > 0.5 || this.virtualStick[1] > 0.5) return -1;
    if (this.padAxes[1] < -0.5 || this.virtualStick[1] < -0.5) return 1;
    return 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
