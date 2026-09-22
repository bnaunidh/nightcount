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
    this._killGeneration = 0;

    const cam = game.camera;
    this.light = new THREE.SpotLight(0xfff0d0, 0, 26, 0.46, 0.55, 1.1);
    this.light.position.set(0.18, -0.12, -0.56);      // held low and to the right
    this.target = new THREE.Object3D();
    this.target.position.set(0.05, -0.06, -6);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = 0.08;
    this.light.shadow.camera.far = 26;
    this.light.shadow.bias = -0.0003;
    this.light.shadow.normalBias = 0.02;
    this.spill = new THREE.SpotLight(0xffedcb, 0, 8, 0.72, 0.9, 1.3);
    this.spill.position.copy(this.light.position);
    this.spill.castShadow = true;
    this.spill.shadow.mapSize.set(256, 256);
    this.spill.shadow.camera.near = 0.08;
    this.spill.shadow.camera.far = 8;
    this.spill.shadow.bias = -0.0003;
    this.spill.shadow.normalBias = 0.02;
    this.spill.target = this.target;
    cam.add(this.light, this.spill, this.target);
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

  async take({ quiet = false } = {}) {
    if (!this.g.inventory.addTorch()) return;
    const isNew = !this.have;
    this.have = true;
    this.g.state.flag("has_torch", true);
    if (isNew && !quiet) {
      this.g.audio.play("int_bottle", { vol: 0.5 });
      this.g.ui.toast(`Torch. ${keyName()} turns it on.`);
      this.g.state.note("Took the torch from under the counter.", this.g.minutes);
    }
    await this.ensureBody();
    this.g.interact.remove("torch");
  }

  async ensureBody() {
    if (this.body) return this.body;
    if (this._bodyPromise) return this._bodyPromise;
    this._bodyPromise = (async () => {
      const { model, fitWidth } = await import("../core/assets.js");
      const o = await model("flashlight", { shadows: false });
      fitWidth(o, 0.21);
      o.name = "held_flashlight";
      o.position.set(0.20, -0.17, -0.42);
      o.rotation.set(0.10, Math.PI / 2 + 0.16, 0.06);
      // The held prop uses a subdued unlit finish so its nearby beam cannot
      // overexpose the casing; the beam still lights and shadows the world.
      o.traverse(m => {
        if (!m.isMesh) return;
        const decorate = mat => new THREE.MeshBasicMaterial({ map: mat.map, color: mat.color.clone().multiplyScalar(0.42), side: mat.side });
        m.material = Array.isArray(m.material) ? m.material.map(decorate) : decorate(m.material);
      });
      o.visible = this.on && this.have;
      this.g.camera.add(o);
      this.body = o;
      return o;
    })();
    try { return await this._bodyPromise; }
    catch (error) { console.warn("[torch] body unavailable", error); return null; }
    finally { this._bodyPromise = null; }
  }

  toggle(force) {
    if (!this.have) return;
    const wasEquipped = this.g.inventory.equipped('torch');
    if (force !== false) this.g.inventory.equip(this.g.inventory.slots.indexOf(this.g.inventory.get('torch')));
    this.on = force === undefined ? (!wasEquipped || !this.on) : force;
    this._killGeneration++;
    this._beamCheck=0;
    if (!this.body) void this.ensureBody();
    this.g.audio.play("int_lightswitch", { vol: 0.5 });
    if (this.body) this.body.visible = this.on;
    this.update(0);
    this.g.bus.emit("torch", this.on);
  }

  /** Scripts can take it away for a beat — the batteries, the cold, the road. */
  kill(secs = 3) {
    if (!this.on) return;
    this.toggle(false);
    const generation = this._killGeneration;
    this.g.timers.after(secs, () => { if (this._killGeneration === generation) this.toggle(true); });
  }

  reset() {
    this._killGeneration++;
    this.on = false;
    this.battery = 1;
    if (this.body) this.body.visible = false;
    this.light.intensity = 0;
    this.spill.intensity = 0;
  }

  update(dt) {
    const equipped = this.have && this.g.inventory.equipped("torch");
    const want = this.on && equipped;
    if (this.body) this.body.visible = equipped;
    if (want) {
      this.battery = Math.max(0.25, this.battery - dt * 0.0016);
      // a slow, shallow wobble — a 1997 torch with tired cells, not a strobe
      this._flickerT += dt;
      const wob = settings.reduceFlicker ? 1
        : 0.94 + Math.sin(this._flickerT * 7.3) * 0.03 + Math.sin(this._flickerT * 2.1) * 0.03;
      // Reduce the beam at arm's length so labels and pale walls stay readable.
      const now = performance.now();
      if (!this._beamCheck || now - this._beamCheck > 120) {
        this._beamCheck = now;
        const direction = new THREE.Vector3(0,0,-1).applyQuaternion(this.g.camera.quaternion);
        const ray = new THREE.Raycaster(this.g.camera.position,direction,.08,2.4);
        const hits = ray.intersectObjects(this.g.scene.children.filter(o=>o!==this.g.camera),true);
        let distance = 2.4;
        for (const hit of hits) {
          let visible=true;for(let o=hit.object;o;o=o.parent)if(!o.visible)visible=false;
          const materials=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];
          if(!visible||hit.object.userData.noOutline||materials.every(m=>m?.transparent||m?.depthWrite===false))continue;
          distance=hit.distance;break;
        }
        this._beamStrength=Math.max(.06,Math.min(1,(distance/2.4)**2));
      }
      const near = this._beamStrength ?? 1;
      this.light.intensity = 42 * this.battery * wob * near;
      this.spill.intensity = 4.5 * this.battery * wob * (.25+.75*near);
    } else {
      this.light.intensity = 0;
      this.spill.intensity = 0;
    }
  }
}

const keyName = () =>
  (settings.keys.flashlight || "KeyF").replace("Key", "").replace("Digit", "");
