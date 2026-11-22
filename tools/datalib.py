"""Shared loader for Morellonomicon's data: the generated files in _data/, their history per patch, and the private game
counts in .cache/. Used by tools/mn.py; standard library only.

    _data/<name>.json                       the newest data (what the plugin reads)
    _data/history/<patch>/<name>.json.gz    the same file as it was for that patch (committed, gzip: ~8x smaller)
    _data/history/index.json                the patches kept, with the date and source of each file
    .cache/mayhem.sqlite                    our LCU crawl (fetch_lcu.py), private
    .cache/resg/<patch>/                    resg.top's numbers (fetch_resg.py), private

Only counts and dates leave the private sources here; their numbers are never written to _data/.
"""
import datetime
import gzip
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "_data"
HISTORY = DATA / "history"
INDEX = HISTORY / "index.json"
LCU_DB = ROOT / ".cache" / "mayhem.sqlite"
RESG = ROOT / ".cache" / "resg"
LIFECYCLE = Path(__file__).resolve().parent / "data" / "lifecycle.json"
SNAPSHOT_FILES = ("augment-tiers", "item-builds")   # the files that are ours and change with each patch's games


def patch_of(version):
    """'16.22.725.1234' or '16.21.1' -> '16.22' / '16.21'."""
    return ".".join(str(version).split(".")[:2])


def patch_key(patch):
    return tuple(int(x) for x in str(patch).split(".") if x.isdigit())


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


# ---------- generated data and its history ----------

def load(name, patch=None):
    """A data file: the newest one, or the snapshot of `patch` (None if that patch was not kept)."""
    if patch is None:
        return read_json(DATA / f"{name}.json")
    f = HISTORY / patch / f"{name}.json.gz"
    return json.loads(gzip.decompress(f.read_bytes())) if f.exists() else None


def index():
    return read_json(INDEX) if INDEX.exists() else {}


def history_patches():
    return sorted(index(), key=patch_key)


def save_snapshot(name, raw, saved=None, commit=None):
    """Keep `raw` (the file's bytes) as the snapshot of the patch it names. Same bytes give the same .gz (mtime 0), so an
    unchanged file makes no git change. Returns the patch."""
    data = json.loads(raw)
    patch = patch_of(data["patch"])
    out = HISTORY / patch / f"{name}.json.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    gz = gzip.compress(raw, compresslevel=9, mtime=0)
    idx = index()
    if out.exists() and out.read_bytes() == gz and name in idx.get(patch, {}):
        return patch   # unchanged: keep the date it was saved
    out.write_bytes(gz)
    entry = {"saved": saved or datetime.date.today().isoformat(), "source": data.get("source") or ""}
    if commit:
        entry["commit"] = commit
    idx.setdefault(patch, {})[name] = entry
    write_json(INDEX, dict(sorted(idx.items(), key=lambda kv: patch_key(kv[0]))))
    return patch


def tier_rows(doc, champion, style):
    """One play style's tier rows of an augment-tiers.json document as dicts (id, group, tier, value, score, when, reason), from
    the compact format 2 (tools/reason/augment_tiers.py tiers_json) or the older list of dicts (history snapshots)."""
    rows = doc["champions"].get(champion, {}).get(style, {}).get("tiers", [])
    if doc.get("format", 1) < 2:
        return rows
    reasons, groups = doc["reasons"], doc["groups"]
    return [{"id": r[0], "group": groups.get(str(r[0]), ""), "tier": r[1], "value": r[2], "score": r[3],
             "reason": reasons[r[4]], "when": r[5] if len(r) > 5 else ""} for r in rows]


def announced_patch():
    """The patch the public tiers and builds are built from."""
    try:
        return patch_of(load("augment-tiers")["patch"])
    except (OSError, KeyError, ValueError):
        return None


def live_patch():
    """The newest patch Riot has released (fetch_changes.py)."""
    try:
        return read_json(DATA / "changes.json")["current"]
    except (OSError, KeyError, ValueError):
        return None


# ---------- private game counts ----------

def read_only(path):
    """A read-only SQLite connection that sorts in memory: a temp B-tree on /mnt/c (WSL) is many times slower."""
    db = sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True, check_same_thread=False)
    db.execute("PRAGMA temp_store=MEMORY")
    db.execute("PRAGMA cache_size=-65536")   # 64 MB
    return db


