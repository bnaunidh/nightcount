// THE NIGHT COUNT — electrical system.
//
// Five circuits, four circuits' worth of service. From Night 3 the player is
// permanently choosing what to leave dark, and every choice has a horror cost:
// no cooler spoils stock, no cameras removes the cross-check, no canopy means
// arrivals reach the window before you know they are there.
import { LIT_DECALS } from "../core/assets.js";
import * as THREE from "three";
import { el, escapeHTML } from "../core/ui.js";
import { settings } from "../core/settings.js";
import { clamp } from "../core/util.js";

export const CIRCUITS = [
  { id: "store",  label: "C1  SALES FLOOR",  hint: "ceiling lights, register" },
  { id: "cooler", label: "C3  REFRIGERATION", hint: "cooler + freezer" },
  { id: "canopy", label: "C5  CANOPY / SIGN", hint: "forecourt lighting" },
  { id: "cams",   label: "C7  SECURITY",      hint: "cameras and recorder" },
  { id: "back",   label: "C9  BACK OF HOUSE", hint: "office, stock, restroom" },
];

export class PowerSystem {
  constructor(game) {
    this.g = game;
    this.on = { store: true, cooler: true, canopy: true, cams: true, back: true };
    this.capacity = 5;
    this.mainTripped = false;
    this.serviceOff = false;       // the pole disconnect
    this.coolerWarm = 0;           // seconds without refrigeration
    this.flicker = 0;
    this._t = 0;
    this._surface = null;
    this._base = {};

    const A = game.station.anchors;
    game.interact.add({
      id: "breakers", pos: new THREE.Vector3(A.breaker.x, 1.45, 11.7),
      radius: 1.7, label: "the breaker panel", verb: "Open",
      enabled: () => game.state.night >= 3 || game.state.flag("panel_unlocked"),
      onUse: () => this.show(),
    });
    game.interact.add({
      id: "service", pos: new THREE.Vector3(A.pole.x, 1.5, A.pole.z - 0.4),
      radius: 2.2, label: "the service disconnect", verb: "Throw",
      enabled: () => game.state.flag("pole_task"),
      onUse: () => this.throwService(),
    });

    for (const k of Object.keys(game.station.lights)) {
      this._base[k] = game.station.lights[k].intensity;
    }
  }

  resetForNight(n) {
    this.capacity = n >= 3 ? 4 : 5;
    // From Night 3 the service is four circuits and there are five, so the
    // night cannot *start* with all five live: the first breaker the player
    // touched found the load already over capacity and tripped the main
    // instantly, blacking out the whole station before they had done anything
    // wrong. The night now opens at the limit, with the forecourt dark, which
    // is the choice the design was always asking them to make — it just made
    // it for them once, at the start, instead of punishing them for it.
    this.on = { store: true, cooler: true, canopy: true, cams: true, back: true };
    if (this.capacity < 5) this.on.canopy = false;
    this.mainTripped = false;
    this.serviceOff = false;
    this.coolerWarm = 0;
    this.apply();
  }

  get load() { return Object.values(this.on).filter(Boolean).length; }

  set(id, v) {
    if (this.mainTripped && v) { this.g.ui.toast("Nothing happens. The main is out."); return; }
    if (v && this.load >= this.capacity) {
      // overload: the main goes, everything goes
      this.on[id] = true;
      this.mainTripped = true;
      for (const k of Object.keys(this.on)) this.on[k] = false;
      this.g.audio.play("int_breaker", { vol: 0.8, scare: true });
      this.g.audio.play("hor_thump_wall", { vol: 0.4, delay: 0.05 });
      this.g.ui.toast("The main goes. Everything goes with it.");
      this.g.player.shake(0.05, 0.3);
      this.apply(); this.paint();
      this.g.bus.emit("power:trip");
      return;
    }
    this.on[id] = v;
    this.g.audio.play("int_breaker", { vol: 0.55 });
    this.apply(); this.paint();
    this.g.bus.emit("power:change", id, v);
  }

  resetMain() {
    this.mainTripped = false;
    this.on = { store: true, cooler: true, canopy: false, cams: true, back: false };
    this.g.audio.play("int_breaker", { vol: 0.7 });
    this.apply(); this.paint();
    this.g.bus.emit("power:reset");
  }

  throwService() {
    this.serviceOff = !this.serviceOff;
    this.g.audio.play("int_breaker", { vol: 0.9, pos: this.g.player.pos.clone() });
    this.apply();
    this.g.bus.emit("power:service", this.serviceOff);
  }

  isOn(id) { return !this.serviceOff && !this.mainTripped && this.on[id]; }

