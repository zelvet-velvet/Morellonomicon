"""The mechanical parts of the vault commands, so the agent does not read or count by hand.

Usage (from the repo root):
    python3 -I tools/vault_status.py show                  # Today's / Yesterday's dates and items, Ongoing open counts
    python3 -I tools/vault_status.py callouts [--check] [NOTE ...]
                                                          # set each callout's type from its boxes (default: Dev Status)
    python3 -I tools/vault_status.py rollover [--commit]   # Today -> Yesterday, Today cleared and dated today
    python3 -I tools/vault_status.py day-note [DATE] [--create]
                                                          # path of a Dev Log day note, its entry count; make it if missing

Rules: the skills in .claude/skills/ (mn-sync, mn-rollover, mn-journal, mn-notes-sync) and the
vault note format in Start/LLM Guide.md. Exit codes: 0 done, 1 nothing to do / stale (--check), 2 not found.
"""
import argparse, datetime, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / 'Review' / 'Dev Status.md'
LOG_DIR = ROOT / 'Review' / 'Log'
DEV_LOG = ROOT / 'Review' / 'Dev Log.md'
TODAY_RE = re.compile(r"^## 🚀 Today's Progress \((\d{4}-\d{2}-\d{2})\)\n", re.M)
YEST_RE = re.compile(r"^## 📅 Yesterday's Progress \((\d{4}-\d{2}-\d{2})\)\n", re.M)
HEAD = re.compile(r'^> \[!(\w+)\]([+-]?)(.*)$')
BOX = re.compile(r'^>\s*- \[(.)\]')
ITEM = re.compile(r'^> - ')
OPEN = set(' >/')
STATEFUL = {'todo', 'done', 'warning', 'question', 'failure'}


def read(p):
    raw = p.read_bytes().decode('utf-8')
    return raw.replace('\r\n', '\n'), '\r\n' in raw


def write(p, text, crlf):
    p.write_bytes((text.replace('\n', '\r\n') if crlf else text).encode('utf-8'))


def state(boxes):
    """Callout type from the box symbols of one block (LLM Guide, Block from its boxes)."""
    if all(b == '-' for b in boxes):
        return 'failure'
    if all(b in 'x-' for b in boxes):
        return 'done'
    if '!' in boxes:
        return 'warning'
    if '?' in boxes:
        return 'question'
    return 'todo'


def blocks(lines):
    """(head index, end index) of every callout."""
    i = 0
    while i < len(lines):
        if HEAD.match(lines[i]):
            j = i + 1
            while j < len(lines) and lines[j].startswith('>') and not HEAD.match(lines[j]):
                j += 1
            yield i, j
            i = j
        else:
            i += 1


def cmd_callouts(a):
    notes = [Path(n) if Path(n).is_absolute() else ROOT / n for n in a.notes] or [STATUS]
    stale = 0
    for note in notes:
        text, crlf = read(note)
        lines = text.split('\n')
        changed = []
        for i, j in blocks(lines):
            m = HEAD.match(lines[i])
            boxes = [BOX.match(l).group(1) for l in lines[i + 1:j] if BOX.match(l)]
            if not boxes or m.group(1).lower() not in STATEFUL | {'abstract', 'example', 'note', 'info'}:
                continue
            typ = state(boxes)
            new = f'> [!{typ}]{m.group(2)}{m.group(3)}'
            if new != lines[i]:
                changed.append(f'  {lines[i]}  ->  {new}')
                lines[i] = new
        rel = note.relative_to(ROOT)
        if changed:
            stale += 1
            print(f'{rel}:\n' + '\n'.join(changed))
            if not a.check:
                write(note, '\n'.join(lines), crlf)
        else:
            print(f'{rel}: callouts are current')
    sys.exit(1 if a.check and stale else 0)


def sections(s):
    t, y = TODAY_RE.search(s), YEST_RE.search(s)
    if not t or not y or y.start() < t.end():
        sys.exit("Dev Status: Today / Yesterday headings with (YYYY-MM-DD) not found")
    y_end = s.find('\n---', y.end())
    return t, y, (len(s) if y_end < 0 else y_end)


def items(body):
    """The list items of a section, without a placeholder line ('- Nothing yet…')."""
    return [l for l in body.split('\n') if ITEM.match(l) and not l.startswith('> - Nothing yet')]


def cmd_show(a):
    s, _ = read(STATUS)
    t, y, y_end = sections(s)
    today, yest = items(s[t.end():y.start()]), items(s[y.end():y_end])
    print(f"Today ({t.group(1)}): {len(today)} items")
    print('\n'.join(today))
    print(f"Yesterday ({y.group(1)}): {len(yest)} items")
    lines = s[y_end:].split('\n')
    for i, j in blocks(lines):
        boxes = [BOX.match(l).group(1) for l in lines[i + 1:j] if BOX.match(l)]
        if boxes:
            n = sum(b in OPEN for b in boxes)
            waits = sum(b in '!?' for b in boxes)
            done = sum(b == 'x' for b in boxes)
            print(f"Ongoing {HEAD.match(lines[i]).group(3).strip()}: {n} open, {waits} waiting, {done} done")


