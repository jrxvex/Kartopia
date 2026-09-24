// Efectos de sonido sintetizados (Web Audio): cuenta atrás, saltos, choques, turbos, mini-turbos,
// objetos, explosiones, escudo, hielo, caídas, menús... Admiten posición 3D simplificada
// (atenuación por distancia y panorama estéreo).

export class SoundEffects {
  constructor(audio) {
    this.audio = audio;
    this.ctx = audio.ctx;
    this.bus = audio.sfxBus;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
  }

  setListener(x, y, z, yaw) {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  /** Nodo de salida con atenuación y panorama según la posición (o bus directo). */
  out(pos, vol = 1, range = 70) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    if (!pos) {
      g.gain.value = vol;
      g.connect(this.bus);
      return g;
    }
    const L = this.listener;
    const dx = pos.x - L.x;
    const dz = pos.z - L.z;
    const d = Math.hypot(dx, dz, (pos.y ?? L.y) - L.y);
    const att = Math.max(0, 1 - d / range);
    g.gain.value = vol * att * att;
    if (att <= 0.001) {
      g.gain.value = 0;
    }
    const p = ctx.createStereoPanner();
    const rx = -Math.cos(L.yaw);
    const rz = Math.sin(L.yaw);
    p.pan.value = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    g.connect(p);
    p.connect(this.bus);
    return g;
  }

