"""Write _data/mastery.json: your champion mastery (level, points, last played) for every champion you have played.

Needs a Riot API key in the environment as RIOT_API_KEY or in `.env` (see fetch_builds.py; a development key lasts 24 hours) and your
Riot ID. The ID is only used to find your account and is never written anywhere: the file holds champion ids and numbers, no name,
no account id. It is git-ignored (your own numbers stay on this computer until you decide to publish them). Run from the repo root:
    python3 -I tools/fetch_mastery.py --riot-id "Name#TW2"
"""
import argparse
import datetime
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_builds  # noqa: E402  (load_key)
import fetch_positions  # noqa: E402  (champion_ids)

OUT = fetch_positions.ROOT / "_data" / "mastery.json"
ACCOUNT_HOST = "https://asia.api.riotgames.com"   # the Taiwan server's account data is in the asia region
PLATFORM_HOST = "https://tw2.api.riotgames.com"
USER_AGENT = fetch_builds.USER_AGENT


def get(url, key):
    req = urllib.request.Request(url, headers={"X-Riot-Token": key, "User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        hint = {401: "no key", 403: "the key is invalid or has expired (a development key lasts 24 hours)", 404: "not found (check the name and the tag)", 429: "too many requests, try again in a minute"}.get(e.code, "")
        sys.exit(f"Riot answered {e.code} {hint}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--riot-id", required=True, help='your Riot ID as "Name#TAG"')
    args = ap.parse_args()
    name, _, tag = args.riot_id.rpartition("#")
    if not name or not tag:
        sys.exit('The Riot ID must look like "Name#TAG"')
    key = fetch_builds.load_key()
    if not key:
        sys.exit("No Riot key. Put RIOT_API_KEY=RGAPI-... in a .env file in the repo root (it is not committed) or in the environment.")
    puuid = get(f"{ACCOUNT_HOST}/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name)}/{urllib.parse.quote(tag)}", key)["puuid"]
    rows = get(f"{PLATFORM_HOST}/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}", key)
    ids = fetch_positions.champion_ids()
    champions = {}
    for r in rows:
        cid = ids.get(str(r.get("championId")))
        if not cid:
            continue   # a champion our notes do not have (yet)
        last = datetime.datetime.fromtimestamp(r.get("lastPlayTime", 0) / 1000).date().isoformat() if r.get("lastPlayTime") else ""
        champions[cid] = {"level": r.get("championLevel", 0), "points": r.get("championPoints", 0), "last": last}
    data = {"fetched": datetime.date.today().isoformat(), "total_points": sum(c["points"] for c in champions.values()), "champions": champions}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    top = sorted(champions.items(), key=lambda kv: -kv[1]["points"])[:5]
    print(f"{len(champions)} champions with mastery, {data['total_points']:,} points in all -> {OUT.relative_to(OUT.parent.parent)}")
    print("most points:", ", ".join(f"{cid} {c['points']:,} (level {c['level']})" for cid, c in top))


if __name__ == "__main__":
    main()