def day_path(date):
    d = datetime.date.fromisoformat(date)
    return LOG_DIR / f'{d:%Y}' / f'{d:%m}' / f'W{d.isocalendar()[1]:02d}' / f'{date}.md'


def cmd_day_note(a):
    date = a.date or datetime.date.today().isoformat()
    p = day_path(date)
    if not p.exists():
        hits = list(LOG_DIR.rglob(f'{date}.md'))
        p = hits[0] if len(hits) == 1 else p
    if p.exists():
        n = sum(1 for l in read(p)[0].split('\n') if l.startswith('## '))
        print(f'{p.relative_to(ROOT)}: {n} entries')
        listed = f'[[{date}]]' in read(DEV_LOG)[0]
        print(f'Dev Log: {"listed" if listed else "not listed yet"}')
        return
    if not a.create:
        print(f'{p.relative_to(ROOT)}: missing (rerun with --create)')
        sys.exit(2)
    d = datetime.date.fromisoformat(date)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        f'---\ntitle: Dev Log · {date}\ndate: {date}\ntags:\n  - dev-log\n  - morellonomicon\n'
        f'up: "[[Dev Log]]"\nsticker: lucide//calendar-days\n---\n'
        f'What changed on {d:%A}, {date} (newest first). The index of all days, what is pending and ideas: [[Dev Log]].\n\n---\n',
        encoding='utf-8')
    print(f'{p.relative_to(ROOT)}: created, 0 entries')


def cmd_rollover(a):
    s, crlf = read(STATUS)
    t, y, y_end = sections(s)
    date = t.group(1)
    body = s[t.end():y.start()]
    today = items(body)
    new_date = a.today or datetime.date.today().isoformat()
    if not today:
        if date != new_date:
            write(STATUS, s[:t.start()] + f"## 🚀 Today's Progress ({new_date})\n" + s[t.end():], crlf)
            print(f'Today was empty: only its date set to {new_date}. Yesterday unchanged.')
        else:
            print('Today has no items: run CMD_SYNC first. Nothing changed.')
        sys.exit(1)
    if date == new_date and not a.force:
        print(f'Today is already dated {new_date}; rolling it over would empty today. Rerun with --force if meant.')
        sys.exit(1)
    p = day_path(date)
    if not p.exists() or sum(1 for l in read(p)[0].split('\n') if l.startswith('## ')) == 0:
        print(f'Warning: no day note entries for {date} ({p.relative_to(ROOT)}): run CMD_JOURNAL {date} first.')
        if not a.force:
            sys.exit(2)
    yest = "> [!abstract]- Yesterday\n" + '\n'.join(today) + '\n'
    s = (s[:t.start()] + f"## 🚀 Today's Progress ({new_date})\n\n"
         + f"## 📅 Yesterday's Progress ({date})\n" + yest + s[y_end:])
    write(STATUS, s, crlf)
    print(f'[Status] Yesterday = {date} ({len(today)} items), Today = {new_date} (empty)')
    if a.commit:
        rel = str(STATUS.relative_to(ROOT))
        subprocess.run(['git', '-C', str(ROOT), 'add', '--', rel], check=True)
        msg = f'docs(vault): rollover {date}'
        if a.coauthor:
            msg += f'\n\nCo-Authored-By: {a.coauthor}'
        subprocess.run(['git', '-C', str(ROOT), 'commit', '-q', '-m', msg, '--', rel], check=True)
        print(f'[Git] committed: {msg.splitlines()[0]} (not pushed)')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('show').set_defaults(f=cmd_show)
    c = sub.add_parser('callouts')
    c.add_argument('notes', nargs='*')
    c.add_argument('--check', action='store_true')
    c.set_defaults(f=cmd_callouts)
    r = sub.add_parser('rollover')
    r.add_argument('--today', help='the new day (default: the system date)')
    r.add_argument('--force', action='store_true')
    r.add_argument('--commit', action='store_true')
    r.add_argument('--coauthor', default='', help='"Name <email>" for the commit trailer')
    r.set_defaults(f=cmd_rollover)
    d = sub.add_parser('day-note')
    d.add_argument('date', nargs='?')
    d.add_argument('--create', action='store_true')
    d.set_defaults(f=cmd_day_note)
    a = ap.parse_args()
    a.f(a)


if __name__ == '__main__':
    main()
