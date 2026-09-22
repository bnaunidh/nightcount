// THE NIGHT COUNT — talking.
//
// Three ways to answer. Pick one. **It remembers.**
//
// Two rules that make this worth having rather than decorative:
//
//   1. Silence is always one of the answers, and it is never the safe one. If
//      the player says nothing, that is a choice with a consequence, not a
//      skip. Letting the timer run out picks it for them.
//   2. Nothing is ever announced. No "he will remember that". The reply is
//      recorded, and it comes back two nights later without a caption.
//
// Every answer is written to `state.data.choices` under a stable key so a later
// night can read what he said and act on it.
import { settings } from "./settings.js";

export class Choices {
  constructor(game) {
    this.g = game;
    this.open = false;
    this._resolve = null;
    this._keyHandler = null;
  }

  /** What did he say last time? Returns the option id, or null. */
  said(key) {
    return this.g.state.data.choices?.[key] ?? null;
  }

  /**
   * Ask. Resolves to the chosen option's id.
   *
   * @param key      stable id, so later nights can look the answer up
   * @param options  [{ id, text }] — three is the shape, but any number works.
   *                 An option with `silent: true` is what the timeout picks.
   * @param secs     how long he has. Running out is an answer.
   */
  ask(key, options, { secs = 9 } = {}) {
    if (this.open) this._close(null);
    return new Promise((resolve) => {
      this.open = true;
      this._resolve = resolve;

      const wrap = document.createElement("div");
      wrap.className = "choices";
      const fallback = options.find((o) => o.silent) || options[options.length - 1];

      options.forEach((o, i) => {
        const b = document.createElement("button");
        b.className = "choice" + (o.silent ? " silent" : "");
        b.innerHTML = `<span class="cnum">${i + 1}</span><span class="ctext"></span>`;
        b.querySelector(".ctext").textContent = o.text;
        b.onclick = () => this._pick(key, o.id);
        wrap.appendChild(b);
      });

      const bar = document.createElement("i");
      bar.className = "ctimer";
      bar.style.animationDuration = secs + "s";
      if(secs>0)wrap.appendChild(bar);

      const host = document.getElementById("app") || document.body;
      host.appendChild(wrap);
      this._wrap = wrap;
      requestAnimationFrame(() => wrap.classList.add("in"));
      setTimeout(() => wrap.classList.add("in"), 60);
      // Measure the replies and tell the dialogue box how far to lift. A fixed
      // number cannot know how many options there are or how they wrapped, and
      // the one that was there was 65px short of two lines of them.
      document.body.classList.add("choosing");
      const lift = () => document.body.style.setProperty(
        "--choicesH", Math.ceil(wrap.getBoundingClientRect().height) + "px");
      lift();
      requestAnimationFrame(lift);
      setTimeout(lift, 80);

      this._keyHandler = (e) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= options.length) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this._pick(key, options[n - 1].id);
        }
      };
      addEventListener("keydown", this._keyHandler, true);

      // running out of time is an answer, not a skip
      if(secs>0)this._timer = setTimeout(() => this._pick(key, fallback.id, true), secs * 1000);
    });
  }

  _pick(key, id, timedOut = false) {
    if (!this.open) return;
    this.g.state.data.choices = this.g.state.data.choices || {};
    this.g.state.data.choices[key] = id;
    this.g.state.data.choiceLog = this.g.state.data.choiceLog || [];
    this.g.state.data.choiceLog.push({ key, id, night: this.g.state.night, timedOut });
    this.g.audio?.play?.(timedOut ? "int_pencil_tick" : "int_regkey", { vol: 0.5 });
    this.g.bus?.emit?.("choice", key, id, timedOut);
    this._close(id);
  }

  _close(id) {
    this.open = false;
    document.body.classList.remove("choosing");
    document.body.style.removeProperty("--choicesH");
    clearTimeout(this._timer);
    if (this._keyHandler) removeEventListener("keydown", this._keyHandler, true);
    this._keyHandler = null;
    const w = this._wrap;
    this._wrap = null;
    if (w) {
      w.classList.remove("in");
      setTimeout(() => w.remove(), 260);
    }
    const r = this._resolve;
    this._resolve = null;
    if (r) r(id);
  }

  cancel() { this._close(null); }
}
