# THE NIGHT COUNT — Safeguard Log

Every download and **every rejection**, per master prompt §3.9. The rejections
matter as much as the acquisitions: they are the evidence the vetting actually
happened rather than being asserted.

Session: the vehicle / defect / polish pass.

---

## Standing constraints observed this session

- No account was created or signed into, anywhere, for any reason (§3.2).
- No personal data of the user's was read, used, or transmitted (§3.2).
- Nothing was uploaded, published, pushed, or transmitted off the machine (§3.6).
- Nothing outside `~/Desktop/night-count` was created, modified, or deleted (§3.1).
- No software was installed — global or local. The audit harness was built as an
  in-page module specifically to avoid installing a headless browser (§3.5, and
  the user's own standing instruction that nothing be installed on their Mac).
- No downloaded code was executed. The only downloads were model and audio data
  files, each checked before use (§3.4).

---

## Downloads

### D-01 — fuel tanker model
| Field | Value |
|---|---|
| Time | this session |
| Action | replace `tanker.glb`, which was byte-identical to `car_pickup.glb` (§6.10) |
| Source | `poly.pizza` — <https://poly.pizza/m/3AmDGcCu6Ll> |
| Tier | **1** (known-good; already the project's low-poly source) |
| Creator | Alex Safayan |
| Licence | **CC-BY**, as stated on the asset's own page |
| Decision | **downloaded** |
| File checks | magic bytes `glTF` ✓ · 203,056 bytes (in range) ✓ · md5 `005766576236…` ✓ not a duplicate of anything in the tree · glTF JSON chunk parses ✓ · 88 meshes, no external URIs, no scripts, no extensions beyond geometry ✓ |
| Attribution | required — recorded in `ASSET_MANIFEST.md` / `ATTRIBUTION.md` |
| Still to do | **verify in-engine that it reads as a tanker.** The listing says tanker; the model is normalised to a 2 × 2 × 2 box so its shape cannot be judged from metadata alone. If it does not read as a tanker, it will be replaced or the scene adapted (§2.1), and this entry updated. |

### D-02 — pencil-writing sound
| Field | Value |
|---|---|
| Action | replace `int_pencil_write.mp3`, which was byte-identical to `int_pencil_tick.mp3` |
| Source | `freesound.org`, via the project's own `tools/fetch_audio.py` |
| Tier | **1** |
| Creator | magnus1906 — *"Writing - pencil on paper"* |
| Licence | **CC0**, re-verified by the fetcher against the sound's own page before download |
| Decision | **downloaded** |
| File checks | MP3 magic ✓ · 877,190 bytes ✓ · decodes ✓ · md5 distinct from every other asset ✓ |

### D-03 — the three silent slots (§9 coverage sweep)
| Field | Value |
|---|---|
| Action | supply files for three slots the game was already playing with nothing behind them |
| Source | `freesound.org`, via the project's own `tools/fetch_audio.py` |
| Tier | **1** |
| Licence | **CC0** on all three, re-verified by the fetcher against each sound's own page before download |
| Decision | **downloaded** |

| Slot | Creator | Page | Bytes | Checks |
|---|---|---|---|---|
| `int_pump_nozzle` | itinerantmonk108 — *"filling the tank"* | [787479](https://freesound.org/people/itinerantmonk108/sounds/787479/) | 1,882,176 | MPEG layer III 48 kHz mono ✓ · md5 `4e05100d…` distinct ✓ |
| `int_panel_metal` | Exarchik — *"squeaky-metal-cabinet-door"* | [713574](https://freesound.org/people/Exarchik/sounds/713574/) | 1,487,903 | MPEG layer III 44.1 kHz ✓ · md5 `0b1a8b78…` distinct ✓ |
| `int_regkey` | UberBosser — *"ctrlKey.wav"* | [421584](https://freesound.org/people/UberBosser/sounds/421584/) | 7,725 | MPEG layer III 44.1 kHz ✓ · md5 `ef82de01…` distinct ✓ |

`tools/assetcheck.py` re-run across all 342 files afterwards: 0 banned, 0 bad
magic, 0 bad size, **0 duplicates**, 0 dangling refs. Receipt with full
licence and page metadata for each: `tools/audio_receipt_sweep.json`.

No account was created or used. Nothing was uploaded, published or
transmitted. Nothing was synthesised, and no voice in this game is spoken by a
machine — the two human reaction sounds now wired into scares
(`hum_gasp`, `hum_breath_scared`) are recorded CC0 performances that were
already in the project from the first fetch.

---

## Rejections

### R-01 — Quaternius "tanker", poly.pizza
| Field | Value |
|---|---|
| Source | <https://poly.pizza/m/qn4grQgHm8> — Quaternius, **CC0** |
| Why it was attractive | CC0, and the same creator as the rest of the low-poly set, so stylistically consistent |
| Decision | **REJECTED** |
| Reason | Downloaded, hashed, and found **byte-identical to `assets/models_lowpoly/car_pickup.glb`** (md5 `7ceb24f2b640c885a5e77ef22e7cbd3a`). It is the same file the original fetcher grabbed. Discarded without writing it into the tree. |
| Significance | This is **exactly the failure in §6.10 happening again**, and the new hash guard caught it on the way in. Searching poly.pizza for "tanker truck" genuinely returns a pickup — the original error was not carelessness so much as an un-checked search result. The guard is now permanent, in both `assetcheck.py` and the download path. |

### R-02 — "Tanker" by Poly by Google, poly.pizza
| Field | Value |
|---|---|
| Source | <https://poly.pizza/m/aT_24cDaW1a> — CC-BY |
| Decision | **REJECTED** |
| Reason | Inspected the glTF JSON chunk before accepting it: its single node is named **`Van`**, and its bounding box is 43.9 × 34.3 × 80.2 units. It is a van, mislabelled in search results. Wrong object. |

### R-03 — KolosStudios "fuel truck", poly.pizza
| Field | Value |
|---|---|
| Source | <https://poly.pizza/m/64ayx6pW3O> — CC-BY |
| Decision | **not used** (held as fallback) |
| Reason | Single mesh, bounding box 0.19 × 0.03 × 0.08 — a length-to-height ratio of 6.3 where a tanker should be about 3.4. That proportion suggests the model is a flat or trailer-only asset. Kept as a fallback if D-01 fails its in-engine check, rather than accepted blind. |

### R-04 — Mixamo
| Field | Value |
|---|---|
| Source | `mixamo.com` |
| Decision | **out of scope, not attempted** |
| Reason | Requires an Adobe account. §3.2 forbids creating or signing into an account under any circumstances, and the master prompt lists it as out of scope for exactly this reason. No request was made to the site. Character animation continues to come from the Quaternius CC0 library already in `assets/characters/`. |

---

## Tier 2 sources considered

**None.** Everything needed this session was available from the Tier 1 list
(Poly Haven, poly.pizza, ambientCG, Freesound, Quaternius, Kenney). No
reputation-check protocol (§3.3.2) was triggered because no download was made
from a site outside the known-good list. If that changes, the searches run and
their results go here before the download, not after.
