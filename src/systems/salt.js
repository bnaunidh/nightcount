// THE NIGHT COUNT — the salt.
//
// One bag. Six pours. More thresholds than pours.
//
// The whole design is the shortfall. A line holds — whatever crosses a salted
// threshold does not come through it. It does not go away either. **It goes
// around.** So every pour is a choice about which way in you are willing to
// leave open, and the player finds out what they left open afterwards, not
// before.
//
// The player is never told any of this. He knows what he read. The game never
// confirms the rule in words; it confirms it by what happens at the doors he
// did not salt.
import * as THREE from "three";
import { L } from "../world/station.js";
import { surface, TEX } from "../core/assets.js";

/**
 * Every threshold that can take a line. There are nine, and six pours, and the
 * player will not work that out until they are standing at the seventh.
 */
export const THRESHOLDS = [
  { id: "front",   label: "the front door",        pos: [5.1, 0.02, 0.15],   w: 2.2, d: 0.5 },
  { id: "rear",    label: "the back door",         pos: [0.0, 0.02, 11.85],  w: 1.5, d: 0.5 },
  // Derived from the layout, not typed twice.
  //
  // These were hand-written at x -7 for "the office door" and x +1 for "the
  // stock room" — which was true before the two rooms were swapped and false
  // afterwards. For several nights the game asked you to salt the office and
  // put the line down at the far end of the building, in the stock room.
  { id: "bath",    label: "the bathroom door",     pos: [L.DOOR_BATH, 0.02, L.PARTZ],   w: 1.1, d: 0.5 },
  { id: "office",  label: "the office door",       pos: [L.DOOR_OFFICE, 0.02, L.PARTZ], w: 1.5, d: 0.5 },
  { id: "stock",   label: "the stock room",        pos: [L.DOOR_STOCK, 0.02, L.PARTZ],  w: 1.2, d: 0.5 },
  { id: "cooler",  label: "the walk-in",           pos: [3.0, 0.02, 6.15],   w: 1.6, d: 0.5 },
  { id: "hall",    label: "the hall",              pos: [4.5, 0.02, 8.0],    w: 1.0, d: 0.5 },
  { id: "counter", label: "the way behind the counter", pos: [-7.6, 0.02, 2.45], w: 1.0, d: 0.5 },
  { id: "canopy",  label: "the forecourt doors",   pos: [5.1, 0.02, -1.6],   w: 2.4, d: 0.5 },
];

export class Salt {
  constructor(game) {
    this.g = game;
    this.pours = 0;
    this.max = 6;
    this.lines = new Map();      // id -> mesh
    this.have = false;
    this._built = false;
  }

  /**
   * Night 6 only: exactly six doors, so that six pours is exactly enough.
   * It is the one night the arithmetic works, and that is the tell.
   */
  restrictTo(ids) {
    this.only = ids ? new Set(ids) : null;
  }

  /** Night 6: it walks over every line laid all week. */
  breakAll() {
    for (const [id, m] of this.lines) { m.material.opacity = 0.18; this.g.state.flag("broken_" + id, true); }
    this.g.audio.play("hor_static_burst", { vol: 0.4 });
  }

  resetForNight() {
    this.only = null;
    for (const m of this.lines.values()) m.parent?.remove(m);
    this.lines.clear();
    this.pours = 0;
    this.have = false;
  }

  /**
   * He takes the bag out of the trunk.
   *
   * `carry: true` is Night 4 onward — it is the *same bag*. Whatever he did
   * not pour on the night before is what he has tonight, and nothing tells him
   * the number except the weight of it in his hand. A player who was frugal on
   * Night 3 is better off now, and a player who used the lot is not, and
   * neither of them was ever warned that this was a decision.
   */
  give({ carry = false, bag = 6 } = {}) {
    const left = this.g.state.data.saltLeft;
    this.max = carry && left != null ? left : bag;
    this.pours = 0;
    this.have = true;
    this.g.state.data.saltLeft = this.max;
    if (this.max <= 0) {
      this.g.ui.toast("The bag is empty. He shakes it anyway.");
    } else if (carry) {
      this.g.ui.toast(`It's lighter than it was. ${this.max} left in it.`);
    } else {
      this.g.ui.toast("One bag. It will not go far.");
    }
    this._install();
  }

