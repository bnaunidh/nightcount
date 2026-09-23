// THE NIGHT COUNT — adaptive audio.
//
// Three ideas carry the whole soundtrack:
//   1. The station is never silent by accident. A stack of looping layers
//      (fluorescents, cooler, fans, wind) plays continuously and is mixed by
//      *state*, not by trigger.
//   2. Interior and exterior are separate buses, each low-passed when you are
//      on the other side of the glass.
//   3. Silence is an event. `subtract()` pulls a named layer out of the mix,
//      which is the single most frightening thing this system can do.
import * as THREE from "three";
import { settings, settingsBus } from "./settings.js";
import { clamp, rng } from "./util.js";

const FILES = [
  "amb_fluorescent", "amb_fridge", "amb_freezer", "amb_roomtone", "amb_hvac",
  "amb_electric", "amb_ceilingfan", "amb_crt", "amb_neon", "amb_clocktick",
  "amb_wind_desert", "amb_wind_gust", "amb_highway", "amb_insects",
  "amb_powerline", "amb_rain_light", "amb_thunder_far",
  "veh_car_idle", "veh_car_arrive", "veh_car_leave", "veh_car_door",
  "veh_truck_idle", "veh_truck_pass", "veh_truck_airbrake",
  "int_doorchime", "int_door_open", "int_door_close", "int_register_beep",
  "int_scanner", "int_drawer", "int_coins", "int_paper_receipt",
  "int_paper_handle", "int_keys", "int_lock", "int_lightswitch", "int_breaker",
  "int_fridge_door", "int_bottle", "int_can", "int_box_cardboard",
  "int_bag_chips", "int_mop", "int_broom", "int_trashbag", "int_dumpster",
  "int_toilet", "int_sink", "int_phone_ring", "int_phone_pickup",
  "int_radio_static", "int_vhs", "int_pump_nozzle", "int_pump_click",
  "int_coffee", "int_punchcard",
  "step_lino", "step_concrete", "step_gravel",
  "hor_knock", "hor_thump_wall", "hor_metal_far", "hor_creak", "hor_rumble_low",
  "hor_shelf_creak", "hor_bottle_fall", "hor_glass_stress", "hor_static_burst",
  "hor_tape_warble", "hor_drone_tension",
  "hum_breath", "hum_breath_scared", "hum_sigh", "hum_gasp", "hum_whisper",
  "hum_cough", "hum_murmur", "hum_cry", "hum_scream_far", "hum_radio_voice",
  "mus_menu", "mus_title", "mus_climax", "mus_closed", "mus_count", "mus_credits",
  "int_pencil_tick", "int_pencil_write",
  "int_watch_buzz", "int_watch_alarm", "hor_tyre_screech", "hor_crash_bang",
  "amb_rain_heavy", "amb_thunder", "int_mop_bucket",
  "int_salt_pour", "mus_dread", "mus_unease",
  // Added by the §9 coverage sweep. `int_pump_nozzle` was already listed here
  // but had never actually downloaded, so every reference to it played
  // nothing; `int_regkey` was referenced by choices.js and had never existed
  // at all. A slot name in this list is not evidence that a file is behind it
  // — tools/audiocheck.py is.
  "int_panel_metal", "int_regkey",
  // Night 4's tune. ONE recording does three jobs: the song on Night 1's
  // radio, the humming in the dark, and the humming in the car. It has to be
  // the same recording or the payoff does not exist. It is a real CC0 vocal
  // performance — the child version is the same take played back a little
  // faster, which is a pitch shift, not a synthesised or cloned voice.
  "hum_tune",
  // The ending. The monitor is under the credits before anyone knows what it
  // is, which only works if it is a real one.
  "med_monitor", "amb_hospital",
];

// Which bus each layer belongs to (drives the interior/exterior filtering).
const EXTERIOR = new Set([
  "amb_wind_desert", "amb_wind_gust", "amb_highway", "amb_insects",
  "amb_powerline", "amb_rain_light", "veh_car_idle", "veh_truck_idle",
]);

