"""Puts tools/ and its job folders on sys.path, so every script imports the others by bare name wherever it lives.

python3 -I adds no script folder, so each script first inserts tools/ itself, then `import toolpath`. The folders:
crawl/ (our Mayhem crawl and resg.top), fetch/ (Riot, CommunityDragon and wiki data into notes and _data/),
reason/ (augment tiers and item builds), vault/ (note upkeep and checks). See tools/README.md.
"""
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
for _d in (TOOLS, *(TOOLS / g for g in ("crawl", "fetch", "reason", "vault"))):
    if str(_d) not in sys.path:
        sys.path.insert(1, str(_d))
