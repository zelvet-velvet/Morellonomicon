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

Crawl: start from the logged-in player's newest Mayhem game, read each player's last 20 games (each entry already holds
that player's champion, items and augments: one sample), open the full game of the newest unread ones (ten samples and
nine more players to read). Samples are keyed by game and participant, so one player is never counted twice in a game.
The database holds no names and no player ids: players already read are kept only as a salted hash, to skip them for a while.
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

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / ".cache" / "mayhem.sqlite"
EXPORT_DIR = ROOT / ".cache" / "lcu"
LOCKFILES = ("/mnt/c/Riot Games/League of Legends/lockfile", "C:/Riot Games/League of Legends/lockfile")
WIN_CURL = "/mnt/c/Windows/system32/curl.exe"   # from WSL the Windows localhost is reached through Windows' own curl
MAYHEM = 2400
MIN_DURATION = 300          # seconds; shorter games are remakes
DELAY = 1.0                 # seconds between calls (the client's history call itself takes a few seconds)
DETAILS_PER_PLAYER = 1      # full games opened per player read (each adds nine players to the queue)
FRONTIER_LOW = 30           # below this many players waiting, open more full games
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

    def connect(self):
        path = os.environ.get("LOL_LOCKFILE") or next((p for p in LOCKFILES if Path(p).exists()), None)
        if not path or not Path(path).exists():
            raise ClientGone("no lockfile: the client is not running")
        _, _, port, pw, proto = Path(path).read_text(encoding="utf-8").strip().split(":")
        self.base, self.pw = f"{proto}://127.0.0.1:{port}", pw

    def _raw(self, path):
        url = self.base + path
        if sys.platform != "win32" and Path(WIN_CURL).exists():
            r = subprocess.run([WIN_CURL, "-s", "-k", "-w", "\n%{http_code}", "-u", f"riot:{self.pw}", url],
                               capture_output=True, timeout=60)
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
            if errors >= MAX_ERRORS or code in (401, 403):
                raise SystemExit(f"stop: {path.split('?')[0]} -> HTTP {code} {body[:150]}")
            pause = 30 * 2 ** errors
            log(f"HTTP {code}, pausing {pause} s")
            time.sleep(pause)


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def patch_of(version):
    return ".".join(version.split(".")[:2])


def patch_key(patch):
    return tuple(int(x) for x in patch.split(".") if x.isdigit())


