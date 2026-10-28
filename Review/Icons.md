---
title: Icons
date: 2026-10-28
tags:
  - morellonomicon
  - icons
sticker: lucide//shapes
---
One idea, one icon, everywhere in the app. Settled by the Champions filter panel (Zaviel, 2026-10-28). Icons are [Lucide](https://lucide.dev/icons) names drawn by Obsidian (`setIcon`); a name Obsidian does not have shows a plain circle. Colours are the CSS variables in `plugin/styles.css` (`.mn-app`).

**Rule for new work:** take the icon from the map in the code (the source of truth), never pick one in a page. A new idea gets its icon added to the map and to this note first.

---
## 🗡️ Damage kind
Source: `DAMAGE_ICON`, `DAMAGE_COLOR` in `plugin/src/ui.ts`. Used for damage type filters, damage pills on skill cards, scaling pills (`+60% 魔法攻擊`).

| Idea | Icon | Colour |
| --- | --- | --- |
| 物理 (physical, AD scaling) | `sword` | `--mn-phys` (orange) |
| 魔法 (magic, AP scaling) | `sparkles` | `--mn-magic` (blue) |
| 真實 (true) | `gem` | `--mn-true` (yellow) |
| 混合 (mixed) | `blend` | `--mn-mixed` (purple) |
| other scaling (`+其他加成`) | `plus` | `--mn-muted` |

## 🏷️ Ability tags
Source: `TAGS` in `plugin/src/pages/profile.ts` (also the groups and the legend text). Used for the 技能 filter, champion pages, skill cards, 速查.

| Group | Tag | Icon | Colour |
| --- | --- | --- | --- |
| 傷害 | 強化普攻 | `sword` | `--mn-aa` |
| 傷害 | 攻擊特效 | `crosshair` | `--mn-onhit` |
| 傷害 | %生命傷害 | `heart-crack` | `--color-red` |
| 傷害 | 斬殺 | `skull` | `--mn-exec` |
| 控制 | 控場 | `lock` | `--mn-cc` |
| 控制 | 緩速 | `snowflake` | `--mn-slow` |
| 控制 | 減益 | `trending-down` | `--mn-weak` |
| 移動 | 位移 | `arrow-big-right-dash` | `--mn-dash` |
| 移動 | 加速 | `wind` | `--mn-haste` |
| 移動 | 隱身 | `eye-off` | `--mn-stealth` |
| 生存 | 治療 | `heart-pulse` | `--mn-heal` |
| 生存 | 護盾 | `shield-plus` | `--mn-shield` |
| 生存 | 吸血 | `syringe` | `--mn-ls` |
| 生存 | 免傷 | `shield-half` | `--mn-guard` |
| 團隊 | 隊友增益 | `users` | `--mn-team` |

強化普攻 and 物理 share `sword` (both are about the basic attack / AD); they never stand side by side without their label colour.

## 🛡️ Roles and lanes
Source: `ROLE_FILE` / `ROLE_ICON` and `LANE_FILE` / `LANE_ICON` in `plugin/src/ui.ts`. The game's own class and position icons (from the League of Legends Wiki, shown by address); the Lucide name is only the fallback when a file does not load.

| Role | Game icon | Fallback | | Lane | Game icon | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| 戰士 | Fighter | `swords` | | 上路 | Top | `arrow-up-left` |
| 坦克 | Tank | `shield` | | 打野 | Jungle | `trees` |
| 法師 | Mage | `wand-sparkles` | | 中路 | Middle | `move-diagonal-2` |
| 刺客 | Slayer | `slice` | | 下路 | Bottom | `arrow-down-right` |
| 射手 | Marksman | `target` | | 輔助 | Support | `heart-handshake` |
| 輔助 | Controller | `heart-handshake` | | | | |

## 🧭 Tabs
Source: `TAB_ICON` in `plugin/src/modes.ts`: Champions `users`, Augments `sparkles`, Patch `newspaper`, Handbook `book-open`.

## 🃏 Handbook cards
- Combo result chips (`RESULT_ICON` in `plugin/src/pages/cardkit.ts`): 快 / 速 `zap`, 遠 / 長 `move-horizontal`, 痛 / 傷 / 強 `flame`, 穩 / 盾 `shield`, else `sparkles`.
- Forms (`FORM_ICONS`): first form `hammer`, second `crosshair`.
- Cooldown `timer`, cost `droplet`, range `crosshair` (stat boxes on ability cards).
- Tip line: a short accent line, no icon.
