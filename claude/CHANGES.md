# THE NIGHT COUNT — Changes

## Audit: before and after

| Check | Baseline | Now |
|---|---|---|
| floating props | 7 | **0** |
| buried props | 17 | **0** |
| doorway obstructions | 2 | **0** |
| mis-mounted hung props | 2 | **0** |
| overlapping level geometry | 15 | **0** |
| duplicate files by hash | 2 | **0** |
| real 404s | 1 | **0** |
| console errors / warnings | 0 | **0** |
| `settleProps` moved/orphan/unsettleable | 216/115/41 | **1/0/0** |
| geometries | 481 | **125** |

## What was fixed (mapped to §6)

6.1 scale — `pick`/`drop` subtree selection; the trash can was two bins, the
payphone sat on a 72 m turntable, the "mop" was a mop-and-bucket set, the
`newsbox` was a 7.6 m slab across the door (removed — it is a mesh named
`Paper`, 58.9 × 8.6 × 47.9, and is not a newspaper box). The desk was fitted by
width and squashed to 0.59 m, which is why everything on it floated.
6.2 the clock · 6.3 the back bar was built twice (1.49 m³) and the canopy fascia
was a solid box sunk into the deck (22.8 m³) · **6.4 the cooler was one solid
box with all 78 drinks sealed inside it** · 6.5 every mount, including six
cameras hanging in free air and a monitor bank *inside* the desk · 6.6 the
pallet · 6.7 the `HUNG` regex · 6.8 the settle report · 6.9 the collider leak ·
6.10 the tanker · 6.11 vehicle proportions · 6.12 the 404.

## What was built

**The vehicle arrival sequence** — a 19-state machine ticked from `update(dt)`.
Arrival 19.6 s, exact bay pose, collider attached only while parked, abort from
all 13 reachable states leaves nothing behind. The headlight rake was *measured*:
at intensity 90 it added 5.8% brightness to the shopfront and read as nothing;
the route also ran outside the building so the beams never crossed the glass.
Fixed to 15.4% and a route across the facade.

**The author's story** — Jacob, the 18:00→21:00→06:00 shift, the watch, the
photograph, the restroom blood, 02:36, Night 2's flash and "come here".

**The salt (Night 3)** — one bag, six pours, **nine thresholds**. A line holds;
what it stops goes *around*. `weakest()` decides where tonight comes in, which
is how the rule is taught: it arrives at the door you did not do.

## Boring parts, and what I did

**The night-1 cold open was 45 seconds of held camera before the player touched
anything.** That fails "do I want to know what happens next" at the worst
possible moment. Cut to ~18 s; every authored line survives, but five of them
now land *while he is mopping* — "people went missing out here" arrives over a
mop instead of a locked camera. Better drama and better pacing.

**Patience during the drive-in** made two customers unservable — the work and
the horror were interfering in the wrong direction.

## What I cut

- the `newsbox` (unusable asset, and an empty apron beats a table in the doorway)
- the rusted duplicate bin, the payphone turntable, the duplicate bucket/broom
- the retired fiction (Meridian, Form 41-C, the Count) — replaced, not deleted:
  recorded in `STORY_BIBLE.md` under "What changed, and what was kept"

## Planted for the second playthrough

1. The tally in the grout — **four marks and a fifth cut across** — appears on
   Night 3 at the wall Jacob was facing on Night 2. It is a count of nights.
2. *"Don't do five."* (Night 3 customer) reads as a warning first time and as a
   number second time.
3. The receipt timestamped **tomorrow**.
4. **$19.72** — the pumps stop there and he cannot say why.
5. **Footprints on both sides** of a salt line that was never broken.
6. The owner's *"stay out of the back lot after dark"* on Night 1.
7. 03:14 twice — Jacob's voice, then **his own**.

## Where a player would still lose interest — honestly

Nights 4–6 are still the old fiction's beats with the names swapped. They work
mechanically but they are not yet written to this story, and that is the weakest
stretch in the game. Night 1's prep phase is currently the most checklist-like
part; it needs one more thing that is not on the list.

**Would I play it twice?** Nights 1–3, yes — the salt shortfall and the tally
are genuinely worth a second run. The back half, not yet.

## Talking (built)

`src/core/choices.js`. Three ways to answer, above the dialogue box, number keys
or click. **Silence is always one of them and never marked safe** — the timer
running out picks it, so saying nothing is an answer. Every reply is written to
`state.data.choices` under a stable key, plus a full `choiceLog` with the night
and whether it timed out, so a later night can read what he said. Nothing is
ever announced on screen.

Verified: 3 options shown, silence styled distinctly, key press returns the
right id, timeout selects the silent option, both remembered.

First use is Night 3's 23:12 customer, written as authored — *"You're the new
one."* / *"How many nights you done?"* / **"Don't do five."** — he leaves the
five on the counter and there is no car outside.

## Night 3 — built (world beats, not dialogue)

**The salt.** One bag, six pours, **nine thresholds**. A line holds; what it
stops goes *around*. `weakest()` picks the first unsalted way in, which is how
the rule teaches itself — it arrives at the door you did not do.

