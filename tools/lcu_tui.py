"""The Mayhem crawler's terminal screens (tools/fetch_lcu.py): a full-screen menu, the live crawl dashboard and a pager.

Standard library only (ANSI escapes, termios). Everything is drawn into the terminal's alternate screen and redrawn in place,
so nothing scrolls: the menu, the dashboard and the pages replace each other, and the terminal is left as it was on exit.
Widths count CJK characters as two cells, so champion names line up. Nothing slow runs on the screen's thread: database
figures and client checks come from background threads (Live, the crawl's worker), and a frame is only written when it changed.
"""
import os
import re
import select
import shutil
import subprocess
import sys
import termios
import threading
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
        self.last, self.buf = None, b""
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
        frame = f"{CSI}H" + "\n".join(f"{fit(l, w)}{CSI}K" for l in lines[:h]) + f"{CSI}J"
        if frame != self.last:   # an unchanged frame is not rewritten: the terminal (Windows Terminal over WSL) stays idle
            self.last = frame
            sys.stdout.write(frame)
            sys.stdout.flush()

    def key(self, timeout=0.0):
        """One key, or None. Escape sequences are read whole and one at a time: a mouse-wheel notch in Windows Terminal
        sends several arrow codes in one burst (the alternate screen turns scrolling into arrows), and a click can send
        codes too. Unknown codes are dropped, never read as Esc; only a lone Esc byte is "esc"."""
        while True:
            if not self.buf:
                r, _, _ = select.select([self.fd], [], [], timeout)
                if not r:
                    return None
                self.buf += os.read(self.fd, 1024)
            k = self._next()
            if k is not None:
                return k
            timeout = 0   # dropped an unknown code: return whatever else is already there, without waiting again

    def _more(self, wait=0.03):
        r, _, _ = select.select([self.fd], [], [], wait)
        if r:
            self.buf += os.read(self.fd, 1024)
            return True
        return False

    def _next(self):
        b = self.buf
        if b[:1] != b"\x1b":
            n = 1 if b[0] < 0x80 else 2 if b[0] >> 5 == 6 else 3 if b[0] >> 4 == 14 else 4
            if len(b) < n:
                self._more()
                b = self.buf
            ch, self.buf = b[:n].decode("utf-8", "ignore"), b[n:]
            return {"\n": "enter", "\r": "enter", "\x7f": "backspace", "\x08": "backspace"}.get(ch, ch or None)
        if len(b) == 1 and not self._more():
            self.buf = b""
            return "esc"
        b = self.buf
        if b[1:2] not in (b"[", b"O"):   # Alt+key or a doubled Esc: drop the Esc, keep the rest
            self.buf = b[1:]
            return "esc" if b[1:2] == b"\x1b" else None
        i = 2
        while True:   # parameters, then one final byte 0x40-0x7e
            while i < len(self.buf) and not 0x40 <= self.buf[i] <= 0x7e:
                i += 1
            if i < len(self.buf) or not self._more():
                break
        seq, self.buf = self.buf[1:i + 1].decode("ascii", "ignore"), self.buf[i + 1:]
        if seq.startswith("[<"):   # SGR mouse report (if a terminal sends one): the wheel scrolls, the rest is ignored
            btn = seq[2:].split(";")[0]
            return {"64": "up", "65": "down"}.get(btn) if seq.endswith("M") else None
        return {"[A": "up", "[B": "down", "[C": "right", "[D": "left", "OA": "up", "OB": "down", "OC": "right",
                "OD": "left", "[5~": "pgup", "[6~": "pgdn", "[H": "home", "[F": "end", "OH": "home", "OF": "end",
                "[1~": "home", "[4~": "end"}.get(seq)


class Live:
    """fn() rerun every `every` seconds on a background thread; .value is the last result (or `first` until there is one).
    For figures that read the database or the client, so the screen never waits for them."""

    def __init__(self, fn, every, first=None):
        self.fn, self.every, self.value, self.at = fn, every, first, 0.0
        self.wake, self.done = threading.Event(), False
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while not self.done:
            try:
                self.value = self.fn()
            except Exception as e:   # shown, not raised: the menu keeps working
                self.value = [BAD(f"could not read: {e}")]
            self.at = time.time()
            self.wake.wait(self.every)
            self.wake.clear()

    def refresh(self):
        self.wake.set()

    def stop(self):
        self.done = True
        self.wake.set()


# ---------- menu ----------

