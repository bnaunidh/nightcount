// THE NIGHT COUNT — small shared helpers.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const dampT = (dt, rate) => 1 - Math.exp(-rate * dt);

/** Deterministic PRNG so a given night plays the same way on reload. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function pick(arr, r = Math.random) {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

/** 22:00 → "10:02 PM" style clock used on receipts and the wall clock. */
export function clockString(minutesFromMidnight, seconds24 = false) {
  let m = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  if (seconds24) return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return hh + ":" + String(mm).padStart(2, "0") + " " + ampm;
}

export const money = (cents) =>
  (cents < 0 ? "-" : "") + "$" + (Math.abs(cents) / 100).toFixed(2);

/** Tiny synchronous event bus. */
export class Bus {
  constructor() { this.h = new Map(); }
  on(ev, fn) {
    if (!this.h.has(ev)) this.h.set(ev, new Set());
    this.h.get(ev).add(fn);
    return () => this.off(ev, fn);
  }
  once(ev, fn) {
    const off = this.on(ev, (...a) => { off(); fn(...a); });
    return off;
  }
  off(ev, fn) { const s = this.h.get(ev); if (s) s.delete(fn); }
  emit(ev, ...a) {
    const s = this.h.get(ev);
    if (s) for (const fn of Array.from(s)) {
      try { fn(...a); } catch (e) { console.error("[bus]", ev, e); }
    }
  }
}

/** Promise that resolves after n seconds of *game* time (respects pause). */
export function makeTimers() {
  const list = [];
  return {
    after(sec, fn) { const t = { t: sec, fn, dead: false }; list.push(t); return () => { t.dead = true; }; },
    every(sec, fn) { const t = { t: sec, every: sec, fn, dead: false }; list.push(t); return () => { t.dead = true; }; },
    clear() { list.length = 0; },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const t = list[i];
        if (t.dead) { list.splice(i, 1); continue; }
        t.t -= dt;
        if (t.t <= 0) {
          if (t.every) { t.t += t.every; } else { list.splice(i, 1); }
          try { t.fn(); } catch (e) { console.error("[timer]", e); }
        }
      }
    },
  };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
