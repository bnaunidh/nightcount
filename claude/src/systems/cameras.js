// THE NIGHT COUNT — the security system.
//
// The feeds are real: selecting a camera renders the world from that camera
// through the CRT path in the composite shader, at a deliberately low frame
// rate. Because they are real renders, the "visible only on camera" trick is
// done with render layers rather than with a video file — the Attendant is on
// layer 1, which the player's eyes never see and every camera does.
import * as THREE from "three";
import { el, escapeHTML } from "../core/ui.js";
import { clockString } from "../core/util.js";

export const LAYER_CAMERA_ONLY = 1;

export const FEEDS = [
  { id: 1, name: "FORECOURT", pos: [0, 4.2, -4.6], look: [0, 0.8, -12], fov: 70 },
  { id: 2, name: "PUMPS",     pos: [0, 4.2, -8.4], look: [0, 0.9, -14], fov: 74 },
  { id: 3, name: "AISLE 3",   pos: [3.1, 2.75, 2.2], look: [1.0, 1.0, 7.4], fov: 68 },
  { id: 4, name: "COOLER",    pos: [-1.1, 2.75, 3.6], look: [2.6, 1.1, 7.6], fov: 66 },
  { id: 5, name: "STOCK",     pos: [-1.5, 2.6, 8.5], look: [0.6, 0.9, 12.2], fov: 70 },
  { id: 6, name: "REAR EXT",  pos: [1.6, 3.1, 12.5], look: [4.0, 0.6, 18.0], fov: 72 },
  // Camera 7 does not exist. It becomes selectable on Night 6.
  { id: 7, name: "———",       pos: [-4.6, 2.3, 4.9], look: [-4.6, 1.4, 1.2], fov: 60, hidden: true },
];

export class CameraSystem {
  constructor(game) {
    this.g = game;
    this.cams = [];
    this.selected = 1;
    this.open = false;
    this.powered = true;
    this.offset = new Map();      // feed id -> timestamp offset in minutes
    this.dead = new Set();
    this.available = new Set();   // which feeds are wired up (grows on Night 2)
    this._t = 0;
    this._surface = null;
    this.recording = false;
    this.incidents = [];
    this.quad = false;
    this.seq = false;
    this._seqT = 0;

    for (const f of FEEDS) {
      const c = new THREE.PerspectiveCamera(f.fov, 4 / 3, 0.08, 140);
      c.position.set(...f.pos);
      c.lookAt(new THREE.Vector3(...f.look));
      c.layers.enable(LAYER_CAMERA_ONLY);
      c.userData.feed = f;
      this.cams.push(c);
    }

    game.interact.add({
      id: "cambank",
      // IN FRONT of the screens, not behind them. The monitors face -z and the
      // player stands on that side; `+0.4` put the prompt against the back wall
      // with the bank between it and the room, so "Watch the monitors" appeared
      // where no monitor could be seen. `__auditInvisible()` is what found it.
      pos: new THREE.Vector3(game.station.anchors.camera_bank.x, 1.2,
                             game.station.anchors.camera_bank.z - 0.42),
      radius: 2.0, label: "the monitors", verb: "Watch",
      enabled: () => this.available.size > 0,
      onUse: () => this.show(),
    });
  }

  resetForNight(n) {
    this.dead.clear();
    this.offset.clear();
    this.available = new Set(n >= 2 ? [1, 2, 3, 4, 5, 6] : []);
    this.incidents = [];
    this.powered = true;
  }

  camFor(id) { return this.cams[FEEDS.findIndex((f) => f.id === id)]; }
  feedFor(id) { return FEEDS.find((f) => f.id === id); }

