"""Per-rank skill numbers (damage, heal, shield, cooldown, cost) for fetch_data.py.

Data Dragon only has placeholders ({{ totaldamage }}); CommunityDragon's game data (characters/<name>/<name>.bin.json)
has the real values: DataValues (a value per rank) and mSpellCalculations (how they combine with stats). Which numbers
to show is decided by the skill's own tooltip: every <magicDamage> / <physicalDamage> / <trueDamage> / <healing> /
<shield> tag names one calculation. A calculation this module cannot resolve is left out, never guessed.

A row is {"label", "vals": [one string per rank], "note"}; equal values collapse to one.
Rank r is 1-based: DataValues arrays have a spare entry at index 0.
"""
import re

TAG_LABEL = {"magicDamage": "魔法傷害", "physicalDamage": "物理傷害", "trueDamage": "真實傷害", "healing": "治療", "shield": "護盾"}
# mStat codes read so far (checked against which damage tags they appear with): 0 = AP, 2 = AD (mStatFormula 2 = bonus AD).
STAT_NAME = {0: "魔法攻擊", 2: "物理攻擊"}
MAX_DAMAGE_ROWS = 4
AD_BONUS_FORMULA = 2
UNKNOWN_STAT = "其他加成"


def num(x):
    x = round(float(x), 2)
    return str(int(x)) if x == int(x) else str(x)


def lookup(path_map, spell_id):
    obj = path_map.get(spell_id.lower())
    return (obj or {}).get("mSpell") or {}


def spell_objects(bin_data):
    """Map lower-case spell name -> bin object, by the last path segment and by mScriptName."""
    out = {}
    for path, v in bin_data.items():
        if isinstance(v, dict) and v.get("mSpell"):
            out.setdefault(path.rsplit("/", 1)[-1].lower(), v)
            out.setdefault(str(v.get("mScriptName", "")).lower(), v)
    return out


class Calc:
    """Evaluates a spell's calculations for one rank into (flat, {stat: coefficient})."""

    def __init__(self, mspell):
        self.values = {}
        for dv in mspell.get("DataValues") or mspell.get("mDataValues") or []:
            if isinstance(dv, dict) and "name" in dv:
                self.values[dv["name"].lower()] = dv.get("values") or []
        self.calcs = {k.lower(): v for k, v in (mspell.get("mSpellCalculations") or {}).items()}

    def value(self, name, rank):
        arr = self.values.get(str(name).lower())
        if arr is None:
            return None
        return arr[rank] if rank < len(arr) else arr[-1] if arr else None

    def has(self, name):
        return str(name).lower() in self.calcs or str(name).lower() in self.values

    def named(self, name, rank):
        name = str(name).lower()
        if name in self.calcs:
            return self.calc(self.calcs[name], rank)
        v = self.value(name, rank)
        return None if v is None else (v, {})

    def calc(self, c, rank):
        t = c.get("__type")
        if t == "GameCalculationModified":
            base = self.named(c.get("mModifiedGameCalculation"), rank)
            mult = self.part(c.get("mMultiplier"), rank) if c.get("mMultiplier") else (1.0, {})
            return mul(base, mult)
        if t != "GameCalculation":
            return None
        total = self.sum_parts(c.get("mFormulaParts") or [], rank)
        if total is not None and c.get("mMultiplier"):
            total = mul(total, self.part(c["mMultiplier"], rank))
        return total

    def sum_parts(self, parts, rank):
        flat, scale = 0.0, {}
        for p in parts:
            r = self.part(p, rank)
            if r is None:
                return None
            flat += r[0]
            for k, v in r[1].items():
                scale[k] = scale.get(k, 0.0) + v
        return flat, scale

    def part(self, p, rank):
        t = p.get("__type")
        if t == "NamedDataValueCalculationPart":
            v = self.value(p.get("mDataValue"), rank)
            return None if v is None else (v, {})
        if t == "NumberCalculationPart":
            return (p.get("mNumber", 0.0), {})
        if t == "StatByCoefficientCalculationPart":
            return (0.0, {(p.get("mStat", 0), p.get("mStatFormula")): p.get("mCoefficient", 0.0)})
        if t == "StatByNamedDataValueCalculationPart":
            v = self.value(p.get("mDataValue"), rank)
            return None if v is None else (0.0, {(p.get("mStat", 0), p.get("mStatFormula")): v})
        if t == "SumOfSubPartsCalculationPart":
            return self.sum_parts(p.get("mSubparts") or [], rank)
        if t == "ProductOfSubPartsCalculationPart":
            a, b = self.part(p.get("mPart1") or {}, rank), self.part(p.get("mPart2") or {}, rank)
            return None if a is None or b is None else mul(a, b)
        if t in ("GameCalculation", "GameCalculationModified"):
            return self.calc(p, rank)
        return None   # level breakpoints, buff counters, conditionals...: not resolved


def mul(a, b):
    """Product when at least one side is a plain number."""
    if a is None or b is None:
        return None
    if not b[1]:
        return (a[0] * b[0], {k: v * b[0] for k, v in a[1].items()})
    if not a[1]:
        return (b[0] * a[0], {k: v * a[0] for k, v in b[1].items()})
    return None


