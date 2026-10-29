"""Lists the Handbook cards whose text breaks the limits in Dev Tools/Layouts.md (Handbook card).

Each `## ` in a guide note is one card: its title, its body and a closing `**label：** tip` (the same split the plugin makes).
Full-width characters count 1, ASCII ½. Run from the repo root: python3 -I tools/check_cards.py
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from vault_paths import GUIDE  # noqa: E402

TITLE_MAX = 12   # one line
BODY_MAX = 36    # two lines
TIP_MAX = 16     # one line, beside its label
TIP = re.compile(r"^([\s\S]*?)\*\*([^*\n]{1,8})[:：]\*\*\s*([\s\S]+)$")
MARKUP = re.compile(r"\*\*|`|\[\[|\]\]")


def width(text: str) -> float:
    plain = MARKUP.sub("", text).strip()
    return sum(0.5 if ord(ch) < 128 else 1 for ch in plain)


def cards(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    if text.startswith("---"):
        head, _, text = text[3:].partition("\n---")
        if re.search(r"^layout:\s*list", head, re.M):
            return   # the glossary is a list, not cards
    for part in re.split(r"^## ", text, flags=re.M)[1:]:
        title, _, rest = part.partition("\n")
        lines = [l for l in rest.splitlines() if l.strip() and not re.match(r"^(icon|visual):", l)]
        yield title.strip(), "\n".join(lines).strip()


def main() -> int:
    bad = 0
    for path in sorted(pathlib.Path(GUIDE).glob("*.md")):
        for i, (title, body) in enumerate(cards(path), 1):
            m = TIP.match(body)
            main_text, tip = (m.group(1).strip(), m.group(3).strip()) if m else (body, "")
            over = [f"{name} {w:g}/{limit}" for name, w, limit in
                    (("title", width(title), TITLE_MAX), ("body", width(main_text), BODY_MAX), ("tip", width(tip), TIP_MAX)) if w > limit]
            if over:
                bad += 1
                print(f"{path.stem} {i:>2} {title}: {', '.join(over)}")
    print(f"{bad} card(s) over the limits")
    return 0


if __name__ == "__main__":
    sys.exit(main())
