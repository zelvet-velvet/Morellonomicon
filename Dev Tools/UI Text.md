---
title: UI Text
tags:
  - morellonomicon
  - dev-tools
sticker: lucide//text-cursor-input
---
> [!abstract]+ The app's hint and tip texts
> By the file they are in (made by `tools/list_ui_text.py`). Edit a text after its `·`; keep one text per line. Then tell Claude **apply the UI Text note**: each changed line is changed in the code. `${…}` parts are filled in by the app (a number, a name): keep them.

## data/riot.ts

> [!example]+ 9 texts
> - `text` · 快速對戰
> - `text` · 彈性積分
> - `text` · 隨機單中
> - `text` · 阿福快打
> - `error` · 還沒設定 Riot API 金鑰(設定 → Riot API key)
> - `error` · 金鑰無效或已過期(開發金鑰每 24 小時要換)
> - `error` · 找不到這個 Riot ID,檢查名稱、標籤和伺服器
> - `error` · 查太多次了,等一兩分鐘再試
> - `error` · Riot 回應錯誤 ${r.status}

## data/store.ts

> [!example]+ 1 texts
> - `text` · 攻擊特效

## inboxnote.ts

> [!example]+ 14 texts
> - `text` · 有趣出裝
> - `text` · 搭配英雄
> - `text` · 26.21 或 16.21；不確定寫 ?
> - `text` · 頻道名稱 + 網址
> - `text` · 例如 AP 刺客、燒傷法師、雄心戰士
> - `text` · 照購買順序；1–2 件代表這個玩法的裝備
> - `text` · 一句話，出裝頁最上面那行
> - `text` · 適合的英雄
> - `text` · 列在這裡的英雄出裝頁就有這個玩法
> - `text` · 網站和網址（數字不照抄）
> - `line` · 還沒有東西，按 + 新增
> - `placeholder` · 搜尋裝備
> - `line` · 刪除這一筆
> - `text` · 再按一次刪除

## layoutnote.ts

> [!example]+ 1 texts
> - `text` · 中華電信

## pages/augments.ts

> [!example]+ 1 texts
> - `placeholder` · 搜尋強化

## pages/build.ts

> [!example]+ 7 texts
> - `text` · 最常出的裝備
> - `text` · 有趣替代
> - `text` · 依技能組推算的出裝
> - `text` · 第三件 (選一)
> - `text` · 鞋子 · 命定
> - `line` · 拿到命定武器時第一件出它，每次參與擊殺${grows.length ? grows.join("、") : "屬性"}永久提升。${st.destiny.reason}
> - `text` · 4–6 件 (挑三件)

## pages/cardkit.ts

> [!example]+ 2 texts
> - `text` · 技能等級給的
> - `text` · ${amount} ${stat.replace("攻擊", "攻")}多給的

## pages/champions.ts

> [!example]+ 14 texts
> - `placeholder` · 搜尋英雄、強化、裝備
> - `button name` · 用鍵盤的麥克風說
> - `hold tip` · 還沒有分路資料
> - `text` · 全部清除
> - `text` · 傷害類型
> - `text` · 攻擊距離
> - `text` · 技能傷害
> - `text` · 觸發攻擊特效
> - `text` · 連招影片
> - `text` · 依英雄的技能機制推理合不合，再對照大混戰的實際對局校正，和同稀有度的其他強化比較。點強化看原因。
> - `text` · 沒有特別適合的強化。
> - `text` · 全部強化
> - `text` · 沒有幫助：${none.map((a) => a.name).join("、")}
> - `text` · 依強化效果和這位英雄的技能挑選：吃魔攻或物攻、普攻型、有護盾或治療、坦克、有位移或控場、用魔力。置頂是你在英雄筆記寫的 pinned。沒有勝率資料（Riot 沒有公開大混戰對戰）。

## pages/changes.ts

> [!example]+ 3 texts
> - `text` · Riot ${patch} 版本公告
> - `text` · 還有 ${entry.more} 項,見全文
> - `text` · 資料比對(冷卻、消耗、射程、屬性)

## pages/deck.ts

> [!example]+ 1 texts
> - `text` · 全部讀完了

## pages/detail.ts

