// THE NIGHT COUNT — HUD, subtitles, title cards, and focus-surface plumbing.
import { settings, settingsBus } from "./settings.js";
import { clockString } from "./util.js";
import { releaseLock, requestLock, setInputEnabled } from "./input.js";
import { generated } from "./assets.js";

/**
 * Who gets a portrait, and which one. Keys are matched case-insensitively
 * against the speaker label passed to say(); anything unmatched falls back to
 * a plain caption, which is what Wren's own narration uses.
 */
const PORTRAIT = {
  "gil": "port_gil",
  "the trucker": "port_trucker",
  "the woman with the sleeping kid": "port_woman",
  "the hauler": "port_hauler",
  "the salesman": "port_salesman",
  "the man from the truck": "port_truckman",
  "the man on foot": "port_burned",
  "the girl with the flat": "port_girl",
  "jacob": "port_danny",   // the portrait file keeps its original slot name
  "the attendant": "port_attendant",
  "radio": "port_radio",
};

/** Display names, so the box says something a person would say. */
const SPEAKER = {
  "gil": "GIL VASQUEZ",
  "radio": "KCBK COLDBROOK",
  "jacob": "JACOB",
};

const $ = (s) => document.querySelector(s);

export class UI {
  constructor() {
    this.hud = $("#hud");
    this.prompt = $("#prompt");
    this.promptKey = $("#promptKey");
    this.promptText = $("#promptText");
    this.clockEl = $("#clock");
    this.objList = $("#objList");
    this.objBox = $("#objective");
    this.subs = $("#subs");
    this.toastEl = $("#toast");
    this.focus = $("#focus");
    this.fadeEl = $("#fade");
    this.tc = $("#titlecard");
    this.subQueue = [];
    this.focusStack = [];
    this.onFocusChange = () => {};
    settingsBus.on("change", () => this.applySettings());
    this.applySettings();
  }

  applySettings() {
    document.documentElement.style.setProperty("--ui", settings.promptScale);
    document.documentElement.style.setProperty("--sub", settings.subtitleSize);
    this.subs.classList.toggle("nobg", !settings.subtitleBg);
    if (!settings.subtitles) this.subs.innerHTML = "";
  }

  showHUD(v) { this._hudWanted = v; this.hud.classList.toggle("hidden", !v); }

  setPrompt(p) {
    if (!p) { this.prompt.classList.add("hidden"); return; }
    this.prompt.classList.remove("hidden");
    this.promptKey.textContent = (settings.keys.interact || "KeyE").replace("Key", "").replace("Left", "");
    // Labels and verbs may be functions — the phone's is, so it can change
    // between "Answer" and "Call". Printed raw, a function stringifies to its
    // own source code and the prompt read `() => "the phone"`.
    const val = (v) => (typeof v === "function" ? v() : v);
    const verb = val(p.verb) || "";
    const label = val(p.label) || "";
    this.promptText.textContent = verb + (label ? " " + label : "");
  }

  setHold(t) {
    this.prompt.classList.toggle("hold", t > 0);
    this.prompt.style.setProperty("--h", Math.round(t * 100) + "%");
  }

  setClock(mins, on = true) {
    this.clockEl.textContent = on ? clockString(mins) : "";
  }

  setObjectives(list, title = "TONIGHT") {
    $("#objTitle").textContent = title;
    this.objList.innerHTML = "";
    for (const o of list) {
      const li = document.createElement("li");
      li.textContent = o.text;
      if (o.done) li.className = "done";
      this.objList.appendChild(li);
    }
    this.objBox.classList.remove("dim");
    clearTimeout(this._objT);
    this._objT = setTimeout(() => this.objBox.classList.add("dim"), 6000);
  }

  flashObjectives() {
    this.objBox.classList.remove("dim");
    clearTimeout(this._objT);
    this._objT = setTimeout(() => this.objBox.classList.add("dim"), 6000);
  }

