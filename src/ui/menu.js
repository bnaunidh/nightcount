// THE NIGHT COUNT — front end.
//
// The menu plays over the station itself: a slow drift across the forecourt,
// rendered live by the game's own pipeline, so the first thing you see is the
// place you are about to work in. Everything on top of it is quiet — thin type,
// one warm accent, no boxes, no chrome. The period hardware lives *inside* the
// game, on the register and the monitor bank, where you actually operate it.
import { settings, setSetting, resetSettings } from "../core/settings.js";
import { State } from "../game/state.js";
import { CREDITS_TEXT } from "./credits.js";
import { releaseLock, inputBus } from "../core/input.js";
import { devmode, tryUnlock, lockDev, DEV_CLOCK_MIN, DEV_CLOCK_MAX } from "../core/devmode.js";
import { clockString } from "../core/util.js";
import { BUILD } from "../core/build.js";

const root = () => document.getElementById("menu");
const el = (h) => { const d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export class Menus {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.mode = null;
    this.stack = [];
    this.tab = "audio";
    inputBus.on("press", (code) => {
      if (code !== "Escape") return;
      if (this.open) { this.mode === "pause" ? this.close() : this.back(); return; }
      // Anything you are holding or looking at gets first claim on Escape:
      // putting a note down must not throw you into the pause menu.
      if (this.game.ui.focused) { this.game.ui.closeFocus(); return; }
      if (this.game.canPause()) this.showPause();
    });
  }

  _present(node, cls = "") {
    const r = root();
    r.className = "cine " + cls + (this.peeking ? " peek" : "");
    r.classList.remove("hidden");
    r.innerHTML = "";
    r.appendChild(node);
    r.appendChild(this._eye());
    this.open = true;
    releaseLock();
    // not rAF-gated: a background tab must still end up with a visible menu
    setTimeout(() => node.classList.add("in"), 16);
  }

  /**
   * The eye. The menu plays over the station drifting past, and there is no
   * other way to look at it — so this takes every panel away and leaves only
   * itself, and pressing it again brings the menu back exactly where it was.
   */
  _eye() {
    const b = el(`<button class="peekeye" title="Hide the menu">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="eball" d="M1.6 12S5.5 5.2 12 5.2 22.4 12 22.4 12 18.5 18.8 12 18.8 1.6 12 1.6 12Z"/>
        <circle class="epup" cx="12" cy="12" r="3.1"/>
        <path class="eslash" d="M4 20 L20 4"/>
      </svg></button>`);
    b.setAttribute("aria-label", this.peeking ? "Show the menu" : "Hide the menu");
    b.onclick = (e) => {
      e.stopPropagation();
      this.peeking = !this.peeking;
      root().classList.toggle("peek", this.peeking);
      b.setAttribute("aria-label", this.peeking ? "Show the menu" : "Hide the menu");
      b.title = this.peeking ? "Show the menu" : "Hide the menu";
    };
    return b;
  }

  close() {
    root().classList.add("hidden");
    root().innerHTML = "";
    this.open = false;
    this.stack = [];
    this.mode = null;
    this.paint = null;
    this.peeking = false;      // a hidden menu must not stay hidden next time
    this.game.onMenuClosed();
  }

  back() {
    const prev = this.stack.pop();
    if (prev) prev(); else this.close();
  }

  repaint() { this.paint?.(); }

  // ——— main ——————————————————————————————————————————————————————
  showMain() {
    this.mode = "main";
    this.paint = () => {
      const has = State.hasSave();
      const peek = has ? State.peek() : null;
      const wrap = el(`<div class="cwrap">
        <div class="ctitle">
          <div class="cbrand">MERIDIAN FUEL &amp; PROVISIONS</div>
          <h1>THE NIGHT COUNT</h1>
          ${BUILD.demo ? `<div class="cdemo">DEMO · THE FIRST TWO NIGHTS</div>` : ""}
          <div class="ctag">The pumps run all night. So does the count.</div>
        </div>
        <nav class="cmenu"></nav>
        <div class="cfoot">
          <span>STATION 41 · OLD STATE ROUTE 41 · HARNEY CO. OREGON</span>
          <span>OCTOBER 1997</span>
        </div>
      </div>`);
      const nav = wrap.querySelector(".cmenu");
      const item = (label, sub, fn, enabled = true) => {
        const b = el(`<button class="citem" ${enabled ? "" : "disabled"}>
          <span class="clabel">${esc(label)}</span>
          <span class="csub">${esc(sub || "")}</span></button>`);
        if (enabled) b.onclick = fn;
        nav.appendChild(b);
      };
      item("Continue", peek
        ? `night ${peek.night} · ${Object.keys(peek.clues || {}).length} things noticed`
        : "no shift in progress", () => this.game.continueGame(), has);
      // The menu promised "three ways it can end" while Night 6 forces the one
      // scripted ending. The old three-ending scorer is unreachable by play,
      // so the promise was simply false — and it is the first line a player
      // reads. It says what the game is instead.
      item("New shift", BUILD.demo
        ? "two nights of six — the demo stops at the storm"
        : "six nights, and the last one is a Sunday", () => {
        if (has && !confirm("Start over? The shift in progress will be overwritten.")) return;
        this.game.newGame();
      });
      item("Settings", "audio, video, controls, comfort",
        () => { this.stack.push(() => this.showMain()); this.showSettings(this.tab); });
      item("Credits & licences", "everyone whose work is in here",
        () => { this.stack.push(() => this.showMain()); this.showCredits(); });
      // Not in the demo. The demo goes to people who are not me, and a
      // passcode box on the main menu of a two-night build is an invitation to
      // go looking for what it opens.
      if (!BUILD.demo && devmode.unlocked) {
        item("DEV MODE", devmode.unlocked ? "unlocked · jump to any shift" : "passcode required",
          () => {
            this.stack.push(() => this.showMain());
            devmode.unlocked ? this.showDev() : this.showDevCode();
          });
      }
      item("Quit", "", () => { if (confirm("Close the game?")) location.href = "about:blank"; });
      this._present(wrap, "main");
    };
    this.paint();
  }

  // ——— pause ————————————————————————————————————————————————————
  showPause() {
    this.mode = "pause";
    this.game.setPaused(true);
    this.paint = () => {
      const st = this.game.state.data;
      const wrap = el(`<div class="cwrap pausewrap">
        <div class="ctitle">
          <div class="cbrand">${esc(this.game.pauseSubtitle())}</div>
          <h1 class="small">Paused</h1>
        </div>
        <nav class="cmenu"></nav>
        <div class="cstats">
          <span><b>${st.servedCount}</b> served</span>
          <span><b>${st.failCount}</b> not served</span>
          <span><b>${Object.keys(st.clues).length}</b> noticed</span>
          ${State.durable() ? "" : `<span class="warn">this browser will not keep saves</span>`}
        </div>
      </div>`);
      const nav = wrap.querySelector(".cmenu");
      const item = (label, sub, fn) => {
        const b = el(`<button class="citem"><span class="clabel">${esc(label)}</span>
          <span class="csub">${esc(sub || "")}</span></button>`);
        b.onclick = fn;
        nav.appendChild(b);
      };
      item("Resume", "back to the counter", () => this.close());
      item("Tonight's tasks", "remind me what I was doing",
        () => { this.close(); this.game.ui.flashObjectives(); });
      item("Settings", "", () => { this.stack.push(() => this.showPause()); this.showSettings(this.tab); });
      item("Credits & licences", "", () => { this.stack.push(() => this.showPause()); this.showCredits(); });
      if (!BUILD.demo && (devmode.on || devmode.unlocked)) {
        item("DEV MODE", "set the clock, tick tasks, jump nights",
          () => { this.stack.push(() => this.showPause()); this.showDevPlay(); });
      }
      item("Save and quit", "back to the main menu",
        () => { this.game.saveNow(); this.game.quitToMenu(); });
      this._present(wrap, "pause");
    };
    this.paint();
  }

  // ——— settings ——————————————————————————————————————————————————
  showSettings(tab = "audio") {
    this.mode = "settings";
    this.tab = tab;
    this.paint = () => {
      const wrap = el(`<div class="cwrap panelwrap">
        <div class="ptop"><button class="pback">← Back</button><h2>Settings</h2>
          <button class="pdefault">Reset to defaults</button></div>
        <div class="ptabs"></div>
        <div class="prows"></div>
      </div>`);
      wrap.querySelector(".pback").onclick = () => this.back();
      wrap.querySelector(".pdefault").onclick = () => {
        if (confirm("Reset all settings?")) { resetSettings(); this.repaint(); }
      };
      const tabs = wrap.querySelector(".ptabs");
      for (const [k, label] of [["audio", "Audio"], ["video", "Video"],
        ["controls", "Controls"], ["comfort", "Comfort"]]) {
        const b = el(`<button class="${k === tab ? "on" : ""}">${label}</button>`);
        b.onclick = () => this.showSettings(k);
        tabs.appendChild(b);
      }
      const rows = wrap.querySelector(".prows");
      for (const r of this._rows(tab)) rows.appendChild(this._row(r));
      this._present(wrap, "panel");
    };
    this.paint();
  }

  _row(r) {
    const row = el(`<div class="prow"><div class="pname">${esc(r.label)}
      ${r.hint ? `<span class="phint">${esc(r.hint)}</span>` : ""}</div>
      <div class="pctl"></div></div>`);
    const ctl = row.querySelector(".pctl");
    if (r.type === "slider") {
      const i = el(`<input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${settings[r.key]}">`);
      const v = el(`<span class="pval">${r.fmt(settings[r.key])}</span>`);
      i.oninput = () => { setSetting(r.key, i.value); v.textContent = r.fmt(Number(i.value)); };
      ctl.append(i, v);
    } else if (r.type === "toggle") {
      const b = el(`<button class="ptoggle ${settings[r.key] ? "on" : ""}">
        <i></i><span>${settings[r.key] ? "On" : "Off"}</span></button>`);
      b.onclick = () => { setSetting(r.key, !settings[r.key]); this.repaint(); };
      ctl.appendChild(b);
    } else if (r.type === "choice") {
      const g = el(`<div class="pchoice"></div>`);
      for (const [val, label] of r.options) {
        const b = el(`<button class="${settings[r.key] === val ? "on" : ""}">${label}</button>`);
        b.onclick = () => { setSetting(r.key, val); this.repaint(); };
        g.appendChild(b);
      }
      ctl.appendChild(g);
    } else if (r.type === "key") {
      const cur = (settings.keys[r.key] || "").replace("Key", "").replace("Left", " L").replace("Digit", "");
      const b = el(`<button class="pkey">${esc(cur)}</button>`);
      b.onclick = () => {
        b.textContent = "press a key…";
        b.classList.add("listening");
        const h = (e) => {
          e.preventDefault();
          removeEventListener("keydown", h, true);
          settings.keys[r.key] = e.code;
          setSetting("keys", settings.keys);
          this.repaint();
        };
        addEventListener("keydown", h, true);
      };
      ctl.appendChild(b);
    } else if (r.type === "action") {
      const b = el(`<button class="pkey">${esc(r.action)}</button>`);
      b.onclick = r.fn;
      ctl.appendChild(b);
    }
    return row;
  }

  _rows(tab) {
    const pct = (v) => Math.round(v * 100) + "%";
    const sl = (key, label, hint, min = 0, max = 1, step = 0.05, fmt = pct) =>
      ({ type: "slider", key, label, hint, min, max, step, fmt });
    const tg = (key, label, hint) => ({ type: "toggle", key, label, hint });
    if (tab === "audio") return [
      sl("volMaster", "Master volume"),
      sl("volAmbience", "Ambience", "the station's own noise"),
      sl("volEffects", "Effects"),
      sl("volVoice", "Voice & telephone"),
      sl("volMusic", "Music"),
      sl("scareVolume", "Loud-scare ceiling", "caps sudden loud sounds only"),
      tg("subtitles", "Subtitles"),
      sl("subtitleSize", "Subtitle size", "", 0.8, 1.8, 0.1, (v) => v.toFixed(1) + "×"),
      tg("subtitleBg", "Subtitle background"),
    ];
    if (tab === "video") return [
      { type: "choice", key: "quality", label: "Graphics quality", hint: "internal resolution and shadows",
        options: [["low", "Low"], ["medium", "Medium"], ["high", "High"]] },
      sl("resScale", "Resolution scale", "", 0.5, 2, 0.1, (v) => v.toFixed(1) + "×"),
      sl("brightness", "Brightness", "", 0.6, 1.6, 0.05, (v) => v.toFixed(2) + "×"),
      sl("fov", "Field of view", "", 60, 100, 1, (v) => Math.round(v) + "°"),
      sl("grain", "Film grain", "", 0, 1.6, 0.05),
      sl("aberration", "Chromatic aberration", "", 0, 1.5, 0.05),
      sl("vignette", "Vignette", "", 0, 1.5, 0.05),
      tg("dither", "Colour dithering", "the 1997 look — off is a cleaner picture"),
      { type: "action", label: "Fullscreen", action: "Toggle", fn: async () => {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen().catch(() => {});
      } },
    ];
    if (tab === "controls") return [
      sl("sensitivity", "Mouse sensitivity", "", 0.2, 2.2, 0.05, (v) => v.toFixed(2)),
      tg("invertY", "Invert vertical look"),
      tg("invertLookX", "Invert horizontal look"),
      tg("holdToInteract", "Hold to interact", "instead of a single press"),
      { type: "key", key: "forward", label: "Walk forward" },
      { type: "key", key: "back", label: "Walk back" },
      { type: "key", key: "left", label: "Step left" },
      { type: "key", key: "right", label: "Step right" },
      { type: "key", key: "interact", label: "Interact" },
      { type: "key", key: "notebook", label: "Notebook" },
      { type: "key", key: "flashlight", label: "Torch on / off" },
      { type: "key", key: "sprint", label: "Sprint (hold)" },
      { type: "key", key: "tasks", label: "Show tasks" },
    ];
    return [
      sl("shake", "Camera shake", "", 0, 1.5, 0.05),
      tg("reduceFlicker", "Reduce light flicker", "steadier lights; scares become visual"),
      tg("motionBlur", "Motion blur"),
      sl("promptScale", "Interaction prompt size", "", 0.8, 1.6, 0.05, (v) => v.toFixed(2) + "×"),
      tg("holdToInteract", "Hold to interact"),
      sl("scareVolume", "Loud-scare ceiling"),
      { type: "action", label: "Remind me what I was doing", action: "Show tasks",
        fn: () => { this.close(); this.game.ui.flashObjectives(); } },
    ];
  }

  // ——— dev mode ——————————————————————————————————————————————————
  //
  // Gated behind a passcode because it is genuinely destructive to a first
  // playthrough: it starts a shift from a blank state, so a night jumped into
  // is missing every flag and clue the nights before it would have set.
  showDevCode() {
    this.mode = "dev";
    this.paint = () => {
      const wrap = el(`<div class="cwrap panelwrap">
        <div class="ptop"><button class="pback">← Back</button><h2>DEV MODE</h2><span></span></div>
        <div class="devcode">
          <p>Enter the passcode.</p>
          <div class="devout">— — — —</div>
          <div class="devpad"></div>
          <div class="deverr"></div>
        </div>
      </div>`);
      wrap.querySelector(".pback").onclick = () => this.back();
      const out = wrap.querySelector(".devout");
      const err = wrap.querySelector(".deverr");
      const pad = wrap.querySelector(".devpad");
      let entry = "";
      const show = () => {
        out.textContent = (entry.split("").join(" ") + " — — — —".slice(entry.length * 2)).trim() || "— — — —";
      };
      const push = (d) => {
        if (entry.length >= 4) return;
        entry += d; show(); err.textContent = "";
        if (entry.length !== 4) return;
        if (tryUnlock(entry)) { this.showDev(); return; }
        err.textContent = "Wrong.";
        entry = ""; show();
      };
      for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
        const b = el(`<button>${k}</button>`);
        b.onclick = () => push(k);
        pad.appendChild(b);
      }
      const clr = el(`<button class="wide">CLEAR</button>`);
      clr.onclick = () => { entry = ""; err.textContent = ""; show(); };
      const zero = el(`<button>0</button>`);
      zero.onclick = () => push("0");
      pad.append(clr, zero);
      // the keyboard works too, because nobody wants to click a keypad
      const onKey = (e) => {
        if (this.mode !== "dev") { removeEventListener("keydown", onKey, true); return; }
        if (/^[0-9]$/.test(e.key)) push(e.key);
        else if (e.key === "Backspace") { entry = entry.slice(0, -1); show(); }
      };
      addEventListener("keydown", onKey, true);
      this._present(wrap, "panel");
    };
    this.paint();
  }

  /** Minute picker: coarse jumps, fine jumps, and the hours that matter. */
  _timeCtl(get, set) {
    const node = el(`<div class="devtime">
      <div class="devclock"></div>
      <div class="devsteps"></div>
      <div class="devpresets"></div>
    </div>`);
    const face = node.querySelector(".devclock");
    const draw = () => { face.textContent = clockString(get()); };
    const clampT = (v) => Math.max(DEV_CLOCK_MIN, Math.min(DEV_CLOCK_MAX, v));
    for (const [label, d] of [["−1h", -60], ["−15", -15], ["+15", 15], ["+1h", 60]]) {
      const b = el(`<button>${label}</button>`);
      b.onclick = () => { set(clampT(get() + d)); draw(); };
      node.querySelector(".devsteps").appendChild(b);
    }
    for (const [label, m] of [["20:20 prep", 20 * 60 + 20], ["21:00 open", 21 * 60],
      ["00:00", 24 * 60], ["03:00", 27 * 60], ["05:40 close", 29 * 60 + 40]]) {
      const b = el(`<button>${label}</button>`);
      b.onclick = () => { set(m); draw(); };
      node.querySelector(".devpresets").appendChild(b);
    }
    draw();
    return node;
  }

  showDev() {
    this.mode = "dev";
    this._devNight = this._devNight || 1;
    this._devClock = this._devClock ?? 20 * 60 + 20;
    this._devSkip = this._devSkip ?? true;
    this.paint = () => {
      const wrap = el(`<div class="cwrap panelwrap">
        <div class="ptop"><button class="pback">← Back</button><h2>DEV MODE</h2>
          <button class="pdefault">Lock</button></div>
        <div class="prows"></div>
      </div>`);
      wrap.querySelector(".pback").onclick = () => this.back();
      wrap.querySelector(".pdefault").onclick = () => { lockDev(); this.back(); };
      const rows = wrap.querySelector(".prows");

      const row = (label, hint, ctlNode) => {
        const r = el(`<div class="prow"><div class="pname">${esc(label)}
          ${hint ? `<span class="phint">${esc(hint)}</span>` : ""}</div>
          <div class="pctl"></div></div>`);
        r.querySelector(".pctl").appendChild(ctlNode);
        rows.appendChild(r);
      };

      const nights = el(`<div class="pchoice"></div>`);
      for (let n = 1; n <= BUILD.lastNight; n++) {
        const b = el(`<button class="${this._devNight === n ? "on" : ""}">${n}</button>`);
        b.onclick = () => { this._devNight = n; this.repaint(); };
        nights.appendChild(b);
      }
      row("Night", "which shift to start", nights);
      row("Start time", "the shift runs 20:20 → 06:00",
        this._timeCtl(() => this._devClock, (v) => { this._devClock = v; }));

      const skip = el(`<button class="ptoggle ${this._devSkip ? "on" : ""}">
        <i></i><span>${this._devSkip ? "On" : "Off"}</span></button>`);
      skip.onclick = () => { this._devSkip = !this._devSkip; this.repaint(); };
      row("Skip the opening cutscene", "straight onto the forecourt", skip);

      const go = el(`<button class="pkey wide">Start this shift</button>`);
      go.onclick = () => this.game.devStart(this._devNight, this._devClock, { skipIntro: this._devSkip });
      row("", "a dev shift starts from a blank state — earlier nights' flags are not set", go);

      this._present(wrap, "panel");
    };
    this.paint();
  }

  /** In-shift dev tools. Only offered when the shift came from dev mode. */
  showDevPlay() {
    this.mode = "dev";
    this.paint = () => {
      const g = this.game;
      const wrap = el(`<div class="cwrap panelwrap">
        <div class="ptop"><button class="pback">← Back</button><h2>DEV · NIGHT ${g.state.night}</h2><span></span></div>
        <div class="prows"></div>
      </div>`);
      wrap.querySelector(".pback").onclick = () => this.back();
      const rows = wrap.querySelector(".prows");
      const row = (label, hint, ctlNode) => {
        const r = el(`<div class="prow"><div class="pname">${esc(label)}
          ${hint ? `<span class="phint">${esc(hint)}</span>` : ""}</div>
          <div class="pctl"></div></div>`);
        r.querySelector(".pctl").appendChild(ctlNode);
        rows.appendChild(r);
      };

      row("Set the clock", "applies immediately",
        this._timeCtl(() => g.state.data.clock, (v) => g.devSetClock(v)));

      const tick = el(`<button class="pkey">Tick it</button>`);
      tick.onclick = () => {
        const next = g.tasks.list.find((t) => !t.done);
        if (!next) { g.ui.toast("Nothing left on the list."); return; }
        g.tasks.done(next.id);
        g.ui.toast(`dev: ${next.id}`);
      };
      row("Complete the next task", "the night's own gates still run", tick);

      const all = el(`<div class="pchoice"></div>`);
      for (let n = 1; n <= BUILD.lastNight; n++) {
        const b = el(`<button>${n}</button>`);
        b.onclick = () => { this.close(); g.devStart(n, g.state.data.clock, { skipIntro: true }); };
        all.appendChild(b);
      }
      row("Jump to another night", "restarts from a blank state", all);

      const quit = el(`<button class="pkey">Main menu</button>`);
      quit.onclick = () => g.quitToMenu();
      row("Leave the shift", "without saving over a real run", quit);

      this._present(wrap, "panel");
    };
    this.paint();
  }

  // ——— credits ——————————————————————————————————————————————————
  showCredits() {
    this.mode = "credits";
    this.paint = () => {
      const wrap = el(`<div class="cwrap panelwrap">
        <div class="ptop"><button class="pback">← Back</button><h2>Credits &amp; licences</h2><span></span></div>
        <pre class="pcredits">${esc(CREDITS_TEXT)}</pre>
      </div>`);
      wrap.querySelector(".pback").onclick = () => this.back();
      this._present(wrap, "panel");
    };
    this.paint();
  }
}
