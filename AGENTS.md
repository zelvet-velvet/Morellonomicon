# Morellonomicon: agent instructions

黑魔禁書: a Traditional Chinese League of Legends beginner guide for Summoner's Rift and ARAM Mayhem, kept as an Obsidian vault with its own plugin. Any coding agent reads this file; Claude Code reads it through `CLAUDE.md`.

## Start here
- Shared rules: `Start/LLM Guide.md` (read it before editing notes, scripts or the plugin).
- **Work log**: the private Folio vault `../morellonomicon-folio` (GitHub `zelvet-velvet/morellonomicon-folio`) holds progress (`LLM/DEV_STATUS.md`, read only the part you need), decisions (`Notes/`), the test queue, the Dev Log history, the finished-work archive and the Vellum screens (`Spec/Screens.md`). Its own `AGENTS.md` and `LLM/LLM_GUIDE.md` give its rules; never write work-log notes into this public repo.
- Commands are typed as `/cmd-*` (slash completion lists them). The `mn-*` skills are committed here in `.claude/skills/<name>/SKILL.md`; the work-log skills (`cmd-*`, `git-workflow`, `test-queue`) are symlinks from the folio, listed in `.git/info/exclude` (`python3 ../morellonomicon-folio/Tools/setup/folio.py link` makes them). Claude Code loads skills by itself; any other agent opens the file when the task matches the table below. A cloud session has only the `mn-*` skills (no folio there): it records nothing in the work log and says so.
- Read a note right before editing it: Zaviel edits in Obsidian at the same time and may have rolled something back; never put it back.
- Before any UI work: read the core `Dev Tools/Design Rules/Design Rules.md`, then the topic notes its index lists for what you build, then that page's block in `Dev Tools/Layouts.md` and its source file. Layout options (mock pages) are Vellum screens in the folio's `Spec/Screens/`, the Layouts note keeps the blocks the plugin reads (skill `mn-layouts`).
- At the start of a session run `python3 -I tools/reason/reasoning_todo.py --hook` (Claude Code does it through `.claude/settings.json`); if it prints a line, tell Zaviel and offer the `mn-reasoning` skill.
- Large notes: grep first, read the matching section. Never read `Review/Tag Audit.md` or `Review/Augment Tiers.md` whole (generated, 130–140 KB each); `Dev Tools/Layouts.md` is about 50 KB of JSON.
- Vault content for readers is Traditional Chinese; workflow notes stay English. Reply in the language Zaviel writes in.

## Commands and skills
| Command / task | Skill | What it does |
| :--- | :--- | :--- |
| `/cmd-sync` | `cmd-sync` (folio) | Update Today / Yesterday / Ongoing in the folio's `DEV_STATUS.md` from the chat |
| `/cmd-rollover` | `cmd-rollover` (folio) | Today → Yesterday, Today cleared and dated, commit the folio |
| `/cmd-notes-sync [date]` | `cmd-notes-sync` (folio) | Fix stale notes, move `[x]` Ongoing items to the folio's `PROGRESS_ARCHIVE.md` |
| `/cmd-features` | `cmd-features` (folio) | List, add or remove the folio's features |
| (test checklists) | `test-queue` (folio) | `Quest/Test Queue.md` in the folio |
| (commit, push) | `git-workflow` (folio) | Same rules as Repo regulation below |
| (frontmatter, tips, builds, inbox) | `mn-content` | Champion / item / augment keys, tips and builds, "process the inbox" |
| (Handbook topic or card) | `mn-handbook` | Deck format, visual kinds, text limits |
| (Layouts or UI Text note, a new layout, the look) | `mn-layouts` | Apply / sync the layout, mock pages, UI Text, visual changes |
| (scripts, `_data/`, new patch) | `mn-data` | What each fetch script does, sources, Riot key |
| (reasoning todo after a patch, augment rules, trick candidates) | `mn-reasoning` | New / changed augment rules, games-beat-reasoning pairs as 待驗證 tip cards for Zaviel |

Work log made with [Folio](https://github.com/zelvet-velvet/folio) @ `557e13b` (`/cmd-new-vault`, features core, archive, screens, test-queue); the template clone is `../folio`, and `/cmd-features` in the folio pulls later improvements. Until 2026-11-18 the log lived in this repo (`Review/Dev Status.md`, `Review/Log/`): see git history.

## Repo regulation
Solo project, owner **Zaviel** (GitHub `zelvet-velvet`); no branches or pull requests.
- Commit straight to `main` and push, small and often, one topic per commit; never force-push. **Every change = commit + push**, without asking.
- Push to `main` even when the session names another branch (Claude Code in the cloud hands out `claude/...`): Zaviel tests every change on the phone through Obsidian Git, which pulls `main`. Fetch first; if `main` moved, merge it in (no rebase over pushed commits).
- Git identity: in a fresh clone check `git config user.name` / `user.email`; if not `Zaviel` / `81034608+zelvet-velvet@users.noreply.github.com`, set them at repo level.
- Messages `type(scope): summary`, lowercase, imperative, no trailing period; `type` is feat, fix, refactor, chore or docs; `scope` is champions, augments, modes, tools, vault, css, docs. End with the co-author line from the session's attribution rules.
- Stage only the files of the change; never `git add -A` (`.obsidian/` holds per-device files).
- Each change is recorded in the folio's `DEV_STATUS.md` (`/cmd-sync`).
- If collaborators are ever invited, add `CONTRIBUTING.md` and switch to branches + PRs first.

## Setup on a new machine
- `python3 tools/vault/install_plugins.py` downloads the editing plugins (git keeps only their settings).
- Plugin: `cd plugin && npm install && npm run check && npm run build && npm run install-vault`, then commit `.obsidian/plugins/morellonomicon/`.
