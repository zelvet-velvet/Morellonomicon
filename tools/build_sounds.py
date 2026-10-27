"""Build _data/sounds.json: how each common Chinese character is said (Mandarin pinyin, tones dropped).

The 速查 search uses it to find a champion when speech to text writes the right sounds with the wrong characters
(阿狸 for 阿璃, 卡特琳娜 for 卡特蓮娜). Source: Unicode's Unihan database (Unihan_Readings.txt: kMandarin for the usual reading,
kHanyuPinyin and kXHC1983 for the rarer ones), under the Unicode licence. Only characters in Big5 or GB2312 are kept (what Traditional or Simplified
speech to text writes), so the file stays small.

Usage:
    python3 -I tools/build_sounds.py                      # downloads Unihan.zip from unicode.org
    python3 -I tools/build_sounds.py path/to/Unihan_Readings.txt
"""
import io
import json
import re
import sys
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_data" / "sounds.json"
URL = "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip"
FIELDS = ("kMandarin", "kHanyuPinyin", "kXHC1983")


def plain(syllable: str) -> str:
    """lǘ -> lv, zhōng -> zhong: no tone marks, ü written v."""
    s = unicodedata.normalize("NFD", syllable.lower())
    s = s.replace("ü", "v")
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def readings(field: str, value: str) -> list[str]:
    if field == "kMandarin":
        return value.split()
    # kHanyuPinyin "10019.020:tiàn,tiān", kXHC1983 "1092.070:qiū"
    return [r for part in value.split() for r in part.split(":", 1)[-1].split(",")]


def common(ch: str) -> bool:
    for enc in ("big5", "gb2312"):
        try:
            ch.encode(enc)
            return True
        except UnicodeEncodeError:
            pass
    return False


def load(path: str | None) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    with urllib.request.urlopen(URL, timeout=120) as r:
        data = r.read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return z.read("Unihan_Readings.txt").decode("utf-8")


def main() -> None:
    text = load(sys.argv[1] if len(sys.argv) > 1 else None)
    version = re.search(r"Unicode Version (\d+\.\d+\.\d+)", text)
    sounds: dict[str, set[str]] = {}   # every reading
    main: dict[str, set[str]] = {}     # kMandarin only: how the character is normally said
    for line in text.splitlines():
        if not line.startswith("U+"):
            continue
        code, field, value = line.split("\t", 2)
        if field not in FIELDS:
            continue
        ch = chr(int(code[2:], 16))
        if not common(ch):
            continue
        for r in readings(field, value):
            p = plain(r)
            if re.fullmatch(r"[a-z]+", p):
                sounds.setdefault(ch, set()).add(p)
                if field == "kMandarin":
                    main.setdefault(ch, set()).add(p)

    def group(table: dict[str, set[str]]) -> dict[str, str]:
        by_sound: dict[str, list[str]] = {}
        for ch, ss in table.items():
            for s in ss:
                by_sound.setdefault(s, []).append(ch)
        return {s: "".join(sorted(chs)) for s, chs in sorted(by_sound.items())}

    rare = {ch: ss - main.get(ch, set()) for ch, ss in sounds.items()}
    rare = {ch: ss for ch, ss in rare.items() if ss}
    out = {
        "source": "Unicode Unihan database" + (f" {version.group(1)}" if version else "") + " (kMandarin, kHanyuPinyin, kXHC1983)",
        "chars": len(sounds),
        "sounds": group(main),   # names are matched on these
        "rare": group(rare),     # older or rarer readings: only for what was typed or said
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(sounds)} characters, {len(out['sounds'])} sounds, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