def open_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB)
    db.execute("PRAGMA journal_mode=WAL")
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
        self.reads = self.details = self.samples = 0
        self.account = None   # hash of the logged-in account the crawl started on
        self.status = "starting"

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
                log(f"new patch {p}: now collecting it")
            self.patch = p
        return p == self.patch

    def history(self, puuid):
        data = self.c.get(f"/lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex=20") or {}
        games = [g for g in data.get("games", {}).get("games", []) if g.get("queueId") == MAYHEM]
        for g in sorted(games, key=lambda g: g.get("gameCreation", 0)):
            self.current(g.get("gameVersion", ""))
        return games

    def read_player(self, puuid):
        games = self.history(puuid)
        self.reads += 1
        self.db.execute("INSERT OR REPLACE INTO readers VALUES (?, ?)", (self.hash(puuid), int(time.time())))
        for g in games:
            if g.get("gameDuration", 0) < MIN_DURATION or patch_of(g.get("gameVersion", "")) != self.patch:
                continue
            p = (g.get("participants") or [None])[0]
            if p and "participantId" in p:
                save_game_row(self.db, g, 0)
                self.samples += self.db.execute(PLAYER_SQL.format("IGNORE"), player_row(g["gameId"], p, "list")).rowcount
        self.db.commit()
        return games

    def open_game(self, game_id):
        d = self.c.get(f"/lol-match-history/v1/games/{game_id}")
        self.details += 1
        if not d:
            return
        for pi in d.get("participantIdentities", []):
            self.enqueue(pi.get("player", {}).get("puuid"))
        save_game_row(self.db, d, 1)
        if d.get("gameDuration", 0) >= MIN_DURATION and patch_of(d.get("gameVersion", "")) == self.patch:
            for p in d.get("participants", []):
                self.samples += self.db.execute(PLAYER_SQL.format("REPLACE"), player_row(game_id, p, "game")).rowcount
        self.db.commit()

    def unopened(self, games):
        out = []
        for g in sorted(games, key=lambda g: -g.get("gameCreation", 0)):
            if patch_of(g.get("gameVersion", "")) != self.patch or g.get("gameDuration", 0) < MIN_DURATION:
                continue
            row = self.db.execute("SELECT full FROM games WHERE game_id=?", (g["gameId"],)).fetchone()
            if not row or not row[0]:
                out.append(g["gameId"])
        return out

    def seed(self):
        me = self.c.get("/lol-summoner/v1/current-summoner")
        if not me:
            raise SystemExit("stop: no logged-in player in the client")
        self.account = self.hash(me["puuid"])
        self.c.check = self.same_account
        games = self.history(me["puuid"])
        if not games:
            raise SystemExit("stop: the logged-in account has no Mayhem games to start from; play one or log in to another")
        newest = max(games, key=lambda g: g.get("gameCreation", 0))
        d = self.c.get(f"/lol-match-history/v1/games/{newest['gameId']}") or {}
        for pi in d.get("participantIdentities", []):
            self.enqueue(pi.get("player", {}).get("puuid"))

    def reseed(self):
        """Out of players: reopen a recent full game of this patch for its players."""
        rows = self.db.execute("SELECT game_id FROM games WHERE patch=? AND full=1 ORDER BY created DESC LIMIT 50",
                               (self.patch,)).fetchall()
        random.shuffle(rows)
        for (gid,) in rows[:RESEED_GAMES]:
            d = self.c.get(f"/lol-match-history/v1/games/{gid}") or {}
            for pi in d.get("participantIdentities", []):
                self.enqueue(pi.get("player", {}).get("puuid"))
            if len(self.frontier) >= RESEED_ENOUGH:
                break
        return bool(self.frontier)

    def same_account(self, response):
        """Called with the raw (code, body) of /current-summoner right after the client (re)connects."""
        code, body = response
        try:
            ok = code == 200 and self.hash(json.loads(body).get("puuid", "")) == self.account
        except ValueError:
            ok = False
        if not ok:
            raise SystemExit("\nstop: a different account (or none) is logged in to the client; the crawl only runs "
                             "on the account it started on")

    def guard(self):
        """Stop if another account logged in; pause while the logged-in player is in champion select or a game."""
        while True:
            self.same_account(self.c._raw("/lol-summoner/v1/current-summoner"))
            phase = self.c.get("/lol-gameflow/v1/gameflow-phase")
            if phase not in BUSY_PHASES:
                return
            self.status = f"paused: {phase}"
            self.line()
            time.sleep(PAUSE_CHECK)

    def run(self, hours, samples):
        self.t0 = last_log = last_guard = time.time()
        self.hours, self.target = hours, samples
        self.seed()
        log(f"start: patch {self.patch}, {len(self.frontier)} players queued, running up to {hours:g} h"
            + (f" or {samples} samples" if samples else "") + "  (Ctrl+C stops; everything is saved as it goes)")
        while time.time() - self.t0 < hours * 3600 and (not samples or self.samples < samples):
            if time.time() - last_guard >= GUARD_EVERY:
                last_guard = time.time()
                self.guard()
            self.status = "reading"
            if not self.frontier and not self.reseed():
                log("no more players to read")
                break
            puuid = self.frontier.popleft()
            if self.recently_read(puuid):
                continue
            games = self.read_player(puuid)
            todo = self.unopened(games)
            for gid in todo[:DETAILS_PER_PLAYER if len(self.frontier) >= FRONTIER_LOW else 3]:
                self.open_game(gid)
            self.line()
            if time.time() - last_log >= LOG_EVERY:
                last_log = time.time()
                self.progress()
        self.progress("done")

    def line(self):
        """One updating progress line in a terminal (nothing when the output goes to a file)."""
        if not sys.stdout.isatty():
            return
        el = time.time() - self.t0
        rate = self.samples / max(el / 60, 0.01)
        if self.target:
            frac = min(self.samples / self.target, 1)
        else:
            frac = min(el / (self.hours * 3600), 1)
        bar = "#" * int(frac * 20) + "-" * (20 - int(frac * 20))
        left = (1 - frac) * el / frac if frac > 0.01 else 0
        text = (f"\r[{bar}] {frac:4.0%}  {self.samples} samples ({rate:.0f}/min)  {self.reads} players  "
                f"{len(self.frontier)} queued  {fmt_time(el)} gone, ~{fmt_time(left)} left  {self.status}")
        print(text[:150].ljust(150), end="", flush=True)

    def progress(self, word="progress"):
        n, g = self.db.execute("SELECT count(*), count(DISTINCT p.game_id) FROM players p JOIN games USING (game_id) "
                               "WHERE patch=?", (self.patch,)).fetchone()
        mins = (time.time() - self.t0) / 60
        if sys.stdout.isatty():
            print()
        log(f"{word}: +{self.samples} samples this run ({self.samples / max(mins, 0.01):.0f}/min), patch {self.patch} "
            f"holds {n} samples in {g} games | {self.reads} players read, {self.details} games opened, "
            f"{len(self.frontier)} queued, {mins:.0f} min")


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


