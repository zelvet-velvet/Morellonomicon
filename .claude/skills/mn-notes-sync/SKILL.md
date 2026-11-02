---
name: mn-notes-sync
description: Morellonomicon vault command CMD_NOTES_SYNC [YYYY-MM-DD]. Use when the user types CMD_NOTES_SYNC in the Morellonomicon repo. Brings the notes describing the day's work up to date against the code, then moves finished Ongoing items from Review/Dev Status.md to Review/Progress Archive.md.
---
# CMD_NOTES_SYNC [YYYY-MM-DD] (Morellonomicon)

No argument: use `Today's Progress` in `Review/Dev Status.md`; with a date, `Yesterday's` when its heading date matches (`python3 -I tools/vault_status.py show`).

1. **Find**: from the progress items, grep the vault for the notes that describe the same feature, file or rule: `README.md`, `Start/Start Guide.md`, `Start/LLM Guide.md`, `AGENTS.md`, the skills in `.claude/skills/`, `Dev Tools/*` (Design Rules, Icons, Layouts, UI Text), `Start/Home.md`. Grep first, read only the matching sections of large notes.
2. **Check against the code** (`git log` / `git diff` of that day): fix only what is provably stale: status words, rules or commands that changed, file, script and function names, counts. Keep each note's own format (callouts by state).
3. **Do not touch**: Zaviel's own notes and ticks (never untick a box Zaviel ticked), the day notes' entries, generated notes (英雄, 道具, 強化), the Handbook decks' text. A decision Zaviel has not made: ask instead of writing.
4. **Finish Ongoing** (after the notes are current): read Dev Status again. Move `[x]` items from `Ongoing` to the top of `Review/Progress Archive.md`, one line per item under its area (`- **Area / topic**: result`, result only, `> ` prefix stripped), and remove them from Ongoing. Leave `[>]`, `[ ]`, `[!]`, `[?]`. Then `python3 -I tools/vault_status.py callouts` to reset the callout types. An `[x]` item whose note is not updated stays and is named in the report.
5. **Commit and push** the changed notes as `docs(vault): notes sync`.
6. **Report**: one line per changed note `**[Notes]** <note>: <what changed>`, then `**[Progress Archive]** Moved N items`; list the notes checked and found current.

**Trust order** when sources disagree: the code, then today's chat and Dev Status, then other notes.
