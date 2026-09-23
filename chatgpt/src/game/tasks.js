// THE NIGHT COUNT — the shift's task list.
//
// Tasks are the objective system *and* the pacing system: each night's script
// waits on task completion rather than on timers, so a slow player is never
// overtaken by the story and a fast one is never left standing around.
import { Bus } from "../core/util.js";

export class Tasks {
  constructor(ui) {
    this.ui = ui;
    this.list = [];
    this.bus = new Bus();
  }

  set(list, title = "TONIGHT") {
    this.list = list.map((t) => (typeof t === "string" ? { id: t, text: t } : { ...t }));
    this.title = title;
    // A resumed shift marks everything that was already finished, silently, so
    // the night script's own `await tasks.wait(...)` gates fall straight
    // through and it picks up exactly where the player left it.
    if (this.resumeDone && this.resumeDone.length) {
      for (const t of this.list) if (this.resumeDone.includes(t.id)) t.done = true;
    }
    this.render();
  }

  /** Rewrite a task's label in place — used by counters like "0/5". */
  /** Night 5: the salt task sits at the top in white until it is poured. */
  highlight(id) {
    const t = this.get(id);
    if (t) { t.hot = true; this.render(); }
  }

  /** Night 5 needs a finished job to come back with one gap left in it. */
  /**
   * Night 4 ends with half the list unticked, on purpose — he walks out at
   * 02:24. Without saying so, that reads as a bug rather than as the ending of
   * the night, and the first thing a tester does is file it.
   */
  setHeader(text) {
    this.title = text;
    this.render();
  }

  reopen(id) {
    const t = this.get(id);
    if (t) { t.done = false; this.render(); }
  }

  setText(id, text) {
    const t = this.get(id);
    if (!t) return false;
    t.text = text;
    this.render();
    return true;
  }

  add(t) {
    const task = typeof t === "string" ? { id: t, text: t } : { ...t };
    if (this.list.some((x) => x.id === task.id)) return;
    this.list.push(task);
    this.render();
    this.bus.emit("added", task.id);
  }

  has(id) { return this.list.some((t) => t.id === id); }
  get(id) { return this.list.find((t) => t.id === id); }
  isDone(id) { return !!this.get(id)?.done; }

  done(id) {
    const t = this.get(id);
    if (!t || t.done) return false;
    t.done = true;
    this.render();
    this.bus.emit("done", id);
    if (this.list.every((x) => x.done || x.optional)) this.bus.emit("all");
    return true;
  }

  remove(id) {
    const i = this.list.findIndex((t) => t.id === id);
    if (i >= 0) { this.list.splice(i, 1); this.render(); }
  }

  clear() { this.list = []; this.render(); }

  /** Resolves when the given task is completed (or immediately if it is). */
  wait(id) {
    if (this.isDone(id)) return Promise.resolve();
    return new Promise((res) => {
      const off = this.bus.on("done", (d) => { if (d === id) { off(); res(); } });
    });
  }

  waitAll() {
    if (this.list.every((x) => x.done || x.optional)) return Promise.resolve();
    return new Promise((res) => {
      const off = this.bus.on("all", () => { off(); res(); });
    });
  }

  render() {
    this.ui.setObjectives(this.list.filter((t) => !t.hidden), this.title);
  }
}
