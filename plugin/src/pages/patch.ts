import { empty, group, h, icon, page, row } from "../ui";
import { badgeColor, badgeText } from "./changes";
import { rememberSub } from "./champions";
import type { PageCtx, PageOut } from "./index";

const OFFICIAL = "https://www.leagueoflegends.com/zh-tw/news/tags/patch-notes/";

// The Patch tab: which patch the data is from, where the official notes are, our own patch notes, and the tips / builds that may be out of date.
export function patchPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("Patch");
    const now = store.currentPatch();

    const hero = h(el, "div", "mn-patch");
    h(hero, "div", "mn-patch-k", "Data from patch");
    h(hero, "div", "mn-patch-v", now || "—");
    h(hero, "div", "mn-patch-s", "Champions, skills and items are regenerated per patch. Tips and builds below show the patch they were written for.");
    const links = group(el);
    row(links, { icon: "external-link", title: "Official patch notes (繁中)", chevron: true, onTap: () => window.open(OFFICIAL) });

    const notes = store.patchNotes();
    if (notes.length) {
        const g = group(el, "Our patch notes");
        for (const n of notes) row(g, { icon: "file-text", title: n.title, sub: n.summary || undefined, value: n.patch, chevron: true, onTap: () => ctx.openNote(n.file.path) });
    }

    const changed = store.champions().map((c) => ({ c, items: store.currentChanges(c.id) })).filter((x) => x.items.length);
    if (changed.length) {
        const g = group(el, `Changed in ${now}`);
        for (const { c, items } of changed.sort((a, b) => b.items.length - a.items.length)) {
            const r = row(g, { image: c.icon, title: c.name, chevron: true, onTap: () => {
                rememberSub(c.id, "skills");
                ctx.goTab("champions");
                ctx.push({ key: "champion", title: c.name, params: { id: c.id } });
            } });
            const badge = h(r, "span", "mn-row-v", badgeText(items) || "✎");
            badge.style.color = badgeColor(items);
            r.insertBefore(badge, r.querySelector(".mn-row-chev"));
        }
        h(el, "div", "mn-gf", "Stats, cooldowns, costs, ranges and skill text compared with the previous patch. Damage numbers are not compared yet.");
    }

    const stale = store.staleEntries();
    const g = group(el, "Check these tricks");
    if (!stale.length) {
        empty(g, { icon: "check-circle", title: "Nothing to recheck", text: "Every tip and build matches the current patch." });
    } else {
        for (const s of stale.slice(0, 30)) {
            row(g, { image: s.champion.icon, title: `${s.champion.name}:${s.title}`, sub: s.patch ? `Written for ${s.patch}` : "No patch given", value: s.kind === "tip" ? "Tip" : "Build", chevron: true, onTap: () => {
                rememberSub(s.champion.id, s.kind === "tip" ? "tips" : "build");
                ctx.goTab("champions");
                ctx.push({ key: "champion", title: s.champion.name, params: { id: s.champion.id } });
            } });
        }
        if (stale.length > 30) h(el, "div", "mn-gf", `${stale.length - 30} more`);
    }
    void icon;
    return { title: "Patch", el };
}
