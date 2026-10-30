#!/usr/bin/env python3
"""The numbers, levels, scaling and fitting champions of the ARAM Mayhem augments, into _data/augment-data.json.

    python3 -I tools/fetch_augment_data.py

Sources (CommunityDragon, game files): Arena's map30.bin.json holds an AugmentData per augment (its tags and root spell, whose
DataValues and mSpellCalculations are the numbers); map12.bin.json (ARAM) holds ChampionAugmentTags, the augment tags each
champion is never offered. The text is the augment's own zh_TW game text (the key fetch_augment_text.py picks) with its
@placeholders@ filled per level: index 1 is level 1, index 2 the upgraded level (DataValues keep a spare entry at index 0).
Mayhem-only augments have no AugmentData there: they are left out and the app keeps their plain text. Standard library only.
"""
import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_augment_text as fat   # noqa: E402  (load_strings, find_key, PREFIXES)
import fetch_augments as fa        # noqa: E402  (get, CDRAGON, POOL)
import fetch_data as fd            # noqa: E402
import spells                      # noqa: E402  (Calc, num, stat_label)

MAPS = "https://raw.communitydragon.org/latest/game/data/maps/shipping"
# The augment tag bits, named by which champions are never offered them (checked 2026-10-30: bit 3 is skipped by champions
# without mana, bit 8 by melee champions, bit 12 by those who cannot help allies...). Bit 6 (summoner spells) excludes no one.
TAG_NAME = {1: "魔攻", 2: "物攻", 3: "魔力", 4: "控場", 5: "位移", 6: "召喚師技能", 7: "技能射擊", 8: "遠程",
            9: "近戰", 10: "大絕", 11: "治療護盾", 12: "輔助友軍"}
UPGRADED = 2   # the level an augment reaches when upgraded (MaxLevel in its DataValues)
TOKEN = re.compile(r"@([\w.:]+?)(\*-?[\d.]+)?@")
ICON = re.compile(r"%i:(\w+)%")


def strip_prefix(api):
    return re.sub(r"^(aram_|kiwi_)", "", api.lower())


def fill(calc, name, times, level, after=""):
    """One placeholder as text, or None when the game data does not have it (f1, f2...: worked out in the game)."""
    name = re.split(r"[.:]", name)[-1]
    r = calc.named(name, level)
    if r is None:
        return None
    flat, scale = r
    k = float(times[1:]) if times else 1
    if k == 1 and not scale and 0 < abs(flat) < 1 and not re.match(r"\s*(秒|%)", after):
        flat, k, unit = flat, 100, "%"   # a bare fraction the game shows as a percent (0.35 傷害 is 35% 傷害)
    else:
        unit = ""
    parts = [spells.num(flat * k) + unit] if flat or not scale else []
    for key, coef in scale.items():
        label = spells.stat_label(key)
        parts.append(f"{spells.num(coef * 100)}% {label}" if label != spells.UNKNOWN_STAT else f"+{label}")
    return " + ".join(parts)


def runs_of(template, calc, level):
    """The text as runs [text, kind]: kind is the game's markup around it (scaleAD, magicDamage, shield...) or ""."""
    t = re.sub(r"<rules>.*?</rules>", "", template, flags=re.S)
    t = re.sub(r"<br\s*/?>", " ", t)
    t = re.sub(r"@spell(\d)keybind@", lambda m: "QWER"[min(int(m.group(1)), 4) - 1], t, flags=re.I)
    chips, missing = [], False

    def sub(m):
        nonlocal missing
        v = fill(calc, m.group(1), m.group(2), level, m.string[m.end():m.end() + 3])
        if v is None:
            missing = True
            return "X"
        return v
    t = TOKEN.sub(sub, t)
    t = re.sub(r"\{\{[^}]*\}\}", "X", t)
    # stat icons: the icon names the stat, the words after it up to the punctuation are the chip
    for m in ICON.finditer(t):
        rest = t[m.end():]
        rest = re.sub(r"^\s*<(?!/)[^>]+>", "", rest)          # an opening tag right after the icon wraps the words
        rest = re.split(r"</", rest, maxsplit=1)[0]            # ...and its end ends them
        words = re.sub(r"<[^>]+>", "", re.split(r"[。，,；;（(]|%i:", rest, maxsplit=1)[0]).strip()
        if words:
            chips.append({"stat": m.group(1), "text": words})
    # stats marked only by their markup (<scaleHealth>15%生命</scaleHealth>) are chips too
    seen = {c["stat"] for c in chips}
    for m in re.finditer(r"<(scale\w+)>(.*?)</\1>", t):
        words = re.sub(r"<[^>]+>|%i:\w+%", "", m.group(2)).strip()
        if m.group(1) not in seen and words and re.search(r"\d", words):
            chips.append({"stat": m.group(1), "text": words}); seen.add(m.group(1))
    t = ICON.sub("", t)
    runs, kind_stack = [], []
    for tok in re.split(r"(<[^>]+>)", t):
        if not tok:
            continue
        m = re.fullmatch(r"<(/?)(\w+)[^>]*>", tok)
        if m:
            if m.group(1):
                if kind_stack:
                    kind_stack.pop()
            else:
                kind_stack.append(m.group(2))
            continue
        text = re.sub(r"\s+", " ", tok)
        if runs and runs[-1][1] == (kind_stack[-1] if kind_stack else ""):
            runs[-1][0] += text
        else:
            runs.append([text, kind_stack[-1] if kind_stack else ""])
    cjk = "\u3000-\u9fff\uff00-\uffef"
    for r in runs:
        r[0] = re.sub(r"\s+([，。！？、：%])", r"\1", r[0])
        r[0] = re.sub(rf"(?<=[{cjk}])\s+(?=[\d{cjk}])|(?<=\d)\s+(?=[{cjk}])", "", r[0])
    for i in range(len(runs) - 1):   # a space between two runs next to Chinese text goes too
        if runs[i][0].endswith(" ") and re.match(rf"[\d{cjk}]", runs[i + 1][0].lstrip()):
            runs[i][0] = runs[i][0].rstrip()
        if runs[i + 1][0].startswith(" ") and re.search(rf"[{cjk}]$", runs[i][0]):
            runs[i + 1][0] = runs[i + 1][0].lstrip()
    while runs and not runs[-1][0].strip():
        runs.pop()
    if runs:
        runs[0][0] = runs[0][0].lstrip()
        runs[-1][0] = runs[-1][0].rstrip()
    return runs, chips, missing