def menu(scr, items, side, title, subtitle, at=0):
    """An arrow-key menu: items [(key, label, hint)] (key None: a group heading), `side` a Live of lines for the panel
    beside (or under) it. Returns (key, position)."""
    pick = [n for n, it in enumerate(items) if it[0]]
    at = at if at in pick else pick[0]
    while True:
        w, h = scr.size()
        lines = [right(" " + ACCENT(BOLD("MAYHEM CRAWLER")) + DIM("  ·  " + subtitle), DIM(time.strftime("%H:%M ")), w), rule(w)]
        left = []
        for n, (key, label, hint) in enumerate(items):
            if key is None:
                left.append(("" if n == 0 else "\n") + "   " + DIM(label.upper()))
                continue
            mark = ACCENT("▸ ") if n == at else "  "
            name = BOLD(ACCENT(label)) if n == at else TEXT(label)
            left.append(f" {mark}{DIM(key)}  {fit(name, 24)}{DIM(hint)}")
        left = [part for l in left for part in l.split("\n")]
        side_lines = side.value or [DIM(spinner() + " reading the database…")]
        if w >= 100:
            lw = 58
            for i in range(max(len(left), len(side_lines))):
                l = left[i] if i < len(left) else ""
                r = side_lines[i] if i < len(side_lines) else ""
                lines.append(fit(l, lw) + FAINT("│ ") + r)
        else:
            lines += left + [""] + side_lines
        lines += [""] * max(0, h - len(lines) - 2) + [rule(w), DIM(" ↑↓ move   ⏎ select   0–9 shortcut   q quit")]
        scr.draw(lines)
        k = scr.key(0.25)
        if k in ("up", "k"):
            at = pick[(pick.index(at) - 1) % len(pick)]
        elif k in ("down", "j"):
            at = pick[(pick.index(at) + 1) % len(pick)]
        elif k == "enter":
            return items[at][0], at
        elif k in ("q", "esc"):
            return "q", at
        elif k:
            for n, (key, _, _) in enumerate(items):
                if key and k == key:
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


def run_steps(scr, title, steps, header, done_note=""):
    """Run commands one after another, their output live on screen; steps [(label, argv)]. Esc stops the running one.
    Returns True when every step ended well. The last screen stays until a key."""
    out, state = [], ["…"] * len(steps)
    ok, t0 = True, time.time()
    for n, (label, argv) in enumerate(steps):
        state[n] = "run"
        proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        reader = threading.Thread(target=lambda: [out.append(l.rstrip("\n")) for l in proc.stdout], daemon=True)
        reader.start()
        while proc.poll() is None or reader.is_alive():
            _steps_screen(scr, title, steps, state, out, header, time.time() - t0, running=True)
            if scr.key(0.15) == "esc":
                proc.terminate()
                out.append("stopped by you")
        state[n] = "ok" if proc.returncode == 0 else "bad"
        if proc.returncode != 0:
            ok = False
            state[n + 1:] = ["skip"] * (len(steps) - n - 1)
            break
    if done_note and ok:
        out += ["", done_note]
    _steps_screen(scr, title, steps, state, out, header, time.time() - t0, running=False)
    while scr.key(1) is None:
        pass
    return ok


def _steps_screen(scr, title, steps, state, out, header, el, running):
    w, h = scr.size()
    marks = {"…": FAINT("○"), "run": INFO(spinner()), "ok": GOOD("✓"), "bad": BAD("✗"), "skip": FAINT("–")}
    lines = header(w) + [right(" " + BOLD(title), DIM(dur(el) + " "), w), ""]
    for (label, argv), st in zip(steps, state):
        lines.append(f"   {marks[st]} {fit((TEXT if st != 'skip' else DIM)(label), 28)}{FAINT(' '.join(a.rsplit('/', 1)[-1] for a in argv[1:] if not a.startswith('-')))}")
    lines += ["", rule(w, "OUTPUT")]
    room = max(3, h - len(lines) - 2)
    lines += [" " + (BAD if l.startswith(("Traceback", "stop", "no ")) else TEXT)(l) for l in out[-room:]]
    lines += [""] * max(0, h - len(lines) - 2)
    lines += [rule(w), DIM(" Esc stop") if running else DIM(" any key: back to the menu")]
    scr.draw(lines)


# ---------- the crawl dashboard ----------


