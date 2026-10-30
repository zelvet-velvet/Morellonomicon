import type { Champion } from "../data/store";
import { DAMAGE_COLOR, DAMAGE_ICON, augIcon, warmPictures, blockUntil, layoutBlock, chip, empty, fgrid, group, h, icon, page, row, segmented, roleChip, LANES, laneChip, slideSeg, tip, fixedPage } from "../ui";
import { TAG_GROUPS, championProfile, iconFilter, tagFilter } from "./profile";
import { buildTab } from "./build";
import type { PageCtx, PageOut } from "./index";
import { badgeColor, badgeText, changesBlock, entryDir, marker } from "./changes";
import { metaLine } from "./fresh";
import { skillStrip } from "./skills";
import { quickCard } from "./roster";
import { DECK_BELOW } from "./deck";
import { augmentPicks, type AugmentPick } from "./detail";

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

// The champion page (layout C, chosen 2026-10-30): the champion as one card like the 速查 card, on one screen with no scrolling. The
// 速查 card's pages (概覽, 玩法, 技能, 風格) and three more (出裝, 強化, 技巧), turned by tapping a half of the card or swiping sideways;
// each shows its top picks, and 全部 › opens the full list as a page of its own (championPart). Back sits on the card.
export function championCard(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const c = store.champion(String(ctx.frame.params?.id ?? ""));
    const el = h(null, "div", "mn-page mn-deckpage");
    if (!c) { empty(el, { icon: "user-x", title: "Champion not found" }); return { title: "", el }; }
    const mayhem = ctx.plugin.settings.mode === "mayhem";
    const part = (p: Part) => () => ctx.push({ key: "champpart", title: `${c.name} · ${PART_TITLE[p]}`, params: { id: c.id, part: p } });
    const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)] as const));
    const startSub = lastSub.get(c.id);   // a link may ask for a page (once): the next visit starts on 概覽 again
    lastSub.delete(c.id);
    const wrap = h(el, "div", "mn-deckwrap mn-rq-deck mn-cc");
    const card = h(h(h(wrap, "div", "mn-pager"), "section", "mn-slide"), "div", "mn-sl-card");
    const face = h(card, "div", "mn-sl-face");
    const skins = quickCard(ctx, c, face, {
        kicker: [c.title, c.roles.join(" · ")].filter(Boolean).join(" · "), recent, back: () => ctx.pop(),
        start: { overview: "概覽", skills: "技能", build: "出裝", augments: "強化", tips: "技巧" }[startSub ?? "overview"],
        more: { skills: part("skills"), style: part("overview") },
        extra: [
            { name: "出裝", build: (tab) => buildTop(tab, c, ctx), more: part("build") },
            ...(mayhem ? [{ name: "強化", build: (tab: HTMLElement) => augmentTop(tab, c, ctx), more: part("augments") }] : []),
            { name: "技巧", build: (tab) => tipsTop(tab, c), more: c.tips.length ? part("tips") : undefined },
        ],
    });
    // the skins behind the later pages are fetched while the first is read (a tap shows them at once)
    window.setTimeout(() => void warmPictures(skins), CARD_WARM_MS);
    // the card fills the screen down to the tab bar, like the 速查 swipe
    const fit = () => {
        const scroll = el.closest<HTMLElement>(".mn-scroll");
        if (!scroll || !wrap.isConnected) return;
        const top = wrap.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
        wrap.style.height = `${Math.max(380, scroll.clientHeight - top - DECK_BELOW)}px`;
    };
    requestAnimationFrame(fit);
    return { title: "", el, ready: null };   // the card's own pictures load as blocks
}

