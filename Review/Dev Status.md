---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Kept by `/cmd-sync` / `/cmd-rollover` / `/cmd-notes-sync` (skills, table in `AGENTS.md`); the day notes in `Review/Log/` by `/cmd-journal`. Run `python3 -I tools/vault_status.py show` before reading this note; read only the section you change.

## 🚀 Today's Progress (2026-11-03)
> [!abstract]+ Today
> - **Augment tiers rebuilt**: every augment tiered per champion from a reasoning rule on the kit, checked against resg.top's 16.21 Mayhem games; no resg numbers stored, unexplained pairs in [[Augment Questions]].
> - **Zaviel's augment answers**: two tier lists for dual-build champions (Kai'Sa, Kog'Maw, Udyr, Shaco, TF, Ashe, Bard, Miss Fortune); Malphite, Nasus, Qiyana, Hecarim and more explained.
> - **Augments by rarity**: each tier lists 稜鏡, 金, 銀, then 五殺; the 強化 page keeps the best S augments that fit before ordering them.
> - **Handbook pile without corner slivers**: the full-screen deck leaves a little room around the card and the pile leans less, so the cards under it show whole instead of cut flat at the screen edge.
> - **Gentler background prefetch**: the portraits cached after start-up come one at a time, so they never crowd a page or a swipe.

## 📅 Yesterday's Progress (2026-11-02)
> [!abstract]- Yesterday
> - **Project management like agent-worklog-vault**: `AGENTS.md` is the entry point; the commands and the long task rules are `mn-*` skills in `.claude/skills/`; [[LLM Guide]] keeps the shared rules (26 → 11 KB); `tools/vault_status.py` does the mechanical steps; finished work moved to [[Progress Archive]].
> - **Pictures fetched ahead from one place**: `media.ts` builds every picture address and fetches what a page needs before it opens; every page must list its needs to build; Settings → Picture readout shows pictures that came late; every champion and topic link on screen fetches its page's splash before the tap, so the art is there the moment the page opens. Picking a champion on 速查 fetches its card's splash and skins at once. The Picks hand's small cards show at once (portraits fetched ahead, kept between picks). Every champion's portrait is cached after start-up (not on a phone network). The champion page's swipe pages after 概覽 each show their own skin behind them, like the 速查 card's tabs.
> - **Only a real load is blurred**: Handbook topics, the 你知道嗎 tips, the champion art and clip boxes show sharp at once when their pictures are already in.
> - **Next**: review the augment recommendations on the 強化 tab and `Review/Augment Tiers.md` (see Ongoing → Data).
