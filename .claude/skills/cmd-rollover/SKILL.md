---
name: cmd-rollover
description: Morellonomicon vault command /cmd-rollover. Use when the user runs /cmd-rollover (or says the day is over). Moves Today's list in Review/Dev Status.md to Yesterday, clears and re-dates Today, commits.
---
# /cmd-rollover (Morellonomicon)

The script does the file and git work; do not read `Start/LLM Guide.md` or the whole Dev Status for this.

1. `python3 -I tools/vault_status.py show` → Today's date and items. Empty → say to run `/cmd-sync` first and stop (never overwrite Yesterday with an empty list).
2. `python3 -I tools/vault_status.py day-note <Today's date>` → if the day note is missing or has `0 entries`, or the Dev Log does not list it, run `/cmd-journal <date>` first (skill `cmd-journal`).
3. `python3 -I tools/vault_status.py rollover --commit --coauthor "<this session's co-author>"` replaces Yesterday with Today's list and date, clears Today and dates it today, and commits only `Review/Dev Status.md` as `docs(vault): rollover <date>`. Exit `1` = nothing to roll over; exit `2` = no day note entries (step 2 was skipped; `--force` only if Zaviel says so). `--today YYYY-MM-DD` when the new day is not the system date.
4. `git push` (fetch and merge `main` first if it moved). Report the script output in one or two lines.
