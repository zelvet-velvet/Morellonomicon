"""Rank ARAM Mayhem augments per champion play style from the champion's own numbers (Dev Tools/Augment Model.md).

Reads the champion notes (per-rank damage, healing, shields, cooldowns, ability tags, `stack`, `onhit`), Data Dragon's base stats
(cached in .cache/ddragon, like fetch_data.py), the hand-written augment terms (tools/data/augment-model.json) and champion
corrections (tools/data/champion-model.json). For every play style it works out a typical fight, applies each augment and works
the fight out again; the gain, ranked within the champion and across champions, gives the tier.

Writes _data/champion-model.json, _data/augment-tiers.json and Review/Augment Tiers.md (the test champions, for review).
Standard library only.

    python3 -I tools/augment_model.py
"""
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data  # noqa: E402
import vault_paths  # noqa: E402

ROOT = fetch_data.ROOT
AUGMENT_MODEL = ROOT / "tools" / "data" / "augment-model.json"
CHAMPION_HAND = ROOT / "tools" / "data" / "champion-model.json"
OUT_MODEL = ROOT / "_data" / "champion-model.json"
OUT_TIERS = ROOT / "_data" / "augment-tiers.json"
OUT_REVIEW = ROOT / "Review" / "Augment Tiers.md"

# Mayhem starts at level 3 with the first augment; more come at 7, 11 and 15 (League of Legends Wiki, ARAM: Mayhem). An augment picked
# at one of them works from there on, so its value at a pick is its average gain over the levels from that pick to 18.
PICKS = [3, 7, 11, 15]
LEVELS = [3, 7, 11, 15, 18]
ITEMS = {3: 0.0, 7: 1.0, 11: 2.0, 15: 3.0, 18: 4.5}   # finished items by each level (STACK_BONUS is for three)
LEVEL_WEIGHT = {3: 0.5, 7: 1.0, 11: 1.0, 15: 1.0, 18: 1.0}   # level 3 fights are short skirmishes: they count half
SHOWN = 11                 # the level whose fight the review note shows
LEVEL = SHOWN              # the level being worked out (set by set_level)
BASIC_RANK, ULT_RANK = 3, 2
EARLY_LATE = 2.0           # an augment worth this many times more at the first pick than the last (or the reverse) is marked 前期強 / 後期強
PENTAKILL = {3170, 3171, 3172, 3173}   # offered only together, by the Pentakill band's own selection: ranked among themselves
OWN_PICKS = {3170: [3], 3171: [3], 3172: [3], 3173: [18]}   # the band's selection: Q / W / E after the first screen, R added at 18
FIGHT_S = 8.0              # seconds of a team fight
RESET_CASTS = 2.0          # casts a full-reset champion gets from takedowns in a fight
TAKEDOWNS = 1.5            # takedowns a champion takes part in per fight
TARGET_HP, TARGET_RES = 2500.0, 80.0   # the enemy hit: health, armor and magic resist
BASE_BONUS = {"hp": 400.0, "haste": 10.0}   # runes and boots, for everyone
STACK_BONUS = {"法術強度": ("ap", 250.0), "攻擊力": ("bonus_ad", 120.0), "攻速": ("as", 0.6), "暴擊": ("crit", 0.5), "生命": ("hp", 1200.0),
               "護甲": ("armor", 80.0), "魔防": ("mr", 80.0), "技能急速": ("haste", 40.0), "跑速": ("ms", 40.0), "穿透": ("pen", 0.18)}
AUTOS = {"射手": 0.85, "melee": 0.6, "tank": 0.45, "other": 0.3}   # share of the fight spent attacking, by default
CRIT_DMG = 1.75
AS_CAP = 2.5
ONHIT_ITEMS = (40.0, 0.15)  # an on-hit build's item damage per hit: base, AP ratio (Nashor's, Wit's End...)
UTIL_SHARE = 1.5            # utility's weight next to Riot's 1-10 ratings (squared, like them)
SUPPORT_SHARE = 9.0         # the weight of healing / shielding allies, for champions that do (as a rating, squared)
TOGGLE_CD = 2.0             # an ability with a shorter cooldown is a toggle or a stance (Jinx Q): one cast, haste does nothing
CAST_S = 0.4                # seconds a cast takes out of attacking (so more casts cost an auto-attacker some attacks)
MIN_CYCLE_S = 1.0           # no ability is cast more often than this, however much its cooldown is cut
SETTLE_ROUNDS = 6           # rounds for casts and attacks that feed each other (祕術拳擊 on Master Yi's Q) to settle
UTIL_POINT = 0.1            # one utility point (a dash, +10% speed...) counts as a 10% gain
TIERS = [("S", 0.82), ("A", 0.6), ("B", 0.4), ("C", -1.0)]   # about the top 2-3 of a rarity S, to about 10th A, to 20th B
TEST = ["Katarina", "Jinx", "Ezreal", "Malphite", "Soraka", "Darius", "MasterYi", "Lux", "Kaisa", "Garen", "Fiora", "Yasuo", "Yone"]