  get left() { return Math.max(0, this.max - this.pours); }
  isSalted(id) { return this.lines.has(id); }

  /**
   * Is this threshold still waiting for a line?
   *
   * Read by the door hotspots, which stand down while it is true. Four of the
   * nine salt points sit exactly in a doorway — as they should, you salt a
   * threshold — and the door's hotspot is wider, so the door won the crosshair
   * every single time and those four could never be poured. Night 3 needs six
   * of nine and Night 6 needs six exactly, so the game's central mechanic was
   * unusable by anybody actually playing it. `dev.use("salt_bath")` fires from
   * anywhere, which is why every automated run said it was fine.
   *
   * While the salt is the job, the doorway is the salt's. Once the line is
   * down, the door is a door again.
   */
  pending(id) {
    return !!(this.have && this.left > 0 && !this.lines.has(id)
      && (!this.only || this.only.has(id)));
  }

  _install() {
    if (this._built) return;
    this._built = true;
    const I = this.g.interact;
    for (const t of THRESHOLDS) {
      I.add({
        id: "salt_" + t.id,
        pos: new THREE.Vector3(t.pos[0], 1.0, t.pos[2]),
        radius: 1.9,
        label: t.label,
        get verb() { return "Lay a line of salt"; },
        // `only` is Night 6: the spots all exist, but six of them answer.
        enabled: () => this.have && this.left > 0 && !this.lines.has(t.id)
          && (!this.only || this.only.has(t.id)),
        onUse: () => this.pour(t),
      });
    }
  }

  pour(t) {
    if (!this.have || this.left <= 0 || this.lines.has(t.id)) return;
    this.pours++;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(t.w, t.d),
      new THREE.MeshLambertMaterial({
        color: 0xe8e4d8, transparent: true, opacity: 0.92,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(t.pos[0], t.pos[1], t.pos[2]);
    m.renderOrder = 4;
    m.name = "salt_" + t.id;
    this.g.scene.add(m);
    this.lines.set(t.id, m);

    this.g.audio.play("int_salt_pour", { vol: 0.7, pos: m.position.clone() });
    this.g.state.flag("salted_" + t.id, true);
    this.g.state.data.saltLeft = this.left;   // the bag persists between nights
    this.g.tasks.setText?.("salt", `Lay salt — ${this.pours}/${this.max}`);
    if (this.pours >= this.max) {
      this.g.tasks.done("salt");
      this.g.ui.toast("That's the bag.");
    } else {
      this.g.ui.toast(`${this.left} left.`);
    }
    this.g.bus.emit("salt:poured", t.id, this.left);
  }

  /**
   * Where would it come in tonight? The first unsalted threshold in priority
   * order — which is how the player learns the rule: it arrives at the door
   * they did not do.
   */
  weakest(order = ["front", "rear", "bath", "hall", "stock", "office", "cooler", "counter", "canopy"]) {
    for (const id of order) {
      if (this.only && !this.only.has(id)) continue;
      if (!this.lines.has(id)) return id;
    }
    return null;
  }

  /** Footprints on both sides of a line that was never crossed. */
  markCrossing(id) {
    const t = THRESHOLDS.find((x) => x.id === id);
    if (!t) return;
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.34),
        new THREE.MeshLambertMaterial({
          color: 0x2a2622, transparent: true, opacity: 0.55,
          depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
        })
      );
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = 0.2 * side;
      p.position.set(t.pos[0] + 0.18 * side, 0.025, t.pos[2] + 0.42 * side);
      p.renderOrder = 5;
      this.g.scene.add(p);
    }
    this.g.state.clue("footprints_" + id, "Footprints on both sides of an unbroken line");
  }
}
