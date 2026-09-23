// THE NIGHT COUNT — arrivals.
//
// One CC0 rig, one CC0 animation library, eight people. They are told apart by
// silhouette, height, colour and behaviour rather than by face, which is both
// what the licensed assets allow and what a dark store at 640x360 wants.
//
// The rig ships as an undressed mannequin, so `dress()` paints clothing into
// the mesh's vertex colours by height band and hangs rigid accessories off the
// bones. At this resolution that reads as a person in a coat.
import * as THREE from "three";
import { loadGLTF, MODEL, unify, model, fitHeight } from "../core/assets.js";
import { clone as skinClone } from "three/addons/utils/SkeletonUtils.js";
import { LAYER_CAMERA_ONLY } from "../systems/cameras.js";
import { L, BAYS } from "../world/station.js";
import { lerp, clamp } from "../core/util.js";

const HEIGHT = 1.78;

/** The cast. `wants` is what they put on the counter. */
export const CAST = {
  A1: {
    name: "the hauler", height: 1.86, build: 1.12,
    coat: 0x3d4a3a, trousers: 0x2b2f36, skin: 0xb08c6e, cap: 0x2c3a2e,
    vehicle: "car_pickup", vehicleColor: 0x5c6a52,
    wants: [{ name: "Coffee, black", price: 65, model: "sodacan", h: 0.14 }],
    tender: 100, lines: [
      "Black. No lid.",
      "What time do you have?",
      "What time do you have?",
    ],
  },
  A2: {
    name: "the woman with the sleeping kid", height: 1.66, build: 0.92,
    coat: 0x6a5a63, trousers: 0x3a3540, skin: 0xc2a184,
    vehicle: "car_sedan", vehicleColor: 0x7a7268,
    wants: [
      { name: "Aspirin", price: 189, model: "cleaner", h: 0.11 },
      { name: "State map", price: 125, model: "snack", h: 0.03 },
    ],
    tender: 500, lines: [
      "He's asleep in the car, I won't be a minute.",
      "Is this the road north?",
      "It looks different at night.",
    ],
  },
  A3: {
    name: "the man on foot", height: 1.81, build: 1.0,
    coat: 0x2a2622, trousers: 0x24211e, skin: 0x6b5347, burned: true,
    vehicle: null,
    wants: [{ name: "Cigarettes", price: 210, model: "cigpack", h: 0.09 }],
    tender: 500, wantsChangeForPhone: true, lines: [
      "Pack of reds. And change for the phone.",
      "I've been walking.",
      "It's a long way back to the truck.",
    ],
  },
  A4: {
    name: "the salesman", height: 1.74, build: 1.04,
    coat: 0x4a4335, trousers: 0x38332b, skin: 0xbb9878, hat: true,
    vehicle: "car_sedan", vehicleColor: 0x6b5b47,
    wants: [
      { name: "Motor oil, quart", price: 149, model: "oiltin", h: 0.14 },
      { name: "Peanuts", price: 79, model: "snack", h: 0.12 },
    ],
    tender: 500, lines: [
      "Whatever you'd recommend.",
      "Whatever you'd recommend.",
      "Long night for you too, then.",
    ],
  },
  A5: {
    name: "the man from the truck", height: 1.79, build: 1.15,
    coat: 0x39414a, trousers: 0x2a2d33, skin: 0xa88a6c,
    vehicle: "car_pickup", vehicleColor: 0x4a4a4a, oneHeadlight: true,
    wants: [], fuelPump: 2, fuelCents: 800,
    tender: 1000, lines: [
      "Eight on two. Cash first.",
      "He'll stay in the cab.",
    ],
  },
  A6: {
    name: "the trucker", height: 1.83, build: 1.18,
    coat: 0x5a4d3c, trousers: 0x33353a, skin: 0xa9855f, cap: 0x7a2f2a,
    vehicle: "truck_semi", vehicleColor: 0x8a8f94, living: true,
    wants: [
      { name: "Coffee, large", price: 89, model: "sodacan", h: 0.16 },
      { name: "Beef jerky", price: 219, model: "chips", h: 0.16 },
    ],
    tender: 500, lines: [
      "Cold one out there.",
      "You're new. What happened to the old guy?",
      "Tell him Ray says hello. He'll know.",
    ],
  },
  A7: {
    name: "the girl with the flat", height: 1.68, build: 0.88,
    coat: 0x50607a, trousers: 0x2f3540, skin: 0xd0ae90, living: true,
    vehicle: "car_sedan", vehicleColor: 0x9aa3a8,
    wants: [{ name: "Payphone change", price: 25, model: "sodacan", h: 0.08 }],
    tender: 100, lines: [
      "Do you have change for the phone? My tyre's gone.",
      "Tow said an hour. That was an hour ago.",
      "Can I wait inside? It's fine, I'll wait outside.",
    ],
  },
  A8: {
    name: "Jacob", height: 1.82, build: 0.98,
    coat: 0x3f5a3e, trousers: 0x2e3a44, skin: 0xbb9877,
    vehicle: null,
    wants: [{ name: "Cigarettes", price: 195, model: "cigpack", h: 0.09 }],
    tender: 500, wantsChangeForPhone: true, lines: [
      "Pack of reds, and change for the phone.",
      "I'm on shift. I just need to call the manager.",
      "Do I know you?",
    ],
  },
  ATT: {
    name: "the attendant", height: 1.80, build: 1.0,
    coat: 0x6d6a5c, trousers: 0x3a382f, skin: 0x8d8c86, uniform: true,
    vehicle: null, wants: [], lines: [],
  },
};

