// THE NIGHT COUNT — vehicle arrivals and departures.
//
// A car used to *appear*, already parked, with a one-shot sound. For a game
// where "a car arrived and you didn't hear it" is a story beat, that is the
// wrong foundation: you cannot subvert a rule the player has never seen obeyed.
// So arrival is now a real, observed event — heard before it is seen, seen as
// headlights before it is seen as a vehicle, and driven rather than lerped.
//
// The important thing this buys is the headlight sweep across the shopfront
// while you are standing at the register with your back to the glass. That is
// the single strongest atmospheric moment available to this station, and it
// used to never happen.
//
// Everything is an explicit state machine ticked from update(dt) — never a
// private requestAnimationFrame, never a chain of setTimeout. Every state can
// be aborted straight to DISPOSING, because a night can end, the power can
// fail, or the player can load a save at any point during a 20-second approach.
import * as THREE from "three";
import {VehicleMotion} from "./vehicle-motion.js";
import {finishVehicle} from "../world/vehicle-finish.js";
import { VEHICLE_DIMENSIONS } from "../core/variants.js";
import { model } from "../core/assets.js";
import { L, BAYS } from "../world/station.js";
import { settings } from "../core/settings.js";

export const S = {
  IDLE: "IDLE", SPAWNING: "SPAWNING", APPROACH_FAR: "APPROACH_FAR",
  APPROACH_NEAR: "APPROACH_NEAR", TURN_IN: "TURN_IN", CROSS: "CROSS_FORECOURT",
  PARKING: "PARKING", SETTLING: "SETTLING", IDLING: "IDLING",
  ENGINE_OFF: "ENGINE_OFF", LIGHTS_OFF: "LIGHTS_OFF", PARKED: "PARKED",
  DOOR_OPEN: "DOOR_OPEN", OCCUPANT_OUT: "OCCUPANT_OUT", DOOR_CLOSE: "DOOR_CLOSE",
  WAITING: "WAITING", DEPARTING: "DEPARTING", LEAVING: "LEAVING",
  DISPOSING: "DISPOSING", DONE: "DONE",
};

// Tuning. Master prompt §7.5 gave starting points; these are what they were
// settled at after watching the approach from behind the register.
const TUNE = {
  cruise: 12.5,          // m/s on the road — a dead highway at night
  turnIn: 4.2,
  forecourt: 2.4,
  creep: 0.8,
  accel: 2.2,
  decel: 2.0,
  arriveFrom: -62,       // metres along the road, out past the fog
  leaveTo: 78,
  headlight: {
    // Measured, not guessed: at intensity 90 the beams added only 5.8% mean
    // brightness to the shopfront band — technically correct and visually
    // nothing. These values put the rake at a level you actually notice with
    // your back to the glass, which is the whole point of the system.
    angle: 0.52,         // ~30 deg outer
    penumbra: 0.38,
    distance: 46,
    intensity: 340,
    height: { car: 0.68, truck: 1.10 },
    downtilt: 0.055,     // ~3 deg
  },
  engineOffToLightsOff: 0.6,
  doorToClear: 1.5,
};

// Real dimensions [length, width, height] — the same table customers.js uses.
const DIMS = {
  car_sedan: [4.70, 1.80, 1.45],
  car_pickup: [5.40, 2.00, 1.90],
  truck_semi: [8.80, 2.50, 3.60],
  van: [5.30, 2.10, 2.30],
  tanker: [11.5, 2.55, 3.50],
};

/**
 * Route to a bay: road → apron → forecourt → bay pose.
 *
 * Hazards these must clear: canopy columns at (±7.2, −5.0) and (±7.2, −13.0),
 * the pump islands at z −6.6 and −11.4, the apron in front of the doors, the
 * cones at (−8.4, −3.2) and (−9.2, −3.6), and Danny's Nova at (−13.6, 5.0),
 * which never moves.
 */
