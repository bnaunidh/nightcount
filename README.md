# THE NIGHT COUNT

A 1997 gas-station horror game. Six night shifts on a desert road: clock in,
mop, restock, read the pumps, serve whoever stops, lock up. Something is wrong
with the station, and it gets worse each night.

**▶ Play: https://bnaunidh.github.io/nightcount/**

Runs in the browser — no install, no plugins, nothing to sign in to. Give it a
moment on first load; it streams its models and textures before the shift
starts and caches them afterwards.

## Two editions

This site carries two builds of the same game, side by side:

| | built by | |
|---|---|---|
| [`/chatgpt/`](https://bnaunidh.github.io/nightcount/chatgpt/) | ChatGPT | the default — the root URL opens this one |
| [`/claude/`](https://bnaunidh.github.io/nightcount/claude/) | Claude | |

Open **DEV MODE** from the main menu (passcode **1234**) and the first row,
**Edition**, switches to the other build — it opens straight onto that
build's own dev panel.

## Controls

| | |
|---|---|
| `W` `A` `S` `D` | move |
| mouse | look |
| `Shift` | sprint |
| `E` | interact |
| `F` | flashlight |
| `Q` | notebook |
| `Tab` | task list |
| `Esc` | release the mouse / menu |

(ChatGPT's edition adds an inventory on `1`–`4`, `0` to stow and `G` to put an
item back.)

## Building the site

`python3 tools/build_site.py` copies both editions from their working folders,
applies the dev-mode patch to each (`tools/patch_edition.py`), and checks every
asset path either one names against the files with exact case — macOS forgives
a wrong-case path and GitHub Pages does not.

Built with [three.js](https://threejs.org) (MIT). Models, textures and sound
are CC0 or CC-BY; each edition's credits screen has the full list.
