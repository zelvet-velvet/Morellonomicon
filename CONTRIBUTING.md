# Contributing to Morellonomicon

This is a small project by **Zaviel** (owner, `zelvet-velvet`), open to anyone who wants to help. This page is the agreed way of working; if something does not fit, say so in an issue.

## 1. Who decides what

| Role | Who | Does |
| --- | --- | --- |
| Owner | Zaviel (`zelvet-velvet`) | decides content and look, reviews and merges pull requests into `main`, keeps Dev Status and the Dev Log in shape |
| Contributor | you | picks or proposes issues, works on branches, opens pull requests |

- **`main` is the stable line.** Nobody pushes to `main` directly; everything arrives through a pull request (PR) that Zaviel merges.
- **The look is the owner's call.** Theme and CSS changes start as a screenshot in the issue; Zaviel picks, then it is built.
- **Ask early.** A short question in the issue saves a long PR that goes the wrong way.

## 2. First day (setup)

```
git clone https://github.com/zelvet-velvet/Morellonomicon.git   # fork first if you are not a collaborator
cd Morellonomicon
git config user.name  "Your Name"          # your own identity, set in this repo only
git config user.email "you@example.com"
python3 tools/install_plugins.py           # downloads the Obsidian plugins (not stored in git)
```

Open the folder `Morellonomicon Note/` as a vault in Obsidian (turn off Restricted Mode to enable the plugins). Then read `Morellonomicon Note/Start/LLM Guide.md` and `Morellonomicon Note/Review/Dev Status.md`.

## 3. The everyday loop

```
issue  ->  branch  ->  commits  ->  pull request  ->  review  ->  merge  ->  delete branch
```

1. **Issue first** (small fixes can skip it): what and why. Assign yourself so we never work on the same thing.
2. **Branch from a fresh `main`:** `git switch main && git pull && git switch -c feat/aram-augments` (`type/short-slug`: `feat`, `fix`, `refactor`, `chore`, `docs`).
3. **Commit small and often**, message `type(scope): summary` (lowercase, imperative, no period), e.g. `feat(champions): add the first ten champions`.
4. **Before the PR:** the change has a short Dev Log entry with your name, and your branch is up to date: `git fetch && git merge origin/main`.
5. **Open the PR** with `gh pr create` (the template asks what changed, pictures, what you checked). Zaviel reviews and merges with a merge commit; delete the branch afterwards.

## 4. Content rules

- Reader-facing notes are in **Traditional Chinese (Taiwan wording)**; use the official zh_TW client names for champions, items and augments.
- Generated pages are rewritten by scripts inside their marked block; write your advice outside it.
- Statistics need a named source and a date. Do not paste another site's tier list; link to it.
- Never commit a Riot API key, personal paths or real players' summoner names.

## 5. Notes for AI assistants

Claude Code reads `CLAUDE.md`, which points to `Morellonomicon Note/Start/LLM Guide.md` (rules and the `CMD_` commands for status and journal notes).
