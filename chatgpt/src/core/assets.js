// THE NIGHT COUNT — asset loading, caching, and the material unifier.
//
// Everything that arrives from a different source (photoscanned Poly Haven
// props, low-poly poly.pizza vehicles, the Quaternius character rig) is passed
// through `unify()`, which strips PBR response and rebuilds each material as a
// flat Lambert surface with a single 256px diffuse map. That is the second
// half of the art direction (the first half being the composite pass).
import * as THREE from "three";
import { VARIANTS } from "./variants.js";
const variantUse = new Map();
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skinClone } from "three/addons/utils/SkeletonUtils.js";

const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

const gltfCache = new Map();
const texCache = new Map();

export const MODEL = {
  roadside_creature: "assets/models_blender/roadside_creature.glb",
  alarmclock_v1: "assets/models_blender/alarmclock_v1.glb",
  alarmclock_v2: "assets/models_blender/alarmclock_v2.glb",
  alarmclock_v3: "assets/models_blender/alarmclock_v3.glb",
  alarmclock_v4: "assets/models_blender/alarmclock_v4.glb",
  barrel_v1: "assets/models_blender/barrel_v1.glb",
  barrel_v2: "assets/models_blender/barrel_v2.glb",
  barrel_v3: "assets/models_blender/barrel_v3.glb",
  barrel_v4: "assets/models_blender/barrel_v4.glb",
  barrel3_v1: "assets/models_blender/barrel3_v1.glb",
  barrel3_v2: "assets/models_blender/barrel3_v2.glb",
  barrel3_v3: "assets/models_blender/barrel3_v3.glb",
  barrel3_v4: "assets/models_blender/barrel3_v4.glb",
  binder_v1: "assets/models_blender/binder_v1.glb",
  binder_v2: "assets/models_blender/binder_v2.glb",
  binder_v3: "assets/models_blender/binder_v3.glb",
  binder_v4: "assets/models_blender/binder_v4.glb",
  bleach_v1: "assets/models_blender/bleach_v1.glb",
  bleach_v2: "assets/models_blender/bleach_v2.glb",
  bleach_v3: "assets/models_blender/bleach_v3.glb",
  bleach_v4: "assets/models_blender/bleach_v4.glb",
  boombox_v1: "assets/models_blender/boombox_v1.glb",
  boombox_v2: "assets/models_blender/boombox_v2.glb",
  boombox_v3: "assets/models_blender/boombox_v3.glb",
  boombox_v4: "assets/models_blender/boombox_v4.glb",
  broom_v1: "assets/models_blender/broom_v1.glb",
  broom_v2: "assets/models_blender/broom_v2.glb",
  broom_v3: "assets/models_blender/broom_v3.glb",
  broom_v4: "assets/models_blender/broom_v4.glb",
  bucket_v1: "assets/models_blender/bucket_v1.glb",
  bucket_v2: "assets/models_blender/bucket_v2.glb",
  bucket_v3: "assets/models_blender/bucket_v3.glb",
  bucket_v4: "assets/models_blender/bucket_v4.glb",
  bush_v1: "assets/models_blender/bush_v1.glb",
  bush_v2: "assets/models_blender/bush_v2.glb",
  bush_v3: "assets/models_blender/bush_v3.glb",
  bush_v4: "assets/models_blender/bush_v4.glb",
  cabinet_v1: "assets/models_blender/cabinet_v1.glb",
  cabinet_v2: "assets/models_blender/cabinet_v2.glb",
  cabinet_v3: "assets/models_blender/cabinet_v3.glb",
  cabinet_v4: "assets/models_blender/cabinet_v4.glb",
  camera1_v1: "assets/models_blender/camera1_v1.glb",
  camera1_v2: "assets/models_blender/camera1_v2.glb",
  camera1_v3: "assets/models_blender/camera1_v3.glb",
  camera1_v4: "assets/models_blender/camera1_v4.glb",
  camera2_v1: "assets/models_blender/camera2_v1.glb",
  camera2_v2: "assets/models_blender/camera2_v2.glb",
  camera2_v3: "assets/models_blender/camera2_v3.glb",
  camera2_v4: "assets/models_blender/camera2_v4.glb",
  cans_v1: "assets/models_blender/cans_v1.glb",
  cans_v2: "assets/models_blender/cans_v2.glb",
  cans_v3: "assets/models_blender/cans_v3.glb",
  cans_v4: "assets/models_blender/cans_v4.glb",
  cardbox_v1: "assets/models_blender/cardbox_v1.glb",
  cardbox_v2: "assets/models_blender/cardbox_v2.glb",
  cardbox_v3: "assets/models_blender/cardbox_v3.glb",
  cardbox_v4: "assets/models_blender/cardbox_v4.glb",
  ceilingfan_v1: "assets/models_blender/ceilingfan_v1.glb",
  ceilingfan_v2: "assets/models_blender/ceilingfan_v2.glb",
  ceilingfan_v3: "assets/models_blender/ceilingfan_v3.glb",
  ceilingfan_v4: "assets/models_blender/ceilingfan_v4.glb",
  chips_v1: "assets/models_blender/chips_v1.glb",
  chips_v2: "assets/models_blender/chips_v2.glb",
  chips_v3: "assets/models_blender/chips_v3.glb",
  chips_v4: "assets/models_blender/chips_v4.glb",
  cigpack_v1: "assets/models_blender/cigpack_v1.glb",
  cigpack_v2: "assets/models_blender/cigpack_v2.glb",
  cigpack_v3: "assets/models_blender/cigpack_v3.glb",
  cigpack_v4: "assets/models_blender/cigpack_v4.glb",
  cleaner_v1: "assets/models_blender/cleaner_v1.glb",
  cleaner_v2: "assets/models_blender/cleaner_v2.glb",
  cleaner_v3: "assets/models_blender/cleaner_v3.glb",
  cleaner_v4: "assets/models_blender/cleaner_v4.glb",
  cleaner2_v1: "assets/models_blender/cleaner2_v1.glb",
  cleaner2_v2: "assets/models_blender/cleaner2_v2.glb",
  cleaner2_v3: "assets/models_blender/cleaner2_v3.glb",
  cleaner2_v4: "assets/models_blender/cleaner2_v4.glb",
  coffeemachine_v1: "assets/models_blender/coffeemachine_v1.glb",
  coffeemachine_v2: "assets/models_blender/coffeemachine_v2.glb",
  coffeemachine_v3: "assets/models_blender/coffeemachine_v3.glb",
  coffeemachine_v4: "assets/models_blender/coffeemachine_v4.glb",
  cone_v1: "assets/models_blender/cone_v1.glb",
  cone_v2: "assets/models_blender/cone_v2.glb",
  cone_v3: "assets/models_blender/cone_v3.glb",
  cone_v4: "assets/models_blender/cone_v4.glb",
  crate1_v1: "assets/models_blender/crate1_v1.glb",
  crate1_v2: "assets/models_blender/crate1_v2.glb",
  crate1_v3: "assets/models_blender/crate1_v3.glb",
  crate1_v4: "assets/models_blender/crate1_v4.glb",
  crate2_v1: "assets/models_blender/crate2_v1.glb",
  crate2_v2: "assets/models_blender/crate2_v2.glb",
  crate2_v3: "assets/models_blender/crate2_v3.glb",
  crate2_v4: "assets/models_blender/crate2_v4.glb",
  desk_v1: "assets/models_blender/desk_v1.glb",
  desk_v2: "assets/models_blender/desk_v2.glb",
  desk_v3: "assets/models_blender/desk_v3.glb",
  desk_v4: "assets/models_blender/desk_v4.glb",
  dumpster_v1: "assets/models_blender/dumpster_v1.glb",
  dumpster_v2: "assets/models_blender/dumpster_v2.glb",
  dumpster_v3: "assets/models_blender/dumpster_v3.glb",
  dumpster_v4: "assets/models_blender/dumpster_v4.glb",
  extinguisher_v1: "assets/models_blender/extinguisher_v1.glb",
  extinguisher_v2: "assets/models_blender/extinguisher_v2.glb",
  extinguisher_v3: "assets/models_blender/extinguisher_v3.glb",
  extinguisher_v4: "assets/models_blender/extinguisher_v4.glb",
  firealarm_v1: "assets/models_blender/firealarm_v1.glb",
  firealarm_v2: "assets/models_blender/firealarm_v2.glb",
  firealarm_v3: "assets/models_blender/firealarm_v3.glb",
  firealarm_v4: "assets/models_blender/firealarm_v4.glb",
  flashlight_v1: "assets/models_blender/flashlight_v1.glb",
  flashlight_v2: "assets/models_blender/flashlight_v2.glb",
  flashlight_v3: "assets/models_blender/flashlight_v3.glb",
  flashlight_v4: "assets/models_blender/flashlight_v4.glb",
  fluoro_v1: "assets/models_blender/fluoro_v1.glb",
  fluoro_v2: "assets/models_blender/fluoro_v2.glb",
  fluoro_v3: "assets/models_blender/fluoro_v3.glb",
  fluoro_v4: "assets/models_blender/fluoro_v4.glb",
  gallon_v1: "assets/models_blender/gallon_v1.glb",
  gallon_v2: "assets/models_blender/gallon_v2.glb",
  gallon_v3: "assets/models_blender/gallon_v3.glb",
  gallon_v4: "assets/models_blender/gallon_v4.glb",
  handtruck_v1: "assets/models_blender/handtruck_v1.glb",
  handtruck_v2: "assets/models_blender/handtruck_v2.glb",
  handtruck_v3: "assets/models_blender/handtruck_v3.glb",
  handtruck_v4: "assets/models_blender/handtruck_v4.glb",
  jerrycan_v1: "assets/models_blender/jerrycan_v1.glb",
  jerrycan_v2: "assets/models_blender/jerrycan_v2.glb",
  jerrycan_v3: "assets/models_blender/jerrycan_v3.glb",
  jerrycan_v4: "assets/models_blender/jerrycan_v4.glb",
  ladder_v1: "assets/models_blender/ladder_v1.glb",
  ladder_v2: "assets/models_blender/ladder_v2.glb",
  ladder_v3: "assets/models_blender/ladder_v3.glb",
  ladder_v4: "assets/models_blender/ladder_v4.glb",
  longlife_v1: "assets/models_blender/longlife_v1.glb",
  longlife_v2: "assets/models_blender/longlife_v2.glb",
  longlife_v3: "assets/models_blender/longlife_v3.glb",
  longlife_v4: "assets/models_blender/longlife_v4.glb",
  manhole_v1: "assets/models_blender/manhole_v1.glb",
  manhole_v2: "assets/models_blender/manhole_v2.glb",
  manhole_v3: "assets/models_blender/manhole_v3.glb",
  manhole_v4: "assets/models_blender/manhole_v4.glb",
  monitor_v1: "assets/models_blender/monitor_v1.glb",
  monitor_v2: "assets/models_blender/monitor_v2.glb",
  monitor_v3: "assets/models_blender/monitor_v3.glb",
  monitor_v4: "assets/models_blender/monitor_v4.glb",
  mop_v1: "assets/models_blender/mop_v1.glb",
  mop_v2: "assets/models_blender/mop_v2.glb",
  mop_v3: "assets/models_blender/mop_v3.glb",
  mop_v4: "assets/models_blender/mop_v4.glb",
  notepads_v1: "assets/models_blender/notepads_v1.glb",
  notepads_v2: "assets/models_blender/notepads_v2.glb",
  notepads_v3: "assets/models_blender/notepads_v3.glb",
  notepads_v4: "assets/models_blender/notepads_v4.glb",
  oiltin_v1: "assets/models_blender/oiltin_v1.glb",
  oiltin_v2: "assets/models_blender/oiltin_v2.glb",
  oiltin_v3: "assets/models_blender/oiltin_v3.glb",
  oiltin_v4: "assets/models_blender/oiltin_v4.glb",
  pallet_v1: "assets/models_blender/pallet_v1.glb",
  pallet_v2: "assets/models_blender/pallet_v2.glb",
  pallet_v3: "assets/models_blender/pallet_v3.glb",
  pallet_v4: "assets/models_blender/pallet_v4.glb",
  payphone_v1: "assets/models_blender/payphone_v1.glb",
  payphone_v2: "assets/models_blender/payphone_v2.glb",
  payphone_v3: "assets/models_blender/payphone_v3.glb",
  payphone_v4: "assets/models_blender/payphone_v4.glb",
  powerbox_v1: "assets/models_blender/powerbox_v1.glb",
  powerbox_v2: "assets/models_blender/powerbox_v2.glb",
  powerbox_v3: "assets/models_blender/powerbox_v3.glb",
  powerbox_v4: "assets/models_blender/powerbox_v4.glb",
  propane_v1: "assets/models_blender/propane_v1.glb",
  propane_v2: "assets/models_blender/propane_v2.glb",
  propane_v3: "assets/models_blender/propane_v3.glb",
  propane_v4: "assets/models_blender/propane_v4.glb",
  pump_v1: "assets/models_blender/pump_v1.glb",
  pump_v2: "assets/models_blender/pump_v2.glb",
  pump_v3: "assets/models_blender/pump_v3.glb",
  pump_v4: "assets/models_blender/pump_v4.glb",
  register_v1: "assets/models_blender/register_v1.glb",
  register_v2: "assets/models_blender/register_v2.glb",
  register_v3: "assets/models_blender/register_v3.glb",
  register_v4: "assets/models_blender/register_v4.glb",
  roadsign_v1: "assets/models_blender/roadsign_v1.glb",
  roadsign_v2: "assets/models_blender/roadsign_v2.glb",
  roadsign_v3: "assets/models_blender/roadsign_v3.glb",
  roadsign_v4: "assets/models_blender/roadsign_v4.glb",
  rock_v1: "assets/models_blender/rock_v1.glb",
  rock_v2: "assets/models_blender/rock_v2.glb",
  rock_v3: "assets/models_blender/rock_v3.glb",
  rock_v4: "assets/models_blender/rock_v4.glb",
  shelf_v1: "assets/models_blender/shelf_v1.glb",
  shelf_v2: "assets/models_blender/shelf_v2.glb",
  shelf_v3: "assets/models_blender/shelf_v3.glb",
  shelf_v4: "assets/models_blender/shelf_v4.glb",
  snack_v1: "assets/models_blender/snack_v1.glb",
  snack_v2: "assets/models_blender/snack_v2.glb",
  snack_v3: "assets/models_blender/snack_v3.glb",
  snack_v4: "assets/models_blender/snack_v4.glb",
  sodacan_v1: "assets/models_blender/sodacan_v1.glb",
  sodacan_v2: "assets/models_blender/sodacan_v2.glb",
  sodacan_v3: "assets/models_blender/sodacan_v3.glb",
  sodacan_v4: "assets/models_blender/sodacan_v4.glb",
  stool_v1: "assets/models_blender/stool_v1.glb",
  stool_v2: "assets/models_blender/stool_v2.glb",
  stool_v3: "assets/models_blender/stool_v3.glb",
  stool_v4: "assets/models_blender/stool_v4.glb",
  streetlight_v1: "assets/models_blender/streetlight_v1.glb",
  streetlight_v2: "assets/models_blender/streetlight_v2.glb",
  streetlight_v3: "assets/models_blender/streetlight_v3.glb",
  streetlight_v4: "assets/models_blender/streetlight_v4.glb",
  toolbox_v1: "assets/models_blender/toolbox_v1.glb",
  toolbox_v2: "assets/models_blender/toolbox_v2.glb",
  toolbox_v3: "assets/models_blender/toolbox_v3.glb",
  toolbox_v4: "assets/models_blender/toolbox_v4.glb",
  trashbag_v1: "assets/models_blender/trashbag_v1.glb",
  trashbag_v2: "assets/models_blender/trashbag_v2.glb",
  trashbag_v3: "assets/models_blender/trashbag_v3.glb",
  trashbag_v4: "assets/models_blender/trashbag_v4.glb",
  trashcan_v1: "assets/models_blender/trashcan_v1.glb",
  trashcan_v2: "assets/models_blender/trashcan_v2.glb",
  trashcan_v3: "assets/models_blender/trashcan_v3.glb",
  trashcan_v4: "assets/models_blender/trashcan_v4.glb",
  utilbox_v1: "assets/models_blender/utilbox_v1.glb",
  utilbox_v2: "assets/models_blender/utilbox_v2.glb",
  utilbox_v3: "assets/models_blender/utilbox_v3.glb",
  utilbox_v4: "assets/models_blender/utilbox_v4.glb",
  utilpole_v1: "assets/models_blender/utilpole_v1.glb",
  utilpole_v2: "assets/models_blender/utilpole_v2.glb",
  utilpole_v3: "assets/models_blender/utilpole_v3.glb",
  utilpole_v4: "assets/models_blender/utilpole_v4.glb",
  wallclock_v1: "assets/models_blender/wallclock_v1.glb",
  wallclock_v2: "assets/models_blender/wallclock_v2.glb",
  wallclock_v3: "assets/models_blender/wallclock_v3.glb",
  wallclock_v4: "assets/models_blender/wallclock_v4.glb",
  wetfloor_v1: "assets/models_blender/wetfloor_v1.glb",
  wetfloor_v2: "assets/models_blender/wetfloor_v2.glb",
  wetfloor_v3: "assets/models_blender/wetfloor_v3.glb",
  wetfloor_v4: "assets/models_blender/wetfloor_v4.glb",
  wrench_v1: "assets/models_blender/wrench_v1.glb",
  wrench_v2: "assets/models_blender/wrench_v2.glb",
  wrench_v3: "assets/models_blender/wrench_v3.glb",
  wrench_v4: "assets/models_blender/wrench_v4.glb",
  vehicle_compact: "assets/models_blender/vehicle_compact.glb",
  vehicle_sedan: "assets/models_blender/vehicle_sedan.glb",
  vehicle_estate: "assets/models_blender/vehicle_estate.glb",
  vehicle_coupe: "assets/models_blender/vehicle_coupe.glb",
  vehicle_work_pickup: "assets/models_blender/vehicle_work_pickup.glb",
  vehicle_canopy_pickup: "assets/models_blender/vehicle_canopy_pickup.glb",
  vehicle_service_van: "assets/models_blender/vehicle_service_van.glb",
  vehicle_delivery: "assets/models_blender/vehicle_delivery.glb",
  vehicle_tractor: "assets/models_blender/vehicle_tractor.glb",
  vehicle_fuel_tanker: "assets/models_blender/vehicle_fuel_tanker.glb",
  blood_small_pool: "assets/models_blender/blood_small_pool.glb",
  blood_wide_pool: "assets/models_blender/blood_wide_pool.glb",
  blood_long_smear: "assets/models_blender/blood_long_smear.glb",
  blood_droplet_trail: "assets/models_blender/blood_droplet_trail.glb",
  blood_fine_spray: "assets/models_blender/blood_fine_spray.glb",
  blood_handprint: "assets/models_blender/blood_handprint.glb",
  blood_finger_drag: "assets/models_blender/blood_finger_drag.glb",
  blood_shoeprint: "assets/models_blender/blood_shoeprint.glb",
  blood_heel_scuff: "assets/models_blender/blood_heel_scuff.glb",
  blood_seeping_patch: "assets/models_blender/blood_seeping_patch.glb",

  letter_closing: "assets/models_blender/letter_closing.glb",
  letter_service: "assets/models_blender/letter_service.glb",
  letter_coffee: "assets/models_blender/letter_coffee.glb",
  letter_delivery: "assets/models_blender/letter_delivery.glb",
  letter_envelope: "assets/models_blender/letter_envelope.glb",

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
  stationDetails: "assets/models_blender/station_details.glb",
  product_trail_oats: "assets/models_blender/product_trail_oats.glb",
  product_saltines: "assets/models_blender/product_saltines.glb",
  product_coffee_tin: "assets/models_blender/product_coffee_tin.glb",
  product_noodle_cup: "assets/models_blender/product_noodle_cup.glb",
  product_honey_jar: "assets/models_blender/product_honey_jar.glb",
  product_water_bottle: "assets/models_blender/product_water_bottle.glb",
  product_orange_carton: "assets/models_blender/product_orange_carton.glb",
  product_cola_bottle: "assets/models_blender/product_cola_bottle.glb",
  product_soap_pump: "assets/models_blender/product_soap_pump.glb",
  product_oil_quart: "assets/models_blender/product_oil_quart.glb",
  product_sardine_tin: "assets/models_blender/product_sardine_tin.glb",
  product_batteries: "assets/models_blender/product_batteries.glb",
  product_bread_loaf: "assets/models_blender/product_bread_loaf.glb",
  product_towel_roll: "assets/models_blender/product_towel_roll.glb",
  product_jerky_pouch: "assets/models_blender/product_jerky_pouch.glb",


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

  // ——— the one thing still from outside: the character rig ————————
  // A skeleton and 46 animation clips (Quaternius, CC0). Rigging and
  // animating a human is not the same job as modelling a bottle.
  human:         "assets/characters/AnimationLibrary_Godot_Standard.gltf",
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
  const options = VARIANTS[key];
  const use = variantUse.get(key) || 0;
  const chosen = options && opts.variant !== false ? options[(opts.variant ?? use) % options.length] : key;
  if (options && opts.variant === undefined) variantUse.set(key, use + 1);
  const path = MODEL[chosen] || chosen;
  try {
    const g = await loadGLTF(path);
    const inst = opts.skinned ? skinClone(g.scene) : g.scene.clone(true);
    if (opts.pick || opts.drop) selectParts(inst, opts.pick, opts.drop);
    unify(inst, opts);
    inst.userData.assetVariant = chosen;
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
