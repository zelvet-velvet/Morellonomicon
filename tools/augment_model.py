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

LEVEL = 13                 # the champion's level in the reference fight
BASIC_RANK, ULT_RANK = 4, 2
FIGHT_S = 8.0              # seconds of a team fight
RESET_CASTS = 2.0          # casts a full-reset champion gets from takedowns in a fight
TAKEDOWNS = 1.5            # takedowns a champion takes part in per fight
TARGET_HP, TARGET_RES = 2500.0, 80.0   # the enemy hit: health, armor and magic resist
BASE_BONUS = {"hp": 400.0, "haste": 10.0}   # runes and boots, for everyone
STACK_BONUS = {"法術強度": ("ap", 250.0), "攻擊力": ("bonus_ad", 120.0), "攻速": ("as", 0.6), "暴擊": ("crit", 0.5), "生命": ("hp", 1200.0),
               "護甲": ("armor", 80.0), "魔防": ("mr", 80.0), "技能急速": ("haste", 40.0), "跑速": ("ms", 40.0), "穿透": ("pen", 0.18)}
AUTOS = {"射手": 0.85, "melee": 0.6, "other": 0.3}   # share of the fight spent attacking, by default
CRIT_DMG = 1.75
AS_CAP = 2.5
ONHIT_ITEMS = (40.0, 0.15)  # an on-hit build's item damage per hit: base, AP ratio (Nashor's, Wit's End...)
UTIL_SHARE = 1.5            # utility's weight next to Riot's 1-10 ratings (squared, like them)
SUPPORT_SHARE = 9.0         # the weight of healing / shielding allies, for champions that do (as a rating, squared)
TOGGLE_CD = 2.0             # an ability with a shorter cooldown is a toggle or a stance (Jinx Q): one cast, haste does nothing
CAST_S = 0.4                # seconds a cast takes out of attacking (so more casts cost an auto-attacker some attacks)
UTIL_POINT = 0.1            # one utility point (a dash, +10% speed...) counts as a 10% gain
TIERS = [("S", 0.8), ("A", 0.6), ("B", 0.4), ("C", -1.0)]
WITHIN, ACROSS = 0.6, 0.4
TEST = ["Katarina", "Jinx", "Ezreal", "Malphite", "Soraka", "Darius", "MasterYi", "Lux", "Kaisa", "Garen", "Fiora"]

ROW_TYPE = {"物理傷害": "physical", "魔法傷害": "magic", "真實傷害": "true"}
SCALE = {"魔法攻擊": "ap", "額外物理攻擊": "bonus_ad", "物理攻擊": "ad"}


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
            i = (ULT_RANK if key == "R" else BASIC_RANK) - 1
        ab = {"key": key, "tags": s.get("tags", []), "cd": 0.0, "dmg": [], "heal": [], "shield": []}
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
            bonus[k] = bonus.get(k, 0) + v
    return {
        "hp": growth(st["hp"], st["hpperlevel"]) + bonus.get("hp", 0), "bonus_hp": bonus.get("hp", 0),
        "base_ad": growth(st["attackdamage"], st["attackdamageperlevel"]), "bonus_ad": bonus.get("bonus_ad", 0),
        "ap": bonus.get("ap", 0), "base_as": st["attackspeed"], "as": st["attackspeedperlevel"] / 100 * (LEVEL - 1) * (0.7025 + 0.0175 * (LEVEL - 1)) + bonus.get("as", 0),
        "crit": bonus.get("crit", 0), "haste": bonus.get("haste", 0), "ult_haste": 0.0, "basic_haste": 0.0,
        "armor": growth(st["armor"], st["armorperlevel"]) + bonus.get("armor", 0), "mr": growth(st["spellblock"], st["spellblockperlevel"]) + bonus.get("mr", 0),
        "ms": st["movespeed"] + bonus.get("ms", 0), "pen": bonus.get("pen", 0), "omnivamp": 0.0, "heal_power": 0.0, "heal_received": 0.0,
        "ad_pct": 0.0, "hp_pct": 0.0, "ms_pct": 0.0, "range": st["attackrange"],
    }


