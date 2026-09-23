// THE NIGHT COUNT — the things that are not on the list.
//
// Every scripted beat in this game is attached to a task: finish the mopping
// and the blood appears, write up the meters and the log page is dated
// tomorrow. That is good structure and it has one bad consequence — the player
// learns, quickly, that nothing happens unless they make it happen. The shift
// becomes safe, and a safe shift is a boring one.
//
// So: one or two things a night that are attached to nothing. They fire on a
// clock the player cannot see, in the middle of whatever they were doing, and
// they never turn into a task, a clue, a note, or a prompt. Nothing is gained
// by investigating and nothing is lost by ignoring them. They exist so that
// the answer to "does anything happen if I just stand here" stops being no.
//
// Rules they all obey, because breaking any of them makes the game worse:
//
//   · never during a cutscene, a focus surface, or an open sale — those are
//     moments the player cannot look away from, and a scare they cannot turn
//     round for is a noise, not a scare
//   · never a task, never a marker, never a clue
//   · always reversible: a light comes back, a door closes, the radio returns
//   · never on Night 6, which is scripted end to end and does not need help
import * as THREE from "three";
import { settings } from "../core/settings.js";
import { PUMPS, L } from "../world/station.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Somewhere behind the player, at about head height.
 *
 * The whole value of these is that you hear them from a direction you are not
 * facing, so the position is derived from where the player is actually looking
 * at the moment it fires rather than from a fixed point in the room.
 */
function behindPlayer(g, dist = 2.6) {
  const p = g.player.pos;
  const yaw = g.player.yaw + Math.PI + (Math.random() - 0.5) * 1.1;
  return V(p.x + Math.sin(yaw) * dist, 1.2, p.z + Math.cos(yaw) * dist);
}

const EVENTS = {
  /** The chime goes. The door swings, a little. Nobody comes in. */
  chime(g) {
    g.audio.play("int_doorchime", { vol: 0.55, pos: V(5.1, 1.6, 0.3) });
    g.station.setDoor("entry", true);
    g.timers.after(1.6, () => g.station.setDoor("entry", false));
  },

  /** A tube over the aisles gives out, and comes back on its own. */
  tube(g) {
    const names = ["fl_mid", "fl_east", "fl_west"];
    const name = names[Math.floor(Math.random() * names.length)];
    const light = g.station.lights[name];
    if (!light) return;
    const was = light.intensity;
    if (was <= 0) return;                 // that circuit is already dead
    g.audio.play("int_lightswitch", { vol: 0.3, pos: light.position.clone() });
    light.intensity = 0;
    // The comfort setting turns the stutter off but not the outage: a steady
    // dark aisle is the accessible version of this, not the absence of it.
    if (!settings.reduceFlicker) {
      g.timers.after(0.5, () => { if (light.intensity === 0) light.intensity = was * 0.4; });
      g.timers.after(0.62, () => { light.intensity = 0; });
    }
    g.timers.after(14 + Math.random() * 8, () => { light.intensity = was; });
  },

  /** Something comes off a shelf behind you. There is nothing on the floor. */
  shelf(g) {
    const at = behindPlayer(g, 3.2);
    g.audio.play("hor_shelf_creak", { vol: 0.4, pos: at });
    g.timers.after(0.7, () => g.audio.play("hor_bottle_fall", { vol: 0.6, pos: at }));
  },

  /** The walk-in opens itself. Cold air, and the light in there is on. */
  walkin(g) {
    if (g.chores?.coolerOpen) return;
    g.audio.play("int_fridge_door", { vol: 0.5, pos: V(3.0, 1.2, 6.2) });
    g.station.setDoor?.("cooler", true);
    if (g.chores) g.chores.coolerOpen = true;
    g.timers.after(7 + Math.random() * 5, () => {
      if (!g.chores?.coolerOpen) return;
      g.audio.play("int_fridge_door", { vol: 0.42, pos: V(3.0, 1.2, 6.2) });
      g.station.setDoor?.("cooler", false);
      if (g.chores) g.chores.coolerOpen = false;
    });
  },

  /** One breath, close, on the side you are not looking at. */
  breath(g) {
    g.audio.play("hum_breath", { vol: 0.34, pos: behindPlayer(g, 1.1) });
  },

  /** Two knocks from the stock room. Then nothing, for the rest of the night. */
  knock(g) {
    const at = V(-6.2, 1.5, 10.4);
    g.audio.play("hor_knock", { vol: 0.5, pos: at });
    g.timers.after(0.9, () => g.audio.play("hor_thump_wall", { vol: 0.38, pos: at }));
  },

  /** The radio loses the station, finds a voice, and loses that too. */
  radio(g) {
    const at = V(-6.6, 1.4, 3.0);
    g.audio.play("int_radio_static", { vol: 0.5, pos: at });
    g.timers.after(1.5, () => g.audio.play("hum_radio_voice", { vol: 0.4, pos: at }));
    g.timers.after(4.2, () => g.audio.play("int_radio_static", { vol: 0.38, pos: at }));
  },

  /** A nozzle goes back in its holster outside. No car, no bell, no sale. */
  pump(g) {
    const p = PUMPS[Math.floor(Math.random() * PUMPS.length)];
    g.audio.play("int_pump_nozzle", { vol: 0.5, pos: p.pos.clone().setY(1.2) });
    g.timers.after(1.3, () =>
      g.audio.play("int_pump_click", { vol: 0.4, pos: p.pos.clone().setY(1.2) }));
  },
};

