#!/usr/bin/env python3
"""Compare champions across the last few patches (Data Dragon, zh_TW) and write _data/changes.json.

    python3 tools/fetch_changes.py            # the last 4 patches
    python3 tools/fetch_changes.py --patches 6

Per champion and patch it lists what changed against the patch before: base stats, each skill's cooldown / cost / range,
and skill text. Numbers are marked buff (better for the player), nerf, mixed (some ranks up, some down) or change;
a rewritten skill text is kept with the old and new wording (it may be a rewording or a real mechanic change: a person has to
read it). Damage numbers per rank are not compared yet, and neither are Mayhem-specific adjustments, which Data Dragon does not hold.
Standard library only.
"""
import argparse
import datetime
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data as fd   # noqa: E402

STATS = [("hp", "生命"), ("hpperlevel", "每級生命"), ("mp", "魔力"), ("mpperlevel", "每級魔力"), ("movespeed", "移速"), ("armor", "護甲"),
         ("armorperlevel", "每級護甲"), ("spellblock", "魔抗"), ("spellblockperlevel", "每級魔抗"), ("attackrange", "射程"),
         ("hpregen", "生命回復"), ("hpregenperlevel", "每級生命回復"), ("mpregen", "魔力回復"), ("mpregenperlevel", "每級魔力回復"),
         ("crit", "暴擊"), ("critperlevel", "每級暴擊"), ("attackdamage", "攻擊力"), ("attackdamageperlevel", "每級攻擊力"),
         ("attackspeedperlevel", "每級攻速"), ("attackspeed", "基礎攻速")]
SPELL_NUMBERS = [("cooldown", "冷卻", True), ("cost", "消耗", True), ("range", "射程", False)]   # (field, label, lower is better)
WORKERS = 16


def fmt(x):
    x = round(float(x), 3)
    return str(int(x)) if x == int(x) else str(x)


def direction(old, new, lower_better):
    """buff / nerf / mixed / change for two lists of numbers; None when equal."""
    if old == new:
        return None
    if len(old) != len(new):
        return "change"
    ups = sum(n > o for o, n in zip(old, new))
    downs = sum(n < o for o, n in zip(old, new))
    if ups and downs:
        return "mixed"
    return "buff" if (ups > 0) != lower_better else "nerf"


def spell_text(s):
    desc = fd.strip_html(s.get("description", "")).replace("\n", " ")
    return desc or fd.strip_html(s.get("tooltip", "")).replace("\n", " ")


def compare(a, b):
    """Changes of champion b against its previous version a (Data Dragon champion entries)."""
    out = []
    for key, label in STATS:
        if a["stats"].get(key) != b["stats"].get(key):
            out.append({"scope": "屬性", "field": label, "old": fmt(a["stats"][key]), "new": fmt(b["stats"][key]),
                        "dir": direction([a["stats"][key]], [b["stats"][key]], False)})
    pairs = [("P", a["passive"], b["passive"])] + [(k, sa, sb) for k, sa, sb in zip("QWER", a["spells"], b["spells"])]
    for scope, sa, sb in pairs:
        for field, label, lower in SPELL_NUMBERS:
            if scope == "P":
                break
            old, new = sa.get(field, []), sb.get(field, [])
            d = direction(old, new, lower)
            if d:
                out.append({"scope": scope, "field": label, "old": sa.get(field + "Burn", "/".join(fmt(x) for x in old)),
                            "new": sb.get(field + "Burn", "/".join(fmt(x) for x in new)), "dir": d})
        ta, tb = spell_text(sa), spell_text(sb)
        if ta != tb:
            out.append({"scope": scope, "field": "說明", "old": ta, "new": tb, "dir": "text"})
    return out


def patches(count):
    """The newest version of each of the last count+1 patches, newest first."""
    seen, out = set(), []
    for v in json.loads(urllib.request.urlopen(f"{fd.DD}/api/versions.json", timeout=30).read()):
        label = ".".join(v.split(".")[:2])
        if label not in seen:
            seen.add(label)
            out.append((label, v))
        if len(out) == count + 1:
            break
    return out


def champions(version):
    listing = fd.fetch(f"{fd.DD}/cdn/{version}/data/{fd.LOCALE}/champion.json", f"{version}/champion.json")["data"]
    def one(cid):
        return cid, fd.fetch(f"{fd.DD}/cdn/{version}/data/{fd.LOCALE}/champion/{cid}.json", f"{version}/champion/{cid}.json")["data"][cid]
    with ThreadPoolExecutor(WORKERS) as pool:
        return dict(pool.map(one, listing))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--patches", type=int, default=4, help="how many patches back to compare")
    args = ap.parse_args()
    vers = patches(args.patches)
    data = {}
    for label, v in vers:
        print(f"patch {label} ({v})")
        data[label] = champions(v)
    result = {}
    for (new_label, _), (old_label, _) in zip(vers, vers[1:]):
        for cid, cb in data[new_label].items():
            ca = data[old_label].get(cid)
            if not ca:
                continue
            items = [i for i in compare(ca, cb) if i["dir"]]
            if items:
                result.setdefault(cid, []).append({"patch": new_label, "from": old_label, "items": items})
    out = {"current": vers[0][0], "patches": [v[0] for v in vers[:-1]], "date": datetime.date.today().isoformat(), "champions": result}
    path = fd.ROOT / "_data" / "changes.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    now = [c for c, p in result.items() if p[0]["patch"] == out["current"]]
    print(f"{len(result)} champions changed in the last {args.patches} patches, {len(now)} in {out['current']} -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
