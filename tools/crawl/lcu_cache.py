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
import multiprocessing
import os
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # python3 -I adds no script folder: tools/ here,
import toolpath  # noqa: E402,F401  (...and toolpath adds the job folders, so the scripts import each other by name)
import datalib  # noqa: E402
from build_tiers import items as item_pool  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DB = datalib.LCU_DB   # the crawl, or the rebuild's copy of it on the Linux disk (MN_LCU_DB)
OUT = ROOT / ".cache" / "lcu" / "cache"
SLOTS = [f"item{i}" for i in range(7)]
AUGS = [f"aug{i}" for i in range(1, 7)]
POOL_BACK = 2          # older patches whose unchanged champions, augments and items still count
SURE_GAMES = 600       # an augment pair this well sampled can raise a question (a trick candidate)
SURE_ITEM_GAMES = 1000 # the same for an item on a champion
CHANGES = ROOT / "_data" / "changes.json"
PATCH_NOTES = ROOT / "_data" / "patches.json"
ALIASES = ROOT / "tools" / "data" / "augment-aliases.json"
SHARES = 8             # the players are counted in this many shares, one process each (fixed: the same output anywhere)


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


def count_share(job):
    """One share of one patch's players (game_id % SHARES), counted in its own process: (rows, players counted, champion,
    augment, champion+augment, champion+item, champion+k+first k items), each {key: [games, wins]}. The loop runs over every
    slot of ~2M rows, so it tests set membership only and counts in flat dicts: ~40 s in one process, ~6 s in eight."""
    q, share, ch_c, ch_a, changed, fin, fin_nb = job
    db = datalib.read_only(DB)
    try:
        rows = db.execute(f"SELECT champ, win, {', '.join(SLOTS + AUGS)} FROM players JOIN games USING (game_id) "
                          "WHERE patch=? AND game_id % ? = ?", (q, SHARES, share)).fetchall()
    finally:
        db.close()
    fin_ok = fin - changed
    champ, aug, ra, ia, co = {}, {}, {}, {}, {}
    n = 0
    for r in rows:
        c, win = r[0], r[1]
        augs = {a for a in r[9:] if a and a not in ch_a}
        for a in augs:   # an augment's result everywhere: any champion's game counts while the augment is unchanged
            v = aug.get(a)
            if v is None:
                aug[a] = [1, win]
            else:
                v[0] += 1
                v[1] += win
        if c in ch_c:
            continue     # the champion changed since: its own numbers start again
        n += 1
        v = champ.get(c)
        if v is None:
            champ[c] = [1, win]
        else:
            v[0] += 1
            v[1] += win
        for a in augs:
            k = (c, a)
            v = ra.get(k)
            if v is None:
                ra[k] = [1, win]
            else:
                v[0] += 1
                v[1] += win
        slots = r[2:9]
        for i in {i for i in slots if i in fin_ok}:
            k = (c, i)
            v = ia.get(k)
            if v is None:
                ia[k] = [1, win]
            else:
                v[0] += 1
                v[1] += win
        order = [i for i in slots if i in fin_nb]
        if changed and any(i in changed for i in order):
            continue
        for kk in (1, 2, 3, 5):
            if len(order) < kk:
                break
            k = (c, kk, tuple(order[:kk]))
            v = co.get(k)
            if v is None:
                co[k] = [1, win]
            else:
                v[0] += 1
                v[1] += win
    return len(rows), n, champ, aug, ra, ia, co