def play_styles(cid, note, dd, hand):
    """The champion's play styles: the default one from its notes, and any the hand file adds."""
    h = hand.get(cid, {})
    melee = dd["stats"]["attackrange"] < 300
    roles = note.get("roles", [])
    default_autos = AUTOS["射手"] if "射手" in roles else AUTOS["melee"] if melee and ({"戰士", "坦克"} & set(roles)) else AUTOS["other"]
    base = {"name": "主流", "stack": note.get("stack", []), "autos": h.get("autos", default_autos), "resets": h.get("resets", 0.0),
            "onhit_hits": h.get("onhit_hits", {}), "use": h.get("use", {}), "extra": h.get("extra", {}), "auto_mult": h.get("auto_mult", 1.0),
            "buff": h.get("buff", {}), "per_hit": h.get("per_hit", {}), "cd_per_attack": h.get("cd_per_attack", {})}
    out = {"main": base}
    for sid, st in h.get("styles", {}).items():
        out[sid] = {**base, **st}
    return out


def fight(ch, style, st, aug=None):
    """Work out the reference fight; `aug` holds the augment's changes (multipliers, extra casts...). Returns its numbers."""
    aug = aug or {}
    ad = (st["base_ad"] + st["bonus_ad"]) * (1 + st["ad_pct"])
    hp = st["hp"] * (1 + st["hp_pct"])
    stats = {**st, "ad": ad, "hp_total": hp}
    resist = {"physical": 100 / (100 + TARGET_RES * (1 - st["pen"])), "magic": 100 / (100 + TARGET_RES * (1 - st["pen"])), "true": 1.0}

    def value(part):
        v = part.get("base", 0) + sum(part.get(k, 0) * stats.get(k, 0) for k in ("ap", "bonus_ad", "ad", "bonus_hp"))
        v += part.get("self_maxhp", 0) * hp + part.get("target_maxhp", 0) * TARGET_HP
        return v

    # how often each ability is cast; a cast takes CAST_S out of the fight, so the time left for basic attacks shrinks with casts
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
            n = 1 + (1 - style["resets"]) * FIGHT_S / cd + style["resets"] * RESET_CASTS
            n *= style["use"].get(k, 1.0)   # the share of its casts it really makes in a fight (an auto-attacker holds Jinx's W)
        plan.append([ab, n, cd])

    # attack speed, with self-buffs at their uptime (hand `buff`: Master Yi's R gives attack speed for 7 s a cast)
    bonus_as = st["as"]
    for ab, n, cd in plan:
        b = style["buff"].get(ab["key"])
        if b:
            bonus_as += b.get("as", 0) * min(1.0, n * b["s"] / FIGHT_S)
    a_s = min(AS_CAP, st["base_as"] * (1 + bonus_as))

    def attacking(plan):
        """(basic attacks, attacks that count for 'on attack' effects: basic attacks, on-hit and empowered-attack abilities)"""
        busy = sum(n * CAST_S for ab, n, cd in plan if cd is not None and (ab["dmg"] or "控場" in ab["tags"]))   # a self-buff takes no attack time
        autos = a_s * max(0.0, FIGHT_S - busy) * style["autos"]
        like = sum(n for ab, n, cd in plan if ab["key"] != "P" and (ab["key"] in ch["onhit"] or "強化普攻" in ab["tags"]))
        return autos, autos + like

    autos, attacks = attacking(plan)
    for row in plan:   # an ability whose own cooldown each attack shortens (hand `cd_per_attack`: Master Yi's Q)
        own = style["cd_per_attack"].get(row[0]["key"], 0)
        if own and row[2] is not None:
            row[1] += own * attacks / max(row[2], 1)
    if aug.get("cd_per_auto"):   # each attack takes seconds off every cooldown (祕術拳擊): more casts, which cost attack time
        for row in plan:
            if row[2] is not None:
                row[1] += aug["cd_per_auto"] * attacks / max(row[2], 1) * (1 - style["resets"]) * style["use"].get(row[0]["key"], 1.0)
        autos, attacks = attacking(plan)
    casts, dmg_ab, dmg_ult, heal_self, shield_self, support = {}, 0.0, 0.0, 0.0, 0.0, 0.0
    counts = {"auto": autos, "attack": attacks, "onhit": autos, "ability_hit": 0.0, "cast": 0.0, "dash": 0.0, "cc": 0.0, "takedown": TAKEDOWNS, "ult": 0.0}
    for ab, n, cd in plan:
        k = ab["key"]
        casts[k] = n
        d = sum(value(p) * resist[p["type"]] for p in ab["dmg"] + style["extra"].get(k, [])) * n
        if k in style["per_hit"]:   # its damage lands on each attack while it lasts (Master Yi's E), not once a cast
            d *= a_s * min(style["per_hit"][k], FIGHT_S / max(n, 1))
        d *= 1 + aug.get("mult", {}).get(k, 0)
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
        else:
            heal_self += out_heal
            shield_self += out_shield
    if aug.get("abilities_onhit"):
        counts["onhit"] += counts["ability_hit"]
    counts["onhit"] += aug.get("extra_onhit", 0)
    auto_hit = ad * (1 + min(1, st["crit"]) * (CRIT_DMG - 1)) * resist["physical"]
    onhit_item = (ONHIT_ITEMS[0] + ONHIT_ITEMS[1] * st["ap"]) * resist["magic"] if "攻速" in style["stack"] else 0.0
    dmg_auto = autos * auto_hit * style["auto_mult"] * (1 + aug.get("mult", {}).get("auto", 0)) + counts["onhit"] * onhit_item
    total = (dmg_ab * (1 + aug.get("mult", {}).get("ability", 0)) + dmg_auto) * (1 + aug.get("mult", {}).get("all", 0))
    total += aug.get("extra_dmg", 0)
    heal_self = heal_self * (1 + st["heal_power"] + st["heal_received"]) + st["omnivamp"] * total + aug.get("extra_heal", 0)
    shield_self = shield_self * (1 + st["heal_power"] + st["heal_received"]) + aug.get("extra_shield", 0)
    ehp = (hp + heal_self + shield_self) * (1 + (st["armor"] + st["mr"]) / 200)
    support = support * (1 + st["heal_power"] + aug.get("ally_power", 0))
    return {"damage": total, "ehp": ehp, "support": support, "counts": counts, "casts": casts, "autos": autos, "stats": stats,
            "auto_hit": auto_hit, "resist": resist, "value": value}


