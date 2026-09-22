# THE NIGHT COUNT — Test Plan and Results

Everything here is run against **the shipped single file**, not the dev build,
because the two have diverged before and it was the shipped one that was
broken. See "Things that were only ever broken in the build people play".

## The suite

| Tool | What it proves | Fails on |
|---|---|---|
| `tools/playtest.js` | plays all six nights through the real scripts, real interactions, real register | a night that stalls, a task that cannot be completed, a beat that never fires |
| `tools/audit.js` | measures the real scene graph — floating, unsupported, buried, doorway clearance, overlaps, NaN | anything placed wrong in the world |
| `tools/audiocheck.py` | slot ↔ file coverage | a sound played with no file, or registered with no file |
| `tools/assetcheck.py` | magic bytes, size, duplicates, glTF parse, URI resolution | a corrupt, banned or duplicated asset |
| `tools/interactions.py` | enumerates every `Interactor.add()` | the interaction list drifting from the game |

Run them:

```bash
python3 tools/serve.py 8843      # no-store, or you will test stale modules
python3 tools/audiocheck.py && python3 tools/assetcheck.py && python3 tools/interactions.py
```

Then in the page: `await __audit()`, and `await __playtest()`.

## Latest results

**Three consecutive full playthroughs of the shipped file, identical every
time:**

| | run 1 | run 2 | run 3 |
|---|---|---|---|
| ending reached | `tennineteen` | `tennineteen` | `tennineteen` |
| clues | 43 | 43 | 43 |
| served / failed | 9 / 0 | 9 / 0 | 9 / 0 |
| story beats missing | **0 of 16** | **0 of 16** | **0 of 16** |
| nights stuck | 0 | 0 | 0 |
| console errors / warnings | 0 | 0 | 0 |

No flakiness: the run is deterministic end to end.

| Check | Result |
|---|---|
| scene audit | 0 floating · 0 unsupported · 0 buried · 0 doorway · 0 overlaps · 0 NaN |
| scene stability across six nights | 904 objects · 625 meshes · 13 lights — **identical every night** |
| draw calls / triangles | 161 / 51,020 |
| scene pass | 0.5 ms canopy dark · 0.8 ms lit |
| assets | 345 files · **0 duplicates** · 0 bad magic |
| audio coverage | 0 phantom · 0 ghost · 0 orphan · 103 slots all decode |
| mix | 0 clipping · 1 quiet outlier · median effective RMS on target |

## Test cases

### Progression

| # | Case | Result |
|---|---|---|
| P-1 | all six nights reach the ending | ✔ |
| P-2 | every night's own beats fire in that night | ✔ *(this failed until Night 3's content was moved out of Night 2)* |
| P-3 | no task is left unticked without a reason | ✔ — only Night 4's abandoned shift, labelled **SHIFT ABANDONED · 02:24** |
| P-4 | refusing every customer still finishes | ✔ 0 served, 9 refused, ending reached |
| P-5 | the ending plays start to finish | ✔ credits → hospital → Noah → corridor → thanks |

### The player doing the wrong thing

| # | Case | Result |
|---|---|---|
| W-1 | skip every cutscene with ESC | ✔ ending reached, no lost flags |
| W-2 | quit mid-shift and continue | ✔ night, ticked tasks, remaining salt, clues and choices all survive; not frozen on return |
| W-3 | start a new game straight after finishing | ✔ *(this froze the player until `startNight` was made to clear it)* |
| W-4 | touch a breaker on Night 3 | ✔ *(this used to trip the main and black out the building through no fault of the player's)* |
| W-5 | never do a task at all | ✔ every scripted wait has a timeout; nothing deadlocks |

### Accessibility

| # | Case | Result |
|---|---|---|
| A-1 | subtitles off / on | ✔ hides and restores |
| A-2 | subtitle size 0.8×–1.8× | ✔ applies through the settings bus |
| A-3 | reduce flicker | ✔ substitutes a toast for the flicker |
| A-4 | scare volume to zero | ✔ safe; also suppresses the caught-breath reaction, which is correct |
| A-5 | **every sound in Night 4's blackout is captioned** | ✔ — a scene made of sound must not lock anyone out |
| A-6 | no interaction needs colour, reaction speed or hearing | ✔ |

## Things that were only ever broken in the build people play

The reason everything is tested against the single file:

- **Every dialogue portrait was an empty box.** The shipped build hides its
  assets behind a patched `fetch` and three's `setURLModifier`; neither covers
  the DOM, and a portrait is an `<img>`. It resolved perfectly in the dev
  build. Found by reading a 404 log, not by playing.
- **The boot plate 404'd** for the same reason.

## Bugs found by this suite

In rough order of how badly they would have read to a tester:

1. Night 3's entire content was inside `night2` — the five-dollar man and the
   01:58 branch fired a night early, and Night 3 had neither. **Found by
   testing one night at a time; a playthrough cannot see it.**
2. Every dialogue portrait missing in the shipped build.
3. Night 1's restock asked for ten units and the world had three gaps, so the
   first night of the game had a task that could not be completed.
4. `setClock` threw the clock eighteen hours backwards after midnight, so a
   slow player could not open the station for the rest of the night.
5. From Night 3 the station started over its own power capacity.
6. Starting a night never cleared `player.frozen`.
7. Night 1's bin bag could not be picked up at all (task id mismatch).
8. Three sounds were played with no file behind them; `Audio.load()` swallows
   the 404 by design, so nothing ever reported it.
9. Loudness compensation was peak-based; 28 of 103 files were effectively
   inaudible, including the ambience beds the whole mix rests on.
10. A shadow-casting light at intensity zero, costing 44% of the scene pass.

## Known open

- **Frame rate on weak hardware is unmeasured.** The preview renders offscreen,
  so only the composite pass draws and timings are meaningless there. The
  static numbers (161 calls, 51k triangles, 0.5–0.8 ms scene pass on this
  machine) are healthy, but a real reading needs a real machine. **This is the
  one thing to ask beta testers about directly.**
- `int_fridge_door` and `veh_truck_airbrake` are present and unreferenced —
  held for the walk-in and for a beat that has not been written.
- `int_vhs` is the one sound still below the audibility target; it is
  peak-limited by a loud transient over a quiet body.

## Two known audit false positives

Both appear only once the world is fully populated, which is why night-start
audits read zero:

- **`overlaps: 34`** — every pair is a parked car's own body panels against
  each other (`NormalCar2_Cube002-Mesh` vs `…_3`, `…_5`). The check compares
  meshes without asking whether they belong to the same imported model, so a
  multi-part glTF flags itself. Not a placement fault; nothing is intersecting
  that should not be.
- **`invisible: ["service"]`** — the pole disconnect on Night 3. The hotspot
  sits just over a metre from the pole mesh, so the reach test misses it. The
  pole is plainly visible in front of the player when the task is live.

Neither is worth a code change this close to a beta; both are worth knowing
before someone reads the audit output and files them.
