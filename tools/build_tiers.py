"""A main build and alternative items for every champion in ARAM Mayhem: why the item works for the champion, checked against games.

Like tools/augment_tiers.py, per champion and play style:
- Reasoning: every finished item has the kinds of champion it is made for (KINDS: crit, on-hit, lethality, bruiser, tank, mage,
  battle mage, enchanter, support) and a line saying what it does; a play style wants some kinds (WANTS, from the champion note
  read by augment_tiers.Champ, or the hand styles in STYLES). Conditions (fit) read the kit: mana for the 魔力之流 items, melee for
  the hydras, an ultimate that matters for 惡意, heals or shields on allies for the enchanter items. Fit -2 (not this style's item)
  to +2, with the reason the page shows.
- Evidence: resg.top's games for the patch (tools/fetch_resg.py, cached in the git-ignored .cache/resg/; no number is written out):
  the item's win rate on the champion against the champion's own, pulled toward the item's result on every champion when the games
  are few, plus how often the champion builds it.

The main build is the best five items with a reason (one per unique passive: 命脈, 魔法彎刀, 魔力之流, 劈砍...), in the order players
buy them (resg's most common first items), and the best boots; then up to four alternatives, with when to buy the situational ones
(重創, 中婭沙漏...). Items the games call strong but no rule explains, and picks the games disagree with, are listed in
Review/Build Questions.md.

Writes _data/item-builds.json (read by the plugin), Review/Build Review.md and Review/Build Questions.md. Standard library.

    python3 -I tools/build_tiers.py
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import vault_paths  # noqa: E402
from augment_tiers import Champ, STYLES as AUG_STYLES, frontmatter, latest_cache  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_data" / "item-builds.json"
OUT_REVIEW = ROOT / "Review" / "Build Review.md"
OUT_QUESTIONS = ROOT / "Review" / "Build Questions.md"
DDRAGON = ROOT / ".cache" / "ddragon"

PRIOR_GAMES = 3000     # games the prior counts as: an item seen in fewer games on a champion leans on its result everywhere
FIT_PRIOR = 0.005      # each fit point moves the prior half a point
FIT_SCORE = 0.03       # and the score 3 points more: the reasoning decides, the games order what it allows
POP = 0.04             # how often the champion builds it (0-1) adds up to 4 points: the main build is also what people build
UNSEEN = -0.03         # an item not in the champion's 50 most built: hardly anyone builds it (never in the main build)
MAIN = 5
ALTS = 4
SURE_GAMES = 5000
SPECIFIC = 0.04
TEST = ["Varus", "Katarina", "Udyr", "Jinx", "Annie", "Malphite", "Soraka", "Darius", "Ezreal", "Yasuo", "Kaisa", "Lux", "Garen",
        "MasterYi", "TwistedFate"]

# ---- what each item is for -------------------------------------------------------------------------------------------------------
# kinds: CRIT (crit attackers), OHAD / OHAP (on-hit attackers, physical / magic), LETH (physical burst with abilities), BRU (melee
# fighters), TANK, SUP (support auras), MAGE (burst mages), MHP (mages who fight long: health, burns), ENCH (heal / shield allies)
KINDS = {
    3031: ("CRIT", "暴擊傷害更高，暴擊流的核心"),
    3085: ("CRIT OHAD", "普攻多射兩支分裂箭，特效打到附近的敵人"),
    3036: ("CRIT", "穿甲，對生命高的坦克傷害更高"),
    6676: ("CRIT LETH", "斬殺殘血，擊殺多拿錢"),
    3032: ("CRIT OHAD", "攻速和暴擊越打越高"),
    3046: ("CRIT", "攻速、暴擊加鬼步，邊走邊打"),
    2523: ("CRIT", "站得越遠普攻越痛，擊殺後射程更遠"),
    3094: ("CRIT", "充能普攻射程更遠"),
    3095: ("CRIT", "充能普攻加跑速，打完就走"),
    6675: ("CRIT", "普攻減少基礎技能冷卻"),
    2512: ("CRIT", "大絕冷卻更短，放大後三下普攻更痛"),
    3033: ("CRIT LETH", "重創，減少敵方回血"),
    6673: ("CRIT", "快死時得到護盾"),
    3072: ("CRIT OHAD", "普攻吸血，滿血時溢出變護盾"),
    3508: ("CRIT LETH", "放技能後的普攻加傷害並回魔"),
    3153: ("OHAD BRU", "依目標目前生命加傷害，打坦克"),
    6672: ("OHAD", "每三下普攻加傷害，目標越殘越痛"),
    3302: ("OHAD OHAP", "普攻帶法傷，交替加穿透或雙抗"),
    3124: ("OHAD OHAP", "攻速越打越快，滿層多觸發一次特效"),
    3087: ("OHAD OHAP", "充能普攻的閃電把特效傳給附近敵人"),
    3091: ("OHAD OHAP", "魔防加韌性，普攻帶法傷"),
    3115: ("OHAP", "攻速加法術強度，普攻帶法傷"),
    2510: ("OHAP MHP", "放技能後的普攻多一次特效並回血"),
    6697: ("LETH", "穿甲，擊殺後攻擊力更高"),
    4004: ("LETH", "穿甲，主動回到標記的位置：切入後撤退"),
    3142: ("LETH", "穿甲加跑速，追擊或拉開距離"),
    6694: ("LETH BRU", "穿甲，技能打到半血以下的敵人會緩速"),
    6695: ("LETH", "穿甲，打掉敵方的護盾"),
    6696: ("LETH", "穿甲，擊殺後大絕冷卻返還"),
    3814: ("LETH", "穿甲，擋下一個敵方技能"),
    3179: ("LETH", "穿甲，繞過去的第一下普攻加真實傷害"),
    6699: ("LETH BRU", "技能觸發充能普攻，依目標目前生命加傷害"),
    3004: ("LETH BRU", "疊滿魔力後攻擊力更高"),
    6692: ("LETH BRU", "兩下普攻或技能命中就得到護盾"),
    2517: ("LETH BRU", "攻擊力轉成技能急速，擊殺後全能吸血"),
    3039: ("BRU", "生命越高暴擊率越高"),
    6333: ("BRU", "受到的傷害延後扣，擊殺後回血"),
    3053: ("BRU", "生命加攻擊力，快死時得到護盾"),
    3078: ("BRU OHAD LETH", "放技能後的普攻加傷害，攻速、生命、急速都有"),
    6631: ("BRU", "普攻打到附近敵人，主動緩速衝進去"),
    6610: ("BRU", "對英雄的第一下普攻暴擊並回血"),
    3071: ("BRU", "物理傷害疊破甲，隊友也打得動"),
    3161: ("BRU LETH", "基礎技能急速，技能傷害越打越高"),
    6609: ("BRU", "重創，減少敵方回血"),
    3073: ("BRU", "大絕冷卻更短，放大後加攻速跑速"),
    3748: ("BRU TANK", "依生命加傷害，普攻打到目標後方"),
    3074: ("BRU", "普攻打到附近敵人並吸血"),
    6698: ("BRU LETH", "穿甲，主動對周圍造成傷害"),
    3156: ("BRU LETH", "被魔法傷害打到快死時得到護盾和吸血"),
    3139: ("BRU CRIT OHAD", "主動解除控場"),
    3181: ("BRU", "每五下普攻加傷害"),   # made for towers: never more than +1 (fit)
    2501: ("BRU TANK", "生命轉成攻擊力，殘血時更痛"),
    3084: ("TANK BRU", "對附近英雄的普攻加傷害並永久加生命"),
    3083: ("TANK", "大量生命，脫戰後回血"),
    3075: ("TANK", "被普攻時反傷並重創"),
    3143: ("TANK", "減少暴擊傷害，主動緩速附近敵人"),
    3110: ("TANK", "降低附近敵人攻速"),
    6662: ("TANK", "放技能後的普攻留下緩速區域"),
    3068: ("TANK", "持續燒傷附近的敵人"),
    2502: ("TANK", "近身打架時持續傷害並回血"),
    6665: ("TANK BRU", "打得越久雙抗越高"),
    4401: ("TANK BRU", "被魔法傷害打幾次後魔防和跑速更高"),
    2504: ("TANK", "一陣子沒被魔法傷害打就得到魔法護盾"),
    3065: ("TANK BRU", "自身受到的治療和護盾更多"),
    6664: ("TANK", "持續燒傷附近的敵人"),
    8020: ("TANK SUP", "附近敵人受到更多魔法傷害"),
    3742: ("TANK", "移動累積跑速，第一下普攻撞人"),
    2525: ("TANK", "快死時再加大量生命並回血"),
    3119: ("TANK", "疊滿魔力後生命更高"),
    3190: ("SUP", "主動給附近隊友護盾"),
    3109: ("SUP", "替一位隊友分擔傷害"),
    3050: ("SUP TANK", "放大絕後身邊的風暴緩速敵人"),
    2524: ("SUP ENCH", "緩速或控場後隊友加攻速"),
    3089: ("MAGE MHP", "法術強度再加三成"),
    4645: ("MAGE", "對殘血的魔法傷害更高"),
    3135: ("MAGE MHP", "魔法穿透，打得動坦克"),
    3118: ("MAGE", "大絕冷卻更短，大絕燒地降魔防"),
    4646: ("MAGE", "一口氣打出大量傷害時追加爆炸"),
    6655: ("MAGE", "技能命中時追加回音傷害"),
    2503: ("MAGE MHP", "技能燒傷敵人，燒越多人法強越高"),
    3003: ("MAGE", "疊滿魔力後法術強度更高"),
    3157: ("MAGE MHP", "主動凝滯，躲掉切入"),
    3102: ("MAGE", "擋下一個敵方技能"),
    3137: ("MAGE", "魔法穿透，擊殺後治療隊友"),
    4628: ("MAGE", "遠距離的技能揭露敵人"),
    2522: ("MAGE", "主動讓基礎技能冷卻更快"),
    3100: ("MAGE", "放技能後的普攻加法傷"),
    4005: ("ENCH MAGE", "控場技能冷卻更短，被控的敵人受到更多傷害"),
    6653: ("MHP MAGE", "技能燒最大生命，越打越痛"),
    3116: ("MHP MAGE", "傷害技能都會緩速"),
    8010: ("MHP MAGE", "魔法傷害疊降魔防"),
    4633: ("MHP", "生命轉成法強，打越久越痛"),
    4629: ("MHP MAGE", "打出魔法傷害後加跑速"),
    3152: ("MHP MAGE", "主動衝刺切入"),
    6657: ("MHP MAGE", "隨時間成長，滿層升一級"),
    3165: ("MHP MAGE", "重創，減少敵方回血"),
    6617: ("ENCH", "治療或護盾時多照顧一位隊友"),
    2526: ("ENCH", "疊滿魔力後治療和護盾更強"),
    6621: ("ENCH", "回魔越多治療、護盾和法強越高"),
    3504: ("ENCH", "治療或護盾時隊友加攻速和傷害"),
    6616: ("ENCH", "治療或護盾時你和隊友加法強"),
    3107: ("ENCH", "主動治療隊友並傷害敵人"),
    6620: ("ENCH", "對敵人的傷害轉成治療隊友"),
    3222: ("ENCH", "主動解除隊友的控場"),
    2065: ("ENCH SUP", "主動讓附近隊友加速"),
    123430: ("ENCH", "技能有機率給自己或隊友護盾"),
}
BOOTS = {
    3006: ("CRIT OHAD OHAP", "攻速"),
    3020: ("MAGE MHP", "魔法穿透"),
    3158: ("LETH ENCH MAGE", "技能和召喚師技能冷卻更短"),
    3111: ("BRU TANK", "韌性和魔防，少被控"),
    3047: ("TANK BRU", "減少普攻傷害"),
    3009: ("", "跑速最高"),
    3008: ("", "參與擊殺後吸血"),
    1001: ("", "便宜，錢先留給裝備"),
}
# when to buy it, not every game: never in the main build, an alternative with this line in front
WHEN = {3033: "敵方回血多時", 6609: "敵方回血多時", 3165: "敵方回血多時", 3075: "敵方回血多時", 6695: "敵方護盾多時",
        3157: "被切入時", 3102: "敵方有關鍵控場時", 3139: "被控就會死時", 3156: "敵方法師多時", 3091: "敵方魔法傷害多時",
        4401: "敵方魔法傷害多時", 2504: "敵方魔法爆發多時", 3143: "敵方暴擊射手多時", 6673: "被切入時", 3814: "敵方有關鍵技能時",
        3222: "敵方控場多時", 3047: "敵方普攻多時"}
# one of each: the passives do not stack
UNIQUE = [{6673, 3053, 3156, 2525}, {3078, 3508, 3100, 6662, 2510}, {3003, 3004, 3119, 2526}, {3748, 3074, 6698, 6631},
          {3068, 6664}, {3033, 6609, 3165, 3075}, {3814, 3102}]
MELEE_ONLY = {3748, 3074, 6698, 6631, 3084, 3179}
RANGED_ONLY = {3085, 2523, 3094}
SPELLBLADE = {3078, 3508, 3100, 6662, 2510}
MANA_FLOW = {3003, 3004, 3119, 2526, 6657}
ULT_ITEMS = {3118, 2512, 3073, 6696, 3050}
ALLY_HEAL = {6617, 2526, 6621, 3504, 6616, 6620, 2524}

# ---- what each play style wants -------------------------------------------------------------------------------------------------
# hand styles (resg's games show these builds; one list each, the page switches between them). Champions not here use the augment
# styles (augment_tiers.STYLES) or one style read from the note.
STYLES = {
    "Varus": [("lethality", "穿甲 Q", {"LETH": 2}), ("onhit", "攻速特效 W", {"OHAD": 2, "OHAP": 1}), ("ap", "法術 W", {"OHAP": 2, "MAGE": 1})],
    "Katarina": [("onhit", "攻速特效", {"OHAD": 2, "OHAP": 2, "BRU": 1})],
    "Udyr": [("ap", "法術 R", {"MHP": 2, "MAGE": 1}), ("tank", "坦克", {"TANK": 2, "BRU": 1})],
    "Malphite": [("tank", "坦克", {"TANK": 2, "SUP": 1}), ("ap", "法術", {"MAGE": 2, "MHP": 1})],
}


def wants_of(c):
    """The item kinds a play style wants: the note's `stack` (the stats it builds) first, its archetypes after."""
    st = c.stack
    ad, ap = "攻擊力" in st or (c.ad and not c.ap), "法術強度" in st or (c.ap and not c.ad)
    bulk = bool({"生命", "護甲", "魔防"} & st)
    if c.enchanter and not c.tank and "穿透" not in st:   # heals or shields allies: the enchanter items first, whatever it stacks
        return {"ENCH": 2, "MAGE": 1, "SUP": 1}
    if ap and not ad:
        if "攻速" in st:
            return {"OHAP": 2, "MAGE": 1}
        if bulk:
            return {"MHP": 2, "MAGE": 1, "TANK": 1}
        if c.ally and "穿透" not in st:
            return {"ENCH": 2, "MAGE": 1, "SUP": 1}
        return {"MAGE": 2, "MHP": 1}
    if ad:
        if "暴擊" in st:
            return {"CRIT": 2, "OHAD": 1}
        if "攻速" in st:
            return {"OHAD": 2, "CRIT": 1 if c.marksman else 0, "BRU": 1 if c.melee else 0}
        if bulk:
            return {"BRU": 2, "TANK": 1}
        return {"LETH": 2, "BRU": 1 if c.melee else 0}
    if c.ally and not c.tank:
        return {"ENCH": 2, "SUP": 1}
    return {"TANK": 2, "SUP": 1, "BRU": 1 if c.ad else 0, "MHP": 1 if c.ap else 0}


