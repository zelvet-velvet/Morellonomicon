#!/usr/bin/env python3
"""Collect ARAM Mayhem games (champion, win, items, augments) through the League client running on this PC.

Riot's Match-V5 API lists no Mayhem games (queue 2400, tested 2026-11-18), but the client's own local API (LCU) shows them
in any player's match history. This script reads (GET), waits between calls, and stops by itself on repeated errors. Its one
write: the client keeps every history it is asked for, so when its UI passes UX_LIMIT_MB while nobody is in a game, the crawl
restarts the client's UI (POST /riotclient/kill-and-restart-ux: the UI reloads, the login and the backend stay).
Riot does not officially support the LCU: run it on a small account. The numbers stay in the git-ignored
.cache/mayhem.sqlite (offline, one file) until Zaviel decides whether they may be shown.

    python3 -I tools/crawl/fetch_lcu.py --hours 8          # overnight: the client must be open and logged in
    python3 -I tools/crawl/fetch_lcu.py --summary          # what the database holds for the newest patch
    python3 -I tools/crawl/fetch_lcu.py --summary 16.22 --export   # also write .cache/lcu/mayhem-stats-16.22.json
    python3 -I tools/crawl/fetch_lcu.py --import-json .cache/lcu/16.22   # load games saved as one JSON file each

Crawl: start from the logged-in player's newest Mayhem game; read each player's last 20 games (a slow call, ~4 s: each entry
holds that player's champion, items and augments), then open every unseen Mayhem game of the patch in it (a fast call, 0.23 s:
ten samples and nine more players to read). The client answers history calls one at a time, so calls go out one by one.
Samples are keyed by game and participant, so one player is never counted twice in a game. The database holds no names and no
player ids: players already read are kept only as a salted hash, to skip them for a while.

In a terminal it is a full-screen app (tools/crawl/lcu_tui.py): a menu (crawl for hours or until a share of the augment picks is
sure; make and open the tiers page, or rebuild the tiers from the crawl first; the database; the client), then a live
dashboard while crawling: how sure the numbers are (confidence(): the share of augment and item picks on pairs with enough
games for the tiers to trust, champions within ±2 points, the next goal and the games it needs), this run, speed, the queue,
the client, the thinnest champions and an aligned, scrollable activity log (p pause, q stop, r browser report, ↑↓ / wheel
scroll). Anything slow shows a loading screen. --plain, or output to a file, logs a progress line every few minutes instead.
Standard library only.
"""
import argparse
import base64
import csv
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # python3 -I adds no script folder: tools/ here,
import toolpath  # noqa: E402,F401  (...and toolpath adds the job folders, so the scripts import each other by name)

ROOT = Path(__file__).resolve().parents[2]
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
UX_LIMIT_MB = 3000          # the client's UI (LeagueClientUx + UxRender) above this is restarted, only in RESTART_PHASES
UX_RESTART_GAP = 1800       # seconds, at least, between two UI restarts
RESTART_PHASES = ("idle", "Lobby")   # never during queue, ready check, champion select, a game or its end screen
MEM_LOG_EVERY = 1800        # seconds between memory lines in the activity log (to see which process grows)
WIN_TASKLIST = "/mnt/c/Windows/system32/tasklist.exe"


class ClientGone(Exception):
    pass


