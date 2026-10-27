import { empty, group, h, icon, page, row } from "../ui";
import { rememberSub, type SubTab } from "./champions";
import type { PageCtx, PageOut } from "./index";

const SNIPPET = 46;      // characters of context around a match
const MAX_PER_NOTE = 2;  // matching lines shown per guide card

// The Handbook: the beginner cards, and a search over everything we have written (guide cards, champion tips and our own builds),
// so a detail read once can be found again in a couple of taps.
export function handbookPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("Handbook");
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search the handbook, e.g. 控場, 護甲";
    const out = h(el, "div");
    const notes = store.guideNotes();
    let texts: Map<string, string[]> | null = null;   // guide note path -> its lines, read on the first search

    const openChampion = (id: string, name: string, sub: SubTab) => {
        rememberSub(id, sub);
        ctx.goTab("champions");
        ctx.push({ key: "champion", title: name, params: { id } });
    };

    const cards = () => {
        out.empty();
        if (!notes.length) { empty(out, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." }); return; }
        const g = group(out);
        for (const n of notes) row(g, { icon: n.icon, title: n.title, sub: n.summary || undefined, chevron: true, onTap: () => ctx.openNote(n.file.path) });
    };

    const results = async (q: string) => {
        if (!texts) {
            texts = new Map();
            for (const n of notes) texts.set(n.file.path, (await ctx.app.vault.cachedRead(n.file)).replace(/^---[\s\S]*?---\n/, "").split("\n").map(clean).filter(Boolean));
        }
        if (search.value.trim().toLowerCase() !== q) return;   // typed on while the notes were being read
        out.empty();
        let found = 0;
        const guide = notes.map((n) => ({ n, lines: (texts!.get(n.file.path) ?? []).filter((l) => l.toLowerCase().includes(q)), title: n.title.toLowerCase().includes(q) }))
            .filter((x) => x.title || x.lines.length);
        if (guide.length) {
            const g = group(out, "Guide");
            for (const { n, lines } of guide) {
                const r = row(g, { icon: n.icon, title: n.title, chevron: true, onTap: () => ctx.openNote(n.file.path) });
                const main = r.querySelector(".mn-row-main") as HTMLElement;
                for (const l of lines.slice(0, MAX_PER_NOTE)) marked(h(main, "div", "mn-row-s"), snippet(l, q), q);
                found++;
            }
        }
        const tipHits = store.champions().flatMap((c) => c.tips.filter((t) => `${t.title} ${t.text}`.toLowerCase().includes(q)).map((t) => ({ c, t })));
        if (tipHits.length) {
            const g = group(out, "Tips");
            for (const { c, t } of tipHits) {
                const r = row(g, { image: c.icon, title: `${c.name}:${t.title}`, chevron: true, onTap: () => openChampion(c.id, c.name, "tips") });
                marked(h(r.querySelector(".mn-row-main") as HTMLElement, "div", "mn-row-s"), snippet(t.text, q), q);
                found++;
            }
        }
        const buildHits = store.champions().flatMap((c) => c.builds.filter((b) => `${b.name} ${b.note}`.toLowerCase().includes(q)).map((b) => ({ c, b })));
        if (buildHits.length) {
            const g = group(out, "Builds");
            for (const { c, b } of buildHits) {
                const r = row(g, { image: c.icon, title: `${c.name}:${b.name}`, chevron: true, onTap: () => openChampion(c.id, c.name, "build") });
                if (b.note) marked(h(r.querySelector(".mn-row-main") as HTMLElement, "div", "mn-row-s"), snippet(b.note, q), q);
                found++;
            }
        }
        if (!found) empty(out, { icon: "search-x", title: "Nothing found", text: "Try a shorter word." });
    };

    search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        if (!q) cards(); else void results(q);
    });
    cards();
    return { title: "Handbook", el };
}

// Markdown to plain text for a search line
const clean = (l: string) => l.replace(/^\s*(?:[-*]|\d+\.|>)\s*/, "").replace(/[*_`]/g, "").replace(/!?\[\[?([^\]|]*)(?:\|[^\]]*)?\]\]?/g, "$1").trim();

function snippet(line: string, q: string): string {
    const i = line.toLowerCase().indexOf(q);
    if (i < 0 || line.length <= SNIPPET * 2) return line;
    const from = Math.max(0, i - SNIPPET), to = Math.min(line.length, i + q.length + SNIPPET);
    return (from ? "…" : "") + line.slice(from, to) + (to < line.length ? "…" : "");
}

// the text with every match of q highlighted (text nodes only, never HTML)
function marked(parent: HTMLElement, text: string, q: string): void {
    const lower = text.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
        if (i > at) parent.appendChild(document.createTextNode(text.slice(at, i)));
        h(parent, "mark", "mn-hl", text.slice(i, i + q.length));
        at = i + q.length;
    }
    if (at < text.length) parent.appendChild(document.createTextNode(text.slice(at)));
}