**21:40, the tally.** Four marks and a fifth cut across them, scratched in the
grout at chest height, on the wall Jacob was facing on Night 2. He does not
clean it off. It is a count of nights.

**01:58, the branch.** A scream, then two shots, and **no task appears** — the
list does not tell him to look. The game watches whether he goes outside:

- *Out:* the car nose-down in the ditch, door open, headlights still on, two
  casings on the asphalt, and a bag of shopping with **this station's receipt,
  timestamped tomorrow** (generated from the night number, so it really is the
  shift he has not worked). And because he was out there, the front door was
  the one he did not salt — something is standing in an aisle when he gets back,
  and it does nothing.
- *In:* at 02:06 all four pumps run themselves with the nozzles in the cradles
  and stop at exactly **$19.72**. He writes it in the log anyway.

Both branches cost him something and neither tells him which was worse.

**06:00, the closing image.** If the bathroom line was salted: the salt is
undisturbed, and there are **footprints on both sides of it**.

## Still open

- Nights 4–6 dialogue (the author is writing these)
- Night 3's 01:58 branch and the $19.72 pumps
- Nights 4–6 rebuilt around the new fiction once their dialogue lands

## The audio sweep, and a bug that changes the honest answer above

### Sound

Three sounds were being played with **no file behind them** — the pumps running
themselves on Night 3, every dialogue reply, and taking the broom — because
`Audio.load()` swallows a missing file by design. `tools/audiocheck.py` now
fails on that class. Four different objects shared two pick-up sounds (a mop
and a bin bag both came up as a glass bottle); opening up and locking up were
the same lock. All separated.

Two additions matter for how the game *plays*, not just how it sounds:

- **Customers make noise while they wait**, and get less patient in both the
  sounds they make and how often they make them. There is no patience bar on
  screen, so this is now the only warning you get — the sound is the mechanic.
- **He reacts.** A beat after something loud, he catches his breath. It hangs
  off the `scare: true` flag every scare already passed, and it is the only
  thing in the mix that comes from inside the player instead of from the
  building.

### The portraits

Every dialogue portrait in every single-file build has been an **empty box**.

The shipped build hides its asset archive behind a patched `fetch` and three's
`setURLModifier`; neither covers the DOM, and a portrait is an `<img>`. It
resolved perfectly in the dev build, so it only ever broke in the build anyone
actually plays. Fixed in one place, verified by A/B: 11/11 portraits now load.

This is worth stating plainly rather than burying in a fix list, because the
author asked for portrait dialogue boxes specifically, and every dialogue scene
they have played so far — all of Nights 1 to 3 — ran without them. The
conversations have been a name and a line in a box. **Every judgement made
about how those scenes land was made against a broken version of them**,
including mine above. I would want to re-read the "would I play it twice"
answer after seeing Night 2 with Jacob's face actually in the box.

## Cutscene audit (required by the discipline prompt)

**The game has 12 cutscenes across six nights and an ending.** Every one is
listed here with what it is for. Two were converted to playable scenes during
this pass.

| # | Cutscene | Night | What it is for |
|---|---|---|---|
| 1 | `cs01_arrival` | 1 | arrival — he is not in the space yet |
| 2 | `cs02_jacob` | 2 | arrival, and the lightning flash |
| 3 | `cs02b_bathroom` | 2 | **losing control is the content** — he goes down on the tile and wakes up on it |
| 4 | `cs03_salt` | 3 | arrival |
| 5 | `cs04_dry` | 4 | arrival |
| 6 | `cs04_sleep` | 4 | **losing control is the content** — two hours with his eyes shut |
| 7 | `cs04_drive` | 4 | a jump the player cannot walk |
| 8 | `cs05_arrive` | 5 | arrival |
| 9 | `cs05_drive` | 5 | a jump the player cannot walk — the drive to the aunt's |
| 10 | `cs06_arrive` | 6 | arrival |
| 11 | `cs06_jacob` | 6 | **losing control is the content** — he cannot move, and the light is shaking |
| 12 | `cs06_road` | 6 | the ending, once |

Six are arrivals, three are helplessness, two are jumps, one is the ending.
That is the budget the prompt describes, and nothing in the list is there
because a scene was easier to write with the camera taken away.

### Converted to playable

- **Night 4, the bathroom.** It was a cutscene and it was worse. He now walks
  down that hall himself, opens the door himself, and **throws the salt
  himself**. A player who stands in the hall and does not go in is left there,
  with the kid still talking at him — which is its own kind of unbearable and
  was not possible when the game was playing it at him.
- **Night 2, coming back from the pole.** Every light on, and something at his
  register. That is a *discovery*, and discovery is the player's job. He is
  walking back across a dark lot; he will look at the building on his own,
  because there is nothing else out there to look at.

### Deliberately not cutscenes

The Night 5 lightning sequence — the boy at the end of the aisle, closer each
flash, then running silently — is the biggest scare in the game and it is fully
playable. He cannot run and he cannot fight; all he can do is keep looking or
stop looking, and that is the whole scene. It never makes a sound while it
stares or while it runs. The only thing you hear is the footfalls at the end,
in the dark, after you have lost sight of it.

Also playable: every customer conversation and both three-option dialogues, the
fourth aisle, the tally, the folders, the Nova, and the run for the car on
Night 6.

