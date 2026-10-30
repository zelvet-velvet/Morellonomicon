import type { Champion } from "../data/store";
import { DAMAGE_COLOR, DAMAGE_ICON, augIcon, warmPictures, blockUntil, layoutBlock, chip, empty, fgrid, group, h, icon, page, row, segmented, roleChip, LANES, laneChip, slideSeg, tip, fixedPage } from "../ui";
import { TAG_GROUPS, championProfile, factsStrip, iconFilter, tagFilter, tagRow } from "./profile";
import { buildTab } from "./build";
import type { PageCtx, PageOut } from "./index";
import { badgeColor, badgeText, changesBlock, entryDir, marker } from "./changes";
import { metaLine } from "./fresh";
import { skillStrip } from "./skills";
import { PICKS_SHOWN, augmentPicks, augmentTiles } from "./detail";

const ROLES = ["戰士", "坦克", "法師", "刺客", "射手", "輔助"];
const DAMAGES = ["物理", "魔法", "混合"];
const REACH = ["近戰", "中程", "遠程"];
const SORTS: [string, string][] = [["name", "名稱"], ["diff", "難度"], ["range", "射程"]];
const SORT_DIR: Record<string, 1 | -1> = { name: 1, diff: 1, range: -1 };   // first direction when a sort is picked: A first, easy first, far first
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
    // the lane row on top, the grid, and at the bottom (where the thumb is, like Picks) one floating capsule: search, a mic and the
    // 篩選 button; the filters open as a sheet right above the capsule
    const filtersHost = layoutBlock(h(parent, "div"));   // the lane row loads as a block of its own
    const filters = h(filtersHost, "div", "mn-fgroup");
    const count = h(parent, "div", "mn-count");
    const list = h(parent, "div", "mn-rq-list");   // the part that scrolls
    const gridHost = layoutBlock(h(list, "div"));      // so does the grid of champion icons
    const grid = h(gridHost, "div", "mn-grid");
    const extra = layoutBlock(h(list, "div"));   // and the augment / item results while searching
    const dock = h(parent, "div", "mn-rq-dock");
    const panel = h(dock, "div", "mn-fpanel mn-fsheet");
    const cap = h(dock, "div", "mn-rq-cap");
    icon(cap, "search", "mn-rq-cap-ic");
    const search = h(cap, "input");
    search.type = "search";
    search.placeholder = "搜尋英雄、強化、裝備";
    search.setAttribute("enterkeyhint", "search");
    const mic = h(cap, "button", "mn-rq-mic");   // opens the keyboard on the box; its own mic key listens
    icon(mic, "mic");
    mic.setAttribute("aria-label", "用鍵盤的麥克風說");
    mic.addEventListener("click", (e) => { e.preventDefault(); search.focus(); });
    const fbHost = h(cap, "div", "mn-cap-fb");

    const draw = () => {
        grid.empty();
        extra.empty();
        const q = query.trim().toLowerCase();
        const hits = sorted(all.filter((c) => matches(c, store.lanes(c)) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))));
        count.textContent = `${hits.length} / ${all.length}`;
        for (const c of hits) {
            const tile = h(grid, "button", "mn-tile");
            const im = h(tile, "img"); im.src = c.icon; im.alt = "";
            const rd = recent.get(c.name);
            if (rd) { const m = marker(rd); const b = h(tile, "span", "mn-tile-b", m.mark); b.style.background = m.color; }
            const ms = store.masteryOf(c.id);
            if (ms && ms.level > 0) h(tile, "span", "mn-tile-m" + (ms.level >= 10 ? " is-high" : ""), String(ms.level));   // your mastery level on the icon
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
        // one slim bar like the Items page's role tabs: how many champions show at the left, the five lanes at the right (like Picks)
        const row = h(filters, "div", "mn-lanebar");
        const known = store.hasLanes();
        for (const l of LANES) {
            const chipEl = laneChip(row, l, { on: F.lanes.has(l), onTap: () => {
                if (!known) { tip(chipEl, "還沒有分路資料"); return; }
                // one lane at a time, like Picks: another lane replaces it, the same lane again clears it
                const was = F.lanes.has(l); F.lanes.clear(); if (!was) F.lanes.add(l); redraw();
            } });
        }
        const n = activeFilters();
        row.prepend(count);
        fbHost.empty();
        const fb = h(fbHost, "button", "mn-filterbtn" + (F.open ? " is-open" : "") + (n ? " has-n" : ""));
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
    fixedPage(el, ctx.component);   // the lane bar stays on top, only the champions scroll, the search capsule under them
    championPicker(el, ctx);
    return { title: "Champions", el, ready: null };   // the page shows at once; its blocks load on their own
}

