#!/usr/bin/env python3
"""What the augment and build reasoning still needs from an agent (or Zaviel), after a patch or a new resg.top crawl.

The tiers are worked out by rules in tools/augment_tiers.py (RULES, one per augment) and tools/build_tiers.py; a rerun costs
nothing. Only these need someone to think, and this script lists them in Review/Reasoning Todo.md:
- Augments with no rule (a new augment gets no tier until it has one).
- Augments the newest patch notes changed whose rule was not checked on that patch.
- Rules for augments the game no longer has (no note in 強化/).
- Trick candidates: pairs where resg.top's games beat the reasoning (_data/questions.json, written by the two tier scripts):
  an augment much stronger on a champion than anywhere else with no rule saying why, an item a champion builds often or wins
  with that no play style explains. Each one may be a trick (a hidden interaction, an off-meta build) for Zaviel to try.

What was done is kept in tools/data/reasoning-done.json (rules checked per patch, candidates turned into a card, a rule, or
skipped), so a list item goes away once handled. The skill .claude/skills/mn-reasoning/SKILL.md says how to work the list.

    python3 -I tools/reasoning_todo.py           # write Review/Reasoning Todo.md and print the counts
    python3 -I tools/reasoning_todo.py --hook    # one line for an agent's session start, nothing when the list is empty
Standard library.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))   # python3 -I does not add the script folder
import vault_paths  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DONE = ROOT / "tools" / "data" / "reasoning-done.json"
ALIASES = ROOT / "tools" / "data" / "augment-aliases.json"
QUESTIONS = ROOT / "_data" / "questions.json"
PATCHES = ROOT / "_data" / "patches.json"
OUT = ROOT / "Review" / "Reasoning Todo.md"
TOP = 10          # trick candidates shown per kind; the rest wait for the next run
MIN_GAP = 0.02    # an item built often with less than this gap over the champion is a habit, not a trick candidate


def read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def game_patch(p):
    """Riot's 26.23 is the game's 16.23."""
    major, _, minor = str(p).partition(".")
    return f"{int(major) - 10}.{minor}" if major.isdigit() and int(major) >= 20 else str(p)


def augment_notes():
    from augment_tiers import frontmatter
    notes = {}
    for path in (ROOT / vault_paths.AUGMENTS).glob("*.md"):
        fm = frontmatter(path)
        if str(fm.get("id", "")).isdigit():
            name = str(fm.get("name", "")).strip()   # one note (3176) has no name in the game data yet
            notes[int(fm["id"])] = {"name": name, "rarity": fm.get("rarity", ""), "off": "目前停用" in str(fm.get("effect", ""))}
    return notes


def candidate_key(kind, q):
    if kind == "augment":
        return f"augment:{q['augment']}:{q['champion']}"   # one per champion: its play styles share the games
    return f"item:{q['champion_name']}:{q['item']}"


def collect():
    from augment_tiers import RULES
    done = read(DONE, {})
    rules_done, cands_done = done.get("rules", {}), done.get("candidates", {})
    notes = augment_notes()
    by_name = {a["name"]: i for i, a in notes.items()}
    aliases = {k: v for k, v in read(ALIASES, {}).items() if not k.startswith("_")}
    newest = (read(PATCHES, {}).get("patches") or [{}])[0]
    patch = game_patch(newest.get("patch", "")) if newest else ""

    def note_id(name):
        return by_name.get(aliases.get(name, name))

    new_names = {aliases.get(a["name"], a["name"]) for a in newest.get("augments_new", [])}
    todo = {"patch": patch, "no_rule": [], "changed": [], "dead": [], "unknown": [], "augment": [], "item": [], "more": {}}
    for i, a in sorted(notes.items(), key=lambda kv: kv[1]["name"]):
        if i not in RULES and not a["off"]:
            todo["no_rule"].append({"id": i, "name": a["name"], "rarity": a["rarity"], "new": a["name"] in new_names})
    for a in newest.get("augments_changed", []):
        i = note_id(a["name"])
        if i is None:
            todo["unknown"].append(a["name"])
        elif i in RULES and rules_done.get(str(i)) != patch:
            todo["changed"].append({"id": i, "name": notes[i]["name"], "changes": a.get("changes", [])})
    for a in newest.get("augments_new", []):
        if note_id(a["name"]) is None:
            todo["unknown"].append(a["name"])
    todo["dead"] = sorted(i for i in RULES if i not in notes)

    q = read(QUESTIONS, {})
    todo["questions_patch"] = q.get("augments", {}).get("patch") or q.get("items", {}).get("patch") or ""
    aug = [x for x in q.get("augments", {}).get("strong", []) if x["augment"] in RULES]
    items = [x for x in q.get("items", {}).get("strong", [])] + [x for x in q.get("items", {}).get("popular", []) if x["gap"] >= MIN_GAP]
    for kind, rows in (("augment", aug), ("item", items)):
        seen, left = set(), []
        for x in sorted(rows, key=lambda x: -x["gap"]):
            k = candidate_key(kind, x)
            if k in cands_done or k in seen:
                continue
            seen.add(k)
            left.append(dict(x, key=k))
        todo[kind] = left[:TOP]
        todo["more"][kind] = max(0, len(left) - TOP)
    return todo


def count(todo):
    return {"no_rule": len(todo["no_rule"]), "changed": len(todo["changed"]), "dead": len(todo["dead"]), "unknown": len(todo["unknown"]),
            "candidates": len(todo["augment"]) + len(todo["item"]) + sum(todo["more"].values())}


def write(todo):
    n = count(todo)
    out = ["---", "title: Morellonomicon - Reasoning Todo", "tags:", "  - review", "  - augments", "sticker: lucide//brain", "---",
           "Written by `tools/reasoning_todo.py` (do not edit). What the augment and build reasoning still needs; the skill "
           "`mn-reasoning` says how to work it. Handled items are kept in `tools/data/reasoning-done.json` and drop off the list.", "",
           f"Newest patch notes: {todo['patch'] or '—'} · games behind the candidates: resg.top {todo['questions_patch'] or '—'}", ""]
    out += ["## Augments with no rule", ""]
    out += [(f"- [[{a['name']}]]" if a["name"] else "- (no name)") + f" ({a['rarity']}, {a['id']})" + (" — new this patch" if a["new"] else "") for a in todo["no_rule"]] or ["None."]
    out += ["", f"## Changed in {todo['patch']}, rule not checked", ""]
    for a in todo["changed"]:
        ch = "; ".join(f"{c.get('label', '')} {c.get('old', '')} → {c.get('new', '')}" for c in a["changes"])
        out.append(f"- [[{a['name']}]] ({a['id']}): {ch}")
    out += [] if todo["changed"] else ["None."]
    out += ["", "## Rules for augments the game no longer has", ""]
    out += [f"- {i}" for i in todo["dead"]] or ["None."]
    if todo["unknown"]:
        out += ["", "## Patch-note augments with no note", "", "A rename (add it to `tools/data/augment-aliases.json`) or a note not fetched yet.", ""]
        out += [f"- {name}" for name in todo["unknown"]]
    out += ["", "## Trick candidates: augments", "", "Much stronger on this champion than anywhere else, and no rule says why. Gap is the win rate "
            "over the augment's result on every champion.", ""]
    out += [f"- {x['champion_name']} · [[{x['name']}]]: {x['gap'] * 100:+.1f} in {x['games']} games"
            for x in todo["augment"]] or ["None."]
    if todo["more"]["augment"]:
        out.append(f"- …and {todo['more']['augment']} more")
    out += ["", "## Trick candidates: items", "", "Built often or winning, and no play style explains it.", ""]
    out += [f"- {x['champion_name']} · [[{x['item']}]]: " + (f"built in {x['pick'] * 100:.0f}% of games, " if x.get("pick") else "")
            + f"{x['gap'] * 100:+.1f}" for x in todo["item"]] or ["None."]
    if todo["more"]["item"]:
        out.append(f"- …and {todo['more']['item']} more")
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    return n


def summary(n):
    parts = [f"{n['no_rule']} augments without a rule", f"{n['changed']} changed augments to recheck", f"{n['candidates']} trick candidates"]
    if n["dead"]:
        parts.append(f"{n['dead']} rules for removed augments")
    if n["unknown"]:
        parts.append(f"{n['unknown']} patch-note augments with no note")
    return ", ".join(parts)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--hook", action="store_true", help="one line for an agent's session start; nothing when there is nothing to do")
    a = ap.parse_args()
    todo = collect()
    n = count(todo)
    if a.hook:
        if n["changed"] or n["dead"] or n["unknown"] or n["candidates"] or any(x["new"] for x in todo["no_rule"]):
            print(f"Reasoning todo ({todo['patch']}): {summary(n)}. Tell Zaviel and offer to run the mn-reasoning skill "
                  "(Review/Reasoning Todo.md).")
        return
    write(todo)
    print(summary(n))


if __name__ == "__main__":
    main()
