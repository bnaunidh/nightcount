# THE NIGHT COUNT — Worklog

Running record of the vehicle/defect/polish pass. Kept current as work happens,
not written at the end. If you are picking this up cold, read this file, then
`docs/SECURITY_LOG.md`, then the master prompt.

---

## Baseline — measured before any change

Git tag: commit `b0157ae` — *"baseline: THE NIGHT COUNT as delivered"*.

### Scene audit (`tools/audit.js` → `__audit()`)

| Check | Baseline |
|---|---|
| floating props | **7** |
| unsupported props | 0 |
| buried props | **17** |
| doorway obstructions | **2** |
| mis-mounted hung props | **2** |
| overlapping level geometry | **15** |
| NaN transforms | 0 |
| `MISSING:` objects | 0 |
| console errors | 0 |
| console warnings | 0 |
| props tracked | 76 |
| colliders | 44 |
| geometries / textures / programs | 481 / 75 / 18 |

### Asset check (`tools/assetcheck.py`)

| Check | Baseline |
|---|---|
| banned file types | 0 |
| bad magic bytes | 1 *(`assets/characters/LICENSE`, a text file — benign, allowlisted)* |
| bad size | 0 |
| **duplicate files by hash** | **2** |
| unparsable glTF | 0 |
| external/dangling URIs | 0 |
| **material-referenced missing textures** | **1** |
| orphaned image entries (inert) | 117 |

### Confirmations of the master-prompt defect list

The audit independently reproduced these, with numbers matching §6:

- `newsbox` overlaps the **entry door aperture by 2.9 m** (§6.1) — the "table in the doorway"
- `pallet` overlaps the **rear service door by 0.85 × 0.42 m** (§6.6)
- `backbar` vs `back-bar` overlap **1.487 m³** (§6.3)
- canopy fascia vs deck overlap **22.85 m³** (§6.3)
- `prop_clock` nearest surface **0.48 m** (§6.2) — the floating clock
- floating: `extinguisher` 0.89, `firealarm` 1.59, `alarmclock` 0.77,
  `utilbox` 1.29, `ceilingfan` 2.85, `propane` 0.10 (§6.5)

---

## Deviations from the master prompt, with reasons

**§5.1 asks for a Playwright harness (`tools/audit.mjs`).** Built as an in-page
module (`tools/audit.js`) driven by the existing browser harness instead, and
installed nothing. Reason: the user's standing instruction across this project is
that no software is to be installed on their machine, and §3.5/§3.1 also prefer
not adding tooling. The checks are identical — same thresholds (Appendix D), same
nine categories. Trade-off: it must be invoked from a browser session rather than
from CI.

**Audit gotcha, learned the hard way:** the raycasts require
`scene.updateMatrixWorld(true)` first. In a throttled or hidden tab the render
loop does not run, world matrices go stale, and the audit reports *every*
floor-standing prop as unsupported. Two investigations were wasted on this before
it was spotted; `__audit()` now forces `dev.draw()` + `updateMatrixWorld` on
entry. Do not remove that.

---

## Done

### Phase 0 — harness
- `tools/audit.js` — nine checks from §5.1, thresholds from Appendix D, console
  capture installed before the game boots.
- `tools/scaleaudit.js` — raw bbox and widest÷height per model against a table of
  expected real-world dimensions. This is the check that catches the `newsbox`
  class of failure.
- `tools/assetcheck.py` — §3.4 as a repeatable pass: magic bytes, banned types,
  size sanity, **duplicate detection by hash**, glTF parse, URI resolution.
- `tools/strip_gltf_refs.py` — removes dead texture references from downloaded
  glTFs.

### Phase 1 — defects fixed so far
- **§6.12 — the 404.** `ceiling_fan.gltf` referenced
  `ceiling_fan_spec_1k.jpg` from a `KHR_materials_specular` extension; the file
  was never downloaded because `unify()` discards specular maps anyway. Stripped
  the reference. **Console errors and warnings are now 0.**
  - Worth recording: the asset check initially reported *117* missing texture
    references. Only **one** was real. The other 116 are image entries referenced
    by the `textures` array but by no material — GLTFLoader is lazy and never
    fetches them. `assetcheck.py` now separates the two so the report stays
    actionable rather than crying wolf.
- **§6.10 — the tanker.** `tanker.glb` was byte-identical to `car_pickup.glb`
  (md5 `7ceb24f2…`). Replaced — see `SECURITY_LOG.md` for the sourcing, including
  a **rejected** candidate that the new hash guard caught.
- **Self-inflicted duplicate found by the new check:** `int_pencil_tick.mp3` and
  `int_pencil_write.mp3` were the same recording. Re-sourced the write variant.

---

## Phase 1 complete — audit at zero

Re-measured after the fixes, on a clean load:

| Check | Baseline | Now |
|---|---|---|
| floating props | 7 | **0** |
| unsupported props | 0 | **0** |
| buried props | 17 | **0** |
| doorway obstructions | 2 | **0** |
| mis-mounted hung props | 2 | **0** |
| overlapping level geometry | 15 | **0** |
| NaN / MISSING | 0 / 0 | **0 / 0** |
| console errors / warnings | 0 / 0 | **0 / 0** |
| `settleProps` moved / orphan / unsettleable | 216 / 115 / 41 | **1 / 0 / 0** |
| geometries | 481 | **125** |

Regression check: full six-night `__playtest()` → **CLOSED OUT, 14 served, 0
failed, 21 clues**, console clean throughout. `__selftest()` 57/58 (the standing
audio-gesture gate).

### What each fix actually was

- **§6.1** `pick`/`drop` subtree selection added to `model()`. The trash can is
  two bins plus four loose handles; the payphone sits on a 72 m turntable; the
  "mop" is a mop-and-bucket set with a separate bucket and broom placed on top of
  it. The `newsbox` is a single mesh named `Paper` measuring 58.9 × 8.6 × 47.9 —
  not a newspaper box under any interpretation, and **removed** rather than
  faked. `desk` was being fitted by *width*, squashing a correct 2.00 × 0.79 ×
  0.92 m desk to 0.59 m tall, which is why everything "on" it floated.
