// Instrumentos sintetizados con Web Audio API (todo el sonido del juego es original y generado
// en tiempo real): melodías (pulso, cuadrada, sierra, triángulo, campana FM, órgano), bajo,
// pads, arpegios y batería (bombo, caja, charles, palmas, toms).

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class SynthVoices {
  constructor(ctx, noiseBuffer) {
    this.ctx = ctx;
    this.noise = noiseBuffer;
    this.waves = {};
    this.waves.pulse25 = this.pulseWave(0.25);
    this.waves.pulse12 = this.pulseWave(0.125);
    this.waves.organ = this.organWave();
  }

  pulseWave(duty) {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) real[i] = (4 / (Math.PI * i)) * Math.sin(Math.PI * i * duty);
    return this.ctx.createPeriodicWave(real, imag);
  }

  organWave() {
    const real = new Float32Array(16);
    const imag = new Float32Array(16);
    const h = [0, 1, 0.8, 0.3, 0.45, 0.1, 0.25, 0, 0.18];
    for (let i = 1; i < h.length; i++) imag[i] = h[i];
    return this.ctx.createPeriodicWave(real, imag);
  }

  osc(type, freq, time) {
    const o = this.ctx.createOscillator();
    if (this.waves[type]) o.setPeriodicWave(this.waves[type]);
    else o.type = type;
    o.frequency.setValueAtTime(freq, time);
    return o;
  }

  env(g, time, dur, a, d, s, r, peak) {
    const p = g.gain;
    p.setValueAtTime(0.0001, time);
    p.linearRampToValueAtTime(peak, time + a);
    p.linearRampToValueAtTime(Math.max(0.0001, peak * s), time + a + d);
    const end = time + Math.max(dur, a + d);
    p.setValueAtTime(Math.max(0.0001, peak * s), end);
    p.exponentialRampToValueAtTime(0.0001, end + r);
    return end + r;
  }

  /** Voz melódica. inst: {wave, vol, attack, decay, sustain, release, vibrato, detune} */
  lead(dest, time, freq, dur, inst = {}) {
    const ctx = this.ctx;
    const vol = inst.vol ?? 0.12;
    if (inst.wave === 'fm-bell' || inst.wave === 'marimba') return this.bell(dest, time, freq, dur, vol, inst.wave === 'marimba' ? 2.0 : 3.5);
    const g = ctx.createGain();
    const o = this.osc(inst.wave || 'square', freq, time);
    let o2 = null;
    if (inst.detune) {
      o2 = this.osc(inst.wave || 'square', freq, time);
      o2.detune.setValueAtTime(inst.detune, time);
      o2.connect(g);
    }
    if (inst.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, time);
      lg.gain.linearRampToValueAtTime(freq * 0.012 * inst.vibrato, time + Math.min(0.4, dur * 0.6));
      lfo.connect(lg);
      lg.connect(o.frequency);
      if (o2) lg.connect(o2.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.6);
    }
    let node = g;
    if (inst.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = inst.filter;
      g.connect(f);
      node = f;
    }
    o.connect(g);
    node.connect(dest);
    const end = this.env(g, time, dur, inst.attack ?? 0.01, inst.decay ?? 0.08, inst.sustain ?? 0.6, inst.release ?? 0.08, vol);
    o.start(time);
    o.stop(end + 0.02);
    if (o2) {
      o2.start(time);
      o2.stop(end + 0.02);
    }
  }

  /** Campana/metalófono FM (tambor metálico, marimba). */
  bell(dest, time, freq, dur, vol = 0.12, ratio = 3.5) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.setValueAtTime(freq, time);
    mod.frequency.setValueAtTime(freq * ratio, time);
    mg.gain.setValueAtTime(freq * 2.2, time);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, time + 0.5);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(g);
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.005);
    const end = time + Math.max(0.25, Math.min(1.2, dur * 1.5));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    car.start(time);
    mod.start(time);
    car.stop(end + 0.02);
    mod.stop(end + 0.02);
  }

  bass(dest, time, freq, dur, inst = {}) {
    const ctx = this.ctx;
    const o = this.osc(inst.wave || 'sawtooth', freq, time);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(inst.cutoff ?? 900, time);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, (inst.cutoff ?? 900) * 0.3), time + Math.min(0.25, dur));
    const g = ctx.createGain();
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    const end = this.env(g, time, dur * 0.9, 0.005, 0.06, 0.75, 0.05, inst.vol ?? 0.16);
    o.start(time);
    o.stop(end + 0.02);
  }

  pad(dest, time, freqs, dur, inst = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = inst.cutoff ?? 1400;
    g.connect(f);
    f.connect(dest);
    const vol = (inst.vol ?? 0.05) / Math.sqrt(freqs.length);
    const end = this.env(g, time, dur, inst.attack ?? 0.25, 0.3, 0.8, inst.release ?? 0.4, vol);
    for (const fr of freqs) {
      for (const d of [-7, 7]) {
        const o = this.osc(inst.wave || 'sawtooth', fr, time);
        o.detune.value = d;
        o.connect(g);
        o.start(time);
        o.stop(end + 0.05);
      }
    }
  }

  pluck(dest, time, freq, dur, inst = {}) {
    const ctx = this.ctx;
    const o = this.osc(inst.wave || 'triangle', freq, time);
    const g = ctx.createGain();
    o.connect(g);
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(inst.vol ?? 0.06, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.35, dur * 1.2) + 0.05);
    o.start(time);
    o.stop(time + Math.min(0.35, dur * 1.2) + 0.1);
  }

  // ------------------------------------------------------------------ Batería
  noiseSrc(time) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(time, Math.random() * 1.5);
    return s;
  }

  kick(dest, time, vol = 0.5) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(155, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    o.connect(g);
    g.connect(dest);
    o.start(time);
    o.stop(time + 0.3);
  }

  snare(dest, time, vol = 0.22) {
    const ctx = this.ctx;
    const n = this.noiseSrc(time);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.stop(time + 0.2);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, time);
    o.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    og.gain.setValueAtTime(vol * 0.8, time);
    og.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    o.connect(og);
    og.connect(dest);
    o.start(time);
    o.stop(time + 0.12);
  }

  hat(dest, time, vol = 0.06, open = false) {
    const ctx = this.ctx;
    const n = this.noiseSrc(time);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    const len = open ? 0.22 : 0.045;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.stop(time + len + 0.02);
  }

  clap(dest, time, vol = 0.18) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1300;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    f.connect(g);
    g.connect(dest);
    g.gain.setValueAtTime(0.0001, time);
    for (let i = 0; i < 3; i++) {
      g.gain.setValueAtTime(vol, time + i * 0.012);
      g.gain.exponentialRampToValueAtTime(vol * 0.2, time + i * 0.012 + 0.01);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    const n = this.noiseSrc(time);
    n.connect(f);
    n.stop(time + 0.2);
  }

  tom(dest, time, freq = 140, vol = 0.25) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(freq, time);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, time + 0.2);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    o.connect(g);
    g.connect(dest);
    o.start(time);
    o.stop(time + 0.27);
  }
}
