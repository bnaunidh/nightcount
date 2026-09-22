# THE NIGHT COUNT — Generated Art Record

Ten original 2D assets were generated for this game and are in the build. This
file records what was generated, with what, from what prompt, and — just as
importantly — **what generation was not used for, and why**.

Regenerate everything with:

```bash
python3 tools/fetch_images.py --redo
```

## What was used

**Flux (schnell), through `image.pollinations.ai`.** No API key, no account, no
installed software — an HTTP GET with the prompt in the path. That matters here
because it means the art pass is reproducible by anyone who clones this folder,
with no credentials to hand around.

A **Gemini** path also ships (`tools/fetch_gemini.py`, same asset list, same
conditioning). It is not the default because it needs a key this machine does
not have:

```bash
export GEMINI_API_KEY=...      # https://aistudio.google.com/apikey
python3 tools/fetch_gemini.py  # writes the same assets/gen/index.json
```

Either tool writes `assets/gen/index.json`, and the game picks generated art up
at boot with no code change (`loadGenerated()` in `src/core/assets.js`). If the
folder is absent the game is complete anyway — the generated art is an upgrade
layer, never a dependency.

## What shipped

| Asset | Where it appears in the game | Size |
|---|---|---|
| `boot_plate` | the boot / loading screen, behind the progress bar | 1024px |
| `meridian_logo` | the roadside sign face, and a decal on the shopfront glass | 512px |
| `sign_face` | generated, **not used** — see failures below | 640px |
| `snack_labels` | packaging reference atlas | 1024px |
| `soda_labels` | cooler stock label reference | 1024px |
| `notice_blank` | workplace notices on the back-of-house walls | 576px |
| `missing_poster` | the missing-person notice by the front door | 576px |
| `oil_stain` | three decals soaked into the forecourt | 512px |
| `cig_pack_face` | the pack at the centre of the plot | 512px |
| `station_photo` | the framed photograph over the manager's desk | 640px |

Every prompt, seed, requested size, shipped size and post-processing step is in
`tools/gen_receipt.json`, written by the generator itself.

## What generation was **not** used for, and why

**Tiling surfaces.** Every floor, wall, ceiling, road and ground texture in the
game is a photographic CC0 material from **Poly Haven** or **ambientCG**, not a
generated image. This was tested, not assumed:

> Prompt: *"seamless tileable dirty bathroom tile, orthographic, flat lighting"*
> Result: a photorealistic render of a **bathroom**, in perspective, with a
> toilet and a sink in it.

Rewriting the prompt in the model's own terms — *"photographed straight on,
camera perpendicular to the surface, fills the entire frame, no room, no
objects, no perspective"* — produced a genuinely flat tile swatch on the second
attempt. It was still not seamless, still had a diagonal artifact, and was
still worse than `Tiles141` from ambientCG, which is a real photograph of a real
dirty tiled wall, correctly lit and actually tileable.

So the split in this project is:

| Need | Source | Why |
|---|---|---|
| Surfaces that tile | Poly Haven + ambientCG (CC0 photographic) | genuinely seamless, correctly lit, higher fidelity |
| Invented brand, signage, packaging, notices, plates | generated | no library contains a company that does not exist |

**Legible text.** Nothing in this game reads its words off a generated image.
Every prompt says *no text* three different ways, and the models still put
mangled lettering on the snack packets (visible in `snack_labels`). All the
writing a player actually reads — the binder, the manager's notes, the pump
log, receipts, the price sign — is real typography set in HTML or drawn in the
engine. That is a deliberate rule, not a workaround: this is a game about
reading documents closely.

## Failures, kept honest

| Asset | What was asked for | What came back | Decision |
|---|---|---|---|
| `sign_face` | a flat cream acrylic sign panel with empty numeral channels | a glowing neon oval light fixture, in perspective | **not used** — the sign face uses `meridian_logo` instead |
| `snack_labels` | six packets, no text | six plausible packets with garbled pseudo-lettering | kept as a reference atlas; at 640×360 the colour and silhouette are what read |
| `meridian_logo` | a chevron inside a ring | concentric rings, no chevron | kept — it works as a mark, and re-rolling for the exact brief was not worth the credits it would cost someone with a paid key |

## Provenance and rights

Flux (schnell) is an openly licensed model and Pollinations documents its
outputs as free to use; no rights are asserted over them here. The generated
assets depict an **invented** company: Meridian Fuel & Provisions does not
exist, and no prompt names or imitates a real brand, product, person or
photograph. If you would rather ship with no generated content at all, delete
`assets/gen/` — the game loses the boot plate, the sign mark, the wall paper and
the forecourt stains, and is otherwise unchanged.
