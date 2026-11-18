"""The Mayhem crawler's terminal screens (tools/fetch_lcu.py): a full-screen menu, the live crawl dashboard and a pager.

Standard library only (ANSI escapes, termios). Everything is drawn into the terminal's alternate screen and redrawn in place,
so nothing scrolls: the menu, the dashboard and the pages replace each other, and the terminal is left as it was on exit.
Widths count CJK characters as two cells, so champion names line up.
"""
import os
import re
import select
import shutil
import sys
import termios
import time
import tty
import unicodedata

CSI = "\x1b["
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


# ---------- colour (256-colour, muted; meaning only) ----------

def _c(code):
    return lambda s: f"{CSI}{code}m{s}{CSI}0m"


BOLD = _c("1")
DIM = _c("38;5;244")
FAINT = _c("38;5;238")
TEXT = _c("38;5;252")
ACCENT = _c("38;5;214")      # the app's orange: the title, the selection
GOOD = _c("38;5;114")
WARN = _c("38;5;221")
BAD = _c("38;5;203")
INFO = _c("38;5;75")         # bars, the sparkline
INV = _c("38;5;234;48;5;214")


# ---------- text width (CJK = 2 cells, escapes = 0) ----------

def cells(ch):
    return 2 if unicodedata.east_asian_width(ch) in "WF" else 0 if unicodedata.combining(ch) else 1


def width(s):
    return sum(cells(ch) for ch in ANSI.sub("", s))


def fit(s, w):
    """s cut or padded to exactly w cells, keeping its colours; a cut ends in …"""
    if width(s) <= w:
        return s + " " * (w - width(s))
    out, used = [], 0
    for tok in re.split(f"({ANSI.pattern})", s):
        if ANSI.fullmatch(tok or "x"):
            out.append(tok)
            continue
        for ch in tok:
            if used + cells(ch) > w - 1:
                return "".join(out) + "…" + CSI + "0m" + " " * (w - 1 - used)
            out.append(ch)
            used += cells(ch)
    return "".join(out)


def right(left, rt, w):
    """left and rt on one line of w cells, rt flush right."""
    gap = w - width(left) - width(rt)
    return left + " " * gap + rt if gap >= 1 else fit(left, w - width(rt) - 1) + " " + rt


# ---------- small parts ----------

EIGHTHS = " ▏▎▍▌▋▊▉█"


def bar(frac, w, colour=INFO):
    """A smooth bar of w cells (eighth blocks), the rest a faint track."""
    frac = max(0.0, min(1.0, frac))
    full, part = divmod(int(frac * w * 8), 8)
    done = "█" * full + (EIGHTHS[part] if part and full < w else "")
    return colour(done) + FAINT("─" * (w - width(done)))


SPARK = "▁▂▃▄▅▆▇█"


def spark(values, w):
    vals = list(values)[-w:]
    if not vals or max(vals) <= 0:
        return FAINT("▁" * w)
    top = max(vals)
    s = "".join(SPARK[min(7, int(v / top * 7.999))] if v > 0 else " " for v in vals)
    return INFO(s.rjust(w, " "))


SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"


def spinner():
    return SPIN[int(time.time() * 10) % len(SPIN)]


def dur(s):
    s = max(0, int(s))
    if s >= 3600:
        return f"{s // 3600}h{s % 3600 // 60:02d}m"
    return f"{s // 60}m{s % 60:02d}s"


def num(n):
    return f"{n:,}"


def rule(w, title=""):
    if not title:
        return FAINT("─" * w)
    return DIM(f"─ {title} ") + FAINT("─" * max(0, w - width(title) - 3))


# ---------- the terminal ----------

