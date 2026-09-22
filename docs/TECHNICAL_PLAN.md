# THE NIGHT COUNT — Technical Plan

## Starting point

The project began as an empty directory. There was no engine, no existing
code, and no instruction to preserve. Constraints found by inspection:

| Constraint | Consequence |
|---|---|
| No game engine installed, and installing one was out of scope | the engine had to be something already present: a browser |
| Must run on **Windows as well as macOS** | rules out anything platform-native; a browser build is identical on both |
| No GPU-heavy hardware assumed | 640×360 internal resolution, Lambert shading, ≤13 lights |
| Assets had to be fetched over the network | build tooling is Python + `curl`; the shipped game has no build step |

## Choice: three.js r160, vendored, no bundler

**Why three.js:** it is the only 3D runtime available without installing
anything, it loads glTF (which is what every CC0 model source publishes), it
does skinned animation, spatial audio, render targets and viewport scissoring
(needed for the quad-view camera bank), and it runs the same on both target
platforms.

**Why vendored, not CDN:** the finished game must run from a folder, offline,
forever. `vendor/three.module.js` is committed with its MIT licence text.

**Why no bundler:** ES modules with an import map. No build step means no
toolchain rot, and the source that ships is the source that was written.

**Rejected:** Unity/Godot/Unreal (installation), WebGPU (support), a custom
renderer (pointless), React or any UI framework (the UI is a character grid and
a hardware panel; a framework would only get in the way).

## Rendering

```
scene ──► WebGLRenderTarget 640×360 (nearest) ──► composite shader ──► canvas
```

The composite pass is the art direction:

| Stage | Purpose |
|---|---|
| low internal resolution + nearest upscale | 1997 pixel size; also the performance budget |
| ordered 4×4 Bayer dither to ~26 levels | period colour banding; unifies mismatched source assets |
| chromatic aberration, radial | lens character without a blur pass |
| grain, vignette | film/CRT grade; both player-adjustable |
| `uFeed` branch | desaturate + scanline + noise: the security-camera look |
| `uTape` branch | line jitter and roll: VHS playback |
| `uFade` | scene fades without a DOM overlay |

Materials are **all** `MeshLambertMaterial` with a single 256/512px diffuse
map. Photoscanned Poly Haven props, low-poly poly.pizza vehicles and flat level
boxes therefore respond to light identically, which is what makes three asset
sources read as one game.

Lighting is physically-unit'd (r155+): point lights ×26, spots ×42 over the
readable values in `station.js`. Two shadow casters maximum.

## Module map

```
src/
  main.js            boot, frame loop, feed switching
  core/
    renderer.js      render targets, composite pass, quad viewports
    assets.js        glTF cache, material unifier, scale normalisers
    audio.js         layered adaptive mix, buses, 3D, subtraction
    player.js        movement, AABB collision, head bob, footsteps
    interact.js      look-at hotspot registry
    ui.js            HUD, subtitles, title cards, focus surfaces
    input.js         keyboard/mouse, pointer lock, rebinding
    settings.js      persisted settings + live apply
    dev.js           debug API (only reachable from the console)
  world/
    station.js       level geometry, colliders, doors, lights, anchors
    props.js         placement of every downloaded model
  systems/
    register.js      the DTS terminal: departments, tender, change, receipt
    cameras.js       six feeds, quad, sequence, OSD, incident log
    power.js         five circuits, four-circuit service, spoilage
    chores.js        clock, urn, meters, restock, mop, trash, lock-up
    docs.js          paper, notebook, the cabinet, the employee file
    phone.js         calls and radio
  game/
    game.js          the hub: modes, clock, checkpoints, cutscenes
    state.js         all persistent story state
    tasks.js         objectives = pacing
    nights.js        the six shift scripts
    arrivals.js      one customer, start to finish
    customers.js     rig instancing, vertex-colour clothing, pathing
    attendant.js     the threat's three stages
    endings.js       decision + three ending sequences
    documents.js     every readable thing in the station
  ui/
    screen.js        80×25 text-mode screen (menus)
    menu.js          main/pause/settings/credits
    credits.js       generated from the asset receipts
    style.css        HUD, register, multiplexer, paper
```

Progression is explicit state, never a chain of delays: night scripts `await`
**tasks**, so a slow player is never overtaken and a fast one never waits.

## Performance

Target: 60 fps at 1080p on integrated graphics; the internal buffer is
640×360 so fragment cost is nearly fixed regardless of window size.

- draw calls ≈ 300–500 (dominated by shelf stock, all shadow-off)
- two shadow-casting lights, 1024² maps
- security feeds render at **12 fps**, not 60, and only while a monitor is open
- quad view = four viewport renders in one pass, still frame-limited
- audio decoded once at startup (67 files, ~7 MB)

## Save

`localStorage`, one slot, written at every night boundary and on demand from
the pause menu. The save is the whole `state.data` object; reloading rebuilds
the night from it. Settings persist separately so they survive a new game.

## Known technical limitations

- The browser will not let audio start before a user gesture, so the first
  click is what wakes the station up.
- Pointer lock is refused inside some embedded/preview contexts; the game
  still plays, mouse-look just needs the window focused.
- Background tabs throttle `requestAnimationFrame`; the game effectively
  pauses. Cutscene timing was deliberately moved off `rAF` so a backgrounded
  tab cannot strand a cutscene with the player frozen.


## Cutscene budget — justified per the discipline prompt

The prompt requires each cutscene to be justified here. Twelve in the whole
game; the full table is in `CHANGES.md`.

| Use | Count | Why gameplay cannot do it |
|---|---|---|
| Arrival at the top of a night | 6 | the player is not in the space yet — it is the title card and the emotional reset |
| Losing control **is** the content | 3 | Night 2's blackout on the tile, Night 4's two hours asleep, Night 6 unable to move while the light shakes |
| A jump the player cannot walk | 2 | the drive to the aunt's, the road before the crash |
| The ending | 1 | once |

Two were converted to playable during the beta pass and are documented there:
Night 4's bathroom, and Night 2's walk back from the pole. The Night 5
lightning sequence was built playable from the start and is the clearest case
for the rule — he cannot run and cannot fight, so all he can do is keep looking
or stop looking, and that is the entire scene.

**Tested specifically**: a full six-night playthrough with ESC held down
through every cutscene reaches the ending with no lost flags and nothing stuck.

## Interaction inventory

`docs/INTERACTION_LIST.md` is checked against the source with
`python3 tools/interactions.py`, which enumerates every `Interactor.add()`.
The document had previously drifted into describing a fiction the game no
longer tells; a hand-maintained list of fifty-five things always will.
