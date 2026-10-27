#!/usr/bin/env python3
"""Generate champion and item notes from Riot Data Dragon (zh_TW).

    python3 tools/fetch_data.py                 # every champion and item
    python3 tools/fetch_data.py --only Ahri,Garen --no-items
    python3 tools/fetch_data.py --patch 16.21.1

Writes 英雄/<name>.md and 道具/<name>.md in the vault (the repo root).
Only the generated frontmatter keys and the block between GEN_START and GEN_END are rewritten;
HAND_KEYS in the frontmatter and everything after GEN_END (your own advice) are kept.
Raw downloads are cached in .cache/ (not in git). Standard library only.
"""
import argparse
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VAULT = ROOT   # the repo root is the Obsidian vault
CACHE = ROOT / ".cache" / "ddragon"
DD = "https://ddragon.leagueoflegends.com"
LOCALE = "zh_TW"
WORKERS = 16

GEN_START = "<!-- generated:start (rewritten by tools/fetch_data.py; write your own notes below the end marker) -->"
GEN_END = "<!-- generated:end -->"
HAND_KEYS = ("video", "archetypes_extra", "pinned", "avoid", "effect", "fits", "tier", "combos")   # kept when a note is regenerated
ARAM_MAP = "12"          # Howling Abyss; ARAM Mayhem uses its item list
ARAM_TWIN_PREFIX = "77"  # id 77NNNN is the ARAM-only copy of item NNNN (other price/stats)
RIFT_DUPLICATE_PREFIXES = ("32", "66")   # 32NNNN / 66NNNN: Summoner's Rift variants of item NNNN, not needed here
RIFT_MAP = "11"

ROLE_ZH = {"Fighter": "戰士", "Tank": "坦克", "Mage": "法師", "Assassin": "刺客", "Marksman": "射手", "Support": "輔助"}
DAMAGE_TAGS = {"physicalDamage": "物理", "magicDamage": "魔法", "trueDamage": "真實"}
MELEE_MAX_RANGE = 250    # attack range up to this counts as melee
RANGED_MIN_RANGE = 450
# Features read from spell text; each regex is run on the description and tooltip
FEATURES = {
    "控場": r"<status>|暈眩|擊飛|定身|緩速|減速|沉默|恐懼|魅惑|嘲諷|擊退|擊暈",
    "治療": r"<healing>|治療|回復",
    "護盾": r"<shield>|護盾",
    "位移": r"衝刺|閃現|傳送|躍|突進",
}


def fetch(url, cache_name):
    path = CACHE / cache_name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    with urllib.request.urlopen(url, timeout=30) as r:
        raw = r.read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return json.loads(raw)


def yaml(value):
    """A JSON value is valid YAML (double-quoted strings, flow lists)."""
    return json.dumps(value, ensure_ascii=False)


def safe_name(name):
    return re.sub(r'[\\/:*?"<>|#^\[\]]', "", name).strip()


def strip_html(text):
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<(passive|active)>(.*?)</\1>", r"**\2**", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def split_note(text):
    """Return (frontmatter lines, body) of an existing note, or ([], "")."""
    if not text.startswith("---\n"):
        return [], text
    end = text.find("\n---\n", 4)
    if end < 0:
        return [], text
    return text[4:end].split("\n"), text[end + 5:]


def hand_blocks(fm_lines):
    """The raw text of each HAND_KEYS entry (a top-level key and its indented lines)."""
    blocks, current = {}, None
    for line in fm_lines:
        m = re.match(r"^([A-Za-z_][\w-]*):", line)
        if m:
            current = m.group(1) if m.group(1) in HAND_KEYS else None
        if current:
            blocks.setdefault(current, []).append(line)
    return blocks


def write_note(path, frontmatter, generated, template_tail):
    old_fm, old_body = ([], "")
    if path.exists():
        old_fm, old_body = split_note(path.read_text(encoding="utf-8"))
    kept = hand_blocks(old_fm)
    fm = ["---"] + [f"{k}: {yaml(v)}" for k, v in frontmatter.items()]
    for key in HAND_KEYS:
        fm += kept.get(key, [])
    fm.append("---")
    if GEN_END in old_body:
        tail = old_body.split(GEN_END, 1)[1]
    elif old_body.strip():
        tail = "\n\n" + old_body.strip() + "\n"
    else:
        tail = template_tail
    text = "\n".join(fm) + "\n" + GEN_START + "\n" + generated.strip() + "\n" + GEN_END + tail
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return True
    return False


# ---------------------------------------------------------------- champions

