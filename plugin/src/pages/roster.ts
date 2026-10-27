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

// Number of single-character edits (change, add, remove) between two words: "阿里" and "阿璃" are 1 apart.
function distance(a: string, b: string): number {
    const x = [...a], y = [...b];
    let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
    for (let i = 1; i <= x.length; i++) {
        const cur = [i];
        for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[y.length];
}

// The champions whose name (or English id) is only a letter or two off what was typed: the "did you mean" list for a misspelling or a
// speech-to-text slip. One slip is allowed for short words, two for longer ones.
function closest(all: Champion[], raw: string, limit = 4): Champion[] {
    const q = raw.trim().toLowerCase();
    if (!q) return [];
    const allowed = [...q].length <= 4 ? 1 : 2;
    return all.map((c) => ({ c, d: Math.min(distance(q, c.name.toLowerCase()), distance(q, c.id.toLowerCase())) }))
        .filter((x) => x.d <= allowed).sort((a, b) => a.d - b.d || a.c.name.localeCompare(b.c.name, "zh-Hant")).slice(0, limit).map((x) => x.c);
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
    search.placeholder = "輸入英雄名字,或按鍵盤上的 🎤 說出來";
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
    // For each word: the best name that matches well; when none does, the nearest names ("did you mean"). Several words add up.
    const drawSuggest = () => {
        suggest.empty();
        const tokens = query.split(SPLIT).filter(Boolean);
        if (!tokens.length) return;
        const best = (t: string): { list: Champion[]; exact: boolean } => {
            const ranked = all.map((c) => ({ c, s: matchScore(c, t) })).sort((a, b) => b.s - a.s);
            return ranked[0] && ranked[0].s >= 50 ? { list: [ranked[0].c], exact: true } : { list: closest(all, t, 3), exact: false };
        };
        const found = tokens.map(best);
        const unique = [...new Map(found.flatMap((f) => f.list).map((c) => [c.id, c])).values()];
        if (!unique.length) return;
        const guessed = found.some((f) => !f.exact && f.list.length);
        // a single word that already matches well needs no suggestion row: the grid shows it
        if (tokens.length === 1 && !guessed) return;
        if (guessed) h(suggest, "span", "mn-dym", "你是不是在找:");
        for (const c of unique) chip(suggest, `${picks.includes(c.id) ? "✓ " : "+ "}${c.name}`, { color: "var(--color-green)", onTap: () => toggle(c.id) });
        if (unique.length > 1) chip(suggest, "全部加入", { on: true, onTap: () => { for (const c of unique) if (!picks.includes(c.id) && picks.length < MAX_PICKS) picks = [...picks, c.id]; save(); drawResults(); drawGrid(); } });
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
        if (!list.length) empty(grid, { icon: "search-x", title: "找不到這個名字", text: "上面的「你是不是在找」會列出最接近的,或換個說法再試。" });
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