function routeTo(bay, fromEast) {
  const side = fromEast ? 1 : -1;
  const x0 = TUNE.arriveFrom * side * -1;   // enters from the far end
  const road = L.ROAD_Z;
  const wp = [];
  wp.push(new THREE.Vector3(x0, 0, road));
  wp.push(new THREE.Vector3(side * 14.0, 0, road));            // still on the road
  wp.push(new THREE.Vector3(side * 11.5, 0, road + 3.4));      // leaving it
  // Up the outfield, then IN ACROSS THE FRONT of the building before turning
  // into the bay. The first route ran straight up the far side at x ±10.5,
  // which is outside the 18 m building, so the beams never crossed the glass —
  // and the headlight rake past the shopfront is the entire reason this system
  // exists. This brings the nose round to face the store as it swings in.
  wp.push(new THREE.Vector3(side * 10.6, 0, -15.5));
  wp.push(new THREE.Vector3(side * 9.4, 0, -7.0));
  wp.push(new THREE.Vector3(side * 7.6, 0, -3.9));             // across the facade
  wp.push(new THREE.Vector3(bay.pos.x + side * 1.4, 0, bay.pos.z + 2.2));
  wp.push(new THREE.Vector3(bay.pos.x, 0, bay.pos.z));
  return wp;
}

function routeOut(bay) {
  const side = bay.pos.x >= 0 ? 1 : -1;
  return [
    new THREE.Vector3(bay.pos.x + side * 3.0, 0, bay.pos.z),
    new THREE.Vector3(side * 10.4, 0, bay.pos.z - 2.0),
    new THREE.Vector3(side * 11.0, 0, -18.0),
    new THREE.Vector3(side * 13.0, 0, L.ROAD_Z),
    new THREE.Vector3(side * TUNE.leaveTo, 0, L.ROAD_Z),
  ];
}

export class Vehicle {
  constructor(dir, def, bay, opts = {}) {
    this.dir = dir;
    this.g = dir.g;
    this.def = def;
    this.bay = bay;
    this.opts = opts;
    this.state = S.IDLE;
    this.t = 0;                 // seconds in the current state
    this.group = new THREE.Group();
    this.group.name = "veh_" + (def.vehicle || "car");
    this.speed = 0;
    this.path = null;
    this.leg = 0;
    this.collider = null;
    this.lights = [];
    this.brakeMats = [];
    this.engine = null;
    this.dead = false;
    this.onParked = opts.onParked || null;
    this.onGone = opts.onGone || null;
  }

  // ——— lifecycle ————————————————————————————————————————————————
  async spawn() {
    this._set(S.SPAWNING);
    const key = this.def.vehicle || "car_sedan";
    const v = await model(key, { shadows: true });
    if (this.dead) return;                      // aborted while loading

    const box = new THREE.Box3().setFromObject(v);
    const size = new THREE.Vector3(); box.getSize(size);
    const want = VEHICLE_DIMENSIONS[v.userData.assetVariant] || DIMS[key] || DIMS.car_sedan;
    const alongX = size.x >= size.z;
    // non-uniform: uniform fitting inflated the day-cab tractor to 4.6 m wide
    v.scale.set(
      (alongX ? want[0] : want[1]) / (size.x || 1),
      want[2] / (size.y || 1),
      (alongX ? want[1] : want[0]) / (size.z || 1)
    );
    // the model's own length axis must end up along local +Z
    if (alongX) v.rotation.y = Math.PI / 2;
    const b2 = new THREE.Box3().setFromObject(v);
    v.position.y -= b2.min.y;
    const c2 = new THREE.Vector3(); b2.getCenter(c2);
    v.position.x -= c2.x; v.position.z -= c2.z;

    if (this.def.vehicleColor) {
      v.traverse((m) => {
        if (m.isMesh && m.material && !m.material.map) m.material.color.setHex(this.def.vehicleColor);
      });
    }
    this.body = v;
    this.length = want[0];
    this.width = want[1];
    this.group.add(v);
    finishVehicle(v,this.group,want,v.userData.assetVariant||key);

    this.motion = new VehicleMotion(this);
    this._makeLights(key, want);

    this.path = this.opts.path || routeTo(this.bay, this.opts.fromEast ?? (this.bay.pos.x >= 0));
    this.group.position.copy(this.path[0]);
    this._faceAlong(this.path[1]);
    this.g.scene.add(this.group);

    this._set(S.APPROACH_FAR);
    this.speed = TUNE.cruise;
    this._lightsOn(true);
    this._engineStart();
  }

