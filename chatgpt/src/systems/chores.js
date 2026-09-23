// THE NIGHT COUNT — the work: clocking in, the urn, pump readings, restocking,
// mopping, the trash run, the bathroom, and locking up.
//
// Chores are deliberately multi-step and physical. Restocking is: fetch a box
// from the back, carry it (it blocks half your view), find the gap, fill it.
// That is what makes the shelf being *already filled* on Night 4 land.
import * as THREE from "three";
import { model, fitHeight } from "../core/assets.js";
import { L, PUMPS } from "../world/station.js";
import { el } from "../core/ui.js";
import { clockString } from "../core/util.js";
import { settings } from "../core/settings.js";

export class ChoreSystem {
  constructor(game) {
    this.g = game;
    this.held = null;             // {kind, object}
    this.readings = {};
    this.logged = false;
    this.spill = null;
    this.restockLeft = 0;
    this.trashOut = false;
    this.bathroomChecked = false;
    this.urnOn = false;
    this._holdT = 0;
    this._register();
  }

  resetForNight(n) {
    this.readings = {}; this.logged = false;
    this.restockLeft = 0; this.trashOut = false;
    this.bathroomChecked = false; this.urnOn = false;
    this.lockedUp = false;
    this._toldEarly = false;        // "doors at nine" is said once a night
    this._filled = {};              // last night's filled gaps are last night's
    // The mop queue was not being cleared, so a second playthrough started
    // Night 1 holding the *previous* run's leftover messes: the counter read a
    // total that no longer matched the spills in the world, `clean` could
    // never complete, and the night stalled. Only reachable by finishing and
    // starting again — which is the first thing anyone does.
    this.cleanQueue = null;
    this.cleanTotal = 0;
    this.cleanLeft = 0;
    this.cleanDone = 0;
    this.coolerOpen = false;
    this.clearSpill();
    this.g.inventory.clearChores();
  }

  // ——— held items ————————————————————————————————————————————————
  async take(kind, modelKey, h = 0.35) {
    return this.g.inventory.takeTool(kind, modelKey, h);
  }

  drop() {
    if (this.held) this.g.inventory.remove(this.held.kind);
  }

  holding(kind) { return this.held?.kind === kind; }

