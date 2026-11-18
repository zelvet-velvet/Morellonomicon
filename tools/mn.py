#!/usr/bin/env python3
"""Morellonomicon data CLI: the patch history and the games behind it.

    python3 -I tools/mn.py status              # per patch: lifecycle state, our games, dates, game versions, resg
    python3 -I tools/mn.py status --json       # the same as JSON (for a dashboard)
    python3 -I tools/mn.py snapshot            # keep the current tiers and builds in _data/history/<patch>/
    python3 -I tools/mn.py snapshot --backfill # also the past patches, from git history (newest commit per patch)

update_patch.py runs `snapshot` after the tiers and builds are rebuilt. Standard library only; see tools/datalib.py.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import datalib as dl   # noqa: E402


def git(*args):
    return subprocess.run(["git", *args], cwd=dl.ROOT, capture_output=True, check=True).stdout


def cmd_snapshot(args):
    if args.backfill:
        for name in dl.SNAPSHOT_FILES:
            seen = set()
            for line in git("log", "--format=%h %ad", "--date=short", "--", f"_data/{name}.json").decode().splitlines():
                commit, date = line.split()
                try:
                    raw = git("show", f"{commit}:_data/{name}.json")
                    patch = dl.patch_of(json.loads(raw)["patch"])
                except (subprocess.CalledProcessError, KeyError, ValueError):
                    continue
                if patch in seen or patch == dl.announced_patch():   # newest commit per patch; the current one below
                    continue
                seen.add(patch)
                dl.save_snapshot(name, raw, saved=date, commit=commit)
                print(f"{patch}  {name}  from {commit} ({date})")
    for name in dl.SNAPSHOT_FILES:
        f = dl.DATA / f"{name}.json"
        if f.exists():
            print(f"{dl.save_snapshot(name, f.read_bytes())}  {name}  current")


def bar(n, total, width=20):
    filled = min(width, round(width * n / total)) if total else 0
    return "█" * filled + "░" * (width - filled)


def cmd_status(args):
    s = dl.status()
    if args.json:
        print(json.dumps(s, ensure_ascii=False, indent=1))
        return
    cfg = s["lifecycle"]
    need = cfg["ready_games"]
    print(f"Pages built from {s['announced'] or '?'} · live patch {s['live'] or '?'} · Ready at {need:,} of our games"
          + ("" if cfg.get("decided") else " (threshold not decided)"))
    if s["live"] and s["announced"] and s["live"] != s["announced"]:
        print(f"  ! the pages show {s['announced']} while {s['live']} is live")
    print()
    for r in s["patches"]:
        lcu, resg = r["lcu"] or {}, r["resg"]
        head = f"{r['patch']:<6} {r['state']:<10}" + (" live" if r["live"] else "")
        print(head)
        if lcu:
            dates = f"{lcu['first']} → {lcu['last']}" if lcu["first"] else "no dates"
            if lcu["first"] and lcu["undated"]:
                dates += f" (+{lcu['undated']:,} undated)"
            print(f"  ours   {bar(lcu['games'], need)} {lcu['games']:,}/{need:,} games ({lcu['full']:,} full) · "
                  f"{lcu['champions']} champions · {dates}")
            vs = lcu["versions"]
            print(f"         game version {vs[0]}" + (f" … {vs[-1]} ({len(vs)} builds)" if len(vs) > 1 else ""))
        else:
            print("  ours   no games")
        if resg:
            print(f"  resg   {resg['games']:,} games, collected {resg['collected']} (private reference)")
        if r["history"]:
            print(f"  kept   {', '.join(r['history'])}")
        print()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("status", help="patches, lifecycle state and the games behind them")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_status)
    p = sub.add_parser("snapshot", help="keep the current tiers and builds per patch")
    p.add_argument("--backfill", action="store_true", help="also past patches from git history")
    p.set_defaults(fn=cmd_snapshot)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
