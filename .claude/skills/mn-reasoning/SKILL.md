---
name: mn-reasoning
description: Morellonomicon reasoning todo after a patch or a new resg.top crawl: write rules for new augments, recheck rules of changed augments, drop rules of removed ones, and turn trick candidates (an augment or item that wins on a champion with no reason known) into 待驗證 tip cards in Inbox/技巧.md for Zaviel to try. Use when the session start says "Reasoning todo", when Zaviel asks to run it, or before writing or changing a rule in tools/reason/augment_tiers.py or a play style in tools/reason/build_tiers.py.
---
# Reasoning todo (Morellonomicon)

The tiers and builds come from rules in Python (`tools/reason/augment_tiers.py` `RULES`, one per augment; `tools/reason/build_tiers.py` play styles and item kinds), checked against resg.top's games: [[Augment Model]] and [[Build Model]] in `Dev Tools/`. A rerun costs nothing; only the list below needs thinking. Keep the work small: one item at a time, read only what it needs.

## Start
1. `git pull`, then `python3 -I tools/reason/reasoning_todo.py`; read `Review/Reasoning Todo.md` (short). If a session-start hook announced it, first tell Zaviel the counts and ask whether to run it now; Zaviel decides.
2. Work the sections in this order. After each one, rerun `python3 -I tools/reason/build_tiers.py` when items or play styles changed, then `python3 -I tools/reason/augment_tiers.py` (its tiers are per play style, from the styles build_tiers wrote), then `reasoning_todo.py`.

## Augments with no rule
- Read the augment's note in `強化/` (`effect`), its text in `_data/augment-text.json` / `_data/augment-wiki.json` and its tags in `_data/augment-data.json` (grep by id; never read these files whole).
- Write a rule in `RULES` under its rarity, reusing the `fit_*` helpers and the hand lists (SPIN, CHANNEL, SUMMON, ...); a reason in zh_TW of a few words, like the rules around it. A flat stat augment that suits everyone goes in `GENERIC`. An augment with no name or text yet (the game data lags) waits: skip it.

## Changed augments
- Read the change (listed with old → new). If the rule still describes what the augment rewards, it stands; if the change moves who it suits (a ratio from AD to AP, melee only, a cooldown that turns a one-off into a loop), change the rule.
- Either way record it: `tools/data/reasoning-done.json` `rules[<id>] = "<game patch>"` (the patch shown in the todo, e.g. 16.23).

## Rules for removed augments
- An id with no note: check the patch notes (`_data/patches.json`, `augments_removed`) or a rename (`tools/data/augment-aliases.json`). Removed: delete the rule. Renamed: nothing to do once the note exists.

## Trick candidates
Each is a pair where the games beat the reasoning: an augment far stronger on one champion than anywhere else, or an item a champion builds or wins with that no play style explains. Take the top ones (at most 10 per run).
1. Read the champion's kit (the champion note in `英雄/`: abilities, tags) and the augment or item text. Find the interaction that would explain it: an ability that procs on-hit, a cast that counts as an attack, a stacking passive, a reset, a shield that scales.
2. Decide:
   - **A real mechanic any champion like this would have** (a tag the rule misses): fix the rule or a hand list; result `rule`.
   - **Something worth trying in a game**: add a tip card to the ```mn-inbox block of `Inbox/技巧.md` (read the note right before editing; Zaviel may be editing it): `{"id": <6 random chars>, "hero": <champion zh name>, "mode": "大混戰", "type": "技巧" (an augment interaction) or "有趣出裝" (an item build), "title": <short>, "text": <the guessed mechanic and how to play it, zh_TW, plainly marked as a guess from game data>, "items": <item names joined by 、, items only>, "patch": <the resg patch>, "date": <today>, "source": "遊戲數據推測（resg.top <patch>）", "status": "待驗證"}`. No win-rate numbers in the card (resg.top's numbers are never shown). Result `card`.
   - **Noise or nothing to explain** (a popular item that just fits, a sample quirk): result `skip`, with a few words why.
3. Record every one in `reasoning-done.json` `candidates[<key>] = {"patch", "result", "note"}`; the key is the one `reasoning_todo.py` uses (`augment:<id>:<champion id>`, `item:<champion name>:<item name>`; `collect()` in the script gives each row's `key`).

Zaviel tries the cards in a game and turns 待驗證 into 已驗證 or deletes them; only then does "process the inbox" (skill `mn-content`) make them tips. An agent never marks its own guess 已驗證.

## End
- Commit (skill `git-workflow`): the scripts, `tools/data/reasoning-done.json`, the regenerated `_data/` and `Review/` files, `Inbox/技巧.md`. Tell Zaviel how many cards wait in the inbox to try.
