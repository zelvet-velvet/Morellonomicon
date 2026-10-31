---
title: Morellonomicon - Augment Model
date: 2026-10-31
tags:
  - dev-tools
  - augments
  - morellonomicon
sticker: lucide//calculator
---
How the app ranks ARAM Mayhem augments for each champion from the champion's own numbers, not from match results. Riot does not serve Mayhem games through its API, and win rates reflect how people play and the meta; this model asks a different question: **how much stronger does this augment make this champion, by its kit?** Sites with match data (OP.GG, Mobalytics) stay linked for the other view.

---
## 🧭 The idea

> [!abstract]+ One number per champion play style and augment, ranked two ways
> - **Value.** For a champion play style in a typical fight, the augment is applied and the fight is worked out again: how much more damage it deals, how much more it survives, how much more it moves or controls. Their weighted sum is the augment's value for that play style.
> - **Ranked within the champion** (its best augments) and **across champions** (is it one of the augment's best users). The tier comes from both, so an augment that is only "least bad" for a champion does not reach S.
> - **A reason line** names the part that gave most of the value (法強 +50 → 輸出 +12%), so a wrong tier shows where the model is wrong.

---
## 🧮 The fight

> [!info]+ Fixed assumptions (constants at the top of `tools/augment_model.py`)
> - **The four picks.** Mayhem starts at level 3 with the first augment; the others come at 7, 11 and 15 ([League of Legends Wiki](https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem)). The fight is worked out at levels 3, 7, 11, 15 and 18 (`LEVELS`); an augment picked at a level is worth its average gain from that level on, and its value is the average over the four picks (`PICKS`). 前期強 / 後期強 marks one worth twice as much at the first pick as at the last, or the reverse (`EARLY_LATE`).
> - **Ranks and items by level**: one ability point a level, the ultimate at 6 / 11 / 16 (no R at level 3), the basics evened out (rank 1 at 3, 2 at 7, 3 at 11, 4 at 15, 5 at 18); base stats grow with Riot's level curve; items: none at 3, one at 7, two at 11, three at 15, four and a half at 18.
> - **An 8 second team fight** (`FIGHT_S`).
> - **A reference build per play style**: bonus stats from the champion's `stack` (the stats it builds toward), for three items: 法術強度 → 250 AP, 攻擊力 → 120 bonus AD, 攻速 → 60% attack speed, 暴擊 → 50% crit, 生命 → 1200 HP, 護甲 / 魔防 → 80, 技能急速 → 40, 跑速 → 40, scaled to the items it has by each level. Everyone also has 400 HP and 10 haste from runes and boots.
> - **A reference target**: 2500 HP, 80 armor and magic resist (for % health effects and resistances).

> [!info]+ What the champion does in it
> - **Casts.** Each ability with a cooldown is cast `1 + (1 − resets) × FIGHT_S × (1 + haste / 100) / cooldown + resets × RESET_CASTS` times. `resets` (0–1, hand) is how much its cooldowns come back by takedowns or resets instead of time (Katarina, Darius R, Master Yi): haste matters less for it. An ability with a cooldown under 2 s (`TOGGLE_CD`: a toggle or stance, Jinx Q) counts as one cast and gains nothing from haste.
> - **Damage per cast** from its rank rows: base + AP ratio × AP + AD ratios × AD (the biggest row of each damage type).
> - **Casting costs attack time**: each cast of an ability that hits or controls takes 0.4 s (`CAST_S`) out of the fight's attacking time, so extra casts (haste, 祕術拳擊) cost an auto-attacker some attacks; a self-buff costs none, and neither does an on-hit ability (it is an attack itself).
> - **Attacks that shorten cooldowns feed back**: 祕術拳擊 (every cooldown) or an ability's own cut (Master Yi's Q) give more casts, whose hits are attacks again (his Q hits four times); this is worked out until it settles, no ability faster than once a second (`MIN_CYCLE_S`).
> - **Basic attacks**: `(FIGHT_S − casting time) × attack speed × autos`, where `autos` (0–1) is how much of the fight it spends attacking: 0.85 for a marksman, 0.6 for a melee fighter or tank, 0.45 for a melee champion whose first role is 坦克, 0.3 for the others (hand-set per play style when wrong). Each deals total AD (crits at 175%).
> - **Triggers counted per fight**: basic attacks; attacks for 'on attack' effects (basic attacks, each hit of an on-hit ability, and the extra attacks of an attack-reset ability: hand `aa_reset`; an ability that only empowers the next attack, like Malphite's W, adds none); on-hit applications (basic attacks + casts of the abilities in `onhit`); ability hits; casts; dashes (casts of abilities tagged 位移); crowd control (casts tagged 控場); takedowns (`TAKEDOWNS`, 1.5 per fight).
> - **Survival** is effective health: total HP × (1 + average resist / 100), plus shields and healing over the fight.

> [!info]+ Weights
> - Damage, survival, support and utility are weighed from Riot's champion ratings (攻擊 / 魔法 / 防禦, 1–10), **squared** so the side a champion is built for counts most: damage = the larger of attack and magic, survival = defense, support = 9 for champions in the 輔助 role that heal or shield allies (Fiora's R heals allies but she is no support), utility 1.5. A tank values a health augment more than an assassin does, from the same numbers.

