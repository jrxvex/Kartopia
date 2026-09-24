// Secuenciador musical: interpreta canciones definidas en data/music.json (acordes, melodías en
// notación de texto, estilos de bajo/arpegio/batería) y las programa con precisión usando el
// reloj de Web Audio (planificación anticipada). Soporta cambio de tempo (última vuelta),
// temas temporales (aura prisma) y sintonías cortas (meta, victoria...).
import { SynthVoices, midiToFreq } from './SynthVoices.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITIES = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
  9: [0, 4, 7, 10, 14],
  5: [0, 7],
};

export function parseNote(tok) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok);
  if (!m) return null;
  let n = NOTE[m[1]];
  if (m[2] === '#') n++;
  else if (m[2] === 'b') n--;
  return 12 * (Number(m[3]) + 1) + n;
}

export function parseChord(sym) {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym || 'C');
  if (!m) return { root: 0, intervals: [0, 4, 7] };
  let r = NOTE[m[1]];
  if (m[2] === '#') r++;
  else if (m[2] === 'b') r--;
  const q = QUALITIES[m[3]] || QUALITIES[m[3].replace('min', 'm')] || [0, 4, 7];
  return { root: (r + 12) % 12, intervals: q };
}

const DRUMS = {
  pop: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  rock: { kick: 'x...x...x.x.x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  disco: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.' },
  techno: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'xxxxxxxxxxxxxxxx' },
  breakbeat: { kick: 'x.........x..x..', snare: '....x..x.x..x...', hat: 'x.x.x.x.x.x.x.x.', tom: '..............x.' },
  halftime: { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' },
  latin: { kick: 'x..x..x.x..x..x.', snare: '..x.....x.x.....', hat: 'x.xxx.xxx.xxx.xx' },
  march: { kick: 'x.......x.......', snare: '....x.x.....x.xx', hat: 'x...x...x...x...' },
  shuffle: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x..x..x.xx.x..x.' },
  tribal: { kick: 'x..x....x..x....', tom: '....x.x....xx.x.', hat: 'x.x.x.x.x.x.x.x.' },
  none: {},
};