def fit(c, wants, i, kinds, line):
    """(fit, reason) of one item for one play style."""
    base = max((wants.get(k, 0) for k in kinds.split()), default=0)
    if base <= 0:
        return -2, "不是這個打法的裝備"
    if i in MELEE_ONLY and not c.melee:
        return -2, "遠程用不到"
    if i in RANGED_ONLY and c.melee:
        return -2, "近戰用不到"
    if i in MANA_FLOW and not c.mana:
        return -2, "不用魔力"
    if i in ALLY_HEAL and not c.ally:
        return -2, "沒有治療或護盾隊友的技能"
    if i == 4005 and c.cc == 0:
        return -2, "沒有硬控技能"
    if i == 2524 and not (c.cc or c.slows):
        return -2, "沒有緩速或控場"
    f, why = base, line
    if i in SPELLBLADE:
        if c.empowers or c.short_cds >= 2:
            why = f"技能冷卻短，{line}"
        else:
            f -= 1
    if i in ULT_ITEMS:
        if c.ult_key or c.ult_spam:
            why = f"大絕是重點，{line}"
        else:
            f -= 1
    if i in (6655, 3161, 4628, 2522) and c.spammer:
        why = f"一直放技能，{line}"
    if i in (6653, 2503) and c.dot:
        why = f"技能持續傷害，{line}"
    if i == 3181:
        f = min(f, 1)
    if i == 4646 and c.dot:
        f -= 1
    if i in (3116, 6694) and c.spammer:
        why = f"技能多，{line}"
    if i == 3065 and (c.heals or c.shields):
        why = f"自己會回血或護盾，{line}"
    if i in (4005, 3050) and c.cc >= 2:
        why = f"{c.cc} 個硬控技能，{line}"
    return f, why