def main():
    strings = fat.load_strings()
    augments = fa.get(f"{fa.CDRAGON}/zh_tw/v1/cherry-augments.json", "cherry-augments.zh_tw.json")
    lists = fa.get(f"{fa.CDRAGON}/default/v1/augment-lists.json", "augment-lists.json")
    arena = fa.get(f"{MAPS}/map30/map30.bin.json", "map30.bin.json")
    aram = fa.get(f"{MAPS}/map12/map12.bin.json", "map12.bin.json")
    pool = [p.rsplit("/", 1)[1] for p in next(x["augmentList"] for x in lists if x["modeName"] == fa.POOL)]
    by_api = {a["augmentNameId"]: a for a in augments}
    data = {v["AugmentNameId"].lower(): v for v in arena.values() if isinstance(v, dict) and v.get("__type") == "AugmentData"}
    names = {}
    for key, value in strings.items():
        if key.endswith("_name") and not key.startswith("{") and key.startswith(("kiwi_", "cherry_")):
            names.setdefault(value, []).append(key[:-5])

    champ_tags = aram.get("Globals/ChampionAugmentTags") or arena.get("Globals/ChampionAugmentTags") or {}
    excluded = {c["championName"].split("/")[-1].lower(): c.get("mExcludedTags", 0) for c in champ_tags.get("ChampionTags", [])}

    out, no_data = {}, 0
    for api in pool:
        a = by_api.get(api)
        d = data.get(strip_prefix(api)) if a else None
        if not d:
            no_data += 1
            continue
        mspell = (arena.get(d.get("RootSpell", "")) or {}).get("mSpell") or {}
        calc = spells.Calc(mspell)
        key = fat.find_key(strings, names, a["nameTRA"], api)
        if not key:
            continue
        top = calc.value("MaxLevel", 1)
        levels = [1, UPGRADED] if top and top >= UPGRADED else [1]
        per = [runs_of(strings[key], calc, lv) for lv in levels]
        if len(per) > 1 and per[0][0] == per[1][0]:
            per, levels = per[:1], [1]   # the upgrade changes nothing this text shows
        tags = d.get("mAugmentTags", 0) or 0
        bits = [b for b in TAG_NAME if tags >> b & 1]
        entry = {"levels": levels, "runs": [p[0] for p in per], "chips": [p[1] for p in per], "partial": any(p[2] for p in per),
                 "tags": [TAG_NAME[b] for b in bits]}
        if bits and any(excluded.get(c, 0) & tags for c in excluded):   # a tag someone is never offered: list who is
            entry["fits"] = sorted(c for c, ex in excluded.items() if not ex & tags)
        out[str(a["id"])] = entry

    path = fd.ROOT / "_data" / "augment-data.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({"date": datetime.date.today().isoformat(),
                                "source": "Riot Games game data via CommunityDragon (Arena's augment data, ARAM's champion augment tags)",
                                "augments": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    fits = sum(1 for v in out.values() if "fits" in v)
    upgraded = sum(1 for v in out.values() if len(v["levels"]) > 1)
    print(f"augment data: {len(out)} of {len(pool)} ({upgraded} with an upgraded level, {fits} with fitting champions); "
          f"{no_data} Mayhem-only without game data -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