export type SubTab = "overview" | "skills" | "build" | "augments" | "tips";
const lastSub = new Map<string, SubTab>();
export function rememberSub(id: string, sub: SubTab): void { lastSub.set(id, sub); }   // the page a link asks the champion card to open on

// The champion page (layout A, chosen 2026-10-30): the splash banner, then one big block that swipes sideways between five pages
// (概覽 · 技能 · 出裝 · 強化 · 技巧) with dots under it; the page never scrolls down. Each page shows only its top picks, centred when
// it has little, and 全部 › opens the full list as a page of its own (championPart).
const PAGES: [Part, string][] = [["overview", "概覽"], ["skills", "技能"], ["build", "出裝"], ["augments", "強化"], ["tips", "技巧"]];
export function championCard(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const c = store.champion(String(ctx.frame.params?.id ?? ""));
    const el = h(null, "div", "mn-page mn-champ");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }
    const mayhem = ctx.plugin.settings.mode === "mayhem";
    const part = (p: Part) => () => ctx.push({ key: "champpart", title: `${c.name} · ${PART_TITLE[p]}`, params: { id: c.id, part: p } });

    // the banner: the splash under the top bar (Back floats on it), the icon, name, title, roles and this patch's change
    const hero = h(el, "div", "mn-hero");
    const bg = h(hero, "div", "mn-hero-bg");
    bg.style.backgroundImage = `url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg")`;
    const head = h(hero, "div", "mn-card-head");
    const im = h(head, "img", "mn-card-img"); im.src = c.icon; im.alt = "";
    // the banner loads as a block of its own: the splash picture (a CSS background, so it is fetched here) and the icon
    const splash = bg.style.backgroundImage.slice(5, -2);
    blockUntil(hero, Promise.all([new Promise<void>((r) => { const x = new Image(); x.onload = x.onerror = () => r(); x.src = splash; }), new Promise<void>((r) => { if (im.complete) r(); else { im.addEventListener("load", () => r(), { once: true }); im.addEventListener("error", () => r(), { once: true }); } })]).then(() => undefined), 200);   // (no loading look when the pictures come from the cache)
    const who = h(head, "div", "mn-card-who");
    h(who, "h1", "mn-title", c.name);
    h(who, "div", "mn-card-sub", c.title);
    const tags = h(who, "div", "mn-chips");
    for (const r of c.roles) chip(tags, r);
    const mastery = store.masteryOf(c.id);   // your own numbers, when this device has _data/mastery.json
    if (mastery && mastery.level > 0) chip(tags, `熟練度 ${mastery.level}`, { color: "var(--color-yellow)" });
    const now = store.currentChanges(c.id);
    const official = store.officialFor("champions", c.name)[0];
    if (badgeText(now)) chip(tags, badgeText(now), { color: badgeColor(now), onTap: part("overview") });
    else if (official) { const m = marker(entryDir(official.entry)); chip(tags, `${m.mark} ${official.patch}`, { color: m.color, onTap: part("overview") }); }

    // the swipe block: one page a screen wide each, snapped into place; native sideways scrolling keeps the swipe smooth
    const pages = PAGES.filter(([p]) => p !== "augments" || mayhem);
    const box = h(el, "div", "mn-cpa");
    const track = h(box, "div", "mn-cpa-track");
    for (const ev of ["touchstart", "touchmove"]) track.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });   // not Obsidian's edge swipes
    for (const [p, name] of pages) {
        const pg = h(track, "section", "mn-cpa-page");
        const body = h(pg, "div", "mn-cpa-body");   // centred when it holds little (Design Rules: balance)
        if (p === "overview") overviewTop(body, c, ctx);
        else if (p === "skills") skillsTop(body, c);
        else if (p === "build") buildTop(body, c, ctx);
        else if (p === "augments") augmentTop(body, c, ctx);
        else tipsTop(body, c);
        const count = p === "skills" ? c.skills.length : p === "augments" ? augmentPicks(store, c).length : p === "tips" ? c.tips.length : p === "build" ? c.builds.filter((x) => x.mode === ctx.plugin.settings.mode).length : 0;
        if (p !== "tips" || c.tips.length) moreLink(pg, part(p), `全部${name}`, count);
    }
    // the dots and the page's name under the block; a dot jumps to its page
    const nav = h(el, "div", "mn-cpa-nav");
    const label = h(nav, "span", "mn-cpa-name");
    const dots = h(nav, "div", "mn-cpa-dots");
    const dotEls = pages.map(([, name], i) => {
        const d = h(dots, "button", "mn-cpa-dot");
        d.setAttribute("aria-label", name);
        d.addEventListener("click", (e) => { e.preventDefault(); go(i, true); });
        return d;
    });
    let cur = -1;
    const mark = (i: number) => { if (i === cur) return; cur = i; dotEls.forEach((d, k) => d.toggleClass("is-on", k === i)); label.setText(pages[i]?.[1] ?? ""); };
    const go = (i: number, smooth: boolean) => { track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? "smooth" : ("instant" as ScrollBehavior) }); mark(i); };
    track.addEventListener("scroll", () => mark(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), { passive: true });
    // a link may ask for a page (once: the next visit starts on 概覽 again)
    const startSub = lastSub.get(c.id);
    lastSub.delete(c.id);
    const start = Math.max(0, pages.findIndex(([p]) => p === startSub));
    // the block fills the screen between the banner and the dots, down to the tab bar: nothing below it to scroll to
    const fit = () => {
        const scroll = el.closest<HTMLElement>(".mn-scroll");
        if (!scroll || !box.isConnected) return;
        const top = box.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
        box.style.height = `${Math.max(320, scroll.clientHeight - top - nav.offsetHeight - CPA_BELOW)}px`;
        go(start, false);
    };
    requestAnimationFrame(fit);
    mark(start);
    return { title: "", el, ready: null };   // the name is in the banner; the blocks load on their own
}
const CPA_BELOW = 12;   // px between the dots and the tab bar

