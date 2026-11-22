#!/usr/bin/env python3
"""Our own Mayhem crawl (tools/crawl/fetch_lcu.py, .cache/mayhem.sqlite) as evidence for the tiers and builds, in resg.top's cache format.

tools/reason/augment_tiers.py and tools/reason/build_tiers.py read games per champion, augment and item from a cache folder laid out like
resg.top's (tools/crawl/fetch_resg.py). This writes the same files from our crawl into the git-ignored .cache/lcu/cache/<patch>/, so a
patch resg.top has not published yet can still be built from our games; the tier scripts take the newest patch of either source
(ours when both have it and it holds tools/data/lifecycle.json's ready_games: every player's items and augments, not totals). Like resg's, no number from here is written into the repo or a note,
only the tiers and builds worked out from them.

    python3 -I tools/crawl/lcu_cache.py            # the newest patch in the crawl
    python3 -I tools/crawl/lcu_cache.py 16.23

Older patches count too, for what did not change: a game of an earlier patch (up to POOL_BACK patches back) adds to a champion's
numbers when no patch since changed that champion (tools/fetch/fetch_changes.py, Riot's notes and the Mayhem balance in
_data/patches.json), to an augment pair when the augment did not change either, and to an item when the item did not. A patch
whose notes are missing stops the pooling there.

Thresholds follow our volume, not resg's millions (meta.json: `sure_games`, `sure_item_games`, `not_offered`, read by the tier
scripts): a gap of 4 points is about two standard errors at 600 games.

Item order: the client lists a player's items by inventory slot, which is mostly the order they were bought (a new item takes the
first free slot); the first-items orders (combos) assume that. Standard library.
"""
import datetime
import functools
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # python3 -I adds no script folder: tools/ here,
import toolpath  # noqa: E402,F401  (...and toolpath adds the job folders, so the scripts import each other by name)
from build_tiers import items as item_pool  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / ".cache" / "mayhem.sqlite"
OUT = ROOT / ".cache" / "lcu" / "cache"
SLOTS = [f"item{i}" for i in range(7)]
AUGS = [f"aug{i}" for i in range(1, 7)]
POOL_BACK = 2          # older patches whose unchanged champions, augments and items still count
SURE_GAMES = 600       # an augment pair this well sampled can raise a question (a trick candidate)
SURE_ITEM_GAMES = 1000 # the same for an item on a champion
CHANGES = ROOT / "_data" / "changes.json"
PATCH_NOTES = ROOT / "_data" / "patches.json"
ALIASES = ROOT / "tools" / "data" / "augment-aliases.json"


@functools.lru_cache(maxsize=None)
def note_ids(folder):
    """name -> id (augments, items) or key -> (id, name) (champions) from the vault notes."""
    from augment_tiers import frontmatter
    import vault_paths
    out = {}
    for path in (ROOT / getattr(vault_paths, folder)).glob("*.md"):
        fm = frontmatter(path)
        if folder == "CHAMPIONS" and fm.get("type") == "champion" and str(fm.get("key", "")).isdigit():
            out[int(fm["key"])] = (fm.get("id", ""), fm.get("name", ""))
        elif folder != "CHAMPIONS" and str(fm.get("id", "")).isdigit():
            out[str(fm.get("name", "")).strip()] = int(fm["id"])
    return out


