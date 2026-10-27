import { chip, empty, group, h, page, row } from "../ui";
import type { PageCtx, PageOut } from "./index";

const KINDS: [string, string][] = [["AP", "SpellDamage"], ["AD", "Damage"], ["Armor", "Armor"], ["MR", "SpellBlock"], ["HP", "Health"], ["Speed", "Boots"]];

// Items of the current mode's shop, cheapest first; tap a chip to filter by what the item gives.
export function itemsPage(ctx: PageCtx): PageOut {
    const el = page("Items");
    const all = ctx.plugin.store.modeItems().filter((i) => i.goldTotal > 0);
    if (!all.length) { empty(el, { icon: "database", title: "No item notes yet", text: "Run python3 tools/fetch_data.py" }); return { title: "Items", el }; }
    let query = "", kind = "";
    const search = h(h(el, "div", "mn-search"), "input");
    search.type = "search";
    search.placeholder = "Search";
    const chips = h(el, "div", "mn-chips");
    const list = h(el, "div");
    const draw = () => {
        list.empty();
        const q = query.trim().toLowerCase();
        const hits = all.filter((i) => (!kind || i.tags.includes(kind)) && (!q || i.name.toLowerCase().includes(q)));
        const g = group(list);
        for (const i of hits.slice(0, 80)) row(g, { image: i.icon, title: i.name, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openNote(i.path) });
        if (!hits.length) empty(list, { icon: "search-x", title: "No match" });
        else if (hits.length > 80) h(list, "div", "mn-gf", `${hits.length - 80} more: search or filter`);
    };
    const drawChips = () => {
        chips.empty();
        for (const [label, tag] of KINDS) chip(chips, label, { on: kind === tag, onTap: () => { kind = kind === tag ? "" : tag; drawChips(); draw(); } });
    };
    search.addEventListener("input", () => { query = search.value; draw(); });
    drawChips();
    draw();
    return { title: "Items", el };
}