  // ——— registration ————————————————————————————————————————————
  _register() {
    const g = this.g, I = g.interact, A = g.station.anchors;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // punch clock by the office door
    I.add({
      id: "punch", pos: V(1.72, 1.35, 7.78), radius: 2.4,
      targets: () => [g.station.usableProps.timeclock],
      label: "the staff time clock", verb: () => g.tasks.isDone("clock_in") ? "Clock out" : "Clock in",
      onUse: () => {
        g.state.data.handled.punchcard++;
        g.audio.play("int_punchcard", { vol: 0.7 });
        const inShift = !g.tasks.isDone("clock_in");
        if (inShift) {
          g.tasks.done("clock_in");
          g.state.note(`Clocked in, ${clockString(g.minutes)}.`, g.minutes);
          g.ui.toast("Punched in.");
        } else if (!g.state.flag("closing")) {
          // you cannot punch out of a shift you have not worked
          g.ui.toast(`It's ${clockString(g.minutes)}. The shift runs to six.`);
        } else if (!this.lockedUp && g.tasks.has("lockup") && !g.state.flag("walkout")) {
          // Closing up is one job now — the doors, then the card — so the card
          // will not take a punch while the station is still standing open.
          //
          // Except on the one night it must: Night 4 ends with him punching out
          // at 02:24 with the shop open behind him, and that beat is the whole
          // ending of the night. `walkout` is that night saying so.
          g.ui.toast("Doors first.");
        } else {
          g.tasks.done("lockup");
          g.ui.toast("Punched out.");
        }
        g.bus.emit("punch");
      },
    });

    // coffee urn — the switch has to be held
    I.add({
      id: "urn", pos: V(A.coffee.x, 1.15, A.coffee.z), radius: 1.7,
      label: "the coffee urn", verb: "Hold the switch",
      onUse: () => {
        this.urnOn = true;
        g.audio.play("int_coffee", { vol: 0.6 });
        g.tasks.done("coffee");
        g.ui.toast("It catches on the fourth try.");
      },
    });

    // pumps: read each meter
    for (const p of PUMPS) {
      I.add({
        id: "pump" + p.id, pos: p.pos.clone().setY(1.2), radius: 2.0,
        label: "pump " + p.id, verb: "Read the meter",
        enabled: () => g.tasks.has("readings") && !g.tasks.isDone("readings"),
        onUse: () => this.readPump(p.id),
      });
    }

    // the log book on the counter
    I.add({
      id: "logbook", pos: V(-7.0, L.CNT_H + 0.12, 3.3), radius: 1.6,
      label: "the pump log", verb: "Write up",
      // Gated on the TASK, not on a private `logged` flag.
      //
      // With the flag, a shift in timing could leave `logged` true while the
      // night set a fresh task list with `readings` open again — and the log
      // book was then disabled forever, so the task could never be completed
      // and the night never ended. It deadlocked Night 2 exactly this way.
      // The book is writable whenever the job is on the list and the meters
      // have been read, which is also what a person would expect.
      enabled: () => Object.keys(this.readings).length >= 4
        && this.g.tasks.has("readings") && !this.g.tasks.isDone("readings"),
      onUse: () => this.writeLog(),
    });

    // restock: box in the stock room
    I.add({
      id: "restockbox", pos: V(-8.10, 0.5, 10.45), radius: 1.9,
      label: "a case of stock", verb: "Pick up",
      enabled: () => g.tasks.has("restock") && !g.tasks.isDone("restock") && !this.holding("box"),
      onUse: async () => {
        if (!await this.take("box", "cardbox", 0.42)) return;
        if (!this.restockLeft) this.restockLeft = 3;
        this._sayGaps();
      },
    });
    for (let i = 0; i < 3; i++) {
      const gx = [-1.0, 2.2, 5.4][i];
      I.add({
        id: "shelfgap" + i, pos: V(gx, 1.15, 5.2), radius: 2.0,
        label: "the gap on the shelf", verb: "Fill",
        enabled: () => this.holding("box") && !g.tasks.isDone("restock") && !this._filled?.[i],
        onUse: () => this.fillShelf(i),
      });
    }

    // cleaning
    I.add({
      id: "bucket", pos: V(3.9, 0.35, 8.7), radius: 1.8,
      label: "the mop and bucket", verb: "Take",
      enabled: () => !this.holding("mop"),
      onUse: () => this.take("mop", "mop", 1.2),
    });
    I.add({
      id: "spill", pos: () => this.spill?.pos, radius: 2.6, priority: 1, aimCos: .85,
      targets: () => this.spill ? [this.spill.mesh] : [],
      label: "the spill", verb: () => this.holding("mop") ? "Mop" : "Inspect",
      enabled: () => !!this.spill,
      onUse: () => this.holding("mop") ? this.mopSpill() : g.ui.toast(this.mopInstructions()),
    });

    // trash
    //
    // Two night scripts name this job differently — Night 1 lists it as
    // `bins` ("Empty the bins before close"), the later nights as `trash` —
    // and the interactions were gated on `trash` alone. So on Night 1 the bin
    // bag could not be picked up at all: a task sat on the list, all night,
    // that the player had no way to complete. It went unnoticed because it is
    // flagged `optional`, so the night still ended and nothing ever
    // complained. The gate answers to whichever id the night is using.
    const TRASH_TASK = () => (g.tasks.has("trash") ? "trash" : "bins");
    this.trashTask = TRASH_TASK;
    I.add({
      id: "trashbag", pos: V(8.45, 0.65, 3.0), radius: 1.8,
      label: "the bin bag", verb: "Lift out",
      enabled: () => {
        const id = TRASH_TASK();
        return g.tasks.has(id) && !g.tasks.isDone(id) && !this.holding("trash");
      },
      onUse: () => this.take("trash", "trashbag", 0.5),
    });
    I.add({
      id: "dumpster", pos: A.dumpster.clone().setY(1.2), radius: 2.6,
      label: "the dumpster", verb: "Throw it in",
      enabled: () => this.holding("trash"),
      onUse: () => {
        this.drop();
        g.audio.play("int_dumpster", { vol: 0.75, pos: A.dumpster.clone() });
        g.tasks.done(TRASH_TASK());
        g.bus.emit("chore:trash");
      },
    });

    // The walk-in. Not a task — it is a door in a shop, and a player who has
    // been told a line of salt across "the walk-in" matters should be able to
    // open the thing and look at it. It is also the last sound in the library
    // that nothing played.
    I.add({
      id: "cooler", pos: V(3.0, 1.2, 6.2), radius: 2.0,
      label: "the walk-in", verb: "Open",
      // The walk-in's own threshold sits under this prompt, and this one is
      // wider, so the line could never be laid across it.
      enabled: () => !g.salt?.pending?.("cooler"),
      onUse: () => {
        this.coolerOpen = !this.coolerOpen;
        g.audio.play("int_fridge_door", { vol: 0.55, pos: V(3.0, 1.2, 7.2) });
        g.station.setDoor?.("cooler", this.coolerOpen);
        if (this.coolerOpen) {
          g.ui.toast(g.power.isOn("cooler") ? "Cold air. The light's on in there."
                                            : "Not cold. Not any more.");
        }
      },
    });

    // bathroom
    I.add({
      // Moved back against the far wall and down to fixture height. It used to
      // hang at chest height in the middle of the room, so on nights with no
      // mess on the floor there was nothing within reach of it: the prompt
      // said "the restroom — Check" and the player was looking at empty air.
      // Found by `__auditInvisible()`, which exists because of it.
      id: "bathcheck", pos: V(7.0, 1.0, 11.0), radius: 2.4,
      label: "the restroom", verb: "Check",
      enabled: () => g.tasks.has("bathroom") && !g.tasks.isDone("bathroom"),
      onUse: () => {
        this.bathroomChecked = true;
        g.tasks.done("bathroom");
        // checking the restroom is two actions, so it is two sounds
        g.audio.play("int_toilet", { vol: 0.35 });
        g.audio.play("int_sink", { vol: 0.4, delay: 1.6 });
        g.state.note("Restroom checked. Clean, except the mirror.", g.minutes);
        g.bus.emit("chore:bathroom");
      },
    });

    // lock up / sign
    // Locking up is a task, but the lock itself is just a lock: you keep the
    // keys, and you can always open your own door again.
    //
    // Two prep errands used to live here and both have gone:
    //
    //   `crates` — "Grab the broom and the restock crates from the office" was
    //     a walk to a spot, a press, and a line of dialogue, and then the mop
    //     and the boxes were picked up from their own places anyway. It was a
    //     task whose entire content was a trip to fetch permission.
    //   `pumpcheck` — one press on a six-metre trigger covering the whole
    //     forecourt, which said all four pumps were fine. The meter readings
    //     are the same job done properly, one pump at a time.
    //
    // Both were on the list. Neither was work.
    // The ONE hotspot on the front door while opening up is a job.
    //
    // There were three stacked here — this, the plain door, and the lock — and
    // this one has the widest radius, so it won the crosshair every time and
    // then REFUSED: "Not yet. Doors at nine." The plain door was never offered
    // at all, so between clocking in and 20:40 the player stood at their own
    // front door pressing E and being told no. They could not get inside to do
    // any of the prep. The prompt also read "Open the station the front door",
    // because the verb already contained the noun the label then repeated.
    //
    // It is a door before nine and a job at nine, and it says which. Nothing
    // here refuses: too early to open the station is still not too early to
    // walk through a door you have the keys to.
    I.add({
      id: "openstation", pos: () => g.doorPoint("entry"), targets: () => g.doorTargets("entry"), radius: 2.6,
      label: () => (g.minutes < 21 * 60 - 20 ? "the front door" : "the station"),
      verb: () => {
        if (g.minutes >= 21 * 60 - 20) return "Open";
        return g.station.doors.get("entry")?.open ? "Close" : "Open";
      },
      // ...and the threshold is the salt's while the salt is the job.
      enabled: () => g.tasks.has("open") && !g.tasks.isDone("open")
        && !g.salt?.pending?.("front"),
      onUse: () => {
        const early = g.minutes < 21 * 60 - 20;
        if (early) {
          // just a door
          const d = g.station.doors.get("entry");
          g.station.setDoor("entry", !d.open);
          g.audio.play("int_door_open", { vol: 0.5 });
          if (!this._toldEarly) {
            this._toldEarly = true;
            g.ui.toast("Doors at nine. Prep first.");
          }
          return;
        }
        const d = g.station.doors.get("entry");
        if (d) d.locked = false;
        g.station.setDoor("entry", true);
        // Keep the entry open while the player walks through it.
        // Opening up is the keys coming out; locking up is the lock itself.
        // They were the same sound, which made the two most load-bearing
        // moments of the shift indistinguishable with your eyes shut.
        g.audio.play("int_keys", { vol: 0.7 });
        g.tasks.done("open");
        g.state.flag("station_open", true);
        g.ui.toast("Open.");
        g.bus.emit("chore:open");
      },
    });

    I.add({
      // Stands down while "Open the station" is still on the list, so the
      // doorway offers ONE prompt at a time instead of three.
      id: "lockfront", pos: () => g.doorPoint("entry"), targets: () => g.doorTargets("entry"), radius: 2.6,
      // Only stands down while you are literally being asked to open up, and
      // only before nine — locking your own front door is otherwise always
      // allowed, and a player who could not lock anything at the start was
      // right to call that broken.
      // ...and never while the front threshold is still waiting for its line.
      enabled: () => (g.state.flag("closing") || g.station.doors.get("entry").locked)
        && !(g.tasks.has("open") && !g.tasks.isDone("open")) && !g.salt?.pending?.("front"),
      label: "the front door",
      get verb() {
        const d = g.station.doors.get("entry");
        return d && d.locked ? "Unlock" : "Lock up";
      },
      onUse: () => {
        if (g.state.flag("closing") && g.delivery?.active) {g.ui.toast("Finish the stock delivery before locking up — the truck is waiting.");return;}
        const d = g.station.doors.get("entry");
        g.state.data.handled.keys++;
        g.audio.play("int_lock", { vol: 0.7 });
        if (d.locked) {
          d.locked = false;
          g.ui.toast("Unlocked.");
          g.bus.emit("chore:unlock");
          return;
        }
        g.station.setDoor("entry", false);
        d.locked = true;
        d.lockMsg = "Locked. The keys are in your pocket.";
        // locking early is allowed — it just is not the end of the shift
        if (g.tasks.has("lockup") && g.state.flag("closing")) {
          // The doors are half the job. The card is the other half.
          this.lockedUp = true;
          g.ui.toast("Locked up. Clock out at the labelled machine beside the office door.");
        } else {
          g.ui.toast("Locked. Rule 1 says it stays open until six, though.");
        }
        g.bus.emit("chore:lockup");
      },
    });
    I.add({
      id: "signswitch", pos: V(-8.5, 1.4, 2.2), radius: 1.7,
      label: "the sign switch", verb: "Throw",
      enabled: () => g.tasks.has("sign") && !g.tasks.isDone("sign"),
      onUse: () => {
        g.state.flag("sign_off", true);
        g.power.apply();
        g.audio.play("int_lightswitch", { vol: 0.6 });
        g.audio.subtract("amb_neon", true, 2.0);
        g.tasks.done("sign");
        g.bus.emit("chore:sign");
      },
    });
  }