## The shift report — the thing that makes you start Night 2

The honest problem with this game was always Night 1. It is prep, chores, two
customers and one scare, and the two things that matter about it — the blood
under the mess, and the screech and bang at 02:36 — are *deliberately* not
explained. That is good horror and a bad hook. A player who puts the pad down
at 06:00 on Night 1 never finds out that any of it goes anywhere.

The gap between nights was a title card held for two and a half seconds. It is
now the loudest thing in the game:

> **NIGHT ONE**
> clocked out · 6:00 AM
> **4** of 5 written down
> *There was one more thing to notice.*
> Two things tonight were not the job.

Why this and not a score:

- **It is a collection with a visible hole in it.** "There were three more
  things to notice" is the single most effective sentence for getting somebody
  to work the next night properly. It converts the notebook from a log into a
  count.
- **You cannot fail it.** Nothing is withheld, no ending changes, no rank is
  given. It is not a punishment, so it does not make a tired player feel bad —
  it makes a curious one lean forward.
- **It names the night's real subject** in one line at the bottom, which is a
  tease rather than a summary: *"He is somewhere in the building. You have
  heard him now."*
- **It shows the clock-out time**, which is how Night 4 gets to say **02:43**
  in the same place every other night says six in the morning, with no comment.

`PAR` is measured, not guessed: the count of distinct `state.clue()` calls each
night's script can make, less the mutually exclusive ones — Night 3's 01:58
branch and Night 5's cordless phone each give you one of two, so those nights
are 10 and 14 rather than 11 and 15.

### Would I play a second night now?

Yes, and I did not think so before. The pull is no longer "was that scary
enough" — it is **"what was the fifth thing"**. And because the count is honest
about branches, a second playthrough has a number to beat that the game never
nags about.

### Where I still expect a player to drift

Night 1's prep is the longest stretch of pure chores in the game — five cleans
and ten restock units before the station even opens. It is the right shape for
teaching the job, and it is the place I would cut first if a tester says they
nearly stopped.

## The playtest report was right, and it found the worst bug in the project

Five scene functions were **called by the night scripts and had never been
written**:

`showFourthAisle` · `showFiveOnCounter` · `showAisleBlood` · `showNova` ·
`showAisleCrowd`

Every call site used optional chaining — `g.station.showNova?.(true)` — so
every one silently did nothing. The scripts ran, the clues fired, the subtitles
played, the shift report counted them as found. **Nothing appeared.**

So: the fourth aisle that should not exist never existed. The two identical
five-dollar notes were never on the counter. The child-sized pool of blood
coming from nothing was a line of text. The Nova — the biggest reveal in the
game, the moment Danny finds his own car in the back lot — was **a subtitle**.
The crowd standing in the aisle facing the shelves was never there.

**And my test suite passed all six nights, every time.** It checks clues, tasks,
flags and console errors. It never checked whether anything was visible. A
harness that validates the script instead of the game will report green through
exactly this, and it did, for as long as those functions have been missing.

All five are implemented now, built to match the existing construction rather
than dropped in:

- **The fourth aisle** uses the same gondola build as `_aisles()` — same
  materials, same 0.36 m shelf pitch, same kick rails and price rails — and is
  stocked, because an empty run of shelves reads as scenery. It gets a collider
  when it appears and loses it when it goes, and it runs the wrong way, past
  the cooler.
- **The two fives** are two identical notes, at slightly different angles,
  on the counter where the first one has been since Tuesday.
- **The aisle blood** is four layered decals — dark core, wetter rim, two
  run-offs — sized to a seven-year-old, and it starts at 55% scale so it can
  spread.
- **The Nova** hides the covered car, reveals the body underneath, and puts the
  cover on the ground beside it, folded.
- **The crowd** is seven figures, facing the shelves, built as plain geometry
  on purpose: a rigged character holding still still reads as alive, and these
  must not.

Verified in the shipped build: 625 → 746 visible meshes, all five groups
present and visible, zero console errors.

## §9 — the specific bugs from the playtest report

All five verified as reported, all five fixed, each re-tested in the shipped
build.

| # | Bug | Evidence before | After |
|---|---|---|---|
| a | callable labels printed as source | `setPrompt` did `p.verb + " " + p.label`; the phone's label is `() => "the phone"` | prompt reads **"Answer the phone"** |
| b | cleaning counter off by one | with three messes it showed **3/3 with one still on the floor** — `cleanLeft` was seeded at `length - 1` and decremented *before* the next spill was placed | counts what has been mopped: **1/3 → 2/3 → 3/3**, and 3/3 only when the floor is clear |
| c | customers shared geometry and materials | `SkeletonUtils.clone()` copies the node graph but shares both, and dressing writes a colour attribute onto the shared geometry — **the last person through the door decided what everyone was wearing** | geometry and materials cloned per spawn; two customers verified `sharedGeometry: false`, `sharedMaterial: false` |
| d | dead model declarations | `canopy_kit`, `fridge`, `shelf_low` declared and referenced by nothing | removed. *(Correction to the report: the `.glb` files do exist in `assets/models_lowpoly/`; the declarations were unused, not dangling)* |
| e | debug surface always on | `window.__nc` was attached for every player | attached only with `?dev`, on localhost, or after opting in. A double-clicked file gets nothing, and `__ncEnableDev()` is the one deliberate door so a tester can be talked through opening it |

