import { requestUrl } from "obsidian";
import type { Champion } from "./data/store";

// Every picture and clip the app shows from the network goes through here (Design Rules, "Fetch ahead"):
// 1. Addresses: each kind of picture is built by one function below, so a page and the list of what it needs (its `needs` in
//    pages/index.ts) always ask for the same address and the browser cache can serve the second ask.
// 2. Fetching ahead: `want` / `warm` queue pictures and clips by how soon they are needed (now: the page about to open; soon: one tap
//    away; idle: start-up), a few at a time, each address once; fetched pictures are kept decoded so the phone does not drop them.
// 3. Misses: a picture that is still loading when it appears and was never asked for ahead is noted (`notePicture`); Settings →
//    Picture readout shows them per page, so a page or tab that forgot to list a picture is seen at once.

// ---- addresses ----
const DD = "https://ddragon.leagueoflegends.com/cdn";
const CD = "https://raw.communitydragon.org/latest";
const champ = (id: string) => encodeURIComponent(id);
export const ARAM_SCREENS = ["habackground", "arambilgewater", "arambloom"];   // Howling Abyss, Butcher's Bridge, the Ionian bridge
export const art = {
    splash: (id: string, skin = 0) => `${DD}/img/champion/splash/${champ(id)}_${skin}.jpg`,       // the full splash (1215 × 717)
    centered: (id: string, skin = 0) => `${DD}/img/champion/centered/${champ(id)}_${skin}.jpg`,   // the champion in the middle (1280 × 720)
    loading: (id: string, skin = 0) => `${DD}/img/champion/loading/${champ(id)}_${skin}.jpg`,     // the loading screen portrait (308 × 560)
    item: (patch: string, id: number | string) => `${DD}/${patch}/img/item/${id}.png`,
    profileIcon: (patch: string, n: number | string) => `${DD}/${patch}/img/profileicon/${n}.png`,
    minimap: (patch: string) => `${DD}/${patch}/img/map/map11.png`,
    // an ARAM loading screen by name, or one of the three at random
    aramScreen: (name?: string) => `${CD}/game/assets/ux/loadingscreen/${name || ARAM_SCREENS[Math.floor(Math.random() * ARAM_SCREENS.length)]}.png`,
    emblem: (tier: string) => `${CD}/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tier.toLowerCase()}.png`,
    // a form's ability picture (Jayce, Nidalee, Elise…): form 0 melee, 1 ranged
    formIcon: (id: string, key: string, form: number) => `${CD}/game/assets/characters/${id}/hud/icons2d/${id}${key.toLowerCase()}_${form === 0 ? "melee" : "ranged"}.png`,
};
// A Handbook topic's cover from its `cover:` frontmatter: a champion id (its splash) or `map <name>` (an ARAM loading screen)
export const coverUrl = (cover: string): string => {
    const [a, b] = cover.trim().split(/\s+/);
    if (!a) return "";
    return a === "map" ? art.aramScreen(b) : art.splash(a);
};

// ---- clips ----
// Riot's own ability demo (the clip the official champion page plays): <champion key, 4 digits>/ability_<key>_<P|Q|W|E|R>1.mp4/.webm.
// An unofficial but public Riot CDN path, so if a clip is missing or the address changes the video simply does not appear.
const DEMO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities";
export const clipAddress = (c: Champion, key: string): string => {
    const k = String(c.key).padStart(4, "0");
    // "Q" is the ability's first clip; "Q2" the second one (the other form of Jayce, Nidalee, Elise… where Riot made one)
    return `${DEMO_BASE}/${k}/ability_${k}_${/\d$/.test(key) ? key : `${key}1`}`;
};
// Clips downloaded ahead of time: clip address -> a local address of the whole file, which plays at once. Only the last CLIP_CACHE are
// kept (oldest first out), so browsing many champions does not fill the phone's memory
const CLIP_CACHE = 15;
const downloaded = new Map<string, string>();
const webmOnly = new Set<string>();   // clips Riot has only as WebM: a phone decodes those in software, so only the clip in view should play
const downloading = new Map<string, Promise<void>>();
export const clipFile = (url: string): string | undefined => downloaded.get(url);
export const clipIsWebmOnly = (url: string): boolean => webmOnly.has(url);
// Downloads a clip into memory with Obsidian's own request (Riot's server allows no cross-site fetch from a page), so the card that
// uses it later has the whole file already. Does nothing for a clip already fetched; a clip that cannot be fetched is skipped.
export function preloadClip(c: Champion, key: string): Promise<void> {
    if (!c.key) return Promise.resolve();
    const url = clipAddress(c, key);
    const have = downloading.get(url);
    if (have) return have;
    const job = (async () => {
        for (const ext of ["mp4", "webm"]) {
            try {
                const r = await requestUrl({ url: `${url}.${ext}`, throw: false });
                if (r.status === 200) {
                    if (ext === "webm") webmOnly.add(url);
                    downloaded.set(url, URL.createObjectURL(new Blob([r.arrayBuffer], { type: `video/${ext}` })));
                    for (const [old, local] of downloaded) {
                        if (downloaded.size <= CLIP_CACHE) break;
                        URL.revokeObjectURL(local); downloaded.delete(old); downloading.delete(old);
                    }
                    return;
                }
            } catch { /* try the next format */ }
        }
    })();
    downloading.set(url, job);
    return job;
}

