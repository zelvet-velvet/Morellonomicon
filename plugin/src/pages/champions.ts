import type { Champion } from "../data/store";
import { MODES } from "../modes";
import { DAMAGE_COLOR, chip, empty, group, h, icon, page, radar, row } from "../ui";
import { buildTab } from "./build";
import type { PageCtx, PageOut } from "./index";
import { skillStrip } from "./skills";

const ROLES = ["戰士", "坦克", "法師", "刺客", "射手", "輔助"];
const DAMAGES = ["物理", "魔法", "混合"];
const FEATURES = ["控場", "治療", "護盾", "位移"];   // tap once = must have, twice = must not have
const REACH = ["近戰", "中程", "遠程"];
const SORTS: [string, string][] = [["name", "名稱"], ["easy", "簡單優先"], ["range", "射程遠優先"]];
const SEARCH_EXTRA = 8;   // augments / items listed under the champions when the search box has text

// The filters stay as you set them while the app is open, so coming back from a champion card keeps your list.
interface Filter { roles: Set<string>; dmg: string; feat: Map<string, 1 | -1>; reach: string; sort: string; open: boolean }
const F: Filter = { roles: new Set(), dmg: "", feat: new Map(), reach: "", sort: "name", open: false };
const activeFilters = () => F.roles.size + (F.dmg ? 1 : 0) + F.feat.size + (F.reach ? 1 : 0);

function matches(c: Champion): boolean {
    if (F.roles.size && !c.roles.some((r) => F.roles.has(r))) return false;
    if (F.dmg && c.damageType !== F.dmg) return false;
    for (const [f, want] of F.feat) if (c.features.includes(f) !== (want === 1)) return false;
    return !F.reach || c.archetypes.includes(F.reach);
}

function sorted(list: Champion[]): Champion[] {
    if (F.sort === "easy") return [...list].sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name, "zh-Hant"));
    if (F.sort === "range") return [...list].sort((a, b) => b.range - a.range || a.name.localeCompare(b.name, "zh-Hant"));
    return list;
}

// The home screen: a tap-to-pick grid of champions you can narrow down (role, damage, abilities, reach) and sort.
// Typing also finds augments and items.
function championPicker(parent: HTMLElement, ctx: PageCtx): void {
    const store = ctx.plugin.store;
    const all = store.champions();
    if (!all.length) { empty(parent, { icon: "database", title: "No champion notes yet", text: "Run python3 tools/fetch_data.py" }); return; }
    let query = "";
    const box = h(parent, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search champions, augments, items";
    search.setAttribute("enterkeyhint", "search");
    const filters = h(parent, "div", "mn-chips");
    const panel = h(parent, "div", "mn-fpanel");
    const count = h(parent, "div", "mn-count");
    const grid = h(parent, "div", "mn-grid");
    const extra = h(parent, "div");

    const draw = () => {
        grid.empty();
        extra.empty();
        const q = query.trim().toLowerCase();
        const hits = sorted(all.filter((c) => matches(c) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))));
        count.textContent = `${hits.length} / ${all.length}`;
        for (const c of hits) {
            const tile = h(grid, "button", "mn-tile");
            const im = h(tile, "img"); im.src = c.icon; im.loading = "lazy"; im.alt = "";
            h(tile, "span", "mn-tile-n", c.name);
            tile.addEventListener("click", (e) => { e.preventDefault(); ctx.push({ key: "champion", title: c.name, params: { id: c.id } }); });
        }
        if (!q) return;
        if (!hits.length) empty(grid, { icon: "search-x", title: "No champion" });
        const augs = ctx.plugin.settings.mode === "mayhem" ? store.augments().filter((a) => a.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA) : [];
        if (augs.length) {
            const g = group(extra, "Augments");
            for (const a of augs) row(g, { image: a.icon, title: a.name, value: a.rarity, chevron: true, onTap: () => ctx.openNote(a.path) });
        }
        const items = store.modeItems().filter((i) => i.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA);
        if (items.length) {
            const g = group(extra, "Items");
            for (const i of items) row(g, { image: i.icon, title: i.name, sub: i.desc || undefined, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openNote(i.path) });
        }
    };
    const redraw = () => { drawFilters(); drawPanel(); draw(); };
    const drawFilters = () => {
        filters.empty();
        for (const r of ROLES) chip(filters, r, { on: F.roles.has(r), onTap: () => { F.roles.has(r) ? F.roles.delete(r) : F.roles.add(r); redraw(); } });
        for (const d of DAMAGES) chip(filters, d, { on: F.dmg === d, color: DAMAGE_COLOR[d], onTap: () => { F.dmg = F.dmg === d ? "" : d; redraw(); } });
        const n = activeFilters();
        chip(filters, F.open ? "More ▲" : n ? `More (${n}) ▼` : "More ▼", { on: F.open, onTap: () => { F.open = !F.open; drawFilters(); drawPanel(); } });
        if (n || F.sort !== "name") chip(filters, "Clear", { color: "var(--color-red)", onTap: () => { F.roles.clear(); F.dmg = ""; F.feat.clear(); F.reach = ""; F.sort = "name"; redraw(); } });
    };
    const drawPanel = () => {
        panel.empty();
        panel.toggleClass("is-open", F.open);
        if (!F.open) return;
        const sect = (title: string) => { h(panel, "div", "mn-fp-t", title); return h(panel, "div", "mn-chips"); };
        const ab = sect("技能(點一下=要有,再點=不要有)");
        for (const f of FEATURES) {
            const st = F.feat.get(f);
            chip(ab, (st === 1 ? "✓ " : st === -1 ? "✕ " : "") + f, {
                on: st !== undefined, color: st === -1 ? "var(--color-red)" : undefined,
                onTap: () => { if (st === undefined) F.feat.set(f, 1); else if (st === 1) F.feat.set(f, -1); else F.feat.delete(f); redraw(); },
            });
        }
        const rg = sect("距離");
        for (const r of REACH) chip(rg, r, { on: F.reach === r, onTap: () => { F.reach = F.reach === r ? "" : r; redraw(); } });
        const so = sect("排序");
        for (const [id, label] of SORTS) chip(so, label, { on: F.sort === id, onTap: () => { F.sort = id; redraw(); } });
    };
    // only the results are redrawn while typing, so the keyboard stays open
    search.addEventListener("input", () => { query = search.value; draw(); });
    redraw();
}

