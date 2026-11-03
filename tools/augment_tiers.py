"""Tier every ARAM Mayhem augment for every champion: why it works for the champion (its kit), checked against real games.

Two parts, per champion and augment:
- Reasoning: a rule per augment reads the champion's kit (the champion note's ability tags, archetypes, resource, `stack`, plus
  the hand lists below for mechanics the notes do not tag: spins, channels, terrain, summons, permanent stacks...) and gives a
  fit from -2 (does nothing for this champion) to +2 (the champion's kit is what the augment rewards), with the reason shown.
- Evidence: resg.top's games for the patch (tools/fetch_resg.py, cached in the git-ignored .cache/resg/; no number is written
  out): the augment's win rate on the champion against the champion's own. Few games pull it toward the augment's result on
  every champion, nudged by the fit, so a small sample cannot make an S.

The score is the evidence plus a small share of the fit; tiers per rarity (the three offers on a screen share one) and the
Pentakill band set apart. A fit of -2 is always C. Pairs where the games call an augment strong but no rule says why, or the
rule says it should work and the games disagree, are listed in Review/Augment Questions.md for a person to explain.

Writes _data/augment-tiers.json (read by the plugin), Review/Augment Tiers.md and Review/Augment Questions.md. Standard library.

    python3 -I tools/augment_tiers.py            # the patch cached by tools/fetch_resg.py (the newest one)
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import vault_paths  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "resg"
OUT_TIERS = ROOT / "_data" / "augment-tiers.json"
OUT_REVIEW = ROOT / "Review" / "Augment Tiers.md"
OUT_QUESTIONS = ROOT / "Review" / "Augment Questions.md"

PRIOR_GAMES = 1500     # games the prior counts as: an augment seen in fewer games on a champion leans on its result everywhere
FIT_PRIOR = 0.008      # each fit point moves the prior 0.8 percentage points
FIT_SCORE = 0.003      # and the score 0.3 points more, so the reasoning still counts when the games are many
TIERS = [("S", 0.08), ("A", 0.20), ("B", 0.45)]   # share of a champion's augments of one rarity, best first; the rest is C
TIER_FLOOR = {"S": 0.0, "A": 0.0, "B": -0.01}   # and the score a tier needs at least (S and A must beat the champion's own)
SPECIFIC = 0.04        # a pair doing this much better than the augment does everywhere is the champion's own (asked when unexplained)
SURE_GAMES = 3000      # resg's own 高 confidence: questions come only from pairs this well sampled
PENTAKILL = {3170, 3171, 3172, 3173}
RARITY = {1: "銀", 2: "金", 3: "稜鏡"}
TEST = ["Katarina", "Jinx", "Ezreal", "Malphite", "Soraka", "Darius", "MasterYi", "Lux", "Kaisa", "Garen", "Fiora", "Yasuo", "Yone", "Udyr", "TwistedFate"]

# ---- mechanics the champion notes do not tag (Data Dragon ids) ---------------------------------------------------------------
SPIN = {"Garen", "Darius", "Katarina", "MonkeyKing", "Tryndamere", "Renekton", "Draven"}
CHANNEL = {"Karthus", "Malzahar", "Fiddlesticks", "Katarina", "Nunu", "MissFortune", "Velkoz", "Xerath", "Zac", "Vi", "Varus", "Pyke",
           "Sion", "Galio", "Janna", "Lucian", "Jhin", "Warwick", "TwistedFate", "Shen", "Caitlyn", "Pantheon", "Poppy", "Yuumi", "Zeri"}
TERRAIN = {"Anivia", "Taliyah", "Trundle", "JarvanIV", "Azir", "Yorick", "Ornn"}
SUMMON = {"Annie", "Yorick", "Ivern", "Malzahar", "Heimerdinger", "Zyra", "Elise", "Shaco", "Azir", "Illaoi", "Naafiri"}
PERMA = {"Veigar", "Nasus", "Sion", "Thresh", "Swain", "Senna", "Kindred", "Chogath", "Smolder", "Belveth", "AurelionSol", "Bard", "Sona",
         "Viktor", "Amumu"}
KNOCKBACK = {"Alistar", "Poppy", "Vayne", "Tristana", "Gragas", "LeeSin", "Syndra", "Ziggs", "Draven", "Jayce", "KSante", "Thresh",
             "Urgot", "Kalista", "Rakan", "Ornn", "Janna"}
# ultimates the champion is picked for (an augment that removes or slows the ultimate costs them most)
ULT_KEY = {"Malphite", "Amumu", "Kennen", "Fiddlesticks", "MissFortune", "Karthus", "Orianna", "Galio", "JarvanIV", "Sejuani", "Ornn",
           "MonkeyKing", "Seraphine", "Neeko", "Nunu", "Katarina", "Samira", "Sona", "Leona", "Nautilus", "Zac", "Gragas", "Lissandra",
           "Shen", "Soraka", "Kindred", "Taliyah", "Yasuo", "Rell", "Vi", "Warwick", "Sion", "Twitch", "Brand", "Veigar", "Zyra", "Annie"}
# abilities that make the next attacks stronger for a while (on-hit and attack augments on an ability)
ATTACK_BUFF = {"Vayne", "Twitch", "KogMaw", "Ashe", "Sivir", "Jinx", "Kindred", "MasterYi", "Olaf", "Trundle", "XinZhao", "Jax", "Kaisa",
               "Tristana", "Udyr", "Nasus", "Renekton", "Volibear", "Shyvana", "Vi", "Nilah", "Kayle", "Zeri", "Belveth", "Warwick"}
# champions whose basic abilities are the damage (more casts matter more than the ultimate)
SPAMMER = {"Ezreal", "Cassiopeia", "Ryze", "Lux", "Xerath", "Ziggs", "Brand", "Karthus", "Anivia", "Heimerdinger", "Zoe", "Velkoz",
           "Kassadin", "Vladimir", "Swain", "Syndra", "Orianna", "Viktor", "Hwei", "Mel", "Lillia", "Gangplank", "Jayce", "Nidalee",
           "Elise", "Leblanc", "Ahri", "Taliyah", "Zyra", "Malzahar", "Teemo", "Corki", "Varus", "Jhin", "Smolder", "Shaco",
           "Qiyana", "Ambessa", "Sylas"}
# passives that stack on every hit (an ability or bee that applies on-hit fills them faster)
ONHIT_PASSIVE = {"TahmKench", "Volibear", "Ekko", "Senna", "Fizz", "Braum", "Vi", "Kayle", "Varus", "Kalista", "Vayne", "Gnar", "KogMaw",
                 "Teemo", "Locke", "Kennen", "Kaisa", "Sylas", "Bard"}
# ultimates that are a long buff or form the champion fights inside (basic abilities spammed during it)
ULT_STANCE = {"Hecarim", "Jax", "Alistar", "Rakan", "Shyvana", "Riven", "Olaf", "Trundle", "Renekton", "Nasus", "Kayle", "MasterYi",
              "Volibear", "Vayne", "Twitch", "Shaco", "Elise", "Nidalee", "Jayce", "Udyr", "Gnar", "Kled"}
# damage over time that ticks many times (each tick counts as a hit)
DOT = {"Singed", "Shaco", "AurelionSol", "Skarner", "Cassiopeia", "Teemo", "Brand", "Malzahar", "Karthus", "Fiddlesticks", "Swain", "Zyra",
       "Rumble", "Twitch", "Mordekaiser", "Lillia", "Gwen"}
# ultimates cast often or hitting many times
ULT_SPAM = {"Anivia", "Udyr", "Kassadin", "Yuumi", "Elise", "Jayce", "Nidalee", "Karthus", "Ryze", "Rumble", "Xerath"}
# large models (shrinking them makes them much harder to hit)
BIG_MODEL = {"Gragas", "Nasus", "Galio", "Darius", "Urgot", "Garen", "Olaf", "Nunu", "Maokai", "Chogath", "Sion", "Zac", "Malphite",
             "Ornn", "Skarner", "DrMundo", "Volibear", "Sejuani", "TahmKench", "Singed", "Thresh"}
# augments that give the same to everyone (gold, anvils, random rewards, snowball): no champion needs a reason for them
GENERIC = {1053, 1062, 1243, 1329, 1337, 1389, 1392, 1402, 12317, 1002, 1238, 1384, 1403, 1237, 1404, 2032, 2034, 2043, 2080, 1358, 2088,
           1116, 1348, 1347, 3004, 3071, 1401, 1105, 1305, 1026, 1333, 1020, 1301, 1322, 2137, 3121, 1057, 1060, 1046, 1416, 1034,
           1025, 1386, 1154, 3081}
# how champions are built in Mayhem where the note's archetypes say otherwise
BRUISER_PLAY = {"Hecarim", "XinZhao"}                                     # played as damage bruisers, not tanks
TANK_PLAY = {"Poppy"}                                                     # played as a tank: AD augments miss
MAGE_PLAY = {"Seraphine"}                                                 # played as a mage, not an enchanter
NO_ATTACK = {"Singed"}                                                    # rarely basic attacks
NO_CC = {"TahmKench"}            # his stun needs three passive stacks and W is hard to land: no reliable hard crowd control (Zaviel)
# champions played in two builds (Zaviel, 2026-11-03): one tier list each, the page switches between them; the games are shared
_AD = {"ap": False, "ad": True, "crit": True, "onhit": True, "attacker": True, "spammer": False, "ap_attacker": False,
       "stack": {"攻擊力", "攻速", "暴擊"}}
_AP = {"ap": True, "ad": False, "crit": False, "onhit": False, "attacker": False, "marksman": False, "ap_attacker": False,
       "spammer": True, "stack": {"法術強度", "技能急速"}}
STYLES = {
    "Kaisa": [("ad", "物攻射手", {**_AD, "marksman": True}), ("ap", "法術 W", _AP)],
    "KogMaw": [("ad", "物攻射手", {**_AD, "marksman": True}), ("ap", "法術 E、R", {**_AP, "ult_spam": True})],
    "Udyr": [("ad", "物攻 Q", {**_AD, "crit": False, "onhit_passive": True}), ("ap", "法術 R", {**_AP, "ult_spam": True})],
    "Shaco": [("ad", "物攻刺客", {**_AD, "onhit": False, "dot": False}), ("ap", "法術 W、R", {**_AP, "dot": True})],
    "TwistedFate": [("ad", "物攻暴擊", {**_AD, "marksman": True}), ("ap", "法術 Q、W", _AP)],
    "Bard": [("onhit", "攻速特效", {"attacker": True, "onhit": True, "ap_attacker": True, "enchanter": False, "stack": {"攻速", "法術強度"}}),
             ("ap", "法師", {**_AP, "enchanter": False, "ally": True})],
    "Ashe": [("ad", "物攻射手", {}), ("ap", "法術 R", {**_AP, "spammer": False, "ult_key": True})],
}
# melee champions whose abilities buff their attacks: range augments make those attacks land (Zaviel)
MELEE_RANGE = {"Irelia", "Tryndamere", "Trundle"}
# damage or survival augments an assassin wants even when its kit has no special use for them (Zaviel)
DMG_BUFF = {1195, 1026, 1084, 1028, 3116, 1325, 1211, 2098, 1007, 3132, 2083}
SURVIVE = {1138, 2132, 1333, 1315, 2107, 1344, 1063, 1020}
# one champion and augment, from Zaviel's answers (2026-11-03); "Id/style" for one build only
PAIR = {
    (3049, "Malphite"): (2, "W 重置普攻，配鎖子甲觸發裝甲衝擊"), (3171, "Malphite"): (2, "W 重置普攻，常觸發普攻強化"),
    (1150, "Malphite"): (2, "W 重置普攻，常觸發普攻強化"),
    (3049, "Sylas"): (2, "位移接被動普攻，配鎖子甲觸發"),
    (2123, "Qiyana"): (2, "W 重置 Q，WQWQ 連放"),
    (1058, "Hecarim"): (2, "Q 冷卻短，普攻減冷卻一直放 Q"), (1029, "Hecarim"): (2, "技能觸發命中，配祕術拳擊一直放 Q"),
    (1058, "Volibear"): (2, "技能、普攻都在打，冷卻一直轉"),
    (1054, "XinZhao"): (2, "被動第三下普攻回血吃魔攻，普攻越多越肉"),
    (2098, "Amumu"): (2, "W、大絕範圍大，四面都打到破綻"),
    (1058, "Ezreal"): (0, "後期 Q 冷卻已經很短"),
    (1019, "Yasuo"): (0, "E 冷卻本來就極短"),
    (2062, "TwistedFate"): (2, "固定強化 Q，分身多丟一次牌"), (2072, "Nidalee"): (2, "固定強化 Q，標槍分裂"),
    (2054, "Cassiopeia"): (2, "固定強化 E，多打兩人"), (2054, "Jhin"): (2, "固定強化 Q，多彈兩人"),
    (1029, "KogMaw/ap"): (2, "E、R 也吃 W 的 %生命傷害"),
    (3086, "Udyr/ad"): (2, "Q 強化普攻吃命中效果，蜜蜂一次四下"),
    (2087, "Ashe/ap"): (2, "大絕冷卻長，每次減很多"),
}
# AP champions whose basic attacks carry the damage
AP_ATTACKER = {"Kayle", "KogMaw", "Teemo", "Kaisa", "Varus", "Nilah", "Azir", "Gwen", "Diana", "Shyvana", "Katarina", "Ekko", "Lillia",
               "Corki", "Ezreal", "Kennen", "Twitch", "Bard"}


# ---- reading the notes -------------------------------------------------------------------------------------------------------

def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    fm = text.split("\n---\n")[0] if text.startswith("---") else ""
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


def cooldown(skill):
    for row in skill.get("rows", []):
        if row["label"].startswith("冷卻"):
            try:
                return float(row["vals"][0])
            except (ValueError, IndexError):
                return None
    return None


class Champ:
    """What the rules ask about a champion, from its note and the hand lists."""

    def __init__(self, note, style=("main", "主流", {})):
        self.style, self.style_name = style[0], style[1]
        self.label = note.get("name", note["id"]) + ("" if style[0] == "main" else f"（{style[1]}）")
        self.id = note["id"]
        self.key = int(note["key"])
        self.name = note.get("name", self.id)
        arch = set(note.get("archetypes", []))
        self.roles = arch
        self.melee = "近戰" in arch
        self.ranged = not self.melee
        dt = note.get("damage_type", "")
        self.ap = dt == "魔法" or (dt == "混合" and "法術強度" in note.get("stack", []))
        self.ad = dt == "物理" or (dt == "混合" and "攻擊力" in note.get("stack", []))
        self.stack = set(note.get("stack", []) or [])
        self.mana = note.get("resource") == "魔力"
        skills = note.get("skills", [])
        self.tags = set(note.get("features", []))
        count = lambda tag: sum(tag in s.get("tags", []) for s in skills)
        self.dashes = count("位移")
        self.cc = 0 if self.id in NO_CC else count("控場")
        self.slows = count("緩速")
        self.empowers = count("強化普攻")
        self.heals = count("治療") + count("吸血")
        self.shields = count("護盾")
        self.ally = "隊友增益" in self.tags and bool(self.heals or self.shields) and self.id not in MAGE_PLAY
        self.enchanter = self.ally and "輔助" in arch
        self.onhit = ("攻速" in self.stack or bool(note.get("onhit"))) and self.id not in NO_ATTACK
        self.crit = "暴擊" in self.stack
        self.marksman = "射手" in arch and self.id not in NO_ATTACK
        self.tank = ("坦克" in arch or self.id in TANK_PLAY) and self.id not in BRUISER_PLAY
        self.hp = "生命" in self.stack or self.tank
        self.resists = bool({"護甲", "魔防"} & self.stack) or self.tank
        self.haste = "技能急速" in self.stack
        self.attacker = (self.marksman or self.onhit or self.id in ATTACK_BUFF) and self.id not in NO_ATTACK
        self.skill_tags = {s["key"]: set(s.get("tags", [])) for s in skills}
        cds = {s["key"]: cooldown(s) for s in skills}
        self.dash_cds = [cds[s["key"]] for s in skills if "位移" in s.get("tags", []) and cds.get(s["key"])]
        self.ult_cd = cds.get("R") or 100.0
        self.basic_cds = [c for k, c in cds.items() if k in "QWE" and c]
        self.short_cds = sum(c <= 6 for c in self.basic_cds)
        self.spin = self.id in SPIN
        self.channel = self.id in CHANNEL
        self.terrain = self.id in TERRAIN
        self.summon = self.id in SUMMON
        self.perma = self.id in PERMA
        self.knockback = self.id in KNOCKBACK
        self.ult_key = self.id in ULT_KEY
        self.spammer = self.id in SPAMMER
        self.ap_attacker = self.id in AP_ATTACKER
        self.attack_buff = self.id in ATTACK_BUFF
        self.onhit_passive = self.id in ONHIT_PASSIVE
        self.ult_stance = self.id in ULT_STANCE
        self.dot = self.id in DOT
        self.ult_spam = self.id in ULT_SPAM
        self.big = self.id in BIG_MODEL
        for k, v in style[2].items():   # the build's own answers win over the note
            setattr(self, k, v)


# ---- the reasoning: one rule per augment ---------------------------------------------------------------------------------------
# A rule takes the champion and returns (fit, reason). The reason is what the page shows for a positive fit; for 0 or less the
# augment's own line (GEN) is shown instead, and a negative reason says why it falls short (Review only).

def fit_dash(c, what):
    if c.dashes >= 2:
        return 2, f"{c.dashes} 個位移技能，{what}"
    if c.dashes == 1:
        return 1, f"有位移技能，{what}"
    return -2, "沒有位移技能"


def fit_cc(c, what):
    if c.cc >= 2:
        return 2, f"{c.cc} 個硬控技能，{what}"
    if c.cc == 1:
        return 1, f"有硬控技能，{what}"
    return -2, "沒有硬控技能"


def fit_ally(c, what):
    if c.ally and "輔助" in c.roles:
        return 2, f"補血護盾給隊友，{what}"
    if c.ally:
        return 1, f"能幫隊友補血或上盾，{what}"
    return -2, "不會補血或護盾隊友"


def fit_self_heal(c, what):
    if c.heals + c.shields >= 2 or c.ally:
        return 2, f"補血、護盾多，{what}"
    if c.heals + c.shields == 1:
        return 1, f"有補血或護盾，{what}"
    return -1, "沒有補血或護盾技能"


def fit_mana(c, what):
    if not c.mana:
        return -2, "不用魔力"
    if c.spammer:
        return 2, f"常放技能吃魔力，{what}"
    return 1, f"用魔力，{what}"


def fit_attack(c, what, strong=None):
    if (strong or (lambda c: c.marksman or c.attack_buff))(c):
        return 2, f"靠普攻輸出，{what}"
    if c.onhit or c.empowers >= 2:
        return 1, f"常普攻，{what}"
    if c.spammer and not c.onhit:
        return -1, "靠技能輸出，普攻少"
    return 0, None


def fit_onhit(c, what):
    if c.onhit and (c.marksman or c.attack_buff):
        return 2, f"堆攻速、吃命中效果，{what}"
    if c.onhit:
        return 1, f"出命中效果裝，{what}"
    return -1, "不出命中效果裝"


def fit_crit(c, what):
    if c.crit:
        return 2, f"出暴擊裝，{what}"
    if c.marksman:
        return 1, f"射手可轉暴擊，{what}"
    return -2, "不出暴擊裝"


def fit_ap(c, what):
    if c.enchanter:
        return 0, None   # enchanters build heal and shield power, not damage
    if c.ap:
        return 2 if "法師" in c.roles else 1, f"魔攻英雄，{what}"
    if "法術強度" in c.stack:
        return 1, f"有魔攻加成，{what}"
    return -2, "不吃魔攻"


def fit_ad(c, what):
    if c.tank:
        return 0, None
    if c.ad:
        return 2 if (c.marksman or "戰士" in c.roles or "刺客" in c.roles) else 1, f"物攻英雄，{what}"
    return -2, "不吃物攻"


def fit_hp(c, what):
    if c.tank or "生命" in c.stack:
        return 2 if c.tank else 1, f"堆生命，{what}"
    if c.melee:
        return 0, None
    return -1, "脆皮，不堆生命"


def fit_spells(c, what):
    if c.spammer or c.short_cds >= 2:
        return 2, f"技能冷卻短、常放，{what}"
    if c.short_cds:
        return 1, f"有短冷卻技能，{what}"
    return 0, None


def fit_haste(c, what):
    if c.spammer or c.haste:
        return 2 if c.spammer else 1, f"靠技能輸出，{what}"
    return 0, None


def fit_key(c, key, what):
    """An augment on one ability: best on the ability that heals or shields allies, good on the main damage ability."""
    tags = c.skill_tags.get(key, set())
    if "隊友增益" in tags and tags & {"治療", "護盾"}:
        return 2, f"{key} 是補血護盾技能，{what}"
    if c.spammer and key in "QWE":
        return 1, f"{key} 常放，{what}"
    return 0, None


def fit_ult(c, what, cd_matter=True):
    if c.ult_key:
        return 2, f"大絕是招牌，{what}"
    if cd_matter and c.ult_cd <= 60:
        return 1, f"大絕冷卻短，{what}"
    return 0, None


def fit_melee_fighter(c, what):
    if c.melee and (c.ad or c.hp) and not c.tank:
        return 2, f"近戰鬥士，{what}"
    if c.melee:
        return 1, f"近戰，{what}"
    return -1, "遠程英雄"


def fit_tank(c, what):
    if c.tank:
        return 2, f"坦克，{what}"
    if c.hp or c.resists:
        return 1, f"出肉裝，{what}"
    return -1, "不出肉裝"


def fit_spellblade(c, what):
    """Cast then attack: the augment's next attack after an ability."""
    if (c.empowers or c.attack_buff) and c.melee:
        return 2, f"技能接普攻，{what}"
    if c.empowers or c.onhit or c.attacker:
        return 1, f"技能後補普攻，{what}"
    if c.spammer:
        return -1, "站得遠，很少補普攻"
    return 0, None


