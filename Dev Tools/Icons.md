---
title: Icons
date: 2026-10-28
tags:
  - morellonomicon
  - icons
sticker: lucide//shapes
---
> [!abstract]+ One idea, one icon
> One idea, one icon, everywhere in the app. Settled by the Champions filter panel (Zaviel, 2026-10-28). Icons are [Lucide](https://lucide.dev/icons) names drawn by Obsidian (`setIcon`); a name Obsidian does not have shows a plain circle. Colours are the CSS variables in `plugin/styles.css` (`.mn-app`).

> [!tip]+ See and change them
> Every list below is an editor. Each row shows the icon in its colour; tap the name box and a scrolling grid of Lucide icons opens under the row (type to filter it by name; tap an icon to take it), pick a colour with the colour square or type a `#hex`, and the note saves by itself. The ↺ button drops your colour and goes back to the app's own (the small `--name` under the label). A name Obsidian does not have turns the box red. When you are done, tell Claude to apply the note to the code: the map in the code stays the source of truth until then.

> [!info]+ Rule for new work
> Take the icon from the map in the code (the source of truth), never pick one in a page. A new idea gets its icon added to the map and to this note first.

---

## 🗡️ Damage kind
> [!info]+ Where it lives
> Source: `DAMAGE_ICON`, `DAMAGE_COLOR` in `plugin/src/ui.ts`. Used for damage type filters, damage pills on skill cards, scaling pills (`+60% 魔法攻擊`).

```mn-icons
物理 (AD) | sword | --mn-phys | #d5763f
魔法 (AP) | sparkles | --mn-magic | #6c99bb
真實 (true) | gem | --mn-true | #e5b567
混合 (mixed) | blend | --mn-mixed | #9e86c8
other scaling (+其他加成) | plus | --mn-muted | #c4beb4
```

## 🏷️ Ability tags
> [!info]+ Where it lives
> Source: `TAGS` in `plugin/src/pages/profile.ts` (also the groups and the legend text). Used for the 技能 filter, champion pages, skill cards, 速查.

```mn-icons
傷害 強化普攻 | sword | --mn-aa | #b05279
傷害 攻擊特效 | crosshair | --mn-onhit | #d5763f
傷害 %生命傷害 | heart-crack | --color-red | #d04255
傷害 斬殺 | skull | --mn-exec
控制 控場 | link | --mn-cc
控制 緩速 | anchor | --mn-slow | #6c99bb
控制 減益 | trending-down | --mn-weak | #b98bd6
移動 位移 | move | --mn-dash | #73bbb2
移動 加速 | wind | --mn-haste | #5ec2b7
移動 隱身 | ghost | --mn-stealth | #9aa3b8
生存 治療 | heart-plus | --mn-heal | #a8c373
生存 護盾 | shield-plus | --mn-shield | #9e86c8
生存 吸血 | syringe | --mn-ls | #d04255
生存 免傷 | shield-half | --mn-guard | #d4a95f
團隊 隊友增益 | users | --mn-team | #7ccf8f
```
> [!note]+ Note
> 強化普攻 and 物理 share `sword` (both are about the basic attack / AD); they never stand side by side without their label colour.

## 📈 Stats to build (速查 玩法)
> [!info]+ Where it lives
> Source: `STAT_ICON`, `STAT_COLOR` in `plugin/src/ui.ts` (the `stack` key of a champion note); stats with a `shop:N` icon show the game's shop icon (`SHOP_ROW`), the colour is the chip's; reach (近戰 / 中程 / 遠程) is `REACH_ICON`.

```mn-icons
法術強度 | shop:5 | --mn-magic
攻擊力 | shop:0 | --mn-phys
攻速 | shop:2 | --mn-true
技能急速 | shop:11 | --mn-haste
暴擊 | shop:1 | --mn-exec
生命 | shop:8 | --mn-heal
護甲 | shop:9 | --mn-guard
魔防 | shop:10 | --mn-shield
穿透 | shop:4 | --mn-aa
跑速 | shop:12 | --mn-dash
攻擊距離 | ruler | 
```

## 🛍️ Item shop filters (Items page)
> [!info]+ Where it lives
> Source: `ITEM_CATS` and `ITEM_CAT_COLOR` in `plugin/src/ui.ts`. Colours: grey when off, the colour below when on (魔力 and 法術穿透 chosen by Claude, 2026-10-29: mana with the magic blue, magic penetration in the debuff purple, as 物理穿透 is apart from 物理). The shop icons are sharpened on the device and painted in the app's colours, not the game's. The rail shows the game's own shop icons, cut by position from its sprite sheet (`SHOP_SPRITE`, CommunityDragon `itemshop_texture_atlas4.png`, shown by address); an icon written `shop:N` is row N of that sheet (the editor draws it; the Lucide fallback stays in the code).

```mn-icons
全部 | layout-grid
攻擊力 | shop:0 | --mn-phys
暴擊 | shop:1 | --mn-exec
攻速 | shop:2 | --mn-true
攻擊特效 | shop:3 | --mn-onhit
物理穿透 | shop:4 | --mn-aa
法術強度 | shop:5 | --mn-magic
魔力 | shop:6 | --mn-magic
法術穿透 | shop:7 | --mn-weak
生命 | shop:8 | --mn-heal
護甲 | shop:9 | --mn-guard
魔防 | shop:10 | --mn-shield
技能急速 | shop:11 | --mn-haste
移動 | shop:12 | --mn-dash
吸血 | shop:13 | --mn-ls
```

## 📖 名詞表 (glossary)
> [!info]+ Where it lives
> Source: `OWN` in `plugin/src/pages/glossary.ts`. A term that is also a damage kind, a stat or an ability tag keeps that icon and colour (AD = 物理, 護甲, 控場…); only the terms below are the glossary's own (chosen by Claude, 2026-10-29).

```mn-icons
普攻 | mouse-pointer-click | --mn-text
爆發 | zap | --mn-exec
前排 | brick-wall | --mn-guard
後排 | telescope | --mn-phys
開團 | flag | --mn-accent
風箏 | rewind | --mn-dash
增幅裝置 | sparkles | --mn-accent
回血包 | package-plus | --mn-heal
```

## 🛡️ Roles and lanes
> [!info]+ Where it lives
> Source: `ROLE_FILE` / `ROLE_ICON` and `LANE_FILE` / `LANE_ICON` in `plugin/src/ui.ts`. The game's own class and position icons (from the League of Legends Wiki, shown by address); the Lucide name is only the fallback when a file does not load.

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
> [!info]+ Where it lives
> Source: `TAB_ICON` in `plugin/src/modes.ts`.

```mn-icons
Home | house
Champions (opened from Home) | users
Picks | clipboard-edit
Augments | sparkles
Patch | newspaper
Handbook | book-open
```

## 🦸 Champion page pages
> [!info]+ Where it lives
> Source: `CHAMPION_TABS` in `plugin/src/pages/champions.ts`. The pages of the champion page's swipe block (and the Handbook card that pictures them).

```mn-icons
概覽 | id-card
技能 | keyboard
出裝 | shopping-bag
強化 | sparkles
技巧 | lightbulb
```

## 🃏 Handbook cards
> [!note]+ Note
> Combo result chips (`RESULT_ICON` in `plugin/src/pages/cardkit.ts`), forms (`FORM_ICONS`) and ability stat boxes. The tip line is a short accent line with no icon.

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
