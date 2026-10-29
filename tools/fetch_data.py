#!/usr/bin/env python3
"""Generate champion and item notes from Riot Data Dragon (zh_TW).

    python3 tools/fetch_data.py                 # every champion and item
    python3 tools/fetch_data.py --only Ahri,Garen --no-items
    python3 tools/fetch_data.py --patch 16.21.1

Writes <champion folder>/<name>.md and <item folder>/<name>.md in the vault (the repo root; folder names are in vault_paths.py).
Only the generated frontmatter keys and the block between GEN_START and GEN_END are rewritten;
HAND_KEYS in the frontmatter and everything after GEN_END (your own advice) are kept.
Raw downloads are cached in .cache/ (not in git). Standard library only.
"""
import argparse
import datetime
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import spells  # noqa: E402
import vault_paths as folders  # noqa: E402  (where the notes live)
VAULT = ROOT   # the repo root is the Obsidian vault
CACHE = ROOT / ".cache" / "ddragon"
DD = "https://ddragon.leagueoflegends.com"
LOCALE = "zh_TW"
WORKERS = 16

GEN_START = "<!-- generated:start (rewritten by tools/fetch_data.py; write your own notes below the end marker) -->"
GEN_END = "<!-- generated:end -->"
HAND_KEYS = ("video", "archetypes_extra", "features_extra", "onhit", "aliases", "pinned", "avoid", "effect", "fits", "tier", "combos", "builds", "tips", "punch", "soul", "plain")   # kept when a note is regenerated
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
    "控場": r"暈眩|眩暈|擊暈|擊飛|擊倒|定身|禁錮|束縛|沉默|恐懼|魅惑|嘲諷|睡眠|擊退|牽引|拉向|(目標|敵人|敵軍)變形",   # 變形 alone is also a champion changing form   # hard crowd control
    "緩速": r"緩速|減速",
    "治療": r"<healing>|治療|回復.{0,6}生命",   # not mana or energy restores
    "護盾": r"<shield>|護盾",
    "位移": r"衝刺|閃現|傳送|躍|突進|瞬步|瞬移|瞬間移動|閃爍|衝向|飛向|跳向|跳到|跳至|翻滾|往後退|向後退|向後跳",
    "吸血": r"吸血|生命偷取|偷取生命|汲取[^。，]{0,6}(生命|靈魂)",   # not 汲取靈感 (drawing inspiration)
    "加速": r"(跑速|移動速度|移速)[^。，]{0,8}(提升|增加|加成|提高)|(提升|增加|提高)[^。，]{0,8}(跑速|移動速度|移速)|加速",
    "隱身": r"隱形|偽裝|隱身|不可見|匿蹤",
    "免傷": r"傷害減免|減少[^。]{0,8}受到的傷害|受到的傷害[^。]{0,6}(降低|減少)|無法被選取|無敵|免疫",
    "斬殺": r"斬殺|處決|立即擊殺|直接擊殺|擊殺生命值",
    # weakens enemies without stopping them: blind, nearsight, grievous wounds, armour / magic resist / attack speed shred
    "減益": r"致盲|近視|重傷|(降低|減少|縮小)[^。]{0,4}(視線|視野)|(降低|減少|削減)[^。]{0,8}(護甲|魔法防禦|魔抗|物理防禦)|(降低|減少|削減)[^。，]{0,4}(敵人|敵方|目標|他們|其)[^。，]{0,4}(攻速|攻擊速度)|破甲",
    # its heal, shield or speed also reaches allies
    "隊友增益": r"(友軍|隊友|友方)[^。]{0,16}(治療|回復|護盾|跑速|移動速度)|(治療|回復|護盾|跑速|移動速度)[^。]{0,16}(友軍|隊友|友方)",
    # skills that empower basic attacks: the next one(s), every Nth one, or an attack the text calls 強化. Not a lasting "attacks deal
    # extra damage" passive (that is an on-hit effect), and not on-hit itself: that one is set by hand (`onhit`, `features_extra`)
    # damage that is a share of the target's health (Fiora, Gwen, Varus, Vayne ...): found in the game's own tooltips (spells.deals_percent_health),
    # never in the text, so this pattern can never match; the entry is here so the tag keeps its place in the order and survives retag_features.py
    spells.PERCENT_TAG: r"(?!)",
    "強化普攻": r"(下[一二三]?次|接下來的?[ 0-9一二三兩]*次?)[^。，]{0,8}(基本攻擊|普通攻擊|普攻|攻擊)|注入[^。]{0,10}(普攻|基本攻擊)|(每|第|連續)[ 0-9一二三四]+[次下][^。，]{0,2}(基本攻擊|普攻)|(首次|最後一次)[^。，]{0,2}(基本攻擊|普攻)|強化[^。，]{0,6}(普攻|基本攻擊)|普攻將被強化",
}