def fit_ability_onhit(c, what):
    if c.onhit and (c.spammer or c.short_cds >= 2):
        return 2, f"技能多又出命中效果，{what}"
    if c.onhit:
        return 1, f"出命中效果裝，{what}"
    if c.spammer or c.short_cds >= 2:
        return 1, f"技能命中多，{what}"
    return 0, None


def fit_duration(c, what):
    if c.attack_buff:
        return 2, f"有強化普攻的持續技能，{what}"
    if c.empowers:
        return 1, f"有強化普攻的技能，{what}"
    return -2, "沒有持續強化普攻的技能"


def fit_empowered(c, what):
    if c.empowers >= 2:
        return 2, f"{c.empowers} 個強化普攻的技能，{what}"
    if c.empowers:
        return 1, f"有強化普攻的技能，{what}"
    return -2, "沒有強化普攻的技能"


def only(flag, yes, no, strong=2):
    return (strong, yes) if flag else (-2, no)


def bad_for(cond, why, then):
    return (-2, why) if cond else then


# the augment's own line, shown when the champion has nothing special for it
GEN = {
    1001: "打久了變大變強", 1004: "技能傷害、急速大增，沒有大絕", 1006: "多段閃現突進", 1011: "大絕時無敵", 1015: "治療轉成傷害",
    1018: "控到人就上盾", 1019: "位移技能急速大增", 1027: "位移後留下爆炸", 1030: "魔攻轉技能急速", 1041: "變大、加生命和適性",
    1045: "技能燒人、減基礎冷卻", 1048: "技能可以暴擊", 1053: "隨機變大或變小", 1054: "普攻疊魔攻、技能疊物攻", 1058: "普攻減技能冷卻",
    1062: "三種龍魂", 1079: "致命節奏＋征服者", 1081: "普攻疊跑速、跑速轉攻速", 1088: "大絕再放一次", 1095: "治療護盾附帶雙抗",
    1115: "大幅加射程", 1134: "遠程變近戰，大量屬性", 1154: "擊殺任務換黃金鍋鏟", 1156: "法帽任務", 1194: "大絕把人變小動物",
    1195: "縮小加速、打大體型增傷", 1225: "普攻多一支箭", 1243: "兩件隨機增幅", 1310: "背刺、詐死、死亡爆炸", 1323: "控人降彗星",
    1324: "雙抗轉治療護盾強度", 1325: "生命換真實傷害", 1329: "超大雪球", 1331: "衝向隊友互相上盾", 1332: "扣血放技能換魔攻吸血",
    1335: "打人額外傷害和金錢", 1337: "攻城換道具", 1344: "大絕後大護盾", 1349: "大絕重置基礎技能", 1379: "升級破曉綻放之劍",
    1388: "技能急速，擊殺再加", 1389: "巴龍之手", 1392: "雪球衝刺無敵", 1402: "四個能力值鐵砧", 1413: "大絕後範圍嘲諷",
    1421: "自動衝刺魅惑", 2004: "補隊友累積衝擊波", 2005: "連打英雄自動掃射", 2010: "暴擊多一次命中效果", 2054: "技能多打兩人",
    2055: "技能多發飛彈", 2062: "分身重放技能", 2072: "飛彈分裂", 2087: "放技能減其他技能冷卻", 2098: "破綻真實傷害",
    2099: "擊殺後閃現重置技能", 2104: "治療護盾累積成炸彈", 2107: "死後復活", 2115: "黏住敵人拉過來", 2123: "放技能重置一個技能",
    2134: "大絕放能量場", 2135: "持續技能疊釘子", 2141: "九頭蛇全買", 3016: "第三下普攻真實傷害", 3018: "攻速轉暴擊傷害",
    3053: "大絕加生命、緩速", 3079: "瞬移後 5 秒不死，沒收頭就死", 3149: "治療護盾多兩個隊友", 12317: "全部換成稜鏡增幅",
    1002: "道具急速", 1005: "靠近受傷隊友加速、補量提高", 1013: "大量生命，傷害降低", 1020: "低血回血", 1029: "技能觸發命中效果",
    1036: "普攻燃燒", 1038: "黑闇收割＋先發制人", 1047: "暴擊率", 1061: "自動回力鏢", 1063: "位移後疊雙抗", 1067: "放技能回血",
    1068: "技能急速", 1071: "加射程", 1072: "技能標記讓隊友追傷", 1074: "普攻降敵方傷害", 1077: "暴擊回血", 1084: "雙穿透",
    1092: "道具和持續傷害可暴擊", 1098: "技能急速轉跑速", 1103: "Q 技能急速", 1104: "召喚物強化", 1113: "遠距離命中減冷卻",
    1116: "三次閃現", 1118: "治療護盾可暴擊", 1129: "普攻吃魔攻", 1133: "技能附帶飛彈", 1141: "補隊友加強", 1149: "裂地衝擊＋冰川增幅",
    1150: "W 技能急速", 1151: "E 技能急速", 1152: "心之鋼任務", 1180: "魔攻變護盾", 1211: "大絕後儲存傷害引爆", 1238: "一件隨機稜鏡增幅",
    1301: "自動團隊無敵", 1311: "多耗魔力換傷害", 1322: "擊殺後加速", 1326: "擊殺後隱形", 1328: "暴擊疊攻速", 1336: "升級無盡之刃",
    1353: "擊殺疊生命", 1358: "彈珠雪球", 1373: "擊殺疊急速", 1375: "控人疊生命", 1384: "直接拿錢", 1390: "技能打人疊魔攻",
    1401: "變大擊飛的召喚師技能", 1403: "三個能力值鐵砧", 1420: "自動補血、加速", 1996: "升級魔法彎刀類道具", 2032: "致死時變鯊魚誘餌",
    2034: "雪球帶鯊魚", 2043: "進草叢回血", 2064: "技能附帶衝刺", 2065: "技能範圍恐懼", 2077: "禁錮技能加傷害回血",
    2078: "擊退撞人追加傷害", 2080: "雪球擊飛", 2083: "爆發打人掉牙齒", 2091: "自動圓形斧擊", 2096: "持續技能加射程攻速",
    2100: "技能命中任務換急速", 2102: "身上燃燒", 2103: "遠距離命中降隕石", 2111: "強化普攻增傷、濺射", 2116: "技能命中任務換傷害",
    2129: "地形技能追加傷害", 2132: "全能吸血", 2133: "技能後普攻加射程、傷害", 2137: "靠近隊友上盾", 2139: "受傷累積反擊",
    2140: "升級狂怒九頭蛇", 2143: "升級突破天際", 3004: "大鬧一場召喚師技能", 3036: "兩招連打追加傷害", 3049: "技能後普攻吃護甲傷害",
    3071: "銅管爆破召喚師技能", 3075: "技能增傷附後跳", 3078: "技能後普攻加攻速傷害", 3081: "道具隨擊殺成長", 3086: "技能丟蜂巢",
    3088: "技能標記普攻引爆", 3116: "打滿五層爆傷害回血", 3118: "擊殺返還大絕冷卻", 3123: "一個技能可暴擊", 3129: "下一次普攻加傷回血",
    3131: "低血加攻速吸血", 3132: "加攻擊、慢下來", 3150: "升級雷霆風暴", 3163: "補隊友累積蝴蝶", 3170: "Q 急速和傷害",
    3171: "W 急速和傷害", 3172: "E 急速和傷害", 3173: "大絕急速和傷害", 1007: "物攻 +20%", 1022: "攻速 +60%", 1025: "死亡時爆炸",
    1026: "比對方快就增傷", 1028: "打人削雙抗", 1034: "法術護盾", 1037: "治療護盾強度", 1044: "緩速更強", 1046: "赤燄龍魂",
    1051: "第四下普攻飛彈", 1056: "魔力轉生命", 1057: "裂地龍魂", 1060: "癒水龍魂", 1073: "位移後大加速", 1076: "補隊友時周圍傷害",
    1080: "暴擊率變閃避", 1087: "普攻多一發飛彈", 1097: "魔攻", 1105: "沒挨打時大加速", 1112: "大絕後免控", 1136: "控人疊適性",
    1138: "全能吸血", 1170: "加射程", 1181: "普攻吃最大生命", 1187: "閃現爆炸", 1204: "永久堆層加倍", 1205: "物攻轉魔攻",
    1206: "魔攻轉物攻", 1214: "旋轉技能增傷", 1237: "一件隨機金級增幅", 1305: "跑速、緩速抗性", 1308: "自動妖火", 1314: "有盾時加適性",
    1315: "位移後上盾", 1318: "升級中婭沙漏", 1319: "升級獻祭", 1320: "升級收藏家", 1333: "低血大護盾逃跑", 1347: "光盾＋鬼步",
    1348: "兩個閃現", 1386: "勾索擺盪", 1404: "兩個能力值鐵砧", 1415: "技能附帶飛彈", 1416: "海克斯科技龍魂", 2009: "攻速、暴擊率",
    2016: "普攻吃最大魔力", 2018: "攻速轉技能急速", 2026: "追殘血加速", 2073: "技能吸血", 2076: "技能打人疊雙抗", 2088: "雪球增傷",
    2125: "持續技能加跑速", 2127: "道具傷害增加", 2131: "引導時上盾", 2136: "技能疊增傷", 2138: "技能命中加雙抗", 2144: "技能護盾加強",
    2157: "升級死亡之舞", 3025: "護盾附幽靈加速", 3051: "放技能上盾", 3052: "遠距離普攻增傷", 3055: "大絕急速", 3063: "生命轉物理致命",
    3085: "放技能加攻速", 3094: "魔攻（吃生命）", 3121: "擊殺掉蜜果", 3134: "被包圍加攻速雙抗",
}

