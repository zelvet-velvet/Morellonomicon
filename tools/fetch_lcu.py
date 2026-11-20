#!/usr/bin/env python3
"""Collect ARAM Mayhem games (champion, win, items, augments) through the League client running on this PC.

Riot's Match-V5 API lists no Mayhem games (queue 2400, tested 2026-11-18), but the client's own local API (LCU) shows them
in any player's match history. This script only reads (GET), waits between calls, and stops by itself on repeated errors.
Riot does not officially support the LCU: run it on a small account. The numbers stay in the git-ignored
.cache/mayhem.sqlite (offline, one file) until Zaviel decides whether they may be shown.

    python3 -I tools/fetch_lcu.py --hours 8          # overnight: the client must be open and logged in
    python3 -I tools/fetch_lcu.py --summary          # what the database holds for the newest patch
    python3 -I tools/fetch_lcu.py --summary 16.22 --export   # also write .cache/lcu/mayhem-stats-16.22.json
    python3 -I tools/fetch_lcu.py --import-json .cache/lcu/16.22   # load games saved as one JSON file each

Crawl: start from the logged-in player's newest Mayhem game; read each player's last 20 games (a slow call, ~4 s: each entry
holds that player's champion, items and augments), then open every unseen Mayhem game of the patch in it (a fast call, 0.23 s:
ten samples and nine more players to read). The client answers history calls one at a time, so calls go out one by one.
Samples are keyed by game and participant, so one player is never counted twice in a game. The database holds no names and no
player ids: players already read are kept only as a salted hash, to skip them for a while.

In a terminal it is a full-screen app (tools/lcu_tui.py): a menu (crawl; make and open the tiers page, or rebuild the tiers
from the crawl first; the database; the client), then a live dashboard while crawling (progress toward the patch's Ready count,
this run, speed, the crawl's queue, the client, samples per champion and the thinnest, an aligned activity log; p pause,
q stop, r browser report). --plain, or output to a file, logs a progress line every few minutes instead.
Standard library only.
"""
import argparse
import base64
import hashlib
import json
import os
import random
import sqlite3
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder (lcu_tui, datalib)

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / ".cache" / "mayhem.sqlite"
EXPORT_DIR = ROOT / ".cache" / "lcu"
LOCKFILES = ("/mnt/c/Riot Games/League of Legends/lockfile", "C:/Riot Games/League of Legends/lockfile")
WIN_CURL = "/mnt/c/Windows/system32/curl.exe"   # from WSL the Windows localhost is reached through Windows' own curl
MAYHEM = 2400
MIN_DURATION = 300          # seconds; shorter games are remakes
DELAY = 0.3                 # seconds between calls. Measured 2026-11-18: a player's history takes ~4 s (the client answers
                            # them one at a time, so parallel calls do not help), a full game 0.23 s for ten samples
OPEN_PER_READ = 20          # every unseen Mayhem game of the patch in a history is opened: the fast call, ten samples each
REREAD_HOURS = 12           # a player read less than this long ago is skipped
MAX_ERRORS = 5              # consecutive throttled or failed calls before stopping
CLIENT_WAIT = 600           # seconds to wait for a closed client to come back before stopping
LOG_EVERY = 300             # seconds between progress lines
MIN_GAMES = 30              # fewer games than this are marked "too few" in the summary
RESEED_GAMES = 10           # recent full games reopened, at most, when no players are left to read
RESEED_ENOUGH = 20          # ... stopping once this many players are queued
GUARD_EVERY = 60           # seconds between checks of the logged-in account and the game state
PAUSE_CHECK = 60            # seconds between checks while paused
BUSY_PHASES = ("ChampSelect", "GameStart", "InProgress", "Reconnect", "WaitingForStats")


class ClientGone(Exception):
    pass


class Client:
    """GET-only access to the local client; rereads the lockfile when the client restarts."""

    def __init__(self, delay):
        self.delay, self.last = delay, 0.0
        self.check = None   # set by the crawl: called after every reconnect, before any other call goes out
        self.calls, self.errors, self.times = 0, 0, deque(maxlen=20)   # for the dashboard

    def connect(self):
        path = os.environ.get("LOL_LOCKFILE") or next((p for p in LOCKFILES if Path(p).exists()), None)
        if not path or not Path(path).exists():
            raise ClientGone("no lockfile: the client is not running")
        _, _, port, pw, proto = Path(path).read_text(encoding="utf-8").strip().split(":")
        self.base, self.pw = f"{proto}://127.0.0.1:{port}", pw

    def _raw(self, path):
        t = time.time()
        try:
            return self._call(path)
        finally:
            self.calls += 1
            self.times.append(time.time() - t)

    def _call(self, path):
        url = self.base + path
        if sys.platform != "win32" and Path(WIN_CURL).exists():
            try:
                r = subprocess.run([WIN_CURL, "-s", "-k", "-w", "\n%{http_code}", "-u", f"riot:{self.pw}", url],
                                   capture_output=True, timeout=60)
            except subprocess.TimeoutExpired:   # a stalled call (the client busy, Riot's history server slow): wait and retry
                raise ClientGone("no answer in 60 s") from None   # from None: the traceback would print the client's password
            if r.returncode != 0:
                raise ClientGone(f"curl exit {r.returncode}")
            body, _, code = r.stdout.decode("utf-8", "replace").rpartition("\n")
            return int(code), body
        auth = base64.b64encode(f"riot:{self.pw}".encode()).decode()
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
        try:
            with urllib.request.urlopen(req, timeout=60, context=ssl._create_unverified_context()) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            raise ClientGone(str(e))

    def get(self, path):
        """The JSON at path, or None for 404. Retries throttling, waits for a restarted client, else stops."""
        errors, gone_since = 0, None
        while True:
            wait = self.delay - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            try:
                if gone_since is not None or not hasattr(self, "base"):
                    self.connect()
                    if self.check:
                        self.check(self._raw("/lol-summoner/v1/current-summoner"))
                code, body = self._raw(path)
                gone_since = None
            except ClientGone as e:
                gone_since = gone_since or time.time()
                if time.time() - gone_since > CLIENT_WAIT:
                    raise SystemExit(f"stop: the client has been unreachable for {CLIENT_WAIT // 60} minutes ({e})")
                log(f"client unreachable ({e}), waiting")
                time.sleep(30)
                continue
            if code == 200:
                return json.loads(body)
            if code == 404:
                return None
            errors += 1
            self.errors += 1
            if errors >= MAX_ERRORS or code in (401, 403):
                raise SystemExit(f"stop: {path.split('?')[0]} -> HTTP {code} {body[:150]}")
            pause = 30 * 2 ** errors
            log(f"HTTP {code}, pausing {pause} s")
            time.sleep(pause)