The counter bug is the one worth dwelling on: it did not just display wrong, it
**told the player a job was finished while a mess was still on the floor**.

## §6 and §8 — the two contradictions a player sees

**The menu promised endings the game cannot reach.** *"six nights, three ways
it can end"* was the first line anyone read, and Night 6 forces the one
scripted ending; the old three-ending scorer is unreachable by play. It now
reads *"six nights, and the last one is a Sunday."*

**Story visuals are night-scoped now.** Night 1's blood under the floor mess
was still on the tiles on Night 4 — the night whose own dialogue has him check
the restroom and find it *"Clean. Dry. Fine."* The game was contradicting
itself in the same room, two nights apart.

Every story visual is reset when a shift starts, and the nights that want one
say so. Nights 2 and 3 re-assert the bathroom blood explicitly, because Night
2's entire *"…Then why is it still warm"* beat stands on it. Measured across a
run:

| | Night 1 | Night 2 | Night 4 | Night 6 |
|---|---|---|---|---|
| bathroom blood | not yet revealed | **visible** | **hidden** | hidden |
| visible meshes | 630 | 633 | 630 | 630 |

The reset is hide-only — it will not build a prop just to hide it, which is
why the mesh count does not drift.

Full run after all of it: `tennineteen` reached, 43 clues, 16/16 beats, 9
served, 0 stuck, **0 console errors**.

---

# The boring problem

> *"the game is quite boring and finish everything else"*

The task markers, the shift report and the salt shortfall were all patches on
a structural problem: the work was not a game, it was a checklist with walking.
Walk to marker, press E, walk to the next marker. Nothing could go wrong,
nothing competed for your attention, nothing was lost by being slow.

Four changes, and none of them is content — they are all about what the shift
*asks* of a player.

## 1 · Arrivals overlap the work

Night 1 was strictly sequential: finish the prep, serve a customer, wait fifty
seconds, serve another, then do the meters. Nothing ever wanted the player in
two places at once.

The arrivals now run on their own thread from the moment the doors open, while
the chores are still outstanding. Being in the stock room with a box in your
hands when the chime goes is the only part of working a counter that is
actually a game, and it was being carefully scheduled out of the way.

Night 1's first customer gets forty in-game minutes of patience instead of
twenty-two — that arrival is teaching the register, and losing it for being
halfway up an aisle teaches the wrong thing. From Night 2 they wait the
ordinary amount, and a missed arrival is a real, losable thing.

## 2 · The register can be got wrong

Both of the ways to make a mistake at the till were being refused by the
machine, which meant neither was a decision.

**Department keys.** Ringing the wrong key used to be rejected outright —
*"Nothing on the counter belongs to that key."* You pressed keys until one of
them worked. The register now takes whatever you give it, the way a 1997
register does. The price is right either way, so the customer never notices
and the receipt total is correct; what is wrong is the classification, and it
surfaces only in the count at six. The one tell is the beep sitting a shade
low, which a player notices on about the fourth one.

**Change.** The two ways of counting it wrong are not symmetrical and were
being treated as one thing:

| | before | now |
|---|---|---|
| short | "That's short. Count it again." | they count it in their hand and say so; nothing commits |
| over | "That's too much." | they take it and leave — the drawer is down by the difference, silently |

`finish()` now credits the drawer with `tender − whatWasActuallyHandedOver`
rather than `tender − whatWasOwed`, which is what made overpaying free.

Verified: two items rung under one wrong key → total still $4.35, two
department errors logged, sale completes. Change overpaid by 35¢ → drawer
$124.00 against $124.35 owed, `changeErrCents = −35`. Change underpaid →
rejected, nothing committed, drawer exact.

The shift report has a new line for it, and it can say the good version:
*"The drawer counts. Every key was the right key."*

## 3 · The list is half the length

Fifty-eight jobs across six nights → forty-five. **Night 1: twelve → seven.**

Two entries were pure errand and are gone: `supplies` (walk to the office to
be told you may use the broom) and `pumps` (one press on a six-metre trigger
saying all four pumps are fine). `readings` absorbed the second and now counts
— *Meter readings — 2/4 pumps* — because reading four meters one at a time was
always the version of that job that made you walk the forecourt.

`lockup` and `clock_out` were the doors and the card, which is one job; the
card now refuses a punch while the station stands open. Night 4 is exempt via
a `walkout` flag, because that night ends with him punching out at 02:24 with
the shop open behind him.

Night 1's restock went from six units to four, and Night 3 lost `restock`
entirely — it already has salt, the breaker and the bins, and the shelves were
the fourth trip to the stock room in three shifts.

## 4 · One thing a night that is not on the list

Every scripted beat in this game was attached to a task, so a player learned
quickly that nothing happens unless they make it happen. The shift became
safe, and a safe shift is a boring one.

`src/systems/unscheduled.js` fires one to three things a night on a clock the
player cannot see. They never become a task, a marker, a clue or a note.
Nothing is gained by investigating and nothing is lost by ignoring them — they
exist so that the answer to *"does anything happen if I just stand here"*
stops being no.

