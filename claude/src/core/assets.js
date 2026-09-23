// THE NIGHT COUNT — asset loading, caching, and the material unifier.
//
// Everything that arrives from a different source (photoscanned Poly Haven
// props, low-poly poly.pizza vehicles, the Quaternius character rig) is passed
// through `unify()`, which strips PBR response and rebuilds each material as a
// flat Lambert surface with a single 256px diffuse map. That is the second
// half of the art direction (the first half being the composite pass).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skinClone } from "three/addons/utils/SkeletonUtils.js";

const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

const gltfCache = new Map();
const texCache = new Map();

export const MODEL = {
  // Every model below is authored in the project's own Blender scene and
  // exported from it. Nothing here was downloaded any more.
  //
  //   source   ~/Downloads/Blender Projects/night-count/night-count.blend
  //   builders                            .../night-count/src/props_*.py
  //   sizes                      tools/scaleaudit.js, which measures them
  //
  // Authoring rules live in the header of src/nc_kit.py. The two that reach
  // into this file: a model stands on y = 0 at its real size in metres, and
  // its FRONT faces +Z, which is what every `rot:` in props.js turns from.

  // ——— the building itself ————————————————————————————————————————
  map:           "assets/models_blender/map.glb",

  // ——— the counter and the shop floor ———————————————————————————————
  register:      "assets/models_blender/register.glb",
  shelf:         "assets/models_blender/shelf.glb",
  fluoro:        "assets/models_blender/fluoro.glb",
  ceilingfan:    "assets/models_blender/ceilingfan.glb",
  trashcan:      "assets/models_blender/trashcan.glb",
  trashbag:      "assets/models_blender/trashbag.glb",
  notepads:      "assets/models_blender/notepads.glb",
  binder:        "assets/models_blender/binder.glb",
  wallclock:     "assets/models_blender/wallclock.glb",
  stool:         "assets/models_blender/stool.glb",
  flashlight:    "assets/models_blender/flashlight.glb",
  coffeemachine: "assets/models_blender/coffeemachine.glb",
  extinguisher:  "assets/models_blender/extinguisher.glb",
  firealarm:     "assets/models_blender/firealarm.glb",

  // ——— stock ————————————————————————————————————————————————————
  cigpack:       "assets/models_blender/cigpack.glb",
  cans:          "assets/models_blender/cans.glb",
  longlife:      "assets/models_blender/longlife.glb",
  gallon:        "assets/models_blender/gallon.glb",
  cleaner:       "assets/models_blender/cleaner.glb",
  bleach:        "assets/models_blender/bleach.glb",
  cleaner2:      "assets/models_blender/cleaner2.glb",
  oiltin:        "assets/models_blender/oiltin.glb",
  snack:         "assets/models_blender/snack.glb",
  sodacan:       "assets/models_blender/sodacan.glb",
  chips:         "assets/models_blender/chips.glb",

  // ——— the office and the stock room ————————————————————————————————
  desk:          "assets/models_blender/desk.glb",
  cabinet:       "assets/models_blender/cabinet.glb",
  monitor:       "assets/models_blender/monitor.glb",
  boombox:       "assets/models_blender/boombox.glb",
  alarmclock:    "assets/models_blender/alarmclock.glb",
  cardbox:       "assets/models_blender/cardbox.glb",
  crate1:        "assets/models_blender/crate1.glb",
  crate2:        "assets/models_blender/crate2.glb",
  pallet:        "assets/models_blender/pallet.glb",
  handtruck:     "assets/models_blender/handtruck.glb",
  ladder:        "assets/models_blender/ladder.glb",
  toolbox:       "assets/models_blender/toolbox.glb",
  wrench:        "assets/models_blender/wrench.glb",
  broom:         "assets/models_blender/broom.glb",
  bucket:        "assets/models_blender/bucket.glb",
  mop:           "assets/models_blender/mop.glb",
  wetfloor:      "assets/models_blender/wetfloor.glb",

  // ——— shop fittings and printed things (props_fixtures.py) ————————
  gondola:       "assets/models_blender/gondola.glb",
  endcap_snack:  "assets/models_blender/endcap_snack.glb",
  endcap_oil:    "assets/models_blender/endcap_oil.glb",
  aislesign1:    "assets/models_blender/aislesign1.glb",
  aislesign2:    "assets/models_blender/aislesign2.glb",
  aislesign3:    "assets/models_blender/aislesign3.glb",
  fascia:        "assets/models_blender/fascia.glb",
  poster1:       "assets/models_blender/poster1.glb",
  poster2:       "assets/models_blender/poster2.glb",
  poster3:       "assets/models_blender/poster3.glb",

  // ——— the back of the building (props_rooms.py) ———————————————————
  toilet:        "assets/models_blender/toilet.glb",
  sink:          "assets/models_blender/sink.glb",
  mirror:        "assets/models_blender/mirror.glb",
  towels:        "assets/models_blender/towels.glb",
  grabbar:       "assets/models_blender/grabbar.glb",
  stockrack_a:   "assets/models_blender/stockrack_a.glb",
  stockrack_b:   "assets/models_blender/stockrack_b.glb",
  coolerdoor:    "assets/models_blender/coolerdoor.glb",

  // ——— past the forecourt (props_land.py) ————————————————————————————
  ridges:        "assets/models_blender/ridges.glb",
  juniper:       "assets/models_blender/juniper.glb",
  billboard:     "assets/models_blender/billboard.glb",
  delineator:    "assets/models_blender/delineator.glb",

  // ——— wall hardware ————————————————————————————————————————————
  camera1:       "assets/models_blender/camera1.glb",
  camera2:       "assets/models_blender/camera2.glb",
  powerbox:      "assets/models_blender/powerbox.glb",
  utilbox:       "assets/models_blender/utilbox.glb",

  // ——— the forecourt and the lot ————————————————————————————————
  pump:          "assets/models_blender/pump.glb",
  payphone:      "assets/models_blender/payphone.glb",
  roadsign:      "assets/models_blender/roadsign.glb",
  streetlight:   "assets/models_blender/streetlight.glb",
  utilpole:      "assets/models_blender/utilpole.glb",
  cone:          "assets/models_blender/cone.glb",
  dumpster:      "assets/models_blender/dumpster.glb",
  propane:       "assets/models_blender/propane.glb",
  barrel:        "assets/models_blender/barrel.glb",
  barrel3:       "assets/models_blender/barrel3.glb",
  jerrycan:      "assets/models_blender/jerrycan.glb",
  manhole:       "assets/models_blender/manhole.glb",
  bush:          "assets/models_blender/bush.glb",
  rock:          "assets/models_blender/rock.glb",

  // ——— vehicles ————————————————————————————————————————————————
  // Built NOSE AT -X. vehicles.js turns any model whose long axis is X by
  // ninety degrees, which lands that nose on the local +Z its headlights
  // hang off; built the other way round, every customer reverses in.
  car_sedan:     "assets/models_blender/car_sedan.glb",
  car_pickup:    "assets/models_blender/car_pickup.glb",
  truck_semi:    "assets/models_blender/truck_semi.glb",
  tanker:        "assets/models_blender/tanker.glb",
  coveredcar:    "assets/models_blender/coveredcar.glb",

  // ——— gore, as geometry rather than a red rectangle ————————————————
  gore_pool_big:   "assets/models_blender/gore_pool_big.glb",
  gore_pool_small: "assets/models_blender/gore_pool_small.glb",
  gore_spatter:    "assets/models_blender/gore_spatter.glb",
  gore_smear:      "assets/models_blender/gore_smear.glb",
  gore_drips:      "assets/models_blender/gore_drips.glb",

  // ——— the character ——————————————————————————————————————————————
  // The Quaternius mannequin and its skeleton (CC0), taken through Blender:
  // the seventeen library clips the game plays, plus thirteen performances
  // authored for it there (char_clips.py) — the Attendant's stillness and its
  // head turn, mopping, restocking, the cold, the payphone, the kerb, the
  // cigarette. One file, one armature: clips authored on a re-imported
  // skeleton only land right on that skeleton. tools/charcheck.js proves the
  // library clips still land within a millimetre of the original file.
  human:         "assets/characters/nc_character.glb",
};

