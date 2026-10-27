#!/usr/bin/env python3
"""Generate ARAM Mayhem augment notes from CommunityDragon (zh_TW).

    python3 tools/fetch_augments.py

Writes 強化/<name>.md for every augment in the Mayhem pool ("KIWI" list in augment-lists.json): name, rarity, icon.
CommunityDragon has no effect text for them, so `effect`, `fits`, `tier` and `combos` are hand-written frontmatter keys
(kept on a rerun, see HAND_KEYS in fetch_data.py). Standard library only.
"""
import datetime
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data as fd   # noqa: E402  (write_note, safe_name, fetch)

CDRAGON = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global"
POOL = "KIWI"            # ARAM Mayhem; KIWI_JADE is a smaller variant, CHERRY is Arena
RARITY_ZH = {"kSilver": "銀", "kGold": "金", "kPrismatic": "稜鏡"}
ICON_PREFIX = "/lol-game-data/assets/"


def get(url, name):
    """Download once per day (CommunityDragon's `latest` has no patch number)."""
    day = datetime.date.today().isoformat()
    path = fd.CACHE / f"cdragon-{day}" / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    req = urllib.request.Request(url, headers={"User-Agent": "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"})   # CommunityDragon rejects the default Python agent
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return json.loads(raw)


def main():
    augments = get(f"{CDRAGON}/zh_tw/v1/cherry-augments.json", "cherry-augments.zh_tw.json")
    lists = get(f"{CDRAGON}/default/v1/augment-lists.json", "augment-lists.json")
    pool = next(x["augmentList"] for x in lists if x["modeName"] == POOL)
    by_api = {a["augmentNameId"]: a for a in augments}
    picked = [by_api[p.rsplit("/", 1)[1]] for p in pool if p.rsplit("/", 1)[1] in by_api]
    counts = {}
    for a in picked:
        counts[a["nameTRA"]] = counts.get(a["nameTRA"], 0) + 1
    changed = 0
    for a in picked:
        icon = a["augmentSmallIconPath"]
        icon_url = f"{CDRAGON}/default/{icon[len(ICON_PREFIX):].lower()}" if icon.startswith(ICON_PREFIX) else ""
        rarity = RARITY_ZH.get(a["rarity"], a["rarity"])
        fm = {"type": "augment", "id": a["id"], "api": a["augmentNameId"], "name": a["nameTRA"], "rarity": rarity,
              "icon": icon_url, "mode": "mayhem", "generated": True}
        gen = f"<img src='{icon_url}' width='56'>  **{a['nameTRA']}**({rarity})"
        name = fd.safe_name(a["nameTRA"]) + (f" ({a['id']})" if counts[a["nameTRA"]] > 1 else "")
        changed += fd.write_note(fd.VAULT / "強化" / f"{name}.md", fm, gen, "\n\n## 效果\n\n\n## 適合的英雄\n\n")
    print(f"augments: {len(picked)} of {len(pool)} in the {POOL} pool; {changed} notes written or changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
