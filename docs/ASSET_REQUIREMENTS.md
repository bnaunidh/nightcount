# THE NIGHT COUNT — Asset Requirements

Status key: **MH** must have · **U** useful · **O** optional · **GOT** obtained ·
**FINAL** shipped as-is · **SUB** substituted · **PROC** procedural/in-engine ·
**CUT** cut from scope.

Full provenance for everything marked GOT is in `ASSET_MANIFEST.md`,
`AUDIO_ASSET_MANIFEST.md` and `ANIMATION_ASSET_MANIFEST.md`.

---

## 3D — architecture

| Asset | Need | Status | Source / note |
|---|---|---|---|
| Convenience-store shell (walls, floor, ceiling, partitions) | MH | PROC/FINAL | level geometry, `station.js` — see *Custom geometry* in ASSET_MANIFEST |
| Shopfront glazing, mullions, knee wall, header | MH | PROC/FINAL | must match sightlines from the register |
| Sales counter, back bar | MH | PROC/FINAL | dimensions set by the customer/attendant standing positions |
| Shelf gondolas (double-sided, 4 shelves) | MH | PROC/FINAL | product placement is generated onto them |
| Cooler run + glass | MH | PROC/FINAL | doubles as a light source |
| Fuel canopy, deck, fascia, columns | MH | PROC/FINAL | fascia is an unlit band so it can be killed with the circuit |
| Pump islands | MH | PROC/FINAL | |
| Roller-shutter door | U | GOT/FINAL | Poly Haven `rollershutter_door` |
| Restroom fittings | U | SUB | tiled surface + fixtures implied; the room is deliberately bare |

## 3D — store fixtures and equipment

