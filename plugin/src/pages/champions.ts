import type { AugTierStyle, Augment, Champion, Item, Store } from "../data/store";
import { DAMAGE_COLOR, DAMAGE_ICON, augIcon, scalingParts, warmPictures, blockUntil, layoutBlock, chip, empty, fgrid, group, h, icon, moreLink, page, row, segmented, roleChip, LANES, laneChip, slideSeg, textSwitch, tierHead, tip, fixedPage } from "../ui";
import { TAG_GROUPS, damageLines, iconFilter, profileAxes, profileRadar, reachOf, tagFilter, tagRow } from "./profile";
import { buildTab } from "./build";
import { cardArt } from "./roster";
import type { PageCtx, PageOut } from "./index";
import { badgeColor, badgeText, changesBlock, entryDir, marker } from "./changes";
import { metaLine } from "./fresh";
import { skillStrip } from "./skills";
import { PICKS_SHOWN, augmentPicks, augmentTiles, type AugmentPick } from "./detail";

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

// The champion page (v3, Zaviel 2026-10-30, Dev Tools/Layouts.md "Champions · champion page"): the centered splash fills the whole page
// behind it (Back floats on it); the icon, name and chips sit at its foot. Above the name the pages swipe sideways (snapped) with their
// parts floating on the art, no frames and no page titles. 概覽 keeps the art bright with its parts just above the name; tapping the
// chart, the tiles or the tags opens its page of its own (the style chart in full, the combo video, this patch's changes). The other
// pages darken the art and show their whole detail in the page (it scrolls inside the page when long). A small page hint (a dot per
// page, the current one lit) floats at the top middle.
const AXIS_PX = 8;          // a touch's first move this far picks its direction (sideways: the pages; up-down: the page's own scrolling)
const TURN_PART = 0.22;     // a swipe past this part of the width turns the page
const FLICK_PX_MS = 0.35;   // or a quick flick (px per ms)
const EDGE_PULL = 0.3;      // past the first or last page the pages follow the finger this much
const WHEEL_PX = 12, WHEEL_GAP_MS = 450;
const TAP_SIDE = 0.22;      // a tap within this share of the width from a side turns the page that way
const TAP_AFTER_SWIPE_MS = 350;   // a click this soon after a swipe is the swipe's, not a tap   // a trackpad swipe: its least move, and the pause before the next one turns a page
const PAGES: [Part, string, string][] = [["overview", "概覽", "id-card"], ["skills", "技能", "keyboard"], ["build", "出裝", "shopping-bag"], ["augments", "強化", "sparkles"], ["tips", "技巧", "lightbulb"]];
export function championCard(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const c = store.champion(String(ctx.frame.params?.id ?? ""));
    const el = h(null, "div", "mn-page mn-champ is-v3");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }
    fixedPage(el, ctx.component);   // one screen: the page fills the scroll area and does not scroll
    const mayhem = ctx.plugin.settings.mode === "mayhem";
    const part = (p: Part) => () => ctx.push({ key: "champpart", title: `${c.name} · ${PART_TITLE[p]}`, params: { id: c.id, part: p } });
    el.style.setProperty("--dc", DAMAGE_COLOR[c.damageType || c.skillDamage[0] || ""] ?? "var(--mn-accent)");   // the page's tint

    // the art behind the page: Riot's centered splash (the champion in the middle), filling the upper screen edge to edge and fading out
    // under the status bar and at its foot (Design Rules: no hard edges)
    const hero = h(el, "div", "mn-hero");
    const bg = h(hero, "div", "mn-hero-bg");
    bg.style.backgroundImage = `url("${cardArt(c.id)}")`;
    // the icon, name, title and chips over the art
    const head = h(null, "div", "mn-card-head");   // placed at the foot, under the pages (below)
    const im = h(head, "img", "mn-card-img"); im.src = c.icon; im.alt = "";
    // the art card loads as a block of its own: the splash picture (a CSS background, so it is fetched here) and the icon
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

    // the pages: one each, side by side; they follow the finger (below)
    const pages = PAGES.filter(([p]) => p !== "augments" || mayhem);
    const box = h(el, "div", "mn-cpa");
    const track = h(box, "div", "mn-cpa-track");
    let tagLine: HTMLElement | null = null;   // 概覽's tags: under the name, at the very foot
    // every ability's clip loads here ahead, on the screen but too small to see (iOS loads a clip only while it is on the screen)
    const shelf = h(el, "div", "mn-clip-shelf");
    const cards = pages.map(([p]) => {
        const pg = h(track, "section", "mn-cpa-page is-" + p);
        const body = h(pg, "div", "mn-cpa-body");   // 概覽: just above the name; the others: the whole page, scrolling inside when long
        if (p === "overview") tagLine = overviewTop(body, c, part("overview"));
        else if (p === "skills") skillStrip(body, c, now, { open: c.skills.findIndex((s) => s.key === "Q"), clipFirst: true, scroll: false, shelf });
        else if (p === "build") buildTab(body, c, ctx);
        else if (p === "augments") augmentsTop(body, c, ctx, part("augments"));
        else tips(body, c, ctx);
        return pg;
    });
    el.append(head);   // the name at the foot
    if (tagLine) h(el, "div", "mn-cv-foot").append(tagLine);   // the tags under it (only on 概覽, like the name)
    // the page hint at the top middle: a dot per page, the current one lit (a hint only; the pages swipe)
    const hint = h(el, "div", "mn-cpa-hint");
    const dots = pages.map(() => h(hint, "i"));
    let cur = -1;
    const mark = (i: number) => {
        if (i === cur) return;
        cur = i;
        dots.forEach((d, k) => d.toggleClass("is-on", k === i));
        el.toggleClass("is-deep", i > 0);   // past 概覽 the art darkens, so the page's parts can use all of it
    };
    // The pages move with the finger (a transform), not by the browser's own sideways scrolling, which iOS left half way between two
    // pages when a page's own up-down scrolling took the swipe over. A touch picks its direction in its first AXIS_PX: sideways moves
    // the pages and lands on one (past TURN_PART of the width, or a quick flick), up-down is left to the page's own scrolling.
    let pos = 0;
    const place = (px: number, animate: boolean) => {
        track.toggleClass("is-settling", animate);
        track.style.transform = `translateX(calc(${-pos * 100}% + ${px}px))`;
    };
    const go = (i: number, animate = true) => { pos = Math.max(0, Math.min(cards.length - 1, i)); place(0, animate); mark(pos); };
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, axis: "" | "x" | "y" = "";
    track.addEventListener("touchstart", (e) => {
        e.stopPropagation();   // not Obsidian's edge swipes
        const t = e.touches[0];
        x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); dx = 0; axis = "";
    }, { passive: true });
    track.addEventListener("touchmove", (e) => {
        e.stopPropagation();
        const t = e.touches[0];
        const mx = t.clientX - x0, my = t.clientY - y0;
        if (!axis) {
            if (Math.abs(mx) < AXIS_PX && Math.abs(my) < AXIS_PX) return;
            axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        }
        if (axis !== "x") return;
        if (e.cancelable) e.preventDefault();   // no up-down scrolling while the pages move
        const edge = (pos === 0 && mx > 0) || (pos === cards.length - 1 && mx < 0);
        dx = edge ? mx * EDGE_PULL : mx;
        place(dx, false);
    }, { passive: false });
    let swiped = 0;
    const end = () => {
        if (axis !== "x") { axis = ""; return; }
        axis = "";
        swiped = Date.now();
        const w = track.clientWidth || 1;
        const flick = Math.abs(dx) / Math.max(1, Date.now() - t0) > FLICK_PX_MS && Math.abs(dx) > AXIS_PX * 2;
        go(pos + (Math.abs(dx) > w * TURN_PART || flick ? (dx < 0 ? 1 : -1) : 0));
    };
    for (const ev of ["touchend", "touchcancel"]) track.addEventListener(ev, end, { passive: true });
    // a tap on the left or right side of the page (not on something tappable) goes to the page before or after, like stories
    track.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea, video, img, .mn-tsw, .mn-skills, .mn-items")) return;
        if (Date.now() - swiped < TAP_AFTER_SWIPE_MS) return;   // the click a finished swipe may still send
        const r = box.getBoundingClientRect();   // the window the pages show in (the track itself is moved)
        const at = (e.clientX - r.left) / (r.width || 1);
        if (at < TAP_SIDE) go(pos - 1);
        else if (at > 1 - TAP_SIDE) go(pos + 1);
    });
    // a trackpad's sideways swipe on a computer: one page per swipe
    let wheelAt = 0;
    track.addEventListener("wheel", (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < WHEEL_PX) return;
        e.preventDefault();
        if (Date.now() - wheelAt < WHEEL_GAP_MS) return;
        wheelAt = Date.now();
        go(pos + (e.deltaX > 0 ? 1 : -1));
    }, { passive: false });
    // a link may ask for a page (once: the next visit starts on 概覽 again)
    const startSub = lastSub.get(c.id);
    lastSub.delete(c.id);
    const start = Math.max(0, pages.findIndex(([p]) => p === startSub));
    go(start, false);
    return { title: "", el, ready: null };   // the name is over the art; the blocks load on their own
}

