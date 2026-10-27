import type { Champion } from "../data/store";
import { MODES } from "../modes";
import { DAMAGE_COLOR, chip, empty, group, h, icon, page, radar, row } from "../ui";
import { buildTab } from "./build";
import type { PageCtx, PageOut } from "./index";
import { skillStrip } from "./skills";

const ROLES = ["戰士", "坦克", "法師", "刺客", "射手", "輔助"];
const DAMAGES = ["物理", "魔法", "混合"];
const SEARCH_EXTRA = 8;   // augments / items listed under the champions when the search box has text

// The home screen: a tap-to-pick grid of champions with role / damage chips. Typing also finds augments and items.
function championPicker(parent: HTMLElement, ctx: PageCtx): void {
    const store = ctx.plugin.store;
    const all = store.champions();
    if (!all.length) { empty(parent, { icon: "database", title: "No champion notes yet", text: "Run python3 tools/fetch_data.py" }); return; }
    let query = "", role = "", dmg = "";
    const box = h(parent, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search champions, augments, items";
    search.setAttribute("enterkeyhint", "search");
    const filters = h(parent, "div", "mn-chips");
    const grid = h(parent, "div", "mn-grid");
    const extra = h(parent, "div");

    const draw = () => {
        grid.empty();
        extra.empty();
        const q = query.trim().toLowerCase();
        const hits = all.filter((c) => (!role || c.roles.includes(role)) && (!dmg || c.damageType === dmg)
            && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)));
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
    const drawFilters = () => {
        filters.empty();
        for (const r of ROLES) chip(filters, r, { on: role === r, onTap: () => { role = role === r ? "" : r; drawFilters(); draw(); } });
        for (const d of DAMAGES) chip(filters, d, { on: dmg === d, color: DAMAGE_COLOR[d], onTap: () => { dmg = dmg === d ? "" : d; drawFilters(); draw(); } });
    };
    // only the results are redrawn while typing, so the keyboard stays open
    search.addEventListener("input", () => { query = search.value; draw(); });
    drawFilters();
    draw();
}

export function championsPage(ctx: PageCtx): PageOut {
    if (ctx.frame.key === "champion") return championCard(ctx);
    const mode = MODES[ctx.plugin.settings.mode];
    const el = page("Champions");
    chip(h(el, "div", "mn-chips mn-chips-top"), mode.label, { color: "var(--interactive-accent)" });
    championPicker(el, ctx);
    return { title: "Champions", el };
}

type SubTab = "skills" | "build" | "augments" | "tips";
const lastSub = new Map<string, SubTab>();   // the sub-tab you were on, per champion, while the app is open

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