export class CustomerSystem {
  constructor(game) {
    this.g = game;
    this.active = [];
    this.vehicles = [];
    this.rig = null;
    this.clips = new Map();
  }

  async init() {
    try {
      const g = await loadGLTF(MODEL.human);
      this.rig = g.scene;
      unify(this.rig, { shadows: true });
      for (const c of g.animations) this.clips.set(c.name, c);
    } catch (e) {
      console.warn("[customers] character rig unavailable", e);
    }
  }

  clip(name) { return this.clips.get(name) || null; }

  /** Paint clothing into vertex colours by height band. */
  dress(obj, def) {
    const box = new THREE.Box3().setFromObject(obj);
    const y0 = box.min.y, y1 = box.max.y, h = Math.max(0.001, y1 - y0);
    const cTrou = new THREE.Color(def.trousers ?? 0x2e2e33);
    const cCoat = new THREE.Color(def.coat ?? 0x4a4a4a);
    const cSkin = new THREE.Color(def.skin ?? 0xbb9877);
    // SkeletonUtils.clone() copies the node graph but **shares geometry and
    // materials with the source**. Writing a colour attribute onto that shared
    // geometry — which is exactly what dressing does — repainted every
    // customer already standing in the shop, and the last person through the
    // door decided what everyone was wearing. Each spawn gets its own copies.
    obj.traverse((m) => {
      if (!m.isMesh && !m.isSkinnedMesh) return;
      if (!m.userData._owned) {
        m.geometry = m.geometry.clone();
        m.material = Array.isArray(m.material)
          ? m.material.map((mm) => mm.clone())
          : m.material.clone();
        m.userData._owned = true;
      }
      const geo = m.geometry;
      const pos = geo.attributes.position;
      if (!pos) return;
      const col = new THREE.Float32BufferAttribute(pos.count * 3, 3);
      for (let i = 0; i < pos.count; i++) {
        const yy = (pos.getY(i) - y0 / (obj.scale.y || 1)) / (h / (obj.scale.y || 1));
        let c = cCoat;
        if (yy < 0.48) c = cTrou;
        else if (yy > 0.88) c = cSkin;
        // hands
        if (yy > 0.5 && yy < 0.62 && Math.abs(pos.getX(i)) > 0.28) c = cSkin;
        col.setXYZ(i, c.r, c.g, c.b);
      }
      geo.setAttribute("color", col);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) { mm.vertexColors = true; mm.color.setHex(0xffffff); mm.needsUpdate = true; }
    });
    if (def.burned) {
      obj.traverse((m) => {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) if (mm) mm.color.setHex(0x6b6058);
      });
    }
  }

  async spawn(id, opts = {}) {
    const def = { ...CAST[id], ...opts };
    const group = new THREE.Group();
    group.name = "cust_" + id;

    let mixer = null, actions = {};
    if (this.rig) {
      const body = skinClone(this.rig);
      fitHeight(body, def.height || HEIGHT);
      body.scale.x *= def.build || 1;
      body.scale.z *= def.build || 1;
      this.dress(body, def);
      group.add(body);
      mixer = new THREE.AnimationMixer(body);
      for (const n of ["Idle_Loop", "Idle_Talking_Loop", "Walk_Loop", "Walk_Formal_Loop",
        "Interact", "PickUp_Table", "Push_Loop", "Fixing_Kneeling", "Crouch_Idle_Loop", "Death01"]) {
        const c = this.clip(n);
        if (c) {
          const a = mixer.clipAction(c);
          a.enabled = true;
          actions[n] = a;
        }
      }
      actions.Idle_Loop?.play();
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, def.height || HEIGHT, 0.35),
        new THREE.MeshLambertMaterial({ color: def.coat || 0x4a4a4a }));
      box.position.y = (def.height || HEIGHT) / 2;
      group.add(box);
    }

    if (def.cap || def.hat) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, def.hat ? 0.12 : 0.08, 8),
        new THREE.MeshLambertMaterial({ color: def.cap || 0x33332c }));
      cap.position.y = (def.height || HEIGHT) - 0.06;
      group.add(cap);
    }

    const c = {
      id, def, group, mixer, actions, state: "idle",
      path: [], speed: def.speed || 1.32, current: "Idle_Loop",
      cameraOnly: !!opts.cameraOnly, lineIndex: 0,
    };
    if (c.cameraOnly) group.traverse((o) => { o.layers.set(LAYER_CAMERA_ONLY); });
    group.position.copy(opts.at || new THREE.Vector3(5.1, 0, -2.4));
    if (opts.rot !== undefined) group.rotation.y = opts.rot;
    this.g.scene.add(group);
    this.active.push(c);
    return c;
  }

  play(c, name, fade = 0.28) {
    if (!c.mixer || !c.actions[name] || c.current === name) return;
    const from = c.actions[c.current], to = c.actions[name];
    to.reset().play();
    if (from) { to.crossFadeFrom(from, fade, false); } else { to.fadeIn(fade); }
    c.current = name;
  }

  walk(c, points, onArrive) {
    c.path = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], 0, p[1])));
    c.onArrive = onArrive;
    this.play(c, c.def.uniform ? "Walk_Formal_Loop" : "Walk_Loop");
  }

  /** Standard entrance: park (if they have a car), walk in, come to the counter. */
  async arrive(id, opts = {}) {
    const def = CAST[id];
    // arrivals always take a pump bay: the long outfield bays are for cars
    // that are parked, not for people who are about to walk in
    const bay = opts.bay ?? BAYS[(opts.bayIndex ?? 0) % 4];
    let vehicle = null;
    if (def.vehicle && !opts.noVehicle) {
      // driven in: road, turn-in, forecourt, bay, engine off, lights off.
      // Resolves only once it is actually parked.
      vehicle = await this.g.vehicles.arrive(def, bay, {
        fromEast: bay.pos.x >= 0,
      });
      if (this.g.mode !== "play" && this.g.mode !== "cutscene") return null;
    }
    const from = def.vehicle && !opts.noVehicle
      ? new THREE.Vector3(bay.pos.x + (bay.side || 1) * 1.3, 0, bay.pos.z + 1.0)
      : new THREE.Vector3(opts.fromX ?? 12, 0, -3.5);
    const c = await this.spawn(id, { at: from, ...opts });
    c.vehicle = vehicle;
    // the door is opened by somebody getting out of it, not before they exist
    this.g.audio.play("veh_car_door", { vol: 0.45, pos: from.clone(), ref: 4 });
    await new Promise((r) => setTimeout(r, 900));
    this.walk(c, [
      [from.x * 0.6 + 2, -2.2],
      [5.1, -1.2],
      [5.1, 1.2],
      [L.CUSTOMER.x + 1.6, L.CUSTOMER.z + 0.4],
      [L.CUSTOMER.x, L.CUSTOMER.z],
    ], () => {
      c.group.rotation.y = Math.PI;
      this.play(c, "Idle_Loop");
      c.state = "counter";
      this.g.bus.emit("customer:counter", c);
    });
    // door chime as they come through
    setTimeout(() => {
      this.g.station.setDoor("entry", true);
      this.g.audio.play("int_doorchime", { vol: 0.6 });
      setTimeout(() => this.g.station.setDoor("entry", false), 2600);
    }, 2600);
    return c;
  }

  async parkVehicle(def, bay) {
    const v = await model(def.vehicle, { shadows: true });
    const box = new THREE.Box3().setFromObject(v);
    const size = new THREE.Vector3(); box.getSize(size);
    // Real dimensions: [length, width, height] in metres, bumper to bumper.
    // Fitted per axis rather than uniformly — uniform fitting by the longest
    // axis inflated a day-cab tractor into something 4.6 m wide and two storeys
    // tall (master prompt 6.11). At this fidelity a little non-uniform stretch
    // is invisible; a 4.6 m wide sedan is not.
    const DIMS = {
      car_sedan:  [4.70, 1.80, 1.45],
      car_pickup: [5.40, 2.00, 1.90],
      truck_semi: [8.80, 2.50, 3.60],   // day-cab tractor unit, not articulated
      van:        [5.30, 2.10, 2.30],
      tanker:     [11.5, 2.55, 3.50],
    };
    const want = DIMS[def.vehicle] || DIMS.car_sedan;
    // the model's own longest horizontal axis is its length
    const alongX = size.x >= size.z;
    const sx = alongX ? want[0] / (size.x || 1) : want[1] / (size.x || 1);
    const sz = alongX ? want[1] / (size.z || 1) : want[0] / (size.z || 1);
    const sy = want[2] / (size.y || 1);
    if (isFinite(sx) && isFinite(sy) && isFinite(sz)) v.scale.set(sx, sy, sz);
    const g = new THREE.Group();
    g.add(v);
    v.position.y -= new THREE.Box3().setFromObject(v).min.y;
    if (def.vehicleColor) {
      v.traverse((m) => {
        if (m.isMesh && m.material && !m.material.map) m.material.color.setHex(def.vehicleColor);
      });
    }
    g.position.copy(bay.pos);
    g.rotation.y = bay.rot;
    this.g.scene.add(g);
    // a parked vehicle is solid
    const vb = new THREE.Box3().setFromObject(g);
    const col = {
      x0: vb.min.x + 0.15, x1: vb.max.x - 0.15,
      z0: vb.min.z + 0.15, z1: vb.max.z - 0.15,
      y1: vb.max.y, label: "vehicle:" + (def.id || def.vehicle),
    };
    this.g.station.colliders.push(col);
    this.vehicles.push({ group: g, def, collider: col });
    this.g.audio.play("veh_car_arrive", { vol: 0.5, pos: bay.pos.clone() });
    return g;
  }

  /** The world position of whatever a customer arrived in, if anything. */
  static vehiclePos(v) {
    if (!v) return null;
    // a Vehicle from the director owns a .group; the old path handed a Group
    return v.group ? v.group.position : v.position || null;
  }

  /** They take their bag and go. If `permanent`, the car leaves the road. */
  leave(c, { permanent = true } = {}) {
    c.state = "leaving";
    const vpos = CustomerSystem.vehiclePos(c.vehicle);
    this.walk(c, [
      [L.CUSTOMER.x + 2.0, 1.0],
      [5.1, 1.0],
      [5.1, -2.4],
      [vpos ? vpos.x : 14, -4.0],
    ], () => {
      this.despawn(c);
      if (c.vehicle) {
        if (permanent) {
          if (vpos) this.g.audio.play("veh_car_leave", { vol: 0.5, pos: vpos.clone() });
          // the vehicle drives itself out: engine, lights, forecourt, road
          if (c.vehicle && c.vehicle.depart) c.vehicle.depart();
          else this._driveOff(c.vehicle);
        }
      }
      this.g.bus.emit("customer:left", c, permanent);
    });
    setTimeout(() => {
      this.g.station.setDoor("entry", true);
      this.g.audio.play("int_doorchime", { vol: 0.55 });
      setTimeout(() => this.g.station.setDoor("entry", false), 2400);
    }, 2000);
  }

  _driveOff(v) {
    // The instant it starts moving it stops being a wall. This used to run only
    // on clearAll(), so a departed car left its collider on the forecourt for
    // the rest of the run (master prompt 6.9).
    const rec = this.vehicles.find((x) => x.group === v);
    if (rec) this._dropVehicleCollider(rec);

    const from = v.position.clone();
    const to = new THREE.Vector3(from.x, 0, -60);
    // Driven from update(dt), not a private rAF loop, so it pauses with the
    // game, respects dt clamping, and cannot keep running in a throttled tab.
    this._departing = this._departing || [];
    this._departing.push({ v, from, to, t: 0, dur: 4.2 });
  }

  despawn(c) {
    c.group.parent?.remove(c.group);
    this.active = this.active.filter((x) => x !== c);
  }

  _dropVehicleCollider(v) {
    const i = this.g.station.colliders.indexOf(v.collider);
    if (i >= 0) this.g.station.colliders.splice(i, 1);
  }

  clearAll() {
    for (const v of this.vehicles) this._dropVehicleCollider(v);
    for (const c of [...this.active]) this.despawn(c);
    for (const v of this.vehicles) v.group.parent?.remove(v.group);
    this.vehicles.length = 0;
  }

  get(id) { return this.active.find((c) => c.id === id); }

  /**
   * A person standing at your counter is not silent.
   *
   * Until this existed, every customer waited in total silence with an idle
   * animation looping, which read as scenery rather than as somebody waiting
   * for you. Now they breathe, shift, clear their throat — and the longer you
   * leave them, the less patient they sound. That is deliberately the only
   * warning you get before patience runs out: there is no bar on screen, so
   * the sound is the mechanic, not decoration on top of it.
   */
  _vox(c, dt) {
    if (c.state !== "counter") { c.waitT = 0; return; }
    c.waitT = (c.waitT || 0) + dt;
    c._voxIn = (c._voxIn ?? 4 + Math.random() * 5) - dt;
    if (c._voxIn > 0) return;
    // patient at first, then not
    const pool = c.waitT < 25
      ? ["hum_breath", "hum_sigh"]
      : c.waitT < 60
        ? ["hum_sigh", "hum_cough", "hum_murmur"]
        : ["hum_cough", "hum_sigh", "hum_murmur", "hum_murmur"];
    const slot = pool[(Math.random() * pool.length) | 0];
    this.g.audio.play(slot, {
      vol: c.waitT < 25 ? 0.22 : 0.34,
      pos: c.group.position.clone().setY(1.5),
      ref: 3,
      // a voice that is always identical is one voice; these are people
      rate: 0.9 + Math.random() * 0.22,
    });
    // impatience is also a rhythm — they make noise more often the longer it goes
    const gap = c.waitT < 25 ? 9 : c.waitT < 60 ? 6 : 4;
    c._voxIn = gap * (0.7 + Math.random() * 0.7);
  }

  update(dt) {
    // departing vehicles
    if (this._departing && this._departing.length) {
      for (let i = this._departing.length - 1; i >= 0; i--) {
        const d = this._departing[i];
        d.t += dt / d.dur;
        if (d.t >= 1) {
          d.v.parent?.remove(d.v);
          this.vehicles = this.vehicles.filter((x) => x.group !== d.v);
          this._departing.splice(i, 1);
          continue;
        }
        d.v.position.lerpVectors(d.from, d.to, d.t * d.t);
      }
    }
    for (const c of this.active) {
      c.mixer?.update(dt);
      this._vox(c, dt);
      if (!c.path.length) continue;
      const target = c.path[0];
      const dx = target.x - c.group.position.x, dz = target.z - c.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.14) {
        c.path.shift();
        if (!c.path.length) {
          this.play(c, "Idle_Loop");
          const cb = c.onArrive; c.onArrive = null;
          cb?.();
        }
        continue;
      }
      const step = Math.min(d, c.speed * dt);
      c.group.position.x += (dx / d) * step;
      c.group.position.z += (dz / d) * step;
      const want = Math.atan2(dx, dz);
      let diff = want - c.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.group.rotation.y += diff * Math.min(1, dt * 6);
    }
  }
}