> [!example]+ 42 texts
> - `text` · 物理攻擊
> - `text` · 魔法攻擊
> - `text` · 生命回復
> - `text` · 魔力回復
> - `text` · 生命偷取
> - `text` · 法術吸血
> - `text` · 技能加速
> - `text` · 冷卻縮減
> - `text` · 魔法穿透
> - `text` · 護甲穿透
> - `text` · 攻擊特效
> - `text` · 🎉 全部讀完了
> - `text` · 護盾 / 治療
> - `text` · 跑速 / 位移
> - `text` · 強化普攻
> - `text` · 暴擊射手
> - `text` · 前排戰士
> - `text` · 大絕強化
> - `text` · 法術強度
> - `text` · 技能急速
> - `text` · 物理穿透
> - `text` · 法術穿透
> - `text` · \\d+(?:\\.\\d+)?%?(?:（遠程 [^）]+）)?\\s?(?:額外|最大|目前|已損失|基礎|總)?(?:物攻|魔攻|攻速|技能加速|大絕加速|基礎技能加速|道具加速|跑速|物防|魔防|生命|暴擊率|暴擊傷害|全能吸血|普攻吸血|物理致命|物理穿透|魔法穿透|治療與護盾強度|適性之力|魔力|攻擊距離)
> - `text` · 魔法傷害|物理傷害|真實傷害|適性傷害
> - `text` · (?:額外|最大|已損失)?(?:物攻|魔攻|攻速|技能加速|大絕加速|跑速|物防|魔防|暴擊率|暴擊傷害|全能吸血|普攻吸血|物理致命|物理穿透|魔法穿透|治療與護盾強度|適性之力)
> - `text` · 數值：競技場的遊戲資料，大混戰可能不同${nums.partial ? "（X 是遊戲內才算得出的數值）" : ""}
> - `text` · 這個強化的效果說明還沒有收錄。
> - `title` · 在 League 維基查看效果
> - `title` · OP.GG 強化列表
> - `text` · 遊戲的強化標籤：只會出現在這 ${list.length} 位英雄的選項裡
> - `text` · 人工整理
> - `text` · 依效果文字推測，僅供參考
> - `text` · 適合的英雄
> - `text` · 版本紀錄
> - `text` · ${x.what === "added" ? "新增於" : "移除於"} ${x.patch}
> - `text` · ${c.name} · 沒有幫助
> - `text` · 這個強化無法用數值估算（${why}），沒有排名。
> - `text` · 依英雄的技能數值估算：對這些英雄是 S 或 A（和同稀有度的其他強化比較，也和其他英雄比較）。不是勝率。
> - `text` · 依英雄的技能數值估算，沒有英雄特別適合這個強化。
> - `text` · 價格與數值和一般版本不同。
> - `text` · 合成材料
> - `text` · 版本調整

## pages/fresh.ts

> [!example]+ 1 texts
> - `text` · ⚠ 版本未註明

## pages/glossary.ts

> [!example]+ 4 texts
> - `text` · 技能急速
> - `placeholder` · 找一個詞
> - `button name` · 用鍵盤的麥克風說
> - `empty page` · 找不到這個詞

## pages/handbook.ts

> [!example]+ 3 texts
> - `placeholder` · 搜尋手冊裡的內容
> - `text` · 初來乍到
> - `text` · 高手必備

## pages/home.ts

> [!example]+ 28 texts
> - `text` · 北歐東歐
> - `text` · 今天想查什麼？
> - `text` · ${n.patch} 版本 · ${(n.champions?.length ?? 0) + (n.mayhem_champions?.length ?? 0)} 位英雄調整 · ${n.augments_new?.length ?? 0} 個新強化
> - `placeholder` · 遊戲名稱#標籤
> - `text` · 格式是 名稱#標籤,例如 Zaviel#TW2
> - `button name` · 帳號選單
> - `text` · ${where} · 設定填 API 金鑰後顯示牌位
> - `hold tip` · 單/雙排 · ${solo.lp} LP · ${solo.wins} 勝 ${solo.losses} 敗
> - `error` · 連不上 Riot,稍後再試
> - `text` · 重新整理
> - `text` · 更換 / 登出
> - `text` · 用預設(最熟練英雄的最新造型)
> - `placeholder` · 搜尋英雄、裝備、強化
> - `title` · 最近對戰
> - `text` · 我的英雄
> - `text` · 最近對戰 · ${wins} 勝 ${games.length - wins} 敗
> - `text` · 繼續學習
> - `text` · 全部讀完了
> - `empty page` · 換個名字,或用英雄的英文名、暱稱
> - `empty page` · 還沒有對戰資料
> - `empty page` · 在 Home 連結 Riot ID，並在設定填 Riot API 金鑰。
> - `text` · 最近 ${prof.games.length} 場 · ${wins} 勝 ${prof.games.length - wins} 敗 · ${ago(prof.fetched)}更新
> - `text` · 法術強度
> - `text` · 技能急速
> - `placeholder` · 搜尋裝備
> - `button name` · 起始在前
> - `button name` · 清除篩選
> - `text` · 沒有符合的裝備

