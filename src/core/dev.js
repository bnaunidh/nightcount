// THE NIGHT COUNT — debug tools.
//
// Exposed as window.__nc.dev. Used by tools/selftest.js and during
// development. Hidden from the player: nothing in the UI reaches this, and the
// shipped build only exposes it if the URL contains #dev.
import * as THREE from "three";

export function makeDev(ctx) {
  const { game, station, player, ui, audio, scene, camera, renderer } = ctx;

  const spots = {
    counter: [-4.6, 3.7, 0],
    register: [-4.6, 3.2, 0],
    door: [5.1, -1.6, Math.PI],
    aisle: [2.2, 5.2, 0],
    cooler: [3.0, 6.4, Math.PI],
    office: [-6.2, 10.4, Math.PI],
    bank: [-6.2, 9.6, Math.PI],
    stock: [-7, 9.7, Math.PI],
    bath: [6.9, 10.2, Math.PI],
    breaker: [-3.8, 11.0, Math.PI],
    pumps: [0, -7.0, 0],
    forecourt: [0, -4.0, Math.PI],
    lot: [6, 15, Math.PI],
    pole: [0, 19.5, Math.PI],
    road: [0, -22, 0],
    nova: [-12.0, 5.0, -1.5],
  };

  const dev = {
    /** Jump straight into a night (skips prior story flags). */
    async night(n, opts = {}) {
      // Developer only, behind #dev, never reachable from any UI. Skips the
      // opening cutscene so a night's *body* can be tested without sitting
      // through a cold open every run.
      game.skipIntro = !!opts.skipIntro;
      game.state.data.night = n;
      game.menus.close();
      await game.startNight(n, true);
      return "night " + n;
    },
    /** Teleport to a named spot. */
    tp(name) {
      const s = spots[name];
      if (!s) return Object.keys(spots).join(", ");
      player.teleport(new THREE.Vector3(s[0], 0, s[1]), s[2] ?? 0);
      player.frozen = false;
      player.lookTarget = null;
      return name;
    },
    /** Complete a task by id (or all of them). */
    done(id) {
      if (id === "*") { for (const t of [...game.tasks.list]) game.tasks.done(t.id); return "all"; }
      return game.tasks.done(id);
    },
    tasks: () => game.tasks.list.map((t) => (t.done ? "[x] " : "[ ] ") + t.id),
    flags: () => game.state.data.flags,
    state: () => game.state.data,
    clues: () => Object.keys(game.state.data.clues),
    /** Force an ending. */
    ending: (id) => game.runEnding(id),
    /** Compress (or slow) the night scripts' pacing waits. */
    async speed(v) {
      const m = await import("../game/nights.js");
      m.setSpeed(v);
      // deliberately does NOT touch clockRate: customer patience is measured in
      // in-game minutes, and accelerating those would time arrivals out
      return "speed " + v;
    },
    /** Manually advance the simulation when rAF is throttled. */
    tick(n = 60, dt = 1 / 30) {
      for (let i = 0; i < n; i++) game.update(dt);
      return game.minutes;
    },
    /** Render one frame on demand. */
    draw() {
      const feed = game.feedView();
      if (feed) renderer.render(feed.cam ? scene : scene, feed.cam || camera, 0.016, { feed: true });
      else renderer.render(scene, camera, 0.016, game.postOpts());
      return "drawn";
    },
    /** Everything the interactor can currently see. */
    near() {
      const out = [];
      for (const s of game.interact.spots) {
        const p = typeof s.pos === "function" ? s.pos() : s.pos;
        if (!p) continue;
        const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
        if (d < 4) out.push(s.id + " " + d.toFixed(1));
      }
      return out;
    },
    /** Fire an interaction by id regardless of where the player is looking. */
    use(id) {
      const s = game.interact.spots.find((x) => x.id === id);
      if (!s) return "no such spot: " + id;
      if (s.enabled && !s.enabled()) return "disabled: " + id;
      s.onUse?.(s);
      return "used " + id;
    },
    /** Run a whole transaction correctly, for testing the arrival pipeline. */
    serve() {
      const r = game.register;
      if (!r.sale) return "no sale";
      while (r.sale.items.some((i) => !r.sale.scanned.includes(i))) r.scanNext();
      if (r.sale.fuelPump && !r.sale.fuelDone) r.ringFuel();
      r.doTotal();
      let due = r.changeDue;
      const DEN = [2000, 1000, 500, 100, 25, 10, 5, 1];
      for (const d of DEN) while (due >= d) { r.sale.given.push(d); due -= d; }
      r.giveChange();
      r.finish();
      return "served";
    },
    voidSale() { game.register.voidSale(); return "voided"; },
    audio: () => ({ state: audio.state, ready: audio.ready, loaded: audio.buffers.size, muted: [...audio.muted] }),
    perf() {
      const i = renderer.gl.info;
      return { calls: i.render.calls, tris: i.render.triangles, geo: i.memory.geometries, tex: i.memory.textures, programs: i.programs?.length };
    },
    spots,
  };
  return dev;
}