RULES = {
    # 稜鏡
    1001: lambda c: fit_melee_fighter(c, "長時間纏鬥疊滿層"),
    1004: lambda c: (-2, "大絕是招牌，不能放太虧") if c.ult_key else (2, "靠基礎技能輸出，大絕可以捨棄") if c.spammer else fit_spells(c, "技能傷害、急速大增"),
    1006: lambda c: fit_onhit(c, "每段觸發命中效果") if c.onhit else fit_melee_fighter(c, "閃進人群連砍"),
    1011: lambda c: fit_ult(c, "放大絕時無敵"),
    1015: lambda c: (0, "補隊友的量不算") if c.enchanter else fit_self_heal(c, "補多少就打多少"),
    1018: lambda c: fit_cc(c, "控人就上大盾"),
    1019: lambda c: (0, "位移冷卻本來就很短") if c.dash_cds and max(c.dash_cds) <= 8 else fit_dash(c, "位移冷卻大減"),
    1027: lambda c: fit_dash(c, "每次位移都炸一次"),
    1030: lambda c: fit_ap(c, "魔攻越高技能越快"),
    1041: lambda c: fit_hp(c, "生命、適性一起加"),
    1045: lambda c: fit_spells(c, "技能燒人、越燒冷卻越短"),
    1048: lambda c: (2, "出暴擊裝又靠技能輸出") if c.crit and (c.spammer or c.short_cds >= 2) else fit_ap(c, "魔攻提高暴擊率，技能可暴擊"),
    1053: lambda c: (0, None),
    1054: lambda c: (2, "普攻和技能都多，雙修兩邊都疊") if c.ap_attacker else (0, None),
    1058: lambda c: (2, "近戰普攻接技能，冷卻一直轉") if c.melee and c.attacker and (c.short_cds or c.empowers) else (0, "射手的技能不是主要輸出") if c.marksman else (0, None),
    1062: lambda c: (0, None),
    1066: lambda c: (0, None),
    1079: lambda c: (2, "長時間普攻，兩個符文都疊滿") if c.attacker and (c.melee or not c.spammer) else (0, None),
    1081: lambda c: (2, "靠普攻輸出，普攻疊跑速再轉攻速") if c.attacker and not c.spammer else (0, None),
    1088: lambda c: fit_ult(c, "大絕連放兩次", cd_matter=False),
    1095: lambda c: fit_ally(c, "每次補人都附雙抗"),
    1115: lambda c: (2, "射程是生命線，多打好多下") if c.marksman and not c.spammer else (2, "近戰普攻手，技能強化普攻，射程讓普攻更好打") if c.id in MELEE_RANGE or (c.melee and c.attacker and (c.attack_buff or c.empowers)) else (0, None),
    1134: lambda c: (2, "遠程普攻手，變近戰換大量屬性") if c.ranged and c.attacker else (-2, "本來就是近戰") if c.melee else (0, None),
    1154: lambda c: (2, "後期普攻核心，鍋鏟收益大") if (c.marksman or c.attack_buff) and not c.tank else (0, None),
    1156: lambda c: fit_ap(c, "法帽、中婭本來就要出"),
    1194: lambda c: (2, "大絕常放又多段，常把人變小動物") if c.ult_spam else (0, None),
    1195: lambda c: (2, "體型大，縮小後很難被技能打中") if c.big else (1, "輸出英雄，吃傷害加成") if not c.tank and not c.enchanter else (0, None),
    1225: lambda c: (2, "命中效果普攻手，多一箭再觸發命中效果") if c.onhit and c.attacker else fit_attack(c, "普攻多一支箭"),
    1243: lambda c: (0, None),
    1310: lambda c: (2, "繞後刺客，背刺好觸發") if "刺客" in c.roles and c.melee else (1, "近戰常繞後") if c.melee else (0, None),
    1323: lambda c: fit_cc(c, "控人降彗星"),
    1324: lambda c: (2, "坦克又有補血護盾") if c.resists and (c.heals or c.shields) else fit_self_heal(c, "雙抗越高補量越多"),
    1325: lambda c: (1, "遠程輸出，站後面不怕少血") if c.ranged and not c.tank else (-2, "坦克不能少血"),
    1329: lambda c: (0, None),
    1331: lambda c: fit_ally(c, "衝去隊友身邊一起上盾"),
    1332: lambda c: (2, "技能多又有吸血，扣的血吸得回來") if c.ap and c.spammer else fit_ap(c, "越少血魔攻越高"),
    1335: lambda c: (0, None),
    1337: lambda c: (0, None),
    1343: lambda c: (0, None),
    1344: lambda c: (2, "大絕後衝進去，大盾加吸血") if c.melee and c.ult_cd <= 100 else fit_ult(c, "大絕後大護盾"),
    1349: lambda c: (2, "大絕是持續強化，期間基礎技能狂放") if c.ult_stance else (0, None),
    1361: lambda c: fit_tank(c, "獻祭裝本來就要出"),
    1379: lambda c: fit_attack(c, "攻速翻倍"),
    1388: lambda c: fit_haste(c, "技能急速"),
    1389: lambda c: (0, None),
    1392: lambda c: (0, None),
    1402: lambda c: (0, None),
    1413: lambda c: (2, "大絕衝進去嘲諷全場") if c.tank or (c.melee and c.ult_key) else fit_ult(c, "大絕後嘲諷"),
    1421: lambda c: (0, None),
    2004: lambda c: fit_ally(c, "補人累積虔誠"),
    2005: lambda c: (1, "技能多段打到多人") if c.spammer else (0, None),
    2007: lambda c: (0, None),
    2010: lambda c: (2, "暴擊又命中效果") if c.crit and c.onhit else fit_crit(c, "暴擊多觸發一次命中效果"),
    2054: lambda c: (0, None),
    2055: lambda c: (0, None),
    2062: lambda c: (0, None),
    2072: lambda c: (0, None),
    2087: lambda c: (-1, "技能冷卻短，減得很少") if c.spammer else (1, "技能冷卻長，每次減很多") if c.basic_cds and min(c.basic_cds) >= 10 else (0, None),
    2098: lambda c: (2, "近戰繞後切入，破綻好打") if c.melee and c.dashes else (1, "普攻多，破綻好打") if c.attacker else (0, None),
    2099: lambda c: (2, "收頭後閃過去重置技能再收") if c.dashes and ("刺客" in c.roles or "戰士" in c.roles) else (0, None),
    2104: lambda c: fit_ally(c, "補得越多炸得越快"),
    2107: lambda c: fit_melee_fighter(c, "衝進去不怕死"),
    2115: lambda c: fit_tank(c, "黏住全場再拉過來"),
    2123: lambda c: (0, None),
    2134: lambda c: fit_ult(c, "大絕後站在場內輸出"),
    2135: lambda c: fit_duration(c, "持續期間普攻疊釘子"),
    2141: lambda c: (2, "近戰物攻，九頭蛇本來就要出") if c.melee and c.ad else (-2, "不出九頭蛇"),
    3016: lambda c: fit_attack(c, "第三下普攻真實傷害"),
    3018: lambda c: (-2, "暴擊率本來就翻倍，攻速才是 Q 的冷卻") if c.id in ("Yasuo", "Yone") else (-2, "攻速是跳躍和疊矛的關鍵") if c.id == "Kalista" else fit_crit(c, "攻速換暴擊傷害"),
    3048: lambda c: fit_spellblade(c, "技能後普攻彈射"),
    3053: lambda c: fit_tank(c, "大絕衝進去又肉又緩") if c.ult_key or c.tank else fit_ult(c, "大絕加生命"),
    3079: lambda c: (2, "高輸出，5 秒不死內收頭") if c.marksman or "刺客" in c.roles else (-1, "輸出不夠，5 秒內收不到頭會死") if c.tank or c.enchanter else (0, None),
    3149: lambda c: fit_ally(c, "一次補三個人"),
    12317: lambda c: (0, None),
    # 金
    1002: lambda c: (0, None),
    1005: lambda c: fit_ally(c, "跑向受傷隊友補更多"),
    1013: lambda c: fit_tank(c, "肉更肉，傷害少一點不痛"),
    1020: lambda c: fit_melee_fighter(c, "前排低血回一大口"),
    1029: lambda c: (2, "被動靠命中疊層，技能也能疊") if c.onhit_passive else fit_ability_onhit(c, "技能也觸發命中效果"),
    1036: lambda c: fit_attack(c, "普攻疊燃燒"),
    1038: lambda c: (1, "爆發型，先手打一套") if "刺客" in c.roles or c.spammer else (0, None),
    1047: lambda c: fit_crit(c, "暴擊率直接補滿一截"),
    1061: lambda c: (0, None),
    1063: lambda c: fit_dash(c, "位移疊雙抗"),
    1064: lambda c: (0, None),
    1067: lambda c: fit_spells(c, "放技能就回血"),
    1068: lambda c: fit_haste(c, "技能急速"),
    1071: lambda c: (2, "射程是生命線，多打好多下") if c.marksman and not c.spammer else (2, "近戰普攻手，技能強化普攻，射程讓普攻更好打") if c.id in MELEE_RANGE or (c.melee and c.attacker and (c.attack_buff or c.empowers)) else (0, None),
    1072: lambda c: fit_spells(c, "技能標記讓隊友追傷"),
    1074: lambda c: fit_attack(c, "普攻讓對方傷害變低"),
    1077: lambda c: fit_crit(c, "暴擊回血"),
    1084: lambda c: (1, "爆發輸出吃穿透") if not c.tank else (-1, "坦克不靠輸出"),
    1092: lambda c: fit_crit(c, "道具傷害也暴擊") if c.crit else (0, None),
    1098: lambda c: fit_haste(c, "急速轉跑速"),
    1103: lambda c: fit_key(c, "Q", "急速大增"),
    1104: lambda c: only(c.summon, "召喚物是主要輸出", "沒有召喚物"),
    1113: lambda c: (2, "遠距離丟技能，命中就減冷卻") if c.ranged and c.spammer else (-1, "近戰打不到遠距離") if c.melee else (0, None),
    1116: lambda c: (0, None),
    1118: lambda c: (2, "出暴擊又會補血護盾") if c.crit and (c.heals or c.shields) else fit_crit(c, "治療護盾可暴擊"),
    1129: lambda c: (2, "魔攻普攻手") if c.ap_attacker else fit_ap(c, "普攻吃魔攻") if c.attacker else (0, None),
    1133: lambda c: fit_spells(c, "技能打人附帶飛彈"),
    1141: lambda c: fit_ally(c, "補隊友更多"),
    1149: lambda c: fit_cc(c, "控人觸發兩個符文"),
    1150: lambda c: fit_key(c, "W", "急速大增"),
    1151: lambda c: fit_key(c, "E", "急速大增"),
    1152: lambda c: fit_tank(c, "心之鋼本來就要出"),
    1180: lambda c: fit_ap(c, "魔攻越高盾越厚"),
    1211: lambda c: fit_ult(c, "大絕後全力輸出再引爆"),
    1238: lambda c: (0, None),
    1301: lambda c: (0, None),
    1311: lambda c: (-1, "技能多，魔力會不夠") if c.mana and c.spammer else fit_mana(c, "多耗魔力換增傷") if c.mana else (-2, "不用魔力"),
    1322: lambda c: (0, None),
    1326: lambda c: (1, "刺客收頭後隱形再切") if "刺客" in c.roles else (0, None),
    1328: lambda c: fit_crit(c, "暴擊疊攻速"),
    1336: lambda c: fit_crit(c, "無盡之刃本來就要出"),
    1346: lambda c: (0, None),
    1353: lambda c: fit_tank(c, "擊殺疊生命"),
    1358: lambda c: (0, None),
    1373: lambda c: fit_haste(c, "擊殺疊急速"),
    1375: lambda c: fit_cc(c, "控人疊生命"),
    1384: lambda c: (0, None),
    1390: lambda c: (2, "技能常打到人，魔攻疊很快") if c.ap and c.spammer else fit_ap(c, "技能打人疊魔攻"),
    1401: lambda c: fit_tank(c, "變大擊飛開團"),
    1403: lambda c: (0, None),
    1420: lambda c: (1, "會補血，奏鳴曲補更多") if c.ally else (0, None),
    1996: lambda c: fit_spellblade(c, "魔法彎刀類道具本來就要出"),
    2032: lambda c: (0, None),
    2034: lambda c: (0, None),
    2043: lambda c: (0, None),
    2064: lambda c: (1, "沒有位移，多一個衝刺") if c.dashes == 0 else (0, None),
    2065: lambda c: (1, "近戰衝進去範圍恐懼") if c.melee else (0, None),
    2077: lambda c: fit_cc(c, "禁錮附加傷害回血"),
    2078: lambda c: only(c.knockback, "有擊退技能，把人撞向隊友或牆", "沒有擊退技能"),
    2080: lambda c: (0, None),
    2083: lambda c: (1, "爆發高，常打出牙齒") if "刺客" in c.roles or (c.ap and c.spammer) else (0, None),
    2091: lambda c: fit_melee_fighter(c, "前排自動斧擊回血"),
    2096: lambda c: fit_duration(c, "持續期間加射程攻速"),
    2097: lambda c: fit_dash(c, "位移終點留虛空區域"),
    2100: lambda c: (0, None),
    2102: lambda c: fit_tank(c, "生命越多燒越痛"),
    2103: lambda c: (2, "遠距離丟技能降隕石") if c.ranged and c.spammer else (-1, "近戰很少遠距離命中") if c.melee else (0, None),
    2109: lambda c: (0, None),
    2111: lambda c: fit_empowered(c, "強化普攻增傷、濺射"),
    2116: lambda c: fit_spells(c, "技能命中換增傷"),
    2119: lambda c: (-2, "只出現在屠夫之橋"),
    2126: lambda c: fit_duration(c, "持續期間普攻減冷卻"),
    2129: lambda c: only(c.terrain, "會造地形，地形邊追加傷害", "沒有地形技能"),
    2132: lambda c: fit_ap(c, "魔攻越高吸越多"),
    2133: lambda c: (2, "補盾強度轉成傷害") if c.enchanter else fit_spellblade(c, "技能後普攻加傷"),
    2137: lambda c: (0, None),
    2139: lambda c: fit_tank(c, "挨打累積反擊"),
    2140: lambda c: (2, "近戰物攻，九頭蛇本來就要出") if c.melee and c.ad else (-2, "不出九頭蛇"),
    2143: lambda c: fit_melee_fighter(c, "突破天際回血更多"),
    3004: lambda c: (0, None),
    3036: lambda c: fit_mana(c, "兩招連打追加傷害"),
    3039: lambda c: (0, None),
    3049: lambda c: (2, "坦克技能接普攻，吃護甲傷害") if c.tank or (c.resists and c.melee) else fit_spellblade(c, "技能後普攻範圍傷害"),
    3058: lambda c: (0, None),
    3071: lambda c: (0, None),
    3075: lambda c: (0, None),
    3078: lambda c: fit_spellblade(c, "技能後普攻加攻速、傷害"),
    3081: lambda c: (2, "物攻核心常收頭，裝備越滾越大") if c.ad and (c.marksman or "刺客" in c.roles) else (0, None),
    3086: lambda c: (2, "被動靠命中疊層，蜜蜂一次疊四下") if c.onhit_passive else fit_ability_onhit(c, "技能丟蜂巢觸發命中效果"),
    3088: lambda c: fit_spellblade(c, "技能標記、普攻引爆減冷卻"),
    3116: lambda c: (2, "近戰連段快，五層很快打滿") if c.melee and not c.tank else (1, "近戰，五層打得滿") if c.melee else (0, None),
    3118: lambda c: fit_ult(c, "擊殺返還大絕冷卻", cd_matter=False),
    3123: lambda c: fit_crit(c, "一個技能可暴擊") if c.crit else (0, None),
    3129: lambda c: fit_hp(c, "下一次普攻吃生命加傷回血") if c.melee else (0, None),
    3131: lambda c: (2, "靠普攻輸出，低血攻速吸血反打") if c.attacker else (1, "近戰鬥士，低血吸血反打") if c.melee and not c.tank else (0, None),
    3132: lambda c: (1, "輸出英雄，加攻擊換一點跑速") if not c.tank else (-1, "坦克不靠攻擊"),
    3150: lambda c: fit_ap(c, "雷霆風暴本來就要出") if c.ap else (-2, "不出雷霆風暴"),
    3163: lambda c: fit_ally(c, "補人累積蝴蝶"),
    3170: lambda c: fit_key(c, "Q", "急速、補量一起加"), 3171: lambda c: fit_key(c, "W", "急速、補量一起加"),
    3172: lambda c: fit_key(c, "E", "急速、補量一起加"), 3173: lambda c: fit_ult(c, "大絕增強"),
    # 銀
    1007: lambda c: fit_ad(c, "物攻 +20%"),
    1022: lambda c: fit_attack(c, "攻速 +60%"),
    1025: lambda c: (1, "衝前排，死也要炸") if c.tank else (0, None),
    1026: lambda c: (0, None),
    1028: lambda c: (2, "持續傷害每跳都疊") if c.dot else (1, "多段傷害快速疊滿") if c.attacker or c.spammer else (0, None),
    1034: lambda c: (0, None),
    1037: lambda c: fit_self_heal(c, "治療護盾強度"),
    1044: lambda c: (1, f"{c.slows} 個緩速技能") if c.slows >= 2 else (0, None),
    1046: lambda c: (0, None),
    1051: lambda c: fit_attack(c, "第四下普攻飛彈"),
    1056: lambda c: (2, "魔力多又常站前面") if c.mana and (c.hp or c.melee) else fit_mana(c, "魔力轉生命"),
    1057: lambda c: (0, None),
    1060: lambda c: (0, None),
    1073: lambda c: fit_dash(c, "位移後大加速"),
    1076: lambda c: fit_ally(c, "補隊友時打周圍"),
    1080: lambda c: fit_crit(c, "暴擊率變閃避"),
    1087: lambda c: fit_onhit(c, "普攻多一發觸發命中效果"),
    1097: lambda c: fit_ap(c, "魔攻"),
    1105: lambda c: (0, None),
    1112: lambda c: fit_ult(c, "大絕期間免控", cd_matter=False),
    1136: lambda c: fit_cc(c, "控人疊適性"),
    1138: lambda c: (1, "近戰纏鬥吃吸血") if c.melee else (0, None),
    1170: lambda c: (1, "射程是生命線，多一點射程") if c.marksman and not c.spammer else (1, "近戰普攻手，技能強化普攻，射程讓普攻更好打") if c.id in MELEE_RANGE or (c.melee and c.attacker and (c.attack_buff or c.empowers)) else (0, None),
    1181: lambda c: (2, "堆生命又常普攻") if c.hp and c.melee and (c.attacker or c.empowers) else fit_hp(c, "普攻吃最大生命"),
    1187: lambda c: (0, None),
    1204: lambda c: only(c.perma, "技能有永久堆層，疊得快一倍", "沒有永久堆層"),
    1205: lambda c: fit_ap(c, "魔攻再加 15%") if c.ap else (-2, "物攻英雄，轉成魔攻沒用"),
    1206: lambda c: fit_ad(c, "物攻再加 15%") if c.ad else (-2, "魔攻英雄，轉成物攻沒用"),
    1214: lambda c: only(c.spin, "旋轉技能增傷", "沒有旋轉技能"),
    1237: lambda c: (0, None),
    1305: lambda c: (1, "近戰黏人不怕緩") if c.melee else (0, None),
    1308: lambda c: (0, None),
    1314: lambda c: fit_self_heal(c, "有盾時加適性") if c.shields else (0, None),
    1315: lambda c: fit_dash(c, "位移後上盾"),
    1318: lambda c: fit_ap(c, "中婭本來就要出") if c.ap else (-2, "不出中婭"),
    1319: lambda c: fit_tank(c, "獻祭裝本來就要出"),
    1320: lambda c: fit_ad(c, "收藏家本來就要出") if c.crit or "刺客" in c.roles else (0, None),
    1327: lambda c: (0, None),
    1333: lambda c: (0, None),
    1347: lambda c: (0, None),
    1348: lambda c: (0, None),
    1386: lambda c: (0, None),
    1404: lambda c: (0, None),
    1415: lambda c: (1, "暴擊又靠技能") if c.crit and c.short_cds else fit_spells(c, "技能附帶飛彈"),
    1416: lambda c: (0, None),
    2009: lambda c: (2, "普攻魔攻英雄，攻速暴擊都吃魔攻") if c.ap_attacker else fit_attack(c, "攻速暴擊"),
    2016: lambda c: fit_mana(c, "普攻吃最大魔力") if c.attacker else (0, None),
    2018: lambda c: (-2, "靠攻速，轉成急速太虧") if c.marksman else fit_haste(c, "冷卻縮短"),
    2026: lambda c: (1, "刺客追殘血") if "刺客" in c.roles else (0, None),
    2073: lambda c: fit_spells(c, "技能吸血"),
    2076: lambda c: (1, "前排常放技能疊雙抗") if c.melee and c.short_cds else (0, None),
    2088: lambda c: (0, None),
    2108: lambda c: (0, None),
    2125: lambda c: fit_duration(c, "持續期間加跑速"),
    2127: lambda c: (2, "坦克靠道具效果輸出") if c.tank else (1, "命中效果裝的傷害也加") if c.onhit and c.melee else (0, None),
    2131: lambda c: only(c.channel, "有引導技能，引導時上盾", "沒有引導技能"),
    2136: lambda c: fit_spells(c, "技能疊增傷"),
    2138: lambda c: (1, "前排技能打人加雙抗") if c.melee else (0, None),
    2144: lambda c: (1, "技能有護盾") if c.shields else (-2, "沒有護盾技能"),
    2148: lambda c: (0, None),
    2157: lambda c: fit_melee_fighter(c, "死亡之舞本來就要出") if c.ad else (-2, "不出死亡之舞"),
    3025: lambda c: (2, "護盾給隊友附幽靈加速") if c.ally and c.shields else (1, "有護盾") if c.shields else (-2, "沒有護盾技能"),
    3051: lambda c: fit_mana(c, "放技能上盾"),
    3052: lambda c: (1, "遠程射手") if c.marksman else (-2, "近戰用不到"),
    3055: lambda c: fit_ult(c, "大絕急速", cd_matter=False),
    3059: lambda c: fit_mana(c, "魔力轉魔攻") if c.ap else (0, None),
    3063: lambda c: (-1, "肉裝英雄，生命轉物理致命太虧") if c.tank else (0, None),
    3085: lambda c: fit_attack(c, "放技能加攻速"),
    3094: lambda c: (2, "堆生命又吃魔攻") if c.ap and c.hp else fit_ap(c, "魔攻"),
    3121: lambda c: (0, None),
    3134: lambda c: (2, "近戰衝進人群") if c.melee and c.attacker else fit_melee_fighter(c, "被包圍加攻速雙抗"),
}


