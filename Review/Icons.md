---
title: Icons
date: 2026-10-28
tags:
  - morellonomicon
  - icons
sticker: lucide//shapes
---
One idea, one icon, everywhere in the app. Settled by the Champions filter panel (Zaviel, 2026-10-28). Icons are [Lucide](https://lucide.dev/icons) names drawn by Obsidian (`setIcon`); a name Obsidian does not have shows a plain circle. Colours are the CSS variables in `plugin/styles.css` (`.mn-app`).

**See and change them:** every list below is an editor. Each row shows the icon in its colour; tap the name box and a scrolling grid of Lucide icons opens under the row (type to filter it by name; tap an icon to take it), pick a colour with the colour square or type a `#hex`, and the note saves by itself. The ↺ button drops your colour and goes back to the app's own (the small `--name` under the label). A name Obsidian does not have turns the box red. When you are done, tell Claude to apply the note to the code: the map in the code stays the source of truth until then.

**Rule for new work:** take the icon from the map in the code (the source of truth), never pick one in a page. A new idea gets its icon added to the map and to this note first.

---
## 🗡️ Damage kind
Source: `DAMAGE_ICON`, `DAMAGE_COLOR` in `plugin/src/ui.ts`. Used for damage type filters, damage pills on skill cards, scaling pills (`+60% 魔法攻擊`).

```mn-icons
物理 (AD) | sword | --mn-phys | #d5763f
魔法 (AP) | sparkles | --mn-magic | #6c99bb
真實 (true) | gem | --mn-true | #e5b567
混合 (mixed) | blend | --mn-mixed | #9e86c8
other scaling (+其他加成) | plus | --mn-muted | #c4beb4
```

## 🏷️ Ability tags
Source: `TAGS` in `plugin/src/pages/profile.ts` (also the groups and the legend text). Used for the 技能 filter, champion pages, skill cards, 速查.

```mn-icons
傷害 強化普攻 | sword | --mn-aa | #b05279
傷害 攻擊特效 | crosshair | --mn-onhit | #d5763f
傷害 %生命傷害 | heart-crack | --color-red | #d04255
傷害 斬殺 | skull | --mn-exec
控制 控場 | link | --mn-cc
控制 緩速 | snowflake | --mn-slow | #6c99bb
控制 減益 | trending-down | --mn-weak | #b98bd6
移動 位移 | arrow-big-right-dash | --mn-dash | #73bbb2
移動 加速 | wind | --mn-haste | #5ec2b7
移動 隱身 | eye-off | --mn-stealth | #9aa3b8
生存 治療 | heart-pulse | --mn-heal | #a8c373
生存 護盾 | shield-plus | --mn-shield | #9e86c8
生存 吸血 | syringe | --mn-ls | #d04255
生存 免傷 | shield-half | --mn-guard | #d4a95f
團隊 隊友增益 | users | --mn-team | #7ccf8f
```

強化普攻 and 物理 share `sword` (both are about the basic attack / AD); they never stand side by side without their label colour.

## 🛡️ Roles and lanes
Source: `ROLE_FILE` / `ROLE_ICON` and `LANE_FILE` / `LANE_ICON` in `plugin/src/ui.ts`. The game's own class and position icons (from the League of Legends Wiki, shown by address); the Lucide name is only the fallback when a file does not load.

```mn-icons
戰士 (Fighter) | swords
坦克 (Tank) | shield
法師 (Mage) | wand-sparkles
刺客 (Slayer) | slice
射手 (Marksman) | target
輔助 (Controller) | heart-handshake
上路 (Top) | arrow-up-left
打野 (Jungle) | trees
中路 (Middle) | move-diagonal-2
下路 (Bottom) | arrow-down-right
輔助 (Support) | heart-handshake
```

## 🧭 Tabs
Source: `TAB_ICON` in `plugin/src/modes.ts`.

```mn-icons
Champions | users
Augments | sparkles
Patch | newspaper
Handbook | book-open
```

## 🃏 Handbook cards
Combo result chips (`RESULT_ICON` in `plugin/src/pages/cardkit.ts`), forms (`FORM_ICONS`) and ability stat boxes. The tip line is a short accent line with no icon.

```mn-icons
快 / 速 | zap
遠 / 長 | move-horizontal
痛 / 傷 / 強 | flame
穩 / 盾 | shield
其他 | sparkles
第一型態 | hammer
第二型態 | crosshair
冷卻 | timer
消耗 | droplet
射程 | crosshair
```