export const TEX = {
  // ambientCG (CC0) where it beats the original set — the restroom, the
  // ceiling grid, the sales floor, the walls and the road all read better
  asphalt: "assets/tex/acg_road_worn.jpg",
  lino: "assets/tex/acg_shop_floor.jpg",
  tiles: "assets/tex/acg_bathroom_tile.jpg",
  tilesWall: "assets/tex/acg_bathroom_wall.jpg",
  wall: "assets/tex/acg_paint_wall.jpg",
  wallOld: "assets/tex/acg_wall_old.jpg",
  ceiling: "assets/tex/acg_ceiling_tile.jpg",
  ceilingStain: "assets/tex/acg_ceiling_stain.jpg",
  roadline: "assets/tex/acg_road_line.jpg",
  counterLam: "assets/tex/acg_counter_lam.jpg",
  shelfMetal: "assets/tex/acg_metal_shelf.jpg",
  cardboard: "assets/tex/acg_cardboard.jpg",
  kerb: "assets/tex/acg_kerb_concrete.jpg",
  exwall: "assets/tex/brushed_concrete.jpg",
  apron: "assets/tex/dirty_concrete.jpg",
  backfloor: "assets/tex/concrete_floor_painted.jpg",
  corrugated: "assets/tex/corrugated_iron.jpg",
  corrugated_rust: "assets/tex/rusty_corrugated_iron.jpg",
  shutter: "assets/tex/painted_metal_shutter.jpg",
  plate: "assets/tex/metal_plate.jpg",
  rustmetal: "assets/tex/rusty_metal_04.jpg",
  ground: "assets/tex/dry_ground_01.jpg",
  dirt: "assets/tex/acg_dirt_verge.jpg",
  gravel: "assets/tex/acg_lot_gravel.jpg",
  corrugated2: "assets/tex/acg_corrugated.jpg",
  rustPanel: "assets/tex/acg_rust_panel.jpg",
};

