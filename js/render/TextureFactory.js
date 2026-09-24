// Texturas procedurales generadas con Canvas 2D (100% originales, sin archivos externos):
// asfalto, bordillos, tablones, metal, piedra, arena, nieve, neón, cuadros de meta, paneles
// turbo, cajas de objetos, fachadas, ruido de detalle y sprites para partículas/nubes.
import * as THREE from 'three';
import { Random } from '../core/Random.js';

const cache = new Map();
let maxAniso = 4;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, { srgb = true, repeat = true, aniso = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (aniso) t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function speckle(ctx, w, h, rng, count, colors, sizeMin = 1, sizeMax = 2.5) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng.next() * colors.length)];
    const s = rng.range(sizeMin, sizeMax);
    ctx.fillRect(rng.next() * w, rng.next() * h, s, s);
  }
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

export const TextureFactory = {
  init(renderer) {
    maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  },

  clear() {
    for (const t of cache.values()) if (t && t.dispose) t.dispose();
    cache.clear();
  },

  /** Asfalto con líneas de borde y línea central discontinua. u: 0..1 transversal. */
  road(style = 'asphalt', color = '#5b6066', line = '#ffffff') {
    return cached(`road:${style}:${color}:${line}`, () => {
      const W = 512;
      const H = 512;
      const c = makeCanvas(W, H);
      const ctx = c.getContext('2d');
      const rng = new Random(`road-${style}`);
      if (style === 'planks') {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, W, H);
        const plank = H / 10;
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = shade(color, rng.range(0.82, 1.12));
          ctx.fillRect(0, i * plank + 2, W, plank - 4);
          ctx.strokeStyle = 'rgba(40,20,5,0.35)';
          ctx.lineWidth = 2;
          for (let k = 0; k < 6; k++) {
            ctx.beginPath();
            const y = i * plank + rng.range(6, plank - 6);
            ctx.moveTo(0, y);
            for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + k) * 2);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(30,15,5,0.8)';
          for (const x of [W * 0.1, W * 0.5, W * 0.9]) {
            ctx.beginPath();
            ctx.arc(x, i * plank + plank / 2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 0; i <= 10; i++) ctx.fillRect(0, i * plank - 2, W, 4);
        return toTexture(c);
      }
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      const base = new THREE.Color(color);
      if (style === 'dirt' || style === 'mud' || style === 'sand' || style === 'snow') {
        speckle(ctx, W, H, rng, 9000, [shade(color, 0.8), shade(color, 1.15), shade(color, 0.92), shade(color, 1.06)], 1, 4);
        ctx.strokeStyle = `rgba(0,0,0,${style === 'snow' ? 0.08 : 0.15})`;
        ctx.lineWidth = 14;
        for (const x of [W * 0.3, W * 0.7]) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          for (let y = 0; y <= H; y += 32) ctx.lineTo(x + Math.sin(y * 0.02) * 6, y);
          ctx.stroke();
        }
        return toTexture(c);
      }
      if (style === 'stone') {
        const rows = 8;
        const rh = H / rows;
        for (let r = 0; r < rows; r++) {
          let x = r % 2 ? -rh / 2 : 0;
          while (x < W) {
            const w = rng.range(rh * 0.8, rh * 1.5);
            ctx.fillStyle = shade(color, rng.range(0.78, 1.15));
            ctx.beginPath();
            ctx.roundRect(x + 3, r * rh + 3, w - 6, rh - 6, 8);
            ctx.fill();
            x += w;
          }
        }
        speckle(ctx, W, H, rng, 3000, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.08)'], 1, 3);
        return toTexture(c);
      }
      if (style === 'metal') {
        const n = 4;
        const s = W / n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            ctx.fillStyle = shade(color, rng.range(0.85, 1.1));
            ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            for (let k = 0; k < 14; k++) ctx.fillRect(i * s + 10 + ((k * 9) % (s - 20)), j * s + 10 + ((k * 23) % (s - 20)), 3, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            for (const [a, b] of [[8, 8], [s - 12, 8], [8, s - 12], [s - 12, s - 12]]) {
              ctx.beginPath();
              ctx.arc(i * s + a + 2, j * s + b + 2, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else if (style === 'neon') {
        ctx.fillStyle = shade(color, 1);
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(120,200,255,0.18)';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo((i * W) / 8, 0);
          ctx.lineTo((i * W) / 8, H);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, (i * H) / 8);
          ctx.lineTo(W, (i * H) / 8);
          ctx.stroke();
        }
      } else {
        // asfalto: grano, manchas y rodadas
        const lum = (base.r + base.g + base.b) / 3;
        speckle(ctx, W, H, rng, 16000, ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.08)', `rgba(255,255,255,${lum > 0.3 ? 0.05 : 0.12})`], 1, 2.2);
        for (let i = 0; i < 18; i++) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
          g.addColorStop(0, 'rgba(0,0,0,0.10)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.save();
          ctx.translate(rng.next() * W, rng.next() * H);
          ctx.scale(rng.range(0.6, 1.8), rng.range(0.6, 1.8));
          ctx.fillStyle = g;
          ctx.fillRect(-60, -60, 120, 120);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (const x of [0.24, 0.36, 0.64, 0.76]) ctx.fillRect(W * x - 10, 0, 20, H);
      }
      // Líneas
      if (line) {
        ctx.fillStyle = line;
        ctx.globalAlpha = style === 'neon' ? 1 : 0.9;
        ctx.fillRect(W * 0.018, 0, W * 0.014, H);
        ctx.fillRect(W * (1 - 0.032), 0, W * 0.014, H);
        ctx.fillRect(W * 0.5 - W * 0.007, 0, W * 0.014, H * 0.5);
        ctx.globalAlpha = 1;
      }
      return toTexture(c);
    });
  },

  /** Emisivo para carreteras de neón (solo las líneas brillan). */
  roadEmissive(color = '#00e5ff') {
    return cached(`roadEm:${color}`, () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = color;
      ctx.fillRect(W * 0.012, 0, W * 0.024, W);
      ctx.fillRect(W * (1 - 0.036), 0, W * 0.024, W);
      ctx.fillRect(W * 0.49, 0, W * 0.02, W * 0.5);
      return toTexture(c);
    });
  },

  curb(a = '#e53935', b = '#ffffff') {
    return cached(`curb:${a}:${b}`, () => {
      const c = makeCanvas(64, 256);
      const ctx = c.getContext('2d');
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? b : a;
        ctx.fillRect(0, i * 64, 64, 64);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, 6, 256);
      return toTexture(c);
    });
  },

  /** Ruido de detalle (escala de grises clara) para multiplicar sobre colores por vértice. */
  detail(kind = 'grass') {
    return cached(`detail:${kind}`, () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      const rng = new Random(`detail-${kind}`);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(0, 0, W, W);
      if (kind === 'grass') {
        for (let i = 0; i < 5000; i++) {
          const v = Math.floor(rng.range(170, 255));
          ctx.strokeStyle = `rgb(${v},${v},${v})`;
          ctx.lineWidth = 1;
          const x = rng.next() * W;
          const y = rng.next() * W;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + rng.range(-2, 2), y - rng.range(3, 7));
          ctx.stroke();
        }
      } else {
        speckle(ctx, W, W, rng, 7000, ['#c8c8c8', '#f4f4f4', '#d8d8d8', '#b8b8b8', '#ffffff'], 1, 3);
      }
      return toTexture(c, { srgb: true });
    });
  },

  checker(n = 8, rows = 2) {
    return cached(`checker:${n}:${rows}`, () => {
      const s = 32;
      const c = makeCanvas(n * s, rows * s);
      const ctx = c.getContext('2d');
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#111111' : '#f5f5f5';
          ctx.fillRect(i * s, j * s, s, s);
        }
      }
      const t = toTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    });
  },

  boostPad() {
    return cached('boostPad', () => {
      const W = 128;
      const H = 256;
      const c = makeCanvas(W, H);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a1200';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 2; i++) {
        const y0 = i * (H / 2);
        const g = ctx.createLinearGradient(0, y0 + H / 2, 0, y0);
        g.addColorStop(0, '#ff6d00');
        g.addColorStop(1, '#ffea00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(W * 0.5, y0 + H * 0.05);
        ctx.lineTo(W * 0.95, y0 + H * 0.3);
        ctx.lineTo(W * 0.95, y0 + H * 0.45);
        ctx.lineTo(W * 0.5, y0 + H * 0.2);
        ctx.lineTo(W * 0.05, y0 + H * 0.45);
        ctx.lineTo(W * 0.05, y0 + H * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, -10, W - 6, H + 20);
      return toTexture(c);
    });
  },

  itemBox() {
    return cached('itemBox', () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, W, W);
      const hues = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ff5252'];
      hues.forEach((h, i) => g.addColorStop(i / (hues.length - 1), h));
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, 0, W, W);
      ctx.strokeStyle = g;
      ctx.lineWidth = 22;
      ctx.strokeRect(11, 11, W - 22, W - 22);
      ctx.font = 'bold 170px "Lilita One", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText('?', W / 2, W / 2 + 8);
      ctx.fillStyle = g;
      ctx.fillText('?', W / 2, W / 2 + 8);
      return toTexture(c, { repeat: false });
    });
  },

  /** Fachada con ventanas (map + emissiveMap). */
  windows(seed = 'city', lit = 0.45, tint = '#ffd98a') {
    return cached(`windows:${seed}:${lit}:${tint}`, () => {
      const W = 256;
      const H = 512;
      const rng = new Random(seed);
      const c = makeCanvas(W, H);
      const e = makeCanvas(W, H);
      const ctx = c.getContext('2d');
      const ex = e.getContext('2d');
      ctx.fillStyle = '#9aa3ad';
      ctx.fillRect(0, 0, W, H);
      ex.fillStyle = '#000';
      ex.fillRect(0, 0, W, H);
      const cols = 6;
      const rows = 16;
      const cw = W / cols;
      const rh = H / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const on = rng.next() < lit;
          ctx.fillStyle = on ? '#fff3c4' : '#2c3440';
          ctx.fillRect(i * cw + 6, j * rh + 7, cw - 12, rh - 12);
          if (on) {
            ex.fillStyle = tint;
            ex.globalAlpha = rng.range(0.55, 1);
            ex.fillRect(i * cw + 6, j * rh + 7, cw - 12, rh - 12);
            ex.globalAlpha = 1;
          }
        }
      }
      return { map: toTexture(c), emissive: toTexture(e) };
    });
  },

  bricks(color = '#8d6e63', mortar = '#4e342e') {
    return cached(`bricks:${color}:${mortar}`, () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      const rng = new Random(`bricks${color}`);
      ctx.fillStyle = mortar;
      ctx.fillRect(0, 0, W, W);
      const rows = 8;
      const rh = W / rows;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? rh : 0;
        for (let x = -off; x < W; x += rh * 2) {
          ctx.fillStyle = shade(color, rng.range(0.8, 1.15));
          ctx.fillRect(x + 3, r * rh + 3, rh * 2 - 6, rh - 6);
        }
      }
      speckle(ctx, W, W, rng, 1500, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.08)']);
      return toTexture(c);
    });
  },

  rock(color = '#8a8278') {
    return cached(`rock:${color}`, () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      const rng = new Random(`rock${color}`);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, W);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = shade(color, rng.range(0.7, 1.2));
        ctx.beginPath();
        const x = rng.next() * W;
        const y = rng.next() * W;
        ctx.ellipse(x, y, rng.range(10, 40), rng.range(6, 20), rng.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
      }
      speckle(ctx, W, W, rng, 4000, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.1)']);
      return toTexture(c);
    });
  },

  wood(color = '#8d6e63') {
    return cached(`wood:${color}`, () => {
      const W = 128;
      const H = 256;
      const c = makeCanvas(W, H);
      const ctx = c.getContext('2d');
      const rng = new Random(`wood${color}`);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(40,20,5,${rng.range(0.1, 0.35)})`;
        ctx.lineWidth = rng.range(1, 3);
        const x = rng.next() * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= H; y += 16) ctx.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
        ctx.stroke();
      }
      return toTexture(c);
    });
  },

  stripes(a = '#ffca28', b = '#212121', n = 8) {
    return cached(`stripes:${a}:${b}:${n}`, () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      ctx.fillStyle = b;
      ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = a;
      for (let i = -n; i < n * 2; i++) {
        ctx.beginPath();
        const x = (i * W) / n;
        ctx.moveTo(x, 0);
        ctx.lineTo(x + W / n / 2, 0);
        ctx.lineTo(x + W / n / 2 + W, W);
        ctx.lineTo(x + W, W);
        ctx.closePath();
        ctx.fill();
      }
      return toTexture(c);
    });
  },

  /** Sprite suave para partículas (blanco, alfa radial). */
  softDot() {
    return cached('softDot', () => {
      const W = 64;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, W);
      return toTexture(c, { repeat: false });
    });
  },

  cloud() {
    return cached('cloud', () => {
      const W = 256;
      const c = makeCanvas(W, W / 2);
      const ctx = c.getContext('2d');
      const rng = new Random('cloud');
      for (let i = 0; i < 22; i++) {
        const x = rng.range(W * 0.15, W * 0.85);
        const y = rng.range(W * 0.18, W * 0.34);
        const r = rng.range(18, 44);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      return toTexture(c, { repeat: false });
    });
  },

  /** Banner con texto (arco de meta, carteles). */
  banner(text, bg = '#1e88e5', fg = '#ffffff', w = 1024, h = 128) {
    return cached(`banner:${text}:${bg}:${fg}:${w}`, () => {
      const c = makeCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const sq = h / 4;
      for (let i = 0; i < w / sq; i++) {
        ctx.fillStyle = i % 2 ? '#111' : '#fafafa';
        ctx.fillRect(i * sq, 0, sq, sq * 0.6);
        ctx.fillStyle = i % 2 ? '#fafafa' : '#111';
        ctx.fillRect(i * sq, h - sq * 0.6, sq, sq * 0.6);
      }
      ctx.font = `${Math.floor(h * 0.5)}px "Lilita One", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(text, w / 2, h / 2 + 2);
      ctx.fillStyle = fg;
      ctx.fillText(text, w / 2, h / 2 + 2);
      return toTexture(c, { repeat: false });
    });
  },

  /** Letrero de neón (texto brillante sobre fondo oscuro). */
  neonSign(text, color = '#ff4081', w = 512, h = 192) {
    return cached(`neon:${text}:${color}`, () => {
      const c = makeCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0a0612';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${Math.floor(h * 0.48)}px "Lilita One", "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 6;
      ctx.strokeStyle = color;
      ctx.strokeText(text, w / 2, h / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, w / 2, h / 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      return toTexture(c, { repeat: false });
    });
  },

  /** Rejilla luminosa (suelo del vacío digital). */
  grid(color = '#00e5ff', bg = '#05010f', cells = 8) {
    return cached(`grid:${color}:${bg}:${cells}`, () => {
      const W = 256;
      const c = makeCanvas(W, W);
      const ctx = c.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, W);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      for (let i = 0; i <= cells; i++) {
        const p = (i * W) / cells;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, W);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(W, p);
        ctx.stroke();
      }
      return toTexture(c);
    });
  },

  /** Montañas lejanas (silueta) para el anillo del horizonte. */
  horizon(color = '#6d8fb3', seed = 'hz', snow = false) {
    return cached(`horizon:${color}:${seed}:${snow}`, () => {
      const W = 1024;
      const H = 256;
      const c = makeCanvas(W, H);
      const ctx = c.getContext('2d');
      const rng = new Random(seed);
      const layers = [
        { col: shade(color, 1.18), amp: 0.55, base: 0.62 },
        { col: color, amp: 0.45, base: 0.8 },
      ];
      for (const L of layers) {
        ctx.fillStyle = L.col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        const pts = [];
        for (let x = 0; x <= W; x += 8) {
          const f = x / W;
          const y = H * L.base - H * L.amp * (0.5 + 0.35 * Math.sin(f * Math.PI * 6 + rng.range(0, 0.3)) + 0.15 * Math.sin(f * Math.PI * 22) * rng.range(0.6, 1));
          pts.push([x, y]);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        if (snow) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          for (let i = 1; i < pts.length - 1; i++) {
            const [x, y] = pts[i];
            if (y < H * 0.32) {
              ctx.beginPath();
              ctx.moveTo(x - 8, y + 10);
              ctx.lineTo(x, y);
              ctx.lineTo(x + 8, y + 10);
              ctx.fill();
            }
          }
        }
      }
      const t = toTexture(c, { repeat: true });
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    });
  },
};
