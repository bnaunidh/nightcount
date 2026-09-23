// THE NIGHT COUNT — prop dressing.
//
// Every downloaded model arrives at a different scale and orientation, so
// nothing is placed raw: fitHeight/fitWidth normalise each asset to a real
// world size first. Anything that fails to load degrades to a grey box rather
// than throwing (see assets.model).
import * as THREE from "three";
import { model, fitHeight, fitWidth, surface, unlit, tex, generated, TEX, ART } from "../core/assets.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { L, PUMPS, CIG } from "./station.js";
import { rng } from "../core/util.js";

const R = rng(41972);

async function place(scene, key, { pos, rot = 0, h = null, w = null, scale = null, name = "", shadows = true, merge = false, pick = null, drop = null }) {
  const o = await model(key, { shadows, pick, drop });
  if (h) fitHeight(o, h);
  else if (w) fitWidth(o, w);
  if (scale) o.scale.multiplyScalar(scale);
  // Same guard at the source. `fitHeight` divides by a bounding-box dimension,
  // so a model that measures zero on an axis — a flat decal, a mesh that failed
  // to load — hands back an infinite scale and a NaN origin.
  for (const v of [o.position, o.scale]) {
    if (!Number.isFinite(v.x + v.y + v.z)) {
      console.warn("[props] non-finite transform on", key, "- reset");
      o.position.set(0, 0, 0); o.scale.set(1, 1, 1);
    }
  }
  const g = new THREE.Group();
  g.add(o);
  g.position.copy(pos);
  g.rotation.y = rot;
  g.name = name || key;
  g.userData.merge = merge;
  scene.add(g);
  return g;
}

/**
 * Drop every placed prop onto whatever is actually beneath it.
 *
 * Props are positioned by hand at assumed surface heights — "the desk top is
 * 0.78, the counter is 1.06" — and the moment a downloaded model turns out to
 * be a different size, the thing hovers. This casts a ray down from each prop's
 * base and closes the gap, so the numbers in the placement list stop being
 * load-bearing. Wall-mounted and hanging things are left alone.
 */
const HUNG = new Set([
  "prop_clock", "prop_fan", "prop_firealarm", "prop_extinguisher", "prop_breaker",
  "prop_utilbox", "prop_sign", "prop_signface", "prop_shutter", "prop_pole",
  "prop_streetlight", "prop_seclight", "prop_canopylight",
  "prop_cam1", "prop_cam2", "prop_cam3", "prop_cam4", "prop_cam5", "prop_cam6",
  "extinguisher", "firealarm", "utilbox", "wallclock", "ceilingfan",
  "streetlight", "roadsign", "manhole",
  "prop_wetfloor",
]);
const HUNG_PREFIX = ["fluoro", "decal_", "paper_", "stain_", "light_", "sign_"];
/** Whole-name match. `light` must never eat `flashlight` again (§6.7). */
const isHung = (n) => HUNG.has(n) || HUNG_PREFIX.some((p) => n.startsWith(p));

