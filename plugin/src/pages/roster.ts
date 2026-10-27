import { Notice } from "obsidian";
import type { Champion } from "../data/store";
import { findSaid, type Said, type Sounds, soundScore } from "../data/sound";
import { chip, empty, fgrid, h, holdTip, icon, page, roleChip } from "../ui";
import { entryDir, marker } from "./changes";
import type { PageCtx, PageOut } from "./index";
import { factsStrip, tagRow } from "./profile";

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
    if (name.includes(q)) return 80;
    if (id.includes(q)) return q.length >= 4 ? 80 : 40;   // three letters inside an English name are too common ("ari" in darius)
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

// English typed by ear: spellings that sound alike become the same (aphelios / afelios, katarina / catarina, yasuo / yasou),
// double letters count once, and anything but letters is dropped (Kai'Sa, Lee Sin)
export function enKey(s: string): string {
    return s.toLowerCase().replace(/[^a-z]/g, "")
        .replace(/ph/g, "f").replace(/ck/g, "k").replace(/ch/g, "1").replace(/c/g, "k").replace(/q/g, "k").replace(/x/g, "ks").replace(/z/g, "s")
        .replace(/ee|ea|ie/g, "i").replace(/oo|ou/g, "u").replace(/y/g, "i").replace(/(.)\1+/g, "$1");
}

// Edits between two words, a swap of two neighbours counting as one (yasou / yasuo)
function edits(a: string, b: string): number {
    const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
}