  tone(freq, dur, { type = 'square', vol = 0.15, to = null, attack = 0.005, dest = null, delay = 0, curve = 'exp' } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      else o.frequency.linearRampToValueAtTime(to, t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  noise(dur, { vol = 0.2, type = 'bandpass', freq = 1000, to = null, q = 1, attack = 0.005, dest = null, delay = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.audio.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.bus);
    s.start(t, Math.random() * 1.2);
    s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ Carrera
  countdown(n) {
    if (n > 0) {
      this.tone(523, 0.32, { type: 'square', vol: 0.16 });
      this.tone(1046, 0.18, { type: 'triangle', vol: 0.06 });
    } else {
      this.tone(1046, 0.8, { type: 'square', vol: 0.16 });
      this.tone(1568, 0.8, { type: 'triangle', vol: 0.09 });
      this.noise(0.5, { vol: 0.08, type: 'highpass', freq: 3000 });
    }
  }

  hop(pos) {
    const d = this.out(pos, 1, 40);
    this.tone(240, 0.12, { type: 'square', vol: 0.05, to: 480, dest: d });
  }

  land(pos, amount = 1) {
    const d = this.out(pos, 1, 50);
    this.noise(0.16, { vol: 0.2 * amount, type: 'lowpass', freq: 500, dest: d });
    this.tone(110, 0.18, { type: 'sine', vol: 0.25 * amount, to: 45, dest: d });
  }

  wall(pos, impact = 10) {
    const k = Math.min(1, impact / 18);
    const d = this.out(pos, 1, 60);
    this.noise(0.22, { vol: 0.28 * k + 0.05, type: 'bandpass', freq: 900, q: 1.2, dest: d });
    this.tone(150, 0.22, { type: 'triangle', vol: 0.2 * k, to: 70, dest: d });
    this.tone(523, 0.08, { type: 'square', vol: 0.05 * k, dest: d });
    this.tone(622, 0.1, { type: 'square', vol: 0.04 * k, dest: d, delay: 0.02 });
  }

  bump(pos) {
    const d = this.out(pos, 1, 50);
    this.noise(0.14, { vol: 0.18, type: 'bandpass', freq: 600, dest: d });
    this.tone(130, 0.15, { type: 'sine', vol: 0.2, to: 70, dest: d });
  }

  miniTurbo(level) {
    const f = [0, 660, 784, 988][level] || 660;
    this.noise(0.45, { vol: 0.16, type: 'bandpass', freq: 600, to: 3200, q: 1.5 });
    this.tone(f, 0.25, { type: 'square', vol: 0.06, to: f * 1.5 });
    if (level >= 2) this.tone(f * 1.26, 0.25, { type: 'triangle', vol: 0.05, delay: 0.05 });
    if (level >= 3) this.tone(f * 1.5, 0.3, { type: 'triangle', vol: 0.05, delay: 0.1 });
  }

  driftLevel(level) {
    const f = [0, 1320, 1568, 1976][level] || 1320;
    this.tone(f, 0.08, { type: 'square', vol: 0.035 });
  }

  boost(pos) {
    const d = this.out(pos, 1, 60);
    this.noise(0.7, { vol: 0.22, type: 'bandpass', freq: 300, to: 2600, q: 0.8, dest: d });
    this.tone(160, 0.6, { type: 'sawtooth', vol: 0.06, to: 420, dest: d });
  }

  boostPad(pos) {
    const d = this.out(pos, 1, 50);
    this.tone(880, 0.12, { type: 'square', vol: 0.06, to: 1760, dest: d });
    this.noise(0.4, { vol: 0.15, type: 'bandpass', freq: 800, to: 3000, dest: d });
  }

  startBoost() {
    this.boost(null);
    this.tone(784, 0.3, { type: 'square', vol: 0.08 });
    this.tone(1175, 0.4, { type: 'triangle', vol: 0.06, delay: 0.08 });
  }

  burnout() {
    this.noise(0.8, { vol: 0.2, type: 'lowpass', freq: 600, to: 200 });
    this.tone(90, 0.5, { type: 'sawtooth', vol: 0.08, to: 40 });
  }

  trick() {
    this.tone(988, 0.1, { type: 'square', vol: 0.06 });
    this.tone(1319, 0.18, { type: 'square', vol: 0.06, delay: 0.08 });
    this.noise(0.25, { vol: 0.05, type: 'highpass', freq: 6000, delay: 0.05 });
  }

  // ------------------------------------------------------------ Objetos
  itemBox(pos) {
    const d = this.out(pos, 1, 40);
    [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.09, delay: i * 0.05, dest: d }));
    this.noise(0.25, { vol: 0.06, type: 'highpass', freq: 5000, dest: d });
  }

  rouletteTick() {
    this.tone(1500 + Math.random() * 300, 0.03, { type: 'square', vol: 0.035 });
  }

  itemGet() {
    this.tone(1046, 0.12, { type: 'triangle', vol: 0.1 });
    this.tone(1568, 0.22, { type: 'triangle', vol: 0.1, delay: 0.1 });
  }

  throw(pos) {
    const d = this.out(pos, 1, 50);
    this.noise(0.22, { vol: 0.16, type: 'bandpass', freq: 1500, to: 400, dest: d });
  }

  drop(pos) {
    const d = this.out(pos, 1, 40);
    this.tone(300, 0.15, { type: 'sine', vol: 0.12, to: 120, dest: d });
    this.noise(0.12, { vol: 0.08, type: 'lowpass', freq: 800, dest: d });
  }

  explosion(pos) {
    const d = this.out(pos, 1.2, 120);
    this.noise(1.3, { vol: 0.55, type: 'lowpass', freq: 2400, to: 120, dest: d });
    this.tone(80, 0.9, { type: 'sine', vol: 0.5, to: 28, dest: d });
    this.noise(0.4, { vol: 0.2, type: 'highpass', freq: 2500, dest: d, delay: 0.05 });
  }

  hit(pos) {
    const d = this.out(pos, 1, 60);
    this.tone(640, 0.35, { type: 'square', vol: 0.1, to: 140, dest: d });
    this.noise(0.2, { vol: 0.14, type: 'bandpass', freq: 1200, dest: d });
  }

  spin(pos) {
    const d = this.out(pos, 1, 50);
    const o = this.tone(700, 0.7, { type: 'sine', vol: 0.12, to: 250, dest: d });
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 14;
    lg.gain.value = 60;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start();
    lfo.stop(this.ctx.currentTime + 0.75);
  }

  shieldUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.06, delay: i * 0.04, attack: 0.05 }));
  }

  shieldPop(pos) {
    const d = this.out(pos, 1, 50);
    this.noise(0.18, { vol: 0.2, type: 'highpass', freq: 2500, dest: d });
    this.tone(1400, 0.25, { type: 'sine', vol: 0.1, to: 300, dest: d });
  }

  freeze() {
    [2093, 1568, 1319, 1047, 784].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.07, delay: i * 0.06 }));
    this.noise(0.8, { vol: 0.1, type: 'highpass', freq: 4000, to: 9000 });
  }

  comet() {
    this.tone(70, 1.2, { type: 'sawtooth', vol: 0.15, to: 140 });
    this.noise(1.2, { vol: 0.2, type: 'lowpass', freq: 400, to: 1800 });
  }

  lockOn() {
    this.tone(1760, 0.08, { type: 'square', vol: 0.05 });
    this.tone(1760, 0.08, { type: 'square', vol: 0.05, delay: 0.14 });
  }

  // ------------------------------------------------------------ Caídas y varios
  fall(reason, pos) {
    const d = this.out(pos, 1, 60);
    if (reason === 'water') {
      this.noise(0.6, { vol: 0.3, type: 'lowpass', freq: 1200, to: 300, dest: d });
      this.noise(0.3, { vol: 0.15, type: 'highpass', freq: 3000, dest: d, delay: 0.05 });
    } else if (reason === 'lava') {
      this.noise(0.9, { vol: 0.25, type: 'bandpass', freq: 800, to: 3000, dest: d });
      this.tone(200, 0.6, { type: 'sawtooth', vol: 0.06, to: 60, dest: d });
    } else {
      this.tone(900, 0.8, { type: 'sine', vol: 0.12, to: 180, dest: d, curve: 'lin' });
    }
  }

  respawn() {
    const o = this.tone(180, 0.9, { type: 'square', vol: 0.03 });
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 30;
    lg.gain.value = 40;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start();
    lfo.stop(this.ctx.currentTime + 1);
  }

  lap() {
    this.tone(784, 0.12, { type: 'triangle', vol: 0.12 });
    this.tone(1046, 0.25, { type: 'triangle', vol: 0.12, delay: 0.1 });
  }

  wrongWay() {
    this.tone(330, 0.2, { type: 'square', vol: 0.06 });
    this.tone(262, 0.3, { type: 'square', vol: 0.06, delay: 0.22 });
  }

  // ------------------------------------------------------------ Menús
  ui(name) {
    switch (name) {
      case 'move':
        this.tone(740, 0.045, { type: 'square', vol: 0.04 });
        break;
      case 'select':
        this.tone(880, 0.07, { type: 'square', vol: 0.06 });
        this.tone(1320, 0.1, { type: 'square', vol: 0.05, delay: 0.06 });
        break;
      case 'back':
        this.tone(520, 0.08, { type: 'square', vol: 0.05, to: 330 });
        break;
      case 'error':
        this.tone(180, 0.18, { type: 'square', vol: 0.06 });
        break;
      case 'start':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, { type: 'square', vol: 0.06, delay: i * 0.07 }));
        break;
      default:
        break;
    }
  }
}