class Client:
    """GET access to the local client (and post() for the UI restart); rereads the lockfile when the client restarts."""

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

    def _call(self, path, method="GET"):
        url = self.base + path
        if sys.platform != "win32" and Path(WIN_CURL).exists():
            try:
                r = subprocess.run([WIN_CURL, "-s", "-k", "-X", method, "-w", "\n%{http_code}", "-u", f"riot:{self.pw}", url],
                                   capture_output=True, timeout=60)
            except subprocess.TimeoutExpired:   # a stalled call (the client busy, Riot's history server slow): wait and retry
                raise ClientGone("no answer in 60 s") from None   # from None: the traceback would print the client's password
            if r.returncode != 0:
                raise ClientGone(f"curl exit {r.returncode}")
            body, _, code = r.stdout.decode("utf-8", "replace").rpartition("\n")
            return int(code), body
        auth = base64.b64encode(f"riot:{self.pw}".encode()).decode()
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"}, method=method,
                                     data=b"" if method == "POST" else None)
        try:
            with urllib.request.urlopen(req, timeout=60, context=ssl._create_unverified_context()) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            raise ClientGone(str(e))

    def post(self, path):
        """One POST, no retries: the HTTP code, or None when the client does not answer."""
        try:
            return self._call(path, "POST")[0]
        except ClientGone:
            return None

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