  apply() {
    const S = this.g.station, L = S.lights;
    const store = this.isOn("store"), back = this.isOn("back"),
      canopy = this.isOn("canopy"), cooler = this.isOn("cooler");
    const setL = (name, on, scale = 1) => {
      // a fluorescent's floor-bounce companion is on the same circuit
      for (const n of [name, name + "_b"]) {
        const l = L[n];
        if (l) l.intensity = on ? this._base[n] * scale : 0;
      }
    };
    for (const n of ["fl_counter", "fl_mid", "fl_east", "fl_west"]) setL(n, store);
    setL("front", store);
    for (const n of ["fl_bath", "fl_office", "fl_stock"]) setL(n, back);
    setL("rear", back);
    setL("canopy", canopy);
    setL("cooler_glow", cooler);
    // The cooler is built in segments now, so there is a glow per run.
    for (const gl of (Array.isArray(S.coolerGlow) ? S.coolerGlow : [S.coolerGlow])) {
      if (!gl) continue;
      gl.visible = cooler;
      gl.material.color.setHex(cooler ? 0xcfe6ec : 0x11161a);
    }
    S.canopyFasciaMat.color.setHex(canopy ? 0xd8d3c2 : 0x1a1a18);
    // lit signs and the register's readout are on the store circuit
    for (const mat of LIT_DECALS) mat.emissiveIntensity = store ? 0.9 : 0.03;
    // the soffit's glow and the fitting lenses go out with the canopy
    S.materials.lamp?.color.setHex(canopy ? 0xfff2d6 : 0x151410);
    S.materials.soffit?.emissive.setHex(canopy ? 0x24221c : 0x000000);
    S.signFace.material.color.setHex(canopy && !this.g.state.flag("sign_off") ? 0xd8cfae : 0x14140f);
    if (S.bankFaces) {
      for (const f of S.bankFaces.children) {
        f.material.color.setHex(this.isOn("cams") ? 0x3d4c42 : 0x0a0c0a);
      }
    }
    // A light at zero intensity still renders its shadow map — a full extra
    // pass over every caster in the scene, every frame, for a lamp that is
    // off. With the canopy circuit dark (which is now the default from Night 3
    // on) that was 44% of the scene pass being spent on a light nobody can
    // see. Shadows follow the switch.
    for (const k of Object.keys(S.lights)) {
      const l = S.lights[k];
      if (!l || l.userData.noShadow) continue;
      if (l.userData.wantsShadow === undefined) l.userData.wantsShadow = l.castShadow;
      l.castShadow = l.userData.wantsShadow && l.intensity > 0.001;
    }
    this.g.cameras.setPowered(this.isOn("cams"));
    this.g.audio.subtract("amb_fridge", !cooler, 1.4);
    this.g.audio.subtract("amb_freezer", !cooler, 1.4);
    this.g.audio.subtract("amb_fluorescent", !store, 0.9);
    this.g.audio.subtract("amb_neon", !canopy, 1.2);
  }

  /** Force a flicker event (used by the night scripts). */
  flickerNow(secs = 1.2, hard = false) {
    if (settings.reduceFlicker && !hard) { this.g.ui.toast("The lights buzz."); return; }
    this.flicker = Math.max(this.flicker, secs);
    this.g.audio.play("hor_static_burst", { vol: 0.25 });
  }

  /** Everything at once — including the fridges, which is the part that lands. */
  blackout(on) {
    for (const c of CIRCUITS) this.set(c.id, !on);
    this.g.bus.emit("power:blackout", !!on);
  }

  show() {
    // The panel door itself. Throwing a breaker had a sound; getting the panel
    // open did not, so the most dangerous object in the building opened in
    // silence.
    this.g.audio.play("int_panel_metal", { vol: 0.5 });
    const surface = el(`<div class="doc" style="max-width:520px">
      <h1>Meridian 41 — Panel A</h1>
      <div class="meta">SERVICE 60A · 1974 · DO NOT EXCEED FOUR CIRCUITS UNDER LOAD</div>
      <div class="rows"></div>
      <div class="cap"></div>
      <button class="closeb">CLOSE PANEL</button>
    </div>`);
    this._surface = surface;
    surface.querySelector(".closeb").onclick = () => this.g.ui.closeFocus();
    this.g.ui.openFocus(surface, { escLabel: "ESC — close the panel" });
    this.paint();
  }

  paint() {
    const s = this._surface;
    if (!s || !document.body.contains(s)) return;
    const rows = s.querySelector(".rows");
    rows.innerHTML = "";
    for (const c of CIRCUITS) {
      const r = el(`<div class="mrow" style="color:#20211c;border-color:#b9b3a0">
        <label>${escapeHTML(c.label)}<span class="hint" style="color:#6b6a5c">${escapeHTML(c.hint)}</span></label>
      </div>`);
      const b = el(`<button style="min-width:74px;background:${this.on[c.id] ? "#3f5c3c" : "#5c3f3c"}">${this.on[c.id] ? "ON" : "OFF"}</button>`);
      b.onclick = () => this.set(c.id, !this.on[c.id]);
      r.appendChild(b);
      rows.appendChild(r);
    }
    const cap = s.querySelector(".cap");
    if (this.mainTripped) {
      cap.innerHTML = `<div class="stamp">MAIN TRIPPED</div>`;
      const b = el(`<button>RESET MAIN</button>`);
      b.onclick = () => this.resetMain();
      cap.appendChild(b);
    } else {
      cap.innerHTML = `<p class="faint">Load ${this.load} of ${this.capacity} circuits.</p>`;
    }
  }

  update(dt) {
    // cooler spoilage
    if (!this.isOn("cooler")) {
      this.coolerWarm += dt;
      if (this.coolerWarm > 240 && !this._spoiled) {
        this._spoiled = true;
        this.g.state.data.spoiledStock++;
        this.g.ui.toast("The cooler has been off too long. That's stock written off.");
        this.g.bus.emit("cooler:spoiled");
      }
    } else { this.coolerWarm = Math.max(0, this.coolerWarm - dt * 2); this._spoiled = false; }

    // flicker
    if (this.flicker > 0) {
      this.flicker -= dt;
      const L = this.g.station.lights;
      const f = Math.random() < 0.35 ? 0.12 : 1;
      for (const n of ["fl_counter", "fl_mid", "fl_east", "fl_west"]) {
        if (L[n] && this.isOn("store")) L[n].intensity = this._base[n] * f;
        if (L[n + "_b"] && this.isOn("store")) L[n + "_b"].intensity = this._base[n + "_b"] * f;
      }
      if (this.flicker <= 0) this.apply();
    }
  }
}
