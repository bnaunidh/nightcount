// THE NIGHT COUNT — look-at interaction. Registrations are plain objects so
// systems can add/remove hotspots without touching the scene graph.
import * as THREE from "three";
import { inputBus, actionDown } from "./input.js";
import { settings } from "./settings.js";

/**
 * The task marker: an amber diamond drawn once to a small canvas and shared.
 *
 * It used to be a rotating wireframe cube with depth testing off, which is
 * what a debug helper looks like — side by side with the other edition it
 * read as a bug, not a signpost. A flat diamond at constant screen size reads
 * as the game pointing, and it stays legible at 640x360.
 */
let _markTex = null;
function markTexture() {
  if (_markTex) return _markTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const dia = (r) => { g.beginPath(); g.moveTo(32, 32 - r); g.lineTo(32 + r, 32);
    g.lineTo(32, 32 + r); g.lineTo(32 - r, 32); g.closePath(); };
  g.lineJoin = "round";
  dia(24); g.lineWidth = 10; g.strokeStyle = "rgba(10,8,4,0.55)"; g.stroke();   // halo for contrast
  dia(24); g.lineWidth = 5; g.strokeStyle = "#f0b845"; g.stroke();
  dia(9);  g.fillStyle = "#ffd98a"; g.fill();
  _markTex = new THREE.CanvasTexture(c);
  _markTex.colorSpace = THREE.SRGBColorSpace;
  _markTex.magFilter = THREE.LinearFilter;
  return _markTex;
}

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
    if (!this.scene) return;
    if (!spot || !settings.showOutlines) { this._hideOutline(); return; }
    // Throttled hard. This is a recursive raycast against the whole scene —
    // nine hundred objects — and the hotspot under the reticle can change
    // several times a second while walking, which was enough to halve the
    // frame budget on its own. Twice a second is invisible to a player and
    // costs nothing.
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - (this._lastCast || 0) < 140) { this._followOutline(); return; }
    this._lastCast = now;
    this._ray.setFromCamera({ x: 0, y: 0 }, this.cam);
    const hits = this._ray.intersectObjects(this.scene.children, true);
    let mesh = null;
    for (const h of hits) {
      const o = h.object;
      if (!o.isMesh || !o.visible || o.userData.noOutline) continue;
      if (o.name && o.name.startsWith("salt_")) continue;     // a line on the floor
      mesh = o; break;
    }
    if (!mesh) { this._hideOutline(); return; }
    if (this._outlineFor === mesh) { this._syncOutline(mesh); return; }
    this._outlineFor = mesh;
    let edges = this._edgeCache.get(mesh.geometry.uuid);
    if (!edges) {
      edges = new THREE.EdgesGeometry(mesh.geometry, 28);
      this._edgeCache.set(mesh.geometry.uuid, edges);
    }
    this._hideOutline();
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62,
        depthTest: false, depthWrite: false })
    );
    this.outline.renderOrder = 9;
    this.outline.userData.noOutline = true;
    this.scene.add(this.outline);
    this._syncOutline(mesh);
  }

  _syncOutline(mesh) {
    if (!this.outline) return;
    mesh.updateWorldMatrix(true, false);
    this.outline.matrix.copy(mesh.matrixWorld);
    this.outline.matrixAutoUpdate = false;
    this.outline.matrixWorldNeedsUpdate = true;
  }

  _hideOutline() {
    if (this.outline) { this.outline.parent?.remove(this.outline); this.outline.material.dispose(); }
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
      call: ["callaunt"], folders: ["n5cabinet"], plan: ["floorplan"],
      bathunlock: ["bathunlock"], bathsalt: ["bathsalt"], getout: ["runcar"],
    };
    const want = new Set();
    for (const t of tasks) {
      if (t.done || t.hidden) continue;
      const m = MAP[t.id];
      for (const id of (typeof m === "function" ? m() : m) || []) want.add(id);
    }
    const key = [...want].sort().join(",");
    if (key === this._markKey) { this._syncMarkers(); return; }
    this._markKey = key;
    this._clearMarkers();
    if (!this.scene || !settings.taskMarkers) return;
    this._markers = [];
    for (const id of want) {
      const s = this.get(id);
      if (!s) continue;
      let on = true;
      try { on = s.enabled(); } catch (e) { on = false; }
      if (!on) continue;
      const p = this.posOf(s);
      if (!p) continue;
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: markTexture(), transparent: true, opacity: 0.8,
        depthTest: false, depthWrite: false, sizeAttenuation: false,
      }));
      m.scale.set(0.042, 0.042, 1);
      m.position.copy(p);
      m.userData.base = p.y;
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
      m.visible = true;
      m.position.copy(p);
      // it floats a hand's width above the thing, and breathes, slowly
      const t = performance.now() / 1000 + (m.id % 7);
      m.position.y += 0.34 + Math.sin(t * 1.7) * 0.03;
      const d = m.position.distanceTo(eye);
      // Gone when you are standing at it — you have arrived. Clearest from
      // across a room, and receding from further out, or from the road the
      // five meter-reading diamonds were the brightest things in the desert.
      const near = Math.min(1, Math.max(0, (d - 1.4) * 0.6));
      const far = d < 18 ? 1 : Math.max(0.3, 1 - (d - 18) / 30);
      m.material.opacity = 0.85 * near * far;
      const sc = 0.042 * (1 + Math.sin(t * 3.1) * 0.06);
      m.scale.set(sc, sc, 1);
    }
  }

  _clearMarkers() {
    for (const m of this._markers || []) {
      m.parent?.remove(m);
      m.material.dispose();         // the texture is shared; it stays
    }
    this._markers = null;
  }

  get(id) { return this.spots.find((s) => s.id === id); }
  clear() { this.spots.length = 0; this.current = null; }

  /** Called every frame from update() so the outline tracks moving objects. */
  _followOutline() {
    if (this.outline && this._outlineFor) this._syncOutline(this._outlineFor);
  }

  posOf(s) {
    const p = typeof s.pos === "function" ? s.pos() : s.pos;
    return p;
  }

  update(dt) {
    if (!this.enabled || this.player.frozen) {
      if (this.current) { this.current = null; this.ui.setPrompt(null); }
      this._hideOutline();
      return;
    }
    const eye = this.cam.position;
    const dir = this._v.set(0, 0, -1).applyQuaternion(this.cam.quaternion);
    let best = null, bestScore = -1;
    for (const s of this.spots) {
      if (s.enabled && !s.enabled()) continue;
      const p = this.posOf(s);
      if (!p) continue;
      const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > s.radius) continue;
      let score = 1 - d / s.radius;
      if (s.look) {
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (d || 1e-6);
        if (dot < 0.55) continue;
        score = dot * 0.7 + score * 0.3;
      }
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best !== this.current) {
      this.current = best;
      this.ui.setPrompt(best ? { verb: best.verb, label: best.label } : null);
      this._updateOutline(best);
    } else {
      this._followOutline();
      this.holdT = 0;
    }
    if (settings.holdToInteract && this.current) {
      if (actionDown("interact")) {
        this.holdT += dt;
        this.ui.setHold(Math.min(1, this.holdT / 0.45));
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
