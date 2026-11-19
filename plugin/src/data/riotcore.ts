// Reading a League profile from Riot's API: the one place that knows Riot's addresses and answers. Two callers use it:
// the plugin with your own key (data/riot.ts, Obsidian's requestUrl) and the profile server (server/profile, a Cloudflare Worker
// that holds the key, so readers link with just their Riot ID). It imports nothing, so both can bundle it.

export const GAMES = 10;   // games fetched (Home shows them as faces, the recent games page all)

// The regional hosts for account-v1 and match-v5, by platform
export const REGION: Record<string, { account: string; match: string }> = {
    TW2: { account: "asia", match: "sea" }, SG2: { account: "asia", match: "sea" }, VN2: { account: "asia", match: "sea" }, OC1: { account: "americas", match: "sea" },
    PH2: { account: "asia", match: "sea" }, TH2: { account: "asia", match: "sea" },
    JP1: { account: "asia", match: "asia" }, KR: { account: "asia", match: "asia" },
    NA1: { account: "americas", match: "americas" }, BR1: { account: "americas", match: "americas" }, LA1: { account: "americas", match: "americas" }, LA2: { account: "americas", match: "americas" },
    EUW1: { account: "europe", match: "europe" }, EUN1: { account: "europe", match: "europe" }, TR1: { account: "europe", match: "europe" }, RU: { account: "europe", match: "europe" }, ME1: { account: "europe", match: "europe" },
};

export interface Rank { queue: string; tier: string; division: string; lp: number; wins: number; losses: number }
export interface Game { id: string; queue: number; end: number; duration: number; champion: string; win: boolean; k: number; d: number; a: number; cs: number; items: number[] }
export interface Profile {
    riotId: string; fetched: number; server: string; name: string; tag: string; icon: number; level: number;
    ranks: Rank[]; mastery: { championKey: number; level: number; points: number; last: number }[]; games: Game[];   // mastery: every champion played, most points first; last = lastPlayTime (ms)
}

// What went wrong, as a code both callers turn into words: the key, a Riot ID that is not there, too many requests, Riot itself
export type RiotFail = "key" | "notfound" | "limit" | "server" | "riot";
export class RiotFailure extends Error { constructor(public code: RiotFail, public status = 0) { super(code); } }

// One GET to Riot: host is a platform (tw2) or a region (asia, sea); the caller does the request and gives back its status and JSON
export type RiotGet = (url: string) => Promise<{ status: number; json: unknown }>;

export async function loadProfile(request: RiotGet, riotId: string, server: string): Promise<Profile> {
    const [name, tag] = riotId.split("#");
    const get = async <T>(host: string, path: string): Promise<T> => {
        const r = await request(`https://${host}.api.riotgames.com${path}`);
        if (r.status === 200) return r.json as T;
        if (r.status === 401 || r.status === 403) throw new RiotFailure("key", r.status);
        if (r.status === 404) throw new RiotFailure("notfound", r.status);
        if (r.status === 429) throw new RiotFailure("limit", r.status);
        throw new RiotFailure("riot", r.status);
    };
    // the account is the same on every regional host; the one nearest the server asked for, or Asia
    const acc = await get<{ puuid: string; gameName: string; tagLine: string }>(REGION[server]?.account ?? "asia",
        `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name ?? "")}/${encodeURIComponent(tag ?? "")}`);
    const id = encodeURIComponent(acc.puuid);
    // where the account plays League, as Riot says
    const where = async (): Promise<string> => {
        let found = "";
        try {
            const r = await get<{ region: string }>(REGION[server]?.account ?? "asia", `/riot/account/v1/region/by-game/lol/by-puuid/${id}`);
            found = (r.region ?? "").toUpperCase();
        } catch (e) { if (e instanceof RiotFailure && e.code !== "notfound") throw e; }
        if (!REGION[found]) throw new RiotFailure("server");
        return found;
    };
    if (!server) server = await where();
    // the summoner on that server; a server picked by hand that the account does not play on: the one Riot names
    type Summoner = { profileIconId: number; summonerLevel: number };
    let sum: Summoner;
    try { sum = await get<Summoner>(server.toLowerCase(), `/lol/summoner/v4/summoners/by-puuid/${id}`); }
    catch (e) {
        if (!(e instanceof RiotFailure && e.code === "notfound")) throw e;
        const other = await where();
        if (other === server) throw e;
        server = other;
        sum = await get<Summoner>(server.toLowerCase(), `/lol/summoner/v4/summoners/by-puuid/${id}`);
    }
    const reg = REGION[server] ?? REGION.TW2;
    const plat = server.toLowerCase();
    const [leagues, mastery, ids] = await Promise.all([
        get<{ queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }[]>(plat, `/lol/league/v4/entries/by-puuid/${id}`),
        get<{ championId: number; championLevel: number; championPoints: number; lastPlayTime: number }[]>(plat, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${id}`),
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
        } catch (e) { if (e instanceof RiotFailure && e.code === "limit") break; }   // keep what was read before the limit
    }
    return {
        riotId, fetched: Date.now(), server, name: acc.gameName, tag: acc.tagLine, icon: sum.profileIconId, level: sum.summonerLevel,
        ranks: leagues.map((l) => ({ queue: l.queueType, tier: l.tier, division: l.rank, lp: l.leaguePoints, wins: l.wins, losses: l.losses })),
        mastery: mastery.map((x) => ({ championKey: x.championId, level: x.championLevel, points: x.championPoints, last: x.lastPlayTime })),
        games,
    };
}
