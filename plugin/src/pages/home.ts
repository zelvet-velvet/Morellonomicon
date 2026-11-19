import { setIcon, type App } from "obsidian";
import type MorellonomiconPlugin from "../main";
import type { Champion } from "../data/store";
import type { NeedCtx, PageCtx, PageOut } from "./index";
import { ITEM_CAT_COLOR, ITEM_CATS, layoutBlock, shopIcon, shopRoleIcon, h, holdTip, icon, page, warmPictures, centreBelow, empty, goes, group, row } from "../ui";
import { MODES } from "../modes";
import { crest, crestRatio } from "../data/crest";
import { PROFILE_FRESH, RiotError, TIER, ago, cachedProfile, emblem, fetchProfile, profileSource, type Profile } from "../data/riot";
import { art, coverUrl, type Need } from "../media";
import { finder } from "./roster";

// The servers a Riot ID can be on (Riot's platform ids), Taiwan first
const SERVERS: [string, string][] = [["", "自動"], ["TW2", "台灣"], ["JP1", "日本"], ["KR", "韓國"], ["SG2", "新加坡"], ["VN2", "越南"], ["NA1", "北美"], ["EUW1", "西歐"], ["EUN1", "北歐東歐"], ["OC1", "大洋洲"]];

// One champion's mastery: level, points and when last played (ms; 0 when not known)
interface Mine { id: string; level: number; points: number; last: number }
// your profile from Riot (cached on this device) and your mastery of every champion, most points first; the profile's wins over
// the mastery file (tools/fetch_mastery.py)
function topMastery(app: App, plugin: MorellonomiconPlugin) {
    const s = plugin.settings, store = plugin.store;
    const all = store.champions();
    const byId = new Map(all.map((c) => [c.id, c]));
    const prof: Profile | null = s.riotId ? cachedProfile(app, s.riotId) : null;
    const byKey = new Map(all.map((c) => [c.key, c]));
    let mine: Mine[] = Object.entries(store.mastery?.champions ?? {}).filter(([id]) => byId.has(id))
        .map(([id, m]) => ({ id, level: m.level, points: m.points, last: Date.parse(m.last) || 0 }));
    if (prof?.mastery.length) mine = prof.mastery.filter((m) => byKey.has(m.championKey)).map((m) => ({ id: byKey.get(m.championKey)!.id, level: m.level, points: m.points, last: m.last ?? 0 }));
    mine.sort((a, b) => b.points - a.points);
    return { all, byId, prof, mine };
}
// the wallpaper: the one you picked, else your top mastery champion's newest skin
function wallpaper(plugin: MorellonomiconPlugin, best: Champion | undefined): string {
    const s = plugin.settings;
    const [wid, wn] = s.wallpaper ? s.wallpaper.split("_") : [best?.id ?? "", String(Math.max(0, ...(best?.skins ?? [0])))];
    return wid ? art.splash(wid, Number(wn) || 0) : "";
}
// The next Handbook topic to read, and how many of the decks are read
function nextTopic(plugin: MorellonomiconPlugin) {
    const decks = plugin.store.guideNotes().filter((n) => n.layout === "deck");
    const read = new Set(plugin.settings.read);
    return { decks, next: decks.find((n) => !read.has(n.file.path)), done: decks.filter((n) => read.has(n.file.path)).length };
}
const POPULAR = ["Jinx", "Garen", "Lux", "Ahri", "Ezreal"];   // the faces until you pick champions in Picks
const FACES = 5;
const points = (p: number): string => p >= 10000 ? `${(p / 10000).toFixed(1).replace(/\.0$/, "")} 萬點` : `${p} 點`;

// What Home shows from the network (its route in pages/index.ts): the card's picture, the avatar, the next topic's cover
export function homeNeeds({ app, plugin }: NeedCtx): Need[] {
    const { next } = nextTopic(plugin);
    const cover = next?.cover ? [coverUrl(next.cover)] : [];
    if (!plugin.settings.riotId) return [art.aramScreen("habackground"), ...cover];
    const { byId, prof, mine } = topMastery(app, plugin);
    const best = mine[0] ? byId.get(mine[0].id) : undefined;
    return [wallpaper(plugin, best), ...(prof ? [art.profileIcon(plugin.store.champions()[0]?.patch ?? "", prof.icon)] : []), ...cover];
}

