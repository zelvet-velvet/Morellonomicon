import { mapUrl } from "./handbook";
import type { PageCtx, PageOut } from "./index";
import { h, icon, page } from "../ui";

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
    const top = Object.entries(store.mastery?.champions ?? {}).filter(([id]) => byId.has(id)).sort((a, b) => b[1].points - a[1].points).slice(0, TOP);

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
        if (best) { const bg = h(hero, "img", "mn-home-wall"); bg.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(best.id)}_0.jpg`; bg.alt = ""; }
        const av = h(hero, "button", "mn-home-av");
        if (best) { const im = h(av, "img"); im.src = best.icon; im.alt = ""; } else h(av, "span", undefined, (name ?? "?").slice(0, 1));
        av.setAttribute("aria-label", "更換 Riot ID");
        h(hero, "div", "mn-home-name").append(name ?? "", h(null, "small", undefined, `#${tag ?? ""}`));
        h(hero, "div", "mn-home-sub", `${SERVERS.find((x) => x[0] === s.riotServer)?.[1] ?? s.riotServer} · 頭像、等級、牌位待接上 Riot`);
        const menu = h(hero, "div", "mn-home-menu is-hidden");
        const out = h(menu, "button", undefined, "更換 / 登出");
        out.addEventListener("click", (e) => { e.preventDefault(); s.riotId = ""; void ctx.plugin.saveData(s).then(() => ctx.goTab("home")); });
        av.addEventListener("click", (e) => { e.preventDefault(); menu.toggleClass("is-hidden", !menu.hasClass("is-hidden")); });
    }

    // the two ways in: Champions (all champions and the filters) and the next Handbook topic
    const entries = h(el, "div", "mn-home-entries");
    const champs = h(entries, "button", "mn-home-entry is-wide");
    icon(champs, "users");
    h(champs, "b", undefined, "Champions");
    h(champs, "span", undefined, `${all.length} 位英雄 · 篩選`);
    champs.addEventListener("click", (e) => { e.preventDefault(); ctx.push({ key: "championlist", title: "Champions" }); });
    const read = new Set(s.read);
    const next = store.guideNotes().find((n) => n.layout === "deck" && !read.has(n.file.path));
    const book = h(entries, "button", "mn-home-entry");
    icon(book, "book-open");
    h(book, "b", undefined, "Handbook");
    h(book, "span", undefined, next ? `繼續:${next.title}` : "全部讀完了");
    book.addEventListener("click", (e) => { e.preventDefault(); if (next) ctx.openNote(next.file.path); else ctx.goTab("handbook"); });

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
    return { title: "Home", el };
}