export function championsPage(ctx: PageCtx): PageOut {
    if (ctx.frame.key === "champion") return championCard(ctx);
    const mode = MODES[ctx.plugin.settings.mode];
    const el = page("Champions");
    chip(h(el, "div", "mn-chips mn-chips-top"), mode.label, { color: "var(--interactive-accent)" });
    championPicker(el, ctx);
    return { title: "Champions", el };
}

export type SubTab = "skills" | "build" | "augments" | "tips";
const lastSub = new Map<string, SubTab>();
export function rememberSub(id: string, sub: SubTab): void { lastSub.set(id, sub); }   // the sub-tab you were on, per champion, while the app is open

// The champion card: a banner and radar always on top, then sub-tabs. Everything glanceable, no paragraphs.
function championCard(ctx: PageCtx): PageOut {
    const c = ctx.plugin.store.champion(String(ctx.frame.params?.id ?? ""));
    const el = h(null, "div", "mn-page");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }

    const dmgColor = DAMAGE_COLOR[c.damageType] ?? "var(--interactive-accent)";
    const hero = h(el, "div", "mn-hero");
    const bg = h(hero, "div", "mn-hero-bg");
    bg.style.backgroundImage = `url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg")`;
    const head = h(hero, "div", "mn-card-head");
    const im = h(head, "img", "mn-card-img"); im.src = c.icon; im.alt = "";
    const who = h(head, "div", "mn-card-who");
    h(who, "h1", "mn-title", c.name);
    h(who, "div", "mn-card-sub", c.title);
    const tags = h(who, "div", "mn-chips");
    for (const r of c.roles) chip(tags, r);
    chip(tags, c.damageType, { color: dmgColor });

    // 射程 is derived from the attack range (650 = full); the other four are Riot's own 1-10 ratings
    const panel = h(el, "div", "mn-panel");
    radar(panel, [
        { label: "物理", value: c.attack }, { label: "魔法", value: c.magic }, { label: "防禦", value: c.defense },
        { label: "射程", value: Math.min(10, Math.round(c.range / 65)) }, { label: "難度", value: c.difficulty },
    ], 10, dmgColor);

    const mayhem = ctx.plugin.settings.mode === "mayhem";
    const tabs: [SubTab, string][] = [["skills", "Skills"], ["build", "Build"], ["augments", mayhem ? "Augments" : "Runes"], ["tips", "Tips"]];
    const seg = h(el, "div", "mn-seg");
    const body = h(el, "div", "mn-sub");
    const show = (t: SubTab) => {
        lastSub.set(c.id, t);
        seg.querySelectorAll<HTMLElement>(".mn-seg-b").forEach((b) => b.toggleClass("is-on", b.dataset.t === t));
        body.empty();
        if (t === "skills") skills(body, c, ctx);
        else if (t === "build") buildTab(body, c, ctx);
        else if (t === "augments") soon(body, mayhem ? "Best augments" : "Runes");
        else tips(body, c, ctx);
    };
    for (const [t, label] of tabs) {
        const b = h(seg, "button", "mn-seg-b", label);
        b.dataset.t = t;
        b.addEventListener("click", (e) => { e.preventDefault(); show(t); });
    }
    show(lastSub.get(c.id) ?? "skills");
    return { title: c.name, el };
}

function skills(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    skillStrip(body, c);
    if (c.video) row(group(body), { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video!)}`) });
    void ctx;
}

function soon(body: HTMLElement, title: string): void {
    row(group(body), { icon: "sparkles", title, value: "Soon", muted: true });
}

// Short cards for hidden tricks and interactions (frontmatter `tips`, written by hand).
function tips(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    void ctx;
    if (!c.tips.length) { empty(body, { icon: "lightbulb", title: "No tips yet", text: "Add tips to this champion's note." }); return; }
    for (const t of c.tips) {
        const card = h(body, "div", "mn-tip");
        icon(card, "lightbulb", "mn-tip-ic");
        const main = h(card, "div", "mn-tip-main");
        h(main, "div", "mn-tip-t", t.title);
        h(main, "div", "mn-tip-s", t.text);
        if (t.video) {
            const v = h(main, "button", "mn-tip-v", "▶ Video");
            v.addEventListener("click", (e) => { e.preventDefault(); window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(t.video)}`); });
        }
    }
}