// ---- fetching ahead ----
export type Soon = "now" | "soon" | "idle";
const RANK: Record<Soon, number> = { now: 0, soon: 1, idle: 2 };
// a picture to fetch, or an ability clip
export type Need = string | { clip: Champion; key: string };
const PARALLEL = 6;          // pictures fetched at once
// Decoded pictures kept in memory (oldest first out), so the phone does not drop them: icons are small (~16 KB decoded) and many are
// kept; a splash is ~3.7 MB decoded, so only a few (an older one is still in the browser's cache and comes back quickly)
const HELD_SMALL = 600;
const HELD_BIG = 24;   // enough for the champions on one screen of a list, fetched ahead (goes() in ui.ts)
const BIG_PX = 256 * 256;
const held = new Map<string, HTMLImageElement>();      // icons, fetched and decoded
const heldBig = new Map<string, HTMLImageElement>();   // splashes, loading art, wallpapers
const asked = new Set<string>();                    // every address ever asked for ahead (for the miss readout)
const waiting = new Map<string, { rank: number; done: Array<() => void> }>();
let running = 0;
const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export const isWarm = (url: string): boolean => !!(held.get(url) ?? heldBig.get(url))?.complete;

function pump(): void {
    while (running < PARALLEL && waiting.size) {
        let best: string | null = null, rank = 9;
        for (const [u, w] of waiting) if (w.rank < rank) { best = u; rank = w.rank; if (rank === 0) break; }
        if (best === null) return;
        const job = waiting.get(best)!;
        waiting.delete(best);
        running++;
        const url = best;
        const im = new Image();
        const finish = () => { running--; job.done.forEach((d) => d()); pump(); };
        im.onload = () => {
            void (im.decode ? im.decode() : Promise.resolve()).catch(() => undefined).then(() => {
                const [map, max] = im.naturalWidth * im.naturalHeight > BIG_PX ? [heldBig, HELD_BIG] : [held, HELD_SMALL];
                map.delete(url); map.set(url, im);
                for (const old of map.keys()) { if (map.size <= max) break; map.delete(old); }
                finish();
            });
        };
        im.onerror = finish;
        im.src = url;
    }
}

// Fetches pictures ahead, the most urgent first; resolves when all of them are in (or failed). An address already fetched or queued
// is not fetched again (a queued one moves up if it is now needed sooner).
export function warm(urls: Iterable<string>, soon: Soon = "soon"): Promise<void> {
    if (soon !== "now" && saveData()) return Promise.resolve();   // a data-saver connection: only what is about to show
    const rank = RANK[soon];
    const jobs: Promise<void>[] = [];
    for (const url of urls) {
        if (!url || !/^https?:/.test(url)) continue;
        asked.add(url);
        if (isWarm(url)) continue;
        const w = waiting.get(url);
        jobs.push(new Promise<void>((done) => {
            if (w) { w.rank = Math.min(w.rank, rank); w.done.push(done); } else waiting.set(url, { rank, done: [done] });
        }));
    }
    pump();
    return Promise.all(jobs).then(() => undefined);
}

// Pictures and clips together. Clips are big (about 1 MB each): they are fetched one by one after the pictures, never at start-up.
let clipChain: Promise<void> = Promise.resolve();
export function want(needs: Need[], soon: Soon = "soon"): Promise<void> {
    const pics = needs.filter((n): n is string => typeof n === "string");
    const clips = soon === "idle" || saveData() ? [] : needs.filter((n): n is { clip: Champion; key: string } => typeof n !== "string");
    const p = warm(pics, soon);
    for (const c of clips) {
        if (!c.clip.key) continue;
        asked.add(clipAddress(c.clip, c.key));
        clipChain = clipChain.then(() => p).then(() => preloadClip(c.clip, c.key));
    }
    return p;
}

// ---- misses ----
// A picture that appeared while still loading and was never asked for ahead. `page` is the page it showed on (the readout lists them).
export interface Miss { url: string; page: string }
let pageNow = "";
const missed: Miss[] = [];
const MISS_MAX = 200;
const listeners = new Set<() => void>();
export function setMissPage(key: string): void { pageNow = key; missed.length = 0; listeners.forEach((l) => l()); }
export function notePicture(url: string, ready: boolean): void {
    if (ready || !/^https?:/.test(url) || asked.has(url) || missed.some((m) => m.url === url)) return;
    missed.push({ url, page: pageNow });
    if (missed.length > MISS_MAX) missed.shift();
    listeners.forEach((l) => l());
}
export const misses = (): readonly Miss[] => missed;
export function onMiss(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); }