  _makeLights(key, dims) {
    const isTruck = key === "truck_semi" || key === "tanker" || key === "vehicle_delivery";
    const H = TUNE.headlight;
    const y = isTruck ? H.height.truck : H.height.car;
    const sep = dims[1] * 0.30;
    const nose = dims[0] / 2 - 0.15;
    // one headlight is dead on A5's pickup — the flag was already in the data
    // and unused, because until now there were no headlights to kill
    const dead = this.def.oneHeadlight ? -1 : 0;
    for (const s of [-1, 1]) {
      const lamp = new THREE.SpotLight(0xfff3d8, s === dead ? 0 : H.intensity,
        H.distance, H.angle, H.penumbra, 1.1);
      lamp.position.set(s * sep, y, nose);
      const target = new THREE.Object3D();
      target.position.set(s * sep * 0.6, y - H.distance * H.downtilt, nose + H.distance);
      this.group.add(lamp, target);
      lamp.target = target;
      lamp.castShadow = false;              // budget: see setShadowBudget()
      this.lights.push({ lamp, on: s !== dead, base: s === dead ? 0 : H.intensity });
      // the visible lamp face, so it reads as a headlight from in front
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(0.11, 8),
        new THREE.MeshBasicMaterial({ color: s === dead ? 0x2a2a26 : 0xfff6e2 })
      );
      face.position.set(s * sep, y, nose + 0.02);
      this.group.add(face);
      this.lampFaces = this.lampFaces || [];
      this.lampFaces.push({ face, dead: s === dead });
    }
    // tail and brake lights: emissive material, not lights — two shadowless
    // spots per vehicle is already the ceiling on integrated graphics
    for (const s of [-1, 1]) {
      const m = new THREE.MeshBasicMaterial({ color: 0x40100c });
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), m);
      tail.position.set(s * sep, y - 0.05, -dims[0] / 2 - 0.02);
      tail.rotation.y = Math.PI;
      this.group.add(tail);
      this.brakeMats.push(m);
    }
  }

  _findWheels(v) {
    this.wheels = [];
    v.traverse((o) => {
      if (/wheel/i.test(o.name || "")) this.wheels.push(o);
    });
  }

  // ——— per-frame ————————————————————————————————————————————————
  _isTruck() {
    return this.def.vehicle === "truck_semi" || this.def.vehicle === "tanker" || this.def.vehicle === "vehicle_delivery";
  }

  update(dt) {
    if (this.dead || this.state === S.DONE) return;
    this.t += dt;
    this.frameDt = dt;
    const st = this.state;

    if (st === S.APPROACH_FAR || st === S.APPROACH_NEAR || st === S.TURN_IN ||
        st === S.CROSS || st === S.PARKING || st === S.DEPARTING || st === S.LEAVING) {
      this._drive(dt);
    }

    switch (st) {
      case S.APPROACH_FAR: {
        const d = this._distanceToLeg(2);
        if (d < 26) this._set(S.APPROACH_NEAR);
        break;
      }
      case S.APPROACH_NEAR:
        this._target(TUNE.turnIn);
        if (this.leg >= 2) this._set(S.TURN_IN);
        break;
      case S.TURN_IN:
        this._target(TUNE.turnIn);
        if (this.leg >= 4) { this._set(S.CROSS); this.g.audio.play("veh_car_arrive", { vol: 0.28, pos: this.group.position.clone(), ref: 8 }); }
        break;
      case S.CROSS:
        this._target(TUNE.forecourt);
        if (this.leg >= this.path.length - 2) this._set(S.PARKING);
        break;
      case S.PARKING: {
        this._target(TUNE.creep);
        this._brake(true);
        // On the last leg, stop steering by waypoint and ease onto the exact
        // bay pose — position AND heading. Waypoint following alone leaves the
        // car a few centimetres out and a few degrees crooked, which reads as
        // "placed" rather than "parked", and can stall short of the target.
        if (this.leg >= this.path.length - 1) {
          const goal = this.path[this.path.length - 1];
          const k = Math.min(1, dt * 2.6);
          this.group.position.lerp(goal, k);
          const want = this.bay.rot ?? this.group.rotation.y;
          let d = want - this.group.rotation.y;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          this.group.rotation.y += d * k;
          this.speed = Math.max(0, this.speed - TUNE.decel * dt);
          if (this.group.position.distanceTo(goal) < 0.05 && Math.abs(d) < 0.04) {
            this.group.position.copy(goal);
            this.group.rotation.y = want;
            this.speed = 0;
            this._set(S.SETTLING);
          }
        }
        break;
      }
      case S.SETTLING:
        // the nose dips and recovers — the tell that it actually stopped
        // Suspension is animated on the body mount, independently of the wheels.
        // ...and if it is a semi, the brakes let go, which is the loudest
        // thing that happens on the forecourt all night. The sound existed
        // from the first asset pass and had never been played: it belonged to
        // the tanker in the retired Night 4, and went with it.
        if (this._isTruck() && !this._hissed) {
          this._hissed = true;
          this.g.audio.play("veh_truck_airbrake", {
            vol: 0.6, pos: this.group.position.clone(), ref: 6,
          });
        }
        if (this.t > 0.8) { this._brake(false); this._set(S.IDLING); }
        break;
      case S.IDLING:
        if (this.t > 1.6 + (this.dir.rand() * 1.2)) this._set(S.ENGINE_OFF);
        break;
      case S.ENGINE_OFF:
        if (this.t === 0) { /* entry handled in _set */ }
        if (this.t > TUNE.engineOffToLightsOff) this._set(S.LIGHTS_OFF);
        break;
      case S.LIGHTS_OFF:
        this._lightsOn(false);
        this._set(S.PARKED);
        break;
      case S.PARKED:
        if (!this.collider) this._attachCollider();
        if (this.onParked) { const f = this.onParked; this.onParked = null; f(this); }
        this._set(S.WAITING);
        break;
      case S.WAITING:
        break;
      case S.DEPARTING:
        this._target(TUNE.forecourt);
        if (this.leg >= this.path.length - 2) this._set(S.LEAVING);
        break;
      case S.LEAVING:
        this._target(TUNE.cruise);
        if (this.group.position.distanceTo(this.path[this.path.length - 1]) < 6 ||
            Math.abs(this.group.position.x) > TUNE.leaveTo - 8) {
          this._set(S.DISPOSING);
        }
        break;
      case S.DISPOSING:
        this.dispose();
        break;
      default: break;
    }

    // engine note follows speed
    if (this.engine) {
      const want = 0.62 + (this.speed / TUNE.cruise) * 0.5;
      this.engine.rate = want;
      this._engineUpdate();
    }
    this.motion?.update(dt);
  }

  _drive(dt) {
    if (!this.path || this.leg >= this.path.length - 1) return;
    const target = this.path[this.leg + 1];
    const pos = this.group.position;
    const to = new THREE.Vector3().subVectors(target, pos);
    to.y = 0;
    const dist = to.length();
    if (dist < Math.max(0.35, this.speed * dt * 1.6)) {
      this.leg++;
      return;
    }
    to.normalize();
    pos.addScaledVector(to, this.speed * dt);
    // heading follows motion, eased, so the turn looks driven not snapped
    const want = Math.atan2(to.x, to.z);
    let diff = want - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = dt * (1.1 + this.speed * 0.06);
    this.group.rotation.y += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);
    this.turnDemand = diff;
  }

  _target(v) {
    const rate = v < this.speed ? TUNE.decel : TUNE.accel;
    const dt = this.frameDt || 1 / 60;
    this.speed += THREE.MathUtils.clamp(v - this.speed, -rate * dt, rate * dt);
  }

  _distanceToLeg(i) {
    const p = this.path[Math.min(i, this.path.length - 1)];
    return this.group.position.distanceTo(p);
  }

  _faceAlong(next) {
    const to = new THREE.Vector3().subVectors(next, this.group.position);
    this.group.rotation.y = Math.atan2(to.x, to.z);
  }

  _brake(on) {
    for (const m of this.brakeMats) m.color.setHex(on ? 0xd8321e : 0x40100c);
  }

  _lightsOn(on) {
    for (const l of this.lights) {
      l.lamp.intensity = on && l.on ? l.base : 0;
    }
    if (this.lampFaces) {
      for (const f of this.lampFaces) {
        f.face.material.color.setHex(f.dead ? 0x2a2a26 : (on ? 0xfff6e2 : 0x3a3833));
      }
    }
    this.lit = on;
  }

  // ——— audio ————————————————————————————————————————————————————
  _engineStart() {
    const truck = this._isTruck();
    this.engine = { slot: truck ? "veh_truck_idle" : "veh_car_idle", rate: 0.7, node: null };
    this._engineUpdate(true);
  }

  _engineUpdate(start) {
    const a = this.g.audio;
    if (!a.ready || !this.engine) return;
    if (start || !this.engine.node) {
      this.engine.node = a.loop
        ? a.loop(this.engine.slot, { vol: 0.30, pos: this.group.position, ref: 6, rolloff: 1.3 })
        : a.play(this.engine.slot, { vol: 0.30, pos: this.group.position, ref: 6, loop: true });
    }
    if (this.engine.node && this.engine.node.setPosition) {
      this.engine.node.setPosition(this.group.position);
    }
    if (this.engine.node && this.engine.node.rate) this.engine.node.rate(this.engine.rate);
  }

  _engineStop(silent = false) {
    if (!this.engine) return;
    const n = this.engine.node;
    if (n && n.stop) n.stop(silent ? 0 : 0.35);
    this.engine.node = null;this.engine=null;
    if(!silent)this.g.audio.play("veh_car_leave", { vol: 0.22, pos: this.group.position.clone(), ref: 6 });
  }

  // ——— colliders ————————————————————————————————————————————————
  _attachCollider() {
    const b = new THREE.Box3().setFromObject(this.group);
    this.collider = {
      x0: b.min.x + 0.12, x1: b.max.x - 0.12,
      z0: b.min.z + 0.12, z1: b.max.z - 0.12,
      y1: b.max.y, label: "vehicle:" + this.group.name,
    };
    this.g.station.colliders.push(this.collider);
  }

  _dropCollider() {
    if (!this.collider) return;
    const i = this.g.station.colliders.indexOf(this.collider);
    if (i >= 0) this.g.station.colliders.splice(i, 1);
    this.collider = null;
  }

  // ——— transitions ——————————————————————————————————————————————
  _set(next) {
    if (this.state === next) return;
    this.state = next;
    this.t = 0;
    if (next === S.ENGINE_OFF) this._engineStop();
    if (next === S.DEPARTING) {
      // it stops being a wall the instant it starts moving
      this._dropCollider();
      this._lightsOn(true);
      this._engineStart();
      this.path = routeOut(this.bay);
      this.leg = 0;
      this.speed = 0.4;
    }
    this.g.bus?.emit?.("vehicle:" + next.toLowerCase(), this);
  }

  /** The occupant is out and gone; leave when the story says so. */
  depart() {
    if (this.dead || this.state === S.DISPOSING || this.state === S.DONE) return;
    this.motion?.door(false);
    this._set(S.DEPARTING);
  }

  /** Hard abort from any state — night end, power cut, save load. */
  dispose() {
    if (this.dead) return;
    this.dead = true;
    this._dropCollider();
    this._engineStop(true);
    for (const l of this.lights) {
      l.lamp.intensity = 0;
      l.lamp.parent?.remove(l.lamp);
      l.lamp.dispose?.();
    }
    this.lights.length = 0;
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
      }
    });
    this.group.parent?.remove(this.group);
    this.state = S.DONE;
    if (this.onGone) { const f = this.onGone; this.onGone = null; f(this); }
  }
}

