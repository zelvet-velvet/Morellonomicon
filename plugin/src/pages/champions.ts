import type { Champion } from "../data/store";
import { DAMAGE_COLOR, chip, empty, fgrid, group, h, icon, page, row, segmented, roleChip, LANES, laneChip, tip } from "../ui";
import { TAG_GROUPS, championProfile, iconFilter, tagFilter } from "./profile";
import { buildTab } from "./build";
import type { PageCtx, PageOut } from "./index";
import { badgeColor, badgeText, changesBlock, entryDir, marker } from "./changes";
import { metaLine } from "./fresh";
import { skillStrip } from "./skills";

const ROLES = ["戰士", "坦克", "法師", "刺客", "射手", "輔助"];
const DAMAGES = ["物理", "魔法", "混合"];
const REACH = ["近戰", "中程", "遠程"];
const SORTS: [string, string][] = [["name", "名稱"], ["diff", "難度"], ["range", "射程"]];
const SORT_DIR: Record<string, 1 | -1> = { name: 1, diff: 1, range: -1 };   // first direction when a sort is picked: A first, easy first, far first
const DAMAGE_ICON: Record<string, string> = { 物理: "sword", 魔法: "sparkles", 混合: "blend" };
const SEARCH_EXTRA = 8;   // augments / items listed under the champions when the search box has text

// The filters stay as you set them while the app is open, so coming back from a champion card keeps your list.
interface Filter { lanes: Set<string>; roles: Set<string>; dmg: string; feat: Map<string, 1 | -1>; reach: string; sort: string; dir: 1 | -1; open: boolean }
const F: Filter = { lanes: new Set(), roles: new Set(), dmg: "", feat: new Map(), reach: "", sort: "name", dir: 1, open: false };
const activeFilters = () => F.roles.size + (F.dmg ? 1 : 0) + F.feat.size + (F.reach ? 1 : 0);   // the ones inside the 篩選 panel

function matches(c: Champion, lanes: string[]): boolean {
    if (F.lanes.size && !lanes.some((l) => F.lanes.has(l))) return false;
    if (F.roles.size && !c.roles.some((r) => F.roles.has(r))) return false;
    if (F.dmg && c.damageType !== F.dmg) return false;
    for (const [f, want] of F.feat) if (c.features.includes(f) !== (want === 1)) return false;
    return !F.reach || c.archetypes.includes(F.reach);
}

function sorted(list: Champion[]): Champion[] {
    const byName = (a: Champion, b: Champion) => a.name.localeCompare(b.name, "zh-Hant");
    if (F.sort === "diff") return [...list].sort((a, b) => F.dir * (a.difficulty - b.difficulty) || byName(a, b));
    if (F.sort === "range") return [...list].sort((a, b) => F.dir * (a.range - b.range) || byName(a, b));
    return F.dir === 1 ? list : [...list].reverse();   // by name (the list comes sorted by name)
}