ROW_TYPE = {"物理傷害": "physical", "魔法傷害": "magic", "真實傷害": "true"}
SCALE = {"魔法攻擊": "ap", "額外物理攻擊": "bonus_ad", "物理攻擊": "ad"}


def set_level(level):
    """Work out everything at this level: ability ranks (one point a level, the ultimate at 6 / 11 / 16) and items."""
    global LEVEL, BASIC_RANK, ULT_RANK
    LEVEL = level
    ULT_RANK = 3 if level >= 16 else 2 if level >= 11 else 1 if level >= 6 else 0
    BASIC_RANK = max(1, min(5, round((level - ULT_RANK) / 3)))


def at_level(v):
    """A [low, high] number that grows with level (the wiki's 20–80), read at LEVEL; a plain number as it is."""
    if isinstance(v, list):
        return v[0] + (v[1] - v[0]) * (LEVEL - 1) / 17
    return float(v or 0)


def growth(base, per):
    """Riot's stat growth from level 1 to LEVEL."""
    n = LEVEL - 1
    return base + per * n * (0.7025 + 0.0175 * n)


def num(s, i):
    """The i-th of "80/115/150" (or the last one), as a number; 0 when there is none."""
    parts = [p for p in re.split(r"/", str(s)) if p.strip()]
    if not parts:
        return 0.0
    m = re.search(r"-?[\d.]+", parts[min(i, len(parts) - 1)])
    return float(m.group(0)) if m else 0.0


def ratios(note, i):
    """{"ap": 0.4, "bonus_ad": 0.25 ...} from a rank row's note ("+40% 魔法攻擊 +25% 額外物理攻擊")."""
    out = {}
    for m in re.finditer(r"\+\s*([\d./]+)%\s*(額外物理攻擊|物理攻擊|魔法攻擊)", note or ""):
        out[SCALE[m.group(2)]] = out.get(SCALE[m.group(2)], 0) + num(m.group(1), i) / 100
    return out


def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    fm = text.split("---")[1] if text.startswith("---") else ""
    out = {}
    for line in fm.splitlines():
        m = re.match(r"^([a-z_]+): (.*)$", line)
        if not m:
            continue
        try:
            out[m.group(1)] = json.loads(m.group(2))
        except json.JSONDecodeError:
            out[m.group(1)] = m.group(2).strip('"')
    return out


# ---- the champion model ----------------------------------------------------------------------------------------------------

def abilities(note):
    """Each ability: key, cooldown, damage parts, healing / shield parts, tags (rank 4 basics, rank 2 ultimate, passive at LEVEL)."""
    out = []
    for s in note.get("skills", []):
        key = s["key"]
        if key == "P":
            levels = [int(x) for x in s.get("levels", []) if str(x).isdigit()]
            i = max([k for k, lv in enumerate(levels) if lv <= LEVEL] or [0])
        else:
            if key == "R" and ULT_RANK == 0:
                continue   # no ultimate before level 6
            i = (ULT_RANK if key == "R" else BASIC_RANK) - 1
        ab = {"key": key, "tags": s.get("tags", []), "desc": s.get("desc", ""), "cd": 0.0, "dmg": [], "heal": [], "shield": []}
        best = {}
        for r in s.get("rows", []):
            label = re.sub(r"\d+$", "", r["label"])
            if label.startswith("冷卻"):
                ab["cd"] = num(r["vals"][min(i, len(r["vals"]) - 1)], 0)
            elif label in ROW_TYPE:
                part = {"type": ROW_TYPE[label], "base": num(r["vals"][min(i, len(r["vals"]) - 1)], 0), **ratios(r["note"], i)}
                if part["base"] >= best.get(label, {"base": -1})["base"]:   # the biggest line of each type (per hit vs total)
                    best[label] = part
            elif label in ("治療", "護盾"):
                ab["heal" if label == "治療" else "shield"].append({"base": num(r["vals"][min(i, len(r["vals"]) - 1)], 0), **ratios(r["note"], i)})
        ab["dmg"] = list(best.values())
        out.append(ab)
    return out


