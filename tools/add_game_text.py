"""Fill in what the game's own text and files give, for the champion notes that already exist, without regenerating them:
  - the passives' numbers (damage / heal / shield by champion level): `rows` / `levels` of the passive in the note's `skills:` line
  - the %生命傷害 tag (damage that is a share of the target's health) on every skill and passive that has it, and in `features:`

fetch_data.py does both for every champion it writes. This reads each champion's game data from the newest .cache/cdragon-bin-<day>
folder, each skill's id from the newest Data Dragon cache (.cache/ddragon/<patch>/champion/<id>.json), and the game text (about 32 MB,
downloaded once a day by fetch_data.game_text()). Run from the repo root:
    python3 -I tools/add_game_text.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data  # noqa: E402
import spells  # noqa: E402


def newest(pattern):
    found = sorted((fetch_data.ROOT / ".cache").glob(pattern), key=lambda p: [int(x) if x.isdigit() else x for x in re.split(r"[.-]", p.name)])
    return found[-1] if found else None


def spell_ids(cid):
    """The champion's Q W E R spell ids (Data Dragon, the newest cached patch), or []."""
    for folder in sorted((fetch_data.ROOT / ".cache" / "ddragon").glob("*"), key=lambda p: [int(x) for x in p.name.split(".") if x.isdigit()], reverse=True):
        path = folder / "champion" / f"{cid}.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))["data"][cid]
            return [s["id"] for s in data["spells"]]
    return []


def update(path, bins, strings):
    text = path.read_text(encoding="utf-8")
    m, cid = re.search(r"^skills: (\[.*\])$", text, re.M), re.search(r'^id: "(.*)"$', text, re.M)
    if not m or not cid:
        return False
    bin_file = bins / f"{cid.group(1).lower()}.json"
    ids = spell_ids(cid.group(1))
    if not bin_file.exists() or len(ids) != 4:
        return False
    bin_data = json.loads(bin_file.read_text(encoding="utf-8"))
    objs = spells.spell_objects(bin_data)
    skills = json.loads(m.group(1))
    by_key = {s.get("key"): s for s in skills}
    mspells = {"P": spells.passive_spell(bin_data), **{k: (objs.get(i.lower()) or {}).get("mSpell") or {} for k, i in zip("QWER", ids)}}
    passive = by_key.get("P")
    if not passive:
        return False
    rows, levels = spells.passive_rows(bin_data, strings)
    passive.pop("rows", None)
    passive.pop("levels", None)
    if rows:
        passive["rows"], passive["levels"] = rows, levels
    for key, ms in mspells.items():
        s = by_key.get(key)
        if s:
            has = spells.deals_percent_health(ms, strings)
            s["tags"] = [n for n in fetch_data.FEATURES if (n in s.get("tags", []) and n != spells.PERCENT_TAG) or (has and n == spells.PERCENT_TAG)]
    old = re.search(r"^features: (\[.*\])$", text, re.M)
    features = [n for n in fetch_data.FEATURES if (old and n in json.loads(old.group(1)) and n != spells.PERCENT_TAG) or (n == spells.PERCENT_TAG and any(n in s.get("tags", []) for s in skills))]
    new = text.replace(m.group(0), "skills: " + json.dumps(skills, ensure_ascii=False))
    if old:
        new = new.replace(old.group(0), "features: " + json.dumps(features, ensure_ascii=False))
    if new == text:
        return False
    path.write_text(new, encoding="utf-8")
    return True


if __name__ == "__main__":
    bins = newest("cdragon-bin-*")
    if not bins:
        sys.exit("no game data in .cache: run tools/fetch_data.py once first")
    strings = fetch_data.game_text()
    if not strings:
        sys.exit("no game text: cannot read the tooltips")
    changed = [p.stem for p in sorted((fetch_data.VAULT / fetch_data.folders.CHAMPIONS).glob("*.md")) if update(p, bins, strings)]
    tagged = sum(1 for p in (fetch_data.VAULT / fetch_data.folders.CHAMPIONS).glob("*.md") if f'"{spells.PERCENT_TAG}"' in p.read_text(encoding="utf-8"))
    print(f"{len(changed)} champion notes updated, {tagged} champions have the {spells.PERCENT_TAG} tag (game data: {bins.name})")