| | |
|---|---|
| `chime` | the door chime goes, the door swings, nobody comes in |
| `tube` | a fluorescent over the aisles gives out, and comes back on its own |
| `shelf` | something comes off a shelf behind you; nothing on the floor |
| `walkin` | the cooler door opens itself |
| `breath` | one breath, close, on the side you are not looking at |
| `knock` | two knocks from the stock room, then nothing all night |
| `radio` | the radio loses the station, finds a voice, loses that too |
| `pump` | a nozzle goes back in its holster outside |

It escalates by kind rather than by volume: Night 1 gets things a building
does on its own, and by Night 5 they are things a person does. **Night 6 gets
none** — it is scripted end to end and anything unscheduled in it competes
with the ending.

Rules all eight obey: never during a cutscene, a focus surface or an open sale
(a scare you cannot turn round for is a noise, not a scare — it waits, up to
six times, then gives up); never a task; always reversible.

Verified: all eight fire clean, the lights return to 26/19.5 and the cooler
closes; `_fire` defers with a sale open and drops entirely on a stale night
generation; scheduling is 2 / 2 / 3 / 2 / 3 / 0 spread across the shift.

## Regression

Full six-night run after all of it: `tennineteen` reached, 43 clues — the same
count as before — 9 served, 1 failed. The failure is the new behaviour
working: the bot was mid-chore when somebody walked in.

---

# You could not get into the gas station

> *"cant enter the gas station"*

The front door has three hotspots stacked on it, and a previous pass made two
of them stand down so the doorway would offer one prompt instead of three. It
stood them down too far. Between 18:00 and 20:40 on Nights 1, 4 and 5:

| | state during prep |
|---|---|
| `door_entry` (the plain door) | **disabled** — for the whole of the `open` task |
| `lockfront` (lock up) | **disabled** — same window |
| `openstation` (Open the station) | enabled, but **refuses**: *"Not yet. Doors at nine."* |

The leaf was shut with its collider in place, and the player spawns on the
forecourt. So the entire three-hour prep phase — punch in, read the note, mop,
restock, take the meter readings — was on the other side of a door with no
working way through it. Walking straight at the doorway for three seconds
moved the player zero units.

`door_entry` now stands down only from 20:40, which is the moment "Open the
station" stops being a refusal and becomes a real action. Before that it is a
door and he has the keys to it.

Handover across the shift, measured:

| | `door_entry` | `openstation` | `lockfront` |
|---|---|---|---|
| 18:00 prep | **on** | on (refuses) | off |
| 20:45 | off | **on** | off |
| after opening | on | — | on |
| closing | off | — | **on** |

Verified by walking, not by firing interactions: from z −2.2, four seconds of
real `KeyW` input now ends at z +2.92, inside the shop, on Nights 1, 4 and 5.

**The automated playthrough could never have caught this.** It fires
interactions by id and teleports between them — it has never walked through a
doorway in its life, and it passed all six nights green while the front door
was impassable. Same lesson as the five `Station.show*` functions that were
called with `?.` and never written: a suite that checks state cannot see the
world.

---

# The demo

`night-count-demo.html` — the first two nights, stopping at the end of Night
Two with a card rather than at the ending.

## It is not a second copy of the game

`src/core/build.js` holds two values and nothing else decides what a demo is:

```js
export const BUILD = { demo: false, lastNight: 6 };
```

`tools/build_single.py --demo` rewrites those two on its way past — the tree on
disk is always the full game, and demo-ness is a property of the *build*. The
build raises `SystemExit` if the strings it rewrites are ever missing, so the
demo cannot silently ship as the full game after a refactor.

Nights three to six are still in the bundle (they are ~40KB of script against
27MB of audio and models, and stripping them would mean maintaining a second
module graph). Nothing can *start* them: `endNight` stops at `BUILD.lastNight`,
`continueGame` clamps, and the dev picker only offers the nights the build
contains.

## The two builds cannot hurt each other

They are the same page on the same origin, so a shared save key means playing
the demo overwrites a full playthrough — and a full save sitting at Night 5
would offer Continue in a build that stops at two. The demo saves under
`nightcount.demo.save.v1`. Verified: after a full demo run, the full game's key
is untouched.

The save a finished demo leaves behind points at Night **two**, not Night three,
so Continue always offers a shift this build can actually start.

## What the player sees

The demo says so once, under the title, and never again while they are playing
— a watermark across a horror game is a worse crime than the demo being short.
"New shift" reads *"two nights of six — the demo stops at the storm"* instead of
promising six.

At the end: the shift report for the night just worked — it is the last thing
the game says about the player's own shift, and cutting it to put a card up
sooner would end the demo on an advertisement — then a card that says the demo
is over, names what Night three opens with, and stops.

## Verified

| | |
|---|---|
| plays | nights 1 → 2, then stops · `finishedAt: 2`, mode `ending` |
| order | `shiftReport` then `demoEnd`, measured with a DOM observer |
| dismiss | card → menu, mode `menu`, save at night 2 |
| dev picker | offers `["1","2"]` |
| title | `THE NIGHT COUNT — DEMO` |
| front door | Night 1 at 18:00 — enabled, walked from z −2.2 to z +2.92 |
| console | no errors |
| full build | unaffected — 1 → 6, `tennineteen`, 43 clues, no demo card |