def ref_stats(dd, stack):
    """The play style's stats at LEVEL with its reference build."""
    st = dd["stats"]
    bonus = dict(BASE_BONUS)
    for name in stack:
        if name in STACK_BONUS:
            k, v = STACK_BONUS[name]
            bonus[k] = bonus.get(k, 0) + v * ITEMS[LEVEL] / 3   # the items it has by this level
    return {
        "hp": growth(st["hp"], st["hpperlevel"]) + bonus.get("hp", 0), "bonus_hp": bonus.get("hp", 0),
        "base_ad": growth(st["attackdamage"], st["attackdamageperlevel"]), "bonus_ad": bonus.get("bonus_ad", 0),
        "ap": bonus.get("ap", 0), "base_as": st["attackspeed"], "as": st["attackspeedperlevel"] / 100 * (LEVEL - 1) * (0.7025 + 0.0175 * (LEVEL - 1)) + bonus.get("as", 0),
        "crit": bonus.get("crit", 0), "haste": bonus.get("haste", 0), "ult_haste": 0.0, "basic_haste": 0.0,
        "armor": growth(st["armor"], st["armorperlevel"]) + bonus.get("armor", 0), "mr": growth(st["spellblock"], st["spellblockperlevel"]) + bonus.get("mr", 0),
        "ms": st["movespeed"] + bonus.get("ms", 0), "pen": bonus.get("pen", 0), "omnivamp": 0.0, "heal_power": 0.0, "heal_received": 0.0,
        "ad_pct": 0.0, "hp_pct": 0.0, "ms_pct": 0.0, "range": st["attackrange"],
        "bonus_armor": bonus.get("armor", 0), "bonus_mr": bonus.get("mr", 0), "dr": 0.0, "crit_dmg": 0.0, "pen_phys": 0.0,
    }


def play_styles(cid, note, dd, hand):
    """The champion's play styles: the default one from its notes, and any the hand file adds."""
    h = hand.get(cid, {})
    melee = dd["stats"]["attackrange"] < 300
    roles = note.get("roles", [])
    default_autos = (AUTOS["射手"] if "射手" in roles else AUTOS["tank"] if melee and roles[:1] == ["坦克"]
                     else AUTOS["melee"] if melee and ({"戰士", "坦克"} & set(roles)) else AUTOS["other"])
    base = {"name": "主流", "stack": note.get("stack", []), "autos": h.get("autos", default_autos), "resets": h.get("resets", 0.0),
            "onhit_hits": h.get("onhit_hits", {}), "use": h.get("use", {}), "extra": h.get("extra", {}), "auto_mult": h.get("auto_mult", 1.0),
            "buff": h.get("buff", {}), "per_hit": h.get("per_hit", {}), "cd_per_attack": h.get("cd_per_attack", {}),
            "cd_as": h.get("cd_as", {}), "crit_mult": h.get("crit_mult", 1.0), "untargetable": h.get("untargetable", {}), "crits": h.get("crits", []),
            "aa_reset": h.get("aa_reset", {}), "cast_s": h.get("cast_s", {}), "attack_hits": h.get("attack_hits", {}), "land": h.get("land", {})}
    out = {"main": base}
    for sid, st in h.get("styles", {}).items():
        out[sid] = {**base, **st}
    return out