# The live crawl screen, top to bottom:
#   title line        patch · status · elapsed
#   two progress bars the patch toward Ready (with ETA), this run's time budget (with the end time)
#   four panels       THIS RUN (what was added) · SPEED · CRAWL (queue and work done) · CLIENT
#   champions         how many champions have enough samples (bands up to `sure`), and the thinnest ones
#   activity log      fixed columns: time, type, then the message; a long message wraps under its own column
#   key line          the keys, and what the crawl is doing right now

TAGS = {"read": INFO, "games": GOOD, "patch": GOOD, "start": GOOD, "queue": TEXT, "pause": WARN, "resume": GOOD,
        "stop": WARN, "client": WARN, "error": BAD, "info": DIM}
TAG_W = 7


def pairs(title, rows, w):
    """A panel of label → value rows, the values flush right in w cells."""
    out = [rule(w - 1, title)]
    for label, value in rows:
        out.append(right(" " + DIM(label), value, w - 1))
    return out


def event_lines(events, w, room, back=0):
    """The log entries that fit in room lines, oldest first, ending `back` entries before the newest; each a fixed
    TIME  TYPE  message row."""
    msg_w = max(20, w - 11 - TAG_W - 3)
    out = []
    events = list(events)
    for t, kind, tag, msg in reversed(events[:len(events) - back] if back else events):
        colour = DIM if kind == "dim" else BAD if kind == "bad" else TEXT
        tagc = TAGS.get(tag, DIM)
        chunks = wrap(msg, msg_w)
        rows = [f" {DIM(t)}  {fit(tagc(tag), TAG_W)}  {colour(chunks[0])}"]
        rows += [" " * (13 + TAG_W) + colour(c) for c in chunks[1:]]
        if len(out) + len(rows) > room:
            break
        out = rows + out
    return out


def wrap(text, w):
    """text in pieces of at most w cells, cut at spaces when it can."""
    out, line = [], ""
    for word in text.split(" "):
        while width(word) > w:   # a word longer than the line (a path): hard cut
            if line:
                out.append(line)
                line = ""
            cut, used = 0, 0
            while cut < len(word) and used + cells(word[cut]) <= w:
                used += cells(word[cut])
                cut += 1
            out.append(word[:cut])
            word = word[cut:]
        cand = f"{line} {word}" if line else word
        if width(cand) <= w:
            line = cand
        else:
            out.append(line)
            line = word
    return out + [line] if line or not out else out


