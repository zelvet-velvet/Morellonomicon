#!/usr/bin/env python3
"""One command for a new patch: regenerate every data note and data file.

    python3 tools/update_patch.py             # run all the steps
    python3 tools/update_patch.py --commit    # ...then commit and push the result to main

Steps, in order: champions and items (fetch_data), Mayhem augments (fetch_augments), what changed since the last patch
(fetch_changes), Riot's patch notes in short (fetch_patch_notes), augment effect text (fetch_augment_text), the
ability tag audit (audit_tags, Review/Tag Audit.md). Your own notes in the generated files are kept (see
HAND_KEYS in fetch_data.py). If a step fails the rest still run and the failures are listed at the end. Standard library only.
"""
import argparse
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
STEPS = [("champions and items", "fetch_data.py"), ("Mayhem augments", "fetch_augments.py"),
         ("changes since the last patch", "fetch_changes.py"), ("Riot's patch notes", "fetch_patch_notes.py"),
         ("augment effect text", "fetch_augment_text.py"), ("lanes (Meraki)", "fetch_positions.py"), ("loading screen tips", "fetch_loading_tips.py"),
         ("ability tag audit", "audit_tags.py")]
ATTRIBUTION = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, **kw)


def prune_cache():
    """The game files are downloaded once per day into .cache/cdragon-<date> and .cache/cdragon-bin-<date> (about 45 MB). Only today's are
    ever read again, so older days are deleted (they also fill GitHub's cache)."""
    today = datetime.date.today().isoformat()
    freed = 0
    for d in (ROOT / ".cache").glob("cdragon-*"):
        if d.is_dir() and not d.name.endswith(today):
            freed += sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
            shutil.rmtree(d)
    if freed:
        print(f"cleaned old downloads: {freed / 1e6:.0f} MB freed")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--commit", action="store_true", help="commit and push the changes to main afterwards")
    args = ap.parse_args()
    failed = []
    prune_cache()
    for label, script in STEPS:
        print(f"\n== {label} ({script})")
        if run([sys.executable, "-I", str(TOOLS / script)]).returncode != 0:
            failed.append(label)
    print("\n== summary")
    status = run(["git", "status", "--short"], capture_output=True, text=True).stdout.strip()
    print(status or "nothing changed")
    if failed:
        print("FAILED:", ", ".join(failed))
    if args.commit and status:
        if failed:
            print("not committing: fix the failed steps first")
            return 1
        run(["git", "add", "-A"], check=True)
        run(["git", "commit", "-q", "-m", f"data(patch): update the generated notes and data\n\n{ATTRIBUTION}"], check=True)
        run(["git", "push", "-q", "origin", "main"], check=True)
        print("committed and pushed")
    elif status:
        print("review the changes, then: git add -A && git commit && git push   (or rerun with --commit)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
