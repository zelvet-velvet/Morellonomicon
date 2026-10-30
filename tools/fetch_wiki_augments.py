#!/usr/bin/env python3
"""The League of Legends Wiki's description of every ARAM Mayhem augment, as plain English, into _data/augment-wiki.json.

    python3 -I tools/fetch_wiki_augments.py

The wiki keeps every Mayhem augment in one data module (Module:MayhemAugmentData/data): an English description with the
numbers in templates ({{as|60% bonus attack speed}}, {{pp|70 to 240}} by level, {{rd|6%|3%}} melee / ranged), expanded here to
plain text. It is the reference for the zh_TW `effect` lines on the augment notes that Riot's game data has no numbers for
(written by hand from it, `effect_source: League of Legends Wiki`); each entry keeps a hash so a rerun lists the augments whose
wiki text changed, whose `effect` line then needs a look. Matched by English name (CommunityDragon en_gb).
The wiki's content is CC BY-SA 3.0: the file names its source and licence, and the app credits it. Standard library only.
"""
import datetime
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_augments as fa   # noqa: E402  (get, CDRAGON, POOL)
import fetch_data as fd       # noqa: E402

WIKI = "https://wiki.leagueoflegends.com/en-us"
MODULE = "Module:MayhemAugmentData/data"
USER_AGENT = "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"
NAME_PREFIXES = ("", "Quest: ", "Pentakill: ")   # how the wiki names quests and the Pentakill set

def fetch_module():
    url = f"{WIKI}/{urllib.parse.quote(MODULE)}?action=raw"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def entries(lua):
    """{wiki name: description} from the Lua table (double-quoted or [=[ ]=] strings)."""
    out = {}
    heads = list(re.finditer(r'^\t\["((?:[^"\\]|\\.)+)"\] = \{', lua, re.M))
    for k, m in enumerate(heads):
        body = lua[m.end():heads[k + 1].start() if k + 1 < len(heads) else len(lua)]
        d = re.search(r'\["description"\] = "((?:[^"\\]|\\.)*)"', body, re.S) or re.search(r'\["description"\] = \[=*\[(.*?)\]=*\]', body, re.S)
        if d:
            out[m.group(1).replace('\\"', '"')] = d.group(1).replace('\\"', '"').replace("\\'", "'")
    return out


def args(inner):
    """Split a template's inside on top-level pipes."""
    parts, depth, cur = [], 0, ""
    i = 0
    while i < len(inner):
        if inner.startswith("{{", i):
            depth += 1; cur += "{{"; i += 2; continue
        if inner.startswith("}}", i):
            depth -= 1; cur += "}}"; i += 2; continue
        if inner[i] == "|" and depth == 0:
            parts.append(cur); cur = ""; i += 1; continue
        cur += inner[i]; i += 1
    parts.append(cur)
    return parts


def expand(text):
    """Templates to plain text; a stat template {{as|...}} is kept marked as ⟦...⟧ so its number and words stay together."""
    def one(name, a):
        n = name.strip().lower()
        if n == "as":
            return "⟦" + a[0] + "⟧" if a else ""
        if n == "fd":
            return a[0] if a else ""
        if n == "pp":
            m = re.match(r"\s*([\d.]+)\s+to\s+([\d.]+)", a[0] if a else "")
            return f"{m.group(1)}–{m.group(2)}（隨等級）" if m else (a[0] if a else "")
        if n == "rd":
            return f"{a[0]}（遠程 {a[1]}）" if len(a) > 1 else (a[0] if a else "")
        if n == "times":
            return "×"
        if n in ("tip", "tt"):
            return a[1] if n == "tip" and len(a) > 1 else (a[0] if a else "")
        return a[0] if a else ""
    while "{{" in text:
        new = re.sub(r"\{\{([^{}]*)\}\}", lambda m: one(*(lambda p: (p[0], p[1:]))(args(m.group(1)))), text)
        if new == text:
            break
        text = new
    text = re.sub(r"\[\[File:[^\]]*\]\]", "", text)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"'''?|<br\s*/?>|<!--.*?-->|<[^>]+>", " ", text, flags=re.S)
    return re.sub(r"\s+", " ", text).strip()


def main():
    lua = fetch_module()
    wiki = entries(lua)
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    by_norm = {norm(k): k for k in wiki}
    english = {a["id"]: a["nameTRA"] for a in fa.get(f"{fa.CDRAGON}/en_gb/v1/cherry-augments.json", "cherry-augments.en_gb.json")}
    lists = fa.get(f"{fa.CDRAGON}/default/v1/augment-lists.json", "augment-lists.json")
    pool = {p.rsplit("/", 1)[1] for p in next(x["augmentList"] for x in lists if x["modeName"] == fa.POOL)}
    ids = {a["id"] for a in fa.get(f"{fa.CDRAGON}/zh_tw/v1/cherry-augments.json", "cherry-augments.zh_tw.json") if a["augmentNameId"] in pool}
    path = fd.ROOT / "_data" / "augment-wiki.json"
    old = json.loads(path.read_text(encoding="utf-8"))["augments"] if path.exists() else {}
    out, unmatched, changed = {}, [], []
    for i in sorted(ids):
        en = english.get(i, "")
        key = next((by_norm[norm(p + en)] for p in NAME_PREFIXES if norm(p + en) in by_norm), None)
        if not key:
            unmatched.append(en)
            continue
        text = expand(wiki[key]).replace("⟦", "").replace("⟧", "")
        h = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
        if str(i) in old and old[str(i)].get("hash") != h:
            changed.append(key)
        out[str(i)] = {"name": key, "url": f"{WIKI}/{urllib.parse.quote(key.replace(' ', '_'))}_(ARAM:_Mayhem_Augment)", "text": text, "hash": h}
    path.write_text(json.dumps({"date": datetime.date.today().isoformat(), "source": f"League of Legends Wiki, {WIKI}/{MODULE}",
                                "license": "CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/)", "augments": out},
                               ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wiki text: {len(out)} augments; not on the wiki: {', '.join(unmatched) or 'none'} -> {path}")
    if changed:
        print(f"changed on the wiki since the last run (check their `effect` line): {', '.join(changed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