export class MusicPlayer {
  constructor(audio) {
    this.audio = audio;
    this.ctx = audio.ctx;
    this.voices = new SynthVoices(this.ctx, audio.noiseBuffer);
    this.out = this.ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(audio.musicBus);
    // eco para la melodía
    this.leadBus = this.ctx.createGain();
    this.leadBus.connect(this.out);
    this.delay = this.ctx.createDelay(1.5);
    this.fb = this.ctx.createGain();
    this.wet = this.ctx.createGain();
    this.leadBus.connect(this.delay);
    this.delay.connect(this.fb);
    this.fb.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this.out);
    this.fb.gain.value = 0.28;
    this.wet.gain.value = 0;
    this.songs = audio.songs;
    this.song = null;
    this.songId = null;
    this.tempoMul = 1;
    this.timer = null;
    this.playing = false;
  }

  play(id, { restart = false } = {}) {
    if (!this.songs[id]) id = 'menu';
    if (!this.songs[id]) return;
    if (this.songId === id && this.playing && !restart) return;
    this.stop(0.25, true);
    this.songId = id;
    this.song = this.compile(this.songs[id]);
    this.tempoMul = 1;
    this.pos = 0;
    this.bar = 0;
    this.step = 0;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.4);
    this.nextTime = this.ctx.currentTime + 0.12;
    this.wet.gain.value = this.song.inst.lead.delay ?? 0;
    this.delay.delayTime.value = this.stepDur() * 3;
    this.playing = true;
    this.schedule();
  }

  compile(def) {
    const sections = {};
    for (const [name, sec] of Object.entries(def.sections)) {
      sections[name] = {
        chords: sec.chords.map(parseChord),
        lead: sec.lead ? sec.lead.map((bar) => bar.trim().split(/\s+/)) : null,
        drums: sec.drums || def.drums || 'pop',
        arp: sec.arp !== undefined ? sec.arp : def.arpStyle,
        bass: sec.bass || def.bassStyle || 'root8',
        pad: sec.pad !== undefined ? sec.pad : def.pad,
        bars: sec.chords.length,
      };
    }
    const inst = {
      lead: { wave: 'square', vol: 0.1, ...(def.instruments?.lead || {}) },
      bass: { wave: 'sawtooth', vol: 0.17, ...(def.instruments?.bass || {}) },
      pad: { wave: 'sawtooth', vol: 0.04, ...(def.instruments?.pad || {}) },
      arp: { wave: 'triangle', vol: 0.045, ...(def.instruments?.arp || {}) },
      drums: { vol: 1, ...(def.instruments?.drums || {}) },
    };
    return { bpm: def.bpm || 120, swing: def.swing || 0, sections, order: def.order || Object.keys(sections), loopFrom: def.loopFrom ?? 0, inst, loop: def.loop !== false };
  }

  stepDur() {
    return 60 / (this.song.bpm * this.tempoMul) / 4;
  }

  setTempo(mul) {
    this.tempoMul = mul;
    if (this.song) this.delay.delayTime.setTargetAtTime(this.stepDur() * 3, this.ctx.currentTime, 0.2);
  }

  stop(fade = 0.5, immediate = false) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.playing = false;
    if (!immediate) {
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0.0001, t + fade);
    }
    this.songId = immediate ? this.songId : null;
  }

  schedule() {
    if (!this.playing) return;
    const ahead = this.ctx.currentTime + 0.15;
    while (this.nextTime < ahead) {
      this.scheduleStep(this.nextTime);
      const sd = this.stepDur();
      this.nextTime += sd;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar++;
        const sec = this.song.sections[this.song.order[this.pos]];
        if (this.bar >= sec.bars) {
          this.bar = 0;
          this.pos++;
          if (this.pos >= this.song.order.length) {
            if (!this.song.loop) {
              this.playing = false;
              if (this.onEnd) this.onEnd();
              return;
            }
            this.pos = this.song.loopFrom;
          }
        }
      }
    }
    this.timer = setTimeout(() => this.schedule(), 25);
  }

  scheduleStep(time) {
    const song = this.song;
    const sec = song.sections[song.order[this.pos]];
    const chord = sec.chords[this.bar];
    const st = this.step;
    const sd = this.stepDur();
    const swing = st % 2 === 1 ? song.swing * sd : 0;
    const t = time + swing;
    const v = this.voices;
    const inst = song.inst;
    const isLastBar = this.bar === sec.bars - 1 && sec.bars >= 4;

    // Pad
    if (sec.pad && st === 0) {
      const freqs = chord.intervals.slice(0, 4).map((iv) => midiToFreq(60 + ((chord.root + iv) % 12) + (chord.root + iv >= 12 ? 0 : 0)));
      v.pad(this.out, t, freqs, sd * 16, inst.pad);
    }
    // Melodía
    if (sec.lead) {
      const bar = sec.lead[this.bar];
      if (bar && bar.length) {
        const per = 16 / bar.length;
        if (st % per === 0) {
          const idx = st / per;
          const tok = bar[idx];
          const midi = parseNote(tok);
          if (midi !== null) {
            let holds = 0;
            for (let k = idx + 1; k < bar.length && bar[k] === '-'; k++) holds++;
            v.lead(this.leadBus, t, midiToFreq(midi), sd * per * (1 + holds) * 0.95, inst.lead);
          }
        }
      }
    }
    // Bajo
    const root = 36 + chord.root;
    const fifth = root + 7;
    const third = root + chord.intervals[1];
    const bassNote = (m, len) => v.bass(this.out, t, midiToFreq(m), sd * len, inst.bass);
    switch (sec.bass) {
      case 'octave':
        if (st % 2 === 0) bassNote(st % 4 === 0 ? root : root + 12, 2);
        break;
      case 'walk':
        if (st % 4 === 0) bassNote([root, third, fifth, root + 9 + (chord.intervals[1] === 3 ? 1 : 0)][st / 4], 4);
        break;
      case 'pump':
        if (st % 2 === 0) bassNote(st === 14 ? fifth : root, 1.6);
        break;
      case 'sixteenth':
        bassNote(st % 8 === 6 ? root + 12 : root, 0.9);
        break;
      case 'reggae':
        if (st === 0 || st === 6 || st === 8 || st === 11) bassNote(st === 11 ? fifth : root, 2);
        break;
      case 'funk':
        if ([0, 3, 6, 10, 12].includes(st)) bassNote(st === 3 || st === 10 ? root + 12 : root, 1.5);
        break;
      case 'sustain':
        if (st === 0) bassNote(root, 14);
        if (st === 12) bassNote(fifth, 4);
        break;
      default:
        if (st % 2 === 0) bassNote(st >= 12 ? fifth : root, 2);
    }
    // Arpegio
    if (sec.arp) {
      const tones = chord.intervals.map((iv) => 60 + chord.root + iv);
      const ext = [...tones, ...tones.map((n) => n + 12)];
      let note = null;
      if (sec.arp === 'up16') note = ext[st % ext.length];
      else if (sec.arp === 'updown8' && st % 2 === 0) {
        const seq = [...ext, ...ext.slice(1, -1).reverse()];
        note = seq[(st / 2) % seq.length];
      } else if (sec.arp === 'broken' && st % 2 === 0) note = [tones[0], tones[2] ?? tones[1], tones[1], tones[2] ?? tones[1]][(st / 2) % 4] + 12;
      else if (sec.arp === 'bells' && st % 4 === 2) note = ext[(st / 4 + this.bar) % ext.length] + 12;
      if (note !== null) {
        if (inst.arp.wave === 'fm-bell' || inst.arp.wave === 'marimba') v.bell(this.out, t, midiToFreq(note), sd * 2, inst.arp.vol, inst.arp.wave === 'marimba' ? 2 : 3.5);
        else v.pluck(this.out, t, midiToFreq(note), sd * 2, inst.arp);
      }
    }
    // Batería
    const pat = DRUMS[sec.drums] || DRUMS.pop;
    const dv = inst.drums.vol;
    const hit = (p) => p && p[st] === 'x';
    if (isLastBar && st >= 8 && sec.drums !== 'none') {
      // redoble de final de sección
      if (st >= 12 || st % 2 === 0) v.snare(this.out, t, (0.12 + (st - 8) * 0.015) * dv);
      if (st === 8 || st === 12) v.kick(this.out, t, 0.45 * dv);
      if (st === 10 || st === 14) v.tom(this.out, t, st === 10 ? 160 : 110, 0.2 * dv);
      return;
    }
    if (hit(pat.kick)) v.kick(this.out, t, 0.45 * dv);
    if (hit(pat.snare)) v.snare(this.out, t, 0.2 * dv);
    if (hit(pat.clap)) v.clap(this.out, t, 0.18 * dv);
    if (hit(pat.hat)) v.hat(this.out, t, 0.05 * dv);
    if (hit(pat.ohat)) v.hat(this.out, t, 0.04 * dv, true);
    if (hit(pat.shaker)) v.hat(this.out, t, 0.018 * dv);
    if (hit(pat.tom)) v.tom(this.out, t, 130 + (st % 3) * 30, 0.2 * dv);
  }

  /** Sintonía corta no cíclica. notes: "C5:2 E5:2 ..." (duración en semicorcheas). */
  jingle(def) {
    if (!def) return 0;
    const ctx = this.ctx;
    const bpm = def.bpm || 150;
    const sd = 60 / bpm / 4;
    let t = ctx.currentTime + 0.05;
    const inst = { wave: def.wave || 'square', vol: def.vol ?? 0.13, vibrato: 0.6, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.12 };
    const bus = ctx.createGain();
    bus.connect(this.audio.musicBus);
    const start = t;
    for (const tok of def.notes.trim().split(/\s+/)) {
      const [n, d] = tok.split(':');
      const len = Number(d || 2);
      if (n !== '.') {
        const chordNotes = n.split('+');
        for (const cn of chordNotes) {
          const midi = parseNote(cn);
          if (midi !== null) {
            this.voices.lead(bus, t, midiToFreq(midi), sd * len * 0.92, inst);
            if (cn === chordNotes[0]) this.voices.bass(bus, t, midiToFreq(midi - 24), sd * len * 0.9, { wave: 'triangle', vol: 0.12 });
          }
        }
        if (def.drums !== false) {
          this.voices.kick(bus, t, 0.3);
          if (len >= 4) this.voices.snare(bus, t, 0.12);
        }
      }
      t += sd * len;
    }
    return t - start;
  }
}
