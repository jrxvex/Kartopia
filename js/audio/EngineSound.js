// Sonido de motor sintetizado por kart: osciladores con marchas simuladas; el tono y el VOLUMEN
// dependen de la velocidad y del acelerador. Los motores rivales se atenúan con la distancia.

export class EngineSound {
  constructor(audio, kart, isPlayer) {
    const ctx = audio.ctx;
    this.audio = audio;
    this.kart = kart;
    this.isPlayer = isPlayer;
    this.base = 52 * (kart.character.enginePitch || 1);
    this.o1 = ctx.createOscillator();
    this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator();
    this.o2.type = 'square';
    this.o3 = ctx.createOscillator();
    this.o3.type = 'sine';
    this.m1 = ctx.createGain();
    this.m2 = ctx.createGain();
    this.m3 = ctx.createGain();
    this.m1.gain.value = 0.5;
    this.m2.gain.value = 0.28;
    this.m3.gain.value = 0.6;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 2.5;
    this.filter.frequency.value = 600;
    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    this.shaper.curve = curve;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.o1.connect(this.m1);
    this.o2.connect(this.m2);
    this.o3.connect(this.m3);
    this.m1.connect(this.filter);
    this.m2.connect(this.filter);
    this.m3.connect(this.filter);
    this.filter.connect(this.shaper);
    this.shaper.connect(this.gain);
    this.gain.connect(this.pan);
    this.pan.connect(audio.engineBus);
    const t = ctx.currentTime;
    this.o1.start(t);
    this.o2.start(t);
    this.o3.start(t);
    this.rpm = 0.2;
    this.time = Math.random() * 10;
    this.muted = false;
  }

  update(dt, listener) {
    const k = this.kart;
    const ctx = this.audio.ctx;
    const now = ctx.currentTime;
    this.time += dt;
    const speed = Math.abs(k.forwardSpeed || 0);
    const max = k.params.maxSpeed;
    const ratio = Math.min(1.45, speed / max);
    const throttle = Math.max(0, k.input.throttle || 0);
    const boosting = k.boostTime > 0 || k.comet > 0;
    // Marchas: el régimen sube dentro de cada marcha y cae al cambiar
    let target;
    if (speed < 1.2) {
      target = 0.18 + (k.revving || throttle > 0.5 ? 0.45 + Math.sin(this.time * 9) * 0.05 : 0) + Math.sin(this.time * 22) * 0.01;
    } else {
      const gears = 5;
      const g = Math.min(gears - 1, Math.floor(ratio * gears));
      const within = ratio * gears - g;
      target = 0.3 + within * 0.62 + g * 0.1;
      if (ratio >= 1) target = 0.95 + (ratio - 1) * 0.8;
    }
    if (!k.grounded) target += 0.12;
    this.rpm += (target - this.rpm) * Math.min(1, dt * 9);
    const f = this.base * (0.8 + this.rpm * 2.2) * (boosting ? 1.12 : 1);
    this.o1.frequency.setTargetAtTime(f, now, 0.03);
    this.o2.frequency.setTargetAtTime(f * 0.5, now, 0.03);
    this.o3.frequency.setTargetAtTime(f * 0.25, now, 0.03);
    this.filter.frequency.setTargetAtTime(420 + ratio * 2400 + throttle * 700 + (boosting ? 1500 : 0), now, 0.05);
    // Volumen: crece con la velocidad y el acelerador
    let vol = 0.045 + ratio * 0.12 + throttle * 0.035 + (boosting ? 0.04 : 0);
    let pan = 0;
    if (!this.isPlayer && listener) {
      const dx = k.pos.x - listener.x;
      const dz = k.pos.z - listener.z;
      const d = Math.hypot(dx, dz);
      const att = Math.max(0, 1 - d / 55);
      vol *= att * att * 0.7;
      const rx = -Math.cos(listener.yaw);
      const rz = Math.sin(listener.yaw);
      pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
    }
    if (k.respawn.active || this.muted) vol = 0;
    this.gain.gain.setTargetAtTime(vol, now, 0.05);
    this.pan.pan.setTargetAtTime(pan, now, 0.05);
  }

  stop() {
    const t = this.audio.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, 0.05);
    for (const o of [this.o1, this.o2, this.o3]) {
      try {
        o.stop(t + 0.3);
      } catch (e) {
        /* ya parado */
      }
    }
    setTimeout(() => this.pan.disconnect(), 500);
  }
}
