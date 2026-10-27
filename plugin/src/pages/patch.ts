import type { NoteEntry, PatchNote } from "../data/store";
import { chip, empty, group, h, page, row } from "../ui";
import { RARITY_COLOR } from "./augments";
import { rememberSub } from "./champions";
import type { PageCtx, PageOut } from "./index";

const SHOWN = 6;   // rows shown before "Show all"

// The Patch tab: Riot's latest patch notes in short (blurb, headline image, what changed in Mayhem, champions and items, a link to the
// full notes), earlier patches, our own patch notes, and the tips / builds written for an older patch.
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
    if (latest?.champions?.length) entries(el, ctx, "Champions", latest.champions, (name) => championOf(ctx, name));
    if (latest?.items?.length) entries(el, ctx, "Items", latest.items, (name) => itemOf(ctx, name));

    if (older.length) {
        const g = group(el, "Earlier patches");
        for (const n of older) row(g, { icon: "newspaper", title: n.title, sub: n.summary || undefined, value: n.date, chevron: true, onTap: () => window.open(n.url) });
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
            row(g, { image: s.champion.icon, title: `${s.champion.name}:${s.title}`, sub: s.patch ? `Written for ${s.patch}` : "No patch given", value: s.kind === "tip" ? "Tip" : "Build", chevron: true, onTap: () => {
                rememberSub(s.champion.id, s.kind === "tip" ? "tips" : "build");
                ctx.goTab("champions");
                ctx.push({ key: "champion", title: s.champion.name, params: { id: s.champion.id } });
            } });
        }
        if (stale.length > 30) h(el, "div", "mn-gf", `${stale.length - 30} more`);
    }
    return { title: "Patch", el };
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
        const g = group(el, `Mayhem · ${added.length} new augments`);
        const list = (limit: number) => {
            g.empty();
            for (const a of added.slice(0, limit)) row(g, { image: byName.get(a.name)?.icon, title: a.name, sub: a.text || undefined, value: a.rarity, chevron: !!byName.get(a.name), onTap: byName.get(a.name) ? () => ctx.openNote(byName.get(a.name)!.path) : undefined });
            if (added.length > limit) {
                const more = h(g, "button", "mn-showall", `Show all ${added.length}`);
                more.addEventListener("click", (e) => { e.preventDefault(); list(added.length); });
            }
        };
        list(SHOWN);
    }
    if (removed.length) {
        h(el, "div", "mn-gh", `Removed augments · ${removed.length}`);
        const chips = h(el, "div", "mn-chips");
        for (const r of removed) chip(chips, r, { color: RARITY_COLOR["銀"] });
    }
}

function championOf(ctx: PageCtx, name: string): { icon: string; open: () => void } | null {
    const c = ctx.plugin.store.champions().find((x) => x.name === name);
    if (!c) return null;
    return { icon: c.icon, open: () => { rememberSub(c.id, "skills"); ctx.goTab("champions"); ctx.push({ key: "champion", title: c.name, params: { id: c.id } }); } };
}

function itemOf(ctx: PageCtx, name: string): { icon: string; open: () => void } | null {
    const i = ctx.plugin.store.items().find((x) => x.name === name);
    return i ? { icon: i.icon, open: () => ctx.openNote(i.path) } : null;
}

// One row per champion / item: the first change in short ("label old → new") and how many more there are; the full text is on Riot's page.
function entries(el: HTMLElement, ctx: PageCtx, title: string, list: NoteEntry[], find: (name: string) => { icon: string; open: () => void } | null): void {
    const g = group(el, `${title} · ${list.length}`);
    const draw = (limit: number) => {
        g.empty();
        for (const e of list.slice(0, limit)) {
            const hit = find(e.name);
            const c = e.changes[0];
            const extra = e.changes.length - 1 + e.more;
            row(g, { image: hit?.icon, title: e.name, sub: c ? `${c.label}  ${c.old} → ${c.new}` : undefined, value: extra > 0 ? `+${extra}` : undefined, chevron: !!hit, onTap: hit?.open });
        }
        if (list.length > limit) {
            const more = h(g, "button", "mn-showall", `Show all ${list.length}`);
            more.addEventListener("click", (e) => { e.preventDefault(); draw(list.length); });
        }
    };
    draw(SHOWN);
}
