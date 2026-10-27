#!/usr/bin/env python3
"""Pull the effect text of the ARAM Mayhem augments from the game's own zh_TW text (CommunityDragon) into _data/augment-text.json.

    python3 tools/fetch_augment_text.py

The game keeps every UI string in lol.stringtable.json (about 32 MB). An augment's strings are named after it
(kiwi_<name>_summary, cherry_<name>_tooltip ...); the Mayhem ones (kiwi_) win over the shared Arena ones. The text carries
placeholders for numbers (@ShieldBase@) that live in game files this script does not read, so those are left out and the entry
is marked `partial`: the app shows the sentence and says the numbers are in the game. Riot's patch notes (fetch_patch_notes.py)
have complete text for augments added in the last patches and are preferred by the app. Standard library only.
"""
import collections
import datetime
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_augments as fa   # noqa: E402  (get, CDRAGON, POOL)
import fetch_data as fd       # noqa: E402

STRINGS_URL = "https://raw.communitydragon.org/latest/game/zh_tw/data/menu/en_us/lol.stringtable.json"
USER_AGENT = "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"   # CommunityDragon rejects the default Python agent
SUFFIXES = ("summary", "tooltipdescription", "tooltip", "desc", "description")   # best first
PREFIXES = ("kiwi_aram_", "kiwi_", "cherry_aram_", "cherry_", "aram_augment_", "kiwi_aram_augment_")


def load_strings():
    day = datetime.date.today().isoformat()
    path = fd.CACHE / f"cdragon-{day}" / "lol.stringtable.json"
    if not path.exists():
        req = urllib.request.Request(STRINGS_URL, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=180) as r:
            raw = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    return json.loads(path.read_text(encoding="utf-8"))["entries"]


def clean(text):
    """(readable text, partial) with markup, icon codes and number placeholders removed."""
    text = re.sub(r"<rules>.*?</rules>", "", text, flags=re.S)
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"%i:[^%]*%", "", text)
    text = re.sub(r"@spell(\d)keybind@", lambda m: "QWER"[min(int(m.group(1)), 4) - 1], text, flags=re.I)   # a skill key, not a number
    partial = bool(re.search(r"@[^@]+@|\{\{[^}]*\}\}", text))
    text = re.sub(r"@[^@\s]+@", "X", text)   # a number the game fills in
    text = re.sub(r"\{\{[^}]*\}\}", "X", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([，。！？、：])", r"\1", text)
    return text, partial


def find_key(strings, prefixes_by_name, name, api):
    """The string key holding this augment's description, Mayhem first."""
    prefixes = list(prefixes_by_name.get(name, []))
    core = re.sub(r"^aram_", "", api.lower())
    for variant in {core, core.replace("_", "")}:
        prefixes += [p + variant for p in PREFIXES]
    for tier in ("kiwi_", ""):   # Mayhem strings before the shared ones
        for pre in prefixes:
            if tier and not pre.startswith(tier):
                continue
            for suffix in SUFFIXES:
                key = f"{pre}_{suffix}"
                if key in strings and strings[key].strip():
                    return key
    return None


def main():
    strings = load_strings()
    augments = fa.get(f"{fa.CDRAGON}/zh_tw/v1/cherry-augments.json", "cherry-augments.zh_tw.json")
    lists = fa.get(f"{fa.CDRAGON}/default/v1/augment-lists.json", "augment-lists.json")
    pool = [p.rsplit("/", 1)[1] for p in next(x["augmentList"] for x in lists if x["modeName"] == fa.POOL)]
    by_api = {a["augmentNameId"]: a for a in augments}
    prefixes_by_name = collections.defaultdict(list)
    for key, value in strings.items():
        if key.endswith("_name") and not key.startswith("{") and key.startswith(("kiwi_", "cherry_")):
            prefixes_by_name[value].append(key[:-5])
    out, missing = {}, []
    for api in pool:
        a = by_api.get(api)
        if not a:
            continue
        key = find_key(strings, prefixes_by_name, a["nameTRA"], api)
        text, partial = clean(strings[key]) if key else ("", False)
        if text:
            out[str(a["id"])] = {"text": text, "partial": partial, "key": key}
        else:
            missing.append(a["nameTRA"])
    path = fd.ROOT / "_data" / "augment-text.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({"date": datetime.date.today().isoformat(), "source": "Riot Games zh_TW game text via CommunityDragon", "augments": out},
                               ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    partial = sum(1 for v in out.values() if v["partial"])
    print(f"augment text: {len(out)} of {len(pool)} ({partial} with the numbers left out); {len(missing)} without text -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
