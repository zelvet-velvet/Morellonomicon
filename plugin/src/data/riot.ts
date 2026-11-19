import { App, requestUrl } from "obsidian";
import { art } from "../media";

import { GAMES, loadProfile, RiotFailure, type Game, type Profile, type Rank, type RiotFail } from "./riotcore";
export type { Game, Profile, Rank };
export { GAMES };

// Your League profile, for Home: account, avatar and level, rank, top mastery and the last games. Only fetched when Home asks
// (opening it after a while, or 重新整理). Two ways: through the profile server (server/profile, a Cloudflare Worker that holds
// Morellonomicon's Riot key, so a reader links with just a Riot ID), or straight from Riot with your own key from the plugin's
// settings (git-ignored data.json: the key never reaches the repo). Obsidian's requestUrl is used because Riot's API refuses requests
// made from a web page. The result is kept in this device's local storage, never in a note.

const KEY = "morellonomicon-profile";
export const PROFILE_FRESH = 10 * 60 * 1000;   // Home fetches again when what it has is older than this
// The profile server: empty until it is deployed (then its address, e.g. https://morellonomicon-profile.<account>.workers.dev);
// the plugin's settings can name another one
export const PROFILE_SERVER = "";

// The queues a game can be in, in Riot's zh_TW wording where it has one
export const QUEUE: Record<number, string> = { 400: "一般", 430: "一般", 490: "快速對戰", 420: "單/雙排", 440: "彈性積分", 450: "隨機單中", 2400: "大混戰", 900: "阿福快打", 1700: "競技場", 1900: "阿福快打", 830: "人機", 840: "人機", 850: "人機" };

export class RiotError extends Error {}
const SAY: Record<RiotFail, string> = {
    key: "金鑰無效或已過期(開發金鑰每 24 小時要換)",
    notfound: "找不到這個 Riot ID,檢查名稱和標籤",
    limit: "查太多次了,等一兩分鐘再試",
    server: "找不到這個帳號玩的伺服器,請選伺服器",
    riot: "Riot 暫時沒有回應,稍後再試",
};

export function cachedProfile(app: App, riotId: string): Profile | null {
    try { const p = app.loadLocalStorage(KEY) as Profile | null; return p && p.riotId === riotId ? p : null; } catch { return null; }
}

// Where Home's profile comes from on this device: your own key wins (you, testing), else the profile server; "" = nowhere yet
export function profileSource(s: { riotKey: string; profileServer: string }): "key" | "server" | "" {
    return s.riotKey ? "key" : (s.profileServer || PROFILE_SERVER) ? "server" : "";
}

// server: a platform id (TW2), or "" to let Riot say where the account plays
export async function fetchProfile(app: App, riotId: string, server: string, s: { riotKey: string; profileServer: string }): Promise<Profile> {
    let prof: Profile;
    try {
        if (s.riotKey) {
            prof = await loadProfile(async (url) => { const r = await requestUrl({ url, headers: { "X-Riot-Token": s.riotKey }, throw: false }); return { status: r.status, json: r.status === 200 ? r.json : null }; }, riotId, server);
        } else {
            const base = (s.profileServer || PROFILE_SERVER).replace(/\/+$/, "");
            if (!base) throw new RiotError("個人資料伺服器還沒設定");
            const r = await requestUrl({ url: `${base}/profile?id=${encodeURIComponent(riotId)}${server ? `&server=${server}` : ""}`, throw: false });
            if (r.status !== 200) {
                const code = (r.json as { error?: RiotFail } | null)?.error;
                throw new RiotError(code && SAY[code] ? SAY[code] : "連不上個人資料伺服器,稍後再試");
            }
            prof = { ...(r.json as Profile), riotId, fetched: Date.now() };
        }
    } catch (e) {
        if (e instanceof RiotFailure) throw new RiotError(SAY[e.code]);
        throw e;
    }
    try { app.saveLocalStorage(KEY, prof); } catch { /* keeps working without the cache */ }
    return prof;
}

// Riot's tier names in the zh_TW client
export const TIER: Record<string, string> = { IRON: "鐵牌", BRONZE: "銅牌", SILVER: "銀牌", GOLD: "金牌", PLATINUM: "白金", EMERALD: "翡翠", DIAMOND: "鑽石", MASTER: "大師", GRANDMASTER: "宗師", CHALLENGER: "菁英" };
export const emblem = art.emblem;
export const ago = (t: number): string => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 60 ? `${Math.max(1, m)} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`;
};