def fight(ch, style, st, aug=None):
    """Work out the reference fight; `aug` holds the augment's changes (multipliers, extra casts...). Returns its numbers."""
    aug = aug or {}
    ad = (st["base_ad"] + st["bonus_ad"]) * (1 + st["ad_pct"])
    hp = st["hp"] * (1 + st["hp_pct"])
    crit_dmg = CRIT_DMG + st["crit_dmg"]
    stats = {**st, "ad": ad, "hp_total": hp, "auto_dmg": ad * (1 + min(1, st["crit"] * style["crit_mult"]) * (crit_dmg - 1))}
    resist = {"physical": 100 / (100 + TARGET_RES * max(0.0, 1 - st["pen"] - st["pen_phys"])), "magic": 100 / (100 + TARGET_RES * (1 - st["pen"])), "true": 1.0}

    def value(part):
        v = part.get("base", 0) + sum(part.get(k, 0) * stats.get(k, 0) for k in ("ap", "bonus_ad", "ad", "bonus_hp", "bonus_armor", "bonus_mr", "auto_dmg"))
        v += part.get("self_maxhp", 0) * hp + part.get("target_maxhp", 0) * TARGET_HP
        return v

    # how often each ability is cast by its cooldown alone; a cast takes CAST_S out of the fight, so the time left for basic attacks
    # shrinks with casts
    plan = []
    for ab in ch["abilities"]:
        k = ab["key"]
        if k == "R" and aug.get("no_ult"):
            continue
        cd = None
        if k == "P" or ab["cd"] < TOGGLE_CD:
            n = 1.0
        else:
            haste = st["haste"] + (st["ult_haste"] if k == "R" else st["basic_haste"]) + aug.get("haste_key", {}).get(k, 0)
            haste += sum(v for tag, v in aug.get("haste_tag", {}).items() if tag in ab["tags"])
            cd = ab["cd"] / (1 + haste / 100) * (1 - aug.get("cdr", 0))
            if k in style["cd_as"]:   # a cooldown that attack speed shortens (Yasuo and Yone's Q)
                per, low = style["cd_as"][k]
                cd = max(low, cd * (1 - st["as"] * per))
            n = 1 + (1 - style["resets"]) * FIGHT_S / cd + style["resets"] * RESET_CASTS
            n *= style["use"].get(k, 1.0)   # the share of its casts it really makes in a fight (an auto-attacker holds Jinx's W)
        plan.append([ab, n, cd])
    alone = [row[1] for row in plan]

    def speed(plan):
        """Attack speed, with self-buffs at their uptime (hand `buff`: Master Yi's R gives attack speed for 7 s a cast)."""
        bonus = st["as"]
        for ab, n, cd in plan:
            b = style["buff"].get(ab["key"])
            if b:
                bonus += b.get("as", 0) * min(1.0, n * b["s"] / FIGHT_S)
        return min(AS_CAP, st["base_as"] * (1 + bonus))

    def attacking(plan, a_s):
        """(basic attacks, attacks for 'on attack' effects: basic attacks, each hit of an on-hit ability, and the extra attacks an
        attack-reset ability gives (hand `aa_reset`: Fiora's E, Garen's Q); an ability that only empowers the next attack adds none)"""
        busy = sum(n * style["cast_s"].get(ab["key"], CAST_S) for ab, n, cd in plan if cd is not None and (ab["dmg"] or "控場" in ab["tags"])
                   and ab["key"] not in ch["onhit"])   # a self-buff takes no attack time, and an on-hit ability is an attack itself
        autos = a_s * max(0.0, FIGHT_S - busy) * style["autos"]
        like = sum(n * style["attack_hits"].get(ab["key"], style["onhit_hits"].get(ab["key"], 1)) for ab, n, cd in plan
                   if ab["key"] != "P" and ab["key"] in ch["onhit"])
        like += sum(n * style["aa_reset"].get(ab["key"], 0) for ab, n, cd in plan)
        return autos, autos + like

    # attacks that shorten cooldowns (an ability's own: Master Yi's Q; every one: 祕術拳擊) give more casts, whose hits are attacks
    # again (Master Yi's Q hits four times): worked out until it settles, no ability faster than once every MIN_CYCLE_S
    a_s = speed(plan)
    autos, attacks = attacking(plan, a_s)
    for _ in range(SETTLE_ROUNDS):
        for row, n0 in zip(plan, alone):
            if row[2] is None:
                continue
            cut = style["cd_per_attack"].get(row[0]["key"], 0) + aug.get("cd_per_auto", 0) * (1 - style["resets"])
            if cut:
                row[1] = min(n0 + cut * attacks / max(row[2], 1) * style["use"].get(row[0]["key"], 1.0), FIGHT_S / MIN_CYCLE_S)
        a_s = speed(plan)
        autos, attacks = attacking(plan, a_s)
    casts, dmg_ab, dmg_ult, heal_self, shield_self, support = {}, 0.0, 0.0, 0.0, 0.0, 0.0
    counts = {"auto": autos, "attack": attacks, "onhit": autos, "ability_hit": 0.0, "cast": 0.0, "dash": 0.0, "cc": 0.0, "takedown": TAKEDOWNS, "ult": 0.0,
              "fight": 1.0, "ally": 0.0}
    by_key = {}   # each ability's damage in the fight (for terms on its strongest basic ability)
    for ab, n, cd in plan:
        k = ab["key"]
        casts[k] = n
        d = sum(value(p) * resist[p["type"]] for p in ab["dmg"] + style["extra"].get(k, [])) * n * style["land"].get(k, 1.0)   # what lands (a channel cut short)
        if k in style["crits"]:   # an ability that crits like an attack (Yasuo and Yone's Q)
            d *= 1 + min(1, st["crit"] * style["crit_mult"]) * (CRIT_DMG - 1)
        if k in style["per_hit"]:   # its damage lands on each attack while it lasts (Master Yi's E), not once a cast
            d *= a_s * min(style["per_hit"][k], FIGHT_S / max(n, 1))
        d *= 1 + aug.get("mult", {}).get(k, 0)
        if aug.get("ability_crit") and k != "P":   # abilities that crit (寶石手套)
            d *= 1 + min(1, st["crit"] * style["crit_mult"]) * aug["ability_crit"]
        by_key[k] = d
        if k == "R":
            d *= 1 + aug.get("mult", {}).get("ult", 0)
            dmg_ult += d
            counts["ult"] += n
        dmg_ab += d
        if k != "P":
            counts["cast"] += n
        if ab["dmg"]:
            counts["ability_hit"] += n
        if "位移" in ab["tags"] and k != "P":
            counts["dash"] += n
        if "控場" in ab["tags"] and k != "P":
            counts["cc"] += n
        if k in ch["onhit"]:
            counts["onhit"] += n * style["onhit_hits"].get(k, 1)
        out_heal = sum(value(p) for p in ab["heal"]) * n
        out_shield = sum(value(p) for p in ab["shield"]) * n
        if "隊友增益" in ab["tags"]:
            support += out_heal + out_shield
            counts["ally"] += n
        else:
            heal_self += out_heal
            shield_self += out_shield
    if aug.get("abilities_onhit"):
        counts["onhit"] += counts["ability_hit"]
    counts["onhit"] += aug.get("extra_onhit", 0)
    counts["hit"] = counts["attack"] + counts["ability_hit"]
    auto_hit = stats["auto_dmg"] * resist["physical"]
    onhit_item = (ONHIT_ITEMS[0] + ONHIT_ITEMS[1] * st["ap"]) * resist["magic"] if "攻速" in style["stack"] else 0.0
    dmg_auto = autos * auto_hit * style["auto_mult"] * (1 + aug.get("mult", {}).get("auto", 0)) + counts["onhit"] * onhit_item
    total = (dmg_ab * (1 + aug.get("mult", {}).get("ability", 0)) + dmg_auto) * (1 + aug.get("mult", {}).get("all", 0))
    total += aug.get("extra_dmg", 0)
    basics = {k: v for k, v in by_key.items() if k in ("Q", "W", "E")}
    best_basic = max(basics.values()) if basics else 0.0
    heal_self = heal_self * (1 + st["heal_power"] + st["heal_received"]) + st["omnivamp"] * total + aug.get("extra_heal", 0)
    heal_self += aug.get("heal_from_best", 0) * best_basic   # 虹吸: a share of its strongest ability's damage
    total += aug.get("heal_to_dmg", 0) * heal_self             # 死亡循環: a share of its healing as damage
    shield_self = shield_self * (1 + st["heal_power"] + st["heal_received"]) + aug.get("extra_shield", 0)
    ehp = (hp + heal_self + shield_self) * (1 + (st["armor"] + st["mr"]) / 200) / (1 - min(0.8, st["dr"]))
    away = sum(n * style["untargetable"].get(ab["key"], 0) for ab, n, cd in plan)   # seconds it cannot be hit (Master Yi's Q)
    away += aug.get("away_ult", 0) * counts["ult"]
    ehp /= 1 - min(0.6, away / FIGHT_S)
    support = support * (1 + st["heal_power"] + aug.get("ally_power", 0))
    best_key = max(basics, key=basics.get) if basics else None
    return {"damage": total, "ehp": ehp, "support": support, "counts": counts, "casts": casts, "autos": autos, "stats": stats,
            "auto_hit": auto_hit, "resist": resist, "value": value, "best_key": best_key, "heal": heal_self}


