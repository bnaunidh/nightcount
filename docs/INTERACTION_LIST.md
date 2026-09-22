# THE NIGHT COUNT — Interaction List

Every interaction in the game, **enumerated from the source** rather than
written from memory. The previous version of this document described the
retired fiction — Wren, the tanker manifest, Form 41-C, the 1989 tapes — none
of which the game contains any more, so it was worse than having no list.

Regenerate the raw inventory with:

```bash
python3 tools/interactions.py
```

All interactions are look-at + press (default **E**), or hold-to-interact if
enabled in Settings → Comfort. All are registered through `Interactor.add()`
and can be listed at runtime with `__nc.dev.near()`.

**Accessibility applies to every row below**: the prompt names the verb and the
object in text, it is resizable (Settings → Comfort → Prompt size), and no
interaction depends on colour, reaction speed, or hearing. Every scripted sound
in the game is captioned — including the entire two-hour blackout on Night 4,
which is made of nothing but sound.

**55 interactions**, of which 9 are the salt thresholds and 4 are doors.

---

## The work

These exist every night. They are the job, and the job is the game.

| Object | Prompt | Feedback | Gate | Kind |
|---|---|---|---|---|
| Time clock | *Punch* | mechanical stamp | always | bookends every night |
| Coffee urn | *Hold the switch* | urn pour | always | reusable |
| Manager's note | *Read* | paper | always | different every night |
| Night-shift binder | *Read* | paper | always | reusable |
| Pump log | *Read* / *Write up* | paper | write needs all four readings | reusable |
| Count sheet | *Read* | paper | always | reusable |
| Floor plan | *Look at* | — | always | **contradicted on Night 5** |
| Pump meter ×4 | *Read the meter* | pump click | while `readings` is open | reusable |
| The pumps | *Check over* | — | while `pumps` is open | reusable |
| Case of stock | *Pick up* | cardboard | while `restock` is open | blocks half the view, 0.78× speed |
| Shelf gap ×3 | *Fill* | can / crisp bag / bottle | carrying a case | a case holds three; then fetch another |
| Mop and bucket | *Take* | bucket | not already holding it | 0.92× speed |
| Spill | *Mop it* | mop water | a spill exists, holding the mop | reusable |
| Bin bag | *Lift out* | bag rustle | while `trash`/`bins` is open | reusable |
| Dumpster | *Throw it in* | metal slam | carrying the bag | **forces the walk to the back lot, alone** |
| Broom and crates | *Take* | broom | while `supplies` is open | prep |
| Restroom | *Check* | toilet, then the tap | while `bathroom` is open | reusable |
| Front door | *Open the station* | keys | while `open` is open, from 21:00 | reusable |
| Front door | *Lock up* / *Unlock* | lock | always | ends the shift |
| Register | *Use* | terminal opens, VFD lights | always | the core loop — see below |
| Torch | *Take* | handled | not already held | then **F** toggles it |
| Telephone | *Answer* | ring, handset | while ringing, or when a call is possible | letting it ring out loses it |
| Radio | *Switch on* | static, voices | always | broadcasts change per night |
| Monitor bank | *Watch* | CRT hum | cameras powered | 6 feeds, QUAD, SEQ, incident log |
| Breaker panel | *Open* | metal panel door | Night 3+ | five circuits, four circuits of service |
| Service disconnect | *Throw* | heavy breaker | during the pole task | Night 3 |
| Doors ×4 | *Open* / *Close* | hinge; chime on the entry | always | entry, office, restroom, rear |
| Filing cabinet | *Open* | lock, drawer | Night 3+ | **his own employee file** |
| Sign switch | *Throw* | switch, neon dies | Night 6 | kills the roadside sign |

### The register

The one screen the game asks you to be competent at. A DTS Series 200: VFD
display, department keys, a 10-key, and tender keys.