def client_memory():
    """(backend MB, UI MB) of the League client from the Windows process list, or None (no client, no tasklist)."""
    exe = "tasklist" if sys.platform == "win32" else WIN_TASKLIST
    try:
        r = subprocess.run([exe, "/FO", "CSV", "/NH", "/FI", "IMAGENAME eq LeagueClient*"], capture_output=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    backend = ui = 0
    for row in csv.reader(r.stdout.decode("latin-1").splitlines()):
        if len(row) < 5 or not row[0].lower().startswith("leagueclient"):
            continue
        mb = int("".join(ch for ch in row[4] if ch.isdigit()) or 0) // 1024   # "1,234,567 K", separators by locale
        if row[0].lower() == "leagueclient.exe":
            backend += mb
        else:   # LeagueClientUx.exe and its LeagueClientUxRender.exe processes
            ui += mb
    return (backend, ui) if backend or ui else None


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
    db = sqlite3.connect(DB, check_same_thread=False)   # one thread at a time: the crawl starts on its worker, then moves
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
        self.mem, self.ux_restart, self.last_restart = None, None, 0.0   # client memory, the guard's UI restart (HTTP code)
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
        """Stops if another account logged in; the client's phase when the player is in champion select or a game, else None.
        Also reads the client's memory and restarts its UI when that passes UX_LIMIT_MB while nobody is playing."""
        self.same_account(self.c._raw("/lol-summoner/v1/current-summoner"))
        self.phase = self.c.get("/lol-gameflow/v1/gameflow-phase") or ""
        self.phase = "idle" if self.phase == "None" else self.phase
        self.mem, self.ux_restart = client_memory(), None
        if (self.mem and self.mem[1] >= UX_LIMIT_MB and self.phase in RESTART_PHASES
                and time.time() - self.last_restart >= UX_RESTART_GAP):
            self.last_restart = time.time()
            self.ux_restart = self.c.post("/riotclient/kill-and-restart-ux") or "no answer"
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
        conf = self.conf.value if getattr(self, "conf", None) else None
        conf = conf if conf and conf["patch"] == self.patch else None
        return {"patch": self.patch or "?", "status": self.status, "mode": self.mode, "elapsed": el,
                "budget": self.hours * 3600, "ends": time.strftime("%H:%M", time.localtime(self.t0 + self.hours * 3600)),
                "until_ready": self.until_ready, "patch_games": games, "patch_full": full, "ready": self.ready,
                "eta_ready": eta, "new_games": self.new_games, "new_full": self.new_full, "new_samples": self.samples,
                "new_per_read": self.new_games / max(1, self.reads), "conf": conf, "target": self.until_sure,
                "spark": [self.per_minute.get(m, 0) for m in range(minute - 29, minute + 1)], "games_per_min": gpm,
                "samples_per_min": spm, "calls": self.c.calls,
                "latency": sum(self.c.times) / len(self.c.times) if self.c.times else 0, "queued": len(self.frontier),
                "opens": len(self.opens), "reads": self.reads, "opened": self.details, "skipped": self.skipped,
                "reseeds": self.reseeds, "errors": self.c.errors, "phase": self.phase, "mem": self.mem, "events": self.events,
                "now_doing": self.now_doing, "log_back": self.log_back}

    # ---------- the crawl ----------
    def run(self, hours, samples=0, until_ready=False, screen=None, until_sure=0):
        """Crawl until the time budget, the sample target or (until_ready) the patch's Ready count. With a screen: the live
        dashboard (p pause, q stop, r browser report); without one: a progress line in the log every few minutes.
        Every client call goes to the one worker thread (a history read, a game, the account / game-state check, a queue
        refill), so the screen keeps answering keys; the database stays on this thread (one SQLite connection)."""
        global LOG_HOOK
        import lcu_tui as ui
        from concurrent.futures import ThreadPoolExecutor, wait
        self.t0 = time.time()
        self.hours, self.target, self.opens, self.until_ready = hours, samples, deque(), until_ready
        self.until_sure = until_sure   # stop once this % of the augment picks sit on sure pairs
        try:
            import datalib
            self.ready = datalib.lifecycle()["ready_games"]
        except Exception:
            self.ready = 3000
        LOG_HOOK = self.event if screen else None
        draw = (lambda: screen.draw(ui.dashboard(self.state(), *screen.size()))) if screen else (lambda: None)
        self.mode, self.status, self.now_doing = "starting", "connecting", "reading your newest Mayhem game"
        self.event("connecting to the client", "", "start")
        if self.patch:
            self.recount()
        self.patch = self.patch or "?"
        self.conf = ui.Live(lambda: confidence(self.patch, self.patch_counts()[0]) if self.patch != "?" else None, 30)
        pool = ThreadPoolExecutor(max_workers=1)   # one call at a time: the client queues them anyway
        start = pool.submit(self.seed)   # on the worker: the screen keeps moving while the client answers (a few s)
        while not start.done():
            if screen:
                draw()
                if screen.key(0.1) == "q":
                    self.event("stopped before the start", "warn", "stop")
                    pool.shutdown(wait=False, cancel_futures=True)
                    self.conf.stop()
                    raise SystemExit("stopped by you before the crawl started")
            else:
                wait([start], timeout=0.5)
        start.result()   # a SystemExit from the start (no client, no account, no games) ends here
        self.recount()
        self.conf.refresh()
        self.event(f"patch {self.patch} · {len(self.frontier)} players queued · up to {fmt_time(hours * 3600)}"
                   + (" or until Ready" if until_ready else "") + (f" or until {until_sure}% sure" if until_sure else ""),
                   "good", "start")
        job, opening, stop, user_pause, busy = None, set(), None, False, None
        last_guard = last_log = last_draw = last_mem = 0.0
        backend_warned = False
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
                    elif until_sure and (c := self.conf.value) and c["patch"] == self.patch and c["aug"]["share"] * 100 >= until_sure:
                        stop = f"{until_sure}% of augment picks are on sure pairs"
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
                        if self.ux_restart:
                            self.event(f"client UI at {num(self.mem[1])} MB: restarted it (HTTP {self.ux_restart})",
                                       "warn", "client")
                        elif self.mem and now - last_mem >= MEM_LOG_EVERY:
                            last_mem = now
                            self.event(f"client memory: backend {num(self.mem[0])} MB · UI {num(self.mem[1])} MB",
                                       "dim", "memory")
                        if self.mem and self.mem[0] >= UX_LIMIT_MB and not backend_warned:
                            backend_warned = True   # a UI restart does not free the backend: only closing the client does
                            self.event(f"client backend at {num(self.mem[0])} MB: restart the League client when you can",
                                       "bad", "client")
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
                        c = self.conf.value
                        self.event(f"{num(games_now // 100 * 100)} games of {self.patch}"
                                   + (f" · augment picks {c['aug']['share']:.0%} sure · item picks {c['item']['share']:.0%}"
                                      if c and c["patch"] == self.patch else ""), "good", "games")
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
            if getattr(self, "conf", None):
                self.conf.stop()
            self.mode, self.status, self.now_doing = "stopped", "stopped" if stop else "stopped by an error", ""
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
    print(f"patch {patch}: {n:,} samples in {games:,} games ({full:,} full) · {len(champs)} champions · {len(augs)} augments")
    if counts:
        print(f"champion samples: min {counts[0]:,}, median {counts[len(counts) // 2]:,}, max {counts[-1]:,}; "
              f"under {MIN_GAMES}: {sum(c < MIN_GAMES for c in counts)}")
    print("most played: " + ", ".join(f"{cn.get(c, c)} {g:,}" for c, g, _ in champs[:8]))
    unknown = [(a, g, w) for a, g, w in augs if a not in an]
    print(f"augments without a note in 強化/: {len(unknown)}" + "".join(f"\n  {a}: {g} picks, {w / g:.0%} win" for a, g, w in unknown))
    rated = sorted(((w / g, a, g) for a, g, w in augs if g >= 100), reverse=True)
    if rated:
        print("augments with 100+ picks, best and worst win rate (raw, not adjusted for champion):")
        for wr, a, g in rated[:5] + rated[-5:]:
            print(f"  {wr:6.1%}  {g:>6,} picks  {an.get(a, a)}")
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


# ---------- how sure the numbers are ----------
# A win rate from n games is within about ±98/√n points of the true one, 19 times in 20 (95%, near a 50% win rate).
# The tier scripts call a champion + augment pair sure at 600 games (±4 points) and an item pair at 1,000 (±3), from the
# crawl cache's meta.json (tools/crawl/lcu_cache.py). The figures below say how much of what players pick has numbers that sure.

LADDER = [(10, 100), (6, 267), (4, 600), (3, 1067), (2, 2401)]   # (± points, games needed)
GOALS = (25, 50, 75, 90)                                        # % of picks on sure pairs to aim for, in turn


def margin(n):
    """± points a win rate from n games can be off, 19 times in 20."""
    return 98 / n ** 0.5 if n else 100.0


def covered(counts, need):
    """Share of all picks whose pair has at least `need` games; counts: games per pair."""
    total = sum(counts)
    return sum(c for c in counts if c >= need) / total if total else 0.0


def games_for(counts, need, goal, games):
    """About how many more games the patch needs before `goal` (0–1) of the picks sit on pairs of `need` games,
    if every pair keeps its share of the games; 0 when already there."""
    total, run = sum(counts), 0
    for c in sorted(counts, reverse=True):
        run += c
        if run >= goal * total:
            return max(0, round(games * (need / c - 1))) if c else None
    return None


_conf_cache = {}


def confidence(patch, games_now=None):
    """How sure the patch's numbers are: champions, augment picks and item picks on the ladder of ± points, and the next
    goals with the games they need. Reads every player row once (about 10 s on /mnt/c), so it runs on a background
    thread and is kept until the patch has 1% more games."""
    import datalib
    hit = _conf_cache.get(patch)
    if hit and games_now is not None and games_now < hit["games"] * 1.01 and time.time() - hit["at"] < 600:
        return hit
    try:
        meta = json.loads((EXPORT_DIR / "cache" / patch / "meta.json").read_text())
    except Exception:
        meta = {}
    sure_aug, sure_item = meta.get("sure_games", 600), meta.get("sure_item_games", 1000)
    db = datalib.read_only(DB)
    real_items = set(names("ITEMS", "id"))
    champs, augs, items = {}, {}, {}
    try:
        games, = db.execute("SELECT count(*) FROM games WHERE patch=?", (patch,)).fetchone()
        cols = ", ".join([f"p.aug{k}" for k in range(1, 7)] + [f"p.item{k}" for k in range(6)])
        for row in db.execute(f"SELECT p.champ, {cols} FROM games g CROSS JOIN players p ON p.game_id = g.game_id "
                              "WHERE g.patch=?", (patch,)):
            c = row[0]
            champs[c] = champs.get(c, 0) + 1
            for a in row[1:7]:
                if a:
                    augs[(c, a)] = augs.get((c, a), 0) + 1
            for i in set(row[7:]):
                if i in real_items:
                    items[(c, i)] = items.get((c, i), 0) + 1
    finally:
        db.close()
    out = {"patch": patch, "games": games, "at": time.time(), "sure_aug": sure_aug, "sure_item": sure_item}
    for name, counts, sure in (("aug", list(augs.values()), sure_aug), ("item", list(items.values()), sure_item)):
        share = covered(counts, sure)
        nxt = next((g for g in GOALS if g / 100 > share), None)
        out[name] = {"share": share, "pairs": len(counts), "sure_pairs": sum(1 for c in counts if c >= sure),
                     "ladder": [(pts, covered(counts, need)) for pts, need in LADDER], "goal": nxt,
                     "more": games_for(counts, sure, nxt / 100, games) if nxt else 0}
    cc = list(champs.values())
    cn = names("CHAMPIONS", "key")
    out["thin"] = [(n, champs.get(k, 0)) for n, k in sorted((n, k) for k, n in cn.items())]
    out["thin"] = sorted(out["thin"], key=lambda x: x[1])[:10]
    out["champ"] = {"total": len(cn), "seen": len(cc),
                    "ladder": [(pts, sum(1 for c in cc if c >= need)) for pts, need in LADDER],
                    "worst": margin(min(cc)) if cc else 100.0}
    _conf_cache[patch] = out
    return out


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


def newest_patch():
    import datalib
    db = datalib.read_only(DB)
    try:
        row = db.execute("SELECT patch FROM games WHERE patch != '' ORDER BY created DESC LIMIT 1").fetchone()
    finally:
        db.close()
    return row[0] if row else None


class SidePanel:
    """The menu's right-hand panel from two background threads: the database, client and tiers (side_panel, every 15 s)
    and how sure the newest patch's numbers are (confidence, every 60 s; about 10 s to work out). Each part shows a
    spinner until it is there, so the menu itself never waits."""

    def __init__(self):
        import lcu_tui as ui
        self.ui = ui
        self.base = ui.Live(side_panel, 15)
        self.conf = ui.Live(lambda: confidence(newest_patch()) if DB.exists() and newest_patch() else None, 60)

    def refresh(self):
        self.base.refresh()
        self.conf.refresh()

    @property
    def value(self):
        ui = self.ui
        base = self.base.value or [ui.DIM("DATABASE"), ui.INFO(ui.spinner()) + ui.DIM(" reading the database…")]
        c = self.conf.value
        if isinstance(c, list):   # Live's error lines
            sure = c
        elif c is None:
            sure = [ui.INFO(ui.spinner()) + ui.DIM(" working out how sure (about 10 s)…")]
        else:
            sure = []
            for key, what in (("aug", "augment picks"), ("item", "item picks")):
                f = c[key]
                tone = ui.GOOD if f["share"] >= .75 else ui.WARN if f["share"] >= .25 else ui.BAD
                sure.append(f"{ui.fit(ui.TEXT(what), 15)}{ui.bar(f['share'], 14, tone)} {tone(ui.BOLD(ui.pct(f['share']).rjust(4)))}"
                            + ui.DIM(f"  on sure pairs"))
            ch = c["champ"]
            two = dict(ch["ladder"])[2]
            sure.append(f"{ui.fit(ui.TEXT('champions'), 15)}{ui.bar(two / max(1, ch['total']), 14)} {ui.BOLD(str(two).rjust(4))}"
                        + ui.DIM(f" / {ch['total']} within ±2"))
            f = c["aug"]
            if f["goal"] and f["more"]:
                sure.append(ui.DIM(f"next: {f['goal']}% of augment picks at ") + ui.TEXT("+" + num(f["more"])) + ui.DIM(" games"))
        return base[:1] + base[1:self._db_end(base)] + ["", ui.DIM("HOW SURE  ") + ui.FAINT(
            f"patch {c['patch']}" if isinstance(c, dict) else "")] + sure + base[self._db_end(base):]

    @staticmethod
    def _db_end(lines):
        """Where the DATABASE part of the base panel ends (the blank line before CLIENT)."""
        return next((i for i, l in enumerate(lines) if i and not l), len(lines))


def side_panel():
    """The menu panel's database, client and tiers parts (SidePanel adds how sure the numbers are)."""
    import lcu_tui as ui
    lines = [ui.DIM("DATABASE  ") + ui.FAINT(str(DB.relative_to(ROOT)))]
    try:
        import datalib
        st = datalib.status()
        pats = {r["patch"]: r["lcu"] for r in st["patches"] if r["lcu"]}
        states = {r["patch"]: r["state"] for r in st["patches"]}
    except Exception:
        pats, states = {}, {}
    for patch in sorted(pats, key=patch_key, reverse=True)[:3]:
        g = pats[patch]
        word = states.get(patch, "")
        state = (ui.GOOD if word == "Announced" else ui.WARN if word in ("Ready", "Collecting") else ui.DIM)(word)
        lines.append(ui.right(f"{ui.TEXT(patch)}  {ui.BOLD(ui.num(g['games']).rjust(7))} {ui.DIM('games')}"
                              f"{ui.DIM(f'  {g['full'] / max(1, g['games']):.0%} full')}", state, 50))
        lines.append(ui.DIM(f"       {g['samples']:,} samples · {g['champions']} champions · "
                            + (f"{g['first'][5:]} → {g['last'][5:]}" if g["first"] else "no dates")))
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
    lines += ["", ui.FAINT("Read-only · one call at a time · no names or ids saved")]
    return lines


def menu():
    """The full-screen menu (python3 -I tools/crawl/fetch_lcu.py with no options, or tools/crawl/mayhem_crawler.bat).
    Every item that takes more than a moment shows a loading screen (ui.busy) or its live output (ui.run_steps)."""
    import lcu_tui as ui
    py = [sys.executable, "-I"]
    tool = lambda name, *args: py + [str(ROOT / "tools" / name), *args]   # noqa: E731
    items = [(None, "Crawl", ""),
             ("1", "Crawl", "for a number of hours"),
             ("2", "Crawl until sure", "to a % of sure augment picks"),
             ("3", "Quick test", "5 minutes"),
             (None, "Tiers", ""),
             ("4", "Tiers page", "make tiers.html, open it"),
             ("5", "Rebuild tiers", "crawl → tiers → page"),
             (None, "Database", ""),
             ("6", "Dashboard", "charts in the browser"),
             ("7", "Patch summary", "the newest patch in text"),
             ("8", "Export to JSON", "the newest patch's counts"),
             ("9", "Import test games", ".cache/lcu/<patch>/"),
             (None, "Client", ""),
             ("0", "Check the client", "logged in, Mayhem games"),
             ("q", "Quit", "")]
    header = lambda w: [" " + ui.ACCENT(ui.BOLD("MAYHEM CRAWLER")), ui.rule(w)]   # noqa: E731
    side = SidePanel()
    at = 0

    def page(title, fn, hint):
        text = ui.busy(scr, title, lambda: captured(fn), header, hint)
        if text is not None:
            ui.pager(scr, title, text, header)

    with ui.Screen() as scr:
        while True:
            choice, at = ui.menu(scr, items, side, "Mayhem crawler", "League client · read-only", at)
            if choice == "q":
                return
            try:
                if choice in ("1", "2", "3"):
                    hours, sure = 5 / 60, 0
                    if choice == "1":
                        hours = ui.ask(scr, "Crawl", "Hours:", 8, header, low=0.05, high=48,
                                       hint="The crawl pauses by itself while you are in champion select or a game, "
                                            "and stops on q; everything is saved as it goes.")
                        if hours is None:
                            continue
                    elif choice == "2":
                        c = side.conf.value if isinstance(side.conf.value, dict) else None
                        now = f" Now {c['aug']['share']:.0%}." if c else ""
                        sure = ui.ask(scr, "Crawl until sure", "Stop at (% of augment picks on sure pairs):", 50, header,
                                      low=1, high=99, hint=f"A pair is sure at 600 games: its win rate is then within "
                                                           f"±4 points, 19 times in 20.{now}")
                        if sure is None:
                            continue
                        hours = ui.ask(scr, "Crawl until sure", "Stop after at most (hours):", 12, header, low=0.05, high=48)
                        if hours is None:
                            continue
                        sure = int(sure)
                    crawl = Crawl(open_db(), Client(DELAY), None)
                    try:
                        crawl.run(hours, 0, False, screen=scr, until_sure=sure)
                    except SystemExit as e:
                        crawl.event(str(e), "bad", "error")
                        crawl.mode, crawl.status, crawl.now_doing = "stopped", "could not start", ""

                    def final(w, h, k):
                        if k in ("up", "down", "pgup", "pgdn", "home", "end"):
                            step = {"up": 1, "down": -1, "pgup": 10, "pgdn": -10, "home": 10 ** 6, "end": -10 ** 6}[k]
                            crawl.log_back = max(0, min(len(crawl.events) - 1, crawl.log_back + step))
                        return ui.dashboard(crawl.state(), w, h)
                    ui.hold(scr, final)
                elif choice == "4":
                    ui.run_steps(scr, "Tiers page", [("tiers.html", tool("mn.py", "tiers"))], header,
                                 "Opened in your browser.")
                elif choice == "5":
                    patch = newest_patch()
                    resg = [] if patch and (ROOT / ".cache" / "resg" / patch / "meta.json").exists() else [
                        ("resg.top games (~7 min)", tool("crawl/fetch_resg.py"))]   # without it the tiers fall back to our far smaller crawl
                    ui.run_steps(scr, "Rebuild tiers", resg + [
                        ("our crawl → cache", tool("crawl/lcu_cache.py")),
                        ("augment tiers", tool("reason/augment_tiers.py")),
                        ("item builds", tool("reason/build_tiers.py")),
                        ("tiers.html", tool("mn.py", "tiers"))], header,
                        "Opened in your browser. _data/ and Review/ changed: commit them when the tiers look right.")
                elif choice == "6":
                    ui.run_steps(scr, "Dashboard", [("report.html", tool("mn.py", "report"))], header,
                                 "Opened in your browser.")
                elif choice == "7":
                    page("Patch summary", lambda: summary(open_db(), None, False),
                         "Counting samples per champion and augment over the whole patch.")
                elif choice == "8":
                    page("Export to JSON", lambda: summary(open_db(), None, True),
                         "Counting every champion, augment and item pair, then writing the JSON file.")
                elif choice == "9":
                    def imp():
                        folders = sorted(p for p in EXPORT_DIR.glob("*") if p.is_dir() and p.name != "cache") \
                            if EXPORT_DIR.exists() else []
                        for f in folders:
                            import_json(open_db(), f)
                        if not folders:
                            print("no test crawl folders in .cache/lcu/")
                    page("Import test games", imp, "Reading one JSON file per game.")
                elif choice == "0":
                    page("Check the client", check_client, "Asking the League client who is logged in and for "
                                                           "their last 20 games (a few seconds).")
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
    ap.add_argument("--until-sure", type=int, default=0, metavar="PCT",
                    help="stop once PCT%% of the augment picks are on sure pairs (600+ games)")
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
                crawl.run(a.hours, a.samples, a.until_ready, screen=scr, until_sure=a.until_sure)
                time.sleep(2)
        else:
            crawl.run(a.hours, a.samples, a.until_ready, until_sure=a.until_sure)
    except KeyboardInterrupt:
        log("stopped by hand; everything so far is saved")
    except SystemExit as e:
        print(e)


if __name__ == "__main__":
    main()
