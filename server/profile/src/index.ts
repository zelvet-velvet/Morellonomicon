// Morellonomicon's profile server (a Cloudflare Worker). GET /profile?id=Name%23TAG[&server=TW2] answers with the reader's League
// profile: avatar, level, ranks, top mastery and the last games, read from Riot with the key this Worker holds (the secret
// RIOT_API_KEY). The plugin calls it from Home (plugin/src/data/riot.ts), so a reader links with just a Riot ID. The Riot calls are
// the plugin's own (plugin/src/data/riotcore.ts). Each answer is kept 10 minutes per Riot ID and server, so many refreshes cost Riot
// one read. Nothing is stored or logged beyond that cache: no names, no accounts.
import { loadProfile, REGION, RiotFailure } from "../../../plugin/src/data/riotcore";

interface Env { RIOT_API_KEY: string }
const FRESH = 600;   // seconds an answer is kept
const ID = /^[^#]{3,16}#[^#]{2,5}$/;

const answer = (body: unknown, status = 200, cache = 0) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": cache ? `public, max-age=${cache}` : "no-store" },
});

export default {
    async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(req.url);
        if (req.method !== "GET" || url.pathname !== "/profile") return answer({ error: "path" }, 404);
        const id = (url.searchParams.get("id") ?? "").trim();
        const server = (url.searchParams.get("server") ?? "").toUpperCase();
        if (!ID.test(id)) return answer({ error: "notfound" }, 400);
        if (server && !REGION[server]) return answer({ error: "server" }, 400);
        // one cached answer per Riot ID (any capitals) and server
        const key = new Request(`https://profile.cache/${encodeURIComponent(id.toLowerCase())}/${server || "auto"}`);
        const cache = caches.default;
        const hit = await cache.match(key);
        if (hit) return hit;
        try {
            const prof = await loadProfile(async (u) => {
                const r = await fetch(u, { headers: { "X-Riot-Token": env.RIOT_API_KEY } });
                return { status: r.status, json: r.status === 200 ? await r.json() : null };
            }, id, server);
            const res = answer(prof, 200, FRESH);
            ctx.waitUntil(cache.put(key, res.clone()));
            return res;
        } catch (e) {
            if (e instanceof RiotFailure) {
                // the key is ours, not the reader's: a bad key is a server problem to them
                const status = e.code === "notfound" ? 404 : e.code === "limit" ? 429 : e.code === "server" ? 400 : 502;
                return answer({ error: e.code === "key" ? "riot" : e.code }, status);
            }
            return answer({ error: "riot" }, 502);
        }
    },
};
