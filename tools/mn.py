#!/usr/bin/env python3
"""Morellonomicon data CLI: the patch history and the games behind it.

    python3 -I tools/mn.py status              # per patch: lifecycle state, our games, dates, game versions, resg
    python3 -I tools/mn.py status --json       # the same as JSON (for a dashboard)
    python3 -I tools/mn.py snapshot            # keep the current tiers and builds in _data/history/<patch>/
    python3 -I tools/mn.py snapshot --backfill # also the past patches, from git history (newest commit per patch)
    python3 -I tools/mn.py report              # the dashboard: .cache/reports/status.html, opened in the browser (PC only)
    python3 -I tools/mn.py report --no-open    # write it only
    python3 -I tools/mn.py tiers               # champion and augment tiers with games and win rates: .cache/reports/tiers.html
    python3 -I tools/mn.py tiers --folio       # also a copy in the private folio, ../morellonomicon-folio/Reports/tiers.html

update_patch.py runs `snapshot` after the tiers and builds are rebuilt. Standard library only; see tools/datalib.py.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import toolpath  # noqa: E402,F401  (the job folders: crawl/, fetch/, reason/, vault/)
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


def cmd_report(args):
    """The dashboard: tools/data/report.html with the status and, per patch with our games, games per day and samples per
    champion. Private (our crawl's counts), so it goes to the git-ignored .cache/reports/."""
    s = dl.status()
    s["detail"] = {r["patch"]: dl.lcu_detail(r["patch"]) for r in s["patches"] if r["lcu"]}
    page = (Path(__file__).resolve().parent / "data" / "report.html").read_text(encoding="utf-8")
    data = json.dumps(s, ensure_ascii=False).replace("</", "<\\/")
    out = dl.ROOT / ".cache" / "reports" / "status.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page.replace("DATA_JSON", data, 1), encoding="utf-8")
    print(f"-> {out}")
    if not args.no_open:
        open_page(out)


def open_page(out):
    win = subprocess.run(["wslpath", "-w", str(out)], capture_output=True, text=True).stdout.strip() if Path("/mnt/c").exists() else ""
    if win:
        subprocess.run(["/mnt/c/Windows/explorer.exe", win])   # explorer returns 1 even when it opened the file
    else:
        import webbrowser
        webbrowser.open(out.as_uri())


def frontmatter(folder):
    """Each note's flat frontmatter in a vault folder, as strings (lists and nesting are not needed here)."""
    import re
    out = []
    for f in (dl.ROOT / folder).glob("*.md"):
        head = f.read_text(encoding="utf-8")[:1500]
        if not head.startswith("---"):
            continue
        fm = {}
        for m in re.finditer(r'^(\w+):\s*(.*)$', head.split("\n---", 1)[0], re.M):
            fm[m.group(1)] = m.group(2).strip().strip('"')
        out.append(fm)
    return out


# The tier viewer's augment tiers (decided with Zaviel 2026-11-21, after reading how resg.top tiers: raw win rate in 3-point
# bands, a 高 / 中 / 观察 label by games): an augment's overall number is its average gap to each champion's own win rate,
# weighted by picks and pulled toward 0 by GAP_PRIOR games, so strong champions taking it do not make it look strong. The
# same 3-point bands as the champions', centred on 0. A second column, the model (tools/crawl/augment_model.py, our crawl only),
# also holds the other augments fixed. Pick rate only orders ties and is shown for confidence.
GAP_PRIOR = 200
GAP_BANDS = ((4.5, "T0"), (1.5, "T1"), (-1.5, "T2"), (-4.5, "T3"))   # points at or above -> tier; below the last is T4


def gap_tier(points):
    return next((t for low, t in GAP_BANDS if points >= low), "T4")


def cmd_tiers(args):
    """The tier viewer: every champion's tier, games and win rate, its augment tiers (with each pair's games and win
    rate) and most-won items, and every augment's games, win rate and pick rate, from the games the current
    augment-tiers.json was built from (our crawl or resg.top). Private numbers, so it goes to the git-ignored .cache/reports/."""
    import vault_paths
    tiers = dl.read_json(dl.DATA / "augment-tiers.json")
    ctiers = dl.read_json(dl.DATA / "champion-tiers.json")
    patch, source = tiers["patch"], tiers["source"]
    cache = (dl.ROOT / ".cache" / "lcu" / "cache" / patch) if source.startswith("our crawl") else (dl.RESG / patch)
    if not cache.exists():
        sys.exit(f"no cached games for {patch} ({source}) at {cache}")
    champs = {fm["id"]: fm for fm in frontmatter(vault_paths.CHAMPIONS) if fm.get("key")}
    augs = {fm["id"]: fm for fm in frontmatter(vault_paths.AUGMENTS) if fm.get("id")}
    items = {fm["id"]: fm for fm in frontmatter(vault_paths.ITEMS) if fm.get("id")}
    aug_games = {str(a["id"]): a for a in dl.read_json(cache / "augments.json")["items"]}
    # each augment's gap to the champions' own win rates, over every champion that took it
    gap_sum, gap_n = {}, {}
    for f in (cache / "champions").glob("*.json"):
        c = dl.read_json(f)
        cg, cw = c["champion"]["tm"], c["champion"]["wm"]
        if not cg:
            continue
        for r in c.get("ra", []):
            a, g, w = str(r[0]), r[2], r[3]
            gap_sum[a] = gap_sum.get(a, 0) + (w - g * cw / cg)
            gap_n[a] = gap_n.get(a, 0) + g
    model = None
    if not args.no_model:
        try:
            import augment_model
            model = augment_model.fit(patch, progress=lambda m: print(m, flush=True))
        except Exception as e:   # no crawl of this patch on this PC, or no database: the page works without the column
            print(f"model: skipped ({e})")
    out_augs = {}
    for aid, fm in augs.items():
        g = aug_games.get(aid, {})
        n = gap_n.get(aid, 0)
        gap = round(gap_sum.get(aid, 0) / (n + GAP_PRIOR) * 100, 2) if n else None
        m = (model or {}).get("augments", {}).get(aid)
        out_augs[aid] = {"name": fm.get("name", aid), "rarity": fm.get("rarity", ""), "icon": fm.get("icon", ""),
                         "games": g.get("tm", 0), "wins": g.get("wm", 0), "pr": g.get("pr", 0),
                         "unrated": tiers.get("unrated", {}).get(aid, ""),
                         "gap": gap, "gap_tier": gap_tier(gap) if gap is not None and n >= 100 else "",
                         "model": m and [m[0], m[1], m[2], gap_tier(m[0]) if m[2] >= 100 else ""]}
    out_champs = []
    for key, fm in champs.items():
        f = cache / "champions" / f"{fm['key']}.json"
        if not f.exists():
            continue
        c = dl.read_json(f)
        pair = {str(r[0]): (r[2], r[3]) for r in c.get("ra", [])}
        styles = []
        for sname, st in tiers["champions"].get(key, {}).items():
            rows = []
            for t in st.get("tiers", []):
                g, w = pair.get(str(t["id"]), (0, 0))
                rows.append([str(t["id"]), t["tier"], t.get("reason", ""), g, w, t.get("when", ""), t.get("score", 0)])
            styles.append({"name": st.get("name", sname), "rows": rows})
        top = [[str(r[0]), r[1], r[2]] for r in c.get("ia", {}).get("items", [])
               if str(r[0]) in items and r[1] >= 30][:12]
        out_champs.append({"key": key, "name": fm.get("name", key), "en": fm.get("name_en", key), "icon": fm.get("icon", ""),
                           "roles": fm.get("roles", ""), "tier": ctiers.get("champions", {}).get(key, ""),
                           "games": c["champion"]["tm"], "wins": c["champion"]["wm"], "styles": styles, "items": top})
    used = {i for c in out_champs for i, *_ in c["items"]}
    data = {"patch": patch, "source": source, "built": tiers.get("source", ""),
            "model": model and {"samples": model["samples"], "games": model["games"], "made": model["made"]},
            "champions": out_champs, "augments": out_augs,
            "items": {i: {"name": items[i].get("name", i)} for i in used}}
    page = (Path(__file__).resolve().parent / "data" / "tiers.html").read_text(encoding="utf-8")
    out = dl.ROOT / ".cache" / "reports" / "tiers.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page.replace("DATA_JSON", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"), 1), encoding="utf-8")
    print(f"-> {out}  ({len(out_champs)} champions, {len(out_augs)} augments, {source})")
    if args.folio:   # a copy in the private folio (Reports/), which Zaviel asked for to view it away from this PC
        import shutil
        dest = dl.ROOT.parent / "morellonomicon-folio" / "Reports" / "tiers.html"
        if not dest.parent.parent.exists():
            sys.exit(f"no folio at {dest.parent.parent}")
        dest.parent.mkdir(exist_ok=True)
        shutil.copyfile(out, dest)
        print(f"-> {dest}")
    if not args.no_open:
        open_page(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("status", help="patches, lifecycle state and the games behind them")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_status)
    p = sub.add_parser("snapshot", help="keep the current tiers and builds per patch")
    p.add_argument("--backfill", action="store_true", help="also past patches from git history")
    p.set_defaults(fn=cmd_snapshot)
    p = sub.add_parser("report", help="the dashboard as a private HTML page")
    p.add_argument("--no-open", action="store_true", help="write the page without opening it")
    p.set_defaults(fn=cmd_report)
    p = sub.add_parser("tiers", help="champion and augment tiers with games and win rates, a private HTML page")
    p.add_argument("--no-open", action="store_true", help="write the page without opening it")
    p.add_argument("--folio", action="store_true", help="also copy it into the private folio's Reports/")
    p.add_argument("--no-model", action="store_true", help="leave out the model column (it takes about a minute when the crawl changed)")
    p.set_defaults(fn=cmd_tiers)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
