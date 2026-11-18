import { chip, empty, group, h, icon, page, row, segmented, blockLoad, tierHead } from "../ui";
import type { PageCtx, PageOut } from "./index";

export const RARITIES = ["銀", "金", "稜鏡"];
export const RARITY_COLOR: Record<string, string> = { 銀: "var(--text-muted)", 金: "var(--color-yellow)", 稜鏡: "var(--color-purple)" };
const RARITY_RANK: Record<string, number> = { 稜鏡: 0, 金: 1, 銀: 2 };   // strongest first
const SORTS: [string, string][] = [["tier", "強度"], ["rarity", "稀有度"], ["name", "名稱"], ["new", "最新"]];
const patchNo = (p: string): number => { const m = /(\d+)\.(\d+)/.exec(p); return m ? Number(m[1]) * 100 + Number(m[2]) : 0; };

// first direction when a sort is picked: strongest first (↓), A first (↑), newest first (↓)
const SORT_DIR: Record<string, 1 | -1> = { tier: -1, rarity: -1, name: 1, new: -1 };
let sortBy = "tier", sortDir: 1 | -1 = -1;   // kept while the app is open; 強度 first

// ARAM Mayhem augments: search, a rarity filter, a sort (強度 by default, rarity, name, newest). 強度 (option C, chosen 2026-11-18) is the
// augment model's rank across champions (store.augmentStrength): the list split under S / A / B / C headings with their counts, each row
// showing the champions it suits best (a stack at the row's end, the rarity under the name) in place of the effect line; augments the model cannot rate come last under 未評級. The other
// sorts are one list with the effect line. An augment added in the latest patch carries a 新 badge on its icon; one Riot changed in it, 改.
const TIERS = ["S", "A", "B", "C"];
export function augmentsPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("Augments");
    const all = store.augments();
    if (!all.length) { empty(el, { icon: "database", title: "No augment notes yet", text: "Run python3 tools/fetch_augments.py" }); return { title: "Augments", el }; }
    let query = "", rarity = "";
    const latest = store.riotNotes[0]?.patch ?? "";
    const history = new Map(all.map((a) => [a.id, store.augmentHistory(a.name)]));
    const addedIn = new Map(all.map((a) => [a.id, history.get(a.id)?.find((x) => x.what === "added")?.patch ?? ""]));
    const changedNow = new Set(all.filter((a) => !!latest && history.get(a.id)?.some((x) => x.what === "changed" && x.patch === latest)).map((a) => a.id));
    const strength = store.augmentStrength();
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
        const rankOf = (a: typeof hits[number]) => strength.get(a.id)?.rank ?? 9999;
        if (sortBy === "tier") hits.sort((a, b) => d * (rankOf(b) - rankOf(a)) || byName(a, b));
        else if (sortBy === "rarity") hits.sort((a, b) => d * ((RARITY_RANK[b.rarity] ?? 9) - (RARITY_RANK[a.rarity] ?? 9)) || byName(a, b));
        else if (sortBy === "new") hits.sort((a, b) => d * (patchNo(addedIn.get(a.id) ?? "") - patchNo(addedIn.get(b.id) ?? "")) || byName(a, b));
        else hits.sort((a, b) => d * byName(a, b));
        const tagOf = (a: typeof hits[number]) => (!!latest && addedIn.get(a.id) === latest ? "新" : changedNow.has(a.id) ? "改" : undefined);
        // 強度: the name over its rarity in the rarity's colour, the champions it suits as a stack at the end; the other sorts: the
        // effect line under the name, the rarity at the end. 新 / 改 is a badge on the icon either way
        const augRow = (g: HTMLElement, a: typeof hits[number], stack?: string[]) =>
            row(g, stack ? { image: a.icon, rarity: a.rarity, badge: tagOf(a), title: a.name, sub: a.rarity, subColor: RARITY_COLOR[a.rarity], stack, chevron: true, onTap: () => ctx.openAugment(a.id) }
                : { image: a.icon, rarity: a.rarity, badge: tagOf(a), title: a.name, sub: a.effect || undefined, value: a.rarity, chevron: true, clamp: true, onTap: () => ctx.openAugment(a.id) });
        if (sortBy === "tier") {
            // a heading per tier (the champion page's), then its rows; ↑ turns the tiers round (C first)
            const order = d === -1 ? [...TIERS, ""] : ["", ...TIERS.slice().reverse()];
            for (const t of order) {
                const part = hits.filter((a) => (strength.get(a.id)?.tier ?? "") === t);
                if (!part.length) continue;
                const head = tierHead(list, t || "未評級");
                h(head, "span", "mn-tier-n", `${part.length} 個強化`);
                const g = group(list);
                for (const a of part) {
                    const st = strength.get(a.id);
                    const faces = st?.top.map((cid) => store.champion(cid)?.icon).filter((x): x is string => !!x);
                    augRow(g, a, faces?.length ? faces : []);
                }
            }
        } else {
            const g = group(list);
            for (const a of hits) augRow(g, a);
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
