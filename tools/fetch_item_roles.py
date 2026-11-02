"""Write _data/item-roles.json: which of the item shop's class tabs (Fighter, Marksman, Assassin, Mage, Tank, Support) each item is
listed under, from the League of Legends Wiki's item data (Module:ItemData/data, its `menu` flags, kept by the wiki's editors to
match the in-game shop). Data Dragon has no such thing, so the Items page's role tabs use this file (CC BY-SA 3.0, credited there).
Standard library only.

    python3 -I tools/fetch_item_roles.py
"""
import datetime
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_data" / "item-roles.json"
SOURCE = "https://wiki.leagueoflegends.com/en-us/Module:ItemData/data"
ROLE = {"fighter": "戰士", "marksman": "射手", "assassin": "刺客", "mage": "法師", "tank": "坦克", "support": "輔助"}   # the shop's tab order
UA = "Morellonomicon/0.1 (+https://github.com/zelvet-velvet/Morellonomicon)"


def parse(lua):
    """{item id: [roles]} from the module's Lua table: each top-level item's ["id"] and the true flags of its ["menu"] block."""
    out, item_id, roles, depth, menu_depth = {}, None, [], 0, None
    for line in lua.splitlines():
        if depth == 1 and re.match(r'\s*\["[^"]+"\]\s*=\s*\{', line):   # an item starts
            item_id, roles = None, []
        m = re.match(r'\s*\["id"\]\s*=\s*(\d+)', line)
        if m and depth == 2:
            item_id = m.group(1)
        if re.match(r'\s*\["menu"\]\s*=\s*\{', line):
            menu_depth = depth + 1
        if menu_depth is not None and depth >= menu_depth:
            m = re.match(r'\s*\["(\w+)"\]\s*=\s*true', line)
            if m and m.group(1) in ROLE:
                roles.append(ROLE[m.group(1)])
        depth += line.count("{") - line.count("}")
        if menu_depth is not None and depth < menu_depth:
            menu_depth = None
        if depth == 1 and item_id:   # the item ended
            if roles:
                out[item_id] = [r for r in ROLE.values() if r in roles]
            item_id, roles = None, []
    return out


def main():
    req = urllib.request.Request(SOURCE + "?action=raw", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        lua = r.read().decode("utf-8")
    roles = parse(lua)
    if not roles:
        sys.exit("no item roles found: the wiki's module may have changed its layout")
    OUT.write_text(json.dumps({"date": datetime.date.today().isoformat(), "source": SOURCE, "license": "CC BY-SA 3.0 (League of Legends Wiki)",
                               "order": list(ROLE.values()), "items": roles}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(roles)} items with a shop class -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