/** Ambience mixes per state. Missing keys fade to zero. */
export const STATES = {
  off:        {},
  normal: {
    amb_fluorescent: 0.34, amb_fridge: 0.30, amb_roomtone: 0.30, amb_hvac: 0.14,
    amb_ceilingfan: 0.10, amb_clocktick: 0.09, amb_neon: 0.07,
    amb_wind_desert: 0.20, amb_insects: 0.11, amb_highway: 0.07, amb_powerline: 0.05,
  },
  customer: {
    amb_fluorescent: 0.30, amb_fridge: 0.26, amb_roomtone: 0.28, amb_hvac: 0.12,
    amb_clocktick: 0.13, amb_wind_desert: 0.13, amb_insects: 0.07,
  },
  suspicion: {
    amb_fluorescent: 0.28, amb_fridge: 0.20, amb_roomtone: 0.34, amb_hvac: 0.10,
    amb_clocktick: 0.16, amb_wind_desert: 0.24, amb_powerline: 0.09,
    hor_drone_tension: 0.07,
  },
  exterior: {
    amb_wind_desert: 0.42, amb_wind_gust: 0.16, amb_insects: 0.16,
    amb_powerline: 0.13, amb_highway: 0.06, amb_neon: 0.10, amb_fluorescent: 0.05,
  },
  outage: {
    amb_roomtone: 0.26, amb_wind_desert: 0.34, amb_wind_gust: 0.14,
    amb_powerline: 0.05, hor_drone_tension: 0.10,
  },
  near: {
    amb_fluorescent: 0.20, amb_roomtone: 0.30, amb_clocktick: 0.18,
    hor_drone_tension: 0.16, amb_wind_desert: 0.12,
  },
  danger: {
    amb_roomtone: 0.20, hor_drone_tension: 0.30, hor_rumble_low: 0.22,
    amb_fluorescent: 0.14, amb_electric: 0.12,
  },
  aftermath: {
    amb_fluorescent: 0.26, amb_roomtone: 0.34, amb_fridge: 0.10,
    amb_wind_desert: 0.18, amb_clocktick: 0.06,
  },
  final: {
    amb_fluorescent: 0.22, amb_roomtone: 0.28, hor_rumble_low: 0.20,
    hor_drone_tension: 0.22, amb_wind_desert: 0.26, amb_electric: 0.10,
  },
};

/** One-shot pools by dread level: what the dark is allowed to do. */
const ONESHOTS = [
  { min: 0, max: 5, pool: ["amb_thunder_far"], w: 0.25 },
  { min: 1, max: 5, pool: ["hor_creak", "hor_shelf_creak"], w: 1 },
  { min: 2, max: 5, pool: ["hor_knock", "hor_metal_far"], w: 0.8 },
  { min: 2, max: 5, pool: ["veh_truck_pass"], w: 0.5 },
  { min: 3, max: 5, pool: ["hor_thump_wall", "hor_bottle_fall", "hor_glass_stress"], w: 1 },
  { min: 4, max: 5, pool: ["hum_whisper", "hum_breath", "hor_static_burst"], w: 0.9 },
];

/**
 * Loudness compensation.
 *
 * This was purely peak-based, and peak is the wrong measure for most of what
 * this game plays. A bin bag rustle or a room-tone bed has one small transient
 * and almost no energy behind it: measured at 103 files, twenty-eight of them
 * sat below an RMS of 0.012, including `amb_fridge`, `amb_roomtone` and
 * `amb_electric` — the layers the entire "the station is never silent" idea
 * rests on. They were being mixed at a third of their intended level and
 * effectively were not there.
 *
 * So it targets RMS now, with peak as a ceiling so a recording with one loud
 * bang in it does not get lifted into distortion. Whichever gain is smaller
 * wins.
 */
const TARGET_RMS = 0.06;      // roughly "clearly present in a quiet mix"
const CEILING = 0.9;          // leave headroom; several sources already clip