// Home (Screens: Home options · E, chosen 2026-11-19): one card where everything starts (your profile, or the ARAM map with a greeting,
// and the search for champions, items and augments at its foot), four round buttons for the ways in that are not tabs, your champions as
// faces, the last games (linked) and the next Handbook topic. Typing in the search shows the results in place of everything under the card.
export function homePage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const s = ctx.plugin.settings;
    const el = page("Home");
    const { all, byId, prof, mine } = topMastery(ctx.app, ctx.plugin);
    const patch = all[0]?.patch ?? "";
    const linked = !!s.riotId;

    // ---------- the card ----------
    const card = layoutBlock(h(el, "div", "mn-hc"));
    const best = mine[0] ? byId.get(mine[0].id) : undefined;
    const wall = linked ? wallpaper(ctx.plugin, best) : art.aramScreen("habackground");
    if (wall) { const bg = h(card, "img", "mn-hc-wall"); bg.src = wall; bg.alt = ""; }
    const foot = h(card, "div", "mn-hc-foot");
    const picker = h(null, "div", "mn-home-pick is-hidden");   // the wallpaper picker (linked), under the card
    if (!linked) {
        // not linked: a greeting with the patch, 連結 Riot ID as a pill in the corner; it opens the form in place of the greeting
        const n = store.riotNotes[0];
        const greet = h(foot, "div", "mn-hc-greet");
        h(greet, "b", undefined, "今天想查什麼？");
        if (n) h(greet, "span", undefined, `${n.patch} 版本 · ${(n.champions?.length ?? 0) + (n.mayhem_champions?.length ?? 0)} 位英雄調整 · ${n.augments_new?.length ?? 0} 個新強化`);
        const form = h(foot, "div", "mn-hc-form is-hidden");
        const line = h(form, "div", "mn-hc-idrow");
        const id = h(line, "input", "mn-hc-in");
        id.type = "text"; id.placeholder = "遊戲名稱#標籤"; id.autocapitalize = "off"; id.spellcheck = false;
        const server = h(line, "select", "mn-hc-server");
        for (const [v, name] of SERVERS) { const o = h(server, "option", undefined, v || name); o.value = v; o.title = name; }
        server.value = s.riotServer;
        const go = h(line, "button", "mn-hc-go", "連結");
        const err = h(form, "span", "mn-home-err");
        go.addEventListener("click", (e) => {
            e.preventDefault();
            const v = id.value.trim().replace(/＃/g, "#");
            if (!/^[^#]{3,16}#[^#]{2,5}$/.test(v)) { err.textContent = "格式是 名稱#標籤,例如 Zaviel#TW2"; return; }
            s.riotId = v; s.riotServer = server.value;
            void ctx.plugin.saveData(s).then(() => ctx.goTab("home"));
        });
        const pill = h(card, "button", "mn-hc-pill");
        const pic = icon(pill, "user-round-plus");
        const label = h(pill, "span", undefined, "連結 Riot ID");
        pill.addEventListener("click", (e) => {
            e.preventDefault();
            const open = form.hasClass("is-hidden");
            form.toggleClass("is-hidden", !open); greet.toggleClass("is-hidden", open);
            label.textContent = open ? "取消" : "連結 Riot ID";
            setIcon(pic, open ? "x" : "user-round-plus");
            if (open) id.focus();
        });
    } else {
        // linked: your avatar (a tap opens the menu), name, server and when it was fetched, your solo rank
        const [name, tag] = s.riotId.split("#");
        const who = h(foot, "div", "mn-hc-who");
        const av = h(who, "button", "mn-hc-av");
        if (prof) { const im = h(av, "img"); im.src = art.profileIcon(patch, prof.icon); im.alt = ""; }
        else if (best) { const im = h(av, "img"); im.src = best.icon; im.alt = ""; } else h(av, "span", undefined, (name ?? "?").slice(0, 1));
        av.setAttribute("aria-label", "帳號選單");
        if (prof) h(av, "em", undefined, String(prof.level));
        const tx = h(who, "div", "mn-hc-name");
        h(tx, "b", undefined, prof?.name ?? name ?? "").append(h(null, "small", undefined, `#${prof?.tag ?? tag ?? ""}`));
        const srv = prof?.server || s.riotServer;   // the server Riot named, when it was left to Riot
        const where = srv ? `${SERVERS.find((x) => x[0] === srv)?.[1] ?? ""} ${srv}`.trim() : "";
        const source = profileSource(s);
        const sub = h(tx, "span", "mn-hc-sub", prof ? `${where} · ${ago(prof.fetched)}更新` : source ? "讀取中…" : "設定填 API 金鑰後顯示牌位");
        const solo = prof?.ranks.find((x) => x.queue === "RANKED_SOLO_5x5");
        if (solo) {
            const rk = h(who, "div", "mn-hc-rank");
            const im = h(rk, "img"); im.src = emblem(solo.tier); im.alt = "";
            h(rk, "span", undefined, `${TIER[solo.tier] ?? solo.tier} ${["MASTER", "GRANDMASTER", "CHALLENGER"].includes(solo.tier) ? "" : solo.division}`.trim());
            holdTip(rk, `單/雙排 · ${solo.lp} LP · ${solo.wins} 勝 ${solo.losses} 敗`);
        }
        // fetch when there is nothing yet or it is old. One fetch at a time: at start-up Home is drawn several times while the data
        // arrives, and each drawing used to start its own fetch (a dozen Riot calls each), whose answers then redrew the page one after
        // another once it was on screen (the cold-open glitch). The page redraws in place only when what Riot sent differs from what
        // it shows; otherwise only the "updated" line changes.
        // an answer can come before the page is on screen (the profile server's cache answers in a few ms): it waits for the page
        // to show, up to 10 s (a timer, not animation frames, which stop while the window is hidden); a page that never shows was left
        const onPage = (fn: () => void) => { let n = 0; const tick = () => { if (el.isConnected) fn(); else if (n++ < 100) window.setTimeout(tick, 100); }; tick(); };
        const refresh = () => {
            sub.textContent = "讀取中…";
            sub.removeClass("is-err");
            profileFetch(ctx)
                .then((p) => onPage(() => {
                    if (sameProfile(p, prof)) sub.textContent = `${where} · ${ago(p.fetched)}更新`;
                    else ctx.redraw();   // in place: opening Home again would replay its arrival
                }))
                .catch((err) => onPage(() => { sub.textContent = err instanceof RiotError ? err.message : "連不上 Riot,稍後再試"; sub.addClass("is-err"); }));
        };
        if (source && (!prof || Date.now() - prof.fetched > PROFILE_FRESH)) refresh();
        // the avatar's menu, in place under the name: refresh, wallpaper, change or log out
        const menu = h(foot, "div", "mn-home-menu is-hidden");
        const again = h(menu, "button", undefined, "重新整理");
        again.addEventListener("click", (e) => { e.preventDefault(); refresh(); });
        const wallBtn = h(menu, "button", undefined, "換背景");
        const out = h(menu, "button", undefined, "更換 / 登出");
        wallBtn.addEventListener("click", (e) => { e.preventDefault(); picker.toggleClass("is-hidden", !picker.hasClass("is-hidden")); });
        out.addEventListener("click", (e) => { e.preventDefault(); s.riotId = ""; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
        av.addEventListener("click", (e) => { e.preventDefault(); menu.toggleClass("is-hidden", !menu.hasClass("is-hidden")); });
        // the wallpaper picker: your champions (top mastery first, else all), then the chosen one's skins, newest first
        const champsRow = layoutBlock(h(picker, "div", "mn-home-prow"));
        const skinsRow = layoutBlock(h(picker, "div", "mn-home-prow is-skins"));
        const pool = mine.length ? mine.slice(0, 24).map((m) => byId.get(m.id)!) : all;
        const showSkins = (cid: string) => {
            skinsRow.empty();
            const c = byId.get(cid);
            if (!c) return;
            for (const n of [...c.skins].sort((a, b) => b - a)) {
                const b = h(skinsRow, "button", "mn-home-skin" + (s.wallpaper === `${cid}_${n}` ? " is-on" : ""));
                const im = h(b, "img"); im.src = art.loading(cid, n); im.alt = ""; im.loading = "lazy";
                b.addEventListener("click", (e) => { e.preventDefault(); s.wallpaper = `${cid}_${n}`; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
            }
        };
        for (const c of pool) {
            const b = h(champsRow, "button", "mn-home-pc");
            const im = h(b, "img"); im.src = c.icon; im.alt = c.name;   // icons are warmed at start-up: no need to load lazily
            b.addEventListener("click", (e) => { e.preventDefault(); champsRow.querySelectorAll(".is-on").forEach((x) => x.removeClass("is-on")); b.addClass("is-on"); showSkins(c.id); });
        }
        if (s.wallpaper) {
            const reset = h(picker, "button", "mn-home-preset", "用預設(最熟練英雄的最新造型)");
            reset.addEventListener("click", (e) => { e.preventDefault(); s.wallpaper = ""; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
        }
        showSkins((s.wallpaper ? s.wallpaper.split("_")[0] : best?.id) || pool[0]?.id || "");
    }
    // the search at the card's foot: champions, items and augments
    const box = h(foot, "div", "mn-search mn-hc-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "搜尋英雄、裝備、強化";
    el.append(picker);

    // ---------- under the card: the ways in, your champions, games, learning (results take their place while typing) ----------
    const rest = h(el, "div", "mn-hc-rest");
    const results = h(el, "div", "mn-hc-results is-hidden");

    const quick = h(rest, "div", "mn-hq");
    const btn = (iconName: string, label: string, tint: string, go: () => void) => {
        const b = h(quick, "button", "mn-hq-b");
        b.style.setProperty("--t", tint);
        icon(h(b, "span", "mn-hq-ic"), iconName);
        h(b, "span", "mn-hq-l", label);
        b.addEventListener("click", (e) => { e.preventDefault(); go(); });
        return b;
    };
    const { decks, next, done } = nextTopic(ctx.plugin);
    const openNext = () => { if (next) ctx.openNote(next.file.path); else ctx.goTab("handbook"); };
    btn("users", "英雄", "var(--mn-accent)", () => ctx.push({ key: "championlist", title: "Champions" }));
    btn("shopping-bag", "裝備", "var(--color-yellow)", () => ctx.push({ key: "itemlist", title: "Items" }));
    btn("book-open", "學習", "var(--color-cyan)", openNext);
    if (!linked) btn("scroll-text", "名詞表", "var(--color-green)", () => ctx.openNote(`${s.guideFolder}/名詞表.md`));

    // 你的英雄 (Screens: Home redesign): with mastery, cards with Riot's crest and level, 最近玩 (when last played, every mode, Mayhem
    // too) or 最拿手 (points); without, 我的英雄: your Picks (編輯 opens Picks), else a few easy ones. A tap opens the champion.
    const withLast = mine.some((m) => m.last > 0);
    const sec = layoutBlock(h(rest, "div", "mn-hy"));
    const lab = h(sec, "div", "mn-hc-lab");
    h(lab, "span", undefined, mine.length ? "你的英雄" : "我的英雄");
    const cards = h(sec, "div", "mn-hy-row");
    const drawCards = () => {
        cards.empty();
        const recent = withLast && s.homeChamps !== "best";
        const list: { c: Champion; level?: number; sub: string }[] = mine.length
            ? (recent ? [...mine].sort((a, b) => b.last - a.last) : mine).slice(0, FACES).map((m) => ({ c: byId.get(m.id)!, level: m.level, sub: recent ? ago(m.last) : points(m.points) }))
            : (s.roster.filter((id) => byId.has(id)).length ? s.roster.filter((id) => byId.has(id)) : POPULAR).map((id) => byId.get(id)).filter((c): c is Champion => !!c).slice(0, FACES).map((c) => ({ c, sub: c.title }));
        for (const { c, level, sub } of list) {
            const b = h(cards, "button", "mn-hy-b");
            const im = h(b, "img", "mn-hy-face"); im.src = c.icon; im.alt = "";
            if (level) {
                const lv = h(b, "span", "mn-hy-lv");
                const cr = h(lv, "img", "mn-hy-crest"); cr.alt = ""; cr.style.width = `${Math.round(20 * crestRatio(level))}px`;
                void crest(level).then((u) => { if (u) cr.src = u; else cr.remove(); });
                h(lv, "b", undefined, `${level}`);
            }
            h(b, "span", "mn-hy-n", c.name);
            h(b, "span", "mn-hy-s", sub);
            b.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(c.id); });
            goes(b, { key: "champion", params: { id: c.id } });
        }
    };
    if (withLast) {
        const seg = h(lab, "div", "mn-seg is-sm mn-hy-seg");
        const opts: [string, string][] = [["recent", "最近玩"], ["best", "最拿手"]];
        const btns = opts.map(([id, t]) => {
            const b = h(seg, "button", "mn-seg-b" + ((s.homeChamps === "best") === (id === "best") ? " is-on" : ""), t);
            b.addEventListener("click", (e) => {
                e.preventDefault();
                s.homeChamps = id as "recent" | "best";
                btns.forEach((x, k) => x.toggleClass("is-on", opts[k][0] === id));
                drawCards();
                void ctx.plugin.saveData(s);
            });
            return b;
        });
    } else if (!mine.length) {
        const more = h(lab, "button", "mn-home-more", "編輯");
        more.addEventListener("click", (e) => { e.preventDefault(); ctx.goTab("picks"); });
    }
    drawCards();

    // the next Handbook topic: a wide cover card
    if (decks.length) {
        const learn = layoutBlock(h(rest, "button", "mn-hl is-wide"));
        if (next?.cover) { const im = h(learn, "img", "mn-hl-img"); im.src = coverUrl(next.cover); im.alt = ""; }
        const tx = h(learn, "div", "mn-hl-t");
        h(tx, "span", "mn-hl-k", `繼續學習 · ${done} / ${decks.length}`);
        h(tx, "b", undefined, next?.title ?? "全部讀完了");
        const bar = h(tx, "div", "mn-hl-bar");
        h(bar, "i").style.width = `${Math.round((done / decks.length) * 100)}%`;
        learn.addEventListener("click", (e) => { e.preventDefault(); openNext(); });
    }

    // ---------- the search: results in place of what is under the card ----------
    const { score } = finder(all, store.sounds);
    const flag = MODES[s.mode].itemFlag;
    const draw = () => {
        const q = search.value.trim();
        rest.toggleClass("is-hidden", !!q); picker.addClass("is-hidden");
        results.toggleClass("is-hidden", !q);
        results.empty();
        if (!q) return;
        const ql = q.toLowerCase();
        const champs = all.map((c) => ({ c, v: score(c, q) })).filter((x) => x.v >= 50).sort((a, b) => b.v - a.v).slice(0, 6);
        const seen = new Set<string>();
        const items = store.items().filter((i) => i[flag] && i.goldTotal > 0 && !i.reward && i.name.toLowerCase().includes(ql) && !seen.has(i.name) && seen.add(i.name)).slice(0, 4);
        const augs = store.augments().filter((a) => a.name.toLowerCase().includes(ql)).slice(0, 4);
        if (!champs.length && !items.length && !augs.length) { empty(results, { icon: "search-x", title: "找不到", text: "換個名字,或用英雄的英文名、暱稱" }); return; }
        if (champs.length) { const g = group(results, "英雄"); for (const { c } of champs) goes(row(g, { image: c.icon, title: c.name, sub: c.title, chevron: true, onTap: () => ctx.openChampion(c.id) }), { key: "champion", params: { id: c.id } }); }
        if (items.length) { const g = group(results, "裝備"); for (const i of items) row(g, { image: i.icon, title: i.name, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openItem(i.id) }); }
        if (augs.length) { const g = group(results, "強化"); for (const a of augs) row(g, { image: a.icon, rarity: a.rarity, title: a.name, sub: a.rarity, chevron: true, onTap: () => ctx.openAugment(a.id) }); }
    };
    search.addEventListener("input", draw);
    return { title: "Home", el };
}

// The profile fetch in flight, shared by every drawing of Home (see refresh in homePage); a tap on 重新整理 while one runs waits for it
let inFlight: Promise<Profile> | null = null;
function profileFetch(ctx: PageCtx): Promise<Profile> {
    const s = ctx.plugin.settings;
    inFlight ??= fetchProfile(ctx.app, s.riotId, s.riotServer, s).finally(() => { inFlight = null; });
    return inFlight;
}
// The same as what Home shows, apart from when it was fetched
const sameProfile = (a: Profile, b: Profile | null): boolean => !!b && JSON.stringify({ ...a, fetched: 0 }) === JSON.stringify({ ...b, fetched: 0 });

// Items: the current mode's shop like the game's: the stat filters as a row of icons, then the items by tier (起始, 鞋子, 基本, 史詩,
// 傳說), or by price; a search on top. A tap opens the item.
const TIERS = ["起始", "鞋子", "基本", "史詩", "傳說"];
const tierOf = (i: { tags: string[]; from: number[]; into: number[]; goldTotal: number }): string =>
    i.tags.includes("Boots") ? "鞋子" : !i.from.length && !i.into.length ? "起始" : !i.from.length ? "基本" : i.into.length ? "史詩" : "傳說";
// The shop's class tabs, in its order. Which items each lists comes from _data/item-roles.json (the League wiki's copy of the shop's
// menus, tools/fetch_item_roles.py); without that file, a guess from the item's stats stands in
type ItemLike = { tags: string[] };
const has = (i: ItemLike, ...tags: string[]) => tags.some((x) => i.tags.includes(x));
const ITEM_ROLES: [string, (i: ItemLike) => boolean][] = [
    ["戰士", (i) => has(i, "Damage") && has(i, "Health")],
    ["射手", (i) => has(i, "CriticalStrike") || (has(i, "AttackSpeed") && has(i, "Damage"))],
    ["刺客", (i) => has(i, "Damage") && has(i, "ArmorPenetration", "NonbootsMovement") && !has(i, "Health")],
    ["法師", (i) => has(i, "SpellDamage")],
    ["坦克", (i) => has(i, "Health") && has(i, "Armor", "SpellBlock", "MagicResist") && !has(i, "Damage", "SpellDamage")],
    ["輔助", (i) => has(i, "GoldPer", "Aura") || (has(i, "Active") && !has(i, "Damage", "SpellDamage"))],
];
const RAIL_BREAKS = new Set(["法術強度", "生命", "技能急速"]);   // a line before each group of the stat rail, like the shop
let itemRole = "", itemFlip = false;   // kept while the app is open; itemFlip: the tier blocks the other way up (傳說 first)
const itemStats = new Set<string>();
// Items, laid out like the game's shop: the search, the role tabs with the sort button, the stat filters as a rail on the left
// (several can be on: an item must have them all), and a tight grid of icons with their price. A tap opens the item.
export function itemsPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const flag = MODES[ctx.plugin.settings.mode].itemFlag;
    const el = page("Items");
    const seen = new Set<string>();
    const items = store.items().filter((i) => i[flag] && i.goldTotal > 0 && !i.reward && !seen.has(i.name) && seen.add(i.name));   // augment rewards are never sold
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "搜尋裝備";
    const roles = layoutBlock(h(el, "div", "mn-shop-roles"), true);   // the three blocks each load on their own
    const body = h(el, "div", "mn-shop");
    const rail = layoutBlock(h(body, "div", "mn-shop-rail"), true);
    const host = layoutBlock(h(body, "div", "mn-shop-list"), true);   // one loading look for the whole list
    const drawRoles = () => {
        roles.empty();
        const all = h(roles, "button", "mn-shop-role" + (!itemRole ? " is-on" : ""));
        shopRoleIcon(all, "全部");
        all.setAttribute("aria-label", "全部");
        all.addEventListener("click", (e) => { e.preventDefault(); itemRole = ""; drawRoles(); draw(); });
        // the six roles centred between 全部 (above the stat rail) and the sort button
        const mid = h(roles, "div", "mn-shop-rolemid");
        for (const [r] of ITEM_ROLES) {
            const b = h(mid, "button", "mn-shop-role" + (itemRole === r ? " is-on" : ""));
            shopRoleIcon(b, r);
            holdTip(b, r);
            b.addEventListener("click", (e) => { e.preventDefault(); itemRole = itemRole === r ? "" : r; drawRoles(); draw(); });
        }
        // the sort button at the right end: it turns the tier blocks upside down (起始 → 傳說, or 傳說 → 起始); its arrow shows which way
        const sb = h(roles, "button", "mn-shop-sortbtn" + (itemFlip ? " is-on" : ""));
        icon(sb, itemFlip ? "arrow-up-wide-narrow" : "arrow-down-wide-narrow");
        sb.setAttribute("aria-label", itemFlip ? "傳說在前" : "起始在前");
        holdTip(sb, itemFlip ? "傳說在前" : "起始在前");
        sb.addEventListener("click", (e) => { e.preventDefault(); itemFlip = !itemFlip; drawRoles(); draw(); });
    };
    const drawRail = () => {
        rail.empty();
        const clear = h(rail, "button", "mn-shop-stat is-clear" + (itemStats.size ? " is-live" : ""));
        icon(clear, "list-x");
        clear.setAttribute("aria-label", "清除篩選");
        clear.addEventListener("click", (e) => { e.preventDefault(); itemStats.clear(); drawRail(); draw(); });
        ITEM_CATS.forEach(([name], k) => {
            if (RAIL_BREAKS.has(name)) h(rail, "i", "mn-shop-break");
            const b = h(rail, "button", "mn-shop-stat" + (itemStats.has(name) ? " is-on" : ""));
            if (itemStats.has(name)) b.style.color = ITEM_CAT_COLOR[name] ?? "";   // on: its colour from the Icons note, off: grey
            shopIcon(b, k, itemStats.has(name), "mn-shop-sprite");   // the shop's own icon, sharpened
            holdTip(b, name);
            b.addEventListener("click", (e) => { e.preventDefault(); itemStats.has(name) ? itemStats.delete(name) : itemStats.add(name); drawRail(); draw(); });
        });
    };
    const tile = (grid: HTMLElement, it: (typeof items)[number]) => {
        const b = h(grid, "button", "mn-item-tile");
        const im = h(b, "img"); im.src = it.icon; im.alt = it.name;
        h(b, "span", undefined, `${it.goldTotal}`);
        holdTip(b, it.name);
        b.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(it.id); });
    };
    const draw = () => {
        host.empty();
        const q = search.value.trim();
        const shopRoles = store.itemRoles;
        const role = !itemRole ? undefined
            : shopRoles ? (i: { id: number }) => (shopRoles[String(i.id)] ?? []).includes(itemRole)
            : ITEM_ROLES.find(([r]) => r === itemRole)?.[1];
        const need = ITEM_CATS.filter(([n]) => itemStats.has(n)).map(([, , tags]) => tags);
        let list = items.filter((i) => (!q || i.name.includes(q)) && (!role || role(i)) && need.every((tags) => i.tags.some((x) => tags.includes(x))));
        if (!list.length) { h(host, "p", "mn-home-sub", "沒有符合的裝備"); return; }
        for (const tier of itemFlip ? [...TIERS].reverse() : TIERS) {
            const part = list.filter((i) => tierOf(i) === tier).sort((x, y) => x.goldTotal - y.goldTotal);   // cheapest first, like the shop
            if (!part.length) continue;
            h(host, "div", "mn-shop-tier", tier);
            const grid = h(host, "div", "mn-items");
            for (const it of part) tile(grid, it);
        }
        host.scrollTop = 0;
    };
    search.addEventListener("input", draw);
    // every item's icon, fetched now: a role or stat filter then shows its items at once (Design Rules: ready before it shows)
    void warmPictures(items.map((i) => i.icon));
    drawRoles(); drawRail(); draw();
    // only the item grid scrolls: the shop fills the screen down to the tab bar, the search, role tabs and rail stay put
    const fit = () => {
        const scroll = el.closest<HTMLElement>(".mn-scroll");
        if (!scroll || !body.isConnected) return;
        body.style.height = `${Math.max(240, scroll.getBoundingClientRect().bottom - body.getBoundingClientRect().top - 8)}px`;
    };
    requestAnimationFrame(fit);
    return { title: "Items", el };
}
