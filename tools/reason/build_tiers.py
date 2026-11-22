"""A main build and alternative items for every champion in ARAM Mayhem: why the item works for the champion, checked against games.

Like tools/reason/augment_tiers.py, per champion and play style:
- Reasoning: every finished item has the kinds of champion it is made for (KINDS: crit, on-hit, lethality, bruiser, tank, mage,
  battle mage, enchanter, support) and a line saying what it does; a play style wants some kinds (WANTS, from the champion note
  read by augment_tiers.Champ, or the hand styles in STYLES). Conditions (fit) read the kit: mana for the 魔力之流 items, melee for
  the hydras, an ultimate that matters for 惡意, heals or shields on allies for the enchanter items. Fit -2 (not this style's item)
  to +2, with the reason the page shows.
- Evidence: resg.top's games for the patch (tools/crawl/fetch_resg.py, cached in the git-ignored .cache/resg/; no number is written out):
  the item's win rate on the champion against the champion's own, pulled toward the item's result on every champion when the games
  are few, plus how often the champion builds it.

The main build is the best five items with a reason (one per unique passive: 命脈, 魔法彎刀, 魔力之流, 劈砍...), in the order players
buy them (resg's most common first items), and the best boots; then up to four alternatives, with when to buy the situational ones
(重創, 中婭沙漏...). Items the games call strong but no rule explains, and picks the games disagree with, are listed in
Review/Build Questions.md.

Writes _data/item-builds.json (read by the plugin), Review/Build Review.md and Review/Build Questions.md. Standard library.

    python3 -I tools/reason/build_tiers.py
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # python3 -I adds no script folder: tools/ here,
import toolpath  # noqa: E402,F401  (...and toolpath adds the job folders, so the scripts import each other by name)
import vault_paths  # noqa: E402
from augment_tiers import Champ, frontmatter, latest_cache, save_questions, source, older_than_published  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "_data" / "item-builds.json"
OUT_REVIEW = ROOT / "Review" / "Build Review.md"
OUT_QUESTIONS = ROOT / "Review" / "Build Questions.md"
DDRAGON = ROOT / ".cache" / "ddragon"

PRIOR_GAMES = 3000     # games the prior counts as: an item seen in fewer games on a champion leans on its result everywhere
FIT_PRIOR = 0.005      # each fit point moves the prior half a point
FIT_SCORE = 0.03       # and the score 3 points more: the reasoning decides, the games order what it allows
POP = 0.04             # how often the champion builds it (0-1) adds up to 4 points: the main build is also what people build
UNSEEN = -0.03         # an item not in the champion's 50 most built: hardly anyone builds it (never in the main build)
CORE_MIN = 50          # games a style needs, all its first-two pairs together
SET_MIN = 20           # games one pair needs to stand for its style (core, other pair, broken or not)
CORE_PRIOR = 1000      # games the champion's own win rate counts as in a set's result
POP_CORE = 0.1         # how often the set is built (share of the champion's games) adds up to that many points
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
    3146: ("MAGE BRU", "物攻加魔攻、全能吸血，主動電擊緩速"),
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
    123430: ("CRIT ENCH", "暴擊率加技能急速，技能依暴擊率給自己或隊友護盾"),
    124011: ("ENCH OHAP", "普攻治療身邊最殘的隊友，治療護盾越強攻速越快"),
}
BOOTS = {
    3006: ("CRIT OHAD OHAP", "攻速"),
    3020: ("MAGE MHP", "法穿"),
    3158: ("LETH ENCH MAGE", "技能急速"),
    3111: ("BRU TANK", "韌性魔防"),
    3047: ("TANK BRU", "擋普攻"),
    3009: ("", "跑速"),
    3008: ("", "擊殺吸血"),
    1001: ("", "省錢"),
}
BOOT_WHY = {3006: "攻速，普攻更快", 3020: "法穿，技能打得更痛", 3158: "技能和召喚師技能冷卻更短", 3111: "韌性和魔防，少被控",
            3047: "減少受到的普攻傷害", 3009: "跑速最高，走位和追人", 3008: "參與擊殺後吸血", 1001: "最便宜，錢先留給裝備"}
# when to buy it, not every game: never in the main build, an alternative with this line in front
WHEN = {3033: "敵方回血多時", 6609: "敵方回血多時", 3165: "敵方回血多時", 3075: "敵方回血多時", 6695: "敵方護盾多時",
        3157: "被切入時", 3102: "敵方有關鍵控場時", 3139: "被控就會死時", 3156: "敵方法師多時", 3091: "敵方魔法傷害多時",
        4401: "敵方魔法傷害多時", 2504: "敵方魔法爆發多時", 3143: "敵方暴擊射手多時", 6673: "被切入時", 3814: "敵方有關鍵技能時",
        3222: "敵方控場多時", 3047: "敵方普攻多時"}
# what an item four to six adds: the page's word on it (the rest is 輸出)
NEEDS = {
    "生存": {3157, 3102, 3139, 3156, 6673, 3053, 6333, 2525, 3814, 2504, 4401, 6665, 3143, 3075, 3110, 3065, 3083, 3742, 2502, 3190, 6692,
            3072, 3091, 6610, 3084, 3039},
    "穿透": {3135, 3036, 3071, 8010, 3153, 3137, 6694, 6695},
    "重創": {3033, 3165, 6609},
    "機動": {3142, 3046, 3152, 4629, 4004, 3095, 6631},
    "功能": {3116, 4005, 2524, 3050, 6662, 8020, 3109, 3222, 2065, 3107, 6617, 3504, 6616, 124011},
}
# hand builds the games cannot show (bought items that are not finished, an odd count), Zaviel's answers
SPECIAL = {
    "Malphite": [{"name": "鎖子甲 ×6", "items": [1031] * 6, "note": "先買六件鎖子甲：W 和 E 都吃物防，最便宜的物防讓傷害和坦度一起來，之後再一件件合成坦裝。"}],
}
# one of each: the passives do not stack
UNIQUE = [{6673, 3053, 3156, 2525}, {3078, 3508, 3100, 6662, 2510}, {3003, 3004, 3119, 2526}, {3748, 3074, 6698, 6631},
          {3068, 6664}, {3033, 6609, 3165, 3075}, {3814, 3102}]
MELEE_ONLY = {3748, 3074, 6698, 6631, 3084, 3179}
RANGED_ONLY = {3085, 2523, 3094}
SPELLBLADE = {3078, 3508, 3100, 6662, 2510}
MANA_FLOW = {3003, 3004, 3119, 2526, 6657}
ULT_ITEMS = {3118, 2512, 3073, 6696, 3050}
ANY_DAMAGE = {123430}   # 殞落之祭: a crit item with 魔法攻擊 that AD crit builds take too (Yasuo, Yone)
ALLY_HEAL = {6617, 2526, 6621, 3504, 6616, 6620, 2524, 124011}

# ---- play styles ----------------------------------------------------------------------------------------------------------------
# A play style is a role and a damage: AD 戰士, AP 刺客, AD 射手, AP 特效, 坦克, 輔助 (decided with Zaviel 2026-11-23, after a page of
# ten item-named styles per champion: 暴擊斬殺, 暴擊射手, 暴擊 and 暴擊刺客 were one way to play Senna). Each first-two set of the
# champion's games goes to the style its items make (group_of: the items' first kinds vote, an on-hit item makes 特效, AP with
# none is 刺客 on a melee champion and 法師 on a ranged one), so every way the champion is played shows once, Jax's AP 刺客 beside
# his AD 戰士. A style is kept on CORE_MIN games, marked when its result is not sure: "few" under SURE_STYLE games, "weak" when it
# does STYLE_FLOOR worse than the champion. Each style is a short build, the way OP.GG shows one: three core items in buying order
# (the style's best first three), one other core, the boots, and items four to six by what the game needs (pick_late).
# An item's family is its first kind; a style wants its core items' kinds (style_wants).
FAMILIES = {"法術": ("MAGE", "MHP"), "攻速特效": ("OHAD", "OHAP"), "暴擊": ("CRIT",), "穿甲": ("LETH",), "戰士": ("BRU",),
            "坦克": ("TANK", "SUP"), "輔助": ("ENCH",)}
SURE_STYLE = 300
STYLE_FLOOR = -0.05    # a style that does this much worse than the champion over all its games is marked weak
STYLE_PRIOR = 100      # games of the champion's own result a style's result is pulled toward (a 100-game style is noisy)
LATE_NEEDS = {"輸出": 2, "生存": 2, "穿透": 1, "重創": 1, "功能": 1, "機動": 1}   # items four to six: at most this many per need
LATE_SHOWN = 5         # the 出裝 page's one row of five


DOUBLE_ONHIT = 2510   # 暮夜與黎明: the attack after a spell applies on-hit twice


def onhit(i, c):
    """An on-hit item (納什之牙, 智慧末刃, 殞落王者之劍); the other spellblades (三相之力, 巫妖之禍) are not, so they make no 特效 style.
    暮夜與黎明 is one for a kit whose attacks stack or proc (Jax, Gwen, Kai'Sa, Ekko), a burst item for the rest."""
    if i == DOUBLE_ONHIT:
        return c.onhit or c.onhit_passive
    return i not in SPELLBLADE and bool({"OHAD", "OHAP"} & set(KINDS.get(i, ("",))[0].split()))


def group_of(ids, c, pool):
    """The play style a set of items makes, as (damage, role word): ("", "坦克"), ("ap", "刺客"). The items' first kinds vote; a tie
    goes to the first item's. Tank and support items make a style whatever the damage."""
    ks = [KINDS[i][0].split()[0] for i in ids if i in KINDS]
    n = lambda *k: sum(x in k for x in ks)   # noqa: E731
    lead = lambda *k: n(*k) * 2 > len(ks) or (n(*k) * 2 == len(ks) and ks[:1] and ks[0] in k)   # noqa: E731
    if lead("ENCH") or (c.enchanter and n("ENCH")):   # an enchanter (Senna) with one support item is supporting
        return "", "輔助"
    if lead("TANK", "SUP"):
        return "", "坦克"
    dmg = (style_damage(ids, pool) or next((d for d in (damage(pool[i]["desc"], i) for i in ids if i in pool) if d), "")
           or ("ap" if c.ap and not c.ad else "ad"))
    if dmg == "ap":
        if any(onhit(i, c) for i in ids):
            return "ap", "特效"
        if not c.melee:
            return "ap", "法師"
        return "ap", "戰士" if n("MHP", "BRU", "TANK") > n("MAGE") else "刺客"
    votes = {"戰士": n("BRU"), "刺客": n("LETH")}
    if c.melee:
        votes.update({"特效": n("OHAD", "OHAP"), "暴擊": n("CRIT")})
    else:
        votes["射手"] = n("CRIT", "OHAD", "OHAP")
    word_of = {"BRU": "戰士", "LETH": "刺客", "CRIT": "暴擊" if c.melee else "射手",
               "OHAD": "特效" if c.melee else "射手", "OHAP": "特效" if c.melee else "射手"}
    first = word_of.get(ks[0] if ks else "", "戰士")
    return "ad", max(votes, key=lambda w: (votes[w], w == first))


def group_name(key):
    dmg, word = key
    return word if not dmg else f"{dmg.upper()} {word}"


def pick_late(cands):
    """Items four to six by need: late_items' list (best first) cut to LATE_NEEDS per need and LATE_SHOWN in all."""
    out, per = [], defaultdict(int)
    for o in cands:
        if per[o["need"]] < LATE_NEEDS.get(o["need"], 1) and len(out) < LATE_SHOWN:
            out.append(o)
            per[o["need"]] += 1
    return out


def family(kinds):
    k = kinds.split()[0] if kinds else ""
    return next((f for f, ks in FAMILIES.items() if k in ks), "")


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
    if i == DOUBLE_ONHIT and (c.onhit or c.onhit_passive):
        why = f"普攻疊層或帶特效，{line}"
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
            out[i] = {"id": i, "name": fm.get("name", ""), "boots": boots, "desc": fm.get("desc", "")}
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
    if older_than_published(meta, OUT):
        return
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
    style_sets = {}   # champion key -> the kept styles' names, damage and first-two sets (for the augment tiers per style)
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
        c = Champ(note)
        sets = merged_sets(d, alias, pool, "2")   # the first two: they keep more of a champion's play styles
        triples = merged_sets(d, alias, pool, "3")
        own_wr = d.get("champion", {}).get("wr")
        total = d.get("champion", {}).get("tm") or 1
        for st in sets:   # strength: the set's win rate against the champion's own, pulled toward it when the games are few
            st["gap"] = (st["wins"] - own_wr * st["games"]) / (st["games"] + CORE_PRIOR) if own_wr is not None else 0.0
            st["value"] = st["gap"] + POP_CORE * st["games"] / total
        champ_out, fits = {"styles": [], "special": SPECIAL.get(note["id"], [])}, defaultdict(lambda: -2)
        # a play style is a role and damage (AP 刺客, AD 戰士, 坦克): each first-two set of the games goes to the one its items make
        # (group_of), so every way the champion is played is there once, however its players spell the build
        groups = defaultdict(lambda: {"sets": [], "triples": [], "games": 0, "wins": 0})
        for st in sets:
            g = groups[group_of(st["items"], c, pool)]
            g["sets"].append(st)
            g["games"] += st["games"]
            g["wins"] += st["wins"]
        for st in triples:
            st["gap"] = (st["wins"] - own_wr * st["games"]) / (st["games"] + CORE_PRIOR) if own_wr is not None else 0.0
            st["value"] = st["gap"] + POP_CORE * st["games"] / total
            if group_of(st["items"], c, pool) in groups:
                groups[group_of(st["items"], c, pool)]["triples"].append(st)
        kept = []
        for key, g in groups.items():
            played, won = g["games"], g["wins"]
            if played < CORE_MIN:
                continue
            broken = own_wr is not None and (won - own_wr * played) / (played + STYLE_PRIOR) < STYLE_FLOOR
            warn = "weak" if broken else "few" if played < SURE_STYLE else ""
            # the core: the group's best first three (strength and how often it is built), else its best pair and a third by reasoning
            mine = sorted((st for st in g["triples"] if st["games"] >= SET_MIN), key=lambda st: -st["value"])
            pairs = sorted(g["sets"], key=lambda st: -st["value"])
            core = list(mine[0]["items"]) if mine else list(pairs[0]["items"])
            sd = {"name": group_name(key), "sig": core, "auto": True}
            sd["wants"], side = style_wants(core, pool)
            sd["side"] = key[0] or side
            scored = score_items(c, sd, pool, seen, base)
            by_id = {r["id"]: r for r in scored}
            if len(core) < 3:
                core = fill_core(core, scored, 3)
            alt = next((st["items"] for st in mine[1:] if len(set(st["items"]) & set(core)) <= 1), None) \
                or next((st["items"] for st in mine[1:] if set(st["items"]) != set(core)), None)
            alts = [list(alt)] if alt else []
            shown = set(core) | {i for a in alts for i in a}
            boots = max((r for r in scored if r["boots"] and r["fit"] >= 0), key=lambda r: (r["fit"], r["value"]), default=None)
            row = lambda i: {"id": i, "reason": by_id[i]["why"], "need": need_of(i)}
            kept.append((played, key, scored, {
                "name": sd["name"], "why": "", "games": True, "status": "", "warn": warn, "share": round(played / total, 3),
                "core": [row(i) for i in core],
                "alts": [[row(i) for i in a] for a in alts],
                "third": [],
                "late": pick_late([o for o in late_items(scored) if o["id"] not in shown]),
                "boots": {"id": boots["id"], "reason": BOOT_WHY.get(boots["id"], boots["why"]), "need": boots["why"]} if boots else None,
                "destiny": {"id": core[0], "reason": by_id[core[0]]["why"], "grows": grows(pool[core[0]]["desc"])},
            }))
            if note["id"] in TEST:
                review.append((note.get("name", note["id"]), sd["name"], scored, core, alts, True))
        kept.sort(key=lambda k: -k[0])
        champ_out["styles"] = [s for _, _, _, s in kept]
        if kept:
            style_sets[int(note["key"])] = [(s["name"], style_damage([x["id"] for x in s["core"]], pool),
                                             {frozenset(st["items"]) for st in groups[key]["sets"]}) for _, key, _, s in kept]
        for _, _, scored, _ in kept:   # an item has a reason when a style the champion keeps has one (for the questions below)
            for r in scored:
                fits[i] = max(fits[i], r["fit"])
        if not champ_out["styles"]:   # nothing played enough: the style its note reads as, from the reasoning
            sd = {"wants": wants_of(c), "side": ""}
            sd["scored"] = score_items(c, sd, pool, seen, base)
            core = fill_core([], sd["scored"], 3)
            if len(core) >= 2:
                by_id = {r["id"]: r for r in sd["scored"]}
                champ_out["styles"] = [{"name": group_name(group_of(core, c, pool)), "why": "", "games": False, "status": "",
                                        "warn": "few", "share": 0,
                                        "core": [{"id": i, "reason": by_id[i]["why"], "need": need_of(i)} for i in core],
                                        "alts": [], "third": [],
                                        "late": pick_late([o for o in late_items(sd["scored"]) if o["id"] not in core]),
                                        "boots": None, "destiny": {"id": core[0], "reason": by_id[core[0]]["why"],
                                                                   "grows": grows(pool[core[0]]["desc"])}}]
        out[note["id"]] = champ_out
        for i, (g, gap, pr) in seen.items():
            if i not in pool or fits[i] > 0 or g < meta.get("sure_item_games", SURE_GAMES) or (i in BOOTS and not BOOTS[i][0]):
                continue
            if pr >= 0.25:
                questions.append(("popular", note.get("name"), "", pool[i]["name"], "", gap, g, pr))
            elif pr >= 0.03 and gap - base.get(i, 0.0) >= SPECIFIC:
                questions.append(("strong", note.get("name"), "", pool[i]["name"], "", gap, g, pr))

    OUT.write_text(json.dumps({"source": source(meta), "patch": meta["version"],
                               "champions": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    write_style_games(cache, meta, style_sets)
    write_review(review, pool, meta)
    write_questions(questions, meta)
    kinds = defaultdict(int)
    for q in questions:
        kinds[q[0]] += 1
    print(f"{len(out)} champions, {sum(len(v['styles']) for v in out.values())} builds; questions: " + ", ".join(f"{k} {v}" for k, v in kinds.items()))


def style_damage(core, pool):
    """A style's damage from its core items: ap, ad or "" (neither, e.g. tank items)."""
    dmg = [damage(pool[i]["desc"], i) for i in core if i in pool]
    return "ap" if dmg.count("ap") > dmg.count("ad") else "ad" if dmg.count("ad") > dmg.count("ap") else ""


def write_style_games(cache, meta, style_sets):
    """Our crawl split by play style into the cache's styles.json (git-ignored), for tools/reason/augment_tiers.py: each kept
    style's games, wins and augment pairs. resg.top's totals cannot be split, so a resg cache gets none (one list per build)."""
    path = cache / "styles.json"
    if meta.get("source") != "our crawl":
        path.unlink(missing_ok=True)
        return
    import lcu_cache
    games = lcu_cache.style_games(meta["version"], {c: [s for _, _, s in v] for c, v in style_sets.items()})
    path.write_text(json.dumps({str(c): [{"name": name, "damage": dmg, **g} for (name, dmg, _), g in zip(style_sets[c], games[c])]
                                for c in style_sets}), encoding="utf-8")
    n = sum(s["tm"] for v in games.values() for s in v)
    print(f"styles.json: {n} of our players matched to a play style")


def merged_sets(d, alias, pool, k="2"):
    """resg's most built first-two (k "2") or first-three orders, one per set (its most built order), with games and wins."""
    sets = {}
    for row in d.get("ia", {}).get("combos", {}).get(k, []) if d else []:
        ids = [alias.get(i, i) for i in row[1]]
        if not all(i in pool for i in ids):
            continue
        s = sets.setdefault(frozenset(ids), {"items": ids, "games": 0, "wins": 0, "top": 0})
        s["games"] += row[2]
        s["wins"] += row[3] if row[3] else round(row[4] / 10000 * row[2])
        if row[2] > s["top"]:
            s["items"], s["top"] = ids, row[2]
    return list(sets.values())


def style_wants(sig, pool):
    """What a hand style wants: its core items' own kinds and their families' (2), their other kinds (1); and its damage
    (法術 or 物攻 when its core items are), so items of the other damage stay out."""
    w = {}
    for i in sig:
        ks = KINDS[i][0].split()
        w[ks[0]] = 2
        for k in FAMILIES[family(KINDS[i][0])]:   # the family's other kind too (法術: MAGE and MHP)
            w[k] = 2
        for k in ks[1:]:
            w[k] = max(w.get(k, 0), 1)
    dmg = [damage(pool[i]["desc"], i) for i in sig]
    side = "ap" if dmg.count("ap") > dmg.count("ad") else "ad" if dmg.count("ad") > dmg.count("ap") else (dmg[0] if dmg else "")   # a tie: the first item's
    return w, side


def damage(desc, i=None):
    if i in ANY_DAMAGE:
        return ""
    stats = " ".join(p for p in desc.split(" / ") if p[:1].isdigit())
    ap, ad = "魔法攻擊" in stats, "物理攻擊" in stats
    return "ap" if ap and not ad else "ad" if ad and not ap else ""


def score_items(c, sd, pool, seen, base):
    if "wants" not in sd:
        sd["wants"], sd["side"] = style_wants(sd["sig"], pool)
    wants, side = sd["wants"], sd.get("side", "")
    scored = []
    for i, it in pool.items():
        kinds, line = (BOOTS if it["boots"] else KINDS)[i]
        if it["boots"]:
            f = max((wants.get(k, 0) for k in kinds.split()), default=0)
            f, why = (f, line) if f > 0 or not kinds else (-2, "不是這個打法的鞋子")
        else:
            f, why = fit(c, wants, i, kinds, line)
            if side and damage(it["desc"], i) not in ("", side):
                f, why = -2, "法術玩法用不到物攻裝" if side == "ap" else "物攻玩法用不到法術裝"
        if i in sd.get("sig", []):
            f = max(f, 1)
        g, gap, pr = seen.get(i, (0, None, 0.0))
        prior = base.get(i, 0.0) + FIT_PRIOR * f
        shrunk = (g * gap + PRIOR_GAMES * prior) / (g + PRIOR_GAMES) if gap is not None else prior + (UNSEEN if seen else 0)
        scored.append({"id": i, "fit": f, "why": why, "games": g, "gap": gap, "base": base.get(i, 0.0), "pr": pr,
                       "value": shrunk + FIT_SCORE * f + POP * pr, "boots": it["boots"]})
    scored.sort(key=lambda r: -r["value"])
    return scored


def fill_core(sig, scored, n=2):
    """A style's first n items when no set of the games has its core items: those items, then the best by the reasoning."""
    core, taken = list(sig[:n]), set()
    for i in core:
        taken |= next((g for g in UNIQUE if i in g), {i})
    for r in scored:
        if len(core) >= n:
            break
        if r["boots"] or r["fit"] < 1 or r["id"] in WHEN or r["id"] in core or not r["games"]:
            continue
        group = next((g for g in UNIQUE if r["id"] in g), {r["id"]})
        if not group & taken:
            core.append(r["id"])
            taken |= group
    return core


STAT_WORDS = [("物理攻擊", "物攻"), ("魔法攻擊", "魔攻"), ("攻擊速度", "攻速"), ("暴擊率", "暴擊"), ("技能加速", "技能急速"), ("物理致命", "穿甲"),
              ("魔法穿透", "法穿"), ("物理穿透", "物穿"), ("物理防禦", "物防"), ("魔法防禦", "魔防"), ("生命", "生命"), ("魔力", "魔力"),
              ("跑速", "跑速"), ("全能吸血", "吸血"), ("普攻吸血", "吸血"), ("治療及護盾強度", "治療護盾"), ("韌性", "韌性")]


def grows(desc):
    """The stats 命定武器 grows on this item: the item's own stats (the numbers before its first passive)."""
    out = []
    for part in desc.split(" / "):
        if not part[:1].isdigit():
            break
        word = next((w for k, w in STAT_WORDS if k in part), None)
        if word and word not in out and "基礎" not in part:
            out.append(word)
    return out


def late_items(scored):
    """Items four to six: the best item for each need the champion has (damage, survival, penetration, utility, mobility, anti-heal),
    then the best of the rest; the style leaves out its core items and pick_late cuts it."""
    cand = [r for r in scored if not r["boots"] and r["fit"] >= 1]
    out = []
    def take(r):
        out.append({"id": r["id"], "reason": r["why"], "need": need_of(r["id"]), "when": WHEN.get(r["id"], "")})
    for need, n in (("輸出", 3), ("生存", 2), ("穿透", 1), ("功能", 1), ("機動", 1), ("重創", 1)):
        own = 2 if need == "輸出" else 1   # damage from the style's own items; survival and the rest from any it can use
        for r in [r for r in cand if need_of(r["id"]) == need and r["fit"] >= own and r["id"] not in {o["id"] for o in out}][:n]:
            take(r)
    for r in cand:
        if len(out) >= LATE_SHOWN * 2:
            break
        if r["id"] not in {o["id"] for o in out}:
            take(r)
    rank = {r["id"]: n for n, r in enumerate(cand)}
    return sorted(out, key=lambda o: rank[o["id"]])


def need_of(i):
    return next((need for need, ids in NEEDS.items() if i in ids), "輸出")


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
           f"Written by `tools/reason/build_tiers.py` (do not edit): the test champions' builds. Fit is the reasoning (−2 not this style's item … +2); "
           f"games, pick rate and the gap come from {source(meta)}, shown here only for "
           "review. [[Build Model]] explains the rules.", ""]
    for champ, style, rows, core, alts, from_games in review:
        pair = lambda ids: " + ".join(f"[[{pool[i]['name']}]]" for i in ids)
        out += [f"## {champ} · {style}", "", "**First two**: " + pair(core)
                + ("" if from_games else " (reasoning only)") + ("; or " + "、".join(pair(a) for a in alts) if alts else ""), "",
                "| Item | Fit | Games | Picked | Gap | Everywhere | Score | Reason |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for r in [r for r in rows if r["fit"] >= 1 or r["pr"] >= 0.05][:24]:
            out.append(f"| [[{pool[r['id']]['name']}]] | {r['fit']:+d} | {r['games']} | {r['pr'] * 100:.0f}% | {pct(r['gap'])} | {pct(r['base'])} | "
                       f"{r['value'] * 100:+.1f} | {r['why']} |")
        out.append("")
    OUT_REVIEW.write_text("\n".join(out) + "\n", encoding="utf-8")


def write_questions(questions, meta):
    out = ["---", "title: Morellonomicon - Build Questions", "tags:", "  - review", "  - items", "sticker: lucide//circle-help", "---",
           f"Written by `tools/reason/build_tiers.py` (do not edit). Items with at least {meta.get('sure_item_games', SURE_GAMES)} games on {source(meta)} where the games "
           "and the reasoning disagree. Explain it and it becomes an item kind or a condition in the script.", ""]
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
    OUT_QUESTIONS.write_text("\n".join(out) + "\n", encoding="utf-8")

    def row(q):
        return {"champion_name": q[1], "item": q[3], "pick": round(q[7], 3), "gap": round(q[5], 3), "games": q[6]}
    save_questions("items", {"patch": meta["version"], "popular": [row(q) for q in popular], "strong": [row(q) for q in strong]})


if __name__ == "__main__":
    main()
