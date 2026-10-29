"""Lists the app's hint and tip texts (Chinese sentences in plugin/src) in `Dev Tools/UI Text.md`, for Zaviel to edit.

Usage: python3 -I tools/list_ui_text.py

Each text is one line under its file, with what it is (placeholder, empty page, error ...). Edit the text in the note; "apply the UI
Text note" means: compare the note with its last commit and change each edited text in the code. Rerun this after code changes; a
rerun keeps nothing from the note (apply or commit edits first). Short words that are data (role and tag names, map keys) are left out.
Standard library only.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "plugin" / "src"
OUT = ROOT / "Dev Tools" / "UI Text.md"
MIN_CHARS = 4   # Chinese characters a text needs to count as a sentence, not a name

STRING = re.compile(r'"((?:[^"\\\n]|\\.)*)"|`([^`\n]*)`')
HAN = re.compile(r"[一-鿿]")
# what the text is, from the code around it (first match wins)
KINDS = [
    (re.compile(r"placeholder"), "placeholder"),
    (re.compile(r"empty\("), "empty page"),
    (re.compile(r"Notice\("), "pop-up"),
    (re.compile(r"RiotError|Error\("), "error"),
    (re.compile(r"aria-label"), "button name"),
    (re.compile(r"holdTip|tip\("), "hold tip"),
    (re.compile(r"setDesc|setName"), "setting"),
    (re.compile(r"title:"), "title"),
    (re.compile(r"text:"), "line"),
]


def texts():
    out = {}
    for f in sorted(SRC.rglob("*.ts")):
        for line in f.read_text(encoding="utf-8").splitlines():
            code = line.split(" // ")[0]
            if code.strip().startswith("//"):
                continue
            for m in STRING.finditer(code):
                s = m.group(1) if m.group(1) is not None else m.group(2)
                if len(HAN.findall(s)) < MIN_CHARS or code[m.end():].lstrip().startswith(":"):
                    continue
                kind = next((k for rx, k in KINDS if rx.search(code)), "text")
                out.setdefault(f.relative_to(SRC).as_posix(), []).append((kind, s.replace("\\n", " ")))
    return out


def main():
    found = texts()
    lines = ["---", "title: UI Text", "tags:", "  - morellonomicon", "  - dev-tools", "sticker: lucide//text-cursor-input", "---",
             "The app's hint and tip texts, by the file they are in (made by `tools/list_ui_text.py`). Edit a text after its `·`; keep one text per line. "
             "Then tell Claude **apply the UI Text note**: each changed line is changed in the code. `${…}` parts are filled in by the app (a number, a name): keep them.", ""]
    total = 0
    for path, items in found.items():
        seen, rows = set(), []
        for kind, s in items:
            if s in seen:
                continue
            seen.add(s)
            rows.append(f"- `{kind}` · {s}")
        if rows:
            lines += [f"## {path}", *rows, ""]
            total += len(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"{total} texts in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