export function settleProps(scene, station) {
  const ray = new THREE.Raycaster();
  ray.far = 4;
  const meshes = [];
  scene.traverse((m) => { if (m.isMesh) meshes.push(m); });
  const isDesc = (m, root) => { let p = m; while (p) { if (p === root) return true; p = p.parent; } return false; };

  const groups = scene.children.filter(
    (o) => o.type === "Group" && o.name && o.name !== "station" && o.name !== "merged_dressing");
  let moved = 0, orphan = 0;
  const far = [];
  for (const g of groups) {
    if (isHung(g.name)) continue;
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty() || !isFinite(box.min.y)) continue;
    const c = new THREE.Vector3(); box.getCenter(c);
    const support = meshes.filter((m) => !isDesc(m, g));
    ray.set(new THREE.Vector3(c.x, box.min.y + 0.02, c.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(support, false)[0];
    if (!hit) { orphan++; continue; }
    const gap = hit.distance - 0.02;
    // A prop should be resting on something a few centimetres below it. A drop
    // of half a metre means the placement was wrong about *what* it stands on,
    // and settling it would bury it inside that thing instead — so leave it,
    // and say so, rather than quietly making it worse.
    // A non-finite gap must never reach a transform: one NaN in a position
    // propagates to every child matrix and the object silently stops being
    // anywhere. Cheaper to refuse it here than to find it in a scene graph.
    if (!Number.isFinite(gap)) { orphan++; continue; }
    if (gap > 0.015 && gap <= 0.35) { g.position.y -= gap; moved++; }
    else if (gap > 0.35) { far.push(g.name + " +" + gap.toFixed(2)); }
  }
  if (moved || orphan || far.length) {
    console.info("[props] settled %d; %d with nothing beneath; %d too far to settle %o",
      moved, orphan, far.length, far);
  }
  return { moved, orphan, far };
}

/**
 * Fold every static, shadow-less dressing mesh into one merged mesh per
 * material. Hundreds of cans, packets and sagebrush become a handful of draw
 * calls, which is most of the frame budget on integrated graphics — and none
 * of them ever move, so nothing is lost.
 */
export function mergeStatics(scene) {
  const byMat = new Map();
  const doomed = [];
  scene.traverse((g) => {
    if (!g.userData || !g.userData.merge) return;
    doomed.push(g);
    g.updateWorldMatrix(true, true);
    // Merge within a spatial cell, never across the whole level: one giant
    // mesh cannot be frustum-culled, and looking down an aisle would then draw
    // every shelf in the building.
    const cell = Math.floor(g.position.x / 4) + "," + Math.floor(g.position.z / 4);
    g.traverse((m) => {
      if (!m.isMesh || !m.geometry || Array.isArray(m.material)) return;
      const geo = m.geometry.clone();
      // merging needs identical attribute sets
      for (const key of Object.keys(geo.attributes)) {
        if (key !== "position" && key !== "normal" && key !== "uv") geo.deleteAttribute(key);
      }
      if (!geo.attributes.position) return;
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) {
        const n = geo.attributes.position.count;
        geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      m.updateWorldMatrix(true, false);
      geo.applyMatrix4(m.matrixWorld);
      // Every instance owns a *separate* material object (unify rebuilds them
      // per clone) even when the texture and colour are identical, so group by
      // what the material actually is, not by object identity — otherwise every
      // group has one member and nothing merges.
      const mm = m.material;
      const key = [cell, mm.map ? mm.map.uuid : "none", mm.color.getHexString(),
                   mm.transparent ? 1 : 0, mm.side, mm.vertexColors ? 1 : 0].join("|");
      let bucket = byMat.get(key);
      if (!bucket) { bucket = { mat: mm, geos: [] }; byMat.set(key, bucket); }
      bucket.geos.push(geo);
    });
  });
  let merged = 0, before = doomed.length;
  for (const [, bucket] of byMat) {
    const { mat, geos } = bucket;
    if (!geos.length) continue;
    let g = null;
    try { g = mergeGeometries(geos, false); } catch (e) { g = null; }
    for (const x of geos) if (x !== g) x.dispose?.();
    if (!g) continue;
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.name = "merged_dressing";
    scene.add(mesh);
    merged++;
  }
  for (const g of doomed) g.parent?.remove(g);
  console.info("[props] merged %d dressing groups into %d meshes", before, merged);
  return merged;
}

/** Solid things outside that the player should not walk through. */
function solidify(station, x, z, w, d, label) {
  station.colliders.push({
    x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y1: 2.2, label,
  });
}

export async function dressStation(scene, station) {
  const A = station.anchors;
  const P = [];
  const add = (...a) => P.push(place(scene, ...a));

  // ——— counter ————————————————————————————————————————————————
  // Facing the attendant, not the customer. It was turned around: the keys and
  // the display pointed out across the counter at whoever was buying.
  add("register", { pos: new THREE.Vector3(L.REG.x, L.CNT_H, L.REG.z), rot: 0, h: 0.42, name: "prop_register" });
  add("notepads", { pos: new THREE.Vector3(-2.6, L.CNT_H, 2.45), rot: 0.4, w: 0.26, name: "prop_notepads" });
  add("binder", { pos: new THREE.Vector3(-6.6, L.CNT_H, 2.5), rot: -0.3, w: 0.3, name: "prop_binder" });
  add("stool", { pos: new THREE.Vector3(-6.2, 0, 3.6), rot: 0.6, h: 0.66, name: "prop_stool" });
  // on the back bar panel, facing the shop floor, at eye height for the queue
  add("wallclock", { pos: new THREE.Vector3(-4.6, 1.98, 4.20), rot: Math.PI, h: 0.32, name: "prop_clock" });
  // Faced up in the case behind the till, three shelves of them.
  //
  // The heights come from CIG.top(shelf) rather than from six numbers typed by
  // hand: the boards moved when the back bar became a wall, these did not, and
  // every pack in the shop hung between 9 and 15cm above the shelf it was
  // supposed to be standing on. The z comes from the case too — they were on
  // the very front lip of the board, half over the edge.
  for (const [cx, shelf] of [[-3.40, 0], [-3.15, 0], [-2.90, 0],
                             [-5.70, 1], [-5.45, 1], [-4.10, 2]]) {
    add("cigpack", { pos: new THREE.Vector3(cx, CIG.top(shelf), CIG.z),
      rot: 0.1 + R() * 0.2, w: 0.06 });
  }
  add("flashlight", { pos: new THREE.Vector3(-6.85, L.CNT_H, 2.62), rot: 1.2, w: 0.22 });

  // ——— cooler doors: a row of glass across the front of every run ———————
  {
    const zFront = (station.coolerBounds?.z ?? 7.55) - 0.375;
    for (const [sx0, sx1] of station.coolerSegments || []) {
      const n = Math.floor((sx1 - sx0 - 0.12) / 0.74);
      const x0 = (sx0 + sx1) / 2 - (n * 0.74) / 2 + 0.37;
      for (let i = 0; i < n; i++) {
        add("coolerdoor", { pos: new THREE.Vector3(x0 + i * 0.74, 0.12, zFront), rot: Math.PI,
          name: "fixture_coolerdoor" });
      }
    }
  }

  // ——— shop fittings (Blender: props_fixtures.py) ————————————————————
  // Placed exactly where station.js says the runs stand, so the stock laid
  // out below lands on these shelves and nowhere else.
  for (const g of station.gondolas) {
    add("gondola", { pos: new THREE.Vector3(g.x, 0, (g.z0 + g.z1) / 2), rot: 0,
      name: "fixture_gondola" + g.index });
  }
  // end caps face the door (-Z), so they turn half round from the library's +Z
  // (named after the collider each one fills, so the audit knows it is theirs)
  for (const [i, e] of (station.endcaps || []).entries()) {
    add(e.kind === "oil" ? "endcap_oil" : "endcap_snack",
      { pos: new THREE.Vector3(e.x, 0, e.z), rot: Math.PI, name: "fixture_endcap" + i });
  }
  // aisle markers on chains over the head of each aisle, readable from the door
  for (const [n, x] of [[1, 0.6], [2, 3.8], [3, 7.2]]) {
    add("aislesign" + n, { pos: new THREE.Vector3(x, L.CEIL - 0.75, 4.0), rot: 0, name: "sign_aisle" + n });
  }
  // the storefront: a lit fascia over the left-hand glazing, turned to the road,
  // with its back on the front wall's outer face (z = -0.125)
  add("fascia", { pos: new THREE.Vector3(-2.6, 2.45, -0.185), rot: Math.PI, name: "sign_fascia" });
  // posters taped inside the glass, facing out
  for (const [k, x] of [["poster1", -7.6], ["poster2", -5.1], ["poster3", 8.2]]) {
    add(k, { pos: new THREE.Vector3(x, 1.0, 0.03), rot: Math.PI, name: "sign_" + k });
  }

  // ——— sales floor —————————————————————————————————————————————
  add("coffeemachine", { pos: new THREE.Vector3(A.coffee.x, 0.95, A.coffee.z), rot: Math.PI, h: 0.55, name: "prop_coffee" });
  add("trashcan", { pos: new THREE.Vector3(6.35, 0, 2.55), rot: 0, h: 0.75 });
  add("extinguisher", { pos: new THREE.Vector3(-8.80, 0.95, 6.0), rot: Math.PI / 2, h: 0.5 });
  add("firealarm", { pos: new THREE.Vector3(-2.70, 2.05, 7.88), rot: Math.PI, h: 0.16 });

  // counter-height snack shelf at the coffee station
  add("chips", { pos: new THREE.Vector3(8.15, 0.96, 1.2), rot: 0.3, h: 0.24 });
  add("snack", { pos: new THREE.Vector3(7.5, 0.96, 1.0), rot: -0.5, h: 0.2 });

  // ——— gondola stock (procedural but seeded, so shelves stay put) ————
  // Shelf fill is hundreds of objects, so it uses only the light models
  // (150–2800 tris). The heavy photoscans — the gallon jug at 13.7k, the oil
  // can at 16.7k — are placed sparingly as hero props where they can be seen.
  const goods = ["sodacan", "cans", "oiltin", "cigpack"];
  const heroes = ["gallon", "cleaner", "bleach", "cleaner2", "longlife"];
  const heights = { cans: 0.11, longlife: 0.13, gallon: 0.28, cleaner: 0.22, bleach: 0.24, cleaner2: 0.22, oiltin: 0.14, sodacan: 0.12, chips: 0.2, snack: 0.14 };
  station.stockSlots = [];
  for (const g of station.gondolas) {
    for (let s = 0; s < 4; s++) {
      const y = g.shelfY[s];
      // one product line per shelf per side, faced forward, with gaps
      const lineL = goods[Math.floor(R() * goods.length)];
      const lineR = goods[Math.floor(R() * goods.length)];
      // one heavier hero item per shelf, at eye level only
      const heroAt = (s === 2 || s === 3) ? 2 + Math.floor(R() * 6) : -1;
      // one facing every 35 cm from 22 cm in: 8 on a 2.9 m run
      const facings = Math.floor((g.z1 - g.z0 - 0.30) / 0.35) + 1;
      for (let i = 0; i < facings; i++) {
        const z = g.z0 + 0.22 + i * 0.35;
        for (const side of [-1, 1]) {
          let key = side < 0 ? lineL : lineR;
          if (i === heroAt && side > 0) key = heroes[Math.floor(R() * heroes.length)];
          const px = g.x + side * 0.3;
          station.stockSlots.push({ x: px, y, z, key, shelf: s, gondola: g.index, side });
          if (R() < 0.07) continue;                    // a few gaps, not a third
          // SIT ON THE BOARD.
          //
          // The shelf board is 0.04 thick and `addBox` puts its base at `y`,
          // so its top surface is at y + 0.04. Stock was being placed at
          // y + 0.02 — two centimetres *inside* the board — so every can on
          // every shelf was sunk halfway through the shelf it was standing on.
          // That is the "floating and weird" in the screenshot, and it was on
          // every gondola in the shop.
          const TOP = y + 0.041;
          add(key, {
            pos: new THREE.Vector3(px, TOP, z), rot: (side < 0 ? Math.PI : 0) + (R() * 0.16 - 0.08),
            h: heights[key] || 0.15, shadows: false, merge: true,
          });
          // a second row behind the facing row — shelves read as stocked, not
          // as a single line of items with daylight behind them
          if (R() < 0.72) {
            add(key, {
              pos: new THREE.Vector3(px + side * 0.075, TOP, z + 0.03),
              rot: (side < 0 ? Math.PI : 0) + (R() * 0.2 - 0.1),
              h: heights[key] || 0.15, shadows: false, merge: true,
            });
          }
        }
      }
    }
  }

  // ——— cooler contents (behind glass) ——————————————————————————
  // stand the stock on the shelves the cooler now actually has, taking the
  // heights from the station so the two cannot drift apart
  // Faced up inside whatever cooler segments exist, rather than along one
  // hard-coded run — the cabinet is now broken by the walkways to the office
  // and the bathroom, and 26 drinks laid out from x -1.9 put a third of them
  // hanging in the open air of a doorway.
  const coolerY = station.coolerShelfY || [0.52, 0.97, 1.42];
  const coolerZ = station.coolerBounds ? station.coolerBounds.z : 6.9;
  for (const [sx0, sx1] of (station.coolerSegments || [[-2.2, 8.2]])) {
    for (let x = sx0 + 0.3; x < sx1 - 0.25; x += 0.38) {
      for (const y of coolerY.map((v) => v + 0.035)) {
        if (R() < 0.25) continue;
        const ck = R() < 0.62 ? "sodacan" : "cans";
        add(ck, {
          pos: new THREE.Vector3(x, y + 0.041, coolerZ - 0.03 + R() * 0.12),
          rot: R() * 6, h: ck === "sodacan" ? 0.12 : 0.13,
          shadows: false, merge: true,
        });
      }
    }
  }

  // ——— back office ——————————————————————————————————————————————
  add("desk", { pos: new THREE.Vector3(A.office_desk.x, 0, A.office_desk.z), rot: Math.PI, h: 0.78, name: "prop_desk" });
  add("cabinet", { pos: new THREE.Vector3(-8.2, 0, 9.2), rot: Math.PI / 2, h: 1.3, name: "prop_cabinet" });
  // Front edge of the desk, both of them — the monitor bank now stands along
  // the back of it, and these two used to sit in the band it occupies.
  add("boombox", { pos: new THREE.Vector3(A.office_desk.x + 0.58, 0.79, A.office_desk.z - 0.30),
    rot: 2.6, h: 0.24, name: "prop_radio" });
  add("alarmclock", { pos: new THREE.Vector3(A.office_desk.x - 0.52, 0.79, A.office_desk.z - 0.30), rot: 3.4, h: 0.11 });

  // camera bank: four CRTs stacked two-by-two on the desk
  // the desk surface the bank stands on — one number, used by both the
  // monitors and their glowing faces, so they cannot drift apart
  const DESK_TOP = 0.78;
  const bank = new THREE.Group();
  bank.name = "prop_bank";
  for (let i = 0; i < 4; i++) {
    const m = await model("monitor", { shadows: true });
    fitHeight(m, 0.42);
    m.position.set(-0.34 + (i % 2) * 0.68, (i < 2 ? DESK_TOP + 0.44 : DESK_TOP), 0);
    m.rotation.y = Math.PI;
    bank.add(m);
  }
  // No +0.5 nudge any more. The anchor is where the bank goes, so there is one
  // number to get right instead of two that have to agree.
  bank.position.set(A.camera_bank.x, 0, A.camera_bank.z);
  scene.add(bank);
  station.bankGroup = bank;
  // glowing faces so the bank reads as live from across the room
  // The monitors face -z, so the glass is on the -z side of the bank and the
  // glow has to sit just proud of it. This was `+0.34` — measured against the
  // bank's old half-metre offset — so with the bank sitting where its anchor
  // says, the same number put four lit rectangles *behind* the monitors.
  // One constant, derived from the bank's own depth.
  const FACE_Z = A.camera_bank.z - 0.24;
  const faces = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.33), unlit(0x3d4c42));
    f.position.set(A.camera_bank.x - 0.34 + (i % 2) * 0.68,
      (i < 2 ? DESK_TOP + 0.64 : DESK_TOP + 0.20), FACE_Z);
    f.rotation.y = Math.PI;
    faces.add(f);
  }
  scene.add(faces);
  station.bankFaces = faces;

  // ——— stock room —————————————————————————————————————————————
  add("cardbox", { pos: new THREE.Vector3(-1.6, 0, 11.2), rot: 0.3, h: 0.42 });
  add("cardbox", { pos: new THREE.Vector3(-1.58, 0.42, 11.22), rot: -0.2, h: 0.42 });
  add("cardbox", { pos: new THREE.Vector3(2.6, 0, 11.6), rot: 1.1, h: 0.42, name: "prop_restockbox" });
  add("crate1", { pos: new THREE.Vector3(3.4, 0, 10.4), rot: 0.2, h: 0.3 });
  add("crate2", { pos: new THREE.Vector3(3.4, 0.3, 10.4), rot: -0.4, h: 0.3 });
  // on the dock, not half through the rear wall and buried in the dock
  add("pallet", { pos: new THREE.Vector3(3.1, 0.35, 12.95), rot: 0.08, w: 1.2, shadows: false });
  add("handtruck", { pos: new THREE.Vector3(4.0, 0, 12.4), rot: 2.2, h: 1.15 });
  add("ladder", { pos: new THREE.Vector3(-3.2, 0, 12.4), rot: 0.1, h: 1.9 });
  add("toolbox", { pos: new THREE.Vector3(-2.4, 0, 9.0), rot: 0.7, h: 0.22 });
  add("wrench", { pos: new THREE.Vector3(-2.4, 0.23, 9.0), rot: 1.4, w: 0.3 });
  add("broom", { pos: new THREE.Vector3(3.62, 0, 9.15), rot: -0.25, h: 1.35, name: "prop_broom" });
  add("bucket", { pos: new THREE.Vector3(4.30, 0, 8.66), rot: 0, h: 0.32, name: "prop_bucket" });
  // No `pick` any more. It selected a sub-object named Broom out of the
  // downloaded mop; the built one is a single mesh, so the filter matched
  // nothing, fitHeight divided by a zero-sized box, and every frame since
  // has logged "non-finite transform on mop".
  add("mop", { pos: new THREE.Vector3(3.98, 0, 9.05), rot: 0.4, h: 1.38,
    name: "prop_mop" });
  add("wetfloor", { pos: new THREE.Vector3(4.4, 0, 9.4), rot: 1.0, h: 0.6, name: "prop_wetfloor" });
  // rot = PI, not 0. Both of these hang on the rear wall at z = 12 and the
  // built models face +Z like everything else, so at rot 0 the breaker door
  // and the junction-box lid opened into the wall behind them.
  add("powerbox", { pos: new THREE.Vector3(A.breaker.x, 1.15, 11.85), rot: Math.PI, h: 0.62, name: "prop_breaker" });
  add("utilbox", { pos: new THREE.Vector3(A.breaker.x - 0.9, 1.3, 11.80), rot: Math.PI, h: 0.35 });
  // The stock room has stock in it. (The old shelf stood at z 12.5 — outside
  // the rear wall, in the lot, since the office and stock room swapped.)
  add("stockrack_b", { pos: new THREE.Vector3(A.stock_shelf.x, 0, L.BZ1 - 0.355), rot: Math.PI, name: "prop_stockshelf" });
  add("stockrack_a", { pos: new THREE.Vector3(L.BX0 + 0.355, 0, 10.9), rot: Math.PI / 2, name: "prop_stockrack" });

  // ——— bathroom ————————————————————————————————————————————————
  // A highway restroom, fitted out. Everything stays off the rear wall's
  // middle — Jacob stands there facing it on Night 2 — and off the floor
  // between the door and x 7, where the figure stands on Night 4. The sink is
  // where nights.js already plays the tap from.
  const BW = L.BATH_X0 + 0.08, BE = L.BX1 - 0.125, BR = L.BZ1 - 0.125;
  add("toilet", { pos: new THREE.Vector3(BW + 0.26, 0, 10.9), rot: Math.PI / 2, name: "prop_toilet" });
  add("grabbar", { pos: new THREE.Vector3(BW + 0.75, 0.80, BR - 0.01), rot: Math.PI, name: "sign_grabbar" });
  add("sink", { pos: new THREE.Vector3(BE - 0.21, 0, 10.6), rot: -Math.PI / 2, name: "prop_sink" });
  add("mirror", { pos: new THREE.Vector3(BE - 0.027, 1.12, 10.6), rot: -Math.PI / 2, name: "sign_mirror" });
  add("towels", { pos: new THREE.Vector3(BE - 0.062, 1.02, 9.75), rot: -Math.PI / 2, name: "sign_towels" });
  add("trashcan", { pos: new THREE.Vector3(8.4, 0, 9.0), rot: 0.4, h: 0.72 });
  add("cleaner", { pos: new THREE.Vector3(8.5, 0, 11.4), rot: 0.2, h: 0.24 });

  // ——— ceiling fixtures ————————————————————————————————————————
  for (const [x, z] of [[-4.6, 3.2], [0.5, 5.2], [5.6, 5.2], [-6.0, 6.8], [0.6, 10.2], [6.9, 10.0], [-6.2, 10.2]]) {
    add("fluoro", { pos: new THREE.Vector3(x, 2.965, z), rot: Math.abs(x) > 6 ? Math.PI / 2 : 0, w: 1.2, shadows: false });
  }
  add("ceilingfan", { pos: new THREE.Vector3(2.6, 2.62, 2.2), rot: 0, w: 1.0, shadows: false, name: "prop_fan" });
  {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.30, 6),
      surface(TEX.rustmetal, { color: 0x5f5b53 }));
    rod.position.set(2.6, 2.95, 2.2);
    scene.add(rod);
  }

  // ——— security cameras ————————————————————————————————————————
  station.cameraProps = [];
  // x, y, z, yaw, then the bracket vector back to the surface it hangs off.
  // Cameras sit high and in a corner, looking at what their feed actually
  // shows — they used to hover in the middle of rooms with no mount at all.
  const camSpots = [
    [0, 4.32, -4.62, Math.PI, 0, 0.26],       // 1 forecourt — under the canopy edge
    [0, 4.32, -8.60, Math.PI, 0, 0.24],       // 2 pumps — canopy underside
    [8.55, 2.86, 2.10, -2.35, 0.26, 0],       // 3 rear aisle — east wall, looking west
    [-8.55, 2.86, 6.40, 2.35, -0.26, 0],      // 4 cooler alcove — west wall, looking east
    // Behind the partition, not in front of it. Feed 5 stands at z 8.5 and
    // looks to 12.2; the prop sat at 7.86 on the SHOP side with its lens six
    // centimetres off the wall it was pointed at, and the bracket ran through
    // the partition instead of back to it.
    [-1.30, 2.84, 8.16, 0.10, 0, -0.22],      // 5 stock room — partition, looking in
    [1.60, 2.84, 11.72, Math.PI, 0, 0.20],    // 6 exterior rear — rear wall
  ];
  for (let i = 0; i < camSpots.length; i++) {
    const [x, y, z, r, mx, mz] = camSpots[i];
    P.push(place(scene, i % 2 ? "camera2" : "camera1", {
      pos: new THREE.Vector3(x, y, z), rot: r, h: 0.2, name: "prop_cam" + (i + 1),
    }));
    // the bracket back to whatever it is bolted to — mounting hardware under
    // 15 cm, which is the one case primitives are allowed
    if (mx !== undefined) {
      const len = Math.hypot(mx, mz) || 0.18;
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(Math.abs(mx) > Math.abs(mz) ? len : 0.05, 0.05,
                              Math.abs(mz) >= Math.abs(mx) ? len : 0.05),
        surface(TEX.rustmetal, { color: 0x6e6a62 })
      );
      arm.position.set(x + mx / 2, y + 0.02, z + mz / 2);
      arm.castShadow = false;
      scene.add(arm);
    }
  }

  // ——— forecourt ————————————————————————————————————————————————
  for (const p of PUMPS) {
    const gp = await place(scene, "pump", {
      pos: p.pos.clone().setY(0.16), rot: p.rot, h: 1.85, name: "prop_pump" + p.id,
    });
    // you can lean on a fuel pump, not walk through it
    solidify(station, p.pos.x, p.pos.z, 1.5, 0.8, "pump" + p.id);
    // Meridian livery: cream body, green band. Downloaded pumps arrive in
    // whatever colour their author liked; the station has one identity.
    gp.traverse((m) => {
      if (!m.isMesh || !m.material || m.material.map) return;
      const h = m.material.color.getHSL({ h: 0, s: 0, l: 0 });
      m.material.color.setHex(h.l > 0.45 ? 0xd9d2be : (h.s > 0.35 ? 0x2f4c3a : 0x54554e));
    });
  }
  // It stands on its own post beside the front corner — the raycast behind it
  // finds nothing for three metres, so it is not a wall phone — and it faces
  // -X, back towards the pumps and the door, which is the side you walk up
  // from. The `drop` filter went with the downloaded model.
  add("payphone", { pos: A.payphone.clone(), rot: -Math.PI / 2, h: 1.4,
    name: "prop_payphone" });
  add("cone", { pos: new THREE.Vector3(-8.4, 0, -3.2), rot: 0.4, h: 0.5 });
  add("cone", { pos: new THREE.Vector3(-9.2, 0, -3.6), rot: 1.4, h: 0.5 });
  add("streetlight", { pos: new THREE.Vector3(-18, 0, -6), rot: 0.2, h: 7.5, shadows: false });
  add("streetlight", { pos: new THREE.Vector3(19, 0, -8), rot: 3.2, h: 7.5, shadows: false });

  // price sign on its pole
  const sign = await model("roadsign", { shadows: false });
  fitHeight(sign, 4.6);
  sign.position.copy(A.sign);
  sign.rotation.y = Math.PI / 2;
  scene.add(sign);
  station.roadSign = sign;
  const signArt = generated(ART.logo) || generated(ART.signFace);
  // The face is the price board, not the logo: three prices in amber, the
  // way a 1997 pole sign reads from the road. (tools/make_decals.py)
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.9),
    new THREE.MeshBasicMaterial({ map: tex("assets/tex/decal_pricesign.jpg") })
  );
  // 3.65, which is the centre of the board on the built sign — the board runs
  // 2.70 to 4.60 and this plane is 1.9 tall. At 4.6 it floated clear of the
  // top edge, printed on nothing.
  signFace.position.set(A.sign.x + 0.12, 3.65, A.sign.z);
  signFace.rotation.y = Math.PI / 2;
  scene.add(signFace);
  station.signFace = signFace;
  // the same mark, small, on the shopfront glass beside the door
  if (signArt) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: tex(signArt), transparent: true, opacity: 0.85 }));
    decal.position.set(3.2, 1.7, 0.06);
    decal.rotation.y = Math.PI;
    scene.add(decal);
  }

  // ——— paper on the walls, printed rather than typeset ————————————
  const paper = (art, w, h, pos, rotY) => {
    const src = generated(art);
    if (!src) return null;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ map: tex(src, { repeat: [1, 1] }) }));
    m.position.copy(pos);
    m.rotation.y = rotY;
    scene.add(m);
    return m;
  };
  // the missing-person notice by the door — the one Wren never mentions
  paper(ART.missingPoster, 0.42, 0.56, new THREE.Vector3(8.84, 1.7, 3.4), -Math.PI / 2);
  // workplace notices in the back of house
  paper(ART.notice, 0.34, 0.45, new THREE.Vector3(-3.42, 1.7, 10.2), -Math.PI / 2);
  paper(ART.notice, 0.34, 0.45, new THREE.Vector3(4.58, 1.65, 9.4), Math.PI / 2);
  // the framed station photograph over the manager's desk
  paper(ART.stationPhoto, 0.46, 0.46, new THREE.Vector3(-6.4, 1.75, 11.9), Math.PI);

  // ——— the stain the forecourt has had since 1972 ————————————————
  const stainSrc = generated(ART.oilStain);
  if (stainSrc) {
    for (const [x, z, s2] of [[-3.4, -8.2, 1.9], [3.6, -12.6, 1.5], [0.4, -4.6, 1.2]]) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(s2, s2),
        new THREE.MeshLambertMaterial({
          map: tex(stainSrc, { repeat: [1, 1] }), transparent: true,
          opacity: 0.55, depthWrite: false,
        }));
      st.rotation.x = -Math.PI / 2;
      st.position.set(x, 0.02, z);
      scene.add(st);
    }
  }

  // ——— back lot ————————————————————————————————————————————————
  add("dumpster", { pos: A.dumpster.clone(), rot: 0.2, w: 2.2, name: "prop_dumpster" });
  solidify(station, A.dumpster.x, A.dumpster.z, 2.4, 2.3, "dumpster");
  // Fitted by its LONGEST axis rather than its height, and then re-seated.
  // The built pole is 9 m tall and this is a no-op on it; it stays because it
  // is the guard that caught the downloaded pole measuring 37 m deep.
  const pole = await place(scene, "utilpole", { pos: A.pole.clone(), rot: 0, shadows: false, name: "prop_pole" });
  {
    const b = new THREE.Box3().setFromObject(pole);
    const sz = new THREE.Vector3(); b.getSize(sz);
    const longest = Math.max(sz.x, sz.y, sz.z);
    if (longest > 0.01) pole.scale.multiplyScalar(9.0 / longest);
    const b2 = new THREE.Box3().setFromObject(pole);
    pole.position.y -= b2.min.y;
  }
  add("propane", { pos: new THREE.Vector3(-11.6, 0, 14.4), rot: 0.3, h: 1.2 });
  add("propane", { pos: new THREE.Vector3(-12.4, 0, 14.6), rot: 1.3, h: 1.2 });
  add("barrel", { pos: new THREE.Vector3(9.0, 0, 13.4), rot: 0.6, h: 0.9 });
  add("barrel3", { pos: new THREE.Vector3(9.8, 0, 13.0), rot: 1.6, h: 0.9 });
  add("jerrycan", { pos: new THREE.Vector3(8.2, 0, 13.6), rot: 2.6, h: 0.4 });
  add("pallet", { pos: new THREE.Vector3(6.0, 0, 14.2), rot: 0.5, w: 1.2, shadows: false });
  add("manhole", { pos: new THREE.Vector3(-3.0, 0.02, 15.0), rot: 0, w: 0.75, shadows: false });

  // Danny's Nova, under its cover, exactly where it has been since 1989
  const nova = await place(scene, "coveredcar", { pos: A.nova.clone(), rot: 1.35, w: 4.4, name: "prop_nova" });
  station.nova = nova;

  // ——— desert scatter ——————————————————————————————————————————
  for (let i = 0; i < 44; i++) {
    const ang = R() * Math.PI * 2, rad = 26 + R() * 90;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad - 6;
    if (Math.abs(z - L.ROAD_Z) < 6) continue;
    add(R() < 0.62 ? "bush" : "rock", {
      pos: new THREE.Vector3(x, 0, z), rot: R() * 6,
      h: (R() < 0.5 ? 0.7 : 1.1) * (0.7 + R() * 0.8), shadows: false, merge: true,
    });
  }

  await Promise.all(P);
  return station;
}