  // ——— chore implementations ————————————————————————————————————
  /**
   * Read one pump's meter.
   *
   * This absorbed the old "Check the pumps" task, which was a single button
   * press on a six-metre trigger that stood over the whole forecourt and said
   * "Nozzles seated, no leaks, all four live." One press, four pumps, nothing
   * to walk to. The readings were always the version of this job that made
   * you go to each pump in turn; now they are the only version, and the list
   * counts them so you can see which ones are left from across the apron.
   */
  readPump(id) {
    if (this.readings[id]) { this.g.ui.toast("Already got that one."); return; }
    const base = 884140;
    this.readings[id] = base + id * 3 + Math.floor(this.g.state.night * 4);
    this.g.audio.play("int_pump_click", { vol: 0.5, pos: PUMPS[id - 1].pos.clone() });
    const n = Object.keys(this.readings).length;
    this.g.ui.toast(`Pump ${id}: ${this.readings[id].toLocaleString()}`);
    this.g.tasks.setText?.("readings", n >= 4
      ? "Meter readings — 4/4 · into the log book"
      : `Meter readings — ${n}/4 pumps`);
    if (n === 4) this.g.ui.toast("All four. Now they go in the book.");
  }

  writeLog() {
    if (this.g.tasks.isDone("readings")) return;   // already written up tonight
    this.logged = true;
    this.g.audio.play("int_paper_handle", { vol: 0.5 });
    this.g.tasks.done("readings");
    this.g.bus.emit("chore:log");
  }

