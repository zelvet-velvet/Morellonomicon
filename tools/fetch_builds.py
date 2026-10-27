#!/usr/bin/env python3
"""Count what players really build and pick in ARAM Mayhem, from Riot's Match-V5 API.

    python3 tools/fetch_builds.py --seed "Name#TAG" --platform tw2 --matches 300
    python3 tools/fetch_builds.py --aggregate-only            # only recount the matches already downloaded

Needs a Riot API key (free, developer.riotgames.com) in the environment as RIOT_API_KEY, or in a `.env` file in the
repo root (`RIOT_API_KEY=RGAPI-...`, not committed). Starting from the seed player's recent Mayhem games, the crawl
follows the other players in those games until it has --matches games. Matches are cached in .cache/matches/ so a
rerun continues where it stopped.

Writes _data/builds.<mode>.json: per champion the games and wins, the most common completed items, the most common
three-item cores, and the augments picked. It holds no player names or ids. Standard library only.
"""
import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data as fd   # noqa: E402

ROOT = fd.ROOT
CACHE = ROOT / ".cache" / "matches"
OUT_DIR = ROOT / "_data"
QUEUES = {"mayhem": 2400}
# platform -> (account-v1 host, match-v5 host)
ROUTES = {
    "tw2": ("asia", "sea"), "sg2": ("asia", "sea"), "ph2": ("asia", "sea"), "th2": ("asia", "sea"), "vn2": ("asia", "sea"),
    "kr": ("asia", "asia"), "jp1": ("asia", "asia"),
    "na1": ("americas", "americas"), "br1": ("americas", "americas"), "la1": ("americas", "americas"), "la2": ("americas", "americas"),
    "euw1": ("europe", "europe"), "eun1": ("europe", "europe"), "tr1": ("europe", "europe"), "ru": ("europe", "europe"),
    "oc1": ("americas", "sea"),
}
USER_AGENT = "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"
MIN_INTERVAL = 1.3        # seconds between calls: the development key allows 100 calls per 2 minutes
IDS_PER_PLAYER = 20       # recent matches listed per player
MIN_DURATION = 300        # seconds; shorter games are remakes
COMPLETED_MIN_GOLD = 1000 # a "completed" item costs at least this much in total and builds into nothing
CORE_SIZE = 3
TOP_ITEMS = 12
TOP_SETS = 5
MIN_SET_GAMES = 2
TRINKET_AND_CONSUMABLE_TAGS = ("Trinket", "Consumable", "Lane", "Jungle")