def dashboard(st, w, h):
    """The live crawl screen from a state dict (fetch_lcu.Crawl.state())."""
    colour = {"running": GOOD, "paused": WARN, "stopping": WARN, "stopped": TEXT}.get(st["mode"], DIM)
    dot = spinner() if st["mode"] == "running" else "■" if st["mode"] in ("stopping", "stopped") else "‖"
    head = (" " + ACCENT(BOLD("MAYHEM CRAWLER")) + DIM(f"  ·  patch {st['patch']}  ·  ") + colour(f"{dot} {st['status']}"))
    lines = [right(head, DIM("elapsed ") + TEXT(dur(st["elapsed"])) + " ", w), rule(w)]

    # progress toward Ready, and the time budget
    label, tail = 22, 26
    bw = max(10, w - label - tail - 4)
    games, ready = st["patch_games"], st["ready"]
    if games >= ready:
        ready_txt = GOOD("Ready ✓")
    elif st["eta_ready"] is not None:
        ready_txt = DIM("Ready in ") + TEXT(dur(st["eta_ready"]))
    else:
        ready_txt = DIM("Ready in —")
    lines.append(right(f" {fit(TEXT('Patch ' + st['patch']), label)}{bar(games / max(1, ready), bw)} "
                       f"{BOLD(num(games))}{DIM(' / ' + num(ready))}", ready_txt + " ", w))
    lines.append(right(f" {fit(TEXT('This run' + (' (until Ready)' if st['until_ready'] else '')), label)}"
                       f"{bar(st['elapsed'] / max(1, st['budget']), bw, DIM)} {TEXT(dur(st['elapsed']))}{DIM(' / ' + dur(st['budget']))}",
                       DIM("ends ") + TEXT(st["ends"]) + " ", w))
    lines.append("")

    # four panels (two rows of two below 100 cells)
    rate, per_read = st["games_per_min"], st["new_per_read"]
    speed = [("games / min", BOLD(f"{rate:.1f}")), ("samples / min", TEXT(num(int(st["samples_per_min"])))),
             ("new games / player", TEXT(f"{per_read:.2f}")), ("", "")]
    crawl = [("players read", TEXT(num(st["reads"]))), ("games opened", TEXT(num(st["opened"]))),
             ("players waiting", TEXT(num(st["queued"])) + DIM(f" (+{num(st['opens'])} games)")),
             ("skipped · refills", TEXT(num(st["skipped"])) + DIM(" · ") + TEXT(str(st["reseeds"])))]
    phase = st["phase"] or "—"
    client = [("state", (GOOD("● ok") if not st["errors"] else WARN("● retrying")) + DIM(" · ") + TEXT(phase)),
              ("calls", TEXT(num(st["calls"]))), ("s / call", TEXT(f"{st['latency']:.2f}")),
              ("errors", (BAD if st["errors"] else DIM)(str(st["errors"])))]
    cols = 4 if w >= 100 else 2
    cw = (w - 1) // cols
    this_run = [("new games", GOOD("+" + num(st["new_games"]))), ("full games", TEXT("+" + num(st["new_full"]))),
                ("player samples", TEXT("+" + num(st["new_samples"]))),
                ("patch full games", TEXT(num(st["patch_full"])) + DIM(f"  {st['patch_full'] / max(1, games):.0%}"))]
    panels = [pairs("THIS RUN", this_run, cw),
              pairs("SPEED", speed, cw), pairs("CRAWL", crawl, cw), pairs("CLIENT", client, cw)]
    # the sparkline goes in SPEED's empty last row
    panels[1][-1] = " " + spark(st["spark"], cw - 14) + DIM(" last 30 min")
    for i in range(0, 4, cols):
        group = panels[i:i + cols]
        for r in range(max(len(p) for p in group)):
            lines.append(" " + "".join(fit(p[r] if r < len(p) else "", cw) for p in group))
    lines.append("")

    # champions: bands by samples, and the thinnest
    ch = st["champ"]
    if ch is None:
        lines += [rule(w, "CHAMPIONS"), " " + DIM(spinner() + " counting samples per champion…")]
    else:
        sure = ch["sure"]
        lines.append(rule(w, f"CHAMPIONS  {ch['seen']} / {ch['total']} seen · median {num(ch['median'])} samples · "
                             f"sure at {num(sure)}"))
        left_w = 44 if w >= 100 else w - 2
        band = []
        for name, n in ch["bands"]:
            band.append(f" {fit(DIM(name), 14)}{TEXT(str(n).rjust(4))}  {bar(n / max(1, ch['total']), left_w - 22, INFO)}")
        thin = ch["thin"]
        per_col = 4
        tw = 18
        thin_cols = max(1, min(3, (w - left_w - 4) // tw)) if w >= 100 else max(1, (w - 2) // tw)
        tlines = []
        for r in range(per_col):
            row = ""
            for c in range(thin_cols):
                k = c * per_col + r
                if k < len(thin):
                    n, cnt = thin[k]
                    tone = BAD if cnt < sure / 6 else WARN if cnt < sure else TEXT
                    row += fit(TEXT(n), tw - 7) + tone(num(cnt).rjust(5)) + "  "
            tlines.append(row)
        if w >= 100:
            lines.append(" " + fit(DIM("SAMPLES PER CHAMPION"), left_w) + FAINT("│ ") + DIM("THINNEST"))
            for r in range(max(len(band), per_col)):
                lines.append(fit(band[r] if r < len(band) else "", left_w + 1) + FAINT("│ ") + (tlines[r] if r < len(tlines) else ""))
        else:
            lines += band + [" " + DIM("THINNEST")] + [" " + t for t in tlines]
    lines.append("")

    # activity log
    back = st.get("log_back", 0)
    lines.append(rule(w, "ACTIVITY" + (f"  ·  scrolled back {back} · End or ↓ for the newest" if back else "")))
    lines.append(" " + DIM(fit("TIME", 10)) + DIM(fit("TYPE", TAG_W + 2)) + DIM("WHAT HAPPENED"))
    room = max(3, h - len(lines) - 2)
    log = event_lines(st["events"], w, room, back)
    lines += log + [""] * (room - len(log))
    keys = (DIM(" p ") + TEXT("pause") + DIM("   q ") + TEXT("stop & save") + DIM("   r ") + TEXT("report")
            + DIM("   ↑↓ wheel ") + TEXT("scroll log"))
    now = st["now_doing"]
    lines += [rule(w), right(keys, (INFO(spinner() + " ") + DIM(now) if now else "") + "  " + GOOD("saved ✓ "), w)]
    return lines