def stat_label(key):
    stat, formula = key
    name = STAT_NAME.get(stat)
    if name is None:
        return UNKNOWN_STAT
    return ("額外" if stat == 2 and formula == AD_BONUS_FORMULA else "") + name


def damage_row(label, calc, name, ranks):
    results = [calc.named(name, r) for r in range(1, ranks + 1)]
    if any(r is None for r in results):
        return None
    vals = [num(r[0]) if r[0] or not r[1] else "" for r in results]
    keys = sorted({k for r in results for k in r[1]}, key=str)
    notes = []
    for k in keys:
        coefs = [r[1].get(k, 0.0) for r in results]
        if stat_label(k) == UNKNOWN_STAT:
            notes.append("+" + UNKNOWN_STAT)
        elif len({round(c, 4) for c in coefs}) == 1:
            notes.append(f"+{num(coefs[0] * 100)}% {stat_label(k)}")
        else:
            notes.append(f"+{'/'.join(num(c * 100) for c in coefs)}% {stat_label(k)}")
    if all(v == "" for v in vals) and not notes:
        return None
    if not notes and all(float(v or 0) < 1 for v in vals):
        return None   # a bare fraction (a percent, a ratio) with no stat to say what it is: not a damage number
    return {"label": label, "vals": [v or "0" for v in vals], "note": " ".join(dict.fromkeys(notes))}


def collapse(row):
    if len(set(row["vals"])) == 1:
        row["vals"] = row["vals"][:1]
    return row


def damage_rows(spell, calc, ranks):
    """One row per distinct value named by a damage / heal / shield tag in the tooltip."""
    rows, seen, counts = [], set(), {}
    for tag, body in re.findall(r"<(magicDamage|physicalDamage|trueDamage|healing|shield)>(.*?)</\1>", spell.get("tooltip", ""), re.S):
        m = re.search(r"\{\{\s*([\w.:]+)", body)
        if not m:
            continue
        name = re.split(r"[.:]", m.group(1))[-1].lower()
        if name in seen or not calc.has(name):
            continue
        seen.add(name)
        row = damage_row(TAG_LABEL[tag], calc, name, ranks)
        if row:
            counts[tag] = counts.get(tag, 0) + 1
            row["tag"] = tag
            rows.append(row)
    index = {}
    for row in rows:   # two rows of one kind: number them in tooltip order
        tag = row.pop("tag")
        index[tag] = index.get(tag, 0) + 1
        if counts[tag] > 1:
            row["label"] += str(index[tag])
    return [collapse(r) for r in rows[:MAX_DAMAGE_ROWS]]


def cost_row(spell, partype, calc, ranks):
    res, costs = spell.get("resource", ""), spell.get("cost", [])[:ranks]
    if res == "被動" or not res:
        return None
    if res == "無消耗" or (costs and all(c == 0 for c in costs) and "{{ cost }}" in res):
        return {"label": "消耗", "vals": ["無"], "note": ""}
    unit = partype if partype and partype != "無" else ""
    per_second = bool(re.search(r"每\s*秒|/\s*秒", res))
    vals = []
    for r, c in enumerate(costs, start=1):
        text = res.replace("{{ cost }}", num(c)).replace("{{ abilityresourcename }}", partype)
        text = re.sub(r"\{\{\s*([\w.:]+)(\*100)?\s*\}\}", lambda m: _var(calc, m, r), text)
        if "{{" in text:
            return None   # an unresolvable placeholder: better no row than a wrong one
        # keep the table short: drop the words the label already says ("每秒消耗 30 魔力" becomes 30, label 消耗(魔力/秒))
        bare = re.sub(r"每\s*秒|/\s*秒|消耗", "", text)
        if unit:
            bare = bare.replace(unit, "")
        vals.append(re.sub(r"\s+", " ", bare).strip(" ,，、"))
    if not vals:
        return None
    if all(re.fullmatch(r"[\d.]+( \+ [\d.]+)?", v) for v in vals):   # numbers only: the unit goes in the label
        parts = unit + ("/秒" if per_second else "")
        label = f"消耗({parts})" if parts else "消耗"
    else:
        vals = [v + "/秒" if per_second else v for v in vals]
        label = "消耗"
    return collapse({"label": label, "vals": vals, "note": ""})


def _var(calc, m, rank):
    name = re.split(r"[.:]", m.group(1))[-1]
    v = calc.value(name, rank)
    if v is None:
        return m.group(0)
    return num(v * 100 if m.group(2) else v)


def rank_rows(spell, mspell, partype):
    """All rows for one skill: damage / heal / shield rows, cooldown, cost."""
    ranks = spell.get("maxrank", 5)
    calc = Calc(mspell)
    rows = damage_rows(spell, calc, ranks)
    cds = spell.get("cooldown", [])[:ranks]
    if cds and any(cds):
        rows.append(collapse({"label": "冷卻(秒)", "vals": [num(c) for c in cds], "note": ""}))
    cost = cost_row(spell, partype, calc, ranks)
    if cost:
        rows.append(cost)
    return rows
