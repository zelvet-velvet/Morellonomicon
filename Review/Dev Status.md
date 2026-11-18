---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Kept by `/cmd-sync` / `/cmd-rollover` / `/cmd-notes-sync` (skills, table in `AGENTS.md`); the day notes in `Review/Log/` by `/cmd-journal`. Run `python3 -I tools/vault_status.py show` before reading this note; read only the section you change.

## 🚀 Today's Progress (2026-11-18)
> [!abstract]+ Today
> - **Mayhem not in Riot's match API**: tested with a key on tw2: Match-V5 lists ARAM and Arena games but no Mayhem (queue 2400) for anyone; noted in skill `mn-data`.
> - **Mayhem crawler through the League client**: `tools/fetch_lcu.py` reads Mayhem games (champion, win, items, four augments) from the client's own match history on a small account into an offline SQLite file, no names or ids; menu, progress bar and a Windows launcher; pauses in games, stops if another account logs in. First 1,000 games of 16.22 collected; numbers stay private until decided.

## 📅 Yesterday's Progress (2026-11-11)
> [!abstract]- Yesterday
> - **Commit email privacy**: a work address removed from the history of [[Vellum]] and one private repo; git now defaults to the GitHub noreply address, and GitHub blocks pushes that expose a private email.
