# THE NIGHT COUNT — textured playable preview

A 1997 gas-station horror game. Six night shifts on a desert road: clock in,
mop, restock, read the pumps, serve whoever stops, lock up. Something is wrong
with the station, and it gets worse each night.

**▶ Play it: https://bnaunidh.github.io/nightcount/**

Runs in the browser. No install, no plugins, nothing to sign in to. Give it a
moment on first load — it streams about 45 MB of models and textures before the
shift starts, and caches them afterwards.

## Controls

| | |
|---|---|
| `W` `A` `S` `D` | move |
| mouse | look |
| `Shift` | sprint |
| `E` | interact |
| `F` | equip / toggle the flashlight |
| `Q` | notebook |
| `1` `2` `3` `4` | equip an inventory slot (`1` flashlight, `2` cellphone) |
| `0` | stow the held item |
| `G` | put the held item back where it came from |
| `Tab` | task list |
| `Esc` | release the mouse / menu |

During a conversation, click a reply or press `1` / `2` / `3`.

## Night 1, if you get stuck

Clock in at the machine beside **OFFICE** on the shop's back wall. A delivery
truck arrives after that — unload its two cases at **STOCK RECEIVING**, then
load the two **EMPTY RETURNS** crates onto the truck with `E`. Talk to the
driver afterwards, then look toward the road.

## What this is

This edition was built by ChatGPT on top of the original project: textured
station and props, fifteen shelf products, ten character looks, ten vehicles
with animated doors and wheels, sixteen custom character clips, 36 sound cues,
doors and signage, a four-slot inventory, and a scripted Night 1 encounter.

Built with [three.js](https://threejs.org) (MIT). Models, textures and sound are
CC0 or CC-BY — see `docs/ATTRIBUTION.md` for the full credit list. The game's
own models were built for it in Blender.

Work in progress. `docs/` holds the story bible, the shift plan and the asset
manifests; `src/` is the game.