- **§6.3** The back bar was built **twice** — the original hangs 0.9 m off the
  floor and intersected the newer one through 1.49 m³, directly behind the
  register. The canopy fascia was a *solid* box sunk 0.14 m into the deck
  (22.8 m³); it is now a four-panel band around the edge.
- **§6.4** Bigger than "no shelves": the cooler was **one solid box**, and all 78
  drinks placed "inside" it were sealed in solid geometry where they could never
  be seen. Rebuilt as a hollow cabinet — back, ends, top, kick, three shelves —
  with the stock re-seated and the shelf heights read from the station so the two
  cannot drift apart again.
- **§6.5** The monitor bank was not merely 0.41 m off the desk: its lower pair of
  monitors were *inside* the desk. Both rows now derive from one `DESK_TOP`.
  `prop_cam6` sat with its centre at y 3.16, above the 3.1 m ceiling, which is
  why no wall was near it in any direction.
- **§6.7** The `HUNG` regex is now an explicit set. `light` was matching
  `flashlight`; the same class of bug appeared again in my own first draft, where
  floor-standing props (mop, broom, payphone, pole) were listed as hung.

### Also fixed, not on the list

- **Dev-server module caching.** Two full fix-and-measure cycles reported "no
  change" because the browser was re-running cached ES modules.
  `tools/serve.py` now sends `Cache-Control: no-store`. Without it, no
  measurement on this project can be trusted.
- **A regression caught before it shipped:** rebuilding the fascia as a Group
  broke `power.js`, which did `canopyFascia.material.color.setHex(...)`. The
  shared material is now exposed as `canopyFasciaMat`.

## Phase 2 — the vehicle arrival sequence

`src/game/vehicles.js`. An explicit 19-state machine ticked from `update(dt)` —
no private `requestAnimationFrame`, no `setTimeout` chains. Arrival is now a
driven event: heard before it is seen, seen as headlights before it is seen as a
vehicle.

### Verified

| Check | Result |
|---|---|
| Full arrival, road → parked | **19.6 s** (§7.5 target 14–22) |
| Sequence | APPROACH_FAR → APPROACH_NEAR → TURN_IN → CROSS → PARKING → SETTLING → IDLING → ENGINE_OFF → LIGHTS_OFF → PARKED → WAITING |
| Final pose | lands exactly on the bay pose (0.00 m, 0.00 rad error) |
| Collider | attached only at PARKED; **dropped the instant it departs**; 0 left after departure; total returns to base |
| Abort from every reachable state (13) | 0 vehicles in scene, 0 colliders, 0 scene-object delta, no errors |
| Abort **during model load** | clean |
| Abort via `quitToMenu()` | clean — 0/0/0 |
| `oneHeadlight` (A5) | works — `[0, 340]` |
| Semi (8.8 m) | arrives in 23.8 s without stalling |

### The headlight sweep, measured rather than assumed

The first version was "correct" and invisible. At intensity 90 the beams added
**5.8%** mean brightness to the shopfront band — technically lit, visually
nothing. Two things were wrong:

1. **The route ran up the far side** at x ±10.5, outside the 18 m building, so
   the beams never crossed the glass at all. The route now comes *across the
   facade* before turning into the bay.
2. **The intensity was an order out** for a scene that already has a canopy
   spot. At 340 cd / 0.52 rad the delta is **15.4%** and plainly visible from
   behind the register.

Shadow budget: headlights never cast on low/medium; at most one vehicle casts on
high (`setShadowBudget()`).

### Integration bugs this surfaced

- **`c.vehicle.position` no longer existed.** `leave()` read `.position.x` off
  what is now a `Vehicle` instance (which owns `.group`), throwing inside a
  timer callback where nothing surfaced it. Added `CustomerSystem.vehiclePos()`.
- **A race in `arrivals.js`.** The `customer:counter` listener was attached
  *after* `await customers.arrive()`. Now that arrivals take ~20 s and the walk
  is driven from `update(dt)`, the customer can reach the counter inside the
  same update batch that resolves the arrival — firing the event into no
  listener, so the sale never opened and the night hung on "serve" forever with
  no error anywhere. The listener now goes on **before** the arrival, matches by
  id, and re-checks on resolve.
- **Ordering hardened:** `beginSale()` now runs *before* the line, the animation
  and the toast, with the presentation wrapped in try/catch. A missing clip must
  never be able to leave a customer at a counter with no transaction open.
- **Patience was counting during the drive-in.** `startedAt` is now set when
  they reach the counter — patience is how long they wait at the counter, not
  how long their car takes to park.

### RESOLVED — the A6/A7 regression

Traced properly by instrumenting `finish()` and running under the harness, which
is what the previous note said to do. The trace said it in one line:

```
{ id: "A6", why: "patience", waited: 22, patience: 22, counterDone: FALSE }
```

`counterDone: false` — **A6 never reached the counter.** The patience timer was
running from the top of the arrival, so the ~20 s drive-in plus the walk across
the forecourt consumed the whole 22-minute budget before they ever got inside.
Both casualties were the `living: true` customers because they are the two with
the short budget.

Before the vehicles were driven this was a second or two and cost nothing. The
fix is one line and is the correct semantic anyway: patience does not tick until
`counterDone`. Patience is how long they will stand at the counter waiting to be
served — their own journey is not the player keeping them waiting.

**After: all eight arrivals served, 14 served, 0 failed, 21 clues, CLOSED OUT.**
Back to the pre-vehicle baseline with the vehicle system in place.

The trace hooks are left in behind a `window.__arrTrace` guard — zero cost
unless a test sets the array, and they turned a two-session mystery into one
line of output.

### Previously OPEN — kept for the record

**A6 and A7 are recorded `failed` in automated runs where they previously
served.** Both are the `living: true` customers. `failCount` is therefore 2, and
**3 failures force THE COUNT ending** — so this is one step from changing which
ending an ordinary playthrough reaches. One run resolved `closedout`, a later
one resolved `null`.