# ---- augments ------------------------------------------------------------------------------------------------------------

def needs_met(aug, ch, st):
    """An augment that needs something the champion lacks (crowd control, shields, mana, an ultimate) is worth nothing to it."""
    for t in aug["terms"]:
        need = t.get("needs")
        if not need:
            continue
        if need == "R" and not any(a["key"] == "R" for a in ch["abilities"]):
            return False
        if need == "mana" and not ch["mana"]:
            return False
        if need not in ("R", "mana") and not any(need in a["tags"] for a in ch["abilities"]):
            return False
    for t in aug["terms"]:   # an ability of a kind no tag names (spinning, terrain, channelling, missiles), found in the ability text
        if "needs_text" in t and not any(a["key"] != "P" and re.search(t["needs_text"], a["desc"]) for a in ch["abilities"]):
            return False
    return True


def apply(aug, ch, style, st0):
    """The augment's terms on the play style: the fight again, and the utility points."""
    st = dict(st0)
    changes = {"mult": {}, "haste_key": {}, "haste_tag": {}}
    util = 0.0
    ranged = st0["range"] >= 300
    plain = fight(ch, style, st0)
    for t in aug["terms"]:
        if "trigger" in t:
            continue   # below, once the fight with the new stats is known
        if "items" in t:   # gold: this share of an item more, in the stats it builds
            for name in style["stack"]:
                if name in STACK_BONUS:
                    k, v = STACK_BONUS[name]
                    st[k] = st.get(k, 0) + v * at_level(t["items"]) / 3
                    if k == "hp":
                        st["bonus_hp"] += v * at_level(t["items"]) / 3
        elif "stat" in t and "from" in t:
            src = {"ap": st0["ap"], "bonus_hp": st0["bonus_hp"], "bonus_ad": st0["bonus_ad"], "as": st0["as"], "crit": st0["crit"]}[t["from"]]
            st[t["stat"]] = st.get(t["stat"], 0) + src * at_level(t["value"])
        elif "stat" in t:
            v = at_level(t.get("ranged", t["value"]) if ranged else t["value"])
            st[t["stat"]] = st.get(t["stat"], 0) + v
            if t["stat"] == "hp":
                st["bonus_hp"] += v
            if t["stat"] in ("armor", "mr"):
                st["bonus_" + t["stat"]] += v
        elif "haste_key" in t:
            changes["haste_key"][t["haste_key"]] = changes["haste_key"].get(t["haste_key"], 0) + t["value"]
        elif "haste_tag" in t:
            changes["haste_tag"][t["haste_tag"]] = t["value"]
        elif "mult" in t:
            key = plain["best_key"] if t["mult"] == "best" else t["mult"]   # "best": its strongest basic ability (the one a player picks)
            if key:
                changes["mult"][key] = changes["mult"].get(key, 0) + at_level(t.get("ranged", t["value"]) if ranged else t["value"]) * t.get("hit", 1.0)
        elif "cd_per_auto" in t:
            changes["cd_per_auto"] = t["cd_per_auto"]
        elif "cdr" in t:
            changes["cdr"] = t["cdr"]
        elif t.get("no_ult"):
            changes["no_ult"] = True
        elif t.get("abilities_onhit"):
            changes["abilities_onhit"] = True
        elif "ability_crit" in t:
            changes["ability_crit"] = t["ability_crit"]
        elif "heal_from_best" in t:
            changes["heal_from_best"] = t["heal_from_best"]
        elif "heal_to_dmg" in t:
            changes["heal_to_dmg"] = t["heal_to_dmg"]
        elif "away_ult" in t:
            changes["away_ult"] = t["away_ult"]
        elif "util" in t:
            util += at_level(t["value"])
    # triggers need the fight with the new stats (their counts and the stats they scale with)
    base = fight(ch, style, st, changes)
    extra = {"extra_dmg": 0.0, "extra_heal": 0.0, "extra_shield": 0.0, "extra_onhit": 0.0, "ally_power": 0.0}
    gained = False
    for t in aug["terms"]:
        if "trigger" not in t:
            continue
        n = base["counts"][t["trigger"]] / t.get("every", 1) * t.get("times", 1)
        if t.get("icd"):
            n = min(n, 1 + FIGHT_S / at_level(t["icd"]))
        if t.get("cap") == "autos":   # an effect on the next attack after a cast: no more than its attacks
            n = min(n, base["autos"])
        for kind in ("dmg", "heal", "shield"):
            if kind in t:
                part = t[kind].get("ranged", t[kind]) if ranged and "ranged" in t[kind] else t[kind]
                part = {k: at_level(v) for k, v in part.items() if k not in ("type", "ranged")} | {"type": t[kind].get("type", "magic")}
                v = base["value"](part) * n
                if kind == "dmg":
                    v *= base["resist"][part["type"]] * t.get("hit", 1.0)   # a delayed or dodgeable hit lands this share of the time
                else:
                    v *= t.get("hit", 1.0)
                extra["extra_" + kind] += v
        if "stat" in t:   # stats each trigger gives, up to `max` at once (俠盜恆毅)
            for k, v in t["stat"].items():
                st[k] = st.get(k, 0) + at_level(v) * min(n, t.get("max", n))
            gained = True
        if "onhit" in t:
            extra["extra_onhit"] += t["onhit"] * n
        if "util" in t:
            util += at_level(t["util"]) * n
    for t in aug["terms"]:
        if "ally_power" in t:
            extra["ally_power"] += t["ally_power"]
    return fight(ch, style, st, {**changes, **extra}), util


