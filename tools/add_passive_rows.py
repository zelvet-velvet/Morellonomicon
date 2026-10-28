"""Fill in the passives' numbers (damage / heal / shield by champion level) of the champion notes, from game files already downloaded.

fetch_data.py does this for every champion it writes. This is the quick way for notes that already exist: it reads each champion's
game data from the newest .cache/cdragon-bin-<day> folder and the game text (about 32 MB, downloaded once a day by fetch_data.game_text()),
and rewrites only the passive's `rows` / `levels` in the note's `skills:` line. Run from the repo root:
    python3 -I tools/add_passive_rows.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data  # noqa: E402
import spells  # noqa: E402


def newest_bin_folder():
    folders = sorted((fetch_data.ROOT / ".cache").glob("cdragon-bin-*"))
    return folders[-1] if folders else None


def update(path, bins, strings):
    text = path.read_text(encoding="utf-8")
    m, cid = re.search(r"^skills: (\[.*\])$", text, re.M), re.search(r'^id: "(.*)"$', text, re.M)
    if not m or not cid:
        return False
    bin_file = bins / f"{cid.group(1).lower()}.json"
    if not bin_file.exists():
        return False
    skills = json.loads(m.group(1))
    passive = next((s for s in skills if s.get("key") == "P"), None)
    if not passive:
        return False
    rows, levels = spells.passive_rows(json.loads(bin_file.read_text(encoding="utf-8")), strings)
    passive.pop("rows", None)
    passive.pop("levels", None)
    if rows:
        passive["rows"], passive["levels"] = rows, levels
    new = text.replace(m.group(0), "skills: " + json.dumps(skills, ensure_ascii=False))
    if new == text:
        return False
    path.write_text(new, encoding="utf-8")
    return True


if __name__ == "__main__":
    bins = newest_bin_folder()
    if not bins:
        sys.exit("no game data in .cache: run tools/fetch_data.py once first")
    strings = fetch_data.game_text()
    if not strings:
        sys.exit("no game text: cannot read the passives' tooltips")
    changed = [p.stem for p in sorted((fetch_data.VAULT / fetch_data.folders.CHAMPIONS).glob("*.md")) if update(p, bins, strings)]
    print(f"passive numbers written for {len(changed)} champion notes (game data: {bins.name})")