## pages/patch.ts

> [!example]+ 4 texts
> - `text` · ▲ 增強 · ▼ 削弱 · ◆ 有增有減 · ● 調整。方向是依數字變化推測的,不是官方標示。
> - `text` · Riot Games · 版本更新公告
> - `text` · 大混戰專屬的英雄平衡（承受傷害、造成傷害等）。
> - `text` · 主秀英雄

## pages/profile.ts

> [!example]+ 26 texts
> - `text` · 隊友增益
> - `text` · 強化普攻
> - `text` · 技能讓下一次(或接下來幾次)普攻更強,例如額外傷害
> - `text` · 攻擊特效
> - `text` · 技能會觸發攻擊特效,適合出攻擊特效裝備(人工標註)
> - `text` · %生命傷害
> - `text` · 傷害是目標生命的一個百分比(最大 / 目前 / 已損失),對血厚的敵人也有用(從遊戲內的技能說明讀出,有些技能用的可能是自己的生命)
> - `text` · 對生命值低的敵人造成更高傷害或直接擊殺
> - `text` · 暈眩、擊飛、定身、沉默、恐懼、魅惑等,讓敵人動不了或不能放技能
> - `text` · 降低敵人的移動速度
> - `text` · 致盲、近視、重傷、降低護甲 / 魔抗 / 攻速,讓敵人變弱但還能行動
> - `text` · 衝刺、閃現、瞬步、跳躍等,讓自己快速移動
> - `text` · 提高自己或隊友的移動速度
> - `text` · 隱形或偽裝,讓敵人看不到你
> - `text` · 回復自己或隊友的生命
> - `text` · 給自己或隊友一層可吸收傷害的護盾
> - `text` · 造成傷害時回復自己的生命
> - `text` · 減少受到的傷害,或短時間無法被選取 / 無敵
> - `text` · 治療、護盾或加速也能給隊友
> - `text` · 圖示說明
> - `text` · 魔法攻擊
> - `text` · 技能傷害
> - `text` · 沒有傷害技能
> - `text` · 基礎傷害
> - `text` · 觸發攻擊特效
> - `text` · 戰鬥風格

## pages/roster.ts

> [!example]+ 17 texts
> - `text` · 加入英雄 · 依分路
> - `placeholder` · 說或打英雄名字
> - `button name` · 用鍵盤的麥克風說
> - `pop-up` · 最多選 ${MAX_PICKS} 位
> - `text` · 你是不是在找:
> - `text` · 全部加入
> - `empty page` · 找不到這個名字
> - `empty page` · 換個說法再試,或看下面的「你是不是在找」。
> - `hold tip` · 還沒有分路資料
> - `empty page` · 還沒選英雄
> - `empty page` · 一個都沒喜歡
> - `text` · 重新挑選
> - `text` · 再滑一次
> - `text` · ${m.mark} 本版調整
> - `text` · ★ 主力 · 多用這招
> - `empty page` · 還沒寫玩法
> - `empty page` · 寫在 Inbox/速查卡片

## pages/skills.ts

> [!example]+ 3 texts
> - `text` · 攻擊特效
> - `text` · 觸發攻擊特效
> - `text` · 進化 / 升級

## picksnote.ts

> [!example]+ 8 texts
> - `line` · 下一位待驗證
> - `text` · 已驗證 ${all.filter((c) => statusOf(c) === "已驗證").length} / ${all.length}
> - `placeholder` · 堆（stack）· 兩三個
> - `text` · 玩法（soul）· 一行一句
> - `text` · 主力（focus）· 只有一招是重點時
> - `text` · 技能白話（plain）
> - `line` · 打開英雄筆記
> - `placeholder` · 選一位英雄

## settings.ts

> [!example]+ 2 texts
> - `text` · 新手入門
> - `text` · 版本更新

## ui.ts

> [!example]+ 5 texts
> - `text` · 攻擊特效
> - `text` · 物理穿透
> - `text` · 法術強度
> - `text` · 法術穿透
> - `text` · 技能急速