# ---- data ----------------------------------------------------------------------------------------------------------------------

def items():
    """The finished items and boots sold in Mayhem, by id, from the item notes; and resg's ids that name the same item."""
    out, by_name = {}, {}
    for path in (ROOT / vault_paths.ITEMS).glob("*.md"):
        fm = frontmatter(path)
        if not str(fm.get("id", "")).isdigit():
            continue
        i = int(fm["id"])
        by_name.setdefault(fm.get("name", ""), []).append((i, fm))
        boots = "Boots" in fm.get("tags", [])
        if fm.get("reward") or (not boots and (fm.get("into") or fm.get("gold_total", 0) < 2200)):
            continue
        if i in KINDS or i in BOOTS:
            out[i] = {"id": i, "name": fm.get("name", ""), "boots": boots}
    alias = {}
    dd = sorted((p for p in DDRAGON.glob("*/item.json")), key=lambda p: [int(x) for x in p.parent.name.split(".")])
    if dd:   # resg counts ARAM's own copies (126697 傲慢): the item note of that name
        for rid, it in json.loads(dd[-1].read_text(encoding="utf-8"))["data"].items():
            for i, _ in by_name.get(it["name"], []):
                if i in out and int(rid) != i:
                    alias[int(rid)] = i
    return out, alias


