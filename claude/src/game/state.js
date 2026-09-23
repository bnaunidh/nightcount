// THE NIGHT COUNT — persistent story state.
//
// One object holds everything the ending calculus reads. It is saved at every
// checkpoint, so a reload reproduces the same station, the same failures and
// the same knowledge.
import { Bus } from "../core/util.js";
import { store, persistent } from "../core/storage.js";
import { BUILD } from "../core/build.js";

// The demo keeps its own save.
//
// Both builds are the same page on the same origin, so a shared key means
// playing the demo silently overwrites a full playthrough — and a full save
// sitting at Night 5 would offer Continue in a build that stops at two. One
// string, and the two files stop being able to hurt each other.
const KEY = BUILD.demo ? "nightcount.demo.save.v1" : "nightcount.save.v1";

export const freshState = () => ({
  version: 1,
  night: 1,
  clock: 22 * 60,                 // minutes from midnight
  started: false,
  finished: false,

  // money / count
  drawerCents: 12000,             // opening float
  overCents: 0,                   // the night count: unexplained surplus
  spoiledStock: 0,
  // The operator's own mistakes, kept apart from the unexplained surplus.
  // Ringing an item to the wrong department and counting change wrong are the
  // two ways the drawer can be wrong because of *you* rather than because of
  // the building, and the shift report has to be able to tell them apart —
  // otherwise every error the player makes reads as the game being haunted.
  deptErrors: 0,                  // items rung under the wrong key
  changeErrCents: 0,              // signed: negative = drawer short
  saleErrors: 0,                  // transactions with at least one of either

  // per-arrival outcomes: id -> "served" | "failed" | "pending"
  arrivals: {},
  failCount: 0,
  servedCount: 0,

  // discovery
  clues: {},                      // clueId -> true
  tapesWatched: {},
  docsRead: {},
  cabinetOpened: false,
  deskOpened: false,
  formSeen: false,
  headcountFiled: null,

  // flags used by the nights
  flags: {},

  // player-facing notebook
  notes: [],

  // tally of what the player physically touched most (used on Night 6)
  handled: { notebook: 0, keys: 0, punchcard: 0 },

  // where the shift was when it was last saved, so Continue puts you back
  // at the counter you were standing at rather than at the start of the night
  resume: null,          // {x,z,yaw,clock,done:[taskId], torch}

  // settings that belong to the run, not the profile
  dread: 0,
  endingSeen: null,
  cutscenesSeen: {},
});

export class State {
  constructor() {
    this.bus = new Bus();
    this.data = freshState();
  }

  reset() { this.data = freshState(); }

  get night() { return this.data.night; }
  flag(k, v) {
    if (v === undefined) return !!this.data.flags[k];
    this.data.flags[k] = v;
    this.bus.emit("flag", k, v);
    return v;
  }
  clue(id, text) {
    if (this.data.clues[id]) return false;
    this.data.clues[id] = true;
    this.bus.emit("clue", id, text);
    return true;
  }
  note(text, when) {
    this.data.notes.push({ text, when });
    this.bus.emit("note", text);
  }
  arrival(id, outcome) {
    this.data.arrivals[id] = outcome;
    if (outcome === "served") this.data.servedCount++;
    if (outcome === "failed") { this.data.failCount++; this.bus.emit("failed", id); }
    this.bus.emit("arrival", id, outcome);
  }
  countClues() { return Object.keys(this.data.clues).length; }

  save() {
    try {
      store.set(KEY, JSON.stringify({ at: Date.now(), data: this.data }));
      this.bus.emit("saved");
      return true;
    } catch (e) { console.warn("save failed", e); return false; }
  }

  static hasSave() {
    try { return !!store.get(KEY); } catch (e) { return false; }
  }
  static peek() {
    try {
      const o = JSON.parse(store.get(KEY));
      return o?.data || null;
    } catch (e) { return null; }
  }
  load() {
    const d = State.peek();
    if (!d) return false;
    this.data = Object.assign(freshState(), d);
    return true;
  }
  static clear() { store.remove(KEY); }
  static durable() { return persistent(); }
}
