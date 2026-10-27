#!/usr/bin/env python3
"""Read Riot's official zh-TW patch notes and write a short summary of each into _data/patches.json.

    python3 tools/fetch_patch_notes.py            # the last 3 patches
    python3 tools/fetch_patch_notes.py --patches 6 --refresh

Per patch: Riot's own one-line blurb, the headline image's address (the app shows it from Riot's site; it is not copied into
the repo), a link to the full notes, and a short list of what changed: champions and items (name, the numbers before => after),
and from the Mayhem section the new augments with Riot's effect text and the removed augments. The full notes stay on Riot's site.
Pages are cached in .cache/riot-news/ (a patch's page is read once). Standard library only.
"""
import argparse
import datetime
import html
import json
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import fetch_data as fd   # noqa: E402

BASE = "https://www.leagueoflegends.com"
LIST_URL = f"{BASE}/zh-tw/news/tags/patch-notes/"
UA = "Mozilla/5.0 (compatible; Morellonomicon/0.1; +https://github.com/zelvet-velvet/Morellonomicon)"
PAUSE = 1.0              # seconds between page downloads
IMAGE_WIDTH = 800        # the headline image is requested at this width
MAX_CHANGES = 4          # numbers listed per champion / item (the rest is counted)
RARITIES = ("稜鏡級", "金級", "銀級")
CHANGE = re.compile(r"^(.*?)[：:]\s*(.+?)\s*⇒\s*(.+)$")
NAME_MAX = 16            # an augment name is short and does not end with 。
BLOCK = {"p", "li", "div", "h1", "h2", "h3", "h4", "h5", "h6", "br", "ul", "ol", "tr", "blockquote"}


def get(url, cache_name, refresh=False):
    path = fd.ROOT / ".cache" / "riot-news" / cache_name
    if path.exists() and not refresh:
        return path.read_text(encoding="utf-8")
    time.sleep(PAUSE)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        text = r.read().decode("utf-8", errors="replace")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return text


def next_data(page):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    return json.loads(m.group(1)) if m else {}


def articles(data):
    """Patch note entries from the list page: title, url, blurb, image, date."""
    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("title"), str) and o["title"].endswith("版本更新公告") and "action" in o:
                yield o
            for v in o.values():
                yield from walk(v)
        elif isinstance(o, list):
            for v in o:
                yield from walk(v)
    seen, out = set(), []
    for a in walk(data):
        m = re.search(r"(\d+\.\d+)", a["title"])
        if not m or m.group(1) in seen:
            continue
        seen.add(m.group(1))
        desc = a.get("description")
        blurb = html.unescape(re.sub(r"<[^>]+>", "", desc.get("body", ""))) if isinstance(desc, dict) else ""
        url = a["action"]["payload"]["url"]
        img = (a.get("media") or {}).get("url", "")
        out.append({"patch": m.group(1), "title": a["title"], "url": url if url.startswith("http") else BASE + url, "summary": blurb.strip(),
                    "image": (img + ("&" if "?" in img else "?") + f"w={IMAGE_WIDTH}&auto=format") if img else "", "date": a.get("publishedAt", "")[:10]})
    return out


class Lines(HTMLParser):
    """Flatten the article into (heading tag or '', text) lines, one per block element."""
    def __init__(self):
        super().__init__()
        self.lines, self.cur, self.head = [], "", ""

    def flush(self):
        t = re.sub(r"\s+", " ", html.unescape(self.cur)).strip()
        if t:
            self.lines.append((self.head, t))
        self.cur = ""

    def handle_starttag(self, tag, attrs):
        if tag in BLOCK:
            self.flush()
            self.head = tag if tag in ("h2", "h3", "h4") else ""

    def handle_endtag(self, tag):
        if tag in BLOCK:
            self.flush()
            self.head = ""

    def handle_data(self, data):
        self.cur += data


def read_lines(page):
    start = page.find('id="patch-notes-container"')
    p = Lines()
    p.feed(page[start:] if start >= 0 else page)
    p.flush()
    return p.lines


def sections(lines):
    """[(h2 title, [lines])]"""
    out = []
    for tag, text in lines:
        if tag == "h2":
            out.append((text, []))
        elif out:
            out[-1][1].append((tag, text))
    return out


def change_list(lines):
    """[{name, changes: [{label, old, new}], more}] from h3 headings followed by 'label：old ⇒ new' lines."""
    out, cur, group = [], None, ""
    for tag, text in lines:
        if tag == "h3":
            cur = {"name": text, "changes": [], "more": 0}
            out.append(cur)
            group = ""
            continue
        m = CHANGE.match(text)
        if cur is not None and m and "⇒" in text:
            label = (f"{group} {m.group(1)}" if group else m.group(1)).strip()
            if len(cur["changes"]) < MAX_CHANGES:
                cur["changes"].append({"label": label, "old": m.group(2).strip(), "new": m.group(3).strip()})
            else:
                cur["more"] += 1
        elif cur is not None and "：" not in text and len(text) <= 24 and not text.endswith("。"):
            group = text
    return [c for c in out if c["changes"] or c["more"]]


def mayhem(lines):
    """New augments (rarity, name, Riot's effect text), removed augment names, and any champion changes of the Mayhem section."""
    new, removed, block, rarity = [], [], "", ""
    pending = None
    for tag, text in lines:
        if tag in ("h3", "h4"):
            block, rarity, pending = text, "", None
            continue
        if "新增" in block and "增幅" in block or "全新增幅" in block:
            for r in RARITIES:
                if text.startswith(r):
                    rarity, text = r, text[len(r):].strip()
                    break
            if not text:
                continue
            if len(text) <= NAME_MAX and not text.endswith("。"):
                pending = {"rarity": rarity, "name": text, "text": ""}
                new.append(pending)
            elif pending is not None:
                pending["text"] = (pending["text"] + " " + text).strip()
        elif "移除" in block and "增幅" in block:
            if len(text) <= NAME_MAX:
                removed.append(text)
    return new, removed


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--patches", type=int, default=3)
    ap.add_argument("--refresh", action="store_true", help="download the pages again")
    args = ap.parse_args()
    listing = articles(next_data(get(LIST_URL, "list.html", True)))
    out = []
    for a in listing[: args.patches]:
        page = get(a["url"], f"{a['patch']}.html", args.refresh and a is listing[0])
        secs = sections(read_lines(page))
        entry = dict(a)
        entry["sections"] = [t for t, _ in secs if t not in ("相關文章", "最低系統需求")]
        for title, lines in secs:
            if title == "英雄":
                entry["champions"] = change_list(lines)
            elif title == "道具":
                entry["items"] = change_list(lines)
            elif "大混戰" in title:
                entry["augments_new"], entry["augments_removed"] = mayhem(lines)
                entry["mayhem_champions"] = change_list(lines)
        print(f"{a['patch']}: {len(entry.get('champions', []))} champions, {len(entry.get('items', []))} items, "
              f"{len(entry.get('augments_new', []))} new / {len(entry.get('augments_removed', []))} removed augments")
        out.append(entry)
    path = fd.ROOT / "_data" / "patches.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({"date": datetime.date.today().isoformat(), "source": LIST_URL, "patches": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
