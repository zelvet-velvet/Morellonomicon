import { chip, empty, group, h, icon, page, row, segmented, blockLoad } from "../ui";
import type { PageCtx, PageOut } from "./index";

export const RARITIES = ["銀", "金", "稜鏡"];
export const RARITY_COLOR: Record<string, string> = { 銀: "var(--text-muted)", 金: "var(--color-yellow)", 稜鏡: "var(--color-purple)" };
const RARITY_RANK: Record<string, number> = { 稜鏡: 0, 金: 1, 銀: 2 };   // strongest first
const SORTS: [string, string][] = [["rarity", "稀有度"], ["name", "名稱"], ["new", "最新"]];
const patchNo = (p: string): number => { const m = /(\d+)\.(\d+)/.exec(p); return m ? Number(m[1]) * 100 + Number(m[2]) : 0; };

// first direction when a sort is picked: strongest first (↓), A first (↑), newest first (↓)
const SORT_DIR: Record<string, 1 | -1> = { rarity: -1, name: 1, new: -1 };
let sortBy = "rarity", sortDir: 1 | -1 = -1;   // kept while the app is open

// ARAM Mayhem augments: search, a rarity filter, a sort (rarity, name, newest), one row each (the effect line shows when there is one).
// An augment added in the latest patch carries a 新 tag.
export function augmentsPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("Augments");
    const all = store.augments();
    if (!all.length) { empty(el, { icon: "database", title: "No augment notes yet", text: "Run python3 tools/fetch_augments.py" }); return { title: "Augments", el }; }
    let query = "", rarity = "";
    const latest = store.riotNotes[0]?.patch ?? "";
    const addedIn = new Map(all.map((a) => [a.id, store.augmentHistory(a.name).find((x) => x.what === "added")?.patch ?? ""]));
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "搜尋強化";
    const sortHost = h(el, "div", "mn-aug-sort");
    const chips = h(el, "div", "mn-chips mn-aug-rar");
    const list = h(el, "div", "mn-blk");
    const links = group(el, "Tier lists (other sites)");
    row(links, { icon: "external-link", title: "OP.GG Mayhem tier list", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
    row(links, { icon: "external-link", title: "U.GG augment tier list", chevron: true, onTap: () => window.open("https://u.gg/lol/aram-mayhem-augment-tier-list") });

    const draw = () => {
        list.empty();
        const q = query.trim().toLowerCase();
        const hits = all.filter((a) => (!rarity || a.rarity === rarity) && (!q || a.name.toLowerCase().includes(q)));
        const byName = (a: typeof hits[number], b: typeof hits[number]) => a.name.localeCompare(b.name, "zh-Hant");
        // each compares in its "↑" order; ↓ turns it round (rarity ↓ = 稜鏡 first, new ↓ = newest first), ties by name
        const d = sortDir;
        if (sortBy === "rarity") hits.sort((a, b) => d * ((RARITY_RANK[b.rarity] ?? 9) - (RARITY_RANK[a.rarity] ?? 9)) || byName(a, b));
        else if (sortBy === "new") hits.sort((a, b) => d * (patchNo(addedIn.get(a.id) ?? "") - patchNo(addedIn.get(b.id) ?? "")) || byName(a, b));
        else hits.sort((a, b) => d * byName(a, b));
        const g = group(list);
        for (const a of hits) {
            const isNew = !!latest && addedIn.get(a.id) === latest;
            row(g, { image: a.icon, rarity: a.rarity, title: a.name, sub: a.effect || undefined, value: isNew ? `${a.rarity} · 新` : a.rarity, chevron: true, clamp: true, onTap: () => ctx.openAugment(a.id) });
        }
        if (!hits.length) empty(list, { icon: "search-x", title: "No match" });
        blockLoad(list);
    };
    // tapping the chosen sort again flips it; only the chosen one shows its arrow
    const drawSort = () => {
        sortHost.empty();
        const arrow = (id: string) => (sortBy !== id ? "" : sortDir === 1 ? " ↑" : " ↓");
        segmented(sortHost, SORTS.map(([id, l]): [string, string] => [id, l + arrow(id)]), sortBy, (id) => {
            if (id === sortBy) sortDir = sortDir === 1 ? -1 : 1;
            else { sortBy = id; sortDir = SORT_DIR[id] ?? 1; }
            drawSort();
            draw();
        }, "is-sm mn-sortbar");
    };
    const drawChips = () => {
        chips.empty();
        for (const r of RARITIES) chip(chips, r, { on: rarity === r, color: RARITY_COLOR[r], onTap: () => { rarity = rarity === r ? "" : r; drawChips(); draw(); } });
    };
    search.addEventListener("input", () => { query = search.value; draw(); });
    drawSort();
    drawChips();
    draw();
    return { title: "Augments", el, ready: null };   // the page shows at once; the list loads as a block
}
