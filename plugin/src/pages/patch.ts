import type { NoteEntry, PatchNote } from "../data/store";
import { AUG_CLASS, augIcon, blockLoad, chip, empty, group, h, page, row, goes } from "../ui";
import { RARITY_COLOR } from "./augments";
import { entryDir, marker, type OfficialDir } from "./changes";
import type { PageCtx, PageOut } from "./index";

// The Patch page's row icons (Dev Tools/Icons.md, "Patch page")
export const PATCH_ICON = { earlier: "newspaper", ours: "file-text", featured: "party-popper" };

const LEGEND = "▲ 增強 · ▼ 削弱 · ◆ 有增有減 · ● 調整。方向是依數字變化推測的,不是官方標示。";

// The Patch tab: Riot's latest patch notes in short (blurb, headline image, a link to the full notes), then icon grids of what changed
// (new Mayhem augments, champions, items). One tap on an icon opens that augment / champion / item, whose own page shows the details:
// no list pages in between. Then earlier patches, our own patch notes, and the tips / builds written for an older patch.
export function patchPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("Patch");
    const [latest, ...older] = store.riotNotes;

    if (latest) latestCard(el, latest);
    else {
        const hero = h(el, "div", "mn-patch");
        h(hero, "div", "mn-patch-k", "Data from patch");
        h(hero, "div", "mn-patch-v", store.riotPatch() || "—");
        h(hero, "div", "mn-patch-s", "Run tools/fetch/fetch_patch_notes.py to show Riot's patch notes here.");
    }

    if (latest?.champions?.length) {
        h(el, "div", "mn-gh", `Champions · ${latest.champions.length}`);
        const grid = h(el, "div", "mn-grid");
        for (const { e, dir } of byDir(latest.champions)) {
            const c = store.champions().find((x) => x.name === e.name);
            if (c) tile(grid, c.icon, c.name, () => ctx.openChampion(c.id, "overview"), { dir, go: { key: "champion", params: { id: c.id } } });
        }
        blockLoad(grid);
        h(el, "div", "mn-gf", LEGEND);
    }
    if (latest?.items?.length) {
        h(el, "div", "mn-gh", `Items · ${latest.items.length}`);
        const grid = h(el, "div", "mn-grid");
        for (const { e, dir } of byDir(latest.items)) {
            const i = store.items().find((x) => x.name === e.name);
            if (i) tile(grid, i.icon, i.name, () => ctx.openItem(i.id), { dir });
        }
        blockLoad(grid);
        h(el, "div", "mn-gf", LEGEND);
    }

    if (latest && ctx.plugin.settings.mode === "mayhem") mayhemSection(el, ctx, latest);

    if (older.length) {
        const g = group(el, "Earlier patches");
        for (const n of older) row(g, { icon: PATCH_ICON.earlier, title: n.title, sub: n.summary || undefined, value: n.date, chevron: true, clamp: true, onTap: () => window.open(n.url) });
    }
    const mine = store.patchNotes();
    if (mine.length) {
        const g = group(el, "Our patch notes");
        for (const n of mine) row(g, { icon: PATCH_ICON.ours, title: n.title, sub: n.summary || undefined, value: n.patch, chevron: true, onTap: () => ctx.openNote(n.file.path) });
    }

    const stale = store.staleEntries();
    const g = group(el, "Check these tricks");
    if (!stale.length) empty(g, { icon: "check-circle", title: "Nothing to recheck", text: "Every tip and build matches the current patch." });
    else {
        for (const s of stale.slice(0, 30)) {
            row(g, { image: s.champion.icon, title: `${s.champion.name}:${s.title}`, sub: s.patch ? `Written for ${s.patch}` : "No patch given", value: s.kind === "tip" ? "Tip" : "Build", chevron: true,
                onTap: () => ctx.openChampion(s.champion.id, s.kind === "tip" ? "tips" : "build") });
        }
        if (stale.length > 30) h(el, "div", "mn-gf", `${stale.length - 30} more`);
    }
    return { title: "Patch", el, ready: null };   // the page shows at once; its grids and the headline picture load as blocks
}

// Entries grouped by the marker they carry: buffs first, then nerfs, then mixed, then plain adjustments (each keeps Riot's order)
const DIR_ORDER: OfficialDir[] = ["buff", "nerf", "mixed", "change"];
function byDir<T extends NoteEntry>(list: T[]): { e: T; dir: OfficialDir }[] {
    return list.map((e) => ({ e, dir: entryDir(e) })).sort((a, b) => DIR_ORDER.indexOf(a.dir) - DIR_ORDER.indexOf(b.dir));
}

