"""Set each callout's type from its boxes, so the agent does not set or count them by hand.

Usage (from the repo root):
    python3 -I tools/vault/callouts.py [--check] NOTE ...

Rules: the vault note format in Start/LLM Guide.md (Block from its boxes). Exit codes: 0 done, 1 stale (--check).
The work log (status, day log, rollover) lives in the private morellonomicon-folio vault since 2026-11-18.
"""
import argparse, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HEAD = re.compile(r'^> \[!(\w+)\]([+-]?)(.*)$')
BOX = re.compile(r'^>\s*- \[(.)\]')
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
    notes = [Path(n) if Path(n).is_absolute() else ROOT / n for n in a.notes]
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


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('notes', nargs='+')
    ap.add_argument('--check', action='store_true')
    cmd_callouts(ap.parse_args())


if __name__ == '__main__':
    main()
