// THE NIGHT COUNT — look-at interaction. Registrations are plain objects so
// systems can add/remove hotspots without touching the scene graph.
import * as THREE from "three";
import { inputBus, actionDown } from "./input.js";
import { settings } from "./settings.js";

export class Interactor {
  constructor(camera, player, ui) {
    this.cam = camera;
    // Outline for whatever you are currently able to use. Built from the mesh
    // you are actually looking at rather than from the hotspot's position, so
    // it traces the real object and never floats next to it.
    this.scene = null;
    this.outline = null;
    this._outlineFor = null;
    this._edgeCache = new Map();
    this._ray = new THREE.Raycaster();
    this._ray.far = 4.2;
    this.player = player;
    this.ui = ui;
    this.spots = [];
    this.current = null;
    this.enabled = true;
    this.holdT = 0;
    this._v = new THREE.Vector3();
    inputBus.on("press", (code) => {
      if (code === settings.keys.interact && !settings.holdToInteract) this.activate();
    });
  }

  /**
   * @param {object} spot
   *   {id, pos:Vector3|()=>Vector3, radius, label, verb, onUse, enabled?, look?}
   *   `look` (default true) requires the player to be facing it.
   */
  add(spot) {
    // re-entering a night must not stack duplicate hotspots
    const dup = this.spots.findIndex((s) => s.id === spot.id);
    if (dup >= 0) this.spots.splice(dup, 1);
    spot.radius ??= 1.9;
    spot.verb ??= "Use";
    spot.look ??= true;
    spot.enabled ??= (() => true);
    this.spots.push(spot);
    return () => this.remove(spot.id);
  }

  remove(id) {
    const i = this.spots.findIndex((s) => s.id === id);
    if (i >= 0) this.spots.splice(i, 1);
  }