/**
 * Owns every live vehicle. One update, one teardown, one place to look when a
 * car is somewhere it should not be.
 */
export class VehicleDirector {
  constructor(game) {
    this.g = game;
    this.list = [];
    this._seed = 41972;
  }

  rand() {
    this._seed = (this._seed * 1664525 + 1013904223) % 4294967296;
    return this._seed / 4294967296;
  }

  /** Bring a vehicle in. Resolves when it is parked, engine and lights off. */
  async arrive(def, bay, opts = {}) {
    const v = new Vehicle(this, def, bay, opts);
    this.list.push(v);
    const parked = new Promise((res) => {
      v.onParked = () => res(v);
      const gone=v.onGone;v.onGone=()=>{res(v);gone?.(v);};
    });
    await v.spawn();
    if (v.dead) return v;
    // shadow budget: at most one vehicle casts, and never on low
    this.setShadowBudget();
    await parked;
    return v;
  }

  setShadowBudget() {
    const allow = settings.quality === "high" ? 1 : 0;
    let given = 0;
    for (const v of this.list) {
      for (const l of v.lights) {
        l.lamp.castShadow = given < allow && v.lit;
      }
      if (v.lit) given++;
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      v.update(dt);
      if (v.state === S.DONE) this.list.splice(i, 1);
    }
  }

  /** Everything gone, immediately — night boundaries and loads. */
  clearAll() {
    for (const v of this.list.slice()) v.dispose();
    this.list.length = 0;
  }

  get count() { return this.list.length; }
}