| Key | Feedback | Failure |
|---|---|---|
| Department ×6 | scanner beep, VFD shows item + running subtotal | wrong key → low beep, `mistakes++`, the count is wrong at close |
| SUBTL / CASH TEND | beep, drawer | refused with nothing rung |
| Denominations | notes / coins | over or under → "count it again", change resets |
| CHANGE | coins, then printer | wrong total is refused |
| RECEIPT | drawer, paper | **this is what releases an arrival** |
| VOID | flat low beep | kills the sale — the arrival is *not* released |
| NO SALE | drawer | opens the drawer |
| COUNT DRAWER | paper | float / takings / **OVER** |

## The salt — nine thresholds

Registered from Night 3, when he brings the bag. One bag, and it does not go
far. **The shortfall is the design**: a line holds, and what it stops does not
leave — it goes around. Every pour is a choice about which way in you leave
open, and you find out which afterwards.

`the front door` · `the back door` · `the bathroom door` · `the office door` ·
`the stock room` · `the walk-in` · `the hall` · `the way behind the counter` ·
`the forecourt doors`

| Night | Pours | Thresholds |
|---|---|---|
| 3 | 6 | 9 |
| 4 | **whatever is left of the same bag** | 9 |
| 5 | 1 | 9 |
| 6 | 6 | **6** — the only night the arithmetic works, which is the tell |

The player is never told any of this. The game confirms the rule by what
happens at the doors they did not do.

## Story interactions, by night

Each of these is registered by its night's script and exists only there.

| Night | id | Prompt | What it is |
|---|---|---|---|
| 1 | `investigate` | ⚠ *INVESTIGATE OUTSIDE — NOW* | 02:36 — a screech, then a bang |
| 2 | `trail` | *Follow it* | the blood, in the rain, leading inside |
| 3 | `pole` | *Throw the disconnect* | the pole in the back lot, in the dark |
| 4 | `bathunlock` | ⚠ *UNLOCK THE BATHROOM — NOW* | **three wrong keys**, then the fourth turns |
| 4 | `bathsalt` | *Throw the salt* | he does it himself; the game will not do it for him |
| 5 | `aisle4` | *Look at* | the fourth aisle, which has always been there |
| 5 | `plan` | *Look at* | the fire plan, which has always shown four |
| 5 | `tally5` | *Touch* | six marks in the grout, and the wall is warm |
| 5 | `callaunt` | *Call the aunt* | it picks up. Four notes |
| 5 | `n5cabinet` | *Pull it open* | Jacob's file, five nameless folders, and his |
| 6 | `nova` | *Look at* | the covered car in the back lot **is his** |
| 6 | `runcar` | *Keys — GO* | 01:31, and the salt does nothing |

### How the player is walked past the discoveries

None of these have a waypoint. Three of them are the best moments in the back
half, and a player working only the task list used to miss all three — so the
*work* goes past them instead:

- **the fourth aisle** — Night 5's restock leaves its last gap in it
- **the Nova** — Night 6 has a bins run, and the dumpster is in the back lot
- **the tally** — the restroom check is down that hall

Night 6 holds Jacob at 01:30 until the back lot has happened.

## Cutscene-only beats

Twelve in the whole game. The count and the justification for each is in
`CHANGES.md` and `TECHNICAL_PLAN.md`; the short version is six arrivals, three
where losing control *is* the content, two jumps the player cannot walk, and
the ending. Everything else — every customer conversation, every three-option
dialogue, every discovery, and the Night 5 lightning sequence — is playable,
with the mouse in the player's hand.

All cutscenes restore control, unfreeze the player, clear subtitles and return
the game to `play` in a `finally`-equivalent path, so a failed cutscene cannot
strand anyone. **Verified**: a full six-night playthrough with ESC held down
through every cutscene still reaches the ending with no lost flags.

## Retired

Left in the source but permanently disabled, because they belong to a story
this game no longer tells:

| id | Was | Now |
|---|---|---|
| `desk` | the manager's desk — three 1989 VHS tapes, Form 41-C | `enabled: false` |
| `vhs` | the tape deck | unreachable; it needed the tapes |

The filing cabinet was rebuilt rather than retired: it used to hold a 1979
district memo and a 1972 clipping, and it contradicted the Night 5 folder
scene. It now holds the count sheets and **an employee file with his own name
on it, hired years before the six nights he thinks he has worked** — which is
the Nova, in a drawer, for a player who opens it early.