// 全部 at the foot of a page: a bar across it (a list icon, 全部技能, how many, a round arrow); the full list as a page of its own
function moreLink(parent: HTMLElement, go: () => void, label: string, count?: number): void {
    const b = h(parent, "button", "mn-cpa-more");
    icon(b, "layout-list", "mn-cpa-more-ic");
    h(b, "span", "mn-cpa-more-l", label);
    if (count) h(b, "span", "mn-cpa-more-n", String(count));
    icon(b, "chevron-right", "mn-cpa-more-go");
    b.addEventListener("click", (e) => { e.preventDefault(); go(); });
}
// 概覽: reach, damage kind and difficulty, and the ability tags it has (the style chart and this patch are behind 全部)
function overviewTop(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    void ctx;
    factsStrip(body, c);
    tagRow(h(body, "div", "mn-cpa-tags"), c, undefined, true);
}
// 技能: the five abilities, one line each (key and picture, name, the ability in plain words, cooldown); the full page has clips and numbers
function skillsTop(body: HTMLElement, c: Champion): void {
    const list = h(body, "div", "mn-cpa-skills");
    for (const s of c.skills) {
        const r = h(list, "div", "mn-cpa-sk");
        const ic = h(r, "div", "mn-cpa-skic");
        ic.style.setProperty("--c", DAMAGE_COLOR[s.damage[0] ?? ""] ?? "var(--mn-line)");
        const pic = h(ic, "img"); pic.src = s.icon; pic.alt = "";
        h(ic, "span", "mn-cpa-key", s.key);
        const t = h(r, "div", "mn-cpa-skt");
        h(t, "b", undefined, s.name);
        h(t, "span", undefined, c.plain[s.key] || s.damage.map((d) => `${d}傷害`).join(" · "));
        const cd = s.rows?.find((x) => x.label.startsWith("冷卻"));
        if (cd) h(r, "span", "mn-cpa-cd", `${cd.vals[cd.vals.length - 1]} 秒`);
    }
}