// An icon with its name under it; `badge` is the number of changes, `ring` an outline colour (rarity)
function tile(grid: HTMLElement, src: string, name: string, onTap: () => void, o: { dir?: OfficialDir; rarity?: string; go?: { key: string; params?: Record<string, string | number> } } = {}): void {
    const t = h(grid, "button", "mn-tile");
    if (o.rarity && AUG_CLASS[o.rarity]) augIcon(t, src, o.rarity, "mn-tile-aug");
    else { const im = h(t, "img"); im.src = src; im.alt = ""; }
    if (o.dir) { const m = marker(o.dir); const b = h(t, "span", "mn-tile-b", m.mark); b.style.background = m.color; }
    h(t, "span", "mn-tile-n", name);
    t.addEventListener("click", (e) => { e.preventDefault(); onTap(); });
    if (o.go) goes(t, o.go);
}

function latestCard(el: HTMLElement, n: PatchNote): void {
    const card = h(el, "div", "mn-pn");
    if (n.image) { const im = h(card, "img", "mn-pn-img"); im.src = n.image; im.alt = ""; im.loading = "lazy"; }
    const body = h(card, "div", "mn-pn-body");
    h(body, "div", "mn-patch-k", `Patch ${n.patch} · ${n.date}`);
    h(body, "div", "mn-pn-t", n.title);
    if (n.summary) h(body, "div", "mn-patch-s", n.summary);
    const btn = h(body, "button", "mn-pn-btn", "Read the full notes ↗");
    btn.addEventListener("click", (e) => { e.preventDefault(); window.open(n.url); });
    h(body, "div", "mn-pn-src", "Riot Games · 版本更新公告");
    blockLoad(card);
}

// The Mayhem part of the patch: new augments, augments Riot changed (▲▼ like champions), the Mayhem balance changes per champion,
// removed augments, and 主秀英雄 (the patch's featured twists) as short rows. An augment name the app does not know is a chip, never dropped.
function mayhemSection(el: HTMLElement, ctx: PageCtx, n: PatchNote): void {
    const store = ctx.plugin.store;
    const added = n.augments_new ?? [], changed = n.augments_changed ?? [], removed = n.augments_removed ?? [];
    const champs = n.mayhem_champions ?? [], featured = n.mayhem_featured ?? [];
    if (!added.length && !changed.length && !removed.length && !champs.length && !featured.length) return;
    const byName = new Map(store.augments().map((a) => [a.name, a]));
    const unknown = (names: string[]) => {
        if (!names.length) return;
        const chips = h(el, "div", "mn-chips");
        for (const x of names) chip(chips, x);
    };
    if (added.length) {
        h(el, "div", "mn-gh", `Mayhem · ${added.length} new augments`);
        const grid = h(el, "div", "mn-grid");
        for (const a of added) {
            const mine = byName.get(a.name);
            if (mine) tile(grid, mine.icon, a.name, () => ctx.openAugment(mine.id), { rarity: mine.rarity });
        }
        blockLoad(grid);
        unknown(added.filter((a) => !byName.has(a.name)).map((a) => a.name));
    }
    if (changed.length) {
        h(el, "div", "mn-gh", `Mayhem · ${changed.length} augments changed`);
        const grid = h(el, "div", "mn-grid");
        for (const { e, dir } of byDir(changed)) {
            const mine = byName.get(e.name);
            if (mine) tile(grid, mine.icon, e.name, () => ctx.openAugment(mine.id), { rarity: mine.rarity, dir });
        }
        blockLoad(grid);
        unknown(changed.filter((e) => !byName.has(e.name)).map((e) => e.name));
        h(el, "div", "mn-gf", LEGEND);
    }
    if (champs.length) {
        h(el, "div", "mn-gh", `Mayhem balance · ${champs.length} champions`);
        const grid = h(el, "div", "mn-grid");
        for (const { e, dir } of byDir(champs)) {
            const c = store.champions().find((x) => x.name === e.name);
            if (c) tile(grid, c.icon, c.name, () => ctx.openChampion(c.id, "overview"), { dir, go: { key: "champion", params: { id: c.id } } });
        }
        blockLoad(grid);
        h(el, "div", "mn-gf", "大混戰專屬的英雄平衡（承受傷害、造成傷害等）。" + LEGEND);
    }
    if (removed.length) {
        h(el, "div", "mn-gh", `Removed augments · ${removed.length}`);
        const chips = h(el, "div", "mn-chips");
        for (const r of removed) chip(chips, r, { color: RARITY_COLOR["銀"] });
    }
    if (featured.length) {
        const g = group(el, "主秀英雄");
        for (const f of featured) row(g, { icon: PATCH_ICON.featured, title: f.new ? `${f.name} · 新` : f.name, sub: f.text || undefined, clamp: true });
    }
}
