function mulHex(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

// THE NIGHT COUNT — Station 41 level geometry.
//
// Metres. +X east, +Z north (into the building), -Z is the forecourt and the
// road. Interior floor is y=0, ceiling 3.1. The building shell, counter, aisle
// gondolas, cooler run, back rooms and forecourt are built here as level
// geometry; individual props are placed by props.js.
import * as THREE from "three";
import { surface, unlit, tex, TEX } from "../core/assets.js";

export const L = {
  // building shell
  BX0: -9, BX1: 9, BZ0: 0, BZ1: 12, CEIL: 3.1, WALL: 0.25,
  // sales floor / back partition
  PARTZ: 8,
  // The back rooms swapped: the office is now the room behind the counter
  // (which is where an office belongs — you can see the till from it) and
  // the old office at the far end became the stock room, which is the one
  // you want furthest from the customer.
  DOOR_OFFICE: 1.0, DOOR_STOCK: -7.0, DOOR_BATH: 7.0,
  OFFICE_X1: -3.5, BATH_X0: 4.5,
  // front entry
  ENTRY_X0: 4.0, ENTRY_X1: 6.2,
  // counter
  CNT_X0: -7.2, CNT_X1: -2.0, CNT_Z0: 2.0, CNT_Z1: 2.9, CNT_H: 1.06,
  REG: new THREE.Vector3(-4.6, 1.06, 2.45),
  // work positions
  BEHIND: new THREE.Vector3(-4.6, 0, 3.5),
  CUSTOMER: new THREE.Vector3(-4.6, 0, 1.45),
  // forecourt
  CANOPY_Z: -9, CANOPY_Y: 4.6, CANOPY_HX: 8.5, CANOPY_HZ: 4.8,
  ROAD_Z: -25,
  // back lot
  LOT_Z1: 26,
};

export const PUMPS = [
  { id: 1, pos: new THREE.Vector3(-3.4, 0, -6.6), rot: 0 },
  { id: 2, pos: new THREE.Vector3(3.4, 0, -6.6), rot: 0 },
  { id: 3, pos: new THREE.Vector3(-3.4, 0, -11.4), rot: Math.PI },
  { id: 4, pos: new THREE.Vector3(3.4, 0, -11.4), rot: Math.PI },
];

/**
 * The cigarette case behind the till.
 *
 * Shared with props.js so the packs and the boards they stand on cannot drift
 * apart. `addBox` puts a box's BASE at the y it is given, so a shelf's usable
 * surface is `shelfY + board` — the packs were placed at hand-picked heights
 * that pre-dated the boards and every one of them floated between 9 and 15cm
 * above the shelf it was supposed to be sitting on.
 */
export const CIG = {
  shelfY: [1.06, 1.38, 1.70],
  board: 0.035,
  z: null,                              // filled in when the case is built
  /** The surface of shelf `i`, which is where a pack's base goes. */
  top(i) { return this.shelfY[i] + this.board; },
};

/** Vehicle bays: where an arriving car parks, and which way it faces. */
export const BAYS = [
  // Parked NOSE-IN along the island, so the vehicle sits beside its pump
  // rather than on top of it. The old bays put a 5.4 m pickup straight through
  // the pump at (3.4, -6.6). `pump` is which pump this bay serves; `side` is
  // which flank the filler is on.
  { id: 1, pos: new THREE.Vector3(-5.9, 0, -5.55), rot: 0, pump: 1, side: -1 },
  { id: 2, pos: new THREE.Vector3(5.9, 0, -5.55), rot: 0, pump: 2, side: 1 },
  { id: 3, pos: new THREE.Vector3(-5.9, 0, -12.45), rot: Math.PI, pump: 3, side: -1 },
  { id: 4, pos: new THREE.Vector3(5.9, 0, -12.45), rot: Math.PI, pump: 4, side: 1 },
  // outfield — cars that are parked, not people walking in
  { id: 5, pos: new THREE.Vector3(-13.5, 0, -3.0), rot: 0 },
  { id: 6, pos: new THREE.Vector3(13.0, 0, -3.0), rot: 0 },
];

/**
 * The building is modelled in Blender now; this file still owns where it is.
 *
 * `station.js` produces four things the rest of the game depends on — the
 * collider list, the doors, the anchors and the lights — and only one of them
 * is visual. So the numbers stay here, `addBox` keeps recording colliders from
 * them, and the MESHES come from `map.glb`, which a Blender script generated
 * from these same numbers (`layout.json`). One source of truth, two consumers:
 * the geometry cannot drift away from the collision, which is the failure this
 * whole project keeps having.
 *
 * Flip this to `false` and the old procedural boxes come straight back.
 */
const MAP_FROM_BLENDER = true;

/** Things that must stay real meshes because something animates or recolours
 *  them: the door leaves swing, the cooler glow is switched by the power
 *  system, the shutter moves. */
const NEVER_FROM_MAP = new Set(["shutter", "signface", "roadline"]);

/** Which of the game's own textured materials each map material stands for. */
const MAP_MATERIAL = {
  MAP_lino: "lino", MAP_backfloor: "backfloor", MAP_tiles: "tiles",
  MAP_wall: "wall", MAP_ceil: "ceil", MAP_exwall: "exwall", MAP_apron: "apron",
  MAP_asphalt: "asphalt", MAP_ground: "ground", MAP_gravel: "gravel",
  MAP_metal: "shelfMetal", MAP_glass: "glass", MAP_counter: "counter",
  MAP_countertop: "counterTop", MAP_dark: "dark", MAP_trim: "counterTop",
};

export class Station {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "station";
    this.colliders = [];      // {x0,z0,x1,z1,label}
    this.doors = new Map();   // name -> {collider, open:bool}
    this.lights = {};
    this.anchors = {};
    this.materials = {};
    this._build();
  }

  // ————————————————————————————————————————————————— helpers
  addBox(w, h, d, mat, x, y, z, { collide = true, label = "", rotY = 0, shadow = true } = {}) {
    // With the map coming from Blender, these calls still define WHERE the
    // building is — they just stop drawing it. The collider, the label and the
    // return value are unchanged, so every caller works exactly as before and
    // `MAP_FROM_BLENDER` can be flipped back in one line if the glTF is wrong.
    let m = null;
    if (!MAP_FROM_BLENDER || NEVER_FROM_MAP.has(label)) {
      m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h / 2, z);
      m.rotation.y = rotY;
      m.castShadow = shadow; m.receiveShadow = true;
      m.name = label;
      this.group.add(m);
    } else {
      // a stand-in so callers that keep the handle (doors, the cooler glow,
      // the shutter) still have an object to hold
      m = new THREE.Object3D();
      m.position.set(x, y + h / 2, z);
      m.name = label;
      m.visible = false;
      this.group.add(m);
    }
    if (collide) {
      // AABB in world XZ (rotations are axis-aligned in this level)
      const hw = Math.abs(Math.cos(rotY)) * w / 2 + Math.abs(Math.sin(rotY)) * d / 2;
      const hd = Math.abs(Math.cos(rotY)) * d / 2 + Math.abs(Math.sin(rotY)) * w / 2;
      this.colliders.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, label, y1: y + h });
    }
    return m;
  }

  addPlane(w, d, mat, x, y, z, rotX = -Math.PI / 2) {
    if (MAP_FROM_BLENDER) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.visible = false;
      this.group.add(o);
      return o;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = rotX;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  // ————————————————————————————————————————————————— build
  _build() {
    const M = this.materials;
    M.lino = surface(TEX.lino, { repeat: [7, 5], color: 0x9fa096 });
    M.backfloor = surface(TEX.backfloor, { repeat: [4, 2] });
    M.tiles = surface(TEX.tiles, { repeat: [4, 3] });
    M.wall = surface(TEX.wall, { repeat: [6, 1.2] });
    M.wallShort = surface(TEX.wall, { repeat: [2, 1.2] });
    M.ceil = surface(TEX.ceiling, { repeat: [10, 7], color: 0xc9c6bb });
    M.exwall = surface(TEX.exwall, { repeat: [5, 1.4] });
    M.apron = surface(TEX.apron, { repeat: [8, 4] });
    M.asphalt = surface(TEX.asphalt, { repeat: [14, 12] });
    M.ground = surface(TEX.ground, { repeat: [40, 40] });
    M.gravel = surface(TEX.gravel, { repeat: [10, 8] });
    M.metal = surface(TEX.plate, { repeat: [2, 2] });
    M.rust = surface(TEX.rustmetal, { repeat: [2, 2] });
    M.corr = surface(TEX.corrugated, { repeat: [6, 2] });
    M.glass = new THREE.MeshLambertMaterial({
      map: tex("assets/tex/nc/MAP_glass.png"), color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
    });
    M.counter = surface(TEX.plate, { repeat: [3, 1], color: 0xa8a49b });
    M.counterTop = surface(TEX.apron, { repeat: [3, 1], color: 0xb9b4a6 });
    M.shelfMetal = surface("assets/tex/nc/MAP_metal.png");
    M.dark = surface("assets/tex/nc/MAP_dark.png",{color:0xa4afa5});
    // Give vertical shelf faces the same neutral steel finish as their boards.
    M.shelfMetal.side=THREE.DoubleSide;
    M.shelfMetal.emissive.setHex(0x080a08);M.shelfMetal.emissiveIntensity=.22;

    // Materials the map itself wears. Its UVs are in METRES, so every repeat
    // is 1 and the tiling comes from the geometry rather than from a guess
    // about how big each surface happens to be.
    M.mapLino = surface(TEX.lino, { repeat: [1, 1], color: 0x9fa096 });
    M.mapBackfloor = surface(TEX.backfloor, { repeat: [1, 1] });
    M.mapTiles = surface(TEX.tiles, { repeat: [1, 1] });
    M.mapWall = surface(TEX.wall, { repeat: [1, 1] });
    M.mapCeil = surface(TEX.ceiling, { repeat: [1, 1], color: 0xc9c6bb });
    M.mapExwall = surface(TEX.exwall, { repeat: [1, 1] });
    M.mapApron = surface(TEX.apron, { repeat: [1, 1] });
    M.mapAsphalt = surface(TEX.asphalt, { repeat: [1, 1] });
    M.mapGround = surface(TEX.ground, { repeat: [1, 1] });
    M.mapGravel = surface(TEX.gravel, { repeat: [1, 1] });

    this._loadMap();
    this._ground();
    this._shell();
    this._interiorWalls();
    this._counter();
    this._aisles();
    this._cooler();
    this._forecourt();
    this._backLot();
    this._lights();
    this._anchors();
  }

  /**
   * The building, as one glTF.
   *
   * Built by a Blender script from `layout.json`, which is these same `L`
   * constants — so the walls you see and the walls you bump into are two
   * readings of one number rather than two numbers that have to agree.
   *
   * Loaded asynchronously and dropped into the group when it lands. The
   * station is constructed synchronously and nothing reads its meshes, only
   * `colliders`, `doors`, `anchors` and `lights`, all of which exist
   * immediately.
   */
  _loadMap() {
    if (!MAP_FROM_BLENDER) { this.mapReady = Promise.resolve(null); return; }
    const M = this.materials;
    const SWAP = {
      MAP_lino: M.mapLino, MAP_backfloor: M.mapBackfloor, MAP_tiles: M.mapTiles,
      MAP_wall: M.mapWall, MAP_ceil: M.mapCeil, MAP_exwall: M.mapExwall,
      MAP_apron: M.mapApron, MAP_asphalt: M.mapAsphalt, MAP_ground: M.mapGround,
      MAP_gravel: M.mapGravel, MAP_metal: M.shelfMetal, MAP_glass: M.glass,
      MAP_counter: M.counter, MAP_countertop: M.counterTop, MAP_dark: M.dark,
      MAP_trim: M.counterTop,
    };
    this.mapReady = import("../core/assets.js")
      .then(({ model }) => model("map", { shadows: true }))
      .then((o) => {
        let swapped = 0, missed = [];
        o.traverse((m) => {
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          const out = mats.map((mm) => {
            const rep = SWAP[mm?.name];
            if (rep) { swapped++; return rep; }
            if (mm?.name) missed.push(mm.name);
            return mm;
          });
          m.material = Array.isArray(m.material) ? out : out[0];
          m.receiveShadow = true;
          m.castShadow = out.some(material => !material.transparent);
        });
        o.name = "map";
        this.group.add(o);
        this.mapObject = o;
        if (missed.length) console.warn("[map] no material for", [...new Set(missed)]);
        console.info("[map] loaded, %d material slots re-skinned", swapped);
        return o;
      })
      .catch((e) => { console.error("[map] failed to load", e); return null; });
  }

  _ground() {
    const M = this.materials;
    // desert plate
    this.addPlane(400, 400, M.ground, 0, -0.02, 0);
    // forecourt asphalt
    this.addPlane(46, 30, M.asphalt, 0, 0.0, -12);
    // apron in front of the doors
    this.addPlane(20, 3.2, M.apron, 0, 0.012, -1.4);
    // back lot gravel
    this.addPlane(34, 16, M.gravel, 0, 0.0, 19);
    // road
    const road = this.addPlane(300, 9, surface(TEX.asphalt, { repeat: [60, 2] }), 0, 0.005, L.ROAD_Z);
    road.name = "road";
    this.road = road;
    // painted line
    const line = this.addPlane(300, 0.16, unlit(0xb8b39a), 0, 0.02, L.ROAD_Z);
    line.name = "roadline";
  }

  _shell() {
    const M = this.materials, W = L.WALL, H = L.CEIL;
    // floors
    this.addPlane(L.BX1 - L.BX0, L.PARTZ, M.lino, 0, 0.01, L.PARTZ / 2);
    this.addPlane(L.BX1 - L.BX0, 4, M.backfloor, 0, 0.01, 10);
    // ceiling
    const ceil = this.addPlane(L.BX1 - L.BX0, L.BZ1 - L.BZ0, M.ceil, 0, H, 6, Math.PI / 2);
    ceil.receiveShadow = false;
    // exterior roof slab
    this.addBox(19, 0.4, 13, M.exwall, 0, H, 6, { collide: false, label: "roof" });

    // Front elevation: knee wall, glazing, header, mullions. The player has to
    // be able to read the forecourt from behind the register — the window is
    // the game's other monitor.
    const runs = [[L.BX0, L.ENTRY_X0 - 0.12], [L.ENTRY_X1 + 0.12, L.BX1]];
    const SILL = 0.62, HEAD = 2.42;
    for (const [a, b] of runs) {
      const w = b - a, cx = (a + b) / 2;
      this.addBox(w, SILL, W, M.exwall, cx, 0, 0, { label: "front-knee" });
      this.addBox(w, H - HEAD, W, M.exwall, cx, HEAD, 0, { collide: false, label: "front-head" });
      // an invisible full-height collider so glass is not a doorway
      this.colliders.push({ x0: a, x1: b, z0: -W / 2, z1: W / 2, label: "front-glass", y1: H });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, HEAD - SILL, 0.05), M.glass);
      glass.position.set(cx, (SILL + HEAD) / 2, 0);
      this.group.add(glass);
      // mullions every ~2.4m
      const n = Math.max(1, Math.round(w / 2.4));
      for (let i = 1; i < n; i++) {
        this.addBox(0.11, HEAD - SILL, W * 0.9, M.metal, a + (w * i) / n, SILL, 0,
          { collide: false, label: "mullion" });
      }
    }
    this.windowGlass = null;
    // door frame + leaf
    this.addBox(0.18, H, W, M.metal, L.ENTRY_X0 - 0.1, 0, 0, { label: "jamb-w" });
    this.addBox(0.18, H, W, M.metal, L.ENTRY_X1 + 0.1, 0, 0, { label: "jamb-e" });
    this.addBox(2.2, H - 2.2, W, M.exwall, 5.1, 2.2, -W / 2, { collide: false, label: "entry-header" });
    this.addBox(2.2, 0.075, 0.28, M.metal, 5.1, 2.2, 0, { collide: false, label: "entry-frame-head" });
    const leaf = this._doorLeaf(4.55, 0, 1.08, 0x8f9895,
      { glazed: true, hingeX: 4.01, handleSide: -1, baseY: 0.012 });
    const rightLeaf = this._doorLeaf(5.65, 0, 1.08, 0x8f9895,
      { glazed: true, hingeX: 6.19, handleSide: -1, baseY: 0.012 });
    rightLeaf.name = "entrydoor-right";
    leaf.name = "entrydoor";
    this.entryDoor = leaf;
    this._registerDoor("entry", {
      x0: L.ENTRY_X0, x1: L.ENTRY_X1, z0: -0.15, z1: 0.15,
      mesh: leaf, openRot: -Math.PI / 2.1, pivotX: L.ENTRY_X0,
      secondary: { mesh: rightLeaf, pivot: rightLeaf.userData.pivot, openRot: Math.PI / 2.1 },
    }, false);

    // side + rear walls
    this.addBox(W, H, L.BZ1 - L.BZ0, M.exwall, L.BX0, 0, 6, { label: "wall-w" });
    this.addBox(W, H, L.BZ1 - L.BZ0, M.exwall, L.BX1, 0, 6, { label: "wall-e" });
    // rear wall with a service door at x=0
    const rearZ = L.BZ1 + W / 2;
    this.addBox(9 - 0.7, H, W, M.exwall, -4.85, 0, rearZ, { label: "rear-w" });
    this.addBox(9 - 0.7, H, W, M.exwall, 4.85, 0, rearZ, { label: "rear-e" });
    // Close the wall above the service opening. Frame trim sits outside the
    // 1.4 m clear width so it cannot narrow the walking route.
    this.addBox(1.4, H - 2.2, W, M.exwall, 0, 2.2, rearZ, { collide: false, label: "rear-header" });
    for (const x of [-0.7375, 0.7375]) {
      this.addBox(0.075, 2.2, 0.32, M.shelfMetal, x, 0, rearZ, { collide: false, label: "rear-jamb" });
    }
    this.addBox(1.55, 0.075, 0.32, M.shelfMetal, 0, 2.2, rearZ, { collide: false, label: "rear-frame-head" });
    const rear = this._doorLeaf(0, rearZ, 1.38, 0x6a6259, { hingeX: -0.69, baseY: 0.012 });
    rear.name = "reardoor";
    this._registerDoor("rear", {
      x0: -0.7, x1: 0.7, z0: rearZ - 0.15, z1: rearZ + 0.15,
      mesh: rear, openRot: -Math.PI / 2.2, pivotX: -0.7,
    }, true);
  }

  _interiorWalls() {
    const M = this.materials, W = 0.16, H = L.CEIL, Z = L.PARTZ;
    // Built from the doorways sorted by x rather than from a hand-written
    // order. The two back rooms swapped over, which inverted two of these
    // ranges — b became smaller than a — and the back wall would have come out
    // with holes in it. Sorting means the layout can move again safely.
    const doors = [
      { x: L.DOOR_OFFICE, half: 0.55 },
      { x: L.DOOR_STOCK, half: 0.7 },
      { x: L.DOOR_BATH, half: 0.5 },
    ].sort((p, q) => p.x - q.x);
    const segs = [];
    let cursor = L.BX0;
    for (const d of doors) {
      segs.push([cursor, d.x - d.half]);
      cursor = d.x + d.half;
    }
    segs.push([cursor, L.BX1]);
    for (let [a, b] of segs) {
      a = Math.max(a, L.BX0 + L.WALL / 2);
      b = Math.min(b, L.BX1 - L.WALL / 2);
      if (b - a <= 0.05) continue;
      this.addBox(b - a, H, W, M.wall, (a + b) / 2, 0, Z, { label: "partition" });
    }
    // header beams over the openings so the wall reads as continuous
    for (const [c, w] of [[L.DOOR_OFFICE, 1.1], [L.DOOR_STOCK, 1.4], [L.DOOR_BATH, 1.0]]) {
      this.addBox(w, 0.9, W, M.wall, c, 2.2, Z, { collide: false, label: "header" });
    }
    // office / stock / bathroom dividers
    this.addBox(W, H, 3.9, M.wall, L.OFFICE_X1, 0, 9.95, { label: "div-office" });
    this.addBox(W, H, 3.9, M.wall, L.BATH_X0, 0, 9.95, { label: "div-bath" });
    // bathroom inner finish
    this.addPlane(4.5, 4, M.tiles, 6.75, 0.012, 10);

    this._registerDoor("office", {
      x0: L.DOOR_OFFICE - 0.55, x1: L.DOOR_OFFICE + 0.55, z0: Z - 0.12, z1: Z + 0.12,
      mesh: this._doorLeaf(L.DOOR_OFFICE, Z, 1.08, 0x6d6b64, { baseY: 0.012 }), openRot: -Math.PI / 2.1,
      pivotX: L.DOOR_OFFICE - 0.55,
    }, true);
    this._registerDoor("stock", {
      x0: L.DOOR_STOCK - 0.7, x1: L.DOOR_STOCK + 0.7, z0: Z - 0.12, z1: Z + 0.12,
      mesh: this._doorLeaf(L.DOOR_STOCK, Z, 1.38, 0x626e61, { baseY: 0.012 }),
      openRot: Math.PI / 2.1, pivotX: L.DOOR_STOCK - 0.69,
    }, true);
    this._registerDoor("bath", {
      x0: L.DOOR_BATH - 0.5, x1: L.DOOR_BATH + 0.5, z0: Z - 0.12, z1: Z + 0.12,
      mesh: this._doorLeaf(L.DOOR_BATH, Z, 0.98, 0x7a746a, { baseY: 0.012 }), openRot: -Math.PI / 2.1,
      pivotX: L.DOOR_BATH - 0.5,
    }, true);
  }

  /**
   * A door that looks like a door: stiles, rails, a glazed or panelled centre,
   * a push bar or a lever handle — hung in a pivot group at the hinge edge so
   * it swings from its edge instead of spinning about its middle.
   */
  _doorLeaf(x, z, w, color, opts = {}) {
    const { glazed = false, hingeX = null, handleSide = 1, baseY = 0 } = opts;
    const H = 2.15, T = 0.055;
    const hinge = hingeX === null ? x - w / 2 : hingeX;
    const pivot = new THREE.Group();
    pivot.position.set(hinge, baseY, z);

    const frameMat = surface("assets/tex/nc/fabric_detail.png", { color });
    const leaf = new THREE.Group();
    leaf.position.set(x - hinge, 0, 0);
    leaf.userData.interactionBounds = new THREE.Box3(new THREE.Vector3(-w/2-.035, 0, -.075), new THREE.Vector3(w/2+.035, H, .075));

    const bar = (bw, bh, bx, by, bz = 0, mat = frameMat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, T), mat);
      m.position.set(bx, by, bz);
      m.castShadow = true;
      leaf.add(m);
      return m;
    };
    const st = Math.min(0.12, w * 0.16);           // stile width
    bar(st, H, -w / 2 + st / 2, H / 2);            // hinge stile
    bar(st, H, w / 2 - st / 2, H / 2);             // lock stile
    bar(w, 0.16, 0, H - 0.08);                     // top rail
    bar(w, 0.28, 0, 0.14);                         // bottom rail

    if (glazed) {
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(w - st * 1.9, H - 0.32),
        new THREE.MeshLambertMaterial({
          color: 0x121a1c, transparent: true, opacity: 0.34,
          depthWrite: false, side: THREE.DoubleSide,
        }));
      glass.position.set(0, H / 2, 0);
      leaf.add(glass);
      // push bar across the glass, the way every shopfront door has
      const push = new THREE.Mesh(new THREE.BoxGeometry(w - st * 2.4, 0.05, 0.05),
        surface(TEX.shelfMetal, { color: 0xb9b4a4 }));
      push.position.set(0, 1.02, T * handleSide);
      leaf.add(push);
    } else {
      bar(w - st * 2, 0.14, 0, 1.16);              // mid rail
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(w - st * 1.9, H - 0.32, T * 0.6),
        surface("assets/tex/nc/fabric_detail.png", { color: mulHex(color, 0.88) }));
      panel.position.set(0, H / 2, 0);
      leaf.add(panel);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.03),
        surface(TEX.shelfMetal, { color: 0xa39c8c }));
      lever.position.set(w / 2 - 0.2, 1.02, T * handleSide);
      leaf.add(lever);
    }

    pivot.add(leaf);
    this.group.add(pivot);
    leaf.userData.pivot = pivot;
    leaf.position.y = 0;
    return leaf;
  }

  _registerDoor(name, def, closed) {
    const col = { x0: def.x0, x1: def.x1, z0: def.z0, z1: def.z1, label: "door:" + name };
    const d = { name, def, open: !closed, collider: col, locked: false, t: closed ? 0 : 1,
                pivot: def.mesh?.userData?.pivot || null, target: closed ? 0 : 1 };
    if (closed) this.colliders.push(col);
    // apply the starting angle once, or a door that begins open renders shut
    const pivot = d.pivot;
    if (pivot) pivot.rotation.y = (def.openRot ?? Math.PI / 2) * d.t;
    if (def.secondary) def.secondary.pivot.rotation.y = def.secondary.openRot * d.t;
    this.doors.set(name, d);
    return d;
  }

  setDoor(name, open) {
    const d = this.doors.get(name);
    if (!d) return d;
    // A closing leaf must never turn into an invisible wall around the player.
    const p = this.player?.pos, c = d.collider;
    if (!open && p && p.x > c.x0-.4 && p.x < c.x1+.4 && p.z > c.z0-.4 && p.z < c.z1+.4) {
      d.pendingClose = true;
      return d;
    }
    d.pendingClose = false;
    if (d.open === open) return d;
    d.open = open;
    d.target = open ? 1 : 0;
    if (this.onDoorMove) this.onDoorMove(name, open);
    const i = this.colliders.indexOf(d.collider);
    if (open && i >= 0) this.colliders.splice(i, 1);
    if (!open && i < 0) this.colliders.push(d.collider);
    return d;
  }

  updateDoors(dt) {
    for (const d of this.doors.values()) {
      if (d.pendingClose) this.setDoor(d.name, false);
      const target = d.open ? 1 : 0;
      if (Math.abs(d.t - target) < 0.001) continue;
      d.t += Math.sign(target - d.t) * Math.min(Math.abs(target - d.t), dt * 3.2);
      const pivot = d.pivot || d.def.mesh?.userData?.pivot;
      if (!pivot) continue;
      pivot.rotation.y = (d.def.openRot ?? Math.PI / 2) * d.t;
      if (d.def.secondary) d.def.secondary.pivot.rotation.y = d.def.secondary.openRot * d.t;
    }
  }

  _counter() {
    const M = this.materials;
    const w = L.CNT_X1 - L.CNT_X0, d = L.CNT_Z1 - L.CNT_Z0;
    this.addBox(w, L.CNT_H - 0.06, d, M.counter, (L.CNT_X0 + L.CNT_X1) / 2, 0, (L.CNT_Z0 + L.CNT_Z1) / 2, { label: "counter" });
    this.addBox(w + 0.14, 0.06, d + 0.14, M.counterTop, (L.CNT_X0 + L.CNT_X1) / 2, L.CNT_H - 0.06, (L.CNT_Z0 + L.CNT_Z1) / 2, { collide: false, label: "countertop" });
    // low wing that pens the attendant in
    // The wing used to run from the counter to the wall, sealing the space
    // behind the till: the player could see the chair and never reach it. It
    // stops short now, leaving a gap you can walk through at the wall end,
    // which is how you get behind a counter in a real shop.
    this.addBox(0.12, L.CNT_H, 0.30, M.counter, L.CNT_X0, 0, 2.95, { label: "counter-wing" });

    // The hot-drinks run along the east wall. The urn and the snack rack were
    // being placed at counter height above nothing at all, because this was
    // never built.
    const cw = 1.5, cd = 0.62, cx = 7.85, cz = 1.6;
    this.addBox(cw, 0.9, 2.6, M.counter, cx, 0, cz, { label: "coffee-counter" });
    this.addBox(cw + 0.1, 0.06, 2.7, M.counterTop, cx, 0.9, cz,
      { collide: false, label: "coffee-counter-top" });
    // a shelf over it, where the cups live
    this.addBox(cw, 0.05, 2.2, M.counterTop, cx, 1.75, cz,
      { collide: false, label: "coffee-shelf" });

    // Behind the register: a wall, floor to ceiling.
    //
    // This was an open run of cigarette shelving, which meant the space behind
    // the till read as more sales floor and the player could see straight
    // through to the back rooms. A till has a wall behind it. It also gives
    // the shop a back to be lit against, and it is the surface the tally is
    // scratched into.
    const bx = (L.CNT_X0 + L.CNT_X1) / 2, bw = L.CNT_X1 - L.CNT_X0, bz = 4.34;
    if (CIG.z === null) { CIG.z = bz - 0.24; }
    this.addBox(bw + 0.6, L.CEIL, 0.26, M.wall, bx, 0, bz, { label: "backwall" });
    // a shallow cigarette case ON the wall, which is where one actually goes.
    // It bites 1cm into the wall on purpose: flush would make the two back
    // faces coplanar, which z-fights.
    this.addBox(bw - 0.2, 1.1, 0.16, M.shelfMetal, bx, 0.95, bz - 0.2,
      { collide: false, label: "cigcase" });
    for (const sy of CIG.shelfY) {
      this.addBox(bw - 0.3, CIG.board, 0.13, M.dark, bx, sy, CIG.z,
        { collide: false, label: "cigcase-shelf" });
    }
  }

  _aisles() {
    const M = this.materials;
    // Gondolas: a narrow back panel with shelf boards proud of it on both
    // sides, so stock sits *on* a shelf rather than inside a block.
    this.gondolas = [];
    const xs = [-1.0, 2.2, 5.4];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      this.addBox(0.22, 1.62, 3.9, M.shelfMetal, x, 0, 5.2, { label: "gondola" + i });
      for (const side of [-1, 1]) {
        this.addBox(0.06, 0.14, 3.9, M.dark, x + side * 0.14, 0, 5.2, { collide: false }); // kick
      }
      for (let s = 0; s < 4; s++) {
        const y = 0.34 + s * 0.36;
        for (const side of [-1, 1]) {
          this.addBox(0.36, 0.04, 3.9, M.shelfMetal, x + side * 0.29, y, 5.2, { collide: false });
        }
        this.addBox(0.94, 0.06, 0.03, M.dark, x, y + 0.04, 3.26, { collide: false }); // price rail
      }
      // Fitted perforated end panels cover the exposed ends of the shelf rails.
      const panelCanvas = document.createElement("canvas");panelCanvas.width=256;panelCanvas.height=512;
      const pc=panelCanvas.getContext("2d");pc.fillStyle="#9eaa98";pc.fillRect(0,0,256,512);
      pc.fillStyle="#758674";for(let py=18;py<512;py+=20)for(let px=14;px<256;px+=20)pc.fillRect(px,py,2,2);
      pc.strokeStyle="#b9c2b0";pc.lineWidth=6;pc.strokeRect(4,4,248,504);
      const panelMap=new THREE.CanvasTexture(panelCanvas);panelMap.colorSpace=THREE.SRGBColorSpace;
      const panel=new THREE.Mesh(new THREE.BoxGeometry(.93,1.58,.045),new THREE.MeshLambertMaterial({map:panelMap}));
      panel.name="aisle_end_"+i;panel.position.set(x,.82,3.23);panel.castShadow=true;panel.receiveShadow=true;this.group.add(panel);
      const labelCanvas=document.createElement("canvas");labelCanvas.width=512;labelCanvas.height=128;
      const lc=labelCanvas.getContext("2d");lc.fillStyle="#c9c2a7";lc.fillRect(0,0,512,128);lc.fillStyle="#304b3c";lc.fillRect(0,0,512,24);
      lc.font="bold 34px sans-serif";lc.textAlign="center";lc.fillText(["PANTRY / COFFEE","SNACKS / DRINKS","HOME / AUTO"][i],256,82);
      const labelMap=new THREE.CanvasTexture(labelCanvas);labelMap.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Mesh(new THREE.PlaneGeometry(.84,.21),new THREE.MeshLambertMaterial({map:labelMap}));label.name="aisle_directory_"+i;label.rotation.y=Math.PI;label.position.set(x,1.41,3.204);this.group.add(label);
      // one collider for the whole run, so you cannot walk through the stock
      this.colliders.push({ x0: x - 0.5, x1: x + 0.5, z0: 3.20, z1: 7.12, label: "gondola" + i, y1: 1.6 });
      this.gondolas.push({ x, z0: 3.3, z1: 7.1, index: i, shelfY: [0.34, 0.70, 1.06, 1.42], reach: 0.4 });
    }
    // end caps
    this.addBox(1.1, 1.2, 0.5, M.shelfMetal, -1.0, 0, 3.0, { label: "endcap0" });
    this.addBox(1.1, 1.2, 0.5, M.shelfMetal, 2.2, 0, 3.0, { label: "endcap1" });
    // the aisle that is not on the floor plan (revealed on Night 5)
    const ghost = new THREE.Group();
    ghost.visible = false;
    ghost.name = "ghostEndcap";
    const gm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, 0.55),
      M.shelfMetal.clone());
    gm.position.set(5.4, 0.68, 3.0);
    ghost.add(gm);
    this.group.add(ghost);
    this.ghostEndcap = ghost;
  }

  _cooler() {
    const M = this.materials;
    // The cooler run, in SEGMENTS, with the back doorways left open.
    //
    // This was one unbroken 10.4-metre cabinet from x -2.2 to 8.2. The back
    // partition has three doors in it — stock at -7, office at +1, bathroom at
    // +7 — and the cabinet crossed two of them. Only the stock room was ever
    // reachable on foot; the office and the bathroom opened onto the back of a
    // fridge for the entire game. Nudging the whole run forward did not help,
    // because a wall that wide has no way round it: the fix is a gap you can
    // walk through, in the same place as the door it serves.
    //
    // Two runs and two walkways, which is also how a shop this shape is really
    // laid out. `_interiorWalls` cuts the partition at the same x values, so
    // both are derived from L.DOOR_* and cannot drift apart.
    const z = 6.9, HALF = 0.9;         // walkway half-width at each doorway
    const gaps = [L.DOOR_OFFICE, L.DOOR_BATH].sort((a, b) => a - b);
    const segs = [];
    let cursor = -2.2;
    for (const gx of gaps) {
      if (gx - HALF > cursor + 0.8) segs.push([cursor, gx - HALF]);
      cursor = Math.max(cursor, gx + HALF);
    }
    if (8.2 - cursor > 0.8) segs.push([cursor, 8.2]);

    const zBack = z + 0.30, zFront = z - 0.375;
    this.coolerShelfY = [0.52, 0.97, 1.42];
    this.coolerSegments = segs;
    this.coolerGlass = [];
    this.coolerGlow = [];
    for (const [sx0, sx1] of segs) {
      const cx = (sx0 + sx1) / 2, W = sx1 - sx0;
      // A HOLLOW cabinet — back, ends, top and kick only. It used to be solid,
      // which sealed the drinks inside it where nobody could see them.
      this.addBox(W, 2.1, 0.09, M.shelfMetal, cx, 0, zBack, { collide: false, label: "cooler" });
      this.addBox(0.09, 2.1, 0.60, M.shelfMetal, sx0 + 0.045, 0, z - 0.05, { collide: false, label: "cooler-end" });
      this.addBox(0.09, 2.1, 0.60, M.shelfMetal, sx1 - 0.045, 0, z - 0.05, { collide: false, label: "cooler-end" });
      this.addBox(W, 0.14, 0.60, M.shelfMetal, cx, 1.96, z - 0.05, { collide: false, label: "cooler-top" });
      this.addBox(W, 0.10, 0.60, M.shelfMetal, cx, 0, z - 0.05, { collide: false, label: "cooler-kick" });
      // one collider per segment, so the walkways are genuinely walkable
      this.colliders.push({ x0: sx0, x1: sx1, z0: zFront - 0.05, z1: zBack + 0.05,
                            y1: 2.1, label: "cooler" });
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(W - 0.2, 1.7, 0.05),
        new THREE.MeshLambertMaterial({ color: 0xbcd2d6, transparent: true, opacity: 0.22 })
      );
      glass.position.set(cx, 1.1, zFront);
      this.group.add(glass);
      this.coolerGlass.push(glass);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, 1.6), unlit(0xcfe6ec));
      glow.position.set(cx, 1.05, zBack - 0.05);
      glow.rotation.y = Math.PI;
      this.group.add(glow);
      this.coolerGlow.push(glow);
      for (const sy of this.coolerShelfY) {
        this.addBox(W - 0.20, 0.035, 0.60, M.shelfMetal, cx, sy, z,
          { collide: false, label: "cooler-shelf" });
      }
      // uprights, so it reads as a fitted-out cabinet rather than a lit box
      for (let ux = sx0 + 1.3; ux < sx1 - 0.6; ux += 2.6) {
        this.addBox(0.05, 1.86, 0.60, M.shelfMetal, ux, 0.10, z,
          { collide: false, label: "cooler-upright" });
      }
    }
    this.coolerBounds = { x0: -2.2, x1: 8.2, z };
  }

  _forecourt() {
    const M = this.materials;
    // canopy deck
    const deck = this.addBox(L.CANOPY_HX * 2, 0.55, L.CANOPY_HZ * 2, M.corr, 0, L.CANOPY_Y, L.CANOPY_Z, { collide: false, label: "canopy" });
    deck.receiveShadow = false;
    // fascia band (lit) — four panels around the deck edge, sitting just
    // outside it, so nothing intersects the deck
    const fascia = new THREE.Group();
    const fMat = unlit(0xd8d3c2);
    const fh = 0.42, t = 0.08;
    const hx = L.CANOPY_HX + t / 2, hz = L.CANOPY_HZ + t / 2;
    const panel = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, fh, d), fMat);
      m.position.set(x, 0, z);
      fascia.add(m);
    };
    panel(hx * 2 + t, t, 0, -hz);          // south face, toward the road
    panel(hx * 2 + t, t, 0, hz);           // north
    panel(t, hz * 2, -hx, 0);              // west
    panel(t, hz * 2, hx, 0);               // east
    // hung so its top lines up with the top of the deck
    fascia.position.set(0, L.CANOPY_Y + 0.55 - fh / 2, L.CANOPY_Z);
    this.group.add(fascia);
    this.canopyFascia = fascia;
    // the four panels share one material — the power system dims it when the
    // canopy circuit drops, and a Group has no .material of its own
    this.canopyFasciaMat = fMat;
    // columns
    for (const [x, z] of [[-7.2, -5.0], [7.2, -5.0], [-7.2, -13.0], [7.2, -13.0]]) {
      this.addBox(0.5, L.CANOPY_Y, 0.5, M.metal, x, 0, z, { label: "column" });
    }
    // pump islands
    for (const z of [-6.6, -11.4]) {
      this.addBox(9.5, 0.16, 1.5, M.apron, 0, 0, z, { collide: false, label: "island" });
      this.addBox(9.5, 0.06, 1.5, M.dark, 0, 0.16, z, { collide: false });
    }
  }

  _backLot() {
    const M = this.materials;
    // Loading dock lip, BESIDE the back door rather than in front of it. It
    // sat centred on x 0 and the door leaf swings out over it, so an open rear
    // door clipped 0.077 m3 through the concrete every time anybody used it.
    this.addBox(3.2, 0.35, 1.4, M.apron, 2.4, 0, 13.0, { collide: false, label: "dock" });
    // propane cage
    this.addBox(2.4, 1.8, 1.4, M.rust, -12.0, 0, 14.5, { label: "propane-cage" });
    // low block wall along the back of the lot
    this.addBox(26, 1.1, 0.35, M.exwall, 0, 0, L.LOT_Z1, { label: "lotwall" });
  }

  _lights() {
    const g = this.group;
    // three.js r155+ uses physical light units: point/spot intensity is in
    // candela, so the readable numbers below are scaled up on creation.
    const PT = 13, SP = 24;
    const mk = (color, inten, dist, x, y, z, name) => {
      const l = new THREE.PointLight(color, inten * PT, dist, 1.4);
      l.position.set(x, y, z);
      l.name = name;
      g.add(l);
      this.lights[name] = l;
      return l;
    };
    // Neutral warm fluorescents; retain detail near fixtures without white clipping.
    mk(0xf3ecdf, 1.15, 11, -4.6, 2.95, 3.2, "fl_counter");
    mk(0xf3ecdf, 1.0, 11, 0.5, 2.95, 5.2, "fl_mid");
    mk(0xf3ecdf, 1.0, 11, 5.6, 2.95, 5.2, "fl_east");
    mk(0xf3ecdf, 0.75, 9, -6.0, 2.95, 6.8, "fl_west");
    mk(0xe9eee7, 0.7, 7, 6.9, 2.7, 10.0, "fl_bath");
    mk(0xe8dcc0, 0.65, 7, 0.6, 2.7, 10.2, "fl_office");
    mk(0xf3ecdf, 0.7, 8, -6.2, 2.7, 10.2, "fl_stock");
    mk(0xf3ecdf, .85, 8, .5, 2.55, 1.5, "fl_aisle_front");
    mk(0xf3ecdf, .85, 8, 5.5, 2.55, 1.5, "fl_entry_aisle");
    // cooler spill
    mk(0xcfe6ec, 0.5, 6, 3.0, 1.4, 6.5, "cooler_glow");

    // canopy — the only real exterior light, shadow caster
    const canopy = new THREE.SpotLight(0xf2ead6, 2.6 * SP, 40, Math.PI / 2.6, 0.55, 1.2);
    canopy.position.set(0, L.CANOPY_Y - 0.2, L.CANOPY_Z);
    canopy.target.position.set(0, 0, L.CANOPY_Z);
    canopy.castShadow = true;
    canopy.shadow.mapSize.set(1024, 1024);
    canopy.shadow.camera.far = 40;
    canopy.shadow.bias = -.00015;
    canopy.shadow.normalBias = .035;
    canopy.shadow.radius = 2;
    g.add(canopy, canopy.target);
    this.lights.canopy = canopy;

    // store front glow spilling onto the apron
    const front = new THREE.SpotLight(0xf2eadf, 1.5 * SP, 22, Math.PI / 2.4, 0.7, 1.4);
    front.position.set(0, 2.6, 1.5);
    front.target.position.set(0, 0, -4.0);
    g.add(front, front.target);
    this.lights.front = front;

    // rear security light
    const rear = new THREE.SpotLight(0xf0e2bc, 1.4 * SP, 24, Math.PI / 3, 0.6, 1.3);
    rear.position.set(0.0, 3.3, 12.9);
    rear.target.position.set(0, 0, 17);
    g.add(rear, rear.target);
    this.lights.rear = rear;

    // Soft sky bounce keeps outdoor people and paths readable after dark.
    const hemi = new THREE.HemisphereLight(0x7c8caa, 0x41404a, 0.72);
    g.add(hemi);
    this.lights.hemi = hemi;
    const moon = new THREE.DirectionalLight(0x9cabc5, 0.4);
    moon.position.set(-30, 40, -20);
    g.add(moon);
    this.lights.moon = moon;
  }

  _anchors() {
    const A = (n, x, y, z) => { this.anchors[n] = new THREE.Vector3(x, y, z); };
    A("spawn_outside", 2.0, 0, -3.6);
    A("behind_counter", -4.6, 0, 3.5);
    A("register", L.REG.x, L.REG.y, L.REG.z);
    A("customer", L.CUSTOMER.x, 0, L.CUSTOMER.z);
    A("door_in", 5.1, 0, 0.9);
    A("door_out", 5.1, 0, -1.6);
    A("office_desk", 2.0, 0, 11.0);
    // ON the desk, at the back of it.
    //
    // Swapping the office and the stock room moved `office_desk` to the room
    // behind the counter and left this one where it was, so the four security
    // monitors spent every night hovering in mid-air in the stock room, 0.77m
    // above the floor, with the desk they stand on almost seven metres away.
    // Nothing complained: the bank is its own group and the code that places
    // it never asked whether anything was underneath.
    A("camera_bank", 1.68, 1.25, 11.18);
    A("stock_shelf", -4.10, 0, 9.65);
    A("bathroom", 6.9, 0, 10.4);
    A("breaker", -3.8, 1.5, 11.6);
    A("dumpster", 11.0, 0, 16.0);
    A("pole", 0.0, 0, 21.0);
    A("payphone", 9.6, 0, -2.2);
    A("sign", -16.0, 0, -19.0);
    A("nova", -13.6, 0, 5.0);
    A("coffee", 7.6, 0, 1.6);
  }

  /**
   * The blood. Hidden until the night that reveals it, and it does not go away
   * afterwards — Night 1 finds it under the floor mess, Night 2 finds a trail
   * of it across the forecourt. Decal planes, so they lie flat on whatever
   * they are on.
   */
  /**
   * Blood, as geometry.
   *
   * This was a `PlaneGeometry` filled with one flat colour at 86% opacity — a
   * red rectangle lying on the floor, which is exactly what it read as. The
   * shape is most of the horror: a pool is lobed where it found the slope, it
   * stands proud at the rim and dries darker there first, and cast-off is
   * stretched along the direction it was thrown.
   *
   * The signature is unchanged so every call site still works. `w` picks the
   * piece unless one is named, and the model is scaled to the width asked for.
   *
   * Returns a Group IMMEDIATELY and fills it when the model arrives — the
   * station is built synchronously and the callers only ever touch `.visible`.
   */
  _bloodDecal(w, h, x, y, z, rotY = 0, kind = null) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.visible = false;
    g.renderOrder = 3;
    g.name = "gore";
    this.group.add(g);

    const key = kind || (w >= 0.75 ? "gore_pool_big"
                       : w >= 0.28 ? "gore_pool_small" : "gore_spatter");
    const NATIVE = { gore_pool_big: 1.45, gore_pool_small: 0.72, gore_spatter: 2.0,
                     gore_smear: 1.9, gore_drips: 0.82 };
    import("../core/assets.js").then(({ model }) => model(key, { shadows: false }))
      .then((o) => {
        const s = w / (NATIVE[key] || 1);
        o.scale.setScalar(s);
        // squash to the depth asked for, so a call that wanted a long thin
        // stain still gets one
        if (h && w) o.scale.z = s * Math.max(0.35, Math.min(1.8, (h / w) / 0.72));
        g.add(o);
      })
      .catch((e) => console.warn("[gore]", key, e));
    return g;
  }

  /**
   * The aisle that is not on the floor plan.
   *
   * Five functions like this one were being *called* by the night scripts with
   * optional chaining and had never been written. `?.` swallowed every one, so
   * the scripts ran, the clues fired, the subtitles played — and nothing
   * appeared. The playtest harness passed all six nights because it checks
   * clues, not pixels. That is the single worst class of bug in this project
   * and a reviewer caught it, not the tooling.
   *
   * Built to match `_aisles()` exactly — same gondola construction, same
   * materials, same shelf pitch — because the horror is that it looks like it
   * has always been there. It runs the wrong way, past the cooler.
   */
  showFourthAisle(on) {
    // Hiding something that was never built should not build it — the
    // per-night reset calls every one of these with `false`.
    if (!on && !this._aisle4) return;
    if (!this._aisle4) {
      const M = this.materials;
      const g = new THREE.Group();
      g.name = "prop_aisle4";
      const X = 3.0, Z0 = 7.6, Z1 = 11.0, CZ = (Z0 + Z1) / 2, LEN = Z1 - Z0;
      const box = (w, h, d, mat, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y + h / 2, z);
        m.castShadow = false; m.receiveShadow = true;
        g.add(m); return m;
      };
      box(0.22, 1.62, LEN, M.shelfMetal, X, 0, CZ);
      for (const side of [-1, 1]) box(0.06, 0.14, LEN, M.dark, X + side * 0.14, 0, CZ);
      for (let s = 0; s < 4; s++) {
        const y = 0.34 + s * 0.36;
        for (const side of [-1, 1]) box(0.36, 0.04, LEN, M.shelfMetal, X + side * 0.29, y, CZ);
        box(0.94, 0.06, 0.03, M.dark, X, y + 0.04, Z0 - 0.04);
      }
      // stock, so it reads as a working aisle rather than empty scenery
      const rng = (n) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
      let n = 0;
      for (let s = 0; s < 4; s++) {
        const y = 0.38 + s * 0.36;
        for (const side of [-1, 1]) {
          for (let k = 0; k < 9; k++) {
            const z = Z0 + 0.24 + k * ((LEN - 0.5) / 8);
            const h = 0.12 + rng(++n) * 0.1;
            const c = new THREE.Mesh(
              new THREE.BoxGeometry(0.09 + rng(++n) * 0.05, h, 0.09 + rng(++n) * 0.05),
              new THREE.MeshLambertMaterial({ color: [0x8a7a4a, 0x6b5f4a, 0x7d3f34, 0x4a5a4a][k % 4] })
            );
            c.position.set(X + side * 0.3, y + h / 2, z);
            g.add(c);
          }
        }
      }
      this.group.add(g);
      this._aisle4 = g;
      this._aisle4Collider = { x0: X - 0.5, x1: X + 0.5, z0: Z0, z1: Z1, label: "aisle4", y1: 1.6 };
    }
    this._aisle4.visible = !!on;
    const i = this.colliders.indexOf(this._aisle4Collider);
    if (on && i < 0) this.colliders.push(this._aisle4Collider);
    if (!on && i >= 0) this.colliders.splice(i, 1);
    if (this.ghostEndcap) this.ghostEndcap.visible = !!on;
  }

  /** Two notes on the counter, and they are the same note. */
  showFiveOnCounter(on) {
    // Hiding something that was never built should not build it — the
    // per-night reset calls every one of these with `false`.
    if (!on && !this._fives) return;
    if (!this._fives) {
      const g = new THREE.Group();
      g.name = "prop_fives";
      const mat = new THREE.MeshLambertMaterial({ color: 0x9aa07e });
      for (const [x, z, r] of [[-3.05, 2.42, 0.16], [-2.72, 2.5, -0.22]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.155, 0.066), mat);
        m.rotation.x = -Math.PI / 2; m.rotation.z = r;
        m.position.set(x, L.CNT_H + 0.005, z);
        m.renderOrder = 3;
        g.add(m);
      }
      this.group.add(g);
      this._fives = g;
    }
    this._fives.visible = !!on;
  }

  /**
   * The patch on the aisle floor. About the size of a seven-year-old, spreading
   * very slowly outward, and not coming from anything.
   *
   * Layered rather than one plane: a dark core, a wetter rim that catches the
   * torch, and a couple of run-offs following the floor. It grows for a while
   * after it appears, which is the part that is wrong.
   */
  showAisleBlood(on) {
    // Hiding something that was never built should not build it — the
    // per-night reset calls every one of these with `false`.
    if (!on && !this._aisleBlood) return;
    if (!this._aisleBlood) {
      const g = new THREE.Group();
      g.name = "prop_aisleblood";
      const spec = [
        [1.15, 0.78, 2.6, 9.2, 0.0, 0x2a0708, 0.94],
        [0.86, 0.58, 2.72, 9.34, 0.5, 0x3d0b0b, 0.9],
        [0.44, 0.33, 2.42, 8.92, 1.2, 0x5a1210, 0.85],
        [0.3, 0.22, 2.95, 9.7, 2.1, 0x35090a, 0.8],
      ];
      for (const [w, h, x, z, r, col, op] of spec) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: op,
            depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })
        );
        m.rotation.x = -Math.PI / 2; m.rotation.z = r;
        m.position.set(x, 0.016, z);
        m.renderOrder = 4;
        g.add(m);
      }
      this.group.add(g);
      this._aisleBlood = g;
    }
    this._aisleBlood.visible = !!on;
    if (on) {
      this._aisleBlood.scale.setScalar(0.55);
      this._bloodGrow = 0;
    }
  }

  /** The cover comes off. It is a Nova, and it is his. */
  showNova(on) {
    if (!on && !this._nova && !this._novaCover) return;
    const covered = this.group.getObjectByName("prop_nova")
      || (this.g && this.g.scene && this.g.scene.getObjectByName("prop_nova"));
    if (!this._novaCover) {
      const g = new THREE.Group();
      g.name = "prop_nova_cover";
      // folded, neatly, on the ground beside it
      const fold = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.18, 0.62),
        new THREE.MeshLambertMaterial({ color: 0x6d6a60 })
      );
      fold.position.set(-8.1, 0.09, 12.9);
      fold.rotation.y = 0.4;
      g.add(fold);
      this.group.add(g);
      this._novaCover = g;
    }
    this._novaCover.visible = !!on;
    if (covered) covered.visible = !on;      // the cover is what you saw before
    if (!this._nova && on) {
      const g = new THREE.Group();
      g.name = "prop_nova_car";
      // the wrong colour for how old it is, because it has never been outside
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.72, 1.85),
        new THREE.MeshLambertMaterial({ color: 0x2f4f6b }));
      body.position.set(-9.4, 0.62, 12.4);
      body.rotation.y = 1.35;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.58, 1.68),
        new THREE.MeshLambertMaterial({ color: 0x2b4760 }));
      roof.position.set(-9.4, 1.24, 12.4);
      roof.rotation.y = 1.35;
      g.add(body, roof);
      for (const [dx, dz] of [[1.5, 0.8], [1.5, -0.8], [-1.5, 0.8], [-1.5, -0.8]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12),
          new THREE.MeshLambertMaterial({ color: 0x14140f }));
        w.rotation.z = Math.PI / 2;
        w.rotation.y = 1.35;
        const c = Math.cos(1.35), s = Math.sin(1.35);
        w.position.set(-9.4 + dx * c - dz * s, 0.33, 12.4 + dx * s + dz * c);
        g.add(w);
      }
      this.group.add(g);
      this._nova = g;
      this.colliders.push({ x0: -11.6, x1: -7.2, z0: 11.2, z1: 13.6, label: "nova", y1: 1.5 });
    }
    if (this._nova) this._nova.visible = !!on;
  }

  /**
   * The fourth aisle, full of people, facing the shelves.
   *
   * They do not turn round. They do not move at all — no idle, no breathing,
   * no sway — which is why they are built as plain geometry rather than as
   * customers: an animation rig that is holding still still *reads* as alive.
   */
  showAisleCrowd(on) {
    // Hiding something that was never built should not build it — the
    // per-night reset calls every one of these with `false`.
    if (!on && !this._crowd) return;
    if (!this._crowd) {
      const g = new THREE.Group();
      g.name = "prop_crowd";
      const skin = [0x6b5b4e, 0x7a6653, 0x5c4d42, 0x83705c];
      const coat = [0x2e2c28, 0x3a3630, 0x24262a, 0x413a30, 0x2a3038];
      const spots = [
        [2.55, 8.1, 0], [3.45, 8.7, 1], [2.5, 9.4, 2], [3.5, 10.1, 3],
        [2.6, 10.7, 4], [3.4, 7.9, 1], [2.48, 8.85, 3],
      ];
      spots.forEach(([x, z, k], i) => {
        const p = new THREE.Group();
        const facing = x < 3.0 ? -Math.PI / 2 : Math.PI / 2;   // to the shelves
        const h = 1.62 + (i % 3) * 0.07;
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, h * 0.52, 0.24),
          new THREE.MeshLambertMaterial({ color: coat[k % coat.length] }));
        torso.position.y = h * 0.52 / 2 + h * 0.42;
        const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, h * 0.44, 0.22),
          new THREE.MeshLambertMaterial({ color: 0x1d1c1a }));
        legs.position.y = h * 0.44 / 2;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8),
          new THREE.MeshLambertMaterial({ color: skin[k % skin.length] }));
        head.position.y = h * 0.96;
        p.add(legs, torso, head);
        p.position.set(x, 0, z);
        p.rotation.y = facing;
        g.add(p);
      });
      this.group.add(g);
      this._crowd = g;
    }
    this._crowd.visible = !!on;
  }

  showBathBlood(on) {
    if (!on && !this._bathBlood) return;
    if (!this._bathBlood) {
      this._bathBlood = [
        this._bloodDecal(0.9, 0.7, 7.0, 0.014, 10.4, 0.3),
        this._bloodDecal(0.5, 0.4, 7.4, 0.014, 10.9, 1.1),
        this._bloodDecal(0.35, 0.3, 6.7, 0.014, 11.1, 2.0),
      ];
    }
    for (const b of this._bathBlood) b.visible = !!on;
  }

  /**
   * Four marks and a fifth cut across them, scratched in the grout at chest
   * height, on the wall he was facing. It never comes off, because he never
   * cleans it off.
   */
  /**
   * The car off the shoulder at 01:58 — nose in the ditch, door open, wipers
   * still going, headlights still on, and nobody anywhere near it. Built on
   * demand because most runs never see it: he has to choose to go out.
   */
  async showCrashScene(on) {
    if (!on) { if (this._crash) this._crash.visible = false; return; }
    if (this._crash) { this._crash.visible = true; return; }
    const { model, fitHeight } = await import("../core/assets.js");
    const g2 = new THREE.Group();
    g2.name = "prop_crash";
    const car = await model("car_sedan", { shadows: true });
    fitHeight(car, 1.45);
    car.rotation.set(-0.18, 0.5, 0.06);        // nose down in the ditch
    g2.add(car);
    // headlights still on, pointing into nothing
    const beam = new THREE.SpotLight(0xfff3d8, 180, 30, 0.5, 0.4, 1.1);
    beam.position.set(0.5, 0.7, 1.8);
    const t = new THREE.Object3D();
    t.position.set(1.5, -1.2, 20);
    g2.add(beam, t);
    beam.target = t;
    // two casings on the asphalt, filling with rain
    for (const [cx, cz] of [[2.1, -1.2], [2.45, -1.6]]) {
      const c = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.045, 6),
        new THREE.MeshLambertMaterial({ color: 0xb9a45c })
      );
      c.rotation.z = Math.PI / 2;
      c.position.set(cx, 0.022, cz);
      g2.add(c);
    }
    g2.position.set(-6.0, -0.35, L.ROAD_Z + 3.0);
    this.group.add(g2);
    this._crash = g2;
  }

  /** All four pumps running with the nozzles in their cradles. */
  runPumpsAlone(on) {
    this._pumpsAlone = !!on;
    for (const p of this.pumpDisplays || []) {
      if (p.material) p.material.color.setHex(on ? 0xc8e6a0 : 0x2a2f28);
    }
  }

  showTally(on) {
    if (!this._tally) {
      const g2 = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(i === 4 ? 0.135 : 0.02, i === 4 ? 0.02 : 0.11),
          new THREE.MeshBasicMaterial({ color: 0x24201c, transparent: true, opacity: 0.9 })
        );
        m.position.set(i === 4 ? 0.05 : (i - 1.5) * 0.035, 0, 0.001);
        if (i === 4) m.rotation.z = -0.25;
        g2.add(m);
      }
      g2.position.set(7.2, 1.32, 11.88);
      g2.rotation.y = Math.PI;
      g2.visible = false;
      this.group.add(g2);
      this._tally = g2;
    }
    this._tally.visible = !!on;
  }

  showForecourtBlood(on) {
    if (!this._lotBlood) {
      this._lotBlood = [];
      // a trail from where he stood, in through the door
      const pts = [[0.5, -11.6], [1.4, -9.4], [2.3, -7.1], [3.1, -5.0],
                   [3.8, -3.2], [4.4, -1.6], [4.9, -0.2], [5.4, 1.6],
                   [5.6, 3.4], [6.2, 6.0], [6.8, 8.4], [7.0, 10.0]];
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const s2 = 0.42 - i * 0.02;
        this._lotBlood.push(this._bloodDecal(s2, s2 * 0.7, x, 0.016, z, i * 0.7,
          i % 3 === 0 ? "gore_spatter" : "gore_smear"));
      }
    }
    for (const b of this._lotBlood) b.visible = !!on;
  }

  update(dt) { this.updateDoors(dt); }
}
