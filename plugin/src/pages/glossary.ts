import type { TFile } from "obsidian";
import { DAMAGE_COLOR, DAMAGE_ICON, ITEM_CAT_COLOR, STAT_COLOR, STAT_ICON, empty, fixedPage, h, icon } from "../ui";
import { tagInfo } from "./profile";
import type { PageCtx, PageOut } from "./index";

// Each term's icon and colour: the same idea keeps the icon it has everywhere else (damage kinds, stats, ability tags; Dev Tools/Icons.md);
// the terms that are only here have their own row in the Icons note's 名詞表 list.
const OWN: Record<string, [string, string]> = {
    AD: [DAMAGE_ICON["物理"], DAMAGE_COLOR["物理"]], AP: [DAMAGE_ICON["魔法"], DAMAGE_COLOR["魔法"]],
    護甲: [STAT_ICON["護甲"], STAT_COLOR["護甲"]], 魔抗: [STAT_ICON["魔防"], STAT_COLOR["魔防"]], 冷卻: [STAT_ICON["技能急速"], STAT_COLOR["技能急速"]],
    消耗: ["droplet", ITEM_CAT_COLOR["魔力"]],
    普攻: ["mouse-pointer-click", "var(--mn-text)"], 爆發: ["zap", "var(--mn-exec)"],
    前排: ["brick-wall", "var(--mn-guard)"], 後排: ["telescope", "var(--mn-phys)"], 開團: ["flag", "var(--mn-accent)"], 風箏: ["rewind", "var(--mn-dash)"],
    增幅裝置: ["sparkles", "var(--mn-accent)"], 回血包: ["package-plus", "var(--mn-heal)"],
};
const termArt = (term: string): [string, string] => {
    const key = term.split(/[（(]/)[0].trim();
    const tag = tagInfo(key);
    return OWN[key] ?? (tag ? [tag.icon, tag.color] : ["book-a", "var(--mn-muted)"]);
};
// The note's own words without the Markdown marks (bold, links)
const plain = (s: string) => s.replace(/[*_`]/g, "").replace(/!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, a: string, b?: string) => b ?? a).trim();

interface Term { term: string; text: string }
// `## group` headings, then `- **term**：meaning` lines
function parse(text: string): { group: string; terms: Term[] }[] {
    const out: { group: string; terms: Term[] }[] = [];
    for (const line of text.replace(/^---[\s\S]*?---\n/, "").split("\n")) {
        const g = /^##\s+(.+)/.exec(line);
        if (g) { out.push({ group: g[1].trim(), terms: [] }); continue; }
        const t = /^\s*[-*]\s+\*\*(.+?)\*\*\s*[:：]\s*(.+)$/.exec(line);
        if (!t) continue;
        if (!out.length) out.push({ group: "", terms: [] });
        out[out.length - 1].terms.push({ term: plain(t[1]), text: plain(t[2]) });
    }
    return out.filter((g) => g.terms.length);
}

// The glossary (名詞表): one list under group headings that stay on top while their rows scroll; each row has the term's icon in its
// colour, the term and what it means. The search capsule at the bottom, where the thumb is (like Picks), narrows the list as you type.
export function glossaryPage(ctx: PageCtx, file: TFile): PageOut {
    const el = h(null, "div", "mn-page mn-glpage");
    fixedPage(el, ctx.component);
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
    const list = h(el, "div", "mn-rq-list mn-gl");
    const dock = h(el, "div", "mn-rq-dock");
    const cap = h(dock, "div", "mn-rq-cap");
    icon(cap, "search", "mn-rq-cap-ic");
    const search = h(cap, "input");
    search.type = "search";
    search.placeholder = "找一個詞";
    search.setAttribute("enterkeyhint", "search");
    const mic = h(cap, "button", "mn-rq-mic");   // as on Picks: opens the keyboard, whose own mic key listens
    icon(mic, "mic");
    mic.setAttribute("aria-label", "用鍵盤的麥克風說");
    mic.addEventListener("click", (e) => { e.preventDefault(); search.focus(); });

    let groups: { group: string; terms: Term[] }[] = [];
    const draw = () => {
        list.empty();
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        for (const g of groups) {
            const hits = g.terms.filter((t) => !q || t.term.toLowerCase().includes(q) || t.text.toLowerCase().includes(q));
            if (!hits.length) continue;
            const sec = h(list, "section", "mn-gl-sec");
            if (g.group) h(sec, "div", "mn-gl-head", g.group);
            for (const t of hits) {
                const r = h(sec, "div", "mn-gl-row");
                const [ic, color] = termArt(t.term);
                const tile = h(r, "span", "mn-gl-ic");
                tile.style.setProperty("--c", color);
                icon(tile, ic);
                const words = h(r, "div", "mn-gl-words");
                h(words, "b", undefined, t.term);
                h(words, "span", undefined, t.text);
                shown++;
            }
        }
        if (!shown) empty(list, { icon: "search-x", title: "找不到這個詞" });
    };
    search.addEventListener("input", draw);
    void ctx.app.vault.cachedRead(file).then((text) => { groups = parse(text); draw(); });
    return { title: "", el };
}
