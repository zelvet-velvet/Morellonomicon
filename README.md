# Morellonomicon 黑魔禁書

給英雄聯盟新手的繁體中文攻略 App(Obsidian),重點是**隨機單中 大混戰(ARAM Mayhem)**:查英雄、查強化、看版本更新、用圖卡學基本觀念。手機和電腦都能用,**不需要寫程式、不需要下指令**。

A Traditional Chinese League of Legends beginner guide that runs inside Obsidian (phone and PC), focused on ARAM Mayhem: champions, augments, patch changes and short picture cards. No coding and no commands needed.

## 開始使用 / Get started (用 Obsidian Git,最簡單)

手機和電腦步驟一樣。整個過程只用 Obsidian 的畫面操作。

1. 安裝 [Obsidian](https://obsidian.md)。
2. 建立一個**全新的空白 vault**(名字隨意)。
3. 設定 → 社群外掛 → 關閉「受限模式」→ 瀏覽 → 搜尋並安裝、啟用 **Obsidian Git**。
4. 開啟指令面板(手機:往下拉;電腦:`Ctrl/Cmd + P`),執行 **Obsidian Git: Clone an existing remote repo**,貼上:
   ```
   https://github.com/zelvet-velvet/Morellonomicon.git
   ```
   選擇複製到 vault 本身(不要再建子資料夾),等它跑完(大約 5 MB)。
5. **關閉 vault 再重新開啟**(讓外掛載入)。到 設定 → 社群外掛,啟用 **Morellonomicon**。
6. 點左側的書本圖示(或指令面板執行 **Open Morellonomicon**)。完成!

1. Install Obsidian. 2. Create a new empty vault. 3. Turn off Restricted mode and install + enable **Obsidian Git**. 4. Run **Obsidian Git: Clone an existing remote repo** with the address above and clone into the vault itself. 5. Close and reopen the vault, then enable **Morellonomicon** under Community plugins. 6. Tap the book icon.

## 更新 / Updating

每次英雄聯盟改版後,資料會由 GitHub 自動更新(通常改版後一兩天內)。你只要:

- 指令面板執行 **Obsidian Git: Pull**,然後重新開啟 vault(讓新版外掛載入)。
- 想自動更新:在 Obsidian Git 的設定裡開啟「啟動時 Pull」。

> **請只用 Pull**,不要用「Commit and sync」。一般使用者沒有寫入權限,Push 會出現 `HTTP 403`,但這對你沒有影響,Pull 仍然會成功。

Every patch the data is refreshed on GitHub automatically. Just run **Obsidian Git: Pull** (and reopen the vault). Use Pull only: pushing shows `HTTP 403` because readers have no write access; it is harmless.

## 常見問題 / Troubleshooting

| 狀況 | 做法 |
| --- | --- |
| 看不到書本圖示 | 設定 → 社群外掛,確認 Morellonomicon 已啟用;關閉再開啟 vault |
| 外掛無法啟用 | 關閉「受限模式」 |
| 畫面沒有更新 | Pull 之後要關閉再開啟 vault |
| 圖片空白 | 圖示和圖片從網路載入,請連上網路 |
| 想換顏色 | 畫面右上角的調色盤按鈕 |

## 資料來源 / Data

Riot 官方的 [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)(英雄、技能、道具)、[CommunityDragon](https://www.communitydragon.org/)(強化、遊戲文字、技能示範影片)和 Riot 繁中版本公告。每筆資料都標示所屬版本。勝率、Tier 等統計不在本專案內(Riot 沒有公開大混戰對戰資料),App 內提供 OP.GG / U.GG 的連結。

## 給開發者 / For developers

一般使用者不需要這一段。需要 Python 3(只用標準函式庫)和 Node.js(只在改外掛時需要)。

```
python3 -I tools/update_patch.py --commit     # 新版本:重新產生所有資料並推送(GitHub 也會自動跑)
cd plugin && npm install && npm run build && npm run install-vault   # 改外掛後重建
```

從 `Start/Start Guide.md` 開始,AI 助理請讀 `Start/LLM Guide.md`。

---
*Morellonomicon isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
