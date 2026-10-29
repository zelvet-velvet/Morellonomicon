# Morellonomicon

黑魔禁書: a Traditional Chinese League of Legends beginner guide for Summoner's Rift and ARAM Mayhem, kept as an Obsidian vault. Read `Start/LLM Guide.md` first (map, rules, `CMD_SYNC`), then `Review/Dev Status.md` for what is built and what is pending.

Solo project, owner **Zaviel** (GitHub `zelvet-velvet`):
- Commit straight to `main` and push, small and often; never force-push.
- Commit with the repo's own git identity (already set; GitHub no-reply address).
- In a fresh clone (Claude Code in the cloud, a new machine) that identity is not set: before the first commit check `git config user.name` / `user.email`, and if they are not `Zaviel` / `81034608+zelvet-velvet@users.noreply.github.com`, set them with `git config` (repo level, not global).
- Vault content for readers is Traditional Chinese; workflow notes stay English.
- Each change gets a Dev Log entry (`CMD_JOURNAL`).
