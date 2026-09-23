// THE NIGHT COUNT — the Attendant.
//
// It never chases. It works. Three stages:
//   1 (N4)  camera-only. It restocks, it mops, it faces the wall.
//   2 (N5)  camera-only, but closer, and it stops working when you watch.
//   3 (N6)  it walks into the room and queues at the counter with your things.
//
// It is bound by the same rules as everyone else on the road: the only thing
// it can do to you is complete a transaction.
import * as THREE from "three";
import { LAYER_CAMERA_ONLY } from "../systems/cameras.js";
import { L } from "../world/station.js";

/** Where it can be found, per camera feed. */
// Clips: NC_* are authored for this game in Blender (char_clips.py). The
// posts were re-set for the shorter runs and the cross aisle: the aisle post
// used to face the cooler rather than a shelf, and the back-room post stood
// inside the office desk.
export const POSTS = {
  3: { pos: new THREE.Vector3(1.22, 0, 5.2), rot: Math.PI / 2, anim: "NC_Restock_Loop" },  // aisle 1, at the shelves
  4: { pos: new THREE.Vector3(3.4, 0, 6.45), rot: 0.0, anim: "NC_Mop_Loop" },             // cross aisle, by the cooler
  5: { pos: new THREE.Vector3(-0.9, 0, 10.9), rot: -Math.PI / 2, anim: "NC_Restock_Loop" }, // back room, at the cartons
  6: { pos: new THREE.Vector3(4.2, 0, 16.4), rot: 2.6, anim: "NC_Stand_Still_Loop" },    // back lot
  1: { pos: new THREE.Vector3(-2.0, 0, -12.5), rot: 0.4, anim: "NC_Stand_Still_Loop" },  // beyond the pumps
};

/** Head turn in NC_Head_Turn_Slow: 150 degrees to its left, which is +Y. */
const HEAD_TURN = THREE.MathUtils.degToRad(150);

export class Attendant {
  constructor(game) {
    this.g = game;
    this.entity = null;
    this.stage = 0;
    this.post = null;
    this.visibleTo = "camera";
    this._watchT = 0;
  }

  get present() { return !!this.entity; }

  /**
   * One frame of him and nothing more — the lightning flash on Night 2.
   * He is placed, drawn, and gone before the player can focus on him.
   */
  async flashAt(pos, secs = 0.14) {
    await this.showAt(0, { stage: 2, anim: "NC_Stand_Still_Loop", at: pos, facing: Math.PI, silent: true });
    this.g.dev?.draw?.();
    await new Promise((r) => setTimeout(r, secs * 1000));
    this.hide();
  }

  async showAt(feedId, { stage = 1, anim = null, at = null, facing = null, silent = false } = {}) {
    const p = POSTS[feedId];
    // `at` overrides the camera post: Night 2 puts him in the rain and then at
    // the restroom wall, where the player sees him with their own eyes rather
    // than on a feed.
    const pos = at ? at.clone() : (p && p.pos.clone());
    const rot = facing !== null ? facing : (p ? p.rot : 0);
    if (!pos) return;
    await this.hide();
    this.stage = stage;
    this.post = at ? null : feedId;
    this.entity = await this.g.customers.spawn("ATT", {
      at: pos, rot, cameraOnly: !at,
    });
    this.g.customers.play(this.entity, anim || p.anim, 0.4);
    this.g.bus.emit("attendant:appear", feedId);
    // it does not make sound, and the room it is in gets quieter
    if (!silent) this.g.audio.subtract("amb_fridge", true, 2.5);
  }

  /** Night 6: it comes in for real, and everyone can see it. */
  async comeToCounter() {
    await this.hide();
    this.stage = 3;
    this.visibleTo = "all";
    const e = await this.g.customers.spawn("ATT", {
      at: new THREE.Vector3(5.1, 0, -1.2),
    });
    this.entity = e;
    this.g.audio.play("int_doorchime", { vol: 0.7, scare: true });
    this.g.customers.walk(e, [
      [5.1, 1.2],
      [L.CUSTOMER.x + 1.8, L.CUSTOMER.z + 0.4],
      [L.CUSTOMER.x, L.CUSTOMER.z],
    ], () => {
      e.group.rotation.y = Math.PI;
      // at the counter it does not breathe
      this.g.customers.play(e, "NC_Stand_Still_Loop");
      this.g.bus.emit("attendant:counter");
    });
    // everything else in the mix goes
    for (const s of ["amb_fridge", "amb_freezer", "amb_hvac", "amb_ceilingfan", "amb_insects", "amb_highway"]) {
      this.g.audio.subtract(s, true, 3.0);
    }
  }

  async hide() {
    if (this.entity) {
      this.g.customers.despawn(this.entity);
      this.entity = null;
    }
    this.post = null;
    this.g.audio.subtract("amb_fridge", false, 3.0);
  }

  /** True if the player is in the same room as its camera post. */
  playerAtPost() {
    if (!this.entity) return false;
    const p = this.g.player.pos, e = this.entity.group.position;
    return Math.hypot(p.x - e.x, p.z - e.z) < 4.2;
  }

  update(dt) {
    if (!this.entity) return;

    // Stage 1–2: it is not there when you walk in. It never is.
    if (this.stage < 3 && this.playerAtPost()) {
      const left = this.post;
      this.hide();
      this.g.audio.play("hor_creak", { vol: 0.3 });
      this.g.bus.emit("attendant:vanish", left);
      return;
    }

    // Stage 2: it stops working while the feed is on it — and then it looks.
    //
    // First it goes still, turned away from the lens (a cut you only see as a
    // skipped frame on a 12 fps feed). Two seconds later its head comes round
    // 150 degrees, at one speed, and stops on the camera. The body is turned
    // so that is exactly where the head ends up: the camera's bearing, less
    // the turn. Look away and it is working again, as if it never stopped.
    const post = POSTS[this.post];
    if (this.stage === 2 && post && this.g.cameras.open && this.g.cameras.selected === this.post) {
      this._watchT += dt;
      const e = this.entity;
      if (this._watchT > 1.6 && !this._stilled) {
        this._stilled = true;
        const cam = this.g.cameras.camFor(this.post);
        const p = e.group.position;
        const toCam = cam ? Math.atan2(cam.position.x - p.x, cam.position.z - p.z) : post.rot + Math.PI;
        e.group.rotation.y = toCam - HEAD_TURN;
        this.g.customers.play(e, "NC_Stand_Still_Loop", 0.12);
      }
      if (this._watchT > 3.6 && !this._turned) {
        this._turned = true;
        this.g.customers.play(e, "NC_Head_Turn_Slow", 0.25);   // once, and it stays
      }
    } else {
      if (this._stilled && this.entity && post) {
        this.entity.group.rotation.y = post.rot;
        this.g.customers.play(this.entity, post.anim, 0.2);
      }
      this._watchT = 0;
      this._stilled = this._turned = false;
    }
  }
}