// How well an English word matches a champion's English name by ear. 0 = no match.
export function enScore(c: Champion, raw: string): number {
    const q = enKey(raw), name = enKey(c.id);
    if (q.length < 3 || !name) return 0;
    if (q === name) return 88;
    if (name.startsWith(q)) return 84;
    const allowed = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
    const whole = edits(q, name);
    if (whole <= allowed) return 60 - 4 * whole;
    if (q.length >= 4 && q.length < name.length && edits(q, name.slice(0, q.length)) <= 1) return 52;   // the start, with a slip
    return 0;
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

// Finding a champion from what was typed or said: by text first; when that is weak, by sound (speech to text hears the
// name and writes other characters). `within` finds several names said in one breath.
export function finder(all: Champion[], sounds: Sounds | null) {
    const heard = new Map<string, { name: [Said, Said]; title: [Said, Said] }>();
    const heardOf = (c: Champion) => {
        let x = heard.get(c.id);
        if (!x && sounds) heard.set(c.id, x = { name: [sounds.said(c.name), sounds.said(c.name, true)], title: [sounds.said(c.title), sounds.said(c.title, true)] });
        return x!;
    };
    const score = (c: Champion, t: string): number => {
        const s = Math.max(matchScore(c, t), enScore(c, t));
        if (s >= 80 || !sounds) return s;
        const q: [Said, Said] = [sounds.said(t, false, true), sounds.said(t, true, true)];
        if (!q[0].length) return s;
        const x = heardOf(c);
        const byName = Math.max(soundScore(q[0], x.name[0], false), soundScore(q[1], x.name[1], true));
        const byTitle = Math.max(soundScore(q[0], x.title[0], false), soundScore(q[1], x.title[1], true));
        return Math.max(s, byName, byTitle >= 64 ? byTitle - 20 : 0);
    };
    // several names said in one breath ("阿璃卡特蓮娜"): the champions whose whole name is heard inside it, longest first, in order
    const within = (t: string): Champion[] => {
        if (!sounds) return [];
        const han = [...t].filter((ch) => /\p{Script=Han}/u.test(ch));
        const q: [Said, Said] = [sounds.said(t, false, true), sounds.said(t, true, true)];
        if (q[0].length < 3) return [];
        const hits: { c: Champion; at: number; len: number; near: number }[] = [];
        for (const c of all) {
            const x = heardOf(c);
            if (x.name[0].length < 2 || x.name[0].length >= q[0].length) continue;
            for (const near of [0, 1]) { const at = findSaid(q[near], x.name[near]); if (at >= 0) { hits.push({ c, at, len: x.name[0].length, near }); break; } }
        }
        hits.sort((a, b) => b.len - a.len || a.near - b.near || a.at - b.at);
        const used = new Set<number>(), out: { c: Champion; at: number }[] = [];
        const take = (c: Champion, at: number, len: number) => { for (let i = at; i < at + len; i++) used.add(i); out.push({ c, at }); };
        for (const h_ of hits) {
            if (out.some((o) => o.c.id === h_.c.id)) continue;
            if (Array.from({ length: h_.len }, (_, i) => h_.at + i).some((i) => used.has(i))) continue;
            take(h_.c, h_.at, h_.len);
        }
        // what is left between them may be one more name: misheard by a character, or a one-character name said exactly (汎, 劫)
        if (out.length) {
            for (let i = 0; i < han.length;) {
                if (used.has(i)) { i++; continue; }
                let j = i;
                while (j < han.length && !used.has(j)) j++;
                const part = han.slice(i, j).join("");
                const best = all.map((c) => ({ c, s: score(c, part) })).sort((a, b) => b.s - a.s)[0];
                if (best && best.s >= (j - i >= 2 ? 50 : 78) && !out.some((o) => o.c.id === best.c.id)) take(best.c, i, j - i);
                i = j;
            }
        }
        return out.sort((a, b) => a.at - b.at).map((x) => x.c);
    };
    return { score, within };
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

    const { score, within } = finder(all, store.sounds);

    // finding first: the search box, then the class icons, then faces (like the game's pick screen). Once champions are
    // picked their cards take the page, and the faces come back as soon as something is typed or a class is chosen.
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "輸入英雄名字,或按鍵盤上的 🎤 說出來";
    search.setAttribute("enterkeyhint", "search");
    const suggest = h(el, "div", "mn-chips mn-rq-sugg");
    const roles = fgrid(el, ROLES.length);
    roles.addClass("mn-rq-roles-f");
    const grid = h(el, "div", "mn-faces");
    const results = h(el, "div", "mn-rq-results");

    const toggle = (id: string) => {
        if (picks.includes(id)) picks = picks.filter((p) => p !== id);
        else if (picks.length >= MAX_PICKS) { new Notice(`最多選 ${MAX_PICKS} 位`); return; }
        else picks = [...picks, id];
        save();
        drawResults();
        drawGrid();
    };
    // a face tapped while searching: add it, empty the box and keep the keyboard up for the next name
    const pickFromSearch = (id: string) => {
        const adding = !picks.includes(id);
        toggle(id);
        if (adding && query) { search.value = ""; query = ""; drawSuggest(); drawGrid(); search.focus(); }
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
        const roles = h(r, "div", "mn-rq-roles");
        for (const role_ of c.roles) h(roles, "span", "mn-rq-role", role_);
        const rd = recent.get(c.name);
        if (rd) { const m = marker(rd); const b = h(roles, "span", "mn-rq-role mn-rq-mark", `${m.mark} 本版調整`); b.style.setProperty("--m", m.color); }
        factsStrip(r, c);
        tagRow(r, c, undefined, true);   // only the abilities it has
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
            const ranked = all.map((c) => ({ c, s: score(c, t) })).sort((a, b) => b.s - a.s);
            if (ranked[0] && ranked[0].s >= 70) return { list: [ranked[0].c], exact: true };
            const many = within(t);
            if (many.length >= 2) return { list: many, exact: true };
            if (ranked[0] && ranked[0].s >= 50) return { list: [ranked[0].c], exact: true };
            const near = ranked.filter((x) => x.s > 0).slice(0, 3).map((x) => x.c);
            return { list: near.length ? near : closest(all, t, 3), exact: false };
        };
        const found = tokens.map(best);
        const unique = [...new Map(found.flatMap((f) => f.list).map((c) => [c.id, c])).values()];
        if (!unique.length) return;
        const guessed = found.some((f) => !f.exact && f.list.length);
        // a single word that already matches well needs no suggestion row: the grid shows it
        if (tokens.length === 1 && !guessed) return;
        if (guessed) h(suggest, "span", "mn-dym", "你是不是在找:");
        for (const c of unique) chip(suggest, `${picks.includes(c.id) ? "✓ " : "+ "}${c.name}`, { color: "var(--color-green)", onTap: () => pickFromSearch(c.id) });
        if (unique.length > 1) chip(suggest, "全部加入", { on: true, onTap: () => { for (const c of unique) if (!picks.includes(c.id) && picks.length < MAX_PICKS) picks = [...picks, c.id]; save(); search.value = ""; query = ""; drawSuggest(); drawResults(); drawGrid(); } });
    };

    const drawGrid = () => {
        grid.empty();
        const tokens = query.split(SPLIT).filter(Boolean);
        const finding = tokens.length > 0 || !!role || !picks.length;
        grid.toggleClass("is-hidden", !finding);
        results.toggleClass("is-hidden", finding && (tokens.length > 0 || !!role));
        if (!finding) return;
        let list = all.filter((c) => !role || c.roles.includes(role));
        if (tokens.length) {
            const said = new Set(tokens.filter((t) => !all.some((c) => score(c, t) >= 70)).flatMap((t) => within(t)).map((c) => c.id));
            const scored = list.map((c) => ({ c, s: Math.max(said.has(c.id) ? 75 : 0, ...tokens.map((t) => score(c, t))) })).filter((x) => x.s > 0);
            scored.sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name, "zh-Hant"));
            list = scored.map((x) => x.c);
        }
        grid.toggleClass("is-named", tokens.length > 0);   // a few matches: names under the faces; the whole roster: faces only
        for (const c of list) {
            const on = picks.includes(c.id);
            const t = h(grid, "button", "mn-face" + (on ? " is-pick" : ""));
            const im = h(t, "img"); im.src = c.icon; im.alt = c.name; im.loading = "lazy";
            if (on) icon(h(t, "span", "mn-pick-ok"), "check");
            h(t, "span", "mn-face-n", c.name);
            holdTip(t, c.name);
            t.addEventListener("click", (e) => { e.preventDefault(); pickFromSearch(c.id); });
        }
        if (!list.length) empty(grid, { icon: "search-x", title: "找不到這個名字", text: "換個說法再試,或看上面的「你是不是在找」。" });
    };

    const drawRoles = () => {
        roles.empty();
        for (const r of ROLES) roleChip(roles, r, { on: role === r, onTap: () => { role = role === r ? "" : r; drawRoles(); drawGrid(); } });
    };

    search.addEventListener("input", () => { query = search.value; drawSuggest(); drawGrid(); });
    drawResults();
    drawRoles();
    drawGrid();
    return { title: "速查", el };
}