def spell_damage(spell):
    text = spell.get("tooltip", "")
    return [zh for tag, zh in DAMAGE_TAGS.items() if f"<{tag}>" in text]


def spell_features(spells, passive):
    texts = [s.get("description", "") + s.get("tooltip", "") for s in spells] + [passive.get("description", "")]
    blob = "\n".join(texts)
    return [name for name, rx in FEATURES.items() if re.search(rx, blob)]


def archetypes(c):
    """Auto archetypes from roles, ratings and range. Hand-made ones go in `archetypes_extra`."""
    info, rng = c["info"], c["stats"]["attackrange"]
    out = [ROLE_ZH.get(t, t) for t in c["tags"]]
    out.append("近戰" if rng <= MELEE_MAX_RANGE else "遠程" if rng >= RANGED_MIN_RANGE else "中程")
    if info["defense"] >= 7 and "坦克" not in out:
        out.append("坦克")
    return out


def damage_type(info):
    a, m = info["attack"], info["magic"]
    if abs(a - m) <= 1:
        return "混合"
    return "物理" if a > m else "魔法"


def skills_fm(c, version):
    """Passive + Q W E R as small objects for the plugin (key, name, damage types, icon)."""
    p = c["passive"]
    out = [{"key": "P", "name": p["name"], "damage": [], "icon": f"{DD}/cdn/{version}/img/passive/{p['image']['full']}"}]
    for key, s in zip("QWER", c["spells"]):
        out.append({"key": key, "name": s["name"], "damage": spell_damage(s), "icon": f"{DD}/cdn/{version}/img/spell/{s['image']['full']}"})
    return out


def champion_note(c, version):
    info, st = c["info"], c["stats"]
    spells = c["spells"]
    dmg_all = sorted({d for s in spells for d in spell_damage(s)})
    fm = {
        "type": "champion", "id": c["id"], "key": int(c["key"]), "name": c["name"], "title": c["title"],
        "roles": [ROLE_ZH.get(t, t) for t in c["tags"]], "damage_type": damage_type(info),
        "skill_damage": dmg_all, "archetypes": archetypes(c),
        "features": spell_features(spells, c["passive"]), "resource": c["partype"],
        "attack": info["attack"], "magic": info["magic"], "defense": info["defense"], "difficulty": info["difficulty"],
        "range": st["attackrange"], "icon": f"{DD}/cdn/{version}/img/champion/{c['image']['full']}",
        "skills": skills_fm(c, version),
        "patch": version, "generated": True,
    }
    desc = lambda t: strip_html(t).replace("\n", " ")
    dmg = lambda sp: "、".join(spell_damage(sp)) or "—"
    lines = [f"![{c['name']}|64]({fm['icon']})  **{c['name']}**,{c['title']}", "",
             "| 技能 | 名稱 | 傷害 | 冷卻 |", "| --- | --- | --- | --- |",
             f"| 被動 | {c['passive']['name']} | — | — |"]
    for key, sp in zip("QWER", c["spells"]):
        lines.append(f"| {key} | {sp['name']} | {dmg(sp)} | {sp['cooldownBurn']} |")
    # long text stays folded so the note reads at a glance
    lines += ["", "> [!info]- 技能說明", f"> - **被動 {c['passive']['name']}**:{desc(c['passive']['description'])}"]
    lines += [f"> - **{key} {sp['name']}**:{desc(sp['description'])}" for key, sp in zip("QWER", c["spells"])]
    for title, kind, tips in (("使用技巧", "tip", c.get("allytips")), ("對戰技巧", "warning", c.get("enemytips"))):
        if tips:
            lines += ["", f"> [!{kind}]- {title}(官方)"] + [f"> - {strip_html(t).lstrip('- ').strip()}" for t in tips]
    lines += ["", "> [!abstract]- 基本數值",
              f"> 生命 {st['hp']:g}、{c['partype']} {st['mp']:g}、物理防禦 {st['armor']:g}、魔法防禦 {st['spellblock']:g}、攻擊力 {st['attackdamage']:g}、攻速 {st['attackspeed']:g}、移速 {st['movespeed']:g}、射程 {st['attackrange']:g}"]
    tail = "\n\n## 玩法心得\n\n\n## 大混戰 強化\n\n"
    return fm, "\n".join(lines), tail


# -------------------------------------------------------------------- items

def twin_of(item_id, keep):
    """The base item id when this is an ARAM-only copy whose base item is also kept, else None."""
    base = item_id[len(ARAM_TWIN_PREFIX):]
    return base if item_id.startswith(ARAM_TWIN_PREFIX) and len(item_id) == 6 and base in keep else None