`tools/playtest.js` now reads `BUILD.lastNight` instead of hard-coding six, so
the suite tests what the build actually is. Before that it forced `dev.night(n)`
for all six and cheerfully "passed" the demo by playing nights the demo is not
supposed to reach — which would have hidden the whole feature.

---

# The audit reads zero

> *"nothing should be covered to shelves etc. remove dev mode from demo, and make sure nothing is glitched"*

## Four security monitors were hanging in mid-air

Swapping the office and the stock room moved the `office_desk` anchor to the
room behind the counter and left `camera_bank` where it was. The camera bank is
its own group, positioned at `A.camera_bank.x, 0, A.camera_bank.z + 0.5`, and
the code that places it never asked whether anything was underneath — so the
four CRTs spent every night of the game floating 0.77m above the stock room
floor, with the desk they stand on 6.8 metres away.

The anchor now sits on the desk (`0.28, 1.25, 11.18`, inside the desk's
`x −0.39…1.59, z 10.53…11.47`) and the `+0.5` nudge is gone — one number to
get right instead of two that have to agree.

Two things moved with it. The boombox and the alarm clock were on the band of
desk the bank now occupies, so both went to the front edge. And the glowing
monitor faces were offset `+0.34` against the bank's old half-metre nudge — with
the bank where its anchor says, that same number put four lit rectangles
*behind* the monitors. They are derived from the bank's own depth now.

## Every cigarette pack floated above its shelf

Same class of bug as the sunken cans, in the other direction. `addBox` puts a
box's **base** at the y it is given, so a shelf board's surface is `y + 0.035`.
The six packs were placed at hand-picked heights that pre-dated the boards:

| shelf | board top | pack was at | gap |
|---|---|---|---|
| 1 | 1.095 | 1.19 | 9.5cm |
| 2 | 1.415 | 1.54 | 12.5cm |
| 3 | 1.745 | 1.89 | 14.5cm |

They were also at z 4.16 against a board spanning 4.035–4.165 — sitting on the
front lip, half over the edge.

Both numbers now come from an exported `CIG` object shared by the wall that
builds the case and the code that fills it, so they cannot drift apart again.
`settleProps` should have caught this and did not, which is worth knowing: it
is a safety net, not a placement strategy.

## One false positive, silenced honestly

`backwall` × `cigcase`, 0.055 m³. A fixture mounted on a wall has to bite into
it — flush leaves the two back faces coplanar, which z-fights. That is a
deliberate 1cm intersection, so the audit now carries a small
`INTENDED_OVERLAP` set and says so, rather than reporting it every run until
somebody "fixes" it into a shimmering seam.

## Dev mode is not in the demo

Gone from the main menu and from the pause menu, gated on `!BUILD.demo`.
Verified on the built demo file: the main menu is
`Continue · New shift · Settings · Credits & licences · Quit`, and the pause
menu offers nothing extra **even with `nc_dev_unlocked` forced into
sessionStorage**. A passcode box on the main menu of a two-night build is an
invitation to go looking for what it opens.

## Results

Every metric, every night, on the full build:

| | n1 | n2 | n3 | n4 | n5 | n6 |
|---|---|---|---|---|---|---|
| floating | 0 | 0 | 0 | 0 | 0 | 0 |
| unsupported | 0 | 0 | 0 | 0 | 0 | 0 |
| buried | 0 | 0 | 0 | 0 | 0 | 0 |
| doorway | 0 | 0 | 0 | 0 | 0 | 0 |
| mismounted | 0 | 0 | 0 | 0 | 0 | 0 |
| overlaps | 0 | 0 | 0 | 0 | 0 | 0 |
| NaN / missing | 0 | 0 | 0 | 0 | 0 | 0 |
| console | 0 | 0 | 0 | 0 | 0 | 0 |
| invisible hotspots | 0 | 0 | 0 | 0 | 0 | 0 |

**This is the first time the audit has read zero across the board.** The
`floating: 7` that has been standing since the cigarette case was added is
gone, and so is an overlap nobody had looked at.

`__auditInvisible()` returning 0 is the direct answer to *"nothing should be
covered"*: it raycasts from the player to every hotspot and reports any whose
prompt can appear with no visible object behind it. Nothing in the shop is
hidden behind a shelf.

Regression: full build 1→6, `tennineteen`, 43 clues, 9 served. Demo stops at 2,
card fires, 4 served, 8 clues, clean audit on both its nights.

---

# The start was super super boring

> *"btw the full game, at the start is super super boring"*

It was, and the reason is one number.

He arrived at **18:00**. The doors could not open until 20:40. At 0.55 in-game
minutes a second that is **291 real seconds — nearly five minutes** of solo
chores in an empty building before the game's actual loop, somebody walking in,
was allowed to begin. In that time nobody spoke to him, nothing could go wrong,
and the first unsettling thing (the blood under the restroom mess) was gated on
mopping all three spills. The player's introduction to the game was killing
time in a room with a list in it.

## He arrives at 20:20

