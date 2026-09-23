# THE NIGHT COUNT

*Six nights. One bag of salt. More doors than you have pours.*

You work the last six night shifts at a filling station thirty-one miles from
anywhere, closing for good at the end of the week. The job is quiet: punch in,
read the manager's note, clean it, stock it, open at nine, serve whoever comes
in, take the pump readings, lock up at six.

You took it for the money, and because of Jacob.

---

## Play it

**Easiest — one file, no setup:** double-click **`the-night-count.html`**
(on your Desktop). Everything is inside it: three.js, every model, texture and
sound. No server, no folder, nothing to install. Chrome or Edge recommended.

**The folder build** (full-quality audio, and the version to edit):

**Windows** — double-click **`Play-Windows.bat`**
**macOS / Linux** — double-click **`Play-Mac.command`**
(the first time on macOS you may need: `chmod +x Play-Mac.command`)

Either launcher starts a small local web server in this folder and opens your
browser. Nothing is installed and nothing leaves your machine. Close the
console window to quit.

**Manual alternative** — from this folder:

```bash
python3 -m http.server 8841
```

then open <http://127.0.0.1:8841/>.

> The game must be served over `http://`. Opening `index.html` directly from
> the file system will show a black screen, because browsers refuse to load 3D
> models over `file://`.

**Needs:** any current Chrome, Edge, Firefox or Safari with WebGL. It runs on
integrated graphics — the game renders internally at 640×360 on purpose.

## Controls

| | |
|---|---|
| **W A S D** | walk |
| **Mouse** | look (click the window once to capture the pointer) |
| **E** | interact with whatever you are looking at |
| **Q** | your notebook |
| **Tab** | remind me what I was doing |
| **Esc** | pause / step back from whatever you are using |
| **Shift** | walk slower |

At the register and the monitors, use the mouse: they are real panels with real
buttons. At the monitors, **1–6** pick a camera, **Q** is quad view, **S** is
auto-sequence, **Space** logs an incident.

Every key can be rebound in Settings → Controls.

## The job

Nobody will explain the work twice, so: read the manager's note on the register,
read the binder, and do what the list in the corner of your eye says. If you
lose track, press **Tab**.

Ringing something up is a sequence, not a button: press the **department key**
for what's on the counter, **SUBTL**, take the cash, **count the change out**
with the denomination keys, then **CHANGE** and hand over the **RECEIPT**.
Getting the change wrong is not fatal. Not finishing is a different matter.

## Comfort and accessibility

Settings → Comfort has camera-shake reduction, a **reduce light flicker**
option, prompt scaling and hold-to-interact. Settings → Audio has separate
volume sliders, a **ceiling on loud scares**, and subtitles with adjustable
size and background. Settings → Video has brightness, field of view, and
switches for grain, chromatic aberration, vignette and the 1997 colour
dithering if you want a cleaner picture.

No puzzle in the game depends on colour, on reaction speed, or on hearing
something quiet: every audio clue has a visible or written counterpart.

## Saving

The game saves at the start of every night and whenever you choose *Save and
quit* from the pause menu. **Continue** on the main menu picks up from there.
There is one slot; starting a new shift overwrites it.

## How long

About 90–120 minutes for a first run through all six nights. There are three
endings, and which one you get is decided by what you did across the whole
run — not by a choice at the end.

## What's in this folder

```
index.html            the game
src/                  all source (no build step — this is what runs)
assets/               models, textures, audio, the character rig
vendor/               three.js r160 (MIT), bundled so the game works offline
docs/                 design documents, asset manifests, licences, test plan
tools/                the asset fetchers, art generators, self test, playthrough runner
Play-Windows.bat      launcher
Play-Mac.command      launcher
```

## Credits and licences

Full credits are in the game (Credits and licences on the main menu) and in
**`docs/ATTRIBUTION.md`**. Everything third-party is CC0 or CC-BY, and every
file's creator, licence and source page is recorded in `docs/ASSET_MANIFEST.md`,
`docs/AUDIO_ASSET_MANIFEST.md` and `docs/ANIMATION_ASSET_MANIFEST.md`.

The game contains no text-to-speech, no AI-generated or cloned voices, and no
assets ripped from any other game. See `docs/VOICE_ASSET_MANIFEST.md`.

Meridian Fuel & Provisions, Station 41, Coldbrook, and everyone in this game
are invented.

## Regenerating the art

```bash
python3 tools/fetch_images.py --redo        # original art (no API key needed)
python3 tools/fetch_ambientcg.py            # CC0 photographic surfaces
python3 tools/fetch_gemini.py               # same art via Gemini (needs GEMINI_API_KEY)
python3 tools/gen_manifests.py              # fold new assets into the manifests
python3 tools/build_single.py               # rebuild the one-file edition
```

See `docs/GENERATED_ART.md` for what was generated, what was deliberately not,
and the failures.

## For developers

- `tools/selftest.js` — load the game, open the console, run `__selftest()`
- `tools/playtest.js` — `__playtest()` plays all six nights automatically
- `__nc.dev` — teleports, night skip, state inspection, forced endings

## Known limitations

- Audio can only start after your first click — that is a browser rule.
- If the tab loses focus the game pauses, because browsers throttle background
  tabs.
- One save slot.
- The single-file build re-encodes audio to mono AAC to fit; the folder build
  keeps the full-quality sound.
- Some browsers refuse `localStorage` on `file://` (Safari always does). The
  single file still plays in full — it just cannot keep your progress between
  sessions there, and the pause menu says so. Use the folder build, or Chrome,
  if you want saves.