# ---- augments ------------------------------------------------------------------------------------------------------------

def apply(aug, ch, style, st0):
    """The augment's terms on the play style: the fight again, and the utility points."""
    st = dict(st0)
    changes = {"mult": {}, "haste_key": {}, "haste_tag": {}}
    util = 0.0
    for t in aug["terms"]:
        if "trigger" in t:
            continue   # below, once the fight with the new stats is known
        if "stat" in t and "from" in t:
            src = {"ap": st["ap"], "bonus_hp": st["bonus_hp"], "bonus_ad": st["bonus_ad"]}[t["from"]]
            st[t["stat"]] = st.get(t["stat"], 0) + src * at_level(t["value"])
        elif "stat" in t:
            st[t["stat"]] = st.get(t["stat"], 0) + at_level(t["value"])
            if t["stat"] == "hp":
                st["bonus_hp"] += at_level(t["value"])
        elif "haste_key" in t:
            changes["haste_key"][t["haste_key"]] = changes["haste_key"].get(t["haste_key"], 0) + t["value"]
        elif "haste_tag" in t:
            changes["haste_tag"][t["haste_tag"]] = t["value"]
        elif "mult" in t:
            ranged = st0["range"] >= 300
            changes["mult"][t["mult"]] = changes["mult"].get(t["mult"], 0) + at_level(t.get("ranged", t["value"]) if ranged else t["value"])
        elif "cd_per_auto" in t:
            changes["cd_per_auto"] = t["cd_per_auto"]
        elif "cdr" in t:
            changes["cdr"] = t["cdr"]
        elif t.get("no_ult"):
            changes["no_ult"] = True
        elif t.get("abilities_onhit"):
            changes["abilities_onhit"] = True
        elif "util" in t:
            util += at_level(t["value"])
    # triggers need the fight with the new stats (their counts and the stats they scale with)
    base = fight(ch, style, st, changes)
    extra = {"extra_dmg": 0.0, "extra_heal": 0.0, "extra_shield": 0.0, "extra_onhit": 0.0, "ally_power": 0.0}
    ranged = st0["range"] >= 300
    for t in aug["terms"]:
        if "trigger" not in t:
            continue
        n = base["counts"][t["trigger"]] / t.get("every", 1)
        if t.get("icd"):
            n = min(n, 1 + FIGHT_S / at_level(t["icd"]))
        for kind in ("dmg", "heal", "shield"):
            if kind in t:
                part = t[kind].get("ranged", t[kind]) if ranged and "ranged" in t[kind] else t[kind]
                part = {k: at_level(v) for k, v in part.items() if k != "type"} | {"type": t[kind].get("type", "magic")}
                v = base["value"](part) * n
                if kind == "dmg":
                    v *= base["resist"][part["type"]]
                extra["extra_" + kind] += v
        if "onhit" in t:
            extra["extra_onhit"] += t["onhit"] * n
        if "util" in t:
            util += at_level(t["util"]) * n
    for t in aug["terms"]:
        if "ally_power" in t:
            extra["ally_power"] += t["ally_power"]
    return fight(ch, style, st, {**changes, **extra}), util