// The home screen: a tap-to-pick grid of champions you can narrow down (role, damage, abilities, reach) and sort.
// Typing also finds augments and items.
function championPicker(parent: HTMLElement, ctx: PageCtx): void {
    const store = ctx.plugin.store;
    const all = store.champions();
    if (!all.length) { empty(parent, { icon: "database", title: "No champion notes yet", text: "Run python3 tools/fetch_data.py" }); return; }
    let query = "";
    // champions changed in the latest patch notes get a ▲ / ▼ / ◆ / ● mark on their icon
    const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)] as const));
    // the search box, with the Quick Look button beside it (the tool for the moment the game hands you champions you do not know)
    const searchRow = h(parent, "div", "mn-search-row");
    const box = h(searchRow, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search champions, augments, items";
    search.setAttribute("enterkeyhint", "search");
    const picked = ctx.plugin.settings.roster.filter((id) => store.champion(id)).length;
    const qk = h(searchRow, "button", "mn-qk-btn");
    qk.setAttribute("aria-label", "大混戰速查");
    icon(qk, "scan-search");
    h(qk, "span", "", "速查");
    if (picked) h(qk, "span", "mn-qk-n", String(picked));
    qk.addEventListener("click", (e) => { e.preventDefault(); ctx.push({ key: "roster", title: "速查" }); });
    const filters = h(parent, "div", "mn-fgroup");
    const panel = h(parent, "div", "mn-fpanel");
    const count = h(parent, "div", "mn-count");
    const grid = h(parent, "div", "mn-grid");
    const extra = h(parent, "div");

    const draw = () => {
        grid.empty();
        extra.empty();
        const q = query.trim().toLowerCase();
        const hits = sorted(all.filter((c) => matches(c, store.lanes(c)) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))));
        count.textContent = `${hits.length} / ${all.length}`;
        for (const c of hits) {
            const tile = h(grid, "button", "mn-tile");
            const im = h(tile, "img"); im.src = c.icon; im.loading = "lazy"; im.alt = "";
            const rd = recent.get(c.name);
            if (rd) { const m = marker(rd); const b = h(tile, "span", "mn-tile-b", m.mark); b.style.background = m.color; }
            h(tile, "span", "mn-tile-n", c.name);
            tile.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(c.id); });
        }
        if (!q) return;
        if (!hits.length) empty(grid, { icon: "search-x", title: "No champion" });
        const augs = ctx.plugin.settings.mode === "mayhem" ? store.augments().filter((a) => a.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA) : [];
        if (augs.length) {
            const g = group(extra, "Augments");
            for (const a of augs) row(g, { image: a.icon, rarity: a.rarity, title: a.name, value: a.rarity, chevron: true, onTap: () => ctx.openAugment(a.id) });
        }
        const items = store.modeItems().filter((i) => i.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA);
        if (items.length) {
            const g = group(extra, "Items");
            for (const i of items) row(g, { image: i.icon, title: i.name, sub: i.desc || undefined, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openItem(i.id) });
        }
    };
    const redraw = () => { drawFilters(); drawPanel(); draw(); };
    // always in view: the five lanes and the 篩選 button; everything else is in the folding panel
    const drawFilters = () => {
        filters.empty();
        const row = fgrid(filters, LANES.length + 1);
        const known = store.hasLanes();
        for (const l of LANES) {
            const chipEl = laneChip(row, l, { on: F.lanes.has(l), onTap: () => {
                if (!known) { tip(chipEl, "還沒有分路資料"); return; }
                F.lanes.has(l) ? F.lanes.delete(l) : F.lanes.add(l); redraw();
            } });
        }
        const n = activeFilters();
        const fb = h(row, "button", "mn-filterbtn" + (F.open ? " is-open" : "") + (n ? " has-n" : ""));
        fb.setAttribute("aria-label", "篩選");
        icon(fb, "sliders-horizontal", "mn-filterbtn-ic");
        if (n) h(fb, "span", "mn-filterbtn-n", String(n));
        fb.addEventListener("click", (e) => { e.preventDefault(); F.open = !F.open; drawFilters(); drawPanel(); });
    };
    const drawPanel = () => {
        panel.empty();
        panel.toggleClass("is-open", F.open);
        if (!F.open) return;
        const sect = (title: string, hint = "") => {
            const s = h(panel, "div", "mn-fp-s");
            const head = h(s, "div", "mn-fp-h");
            h(head, "span", "mn-fp-t", title);
            if (hint) h(head, "span", "mn-fp-hint", hint);
            return s;
        };
        // top to bottom: 定位, 技能, 傷害, 攻擊距離, 排序
        const roleSect = sect("定位");
        // clear everything, on the 定位 line (only when something is set)
        if (activeFilters() || F.sort !== "name" || F.dir !== 1) {
            const clear = h(roleSect.querySelector<HTMLElement>(".mn-fp-h") ?? roleSect, "button", "mn-clear", "全部清除");
            clear.addEventListener("click", (e) => { e.preventDefault(); F.roles.clear(); F.dmg = ""; F.feat.clear(); F.reach = ""; F.sort = "name"; F.dir = 1; redraw(); });
        }
        const roleRow = fgrid(roleSect, ROLES.length);
        for (const r of ROLES) roleChip(roleRow, r, { on: F.roles.has(r), onTap: () => { F.roles.has(r) ? F.roles.delete(r) : F.roles.add(r); redraw(); } });
        // the ability tags in their groups: a small label, then the group's icons (tap: must have / any)
        const ab = sect("技能");
        for (const [group, tags] of TAG_GROUPS) {
            const line = h(ab, "div", "mn-fcat");
            h(line, "span", "mn-fcat-l", group);
            for (const f of tags) {
                const on = F.feat.get(f) === 1;
                tagFilter(line, f, on, () => { if (on) F.feat.delete(f); else F.feat.set(f, 1); redraw(); });
            }
        }
        const kindRow = fgrid(sect("傷害類型"), DAMAGES.length);   // three icons spread across the width
        for (const d of DAMAGES) iconFilter(kindRow, d, DAMAGE_ICON[d], DAMAGE_COLOR[d], F.dmg === d, () => { F.dmg = F.dmg === d ? "" : d; redraw(); });
        segmented(sect("攻擊距離"), [["", "全部"], ...REACH.map((r): [string, string] => [r, r])], F.reach, (id) => { F.reach = id; redraw(); }, "is-sm");
        // sort: tapping the chosen one again flips its direction (the arrow shows which way)
        const arrow = (id: string) => (F.sort !== id ? "" : F.dir === 1 ? " ↑" : " ↓");   // only the chosen one shows its direction
        segmented(sect("排序"), SORTS.map(([id, l]): [string, string] => [id, l + arrow(id)]), F.sort, (id) => {
            if (id === F.sort) F.dir = F.dir === 1 ? -1 : 1;
            else { F.sort = id; F.dir = SORT_DIR[id] ?? 1; }
            redraw();
        }, "is-sm");
    };
    // only the results are redrawn while typing, so the keyboard stays open
    search.addEventListener("input", () => { query = search.value; draw(); });
    redraw();
}

