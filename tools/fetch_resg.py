"""Cache resg.top's ARAM Mayhem numbers (games and wins per champion and per augment on each champion) for tools/augment_tiers.py.

resg.top publishes no licence, so its numbers are only read here as evidence for our own tiers: they go to the git-ignored
.cache/resg/<patch>/ and never into the repo or a note. One file per champion, fetched one at a time.

    python3 -I tools/fetch_resg.py            # the newest patch resg has
    python3 -I tools/fetch_resg.py 16.21      # a given patch
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "resg"
API = "https://cdn.resg.top/api/v1"
UA = {"User-Agent": "Morellonomicon (github.com/zelvet-velvet)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read().decode("utf-8")


def module(text):
    """The site's files are JavaScript modules: `export default {...}`."""
    return json.loads(text[text.index("export default") + len("export default"):].strip().rstrip(";"))


def main():
    versions = module(get(f"{API}/versions.js"))
    patch = sys.argv[1] if len(sys.argv) > 1 else versions[0]["version"]
    meta = next((v for v in versions if v["version"] == patch), None)
    if not meta:
        sys.exit(f"resg has no patch {patch} (has {', '.join(v['version'] for v in versions)})")
    out = CACHE / patch
    (out / "champions").mkdir(parents=True, exist_ok=True)
    for name in ("champions", "augments"):
        (out / f"{name}.json").write_text(json.dumps(module(get(f"{API}/versions/{patch}/{name}.js")), ensure_ascii=False), encoding="utf-8")
    champs = json.loads((out / "champions.json").read_text(encoding="utf-8"))["items"]
    failed = []
    for c in champs:
        try:
            data = module(get(f"{API}/versions/{patch}/champions/{c['id']}.js"))
            (out / "champions" / f"{c['id']}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except Exception as e:   # one champion missing only leaves that champion to the reasoning alone
            failed.append(f"{c['id']} ({e})")
        time.sleep(0.3)
    (out / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    print(f"resg {patch} (collected {meta['collectedAt'][:10]}): {len(champs) - len(failed)} champions cached in {out.relative_to(ROOT)}")
    if failed:
        print("failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