def item_note(item_id, it, version, names, keep):
    maps = it.get("maps", {})
    gold = it["gold"]
    base = twin_of(item_id, keep)
    has_twin = ARAM_TWIN_PREFIX + item_id in keep
    fm = {
        "type": "item", "id": int(item_id), "name": it["name"], "tags": it.get("tags", []),
        "gold_total": gold["total"], "gold_base": gold["base"],
        "aram": bool(maps.get(ARAM_MAP)) and not has_twin, "rift": bool(maps.get(RIFT_MAP)),
        "icon": f"{DD}/cdn/{version}/img/item/{it['image']['full']}", "patch": version, "generated": True,
    }
    if base:
        fm["aram"] = True
        fm["variant_of"] = names[base]
    link = lambda ids: [f"[[{names[i]}]]" for i in ids if i in names]
    lines = [f"![{it['name']}|48]({fm['icon']})", ""]
    if base:
        lines += [f"> [!info] ARAM 版本\n> 這是 [[{names[base]}]] 在 ARAM 的專用版本,價格與數值不同。", ""]
    elif has_twin:
        lines += [f"> [!info] ARAM 另有專用版本\n> 在 ARAM 請看 [[{names[ARAM_TWIN_PREFIX + item_id]}]]。", ""]
    if it.get("plaintext"):
        lines += [f"**{it['plaintext']}**", ""]
    lines += [strip_html(it.get("description", "")), "", f"價格:{gold['total']}(合成 {gold['base']})"]
    if it.get("from"):
        lines += ["", "合成材料:" + "、".join(link(dict.fromkeys(it["from"])))]
    if it.get("into"):
        lines += ["", "可合成:" + "、".join(link(dict.fromkeys(it["into"])))]
    return fm, "\n".join(lines), "\n\n## 使用心得\n\n"


def wanted_item(item_id, it):
    maps = it.get("maps", {})
    if len(item_id) == 6 and item_id.startswith(RIFT_DUPLICATE_PREFIXES):
        return False
    return it["gold"].get("purchasable") and (maps.get(ARAM_MAP) or maps.get(RIFT_MAP)) and it["name"].strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--patch", help="Data Dragon version (default: latest)")
    ap.add_argument("--only", help="comma separated champion ids, e.g. Ahri,Garen")
    ap.add_argument("--no-items", action="store_true")
    ap.add_argument("--no-champions", action="store_true")
    args = ap.parse_args()

    version = args.patch or json.loads(urllib.request.urlopen(f"{DD}/api/versions.json", timeout=30).read())[0]
    print(f"patch {version} ({LOCALE})")
    changed = 0

    if not args.no_champions:
        listing = fetch(f"{DD}/cdn/{version}/data/{LOCALE}/champion.json", f"{version}/champion.json")["data"]
        ids = [i for i in listing if not args.only or i in args.only.split(",")]
        def one(cid):
            return fetch(f"{DD}/cdn/{version}/data/{LOCALE}/champion/{cid}.json", f"{version}/champion/{cid}.json")["data"][cid]
        with ThreadPoolExecutor(WORKERS) as pool:
            champions = list(pool.map(one, ids))
        for c in champions:
            fm, gen, tail = champion_note(c, version)
            changed += write_note(VAULT / "英雄" / f"{safe_name(c['name'])}.md", fm, gen, tail)
        print(f"champions: {len(champions)}")

    if not args.no_items:
        items = fetch(f"{DD}/cdn/{version}/data/{LOCALE}/item.json", f"{version}/item.json")["data"]
        keep = {i: it for i, it in items.items() if wanted_item(i, it)}
        def file_name(i, it):
            if twin_of(i, keep):
                return safe_name(it["name"]) + " (ARAM)"
            n = sum(1 for j, o in keep.items() if o["name"] == it["name"] and not twin_of(j, keep))
            return safe_name(it["name"]) + (f" ({i})" if n > 1 else "")
        names = {i: file_name(i, it) for i, it in keep.items()}
        for i, it in keep.items():
            fm, gen, tail = item_note(i, it, version, names, keep)
            changed += write_note(VAULT / "道具" / f"{names[i]}.md", fm, gen, tail)
        print(f"items: {len(keep)} (of {len(items)}; purchasable on Summoner's Rift or ARAM)")

    print(f"{changed} notes written or changed")


if __name__ == "__main__":
    sys.exit(main())