def main():
    cache = latest_cache()
    meta = json.loads((cache / "meta.json").read_text(encoding="utf-8"))
    pool, alias = items()
    data = {}
    for f in (cache / "champions").glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        data[d["champion"]["id"]] = d

    # an item's result everywhere: its win rate on each champion against the champion's own, weighted by games
    tot = defaultdict(lambda: [0, 0.0])
    def rows(d):
        own = d["champion"]["wr"]
        for r in d.get("ia", {}).get("items", []):
            yield alias.get(r[0], r[0]), r[1], r[2], r[4] / 10000, own
        for r in d.get("b", {}).get("BOOTS", []):
            if len(r[1]) == 1 and r[2]:
                yield alias.get(r[1][0], r[1][0]), r[2], round(r[4] / 10000 * r[2]), r[5] / 10000, own
    for d in data.values():
        for i, g, w, _, own in rows(d):
            tot[i][0] += g
            tot[i][1] += g * (w / g - own)
    base = {i: v[1] / v[0] for i, v in tot.items() if v[0]}

    out, review, questions = {}, [], []
    for path in sorted((ROOT / vault_paths.CHAMPIONS).glob("*.md")):
        note = frontmatter(path)
        if note.get("type") != "champion":
            continue
        d = data.get(int(note["key"]), {})
        sums = defaultdict(lambda: [0, 0, 0.0, 0.0])   # an item and its ARAM copy (6697 / 126697 傲慢) add up
        for i, g, w, pr, own in rows(d) if d else ():
            sums[i][0] += g
            sums[i][1] += w
            sums[i][2] += pr
            sums[i][3] = own
        seen = {i: (g, w / g - own, pr) for i, (g, w, pr, own) in sums.items() if g}
        order = first_items(d, alias)
        hand = STYLES.get(note["id"])
        styles = [(Champ(note), key, name, w) for key, name, w in hand] if hand else \
                 [(c, c.style, c.style_name, None) for c in (Champ(note, s) for s in AUG_STYLES.get(note["id"], [("main", "主流", {})]))]
        champ_out, fits = {}, defaultdict(lambda: -2)
        for c, key, name, w in styles:
            wants = w or wants_of(c)
            scored = []
            for i, it in pool.items():
                kinds, line = (BOOTS if it["boots"] else KINDS)[i]
                if it["boots"]:
                    f, why = (1, line) if not kinds or any(wants.get(k, 0) > 0 for k in kinds.split()) else (-2, "不是這個打法的鞋子")
                    if not kinds:
                        f = 0
                else:
                    f, why = fit(c, wants, i, kinds, line)
                fits[i] = max(fits[i], f)
                g, gap, pr = seen.get(i, (0, None, 0.0))
                prior = base.get(i, 0.0) + FIT_PRIOR * f
                shrunk = (g * gap + PRIOR_GAMES * prior) / (g + PRIOR_GAMES) if gap is not None else prior + (UNSEEN if seen else 0)
                scored.append({"id": i, "fit": f, "why": why, "games": g, "gap": gap, "base": base.get(i, 0.0), "pr": pr,
                               "value": shrunk + FIT_SCORE * f + POP * pr, "boots": it["boots"]})
            scored.sort(key=lambda r: -r["value"])
            main_build, taken = [], set()
            for r in scored:
                if r["boots"] or r["fit"] < 1 or r["id"] in WHEN or len(main_build) >= MAIN or (seen and not r["games"]):
                    continue
                group = next((g for g in UNIQUE if r["id"] in g), {r["id"]})
                if group & taken:
                    continue
                main_build.append(r)
                taken |= group
            main_build.sort(key=lambda r: (order.get(r["id"], 99), -r["value"]))
            boots = max((r for r in scored if r["boots"] and r["fit"] >= 0), key=lambda r: (r["fit"], r["value"]), default=None)
            alts = [r for r in scored if not r["boots"] and r["fit"] >= 1 and r not in main_build]
            plain = [r for r in alts if r["id"] not in WHEN][:ALTS - 1]
            when = [r for r in alts if r["id"] in WHEN and not (next((g for g in UNIQUE if r["id"] in g), set()) & {m["id"] for m in plain})][:max(1, ALTS - len(plain))]
            alt = (plain + when)[:ALTS]
            champ_out[key] = {
                "name": name,
                "main": [{"id": r["id"], "reason": r["why"]} for r in main_build],
                "boots": {"id": boots["id"], "reason": boots["why"]} if boots else None,
                "alt": [{"id": r["id"], "reason": r["why"], "when": WHEN.get(r["id"], "")} for r in alt],
            }
            if note["id"] in TEST:
                review.append((note.get("name", note["id"]), name, main_build, boots, alt, scored))
            for r in main_build + ([boots] if boots else []):
                if r["games"] >= SURE_GAMES and r["gap"] is not None and r["gap"] - r["base"] <= -SPECIFIC:
                    questions.append(("weak", note.get("name"), name, pool[r["id"]]["name"], r["why"], r["gap"], r["games"]))
        for i, (g, gap, pr) in seen.items():
            if i not in pool or fits[i] > 0 or g < SURE_GAMES or (i in BOOTS and not BOOTS[i][0]):
                continue
            if pr >= 0.25:
                questions.append(("popular", note.get("name"), "", pool[i]["name"], "", gap, g, pr))
            elif pr >= 0.03 and gap - base.get(i, 0.0) >= SPECIFIC:
                questions.append(("strong", note.get("name"), "", pool[i]["name"], "", gap, g, pr))
        out[note["id"]] = champ_out

    OUT.write_text(json.dumps({"source": f"resg.top {meta['version']} ({meta['collectedAt'][:10]})", "patch": meta["version"],
                               "champions": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    write_review(review, pool, meta)
    write_questions(questions, meta)
    kinds = defaultdict(int)
    for q in questions:
        kinds[q[0]] += 1
    print(f"{len(out)} champions, {sum(len(v) for v in out.values())} builds; questions: " + ", ".join(f"{k} {v}" for k, v in kinds.items()))


def first_items(d, alias):
    """Each item's usual place in the build (resg's most common first five and three items), for the main build's order."""
    pos = defaultdict(lambda: [0.0, 0])
    for k in ("5", "3"):
        for row in d.get("ia", {}).get("combos", {}).get(k, []):
            for n, i in enumerate(row[1]):
                pos[alias.get(i, i)][0] += n * row[2]
                pos[alias.get(i, i)][1] += row[2]
    return {i: s / g for i, (s, g) in pos.items() if g}


def pct(x):
    return f"{x * 100:+.1f}" if x is not None else "—"


def write_review(review, pool, meta):
    out = ["---", "title: Morellonomicon - Build Review", "tags:", "  - review", "  - items", "sticker: lucide//list-ordered", "---",
           f"Written by `tools/build_tiers.py` (do not edit): the test champions' builds. Fit is the reasoning (−2 not this style's item … +2); "
           f"games, pick rate and the gap come from resg.top {meta['version']} (collected {meta['collectedAt'][:10]}), shown here only for "
           "review. [[Build Model]] explains the rules.", ""]
    for champ, style, main_build, boots, alt, scored in review:
        out += [f"## {champ} · {style}", ""]
        out.append("**Main**: " + " › ".join(f"[[{pool[r['id']]['name']}]]" for r in main_build)
                   + (f" + [[{pool[boots['id']]['name']}]]" if boots else ""))
        out.append("**Alternatives**: " + "、".join(f"[[{pool[r['id']]['name']}]]" + (f" ({WHEN[r['id']]})" if r["id"] in WHEN else "") for r in alt))
        out += ["", "| Item | Fit | Games | Picked | Gap | Everywhere | Score | Reason |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for r in [r for r in scored if r["fit"] >= 1 or r["pr"] >= 0.05][:24]:
            out.append(f"| [[{pool[r['id']]['name']}]] | {r['fit']:+d} | {r['games']} | {r['pr'] * 100:.0f}% | {pct(r['gap'])} | {pct(r['base'])} | "
                       f"{r['value'] * 100:+.1f} | {r['why']} |")
        out.append("")
    OUT_REVIEW.write_text("\n".join(out) + "\n", encoding="utf-8")


def write_questions(questions, meta):
    out = ["---", "title: Morellonomicon - Build Questions", "tags:", "  - review", "  - items", "sticker: lucide//circle-help", "---",
           f"Written by `tools/build_tiers.py` (do not edit). Items with at least {SURE_GAMES} games on resg.top {meta['version']} where the games "
           "and the reasoning disagree. Explain it and it becomes a play style (`STYLES`), an item kind or a condition in the script.", ""]
    popular = sorted((q for q in questions if q[0] == "popular"), key=lambda q: -q[7])
    by_champ = defaultdict(list)
    for q in popular:
        by_champ[q[1]].append(q)
    out += ["## Built often, no reason (another play style?)", ""]
    for champ, qs in sorted(by_champ.items(), key=lambda kv: -len(kv[1])):
        out.append(f"- **{champ}**: " + "、".join(f"[[{q[3]}]] {q[7] * 100:.0f}% ({pct(q[5])})" for q in qs))
    strong = sorted((q for q in questions if q[0] == "strong"), key=lambda q: -q[5])
    out += ["", "## Strong in games, no reason yet", ""]
    by_item = defaultdict(list)
    for q in strong:
        by_item[q[3]].append(q)
    for item, qs in sorted(by_item.items(), key=lambda kv: -len(kv[1])):
        out.append(f"- **[[{item}]]** ({len(qs)}): " + "、".join(f"{q[1]} {pct(q[5])}" for q in qs[:25]) + (" …" if len(qs) > 25 else ""))
    out += ["", "## In the main build, the games say no", ""]
    for q in sorted((q for q in questions if q[0] == "weak"), key=lambda q: q[5]):
        out.append(f"- {q[1]}（{q[2]}）· [[{q[3]}]]: {q[4]} — {pct(q[5])} in {q[6]} games")
    OUT_QUESTIONS.write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
