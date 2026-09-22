// THE NIGHT COUNT — the hub. Owns the run, the clock, the systems and the
// night scripts; everything else is a module it wires together.
import * as THREE from "three";
import { State } from "./state.js";
import { Tasks } from "./tasks.js";
import { Menus } from "../ui/menu.js";
import { settings } from "../core/settings.js";
import { clamp, makeTimers, clockString, money, Bus } from "../core/util.js";
import { inputBus, setInputEnabled, requestLock, releaseLock } from "../core/input.js";

import { RegisterSystem } from "../systems/register.js";
import { CameraSystem } from "../systems/cameras.js";
import { PowerSystem } from "../systems/power.js";
import { DocSystem } from "../systems/docs.js";
import { PhoneSystem } from "../systems/phone.js";
import { ChoreSystem } from "../systems/chores.js";
import { Shotgun } from "../systems/shotgun.js";
import { Delivery } from "../systems/delivery.js";
import { Inventory } from "../systems/inventory.js";
import { Doppelganger } from "../systems/doppelganger.js";
import { Weather } from "../systems/weather.js";
import { WorldUse } from "../systems/world-use.js";
import { Flashlight } from "../systems/flashlight.js";
import { Music } from "../core/music.js";
import { CustomerSystem } from "./customers.js";
import { VehicleDirector } from "./vehicles.js";
import { Watch } from "../systems/watch.js";
import { Salt } from "../systems/salt.js";
import { Unscheduled } from "../systems/unscheduled.js";
import { Choices } from "../core/choices.js";
import { devmode } from "../core/devmode.js";
import { BUILD, NIGHT_WORD } from "../core/build.js";
import { Attendant } from "./attendant.js";
import { NIGHTS } from "./nights.js";
import { ENDINGS } from "./endings.js";

/**
 * Interactions a night script registers for one beat and one night only.
 * Anything in here is removed when a shift starts. Systems-owned spots (the
 * register, the doors, the salt thresholds, the chores) are not in this list
 * and are never removed.
 */