class Screen:
    """The alternate screen in cbreak mode: draw(lines) repaints in place; key(timeout) reads one key or None."""

    def __enter__(self):
        self.fd = sys.stdin.fileno()
        self.saved = termios.tcgetattr(self.fd)
        tty.setcbreak(self.fd)
        sys.stdout.write(f"{CSI}?1049h{CSI}?25l{CSI}2J")
        sys.stdout.flush()
        return self

    def __exit__(self, *exc):
        termios.tcsetattr(self.fd, termios.TCSADRAIN, self.saved)
        sys.stdout.write(f"{CSI}0m{CSI}?25h{CSI}?1049l")
        sys.stdout.flush()

    @staticmethod
    def size():
        s = shutil.get_terminal_size((100, 30))
        return max(60, s.columns - 1), max(20, s.lines)   # one cell spare: writing the last column wraps in some terminals

    def draw(self, lines):
        w, h = self.size()
        body = [fit(l, w) for l in lines[:h]]
        sys.stdout.write(f"{CSI}H" + "\n".join(f"{l}{CSI}K" for l in body) + f"{CSI}J")
        sys.stdout.flush()

    def key(self, timeout=0.0):
        r, _, _ = select.select([self.fd], [], [], timeout)
        if not r:
            return None
        ch = os.read(self.fd, 1).decode("utf-8", "ignore")
        if ch != "\x1b":
            return {"\n": "enter", "\r": "enter", "\x7f": "backspace"}.get(ch, ch)
        r, _, _ = select.select([self.fd], [], [], 0.02)
        if not r:
            return "esc"
        seq = os.read(self.fd, 8).decode("utf-8", "ignore")
        return {"[A": "up", "[B": "down", "[C": "right", "[D": "left", "[5~": "pgup", "[6~": "pgdn", "OA": "up",
                "OB": "down"}.get(seq, "esc")


# ---------- menu ----------

def menu(scr, items, side, title, subtitle, at=0):
    """An arrow-key menu: items [(key, label, hint)], `side()` -> lines for the panel beside (or under) it. Returns a key."""
    side_lines, side_at = side(), time.time()
    while True:
        if time.time() - side_at > 5:
            side_lines, side_at = side(), time.time()
        w, h = scr.size()
        lines = [right(" " + ACCENT(BOLD("MAYHEM CRAWLER")) + DIM("  ·  " + subtitle), DIM(time.strftime("%H:%M ")), w), rule(w)]
        left = []
        for n, (key, label, hint) in enumerate(items):
            mark = ACCENT("▸ ") if n == at else "  "
            name = BOLD(label) if n == at else TEXT(label)
            left.append(f" {mark}{DIM(key)}  {fit(name, 22)}{DIM(hint)}")
        if w >= 100:
            lw = 56
            rows = max(len(left), len(side_lines))
            for i in range(rows):
                l = left[i] if i < len(left) else ""
                r = side_lines[i] if i < len(side_lines) else ""
                lines.append(fit(l, lw) + FAINT("│ ") + r)
        else:
            lines += left + [""] + side_lines
        lines += [""] * max(0, h - len(lines) - 2) + [rule(w), DIM(" ↑↓ move   ⏎ select   1–9 shortcut   q quit")]
        scr.draw(lines)
        k = scr.key(0.5)
        if k in ("up", "k"):
            at = (at - 1) % len(items)
        elif k in ("down", "j"):
            at = (at + 1) % len(items)
        elif k == "enter":
            return items[at][0], at
        elif k in ("q", "esc"):
            return "q", at
        elif k:
            for n, (key, _, _) in enumerate(items):
                if k == key:
                    return key, n


def ask(scr, title, prompt, default, header):
    """A one-line input under a header; Esc cancels (None), Enter takes the default when empty."""
    got = ""
    while True:
        w, h = scr.size()
        lines = header(w) + ["", " " + BOLD(title), "", f"  {prompt} " + ACCENT(got or DIM(str(default))) + ACCENT("▏"), "",
                             DIM("  ⏎ start   Esc back")]
        scr.draw(lines)
        k = scr.key(0.5)
        if k == "enter":
            return got or str(default)
        if k == "esc":
            return None
        if k == "backspace":
            got = got[:-1]
        elif k and len(k) == 1 and (k.isdigit() or k == "."):
            got += k


def pager(scr, title, text, header):
    """Text in a scrolling page: ↑↓ PgUp PgDn, q / Esc / ⏎ back."""
    raw = text.rstrip("\n").split("\n") or [""]
    top = 0
    while True:
        w, h = scr.size()
        room = h - 6
        lines = header(w) + [" " + BOLD(title), rule(w)]
        lines += [" " + TEXT(l) for l in raw[top:top + room]]
        lines += [""] * max(0, h - len(lines) - 2)
        more = f"{top + 1}–{min(len(raw), top + room)} of {len(raw)}" if len(raw) > room else ""
        lines += [rule(w), right(DIM(" ↑↓ scroll   q back"), DIM(more + " "), w)]
        scr.draw(lines)
        k = scr.key(0.5)
        if k in ("q", "esc", "enter", "backspace"):
            return
        if k in ("down", "j"):
            top = min(max(0, len(raw) - room), top + 1)
        elif k in ("up", "k"):
            top = max(0, top - 1)
        elif k == "pgdn":
            top = min(max(0, len(raw) - room), top + room)
        elif k == "pgup":
            top = max(0, top - room)


