// THE NIGHT COUNT — the torch.
//
// Gil's note on Night 3 says the torch is under the counter, so that is where
// it is, from the first shift. It is a real spot light parented to the camera:
// it lights what you point it at, it does not light the room, and it is the
// only light you own — every other light in the game belongs to the building
// and can be taken away from you.
import * as THREE from "three";
import { L } from "../world/station.js";
import { settings } from "../core/settings.js";
import { inputBus } from "../core/input.js";

export class Flashlight {
  constructor(game) {
    this.g = game;
    this.have = false;
    this.on = false;
    this.battery = 1;          // drains only while lit, and never fully dies
    this._flickerT = 0;

    const cam = game.camera;
    this.light = new THREE.SpotLight(0xfff0d0, 0, 26, 0.46, 0.55, 1.1);
    this.light.position.set(0.18, -0.12, 0);      // held low and to the right
    this.target = new THREE.Object3D();
    this.target.position.set(0.05, -0.06, -6);
    cam.add(this.light, this.target);
    this.light.target = this.target;

    // the body of the torch, in shot when it is out
    this.body = null;

    game.interact.add({
      id: "torch", pos: new THREE.Vector3(-7.0, L.CNT_H + 0.06, 3.0), radius: 1.9,
      label: "the torch under the counter", verb: "Take",
      enabled: () => !this.have,
      onUse: () => this.take(),
    });

    inputBus.on("press", (code) => {
      if (code !== settings.keys.flashlight) return;
      if (this.g.mode !== "play" || this.g.ui.focused) return;
      this.toggle();
    });
  }

  async take() {
    if (this.have) return;
    this.have = true;
    this.g.audio.play("int_bottle", { vol: 0.5 });
    this.g.ui.toast(`Torch. ${keyName()} turns it on.`);
    this.g.state.flag("has_torch", true);
    this.g.state.note("Took the torch from under the counter.", this.g.minutes);
    try {
      // fitWidth, not fitHeight. The torch is built lying along its own X at
      // 23 cm long and 8 cm across; fitting it BY HEIGHT scaled it by 2.5 and
      // put a 60 cm baton in your hand. Then turn it to point where you look:
      // +X forward is rotation.y = PI/2.
      const { model, fitWidth } = await import("../core/assets.js");
      const o = await model("flashlight", { shadows: false });
      fitWidth(o, 0.21);
      o.position.set(0.26, -0.26, -0.30);
      o.rotation.set(0.10, Math.PI / 2 + 0.16, 0.06);
      o.visible = false;
      this.g.camera.add(o);
      this.body = o;
    } catch (e) { /* the light still works without the prop */ }
    this.g.interact.remove("torch");
  }

  toggle(force) {
    if (!this.have) return;
    this.on = force === undefined ? !this.on : force;
    this.g.audio.play("int_lightswitch", { vol: 0.5 });
    if (this.body) this.body.visible = this.on;
    this.g.bus.emit("torch", this.on);
  }

  /** Scripts can take it away for a beat — the batteries, the cold, the road. */
  kill(secs = 3) {
    if (!this.on) return;
    this.toggle(false);
    this.g.timers.after(secs, () => this.toggle(true));
  }

  reset() {
    this.on = false;
    this.battery = 1;
    if (this.body) this.body.visible = false;
    this.light.intensity = 0;
  }

  update(dt) {
    const want = this.on && this.have;
    if (want) {
      this.battery = Math.max(0.25, this.battery - dt * 0.0016);
      // a slow, shallow wobble — a 1997 torch with tired cells, not a strobe
      this._flickerT += dt;
      const wob = settings.reduceFlicker ? 1
        : 0.94 + Math.sin(this._flickerT * 7.3) * 0.03 + Math.sin(this._flickerT * 2.1) * 0.03;
      this.light.intensity = 46 * this.battery * wob;
    } else if (this.light.intensity > 0) {
      this.light.intensity = 0;
    }
  }
}

const keyName = () =>
  (settings.keys.flashlight || "KeyF").replace("Key", "").replace("Digit", "");
