import { Notice } from "obsidian";
import type { Champion } from "../data/store";
import { DAMAGE_COLOR, chip, empty, h, icon, page } from "../ui";
import { entryDir, marker } from "./changes";
import type { PageCtx, PageOut } from "./index";
import { abilityPills, styleLine } from "./profile";

const MAX_PICKS = 15;   // a Mayhem game can hand you a lot of champions
const ROLES = ["戰士", "坦克", "法師", "刺客", "射手", "輔助"];
const SPLIT = /[\s,，、;；和跟與及]+/;   // several names said or typed in one go

// How well a champion matches what was typed or dictated. Forgiving on purpose: a name, part of it, the title, the English id, or most of
// the characters (speech to text often gets one wrong). 0 = no match.
export function matchScore(c: Champion, raw: string): number {
    const q = raw.trim().toLowerCase();
    if (!q) return 0;
    const name = c.name.toLowerCase(), title = c.title.toLowerCase(), id = c.id.toLowerCase();
    if (name === q || id === q) return 100;
    if (name.startsWith(q) || id.startsWith(q)) return 90;
    if (name.includes(q) || id.includes(q)) return 80;
    if (title.includes(q)) return 60;
    const chars = [...q];
    let at = 0;
    for (const ch of name) if (ch === chars[at]) at++;   // the characters appear in order
    if (at === chars.length && chars.length >= 2) return 50;
    const shared = chars.filter((ch) => name.includes(ch)).length;   // most of the characters are there
    return chars.length >= 3 && shared / chars.length >= 0.66 ? 20 + shared : 0;
}

// Quick Look: pick the champions the game gave you (up to 15) and see right away what each one is and can do.
export function rosterPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("速查");
    const all = store.champions();
    let picks = ctx.plugin.settings.roster.filter((id) => all.some((c) => c.id === id)).slice(0, MAX_PICKS);
    let query = "", role = "";
    const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)] as const));
    const save = () => { void ctx.plugin.setRoster(picks); };

    h(el, "p", "mn-rq-hint", "大混戰會隨機給你英雄。點你拿到的(最多 15 位),馬上看到定位和能力。");
    const results = h(el, "div", "mn-rq-results");

    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "打字,或用鍵盤的麥克風說名字(可以一次說好幾個)";
    search.setAttribute("enterkeyhint", "search");
    const suggest = h(el, "div", "mn-chips");
    const roles = h(el, "div", "mn-chips");
    const grid = h(el, "div", "mn-grid");

    const toggle = (id: string) => {
        if (picks.includes(id)) picks = picks.filter((p) => p !== id);
        else if (picks.length >= MAX_PICKS) { new Notice(`最多選 ${MAX_PICKS} 位`); return; }
        else picks = [...picks, id];
        save();
        drawResults();
        drawGrid();
    };

    const card = (c: Champion) => {
        const r = h(results, "div", "mn-rq");
        const top = h(r, "div", "mn-rq-top");
        const im = h(top, "img", "mn-rq-img"); im.src = c.icon; im.alt = "";
        const who = h(top, "div", "mn-rq-who");
        h(who, "div", "mn-rq-name", c.name);
        h(who, "div", "mn-rq-title", c.title);
        const rm = h(top, "button", "mn-rq-x");
        icon(rm, "x");
        rm.setAttribute("aria-label", "移除");
        rm.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggle(c.id); });
        const tags = h(r, "div", "mn-chips mn-rq-tags");
        for (const role_ of c.roles) chip(tags, role_);
        chip(tags, `${c.damageType}輸出`, { color: DAMAGE_COLOR[c.damageType] });
        const rd = recent.get(c.name);
        if (rd) { const m = marker(rd); chip(tags, `${m.mark} 本版調整`, { color: m.color }); }
        styleLine(r, c);
        abilityPills(r, c);
        r.addEventListener("click", () => ctx.openChampion(c.id));
    };

    const drawResults = () => {
        results.empty();
        if (!picks.length) return;
        const head = h(results, "div", "mn-rq-head");
        h(head, "span", "mn-rq-count", `你的英雄 ${picks.length} / ${MAX_PICKS}`);
        const clear = h(head, "button", "mn-clear", "全部清除");
        clear.addEventListener("click", (e) => { e.preventDefault(); picks = []; save(); drawResults(); drawGrid(); });
        for (const id of picks) { const c = all.find((x) => x.id === id); if (c) card(c); }
    };

    // several names typed or said together: a button per name that matched, and one to add them all
    const drawSuggest = () => {
        suggest.empty();
        const tokens = query.split(SPLIT).filter(Boolean);
        if (tokens.length < 2) return;
        const found = tokens.map((t) => all.map((c) => ({ c, s: matchScore(c, t) })).sort((a, b) => b.s - a.s)[0]).filter((x) => x && x.s >= 50).map((x) => x.c);
        const unique = [...new Map(found.map((c) => [c.id, c])).values()];
        if (!unique.length) return;
        for (const c of unique) chip(suggest, `${picks.includes(c.id) ? "✓ " : "+ "}${c.name}`, { color: "var(--color-green)", onTap: () => toggle(c.id) });
        chip(suggest, "全部加入", { on: true, onTap: () => { for (const c of unique) if (!picks.includes(c.id) && picks.length < MAX_PICKS) picks = [...picks, c.id]; save(); drawResults(); drawGrid(); } });
    };

    const drawGrid = () => {
        grid.empty();
        const tokens = query.split(SPLIT).filter(Boolean);
        let list = all.filter((c) => !role || c.roles.includes(role));
        if (tokens.length) {
            const scored = list.map((c) => ({ c, s: Math.max(...tokens.map((t) => matchScore(c, t))) })).filter((x) => x.s > 0);
            scored.sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name, "zh-Hant"));
            list = scored.map((x) => x.c);
        }
        for (const c of list) {
            const on = picks.includes(c.id);
            const t = h(grid, "button", "mn-tile mn-pick" + (on ? " is-pick" : ""));
            const im = h(t, "img"); im.src = c.icon; im.alt = ""; im.loading = "lazy";
            if (on) icon(h(t, "span", "mn-pick-ok"), "check");
            h(t, "span", "mn-tile-n", c.name);
            t.addEventListener("click", (e) => { e.preventDefault(); toggle(c.id); });
        }
        if (!list.length) empty(grid, { icon: "search-x", title: "找不到", text: "換個說法,或少打幾個字試試。" });
    };

    const drawRoles = () => {
        roles.empty();
        for (const r of ROLES) chip(roles, r, { on: role === r, onTap: () => { role = role === r ? "" : r; drawRoles(); drawGrid(); } });
    };

    search.addEventListener("input", () => { query = search.value; drawSuggest(); drawGrid(); });
    drawResults();
    drawRoles();
    drawGrid();
    return { title: "速查", el };
}
