# THE NIGHT COUNT — Shift Plan

**Canonical, and checked against the code.** The task lists below are the lists
`nights.js` actually sets; the beats are the beats it actually fires. The
previous version of this document planned six nights called *"The Cameras"*,
*"The Power"*, *"The Delivery"* and *"The Audit"*, none of which the game
contains.

Read `STORY_BIBLE.md` first — this is the production view of what that story
does minute by minute.

## The shape of every night

| Time | Phase |
|---|---|
| ~17:50 | arrival (cutscene) |
| 20:20–21:00 | **PREP** |
| **21:00** | open the station |
| 21:00–06:00 | **SHIFT** — serve, and whatever the night is doing |
| **06:00** | close up, punch out |

The clock is minutes from midnight of the *first* day, so six in the morning is
**30:00**. `setClock()` treats any hour below 12 as this shift's small hours and
adds 24 — written the way a person says it, stored the way the shift runs.

Nights 4 and 6 do not reach 06:00.

---

## NIGHT 1 — the job · dread 0→2 · 2 arrivals

| Task | |
|---|---|
| `clock_in` | Punch in — the clock is by the office door |
| `note` | Check the manager's note |
| `clean` | Clean the shop — 0/3 |
| `restock` | Restock the shelves — 0/4 |
| `readings` | Meter readings — 0/4 pumps |
| `open` | Open the station — 21:00 |
| `serve` | Serve customers |
| `lockup` | Lock the doors and punch out — 06:00 |

Header: **TONIGHT · PREP**. Arrivals: **A6** (the trucker), **A2** (the woman
with the sleeping kid).


## The list is shorter than it was

Fifty-eight jobs across six nights became forty-five, and Night 1 — the one
that decides whether anybody works a second shift — went from twelve to seven.

Three kinds of entry came off:

- **Errands.** `supplies` was a walk to the office to be told you may now use
  the broom that is standing in its own place anyway. `pumps` was one press on
  a six-metre trigger covering the whole forecourt, reporting that all four
  pumps were fine. Neither was work; both were a trip to a spot to receive
  permission.
- **Halves of one job.** `lockup` and `clock_out` are the doors and the card,
  and they are the same job: the card now refuses a punch while the station is
  standing open ("Doors first."). Night 4 is exempt via the `walkout` flag —
  that night ends with him punching out at 02:24 with the shop open behind
  him, which is the whole point of it.
- **Repeats.** `restock` came off Night 3, which already has salt, the breaker
  and the bins; it was the fourth trip to the stock room in three shifts.

`readings` absorbed `pumps` and now counts — *Meter readings — 2/4 pumps* —
because reading four meters one pump at a time was always the version of that
job that made you walk the forecourt.

## Arrivals overlap the work

Night 1 used to be strictly sequential: finish the prep, serve a customer,
wait fifty seconds, serve another, then do the meters. Nothing ever wanted the
player in two places, so the station might as well have been empty between
beats.

The arrivals now run on their own thread from the moment the doors open, while
the chores are still on the list. Being in the stock room with a box in your
hands when the chime goes **is** the job. Night 1 gives its first customer
forty in-game minutes of patience instead of twenty-two, because that arrival
is teaching the register and losing it for being halfway up an aisle teaches
the wrong thing; from Night 2 they wait the ordinary amount.

**Restock is ten units and the world has three gaps** — a case holds three, and
when it is empty the shelves want filling again. That loop is the intent; it
was broken for most of development and the task simply could not be completed.

**Two things do not belong.** The blood under the mess on the restroom floor,
which nobody mentions. And **02:36**, a screech then a bang, with no task
telling him to look.

The song on the radio in the cold open is the four notes. Nothing is made of it.

---

## NIGHT 2 — Jacob · dread 2→4 · 2 arrivals

| Task | |
|---|---|
| `clock_in` | Punch in |
| `note` | Read the note |
| `cams` | The cameras are live — look at the monitors |
| `bathroom` | Check the restroom at midnight |
| `serve` | Serve whoever comes in |
| `readings` | Meter readings — 0/4 pumps |
| `lockup` | Lock the doors and punch out — 06:00 |

Arrivals: **A1** (the hauler), **A7** (the girl with the flat).

Cold open in the rain; **Jacob in a lightning flash, covered in blood**. Blood
on the forecourt leads inside. Restroom: he is at the far wall. Flash, gone,
and Danny goes down on the tile — *the one place in this night where losing
control is the content, so it is a cutscene.*

> *"…Then why is it still warm."*

The pole walk and coming back to a lit building with something at the register
is **playable** — it was a cutscene and it was worse; discovery is the player's
job. **03:14** — *"come here."*

---

## NIGHT 3 — the salt · dread 2→5 · 1 arrival · **6 pours / 9 doors**

| Task | |
|---|---|
| `clock_in` | Punch in |
| `note` | Check the manager's note |
| `salt` | Lay salt — 0/6 |
| `breaker` | Reset C7 — the panel is in the stock room |
| `trash` | Take the trash out to the dumpster |
| `serve` | Serve whoever comes in |
| `readings` | Meter readings — 0/4 pumps |
| `lockup` | Lock the doors and punch out — 06:00 |

Arrival: **A5** (the man from the truck). Power capacity drops to **4 circuits
of 5** from tonight — and the night now *starts* at the limit with the canopy
dark, because starting over the limit tripped the main the first time anyone
touched a breaker.

| Time | Beat |
|---|---|
| 21:40 | the tally in the grout — four marks and a fifth struck across |
| 23:12 | **A3**, no car, five dollars for nothing — *"Don't do five."* |
| 01:58 | a scream and two shots, **and no task appears** |
| 05:30 | at the door: *"Maybe some salt will help next time."* |
| 06:00 | the line undisturbed, **footprints on both sides** |