  /**
   * Trace the thing you can use.
   *
   * A prompt at the bottom of the screen tells you *that* something is usable;
   * it does not tell you **which** object, and in a dark shop full of props at
   * counter height that is a real question. The outline answers it.
   *
   * It is driven off the crosshair raycast, so it outlines the mesh under the
   * reticle — if a hotspot has no visible mesh behind it, nothing lights up,
   * which is also how `__audit()` finds hotspots that cannot be seen.
   */
  _updateOutline(spot) {
    if (!this.scene || !spot || !settings.showOutlines) { this._hideOutline(); return; }
    // The cue belongs to the selected interaction, never a separate mesh ray.
    if (!this.outline) {
      this.outline = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xc49b61, transparent: true, opacity: 0.78,
          depthTest: false, depthWrite: false }));
      this.outline.userData.noOutline = true;
      this.outline.renderOrder = 8;
      this.scene.add(this.outline);
    }
    this._outlineFor = spot;
    this._followOutline();
  }

  _clearSight(spot, point) {
    if (!this.scene || spot.look === false) return true;
    this._sightCache ||= new Map();
    const stamp = performance.now();
    const previous = this._sightCache.get(spot.id);
    if (spot.id && previous && stamp - previous.stamp < 100 && previous.eye.distanceToSquared(this.cam.position) < .0025 && previous.point.distanceToSquared(point) < .0004) return previous.clear;
    const finish = clear => {
      if (spot.id) this._sightCache.set(spot.id, {stamp,eye:this.cam.position.clone(),point:point.clone(),clear});
      return clear;
    };
    const delta = new THREE.Vector3().subVectors(point, this.cam.position);
    const distance = delta.length();
    if (distance < 0.2) return true;
    this._ray.set(this.cam.position, delta.normalize());
    this._ray.far = Math.max(0, distance - 0.2);
    const hits = this._ray.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      const object = hit.object;
      if (!object.isMesh || object.userData.noOutline) continue;
      let hidden = false;
      for (let parent = object; parent; parent = parent.parent) {
        if (!parent.visible || parent === this.cam) { hidden = true; break; }
      }
      if (hidden) continue;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every(material => material.transparent || !material.depthWrite)) continue;
      // A target may sit inside its own prop. Reaching its outer surface is valid.
      const box = new THREE.Box3().setFromObject(object);
      if (box.distanceToPoint(point) < 0.06 && box.getSize(new THREE.Vector3()).length() < 3.5) continue;
      return finish(false);
    }
    return finish(true);
  }

  _hideOutline() {
    if (this.outline) { this.outline.parent?.remove(this.outline); this.outline.material.dispose(); this.outline.geometry.dispose(); }
    this.outline = null;
    this._outlineFor = null;
  }

  /**
   * Which hotspots belong to which job.
   *
   * The task list said "Clean the shop — 0/3" and the player said *"tasks are
   * boring and I don't know how to do them"* — because nothing in the world
   * connected a line of text to an object. Now the objects a live task needs
   * carry a soft amber marker, visible across the room. You can still miss it,
   * and it says nothing about what to do when you get there; it just answers
   * "where".
   */
  markers(tasks, game) {
    const MAP = {
      investigate: ["investigate"], crash_site: ["crash_site"], trail: ["trail"], doppelganger: ["doppelganger"],
      clock_in: ["punch"], note: ["note"], coffee: ["urn"],
      clean: ["bucket", "spill"],
      restock: ["restockbox", "shelfgap0", "shelfgap1", "shelfgap2"],
      readings: ["pump1", "pump2", "pump3", "pump4", "logbook"],
      bathroom: ["bathcheck"], open: ["openstation"],
      // Closing up is two halves — the doors, then the card — and pointing at
      // both at once would send the player to the office while the station is
      // still standing open. It marks whichever half is actually next.
      lockup: () => (game?.chores?.lockedUp ? ["punch"] : ["lockfront"]),
      trash: ["trashbag", "dumpster"],
      cams: ["cambank"], breaker: ["breakers"], pole: ["service"],
      salt: ["salt_front", "salt_rear", "salt_bath", "salt_hall", "salt_stock",
             "salt_office", "salt_cooler", "salt_counter", "salt_canopy"],
      driver_escape: () => game?.delivery?.scare.phase==='defend' ? ["use_cashier_shotgun"] : ["delivery_safety"],
      driver_snack: () => [game?.delivery?.guidance()?.target].filter(Boolean),
      delivery: () => [game?.delivery?.guidance()?.target].filter(Boolean),
      call: ["callaunt"], folders: ["n5cabinet"], plan: ["floorplan"],
      bathunlock: ["bathunlock"], bathsalt: ["bathsalt"], getout: ["runcar"],
    };
    const want = new Set();
    for (const t of tasks) {
      if (t.done || t.hidden) continue;
      const m = t.id.startsWith("serve_") ? ["register"] : MAP[t.id];
      for (const id of (typeof m === "function" ? m() : m) || []) want.add(id);
    }
    // Targets may become usable after the task starts (for example a newly spawned spill).
    // Include availability in the cache so those markers are actually created.
    const live=[...want].filter(id=>{const spot=this.get(id);try{return spot&&spot.enabled()&&this.posOf(spot);}catch{return false;}});
    const key = settings.taskMarkers + ":" + live.sort().join(",");
    if (key === this._markKey) { this._syncMarkers(); return; }
    this._markKey = key;
    this._clearMarkers();
    if (!this.scene || !settings.taskMarkers) return;
    this._markers = [];
    if(!this._taskIcon){const c=document.createElement('canvas');c.width=128;c.height=160;const x=c.getContext('2d');x.fillStyle='#20160ddd';x.beginPath();x.roundRect(23,7,82,112,21);x.fill();x.strokeStyle='#ff991c';x.lineWidth=5;x.stroke();x.fillStyle='#ff991c';x.font='bold 104px sans-serif';x.textAlign='center';x.fillText('!',64,101);x.beginPath();x.moveTo(51,130);x.lineTo(77,130);x.lineTo(64,148);x.fill();this._taskIcon=new THREE.CanvasTexture(c);this._taskIcon.colorSpace=THREE.SRGBColorSpace;}

    for (const id of want) {
      const s = this.get(id);
      if (!s) continue;
      let on = true;
      try { on = s.enabled(); } catch (e) { on = false; }
      if (!on) continue;
      const p = this.posOf(s);
      if (!p) continue;
      const m=new THREE.Sprite(new THREE.SpriteMaterial({map:this._taskIcon,transparent:true,depthTest:false,depthWrite:false}));
      m.scale.set(.30,.375,1);m.raycast=()=>{};
      m.position.copy(p);
      m.renderOrder = 8;
      m.userData.noOutline = true;
      m.userData.spotId = id;
      this.scene.add(m);
      this._markers.push(m);
    }
  }

  /** Markers follow anything that moves, and fade when you are on top of them. */
  _syncMarkers() {
    if (!this._markers) return;
    const eye = this.cam.position;
    for (const m of this._markers) {
      const s = this.get(m.userData.spotId);
      if (!s) { m.visible = false; continue; }
      let on = true;
      try { on = s.enabled(); } catch (e) { on = false; }
      const p = this.posOf(s);
      if (!on || !p) { m.visible = false; continue; }
      m.visible = this._clearSight(s, p) && p.distanceTo(eye) < 48;
      m.position.copy(p).add(new THREE.Vector3(0,.46,0));
      const d = m.position.distanceTo(eye);
      m.material.opacity = d < 1.6 ? .65 : 1;
      const size=Math.max(.30,Math.min(.75,d*.035));m.scale.set(size,size*1.25,1);
    }
  }

  _clearMarkers() {
    for (const m of this._markers || []) {
      m.parent?.remove(m);
      m.geometry?.dispose();
      m.material.dispose();
    }
    this._markers = null;
  }

  get(id) { return this.spots.find((s) => s.id === id); }
  clear() { this.spots.length = 0; this.current = null; }

  /** Called every frame from update() so the outline tracks moving objects. */
  _followOutline() {
    if (this.outline && this._outlineFor) {
      const point = this._outlineFor._aimPoint || this.posOf(this._outlineFor);
      if (point) this.outline.position.copy(point);
    }
  }

  posOf(s) {
    const p = typeof s.pos === "function" ? s.pos() : s.pos;
    return p;
  }

  aimPoint(s, eye, dir) {
    const targets = typeof s.targets === "function" ? s.targets() : s.targets;
    if (!targets && !s.bounds) return this.posOf(s);
    const ray = new THREE.Ray(eye, dir);
    let best = null, distance = Infinity;
    for (const target of targets || [s.bounds]) {
      let hit;
      if (target.isBox3) hit = ray.intersectBox(target, new THREE.Vector3());
      else {
        target.updateWorldMatrix(true, false);
        const bounds = target.userData.interactionBounds;
        if (!bounds) continue;
        const local = ray.clone().applyMatrix4(target.matrixWorld.clone().invert());
        hit = local.intersectBox(bounds, new THREE.Vector3());
        if (hit) target.localToWorld(hit);
      }
      if (hit && eye.distanceToSquared(hit) < distance) { best = hit; distance = eye.distanceToSquared(hit); }
    }
    return best;
  }

  update(dt) {
    if (!this.enabled || this.player.frozen) {
      if (this.current) { this.current = null; this._promptKey = null; this.holdT = 0; this.ui.setPrompt(null); this.ui.setHold(0); }
      this._hideOutline();
      return;
    }
    const eye = this.cam.position;
    const dir = this._v.set(0, 0, -1).applyQuaternion(this.cam.quaternion);
    let best = null, bestScore = -Infinity;
    for (const s of this.spots) {
      if (s.enabled && !s.enabled()) continue;
      if (s.bounds && s.bounds.distanceToPoint(eye) > s.radius) continue;
      const p = this.aimPoint(s, eye, dir);
      s._aimPoint = p;
      if (!p) continue;
      const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > s.radius) continue;
      let score = 1 - d / s.radius;
      if (s.look) {
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (d || 1e-6);
        if (dot < (s.aimCos ?? 0.93)) continue;
        score = dot * 0.7 + score * 0.3;
      }
      score += s.priority || 0;
      if (score > bestScore && this._clearSight(s, p)) { bestScore = score; best = s; }
    }
    if (best !== this.current) {
      this.current = best;
      this.holdT = 0;
      this.ui.setHold(0);
      this._updateOutline(best);
    } else {
      this._followOutline();
    }
    const resolve = value => typeof value === "function" ? value() : value;
    const prompt = best ? {verb: resolve(best.verb), label: resolve(best.label)} : null;
    const key = JSON.stringify(prompt);
    if (key !== this._promptKey) { this._promptKey = key; this.ui.setPrompt(prompt); }
    if (settings.holdToInteract && this.current) {
      if (actionDown("interact")) {
        this.holdT += dt;
        this.ui.setHold(Math.max(0, Math.min(1, this.holdT / 0.45)));
        if (this.holdT >= 0.45) { this.holdT = -999; this.activate(); }
      } else { this.holdT = 0; this.ui.setHold(0); }
    }
  }

  activate() {
    const s = this.current;
    if (!s || !this.enabled || this.player.frozen) return;
    if (s.enabled && !s.enabled()) return;
    try { s.onUse?.(s); } catch (e) { console.error("[interact]", s.id, e); }
  }
}