const DIFF_STEPS = 10;
const TAGS_SHOWN = 4;
// 概覽: the style chart beside three stat tiles (damage kind, reach, difficulty as a 10-step bar), then its ability tags two across
function overviewTop(body: HTMLElement, c: Champion, more: () => void): HTMLElement {
    // the style chart (radar) on the left, the three stat tiles stacked on its right, the tags under them
    const row = h(body, "div", "mn-cv-look");
    profileRadar(h(row, "div", "mn-cv-radar"), profileAxes(c), DAMAGE_COLOR[c.damageType || c.skillDamage[0] || ""] ?? "var(--mn-accent)");
    statTiles(row, c);
    const t = tagRow(body, c, undefined, true);
    t.addClass("mn-cv-tags");
    Array.from(t.children).slice(TAGS_SHOWN).forEach((x) => x.remove());
    for (const x of [row, t]) x.addEventListener("click", (e) => { e.preventDefault(); more(); });   // the chart, the tiles and the tags open the page of its own
    return t;   // placed under the name by the caller
}
// the three stats: damage kind, reach, difficulty (a 10-step bar); each an icon, a value and what it is
function statTiles(parent: HTMLElement, c: Champion): HTMLElement {
    const tiles = h(parent, "div", "mn-cv-stats");
    const tile = (iconName: string, color: string, big: string, small: string) => {
        const t = h(tiles, "div", "mn-cv-stat");
        t.style.setProperty("--c", color);
        icon(t, iconName, "mn-cv-sic");
        h(t, "b", undefined, big);
        h(t, "span", undefined, small);
        return t;
    };
    const main = c.damageType || c.skillDamage[0] || "";
    if (main) tile(DAMAGE_ICON[main] ?? "flame", DAMAGE_COLOR[main] ?? "var(--mn-muted)", main === "物理" ? "物攻" : main === "魔法" ? "魔攻" : main, "傷害");
    const reach = reachOf(c) || (c.range >= 550 ? "遠程" : c.range >= 300 ? "中程" : "近戰");
    tile("ruler", "var(--mn-dash)", reach, c.range ? `射程 ${c.range}` : "距離");
    const d = tile("gauge", "var(--mn-accent)", `${c.difficulty}`, "難度");
    const bar = h(d, "div", "mn-cv-bar");
    for (let i = 0; i < DIFF_STEPS; i++) h(bar, "i", i < c.difficulty ? "is-on" : "");
    return tiles;
}
// 概覽's page of its own (the chart in full, the combo video, this patch's changes), opened from its chart, tiles or tags
type Part = "overview" | "skills" | "build" | "augments" | "tips";
const PART_TITLE: Record<Part, string> = { overview: "概覽", skills: "技能", build: "出裝", augments: "強化", tips: "技巧" };
export function championPart(ctx: PageCtx): PageOut {
    const c = ctx.plugin.store.champion(String(ctx.frame.params?.id ?? ""));
    const p = String(ctx.frame.params?.part ?? "") as Part;
    const el = h(null, "div", "mn-page");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", `${c.name} · ${PART_TITLE[p] ?? ""}`);
    if (p === "overview") overviewAll(el, c, ctx);
    else if (p === "skills") skillStrip(el, c, ctx.plugin.store.currentChanges(c.id), { open: c.skills.findIndex((s) => s.key === "Q"), clipFirst: true, scroll: false });
    else if (p === "build") buildTab(el, c, ctx);
    else if (p === "augments") augmentsAll(el, c, ctx);
    else tips(el, c, ctx);
    // the champion page family: its sub pages sit on the same darkened splash as the swipe pages (Design Rules); the picture is the
    // one the champion page just showed, so it comes from the cache
    return { title: `${c.name} · ${PART_TITLE[p] ?? ""}`, el, art: cardArt(c.id) };
}