  fillShelf(i) {
    this._filled = this._filled || {};
    this._filled[i] = true;
    this.restockLeft--;
    // three gaps, three different things going onto the shelf
    this.g.audio.play(["int_can", "int_bag_chips", "int_bottle"][i % 3], { vol: 0.55 });
    // There are three gaps in the world and Night 1 asks for ten units, so the
    // task could never be completed — the counter stuck at seven and the very
    // first night of the game had a job on the list with no way to finish it.
    // A case holds three; when it is empty the shelves want filling again and
    // he goes back to the stock room for another one. That is the loop the
    // "0/10" was always describing.
    if (this.restockLeft > 0 && Object.keys(this._filled).length >= 3) {
      this._filled = {};
      this.drop();
      this.g.ui.toast(`That's the case. ${this.restockLeft} more — there's another in the back.`);
      this._sayGaps();
      return;
    }
    this.g.ui.toast(this.restockLeft > 0 ? `${this.restockLeft} more gap${this.restockLeft === 1 ? "" : "s"}.` : "That's the lot.");
    this._sayGaps();
    if (this.restockLeft <= 0) {
      this.drop();
      this.g.tasks.done("restock");
      this.g.bus.emit("chore:restock");
    }
  }

  /** Same idea as _sayWhere: the list says what to do next, not just a score. */
  _sayGaps() {
    const t = this.g.tasks;
    if (!t.has("restock") || t.isDone("restock")) return;
    if (this.restockLeft <= 0) return;
    t.setText?.("restock", this.holding("box")
      ? `Fill the shelf gaps — ${this.restockLeft} left · the aisle by the coolers`
      : `Fill the shelf gaps — ${this.restockLeft} left · fetch a case from the stock room`);
  }

