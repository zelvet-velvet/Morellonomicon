#!/usr/bin/env python3
"""Re-read the abilities (控場, 位移, 強化普攻 ...) of every champion note from the skill text already stored in it.

    python3 -I tools/retag_features.py

Use it after FEATURES in fetch_data.py changed and Data Dragon cannot be reached. Tags are only added, never removed;
the next fetch_data.py run recomputes them from the full spell text. Standard library only.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data  # noqa: E402

FEATURES = fetch_data.FEATURES


def retag(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"^skills: (\[.*\])$", text, re.M)
    if not m:
        return False
    skills = json.loads(m.group(1))
    for s in skills:
        blob = s.get("desc", "") + s.get("upgrade", "")
        s["tags"] = [n for n, rx in FEATURES.items() if n in s.get("tags", []) or re.search(rx, blob)]
    features = [n for n in FEATURES if any(n in s["tags"] for s in skills)]
    new = text.replace(m.group(0), "skills: " + json.dumps(skills, ensure_ascii=False))
    new = re.sub(r"^features: .*$", lambda _: "features: " + json.dumps(features, ensure_ascii=False), new, count=1, flags=re.M)
    if new == text:
        return False
    path.write_text(new, encoding="utf-8")
    return True


if __name__ == "__main__":
    changed = [p.stem for p in sorted((fetch_data.VAULT / "英雄").glob("*.md")) if retag(p)]
    print(f"retagged {len(changed)} champion notes")
