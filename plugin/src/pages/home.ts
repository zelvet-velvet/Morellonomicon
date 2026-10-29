import { mapUrl } from "./handbook";
import type { PageCtx, PageOut } from "./index";
import { ITEM_CATS, SHOP_ICON_X, SHOP_ICON_Y, SHOP_SPRITE, blockLoad, h, holdTip, icon, page, roleArt } from "../ui";
import { MODES } from "../modes";
import { PROFILE_FRESH, QUEUE, RiotError, TIER, ago, cachedProfile, emblem, fetchProfile, type Profile } from "../data/riot";

// The servers a Riot ID can be on (Riot's platform ids), Taiwan first
const SERVERS: [string, string][] = [["TW2", "台灣"], ["JP1", "日本"], ["KR", "韓國"], ["SG2", "新加坡"], ["VN2", "越南"], ["NA1", "北美"], ["EUW1", "西歐"], ["EUN1", "北歐東歐"], ["OC1", "大洋洲"]];
const TOP = 3;   // mastery cards on Home

// Home (Review: Home tab draft): your profile like the client's, the way into Champions and the Handbook, your top mastery.
// Signed out it is a Riot ID box. The avatar, level, rank and recent games need Riot's API, which is not wired yet: until then the
// hero shows your name on your best champion's art.
export function homePage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const s = ctx.plugin.settings;
    const el = page("Home");
    const all = store.champions();
    const byId = new Map(all.map((c) => [c.id, c]));
    // your profile from Riot (cached on this device); its top mastery wins over the mastery file
    const prof: Profile | null = s.riotId ? cachedProfile(ctx.app, s.riotId) : null;
    const byKey = new Map(all.map((c) => [c.key, c]));
    let top = Object.entries(store.mastery?.champions ?? {}).filter(([id]) => byId.has(id)).sort((a, b) => b[1].points - a[1].points).slice(0, TOP);
    if (prof?.mastery.length) top = prof.mastery.filter((m) => byKey.has(m.championKey)).map((m) => [byKey.get(m.championKey)!.id, { level: m.level, points: m.points, last: "" }]);
    const patch = all[0]?.patch ?? "";
    const dd = (path: string) => `https://ddragon.leagueoflegends.com/cdn/${patch}/img/${path}`;

    const hero = h(el, "div", "mn-home-hero");
    if (!s.riotId) {
        // signed out: an ARAM map behind, one line on why, the Riot ID and the server
        hero.addClass("is-out");
        const bg = h(hero, "img", "mn-home-wall"); bg.src = mapUrl("habackground"); bg.alt = "";
        const box = h(hero, "div", "mn-home-cta");
        h(box, "b", undefined, "連結你的召喚師");
        h(box, "span", undefined, "輸入 Riot ID,看你的頭像、等級、牌位和最近對戰");
        const id = h(box, "input", "mn-home-in");
        id.type = "text"; id.placeholder = "遊戲名稱#標籤"; id.autocapitalize = "off"; id.spellcheck = false;
        const server = h(box, "select", "mn-home-in");
        for (const [v, name] of SERVERS) { const o = h(server, "option", undefined, `${name} ${v}`); o.value = v; }
        server.value = s.riotServer || "TW2";
        const err = h(box, "span", "mn-home-err");
        const go = h(box, "button", "mn-home-go", "連結");
        go.addEventListener("click", (e) => {
            e.preventDefault();
            const v = id.value.trim().replace(/＃/g, "#");
            if (!/^[^#]{3,16}#[^#]{2,5}$/.test(v)) { err.textContent = "格式是 名稱#標籤,例如 Zaviel#TW2"; return; }
            s.riotId = v; s.riotServer = server.value;
            void ctx.plugin.saveData(s).then(() => ctx.goTab("home"));
        });
    } else {
        // signed in: your best champion's art as the wallpaper, the avatar ring with your name; a tap on it changes or removes the ID
        const [name, tag] = s.riotId.split("#");
        const best = top[0] ? byId.get(top[0][0]) : undefined;
        // the wallpaper: the one you picked, else your top mastery champion's newest skin
        const splash = (id: string, n: number) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(id)}_${n}.jpg`;
        const [wid, wn] = s.wallpaper ? s.wallpaper.split("_") : [best?.id ?? "", String(Math.max(0, ...(best?.skins ?? [0])))];
        if (wid) { const bg = h(hero, "img", "mn-home-wall"); bg.src = splash(wid, Number(wn) || 0); bg.alt = ""; }
        const av = h(hero, "button", "mn-home-av");
        if (prof) { const im = h(av, "img"); im.src = dd(`profileicon/${prof.icon}.png`); im.alt = ""; }
        else if (best) { const im = h(av, "img"); im.src = best.icon; im.alt = ""; } else h(av, "span", undefined, (name ?? "?").slice(0, 1));
        av.setAttribute("aria-label", "更換 Riot ID");
        if (prof) h(hero, "div", "mn-home-lvl", String(prof.level));
        h(hero, "div", "mn-home-name").append(prof?.name ?? name ?? "", h(null, "small", undefined, `#${prof?.tag ?? tag ?? ""}`));
        const where = SERVERS.find((x) => x[0] === s.riotServer)?.[1] ?? s.riotServer;
        const sub = h(hero, "div", "mn-home-sub", prof ? `${where} · ${ago(prof.fetched)}更新` : s.riotKey ? `${where} · 讀取中…` : `${where} · 設定裡填 Riot API 金鑰後顯示頭像、牌位、對戰`);
        // fetch when there is nothing yet or it is old; the page redraws itself once it has the new one
        const refresh = () => {
            sub.textContent = `${where} · 讀取中…`;
            fetchProfile(ctx.app, s.riotId, s.riotServer, s.riotKey)
                .then(() => { if (el.isConnected) ctx.goTab("home"); })
                .catch((err) => { sub.textContent = err instanceof RiotError ? err.message : "連不上 Riot,稍後再試"; sub.addClass("is-err"); });
        };
        if (s.riotKey && (!prof || Date.now() - prof.fetched > PROFILE_FRESH)) refresh();
        const menu = h(hero, "div", "mn-home-menu is-hidden");
        const again = h(menu, "button", undefined, "重新整理");
        again.addEventListener("click", (e) => { e.preventDefault(); refresh(); });
        const wallBtn = h(menu, "button", undefined, "換背景");
        const out = h(menu, "button", undefined, "更換 / 登出");
        // the wallpaper picker: your champions (top mastery first, else all), then the chosen one's skins, newest first
        const picker = h(el, "div", "mn-home-pick is-hidden");
        wallBtn.addEventListener("click", (e) => { e.preventDefault(); picker.toggleClass("is-hidden", !picker.hasClass("is-hidden")); });
        const champsRow = h(picker, "div", "mn-home-prow");
        const skinsRow = h(picker, "div", "mn-home-prow is-skins");
        const mine = Object.entries(store.mastery?.champions ?? {}).filter(([id]) => byId.has(id)).sort((a, b) => b[1].points - a[1].points).map(([id]) => byId.get(id)!);
        const pool = mine.length ? mine.slice(0, 24) : all;
        const showSkins = (cid: string) => {
            skinsRow.empty();
            const c = byId.get(cid);
            if (!c) return;
            for (const n of [...c.skins].sort((a, b) => b - a)) {
                const b = h(skinsRow, "button", "mn-home-skin" + (s.wallpaper === `${cid}_${n}` ? " is-on" : ""));
                const im = h(b, "img"); im.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${encodeURIComponent(cid)}_${n}.jpg`; im.alt = ""; im.loading = "lazy";
                b.addEventListener("click", (e) => { e.preventDefault(); s.wallpaper = `${cid}_${n}`; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
            }
        };
        for (const c of pool) {
            const b = h(champsRow, "button", "mn-home-pc");
            const im = h(b, "img"); im.src = c.icon; im.alt = c.name; im.loading = "lazy";
            b.addEventListener("click", (e) => { e.preventDefault(); champsRow.querySelectorAll(".is-on").forEach((x) => x.removeClass("is-on")); b.addClass("is-on"); showSkins(c.id); });
        }
        if (s.wallpaper) {
            const reset = h(picker, "button", "mn-home-preset", "用預設(最熟練英雄的最新造型)");
            reset.addEventListener("click", (e) => { e.preventDefault(); s.wallpaper = ""; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
        }
        showSkins(wid || pool[0]?.id || "");
        out.addEventListener("click", (e) => { e.preventDefault(); s.riotId = ""; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
        av.addEventListener("click", (e) => { e.preventDefault(); menu.toggleClass("is-hidden", !menu.hasClass("is-hidden")); });
    }

    // rank: solo / duo and flex
    if (prof?.ranks.length) {
        const ranks = h(el, "div", "mn-home-ranks");
        for (const q of ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"]) {
            const r = prof.ranks.find((x) => x.queue === q);
            const t = h(ranks, "div", "mn-home-rank");
            if (r) { const im = h(t, "img"); im.src = emblem(r.tier); im.alt = ""; }
            const tx = h(t, "div");
            h(tx, "b", undefined, r ? `${TIER[r.tier] ?? r.tier} ${["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? "" : r.division} · ${r.lp} LP` : "未定級");
            h(tx, "span", undefined, `${q === "RANKED_SOLO_5x5" ? "單/雙排" : "彈性"}${r ? ` · ${r.wins} 勝 ${r.losses} 敗` : ""}`);
        }
    }

    // the ways in, 2 x 2 of the same size: Champions, Items, the next Handbook topic and the recent games
    const entries = h(el, "div", "mn-home-entries");
    const entry = (iconName: string, title: string, line: string, tint: string, go: () => void) => {
        const b = h(entries, "button", "mn-home-entry");
        b.style.setProperty("--t", tint);
        icon(b, iconName);
        h(b, "b", undefined, title);
        h(b, "span", undefined, line);
        b.addEventListener("click", (e) => { e.preventDefault(); go(); });
    };
    entry("users", "Champions", `${all.length} 位英雄 · 篩選`, "var(--mn-accent)", () => ctx.push({ key: "championlist", title: "Champions" }));
    entry("shopping-bag", "Items", "裝備 · 價格 · 合成", "var(--color-yellow)", () => ctx.push({ key: "itemlist", title: "Items" }));
    const read = new Set(s.read);
    const next = store.guideNotes().find((n) => n.layout === "deck" && !read.has(n.file.path));
    entry("book-open", "Handbook", next ? `繼續:${next.title}` : "全部讀完了", "var(--color-cyan)", () => { if (next) ctx.openNote(next.file.path); else ctx.goTab("handbook"); });
    // the recent games only once a Riot ID is linked (signed out, Handbook takes the whole row)
    if (!s.riotId) entries.lastElementChild?.addClass("is-wide");
    else entry("swords", "最近對戰", prof?.games.length ? `${prof.games.length} 場 · ${prof.games.filter((g) => g.win).length} 勝` : "連結 Riot 後顯示", "var(--color-purple)", () => ctx.push({ key: "games", title: "最近對戰" }));

    // your top mastery (from _data/mastery.json on a device that has it)
    if (top.length) {
        h(el, "div", "mn-home-lab", "熟練度");
        const row = h(el, "div", "mn-home-mast");
        for (const [id, m] of top) {
            const c = byId.get(id)!;
            const card = h(row, "button", "mn-home-mc");
            const im = h(card, "img"); im.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${encodeURIComponent(id)}_0.jpg`; im.alt = "";
            h(card, "em", m.level >= 10 ? "is-high" : undefined, `M${m.level}`);
            h(card, "b", undefined, c.name);
            card.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(id); });
        }
    }
    // the last games: a few rows here, all of them on the recent games page
    if (prof?.games.length) {
        const lab = h(el, "div", "mn-home-lab mn-home-labrow");
        h(lab, "span", undefined, "最近對戰");
        const more = h(lab, "button", "mn-home-more", "更多");
        more.addEventListener("click", (e) => { e.preventDefault(); ctx.push({ key: "games", title: "最近對戰" }); });
        const list = h(el, "div", "mn-home-games");
        for (const g of prof.games.slice(0, HOME_GAMES)) gameRow(ctx, list, g, false);
    }
    return { title: "Home", el };
}

const HOME_GAMES = 4;   // rows on Home; the rest are on the recent games page

// One game: a win / loss stripe, the champion, K/D/A, the mode and when; `full` adds CS, length and the items
function gameRow(ctx: PageCtx, parent: HTMLElement, g: Profile["games"][number], full: boolean): void {
    const c = ctx.plugin.store.champions().find((x) => x.id.toLowerCase() === g.champion.toLowerCase());   // matches spell some ids differently (FiddleSticks)
    const r = h(parent, "button", "mn-game" + (g.win ? " is-win" : " is-loss") + (full ? " is-full" : ""));
    const im = h(r, "img"); im.src = c?.icon ?? ""; im.alt = "";
    const tx = h(r, "div", "mn-game-t");
    h(tx, "b", undefined, `${c?.name ?? g.champion} · ${g.k}/${g.d}/${g.a}`);
    h(tx, "span", undefined, [QUEUE[g.queue] ?? "其他", ago(g.end), full ? `${Math.round(g.duration / 60)} 分 · ${g.cs} 兵` : ""].filter(Boolean).join(" · "));
    if (full && g.items.length) {
        const items = h(tx, "div", "mn-game-items");
        for (const id of g.items) { const x = h(items, "img"); x.src = `https://ddragon.leagueoflegends.com/cdn/${ctx.plugin.store.champions()[0]?.patch ?? ""}/img/item/${id}.png`; x.alt = ""; x.loading = "lazy"; }
    }
    h(r, "span", "mn-game-wl", g.win ? "勝" : "敗");
    if (c) r.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(c.id); });
}

// The recent games page: every game Home has
export function gamesPage(ctx: PageCtx): PageOut {
    const el = page("最近對戰");
    const prof = cachedProfile(ctx.app, ctx.plugin.settings.riotId);
    if (!prof?.games.length) { h(el, "p", "mn-home-sub", "還沒有對戰資料:在 Home 連結 Riot ID 並設定金鑰。"); return { title: "最近對戰", el }; }
    const wins = prof.games.filter((g) => g.win).length;
    h(el, "div", "mn-home-sub", `最近 ${prof.games.length} 場 · ${wins} 勝 ${prof.games.length - wins} 敗 · ${ago(prof.fetched)}更新`);
    const list = h(el, "div", "mn-home-games");
    for (const g of prof.games) gameRow(ctx, list, g, true);
    return { title: "最近對戰", el };
}

// Items: the current mode's shop like the game's: the stat filters as a row of icons, then the items by tier (起始, 鞋子, 基本, 史詩,
// 傳說), or by price; a search on top. A tap opens the item.
const TIERS = ["起始", "鞋子", "基本", "史詩", "傳說"];
const tierOf = (i: { tags: string[]; from: number[]; into: number[]; goldTotal: number }): string =>
    i.tags.includes("Boots") ? "鞋子" : !i.from.length && !i.into.length ? "起始" : !i.from.length ? "基本" : i.into.length ? "史詩" : "傳說";
// The shop's role tabs: Data Dragon gives items no roles, so each is read from the item's stats (a guess, close to the shop's own)
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
const SPRITE_HALF = 13;   // half the 26 px window each shop icon is shown in
const RAIL_BREAKS = new Set(["法術強度", "生命", "技能急速"]);   // a line before each group of the stat rail, like the shop
let itemRole = "", itemSort = "tier";   // kept while the app is open
const itemStats = new Set<string>();
// Items, laid out like the game's shop: the search, the role tabs with the sort button, the stat filters as a rail on the left
// (several can be on: an item must have them all), and a tight grid of icons with their price. A tap opens the item.
export function itemsPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const flag = MODES[ctx.plugin.settings.mode].itemFlag;
    const el = page("Items");
    const seen = new Set<string>();
    const items = store.items().filter((i) => i[flag] && i.goldTotal > 0 && !seen.has(i.name) && seen.add(i.name));
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "搜尋裝備";
    const roles = h(el, "div", "mn-shop-roles");
    const sortWrap = h(el, "div", "mn-shop-sortwrap");
    const body = h(el, "div", "mn-shop");
    const rail = h(body, "div", "mn-shop-rail");
    const host = h(body, "div", "mn-shop-list");   // one loading look for the whole list
    const drawRoles = () => {
        roles.empty();
        const all = h(roles, "button", "mn-shop-role" + (!itemRole ? " is-on" : ""));
        icon(all, "layout-grid");
        all.setAttribute("aria-label", "全部");
        all.addEventListener("click", (e) => { e.preventDefault(); itemRole = ""; drawRoles(); draw(); });
        for (const [r] of ITEM_ROLES) {
            const b = h(roles, "button", "mn-shop-role" + (itemRole === r ? " is-on" : ""));
            roleArt(b, r);
            holdTip(b, r);
            b.addEventListener("click", (e) => { e.preventDefault(); itemRole = itemRole === r ? "" : r; drawRoles(); draw(); });
        }
        // the sort button at the right end; its choices drop down under it
        const sb = h(roles, "button", "mn-shop-sortbtn");
        icon(sb, "arrow-up-down");
        sb.setAttribute("aria-label", "排序");
        sb.addEventListener("click", (e) => { e.preventDefault(); sortWrap.toggleClass("is-open", !sortWrap.hasClass("is-open")); });
    };
    const drawSort = () => {
        sortWrap.empty();
        for (const [id, name] of [["tier", "依階級"], ["up", "價格 低 → 高"], ["down", "價格 高 → 低"]]) {
            const b = h(sortWrap, "button", "mn-shop-sort" + (itemSort === id ? " is-on" : ""), name);
            b.addEventListener("click", (e) => { e.preventDefault(); itemSort = id; sortWrap.removeClass("is-open"); drawSort(); draw(); });
        }
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
            // the shop's own icon, cut from its sprite sheet: plain, or lit when on
            const ic = h(b, "span", "mn-shop-sprite");
            const at = (col: number) => `${-(SHOP_ICON_X[col] - SPRITE_HALF)}px ${-(SHOP_ICON_Y[k] - SPRITE_HALF)}px`;
            ic.style.backgroundImage = `url("${SHOP_SPRITE}")`;
            ic.style.backgroundPosition = at(itemStats.has(name) ? 2 : 0);
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
        const role = ITEM_ROLES.find(([r]) => r === itemRole)?.[1];
        const need = ITEM_CATS.filter(([n]) => itemStats.has(n)).map(([, , tags]) => tags);
        let list = items.filter((i) => (!q || i.name.includes(q)) && (!role || role(i)) && need.every((tags) => i.tags.some((x) => tags.includes(x))));
        if (!list.length) { h(host, "p", "mn-home-sub", "沒有符合的裝備"); return; }
        if (itemSort === "tier") {
            for (const tier of TIERS) {
                const part = list.filter((i) => tierOf(i) === tier);
                if (!part.length) continue;
                h(host, "div", "mn-shop-tier", tier);
                const grid = h(host, "div", "mn-items");
                for (const it of part) tile(grid, it);
            }
        } else {
            list = [...list].sort((x, y) => (itemSort === "up" ? 1 : -1) * (x.goldTotal - y.goldTotal));
            const grid = h(host, "div", "mn-items");
            for (const it of list) tile(grid, it);
        }
        blockLoad(host);
    };
    search.addEventListener("input", draw);
    drawRoles(); drawSort(); drawRail(); draw();
    // only the item grid scrolls: the shop fills the screen down to the tab bar, the search, role tabs and rail stay put
    const fit = () => {
        const scroll = el.closest<HTMLElement>(".mn-scroll");
        if (!scroll || !body.isConnected) return;
        body.style.height = `${Math.max(240, scroll.getBoundingClientRect().bottom - body.getBoundingClientRect().top - 8)}px`;
    };
    requestAnimationFrame(fit);
    sortWrap.addEventListener("transitionend", fit);
    new ResizeObserver(fit).observe(sortWrap);
    return { title: "Items", el };
}
