#!/usr/bin/env python3
"""
Assemble the published site: both editions of THE NIGHT COUNT side by side.

    python3 tools/build_site.py [out_dir]        (default: this repo)

    <out>/claude/    Claude's edition   <- ~/Desktop/night-count
    <out>/chatgpt/   ChatGPT's edition  <- ~/Downloads/for claude to update/game
    <out>/index.html sends visitors to the default edition

Each edition is copied without its dev tools and without model folders its
own MODEL table no longer points at, then patched (tools/patch_edition.py)
with passcode 1234 and the dev-mode switch to the other. Then every asset path
either edition's code names is checked against the files with EXACT case —
macOS forgives a wrong-case path and GitHub Pages 404s it, so it has to be
caught here, not after deploy.
"""
import os, re, shutil, subprocess, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE
SOURCES = {
    "claude": pathlib.Path.home() / "Desktop/night-count",
    "chatgpt": pathlib.Path.home() / "Downloads/for claude to update/game",
}
DEFAULT = "chatgpt"          # what bnaunidh.github.io/nightcount/ opens
EXCLUDE = [".git/", "tools/", "docs/", ".claude/", ".DS_Store", ".gitignore",
           "Play-Mac.command", "Play-Windows.bat", "_singlefile_test.html"]


def dead_model_dirs(root):
    """Model folders this edition's MODEL table never points at."""
    src = (root / "src/core/assets.js").read_text()
    body = src[src.index("export const MODEL = {"):]
    body = body[:body.index("\n};")]
    used = set(re.findall(r'"(assets/[^"]+)"', body))
    keep = {os.path.dirname(u) for u in used}
    dead = []
    for top in ("assets/models", "assets/models_lowpoly"):
        if (root / top).is_dir() and not any(k == top or k.startswith(top + "/") for k in keep):
            dead.append(top + "/")
    return dead


def case_check(root):
    have = set()
    for r, _, fs in os.walk(root):
        for f in fs:
            have.add(os.path.relpath(os.path.join(r, f), root).replace(os.sep, "/"))
    code = ""
    for r, _, fs in os.walk(root / "src"):
        for f in fs:
            if f.endswith((".js", ".json")):
                code += open(os.path.join(r, f), encoding="utf-8", errors="replace").read()
    code += (root / "index.html").read_text()
    refs = sorted(set(re.findall(r'["\'](assets/[A-Za-z0-9_./-]+\.[a-z0-9]{2,5})["\']', code)))
    bad = [r for r in refs if r not in have]
    return len(refs), bad


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for ed, src in SOURCES.items():
        dst = OUT / ed
        ex = EXCLUDE + dead_model_dirs(src)
        cmd = ["rsync", "-a", "--delete", "--delete-excluded"] + sum([["--exclude", e] for e in ex], []) + [str(src) + "/", str(dst) + "/"]
        subprocess.run(cmd, check=True)
        subprocess.run([sys.executable, str(HERE / "tools/patch_edition.py"), str(dst), ed], check=True)
        n, bad = case_check(dst)
        if bad:
            sys.exit("%s: %d asset path(s) that would 404 on Pages: %s" % (ed, len(bad), bad[:8]))
        size = sum(f.stat().st_size for f in dst.rglob("*") if f.is_file()) / 1e6
        print("  %-8s %d asset paths ok, %.0f MB" % (ed, n, size))
    (OUT / "index.html").write_text('''<!doctype html>
<meta charset="utf-8">
<title>THE NIGHT COUNT</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>location.replace("%s/" + location.search + location.hash);</script>
<noscript><meta http-equiv="refresh" content="0; url=%s/"></noscript>
<a href="%s/">THE NIGHT COUNT</a>
''' % (DEFAULT, DEFAULT, DEFAULT))
    (OUT / ".nojekyll").touch()
    print("site built at %s (root opens %s)" % (OUT, DEFAULT))


if __name__ == "__main__":
    main()
