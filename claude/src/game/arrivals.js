// THE NIGHT COUNT — one arrival, start to finish.
//
// Everything a customer is, mechanically, lives here: they come in, they say
// their piece, they put their things on the counter, and then the player either
// completes the transaction or doesn't. The result is written into state, where
// the ending reads it.
import { CAST } from "./customers.js";
import { clockString } from "../core/util.js";

/**
 * @param g Game
 * @param id cast id
 * @param opts {patience (in-game minutes), bayIndex, lines, onCounter, noVehicle}
 * @returns Promise<"served"|"failed">
 */
export function serveArrival(g, id, opts = {}) {
  const def = CAST[id];
  return new Promise(async (resolve) => {
    let done = false;
    const finish = (outcome, cust) => {
      if (done) return;
      done = true;
      clearInterval(patienceT);
      g.register.onComplete = null;
      g.register.onVoid = null;
      g.state.arrival(id, outcome);
      g.audio.setState(outcome === "served" ? "normal" : "suspicion", 2.5);
      if (cust) g.customers.leave(cust, { permanent: outcome === "served" });
      if (outcome === "served") {
        // the drawer runs over by exactly what they paid
        const over = (def.tender || 0) - Math.max(0, (def.tender || 0) - lineTotal(def));
        g.state.data.overCents += over;
        g.state.data.takingsCents = (g.state.data.takingsCents || 0) + lineTotal(def);
        g.state.note(`${cap(def.name)} — served, ${clockString(g.minutes)}.`, g.minutes);
      } else {
        g.state.note(`${cap(def.name)} — not served.`, g.minutes);
        g.setDread(Math.max(g.dread, 3));
      }
      g.bus.emit("arrival:done", id, outcome);
      resolve(outcome);
    };

    g.audio.setState("customer", 2.0);

    // The listener goes on BEFORE the arrival, and matches by id rather than by
    // object identity. Arrivals now take ~20 seconds of driving, and the walk to
    // the counter is driven from update(dt) — under a frame hitch, a speed-up,
    // or the test harness's batched stepping, the customer can reach the counter
    // inside the same batch that resolves arrive(), firing customer:counter
    // before the old code had subscribed. The sale then never opened and the
    // night hung on "serve" forever.
    let cust = null;
    let counterDone = false;
    // Patience is how long they will stand AT THE COUNTER — not how long their
    // car takes to park. Arrivals now drive in over ~20 s, and starting the
    // clock at the top of the arrival ate most of a living customer's budget
    // before they had even walked in: A6 and A7 both timed out on a run where
    // they used to be served.
    let startedAt = g.minutes;
    let patience = opts.patience ?? (def.living ? 22 : 34);

    const onCounter = (c) => {
      if (c.id !== id) return;
      if (cust && c !== cust) return;
      if (counterDone) return;
      counterDone = true;
      startedAt = g.minutes;          // the wait starts here
      if (window.__arrTrace) window.__arrTrace.push({ id, why: "counter", clock: Math.round(g.minutes) });
      offCounter();
      // The SALE comes first. Everything after it is presentation, and a
      // cosmetic failure (a missing clip, a subtitle, a toast) must never be
      // able to leave the customer standing at a counter with no transaction
      // open — that hangs the night on "serve" with no error anywhere.
      g.register.beginSale({
        id, who: def.name,
        items: def.wants || [],
        tenderCents: def.tender || 0,
        fuelPump: def.fuelPump, fuelCents: def.fuelCents,
      });
      try {
        const line = (opts.lines || def.lines || [])[0];
        if (line) g.ui.say(line, { who: cap(def.name), secs: 4 });
        g.customers.play(c, "Idle_Talking_Loop", 0.3);
        setTimeout(() => g.customers.play(c, "Interact", 0.25), 900);
        setTimeout(() => g.customers.play(c, "Idle_Loop", 0.4), 2000);
        g.ui.toast("They're waiting at the register.");
        opts.onCounter?.(c);
      } catch (e) {
        console.warn("[arrival] presentation failed for", id, e);
      }
    };
    const offCounter = g.bus.on("customer:counter", onCounter);

    cust = await g.customers.arrive(id, opts);
    if (!cust) { offCounter(); return resolve("aborted"); }
    // if they got there while we were still awaiting, run it now
    // if they arrived while we were still awaiting, run it now
    if (cust.state === "counter") onCounter(cust);

    g.register.onComplete = (sale) => { if (sale.id === id) finish("served", cust); };
    g.register.onVoid = (sale) => { if (sale.id === id) finish("failed", cust); };

    // patience: they say their next line, then they stop asking
    let nagged = 0;
    const patienceT = setInterval(() => {
      if (done) return;
      // Patience is how long they will stand AT THE COUNTER waiting to be
      // served. It must not tick while they are still driving in and walking
      // across the forecourt — their own journey is not the player keeping
      // them waiting. Before the vehicles were driven this was a second or two
      // and did not matter; now it is ~20 s, and it was timing out the two
      // short-patience living customers (A6, A7) before they ever arrived.
      if (!counterDone) return;
      const waited = g.minutes - startedAt;
      const lines = opts.lines || def.lines || [];
      if (waited > patience * 0.45 && nagged === 0 && lines[1]) {
        nagged = 1; g.ui.say(lines[1], { who: cap(def.name), secs: 4 });
        g.customers.play(cust, "Idle_Talking_Loop", 0.3);
        setTimeout(() => g.customers.play(cust, "Idle_Loop", 0.5), 2200);
      } else if (waited > patience * 0.78 && nagged === 1 && lines[2]) {
        nagged = 2; g.ui.say(lines[2], { who: cap(def.name), secs: 4 });
      } else if (waited > patience) {
        if (window.__arrTrace) {
          window.__arrTrace.push({ id, why: "patience", waited: Math.round(waited),
            patience, counterDone, clock: Math.round(g.minutes) });
        }
        g.register.clearSale();
        finish("failed", cust);
      }
    }, 900);
  });
}

export function lineTotal(def) {
  return (def.wants || []).reduce((a, b) => a + b.price, 0) + (def.fuelCents || 0);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