LOG_HOOK = None   # the dashboard's activity panel while it is on screen


def log(msg, kind="warn"):
    if LOG_HOOK:
        LOG_HOOK(msg, kind, "client")
    else:
        print(time.strftime("%H:%M:%S"), msg, flush=True)


def patch_of(version):
    return ".".join(version.split(".")[:2])


def patch_key(patch):
    return tuple(int(x) for x in patch.split(".") if x.isdigit())


def open_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA temp_store=MEMORY")   # sorts in memory: a temp B-tree on /mnt/c (WSL) is many times slower
    db.execute("PRAGMA cache_size=-65536")
    items = ", ".join(f"item{k} INTEGER" for k in range(7))
    augs = ", ".join(f"aug{k} INTEGER" for k in range(1, 7))
    db.executescript(f"""
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS games (game_id INTEGER PRIMARY KEY, patch TEXT, version TEXT, created INTEGER,
            duration INTEGER, full INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS players (game_id INTEGER, pid INTEGER, team INTEGER, champ INTEGER, win INTEGER,
            {items}, {augs}, source TEXT, PRIMARY KEY (game_id, pid));
        CREATE TABLE IF NOT EXISTS readers (hash TEXT PRIMARY KEY, read_at INTEGER);
        CREATE INDEX IF NOT EXISTS games_patch ON games (patch);
        CREATE INDEX IF NOT EXISTS players_champ ON players (champ);
    """)
    if not db.execute("SELECT 1 FROM meta WHERE key='salt'").fetchone():
        db.execute("INSERT INTO meta VALUES ('salt', ?)", (os.urandom(16).hex(),))
        db.commit()
    return db


def player_row(game_id, p, source):
    st = p.get("stats", {})
    return (game_id, p["participantId"], p.get("teamId"), p.get("championId"), int(bool(st.get("win"))),
            *[st.get(f"item{k}", 0) for k in range(7)], *[st.get(f"playerAugment{k}", 0) for k in range(1, 7)], source)


PLAYER_SQL = "INSERT OR {} INTO players VALUES (" + ", ".join("?" * 19) + ")"


def save_game_row(db, g, full):
    db.execute("INSERT INTO games VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(game_id) DO UPDATE SET full = max(full, excluded.full)",
               (g["gameId"], patch_of(g.get("gameVersion", "")), g.get("gameVersion", ""), g.get("gameCreation", 0) // 1000,
                g.get("gameDuration", 0), full))