  /**
   * A line of dialogue. With a named speaker it becomes a proper dialogue box
   * at the bottom of the screen — portrait, name, line — the way most games do
   * it. Wren's own narration (no speaker) stays a plain unboxed caption,
   * because it is a thought, not somebody talking to you.
   */
  say(text, { who = "", secs = null, keep = false, voice = "room" } = {}) {
    // Speak it FIRST, and before the subtitle gate.
    //
    // Subtitles are a setting; the voice is the performance. Turning captions
    // off must not turn the acting off with them — that reading of the flag
    // would have made the whole voice pass invisible to anyone who plays
    // without subtitles, which is most people.
    const spoken = this.audio?.speak?.(text, voice, voice === "phone" ? 1.0 : 0.92) || 0;
    if (!settings.subtitles) return spoken || secs
      || Math.max(1.8, Math.min(8, text.length * 0.062));
    // A caption must not leave the screen while the line is still being said.
    const t = Math.max(secs ?? Math.max(1.8, Math.min(8, text.length * 0.062)),
                       spoken ? spoken + 0.25 : 0);
    const key = String(who || "").toLowerCase().trim();

    if (who) {
      const art = PORTRAIT[key] ? generated(PORTRAIT[key]) : null;
      const name = SPEAKER[key] || String(who).toUpperCase();
      this.subs.innerHTML = "";
      // The dialogue box lives in its own layer, not inside #subs: that
      // container is a zero-width, transformed box, which becomes the
      // containing block for anything fixed inside it and collapses the box to
      // its own borders.
      if (!this._dlg) {
        this._dlg = document.createElement("div");
        this._dlg.id = "dlg";
        document.getElementById("app").appendChild(this._dlg);
      }
      this._dlg.innerHTML = "";
      const box = document.createElement("div");
      box.className = "dbox";
      box.innerHTML =
        `<div class="dport${art ? "" : " none"}">${art ? `<img src="${art}" alt="">` : ""}</div>` +
        `<div class="dtext"><div class="dname">${escapeHTML(name)}</div>` +
        `<div class="dline"></div></div>`;
      this._dlg.appendChild(box);
      // lift the narration caption clear of the box while somebody is talking
      document.body.classList.add("dlgOn");
      requestAnimationFrame(() => box.classList.add("in"));
      // reveal the line rather than snapping it in; skipped if the clip is short
      const lineEl = box.querySelector(".dline");
      const full = String(text);
      const step = Math.max(12, Math.min(34, (t * 1000 * 0.55) / Math.max(1, full.length)));
      let i = 0;
      clearInterval(this._typeT);
      this._typeT = setInterval(() => {
        i += 1;
        lineEl.textContent = full.slice(0, i);
        if (i >= full.length) clearInterval(this._typeT);
      }, step);
      clearTimeout(this._subT);
      this._subT = setTimeout(() => {
        clearInterval(this._typeT);
        box.classList.remove("in");
        setTimeout(() => {
          box.remove();
          if (!this._dlg.children.length) document.body.classList.remove("dlgOn");
        }, 260);
      }, t * 1000);
      return t;
    }

    const div = document.createElement("div");
    div.className = "line";
    div.textContent = text;
    if (!keep) this.subs.innerHTML = "";
    this.subs.appendChild(div);
    clearTimeout(this._subT);
    this._subT = setTimeout(() => { if (this.subs.contains(div)) div.remove(); }, t * 1000);
    return t;
  }

  /** The watch going off — a flash on the HUD clock and, if there is one, why. */
  watchBuzz(label, time) {
    const el = document.getElementById("clock");
    if (!el) return;
    el.classList.remove("buzz");
    void el.offsetWidth;                 // restart the animation
    el.classList.add("buzz");
    if (!label) el.classList.add("buzzCold");
    setTimeout(() => el.classList.remove("buzz", "buzzCold"), 2400);
  }

  clearSubs() {
    clearInterval(this._typeT);
    this.subs.innerHTML = "";
    if (this._dlg) this._dlg.innerHTML = "";
    document.body.classList.remove("dlgOn");
  }

  toast(text, secs = 3) {
    this.toastEl.innerHTML = escapeHTML(text);
    this.toastEl.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove("show"), secs * 1000);
  }

  fade(to, secs = 0.6) {
    this.fadeEl.style.transition = `opacity ${secs}s linear`;
    this.fadeEl.style.opacity = String(to);
    return new Promise((r) => setTimeout(r, secs * 1000));
  }

  async titleCard(main, sub = "", hold = 2.6) {
    $("#tcMain").textContent = main;
    $("#tcSub").textContent = sub;
    this.tc.classList.remove("hidden");
    this.tc.style.opacity = "0";
    this.tc.style.transition = "opacity .8s";
    requestAnimationFrame(() => { this.tc.style.opacity = "1"; });
    await new Promise((r) => setTimeout(r, hold * 1000));
    this.tc.style.opacity = "0";
    await new Promise((r) => setTimeout(r, 800));
    this.tc.classList.add("hidden");
  }

  // ——— focus surfaces (register, cameras, docs) ————————————————————
  /**
   * @param {HTMLElement} el content
   * @param {object} o {onClose, escLabel, canvasMode}
   */
  openFocus(el, o = {}) {
    const entry = { el, o };
    this.focusStack.push(entry);
    this.focus.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "surface";
    wrap.appendChild(el);
    if (o.escLabel !== null) {
      const esc = document.createElement("div");
      esc.className = "esc";
      esc.textContent = o.escLabel || "ESC — step back";
      wrap.appendChild(esc);
    }
    this.focus.appendChild(wrap);
    this.focus.classList.remove("hidden");
    this.focus.classList.toggle("clear", !!o.clear);
    // the HUD belongs to her eyes, not to the equipment she is looking at
    this.hud.classList.add("hidden");
    releaseLock();
    setInputEnabled(true);
    this.onFocusChange(true);
    return entry;
  }

  closeFocus(relock = true) {
    const e = this.focusStack.pop();
    if (!this.focusStack.length && this._hudWanted !== false) this.hud.classList.remove("hidden");
    this.focus.classList.add("hidden");
    this.focus.innerHTML = "";
    try { e?.o.onClose?.(); } catch (err) { console.error(err); }
    this.onFocusChange(false);
    if (relock) requestLock(document.getElementById("view"));
  }

  get focused() { return this.focusStack.length > 0; }
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}