# Phrases that contain a tag's words without meaning it (found with tools/audit_tags.py): they are blanked out before the tag is looked for
NOT_FEATURES = {
    "緩速": r"(免疫|解除|移除|淨化)[^。，]{0,8}(緩速|減速)",
    "護盾": r"(移除|摧毀|擊破)[^。]{0,8}護盾",
    "位移": r"的敵(方|人|軍)衝刺|敵(方|人|軍)從[^。，]{0,6}衝刺|敵方的衝刺|(打斷|中斷|阻止)[^。，]{0,8}衝刺|跳躍的水柱|跳躍一次|虛空的傳送門|傳送在兩道傳送門|海潮衝向|魔法衝刺|從石塊上衝刺",   # enemies dashing, not this champion
    "加速": r"技能加速|(飛行途中|直線|隨時間)加速|控制加速|加速的飛彈",
    "隱身": r"偽裝成|在偽裝的狀態下|不可見的敵",
    "免傷": r"免疫[^。，]{0,4}(控場|緩速|硬控場)|(控場|緩速|行動限制)[^。，]{0,4}免疫",
    "隊友增益": r"友方防禦塔|獲得友軍的治療",
}


def tag_search(tag, text):
    """The first place `text` shows the ability `tag`, or None."""
    text = re.sub(r"<(?!/?(healing|shield)\b)[^>]*>", "", text)   # markup (<status>, <br>) can sit inside an ignored phrase; <healing> and <shield> are rules
    if tag in NOT_FEATURES:
        text = re.sub(NOT_FEATURES[tag], "。", text)
    return re.search(FEATURES[tag], text)


def fetch(url, cache_name):
    path = CACHE / cache_name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    with urllib.request.urlopen(url, timeout=30) as r:
        raw = r.read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return json.loads(raw)


CDRAGON_BIN = "https://raw.communitydragon.org/latest/game/data/characters/{n}/{n}.bin.json"