def changed_in(patch):
    """What a game patch (16.23) changed: champion keys, augment ids, item ids; None when its notes are not known."""
    champs = note_ids("CHAMPIONS")
    by_id = {cid: k for k, (cid, _) in champs.items()}
    by_name = {name: k for k, (_, name) in champs.items()}
    augs, items = note_ids("AUGMENTS"), note_ids("ITEMS")
    try:
        aliases = {k: v for k, v in json.loads(ALIASES.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    except (OSError, ValueError):
        aliases = {}
    major, _, minor = patch.partition(".")
    riot = f"{int(major) + 10}.{minor}"
    notes = next((n for n in json.loads(PATCH_NOTES.read_text(encoding="utf-8")).get("patches", []) if n.get("patch") == riot), None)
    if notes is None:
        return None
    c = {by_name[x["name"]] for key in ("champions", "mayhem_champions") for x in notes.get(key, []) if x.get("name") in by_name}
    try:
        for cid, entries in json.loads(CHANGES.read_text(encoding="utf-8")).get("champions", {}).items():
            if any(e.get("patch") == patch for e in entries) and cid in by_id:
                c.add(by_id[cid])
    except (OSError, ValueError):
        pass
    a = {augs[aliases.get(x["name"], x["name"])] for key in ("augments_changed", "augments_new", "augments_removed")
         for x in notes.get(key, []) if aliases.get(x["name"], x["name"]) in augs}
    i = {items[x["name"]] for x in notes.get("items", []) if x.get("name") in items}
    return c, a, i


def main():
    if not DB.exists():
        print("no crawl on this machine (tools/crawl/fetch_lcu.py): skipped")   # the GitHub patch job has none
        return
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    patches = [r[0] for r in db.execute("SELECT DISTINCT patch FROM games WHERE patch IS NOT NULL")]
    patch = sys.argv[1] if len(sys.argv) > 1 else max(patches, key=lambda p: [int(x) for x in p.split(".")], default=None)
    if patch not in patches:
        sys.exit(f"the crawl has no patch {patch} (has {', '.join(sorted(patches))})")
    key = lambda v: [int(x) for x in v.split(".")]   # noqa: E731
    sql = f"SELECT champ, win, {', '.join(SLOTS + AUGS)} FROM players JOIN games USING (game_id) WHERE patch=?"
    parts = [(patch, db.execute(sql, (patch,)).fetchall(), (set(), set(), set()))]   # (patch, rows, what changed since)
    since = (set(), set(), set())
    older = sorted((p for p in patches if key(p) < key(patch)), key=key, reverse=True)
    try:   # every patch that came out, crawled or not, so a gap in the crawl still counts its changes
        known = set(json.loads(CHANGES.read_text(encoding="utf-8")).get("patches", [])) | set(patches)
    except (OSError, ValueError):
        known = set(patches)
    newer = patch
    for q in older[:POOL_BACK]:
        # what changed between q and the target: every patch after q, up to the target
        for step in [p for p in known if key(q) < key(p) <= key(newer)]:
            ch = changed_in(step)
            if ch is None:
                print(f"no patch notes for {step}: {q} and older are not pooled")
                since = None
                break
            since = tuple(x | y for x, y in zip(since, ch))
        if since is None:
            break
        parts.append((q, db.execute(sql, (q,)).fetchall(), since))
        newer = q
    last = db.execute("SELECT max(created), count(*) FROM games WHERE patch=?", (patch,)).fetchone()
    pool, alias = item_pool()
    finished = lambda i: alias.get(i, i) in pool   # noqa: E731
    is_boots = lambda i: pool.get(alias.get(i, i), {}).get("boots", False)   # noqa: E731

    champ = defaultdict(lambda: [0, 0])                        # champion -> games, wins
    aug = defaultdict(lambda: [0, 0])                          # augment -> picks, wins
    ra = defaultdict(lambda: defaultdict(lambda: [0, 0]))      # champion -> augment -> games, wins
    ia = defaultdict(lambda: defaultdict(lambda: [0, 0]))      # champion -> item -> games, wins
    combos = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0, 0])))   # champion -> k -> first k items -> games, wins
    used = {}
    samples = 0
    for q, rows, (ch_c, ch_a, ch_i) in parts:
        n = 0
        for r in rows:
            c, win, slots, augs = r[0], r[1], r[2:9], r[9:]
            augs = {a for a in augs if a and a not in ch_a}
            for a in augs:   # an augment's result everywhere: any champion's game counts while the augment is unchanged
                aug[a][0] += 1
                aug[a][1] += win
            if c in ch_c:
                continue     # the champion changed since: its own numbers start again
            n += 1
            champ[c][0] += 1
            champ[c][1] += win
            for a in augs:
                ra[c][a][0] += 1
                ra[c][a][1] += win
            for i in {i for i in slots if i and finished(i) and alias.get(i, i) not in ch_i}:
                ia[c][i][0] += 1
                ia[c][i][1] += win
            order = [i for i in slots if i and finished(i) and not is_boots(i)]
            if any(alias.get(i, i) in ch_i for i in order):
                continue
            for k in (1, 2, 3, 5):
                if len(order) >= k:
                    combos[c][str(k)][tuple(order[:k])][0] += 1
                    combos[c][str(k)][tuple(order[:k])][1] += win
        used[q] = n
        samples += len(rows)

    out = OUT / patch
    (out / "champions").mkdir(parents=True, exist_ok=True)
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
    per_pair = samples / max(len(champ), 1) * 4 / max(len(aug), 1)   # games an augment gets on a champion, on average
    meta = {"version": patch, "collectedAt": collected, "source": "our crawl", "games": last[1], "pooled": used,
            "sure_games": SURE_GAMES, "sure_item_games": SURE_ITEM_GAMES,
            # 0 games where this many were expected: the game does not offer it (8 at a night's crawl, resg's 50 at large volume)
            "not_offered": min(50, max(8, round(per_pair * 0.35)))}
    (out / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    pooled = ", ".join(f"{q}: {n:,}" for q, n in used.items() if q != patch)
    print(f"our crawl {patch}: {last[1]:,} games, {used[patch]:,} samples" + (f" + unchanged from {pooled}" if pooled else "")
          + f", {len(champ)} champions -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