def weights(dd, ch, style):
    info = {**dd["info"], **style.get("ratings", {})}   # a play style may rate itself otherwise (AP Malphite: more magic, less defense)
    off, dfn = max(info["attack"], info["magic"]) ** 2, info["defense"] ** 2   # squared: the side a champion is built for counts most
    sup = SUPPORT_SHARE ** 2 if ch["support"] else 0.0
    util = UTIL_SHARE ** 2
    total = off + dfn + sup + util
    return {"damage": off / total, "survival": dfn / total, "support": sup / total, "utility": util / total}


def main():
    patch_file = next((ROOT / vault_paths.CHAMPIONS).glob("*.md"))
    version = frontmatter(patch_file).get("patch", "")
    listing = fetch_data.fetch(f"{fetch_data.DD}/cdn/{version}/data/{fetch_data.LOCALE}/champion.json", f"{version}/champion.json")["data"]
    hand = json.loads(CHAMPION_HAND.read_text(encoding="utf-8")) if CHAMPION_HAND.exists() else {}
    augs = [json.loads(line) for line in AUGMENT_MODEL.read_text(encoding="utf-8").splitlines() if line.strip().startswith("{")]
    for a in augs:
        a.setdefault("terms", [])
    fits = json.loads((ROOT / "_data" / "augment-data.json").read_text(encoding="utf-8"))["augments"]

    notes = []
    for path in sorted((ROOT / vault_paths.CHAMPIONS).glob("*.md")):
        note = frontmatter(path)
        if note.get("id") in listing:
            notes.append(note)
    rarity = {}
    for path in (ROOT / vault_paths.AUGMENTS).glob("*.md"):
        fm = frontmatter(path)
        if str(fm.get("id", "")).isdigit():
            rarity[int(fm["id"])] = fm.get("rarity", "")
    group = {a["id"]: "五殺" if a["id"] in PENTAKILL else rarity.get(a["id"], "") for a in augs}

    by_level = {}   # level -> (champs, {(cid, sid): {aug id: (value, amount, parts)}})
    for level in LEVELS:
        set_level(level)
        champs = {}
        for note in notes:
            cid = note["id"]
            abil = abilities(note)
            ch = {"id": cid, "name": note.get("name", cid), "abilities": abil, "onhit": note.get("onhit", []), "mana": note.get("resource") == "魔力",
                  "support": "輔助" in note.get("roles", []) and any("隊友增益" in a["tags"] and (a["heal"] or a["shield"]) for a in abil)}
            ch["styles"] = {}
            for sid, style in play_styles(cid, note, listing[cid], hand).items():
                st = ref_stats(listing[cid], style["stack"])
                f = fight(ch, style, st)
                ch["styles"][sid] = {"style": style, "weights": weights(listing[cid], ch, style), "stats": st, "damage": round(f["damage"]), "ehp": round(f["ehp"]),
                                     "support": round(f["support"]), "counts": {k: round(v, 2) for k, v in f["counts"].items()},
                                     "casts": {k: round(v, 2) for k, v in f["casts"].items()}}
            champs[cid] = ch

        # every play style's fight without an augment; their medians are the yardstick for comparing champions in absolute terms
        bases = {(cid, sid): fight(ch, s["style"], s["stats"]) for cid, ch in champs.items() for sid, s in ch["styles"].items()}
        median = {k: sorted(b[k] for b in bases.values())[len(bases) // 2] or 1.0 for k in ("damage", "ehp")}
        healers = sorted(b["support"] for b in bases.values() if b["support"])
        median["support"] = healers[len(healers) // 2] if healers else 1.0

        # every modelled augment on every play style: `value` (the gain as a share of its own fight: ranks augments within the champion)
        # and `amount` (the gain against the median champion: ranks champions for an augment, so a small base does not look like a big gain)
        values = {}
        for cid, ch in champs.items():
            for sid, s in ch["styles"].items():
                style, st = s["style"], s["stats"]
                base = bases[(cid, sid)]
                ranged = st["range"] >= 300
                for a in augs:
                    if a.get("special") or not needs_met(a, ch, st):
                        continue
                    only = next((t["only"] for t in a["terms"] if "only" in t), None)
                    if only and (only == "ranged") != ranged:
                        continue
                    f = fits.get(str(a["id"]), {}).get("fits")
                    if f and cid.lower() not in f:
                        continue
                    after, util = apply(a, ch, style, st)
                    parts = {
                        "damage": (after["damage"] - base["damage"]) / max(base["damage"], 1),
                        "survival": (after["ehp"] - base["ehp"]) / max(base["ehp"], 1),
                        "support": (after["support"] - base["support"]) / max(base["support"], 1) if base["support"] else 0.0,
                        "utility": util * UTIL_POINT,
                    }
                    w = s["weights"]
                    v = sum(w[k] * parts[k] for k in parts)
                    amount = (w["damage"] * (after["damage"] - base["damage"]) / median["damage"]
                              + w["survival"] * (after["ehp"] - base["ehp"]) / median["ehp"]
                              + w["support"] * (after["support"] - base["support"]) / median["support"]
                              + w["utility"] * parts["utility"])
                    values.setdefault((cid, sid), {})[a["id"]] = (v, amount, parts)
        by_level[level] = (champs, values)

    # an augment's value at a pick: its average from that level on; its overall value: the average over the four picks
    def at_pick(key, aid, pick, i):
        got = [(LEVEL_WEIGHT[lv], by_level[lv][1].get(key, {}).get(aid)) for lv in LEVELS if lv >= pick]
        got = [(w, g) for w, g in got if g]
        return sum(w * g[i] for w, g in got) / sum(w for w, g in got) if got else 0.0

    champs = by_level[SHOWN][0]
    set_level(SHOWN)
    values = {}   # (cid, sid) -> {aug id: (value, amount, reason part, its gain, value at each pick)}
    for key in by_level[SHOWN][1]:
        ids = {aid for lv in LEVELS for aid in by_level[lv][1].get(key, {})}
        for aid in ids:
            when = OWN_PICKS.get(aid, PICKS)
            v = sum(at_pick(key, aid, p, 0) for p in when) / len(when)
            amount = sum(at_pick(key, aid, p, 1) for p in when) / len(when)
            picks = [at_pick(key, aid, p, 1) for p in PICKS]   # the gain against the median champion at each pick: early or late
            w = champs[key[0]]["styles"][key[1]]["weights"]
            parts = {k: sum(by_level[lv][1][key][aid][2][k] for lv in LEVELS if aid in by_level[lv][1].get(key, {})) / len(LEVELS) for k in w}
            top = max(parts, key=lambda k: abs(w[k] * parts[k]))
            values.setdefault(key, {})[aid] = (v, amount, top, parts[top], picks)

    # tiers: rank within the play style and across all play styles
    across = {}
    for key, vals in values.items():
        for aid, (v, amount, _, _, _) in vals.items():
            across.setdefault(aid, []).append(amount)
    top_user = {}   # the augment's best users' gain (90th percentile, so one outlier does not set the bar)
    for aid in across:
        across[aid].sort()
        top_user[aid] = across[aid][int(0.9 * (len(across[aid]) - 1))] or 1.0
    WORD = {"damage": "輸出", "survival": "生存", "support": "輔助", "utility": "機動"}
    tiers = {}
    for (cid, sid), vals in values.items():
        good = sorted(((v, aid) for aid, (v, _, _, _, _) in vals.items() if v > 0), reverse=True)
        rows = []
        best = {}   # the play style's best augment of each rarity: the three offers on a screen share one, so that is the competition
        for v, aid in good:
            best.setdefault(group[aid], v)
        for v, aid in good:
            within = v / best[group[aid]]   # how close it comes to the play style's best augment of its rarity (half as good: 0.5)
            acr = max(0.0, min(1.0, vals[aid][1] / top_user[aid]))   # how close it comes to the augment's best users
            score = math.sqrt(within * acr)   # both: one of its best augments, and one of the augment's best users
            tier = next(t for t, cut in TIERS if score >= cut)
            _, _, top, part, picks = vals[aid]
            when = "前期強" if picks[0] > EARLY_LATE * max(picks[-1], 1e-9) else "後期強" if picks[-1] > EARLY_LATE * max(picks[0], 1e-9) else ""
            rows.append({"id": aid, "group": group[aid], "tier": tier, "value": round(v, 4), "score": round(score, 3),
                         "picks": [round(x, 4) for x in picks], "when": when, "reason": f"{WORD[top]} {part * 100:+.0f}%"})
        bad = [{"id": aid, "value": round(v, 4)} for aid, (v, _, _, _, _) in vals.items() if v <= 0]
        tiers.setdefault(cid, {})[sid] = {"name": champs[cid]["styles"][sid]["style"]["name"], "tiers": rows, "none": bad}

    OUT_MODEL.write_text(json.dumps({"level": SHOWN, "fight_s": FIGHT_S, "patch": version,
                                     "champions": {cid: {"styles": {sid: {k: v for k, v in s.items() if k not in ("stats", "weights")}
                                                                    | {"weights": {k: round(x, 3) for k, x in s["weights"].items()}, "stats": {k: round(x, 2) for k, x in s["stats"].items()}}
                                                                    for sid, s in ch["styles"].items()}}
                                                   for cid, ch in champs.items()}}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    OUT_TIERS.write_text(json.dumps({"picks": PICKS, "levels": LEVELS, "patch": version, "augments": len(augs), "champions": tiers}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    review(champs, tiers, {a["id"]: a for a in augs})
    print(f"{len(champs)} champions, {len(augs)} augments modelled -> {OUT_TIERS.relative_to(ROOT)}, {OUT_REVIEW.relative_to(ROOT)}")


def review(champs, tiers, augs):
    """Review/Augment Tiers.md: the test champions' tiers and what the fight looks like for them."""
    out = ["---", "title: Morellonomicon - Augment Tiers (review)", "tags:", "  - review", "  - augments", "sticker: lucide//list-ordered", "---",
           f"Written by `tools/augment_model.py` (do not edit): the test champions' augment tiers from the model in [[Augment Model]], {len(augs)} augments modelled so far. "
           f"Tiers are per rarity (the three offers on a screen share one) and the 五殺 set apart; an augment's value is its average over the picks at {', '.join(map(str, PICKS))}. "
           f"The fight line shows what the model thinks the champion does in an 8 s fight at level {SHOWN}.", ""]
    for cid in TEST:
        if cid not in champs:
            continue
        ch = champs[cid]
        for sid, s in ch["styles"].items():
            t = tiers[cid][sid]
            c = s["counts"]
            w = s["weights"]
            out += [f"## {ch['name']} · {s['style']['name']}", "",
                    f"Fight: {s['damage']} damage, {s['ehp']} effective health" + (f", {s['support']} healing / shields for allies" if s["support"] else "")
                    + f"; {c['auto']:.1f} attacks, {c['cast']:.1f} casts, {c['dash']:.1f} dashes, {c['cc']:.1f} crowd control, {c['onhit']:.1f} on-hit. "
                    f"Weights: damage {w['damage']:.2f} · survival {w['survival']:.2f} · support {w['support']:.2f} · utility {w['utility']:.2f}.", "",
                    "| Rarity | Tier | Augment | Value | Reason |", "| --- | --- | --- | --- | --- |"]
            order = {"稜鏡": 0, "金": 1, "銀": 2, "五殺": 3}
            for r in sorted(t["tiers"], key=lambda r: (order.get(r["group"], 4), -r["score"])):
                out.append(f"| {r['group']} | {r['tier']} | [[{augs[r['id']]['name']}]] | {r['value'] * 100:.1f} | {r['reason']}{' · ' + r['when'] if r['when'] else ''} |")
            if t["none"]:
                out.append(f"| | — | " + "、".join(f"[[{augs[r['id']]['name']}]]" for r in t["none"]) + " | ≤ 0 | no gain |")
            out.append("")
    OUT_REVIEW.write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    main()