class Crawl:
    def __init__(self, db, client, patch):
        known = [r[0] for r in db.execute("SELECT DISTINCT patch FROM games WHERE patch != ''")]
        self.db, self.c = db, client
        self.patch = patch or max(known, key=patch_key, default=None)   # the newest patch already collected
        self.salt = db.execute("SELECT value FROM meta WHERE key='salt'").fetchone()[0]
        self.frontier, self.queued = deque(), set()
        self.reads = self.details = self.samples = self.skipped = self.new_games = self.new_full = 0
        self.account = None   # hash of the logged-in account the crawl started on
        self.status, self.mode, self.phase, self.now_doing = "starting", "running", "", ""
        self.events = deque(maxlen=300)   # (time, kind, tag, message) for the activity log
        self.reseeds = 0
        self.log_back = 0   # how many log entries the activity log is scrolled back (0: following the newest)
        self.base = self.base_full = 0   # the patch's games when the run started (or the patch changed); + new_games
        self.per_minute = {}   # minute -> new games, for the speed sparkline
        self.snaps = deque()   # (time, patch games, samples) every 10 s, for the rates

    def event(self, msg, kind="", tag="info"):
        """A line in the activity log: kind colours the message (good, warn, bad, dim), tag is its TYPE column."""
        self.events.append((time.strftime("%H:%M:%S"), kind, tag, msg))
        if self.log_back:   # scrolled back: keep the same entries on screen while new ones arrive
            self.log_back = min(self.log_back + 1, len(self.events) - 1)
        if LOG_HOOK is None:
            log(msg)

    def hash(self, puuid):
        return hashlib.sha256((self.salt + puuid).encode()).hexdigest()[:32]

    def recently_read(self, puuid):
        row = self.db.execute("SELECT read_at FROM readers WHERE hash=?", (self.hash(puuid),)).fetchone()
        return bool(row) and time.time() - row[0] < REREAD_HOURS * 3600

    def enqueue(self, puuid):
        h = self.hash(puuid)
        if puuid and h not in self.queued and not self.recently_read(puuid):
            self.queued.add(h)
            self.frontier.append(puuid)

    def current(self, version):
        """Follow the newest patch seen: a game of a newer patch moves the crawl to it."""
        p = patch_of(version)
        if p and (not self.patch or patch_key(p) > patch_key(self.patch)):
            if self.patch:
                self.event(f"new patch {p}: now collecting it", "good", "patch")
            self.patch = p
            self.recount()
        return p == self.patch

    # the calls (any thread) and what is saved from them (the main thread: SQLite stays on one thread)
    def fetch_history(self, puuid):
        return self.c.get(f"/lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex=20") or {}

    def fetch_game(self, game_id):
        return self.c.get(f"/lol-match-history/v1/games/{game_id}")

    def mayhem_games(self, data):
        games = [g for g in data.get("games", {}).get("games", []) if g.get("queueId") == MAYHEM]
        for g in sorted(games, key=lambda g: g.get("gameCreation", 0)):
            self.current(g.get("gameVersion", ""))
        return games

    def known(self, game_id):
        row = self.db.execute("SELECT full FROM games WHERE game_id=?", (game_id,)).fetchone()
        return None if row is None else row[0]

    def count_new(self, before, full):
        if before is None:
            self.new_games += 1
            minute = int(time.time() // 60)
            self.per_minute[minute] = self.per_minute.get(minute, 0) + 1
        if full and not before:
            self.new_full += 1

    def save_history(self, puuid, data):
        games = self.mayhem_games(data)
        self.reads += 1
        self.db.execute("INSERT OR REPLACE INTO readers VALUES (?, ?)", (self.hash(puuid), int(time.time())))
        for g in games:
            if g.get("gameDuration", 0) < MIN_DURATION or patch_of(g.get("gameVersion", "")) != self.patch:
                continue
            p = (g.get("participants") or [None])[0]
            if p and "participantId" in p:
                self.count_new(self.known(g["gameId"]), 0)
                save_game_row(self.db, g, 0)
                self.samples += self.db.execute(PLAYER_SQL.format("IGNORE"), player_row(g["gameId"], p, "list")).rowcount
        self.db.commit()
        return games

    def save_game(self, game_id, d):
        self.details += 1
        if not d:
            return
        for pi in d.get("participantIdentities", []):
            self.enqueue(pi.get("player", {}).get("puuid"))
        if d.get("gameDuration", 0) >= MIN_DURATION and patch_of(d.get("gameVersion", "")) == self.patch:
            self.count_new(self.known(game_id), 1)
            save_game_row(self.db, d, 1)
            for p in d.get("participants", []):
                self.samples += self.db.execute(PLAYER_SQL.format("REPLACE"), player_row(game_id, p, "game")).rowcount
        else:
            save_game_row(self.db, d, 1)
        self.db.commit()

    def unopened(self, games):
        out = []
        for g in sorted(games, key=lambda g: -g.get("gameCreation", 0)):
            if patch_of(g.get("gameVersion", "")) != self.patch or g.get("gameDuration", 0) < MIN_DURATION:
                continue
            if not self.known(g["gameId"]):
                out.append(g["gameId"])
        return out

    def seed(self):
        me = self.c.get("/lol-summoner/v1/current-summoner")
        if not me:
            raise SystemExit("stop: no logged-in player in the client")
        self.account = self.hash(me["puuid"])
        self.c.check = self.same_account
        games = self.mayhem_games(self.fetch_history(me["puuid"]))
        if not games:
            raise SystemExit("stop: the logged-in account has no Mayhem games to start from; play one or log in to another")
        newest = max(games, key=lambda g: g.get("gameCreation", 0))
        d = self.c.get(f"/lol-match-history/v1/games/{newest['gameId']}") or {}
        for pi in d.get("participantIdentities", []):
            self.enqueue(pi.get("player", {}).get("puuid"))

    def reseed_ids(self):
        """Out of players: some recent full games of this patch to reopen for their players (main thread: the database)."""
        rows = [gid for gid, in self.db.execute("SELECT game_id FROM games WHERE patch=? AND full=1 ORDER BY created DESC "
                                                "LIMIT 50", (self.patch,))]
        random.shuffle(rows)
        return rows[:RESEED_GAMES]

    def fetch_players(self, game_ids):
        """The worker's half of a refill: each game's players, until enough are found (no database here)."""
        out = []
        for gid in game_ids:
            d = self.c.get(f"/lol-match-history/v1/games/{gid}") or {}
            out += [pi.get("player", {}).get("puuid") for pi in d.get("participantIdentities", [])]
            if len(out) >= RESEED_ENOUGH * 2:
                break
        return out

    def reseed(self, puuids):
        self.reseeds += 1
        for puuid in puuids:
            self.enqueue(puuid)
        if self.frontier:
            self.event(f"queue refilled from recent games: {len(self.frontier)} players", "", "queue")
        return bool(self.frontier)

    def same_account(self, response):
        """Called with the raw (code, body) of /current-summoner right after the client (re)connects."""
        code, body = response
        try:
            ok = code == 200 and self.hash(json.loads(body).get("puuid", "")) == self.account
        except ValueError:
            ok = False
        if not ok:
            raise SystemExit("stop: a different account (or none) is logged in to the client; the crawl only runs "
                             "on the account it started on")

    def busy_phase(self):
        """Stops if another account logged in; the client's phase when the player is in champion select or a game, else None."""
        self.same_account(self.c._raw("/lol-summoner/v1/current-summoner"))
        self.phase = self.c.get("/lol-gameflow/v1/gameflow-phase") or ""
        self.phase = "idle" if self.phase == "None" else self.phase
        return self.phase if self.phase in BUSY_PHASES else None

    # ---------- figures for the dashboard and the log ----------
    def recount(self):
        """The patch's games from the database: at the start and when the patch changes; after that new_games adds up."""
        self.base, self.base_full = self.db.execute("SELECT count(*), coalesce(sum(full), 0) FROM games WHERE patch=?",
                                                    (self.patch,)).fetchone()
        self.base_new, self.base_new_full = self.new_games, self.new_full

    def patch_counts(self):
        """(games, full games) of the patch, without a query: the count at the start plus what this run added."""
        return (self.base + self.new_games - getattr(self, "base_new", 0),
                self.base_full + self.new_full - getattr(self, "base_new_full", 0))

    def champion_figures(self):
        """Samples per champion on the patch (the Live thread, its own read-only connection; about 1 s on /mnt/c)."""
        import datalib
        if not hasattr(self, "_ro"):
            self._ro = datalib.read_only(DB)
            self._names = names("CHAMPIONS", "key")
            try:
                self._sure = json.loads((EXPORT_DIR / "cache" / self.patch / "meta.json").read_text())["sure_games"]
            except Exception:
                self._sure = 600
        seen = dict(self._ro.execute("SELECT p.champ, count(*) FROM games g CROSS JOIN players p ON p.game_id = g.game_id "
                                     "WHERE g.patch=? GROUP BY p.champ", (self.patch,)).fetchall())
        counts = sorted((seen.get(k, 0), n) for k, n in self._names.items())
        sure = self._sure
        cuts = [(f"under {sure // 6}", 0, sure // 6), (f"{sure // 6}–{sure // 2 - 1}", sure // 6, sure // 2),
                (f"{sure // 2}–{sure - 1}", sure // 2, sure), (f"{sure}+ (sure)", sure, 10 ** 9)]
        return {"seen": sum(1 for c, _ in counts if c), "total": len(counts), "sure": sure,
                "median": counts[len(counts) // 2][0] if counts else 0,
                "bands": [(name, sum(1 for c, _ in counts if lo <= c < hi)) for name, lo, hi in cuts],
                "thin": [(n, c) for c, n in counts[:12]]}

    def rates(self):
        """games and samples per minute over the last 10 minutes of this run."""
        now = time.time()
        games = self.patch_counts()[0]
        if not self.snaps or now - self.snaps[-1][0] >= 10:
            self.snaps.append((now, games, self.samples))
        while self.snaps and now - self.snaps[0][0] > 600:
            self.snaps.popleft()
        t, g, s = self.snaps[0]
        mins = max((now - t) / 60, 1 / 60)
        return (games - g) / mins, (self.samples - s) / mins

    def state(self):
        games, full = self.patch_counts()
        gpm, spm = self.rates()
        el = time.time() - self.t0
        eta = (self.ready - games) / gpm * 60 if gpm > 0 and el >= 60 and games < self.ready else None
        minute = int(time.time() // 60)
        champ = self.champs.value if getattr(self, "champs", None) else None
        return {"patch": self.patch or "?", "status": self.status, "mode": self.mode, "elapsed": el,
                "budget": self.hours * 3600, "ends": time.strftime("%H:%M", time.localtime(self.t0 + self.hours * 3600)),
                "until_ready": self.until_ready, "patch_games": games, "patch_full": full, "ready": self.ready,
                "eta_ready": eta, "new_games": self.new_games, "new_full": self.new_full, "new_samples": self.samples,
                "new_per_read": self.new_games / max(1, self.reads), "champ": champ,
                "spark": [self.per_minute.get(m, 0) for m in range(minute - 29, minute + 1)], "games_per_min": gpm,
                "samples_per_min": spm, "calls": self.c.calls,
                "latency": sum(self.c.times) / len(self.c.times) if self.c.times else 0, "queued": len(self.frontier),
                "opens": len(self.opens), "reads": self.reads, "opened": self.details, "skipped": self.skipped,
                "reseeds": self.reseeds, "errors": self.c.errors, "phase": self.phase, "events": self.events,
                "now_doing": self.now_doing, "log_back": self.log_back}

    # ---------- the crawl ----------
    def run(self, hours, samples=0, until_ready=False, screen=None):
        """Crawl until the time budget, the sample target or (until_ready) the patch's Ready count. With a screen: the live
        dashboard (p pause, q stop, r browser report); without one: a progress line in the log every few minutes.
        Every client call goes to the one worker thread (a history read, a game, the account / game-state check, a queue
        refill), so the screen keeps answering keys; the database stays on this thread (one SQLite connection)."""
        global LOG_HOOK
        import lcu_tui as ui
        from concurrent.futures import ThreadPoolExecutor, wait
        self.t0 = time.time()
        self.hours, self.target, self.opens, self.until_ready = hours, samples, deque(), until_ready
        try:
            import datalib
            self.ready = datalib.lifecycle()["ready_games"]
        except Exception:
            self.ready = 3000
        LOG_HOOK = self.event if screen else None
        draw = (lambda: screen.draw(ui.dashboard(self.state(), *screen.size()))) if screen else (lambda: None)
        self.status, self.now_doing = "connecting", "reading your newest Mayhem game"
        self.event("connecting to the client", "", "start")
        if self.patch:
            self.recount()
        if screen:
            self.patch = self.patch or "?"
            draw()
        self.seed()
        self.recount()
        if screen:
            self.champs = ui.Live(self.champion_figures, 20)
        self.event(f"patch {self.patch} · {len(self.frontier)} players queued · up to {fmt_time(hours * 3600)}"
                   + (" or until Ready" if until_ready else ""), "good", "start")
        pool = ThreadPoolExecutor(max_workers=1)   # one call at a time: the client queues them anyway
        job, opening, stop, user_pause, busy = None, set(), None, False, None
        last_guard = last_log = last_draw = 0.0
        try:
            while True:
                now = time.time()
                key = screen.key(0.05) if screen else None
                if key == "p":
                    user_pause = not user_pause
                    self.event("paused by you" if user_pause else "resumed", "warn" if user_pause else "good",
                               "pause" if user_pause else "resume")
                elif key in ("up", "down", "pgup", "pgdn", "home", "end"):   # arrows and the mouse wheel scroll the log
                    step = {"up": 1, "down": -1, "pgup": 10, "pgdn": -10, "home": len(self.events), "end": -len(self.events)}[key]
                    self.log_back = max(0, min(len(self.events) - 1, self.log_back + step))
                elif key == "q" and not stop:   # only q: Esc is too easy to send by accident (a stray escape code)
                    stop = "stopped by you"
                    self.event("stopping: finishing the current call", "warn", "stop")
                elif key == "r":
                    subprocess.Popen([sys.executable, "-I", str(ROOT / "tools" / "mn.py"), "report"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    self.event("dashboard opened in the browser")
                if not stop:
                    if now - self.t0 >= hours * 3600:
                        stop = "the time budget is used"
                    elif samples and self.samples >= samples:
                        stop = f"{samples} samples collected"
                    elif until_ready and self.patch_counts()[0] >= self.ready:
                        stop = f"patch {self.patch} is Ready"
                if stop and job is None:
                    break
                paused = busy or user_pause
                self.mode = "stopping" if stop else "paused" if paused else "running"
                self.status = ("stopping" if stop else f"paused · {busy}" if busy else "paused" if user_pause else "running")
                if job is None and not stop:
                    if now - last_guard >= (PAUSE_CHECK if busy else GUARD_EVERY):
                        last_guard = now
                        job = (pool.submit(self.busy_phase), "guard", None)
                        self.now_doing = "checking the client"
                    elif paused:
                        pass
                    elif self.opens:
                        gid = self.opens.popleft()
                        job = (pool.submit(self.fetch_game, gid), "open", gid)
                        self.now_doing = "opening a game"
                    else:
                        while self.frontier and self.recently_read(self.frontier[0]):
                            self.frontier.popleft()
                            self.skipped += 1
                        if self.frontier:
                            p = self.frontier.popleft()
                            job = (pool.submit(self.fetch_history, p), "read", p)
                            self.now_doing = "reading a player's history"
                        elif getattr(self, "refilled", False):
                            stop = "no more players to read"
                        else:
                            job = (pool.submit(self.fetch_players, self.reseed_ids()), "refill", None)
                            self.now_doing = "refilling the queue from recent games"
                if job and job[0].done():
                    fut, kind, arg = job
                    job = None
                    res = fut.result()   # a SystemExit from the call (account changed, client gone) ends the crawl here
                    if kind == "guard":
                        was, busy = busy, res
                        if busy and not was:
                            self.event(f"paused while you play ({busy})", "warn", "pause")
                        elif was and not busy:
                            self.event("your game is over: crawling again", "good", "resume")
                    elif kind == "refill":
                        self.reseed(res)
                        self.refilled = not self.frontier   # a refill that found nobody new ends the crawl next time
                    elif kind == "read":
                        self.refilled = False
                        before = self.new_games
                        games = self.save_history(arg, res)
                        todo = [g for g in self.unopened(games) if g not in opening][:OPEN_PER_READ]
                        self.opens.extend(todo)
                        opening.update(todo)
                        new = self.new_games - before
                        ours = sum(1 for g in games if patch_of(g.get("gameVersion", "")) == self.patch)
                        self.event(f"player {num(self.reads):>7}  {ours:>2} Mayhem  {new:>2} new  {len(todo):>2} to open  "
                                   f"queue {num(len(self.frontier)):>6}",
                                   "" if new or todo else "dim", "read")
                    else:
                        opening.discard(arg)
                        self.save_game(arg, res)
                    games_now = self.patch_counts()[0]
                    if games_now // 100 > getattr(self, "milestone", games_now // 100):
                        self.event(f"{num(games_now // 100 * 100)} games of {self.patch}"
                                   + (" · Ready ✓" if games_now >= self.ready else f" · {num(self.ready - games_now)} to Ready"),
                                   "good", "games")
                    self.milestone = games_now // 100
                    self.now_doing = ""
                if not screen and job and not job[0].done():
                    wait([job[0]], timeout=0.5)
                if screen and now - last_draw >= 0.1:
                    last_draw = now
                    draw()
                elif not screen and now - last_log >= LOG_EVERY:
                    last_log = now
                    self.progress()
                if not screen and not job and self.mode != "running":
                    time.sleep(1)
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
            if getattr(self, "champs", None):
                self.champs.stop()
            self.mode, self.status, self.now_doing = "stopped", f"stopped · {stop or 'error'}", ""
            self.event(f"stopped: {stop or 'error'}. Everything is saved.", "good" if stop else "bad", "stop" if stop else "error")
            LOG_HOOK = None
            if screen:
                draw()
            else:
                self.progress("done")
        return stop

    def progress(self, word="progress"):
        games, full = self.patch_counts()
        mins = (time.time() - self.t0) / 60
        log(f"{word}: +{self.new_games} games, +{self.samples} samples this run ({self.samples / max(mins, 0.01):.0f}/min); "
            f"patch {self.patch} holds {games} games ({full} full) | {self.reads} players read, {self.details} games opened, "
            f"{len(self.frontier)} queued, {mins:.0f} min")


def num(n):
    return f"{n:,}"


def fmt_time(s):
    s = int(s)
    return f"{s // 3600}h{s % 3600 // 60:02d}m" if s >= 3600 else f"{s // 60}m{s % 60:02d}s"


def import_json(db, folder):
    """Games saved by the first test crawl: one JSON file each, players in participant order."""
    n = 0
    for f in sorted(Path(folder).glob("*.json")):
        g = json.loads(f.read_text(encoding="utf-8"))
        gid = int(f.stem)
        db.execute("INSERT OR IGNORE INTO games VALUES (?, ?, ?, 0, ?, 1)", (gid, patch_of(g["version"]), g["version"], g["duration"]))
        for pid, p in enumerate(g["players"], 1):
            n += db.execute(PLAYER_SQL.format("IGNORE"), (gid, pid, p["team"], p["champ"], int(p["win"]), *p["items"],
                                                          *p["augments"], "game")).rowcount
    db.commit()
    print(f"imported {n} samples from {folder}")


def names(folder, key):
    """id -> name from the notes' frontmatter (英雄 by `key`, 強化 by `id`)."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import vault_paths   # noqa: E402
    import re
    out = {}
    for f in (ROOT / getattr(vault_paths, folder)).glob("*.md"):
        head = f.read_text(encoding="utf-8")[:800]
        k, n = re.search(rf"^{key}: *\"?(\d+)\"?$", head, re.M), re.search(r'^name: *"?([^"\n]+)', head, re.M)
        if k and n:
            out[int(k.group(1))] = n.group(1)
    return out


def summary(db, patch, export):
    patch = patch or (db.execute("SELECT patch FROM games WHERE patch != '' ORDER BY created DESC LIMIT 1").fetchone() or [None])[0]
    if not patch:
        sys.exit("the database is empty")
    q = lambda sql, *a: db.execute(sql, (patch, *a)).fetchall()   # noqa: E731
    base = "FROM players p JOIN games g USING (game_id) WHERE g.patch=?"
    (n, games, full), = q(f"SELECT count(*), count(DISTINCT game_id), count(DISTINCT CASE WHEN g.full THEN game_id END) {base}")
    champs = q(f"SELECT champ, count(*), sum(win) {base} GROUP BY champ ORDER BY 2 DESC")
    aug_union = " UNION ALL ".join(f"SELECT champ, aug{k} AS aug, win {base} AND aug{k} > 0" for k in range(1, 7))
    augs = db.execute(f"SELECT aug, count(*), sum(win) FROM ({aug_union}) GROUP BY aug ORDER BY 2 DESC", (patch,) * 6).fetchall()
    cn, an = names("CHAMPIONS", "key"), names("AUGMENTS", "id")
    counts = sorted(c[1] for c in champs)
    print(f"patch {patch}: {n} samples in {games} games ({full} full) | {len(champs)} champions | {len(augs)} augments")
    if counts:
        print(f"champion samples: min {counts[0]}, median {counts[len(counts) // 2]}, max {counts[-1]}; "
              f"under {MIN_GAMES}: {sum(c < MIN_GAMES for c in counts)}")
    print("most played: " + ", ".join(f"{cn.get(c, c)} {g}" for c, g, _ in champs[:8]))
    unknown = [(a, g, w) for a, g, w in augs if a not in an]
    print(f"augments without a note in 強化/: {len(unknown)}" + "".join(f"\n  {a}: {g} picks, {w / g:.0%} win" for a, g, w in unknown))
    rated = sorted(((w / g, a, g) for a, g, w in augs if g >= 100), reverse=True)
    if rated:
        print("augments with 100+ picks, best and worst win rate (raw, not adjusted for champion):")
        for wr, a, g in rated[:5] + rated[-5:]:
            print(f"  {an.get(a, a)} {wr:.1%} ({g})")
    if export:
        per = db.execute(f"SELECT champ, aug, count(*), sum(win) FROM ({aug_union}) GROUP BY champ, aug", (patch,) * 6).fetchall()
        item_union = " UNION ALL ".join(f"SELECT champ, item{k} AS item, win {base} AND item{k} > 0" for k in range(6))
        items = db.execute(f"SELECT champ, item, count(*), sum(win) FROM ({item_union}) GROUP BY champ, item", (patch,) * 6).fetchall()
        out = {"source": "League client match history (LCU), ARAM Mayhem", "patch": patch, "date": time.strftime("%Y-%m-%d"),
               "samples": n, "games": games,
               "augments": {a: [g, w] for a, g, w in augs},
               "champions": {c: {"games": [g, w], "augments": {}, "items": {}} for c, g, w in champs}}
        for c, a, g, w in per:
            out["champions"][c]["augments"][a] = [g, w]
        for c, i, g, w in items:
            out["champions"][c]["items"][i] = [g, w]
        EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        path = EXPORT_DIR / f"mayhem-stats-{patch}.json"
        path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)} ([games, wins] per champion, augment and item)")


def check_client():
    """Is the client open, who is logged in (level only), what is it doing, can Mayhem games be read?"""
    c = Client(DELAY)
    try:
        me = c.get("/lol-summoner/v1/current-summoner")
    except SystemExit as e:
        print(e)
        return
    if not me:
        print("the client is open but nobody is logged in")
        return
    phase = c.get("/lol-gameflow/v1/gameflow-phase")
    hist = (c.get(f"/lol-match-history/v1/products/lol/{me['puuid']}/matches?begIndex=0&endIndex=20") or {})
    may = [g for g in hist.get("games", {}).get("games", []) if g.get("queueId") == MAYHEM]
    newest = max((g.get("gameVersion", "") for g in may), key=lambda v: patch_key(patch_of(v)) if v else (), default="")
    print(f"client open | account level {me.get('summonerLevel')} | state: {phase}")
    print(f"Mayhem games in this account's last 20: {len(may)}" + (f" (newest patch {patch_of(newest)})" if may else
          " -> the crawl needs at least one to start from"))


def captured(fn, *args):
    """What fn prints, as text (for the pager)."""
    import contextlib
    import io
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            fn(*args)
    except SystemExit as e:
        buf.write(f"\n{e}\n")
    return buf.getvalue() or "(nothing to show)"


def side_panel():
    """The menu's right-hand panel: the database per patch (toward Ready) and the client."""
    import lcu_tui as ui
    lines = [ui.DIM("DATABASE  ") + ui.FAINT(str(DB.relative_to(ROOT)))]
    try:
        import datalib
        st = datalib.status()
        pats = {r["patch"]: r["lcu"] for r in st["patches"] if r["lcu"]}
        states = {r["patch"]: r["state"] for r in st["patches"]}
        ready = st["lifecycle"]["ready_games"]
    except Exception:
        pats, states, ready = {}, {}, 3000
    for patch in sorted(pats, key=patch_key, reverse=True)[:4]:
        g = pats[patch]
        word = states.get(patch, "")
        state = (ui.GOOD if word in ("Ready", "Announced") else ui.WARN if word == "Collecting" else ui.DIM)(word)
        lines.append(f"{ui.TEXT(patch):<6} {ui.bar(g['games'] / ready, 14)} {ui.BOLD(ui.num(g['games']))}"
                     f"{ui.DIM(' / ' + ui.num(ready))}  {state}")
        lines.append(ui.DIM(f"       {g['full']:,} full · {g['champions']} champions · "
                            + (f"{g['first']} → {g['last']}" if g["first"] else "no dates")))
    if not pats:
        lines.append(ui.DIM("empty: start a crawl"))
    lines += ["", ui.DIM("CLIENT")]
    path = os.environ.get("LOL_LOCKFILE") or next((p for p in LOCKFILES if Path(p).exists()), None)
    if not path:
        lines.append(ui.BAD("● closed") + ui.DIM("  open League and log in"))
    else:
        try:
            c = Client(0)
            c.connect()
            code, body = c._raw("/lol-gameflow/v1/gameflow-phase")
            phase = json.loads(body) if code == 200 else "?"
            phase = "idle" if phase == "None" else phase
            lines.append(ui.GOOD("● open") + ui.DIM(f"  {phase}") if phase not in BUSY_PHASES else
                         ui.WARN("● in a game") + ui.DIM(f"  {phase}: the crawl waits"))
        except Exception:
            lines.append(ui.WARN("● starting") + ui.DIM("  not answering yet"))
    lines += ["", ui.DIM("TIERS")]
    try:
        t = json.loads((ROOT / "_data" / "augment-tiers.json").read_text(encoding="utf-8"))
        lines.append(ui.TEXT(f"patch {t.get('patch', '?')}") + ui.DIM(f"  from {t.get('source', '?')}"))
    except Exception:
        lines.append(ui.DIM("no _data/augment-tiers.json"))
    page = ROOT / ".cache" / "reports" / "tiers.html"
    lines.append(ui.DIM("page made ") + ui.TEXT(time.strftime("%m-%d %H:%M", time.localtime(page.stat().st_mtime)))
                 if page.exists() else ui.DIM("page not made yet: 4"))
    lines += ["", ui.DIM("Read-only · one call at a time · no names or ids saved"),
              ui.DIM("Ctrl+C or q stops; everything is saved as it goes")]
    return lines


def menu():
    """The full-screen menu (python3 -I tools/fetch_lcu.py with no options, or tools/mayhem_crawler.bat)."""
    import lcu_tui as ui
    py = [sys.executable, "-I"]
    tool = lambda name, *args: py + [str(ROOT / "tools" / name), *args]   # noqa: E731
    items = [(None, "Crawl", ""), ("1", "Crawl", "for a number of hours"), ("2", "Crawl until Ready", "stops at the Ready count"),
             ("3", "Quick test", "5 minutes"),
             (None, "Tiers", ""), ("4", "Tiers page", "make tiers.html and open it"),
             ("5", "Rebuild tiers", "from the crawl, then the page"),
             (None, "Database", ""), ("6", "Dashboard", "charts in the browser"), ("7", "Patch summary", "newest patch"),
             ("8", "Export to JSON", "newest patch"), ("9", "Import test games", ".cache/lcu/<patch>/"),
             (None, "Client", ""), ("0", "Check the client", "open, logged in, Mayhem games"), ("q", "Quit", "")]
    header = lambda w: [" " + ui.ACCENT(ui.BOLD("MAYHEM CRAWLER")), ui.rule(w)]   # noqa: E731
    side = ui.Live(side_panel, 15)
    at = 0
    with ui.Screen() as scr:
        while True:
            choice, at = ui.menu(scr, items, side, "Mayhem crawler", "League client · read-only", at)
            if choice == "q":
                return
            try:
                if choice in ("1", "2", "3"):
                    if choice == "1":
                        got = ui.ask(scr, "Crawl", "Hours:", 8, header)
                        if got is None:
                            continue
                        hours, until = float(got), False
                    elif choice == "2":
                        got = ui.ask(scr, "Crawl until Ready", "Stop after at most (hours):", 12, header)
                        if got is None:
                            continue
                        hours, until = float(got), True
                    else:
                        hours, until = 5 / 60, False
                    crawl = Crawl(open_db(), Client(DELAY), None)
                    try:
                        crawl.run(hours, 0, until, screen=scr)
                    except SystemExit as e:
                        crawl.event(str(e), "bad", "error")
                        crawl.mode, crawl.status = "stopped", "stopped"
                        if not hasattr(crawl, "t0") or not hasattr(crawl, "ready"):
                            ui.pager(scr, "Could not start", str(e), header)
                            continue
                    w, h = scr.size()
                    lines = ui.dashboard(crawl.state(), w, h)
                    lines[-1] = ui.right(ui.DIM(" any key: back to the menu"), ui.GOOD("saved ✓ "), w)
                    scr.draw(lines)
                    while scr.key(1) is None:
                        pass
                elif choice == "4":
                    ui.run_steps(scr, "Tiers page", [("tiers.html", tool("mn.py", "tiers"))], header,
                                 "Opened in your browser.")
                elif choice == "5":
                    ui.run_steps(scr, "Rebuild tiers", [
                        ("our crawl → cache", tool("lcu_cache.py")),
                        ("augment tiers", tool("augment_tiers.py")),
                        ("item builds", tool("build_tiers.py")),
                        ("tiers.html", tool("mn.py", "tiers"))], header,
                        "Opened in your browser. _data/ and Review/ changed: commit them when the tiers look right.")
                elif choice == "6":
                    ui.run_steps(scr, "Dashboard", [("report.html", tool("mn.py", "report"))], header,
                                 "Opened in your browser.")
                elif choice in ("7", "8"):
                    ui.pager(scr, "Patch summary" if choice == "7" else "Export to JSON",
                             captured(summary, open_db(), None, choice == "8"), header)
                elif choice == "9":
                    folders = sorted(p for p in EXPORT_DIR.glob("*") if p.is_dir() and p.name != "cache") if EXPORT_DIR.exists() else []
                    text = "".join(captured(import_json, open_db(), f) for f in folders) or "no test crawl folders in .cache/lcu/"
                    ui.pager(scr, "Import test games", text, header)
                elif choice == "0":
                    ui.pager(scr, "Check the client", captured(check_client), header)
            except KeyboardInterrupt:
                continue
            side.refresh()


def main():
    if len(sys.argv) == 1 and sys.stdin.isatty() and sys.stdout.isatty():
        try:
            return menu()
        except KeyboardInterrupt:
            print("stopped; everything so far is saved")
            return
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hours", type=float, default=8, help="stop after this long (default 8)")
    ap.add_argument("--samples", type=int, default=0, help="stop after this many new samples")
    ap.add_argument("--until-ready", action="store_true", help="stop once the patch has the Ready count of games")
    ap.add_argument("--patch", help="collect this patch (default: the newest seen)")
    ap.add_argument("--delay", type=float, default=DELAY, help=f"seconds between calls (default {DELAY})")
    ap.add_argument("--summary", nargs="?", const="", metavar="PATCH", help="print what the database holds, then exit")
    ap.add_argument("--export", action="store_true", help="with --summary: write the patch's counts as JSON")
    ap.add_argument("--import-json", metavar="DIR", help="load one-file-per-game JSON, then exit")
    ap.add_argument("--plain", action="store_true", help="log lines instead of the live dashboard")
    a = ap.parse_args()
    db = open_db()
    if a.import_json:
        return import_json(db, a.import_json)
    if a.summary is not None:
        return summary(db, a.summary or None, a.export)
    crawl = Crawl(db, Client(a.delay), a.patch)
    try:
        if sys.stdin.isatty() and sys.stdout.isatty() and not a.plain:
            import lcu_tui as ui
            with ui.Screen() as scr:
                crawl.run(a.hours, a.samples, a.until_ready, screen=scr)
                time.sleep(2)
        else:
            crawl.run(a.hours, a.samples, a.until_ready)
    except KeyboardInterrupt:
        log("stopped by hand; everything so far is saved")
    except SystemExit as e:
        print(e)


if __name__ == "__main__":
    main()