  /**
   * The bank is a 1990s video multiplexer: a front panel of camera buttons,
   * QUAD and SEQ modes, a REC lamp, and an OSD burned into the picture with a
   * hard black outline. There is no windowed "app" here — the picture fills
   * the monitor and the furniture sits on top of it.
   */
  show() {
    if (this.g.ui.focused) return;
    this.open = true;
    const surface = el(`<div class="mux">
      <div class="osd feedname" style="left:3.5%;top:4%"></div>
      <div class="osd stamp" style="right:3.5%;top:4%;left:auto"></div>
      <div class="osd date" style="right:3.5%;top:9%;left:auto"></div>
      <div class="osd rec" style="left:3.5%;top:9%"></div>
      <div class="quadlabels"></div>
      <div class="panel">
        <span class="plate">MERIDIAN · VM-6 MULTIPLEXER</span>
        <span class="lamp"></span>
        <span class="cambtns"></span>
        <button class="quad">QUAD</button>
        <button class="seq">SEQ</button>
        <button class="logb">LOG INCIDENT</button>
        <span class="hint">1–6 camera · Q quad · S sequence · SPACE log · ESC away</span>
      </div>
    </div>`);
    this._surface = surface;
    const host = surface.querySelector(".cambtns");
    for (const f of FEEDS) {
      if (f.hidden && !this.available.has(f.id)) continue;
      const b = el(`<button data-id="${f.id}">${f.id} ${escapeHTML(f.name)}</button>`);
      b.onclick = () => this.select(f.id);
      host.appendChild(b);
    }
    surface.querySelector(".quad").onclick = () => this.setQuad(!this.quad);
    surface.querySelector(".seq").onclick = () => this.setSeq(!this.seq);
    surface.querySelector(".logb").onclick = () => this.logIncident();
    this._key = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) this.select(n);
      if (e.code === "KeyQ") this.setQuad(!this.quad);
      if (e.code === "KeyS") this.setSeq(!this.seq);
      if (e.code === "Space") { e.preventDefault(); this.logIncident(); }
    };
    addEventListener("keydown", this._key);
    this.g.ui.openFocus(surface, {
      escLabel: null, clear: true,
      onClose: () => {
        this.open = false;
        this.seq = false;
        removeEventListener("keydown", this._key);
        this.g.bus.emit("cameras:closed");
      },
    });
    this.select(this.selected);
    this.g.audio.play("amb_crt", { vol: 0.25 });
    this.g.bus.emit("cameras:opened");
  }

  setQuad(v) {
    this.quad = v;
    if (v) this.seq = false;
    this._paint();
    this.g.audio.play("int_lightswitch", { vol: 0.3 });
  }

  setSeq(v) {
    this.seq = v;
    this._seqT = 0;
    if (v) this.quad = false;
    this._paint();
  }

  /** The four feeds shown in quad mode, in panel order. */
  quadFeeds() {
    const live = [...this.available].filter((id) => id <= 6).sort((a, b) => a - b);
    const start = live.indexOf(this.selected);
    const from = start < 0 ? 0 : Math.floor(start / 4) * 4;
    return live.slice(from, from + 4);
  }

  select(id) {
    if (!this.available.has(id)) return;
    this.selected = id;
    this.g.bus.emit("cameras:select", id);
    this._paint();
  }

  _paint() {
    const s = this._surface;
    if (!s) return;
    const f = this.feedFor(this.selected);
    const dead = this.dead.has(this.selected) || !this.powered;
    const off = this.offset.get(this.selected) || 0;
    const secs = String(Math.floor((this.g.minutes * 60) % 60)).padStart(2, "0");

    s.querySelector(".feedname").textContent =
      this.quad ? "QUAD" : "CAM " + String(this.selected).padStart(2, "0") + "  " + (f ? f.name : "");
    s.querySelector(".stamp").textContent = dead && !this.quad ? "" : clockString(this.g.minutes + off, true) + ":" + secs;
    s.querySelector(".date").textContent = dead && !this.quad ? "" : DATE_FOR[this.g.state.night] || "";
    s.querySelector(".rec").textContent = this.powered ? (dead && !this.quad ? "NO SIGNAL" : "REC") : "SYSTEM UNPOWERED";

    // quad corner labels, positioned over the four viewports
    const ql = s.querySelector(".quadlabels");
    ql.innerHTML = "";
    if (this.quad) {
      const ids = this.quadFeeds();
      const at = [["3.5%", "4%"], ["53.5%", "4%"], ["3.5%", "52%"], ["53.5%", "52%"]];
      ids.forEach((id, i) => {
        const lab = el(`<div class="quadlbl" style="left:${at[i][0]};top:${at[i][1]}">CAM ${String(id).padStart(2, "0")}${this.dead.has(id) ? "  NO SIGNAL" : ""}</div>`);
        ql.appendChild(lab);
      });
    }
    for (const b of s.querySelectorAll(".cambtns button")) {
      const id = Number(b.dataset.id);
      b.classList.toggle("on", !this.quad && id === this.selected);
      b.classList.toggle("dead", this.dead.has(id) || !this.powered);
    }
    s.querySelector(".quad")?.classList.toggle("on", !!this.quad);
    s.querySelector(".seq")?.classList.toggle("on", !!this.seq);
    s.querySelector(".lamp")?.classList.toggle("rec", !!this.powered);
  }

  logIncident() {
    if (!this.open) return;
    const rec = {
      cam: this.selected, at: this.g.minutes, night: this.g.state.night,
      what: this.g.bus.emit("incident:describe", this.selected) || "",
    };
    this.incidents.push(rec);
    this.g.state.note(`Logged incident — camera ${this.selected}, ${clockString(this.g.minutes)}.`, this.g.minutes);
    this.g.ui.toast("Incident logged.");
    this.g.audio.play("int_paper_handle", { vol: 0.4 });
    this.g.bus.emit("incident", rec);
  }

  /** The active render camera while the bank is open (used by main loop). */
  activeCamera() {
    if (!this.open) return null;
    if (this.dead.has(this.selected) || !this.powered) return null;
    return this.camFor(this.selected);
  }

  killFeed(id, on = true) {
    if (on) this.dead.add(id); else this.dead.delete(id);
    this._paint();
  }

  setPowered(v) {
    this.powered = v;
    this._paint();
  }

  update(dt) {
    this._t += dt;
    if (!this.open) return;
    // auto-sequence steps through the live feeds, like the real panel button
    if (this.seq) {
      this._seqT = (this._seqT || 0) + dt;
      if (this._seqT > 3.5) {
        this._seqT = 0;
        const live = [...this.available].filter((id) => id <= 6).sort((a, b) => a - b);
        const i = live.indexOf(this.selected);
        this.selected = live[(i + 1) % live.length] || 1;
        this._paint();
      }
    }
    // repaint the OSD roughly twice a second — the feed itself is frame-limited
    if (this._t > 0.45) { this._t = 0; this._paint(); }
  }
}

const DATE_FOR = {
  1: "10-23-97", 2: "10-24-97", 3: "10-27-97",
  4: "10-29-97", 5: "10-30-97", 6: "10-31-97",
};