// The champion page's swipe pages, for the Handbook card that pictures them (label, icon; the Champion page pages in the Icons note)
export const CHAMPION_TABS = [["概覽", "id-card"], ["技能", "keyboard"], ["出裝", "shopping-bag"], ["強化", "sparkles"], ["技巧", "lightbulb"]] as const;

// Overview: reach, damage kind, difficulty and the style chart, then the combo video and this patch's changes
// 全部概覽 (opened from 概覽's chart, stats or tags), in the champion page family's style (Design Rules): no panels, about one screen.
// The style chart large, the three stats in a row, every ability tag with its keys, each damaging ability's damage kind and scaling,
// then the combo video as a link and this patch's changes.
function overviewAll(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    const look = h(body, "div", "mn-ov");
    profileRadar(h(look, "div", "mn-ov-radar"), profileAxes(c), DAMAGE_COLOR[c.damageType || c.skillDamage[0] || ""] ?? "var(--mn-accent)");
    statTiles(look, c).addClass("mn-ov-stats");
    tagRow(look, c, undefined, true).addClass("mn-ov-tags");
    const lines = damageLines(c);
    if (lines.length) {
        tierHead(look, "技能傷害");
        const list = h(look, "div", "mn-ov-dl");
        for (const d of lines) {
            h(list, "b", "mn-ov-key", d.key);
            const name = h(list, "span", "mn-ov-name", d.name);
            if (d.onHit) h(name, "small", undefined, "觸發攻擊特效");
            h(list, "span", "mn-ov-kind", d.kind).style.color = DAMAGE_COLOR[d.kind] ?? "inherit";
            const scale = [d.ad ? `物攻 ${Math.round(d.ad)}%` : "", d.ap ? `魔攻 ${Math.round(d.ap)}%` : ""].filter(Boolean).join(" · ");
            h(list, "span", "mn-ov-scale", scale || "—");
        }
    }
    if (c.video) moreLink(look, "連招影片", () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video!)}`));
    changesBlock(look, c, ctx);
    body.addClass("is-centred");   // a few parts: centred down the screen under the title (Design Rules, balance)
}

// The augment model's tiers (Dev Tools/Augment Model.md), in the champion page family's style (Design Rules): one ranking by tier,
// then score, rarity only in the icon's frame; icon grids with names only (the reason is on the augment's page); the play style as
// words. The 強化 page is a glance (its S augments, as many whole rows as fit, no scrolling); 全部強化 has every tier. The champion
// note's `pinned` come first, its `avoid` are left out. Without the model's file, the augments matched by their effect text stand in.
const TIER_ORDER = ["S", "A", "B", "C"];
const AUG_COLS = 4;   // icons per row in the champion page family's augment grid
const MODEL_NOTE = "依英雄的技能數值估算：在第 3、7、11、15 級選到時，讓這位英雄變強多少，和同稀有度的其他強化比較。不是勝率。點強化看原因。";
function tierPicks(store: Store, c: Champion, style: AugTierStyle): (AugmentPick & { tier: string })[] {
    const out: (AugmentPick & { tier: string })[] = [];
    for (const name of c.pinned) {
        const a = store.augments().find((x) => x.name === name);
        if (a) out.push({ a, why: "置頂", score: 100, tier: "S" });
    }
    const rows = [...style.tiers].sort((x, y) => TIER_ORDER.indexOf(x.tier) - TIER_ORDER.indexOf(y.tier) || y.score - x.score);
    for (const t of rows) {
        const a = store.augment(t.id);
        if (!a || c.avoid.includes(a.name) || c.pinned.includes(a.name)) continue;
        out.push({ a, why: t.reason, score: t.score, tier: t.tier });
    }
    return out;
}
// the play style as words (only when there is more than one); `draw` redraws with the chosen one
function styleSwitch(body: HTMLElement, styles: AugTierStyle[], draw: (s: AugTierStyle) => void): void {
    if (styles.length > 1) textSwitch(body, styles.map((s, i) => [String(i), s.name]), "0", (id) => draw(styles[Number(id)]));
}
// 強化 (the champion page): a glance at its S augments. One screen: as many whole rows as fit between the switch and 全部強化 ›
function augmentsTop(body: HTMLElement, c: Champion, ctx: PageCtx, more: () => void): void {
    const styles = Object.values(ctx.plugin.store.augTiers[c.id] ?? {});
    if (!styles.length) { augmentsTab(body, c, ctx); return; }
    body.addClass("is-glance");
    styleSwitch(body, styles, (s) => draw(s));
    const box = h(body, "div", "mn-cv-glance");
    const draw = (style: AugTierStyle) => {
        box.empty();
        const picks = tierPicks(ctx.plugin.store, c, style).filter((p) => p.tier === "S");
        if (!picks.length) { h(box, "p", "mn-cpa-empty", "沒有特別適合的強化。"); return; }
        const grid = augmentTiles(box, picks, ctx, { bare: true, champ: c.id });
        // whole rows only: the last row goes while the grid does not fit (laid out even while the page is off to the side)
        requestAnimationFrame(() => {
            while (box.scrollHeight > box.clientHeight + 1 && grid.childElementCount > AUG_COLS) {
                const last = ((grid.childElementCount - 1) % AUG_COLS) + 1;
                for (let i = 0; i < last; i++) grid.lastElementChild?.remove();
            }
        });
    };
    draw(styles[0]);
    moreLink(body, "全部強化", more);
}
// 全部強化: every tier, S to C, each a coloured letter over its icons; then the augments that do nothing for it
function augmentsAll(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    const store = ctx.plugin.store;
    const styles = Object.values(store.augTiers[c.id] ?? {});
    if (!styles.length) { augmentsTab(body, c, ctx); return; }
    styleSwitch(body, styles, (s) => draw(s));
    const box = h(body, "div", "mn-cv-tiers");
    const draw = (style: AugTierStyle) => {
        box.empty();
        const picks = tierPicks(store, c, style);
        for (const tier of TIER_ORDER) {
            const these = picks.filter((p) => p.tier === tier);
            if (!these.length) continue;
            tierHead(box, tier);
            augmentTiles(box, these, ctx, { bare: true, champ: c.id });
        }
        const none = style.none.map((n) => store.augment(n.id)).filter((a): a is Augment => !!a && !c.pinned.includes(a.name));
        if (none.length) h(box, "div", "mn-gf", `沒有幫助：${none.map((a) => a.name).join("、")}`);   // the same line style as the note under it
    };
    draw(styles[0]);
    h(body, "div", "mn-gf", MODEL_NOTE);
}

// The augments matched by their effect text (before the augment model; kept for when its file is missing)
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
