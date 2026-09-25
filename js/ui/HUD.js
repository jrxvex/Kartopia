// HUD de carrera: objeto (con ruleta), posición, vueltas, cronómetro, tiempos por vuelta,
// velocímetro con indicador de derrape, minimapa, clasificación lateral, barra de progreso
// de la carrera, cuenta atrás y mensajes (mini-turbo, truco, última vuelta, meta...).
import { h } from './dom.js';
import { Minimap } from './Minimap.js';
import { formatTime, clamp } from '../core/MathUtils.js';
import { PHYSICS } from '../config.js';

const DRIFT_NAMES = ['', '¡MINI-TURBO!', '¡SÚPER TURBO!', '¡ULTRA TURBO!'];

/** Escribe texto solo si ha cambiado (evita repintados innecesarios). */
function setText(el, text) {
  if (el._text !== text) {
    el._text = text;
    el.textContent = text;
  }
}

/** Cambia una variable CSS solo si su valor es distinto. */
function setVar(el, name, value) {
  const key = `_var${name}`;
  if (el[key] !== value) {
    el[key] = value;
    el.style.setProperty(name, value);
  }
}

const q2 = (v) => (Math.round(v * 50) / 50).toString();
const DRIFT_CLASS = ['', 'blue', 'orange', 'purple'];

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.race = null;
    this.build();
  }

  build() {
    this.el = {};
    const e = this.el;
    e.itemFrame = h('div.item-frame', (e.itemIcon = h('img.item-icon', { alt: '' })), (e.itemUses = h('span.item-uses')));
    e.itemName = h('div.item-name');
    e.item = h('div.hud-item', e.itemFrame, e.itemName);
    e.lap = h('div.hud-lap', 'VUELTA ', (e.lapNum = h('b', '1')), (e.lapTot = h('span', '/3')));
    e.time = h('div.hud-time', '0:00.000');
    e.lapTimes = h('div.hud-laptimes');
    e.topRight = h('div.hud-topright', e.lap, e.time, e.lapTimes);
    e.progress = h('div.hud-progress', h('div.progress-track'), (e.progressMarks = h('div.progress-marks')));
    e.ranking = h('div.hud-ranking');
    e.speedVal = h('span.speed-value', '0');
    e.speedUnit = h('span.speed-unit', 'km/h');
    e.drift = h('div.drift-meter', h('span.seg.s1'), h('span.seg.s2'), h('span.seg.s3'));
    e.speed = h('div.hud-speed', h('div.speed-dial', h('div.speed-num', e.speedVal, e.speedUnit)), e.drift);
    e.minimapCanvas = h('canvas.minimap-canvas');
    e.minimap = h('div.hud-minimap', e.minimapCanvas);
    e.posNum = h('span.pos-num', '1');
    e.posSuf = h('span.pos-suffix', 'º');
    e.position = h('div.hud-position', e.posNum, e.posSuf);
    e.center = h('div.hud-center');
    e.banner = h('div.hud-banner');
    e.warning = h('div.hud-warning', '⚠ SENTIDO CONTRARIO');
    e.threat = h('div.hud-threat', '¡Te persiguen!');
    e.intro = h('div.hud-intro');
    e.hint = h('div.hud-hint');
    e.safe = h(
      'div.hud-safe',
      e.item,
      e.progress,
      e.topRight,
      e.ranking,
      e.speed,
      e.minimap,
      e.position,
      e.center,
      e.banner,
      e.warning,
      e.threat,
      e.intro,
      e.hint,
    );
    this.root.appendChild(e.safe);
    this.minimap = new Minimap(e.minimapCanvas);
    this._tick = 0;
    window.addEventListener('resize', () => {
      this.minimap.resize();
      this._marksW = 0;
      if (this.rankRows) for (const r of this.rankRows.values()) r.x = null;
    });
  }

  attach(race, view) {
    this.detach();
    this.race = race;
    this.view = view;
    this.focus = view.focus;
    this.messages = [];
    this.lastPos = 0;
    this.lastLap = 0;
    this.lastItem = null;
    this.rouletteT = 0;
    this.rankRows = new Map();
    this._marksW = 0;
    this._lapCount = -1;
    const e = this.el;
    e.ranking.replaceChildren();
    e.progressMarks.replaceChildren();
    this.colors = race.karts.map((k) => k.character.colors.outfit);
    for (const k of race.karts) {
      const row = h(`div.rank-row${k === this.focus ? '.me' : ''}`, h('span.rank-pos'), h('img.rank-face', { src: this.game.portraits[k.character.id] || '', alt: '' }), h('span.rank-name', k.name));
      e.ranking.appendChild(row);
      const mark = h(`div.progress-mark${k === this.focus ? '.me' : ''}`, { style: { background: k.character.colors.outfit } }, k === this.focus ? h('img', { src: this.game.portraits[k.character.id] || '', alt: '' }) : null);
      e.progressMarks.appendChild(mark);
      this.rankRows.set(k, { row, mark, pos: row.querySelector('.rank-pos') });
    }
    const tt = race.mode === 'timetrial';
    e.ranking.classList.toggle('hidden', tt || !this.game.settings.showRanking);
    e.progress.classList.toggle('hidden', tt);
    e.position.classList.toggle('hidden', tt);
    e.minimap.classList.toggle('hidden', !this.game.settings.showMinimap);
    e.lapTot.textContent = `/${race.laps}`;
    e.itemFrame.classList.toggle('hidden', race.items.boxes.length === 0 && !race.player?.item);
    this.minimap.setTrack(race.track);
    requestAnimationFrame(() => this.minimap.resize());
    this.bind(race);
    this.showIntro();
  }

  detach() {
    if (this.offs) for (const off of this.offs) off();
    this.offs = [];
    this.race = null;
    this.el.center.replaceChildren();
    this.el.banner.replaceChildren();
    this.el.banner.className = 'hud-banner';
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  bind(race) {
    const ev = race.events;
    const F = (k) => k === this.focus;
    const on = (t, fn) => this.offs.push(ev.on(t, fn));
    on('race:phase', ({ phase }) => {
      if (phase === 'countdown') this.el.intro.classList.remove('show');
    });
    on('race:countdown', ({ value }) => this.countdown(value));
    on('kart:start-boost', ({ kart }) => F(kart) && this.message('¡SALIDA PERFECTA!', 'gold'));
    on('kart:burnout', ({ kart }) => F(kart) && this.message('¡Motor calado!', 'red'));
    on('kart:miniturbo', ({ kart, level }) => F(kart) && this.message(DRIFT_NAMES[level], DRIFT_CLASS[level]));
    on('kart:trick', ({ kart }) => F(kart) && this.message('¡TRUCO!', 'gold', 0.7));
    on('kart:boostpad', ({ kart }) => F(kart) && this.message('¡TURBO!', 'orange', 0.6));
    on('kart:hit', ({ kart, type }) => F(kart) && type === 'freeze' && this.message('¡CONGELADO!', 'blue'));
    on('kart:shield-pop', ({ kart }) => F(kart) && this.message('¡Escudo roto!', 'blue', 0.8));
    on('kart:fall', ({ kart }) => F(kart) && this.message('¡Al rescate!', 'white', 1));
    on('item:hit', ({ attacker, victim }) => F(attacker) && victim !== attacker && this.message(`¡Impacto a ${victim.name}!`, 'green', 1));
    on('item:get', ({ kart, id }) => {
      if (!F(kart)) return;
      const def = race.items.itemDef(id);
      this.el.itemName.textContent = def ? def.name : '';
      this.el.itemName.classList.add('show');
      clearTimeout(this._nameT);
      this._nameT = setTimeout(() => this.el.itemName.classList.remove('show'), 1600);
      this.el.itemFrame.classList.remove('pop');
      void this.el.itemFrame.offsetWidth;
      this.el.itemFrame.classList.add('pop');
    });
    on('race:lap', ({ kart, lap }) => {
      if (!F(kart) || lap < 2 || lap > race.laps) return;
      const lt = kart.progress.lapTimes[kart.progress.lapTimes.length - 1];
      const best = Math.min(...kart.progress.lapTimes);
      this.message(lap === race.laps ? '' : `VUELTA ${lap}`, 'white', 1.2);
      if (lt === best && kart.progress.lapTimes.length > 1) this.message(`¡Vuelta rápida! ${formatTime(lt * 1000)}`, 'green', 1.6);
    });
    on('race:final-lap', ({ kart }) => F(kart) && this.banner('¡ÚLTIMA VUELTA!', 'final'));
    on('race:finish', ({ kart, position }) => {
      if (!F(kart)) return;
      this.banner(race.mode === 'timetrial' ? '¡META!' : `¡META! ${position}º`, position <= 3 || race.mode === 'timetrial' ? 'finish good' : 'finish');
    });
  }

  showIntro() {
    const r = this.race;
    const meta = this.game.data.track(r.track.id);
    this.el.intro.replaceChildren(h('div.intro-name', meta.name), h('div.intro-sub', this.game.touch?.wanted ? 'Toca la pantalla para saltar la presentación' : 'Pulsa Intro para saltar la presentación'));
    this.el.intro.classList.add('show');
  }

  countdown(v) {
    const text = v > 0 ? String(v) : '¡YA!';
    const el = h(`div.countdown${v === 0 ? '.go' : ''}`, text);
    this.el.center.appendChild(el);
    setTimeout(() => el.remove(), v === 0 ? 1100 : 950);
  }

  message(text, cls = 'white', time = 1.1) {
    if (!text) return;
    const el = h(`div.hud-msg.${cls}`, text);
    this.el.center.appendChild(el);
    setTimeout(() => el.remove(), time * 1000);
  }

  banner(text, cls) {
    const b = this.el.banner;
    b.className = `hud-banner show ${cls}`;
    b.textContent = text;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => (b.className = 'hud-banner'), cls.includes('finish') ? 4200 : 2600);
  }

  update(dt) {
    const race = this.race;
    if (!race) return;
    const e = this.el;
    const k = this.focus;
    const pr = k.progress;
    const s = this.game.settings;
    // El HUD se repinta en la CPU (sobre todo en iOS): cada elemento se toca solo cuando cambia y
    // lo que cambia sin parar (cronómetro, velocímetro, minimapa) se refresca a ~30 Hz.
    this._tick = (this._tick + 1) | 0;
    const slow = (this._tick & 1) === 0;

    // Vuelta y tiempo
    const lap = clamp(pr.lap, 1, race.laps);
    if (lap !== this.lastLap) {
      this.lastLap = lap;
      e.lapNum.textContent = String(lap);
    }
    const t = race.phase === 'racing' || race.phase === 'finished' ? (pr.finished ? pr.finishTime : race.time) : 0;
    if (slow || pr.finished) setText(e.time, formatTime(t * 1000));
    const laps = pr.lapTimes;
    if (laps.length !== this._lapCount) {
      this._lapCount = laps.length;
      e.lapTimes.replaceChildren(...laps.map((lt, i) => h(`div${lt === Math.min(...laps) && laps.length > 1 ? '.best' : ''}`, `V${i + 1} ${formatTime(lt * 1000)}`)));
    }

    // Posición
    if (pr.position !== this.lastPos) {
      this.lastPos = pr.position;
      e.posNum.textContent = String(pr.position);
      e.position.className = `hud-position p${Math.min(pr.position, 4)}${race.mode === 'timetrial' ? ' hidden' : ''}`;
      e.position.classList.remove('bump');
      void e.position.offsetWidth;
      e.position.classList.add('bump');
    }

    // Velocidad
    const mph = s.speedUnit === 'mph';
    setText(e.speedUnit, mph ? 'mph' : 'km/h');
    if (slow) {
      const v = Math.abs(k.forwardSpeed) * 3.6 * (mph ? 0.6214 : 1);
      setText(e.speedVal, String(Math.round(v)));
      const maxV = k.params.maxSpeed * PHYSICS.BOOST_MULT * 3.6 * (mph ? 0.6214 : 1);
      setVar(e.speed, '--speed', (Math.round(clamp(v / maxV, 0, 1) * 100) / 100).toString());
    }
    e.speed.classList.toggle('boost', k.boostTime > 0 || k.comet > 0);
    const d = k.drift;
    const th = PHYSICS.MT_THRESHOLDS;
    e.drift.classList.toggle('active', d.active);
    setVar(e.drift, '--c1', q2(clamp(d.charge / th[0], 0, 1)));
    setVar(e.drift, '--c2', q2(clamp((d.charge - th[0]) / (th[1] - th[0]), 0, 1)));
    setVar(e.drift, '--c3', q2(clamp((d.charge - th[1]) / (th[2] - th[1]), 0, 1)));

    // Objeto / ruleta
    this.updateItem(dt, k, race);

    // Clasificación y progreso (las marcas se mueven con transform: sin recalcular el diseño)
    const total = (race.laps + 1) * race.track.length;
    const start = race.track.length - 30;
    if (!this._marksW) this._marksW = e.progressMarks.clientWidth;
    const W = this._marksW;
    for (const kk of race.karts) {
      const r = this.rankRows.get(kk);
      if (!r) continue;
      const p = kk.progress.position;
      if (r.last !== p) {
        r.last = p;
        r.row.style.transform = `translateY(${(p - 1) * 100}%)`;
        r.pos.textContent = `${p}º`;
      }
      const f = clamp((kk.progress.raceDistance - start) / (total - start), 0, 1);
      const x = Math.round(f * W * 2) / 2;
      if (x !== r.x && W) {
        r.x = x;
        r.mark.style.transform = `translate(calc(${x}px - 50%), -50%)`;
      }
    }

    // Avisos
    e.warning.classList.toggle('show', pr.wrongWay > 1.2 && !pr.finished && race.phase === 'racing');
    const targeted = race.items.entities.some((en) => en.target === k && !en.dead);
    e.threat.classList.toggle('show', targeted);
    const stuck = race.phase === 'racing' && !pr.finished && Math.abs(k.forwardSpeed) < 1 && k.grounded && k.input.throttle > 0.5;
    this._stuckT = stuck ? (this._stuckT || 0) + dt : 0;
    setText(e.hint, this._stuckT > 3 ? '¿Atascado? Pulsa R para el rescate' : '');
    e.hint.classList.toggle('show', this._stuckT > 3);

    if (s.showMinimap && slow) this.minimap.draw(race, k, this.colors);
  }

  updateItem(dt, k, race) {
    const e = this.el;
    const defs = race.items.defs;
    if (k.roulette) {
      this.rouletteT -= dt;
      if (this.rouletteT <= 0) {
        this.rouletteT = 0.075;
        const d = defs[Math.floor(Math.random() * defs.length)];
        e.itemIcon.src = d.icon;
        e.itemIcon.classList.remove('hidden');
      }
      e.itemFrame.classList.add('spinning');
      e.itemUses.textContent = '';
      this.lastItem = '__roulette';
      return;
    }
    e.itemFrame.classList.remove('spinning');
    const key = k.item ? `${k.item.id}:${k.item.uses}:${k.item.active}` : k.held ? 'held' : null;
    if (key === this.lastItem) return;
    this.lastItem = key;
    if (k.item) {
      const def = race.items.itemDef(k.item.id);
      e.itemIcon.src = def.icon;
      e.itemIcon.classList.remove('hidden');
      e.itemUses.textContent = k.item.uses > 1 ? `×${k.item.uses}` : '';
      e.itemFrame.classList.toggle('active-item', !!k.item.active);
    } else if (k.held) {
      e.itemIcon.src = race.items.itemDef('goo-trap').icon;
      e.itemIcon.classList.remove('hidden');
      e.itemUses.textContent = '';
      e.itemFrame.classList.add('active-item');
    } else {
      e.itemIcon.classList.add('hidden');
      e.itemUses.textContent = '';
      e.itemFrame.classList.remove('active-item');
    }
  }
}
