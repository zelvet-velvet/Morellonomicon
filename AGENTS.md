# Morellonomicon: agent instructions

黑魔禁書: a Traditional Chinese League of Legends beginner guide for Summoner's Rift and ARAM Mayhem, kept as an Obsidian vault with its own plugin. Any coding agent reads this file; Claude Code reads it through `CLAUDE.md`.

## Start here
- Shared rules: `Start/LLM Guide.md` (read it before editing notes, scripts or the plugin). Progress: `python3 -I tools/vault_status.py show`, then only the part of `Review/Dev Status.md` you need.
- Task rules are skills in `.claude/skills/<name>/SKILL.md`: Claude Code loads them by itself; any other agent opens the file when the task matches the table below.
- Read a note right before editing it: Zaviel edits in Obsidian at the same time and may have rolled something back; never put it back.
- Large notes: grep first, read the matching section. Never read `Review/Tag Audit.md` or `Review/Augment Tiers.md` whole (generated, 130–140 KB each); `Dev Tools/Layouts.md` is about 50 KB of JSON.
- Vault content for readers is Traditional Chinese; workflow notes stay English. Reply in the language Zaviel writes in.

## Commands and skills
| Command / task | Skill | What it does |
| :--- | :--- | :--- |
| `CMD_SYNC` | `mn-sync` | Update Today / Yesterday / Ongoing in Dev Status from the chat and git |
| `CMD_JOURNAL [date]` | `mn-journal` | The day's Dev Log note (one English entry per change) and the Dev Log index |
| `CMD_ROLLOVER` | `mn-rollover` | Today → Yesterday, Today cleared and dated, commit (`tools/vault_status.py rollover`) |
| `CMD_NOTES_SYNC [date]` | `mn-notes-sync` | Fix stale notes, move `[x]` Ongoing items to `Review/Progress Archive.md` |
| (frontmatter, tips, builds, inbox) | `mn-content` | Champion / item / augment keys, tips and builds, "process the inbox" |
| (Handbook topic or card) | `mn-handbook` | Deck format, visual kinds, text limits |
| (Layouts or UI Text note, a new layout, the look) | `mn-layouts` | Apply / sync the layout, mock pages, UI Text, visual changes |
| (scripts, `_data/`, new patch) | `mn-data` | What each fetch script does, sources, Riot key |

The `cmd-*` skills in `~/.claude/skills/` belong to another vault (S11_Obs); in this repo `CMD_*` always means the `mn-*` skill.

## Repo regulation
Solo project, owner **Zaviel** (GitHub `zelvet-velvet`); no branches or pull requests.
- Commit straight to `main` and push, small and often, one topic per commit; never force-push. **Every change = commit + push**, without asking.
- Push to `main` even when the session names another branch (Claude Code in the cloud hands out `claude/...`): Zaviel tests every change on the phone through Obsidian Git, which pulls `main`. Fetch first; if `main` moved, merge it in (no rebase over pushed commits).
- Git identity: in a fresh clone check `git config user.name` / `user.email`; if not `Zaviel` / `81034608+zelvet-velvet@users.noreply.github.com`, set them at repo level.
- Messages `type(scope): summary`, lowercase, imperative, no trailing period; `type` is feat, fix, refactor, chore or docs; `scope` is champions, augments, modes, tools, vault, css, docs. End with the co-author line from the session's attribution rules.
- Stage only the files of the change; never `git add -A` (`.obsidian/` holds per-device files).
- Each change gets a Dev Log entry (`CMD_JOURNAL`).
- If collaborators are ever invited, add `CONTRIBUTING.md` and switch to branches + PRs first.

## Setup on a new machine
- `python3 tools/install_plugins.py` downloads the editing plugins (git keeps only their settings).
- Plugin: `cd plugin && npm install && npm run check && npm run build && npm run install-vault`, then commit `.obsidian/plugins/morellonomicon/`.