| Asset | Need | Status | Source |
|---|---|---|---|
| Cash register | MH | GOT/FINAL | Poly Haven `CashRegister_01` |
| Shelving unit (stock room) | MH | GOT/FINAL | Poly Haven `Shelf_01` |
| Fluorescent ceiling fixtures ×7 | MH | GOT/FINAL | Poly Haven `mounted_fluorescent_lights` |
| Security cameras ×6 | MH | GOT/FINAL | Poly Haven `security_camera_01/02` |
| CRT monitors ×4 (the bank) | MH | GOT/FINAL | Poly Haven `Television_01` |
| Breaker panel / utility boxes | MH | GOT/FINAL | Poly Haven `power_box_01`, `utility_box_01/02` |
| Coffee machine | MH | GOT/FINAL | poly.pizza |
| Refrigerated case | U | SUB | cooler is level geometry; the low-poly case model was redundant |
| Trash cans, bin bag | MH | GOT/FINAL | Poly Haven `metal_trash_can`, `trashbag` |
| Mop, bucket, broom, wet-floor sign | MH | GOT/FINAL | poly.pizza + Poly Haven |
| Fire extinguisher, fire alarm | U | GOT/FINAL | Poly Haven |
| Office desk, filing cabinet, stool | MH | GOT/FINAL | Poly Haven |
| Radio (boombox), alarm clock, wall clock | U | GOT/FINAL | Poly Haven |
| Binder, notepads, receipt paper | MH | GOT/FINAL | Poly Haven `binder_notebook`, `office_notepads` |
| Flashlight | U | GOT/FINAL | Poly Haven `vintage_flashlight` |
| Cardboard boxes, crates, pallet, hand truck, ladder | MH | GOT/FINAL | Poly Haven + poly.pizza |
| Toolbox, pipe wrench | O | GOT/FINAL | Poly Haven |
| Payphone | MH | GOT/FINAL | poly.pizza (Poly Haven's is a Korean unit — kept as the interior reference, low-poly used outside) |
| VHS deck | U | SUB | implied by the monitor stack; the deck is a UI surface |

## 3D — products

| Asset | Need | Status | Source |
|---|---|---|---|
| Canned food, long-life food | MH | GOT/FINAL | Poly Haven |
| Bottles (gallon, cleaner, bleach) | MH | GOT/FINAL | Poly Haven |
| Motor oil tin / can | MH | GOT/FINAL | Poly Haven |
| Soda can, chips bag, snack | MH | GOT/FINAL | poly.pizza (Kenney, iPoly3D, accidentallyc) |
| Cigarette pack | MH | GOT/FINAL | Poly Haven — the item at the centre of the plot |
| Fictional branded labels | U | PROC | see `GEMINI_ASSET_PROMPTS.md`; no image model was available |

## 3D — exterior

| Asset | Need | Status | Source |
|---|---|---|---|
| Fuel pumps ×4 | MH | GOT/FINAL | poly.pizza, **recoloured to Meridian livery in code** |
| Roadside price sign | MH | GOT/FINAL | poly.pizza `road_sign` + unlit face plane |
| Street lights, utility pole | MH | GOT/FINAL | poly.pizza |
| Dumpster | MH | GOT/FINAL | poly.pizza |
| Propane cage/tanks, barrels, jerrycans | U | GOT/FINAL | poly.pizza + Poly Haven |
| Traffic cones, manhole cover | O | GOT/FINAL | poly.pizza + Poly Haven |
| Desert bushes, rocks (44 scattered) | MH | GOT/FINAL | poly.pizza |
| Newspaper box | O | GOT/FINAL | poly.pizza |

## 3D — vehicles

| Asset | Need | Status | Source |
|---|---|---|---|
| Sedan (customers, 1972 + 1997) | MH | GOT/FINAL | poly.pizza |
| Pickup (the hauler, the two in the truck) | MH | GOT/FINAL | poly.pizza |
| Semi truck (the trucker) | MH | GOT/FINAL | poly.pizza |
| Delivery van (Night 6 lot) | U | GOT/FINAL | poly.pizza |
| Fuel tanker (Night 4) | MH | GOT/FINAL | poly.pizza |
| Danny's Nova, under a cover | MH | GOT/FINAL | Poly Haven `covered_car` — the single most important prop in the lot |
| Police vehicle | O | CUT | no police ever come; that is the point |

## 3D — characters

| Asset | Need | Status | Source |
|---|---|---|---|
| Rigged human body | MH | GOT/FINAL | Quaternius Universal Animation Library mannequin mesh (CC0) |
| Clothed customer variants ×8 | MH | SUB/FINAL | **procedural vertex-colour clothing by height band** + rigid cap/hat, applied per cast member (`customers.dress`) |
| The Attendant | MH | SUB/FINAL | same rig, Meridian-uniform palette, `Walk_Formal_Loop` |
| Faces | U | CUT | deliberately: at 640×360 in a dark store, a face would be four pixels and a lie |

*Why substituted:* the only CC0 rig obtainable non-interactively ships as an
undressed mannequin (Quaternius' dressed **Base Characters** pack is behind an
itch.io download flow that could not be completed here). Rather than mix a
blocky toy-proportioned pack into a photographic set, the mannequin was dressed
in code. See ANIMATION_ASSET_MANIFEST for the searches run.

## Animation

| Asset | Need | Status | Source |
|---|---|---|---|
| Idle, talking idle, walk, formal walk | MH | GOT/FINAL | Quaternius UAL (CC0) |
| Interact, pick-up, push (restocking) | MH | GOT/FINAL | Quaternius UAL |
| Kneeling fix (mopping), crouch idle | MH | GOT/FINAL | Quaternius UAL |
| Sitting enter/idle/exit | U | GOT/FINAL | Quaternius UAL |
| Death | U | GOT/FINAL | Quaternius UAL — the Count ending only |
| Doors, drawer, shutter, fan, vehicles | MH | PROC/FINAL | one-degree-of-freedom mechanisms, animated from state |

## Audio

| Group | Need | Status | Source |
|---|---|---|---|
| Interior ambience (fluorescent, cooler, freezer, room tone, HVAC, fan, CRT, neon, clock) | MH | GOT/FINAL | Freesound CC0 ×10 |
| Exterior ambience (desert wind, gusts, highway, insects, power lines, rain, thunder) | MH | GOT/FINAL | Freesound CC0 ×7 |
| Vehicles (idle, arrive, leave, doors, diesel, air brake, passing) | MH | GOT/FINAL | Freesound CC0 ×7 |
| Store interactions (chime, doors, register, scanner, drawer, coins, receipt, paper, keys, locks, switches, breaker, fridge, bottles, cans, cardboard, bags, mop, broom, trash, dumpster, toilet, sink, phone, radio, VHS, pumps, coffee, punch clock) | MH | GOT/FINAL | Freesound CC0 ×30 |
| Footsteps (lino, concrete, gravel) | MH | GOT/FINAL | Freesound CC0 ×3 |
| Horror one-shots (knock, thump, distant metal, creaks, rumble, shelf, bottle, glass, static, tape, drone) | MH | GOT/FINAL | Freesound CC0 ×11 |
| Human non-verbal (breath, scared breath, sigh, gasp, whisper, cough, murmur, crying, distant scream, radio voice) | MH | GOT/FINAL | Freesound CC0 ×10 — see VOICE_ASSET_MANIFEST |
| Music | O | CUT | deliberately: the game has no score. The ambience *is* the score, and its subtraction is the loudest event in the game. |
| Voice acting | MH→SUB | SUB | see `VOICE_ASSET_MANIFEST.md` |

## 2D / UI

| Asset | Need | Status | Source |
|---|---|---|---|
| Surface textures ×16 | MH | GOT/FINAL | Poly Haven CC0, 512px diffuse |
| Documents (11 written pieces) | MH | PROC/FINAL | typeset HTML/CSS, `documents.js` |
| Menu system | MH | PROC/FINAL | 80×25 text-mode renderer, `ui/screen.js` |
| Register terminal face | MH | PROC/FINAL | CSS hardware panel with a 20×2 VFD |
| Camera OSD | MH | PROC/FINAL | CSS over live render |
| Fonts | MH | FINAL | system monospace stacks only — no network fonts, so the build stays offline |
| Loading screen art | O | PROC | the boot bar; a plate is specified in GEMINI_ASSET_PROMPTS if wanted |

## Particles / effects

| Asset | Need | Status | Note |
|---|---|---|---|
| Grain, aberration, dither, vignette | MH | PROC/FINAL | composite shader |
| CRT scanline + noise | MH | PROC/FINAL | `uFeed` branch |
| VHS jitter/roll | MH | PROC/FINAL | `uTape` branch |
| Light flicker | MH | PROC/FINAL | with a reduce-flicker accessibility option |
| Spill decal | MH | PROC/FINAL | geometry |
| Dust motes, breath fog | O | CUT | cost outweighed the payoff at this resolution |
