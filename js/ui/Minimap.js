// Minimapa 2D del circuito con karts, cajas y proyectiles.

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.static = document.createElement('canvas');
    this.track = null;
    this.dpr = 1;
  }

  setTrack(track) {
    this.track = track;
    this.resize();
  }

  resize() {
    const t = this.track;
    if (!t) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(60, Math.round(this.canvas.clientWidth * dpr));
    const hgt = Math.max(60, Math.round(this.canvas.clientHeight * dpr));
    if (w === this.canvas.width && hgt === this.canvas.height && this.map) return;
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = hgt;
    this.static.width = w;
    this.static.height = hgt;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < t.N; i++) {
      const x = -t.px[i];
      const y = -t.pz[i];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const pad = 14 * dpr;
    const sc = Math.min((w - pad * 2) / (maxX - minX || 1), (hgt - pad * 2) / (maxY - minY || 1));
    const ox = (w - (maxX - minX) * sc) / 2 - minX * sc;
    const oy = (hgt - (maxY - minY) * sc) / 2 - minY * sc;
    this.map = (x, z) => [-x * sc + ox, -z * sc + oy];
    this.scale = sc;
    const ctx = this.static.getContext('2d');
    ctx.clearRect(0, 0, w, hgt);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const roadW = Math.max(3 * dpr, 16 * sc);
    const trace = (src, n, closed, skip = null) => {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        if (skip && skip(i)) {
          started = false;
          continue;
        }
        const [x, y] = this.map(src.px[i], src.pz[i]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      if (closed && !skip) ctx.closePath();
    };
    // atajos
    for (const sc2 of t.shortcuts || []) {
      trace(sc2, sc2.N, false);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = roadW * 0.6 + 3 * dpr;
      ctx.stroke();
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.strokeStyle = 'rgba(255,230,160,0.8)';
      ctx.lineWidth = roadW * 0.45;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const isGap = (i) => (t.flags[i] & 8) !== 0;
    trace(t, t.N, true);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = roadW + 5 * dpr;
    ctx.stroke();
    trace(t, t.N, true);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = roadW;
    ctx.stroke();
    // huecos
    ctx.strokeStyle = 'rgba(255,82,82,0.9)';
    ctx.lineWidth = roadW * 0.6;
    for (let i = 0; i < t.N; i++) {
      if (!isGap(i)) continue;
      const j = (i + 1) % t.N;
      const [x1, y1] = this.map(t.px[i], t.pz[i]);
      const [x2, y2] = this.map(t.px[j], t.pz[j]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // meta
    const [sx, sy] = this.map(t.px[0], t.pz[0]);
    const rx = -t.rx[0];
    const rz = -t.rz[0];
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.moveTo(sx - rx * roadW * 0.7, sy - rz * roadW * 0.7);
    ctx.lineTo(sx + rx * roadW * 0.7, sy + rz * roadW * 0.7);
    ctx.stroke();
    ctx.strokeStyle = '#ffd740';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
  }

  draw(race, focus, colors) {
    if (!this.track || !this.map) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.static, 0, 0);
    // cajas
    ctx.fillStyle = 'rgba(255,215,64,0.85)';
    for (const b of race.items.boxes) {
      if (!b.active) continue;
      const [x, y] = this.map(b.x, b.z);
      ctx.fillRect(x - 1.5 * dpr, y - 1.5 * dpr, 3 * dpr, 3 * dpr);
    }
    // entidades
    for (const e of race.items.entities) {
      if (e.dead || e.held) continue;
      const [x, y] = this.map(e.pos.x, e.pos.z);
      ctx.fillStyle = e.visualType === 'seeker-orb' ? '#ff1744' : e.visualType === 'goo-trap' ? '#ce93d8' : e.visualType === 'blast-bomb' ? '#212121' : '#76ff03';
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    // karts (el foco se dibuja al final)
    const karts = [...race.karts].sort((a, b) => (a === focus ? 1 : 0) - (b === focus ? 1 : 0));
    for (const k of karts) {
      if (k.respawn.active && k.respawn.phase === 'fall') continue;
      const [x, y] = this.map(k.pos.x, k.pos.z);
      const isF = k === focus;
      const r = (isF ? 6 : 4.2) * dpr;
      ctx.fillStyle = colors[k.index] || '#fff';
      ctx.strokeStyle = isF ? '#ffffff' : 'rgba(0,0,0,0.8)';
      ctx.lineWidth = (isF ? 2.5 : 1.5) * dpr;
      if (isF) {
        // dirección en pantalla: x = -x mundo, y = -z mundo
        const ang = Math.atan2(-Math.cos(k.yaw), -Math.sin(k.yaw));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.5);
        ctx.lineTo(r, r);
        ctx.lineTo(0, r * 0.5);
        ctx.lineTo(-r, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
