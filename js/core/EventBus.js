// Bus de eventos minimalista para desacoplar sistemas (física → audio, partículas, HUD...).

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(type, fn) {
    const set = this.listeners.get(type);
    if (set) set.delete(fn);
  }

  emit(type, payload) {
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] error en listener de "${type}"`, err);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}
