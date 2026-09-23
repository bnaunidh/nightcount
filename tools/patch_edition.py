#!/usr/bin/env python3
"""
Give one edition of THE NIGHT COUNT the dev-mode edition switch, and the
passcode 1234.

    python3 tools/patch_edition.py <game_root> <claude|chatgpt>

The published site carries both editions side by side — /nightcount/claude/
and /nightcount/chatgpt/ — and DEV MODE in either offers the other. Switching
is a navigation to the sibling folder with #devmode on the end; both live on
one origin, so the unlock (sessionStorage) carries across and the other
edition opens straight onto its own dev panel.

Idempotent, and every edit is anchored and asserted: if a new drop of either
edition moves the code this patches, the script stops and says where, rather
than shipping a build where the switch silently isn't there.
"""
import pathlib, re, sys

root = pathlib.Path(sys.argv[1]); ed = sys.argv[2]
NAMES = {"claude": "Claude", "chatgpt": "ChatGPT"}
assert ed in NAMES, "edition must be claude or chatgpt"
src = root / "src"
changed = []


def edit(rel, fn):
    p = src / rel
    t = p.read_text()
    u = fn(t)
    if u != t:
        p.write_text(u); changed.append(rel)


# 1. passcode
def passcode(t):
    if 'const CODE = "1234";' in t:
        return t
    assert re.search(r'const CODE = "\d{4}";', t), "devmode.js: CODE not found"
    return re.sub(r'const CODE = "\d{4}";', 'const CODE = "1234";', t, count=1)
edit("core/devmode.js", passcode)

# 2. which edition this is
(src / "core" / "edition.js").write_text('''// THE NIGHT COUNT — which build this is.
//
// Two editions of this game exist: one built by Claude, one by ChatGPT. The
// published site carries both side by side, and DEV MODE offers the other.
// Written by nightcount-site/tools/patch_edition.py — edit it there.
export const EDITION = { id: "%s", name: "%s" };
export const EDITIONS = [
  { id: "claude", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
];

/**
 * Where edition `id` lives, if this page is on the site that carries both
 * (…/claude/ or …/chatgpt/). Anywhere else — the single-file build, a dev
 * server at the root — there is no sibling to go to, and this says so.
 */
export function editionHref(id) {
  const m = /^(.*\\/)(claude|chatgpt)\\/(index\\.html)?$/.exec(location.pathname);
  return m ? m[1] + id + "/" : null;
}
''' % (ed, NAMES[ed]))
changed.append("core/edition.js")

# 3. the menu: an Edition row at the top of the dev panel, and #devmode on arrival
def menu(t):
    if "editionHref" in t:
        return t
    imp = 'import { devmode, tryUnlock, lockDev, DEV_CLOCK_MIN, DEV_CLOCK_MAX } from "../core/devmode.js";'
    assert imp in t, "menu.js: devmode import not found"
    t = t.replace(imp, imp + '\nimport { EDITION, EDITIONS, editionHref } from "../core/edition.js";', 1)
    anchor = '      const nights = el(`<div class="pchoice"></div>`);'
    assert t.count(anchor) == 1, "menu.js: showDev night picker not found"
    row = '''      // Which build: this one, or the other edition's. Only where both are
      // published side by side; anywhere else there is nowhere to go.
      const eds = el(`<div class="pchoice"></div>`);
      for (const e of EDITIONS) {
        const href = editionHref(e.id);
        const here = e.id === EDITION.id;
        const b = el(`<button class="${here ? "on" : ""}">${esc(e.name)}</button>`);
        if (!here && !href) b.disabled = true;
        b.onclick = () => { if (!here && href) location.href = href + "#devmode"; };
        eds.appendChild(b);
      }
      row("Edition", editionHref(EDITION.id)
        ? "this build is " + EDITION.name + "'s — switch to the other"
        : "both editions sit side by side on the published site", eds);

'''
    t = t.replace(anchor, row + anchor, 1)
    main = '''  showMain() {
    this.mode = "main";'''
    assert main in t, "menu.js: showMain not found"
    hook = '''  showMain() {
    // Arriving from the other edition's dev panel: go straight back to one.
    if (location.hash === "#devmode" && devmode.unlocked && !BUILD.demo) {
      history.replaceState(null, "", location.pathname + location.search);
      setTimeout(() => { this.stack.push(() => this.showMain()); this.showDev(); }, 0);
    }
    this.mode = "main";'''
    return t.replace(main, hook, 1)
edit("ui/menu.js", menu)

print("patched %s edition at %s: %s" % (ed, root, ", ".join(changed) or "already up to date"))
