import { chip, empty, group, h, icon, page, row } from "../ui";
import type { PageCtx, PageOut } from "./index";

export const RARITIES = ["銀", "金", "稜鏡"];
export const RARITY_COLOR: Record<string, string> = { 銀: "var(--text-muted)", 金: "var(--color-yellow)", 稜鏡: "var(--color-purple)" };

// ARAM Mayhem augments: search, a rarity filter, one row each (the effect line shows when the note has one).
export function augmentsPage(ctx: PageCtx): PageOut {
    const el = page("Augments");
    const all = ctx.plugin.store.augments();
    if (!all.length) { empty(el, { icon: "database", title: "No augment notes yet", text: "Run python3 tools/fetch_augments.py" }); return { title: "Augments", el }; }
    let query = "", rarity = "";
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search";
    const links = group(el);
    row(links, { icon: "external-link", title: "OP.GG Mayhem tier list", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
    row(links, { icon: "external-link", title: "U.GG augment tier list", chevron: true, onTap: () => window.open("https://u.gg/lol/aram-mayhem-augment-tier-list") });
    const chips = h(el, "div", "mn-chips");
    const list = h(el, "div");
    const draw = () => {
        list.empty();
        const q = query.trim().toLowerCase();
        const hits = all.filter((a) => (!rarity || a.rarity === rarity) && (!q || a.name.toLowerCase().includes(q)));
        const g = group(list);
        for (const a of hits.slice(0, 100)) row(g, { image: a.icon, title: a.name, sub: a.effect || undefined, value: a.rarity, chevron: true, clamp: true, onTap: () => ctx.openAugment(a.id) });
        if (!hits.length) empty(list, { icon: "search-x", title: "No match" });
        else if (hits.length > 100) h(list, "div", "mn-gf", `${hits.length - 100} more: search or filter`);
    };
    const drawChips = () => {
        chips.empty();
        for (const r of RARITIES) chip(chips, r, { on: rarity === r, color: RARITY_COLOR[r], onTap: () => { rarity = rarity === r ? "" : r; drawChips(); draw(); } });
    };
    search.addEventListener("input", () => { query = search.value; draw(); });
    drawChips();
    draw();
    return { title: "Augments", el };
}
