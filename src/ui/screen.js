// THE NIGHT COUNT — an 80x25 text-mode screen.
//
// Every system screen in the game (menus, settings, the station's own DOS
// software) is composed into a real character buffer and then rendered, rather
// than laid out as web UI that merely looks retro. Box-drawing characters,
// CGA palette, drop shadows and a status bar full of F-keys, the way Borland's
// Turbo Vision did it in 1990 — which is what a 1974 station running a 1991
// software revision would still be staring at in 1997.
export const CGA = [
  "#000000", "#0000a8", "#00a800", "#00a8a8", "#a80000", "#a800a8", "#a85400", "#a8a8a8",
  "#545454", "#5454fc", "#54fc54", "#54fcfc", "#fc5454", "#fc54fc", "#fcfc54", "#fcfcfc",
];

export const W = 80, H = 25;

export class Screen {
  constructor(w = W, h = H) {
    this.w = w; this.h = h;
    this.cells = new Array(w * h);
    this.hot = [];                     // {x,y,len,fn,id,key}
    this.clear();
  }

  clear(ch = " ", fg = 7, bg = 1) {
    for (let i = 0; i < this.w * this.h; i++) this.cells[i] = { ch, fg, bg };
    this.hot.length = 0;
  }

  /** Desktop fill — the classic 50% dither field behind the windows. */
  desktop(ch = "░", fg = 9, bg = 1) {
    for (let i = 0; i < this.w * this.h; i++) this.cells[i] = { ch, fg, bg };
  }

  put(x, y, ch, fg = 7, bg = 1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = { ch, fg, bg };
  }

  text(x, y, s, fg = 7, bg = 1) {
    for (let i = 0; i < s.length; i++) this.put(x + i, y, s[i], fg, bg);
    return x + s.length;
  }

  /** Text with the first letter (or the one after '&') in the hotkey colour. */
  hotText(x, y, s, fg = 0, bg = 7, hotFg = 4) {
    let cx = x;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "&") { i++; this.put(cx++, y, s[i], hotFg, bg); continue; }
      this.put(cx++, y, s[i], fg, bg);
    }
    return cx;
  }

  fill(x, y, w, h, ch = " ", fg = 7, bg = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, ch, fg, bg);
  }

  /**
   * Framed window with a title and a drop shadow.
   * style 2 = double line (the Turbo Vision default for dialogs).
   */
  window(x, y, w, h, title = "", { fg = 0, bg = 7, style = 2, shadow = true, titleFg = 0 } = {}) {
    const B = style === 2
      ? { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" }
      : { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" };
    this.fill(x, y, w, h, " ", fg, bg);
    this.put(x, y, B.tl, fg, bg);
    this.put(x + w - 1, y, B.tr, fg, bg);
    this.put(x, y + h - 1, B.bl, fg, bg);
    this.put(x + w - 1, y + h - 1, B.br, fg, bg);
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, B.h, fg, bg);
      this.put(x + i, y + h - 1, B.h, fg, bg);
    }
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, B.v, fg, bg);
      this.put(x + w - 1, y + j, B.v, fg, bg);
    }
    if (title) {
      const t = " " + title + " ";
      this.text(x + Math.max(1, Math.floor((w - t.length) / 2)), y, t, titleFg, bg);
    }
    if (shadow) {
      for (let i = 2; i < w; i++) this._shade(x + i, y + h);
      for (let j = 1; j < h; j++) { this._shade(x + w, y + j); this._shade(x + w + 1, y + j); }
    }
    return { x, y, w, h, ix: x + 2, iy: y + 1, iw: w - 4 };
  }

  _shade(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const c = this.cells[y * this.w + x];
    this.cells[y * this.w + x] = { ch: c.ch, fg: 8, bg: 0 };
  }

  /** A clickable run of text. */
  button(x, y, label, fn, { fg = 0, bg = 7, hot = true, id = "" } = {}) {
    const end = hot ? this.hotText(x, y, label, fg, bg) : this.text(x, y, label, fg, bg);
    this.hot.push({ x, y, len: end - x, fn, id });
    return end;
  }

  /** Render to a DOM node. Runs of identical colour become one span. */
  render(host) {
    const rows = [];
    for (let y = 0; y < this.h; y++) {
      let out = "", run = "", fg = -1, bg = -1;
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[y * this.w + x] || { ch: " ", fg: 7, bg: 1 };
        if (c.fg !== fg || c.bg !== bg) {
          if (run) out += `<span style="color:${CGA[fg]};background:${CGA[bg]}">${esc(run)}</span>`;
          run = ""; fg = c.fg; bg = c.bg;
        }
        run += c.ch;
      }
      if (run) out += `<span style="color:${CGA[fg]};background:${CGA[bg]}">${esc(run)}</span>`;
      rows.push(`<div class="tvrow">${out}</div>`);
    }
    host.innerHTML = `<div class="tvscreen">${rows.join("")}</div>`;
    const screenEl = host.querySelector(".tvscreen");
    screenEl.onclick = (e) => {
      const r = screenEl.getBoundingClientRect();
      const cw = r.width / this.w, chh = r.height / this.h;
      const cx = Math.floor((e.clientX - r.left) / cw);
      const cy = Math.floor((e.clientY - r.top) / chh);
      for (const h of this.hot) {
        if (cy === h.y && cx >= h.x && cx < h.x + h.len) { h.fn?.(); return; }
      }
    };
    screenEl.onmousemove = (e) => {
      const r = screenEl.getBoundingClientRect();
      const cw = r.width / this.w, chh = r.height / this.h;
      const cx = Math.floor((e.clientX - r.left) / cw);
      const cy = Math.floor((e.clientY - r.top) / chh);
      const on = this.hot.some((h) => cy === h.y && cx >= h.x && cx < h.x + h.len);
      screenEl.style.cursor = on ? "pointer" : "default";
    };
    return screenEl;
  }
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** Status bar of F-key hints, the way every DOS program had one. */
export function statusBar(scr, items, y = scr.h - 1) {
  scr.fill(0, y, scr.w, 1, " ", 0, 7);
  let x = 1;
  for (const [key, label, fn] of items) {
    scr.text(x, y, key, 4, 7); x += key.length;
    const end = scr.text(x, y, "-" + label + "  ", 0, 7);
    if (fn) scr.hot.push({ x: x - key.length, y, len: end - x + key.length, fn });
    x = end;
  }
}