Forty minutes instead of three hours. Measured on a real Night 1: the doors can
be opened **36.5 seconds** after clocking in, against 291 before.

The prep list takes longer than forty minutes to actually do, so you open a few
minutes late — which is the exact thing the owner rings up about. Nothing was
cut. The wait became a race.

## The phone rings in the first minute

The owner's call used to come *after* the first customer — seven or eight
minutes in, by which point the player had worked the entire prep list alone and
not one character had spoken to them. It is the only other voice on Night 1 and
it carries every rule the night is about: doors at nine, serve whoever comes in
however they look, stay out of the back lot.

It now rings nine seconds after clocking in — measured at **20:33**, while they
are still walking to the mop. Answering is optional; the machine takes it
otherwise, which is its own small characterisation of him.

## Something is wrong before any of it is done

A pump resets its own nozzle out on the forecourt at ~26 seconds, while he is
still finding the light switch. Deniable, never mentioned again, costs nothing
— and it is the first evidence that the station is not simply a room with a
list in it, four minutes before the blood would have been.

## And the last cutscene line plays over the walk

*"Clean it, stock it, open it. Before nine fifteen."* was the last of ~20
seconds of held camera. It is the instruction, so it is the exact moment the
player most wants their hands back. It plays over the walk now.

## One audit false positive, found on the way

Running the audit *after* a full playthrough reported 45 overlaps on every
night. Nothing was wrong: story props (the Nova, the crash scene, the fourth
aisle, the crowd) are built once and **hidden** between the nights that want
them, and hiding is not removing — so the overlap pass was comparing invisible
geometry against the walls it is parked inside. It skips anything not actually
drawn now.

This is why the audit is run both cold and after a full run. Cold it read zero
the whole time.

## Verified

| | |
|---|---|
| doors openable | 36.5s after clock-in (was 291s) |
| phone | rings at 20:33, `owner1` clue collected |
| forecourt beat | fires, ~26s |
| six nights | `tennineteen`, 43 clues, 9 served, 0 stuck |
| audit, cold | clean on all six |
| audit, after a full run | clean |

---

# Three of the four doors did not work

> *"i cant open the front door or go to the bathroom dude"*

Three separate bugs, and every automated check said clean through all of them,
because the harness fires interactions by id and teleports between them. It has
still never walked through a doorway.

## The front door refused

Three hotspots share that doorway. `openstation` has the widest radius, so it
won the crosshair every time — and before 20:40 it **refused**: *"Not yet. Doors
at nine."* The plain door was never offered at all. The prompt also read
**"Open the station the front door"**, because the verb already contained the
noun the label then repeated.

Earlier I "fixed" this by splitting the window at 20:40 and verified it with
`dev.use('door_entry')` — which bypasses the crosshair contest entirely. It
looked fixed and was not. That is the same blind spot, for the third time.

It is now one hotspot that is **a door before nine and a job at nine**. Nothing
refuses: too early to open the station is still not too early to walk through a
door you have the keys to.

## The cooler sealed two of the three back doorways

The cooler was one unbroken run from x −2.2 to 8.2. The partition has three
doors in it — stock at −7, office at +1, bathroom at +7 — and the cabinet
crossed two of them. **The office and the bathroom opened onto the back of a
fridge for the entire game.** Only the stock room was ever reachable.

Nudging the run forward did not help: a wall that wide has no way round it. It
is now two runs with a walkway at each doorway, derived from `L.DOOR_*` so it
cannot drift from the partition it faces.

## The office door's hotspot was at the stock room

`door_office` was hand-typed at x −7. Swapping the office and the stock room
moved the leaves and left the hotspots behind, so it offered *"Open the office
door"* at the wrong end of the building and toggled a door eight metres away —
while the real office door at x +1 had **no hotspot at all** and could never be
opened.

All three door hotspots are now derived from the door the station actually
built. A hand-typed number cannot follow a wall that moves; a door's own
definition can.

## The audit now asks the question the player asks

The doorway check tested *props* against door rects. It had never looked at
level geometry or the collider list — which is exactly how a 10.4-metre cooler
came to sit across two doorways with every audit reading clean, because the
thing in the way was a wall rather than a box of crisps.

It now walks a line through each doorway, a player's radius wide, and asks the
collider list whether a body fits. Same question as the W key.

## Two more it found immediately

- **`cambank` was behind its own monitors.** The hotspot sat at bank + 0.4 in
  z, against the back wall, with the bank between it and the room — so *"Watch
  the monitors"* appeared where no monitor could be seen. Found by
  `__auditInvisible()`.
- **The open rear door clipped the loading dock** by 0.077 m³ every time
  anybody used it. The dock lip sat centred on the doorway; it is beside it now.

## Verified by walking

| route | prompt | result |
|---|---|---|
| front door | "Open the front door" | inside, z 2.92 |
| office | "Open the office door" | through, z 11.52 |
| bathroom | "Open the bathroom door" | through, z 11.54 |
| stock | (open doorway, no leaf) | through, z 11.54 |
| back door | "Open the back door" | out to the lot, z 17.56 |
| straight at the cooler | "Open the walk-in" | stops at it, as it should |

Audit clean on all six nights, doorway check included.

---

