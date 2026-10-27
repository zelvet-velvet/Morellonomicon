"""Write _data/positions.json: the lanes each champion is played in, for the lane icons (英雄 tab, 速查).

Source: Meraki Analytics' championrates.json (a free community data set made from Riot's ranked match data; no Riot key
needed). It gives each champion's play rate per lane; the app shows a lane when at least 10% of the champion's games are
there (LANE_MIN_SHARE in the plugin). A `positions` list written by hand in a champion note wins over this.
`tools/fetch_builds.py --mode ranked` writes the same file from our own match count, when a Riot key is set.
Standard library only.

    python3 -I tools/fetch_positions.py
"""
import datetime
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_data" / "positions.json"
URL = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/championrates.json"
LANES = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")


def champion_ids():
    """Riot's numeric champion key -> id (Katarina), read from the champion notes."""
    out = {}
    for path in (ROOT / "英雄").glob("*.md"):
        text = path.read_text(encoding="utf-8")
        cid, key = re.search(r'^id: "(.*)"$', text, re.M), re.search(r"^key: (\d+)$", text, re.M)
        if cid and key:
            out[key.group(1)] = cid.group(1)
    return out


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = json.loads(r.read())
    data = raw.get("data", raw)
    ids = champion_ids()
    champions, unknown = {}, []
    for key, lanes in data.items():
        cid = ids.get(str(key))
        if not cid:
            unknown.append(str(key))
            continue
        rates = {lane: float((lanes.get(lane) or {}).get("playRate") or 0) for lane in LANES}
        total = sum(rates.values())
        if total > 0:
            champions[cid] = {lane: round(rate / total, 4) for lane, rate in rates.items() if rate > 0}
    if len(champions) < 100:   # the file looks different from what this reads: keep the old one
        sys.exit(f"only {len(champions)} champions read from {URL}; positions.json left as it was")
    out = {"source": "Meraki Analytics championrates.json (play rate per lane, ranked)", "patch": str(raw.get("patch", "")),
           "date": datetime.date.today().isoformat(), "matches": 0, "champions": dict(sorted(champions.items()))}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(champions)} champions" + (f" ({len(unknown)} keys not in the notes: {', '.join(unknown[:8])})" if unknown else ""))


if __name__ == "__main__":
    main()