/** Generated original art, by slot name in assets/gen/index.json. */
export const ART = {
  bootPlate: "boot_plate",
  logo: "meridian_logo",
  signFace: "sign_face",
  snackLabels: "snack_labels",
  sodaLabels: "soda_labels",
  notice: "notice_blank",
  missingPoster: "missing_poster",
  oilStain: "oil_stain",
  cigPack: "cig_pack_face",
  stationPhoto: "station_photo",
};

let onProgress = () => {};
export const setLoadProgress = (fn) => { onProgress = fn; };

/**
 * Generated art, if any. `tools/fetch_gemini.py` writes assets/gen/index.json;
 * when a generated texture exists for a surface it silently replaces the stock
 * CC0 one, so the art pass needs no code change and the game is complete
 * either way.
 */
const GEN_FOR = {
  "assets/tex/dirty_tiles.jpg": "bathroom_tile",
  "assets/tex/ceiling_interior.jpg": "ceiling_tile",
  "assets/tex/asphalt_04.jpg": "asphalt_oil",
  "assets/tex/dry_ground_01.jpg": "desert_ground",
};
let genIndex = {};

export async function loadGenerated() {
  try {
    const r = await fetch("assets/gen/index.json", { cache: "no-store" });
    if (!r.ok) return {};
    genIndex = await r.json();
    const n = Object.keys(genIndex).length;
    if (n) console.info("[assets] using %d generated texture(s)", n);
  } catch (e) { genIndex = {}; }
  return genIndex;
}

/**
 * A generated-art path, ready to put in an `<img src>` or a CSS `url()`.
 *
 * It has to be resolved here rather than at the call site. In the single-file
 * build every asset lives in a packed archive behind an object URL, and the
 * two redirects that make that invisible — the patched `fetch` and three's
 * `setURLModifier` — only cover code that goes through fetch or a three
 * loader. The DOM does neither: a portrait is an `<img>` and the boot plate is
 * a CSS background, so both asked the *server* for `assets/gen/…` and got a
 * 404. In the dev build they resolved fine, which is exactly why it survived
 * this long — it was only ever broken in the build people actually play.
 */
export const generated = (name) => {
  const p = genIndex[name] || null;
  return p && window.__NCRESOLVE ? window.__NCRESOLVE(p) : p;
};
const resolve = (path) => {
  const g = GEN_FOR[path];
  return (g && genIndex[g]) ? genIndex[g] : path;
};

export function tex(path, { repeat = [1, 1], flipY = true, nearest = false } = {}) {
  path = resolve(path);
  const key = path + "|" + repeat.join(",") + "|" + nearest;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = flipY;
  t.anisotropy = 1;
  if (nearest) { t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; }
  texCache.set(key, t);
  return t;
}

/** Flat lambert surface material — the only material type in the game. */
export function surface(path, { repeat = [1, 1], color = 0xffffff, opts = {} } = {}) {
  return new THREE.MeshLambertMaterial({
    map: path ? tex(path, { repeat }) : null,
    color, ...opts,
  });
}

