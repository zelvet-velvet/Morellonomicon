import type { Champion } from "../data/store";
import { MODES } from "../modes";
import { DAMAGE_COLOR, chip, empty, group, h, icon, page, radar, row } from "../ui";
import type { PageCtx, PageOut } from "./index";

const ROLES = ["戰士", "坦克", "法師", "刺客", "射手", "輔助"];
const DAMAGES = ["物理", "魔法", "混合"];

// A tap-to-pick grid of champion icons (names under the icons). `withFilters` adds role and damage chips.
export function championPicker(parent: HTMLElement, ctx: PageCtx, withFilters: boolean): void {
    const all = ctx.plugin.store.champions();
    if (!all.length) { empty(parent, { icon: "database", title: "No champion notes yet", text: "Run python3 tools/fetch_data.py" }); return; }
    let query = "", role = "", dmg = "";
    const box = h(parent, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search";
    search.setAttribute("enterkeyhint", "search");
    let filters: HTMLElement | null = null;
    if (withFilters) filters = h(parent, "div", "mn-chips");
    const grid = h(parent, "div", "mn-grid");

    const drawGrid = () => {
        grid.empty();
        const q = query.trim().toLowerCase();
        const hits = all.filter((c) => (!role || c.roles.includes(role)) && (!dmg || c.damageType === dmg)
            && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)));
        for (const c of hits) {
            const tile = h(grid, "button", "mn-tile");
            const im = h(tile, "img"); im.src = c.icon; im.loading = "lazy"; im.alt = "";
            h(tile, "span", "mn-tile-n", c.name);
            tile.addEventListener("click", (e) => { e.preventDefault(); ctx.push({ key: "champion", title: c.name, params: { id: c.id } }); });
        }
        if (!hits.length) empty(grid, { icon: "search-x", title: "No match" });
    };
    const drawFilters = () => {
        if (!filters) return;
        filters.empty();
        for (const r of ROLES) chip(filters, r, { on: role === r, onTap: () => { role = role === r ? "" : r; drawFilters(); drawGrid(); } });
        for (const d of DAMAGES) chip(filters, d, { on: dmg === d, color: DAMAGE_COLOR[d], onTap: () => { dmg = dmg === d ? "" : d; drawFilters(); drawGrid(); } });
    };
    // only the grid is redrawn while typing, so the keyboard stays open
    search.addEventListener("input", () => { query = search.value; drawGrid(); });
    drawFilters();
    drawGrid();
}

export function championsPage(ctx: PageCtx): PageOut {
    if (ctx.frame.key === "champion") return championCard(ctx);
    const el = page("Champions");
    championPicker(el, ctx, true);
    return { title: "Champions", el };
}

// The champion "cheat card": everything at a glance, no paragraphs. The full note is one tap away.
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

    skillStrip(el, c);

    if (c.archetypes.length || c.features.length) {
        const tg = h(el, "div", "mn-chips");
        for (const a of c.archetypes) chip(tg, a);
        for (const f of c.features) chip(tg, f, { color: "var(--color-cyan)" });
    }

    // mode-specific block: Mayhem shows augment fit (data comes with the augment notes); Rift will show builds and runes
    const mode = MODES[ctx.plugin.settings.mode];
    const g = group(el, mode.id === "mayhem" ? "Augments" : "Build");
    row(g, { icon: mode.id === "mayhem" ? "sparkles" : "swords", title: mode.id === "mayhem" ? "Best augments" : "Core build", value: "Soon", muted: true });
    const links = group(el);
    row(links, { icon: "file-text", title: "Full note", chevron: true, onTap: () => ctx.openNote(c.path) });
    if (c.video) row(links, { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video!)}`) });
    return { title: c.name, el };
}

// Passive + Q W E R as icons; the frame colour is the damage type of the skill (orange physical, blue magic, yellow true).
// Tap an icon to open its details right below (tap again to close); no new page.
function skillStrip(parent: HTMLElement, c: Champion): void {
    if (!c.skills.length) return;
    const strip = h(parent, "div", "mn-skills");
    const detail = h(parent, "div", "mn-skill-detail");
    let open = -1;
    const boxes = c.skills.map((s, i) => {
        const box = h(strip, "button", "mn-skill-box");
        box.setAttribute("aria-label", `${s.key} ${s.name}`);
        const im = h(box, "img"); im.src = s.icon; im.alt = "";
        box.style.setProperty("--chip", DAMAGE_COLOR[s.damage[0] ?? ""] ?? "var(--background-modifier-border)");
        h(box, "span", "mn-skill-k", s.key);
        box.addEventListener("click", (e) => { e.preventDefault(); show(open === i ? -1 : i); });
        return box;
    });
    const show = (i: number) => {
        open = i;
        boxes.forEach((b, j) => b.toggleClass("is-on", j === i));
        detail.empty();
        detail.toggleClass("is-open", i >= 0);
        if (i < 0) return;
        const s = c.skills[i];
        const head = h(detail, "div", "mn-sd-head");
        h(head, "span", "mn-sd-key", s.key);
        h(head, "span", "mn-sd-name", s.name);
        const types = h(head, "span", "mn-sd-types");
        for (const d of s.damage) chip(types, `${d}傷害`, { color: DAMAGE_COLOR[d] });
        const meta: [string, string][] = [];
        if (s.cd) meta.push(["冷卻", `${s.cd} 秒`]);
        if (s.cost) meta.push(["消耗", s.cost === "0" ? "無" : `${s.cost} ${c.resource}`]);
        if (s.range) meta.push(["射程", s.range === "self" ? "自身" : s.range]);
        if (meta.length) {
            const m = h(detail, "div", "mn-sd-meta");
            for (const [k, v] of meta) { const cell = h(m, "div", "mn-sd-cell"); h(cell, "span", "mn-sd-k", k); h(cell, "span", "mn-sd-v", v); }
        }
        h(detail, "p", "mn-sd-desc", s.desc);
    };
}