  async makeSpill(x, z, where = "shop", place = "") {
    this.clearSpill();
    if (!this.cleanTotal || this.cleanDone >= this.cleanTotal) {
      this.cleanQueue=[];this.cleanTotal=1;this.cleanDone=0;this.cleanLeft=1;
    }
    const geo = new THREE.CircleGeometry(0.60, 32), vertices=geo.attributes.position;
    for(let i=1;i<vertices.count;i++){
      const angle=Math.atan2(vertices.getY(i),vertices.getX(i));
      const r=1+.09*Math.sin(angle*3)+.05*Math.sin(angle*7);
      vertices.setXY(i,vertices.getX(i)*r,vertices.getY(i)*r);
    }
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x694a28, transparent: true, opacity: 0.90, depthWrite: false,
    }));
    m.name='cleaning_spill';
    m.userData.interactionBounds=new THREE.Box3(new THREE.Vector3(-.67,-.67,-.04),new THREE.Vector3(.67,.67,.12));
    const marker=new THREE.Mesh(new THREE.RingGeometry(.68,.70,48),new THREE.MeshBasicMaterial({color:0xc4a264,transparent:true,opacity:.58,depthWrite:false}));
    marker.name='spill_task_ring';marker.position.z=.004;marker.userData.noOutline=true;marker.visible=settings.taskMarkers;m.add(marker);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.025, z);
    this.g.scene.add(m);
    // Three strokes, not one press. Mopping is the single most repeated action
    // on the first night and it was over the instant you looked at it — the
    // mess vanished, a counter ticked, and nothing about it felt like work.
    this.spill = { mesh: m, marker, pos: new THREE.Vector3(x, 0.04, z), where, place: place || (where === "bath" ? "inside the restroom" : "on the shop floor"), strokes: 0 };
    this.g.audio.play("hor_bottle_fall", { vol: 0.5, pos: new THREE.Vector3(x, 0.2, z) });
    this._sayWhere();
    return this.spill;
  }

  /**
   * Put the place in the task.
   *
   * "Clean the shop — 0/3" tells you a number and nothing else; you then walk
   * the building looking for a dark circle on the floor. The list names where
   * the next one is, so the job reads as an instruction you can act on rather
   * than a score you have to go and earn.
   */
  _sayWhere() {
    const t = this.g.tasks;
    if (!t.has("clean") || t.isDone("clean")) return;
    const done = this.cleanDone || 0, total = this.cleanTotal || 0;
    const where = this.spill?.place;
    t.setText?.("clean", where
      ? `Mop the spills — ${done}/${total} · ${where}`
      : `Mop the spills — ${done}/${total}`);
  }

  clearSpill() {
    if (this.spill) {
      this.g.scene.remove(this.spill.mesh);
      this.spill.mesh.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
    }
    this.spill = null;
  }

  /**
   * Mop what is in front of you.
   *
   * The shop is not one mess — the prep list says "Clean the shop — 0/5". Each
   * one mopped spawns the next from the queue, and only the last one closes the
   * task. `where` names the room, so a night script can hang a beat on a
   * specific one (Night 1 puts the blood under the restroom mess).
   */
  mopSpill() {
    this.g.inventory.stroke();
    const sp = this.spill;
    if (!sp) return;
    // Each pass takes a bite out of it, so the floor visibly gets cleaner and
    // the third stroke is the one that finishes it.
    sp.strokes = (sp.strokes || 0) + 1;
    const stroke = sp.strokes % 2 === 0 && this.g.audio.has("nc_mop_pull")
      ? "nc_mop_pull" : "int_mop";
    this.g.audio.play(stroke, { vol: 0.5 + sp.strokes * 0.06,
      rate: 0.94 + Math.random() * 0.12 });
    if (sp.strokes < 3) {
      const left = 1 - sp.strokes / 3;
      sp.mesh.material.opacity = 0.90 * left;
      sp.mesh.scale.setScalar(0.55 + 0.45 * left);
      this.g.player.shake?.(0.04, 0.18);
      return;
    }
    const where = sp.where || "shop";
    this.clearSpill();
    this.g.bus.emit("chore:clean", where);

    if (this.cleanQueue && this.cleanQueue.length) {
      // Count what has been MOPPED, not what is queued. `cleanLeft` was seeded
      // at list.length - 1 and decremented before the next spill was placed,
      // so with three messes the panel read "3/3" while one was still on the
      // floor — and the task looked finished when it was not.
      this.cleanDone = (this.cleanDone || 0) + 1;
      this.cleanLeft = Math.max(0, this.cleanTotal - this.cleanDone);
      const next = this.cleanQueue.shift();
      this.g.ui.toast(next[3] ? `${this.cleanLeft} more — ${next[3]}.` : `${this.cleanLeft} more.`);
      this.makeSpill(next[0], next[1], next[2], next[3]);
      return;
    }
    this.cleanDone = this.cleanTotal;
    this.cleanLeft = 0;
    this.g.tasks.setText?.("clean", `Mop the spills — ${this.cleanTotal}/${this.cleanTotal}`);
    this.g.tasks.done("clean");
  }

  /** Queue a night's messes. Each entry is [x, z, where, place-to-say]. */
  setCleanQueue(list) {
    this.cleanQueue = list.slice(1);
    this.cleanTotal = list.length;
    this.cleanDone = 0;
    this.cleanLeft = list.length;
    const first = list[0];
    this.makeSpill(first[0], first[1], first[2], first[3]);
  }

  startPrepCleaning() {
    this.setCleanQueue([
      [-4.6, 1.15, "shop", "in front of the checkout counter"],
      [.55, 5.6, "shop", "between the left and middle shelves"],
      [7.0, 10.5, "bath", "inside the restroom — through BATH"],
    ]);
  }

  mopInstructions() {
    if(this.holding("mop"))return `Look down at the puddle and press E — ${this.spill?.strokes||0}/3 strokes.`;
    const slot=this.g.inventory.slots.findIndex(item=>item?.kind==='mop');
    return slot>=0 ? `Press ${slot+1} to equip your mop, then look down at the spill and press E.`
      : 'Get the mop: through the OFFICE door, in the right-hand corner beside the bucket.';
  }

  update(dt) {
    if(this.spill)this.spill.marker.visible=settings.taskMarkers;
  }
}

const HELD_LABEL = {
  box: "Heavier than it looks.",
  mop: "The water's cold.",
  trash: "Two bags, one hand each.",
};