export function championsPage(ctx: PageCtx): PageOut {
    if (ctx.frame.key === "champion") return championCard(ctx);
    const el = page("Champions");
    championPicker(el, ctx);
    return { title: "Champions", el };
}

export type SubTab = "skills" | "build" | "augments" | "tips";
const lastSub = new Map<string, SubTab>();
export function rememberSub(id: string, sub: SubTab): void { lastSub.set(id, sub); }   // the sub-tab you were on, per champion, while the app is open

// The champion card: a banner and radar always on top, then sub-tabs. Everything glanceable, no paragraphs.
export function championCard(ctx: PageCtx): PageOut {
    const c = ctx.plugin.store.champion(String(ctx.frame.params?.id ?? ""));
    const el = h(null, "div", "mn-page");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }

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
    if (c.tier) chip(tags, `評價 ${c.tier}`, { color: "var(--color-green)" });   // optional, hand-written `tier` in the champion note
    const now = ctx.plugin.store.currentChanges(c.id);
    const openChanges = () => { show("skills"); block?.open(); block?.el.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const official = ctx.plugin.store.officialFor("champions", c.name)[0];
    if (badgeText(now)) chip(tags, badgeText(now), { color: badgeColor(now), onTap: openChanges });
    else if (official) { const m = marker(entryDir(official.entry)); chip(tags, `${m.mark} ${official.patch}`, { color: m.color, onTap: openChanges }); }

    // what the champion can do at a glance: reach, damage kind, difficulty, a six-axis profile and its abilities (see profile.ts)
    championProfile(el, c, ctx.app);

    const mayhem = ctx.plugin.settings.mode === "mayhem";
    const tabs: [SubTab, string][] = [["skills", "Skills"], ["build", "Build"], ["augments", mayhem ? "Augments" : "Runes"], ["tips", "Tips"]];
    let block: { el: HTMLElement; open(): void } | null = null;   // the Recent changes block of the Skills sub-tab
    const seg = h(el, "div", "mn-seg mn-seg-line");
    const body = h(el, "div", "mn-sub");
    const show = (t: SubTab) => {
        lastSub.set(c.id, t);
        seg.querySelectorAll<HTMLElement>(".mn-seg-b").forEach((b) => b.toggleClass("is-on", b.dataset.t === t));
        body.empty();
        if (t === "skills") block = skills(body, c, ctx);
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
    return { title: "", el };   // the name is in the banner; no second copy in the top bar
}

function skills(body: HTMLElement, c: Champion, ctx: PageCtx): { el: HTMLElement; open(): void } | null {
    skillStrip(body, c, ctx.plugin.store.currentChanges(c.id));
    if (c.video) row(group(body), { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video!)}`) });
    return changesBlock(body, c, ctx);
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
        metaLine(main, t, ctx.plugin.store.currentPatch());
        if (t.video) {
            const v = h(main, "button", "mn-tip-v", "▶ Video");
            v.addEventListener("click", (e) => { e.preventDefault(); window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(t.video)}`); });
        }
    }
}
