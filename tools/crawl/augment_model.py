#!/usr/bin/env python3
"""Each augment's own effect on winning, with the champion and the other augments held fixed, from our Mayhem crawl.

A plain win rate gives an augment the credit of whoever takes it: strong champions, and the other augments picked with it
(an augment usually taken next to a strong one looks strong itself). This fits one logistic model on every player sample of
a patch in .cache/mayhem.sqlite (tools/crawl/fetch_lcu.py):

    log-odds(win) = base + champion + augment 1 + ... + augment 6

so each augment's number is what it adds when the champion and the five other augments are the same. Every sample has
several augments, so only the differences between augments are known: each is reported against the average augment pick. A small ridge
(RIDGE, about 80 games' worth) pulls augments with few games toward 0, like the shrinkage of the tier scripts. Reported
as points of win rate at a 50 % game (log-odds × 25): +3.0 means taking it over an average augment turns a coin-flip
game into about 53 %.

Pick rate is not in it: picks show what players chose, not what they were offered, so it is used for confidence only.
Standard library only; cached per patch and game count in .cache/reports/. A cold fit takes ~30 rounds (~2.5 min for 1.7M
samples); a refit after more games starts from the cached fit and takes a few.

    python3 -I tools/crawl/augment_model.py 16.23     # print the strongest and weakest effects
"""
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # python3 -I adds no script folder: tools/ here,
import toolpath  # noqa: E402,F401  (...and toolpath adds the job folders, so the scripts import each other by name)
import datalib   # noqa: E402

RIDGE = 20.0       # penalty on each champion and augment term; a sample near 50 % adds 0.25, so 20 ≈ 80 games
ROUNDS = 60        # block coordinate rounds (champions, then augments); stops early once the changes are tiny
DAMP = 0.5         # step on the augment block: up to six augments share a row, so their steps overlap
CACHE = datalib.ROOT / ".cache" / "reports"


def sigmoid(z):
    return 1 / (1 + math.exp(-z)) if z > -30 else 0.0


def load(patch):
    """(rows, champions, augments): rows are (win, champion index, augment indexes) for every sample of the patch."""
    db = datalib.read_only(datalib.LCU_DB)
    cols = ", ".join(f"p.aug{k}" for k in range(1, 7))
    champ_ix, aug_ix, rows = {}, {}, []
    try:
        for win, champ, *augs in db.execute(f"SELECT p.win, p.champ, {cols} FROM games g CROSS JOIN players p "
                                            "ON p.game_id = g.game_id WHERE g.patch=?", (patch,)):
            c = champ_ix.setdefault(champ, len(champ_ix))
            a = tuple(aug_ix.setdefault(x, len(aug_ix)) for x in set(augs) if x)
            rows.append((win, c, a))
    finally:
        db.close()
    return rows, champ_ix, aug_ix


def fit(patch, progress=print):
    """{"games": n, "samples": n, "augments": {id: [effect points, ± points, samples]}, "champions": {...}} for the patch,
    from the cache when the patch's game count has not changed."""
    db = datalib.read_only(datalib.LCU_DB)
    try:
        games, = db.execute("SELECT count(*) FROM games WHERE patch=?", (patch,)).fetchone()
    finally:
        db.close()
    out_file = CACHE / f"augment-model-{patch}.json"
    old = None
    if out_file.exists():
        old = json.loads(out_file.read_text(encoding="utf-8"))
        if old.get("games") == games:
            return old
    t0 = time.time()
    rows, champ_ix, aug_ix = load(patch)
    if not rows:
        return None
    progress(f"model: {len(rows):,} samples, {len(champ_ix)} champions, {len(aug_ix)} augments ({time.time() - t0:.0f} s to read)")
    wins = sum(r[0] for r in rows)
    base = math.log(wins / (len(rows) - wins))   # fixed: every sample has one champion, so a moving base would fight them
    ch = [0.0] * len(champ_ix)
    au = [0.0] * len(aug_ix)
    if old and old.get("ridge") == RIDGE and "offset" in old:
        # start from the last fit of the patch (a few hundred games fewer while the crawl runs): 2 rounds instead of ~30, within
        # 0.1 points of a cold fit. It keeps points against the average pick; "offset" (the average, log-odds) puts that back:
        # without it every augment starts a point off, and the fit drifts back too slowly (33 rounds, still 0.7 points off)
        off = old["offset"]
        for k, i in champ_ix.items():
            ch[i] = old["champions"].get(str(k), 0.0) / 25
        for k, i in aug_ix.items():
            if str(k) in old["augments"]:
                au[i] = old["augments"][str(k)][0] / 25 + off
        progress(f"model: started from the fit of {old['games']:,} games")
    for rnd in range(1, ROUNDS + 1):
        # block 1: champions (each sample has exactly one, so these are exact Newton steps for the block)
        g_c, h_c = [0.0] * len(ch), [0.0] * len(ch)
        for win, c, a in rows:
            p = sigmoid(base + ch[c] + sum(au[x] for x in a))
            g_c[c] += win - p
            h_c[c] += p * (1 - p)
        moved = 0.0
        for c in range(len(ch)):
            step = (g_c[c] - RIDGE * ch[c]) / (h_c[c] + RIDGE)
            ch[c] += step
            moved = max(moved, abs(step))
        # block 2: augments (damped: they share rows)
        g_a, h_a = [0.0] * len(au), [0.0] * len(au)
        for win, c, a in rows:
            p = sigmoid(base + ch[c] + sum(au[x] for x in a))
            r, w = win - p, p * (1 - p)
            for x in a:
                g_a[x] += r
                h_a[x] += w
        for x in range(len(au)):
            step = DAMP * (g_a[x] - RIDGE * au[x]) / (h_a[x] + RIDGE)
            au[x] += step
            moved = max(moved, abs(step))
        progress(f"model: round {rnd}, largest change {moved * 25:.3f} points ({time.time() - t0:.0f} s)")
        if moved * 25 < 0.05:
            break
    inv_c = {i: k for k, i in champ_ix.items()}
    inv_a = {i: k for k, i in aug_ix.items()}
    out = {"patch": patch, "games": games, "samples": len(rows), "made": time.strftime("%Y-%m-%d %H:%M"),
           "ridge": RIDGE, "rounds": rnd, "augments": {}, "champions": {}}
    # every sample has several augments, so only their differences are known: report each against the average pick
    mean = sum(v * h for v, h in zip(au, h_a)) / max(1e-9, sum(h_a))
    out["offset"] = round(mean, 6)
    for x, v in enumerate(au):
        v -= mean
        n = h_a[x] / 0.25   # the information, as games at 50 %
        out["augments"][str(inv_a[x])] = [round(v * 25, 2), round(25 / math.sqrt(h_a[x] + RIDGE) * 1.96, 2), round(n)]
    for c, v in enumerate(ch):
        out["champions"][str(inv_c[c])] = round(v * 25, 2)
    CACHE.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(out), encoding="utf-8")
    shown = out_file.relative_to(datalib.ROOT) if out_file.is_relative_to(datalib.ROOT) else out_file
    progress(f"model: done in {time.time() - t0:.0f} s, {rnd} rounds -> {shown}")
    return out


if __name__ == "__main__":
    m = fit(sys.argv[1] if len(sys.argv) > 1 else "16.23")
    if m:
        ranked = sorted(m["augments"].items(), key=lambda kv: -kv[1][0])
        for aid, (eff, pm, n) in ranked[:8] + ranked[-5:]:
            print(f"{aid:>6}  {eff:+6.2f} ±{pm:.2f} points  ({n:,} samples)")
