---
name: cmd-journal
description: Morellonomicon vault command /cmd-journal [YYYY-MM-DD]. Use when the user runs /cmd-journal (or asks for the day's Dev Log entries). Writes that day's Dev Log note in Review/Log/ (one English entry per feature) from Dev Status and lists the day in Review/Dev Log.md.
---
# /cmd-journal [YYYY-MM-DD] (Morellonomicon)

Default day: today. Source: `Today's Progress` in `Review/Dev Status.md`, or `Yesterday's` when its heading date matches (`python3 -I tools/vault_status.py show`), plus `git log --since/--until` for that day.

1. **Find the note**: `python3 -I tools/vault_status.py day-note <date>` prints the path (`Review/Log/YYYY/MM/Www/YYYY-MM-DD.md`), its entry count and whether [[Dev Log]] lists it. Missing → rerun with `--create` (same frontmatter as the Templater `_Meta/Templates/Day note.md`).
2. **Read before edit**: read the note right before writing; Zaviel may have changed it. Keep existing entries; never duplicate one.
3. **Entries**: one `## ` entry per feature, not per commit (follow-up fixes and tweaks go into their feature's entry; aim for at most about 10 entries a day), newest first, under the first `---`: an emoji title with the author in brackets (`(Claude, for Zaviel)`), then **two to four** plain bullets of what changed **for the reader of the vault** (what it does and looks like, not how the code does it), the branch if not merged, pictures if visual. The commit messages hold the detail. No "to check on the phone" markers.
4. **Dev Log index**: add or update the day's line under its year in `Review/Dev Log.md` (newest first): `- [[YYYY-MM-DD]]: <the day's main changes, one line>`.
5. **Commit and push** only those two notes as `docs(vault): journal <date>`.
6. **Notification**: `**[Journal]** N entries in <date>`.