# Voice delivery, the reply box, and a premium pass

## The replies sat on top of the line they were replying to

Two full `.choices` blocks in one stylesheet, both positioning the same
element. The loser's `bottom` was still what the author had reasoned about, and
the winner lifted the dialogue box with a **guessed** `translateY(-250px)` —
65px short of three replies.

Raising the guess only moves the problem to a different number of options, and
a transform there fights `.dbox.in`, which owns the entrance animation and sets
a transform of its own: two rules writing one property.

One block now. `choices.js` measures the replies and writes `--choicesH`, and
the dialogue box stacks by changing **`bottom`**, not by adding a transform —
so the entrance still plays and the arithmetic is exact for any number of
options.

*Honest note: the browser pane reports a 0×0 viewport while hidden, so I could
not measure the final pixel gap. This is fixed by construction rather than by
tuning against a measurement — please glance at a phone call on Night 1.*

## Voice: prosody, not just a voice

No Premium or Enhanced system voices are installed on this Mac, and installing
them is a System Settings action I will not take on someone else's machine — so
the ceiling is the compact voices. What was costing the most naturalness was
not the voice, it was that `say` reads a sentence as one unbroken run: the
pauses the author wrote with commas, dashes and ellipses simply were not there.

`prosody()` turns punctuation into actual silence — 480ms on an ellipsis
(in this script it is always somebody deciding whether to say the next thing),
320ms between sentences, 260 on a dash, 130 on a comma — and each character
gets a pitch base, which separates two speakers more than the voice choice
does. Everything re-rendered: 192 clips, 2.9 MB.

**If you want a real step up:** System Settings → Accessibility → Spoken
Content → System Voice → Manage Voices, and install any English *(Premium)*
voice. `tools/voice.py` will use it the moment its name is in `VOICES`, and
`--force` re-renders the lot in about two minutes.

## Premium pass on the surfaces you look at all night

- **Interaction prompt** — blurred backing, a hairline border, a 160ms rise on
  appear instead of a hard cut
- **Objective panel** — carries its own ground now. It is on screen for the
  whole shift over a picture that goes from a lit forecourt to a black stock
  room, and a text shadow cannot survive both
- **Toast** — same treatment, and it rises rather than blinking
- **Dialogue box** — backdrop blur and a deeper shadow so it sits *over* the
  scene rather than in it

## Verified after all of it

Six nights: `tennineteen`, 43 clues, 9 served, **0 stuck**. Audit clean on all
six, doorway check included. Demo: stops at Night 2, card fires, both nights
clean, all five doors walked.

---

# The salt could not be laid

> *"game typa sucks — do so many playtests, look at all the models animations
> and hitboxes"*

Fair. Every check in this project asks the game about its own state; the player
asks the world. So I built the check that asks the world.

## tools/reach.js

For every hotspot: stand in a ring of **real positions** around it, at a real
standing height, face it, and ask whether the crosshair offers **that** hotspot.
A spot no ring position can summon is a spot nobody can use, whatever the state
says. It is what a player does and nothing else.

**Its first run reported all 21 Night 1 hotspots unreachable — including the
register and the punch clock, which plainly work.** That was the tool, not the
game: the player's forward vector is `(-sin(yaw), -cos(yaw))` and I had assumed
`(sin, cos)`, so it stood in the right place facing exactly backwards. Read the
convention off the movement code; do not assume it.

## What it found once it was right

**Four of the nine salt thresholds could never be poured.** They sit *in* the
doorways — correct, you salt a threshold — and the door's hotspot is wider, so
the door won the crosshair every single time. Night 3 needs six of nine and
**Night 6 needs six exactly** ("Six doors. Six pours. That's the first time it's
been enough"), so the game's central horror mechanic was unusable by anybody
actually playing it. Every automated run passed, because `dev.use("salt_bath")`
fires from anywhere.

Now: while the salt is the job, the doorway is the salt's. Once the line is
down the door is a door again. Five hotspots defer — `door_office`, `door_bath`,
`door_rear`, `door_entry`/`lockfront`/`openstation`, and the walk-in.

**The salt labels never followed the room swap either.** `office` was written at
x −7 and `stock` at x +1, which was true before the rooms were swapped and false
after — so the game asked you to salt the office and put the line down at the
far end of the building. Both now come from `L.DOOR_*`.

## Models and animations, checked

- 46 animation clips in the library; all **six** the game references exist
  (`Idle_Loop`, `Idle_Talking_Loop`, `Interact`, `Push_Loop`, `Walk_Loop`,
  `Walk_Formal_Loop`). 40 unused, including `Death01`, `Hit_Chest`,
  `Fixing_Kneeling`, `Driving_Loop` — worth spending later.
- 0 `MISSING:` placeholders in any night.

## Results

| | n1 | n2 | n3 | n4 | n5 | n6 |
|---|---|---|---|---|---|---|
| hotspots tested | 29 | 29 | 27 | 29 | 29 | 27 |
| unreachable | 0 | 0 | 0 | 0 | 0 | 0 |
| audit | clean | clean | clean | clean | clean | clean |

**170 hotspots, every night, all reachable.** Six nights: `tennineteen`, 43
clues, 9 served, 0 stuck.