// The parts behind 全部 ›: the full lists of the old sub-tabs, as pages that scroll
type Part = "overview" | "skills" | "build" | "augments" | "tips";
const PART_TITLE: Record<Part, string> = { overview: "概覽", skills: "技能", build: "出裝", augments: "強化", tips: "技巧" };
const TOP_TIPS = 3;
export function championPart(ctx: PageCtx): PageOut {
    const c = ctx.plugin.store.champion(String(ctx.frame.params?.id ?? ""));
    const p = String(ctx.frame.params?.part ?? "") as Part;
    const el = h(null, "div", "mn-page");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", `${c.name} · ${PART_TITLE[p] ?? ""}`);
    if (p === "overview") overview(el, c, ctx);
    else if (p === "skills") skillStrip(el, c, ctx.plugin.store.currentChanges(c.id), { open: c.skills.findIndex((s) => s.key === "Q"), clipFirst: true, scroll: false });
    else if (p === "build") buildTab(el, c, ctx);
    else if (p === "augments") augmentsTab(el, c, ctx);
    else tips(el, c, ctx);
    return { title: `${c.name} · ${PART_TITLE[p] ?? ""}`, el };
}

// 出裝 on the card: the first build for this mode, its items in buying order
function buildTop(tab: HTMLElement, c: Champion, ctx: PageCtx): void {
    const store = ctx.plugin.store;
    const b = c.builds.find((x) => x.mode === ctx.plugin.settings.mode);
    if (!b) { h(tab, "p", "mn-cpa-empty", "還沒有寫出裝。之後依玩法推薦前三件。"); return; }
    h(tab, "b", "mn-cc-t", b.name);
    const row = h(tab, "div", "mn-cc-items");
    for (const id of b.items.slice(0, 6)) {
        const i = store.item(id);
        if (!i) continue;
        const x = h(row, "button", "mn-cc-item");
        const im = h(x, "img"); im.src = i.icon; im.alt = "";
        h(x, "span", undefined, i.name);
        x.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); ctx.openItem(i.id); });
    }
    if (b.note) h(tab, "p", "mn-cpa-empty", b.note);
}
// 強化 on the page: the champion's best augments (any rarity), as tiles
function augmentTop(tab: HTMLElement, c: Champion, ctx: PageCtx): void {
    const picks = augmentPicks(ctx.plugin.store, c);
    if (!picks.length) { h(tab, "p", "mn-cpa-empty", "還沒有配對到的強化。"); return; }
    augmentTiles(tab, picks.slice(0, PICKS_SHOWN), ctx);
}
// 技巧 on the card: the first tips' titles
function tipsTop(tab: HTMLElement, c: Champion): void {
    if (!c.tips.length) { h(tab, "p", "mn-cpa-empty", "還沒有技巧。寫在 Inbox/技巧，整理後會出現在這裡。"); return; }
    const box = h(tab, "div", "mn-cpa-tips");
    for (const t of c.tips.slice(0, TOP_TIPS)) { const p = h(box, "p", "mn-cpa-tip"); h(p, "b", undefined, t.title); if (t.text) p.append(`：${t.text}`); }
}

// The champion page's swipe pages, for the Handbook card that pictures them (label, icon; the Champion page pages in the Icons note)
export const CHAMPION_TABS = [["概覽", "id-card"], ["技能", "keyboard"], ["出裝", "shopping-bag"], ["強化", "sparkles"], ["技巧", "lightbulb"]] as const;

// Overview: reach, damage kind, difficulty and the style chart, then the combo video and this patch's changes
function overview(body: HTMLElement, c: Champion, ctx: PageCtx): { el: HTMLElement; open(): void } | null {
    championProfile(body, c, ctx.app);
    if (c.video) row(group(body), { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video!)}`) });
    return changesBlock(body, c, ctx);
}

// 全部強化: every augment that suits the champion, best first, as tiles; a note on how they are picked
function augmentsTab(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    const picks = augmentPicks(ctx.plugin.store, c);
    if (!picks.length) { empty(body, { icon: "sparkles", title: "No augments matched yet" }); return; }
    augmentTiles(body, picks, ctx);
    h(body, "div", "mn-gf", "依強化效果和這位英雄的技能挑選：吃魔攻或物攻、普攻型、有護盾或治療、坦克、有位移或控場、用魔力。置頂是你在英雄筆記寫的 pinned。沒有勝率資料（Riot 沒有公開大混戰對戰）。");
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
