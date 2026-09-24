// Controles reutilizables para menús: selector de opciones, interruptor y deslizador.
// Todos son navegables con ←/→ cuando tienen el foco (atributo data-adjust).
import { h } from './dom.js';

export function choiceRow(label, options, current, onChange, opts = {}) {
  let idx = Math.max(0, options.findIndex((o) => o.value === current));
  const valueEl = h('span.choice-value', options[idx].label);
  const sub = h('span.choice-sub', options[idx].sub || '');
  const set = (i) => {
    idx = (i + options.length) % options.length;
    valueEl.textContent = options[idx].label;
    sub.textContent = options[idx].sub || '';
    row.dataset.value = String(options[idx].value);
    onChange(options[idx].value);
  };
  const row = h(
    'div.option-row.focusable',
    { tabindex: '0', 'data-adjust': '1', 'data-default': opts.default ? '1' : null, onAdjust: (e) => set(idx + e.detail) },
    h('span.option-label', label),
    h(
      'span.choice',
      h('button.arrow', { type: 'button', tabindex: '-1', onClick: (e) => (e.stopPropagation(), set(idx - 1)) }, '◀'),
      h('span.choice-center', valueEl, sub),
      h('button.arrow', { type: 'button', tabindex: '-1', onClick: (e) => (e.stopPropagation(), set(idx + 1)) }, '▶'),
    ),
  );
  row.addEventListener('click', () => set(idx + 1));
  return row;
}

export function toggleRow(label, value, onChange) {
  let v = !!value;
  const pill = h(`span.toggle${v ? '.on' : ''}`, h('span.toggle-knob'), h('span.toggle-text', v ? 'Sí' : 'No'));
  const set = (nv) => {
    v = nv;
    pill.classList.toggle('on', v);
    pill.querySelector('.toggle-text').textContent = v ? 'Sí' : 'No';
    onChange(v);
  };
  const row = h('div.option-row.focusable', { tabindex: '0', 'data-adjust': '1', onAdjust: () => set(!v) }, h('span.option-label', label), pill);
  row.addEventListener('click', () => set(!v));
  return row;
}

export function sliderRow(label, value, min, max, step, onChange, format = (v) => `${Math.round(v * 100)}%`) {
  const input = h('input.slider', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), tabindex: '-1' });
  const out = h('span.slider-value', format(value));
  const set = (v) => {
    v = Math.max(min, Math.min(max, Math.round(v / step) * step));
    input.value = String(v);
    out.textContent = format(v);
    onChange(v);
  };
  input.addEventListener('input', () => set(Number(input.value)));
  const row = h('div.option-row.focusable', { tabindex: '0', 'data-adjust': '1', onAdjust: (e) => set(Number(input.value) + e.detail * step) }, h('span.option-label', label), h('span.slider-wrap', input, out));
  return row;
}