def lcu_patches():
    """Per patch: games, full games (all ten players read), player samples, first / last game date, game versions."""
    if not LCU_DB.exists():
        return {}
    db = read_only(LCU_DB)
    out = {}
    try:
        # samples and champions per patch in one pass: games first (CROSS JOIN keeps that order), so SQLite walks each
        # patch's games and their ten players instead of sorting every player row (17 s on /mnt/c, under 1 s this way)
        per = {}
        for patch, samples, champs in db.execute(
                "SELECT g.patch, count(*), count(DISTINCT p.champ) FROM games g CROSS JOIN players p ON p.game_id = g.game_id "
                "GROUP BY g.patch"):
            per[patch] = (samples, champs)
        for patch, games, full, first, last, nodate in db.execute(
                "SELECT patch, count(*), sum(full), min(nullif(created, 0)), max(nullif(created, 0)), sum(created = 0) "
                "FROM games GROUP BY patch"):
            day = lambda t: datetime.date.fromtimestamp(t).isoformat() if t else None   # noqa: E731
            versions = [v for v, in db.execute("SELECT DISTINCT version FROM games WHERE patch=? ORDER BY version", (patch,))]
            samples, champs = per.get(patch, (0, 0))
            out[patch] = {"games": games, "full": full or 0, "samples": samples, "champions": champs,
                          "first": day(first), "last": day(last), "undated": nodate or 0, "versions": versions}
    finally:
        db.close()
    return out


def champion_names():
    """Riot's numeric champion key -> the zh_TW name, from the champion notes' frontmatter."""
    import re
    import vault_paths
    out = {}
    for f in (ROOT / vault_paths.CHAMPIONS).glob("*.md"):
        head = f.read_text(encoding="utf-8")[:600]
        k, n = re.search(r"^key:\s*(\d+)", head, re.M), re.search(r'^name:\s*"?([^"\n]+)', head, re.M)
        if k and n:
            out[int(k.group(1))] = n.group(1)
    return out


def lcu_detail(patch):
    """For one patch of our crawl: games per day (dated games only) and player samples per champion (every champion, 0 when unseen)."""
    if not LCU_DB.exists():
        return {"daily": [], "champions": {}}
    db = sqlite3.connect(f"file:{LCU_DB.as_posix()}?mode=ro", uri=True)
    try:
        daily = db.execute("SELECT date(created, 'unixepoch', 'localtime'), count(*) FROM games WHERE patch=? AND created > 0 "
                           "GROUP BY 1 ORDER BY 1", (patch,)).fetchall()
        seen = dict(db.execute("SELECT champ, count(*) FROM players JOIN games USING (game_id) WHERE patch=? GROUP BY champ",
                               (patch,)).fetchall())
    finally:
        db.close()
    names = champion_names()
    champs = {names.get(k, str(k)): seen.get(k, 0) for k in set(names) | set(seen)}
    return {"daily": daily, "champions": champs}


def resg_patches():
    """Per cached patch: when resg.top collected it and its game count (players / 10)."""
    out = {}
    for d in RESG.glob("*/") if RESG.exists() else []:
        try:
            meta = read_json(d / "meta.json")
            champs = read_json(d / "champions.json")["items"]
        except (OSError, KeyError, ValueError):
            continue
        out[d.name] = {"collected": meta.get("collectedAt", "")[:10], "games": sum(c.get("tm", 0) for c in champs) // 10}
    return out


# ---------- patch lifecycle ----------

def lifecycle():
    """Thresholds (tools/data/lifecycle.json): how many of our games make a patch Ready."""
    try:
        return read_json(LIFECYCLE)
    except (OSError, ValueError):
        return {"ready_games": 3000, "decided": False}


def status():
    """One row per patch known anywhere, newest first, with its lifecycle state:
    Announced (the public tiers are built from it), Archived (older, kept in history), Ready (newer than Announced and
    enough of our games), Collecting (newer, not enough yet), Not kept (older, never snapshotted)."""
    cfg = lifecycle()
    lcu, resg, hist = lcu_patches(), resg_patches(), index()
    ann, live = announced_patch(), live_patch()
    patches = set(lcu) | set(resg) | set(hist) | {p for p in (ann, live) if p}
    rows = []
    for p in sorted(patches, key=patch_key, reverse=True):
        games = lcu.get(p, {}).get("games", 0)
        if p == ann:
            state = "Announced"
        elif ann and patch_key(p) < patch_key(ann):
            state = "Archived" if p in hist else "Not kept"
        else:
            state = "Ready" if games >= cfg["ready_games"] else "Collecting"
        rows.append({"patch": p, "state": state, "live": p == live, "lcu": lcu.get(p), "resg": resg.get(p),
                     "history": sorted(hist.get(p, {}))})
    return {"announced": ann, "live": live, "lifecycle": cfg, "patches": rows,
            "made": datetime.datetime.now().isoformat(timespec="minutes")}
