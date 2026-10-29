import { App, requestUrl } from "obsidian";

// Your League profile from Riot's API, for Home: account, avatar and level, rank, top mastery and the last games.
// Only fetched when Home asks (opening it after a while, or the refresh button), with the key from the plugin's settings, which
// live in the git-ignored data.json: the key never reaches the repo. Obsidian's requestUrl is used because Riot's API refuses
// requests made from a web page. The result is kept in this device's local storage, never in a note.

const KEY = "morellonomicon-profile";
export const PROFILE_FRESH = 10 * 60 * 1000;   // Home fetches again when what it has is older than this
const GAMES = 10;                               // games fetched (Home shows a few, the recent games page all)

// The regional host for account-v1 and match-v5, by platform
const REGION: Record<string, { account: string; match: string }> = {
    TW2: { account: "asia", match: "sea" }, SG2: { account: "asia", match: "sea" }, VN2: { account: "asia", match: "sea" }, OC1: { account: "americas", match: "sea" },
    JP1: { account: "asia", match: "asia" }, KR: { account: "asia", match: "asia" },
    NA1: { account: "americas", match: "americas" }, EUW1: { account: "europe", match: "europe" }, EUN1: { account: "europe", match: "europe" },
};
// The queues a game can be in, in Riot's zh_TW wording where it has one
export const QUEUE: Record<number, string> = { 400: "一般", 430: "一般", 490: "快速對戰", 420: "單/雙排", 440: "彈性積分", 450: "隨機單中", 2400: "大混戰", 900: "阿福快打", 1700: "競技場", 1900: "阿福快打", 830: "人機", 840: "人機", 850: "人機" };

export interface Rank { queue: string; tier: string; division: string; lp: number; wins: number; losses: number }
export interface Game { id: string; queue: number; end: number; duration: number; champion: string; win: boolean; k: number; d: number; a: number; cs: number; items: number[] }
export interface Profile {
    riotId: string; fetched: number; name: string; tag: string; icon: number; level: number;
    ranks: Rank[]; mastery: { championKey: number; level: number; points: number }[]; games: Game[];
}

export class RiotError extends Error {}

export function cachedProfile(app: App, riotId: string): Profile | null {
    try { const p = app.loadLocalStorage(KEY) as Profile | null; return p && p.riotId === riotId ? p : null; } catch { return null; }
}

export async function fetchProfile(app: App, riotId: string, server: string, key: string): Promise<Profile> {
    if (!key) throw new RiotError("還沒設定 Riot API 金鑰(設定 → Riot API key)");
    const [name, tag] = riotId.split("#");
    const reg = REGION[server] ?? REGION.TW2;
    const plat = server.toLowerCase();
    const get = async <T>(host: string, path: string): Promise<T> => {
        const r = await requestUrl({ url: `https://${host}.api.riotgames.com${path}`, headers: { "X-Riot-Token": key }, throw: false });
        if (r.status === 200) return r.json as T;
        if (r.status === 401 || r.status === 403) throw new RiotError("金鑰無效或已過期(開發金鑰每 24 小時要換)");
        if (r.status === 404) throw new RiotError("找不到這個 Riot ID,檢查名稱、標籤和伺服器");
        if (r.status === 429) throw new RiotError("查太多次了,等一兩分鐘再試");
        throw new RiotError(`Riot 回應錯誤 ${r.status}`);
    };
    const acc = await get<{ puuid: string; gameName: string; tagLine: string }>(reg.account, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name ?? "")}/${encodeURIComponent(tag ?? "")}`);
    const id = encodeURIComponent(acc.puuid);
    const [sum, leagues, mastery, ids] = await Promise.all([
        get<{ profileIconId: number; summonerLevel: number }>(plat, `/lol/summoner/v4/summoners/by-puuid/${id}`),
        get<{ queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }[]>(plat, `/lol/league/v4/entries/by-puuid/${id}`),
        get<{ championId: number; championLevel: number; championPoints: number }[]>(plat, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${id}/top?count=3`),
        get<string[]>(reg.match, `/lol/match/v5/matches/by-puuid/${id}/ids?count=${GAMES}`),
    ]);
    type Part = { puuid: string; championName: string; win: boolean; kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number;
        item0: number; item1: number; item2: number; item3: number; item4: number; item5: number };
    const games: Game[] = [];
    for (const m of ids) {
        try {
            const g = await get<{ info: { queueId: number; gameEndTimestamp: number; gameDuration: number; participants: Part[] } }>(reg.match, `/lol/match/v5/matches/${encodeURIComponent(m)}`);
            const p = g.info.participants.find((x) => x.puuid === acc.puuid);
            if (!p) continue;
            games.push({ id: m, queue: g.info.queueId, end: g.info.gameEndTimestamp, duration: g.info.gameDuration, champion: p.championName, win: p.win, k: p.kills, d: p.deaths, a: p.assists,
                cs: p.totalMinionsKilled + p.neutralMinionsKilled, items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((x) => x > 0) });
        } catch (e) { if (e instanceof RiotError && /太多次/.test(e.message)) break; }   // keep what was read before the limit
    }
    const prof: Profile = {
        riotId, fetched: Date.now(), name: acc.gameName, tag: acc.tagLine, icon: sum.profileIconId, level: sum.summonerLevel,
        ranks: leagues.map((l) => ({ queue: l.queueType, tier: l.tier, division: l.rank, lp: l.leaguePoints, wins: l.wins, losses: l.losses })),
        mastery: mastery.map((x) => ({ championKey: x.championId, level: x.championLevel, points: x.championPoints })),
        games,
    };
    try { app.saveLocalStorage(KEY, prof); } catch { /* keeps working without the cache */ }
    return prof;
}

// Riot's tier names in the zh_TW client
export const TIER: Record<string, string> = { IRON: "鐵牌", BRONZE: "銅牌", SILVER: "銀牌", GOLD: "金牌", PLATINUM: "白金", EMERALD: "翡翠", DIAMOND: "鑽石", MASTER: "大師", GRANDMASTER: "宗師", CHALLENGER: "菁英" };
export const emblem = (tier: string): string => `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tier.toLowerCase()}.png`;
export const ago = (t: number): string => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 60 ? `${Math.max(1, m)} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`;
};