def load_key():
    key = os.environ.get("RIOT_API_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("RIOT_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
    return key


class Riot:
    def __init__(self, key):
        self.key, self.last = key, 0.0

    def get(self, url):
        for attempt in range(5):
            wait = MIN_INTERVAL - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            req = urllib.request.Request(url, headers={"X-Riot-Token": self.key, "User-Agent": USER_AGENT})   # the default Python agent is blocked (error 1010)
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.loads(r.read())
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(int(e.headers.get("Retry-After", "10")) + 1)
                elif e.code in (401, 403):
                    sys.exit("The Riot key was refused (expired? a development key lasts 24 hours). Make a new one at developer.riotgames.com.")
                elif e.code == 404:
                    return None
                elif e.code >= 500:
                    time.sleep(2 * (attempt + 1))
                else:
                    sys.exit(f"Riot API error {e.code} for {url.split('?')[0]}")
            except urllib.error.URLError:
                time.sleep(2 * (attempt + 1))
        sys.exit("Riot API did not answer; try again later.")


def trim(match):
    """Keep only what is counted, plus the players' ids (cache only, never written to the output)."""
    info = match["info"]
    return {
        "id": match["metadata"]["matchId"], "version": info.get("gameVersion", ""), "duration": info.get("gameDuration", 0),
        "players": [{
            "puuid": p.get("puuid", ""), "champion": p.get("championId"), "win": bool(p.get("win")),
            "items": [p.get(f"item{i}", 0) for i in range(7)],
            "augments": [p[k] for k in sorted(p) if k.startswith("playerAugment") and p[k]],
        } for p in info["participants"]],
    }


def crawl(args, key):
    acct, region = ROUTES[args.platform]
    riot = Riot(key)
    name, _, tag = args.seed.partition("#")
    who = riot.get(f"https://{acct}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name)}/{urllib.parse.quote(tag)}")
    if not who:
        sys.exit(f"Player {args.seed} not found on {args.platform}.")
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = {p.stem for p in CACHE.glob("*.json")}
    frontier, seen = [who["puuid"]], set()
    for m in cached:   # resume: the cached matches' players are the first to follow
        frontier += [p["puuid"] for p in json.loads((CACHE / f"{m}.json").read_text(encoding="utf-8"))["players"] if p["puuid"]]
    queue = QUEUES[args.mode] if not args.queue else args.queue
    got = len(cached)
    print(f"{got} matches cached; collecting up to {args.matches}")
    while frontier and got < args.matches:
        puuid = frontier.pop(0)
        if puuid in seen:
            continue
        seen.add(puuid)
        ids = riot.get(f"https://{region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?queue={queue}&start=0&count={IDS_PER_PLAYER}") or []
        for mid in ids:
            if got >= args.matches:
                break
            if mid in cached:
                continue
            match = riot.get(f"https://{region}.api.riotgames.com/lol/match/v5/matches/{mid}")
            if not match:
                continue
            t = trim(match)
            (CACHE / f"{mid}.json").write_text(json.dumps(t), encoding="utf-8")
            cached.add(mid)
            got += 1
            frontier += [p["puuid"] for p in t["players"] if p["puuid"]]
            if got % 10 == 0:
                print(f"  {got} matches")
    print(f"{got} matches collected")


def patch_of(version):
    return ".".join(version.split(".")[:2])


def item_info(version):
    items = fd.fetch(f"{fd.DD}/cdn/{version}/data/{fd.LOCALE}/item.json", f"{version}/item.json")["data"]
    done, boots = set(), set()
    for i, it in items.items():
        if it.get("into") or it["gold"]["total"] < COMPLETED_MIN_GOLD or any(t in it.get("tags", []) for t in TRINKET_AND_CONSUMABLE_TAGS):
            continue
        done.add(int(i))
        if "Boots" in it.get("tags", []):
            boots.add(int(i))
    return done, boots, {i: it["gold"]["total"] for i, it in items.items()}


def aggregate(args, ddragon_version):
    done, boots, gold = item_info(ddragon_version)
    champs = fd.fetch(f"{fd.DD}/cdn/{ddragon_version}/data/{fd.LOCALE}/champion.json", f"{ddragon_version}/champion.json")["data"]
    by_key = {int(c["key"]): c["id"] for c in champs.values()}
    matches = [json.loads(p.read_text(encoding="utf-8")) for p in CACHE.glob("*.json")]
    matches = [m for m in matches if m["duration"] >= MIN_DURATION]
    if not matches:
        sys.exit("No matches to count yet.")
    patches = Counter(patch_of(m["version"]) for m in matches if m["version"])
    patch = args.patch or max(patches, key=lambda p: tuple(int(x) for x in p.split(".") if x.isdigit()))
    matches = [m for m in matches if patch_of(m["version"]) == patch]
    stats = defaultdict(lambda: {"games": 0, "wins": 0, "items": defaultdict(lambda: [0, 0]), "sets": defaultdict(lambda: [0, 0]), "augments": defaultdict(lambda: [0, 0])})
    for m in matches:
        for p in m["players"]:
            cid = by_key.get(p["champion"])
            if not cid:
                continue
            s, w = stats[cid], int(p["win"])
            s["games"] += 1
            s["wins"] += w
            mine = sorted({i for i in p["items"] if i in done or (i % 100000 in done and i > 700000)})
            for i in mine:
                s["items"][i][0] += 1
                s["items"][i][1] += w
            core = sorted((i for i in mine if i not in boots), key=lambda i: -gold.get(str(i), 0))[:CORE_SIZE]
            if len(core) == CORE_SIZE:
                key = tuple(sorted(core))
                s["sets"][key][0] += 1
                s["sets"][key][1] += w
            for a in set(p["augments"]):
                s["augments"][a][0] += 1
                s["augments"][a][1] += w
    out = {"mode": args.mode, "queue": QUEUES.get(args.mode, args.queue), "patch": patch, "date": datetime.date.today().isoformat(), "matches": len(matches), "champions": {}}
    for cid, s in sorted(stats.items()):
        rank = lambda d: sorted(d.items(), key=lambda kv: (-kv[1][0], kv[0]))
        out["champions"][cid] = {
            "games": s["games"], "wins": s["wins"],
            "items": [{"id": i, "games": g, "wins": w} for i, (g, w) in rank(s["items"])[:TOP_ITEMS]],
            "sets": [{"items": list(k), "games": g, "wins": w} for k, (g, w) in rank(s["sets"]) if g >= MIN_SET_GAMES][:TOP_SETS],
            "augments": [{"id": a, "games": g, "wins": w} for a, (g, w) in rank(s["augments"])[:TOP_ITEMS]],
        }
    OUT_DIR.mkdir(exist_ok=True)
    path = OUT_DIR / f"builds.{args.mode}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(matches)} matches of patch {patch}, {len(out['champions'])} champions -> {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", help='a Riot ID to start from, e.g. "Name#TW2"')
    ap.add_argument("--platform", default="tw2", choices=sorted(ROUTES))
    ap.add_argument("--mode", default="mayhem", choices=sorted(QUEUES))
    ap.add_argument("--queue", type=int, help="override the queue id (Mayhem is 2400)")
    ap.add_argument("--matches", type=int, default=300, help="stop after this many matches in the cache")
    ap.add_argument("--patch", help='count only this patch, e.g. "16.21" (default: the newest in the cache)')
    ap.add_argument("--aggregate-only", action="store_true", help="do not call Riot, only count the cached matches")
    args = ap.parse_args()
    if not args.aggregate_only:
        key = load_key()
        if not key:
            sys.exit("No Riot key. Put RIOT_API_KEY=RGAPI-... in a .env file in the repo root (it is not committed) or in the environment.")
        if not args.seed:
            sys.exit('Give a --seed Riot ID, e.g. --seed "Name#TW2".')
        crawl(args, key)
    version = json.loads(urllib.request.urlopen(f"{fd.DD}/api/versions.json", timeout=30).read())[0]
    aggregate(args, version)
    return 0


if __name__ == "__main__":
    sys.exit(main())