export function unlit(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

/**
 * What each Blender material wears, by name: [texture, metres per tile, mode].
 *
 * The props are built untextured and exported with world-metre UVs; the
 * surface comes from here, one shared 256px image per material, instead of
 * seventy .glb files each embedding their own copy of the same scuffs.
 * (tools/make_prop_textures.py makes the images.)
 *
 * "detail" maps are grey and bright-centred, so they add wear to the palette
 * colour without changing it — the extinguisher stays its authored red.
 * "albedo" maps are the surface itself, and the colour goes to white.
 */
/** Every glowing decal material made so far — power.js dims them. */
export const LIT_DECALS = new Set();

const PROP_TEX = {
  NC_p_red: ["prop_wear", 0.9], NC_p_green: ["prop_wear", 0.9], NC_p_blue: ["prop_wear", 0.9],
  NC_p_amber: ["prop_wear", 0.9], NC_p_yellow: ["prop_wear", 0.9], NC_p_orange: ["prop_wear", 0.9],
  NC_p_white: ["prop_wear", 0.9], NC_p_pale: ["prop_wear", 0.9], NC_p_grey: ["prop_wear", 0.9],
  NC_p_dark: ["prop_wear", 0.9], NC_p_stone: ["prop_wear", 1.4], NC_p_sage: ["prop_grain", 0.35],
  NC_pump_enamel: ["prop_wear", 0.9], NC_pump_amber: ["prop_wear", 0.9], NC_pump_dark: ["prop_wear", 0.9],
  NC_car_paint: ["prop_wear", 1.8], NC_car_dark: ["prop_wear", 1.2],
  NC_p_steel: ["prop_metal", 0.6], NC_pump_steel: ["prop_metal", 0.6],
  NC_p_wood: ["prop_grain", 0.5],
  NC_p_rubber: ["prop_rubber", 0.3], NC_car_tyre: ["prop_rubber", 0.3],
  NC_p_paper: ["prop_paper", 0.3], NC_p_tarp: ["prop_tarp", 0.35],
  NC_fx_body: ["prop_wear", 0.9], NC_fx_regbody: ["prop_wear", 0.6], NC_fx_green: ["prop_wear", 0.9],
  NC_fx_upright: ["prop_metal", 0.6], NC_fx_peg: ["prop_peg", 0.4], NC_fx_porcelain: ["prop_wear", 0.9],
  NC_p_card: ["prop_card", 0.45, "albedo"],
  NC_p_rust: ["prop_rust", 0.7, "albedo"],
  NC_p_conc: ["prop_conc", 1.2, "albedo"],
};

/**
 * Convert whatever came out of a glTF into the game's flat look and set
 * sensible shadow flags. Keeps the diffuse map, drops normal/rough/metal/env.
 */
export function unify(root, { shadows = true, brighten = 1.0, emissiveNames = [] } = {}) {
  root.traverse((o) => {
    if (o.isLight) { o.parent?.remove(o); return; }
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = shadows;
    o.receiveShadow = shadows;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      if (!m) return new THREE.MeshLambertMaterial({ color: 0x888888 });
      const map = m.map || null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 1;
      }
      const col = new THREE.Color(m.color ? m.color : 0xffffff).multiplyScalar(brighten);
      const isGlass = (m.name || "").toLowerCase().includes("glass") ||
        (m.transparent && m.opacity < 0.9);
      const lm = new THREE.MeshLambertMaterial({
        map, color: col,
        transparent: isGlass || m.transparent === true,
        opacity: isGlass ? 0.28 : (m.opacity ?? 1),
        side: m.side ?? THREE.FrontSide,
        alphaTest: m.alphaTest || (m.transparent && !isGlass ? 0.5 : 0),
        vertexColors: !!m.vertexColors,
        name: m.name || "",
      });
      // Printed things: NC_decal_<x> wears assets/tex/decal_<x> across each
      // face (Blender fits those UVs per face). glTF's convention, so flipY
      // off, or every word reads upside down. A trailing _lit glows — a sign
      // with a tube behind it, a register's readout — and is listed in
      // LIT_DECALS so the power system can put it out with the lights.
      const dm = !map && /^NC_decal_(.+?)(_lit)?$/.exec(m.name || "");
      if (dm && o.geometry?.attributes?.uv) {
        lm.map = tex("assets/tex/decal_" + dm[1] + ".jpg", { flipY: false });
        lm.color.set(0xffffff);
        if (dm[2]) {
          lm.emissive = new THREE.Color(0xffffff);
          lm.emissiveMap = lm.map;
          lm.emissiveIntensity = 0.9;
          LIT_DECALS.add(lm);
        }
      }
      // the Blender props' surface, by material name — only where the mesh
      // actually has UVs, or the map samples one texel and paints it solid
      const pt = !map && !dm && PROP_TEX[m.name];
      if (pt && o.geometry?.attributes?.uv) {
        const rep = 1 / pt[1];
        lm.map = tex("assets/tex/" + pt[0] + ".jpg", { repeat: [rep, rep] });
        if (pt[2] === "albedo") lm.color.set(0xffffff);
      }
      if (emissiveNames.some((n) => (m.name || "").includes(n))) {
        lm.emissive = new THREE.Color(0xffffff);
        lm.emissiveIntensity = 1;
      }
      m.dispose?.();
      return lm;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return root;
}

export async function loadGLTF(path) {
  if (gltfCache.has(path)) return gltfCache.get(path);
  const p = new Promise((res, rej) => {
    gltfLoader.load(path, (g) => res(g), undefined, (e) => {
      console.warn("[assets] failed", path, e);
      rej(e);
    });
  });
  gltfCache.set(path, p);
  return p;
}

/**
 * Load a model and return a fresh, unified instance.
 * Missing assets degrade to a labelled grey box rather than breaking the game.
 */
/**
 * Load a model.
 *
 * `pick` / `drop` exist because several downloaded assets are not one object:
 * Poly Haven's metal_trash_can is two bins plus four loose handles laid out side
 * by side, and poly.pizza's payphone sits on a 72 m display turntable. Fitting
 * those by height explodes the footprint, because the bounding box is being set
 * by something that is not the object. Selecting the subtree first is the fix —
 * see docs/ASSET_MANIFEST.md.
 *
 *   pick: /Bin_A/     keep only matching child subtrees
 *   drop: /Sphere001/ remove matching child subtrees
 */
export async function model(key, opts = {}) {
  const path = MODEL[key] || key;
  try {
    const g = await loadGLTF(path);
    const inst = opts.skinned ? skinClone(g.scene) : g.scene.clone(true);
    if (opts.pick || opts.drop) selectParts(inst, opts.pick, opts.drop);
    unify(inst, opts);
    if (opts.animations) return { object: inst, animations: g.animations };
    return inst;
  } catch (e) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x6b6b6b })
    );
    box.name = "MISSING:" + key;
    return opts.animations ? { object: box, animations: [] } : box;
  }
}