// The parts behind 全部 ›: the full lists of the old sub-tabs, as pages that scroll
type Part = "overview" | "skills" | "build" | "augments" | "tips";
const PART_TITLE: Record<Part, string> = { overview: "風格與本版", skills: "技能", build: "出裝", augments: "強化", tips: "技巧" };
const CARD_WARM_MS = 600;
const TOP_AUGS = 2;   // per rarity on the card
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
    h(tab, "div", "mn-qc-k", "出裝");
    if (!b) { h(tab, "p", "mn-qc-how", "還沒有寫出裝。之後依玩法推薦前三件。"); return; }
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
    if (b.note) h(tab, "p", "mn-qc-how", b.note);
}
// 強化 on the card: the best two of each rarity, with why
function augmentTop(tab: HTMLElement, c: Champion, ctx: PageCtx): void {
    const picks = augmentPicks(ctx.plugin.store, c);
    h(tab, "div", "mn-qc-k", "強化");
    if (!picks.length) { h(tab, "p", "mn-qc-how", "還沒有配對到的強化。"); return; }
    const list = h(tab, "div", "mn-cc-augs");
    for (const r of AUG_RARITIES) for (const p of picks.filter((x) => x.a.rarity === r).slice(0, TOP_AUGS)) {
        const x = h(list, "button", "mn-cc-aug");
        augIcon(x, p.a.icon, p.a.rarity, "mn-cc-augic");
        const t = h(x, "span", "mn-cc-augt");
        h(t, "b", undefined, p.a.name);
        h(t, "span", undefined, `${p.a.rarity} · ${p.why}`);
        x.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); ctx.openAugment(p.a.id); });
    }
}
// 技巧 on the card: the first tips' titles
function tipsTop(tab: HTMLElement, c: Champion): void {
    h(tab, "div", "mn-qc-k", "技巧");
    if (!c.tips.length) { h(tab, "p", "mn-qc-how", "還沒有技巧。寫在 Inbox/技巧，整理後會出現在這裡。"); return; }
    const box = h(tab, "div", "mn-qc-howbox");
    for (const t of c.tips.slice(0, TOP_TIPS)) { const p = h(box, "p", "mn-qc-how"); h(p, "b", undefined, t.title); if (t.text) p.append(`：${t.text}`); }
}

// The champion card's pages, for the Handbook card that pictures them (label, icon; the Champion page tabs in the Icons note)
export const CHAMPION_TABS = [["概覽", "id-card"], ["玩法", "gamepad-2"], ["技能", "keyboard"], ["風格", "radar"], ["出裝", "shopping-bag"], ["強化", "sparkles"], ["技巧", "lightbulb"]] as const;

// Overview: reach, damage kind, difficulty and the style chart, then the combo video and this patch's changes
function overview(body: HTMLElement, c: Champion, ctx: PageCtx): { el: HTMLElement; open(): void } | null {
    championProfile(body, c, ctx.app);
    if (c.video) row(group(body), { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video!)}`) });
    return changesBlock(body, c, ctx);
}

// Augments: the ones that suit this champion, by rarity (稜鏡, 金, 銀), best first, each with why; the first few of each, the rest folded
const AUG_SHOWN = 6;
const AUG_RARITIES = ["稜鏡", "金", "銀"];
function augmentsTab(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    const picks = augmentPicks(ctx.plugin.store, c);
    if (!picks.length) { empty(body, { icon: "sparkles", title: "No augments matched yet" }); return; }
    for (const r of AUG_RARITIES) {
        const list = picks.filter((p) => p.a.rarity === r);
        if (!list.length) continue;
        const g = group(body, `${r}級 · ${list.length}`);
        const add = (p: AugmentPick) => row(g, { image: p.a.icon, rarity: p.a.rarity, title: p.a.name, sub: p.a.effect || undefined, value: p.why, chevron: true, clamp: true, onTap: () => ctx.openAugment(p.a.id) });
        list.slice(0, AUG_SHOWN).forEach(add);
        if (list.length > AUG_SHOWN) {
            const more = row(g, { icon: "chevron-down", title: `再看 ${list.length - AUG_SHOWN} 個`, muted: true, onTap: () => { more.remove(); list.slice(AUG_SHOWN).forEach(add); } });
        }
    }
    h(body, "div", "mn-gf", "置頂：你在英雄筆記的 pinned；遊戲標籤：遊戲只會給適合的英雄；推測：依效果文字，僅供參考。沒有勝率資料（Riot 沒有公開大混戰對戰）。");
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