# ---- the score -----------------------------------------------------------------------------------------------------------------

ITEM_UPGRADE = {2143, 1996, 2140, 2141, 1336, 1320, 1318, 3150, 1156, 1152, 1319, 2157, 1361, 1379}


def reasoning(i, c):
    """The fit and reason of augment i for champion c: a pair answer first, then the augment's rule, then the general answers."""
    pair = PAIR.get((i, f"{c.id}/{c.style}")) or PAIR.get((i, c.id))
    if pair:
        return pair
    fit, why = RULES[i](c)
    if i in ITEM_UPGRADE:
        fit = min(fit, 1)
    if fit <= 0 and "刺客" in c.roles and not (c.style == "ap" and c.id in STYLES):
        if i in DMG_BUFF:
            return 1, "刺客要傷害加成"
        if i in SURVIVE:
            return 1, "刺客切進去要保命"
    return fit, why


def tier_rows(rows):
    """Tiers within each rarity: by rank (TIERS), held back by the score floor; a fit of -2 is always C."""
    for grp in {r["group"] for r in rows}:
        part = sorted((r for r in rows if r["group"] == grp), key=lambda r: -r["value"])
        for n, r in enumerate(part):
            share = n / len(part)
            r["tier"] = "C"
            if r["fit"] > -2:
                for t, cut in TIERS:
                    if share < cut and r["value"] >= TIER_FLOOR[t]:
                        r["tier"] = t
                        break
            if r.get("other") and r["tier"] in ("S", "A"):
                r["tier"] = "B"   # the other build's augment: it does not reach S or A here