const NIGHT_SCOPED = [
  "investigate", "crash_site", "trail", "pole", "clean", "readings_hint",
  "aisle4", "plan", "tally5", "call", "callaunt", "folders", "n5cabinet",
  "bathunlock", "bathsalt", "nova", "runcar",
];

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);              // renderer scene camera station player interact ui audio canvas
    this.state = new State();
    this.tasks = new Tasks(this.ui);
    this.timers = makeTimers();
    this.bus = new Bus();
    this.paused = false;
    this.mode = "boot";                    // boot | menu | play | cutscene | ending
    this.dread = 0;
    this.clockRate = 0.55;                 // in-game minutes per real second
    this.script = null;
    this.postFX = {};
    this.gen = 0;          // bumped whenever the world is torn down

    // A slow drift across the forecourt, playing behind the menus. It is the
    // real station, lit and rendered by the real pipeline — not a backdrop.
    this.menuCam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
    this.menuT = 0;
    this.menuShots = [
      { from: [15.5, 2.4, -15.0], to: [10.5, 2.0, -17.5], look: [-1.5, 1.5, -1.0] },
      { from: [-13.0, 1.9, -13.0], to: [-8.5, 2.2, -16.0], look: [1.0, 1.6, -2.0] },
      { from: [2.5, 1.7, -20.0], to: [-2.5, 1.7, -19.0], look: [0.0, 3.4, -6.0] },
      { from: [9.0, 1.6, -3.5], to: [9.0, 1.6, 3.0], look: [-2.0, 1.5, 4.0] },
    ];
    this.shot = 0;
  }

  /** Advance the menu camera. Shots are 14s each and cross-cut, never cut hard. */
  updateMenuCamera(dt) {
    this.menuT += dt;
    const LEN = 14;
    if (this.menuT > LEN) {
      this.menuT = 0;
      this.shot = (this.shot + 1) % this.menuShots.length;
    }
    const s = this.menuShots[this.shot];
    const t = this.menuT / LEN;
    const e = t * t * (3 - 2 * t);            // ease so the drift never snaps
    this.menuCam.position.set(
      s.from[0] + (s.to[0] - s.from[0]) * e,
      s.from[1] + (s.to[1] - s.from[1]) * e,
      s.from[2] + (s.to[2] - s.from[2]) * e
    );
    this.menuCam.lookAt(s.look[0], s.look[1], s.look[2]);
  }

  async init() {
    this.menus = new Menus(this);
    this.register = new RegisterSystem(this);
    this.cameras = new CameraSystem(this);
    this.power = new PowerSystem(this);
    this.docs = new DocSystem(this);
    this.phone = new PhoneSystem(this);
    this.inventory = new Inventory(this);
    this.chores = new ChoreSystem(this);
    this.torch = new Flashlight(this);
    this.music = new Music(this.audio);
    this.customers = new CustomerSystem(this);
    this.vehicles = new VehicleDirector(this);
    this.watch = new Watch(this);
    this.salt = new Salt(this);
    this.unscheduled = new Unscheduled(this);
    this.choices = new Choices(this);
    this.attendant = new Attendant(this);

    await this.customers.init();

    this.player.onStep = (surf) => this.audio.step(surf);

    // Wren keeps the list on paper. Finishing a job is a pencil stroke.
    this.tasks.bus.on("done", () => {
      this.audio.play(Math.random() < 0.5 ? "int_pencil_tick" : "int_pencil_write",
        { vol: 0.85, rate: 0.96 + Math.random() * 0.08 });
    });
    this._baseInteractions();
    this.worldUse = new WorldUse(this);
    this.delivery = new Delivery(this);
    await this.delivery.init();
    this.shotgun = new Shotgun(this);
    this.weather = new Weather(this);
    this.doppelganger = new Doppelganger(this);

    inputBus.on("press", (code) => {
      if (this.mode !== "play" || this.ui.focused) return;
      if (code === settings.keys.notebook) this.docs.openNotebook();
      if (code === settings.keys.tasks) this.ui.flashObjectives();
    });

    this.ui.showHUD(false);
    this.menus.showMain();
    this.mode = "menu";
    this.music.play("menu");
    // The browser will not start audio until the first click, by which time the
    // menu cue has already been queued and forgotten. Start it again the moment
    // sound is actually available — but only if we are still on the menu.
    this.audio.bus?.music || this.audio.onReady?.(() => {
      if (this.mode === "menu") this.music.play("menu");
    });
  }

  // ——— framework ————————————————————————————————————————————————
  canPause() { return this.mode === "play" || this.mode === "cutscene"; }
  acceptsLock() { return this.mode === "play" && !this.paused && !this.menus.open; }
  pauseSubtitle() {
    return `NIGHT ${this.state.night} · ${clockString(this.state.data.clock)}`;
  }
  setPaused(p) {
    this.paused = p;
    setInputEnabled(true);
    if (p) releaseLock();
  }
  onMenuClosed() {
    if (this.mode === "play" || this.mode === "cutscene") {
      this.setPaused(false);
      requestLock(this.canvas);
    }
  }
  /** Everything Continue needs to put the player back where they were. */
  snapshot() {
    if (this.mode !== "play" && this.mode !== "cutscene") return;
    this.state.data.resume = {
      night: this.state.night, x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw,
      clock: this.state.data.clock,
      done: this.tasks.list.filter((t) => t.done).map((t) => t.id),
      torch: !!this.torch?.have,
    };
  }

  saveNow() {
    if (this.mode === "play") {
      this.snapshot();
      this.state.save();
      this.ui.toast("Shift saved.");
    }
  }
  quitToMenu() {
    this.gen++;
    this.mode = "menu";
    this.music.play("menu");
    this.setPaused(false);
    this.script?.abort?.();
    this.script = null;
    if(resume?.night != null && resume.night !== n)resume=null;
    this.tasks.clear();this.tasks.resumeDone=null;
    this.interact._markKey=null;this.interact._clearMarkers();
    this.phone?.reset();
    this.doppelganger?.reset();
    this.customers.clearAll();
    this.delivery?.reset();
    this.shotgun?.reset();
    this.vehicles.clearAll();
    this.attendant.hide();
    this.tasks.clear();
    this.ui.showHUD(false);
    this.ui.clearSubs();
    this.audio.setState("off", 1.0);
    this.menus.showMain();
  }

  async newGame() {
    this.state.reset();
    this.state.data.started = true;
    this.menus.close();
    await this.startNight(1, true);
  }

  async continueGame() {
    if (!this.state.load()) return this.newGame();
    this.menus.close();
    // Belt and braces on top of the demo's own save key: never try to start a
    // night this build does not contain.
    const n = Math.min(this.state.data.night, BUILD.lastNight);
    await this.startNight(n, false, n === this.state.data.night ? this.state.data.resume : null);
  }

  /**
   * Start any night at any hour, from the dev menu.
   *
   * The state is reset first, deliberately: a night jumped into has none of the
   * flags or clues the nights before it would have set, and pretending
   * otherwise would make a dev shift diverge from a real one in ways that are
   * invisible until something reads a flag that was never written. Blank is at
   * least a state you can reason about.
   */
  async devStart(night, clock, opts = {}) {
    devmode.on = true;
    this.state.reset();
    this.state.data.started = true;
    this.state.data.devRun = true;
    this.skipIntro = !!opts.skipIntro;
    this._devClock = clock;
    this.menus.close();
    await this.startNight(night, true);
    this.ui.toast(`DEV · night ${night} · ${clockString(this.state.data.clock)}`);
  }

  /** Move the clock from the dev tools while a shift is running. */
  devSetClock(minutes) {
    this.state.data.clock = minutes;
    this.ui.setClock(minutes);
  }

  // ——— the night ————————————————————————————————————————————————
  async startNight(n, fresh, resume = null) {
    // A previous shift's script may still be sitting on an await; stop it
    // before another one starts, or two nights drive the world at once.
    this.script?.abort?.();
    this.script = null;
    if(resume?.night != null && resume.night !== n)resume=null;
    this.tasks.clear();this.tasks.resumeDone=null;
    this.interact._markKey=null;this.interact._clearMarkers();
    this.phone?.reset();
    this.gen++;
    this.mode = "cutscene";
    this.ui.showHUD(false);
    await this.ui.fade(1, 0.35);
    this.state.data.night = n;
    this.state.data.clock = resume ? (resume.clock ?? SHIFT_START) : SHIFT_START;
    // A dev shift picks its own hour. Consumed here so the next ordinary night
    // starts at six in the evening like everybody else's.
    if (this._devClock != null) { this.state.data.clock = this._devClock; this._devClock = null; }
    this.setDread(0);
    this.resuming = !!resume;
    this._cluesAtStart = Object.keys(this.state.data.clues).length;
    // Whatever the last night, ending or cutscene left behind, a shift that is
    // starting owns the player again. Nothing here cleared `frozen`, so any
    // path that began a night while frozen — finishing the game and starting
    // over, resuming a save written during a cutscene, a cutscene that threw —
    // dropped the player into a shift they could look at and not walk through.
    // One line, and it removes the entire class of "I can't move".
    this.player.frozen = false;
    this.player.lookTarget = null;
    // He owns a flashlight. Gating F on finding a hotspot under the counter
    // meant the key did nothing for most of the first night and players
    // reported the flashlight as broken — which, from where they were
    // standing, it was.
    await this.torch.take({ quiet: true });

    // Drop last night's story interactions.
    //
    // The systems register their spots once and keep them for the whole game,
    // which is right. The *night scripts* register theirs at a beat — the
    // ditch, the fourth aisle, the Nova — and nothing ever took them away, so
    // they accumulated: finish the game, start a new one, and Night 1 still
    // had the covered car and the marks in the grout waiting to be found,
    // four nights before either exists.
    for (const id of NIGHT_SCOPED) this.interact.remove(id);
    this.tasks.resumeDone = resume ? (resume.done || []) : null;

    // reset per-night world state
    this.doppelganger?.reset();
    this.customers.clearAll();
    this.delivery?.reset();
    this.shotgun?.reset();
    this.vehicles.clearAll();
    this.attendant.hide();
    this.power.resetForNight(n);
    this.weather?.resetForNight(n);
    this.register.resetForNight(n);
    this.cameras.resetForNight(n);
    this.chores.resetForNight(n);
    this.torch.reset();
    this.watch.resetForNight();
    this.salt.resetForNight();
    this.unscheduled.resetForNight(n);
    this.choices.cancel();
    this.state.flag("closing", false);
    this.state.flag("walkout", false);   // only Night 4 leaves the doors open
    this.station.setDoor("entry", false);
    this.station.setDoor("rear", false);
    this.station.setDoor("office", false);
    this.station.setDoor("stock", false);
    this.station.setDoor("bath", false);
    // Story visuals are night-scoped unless a night deliberately restores
    // them. Night 1's blood under the floor mess was still there on Night 4,
    // whose own dialogue has him check the restroom and find it "clean, dry,
    // fine" — the game contradicting itself in the same room, two nights
    // apart. Each night re-asserts what it wants to be visible.
    this.station.showBathBlood?.(false);
    this.station._jacobBlood?.removeFromParent();this.station._jacobBlood=null;
    this.station.showForecourtBlood?.(false);
    this.station.showAisleBlood?.(false);
    this.station.showCrashScene?.(false);
    this.station.showFourthAisle?.(false);
    this.station.showFiveOnCounter?.(false);
    this.station.showAisleCrowd?.(false);
    this.station.showNova?.(false);
    this.station.showTally?.(false);
    if (resume && Number.isFinite(resume.x)) {
      this.player.teleport(new THREE.Vector3(resume.x, 0, resume.z), resume.yaw ?? Math.PI);
    } else {
      this.player.teleport(this.station.anchors.spawn_outside, Math.PI);
    }
    if (resume && resume.torch) this.torch.take();

    this.state.save();

    const script = NIGHTS[n];
    this.script = script ? script(this) : null;
    this.mode = "play";
    this.ui.showHUD(true);
    await this.ui.fade(0, 0.8);
    requestLock(this.canvas);
    this.audio.setState("normal", 2.0);
    // the station's own noise is the score from here on
    this.music.stop(2.5);
    if (n === 6) this.music.play("climax");
    // The shift script runs for the whole night — it is started, never awaited.
    this.script?.start?.();
    if (resume) {
      this.ui.toast("Back on shift.");
      // re-assert the resume pose once the night has finished setting itself up
      const want = resume;
      const g0 = this.gen;
      this.timers.after(0.6, () => {
        if (this.gen !== g0 || this.mode !== "play") return;
        if (!Number.isFinite(want.x)) return;
        this.player.teleport(new THREE.Vector3(want.x, 0, want.z), want.yaw ?? Math.PI);
      });
    }
    // keep the resume point fresh as the night goes on
    this._autoSave?.();
    this._autoSave = this.timers.every(20, () => {
      if (this.mode === "play") { this.snapshot(); this.state.save(); }
    });
  }

  async endNight(nextNight) {
    // Grab the clock before the reset below wipes it — the shift report wants
    // the time he actually clocked out, and Night 4's "02:24" is the whole
    // point of that line.
    this._clockedOutAt = this.state.data.clock;
    this.mode = "cutscene";
    this.player.frozen = true;
    await this.ui.fade(1, 1.2);
    this.ui.showHUD(false);
    this.ui.clearSubs();
    // A demo stops at its last night rather than at the ending, so the save it
    // leaves behind has to point at a night the build can actually start —
    // otherwise Continue offers a shift that is not in this copy of the game.
    const past = nextNight > BUILD.lastNight;
    this.state.data.night = past && BUILD.demo ? BUILD.lastNight : nextNight;
    this.state.data.clock = SHIFT_START;
    this.state.data.resume = null;      // a new night starts at the door
    this.state.save();
    this.player.frozen = false;
    if (past) {
      // The demo still gets the shift report for the night just worked. It is
      // the last thing it says about the player's own shift, and cutting it to
      // put a card up sooner would end the demo on an advertisement.
      if (BUILD.demo) { await this.shiftReport(nextNight - 1); return this.demoEnd(); }
      return this.runEnding();
    }
    await this.shiftReport(nextNight - 1);
    this.music.play("title");
    await this.ui.titleCard(`NIGHT ${NIGHT_WORD[nextNight]}`, NIGHT_DATES[nextNight] || "");
    await this.startNight(nextNight, true);
  }

  /**
   * The end of the demo.
   *
   * Deliberately not a wall of marketing. The player has just worked two
   * nights and been told what they walked past; the card says the demo is
   * over, names the thing the next night opens with, and stops. Anything
   * longer reads as a storefront bolted to the end of a horror game.
   */
  async demoEnd() {
    this.mode = "ending";
    this.music.play("title");
    const el = document.createElement("div");
    el.className = "demoEnd";
    el.innerHTML =
      `<div class="deBrand">MERIDIAN FUEL &amp; PROVISIONS · STATION 41</div>` +
      `<div class="deTitle">END OF THE DEMO</div>` +
      `<p class="deBody">Two of six nights. The station closes for good on the
        thirty-first, and there are four more shifts between here and then.</p>` +
      `<p class="deBody de2">Night three starts with the sign out and the camera
        circuit dead.</p>` +
      `<div class="deGo">press any key</div>`;
    const host = document.getElementById("app") || document.body;
    host.appendChild(el);
    await this.ui.fade(0, 1.2);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => el.classList.add("in"), 60);

    await new Promise((res) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        removeEventListener("pointerdown", go, true);
        removeEventListener("keydown", go, true);
        res();
      };
      // It cannot be dismissed instantly — the fade in alone takes a second,
      // and a keypress still held from the last interaction would eat it.
      setTimeout(() => {
        el.classList.add("ready");
        addEventListener("pointerdown", go, true);
        addEventListener("keydown", go, true);
      }, 2600);
    });
    el.classList.remove("in");
    setTimeout(() => el.remove(), 900);
    this.quitToMenu();
  }

  /**
   * The shift report.
   *
   * The gap between nights used to be a title card held for two and a half
   * seconds, which is the deadest moment in the game and the one place a
   * player decides whether to start another shift. So it is now the place the
   * game tells them **what they walked past**.
   *
   * The number of things he wrote down, against the number that were there.
   * Not a score and not a rank — you cannot fail it and nothing is withheld
   * for missing them. It exists because "there were two more" is the single
   * most effective sentence for getting somebody to work the next night
   * properly, and because it turns the notebook from a log into a collection
   * with a visible hole in it.
   *
   * PAR is the count of distinct `state.clue()` calls each night can make,
   * measured from the scripts, less the ones that are mutually exclusive —
   * Night 3's 01:58 branch and Night 5's corded-less phone can each only give
   * you one of two.
   */
  async shiftReport(night) {
    const PAR = { 1: 5, 2: 7, 3: 10, 4: 6, 5: 14, 6: 6 };
    const TAIL = {
      1: "Two things tonight were not the job.",
      2: "He is somewhere in the building. You have heard him now.",
      3: "One bag. It was never going to be enough.",
      4: "You slept for two hours. She went in at twenty past twelve.",
      5: "Five folders with no name on the tab. And yours.",
    };
    const found = Math.max(0, Object.keys(this.state.data.clues).length - (this._cluesAtStart || 0));
    const par = PAR[night] || 0;
    const missed = Math.max(0, par - found);
    const clock = clockString(this._clockedOutAt ?? this.state.data.clock);

    const miss = missed === 0
      ? "You didn't walk past anything. That is rarer than it sounds."
      : missed === 1
        ? "There was one more thing to notice."
        : `There were ${missed} more things to notice.`;

    // The register's own verdict, and it is separate from the noticing count on
    // purpose: one is what the building did, the other is what you did. A
    // clean shift says so, because "the drawer counts" is only worth reading
    // when it can also say the opposite.
    const d = this.state.data;
    const dept = d.deptErrors || 0;
    const shortC = d.changeErrCents || 0;
    const till = dept === 0 && shortC === 0
      ? "The drawer counts. Every key was the right key."
      : [
        shortC < 0 ? `The drawer is short ${money(-shortC)}.` : "",
        dept > 0 ? `${dept} ${dept === 1 ? "item" : "items"} under the wrong key.` : "",
      ].filter(Boolean).join(" ");

    const el = document.createElement("div");
    el.className = "shiftReport";
    el.innerHTML =
      `<div class="srNight">NIGHT ${NIGHT_WORD[night] || night}</div>` +
      `<div class="srClock">clocked out · ${clock}</div>` +
      `<div class="srCount"><b>${found}</b> <span>of ${par} written down</span></div>` +
      `<div class="srMiss">${miss}</div>` +
      `<div class="srTill">${till}</div>` +
      `<div class="srTail">${TAIL[night] || ""}</div>`;
    const host = document.getElementById("app") || document.body;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => el.classList.add("in"), 60);
    await new Promise((r) => setTimeout(r, 5200));
    el.classList.remove("in");
    await new Promise((r) => setTimeout(r, 700));
    el.remove();
  }

  async runEnding(forced) {
    this.mode = "ending";
    const id = forced || ENDINGS.decide(this.state);
    this.state.data.endingSeen = id;
    this.state.data.finished = true;
    this.state.save();
    await ENDINGS.play(this, id);
    this.quitToMenu();
  }

  setDread(d) {
    const was = this.dread;
    this.dread = clamp(d, 0, 5);
    this.state.data.dread = this.dread;
    this.audio.setDread(this.dread);
    // Music follows the night rather than announcing events: nothing under 3,
    // a low unease bed at 3, and the dread bed from 4. It never tells the
    // player they are safe, because it never stops once it starts.
    if (this.mode === "play" && this.dread !== was) {
      if (this.dread >= 4) this.music.play("dread");
      else if (this.dread >= 3) this.music.play("unease");
      else this.music.play("shift");     // the ordinary hours are not silent
    }
  }

  // ——— world interactions available every night ———————————————————
  _baseInteractions() {
    // Which salt threshold shares a doorway with which door leaf.
    const SALT_AT_DOOR = { office: "office", stock: "stock", bath: "bath", rear: "rear", entry: "front" };
    const S = this.station, A = S.anchors, I = this.interact;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    I.add({
      // The front door had THREE hotspots stacked on it — this one, plus
      // "Open the station" and "Lock up" from the chore list — so the prompt
      // flickered between "Open the front door" and "Open the station the
      // front door" depending on which won the look test. The plain door
      // stands down whenever the shift has an opinion about that door.
      //
      // It stood down too far, and it locked the player out of their own
      // workplace: this was disabled for the WHOLE of `open`, `lockfront` is
      // disabled in the same window, and "Open the station" refuses before
      // 20:40 with "Not yet. Doors at nine." So from the top of the shift to
      // 20:40 on Nights
      // 1, 4 and 5 all three hotspots on the front door were dead, the leaf
      // was shut with its collider in place, and the three hours of prep — punch
      // in, read the note, mop, restock — were all on the other side of it.
      //
      // The automated playthrough never saw it because it fires interactions by
      // id and teleports between them; it never walks through a doorway. Same
      // lesson as the five scene functions that were called and never written.
      //
      // It now stands down only from 20:40, which is the moment "Open the
      // station" becomes a real action rather than a refusal. Before that it is
      // a door, and he has the keys to it.
      id: "door_entry", pos: () => this.doorPoint("entry"), targets: () => this.doorTargets("entry"), radius: 2.6,
      // Stands down for the WHOLE of `open` again — but this time that is safe,
      // because "Open the station" is a door before nine instead of a refusal.
      // Splitting the window at 20:40 only meant two hotspots fighting over one
      // doorway, and the wider one won and said no.
      enabled: () => !(this.tasks.has("open") && !this.tasks.isDone("open"))
        && !this.state.flag("closing") && !S.doors.get("entry").locked && !this.salt?.pending?.("front"),
      label: "the front door",
      onUse: () => this.toggleDoor("entry"),
      get verb() { return S.doors.get("entry").open ? "Close" : "Open"; },
    });
    // Every door hotspot sits on its own LEAF, derived from the door the
    // station actually built.
    //
    // These were three hand-typed positions, and swapping the office and the
    // stock room moved the leaves without moving them: `door_office` stayed at
    // x -7, which is the stock room's doorway, so it offered "Open the office
    // door" at the wrong end of the building and toggled a door eight metres
    // away — while the real office door, at x +1, had no hotspot at all and
    // could never be opened. The office was unreachable for the whole game.
    //
    // A hand-typed number cannot follow a wall that moves. A door's own
    // definition can.
    for (const [name, label] of [["office", "the office door"],
                                 ["stock", "the stockroom door"],
                                 ["bath", "the bathroom door"],
                                 ["rear", "the back door"]]) {
      const d = S.doors.get(name);
      if (!d) continue;                     // an opening with no leaf needs no prompt
      I.add({
        id: "door_" + name, radius: 2.6, label, targets: () => this.doorTargets(name),
        pos: () => this.doorPoint(name),
        // Stands down while this threshold is still waiting for salt. The salt
        // point sits in the doorway, as it should, and the door's hotspot is
        // wider — so the door won the crosshair every time and the line could
        // never be laid. While the salt is the job, the doorway is the salt's.
        enabled: () => !this.salt?.pending?.(SALT_AT_DOOR[name]),
        get verb() { return S.doors.get(name).open ? "Close" : "Open"; },
        onUse: () => this.toggleDoor(name),
      });
    }
  }

  doorTargets(name) {
    const d = this.station.doors.get(name);
    return [d?.def.mesh, d?.def.secondary?.mesh].filter(Boolean);
  }

  doorPoint(name) {
    const d = this.station.doors.get(name);
    const leaves = [d.def.mesh, d.def.secondary?.mesh].filter(Boolean);
    const points = leaves.map(leaf => { leaf.updateWorldMatrix(true, false); return leaf.localToWorld(new THREE.Vector3(0, 1.2, 0)); });
    return points.sort((a,b) => a.distanceToSquared(this.player.pos) - b.distanceToSquared(this.player.pos))[0];
  }

  toggleDoor(name) {
    const d = this.station.doors.get(name);
    if (!d) return;
    if (d.locked && !d.open) {
      this.audio.play("int_lock", { vol: 0.5 });
      this.ui.toast(d.lockMsg || "Locked.");
      return;
    }
    this.station.setDoor(name, !d.open);
    this.audio.play(d.open ? "int_door_open" : "int_door_close", { vol: 0.5, pos: this.player.pos.clone() });
    if (name === "entry" && d.open) this.audio.play("int_doorchime", { vol: 0.55 });
    this.bus.emit("door", name, d.open);
  }

  // ——— cutscene helper ——————————————————————————————————————————
  /**
   * Runs `fn` with the player locked out of movement. Cutscenes are always
   * in-engine and first-person; `skippable` ones can be ESC'd after the first
   * viewing, and always leave the world in the same state.
   */
  async cutscene(id, fn, { skippable = true } = {}) {
    const seen = this.state.data.cutscenesSeen[id];
    const gen = this.gen;              // a cutscene belongs to the night that started it
    this.mode = "cutscene";
    this.player.frozen = true;
    this.interact.enabled = false;
    let skipped = false;
    const off = inputBus.on("press", (code) => {
      if (code === "Escape" && seen && skippable) skipped = true;
    });
    const api = {
      skipped: () => skipped,
      // deliberately not rAF-based: a backgrounded tab must not wedge a
      // cutscene half-played with the player frozen
      // Deliberately not rAF-based: a backgrounded tab must not wedge a
      // cutscene half-played with the player frozen.
      //
      // `__ncClock` is a test seam and nothing else. In a real session it is
      // undefined and this is `performance.now()`, unchanged. The playtest
      // harness installs a virtual clock through it, because otherwise a night
      // with three minutes of cutscene takes three minutes to test, which in
      // practice meant nights 4 to 6 were never tested end to end at all.
      wait: (s) => new Promise((r) => {
        if (window.__csTrace) window.__csTrace.push(id + " wait " + s);
        const now = () => (window.__ncClock ? window.__ncClock() : performance.now());
        const t0 = now();
        const tick = () => {
          // a stale cutscene stops waiting the instant its night is gone
          if (skipped || gen !== this.gen || now() - t0 > s * 1000) r();
          else setTimeout(tick, 33);
        };
        tick();
      }),
      dead: () => gen !== this.gen,
      look: (p, speed = 1.4) => this.player.lookAtPoint(p, speed),
      say: (t, o) => this.ui.say(t, o),
      fade: (v, s) => this.ui.fade(v, s),
    };
    try { await fn(api); } catch (e) { console.error("[cutscene]", id, e); }
    off();
    if (gen !== this.gen) return;      // the night it belonged to is over
    this.state.data.cutscenesSeen[id] = true;
    this.ui.clearSubs();
    this.player.frozen = false;
    this.player.lookTarget = null;
    // He owns a flashlight. Gating F on finding a hotspot under the counter
    // meant the key did nothing for most of the first night and players
    // reported the flashlight as broken — which, from where they were
    // standing, it was.
    await this.torch.take({ quiet: true });
    if (gen !== this.gen) return;
    this.interact.enabled = true;
    this.mode = "play";
    requestLock(this.canvas);
  }

  // ——— per-frame ————————————————————————————————————————————————
  update(dt) {
    if (this.mode === "menu") {
      this.updateMenuCamera(dt);
      this.station.update(dt);
      this.audio.update(dt, this.menuCam, null);
      return;
    }
    if (this.paused || this.menus.open) {
      // keep the world alive behind a pause overlay
      this.station.update(dt);
      this.audio.update(dt, this.camera, this.player);
      return;
    }
    this.timers.update(dt);

    if (this.mode === "play" || this.mode === "cutscene") {
      if (!this.ui.focused) this.player.update(dt);
      this.interact.update(dt);
      this.interact.markers(this.tasks.list, this);
      this.station.update(dt);
      this.power.update(dt);
      this.weather.update(dt);
      this.register.update(dt);
      this.cameras.update(dt);
      this.customers.update(dt);
      this.vehicles.update(dt);
      this.watch.update();
      this.attendant.update(dt);
      this.chores.update(dt);
      this.torch.update(dt);
      this.worldUse.update(dt);
      this.delivery.update(dt);
      this.doppelganger.update(dt);
      this.shotgun.update(dt);
      this.phone.update(dt);
      this.script?.update?.(dt);

      if (this.mode === "play" && !this.ui.focused && !this.choices.open) {
        this.state.data.clock += dt * this.clockRate;
        this.ui.setClock(this.state.data.clock);
      }
    }
    this.audio.update(dt, this.camera, this.player);
  }

  /**
   * Time control used by scripts: jump the clock forward to a beat.
   *
   * The shift runs 20:20 to 06:00 and the clock is encoded as minutes from
   * midnight *of the first day* — so six in the morning is 30:00, not 06:00.
   * Every script beat after midnight was written the way a person says it
   * ("setClock(3, 40)"), which set the clock to 03:40 of the wrong day and
   * threw it eighteen hours backwards.
   *
   * Mostly that was invisible, because nothing read the clock. But anything
   * gated on a time then broke permanently: after a jump to "03:40" the front
   * door believed it was the afternoon and refused to open, forever, with
   * "Not yet. Doors at nine." A player slow enough to still be prepping when
   * the script moved on could not open the station at all for the rest of the
   * night. Small hours are always this shift's small hours.
   */
  setClock(hours, mins = 0) {
    const h = hours < 12 ? hours + 24 : hours;
    this.state.data.clock = h * 60 + mins;
    this.ui.setClock(this.state.data.clock);
  }
  get minutes() { return this.state.data.clock; }

  /**
   * When a monitor surface is open, the main render becomes that feed.
   * Returns null for normal play, {cam} for a live feed, {cam:null} for a
   * dead one (which still renders, as CRT-treated black).
   */
  feedView() {
    if (this.cameras.open) {
      if (this.cameras.quad) {
        const ids = this.cameras.quadFeeds();
        return {
          quad: ids.map((id) => (this.cameras.dead.has(id) || !this.cameras.powered
            ? null : this.cameras.camFor(id))),
        };
      }
      return { cam: this.cameras.activeCamera() };
    }
    if (this.docs.playing) return { cam: this.cameras.camFor(this.cameras.selected) };
    return null;
  }

  postOpts() {
    const d = this.dread;
    return {
      grain: 1 + d * 0.06,
      vignette: 1 + d * 0.07,
      aberration: 1 + d * 0.12,
      ...this.postFX,
    };
  }
}