/**
 * Which nights get what.
 *
 * It escalates by *kind*, not by volume: Night 1 gets things a building does
 * on its own, and by Night 5 they are things a person does. Night 6 gets
 * nothing — it is scripted end to end and anything unscheduled in it is
 * competing with the ending.
 */
const POOLS = {
  1: ["chime", "shelf", "tube"],
  2: ["knock", "walkin", "shelf", "tube"],
  3: ["tube", "pump", "radio", "chime"],
  4: ["breath", "knock", "shelf"],
  5: ["radio", "walkin", "breath", "knock"],
  6: [],
};

/** How many fire per night. Two is enough to stop the shift feeling safe. */
const COUNT = { 1: 2, 2: 2, 3: 3, 4: 2, 5: 3, 6: 0 };

export class Unscheduled {
  constructor(game) {
    this.g = game;
    this.gen = 0;
  }

  resetForNight(n) {
    this.gen++;
    const gen = this.gen;
    const pool = [...(POOLS[n] || [])];
    const want = Math.min(COUNT[n] || 0, pool.length);
    if (!want) return;

    // Spread across the working hours in real seconds, jittered so two runs of
    // the same night are not the same night. The first is late enough that the
    // player has settled into the job and stopped expecting anything.
    const SPAN = 950;              // ~the length of a shift at the default rate
    const first = 150;
    for (let i = 0; i < want; i++) {
      const k = Math.floor(Math.random() * pool.length);
      const [id] = pool.splice(k, 1);
      const slot = first + (SPAN - first) * (i / want);
      const at = slot + Math.random() * ((SPAN - first) / want) * 0.8;
      this.g.timers.after(at, () => this._fire(id, gen, 0));
    }
  }

  /**
   * Fire it, or wait for a moment when firing it is fair.
   *
   * A player halfway through a transaction, reading a document, or watching a
   * cutscene cannot turn round, so the event would be spent on somebody who
   * could not respond to it. It waits — a few times, and then it gives up
   * rather than queueing itself into a moment where it makes no sense.
   */
  _fire(id, gen, tries) {
    if (gen !== this.gen) return;             // the night ended
    const g = this.g;
    const clear = g.mode === "play" && !g.ui.focused && !g.paused
      && !g.register.sale && !g.player.frozen && !g.player.cutscene;
    if (!clear) {
      if (tries >= 6) return;
      g.timers.after(14 + Math.random() * 12, () => this._fire(id, gen, tries + 1));
      return;
    }
    try { EVENTS[id]?.(g); } catch (e) { console.warn("[unscheduled]", id, e); }
  }

  /** For the test harness: fire one by name, right now. */
  force(id) { EVENTS[id]?.(this.g); return id; }
}

export const UNSCHEDULED_IDS = Object.keys(EVENTS);