def main():
    if not DB.exists():
        print("no crawl on this machine (tools/crawl/fetch_lcu.py): skipped")   # the GitHub patch job has none
        return
    db = datalib.read_only(DB)
    patches = [r[0] for r in db.execute("SELECT DISTINCT patch FROM games WHERE patch IS NOT NULL")]
    patch = sys.argv[1] if len(sys.argv) > 1 else max(patches, key=lambda p: [int(x) for x in p.split(".")], default=None)
    if patch not in patches:
        sys.exit(f"the crawl has no patch {patch} (has {', '.join(sorted(patches))})")
    key = lambda v: [int(x) for x in v.split(".")]   # noqa: E731
    parts = [(patch, (set(), set(), set()))]   # (patch, what changed since)
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
        parts.append((q, since))
        newer = q
    last = db.execute("SELECT max(created), count(*) FROM games WHERE patch=?", (patch,)).fetchone()
    db.close()
    pool, alias = item_pool()
    fin = {i for i in set(pool) | set(alias) if alias.get(i, i) in pool}            # finished items (any id the game uses)
    fin_nb = {i for i in fin if not pool[alias.get(i, i)].get("boots", False)}     # ...boots aside, for the first-items orders
    jobs = [(q, share, ch_c, ch_a, {i for i in fin if alias.get(i, i) in ch_i}, fin, fin_nb)
            for q, (ch_c, ch_a, ch_i) in parts for share in range(SHARES)]
    with multiprocessing.get_context("fork").Pool(min(SHARES, os.cpu_count() or 1)) as workers:
        counted = workers.map(count_share, jobs)   # in the jobs' order: the same output on any machine
    champ, aug, ra, ia, co = {}, {}, {}, {}, {}
    used = {}
    samples = 0
    for (q, *_), (rows, n, *dicts) in zip(jobs, counted):
        used[q] = used.get(q, 0) + n
        samples += rows
        for total, part in zip((champ, aug, ra, ia, co), dicts):
            for k, (g, w) in part.items():
                gw = total.setdefault(k, [0, 0])
                gw[0] += g
                gw[1] += w

    def nest(flat, depth):
        """{(a, b, ..., key): [games, wins]} -> {a: {b: {...: {key: [games, wins]}}}}, first seen first."""
        out = defaultdict(dict)
        for k, gw in flat.items():
            d = out
            for part in k[:depth - 1]:
                d = d.setdefault(part, {})
            d[k[depth - 1]] = gw
        return out
    ra = nest(ra, 2)                                     # champion -> augment -> games, wins
    ia = nest(ia, 2)                                     # champion -> item -> games, wins
    combos = defaultdict(dict)                           # champion -> k -> first k items -> games, wins
    for c, ks in nest(co, 3).items():
        combos[c] = {str(k): v for k, v in ks.items()}

    out = OUT / patch
    (out / "champions").mkdir(parents=True, exist_ok=True)
    wr = lambda g, w: round(w / g, 4) if g else 0.0   # noqa: E731
    bp = lambda g, w: round(w / g * 10000) if g else 0   # noqa: E731
    augs_out = [{"id": a, "tm": g, "wm": w, "wr": wr(g, w), "pr": round(g / samples, 4)} for a, (g, w) in aug.items()]
    (out / "augments.json").write_text(json.dumps({"items": augs_out}), encoding="utf-8")
    for c, (g, w) in champ.items():
        data = {
            "champion": {"id": c, "tm": g, "wm": w, "wr": wr(g, w)},
            "ra": [[a, 0, ag, aw, bp(ag, aw)] for a, (ag, aw) in sorted(ra[c].items(), key=lambda kv: (-kv[1][0], kv[0]))],
            "ia": {"items": [[i, ig, iw, 0, bp(ig, iw)] for i, (ig, iw) in sorted(ia[c].items(), key=lambda kv: (-kv[1][0], kv[0]))],
                   "combos": {k: [[n + 1, list(ids), cg, cw, bp(cg, cw)] for n, (ids, (cg, cw)) in
                                  enumerate(sorted(v.items(), key=lambda kv: (-kv[1][0], kv[0])))] for k, v in combos[c].items()}},
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



def style_games(patch, styles):
    """Each play style's own games, for the augment tiers per style (tools/reason/build_tiers.py calls it, then augment_tiers.py
    reads the result): a player is in the style whose first-two sets hold their first two finished items (boots aside, by slot,
    as the combos above). styles: {champion key: [set of frozensets of item ids, one per style]} -> {champion key: [{"tm", "wm",
    "ra": [[augment, games, wins]]}, one per style]}. Only the patch itself: our volume splits well enough without pooling."""
    pool, alias = item_pool()
    # any id the game uses -> its finished item, boots aside (the only items a first two counts)
    canon = {i: alias.get(i, i) for i in set(pool) | set(alias)
             if alias.get(i, i) in pool and not pool[alias.get(i, i)].get("boots", False)}
    index = {}   # {champion: {first-two set: style number}}, the first style holding a set wins
    for c, sets in styles.items():
        index[c] = {}
        for n, s in enumerate(sets):
            for first in s:
                index[c].setdefault(first, n)
    jobs = [(patch, share, canon, index) for share in range(SHARES)]
    with multiprocessing.get_context("fork").Pool(min(SHARES, os.cpu_count() or 1)) as workers:
        counted = workers.map(style_share, jobs)
    tm, ra = {}, {}
    for part_tm, part_ra in counted:
        for total, part in ((tm, part_tm), (ra, part_ra)):
            for k, (g, w) in part.items():
                gw = total.setdefault(k, [0, 0])
                gw[0] += g
                gw[1] += w
    per = defaultdict(list)
    for (c, n, a), (g, w) in ra.items():
        per[c, n].append([a, g, w])
    return {c: [{"tm": tm.get((c, n), (0, 0))[0], "wm": tm.get((c, n), (0, 0))[1],
                 "ra": sorted(per.get((c, n), []), key=lambda r: (-r[1], r[0]))} for n in range(len(sets))]
            for c, sets in styles.items()}


def style_share(job):
    """One share of a patch's players (game_id % SHARES) split by play style, in its own process, as count_share:
    ({(champion, style): [games, wins]}, {(champion, style, augment): [games, wins]}). ~60 s in one process, a few in eight."""
    patch, share, canon, index = job
    db = datalib.read_only(DB)
    try:
        rows = db.execute(f"SELECT champ, win, {', '.join(SLOTS + AUGS)} FROM players JOIN games USING (game_id) "
                          "WHERE patch=? AND game_id % ? = ?", (patch, SHARES, share)).fetchall()
    finally:
        db.close()
    tm, ra = {}, {}
    for r in rows:
        sets = index.get(r[0])
        if sets is None:
            continue
        one = two = None
        for i in r[2:9]:   # the first two finished items, by slot
            j = canon.get(i)
            if j is not None:
                if one is None:
                    one = j
                else:
                    two = j
                    break
        if two is None or two == one:
            continue
        n = sets.get(frozenset((one, two)))
        if n is None:
            continue
        c, win = r[0], r[1]
        v = tm.get((c, n))
        if v is None:
            tm[c, n] = [1, win]
        else:
            v[0] += 1
            v[1] += win
        for a in {a for a in r[9:] if a}:
            k = (c, n, a)
            v = ra.get(k)
            if v is None:
                ra[k] = [1, win]
            else:
                v[0] += 1
                v[1] += win
    return tm, ra

if __name__ == "__main__":
    main()