/**
 * The shift, in minutes from midnight.
 *
 * 20:20 arrive and prep · 21:00 open the station · 06:00 close.
 * The clock rolls past midnight, so CLOSE is expressed on the following day.
 *
 * He used to arrive at six. Three in-game hours before the doors could open,
 * at 0.55 minutes a second, is five and a half REAL minutes of solo chores in
 * an empty building before the game's actual loop — somebody walking in — was
 * allowed to start. Nobody spoke to him, nothing could go wrong, and the
 * player's first experience of the game was killing time.
 *
 * Forty minutes. The prep list takes longer than that to actually do, so you
 * open a few minutes late, which is the exact thing the owner rings up about.
 * The wait became a race and not one line of content changed.
 */
export const SHIFT_START = 20 * 60 + 20;  // 20:20 — prep begins
export const SHIFT_OPEN = 21 * 60;       // 21:00 — the station opens
export const SHIFT_LATE = 21 * 60 + 15;  // 21:15 — "or the boss makes it my problem"
export const SHIFT_CLOSE = 30 * 60;      // 06:00 next day

export const NIGHT_DATES = {
  1: "23 OCTOBER 1997",
  2: "24 OCTOBER 1997",
  3: "27 OCTOBER 1997",
  4: "29 OCTOBER 1997",
  5: "30 OCTOBER 1997",
  6: "31 OCTOBER 1997",
};
