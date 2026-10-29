---
title: UI Text
tags:
  - morellonomicon
  - dev-tools
sticker: lucide//text-cursor-input
---
The app's hint and tip texts, by the file they are in (made by `tools/list_ui_text.py`). Edit a text after its `·`; keep one text per line. Then tell Claude **apply the UI Text note**: each changed line is changed in the code. `${…}` parts are filled in by the app (a number, a name): keep them.

## data/riot.ts
- `text` · 快速對戰
- `text` · 彈性積分
- `text` · 隨機單中
- `text` · 阿福快打
- `error` · 還沒設定 Riot API 金鑰(設定 → Riot API key)
- `error` · 金鑰無效或已過期(開發金鑰每 24 小時要換)
- `error` · 找不到這個 Riot ID,檢查名稱、標籤和伺服器
- `error` · 查太多次了,等一兩分鐘再試
- `error` · Riot 回應錯誤 ${r.status}

## data/store.ts
- `text` · 攻擊特效

## pages/build.ts
- `text` · 最常出的裝備
- `text` · 有趣替代

## pages/cardkit.ts
- `text` · 技能等級給的
- `text` · ${amount} ${stat.replace("攻擊", "攻")}多給的

## pages/champions.ts
- `placeholder` · 搜尋英雄、強化、裝備
- `button name` · 用鍵盤的麥克風說
- `hold tip` · 還沒有分路資料
- `text` · 全部清除
- `text` · 傷害類型
- `text` · 攻擊距離

## pages/changes.ts
- `text` · Riot ${patch} 版本公告
- `text` · 還有 ${entry.more} 項,見全文
- `text` · 資料比對(冷卻、消耗、射程、屬性)

## pages/deck.ts
- `text` · 全部讀完了

## pages/detail.ts
- `text` · 物理攻擊
- `text` · 魔法攻擊
- `text` · 生命回復
- `text` · 魔力回復
- `text` · 生命偷取
- `text` · 法術吸血
- `text` · 技能加速
- `text` · 冷卻縮減
- `text` · 魔法穿透
- `text` · 護甲穿透
- `text` · 攻擊特效
- `text` · 🎉 全部讀完了
- `text` · 護盾 / 治療
- `text` · 跑速 / 位移
- `text` · ${last.what === "added" ? "新增於" : "移除於"} ${last.patch}
- `text` · X = 遊戲內才看得到的數值
- `text` · 這個強化的效果說明還沒有收錄。
- `title` · 在 League 維基查看效果
- `title` · OP.GG 強化列表
- `text` · 人工整理
- `text` · 依效果文字自動推測,僅供參考
- `text` · 效果重點
- `text` · 適合的英雄
- `text` · 版本紀錄
- `text` · 這是 ARAM 專用版本,價格與數值和一般版本不同。
- `text` · 合成材料
- `text` · 版本調整

## pages/fresh.ts
- `text` · ⚠ 版本未註明

## pages/handbook.ts
- `text` · 初來乍到
- `text` · 高手必備

## pages/home.ts
- `text` · 北歐東歐
- `text` · 連結你的召喚師
- `text` · 輸入 Riot ID,看你的頭像、等級、牌位和最近對戰
- `placeholder` · 遊戲名稱#標籤
- `text` · 格式是 名稱#標籤,例如 Zaviel#TW2
- `text` · ${where} · 設定裡填 Riot API 金鑰後顯示頭像、牌位、對戰
- `error` · 連不上 Riot,稍後再試
- `text` · 重新整理
- `text` · 更換 / 登出
- `text` · 用預設(最熟練英雄的最新造型)
- `text` · ${q === "RANKED_SOLO_5x5" ? "單/雙排" : "彈性"}${r ? 
- `title` · ${all.length} 位英雄 · 篩選
- `title` · 裝備 · 價格 · 合成
- `text` · 全部讀完了
- `title` · 最近對戰
- `title` · 連結 Riot 後顯示
- `title` · 還沒有對戰資料:在 Home 連結 Riot ID 並設定金鑰。
- `text` · 最近 ${prof.games.length} 場 · ${wins} 勝 ${prof.games.length - wins} 敗 · ${ago(prof.fetched)}更新
- `text` · 法術強度
- `text` · 技能急速
- `placeholder` · 搜尋裝備
- `text` · 價格 低 → 高
- `text` · 價格 高 → 低
- `button name` · 清除篩選
- `text` · 沒有符合的裝備

## pages/patch.ts
- `text` · ▲ 增強 · ▼ 削弱 · ◆ 有增有減 · ● 調整。方向是依數字變化推測的,不是官方標示。
- `text` · Riot Games · 版本更新公告

## pages/profile.ts
- `text` · 強化普攻
- `text` · 技能讓下一次(或接下來幾次)普攻更強,例如額外傷害
- `text` · 攻擊特效
- `text` · 技能會觸發攻擊特效,適合出攻擊特效裝備(人工標註)
- `text` · %生命傷害
- `text` · 傷害是目標生命的一個百分比(最大 / 目前 / 已損失),對血厚的敵人也有用(從遊戲內的技能說明讀出,有些技能用的可能是自己的生命)
- `text` · 對生命值低的敵人造成更高傷害或直接擊殺
- `text` · 暈眩、擊飛、定身、沉默、恐懼、魅惑等,讓敵人動不了或不能放技能
- `text` · 降低敵人的移動速度
- `text` · 致盲、近視、重傷、降低護甲 / 魔抗 / 攻速,讓敵人變弱但還能行動
- `text` · 衝刺、閃現、瞬步、跳躍等,讓自己快速移動
- `text` · 提高自己或隊友的移動速度
- `text` · 隱形或偽裝,讓敵人看不到你
- `text` · 回復自己或隊友的生命
- `text` · 給自己或隊友一層可吸收傷害的護盾
- `text` · 造成傷害時回復自己的生命
- `text` · 減少受到的傷害,或短時間無法被選取 / 無敵
- `text` · 隊友增益
- `text` · 治療、護盾或加速也能給隊友
- `text` · 圖示說明
- `text` · 魔法攻擊
- `text` · 技能傷害
- `text` · 沒有傷害技能
- `text` · 基礎傷害
- `text` · 觸發攻擊特效
- `text` · 戰鬥風格

## pages/roster.ts
- `text` · 加入英雄 · 依分路
- `placeholder` · 說或打英雄名字
- `button name` · 用鍵盤的麥克風說
- `pop-up` · 最多選 ${MAX_PICKS} 位
- `text` · 你是不是在找:
- `text` · 全部加入
- `empty page` · 找不到這個名字
- `empty page` · 換個說法再試,或看下面的「你是不是在找」。
- `hold tip` · 還沒有分路資料
- `text` · ${m.mark} 本版調整
- `text` · ★ 主力 · 多用這招
- `empty page` · 還沒寫玩法
- `empty page` · 寫在 Inbox/速查卡片草稿
- `empty page` · 還沒選英雄
- `text` · 喜歡的英雄 · ${liked.length}
- `text` · 重新挑選
- `empty page` · 一個都沒喜歡
- `text` · 再滑一次

## pages/skills.ts
- `text` · 攻擊特效
- `text` · 觸發攻擊特效
- `text` · 進化 / 升級

## settings.ts
- `text` · 新手入門
- `text` · 版本更新

## ui.ts
- `text` · 攻擊特效
- `text` · 物理穿透
- `text` · 法術強度
- `text` · 法術穿透
- `text` · 技能急速
