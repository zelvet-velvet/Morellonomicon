#!/usr/bin/env python3
"""Read Riot's official zh-TW patch notes and write a short summary of each into _data/patches.json.

    python3 tools/fetch/fetch_patch_notes.py            # the last 12 patches
    python3 tools/fetch/fetch_patch_notes.py --patches 24 --refresh

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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # python3 -I adds no script folder: tools/ here,
import toolpath  # noqa: E402,F401  (...and toolpath adds the job folders, so the scripts import each other by name)
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


CHANGE_ANY = re.compile(r"^(.*?)[：:]\s*(.+?)\s*(?:⇒|→)\s*(.+)$")   # label：old ⇒ new (Riot also writes →)
LABEL_TEXT = re.compile(r"^([^：:]{1,24})[：:]\s*(.+)$")              # label：words (a change without numbers)
KNOWN = set()   # augment names from the augment notes: a name with a colon in it (升級：雷霆風暴) is still a name


ALIASES = {}   # Riot's name -> the game's name (tools/data/augment-aliases.json)


def note_name(name):
    """The augment note's name for a name in Riot's notes (alias, or the colon dropped), else the name unchanged."""
    if name in ALIASES:
        return ALIASES[name]
    for n in (name, name.replace("：", "").replace(":", ""), name.split("：")[-1].split(":")[-1]):
        if n in KNOWN:
            return n
    return name


def is_known(text):
    """An augment name as Riot writes it: the note's name, or with its colon (升級：雷霆風暴 = 升級雷霆風暴, 任務：專精輔助 = 專精輔助)."""
    t = text.replace(" ", "")
    return t in ALIASES or t in KNOWN or t.replace("：", "").replace(":", "") in KNOWN or t.split("：")[-1].split(":")[-1] in KNOWN


def known_names():
    import vault_paths
    folder = fd.ROOT / vault_paths.AUGMENTS
    return {f.stem for f in folder.glob("*.md")} if folder.exists() else set()


def entries(lines):
    """Riot's Mayhem blocks list entries as a short name line (`新增 ` before a new one, a rarity before it in older notes), then
    `label：old ⇒ new` lines, `label：words` lines or description sentences. A line ending in ： names a group for the lines under it."""
    out, cur, group = [], None, ""
    for _, text in lines:
        text = text.strip()
        if not text:
            continue
        m = CHANGE_ANY.match(text)
        if m and cur is not None and not is_known(text):
            label = f"{group} {m.group(1)}".strip() if group else m.group(1).strip()
            cur["changes"].append({"label": label, "old": m.group(2).strip(), "new": m.group(3).strip()})
            continue
        if text.endswith(("：", ":")) and len(text) <= 24:
            group = text[:-1].strip()
            continue
        rarity = next((r for r in RARITIES if text.startswith(r)), "")
        name, is_new = text[len(rarity):].strip(), False
        if name.startswith("新增 ") and not LABEL_TEXT.match(name):
            name, is_new = name[3:].strip(), True
        if is_known(name) or (name and len(name) <= NAME_MAX and not LABEL_TEXT.match(name) and not name.endswith(("。", "？", "?"))):
            cur = {"name": name, "rarity": rarity, "new": is_new, "text": "", "changes": []}
            out.append(cur)
            group = ""
            continue
        lt = LABEL_TEXT.match(text)
        if cur is None and lt:   # "超萌咖啡廳：補包效果變得特別強。": a name and its text on one line
            out.append({"name": lt.group(1).strip(), "rarity": "", "new": False, "text": lt.group(2).strip(), "changes": []})
        elif cur is not None and lt and not text.endswith("。"):
            cur["changes"].append({"label": f"{group} {lt.group(1)}".strip() if group else lt.group(1).strip(), "old": "", "new": lt.group(2).strip()})
        elif cur is not None:
            cur["text"] = (cur["text"] + " " + text).strip()
    return out


def as_note_entry(e):
    return {"name": e["name"], "changes": e["changes"][:MAX_CHANGES], "more": max(0, len(e["changes"]) - MAX_CHANGES)}


def mayhem(lines):
    """The Mayhem section, block by block (h3 / h4): new augments (rarity, name, Riot's text), removed augment names, changed
    augments and champion changes (name + label old ⇒ new lines), and 主秀英雄 (the patch's featured twists)."""
    blocks, title = [], ""
    for tag, text in lines:
        if tag in ("h3", "h4"):
            title = text
            blocks.append((title, []))
        elif blocks:
            blocks[-1][1].append((tag, text))
    new, removed, changed, champions, featured = [], [], [], [], []
    rar = {"稜鏡級": "稜鏡", "金級": "金", "銀級": "銀"}
    for title, body in blocks:
        if "主秀" in title:
            for e in entries(body):
                text = e["text"] or "；".join(f"{c['label']}：{c['old']} ⇒ {c['new']}" if c["old"] else f"{c['label']}：{c['new']}" for c in e["changes"])
                featured.append({"name": e["name"], "text": text, "new": e["new"]})
        elif "英雄" in title:
            champions += [as_note_entry(e) for e in entries(body) if e["changes"]]
        elif "移除" in title and "增幅" in title:
            removed += [note_name(t.strip()) for _, t in body if t.strip() and len(t.strip()) <= NAME_MAX]
        elif "增幅" in title or title in rar or any(r in title for r in RARITIES):
            all_new = "新增" in title or "全新" in title
            block_rarity = next((v for k, v in rar.items() if k in title), "")
            last_rarity = block_rarity
            for e in entries(body):
                if e["rarity"]:
                    last_rarity = rar.get(e["rarity"], "")
                e["name"] = note_name(e["name"])
                if e["new"] or all_new:
                    new.append({"rarity": last_rarity, "name": e["name"], "text": e["text"]})
                elif e["changes"] or e["text"]:
                    if e["text"] and not e["changes"]:
                        e["changes"] = [{"label": "說明", "old": "", "new": e["text"]}]
                    changed.append(as_note_entry(e))
    return {"augments_new": new, "augments_removed": removed, "augments_changed": changed, "mayhem_champions": champions,
            "mayhem_featured": featured}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--patches", type=int, default=12)
    ap.add_argument("--refresh", action="store_true", help="download the pages again")
    args = ap.parse_args()
    KNOWN.update(known_names())
    ALIASES.update({k: v for k, v in json.loads((Path(__file__).resolve().parents[1] / "data" / "augment-aliases.json").read_text(encoding="utf-8")).items() if not k.startswith("_")})
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
                entry.update(mayhem(lines))
        print(f"{a['patch']}: {len(entry.get('champions', []))} champions, {len(entry.get('items', []))} items; Mayhem: "
              f"{len(entry.get('augments_new', []))} new / {len(entry.get('augments_changed', []))} changed / "
              f"{len(entry.get('augments_removed', []))} removed augments, {len(entry.get('mayhem_champions', []))} champions, "
              f"{len(entry.get('mayhem_featured', []))} featured")
        if a is listing[0] and KNOWN:   # only the newest patch: older notes name augments that have left the game
            unknown = [x["name"] for x in entry.get("augments_new", []) + entry.get("augments_changed", []) if x["name"] not in KNOWN]
            if unknown:
                print(f"  ! augments not in {len(KNOWN)} notes (add to tools/data/augment-aliases.json if renamed): {', '.join(unknown)}")
        out.append(entry)
    path = fd.ROOT / "_data" / "patches.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({"date": datetime.date.today().isoformat(), "source": LIST_URL, "patches": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
