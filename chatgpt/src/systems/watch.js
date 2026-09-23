// THE NIGHT COUNT — the watch.
//
// It buzzes when something is due: opening, closing, anything with a clock on
// it. That is the whole of its honest job.
//
// The other half is the point of it. Once the player has learned that a buzz
// means a task, a buzz that arrives with nothing attached is not a bug and not
// a jumpscare — it is the watch doing exactly what it always does, for a reason
// the player cannot see. Per the design note: *when it goes off and you don't
// know why, that's the point.*
//
// So `due()` and `buzz()` are the same mechanism. Nothing about the presentation
// distinguishes a real alarm from one the night script fires at nobody.
import { clockString } from "../core/util.js";

export class Watch {
  constructor(game) {
    this.g = game;
    this.alarms = [];        // {at, id, label, fired}
    this.lastBuzz = -999;
  }

  resetForNight() {
    this.alarms.length = 0;
    this.lastBuzz = -999;
  }

  /**
   * Ring at a given clock time.
   * @param at    minutes from midnight (the shift crosses midnight, so 06:00
   *              is 30*60 — see SHIFT_CLOSE)
   * @param label what the player is told, or "" for a buzz with nothing on it
   */
  at(at, id, label = "") {
    this.alarms.push({ at, id, label, fired: false });
    this.alarms.sort((a, b) => a.at - b.at);
    return this;
  }

  /** Buzz now. `label` empty means the player gets no explanation. */
  buzz(label = "", { hard = false } = {}) {
    const g = this.g;
    if (g.minutes - this.lastBuzz < 0.2) return;
    this.lastBuzz = g.minutes;
    g.audio.play(hard ? "int_watch_alarm" : "int_watch_buzz", { vol: hard ? 0.8 : 0.55 });
    g.ui.watchBuzz?.(label, clockString(g.minutes));
    if (label) g.ui.toast(label);
    g.bus.emit("watch", label);
  }

  update() {
    const now = this.g.minutes;
    for (const a of this.alarms) {
      if (a.fired || now < a.at) continue;
      a.fired = true;
      this.buzz(a.label, { hard: !a.label });
    }
  }
}