# ---------- the crawl dashboard ----------

def dashboard(st, w, h):
    """The live crawl screen from a state dict (fetch_lcu.Crawl.state())."""
    status, colour = st["status"], {"running": GOOD, "paused": WARN, "stopping": WARN, "stopped": TEXT}.get(st["mode"], DIM)
    dot = spinner() if st["mode"] == "running" else "■" if st["mode"] in ("stopping", "stopped") else "‖"
    head = " " + ACCENT(BOLD("MAYHEM CRAWLER")) + DIM(f"  ·  patch {st['patch']}  ·  ") + colour(f"{dot} {status}")
    lines = [right(head, DIM(f"elapsed {dur(st['elapsed'])} "), w), rule(w)]

    # progress: the patch toward Ready, then the time budget
    label = 24
    bw = max(10, w - label - 34)
    games, ready = st["patch_games"], st["ready"]
    eta = st["eta_ready"]
    ready_txt = (GOOD("Ready ✓") if games >= ready else
                 (DIM("ETA ") + TEXT(dur(eta)) if eta is not None else DIM("ETA —")))
    lines.append(right(f" {fit(TEXT(f'Patch {st['patch']} → Ready'), label)}{bar(games / max(1, ready), bw)} "
                       f"{BOLD(num(games))}{DIM(f' / {num(ready)}')}", ready_txt + " ", w))
    tb = st["budget"]
    lines.append(right(f" {fit(TEXT('This run'), label)}{bar(st['elapsed'] / max(1, tb), bw, DIM)} "
                       f"{TEXT(dur(st['elapsed']))}{DIM(' / ' + dur(tb))}", DIM("ends ") + TEXT(st["ends"]) + " ", w))
    lines.append(rule(w))

    # three columns: this run · speed · queue and client
    col = (w - 2) // 3
    rate = st["games_per_min"]
    c1 = [DIM("THIS RUN"),
          f"{GOOD('+' + num(st['new_games']))} games  {DIM('(' + num(st['new_full']) + ' full)')}",
          f"{TEXT('+' + num(st['new_samples']))} player samples",
          f"{TEXT(str(st['seen']))}{DIM(f' / {st['champions']} champions seen')}"]
    c2 = [DIM("SPEED  last 30 min"),
          spark(st["spark"], min(30, col - 2)),
          f"{BOLD(f'{rate:.1f}')} {DIM('games/min')}",
          f"{TEXT(num(int(st['samples_per_min'])))} {DIM('samples/min ·')} {TEXT(f'{st['latency']:.1f}')}{DIM(' s/call')}"]
    errs = st["errors"]
    c3 = [DIM("QUEUE · CLIENT"),
          f"{TEXT(num(st['queued']))} {DIM('waiting ·')} {TEXT(num(st['opens']))} {DIM('to open')}",
          f"{TEXT(num(st['reads']))} {DIM('read ·')} {TEXT(num(st['opened']))} {DIM('games opened')}",
          (GOOD("client ok") if not errs else BAD(f"{errs} errors")) + DIM(f"  ·  {st['phase'] or '—'}")]
    for a, b, c in zip(c1, c2, c3):
        lines.append(" " + fit(a, col) + fit(b, col) + fit(c, col))
    lines.append(rule(w, "THINNEST CHAMPIONS"))
    thin = "  ".join(f"{TEXT(n)} {DIM(str(c))}" for n, c in st["thinnest"]) or DIM("—")
    lines.append(" " + thin)
    lines.append(rule(w, "ACTIVITY"))
    room = max(3, h - len(lines) - 3)
    events = list(st["events"])[-room:]
    for t, kind, msg in events:
        mark = {"good": GOOD("●"), "warn": WARN("●"), "bad": BAD("●"), "dim": FAINT("·")}.get(kind, DIM("●"))
        lines.append(f" {DIM(t)}  {mark} {(DIM if kind == 'dim' else TEXT)(msg)}")
    lines += [""] * max(0, h - len(lines) - 2)
    now = st["now_doing"]
    keys = DIM(" p ") + TEXT("pause") + DIM("   q ") + TEXT("stop & save") + DIM("   r ") + TEXT("report")
    lines += [rule(w), right(keys, DIM(now + "  ") + GOOD("saved ✓ "), w)]
    return lines
