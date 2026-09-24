// Pequeñas utilidades DOM para construir la interfaz sin frameworks.

/**
 * Crea un elemento: h('div.clase#id', {atributos}, hijos...)
 * Atributos especiales: onClick/onInput..., dataset, style (objeto), html (innerHTML).
 */
export function h(sel, attrs = {}, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  const rest = m[2] || '';
  for (const part of rest.match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = {};
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ` ${v}`;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Botón navegable estándar. */
export function button(label, onClick, opts = {}) {
  const b = h(
    `button.btn.focusable${opts.cls ? '.' + opts.cls.split(' ').join('.') : ''}`,
    { type: 'button', onClick, 'data-default': opts.default ? '1' : null, 'aria-label': opts.aria || null },
    opts.icon ? h('span.btn-icon', { html: opts.icon }) : null,
    h('span.btn-label', label),
    opts.sub ? h('span.btn-sub', opts.sub) : null,
  );
  if (opts.disabled) b.disabled = true;
  return b;
}

/** Barra de estadística (0..10). */
export function statBar(label, value, max = 10, color = null) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return h(
    'div.stat',
    h('span.stat-label', label),
    h('span.stat-track', h('span.stat-fill', { style: { width: `${pct}%`, ...(color ? { background: color } : {}) } })),
    h('span.stat-value', String(Math.round(value * 10) / 10)),
  );
}

export const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M6 3h12v3h3v2a5 5 0 0 1-5 5 6 6 0 0 1-3 2.6V19h4v2H7v-2h4v-3.4A6 6 0 0 1 8 13a5 5 0 0 1-5-5V6h3zm0 5V8H5a3 3 0 0 0 1 2.2zm12 0v2.2A3 3 0 0 0 19 8z" fill="currentColor"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 2v20h2v-8h4l1 2h8V4h-7l-1-2zm2 2h3l1 2h7v8h-5l-1-2H7z" fill="currentColor"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6l5 3 1-1.7-4-2.3V7z" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5.5v-3l-2.4-.6a7 7 0 0 0-.7-1.7l1.3-2.1-2.1-2.1-2.1 1.3a7 7 0 0 0-1.7-.7L12.9 2h-3l-.6 2.4a7 7 0 0 0-1.7.7L5.5 3.8 3.4 5.9l1.3 2.1a7 7 0 0 0-.7 1.7L1.6 10.3v3l2.4.6c.2.6.4 1.2.7 1.7l-1.3 2.1 2.1 2.1 2.1-1.3c.5.3 1.1.5 1.7.7l.6 2.4h3l.6-2.4a7 7 0 0 0 1.7-.7l2.1 1.3 2.1-2.1-1.3-2.1c.3-.5.5-1.1.7-1.7z" fill="currentColor"/></svg>',
  pad: '<svg viewBox="0 0 24 24"><path d="M7 7h10a5 5 0 0 1 4.9 6l-.9 4a2.5 2.5 0 0 1-4.3 1.1L14 16h-4l-2.7 2.1A2.5 2.5 0 0 1 3 17l-.9-4A5 5 0 0 1 7 7zm0 3v1.5H5.5v2H7V15h2v-1.5h1.5v-2H9V10zm9.5 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm2 2.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" fill="currentColor"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M3 21V3h2v16h16v2zm4-4V10h3v7zm5 0V6h3v11zm5 0v-5h3v5z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M10 5L3 12l7 7v-4h6a5 5 0 0 1 0 10h-2v2h2a7 7 0 0 0 0-14h-6z" fill="currentColor" transform="translate(0,-3)"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.7 10h2.1A6 6 0 1 0 12 6v3L7 5l5-4z" fill="currentColor"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M5 4l9 8-9 8zm10 0h3v16h-3z" fill="currentColor"/></svg>',
};

/** Dibuja la silueta del circuito en un canvas (miniaturas y minimapa). */
export function drawTrackShape(canvas, track, { pad = 10, lineColor = '#ffffff', width = null, bg = null, startColor = '#ffd740' } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }
  const pts = track;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const sc = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1));
  const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
  const map = ([x, y]) => [x * sc + ox, y * sc + oy];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = map(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };
  path();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = (width ?? Math.max(4, W * 0.05)) + 4;
  ctx.stroke();
  path();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = width ?? Math.max(4, W * 0.05);
  ctx.stroke();
  const [sx, sy] = map(pts[0]);
  ctx.fillStyle = startColor;
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(3, W * 0.03), 0, Math.PI * 2);
  ctx.fill();
  return { sc, ox, oy, map };
}
