#!/usr/bin/env python3
"""Our own Mayhem crawl (tools/fetch_lcu.py, .cache/mayhem.sqlite) as evidence for the tiers and builds, in resg.top's cache format.

tools/augment_tiers.py and tools/build_tiers.py read games per champion, augment and item from a cache folder laid out like
resg.top's (tools/fetch_resg.py). This writes the same files from our crawl into the git-ignored .cache/lcu/cache/<patch>/, so a
patch resg.top has not published yet can still be built from our games; the tier scripts take the newest patch of either source
(resg.top when both have it, its sample is far larger). Like resg's, no number from here is written into the repo or a note,
only the tiers and builds worked out from them.

    python3 -I tools/lcu_cache.py            # the newest patch in the crawl
    python3 -I tools/lcu_cache.py 16.23

Item order: the client lists a player's items by inventory slot, which is mostly the order they were bought (a new item takes the
first free slot); the first-items orders (combos) assume that. Standard library.
"""
import datetime
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
from build_tiers import items as item_pool  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / ".cache" / "mayhem.sqlite"
OUT = ROOT / ".cache" / "lcu" / "cache"
SLOTS = [f"item{i}" for i in range(7)]
AUGS = [f"aug{i}" for i in range(1, 7)]
NOT_OFFERED = 8   # at our volume: an augment expected this many times on a champion, at 0 games, is not offered to it


def main():
    if not DB.exists():
        print("no crawl on this machine (tools/fetch_lcu.py): skipped")   # the GitHub patch job has none
        return
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    patches = [r[0] for r in db.execute("SELECT DISTINCT patch FROM games WHERE patch IS NOT NULL")]
    patch = sys.argv[1] if len(sys.argv) > 1 else max(patches, key=lambda p: [int(x) for x in p.split(".")], default=None)
    if patch not in patches:
        sys.exit(f"the crawl has no patch {patch} (has {', '.join(sorted(patches))})")
    rows = db.execute(f"SELECT champ, win, {', '.join(SLOTS + AUGS)} FROM players JOIN games USING (game_id) WHERE patch=?",
                      (patch,)).fetchall()
    last = db.execute("SELECT max(created), count(*) FROM games WHERE patch=?", (patch,)).fetchone()
    pool, alias = item_pool()
    finished = lambda i: alias.get(i, i) in pool   # noqa: E731
    is_boots = lambda i: pool.get(alias.get(i, i), {}).get("boots", False)   # noqa: E731

    champ = defaultdict(lambda: [0, 0])                        # champion -> games, wins
    aug = defaultdict(lambda: [0, 0])                          # augment -> picks, wins
    ra = defaultdict(lambda: defaultdict(lambda: [0, 0]))      # champion -> augment -> games, wins
    ia = defaultdict(lambda: defaultdict(lambda: [0, 0]))      # champion -> item -> games, wins
    combos = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0, 0])))   # champion -> k -> first k items -> games, wins
    for r in rows:
        c, win, slots, augs = r[0], r[1], r[2:9], r[9:]
        champ[c][0] += 1
        champ[c][1] += win
        for a in {a for a in augs if a}:
            aug[a][0] += 1
            aug[a][1] += win
            ra[c][a][0] += 1
            ra[c][a][1] += win
        for i in {i for i in slots if i and finished(i)}:
            ia[c][i][0] += 1
            ia[c][i][1] += win
        order = [i for i in slots if i and finished(i) and not is_boots(i)]
        for k in (1, 2, 3, 5):
            if len(order) >= k:
                combos[c][str(k)][tuple(order[:k])][0] += 1
                combos[c][str(k)][tuple(order[:k])][1] += win

    out = OUT / patch
    (out / "champions").mkdir(parents=True, exist_ok=True)
    samples = len(rows)
    wr = lambda g, w: round(w / g, 4) if g else 0.0   # noqa: E731
    bp = lambda g, w: round(w / g * 10000) if g else 0   # noqa: E731
    augs_out = [{"id": a, "tm": g, "wm": w, "wr": wr(g, w), "pr": round(g / samples, 4)} for a, (g, w) in aug.items()]
    (out / "augments.json").write_text(json.dumps({"items": augs_out}), encoding="utf-8")
    for c, (g, w) in champ.items():
        data = {
            "champion": {"id": c, "tm": g, "wm": w, "wr": wr(g, w)},
            "ra": [[a, 0, ag, aw, bp(ag, aw)] for a, (ag, aw) in sorted(ra[c].items(), key=lambda kv: -kv[1][0])],
            "ia": {"items": [[i, ig, iw, 0, bp(ig, iw)] for i, (ig, iw) in sorted(ia[c].items(), key=lambda kv: -kv[1][0])],
                   "combos": {k: [[n + 1, list(ids), cg, cw, bp(cg, cw)] for n, (ids, (cg, cw)) in
                                  enumerate(sorted(v.items(), key=lambda kv: -kv[1][0]))] for k, v in combos[c].items()}},
            "b": {},
        }
        (out / "champions" / f"{c}.json").write_text(json.dumps(data), encoding="utf-8")
    collected = datetime.datetime.fromtimestamp(last[0] / 1000 if last[0] > 1e11 else last[0], datetime.timezone.utc).isoformat()
    meta = {"version": patch, "collectedAt": collected, "source": "our crawl", "games": last[1], "not_offered": NOT_OFFERED}
    (out / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    print(f"our crawl {patch}: {last[1]:,} games, {samples:,} samples, {len(champ)} champions -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
