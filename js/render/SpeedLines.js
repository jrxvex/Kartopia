// Efecto de velocidad: líneas radiales en un canvas 2D superpuesto (muy barato de dibujar) y una
// viñeta que es una capa CSS fija: solo cambia su opacidad, que la GPU compone sin repintar.
import { Random } from '../core/Random.js';

export class SpeedLines {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.intensity = 0;
    this.color = '255,255,255';
    this.rng = new Random(5);
    this.lines = [];
    for (let i = 0; i < 70; i++) this.lines.push(this.newLine());
    this.visible = false;
    this.maxDpr = 1.5;
    this.vignette = document.createElement('div');
    this.vignette.className = 'fx-vignette';
    canvas.after(this.vignette);
    this.vigOpacity = '0';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** En calidad baja el lienzo se dibuja a resolución CSS (menos píxeles que limpiar y trazar). */
  setQuality(low) {
    const max = low ? 1 : 1.5;
    if (max === this.maxDpr) return;
    this.maxDpr = max;
    this.resize();
  }

  newLine() {
    return {
      a: this.rng.range(0, Math.PI * 2),
      r: this.rng.range(0.25, 0.9),
      len: this.rng.range(0.08, 0.3),
      speed: this.rng.range(1.2, 2.6),
      w: this.rng.range(1, 3.2),
    };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.dpr = dpr;
  }

  update(dt, target, color = null) {
    this.intensity += (target - this.intensity) * Math.min(1, dt * 6);
    if (color) this.color = color;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const vig = this.intensity < 0.02 ? '0' : (Math.round(Math.min(0.35, this.intensity * 0.3) * 50) / 50).toString();
    if (vig !== this.vigOpacity) {
      this.vigOpacity = vig;
      this.vignette.style.opacity = vig;
    }
    if (this.intensity < 0.02) {
      if (this.visible) {
        ctx.clearRect(0, 0, W, H);
        this.visible = false;
      }
      return;
    }
    this.visible = true;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H * 0.46;
    const R = Math.hypot(W, H) * 0.55;
    ctx.lineCap = 'round';
    const count = Math.floor(this.lines.length * Math.min(1, this.intensity * 1.2));
    for (let i = 0; i < count; i++) {
      const l = this.lines[i];
      l.r += l.speed * dt * (0.8 + this.intensity);
      if (l.r > 1.1) Object.assign(l, this.newLine(), { r: this.rng.range(0.3, 0.5) });
      const r0 = l.r * R;
      const r1 = (l.r + l.len) * R;
      const ca = Math.cos(l.a);
      const sa = Math.sin(l.a);
      const alpha = Math.min(0.55, this.intensity * 0.5) * Math.min(1, (l.r - 0.25) * 3);
      ctx.strokeStyle = `rgba(${this.color},${alpha})`;
      ctx.lineWidth = l.w * this.dpr;
      ctx.beginPath();
      ctx.moveTo(cx + ca * r0, cy + sa * r0 * 0.75);
      ctx.lineTo(cx + ca * r1, cy + sa * r1 * 0.75);
      ctx.stroke();
    }
  }

  clear() {
    this.intensity = 0;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.visible = false;
    this.vigOpacity = '0';
    this.vignette.style.opacity = '0';
  }
}