The 01:58 branch watches whether he actually walks outside. Both sides cost him
and neither tells him which was worse.

---

## NIGHT 4 — the sleep · dread 3→5 · **no arrivals** · ends 02:24

| Task | |
|---|---|
| `clock_in` | Punch in |
| `note` | Check the manager's note |
| `salt` | Lay salt — 0/*(whatever is left of the same bag)* |
| `restock` | Restock the shelves |
| `bathroom` | Check the restroom |
| `readings` | Meter readings — 0/4 pumps |
| `open` | Open the station — 21:00 |
| `serve` | Serve whoever comes in |
| `lockup` | Lock the doors and punch out — 06:00 |

Header: **TONIGHT · PREP**, becoming **SHIFT ABANDONED · 02:24**.

No customers reach the counter — the only two people who come in do so while he
is asleep. The restroom check at 18:30 is deliberate: he finds nothing, hours
before it matters.

| Time | Beat |
|---|---|
| 00:19 | *"Ten minutes. Just ten."* — **screen black, and the game does not skip** |
| 00:20–00:21 | the chime, two sets of footsteps, the chip bag, the notes on the laminate, the door |
| — | a boy humming in the dark. **The four notes.** |
| 02:16 | a scream. Money on the counter. Small fists on a door |
| — | three wrong keys, then the fourth |
| — | **he throws the salt himself** |
| 02:22 | eleven seconds inside; he does not touch the money |
| 02:24 | punches out three and a half hours early and lets the watch buzz |

Every sound in the black is captioned. A scene made of sound is a scene deaf
players are locked out of, and the whole point is that you heard all of it and
could not see it.

---

## NIGHT 5 — the storm · dread 3→5 · 2 arrivals · **1 pour / 9 doors**

| Task | |
|---|---|
| `note` | Check the manager's note |
| `salt` | **Lay salt — 1/1 · CHOOSE** |
| `restock` | Restock the shelves |
| `readings` | Meter readings — 0/4 pumps |
| `bathroom` | Check the restroom |
| `open` | Open the station — 21:00 |
| `serve` | Serve whoever comes in |
| `lockup` | Lock the doors and punch out — 06:00 |

Arrivals: **A2**, **A7** — two ordinary sales before the storm takes the night
over. The salt task sits at the top, highlighted, until it is poured. **The
game never suggests a door.**

The storm closes by the hour: ~11 s between flash and bang at nine, ~4 s at
midnight, together by three. Nobody tells the player this is happening.

| Time | Beat |
|---|---|
| 21:04 | the note — *"I never told him what happened."* Sunday, counted on fingers: **six** |
| 22:30 | **the fourth aisle**; the fire plan has always shown four |
| 23:47 | **A3** again, the same five — *"You're the sixth."* |
| 01:31 | six marks in the grout, fresh, **warm** |
| 02:16 | **nothing happens**, for four minutes; then the drawer opens by itself |
| 03:14 | every light dies including the fridges; **the flashlight is not where he left it** |
| — | three flashes: the boy at the end of the aisle, closer, running — **silent** |
| — | the call: breathing, and four notes. Then number not recognised. Twice |
| — | Jacob's file, five nameless folders, **and his. Six.** |
| — | the phone on the desk rings. It has no cord |
| 06:00 | a full bag of salt on the passenger seat he did not put there |

Restock deliberately leaves its last gap **in the aisle that should not exist**,
so the job walks him into it. The lightning sequence is fully playable: he
cannot run and cannot fight, and all he can do is keep looking or stop looking.

---

## NIGHT 6 — Sunday · dread 4→5 · 2 arrivals · **6 pours / 6 doors** · ends 01:41

| Task | |
|---|---|
| `note` | Check the manager's note |
| `salt` | Lay salt — 0/6 |
| `serve` | Serve whoever comes in |
| `readings` | Meter readings — 0/4 pumps |
| `bathroom` | Check the restroom |
| `trash` | Take the last of the bins out |
| `lockup` | Close the station — permanently — 06:00 |

Header: **TONIGHT · THE LAST ONE**. Arrivals: **A1**, **A6**.

**This is the only night the arithmetic works**, and that is the tell. The bins
run is load-bearing: the dumpster is in the back lot, which is the only reason
anyone walks past the covered car. Jacob waits at 01:30 until it has happened.

| Time | Beat |
|---|---|
| 21:04 | *"Danny —"* … *"You **were** a good one."* — the first time the game names him |
| 21:30 / 22:20 | two ordinary sales; the second is the last customer this station ever has |
| 23:15 | **the Nova.** His registration, his dent, his air freshener, his photograph |
| 01:30 | every light out, thunder with no storm — **Jacob** |
| 01:31 | ⚠ GET OUT. The salt does nothing. The chime goes off cheerfully |
| 01:41 | the road, the mirror twice, four notes on the radio, headlights |

Then rain on metal, a door hanging open, a bag of shopping — **and a man on his
shift at the station hears a scream and two bangs and doesn't come out.**

---

## The ending

Ninety seconds of credits in silence with a heart monitor under them, then the
hospital, Noah, and the corridor. See `STORY_BIBLE.md` §7. There is **one**
ending; the three scored endings of the old design are retired.

## Dread and music

`setDread()` drives the ambience mix and the music. Nothing above a low bed
under the ordinary hours, the unease bed from 3, the dread bed from 4. It never
tells the player they are safe, because it never stops once it starts.

## Verification

Every night in this document is exercised by `tools/playtest.js`, which plays
the real scripts through the real interactions. A full run reaches the ending
with 16/16 story beats and no task left unticked except Night 4's abandoned
shift, which is labelled as such.