function normFactor(buf) {
  const d = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / 6000));
  let peak = 0, sumSq = 0, n = 0;
  for (let i = 0; i < d.length; i += step) {
    const v = d[i];
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
    n++;
  }
  if (peak < 0.001 || !n) return 1;
  const rms = Math.sqrt(sumSq / n);
  const byRms = rms > 1e-5 ? TARGET_RMS / rms : 1;
  const byPeak = CEILING / peak;
  return clamp(Math.min(byRms, byPeak), 0.5, 20);
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.layers = new Map();     // slot -> {src,gain,target}
    this.state = "off";
    this.dread = 0;
    this.inside = true;
    this.ready = false;
    this.muted = new Set();      // layers deliberately subtracted
    this.norm = new Map();       // per-file loudness compensation
    this.rand = rng(1972);
    this._nextOneShot = 20;
    this._pending = [];
    this._onReady = [];
    this._listener = new THREE.Vector3();
    settingsBus.on("change", () => this.applyVolumes());
    const kick = () => this.init();
    addEventListener("pointerdown", kick, { once: true });
    addEventListener("keydown", kick, { once: true });
  }

  async init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn("no WebAudio"); return; }
    this.ctx = new AC({ latencyHint: "interactive" });
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.bus = {};
    for (const b of ["amb", "sfx", "voice", "music"]) {
      const g = c.createGain();
      g.connect(this.master);
      this.bus[b] = g;
    }
    // interior/exterior colouring
    this.filtIn = c.createBiquadFilter(); this.filtIn.type = "lowpass"; this.filtIn.frequency.value = 20000;
    this.filtEx = c.createBiquadFilter(); this.filtEx.type = "lowpass"; this.filtEx.frequency.value = 20000;
    this.busIn = c.createGain(); this.busEx = c.createGain();
    this.busIn.connect(this.filtIn); this.filtIn.connect(this.bus.amb);
    this.busEx.connect(this.filtEx); this.filtEx.connect(this.bus.amb);
    this.applyVolumes();
    this.ready = true;
    for (const f of this._onReady.splice(0)) { try { f(); } catch (e) {} }
    await this.loadAll();
    this.setState(this.state === "off" ? "normal" : this.state, 0.1);
    for (const f of this._pending.splice(0)) f();
    // The spoken lines come after the sound library rather than with it: the
    // library is what the station needs to exist, and the first line of
    // dialogue is a cutscene away. Awaiting it here would hold the menu.
    this.loadVoice().then((n) => {
      if (n) console.info("[audio] %d spoken lines", n);
    });
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = settings;
    this.master.gain.value = s.volMaster;
    this.bus.amb.gain.value = s.volAmbience;
    this.bus.sfx.gain.value = s.volEffects;
    this.bus.voice.gain.value = s.volVoice;
    this.bus.music.gain.value = s.volMusic;
  }

  async loadAll(onProgress) {
    let n = 0;
    await Promise.all(FILES.map(async (slot) => {
      try {
        const r = await fetch("assets/audio/" + slot + ".mp3");
        if (!r.ok) throw new Error(r.status);
        const b = await r.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(b);
        this.buffers.set(slot, buf);
        this.norm.set(slot, normFactor(buf));
      } catch (e) { /* missing sounds simply do not play */ }
      onProgress?.(++n / FILES.length);
    }));
  }

  has(slot) { return this.buffers.has(slot); }

  /**
   * The spoken lines.
   *
   * Loaded as a second pass after the sound library, with their own index, so
   * a build with no voice pass run against it still boots — and so that adding
   * or changing a line is a matter of re-running tools/voice.py rather than of
   * editing a list in here.
   *
   * The index maps the exact line of dialogue to its clip. `ui.say` is
   * synchronous and gets called from the middle of cutscenes, so hashing the
   * string in the browser would mean an async digest in a place that cannot
   * await one; a lookup table costs 20KB and removes the problem.
   */
  async loadVoice(onProgress) {
    this.voiceIndex = new Map();
    let list;
    try {
      const r = await fetch("assets/voice/index.json");
      if (!r.ok) throw new Error(r.status);
      list = await r.json();
    } catch (e) { return 0; }              // no voice pass in this build
    const entries = Object.entries(list);
    let n = 0;
    await Promise.all(entries.map(async ([text, slot]) => {
      try {
        const r = await fetch("assets/voice/" + slot + ".m4a");
        if (!r.ok) throw new Error(r.status);
        const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(slot, buf);
        this.norm.set(slot, normFactor(buf));
        this.voiceIndex.set(text, slot);
      } catch (e) { /* one missing line is one silent line */ }
      onProgress?.(++n / entries.length);
    }));
    return this.voiceIndex.size;
  }

  /** Speak a line of dialogue, if it has been recorded. Returns its length. */
  speak(text, kind = "room", vol = 1.0) {
    const slot = this.voiceIndex?.get(text);
    if (!slot) return 0;
    const buf = this.buffers.get(slot);
    this._lastLine?.stop?.();
    this._lastLine = this.voice(slot, kind, { vol });
    return buf ? buf.duration : 0;
  }

  // ——— looping layers ——————————————————————————————————————————
  _layer(slot) {
    if (this.layers.has(slot)) return this.layers.get(slot);
    const buf = this.buffers.get(slot);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    // avoid every station sounding phase-locked on reload
    src.playbackRate.value = 0.97 + this.rand() * 0.06;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(EXTERIOR.has(slot) ? this.busEx : this.busIn);
    try { src.start(this.rand() * Math.max(0.1, buf.duration - 0.2)); } catch (e) { src.start(); }
    const L = { src, gain: g, target: 0 };
    this.layers.set(slot, L);
    return L;
  }

  /**
   * A looping sound that moves — an engine crossing the forecourt.
   *
   * Distinct from `_layer()`, which owns one shared loop per slot for station
   * ambience. Several vehicles can be audible at once, each with its own
   * position and playback rate, so each gets its own source and panner.
   *
   * Returns a handle: setPosition(v3), rate(r), stop(fade).
   */
  loop(slot, o = {}) {
    if (!this.ready) return null;
    const buf = this.buffers.get(slot);
    if (!buf) return null;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = o.rate ?? 1;
    const g = c.createGain();
    g.gain.value = 0;
    const p = c.createPanner();
    p.panningModel = "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = o.ref ?? 6;
    p.maxDistance = 140;
    p.rolloffFactor = o.rolloff ?? 1.2;
    src.connect(g); g.connect(p); p.connect(this.busEx);
    const pos = o.pos || { x: 0, y: 0, z: 0 };
    const setPos = (v) => {
      if (p.positionX) {
        p.positionX.setTargetAtTime(v.x, c.currentTime, 0.02);
        p.positionY.setTargetAtTime(v.y, c.currentTime, 0.02);
        p.positionZ.setTargetAtTime(v.z, c.currentTime, 0.02);
      } else { p.setPosition(v.x, v.y, v.z); }
    };
    setPos(pos);
    try { src.start(); } catch (e) { return null; }
    const target = (o.vol ?? 1) * (this.norm.get(slot) || 1);
    g.gain.setTargetAtTime(target, c.currentTime, 0.25);
    let stopped = false;
    return {
      setPosition: setPos,
      rate: (r) => { try { src.playbackRate.setTargetAtTime(r, c.currentTime, 0.12); } catch (e) {} },
      gain: (v) => { try { g.gain.setTargetAtTime(v * (this.norm.get(slot) || 1), c.currentTime, 0.2); } catch (e) {} },
      stop: (fade = 0.4) => {
        if (stopped) return;
        stopped = true;
        try {
          g.gain.cancelScheduledValues(c.currentTime);
          g.gain.setTargetAtTime(0, c.currentTime, Math.max(0.05, fade / 3));
          setTimeout(() => { try { src.stop(); } catch (e) {} }, fade * 1000 + 300);
        } catch (e) { try { src.stop(); } catch (e2) {} }
      },
    };
  }

  setState(name, fade = 2.2) {
    this.state = name;
    if (!this.ready) { this._pending.push(() => this.setState(name, fade)); return; }
    const mix = STATES[name] || {};
    const all = new Set([...Object.keys(mix), ...this.layers.keys()]);
    for (const slot of all) {
      const L = this._layer(slot);
      if (!L) continue;
      // field recordings arrive at wildly different levels; normalise so the
      // mix means what it says
      const want = this.muted.has(slot) ? 0 : (mix[slot] || 0) * (this.norm.get(slot) || 1);
      L.target = want;
      L.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      L.gain.gain.setTargetAtTime(want, this.ctx.currentTime, Math.max(0.05, fade / 3));
    }
  }

  /** Remove a layer from the mix — used when the station goes wrong. */
  subtract(slot, on = true, fade = 1.2) {
    if (on) this.muted.add(slot); else this.muted.delete(slot);
    this.setState(this.state, fade);
  }

  setInside(inside) {
    if (this.inside === inside || !this.ready) return;
    this.inside = inside;
    const t = this.ctx.currentTime;
    this.filtEx.frequency.setTargetAtTime(inside ? 750 : 20000, t, 0.25);
    this.filtIn.frequency.setTargetAtTime(inside ? 20000 : 1400, t, 0.25);
    this.busEx.gain.setTargetAtTime(inside ? 0.55 : 1.0, t, 0.3);
    this.busIn.gain.setTargetAtTime(inside ? 1.0 : 0.45, t, 0.3);
  }

  // ——— one-shots ————————————————————————————————————————————————
  /**
   * @param slot sound name
   * @param o {vol, rate, pos:Vector3, bus, delay, scare}
   */
  play(slot, o = {}) {
    // Queued until the context is unlocked — but bounded. Anything that fires
    // on a timer (a customer shifting their weight, an ambience change) would
    // otherwise pile up for as long as the context stays locked and then all
    // arrive at once the moment it opens.
    if (!this.ready) {
      if (this._pending.length < 24) this._pending.push(() => this.play(slot, o));
      return null;
    }
    const buf = this.buffers.get(slot);
    if (!buf) return null;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? (0.98 + this.rand() * 0.04);
    if (o.loop) src.loop = true;      // the heart monitor under the credits
    const g = c.createGain();
    let vol = (o.vol ?? 1) * (this.norm.get(slot) || 1);
    if (o.scare) vol *= settings.scareVolume;
    g.gain.value = vol;
    src.connect(g);
    let node = g;
    if (o.pos) {
      const p = c.createPanner();
      p.panningModel = "equalpower";
      p.distanceModel = "inverse";
      p.refDistance = o.ref ?? 2.2;
      p.maxDistance = 60;
      p.rolloffFactor = o.rolloff ?? 1.1;
      p.positionX?.setValueAtTime(o.pos.x, c.currentTime);
      p.positionY?.setValueAtTime(o.pos.y, c.currentTime);
      p.positionZ?.setValueAtTime(o.pos.z, c.currentTime);
      if (!p.positionX) p.setPosition(o.pos.x, o.pos.y, o.pos.z);
      g.connect(p);
      node = p;
    }
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter.type || "lowpass";
      f.frequency.value = o.filter.freq ?? 1200;
      f.Q.value = o.filter.q ?? 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(this.bus[o.bus || "sfx"]);
    // `dur` plays only the front of a recording. The tune is four notes; the
    // source clip is a longer phrase, and a player who hears eight notes on the
    // radio and four in a corridor has not heard the same thing.
    try {
      src.start(c.currentTime + (o.delay || 0), o.offset || 0, o.dur || undefined);
    } catch (e) { try { src.start(); } catch (e2) {} }
    if (o.duck) this.duck(o.duck, buf.duration);
    if (o.scare && !o.noReact) this._react(vol, o.delay || 0);
    return src;
  }

  /**
   * He reacts to things.
   *
   * Every scare in the game already passes `scare: true` for volume scaling,
   * so this hangs off that one flag rather than being remembered at twelve
   * separate call sites. A beat after something loud, he catches his breath —
   * which is the only thing in the mix that comes from *inside* the player
   * rather than from the building, and it is what makes a bang land as
   * happening to somebody instead of happening near a camera.
   *
   * Cooled down, so a scare made of three sounds in a row is one reaction, not
   * three. Recorded human performances, like everything else here — nothing in
   * this game is synthesised or spoken by a machine.
   */
  _react(vol, delay) {
    if (vol < 0.45) return;                      // small noises do not do this
    const now = this.ctx.currentTime;
    if (now < (this._reactUntil || 0)) return;
    this._reactUntil = now + 6;
    this.play(vol > 0.8 ? "hum_gasp" : "hum_breath_scared", {
      vol: 0.30, noReact: true, bus: "voice",
      delay: delay + 0.28 + this.rand() * 0.22,
      rate: 0.94 + this.rand() * 0.12,
    });
  }

  /** Phone / radio / security-monitor colouring for human recordings. */
  voice(slot, kind = "phone", o = {}) {
    const f = { phone: { type: "bandpass", freq: 1500, q: 1.1 },
                radio: { type: "bandpass", freq: 1900, q: 1.5 },
                tape:  { type: "lowpass", freq: 2600, q: 0.8 },
                room:  null }[kind];
    return this.play(slot, { bus: "voice", filter: f, vol: o.vol ?? 1, ...o });
  }

  duck(amount = 0.45, secs = 1.5) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const g = this.bus.amb.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(settings.volAmbience * (1 - amount), t, 0.12);
    g.setTargetAtTime(settings.volAmbience, t + secs, 0.5);
  }

  /**
   * One footfall.
   *
   * These recordings are *sequences* — several seconds of somebody walking —
   * and the whole file was being played from the top every 0.78 m. Three or
   * four overlapping copies of a walk cycle is not a footstep; it is a crowd,
   * slightly out of phase with itself, and it was the first thing a player
   * said was wrong.
   *
   * A short window from a random position gives a different footfall each time
   * out of the same recording, which is also why the file is long.
   */
  step(surface) {
    const slot = { lino: "step_lino", tile: "step_lino", concrete: "step_concrete", gravel: "step_gravel" }[surface] || "step_lino";
    const buf = this.buffers.get(slot);
    const dur = 0.26;
    const offset = buf ? this.rand() * Math.max(0, buf.duration - dur) : 0;
    this.play(slot, { vol: 0.3, rate: 0.94 + this.rand() * 0.12, offset, dur });
  }

  setDread(d) { this.dread = clamp(d, 0, 5); }

  /** Called every frame: listener pose + the random unsettling one-shots. */
  update(dt, camera, player) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      // direct assignment, not setValueAtTime: scheduling an event per frame
      // grows the parameter timeline forever and gets slower as it does
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = u.x; l.upY.value = u.y; l.upZ.value = u.z;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    if (player) this.setInside(player.inside());

    if (this.state === "off" || this.dread <= 0) return;
    this._nextOneShot -= Math.min(dt, 0.2);   // compressed test ticks must not spam
    if (this._nextOneShot > 0) return;
    // higher dread = more often, but never metronomic
    const base = 42 - this.dread * 5.5;
    this._nextOneShot = base * (0.55 + this.rand() * 1.1);
    const opts = ONESHOTS.filter((o) => this.dread >= o.min && this.dread <= o.max);
    let total = 0; for (const o of opts) total += o.w;
    let r = this.rand() * total;
    for (const o of opts) {
      r -= o.w;
      if (r <= 0) {
        const slot = o.pool[Math.floor(this.rand() * o.pool.length)];
        // place it somewhere the player is not looking at
        const ang = this.rand() * Math.PI * 2;
        const d = 5 + this.rand() * 9;
        const pos = new THREE.Vector3(p.x + Math.cos(ang) * d, 1.2, p.z + Math.sin(ang) * d);
        this.play(slot, { vol: 0.22 + this.dread * 0.045, pos, rolloff: 1.4 });
        break;
      }
    }
  }
}
