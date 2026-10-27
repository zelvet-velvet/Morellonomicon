import type { PatchNote } from "../data/store";
import { AUG_CLASS, chip, empty, group, h, page, row } from "../ui";
import { RARITY_COLOR } from "./augments";
import type { PageCtx, PageOut } from "./index";

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
        h(hero, "div", "mn-patch-s", "Run tools/fetch_patch_notes.py to show Riot's patch notes here.");
    }

    if (latest && ctx.plugin.settings.mode === "mayhem") mayhemSection(el, ctx, latest);

    if (latest?.champions?.length) {
        h(el, "div", "mn-gh", `Champions · ${latest.champions.length}`);
        const grid = h(el, "div", "mn-grid");
        for (const e of latest.champions) {
            const c = store.champions().find((x) => x.name === e.name);
            if (c) tile(grid, c.icon, c.name, () => ctx.openChampion(c.id, "skills"), { badge: e.changes.length + e.more });
        }
    }
    if (latest?.items?.length) {
        h(el, "div", "mn-gh", `Items · ${latest.items.length}`);
        const grid = h(el, "div", "mn-grid");
        for (const e of latest.items) {
            const i = store.items().find((x) => x.name === e.name);
            if (i) tile(grid, i.icon, i.name, () => ctx.openItem(i.id), { badge: e.changes.length + e.more });
        }
    }

    if (older.length) {
        const g = group(el, "Earlier patches");
        for (const n of older) row(g, { icon: "newspaper", title: n.title, sub: n.summary || undefined, value: n.date, chevron: true, clamp: true, onTap: () => window.open(n.url) });
    }
    const mine = store.patchNotes();
    if (mine.length) {
        const g = group(el, "Our patch notes");
        for (const n of mine) row(g, { icon: "file-text", title: n.title, sub: n.summary || undefined, value: n.patch, chevron: true, onTap: () => ctx.openNote(n.file.path) });
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
    return { title: "Patch", el };
}

// An icon with its name under it; `badge` is the number of changes, `ring` an outline colour (rarity)
function tile(grid: HTMLElement, src: string, name: string, onTap: () => void, o: { badge?: number; rarity?: string } = {}): void {
    const t = h(grid, "button", "mn-tile");
    const im = h(t, "img", o.rarity ? AUG_CLASS[o.rarity] : undefined); im.src = src; im.alt = ""; im.loading = "lazy";
    if (o.badge && o.badge > 1) h(t, "span", "mn-tile-b", `+${o.badge}`);
    h(t, "span", "mn-tile-n", name);
    t.addEventListener("click", (e) => { e.preventDefault(); onTap(); });
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
}

function mayhemSection(el: HTMLElement, ctx: PageCtx, n: PatchNote): void {
    const added = n.augments_new ?? [], removed = n.augments_removed ?? [];
    if (!added.length && !removed.length) return;
    const byName = new Map(ctx.plugin.store.augments().map((a) => [a.name, a]));
    if (added.length) {
        h(el, "div", "mn-gh", `Mayhem · ${added.length} new augments`);
        const grid = h(el, "div", "mn-grid");
        for (const a of added) {
            const mine = byName.get(a.name);
            if (mine) tile(grid, mine.icon, a.name, () => ctx.openAugment(mine.id), { rarity: a.rarity });
        }
    }
    if (removed.length) {
        h(el, "div", "mn-gh", `Removed augments · ${removed.length}`);
        const chips = h(el, "div", "mn-chips");
        for (const r of removed) chip(chips, r, { color: RARITY_COLOR["銀"] });
    }
}