---
## 🧩 Data

> [!example]+ Files
> - `tools/data/augment-model.json` (hand): each augment as **terms** (below), one augment per line, with the wiki numbers at level 13.
> - `tools/data/champion-model.json` (hand): what the rank rows cannot say, per champion: `resets`; `autos`; `use` (the share of an ability's casts really made: Jinx holds W); `extra` (damage the rows miss: Fiora's vitals); `auto_mult` (Master Yi's double strike); `buff` (a self-buff's stats and seconds: Master Yi's R attack speed); `per_hit` (an ability whose damage lands on each attack while it lasts: Master Yi's E); `cd_per_attack` (an ability whose cooldown each attack shortens: Master Yi's Q); `cd_as` (a cooldown attack speed shortens: Yasuo and Yone's Q); `crit_mult` (Yasuo and Yone's double crit chance); `crits` (abilities that crit: their Q); `untargetable` (seconds per cast it cannot be hit: Master Yi's Q); `onhit_hits` (hits per cast that count as attacks); `aa_reset` (extra attacks per cast: Fiora E 2, Garen Q, Darius W); `cast_s` (a longer wind-up: Jinx W 0.6 s); `ratings` in a play style (it weighs damage and survival otherwise: AP Malphite); `attack_hits` (hits that count as attacks when they differ from on-hit applications: Katarina's R is one); `land` (the share of an ability's damage that lands: Katarina's R channel is cut by crowd control, 0.7); and `styles` for more play styles (Katarina's 攻速特效).
> - On-hit abilities are listed in the champion note's `onhit` (Katarina P R, Ezreal Q, Fiora Q, Master Yi Q, Yasuo Q, Yone Q).
> - `_data/champion-model.json` (generated): every champion's play styles with their reference stats, damage per ability, trigger counts and weights.
> - `_data/augment-tiers.json` (generated): per play style, each modelled augment's value, tier and reason. Committed, so every change of tier shows in git.
> - `Review/Augment Tiers.md` (generated): the tiers of the test champions, for review.
> - `python3 -I tools/augment_model.py` makes the three generated files (it fetches Data Dragon's champion stats once into `.cache/`).

> [!example]+ Augment terms
> | Term | Example | Means |
> | --- | --- | --- |
> | `stat` | `{"stat": "ap", "value": 50}`, `{"stat": "haste", "from": "ap", "value": 0.3}` | a stat change (or one made from another stat: 靈光一閃, 巫妖思維): `ap`, `ad`, `ad_pct`, `bonus_ad`, `as`, `crit`, `haste`, `ult_haste`, `basic_haste`, `hp`, `hp_pct`, `armor`, `mr`, `ms_pct`, `omnivamp`, `heal_power`, `heal_received`, `pen` |
> | `haste_key` / `haste_tag` | `{"haste_tag": "位移", "value": 175}` | haste for one ability, or for abilities with a tag (衝鋒) |
> | `abilities_onhit` | `{"abilities_onhit": true}` | abilities apply on-hit effects (幻影武器) |
> | `ally_power` | `{"ally_power": 0.3}` | more healing and shields on allies (全部都給你) |
> | `trigger` | `{"trigger": "auto", "every": 4, "dmg": {"base": [11, 80], "bonus_ad": 0.35, "ap": 0.19}}` | damage, shield or heal each time something happens: `auto`, `onhit`, `ability_hit`, `cast`, `dash`, `cc`, `takedown`, `ult`; `every` (every n-th), `icd` (seconds between), `hit` (the share that lands: 大地覺醒 explodes late, 0.1), `ranged` (other numbers when ranged) |
> | `mult` | `{"mult": "ability", "value": 0.35}` | more damage: `ability`, `auto`, `ult`, `all`, or one ability (`Q`) |
> | `cd_per_auto` | `{"cd_per_auto": 1.25}` | each basic attack takes seconds off every cooldown (祕術拳擊) |
> | `no_ult` | `{"no_ult": true}` | the ultimate cannot be cast (基本功夫) |
> | `only` | `{"only": "ranged"}` | offered or useful only to melee / ranged |
> | `util` | `{"util": "mobility", "value": 1}` | utility the fight does not count in damage: `mobility`, `ms`, `cc` |
>
> `[low, high]` numbers grow with level (as the wiki's 20–80) and are read at `LEVEL`.

---
## 🏷️ Tiers

> [!info]+ From value to tier
> - **Per rarity.** Every screen's three offers share one rarity, random each screen (silver never on both the first two), so an augment competes with the champion's other augments of its rarity. The Pentakill band's own set (重金屬, 力量金屬, 鞭擊金屬 after the first screen; 末日金屬 added at 18) is ranked apart, its R one valued at 18 only.
> - Values ≤ 0 (or an augment not offered to the champion) are left out.
> - `within` = the augment's gain against the play style's best augment (half as good: 0.5), the gain taken as a share of its own fight; `across` = its gain against the augment's best users (their 90th percentile), the gain taken against the median champion's fight, so a champion with little damage does not look like a big gainer and an augment most champions cannot use is not easy to win.
> - score = √(within × across): S needs both, one of the champion's best augments and one of the augment's best users.
> - **S** ≥ 0.75 · **A** ≥ 0.55 · **B** ≥ 0.35 · **C** below.
> - `pinned` / `avoid` in the champion note still win over the model.

---
## ✅ Checks (known answers)

> [!todo]+ Cases the model must get right; a wrong one is fixed in the model, never by hand-setting the tier
> - [ ] Katarina (AP): 技能急速 augments (循環利用, 靈光一閃) and 衝鋒 rank low (her passive resets cooldowns, her only dash is E).
> - [ ] Katarina (on-hit): attack speed and on-hit augments rank higher than for her AP style.
> - [ ] Jinx: attack speed, crit and on-hit augments rank high; ability haste low.
> - [ ] Malphite: health and crowd-control augments (巨像之勇氣, 殘忍) rank high; attack speed low.
> - [ ] Soraka: heal and shield power (急救箱) rank high; damage augments low.
> - [ ] Lux: ability haste and AP rank high (long cooldowns, big AP ratios).
> - [ ] 祕術拳擊 (Zaviel, 2026-10-31) suits champions that trigger it often, whose abilities count as attacks or reset them: Master Yi (his Q hits four times: Q spam, untargetable), Yasuo, Yone (broken with it), Fiora, Ezreal high; Malphite and Jinx (an attack-speed marksman) lower.
> - [ ] Marksmen want on-attack augments (attack speed, every-n-th attack, extra damage on attack); 基本功夫 low for Jinx; 祕術拳擊 low for Jinx (casting and attacking get in each other's way).
> - [ ] Malphite: haste (靈光一閃, 循環利用) above 祕術拳擊.
> - [ ] Katarina: 祕術拳擊 low (her R does trigger it, but it only lets her cast R again, and R is cut by crowd control).
> - [ ] Augments that deal damage late or unreliably rank low: 大地覺醒 (explodes 0.75 s later, rarely hits) is weak for everyone.

---
## 🚧 Not yet

> [!todo]+ Later steps
> - [ ] All 248 augments as terms (the first 30 cover every kind of term).
> - [ ] More hand play styles (champions with two builds).
> - [ ] The tier page in the app (an OP.GG-like list: S / A / B / C rows of augment icons with the reason), drawn first as a mock in [[Layouts]].