What is ruled out: the vehicles themselves (the semi arrives in 23.8 s and
parks correctly), the listener race (fixed), and patience starting too early
(fixed). What is not yet known: whether the night script ends the shift before
the last arrival completes, or whether the harness's own stepping is at fault.

It could not be pinned down further this session because the cutscene path
needs the playtest harness's virtual timers — a hidden browser tab throttles
`setTimeout` to about 1 Hz, so night 1's opening cutscene never completes under
manual instrumentation. **Next session: instrument inside `__playtest()` rather
than around it.**

## Earlier findings, now addressed

- **The collider leak is not fully closed.** After a full run the collider count
  is 44 → 51, with six `vehicle:*` colliders still present. `_driveOff` now drops
  its own, so these are cars that never departed — parked arrivals still standing
  when the night ended. `clearAll()` ordering needs checking against a customer
  who is mid-departure at a night boundary (§6.9's second half).
- **Bay 2 overlaps pump 2.** A 5.4 m pickup parked at bay 2 `(6.0, −6.6)` spans
  x 3.3–8.7 and swallows the pump at `(3.4, −6.6)`. The bays and the pump islands
  were never checked against real vehicle lengths. Phase 2 route work must place
  a fuelling vehicle *alongside* its pump, not on top of it.

## Queued

Phase 1 remainder (§6.1–§6.9, §6.11), then Phase 2 (vehicles), then §8–§12.

**User request received mid-pass: "create a proper and good storyline."**
Reading before acting: the game already has a complete, internally consistent
story in `STORY_BIBLE.md` (the 1972 tanker fire at Mile 41, the Count, Meridian's
policy lineage, Danny, Form 41-C). My working assumption is that the *story is
not reaching the player during play* rather than that it is absent — most of it
currently lives in documents the player may never open. Planned response is to
strengthen delivery (what is spoken, shown, and forced into the player's path)
rather than replace the fiction, which would contradict §2.6 and the master
prompt's instruction to keep every clue consistent with the bible. To be
confirmed with the user if they meant otherwise.


---

## Story rewrite — the author's Nights 1–3

The author supplied a new storyline mid-pass. Per master prompt §15.2 the later
instruction wins, so `STORY_BIBLE.md` was rewritten around it and the old
fiction retired. The conflict is recorded at the bottom of that file.

| Was | Now |
|---|---|
| Wren Alcott, sister | an unnamed man in his twenties |
| Danny, her brother | **Jacob**, his friend |
| Meridian, October 1997 | Station 41, period unstated |
| 22:00–06:00 | **18:00 prep → 21:00 open → 06:00 close** |
| The Count | the disappearances, and Jacob |

### Built

- **The shift moved.** `SHIFT_START/OPEN/LATE/CLOSE` in `game.js`; the clock now
  begins at 18:00 and the prep phase is real.
- **Night 1 cold open**, the author's monologue beat for beat: the gravel, the
  radio cutting mid-song, the sign, the closure, the disappearances, the
  photograph with the tear wiped off it, *"…One of them was my friend."*,
  5:50, and *"Clean it, stock it, open it."*
- **The photograph** — a real document (`photo_jacob`) he takes out in the car.
- **The watch** (`src/systems/watch.js`). It buzzes when something is due, and
  `buzz("")` fires with nothing attached — same mechanism, no extra tell,
  because *when it goes off and you don't know why, that's the point*.
  Verified: all three Night 1 alarms fire.
- **Night 1 prep list** as written: note, supplies, clean 0/5, restock 0/10,
  pumps, readings, open at 21:00. New interactions for the crates, the pump
  check and opening up; `chores.setCleanQueue()` for a five-mess clean with a
  live counter.
- **The restroom.** The brown mess is the task; the blood underneath is not.
  `station.showBathBlood()`, revealed by mopping the restroom, never mentioned
  again.
- **02:36** — the watch buzzes with nothing due, then tyres, then the impact,
  the highway layer drops out, and `⚠ INVESTIGATE OUTSIDE — NOW`. Verified
  firing and completing.
- **Night 2** — rain, the radio, the thunder crack that is the wrong shape, one
  frame of Jacob in the flash (`attendant.flashAt`), the blood trail across the
  forecourt (`station.showForecourtBlood`), the restroom wall, the blackout and
  the THUD, *"…Then why is it still warm."*, and **03:14 "come here"**.
- Seven CC0 sounds sourced for the new beats (watch buzz and alarm, tyre
  screech, crash, heavy rain, thunder, mop bucket).
- `Danny → Jacob` across scripts, documents, endings and the portrait mapping;
  the lead is unnamed and the manager is "the owner" throughout.

### State at the end of this session — READ THIS FIRST

The build **boots clean and the scene audit is still zero across every
category**. The vehicle system, the Phase 1 fixes and the A6/A7 fix are all
verified and committed.

**Night 1 is not yet verified end to end.** An intermediate run had it working —
clock_in, note, supplies, clean (all five messes), pumps, readings, open, serve
and the 02:36 investigate beat all completing. After moving the blood listener
earlier (so it registers before the mopping) and re-gating the first customer on
`open` instead of the retired `binder` task, the harness stopped getting past the
opening cutscene inside my observation window. No errors are thrown, the file
parses, and every `tasks.wait()` in Night 1 now resolves to a task that exists —
so the most likely cause is simply that the settle loop plus a ~26 s cutscene
plus polling overhead exceeds the window, not a hang.

**Next session, in this order:**
1. Re-run `__playtest({night:1})` and watch it to completion rather than polling.
2. If it genuinely hangs, bisect: the cutscene is the only thing before
   `tasks.set`, so instrument `cs.wait` directly.
3. Then Nights 3–6 under the new fiction.

### Night 3 — supplied, not yet built

The author has since supplied Night 3 in full. Not started. It needs:

- **THE SALT** — one bag, **six pours**, and more thresholds than pours. A line
  holds; what it stops *goes around* rather than away. The player is never told
  the rules.
- The 21:40 tally scratched in the grout — four marks and a fifth cut across
  them — which he does not clean off.
- The 23:12 customer: pays five dollars for nothing, **three-way dialogue**
  (this is the first use of the choice system, which does not exist yet and must
  remember), *"Don't do five."*, and no car outside.
- The 01:58 branch — go out (the ditch, the casings, the receipt timestamped
  **tomorrow**, and the front door now unsalted) or stay in (the pumps running
  themselves to exactly **$19.72**).
- 03:14 in **the player's own voice**, with his mouth closed.
- The closing image: the salt line undisturbed, **footprints on both sides**.

---

## §9 — the audio coverage sweep

The master prompt's rule for this pass is two lines: *anything on the
interaction list that plays no sound is a defect, and anything that plays the
same sound as something else is a defect.* Checking that by playing the game is
hopeless — a missing sound and a correct silence are the same experience — so
it was done by instrumentation, and the instrument is now `tools/audiocheck.py`.

### The thing that made this necessary

`Audio.load()` has always swallowed a failed fetch:

```js
} catch (e) { /* missing sounds simply do not play */ }
```

That is the right call for robustness and it is why three separate bugs
survived to this point. **A slot name in `audio.js`'s `FILES` list is not
evidence that a file exists behind it**, and nothing anywhere said otherwise:

| Slot | Played from | What was actually happening |
|---|---|---|
| `int_pump_nozzle` | Night 3, the pumps running themselves | registered since the first pass; the original fetch query returned no CC0 candidate, the failure scrolled past, and the slot has been silent ever since |
| `int_regkey` | `choices.js`, every dialogue reply | referenced from the day the choice system was written; the file never existed |
| `int_box_open` | taking the broom and crates | a typo for `int_box_cardboard` |

All three now have files (D-03 in the security log) or point at one that
exists. `audiocheck.py` fails the build on both invisible classes —
played-with-no-file, registered-with-no-file — and only notes the tidy ones.

### Duplicates removed

- **Pick-ups.** `take()` played `int_box_cardboard` for a box and `int_bottle`
  for *everything else* — the mop, the bin bag and the broom all came up as a
  glass bottle. Each now sounds like itself, which is also the only cue telling
  you what is in your hands when it is off the bottom of the screen.
- **Opening up vs locking up.** Both were `int_lock`. Opening the station is
  now `int_keys` — the two most load-bearing moments of the shift were
  indistinguishable with your eyes shut.
- **The three shelf gaps** were three identical `int_can`s; they are now a can,
  a bag and a bottle.

### Silences filled

- **The breaker panel** — throwing a breaker had a sound, getting the panel
  open did not, so the most dangerous object in the building opened silently.
  Now `int_panel_metal`.
- **The restroom check** is two actions, so it is now two sounds.
- **Customers.** This is the real one. A person stood at your counter in
  *total silence* under a looping idle animation, which reads as scenery rather
  than as somebody waiting. `CustomerSystem._vox()` gives them breath, shifts,
  a cleared throat — and the pool and the *rhythm* both get less patient the
  longer you leave them. There is no patience bar on screen, so this is the
  mechanic rather than decoration on top of it: measured at 2 sounds in the
  first 20 seconds against 3 in the same span once they have been waiting 90.
- **He reacts to things.** Every scare in the game already passes
  `scare: true` for volume scaling, so `Audio._react()` hangs off that one flag
  instead of twelve call sites: a beat after something loud he catches his
  breath. Cooled down, so a scare made of three sounds is one reaction, not
  three — verified: loud → `hum_gasp`, mid → `hum_breath_scared`, quiet →
  nothing, burst of three → one, and it returns after the cooldown. It is the
  only thing in the mix coming from *inside* the player rather than from the
  building.

`_pending` is now bounded at 24. Anything that fires on a timer would otherwise
pile up for as long as the audio context stayed locked and then all arrive at
once the moment it opened.

## The portraits were broken in the shipped build

Found while reading the dev server's 404 log rather than by looking for it.

The single-file build hides the packed archive behind two redirects — a patched
`fetch` and three's `setURLModifier`. **Neither covers the DOM.** A dialogue
portrait is an `<img src>` and the boot plate is a CSS `background-image`, so
both asked the *server* for `assets/gen/…`, and in the shipped file there is no
server. In the dev build they resolved perfectly, which is exactly why this
survived: it was only ever broken in the build people actually play.

Confirmed by A/B rather than by reasoning — with the resolver hidden, the same
call produces `assets/gen/port_danny.jpg` → **404**; with it, a blob that
loads. Every dialogue portrait in every single-file build so far has been an
empty box.

`generated()` now resolves through `window.__NCRESOLVE` when it exists, which
fixes the boot plate and all eleven portraits in one place and changes nothing
in the dev build. Verified on the final build: 11/11 portraits load, the boot
plate decodes at 1024×576, and the only remaining 404 was `favicon.ico` — now
also gone, via an inline SVG of the roadside sign so a `file://` copy stops
asking for one.

### Verification for this pass

- `tools/audiocheck.py` — 0 phantom, 0 ghost, 0 orphan. 100 files, 100
  registered slots, 97 referenced in code.
- `tools/assetcheck.py` — 342 files, **0 duplicates**, 0 bad magic, 0 bad size.
- `__audit()` — 0 in every category, 0 console errors, 75 props, 44 colliders.
- All 100 audio slots return 200 in the dev build; the ten touched by this pass
  decode from the packed archive in the shipped build (checked on an
  `OfflineAudioContext`, which never touches an output device — the author is
  listening to music).

### Still open

- `int_fridge_door`, `hum_cry` and `mus_menu` are present and unreferenced.
  `mus_menu` is deliberate: the menu bed is `mus_dread`, because a neutral pad
  said *"atmospheric"* and this one says something is wrong with the building.
  The other two are held for the walk-in and for a beat that has not been
  written.
- Opening the register surface is still silent. Every candidate sound is
  already doing another job, and a beep shared with the department keys would
  trade one defect for the other one. Left alone on purpose, not missed.

## The playtest harness now runs

Before this, `__playtest({night:1})` had never completed. Previous sessions
recorded it as "hangs, investigate next time". Three separate faults, none of
them in the game:

**1. The runner deadlocked on itself.** Cutscene waits are built on
`performance.now()` and cannot be compressed, so the loop sleeps through them
in real time. That sleep was written as a bare `setTimeout` — *after*
`installVirtualTimers()` had replaced `setTimeout` with the virtual queue. The
timer went into the queue, and the only thing that drains the queue is
`advanceVirtual()` at the top of the next iteration, which never came because
the loop was awaiting the timer. **That is the "night 1 never starts" hang.**
The night was fine the whole time; the harness was waiting on itself. It now
uses `sleep()`, which captured the real `setTimeout` before the swap.

**2. Steps that could not fail.** Several were written `use("x") || true`, so
they reported success whether or not anything happened. `case "bins"` called
`use("trash")` — an interaction id that does not exist — and then returned
true anyway, which is why the log read `task bins` several thousand times
while nothing moved. A step that cannot fail is not a test; the `|| true`s are
gone, and `open` now reports *not acted* while it waits for 21:00 instead of
claiming a win every tick.

**3. Two tasks fighting over his hands.** He can carry one thing, and `take()`
drops whatever he was holding. Walking the task list from the top each tick had
`restock` pick up the box, `bins` immediately drop it for the bin bag,
`restock` pick the box back up — forever. Night 1 ran to a clock reading of
**288 hours** and then reported STUCK. The runner now finishes whatever is
already in his hands first, which is what a player would do.

### And a real bug underneath it

Night 1 lists the trash run as `bins` ("Empty the bins before close"); the
later nights call it `trash`; the interactions were gated on `trash` alone. So
**on Night 1 the bin bag could not be picked up at all** — a task sat on the
list all night with no way to complete it. It survived because the task is
flagged `optional`, so the night still ended and nothing complained. The gate
now answers to whichever id the night is using.

### Result

| Night | Outcome |
|---|---|
| 1 | complete · 2 served · 2.2 s |
| 2 | complete · 2 served · 1.3 s |
| 3 | complete · 1 served · 1.4 s |
| 4 | complete · 1 served · 1.0 s |
| 5 | complete · 2 served · 1.0 s |
| 6 | complete · 6 served · 33.4 s |

**All six nights play start to finish, unattended, and reach an ending** —
`closedout`, 14 served, 0 failed, 28 clues, 14 flags. Nights 1–5 take about
seven seconds between them; Night 6 takes thirty-three on its own, which is
the climax cutscenes running in real time because their waits use
`performance.now()` and cannot be compressed. Worth knowing before assuming it
has hung: I called it stalled myself at forty seconds, and it was working.

### Dev-server note, again

The `nightcount` launch config was pointed at plain `http.server`. It must be
`tools/serve.py`, which sends `no-store` — this cost another cycle today, with
a fix that was live on the server and stale in the page. `no-store` does not
retroactively evict what a tab already cached, so **if a fix appears not to
have taken, load it on a fresh port** rather than reloading. Config now points
at `serve.py` on 8843.

## Night 4 — built to the author's script

Two things about this night are unlike anything else in the game.

**The screen goes black and the game does not skip.** He puts his head down at
00:19 for "ten minutes", and the player sits through the next two hours with
their eyes shut, listening: the chime, two sets of footsteps (one adult, one
small and quick), the chip bag, the notes landing on the laminate, her going
down the hall, the door closing at 00:21, and then a boy humming somewhere in
the dark. Every line of it is captioned — a scene made of sound is a scene deaf
players are locked out of, and the point is that you *heard all of it and could
not see it*. `#subs` had to be raised above `#fade` for that to work; captions
were rendering underneath the black.

**It ends at 02:24.** He clocks out three and a half hours early with the shift
unfinished, the watch buzzes to tell him he ended it wrong, and he lets it
buzz. The remaining tasks are never completed. That is the ending of the night.

### The tune

One CC0 vocal recording does three jobs: the song on Night 1's radio (cut off
mid-phrase when he kills the engine), the humming in the dark, and the humming
in the car at the end. It **has** to be the same recording or the payoff does
not exist — so Night 1's cold open now plays it, which it never did before. The
child version is the same take played back at 1.22×, which is a pitch shift on
a real performance, not a synthesised or cloned voice.

### The salt carries over

`give({ carry: true })` — it is the same bag. Whatever he did not pour on
Night 3 is what he has tonight, and nothing tells him the number except the
weight of it. A player who was frugal is better off; a player who used the lot
is not; neither was ever warned it was a decision.

### Cutscene discipline, applied

The author's note landed while this was being built: *"would this be scarier if
I were the one standing there with the mouse in my hand?"* Night 4 was
refactored against it.

| Beat | Verdict |
|---|---|
| the arrival, the dry lot, the trunk | **cutscene** — he is not in the space yet |
| the sleep and the two black hours | **cutscene** — losing control *is* the content |
| unlocking the bathroom | **playable** — three wrong keys, his hands shaking, and the kid talking at him between each one |
| the bathroom itself | **playable** — he walks in, and **throws the salt himself** |
| the walk back to punch out | **playable** — the hall is on his left the whole way and the game never turns his head |
| the drive away | **cutscene** — a jump the player cannot walk |

The bathroom was a cutscene first and it was worse. Now the player can also
stand in the hall and not go in, and the game waits, with the kid still
talking. That is its own kind of unbearable.

### Verification, and its limit

Runs clean: no console errors, no unhandled rejections, beats fire in script
order through prep, the sleep, and the black scene. The back half could not be
watched end to end here — the preview pane renders offscreen, where
`setTimeout` throttles to about one call a second, and cutscene waits are built
on `performance.now()` polled by `setTimeout`. The playtest harness works
around that by virtualising timers, but its `advanceVirtual()` does a linear
scan of the pending queue per timer fired, and this night has minutes of
cutscene, so it bogs down and then trips its own 90-second cutscene grace.
**Both are harness limits, not game faults** — but it does mean the last third
of Night 4 has been read and syntax-checked rather than watched. Fixing
`advanceVirtual` to use a heap, and raising the grace, is the next tooling job.

## Beta pass — testing nights 5 and 6, and five bugs it found

### First, the harness, because nothing else was measurable

Cutscene waits are gated on `performance.now()` by design (a backgrounded tab
must not wedge a cutscene half-played). That made every night with cutscenes
untestable: nights 4–6 ran in real time, and the runner tripped its own
90-second grace and gave up. Two changes fixed it:

- **`__ncClock`** — a one-line seam in the cutscene wait. Undefined in a real
  session, so the shipped path is unchanged; the harness points it at the
  virtual clock, and a three-minute cutscene now costs three *virtual* minutes.
- **`advanceVirtual()` was O(n) per timer fired** — it rescanned the entire
  pending queue to find the minimum for every single timer. With a few hundred
  pending (which any night with cutscenes reaches, since each cutscene wait
  re-arms a 33 ms poll) the runner slowed to ~4 s per iteration and looked like
  a hang. It now collects the due set once and sorts it.

**All six nights now run in under five seconds, start to ending.**

### What the tests then found

1. **Night 1's restock could never be completed.** The script asks for ten
   units; the world has three gaps. The counter stuck at seven and the first
   night of the game had a job on the list with no way to finish it. A case now
   holds three, and when it is empty the shelves want filling again — the loop
   the "0/10" was always describing.

2. **The clock went eighteen hours backwards after midnight.** The shift is
   encoded as minutes from midnight of the *first* day, so six in the morning
   is 30:00 — but every after-midnight beat was written the way a person says
   it, `setClock(3, 40)`. Mostly invisible, because little reads the clock;
   fatal for anything gated on one. After that jump the front door believed it
   was the afternoon and refused to open **for the rest of the night**, so a
   player slow enough to still be prepping when the script moved on could not
   open the station at all. `setClock` now treats small hours as this shift's
   small hours.

3. **From Night 3 the station started over its own capacity.** Four circuits'
   worth of service, five circuits live. The first breaker a player touched
   found the load already over the limit and tripped the main, blacking out the
   building before they had done anything wrong. The night now opens *at* the
   limit with the forecourt dark — which is the choice the design was asking
   for; it just makes it once, at the start, instead of punishing them for it.

4. **Starting a night never cleared `player.frozen`.** Any path that began a
   shift while frozen — finishing the game and starting over, resuming a save
   written during a cutscene, a cutscene that threw — dropped the player into a
   night they could look at and not walk through. One line in `startNight`
   removes the whole class of "I can't move".

5. **The best content in nights 5 and 6 was optional and unreachable.** The
   fourth aisle, the tally and the Nova had no task pointing at them, and a
   runner working only the task list never found any of them. The fix is not a
   waypoint — it is *work*: Night 5's restock now leaves its last gap in the
   aisle that should not exist, and Night 6 has a bins run, and the dumpster is
   in the back lot, which is the only reason anyone walks past the covered car.
   Jacob does not arrive until that has happened.

Also fixed: Night 4 left half its list unticked with no explanation, which
reads as a bug rather than as the ending of the night — the panel now says
**SHIFT ABANDONED · 02:24**. And `audiocheck.py`'s prefix list did not know
about the `med_` family, so the ending's own sounds were invisible to it,
including to the phantom check, which is the dangerous one.

### Final state

| Check | Result |
|---|---|
| all six nights, shipped single file | **complete → `tennineteen` ending** |
| story beats fired | **18/18** · 43 clues · 0 failed |
| console errors / warnings | **0 / 0** |
| tasks left unticked | none, except Night 4's abandoned shift (labelled) |
| every cutscene skipped with ESC | **still completes, nothing lost** |
| scene audit | 0 floating, 0 unsupported, 0 buried, 0 doorway, 0 overlaps |
| assets | 345 files, 0 duplicates, 0 bad magic |
| audio coverage | 0 phantom, 0 ghost, 0 orphan |

The one thing still unwatched is the after-credits hospital scene past its
96-second credit roll; it has been read and its code path exercised, but not
sat through end to end.

## The structural bug: Night 3's content was inside Night 2

Found by testing a single night rather than a playthrough. Running
`__playtest({night: 3})` produced none of Night 3's own beats — no
five-dollar man, no 01:58 branch — while a full run showed them fine, because
**Night 2 was running them**.

All of the author's Night 3 material — *"Don't do five"*, the 23:12 customer
with no car outside, the 01:58 scream-and-two-shots branch, the ditch, the
casings, the receipt timestamped tomorrow, and the pumps running alone to
$19.72 — had been written into `night2`'s function body. So a player met the
five-dollar man on **Night 2**, a night before the salt exists and before the
tally is on the wall, and then Night 3 arrived with the salt and the tally and
nothing else. The escalation the author built was scrambled, and a full
playthrough could not reveal it because every beat still fired *somewhere*.

144 lines moved into `night3`, after the pole walk, where 23:12 and 01:58
belong on that night's clock. Verified per night rather than per playthrough:

| | Night 2 | Night 3 |
|---|---|---|
| Jacob, the blood, *"come here"* | **yes** | no |
| *"Don't do five"*, no car outside | no | **yes** |
| the 01:58 branch | no | **yes** (fires, either side) |
| the salt, the tally, the closing line | no | **yes** |

**Testing one night at a time is what found this.** A playthrough is not a
substitute: it proves the game finishes, not that each night is the night it
is supposed to be.

## Other beta-pass results

- **Resume mid-shift** — night, ticked tasks, remaining salt, clues and
  choices all survive a quit and continue; the player is not frozen on return.
- **Refusing every customer, all six nights** — 0 served, 9 refused, still
  reaches the ending with nothing stuck.
- **Every cutscene skipped with ESC** — completes, no lost flags.
- **Accessibility** — subtitles off hides text, on restores it, subtitle size
  applies through the settings bus (0.8×–1.8×), reduce-flicker and
  scare-volume both safe.
- **The ending, end to end on a virtual clock** — 96 s of silent credits, the
  hospital, Noah's full speech, the corridor, the thanks screen. Zero errors.
  At real speed in a hidden pane it *looks* stalled; that is the browser
  throttling timers to about one a minute, not the scene.

Performance could not be measured here — the preview renders offscreen, so
only the post-processing quad draws and the scene statistics are meaningless.
That one is still open.

## Performance, measured at last — and the mix

### The numbers were never real

Every performance reading this project has taken was wrong. `WebGLRenderer.info`
auto-resets on each `render()` call, and the frame ends with a composite pass
that draws one full-screen quad — so `info` always reported **1 draw call and
2 triangles**, which is the post pass and nothing else. With `autoReset` off
and the scene pass measured on its own:

| | |
|---|---|
| draw calls | **161** |
| triangles | **51,020** |
| geometries / textures | 125 / 18 |
| shader programs | 10–11 |
| scene pass | **0.5–0.8 ms** |
| composite pass | ~0 ms |

Also checked for a leak across a full playthrough: 904 objects, 625 meshes, 13
lights, 161 calls — **identical on all six nights**. Nothing accumulates.

### The one real cost

Thirteen lights, but only one casts shadows — and it was sitting at **intensity
zero**, rendering a 1024×1024 shadow map every frame for a lamp that is off.
From Night 3 the canopy circuit is dark by default, so that was the normal
case: 44% of the scene pass spent on a light nobody can see.

Shadows now follow the switch, in `power.apply()`, where the intensities are
already being set. Measured: **0.5 ms with the canopy dark, 0.8 ms lit**, and
the shadow comes back the moment the light is genuinely on.

### The mix was quietly broken

Loudness compensation was **peak**-based. Peak is the wrong measure for most of
what this game plays: a bin-bag rustle or a room-tone bed has one small
transient and almost no energy behind it. Measured across all 103 files,
**twenty-eight sat below an RMS of 0.012** — including `amb_fridge`,
`amb_roomtone` and `amb_electric`, which are the layers the entire "the station
is never silent by accident" idea rests on. They were being mixed at a fraction
of their intended level and were effectively not there.

It now targets RMS with peak as a ceiling, whichever gain is smaller:

| | before | after |
|---|---|---|
| below audibility (eff. RMS < 0.02) | 28 | **1** |
| would clip | 5 | **0** |
| median effective RMS | — | **0.060** (the target) |

The one remaining outlier is `int_vhs`, which is peak-limited by a loud
transient over a quiet body; its call site can carry it.

### Music

The game had no music for most of a night — the beds only came in at dread 3
and 4, so the ordinary hours were musically empty and the unease bed arrived
like a switch being thrown rather than like the night turning. `mus_menu` was
the only piece of music in the project that nothing ever played (the menu uses
the dread bed on purpose). It is now the **shift bed**, very low, under the
ordinary hours.

The credits keep the author's ninety seconds of silence with only the heart
monitor under them — then the credits music comes in for the last thirty
seconds and carries through the hospital scene to the final screen.

All 103 slots verified decoded and playing, with the two new music cues
confirmed running. Zero console errors.

## The interaction list, and the fiction still sitting in the drawers

`docs/INTERACTION_LIST.md` had drifted past the point of being wrong into being
misleading: it described the tanker manifest, Form 41-C, three 1989 VHS tapes,
and a protagonist who does not exist. A hand-written inventory of fifty-five
things will always drift, so it is now enumerated from the source by
`tools/interactions.py` — id, label, verb, file, and the condition that gates
it — and the document is written against that output. **55 interactions**, of
which 9 are salt thresholds and 4 are doors.

Rewriting it surfaced two pieces of the retired story a player could still walk
into:

- **The manager's desk** yielded the three 1989 tapes and the Form 41-C
  paperwork. On Night 4 — the night that is now the woman, the boy and the two
  black hours — a player who searched the desk would have been reading a
  different game's documents. Disabled, left in the source rather than deleted,
  in case the author wants the drawer for something.
- **The filing cabinet** held a 1979 district memo and a 1972 clipping, and it
  contradicted the Night 5 folder scene outright — two different sets of
  contents in the same drawer.

The cabinet was rebuilt rather than retired, because one thing in it is now
*better* than it ever was under the old fiction: **an employee file with his
own name on it, hired years before the six nights he thinks he has worked.**
It is the Nova, in a drawer, available from Night 3 to any player who opens it
— and it is a straight callback for anyone replaying after the ending. From
Night 5 the drawer also holds the folder with no name on the tab.

`TECHNICAL_PLAN.md` now carries the cutscene budget, which the discipline
prompt asked to be justified there rather than only in `CHANGES.md`.

Verified after all of it: `desk` and `vhs` unreachable, the cabinet holds the
two new items, and a full six-night run still reaches the ending with 43 clues,
16/16 story beats, 0 failed and 0 console errors.

## Documentation brought back in line with the game

`INTERACTION_LIST.md` was not the only document describing a game that no
longer exists. A sweep for the retired fiction found it across most of `docs/`:

| Document | Was | Now |
|---|---|---|
| `STORY_BIBLE.md` | the Jacob rewrite, with no ending and no Danny | **rewritten** — all six nights, the reveal, the coma ending, and why the boy defends it against the cheap reading |
| `SHIFT_PLAN.md` | six nights called *The Cameras*, *The Power*, *The Delivery*, *The Audit* | **rewritten** from the task lists `nights.js` actually sets, beat by beat with times |
| `GAME_CONCEPT.md` | Wren Alcott and her brother Danny, 1989 | the premise as it now is, including that the game withholds his name until Night 6 |
| `VOICE_ASSET_MANIFEST.md` | the 1989 tape; *"Wren never speaks aloud"* | Jacob on Night 6, the boy who makes no sound at all, the four-note tune, and Danny's caught breath |
| `TECHNICAL_PLAN.md`, `GENERATED_ART.md` | Form 41-C, the VHS deck | the cabinet and the employee file |

The story bible now carries the thing that was missing from every version of
it: **the ending, and what the ending is defended by.** A coma ending invites
"none of it counted" — and the seventeen-year-old who has visited every Tuesday
since he was small, who says Danny got him out of somewhere once and could
never explain it, is the answer. Danny cannot have invented him. Either
something real happened out there, or the kindest thing he did in ten years of
sleeping reached the outside anyway. The game never says which.

The only places the retired fiction still appears are the "what was retired"
tables and this worklog, where it is history rather than description.

## Two things a replaying tester would have hit

**The notebook had the wrong protagonist's name on it.** Every page header read
`W. ALCOTT — NIGHT 3`, on the one screen the player opens to review what they
have worked out. It is now `STATION 41 — NIGHT 3`, which also protects the
reveal: the game withholds his name until a note from his boss says it on Night
6, and a notebook with his surname at the top for five nights would have given
it away for free.

**Night-scoped interactions were never removed.** The systems register their
spots once and keep them for the whole game, which is correct. The *night
scripts* register theirs at a beat — the ditch, the fourth aisle, the covered
car — and nothing ever took them away. Finish the game, start a new one, and
**Night 1 still had the Nova and the marks in the grout waiting to be found**,
four and five nights before either exists. `startNight` now drops a named list
of sixteen night-scoped ids; verified as two spots surviving a finish before,
and zero after.

Neither shows up in a single linear playthrough, which is why neither had been
seen. They need a replay — which is exactly what a beta tester does.

Full run after both: ending reached, 43 clues, 16/16 beats, 9 served, 0 failed,
0 stuck, 0 console errors.

## Every sound in the library is now played by something

Two recordings had sat unused since the first asset pass.

**`veh_truck_airbrake`** belonged to the tanker in the retired Night 4 and went
out with it. It now fires when a semi settles on the forecourt — the moment the
nose dips and the brakes let go, which is the loudest thing that happens out
there all night, and Night 1 opens with a truck.

**`int_fridge_door`** had nothing to open. The walk-in has geometry, it is one
of the nine salt thresholds, and a player told that a line across *"the
walk-in"* matters should be able to open the thing and look inside. It is not a
task — it is a door in a shop. It reports whether the cooler still has power,
which is a quiet way of showing what a dark circuit actually costs.

`audiocheck.py`: **0 phantom, 0 ghost, 0 orphan, 0 idle.** Every one of the 103
slots is referenced, has a file, and decodes.

## Script-failure resilience

A night script that dies must not take the game with it. Aborted a running
night mid-shift and started the next one: the player was left unfrozen and in
`play`, and Night 3 came up with its full task list. The `scriptShell` catch and
the `startNight` teardown between them mean a thrown beat costs that beat and
nothing else.

Full run after all of tonight's changes: **`tennineteen` reached, 43 clues,
16/16 story beats, 9 served, 0 failed, 0 stuck, 0 console errors.**

## Beta cut — what shipped, and what did not

The shipped file is commit `66aed81`. Verified on a fresh tab immediately
before handing over: all six nights, `tennineteen` reached, 43 clues, 16/16
story beats, 9 served, 1 failed, **0 console errors**.

Four later changes are parked on the branch `polish-warning-outline`
(`191b284`) and are **not** in the beta build:

1. the content warning as the station's CRT terminal
2. white edge outlines on usable objects
3. `__auditInvisible()` — the hotspot-with-nothing-behind-it check
4. moving the restroom hotspot down to fixture height

They introduce a **hard wedge on Night 2**: the `readings` task never
completes. Diagnosed as far as — `chores.logged` is `true` and all four meter
readings are present, so `writeLog()` ran and called `tasks.done("readings")`,
yet the task is still open, which means the list was replaced or the task
re-added after it completed. Not throttling: it reproduces on a fresh tab, in
under ten seconds, every time.

It was not the outline (disabling it changes nothing) and not the hotspot move
(reverting it changes nothing), so it is the warning screen or the CSS —
almost certainly the warning, which is the only one of the four that changes
the **boot order**. `contentWarning()` now runs between `game.init()` and the
first frame, and something in the night-1 → night-2 handover depends on that
ordering.

That is the first thing to pick up: reproduce with `__playtest({night:2})`
directly, then bisect the four changes rather than guessing at them, which is
what ran out of time here.
## The Night 2 deadlock — found and fixed

The log book was gated on a private `logged` flag instead of on the task:

```js
enabled: () => Object.keys(this.readings).length >= 4 && !this.logged
```

That is safe only while the runner and the night script never interleave. Move
the boot sequence — which the content warning did — and they interleave: the
meters get read and the book written **against the previous night's task
list**, so `tasks.done("readings")` marks a list that is about to be replaced.
The new night then sets a fresh list with `readings` open, and `logged` is
still `true`, so the book is **disabled forever**. The task can never be
completed, the night never ends, and nothing throws — which is why it looked
like throttling for so long.

It is gated on the task now, which is what it always meant:

```js
enabled: () => Object.keys(this.readings).length >= 4
  && this.g.tasks.has("readings") && !this.g.tasks.isDone("readings")
```

and `writeLog()` returns early if the job is already ticked. The book is
writable whenever the job is on the list and the meters have been read, which
is also what a person would expect of a log book.

**This was not caused by the content warning.** The warning only changed the
timing enough to expose it; the same latent deadlock was reachable any time the
Night 1 → Night 2 handover raced, which on a slower machine it could. It is a
better bug to have found before testers did than after.

The warning also moved to the front of `boot()`, ahead of the loaders and the
game object, so it can no longer sit between `game.init()` and the first frame.

Verified on the branch with everything enabled: six nights, `tennineteen`
reached, 43 clues, 16/16 story beats, 9 served, 1 failed, 0 console errors.