def weights(dd, ch):
    info = dd["info"]
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
    fits = json.loads((ROOT / "_data" / "augment-data.json").read_text(encoding="utf-8"))["augments"]

    champs = {}
    for path in sorted((ROOT / vault_paths.CHAMPIONS).glob("*.md")):
        note = frontmatter(path)
        cid = note.get("id")
        if not cid or cid not in listing:
            continue
        abil = abilities(note)
        ch = {"id": cid, "name": note.get("name", cid), "abilities": abil, "onhit": note.get("onhit", []),
              "support": "輔助" in note.get("roles", []) and any("隊友增益" in a["tags"] and (a["heal"] or a["shield"]) for a in abil)}
        ch["weights"] = weights(listing[cid], ch)
        ch["styles"] = {}
        for sid, style in play_styles(cid, note, listing[cid], hand).items():
            st = ref_stats(listing[cid], style["stack"])
            f = fight(ch, style, st)
            ch["styles"][sid] = {"style": style, "stats": st, "damage": round(f["damage"]), "ehp": round(f["ehp"]), "support": round(f["support"]),
                                 "counts": {k: round(v, 2) for k, v in f["counts"].items()}, "casts": {k: round(v, 2) for k, v in f["casts"].items()}}
        champs[cid] = ch

    # every modelled augment on every play style
    values = {}   # (cid, sid) -> {aug id: (value, reason)}
    for cid, ch in champs.items():
        for sid, s in ch["styles"].items():
            style, st = s["style"], s["stats"]
            base = fight(ch, style, st)
            ranged = st["range"] >= 300
            for a in augs:
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
                v = sum(ch["weights"][k] * parts[k] for k in parts)
                top = max(parts, key=lambda k: abs(ch["weights"][k] * parts[k]))
                values.setdefault((cid, sid), {})[a["id"]] = (v, top, parts[top])

    # tiers: rank within the play style and across all play styles
    across = {}
    for key, vals in values.items():
        for aid, (v, _, _) in vals.items():
            across.setdefault(aid, []).append(v)
    for aid in across:
        across[aid].sort()
    WORD = {"damage": "輸出", "survival": "生存", "support": "輔助", "utility": "機動"}
    tiers = {}
    for (cid, sid), vals in values.items():
        good = sorted(((v, aid) for aid, (v, _, _) in vals.items() if v > 0), reverse=True)
        rows = []
        for rank, (v, aid) in enumerate(good):
            within = 1 - rank / max(1, len(good) - 1) if len(good) > 1 else 1.0
            pool = across[aid]
            acr = sum(1 for x in pool if x < v) / max(1, len(pool) - 1)
            score = WITHIN * within + ACROSS * acr
            tier = next(t for t, cut in TIERS if score >= cut)
            _, top, part = vals[aid]
            rows.append({"id": aid, "tier": tier, "value": round(v, 4), "score": round(score, 3), "reason": f"{WORD[top]} {part * 100:+.0f}%"})
        bad = [{"id": aid, "value": round(v, 4)} for aid, (v, _, _) in vals.items() if v <= 0]
        tiers.setdefault(cid, {})[sid] = {"name": champs[cid]["styles"][sid]["style"]["name"], "tiers": rows, "none": bad}

    OUT_MODEL.write_text(json.dumps({"level": LEVEL, "fight_s": FIGHT_S, "patch": version,
                                     "champions": {cid: {"weights": {k: round(v, 3) for k, v in ch["weights"].items()},
                                                         "styles": {sid: {k: v for k, v in s.items() if k != "stats"} | {"stats": {k: round(x, 2) for k, x in s["stats"].items()}}
                                                                    for sid, s in ch["styles"].items()}}
                                                   for cid, ch in champs.items()}}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    OUT_TIERS.write_text(json.dumps({"level": LEVEL, "patch": version, "augments": len(augs), "champions": tiers}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    review(champs, tiers, {a["id"]: a for a in augs})
    print(f"{len(champs)} champions, {len(augs)} augments modelled -> {OUT_TIERS.relative_to(ROOT)}, {OUT_REVIEW.relative_to(ROOT)}")


def review(champs, tiers, augs):
    """Review/Augment Tiers.md: the test champions' tiers and what the fight looks like for them."""
    out = ["---", "title: Morellonomicon - Augment Tiers (review)", "tags:", "  - review", "  - augments", "sticker: lucide//list-ordered", "---",
           f"Written by `tools/augment_model.py` (do not edit): the test champions' augment tiers from the model in [[Augment Model]], {len(augs)} augments modelled so far. "
           "The fight line shows what the model thinks the champion does in an 8 s fight at level 13.", ""]
    for cid in TEST:
        if cid not in champs:
            continue
        ch = champs[cid]
        for sid, s in ch["styles"].items():
            t = tiers[cid][sid]
            c = s["counts"]
            w = ch["weights"]
            out += [f"## {ch['name']} · {s['style']['name']}", "",
                    f"Fight: {s['damage']} damage, {s['ehp']} effective health" + (f", {s['support']} healing / shields for allies" if s["support"] else "")
                    + f"; {c['auto']:.1f} attacks, {c['cast']:.1f} casts, {c['dash']:.1f} dashes, {c['cc']:.1f} crowd control, {c['onhit']:.1f} on-hit. "
                    f"Weights: damage {w['damage']:.2f} · survival {w['survival']:.2f} · support {w['support']:.2f} · utility {w['utility']:.2f}.", "",
                    "| Tier | Augment | Value | Reason |", "| --- | --- | --- | --- |"]
            for r in sorted(t["tiers"], key=lambda r: -r["score"]):
                out.append(f"| {r['tier']} | [[{augs[r['id']]['name']}]] | {r['value'] * 100:.1f} | {r['reason']} |")
            if t["none"]:
                out.append(f"| — | " + "、".join(f"[[{augs[r['id']]['name']}]]" for r in t["none"]) + " | ≤ 0 | no gain |")
            out.append("")
    OUT_REVIEW.write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    main()
