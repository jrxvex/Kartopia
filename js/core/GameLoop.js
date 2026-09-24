// Bucle principal con paso fijo para la física e interpolación para el render.
import { PHYSICS } from '../config.js';

export class GameLoop {
  /**
   * @param {object} hooks
   * @param {(dt:number)=>void} hooks.fixedUpdate  paso de simulación fijo
   * @param {(dt:number, alpha:number)=>void} hooks.update  actualización por frame
   * @param {()=>void} hooks.render
   */
  constructor({ fixedUpdate, update, render }) {
    this.fixedUpdate = fixedUpdate;
    this.update = update;
    this.render = render;
    this.fixedDt = PHYSICS.FIXED_DT;
    this.accumulator = 0;
    this.last = 0;
    this.running = false;
    this.timeScale = 1;
    this.frame = 0;
    this.fps = 60;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, this.maxDt || 0.1);

    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    const scaled = dt * this.timeScale;
    this.accumulator += scaled;
    let steps = 0;
    const maxSteps = PHYSICS.MAX_STEPS_PER_FRAME * Math.max(1, Math.ceil(this.timeScale));
    while (this.accumulator >= this.fixedDt && steps < maxSteps) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps >= maxSteps) this.accumulator = 0; // evita la "espiral de la muerte"
    const alpha = this.accumulator / this.fixedDt;
    this.update(scaled, alpha, dt);
    this.render(dt);
    this.frame++;
  }
}