def latest_cache():
    patches = sorted((p for p in CACHE.glob("*") if (p / "meta.json").exists()), key=lambda p: [int(x) for x in p.name.split(".")])
    if not patches:
        sys.exit("no resg data cached: run python3 -I tools/fetch_resg.py first")
    return patches[-1]


def main():
    cache = latest_cache()
    meta = json.loads((cache / "meta.json").read_text(encoding="utf-8"))
    overall = {a["id"]: a for a in json.loads((cache / "augments.json").read_text(encoding="utf-8"))["items"]}

    augs = {}
    for path in (ROOT / vault_paths.AUGMENTS).glob("*.md"):
        fm = frontmatter(path)
        if str(fm.get("id", "")).isdigit():
            augs[int(fm["id"])] = {"id": int(fm["id"]), "name": fm.get("name", ""), "rarity": fm.get("rarity", ""), "effect": fm.get("effect", "")}
    unrated = {}
    for i, a in augs.items():
        if "目前停用" in a["effect"]:
            unrated[str(i)] = "目前停用"
        elif i not in RULES:
            unrated[str(i)] = "還沒有推理規則"
        elif i not in overall:
            unrated[str(i)] = "沒有對局資料"
    rated = [i for i in augs if str(i) not in unrated]
    base_gap = {i: overall[i]["wr"] - 0.5 for i in rated}

    champs, out, questions = {}, {}, []
    for path in sorted((ROOT / vault_paths.CHAMPIONS).glob("*.md")):
        note = frontmatter(path)
        if note.get("type") != "champion":
            continue
        key = int(note["key"])
        f = cache / "champions" / f"{key}.json"
        data = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
        own = data.get("champion", {}).get("wr")
        games = {r[0]: (r[2], r[3]) for r in data.get("ra", [])}
        builds = [Champ(note, style) for style in STYLES.get(note["id"], [("main", "主流", {})])]
        for c in builds:
            champs[f"{c.id}/{c.style}"] = c
            rows = []
            for i in rated:
                fit, why = reasoning(i, c)
                # two builds share the games: an augment only the other build has a reason for is that build's result
                other = fit <= 0 and any(reasoning(i, o)[0] > 0 for o in builds if o is not c)
                prior = base_gap[i] + FIT_PRIOR * fit
                g, w = games.get(i, (0, 0))
                seen = (w / g - own) if g and own is not None else None
                gap = ((g * seen + PRIOR_GAMES * prior) / (g + PRIOR_GAMES)) if seen is not None else prior
                score = gap + FIT_SCORE * fit
                if fit > 0 and seen is not None and g >= SURE_GAMES and seen - base_gap[i] <= -SPECIFIC:
                    why_shown = None   # the games say the kit does not make it work: show what it does, not why it should
                else:
                    why_shown = why if fit > 0 else None
                reason = why_shown or GEN.get(i, "")
                group = "五殺" if i in PENTAKILL else augs[i]["rarity"]
                rows.append({"id": i, "group": group, "tier": "", "value": round(score, 4), "score": 0.0, "when": "", "reason": reason,
                             "fit": fit, "why": why or "", "games": g, "seen": seen, "base": base_gap[i], "other": other})
            tier_rows(rows)
            for r in rows:
                if r["games"] < SURE_GAMES or r["seen"] is None:
                    continue
                if r["id"] in GENERIC or r["other"]:
                    continue
                if r["tier"] in ("S", "A") and r["fit"] <= 0 and r["seen"] - r["base"] >= SPECIFIC:
                    questions.append(("strong", c, augs[r["id"]], r["fit"], r["why"], r["seen"], r["games"]))
                elif r["fit"] >= 2 and r["seen"] - r["base"] <= -SPECIFIC:
                    questions.append(("weak", c, augs[r["id"]], r["fit"], r["why"], r["seen"], r["games"]))
            # score: 0-1 within the rarity, for the plugin's order inside a tier
            for grp in {r["group"] for r in rows}:
                part = [r for r in rows if r["group"] == grp]
                lo, hi = min(r["value"] for r in part), max(r["value"] for r in part)
                for r in part:
                    r["score"] = round((r["value"] - lo) / (hi - lo), 3) if hi > lo else 0.5
            rows.sort(key=lambda r: -r["value"])
            out.setdefault(c.id, {})[c.style] = {"name": c.style_name, "tiers": [{k: r[k] for k in ("id", "group", "tier", "value", "score", "when", "reason")} for r in rows],
                                                 "none": []}
            c.rows = rows

    OUT_TIERS.write_text(json.dumps({"source": f"resg.top {meta['version']} ({meta['collectedAt'][:10]})", "patch": meta["version"],
                                     "augments": len(rated), "unrated": unrated, "champions": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    review(champs, augs, meta, len(rated), unrated)
    ask(questions, augs, meta)
    counts = {}
    for c in champs.values():
        for r in c.rows:
            counts[(r["group"], r["tier"])] = counts.get((r["group"], r["tier"]), 0) + 1
    print(f"{len(champs)} champions × {len(rated)} augments ({len(unrated)} unrated); {len(questions)} questions")
    for grp in ("稜鏡", "金", "銀", "五殺"):
        n = sum(v for (g, _), v in counts.items() if g == grp)
        print(grp, "  ".join(f"{t} {counts.get((grp, t), 0) / max(n, 1) * 100:.0f}%" for t in "SABC"))


def review(champs, augs, meta, n, unrated):
    out = ["---", "title: Morellonomicon - Augment Tiers (review)", "tags:", "  - review", "  - augments", "sticker: lucide//list-ordered", "---",
           f"Written by `tools/augment_tiers.py` (do not edit): the test champions' tiers, {n} augments rated, {len(unrated)} not. "
           f"Fit is the reasoning (−2 useless … +2 the kit is what the augment rewards); games and the gap come from resg.top {meta['version']} "
           f"(collected {meta['collectedAt'][:10]}), shown here only for review; the score is the gap pulled toward the augment's result on "
           f"every champion when games are few, plus the fit. Tiers by rank within each rarity (S top 8%, A to 20%, B to 45%), S and A above "
           f"the champion's own win rate.", ""]
    order = {"稜鏡": 0, "金": 1, "銀": 2, "五殺": 3}
    for c in sorted((c for c in champs.values() if c.id in TEST), key=lambda c: (TEST.index(c.id), c.style)):
        out += [f"## {c.label}", "", "| Rarity | Tier | Augment | Fit | Games | Gap | Score | Reason |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for r in sorted(c.rows, key=lambda r: (order.get(r["group"], 4), "SABC".index(r["tier"]), -r["value"])):
            gap = f"{r['seen'] * 100:+.1f}" if r["seen"] is not None else "—"
            why = r["why"] if r["fit"] <= 0 and r["why"] else r["reason"]
            out.append(f"| {r['group']} | {r['tier']} | [[{augs[r['id']]['name']}]] | {r['fit']:+d} | {r['games']} | {gap} | {r['value'] * 100:+.1f} | {why} |")
        out.append("")
    out += ["## Unrated", "", "| Augment | Why |", "| --- | --- |"] + [f"| [[{augs[int(i)]['name']}]] | {w} |" for i, w in sorted(unrated.items())]
    OUT_REVIEW.write_text("\n".join(out) + "\n", encoding="utf-8")


def ask(questions, augs, meta):
    out = ["---", "title: Morellonomicon - Augment Questions", "tags:", "  - review", "  - augments", "sticker: lucide//circle-help", "---",
           f"Written by `tools/augment_tiers.py` (do not edit). Pairs with at least {SURE_GAMES} games on resg.top {meta['version']} where the games "
           "and the reasoning disagree. Explain the mechanic and it becomes a rule (or a hand list entry) in the script.", ""]
    strong = sorted((q for q in questions if q[0] == "strong"), key=lambda q: -q[5])
    weak = sorted((q for q in questions if q[0] == "weak"), key=lambda q: q[5])
    by_aug = {}
    for q in strong:
        by_aug.setdefault(q[2]["id"], []).append(q)
    out += ["## Strong in games, no reason yet", "", "Grouped by augment, the champions it wins most for first.", ""]
    for i, qs in sorted(by_aug.items(), key=lambda kv: -len(kv[1])):
        a = augs[i]
        out.append(f"- **[[{a['name']}]]** ({a['rarity']}, {len(qs)}): " + "、".join(f"{q[1].label} {q[5] * 100:+.1f}" for q in qs[:25])
                   + (" …" if len(qs) > 25 else ""))
    out += ["", "## The reasoning says yes, the games say no", ""]
    for q in weak:
        out.append(f"- {q[1].label} · [[{q[2]['name']}]]: {q[4]} — {q[5] * 100:+.1f} in {q[6]} games")
    OUT_QUESTIONS.write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
