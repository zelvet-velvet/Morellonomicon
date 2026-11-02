---
name: mn-sync
description: Morellonomicon vault command CMD_SYNC. Use when the user types CMD_SYNC in the Morellonomicon repo (or asks to update Dev Status from this chat). Updates Today, Yesterday and Ongoing in Review/Dev Status.md from the chat and git.
---
# CMD_SYNC (Morellonomicon)

Target: `Review/Dev Status.md` (from the repo root).

1. **Look before reading**: `python3 -I tools/vault_status.py show` prints Today's and Yesterday's dates and items and each Ongoing area's counts. Then read only the parts you will change (grep the area heading); the note is long.
2. **Date**: Keep the date in the `Today` heading (`## 🚀 Today's Progress (YYYY-MM-DD)`) right. If it is an earlier day and Today has items, run `CMD_ROLLOVER` first (skill `mn-rollover`) or ask; empty → `vault_status.py rollover` just sets the date.
3. **Update** from the chat and `git log` / `git status`: `Today`, `Yesterday` and `Ongoing` (`[x]` done, `[>]` in progress, `[ ]` not started, `[!]` waiting for someone (name who or what), `[?]` waiting for a decision), Ongoing by area. **Read before edit**: read each section right before changing it; Zaviel may have rolled something back in Obsidian: never put it back.
4. **Results, not steps, kept short**: one item per feature, not per commit: fold follow-up fixes and tweaks into their feature's item instead of adding new ones (aim for at most about 10 items a day). One line each: bold title, then about 20 words of the result; no file lists, offsets or function chains (details belong in the notes and commits: link them). Never add "to check on the phone" or similar test markers: Zaviel is the only developer and tests everything anyway.
5. **Format**: Today is `> [!abstract]+ Today` under its heading, every line starting `> `; nested items use 4 spaces after `> `. Each Ongoing area is one callout titled with the area. Do not set callout types by hand: after editing run `python3 -I tools/vault_status.py callouts`, which sets every type from its boxes (rules in `Start/LLM Guide.md`, Vault note format).
6. **Stale-note hint** (read-only, last step): from the items just written, name the notes that probably need an update (by feature, file or function; grep the vault) as `**[Notes to review]** <note>, <note>`. Do not edit them here: that is `CMD_NOTES_SYNC`.
7. **Commit and push** only `Review/Dev Status.md` as `docs(vault): sync`.
8. **Notification** at the very end, only for what changed, a blank line before: `**[Today's Progress]** Updated in Dev Status`.
