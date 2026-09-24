// Navegación espacial por teclado/mando entre elementos ".focusable" de la pantalla activa.

export class FocusNavigator {
  constructor() {
    this.scope = null;
    this.current = null;
  }

  setScope(el) {
    this.scope = el;
    this.current = null;
  }

  items() {
    if (!this.scope) return [];
    return Array.from(this.scope.querySelectorAll('.focusable')).filter((e) => !e.disabled && e.offsetParent !== null && !e.closest('.hidden'));
  }

  focus(el, scroll = true) {
    if (!el) return;
    if (this.current && this.current !== el) this.current.classList.remove('focused');
    this.current = el;
    el.classList.add('focused');
    if (document.activeElement !== el && typeof el.focus === 'function') el.focus({ preventScroll: true });
    if (scroll && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.dispatchEvent(new CustomEvent('navfocus', { bubbles: true }));
  }

  focusDefault() {
    const items = this.items();
    const def = items.find((e) => e.dataset.default === '1') || items[0];
    this.focus(def, false);
  }

  /** Mueve el foco en una dirección: devuelve true si se movió. */
  move(dir) {
    const items = this.items();
    if (!items.length) return false;
    if (!this.current || !items.includes(this.current)) {
      this.focusDefault();
      return true;
    }
    const r = this.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === this.current) continue;
      const b = el.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      let primary;
      let secondary;
      if (dir === 'up') {
        if (dy >= -2) continue;
        primary = -dy;
        secondary = Math.abs(dx);
      } else if (dir === 'down') {
        if (dy <= 2) continue;
        primary = dy;
        secondary = Math.abs(dx);
      } else if (dir === 'left') {
        if (dx >= -2) continue;
        primary = -dx;
        secondary = Math.abs(dy);
      } else {
        if (dx <= 2) continue;
        primary = dx;
        secondary = Math.abs(dy);
      }
      const score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      this.focus(best);
      return true;
    }
    return false;
  }

  activate() {
    if (this.current && !this.current.disabled) {
      this.current.click();
      return true;
    }
    return false;
  }
}
