<div align="center">

<img src="Assets/logo.png" alt="Morellonomicon logo" width="160">

# Morellonomicon · 黑魔禁書

**給英雄聯盟新手的繁體中文攻略 App**<br>
召喚峽谷 × 隨機單中：大混戰（ARAM Mayhem）· 手機和電腦都能用 · 不用寫程式

A Traditional Chinese League of Legends guide for beginners, running inside Obsidian on phone and PC.

[![Obsidian](https://img.shields.io/badge/Obsidian-plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
[![Platform](https://img.shields.io/badge/phone%20%C2%B7%20PC-supported-2E8A80)](#開始使用--get-started)
[![Language](https://img.shields.io/badge/語言-繁體中文-E38B3A)](#)
[![Data](https://img.shields.io/badge/data-updated%20every%20patch-6C99BB)](#資料來源--data)
[![License](https://img.shields.io/badge/license-MIT-9A97A0)](LICENSE)

[開始使用](#開始使用--get-started) · [功能](#功能--features) · [更新](#更新--updating) · [常見問題](#常見問題--troubleshooting) · [資料來源](#資料來源--data)

</div>

---

## ✨ 功能 / Features

| | 功能 | 說明 |
| --- | --- | --- |
| 🏠 | **首頁 Home** | 連結你的 Riot ID 後，像遊戲客戶端一樣看到自己的頭像、牌位、英雄專精和最近對戰（需要你自己的 Riot API 金鑰，只存在你的裝置上）。 |
| 🃏 | **速查 Picks** | 大混戰選角時，把拿到的英雄一張張滑過：一句話特色、玩法、技能白話、要堆的屬性，右滑喜歡、左滑略過。也能用語音或暱稱（如「機器人」）找英雄。 |
| 🦸 | **英雄 Champions** | 全部英雄依路線、定位、傷害類型篩選；每位英雄有技能（每級數值和加成）、出裝、強化、小技巧四個分頁，技能附官方示範影片。 |
| 🛒 | **道具 Items** | 像遊戲商店一樣依定位和屬性找道具，看合成樹、數值和效果；大混戰專屬版本也在內。 |
| 🔮 | **強化 Augments** | 大混戰全部強化（銀級、金級、稜鏡級），附官方說明文字。 |
| 📰 | **版本更新 Patch** | 每次改版：哪些英雄被加強、削弱，道具和新強化，一眼看完。 |
| 📖 | **新手入門 Handbook** | 可以滑的圖卡課程：傷害類型、英雄定位、出裝思路、走位、視野……分成「初來乍到」和「高手必備」，附載入畫面的冷知識。 |
| 🎨 | **主題 Themes** | 多種配色，跟著系統的深色 / 淺色切換。 |

**Highlights.** Swipe through the champions you got in ARAM Mayhem; every champion's abilities with per-rank numbers and Riot's clips; an item shop that works like the game's; Mayhem augments; patch changes at a glance; a swipeable card course for beginners. Mayhem is complete first; Summoner's Rift is being filled in.

## 📸 畫面 / Screenshots

> 截圖整理中。/ Screenshots coming soon.

## 🚀 開始使用 / Get started

手機和電腦步驟一樣，整個過程只用 Obsidian 的畫面操作，不用指令。

1. 安裝 [Obsidian](https://obsidian.md)。
2. 建立一個**全新的空白 vault**（名字隨意）。
3. 設定 → 社群外掛 → 關閉「受限模式」→ 瀏覽 → 搜尋並安裝、啟用 **Obsidian Git**。
4. 開啟指令面板（手機：往下拉；電腦：`Ctrl/Cmd + P`），執行 **Obsidian Git: Clone an existing remote repo**，貼上：
   ```
   https://github.com/zelvet-velvet/Morellonomicon.git
   ```
   選擇複製到 vault 本身（不要再建子資料夾），等它跑完（大約 5 MB）。
5. **關閉 vault 再重新開啟**（讓外掛載入）。到 設定 → 社群外掛，啟用 **Morellonomicon**。
6. 點左側的書本圖示（或指令面板執行 **Open Morellonomicon**）。完成！

<details>
<summary>English</summary>

1. Install [Obsidian](https://obsidian.md). 2. Create a new empty vault. 3. Turn off Restricted mode, then install and enable **Obsidian Git**. 4. Run **Obsidian Git: Clone an existing remote repo** with the address above and clone into the vault itself. 5. Close and reopen the vault, then enable **Morellonomicon** under Community plugins. 6. Tap the book icon.

</details>

## 🔄 更新 / Updating

每次英雄聯盟改版後，資料會由 GitHub 自動更新（通常改版後一兩天內）。你只要：

- 指令面板執行 **Obsidian Git: Pull**，然後重新開啟 vault（讓新版外掛載入）。
- 想自動更新：在 Obsidian Git 的設定裡開啟「啟動時 Pull」。

> [!NOTE]
> **請只用 Pull**，不要用「Commit and sync」。一般使用者沒有寫入權限，Push 會出現 `HTTP 403`，但這對你沒有影響，Pull 仍然會成功。

Every patch the data is refreshed on GitHub automatically. Run **Obsidian Git: Pull** and reopen the vault. Use Pull only: pushing shows `HTTP 403` because readers have no write access; it is harmless.

## 🛟 常見問題 / Troubleshooting

| 狀況 | 做法 |
| --- | --- |
| 看不到書本圖示 | 設定 → 社群外掛，確認 Morellonomicon 已啟用；關閉再開啟 vault |
| 外掛無法啟用 | 關閉「受限模式」 |
| 畫面沒有更新 | Pull 之後要關閉再開啟 vault |
| 圖片空白 | 圖示和圖片從網路載入，請連上網路 |
| 想換顏色 | 畫面右上角的調色盤按鈕 |

## 📚 資料來源 / Data

| 來源 | 內容 |
| --- | --- |
| Riot [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)（zh_TW） | 英雄、技能、道具 |
| [CommunityDragon](https://www.communitydragon.org/) | 強化、遊戲文字、技能示範影片、載入畫面 |
| [Meraki Analytics](https://github.com/meraki-analytics) | 英雄常走的路線 |
| Riot 繁中版本公告 | 版本更新摘要（附原文連結） |
| Unicode Unihan | 速查的語音搜尋（字的讀音） |

每筆資料都標示所屬版本。勝率、Tier 等統計不在本專案內（Riot 沒有公開大混戰對戰資料），App 內提供 OP.GG / U.GG 的連結。攻略文字（出裝、玩法、小技巧）由人撰寫和校對。

## 🛠️ 給開發者 / For developers

一般使用者不需要這一段。需要 Python 3（只用標準函式庫）和 Node.js（只在改外掛時需要）。

```bash
python3 -I tools/update_patch.py --commit                             # 新版本：重新產生所有資料並推送（GitHub 每週三到五也會自動跑）
cd plugin && npm install && npm run check && npm run build && npm run install-vault   # 改外掛後重建
```

| 資料夾 | 內容 |
| --- | --- |
| `英雄/` `道具/` `強化/` | 由腳本產生的資料筆記，加上手寫的攻略 |
| `新手入門/` | Handbook 的圖卡課程（每個 `##` 是一張卡） |
| `plugin/` | Morellonomicon 的 Obsidian 外掛（TypeScript） |
| `tools/` | 抓資料的 Python 腳本 |

從 `Start/Start Guide.md` 開始；AI 助理請讀 `Start/LLM Guide.md`。授權：[MIT](LICENSE)。

---

<sub>Morellonomicon isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</sub>
