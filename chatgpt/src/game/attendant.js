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
import { model } from "../core/assets.js";

/** Where it can be found, per camera feed. */
export const POSTS = {
  3: { pos: new THREE.Vector3(1.2, 0, 6.0), rot: 0.0, anim: "NC_Restock_Loop" },
  4: { pos: new THREE.Vector3(3.4, 0, 6.6), rot: 0.0, anim: "NC_Stand_Still_Loop" },
  5: { pos: new THREE.Vector3(0.4, 0, 11.4), rot: 0.3, anim: "NC_Mop_Loop" },
  6: { pos: new THREE.Vector3(4.2, 0, 16.4), rot: 2.6, anim: "NC_Stand_Still_Loop" },
  1: { pos: new THREE.Vector3(-2.0, 0, -12.5), rot: 0.4, anim: "NC_Stand_Still_Loop" },
};

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
    await this.showAt(0, { stage: 2, anim: "Idle_Loop", at: pos, facing: Math.PI, silent: true });
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
    const requested = anim || p?.anim || "NC_Stand_Still_Loop";
    const custom = { Idle_Loop: "NC_Stand_Still_Loop", Push_Loop: "NC_Mop_Loop",
      Fixing_Kneeling: "NC_Restock_Loop" }[requested] || requested;
    this._workAnim = this.entity.actions[custom] ? custom : requested;
    this._watchT = 0;
    this.g.customers.play(this.entity, this._workAnim, 0.4);
    if (this._workAnim === "NC_Mop_Loop") {
      const entity = this.entity;
      const mop = await model("mop");
      if (this.entity === entity) {
        entity.group.add(mop);
        if (entity.cameraOnly) mop.traverse((o) => o.layers.set(LAYER_CAMERA_ONLY));
        this._mop = mop;
        this._rightHand = entity.group.getObjectByName("DEF-handR");
        this._leftHand = entity.group.getObjectByName("DEF-handL");
      }
    }
    if (this._workAnim === "NC_Restock_Loop") {
      const entity = this.entity;
      const can = await model("cans");
      if (this.entity === entity) {
        entity.group.add(can);
        if (entity.cameraOnly) can.traverse((o) => o.layers.set(LAYER_CAMERA_ONLY));
        this._stockCan = can;
        this._rightHand = entity.group.getObjectByName("DEF-handR");
      }
    }
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
      this.g.customers.play(e, "Idle_Loop");
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
    this._watchT = 0;
    this._mop = this._stockCan = this._rightHand = this._leftHand = null;
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
    if (this.stage < 3 && this.post !== null && this.playerAtPost()) {
      const left = this.post;
      this.hide();
      this.g.audio.play("hor_creak", { vol: 0.3 });
      this.g.bus.emit("attendant:vanish", left);
      return;
    }

    // Only a live, visible feed counts as watching, including QUAD mode.
    const cameras = this.g.cameras;
    const watched = this.post !== null && cameras.open && cameras.powered
      && !cameras.dead.has(this.post)
      && (cameras.quad ? cameras.quadFeeds().includes(this.post) : cameras.selected === this.post);
    if (this.stage === 2 && watched) {
      this._watchT += dt;
      if (this._watchT > 1.6) {
        this.g.customers.play(this.entity, this.entity.actions.NC_Head_Turn_Slow
          ? "NC_Head_Turn_Slow" : "Idle_Loop", 0.35);
      }
    } else {
      if (this._watchT > 1.6) this.g.customers.play(this.entity, this._workAnim, 0.35);
      this._watchT = 0;
    }
    // Fit the existing mop through both animated grips, with its head on the
    // floor. The authored animation and the character's height stay intact.
    if (this._mop && this._leftHand && this._rightHand) {
      const group = this.entity.group;
      group.updateWorldMatrix(true, true);
      const low = group.worldToLocal(this._leftHand.getWorldPosition(new THREE.Vector3()));
      const high = group.worldToLocal(this._rightHand.getWorldPosition(new THREE.Vector3()));
      const axis = high.clone().sub(low).normalize();
      this._mop.visible = this.entity.current === "NC_Mop_Loop";
      if (axis.y > 0.1 && this._mop.visible) {
        const foot = low.clone().addScaledVector(axis, -low.y / axis.y);
        this._mop.position.copy(foot);
        this._mop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
        this._mop.scale.y = (high.distanceTo(foot) + 0.15) / 1.26;
      }
    }
    if (this._stockCan && this._rightHand) {
      const group = this.entity.group;
      group.updateWorldMatrix(true, true);
      this._stockCan.visible = this.entity.current === "NC_Restock_Loop";
      this._stockCan.position.copy(group.worldToLocal(
        this._rightHand.getWorldPosition(new THREE.Vector3()))).y -= 0.055;
    }
  }
}