def ask(prompt, default):
    got = input(f"{prompt} [{default}]: ").strip()
    return got or str(default)


def menu():
    """A small menu for running the script by hand (python3 -I tools/fetch_lcu.py with no options)."""
    items = [("1", "Overnight crawl (asks how many hours)"), ("2", "Quick test (5 minutes)"),
             ("3", "Check the client"), ("4", "Summary of the newest patch"),
             ("5", "Export the newest patch to JSON"), ("6", "Import the test crawl's JSON games"), ("q", "Quit")]
    while True:
        print("\n=== Mayhem crawler (League client, read-only) ===")
        n, g = open_db().execute("SELECT count(*), count(DISTINCT game_id) FROM players").fetchone()
        print(f"database: {n} samples in {g} games ({DB.relative_to(ROOT)}, offline)")
        for key, text in items:
            print(f"  {key}  {text}")
        try:
            choice = input("> ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print()
            return
        try:
            if choice == "1":
                hours = float(ask("hours", 8))
                Crawl(open_db(), Client(DELAY), None).run(hours, 0)
            elif choice == "2":
                Crawl(open_db(), Client(DELAY), None).run(5 / 60, 0)
            elif choice == "3":
                check_client()
            elif choice in ("4", "5"):
                summary(open_db(), None, choice == "5")
            elif choice == "6":
                folders = sorted(p for p in EXPORT_DIR.glob("*") if p.is_dir()) if EXPORT_DIR.exists() else []
                if not folders:
                    print("no test crawl folders in .cache/lcu/")
                for f in folders:
                    import_json(open_db(), f)
            elif choice in ("q", "quit", "exit"):
                return
        except KeyboardInterrupt:
            print()
            log("stopped by hand; everything so far is saved")
        except SystemExit as e:
            print(e)


def main():
    if len(sys.argv) == 1 and sys.stdin.isatty():
        return menu()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hours", type=float, default=8, help="stop after this long (default 8)")
    ap.add_argument("--samples", type=int, default=0, help="stop after this many new samples")
    ap.add_argument("--patch", help="collect this patch (default: the newest seen)")
    ap.add_argument("--delay", type=float, default=DELAY, help=f"seconds between calls (default {DELAY})")
    ap.add_argument("--summary", nargs="?", const="", metavar="PATCH", help="print what the database holds, then exit")
    ap.add_argument("--export", action="store_true", help="with --summary: write the patch's counts as JSON")
    ap.add_argument("--import-json", metavar="DIR", help="load one-file-per-game JSON, then exit")
    a = ap.parse_args()
    db = open_db()
    if a.import_json:
        return import_json(db, a.import_json)
    if a.summary is not None:
        return summary(db, a.summary or None, a.export)
    try:
        Crawl(db, Client(a.delay), a.patch).run(a.hours, a.samples)
    except KeyboardInterrupt:
        log("stopped by hand; everything so far is saved")


if __name__ == "__main__":
    main()