/** Scale a model so its bounding box has the given height (metres). */
/**
 * Keep or remove child subtrees by name. Applied before fitting, so the
 * bounding box reflects the object we actually want.
 */
export function selectParts(root, pick, drop) {
  const match = (re, name) => {
    if (!re) return false;
    return re instanceof RegExp ? re.test(name) : String(name).includes(re);
  };
  const doomed = [];
  root.traverse((o) => {
    if (o === root || !o.name) return;
    if (drop && match(drop, o.name)) { doomed.push(o); return; }
    if (pick) {
      // keep a node if it, or any ancestor, matches — so picking a group keeps
      // its meshes, and picking a mesh keeps that mesh alone
      let p = o, keep = false;
      while (p && p !== root) { if (match(pick, p.name)) { keep = true; break; } p = p.parent; }
      if (!keep && o.isMesh) doomed.push(o);
    }
  });
  for (const o of doomed) o.parent?.remove(o);
  return root;
}

export function fitHeight(obj, height, { center = true, ground = true } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  if (size.y > 1e-5) {
    const s = height / size.y;
    obj.scale.multiplyScalar(s);
  }
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3(); b2.getCenter(c);
  if (center) { obj.position.x -= c.x; obj.position.z -= c.z; }
  if (ground) obj.position.y -= b2.min.y;
  return obj;
}

/** Scale so the longest horizontal dimension matches `width`. */
export function fitWidth(obj, width, { ground = true, center = true } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const d = Math.max(size.x, size.z);
  if (d > 1e-5) obj.scale.multiplyScalar(width / d);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3(); b2.getCenter(c);
  if (center) { obj.position.x -= c.x; obj.position.z -= c.z; }
  if (ground) obj.position.y -= b2.min.y;
  return obj;
}

export async function preload(keys, label = "loading") {
  let done = 0;
  await Promise.all(keys.map(async (k) => {
    try { await loadGLTF(MODEL[k] || k); } catch (e) { /* handled in model() */ }
    done++;
    onProgress(done / keys.length, label);
  }));
}