def champion_bin(cid):
    """The champion's game data (per-rank numbers), cached for the day; {} if it cannot be fetched."""
    path = ROOT / ".cache" / f"cdragon-bin-{datetime.date.today().isoformat()}" / f"{cid.lower()}.json"
    try:
        if not path.exists():
            req = urllib.request.Request(CDRAGON_BIN.format(n=cid.lower()), headers={"User-Agent": "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:   # the note is still made, without the per-rank numbers
        print(f"! {cid}: no game data ({e})", file=sys.stderr)
        return {}


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
    return [name for name in FEATURES if tag_search(name, blob)]


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


UPGRADE_MARKERS = ("進化", "升級", "生物兵器")   # sentences with these describe a skill's upgrade (Kha'Zix, Kai'Sa, Heimerdinger...)
GLOBAL_RANGE = 25000   # Data Dragon's "no range / whole map" value
GLOBAL_WORDS = re.compile(r"全地圖|整張地圖|全圖")


def split_upgrade(html):
    """(base text, upgrade text): sentences that mention an upgrade go to the second part."""
    base, upgrade = [], []
    for para in strip_html(html).split("\n"):
        for sentence in re.findall(r"[^。]+。?", para):
            (upgrade if any(m in sentence for m in UPGRADE_MARKERS) else base).append(sentence.strip())
    return " ".join(base), " ".join(upgrade)


def clean_range(spell):
    """The range worth showing: nothing for self-cast or no-range skills, 全地圖 only when the text says so."""
    r = spell["rangeBurn"]
    if r in ("", "0", "1", "-1", "self"):
        return ""
    if all(part.isdigit() and int(part) >= GLOBAL_RANGE for part in r.split("/")):
        return "全地圖" if GLOBAL_WORDS.search(spell["description"]) else ""
    return r


def skill_tags(spell):
    """The abilities one skill has (控場, 治療, 護盾, 位移, 吸血), read from its own text."""
    blob = spell.get("description", "") + spell.get("tooltip", "")
    return [name for name in FEATURES if tag_search(name, blob)]


GAME_TEXT_URL = "https://raw.communitydragon.org/latest/game/zh_tw/data/menu/en_us/lol.stringtable.json"
_game_text = None


def game_text():
    """The game's own zh_TW strings (lol.stringtable.json, about 32 MB), cached for the day in the folder fetch_augment_text.py also uses;
    {} if it cannot be fetched (the passives are then made without numbers)."""
    global _game_text
    if _game_text is None:
        path = CACHE / f"cdragon-{datetime.date.today().isoformat()}" / "lol.stringtable.json"
        try:
            if not path.exists():
                req = urllib.request.Request(GAME_TEXT_URL, headers={"User-Agent": "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    raw = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            _game_text = json.loads(path.read_text(encoding="utf-8"))["entries"]
        except Exception as e:
            print(f"! no game text for the passives ({e})", file=sys.stderr)
            _game_text = {}
    return _game_text


def with_tag(tags, tag):
    """`tags` with `tag` added, in the order of FEATURES."""
    return [n for n in FEATURES if n in tags or n == tag]


def skills_fm(c, version, bin_data=None):
    """Passive + Q W E R as small objects for the plugin (key, name, damage types, abilities, description, cooldown, cost, range, icon)."""
    p = c["passive"]
    objs = spells.spell_objects(bin_data or {})
    base, up = split_upgrade(p["description"])
    out = [{"key": "P", "name": p["name"], "damage": [], "tags": skill_tags(p), "desc": base, "upgrade": up,
            "icon": f"{DD}/cdn/{version}/img/passive/{p['image']['full']}"}]
    strings = game_text() if bin_data else {}
    rows, levels = spells.passive_rows(bin_data, strings) if bin_data else ([], [])
    if rows:   # damage / heal / shield by champion level, from the passive's own tooltip
        out[0]["rows"], out[0]["levels"] = rows, levels
    if bin_data and spells.deals_percent_health(spells.passive_spell(bin_data), strings):
        out[0]["tags"] = with_tag(out[0]["tags"], spells.PERCENT_TAG)
    for key, s in zip("QWER", c["spells"]):
        base, up = split_upgrade(s["description"])
        mspell = objs.get(s["id"].lower(), {}).get("mSpell") or {}
        tags = with_tag(skill_tags(s), spells.PERCENT_TAG) if spells.deals_percent_health(mspell, strings) else skill_tags(s)
        out.append({"key": key, "name": s["name"], "damage": spell_damage(s), "tags": tags, "desc": base, "upgrade": up,
                    "range": clean_range(s), "rows": spells.rank_rows(s, mspell, c["partype"]),
                    "icon": f"{DD}/cdn/{version}/img/spell/{s['image']['full']}"})
    return out


def champion_note(c, version, bin_data, name_en=""):
    info, st = c["info"], c["stats"]
    spells = c["spells"]
    dmg_all = sorted({d for s in spells for d in spell_damage(s)})
    fm = {
        "type": "champion", "id": c["id"], "key": int(c["key"]), "name": c["name"], "name_en": name_en or c["id"], "title": c["title"], "blurb": strip_html(c.get("blurb", "")).replace("\n", " "),
        "roles": [ROLE_ZH.get(t, t) for t in c["tags"]], "damage_type": damage_type(info),
        "skill_damage": dmg_all, "archetypes": archetypes(c),
        "features": None, "resource": c["partype"],
        "attack": info["attack"], "magic": info["magic"], "defense": info["defense"], "difficulty": info["difficulty"],
        "range": st["attackrange"], "icon": f"{DD}/cdn/{version}/img/champion/{c['image']['full']}",
        "skills": skills_fm(c, version, bin_data),
        "patch": version, "generated": True,
    }
    # the abilities of the champion: those read from the text, and the ones found in the game's tooltips (on its skills' tags)
    read = spell_features(spells, c["passive"])
    fm["features"] = [n for n in FEATURES if n in read or any(n in s["tags"] for s in fm["skills"])]
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


def item_desc(it, limit=140):
    """One short line of the item's stats and effect for the app's item panel."""
    text = re.sub(r"\s*\n+\s*", " / ", strip_html(it.get("description", ""))).replace("**", "")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def item_note(item_id, it, version, names, keep, everything=()):
    maps = it.get("maps", {})
    gold = it["gold"]
    base = twin_of(item_id, keep)
    has_twin = ARAM_TWIN_PREFIX + item_id in keep
    fm = {
        "type": "item", "id": int(item_id), "name": it["name"], "tags": it.get("tags", []),
        "desc": item_desc(it), "from": [int(i) for i in dict.fromkeys(it.get("from", []))], "into": [int(i) for i in dict.fromkeys(it.get("into", []))], "gold_total": gold["total"], "gold_base": gold["base"],
        "aram": bool(maps.get(ARAM_MAP)) and not has_twin, "rift": bool(maps.get(RIFT_MAP)),
        "icon": f"{DD}/cdn/{version}/img/item/{it['image']['full']}", "patch": version, "generated": True,
    }
    # an ARAM copy's own picture is often the item's old art: use the normal item's, whenever Riot's data has that item at all
    plain_id = item_id[len(ARAM_TWIN_PREFIX):] if item_id.startswith(ARAM_TWIN_PREFIX) and len(item_id) == 6 else None
    if plain_id and (plain_id in keep or plain_id in everything):
        fm["icon"] = f"{DD}/cdn/{version}/img/item/{plain_id}.png"
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
        # English names too, for the 速查 search (Wukong is MonkeyKing in the ids, Nunu & Willump is Nunu)
        english = fetch(f"{DD}/cdn/{version}/data/en_US/champion.json", f"{version}/champion.en_US.json")["data"]
        def one(cid):
            return fetch(f"{DD}/cdn/{version}/data/{LOCALE}/champion/{cid}.json", f"{version}/champion/{cid}.json")["data"][cid]
        with ThreadPoolExecutor(WORKERS) as pool:
            champions = list(pool.map(one, ids))
        for c in champions:
            fm, gen, tail = champion_note(c, version, champion_bin(c['id']), english.get(c["id"], {}).get("name", ""))
            changed += write_note(VAULT / folders.CHAMPIONS / f"{safe_name(c['name'])}.md", fm, gen, tail)
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
            fm, gen, tail = item_note(i, it, version, names, keep, items)
            changed += write_note(VAULT / folders.ITEMS / f"{names[i]}.md", fm, gen, tail)
        print(f"items: {len(keep)} (of {len(items)}; purchasable on Summoner's Rift or ARAM)")

    print(f"{changed} notes written or changed")


if __name__ == "__main__":
    sys.exit(main())
