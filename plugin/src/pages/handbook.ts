import { empty, h, icon, page } from "../ui";
import type { PageCtx, PageOut } from "./index";

const SNIPPET = 46;      // characters of context around a match
const MAX_PER_NOTE = 2;  // matching lines shown per guide card
const CHARS_PER_MINUTE = 350;   // reading speed for the "N min" label (Chinese)
const KEYWORDS = 6;      // quick-search chips taken from the glossary
const TILE_COLORS = ["--color-blue", "--color-purple", "--color-orange", "--color-green", "--color-cyan", "--color-pink", "--color-yellow", "--color-red"];
const GLOSSARY = "名詞表";
const TRIVIA_AFTER = 4;   // topic cards above the lore trivia card

// a stable pseudo-random number from a whole number (the day, then +1 per tap)
const hash = (x: number): number => Math.imul(x ^ 0x9e3779b9, 2654435761) >>> 0;

// the first sentence of a champion's lore, kept to one line or two
function firstSentence(blurb: string): string {
    const s = blurb.split(/(?<=[。!?!?])/)[0] ?? blurb;
    return s.length > 64 ? s.slice(0, 62) + "…" : s;
}

// The Handbook: a short, friendly start page (where to begin, topic tiles with a read time, a small fact of the day) and a search over
// everything we have written (guide cards, champion tips and our own builds), so a detail read once can be found again in a couple of taps.
export function handbookPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const el = page("Handbook");
    const box = h(el, "div", "mn-search");
    icon(box, "search", "mn-search-ic");
    const search = h(box, "input");
    search.type = "search";
    search.placeholder = "Search anything you read here";
    const chips = h(el, "div", "mn-keys");
    const out = h(el, "div");
    const notes = store.guideNotes();
    let texts: Map<string, string[]> | null = null;   // guide note path -> its lines, read on the first search
    const read = new Set(ctx.plugin.settings.read);
    const minutes = (size: number) => Math.max(1, Math.round(size / 3 / CHARS_PER_MINUTE));   // UTF-8: about 3 bytes per Chinese character

    const load = async () => {
        if (texts) return texts;
        texts = new Map();
        for (const n of notes) texts.set(n.file.path, (await ctx.app.vault.cachedRead(n.file)).replace(/^---[\s\S]*?---\n/, "").split("\n").map(clean).filter(Boolean));
        return texts;
    };

    const home = () => {
        out.empty();
        if (!notes.length) { empty(out, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." }); return; }
        const done = notes.filter((n) => read.has(n.file.path)).length;

        // where to begin: the first card you have not opened (or a random one to review when you have read them all)
        const next = notes.find((n) => !read.has(n.file.path)) ?? notes[Math.floor(Math.random() * notes.length)];
        const hero = h(out, "button", "mn-hh");
        const body = h(hero, "div", "mn-hh-body");
        h(body, "div", "mn-hh-k", done >= notes.length ? "全部讀完了 🎉 再複習一下?" : done ? "接著看" : "從這裡開始");
        h(body, "div", "mn-hh-t", next.title);
        if (next.summary) h(body, "div", "mn-hh-s", next.summary);
        const go = h(body, "span", "mn-hh-go", `${minutes(next.file.stat.size)} 分鐘 · 開始 →`);
        void go;
        const ic = h(hero, "div", "mn-hh-ic");
        icon(ic, next.icon);
        const prog = h(out, "div", "mn-prog");
        const bar = h(h(prog, "div", "mn-prog-track"), "div", "mn-prog-fill");
        bar.style.width = `${(done / notes.length) * 100}%`;
        h(prog, "div", "mn-prog-t", `${done} / ${notes.length}`);
        hero.addEventListener("click", (e) => { e.preventDefault(); ctx.openNote(next.file.path); });

        // topic cards in two groups with a lore trivia card between them (like a loading screen)
        const tile = (grid: HTMLElement, n: (typeof notes)[number], i: number) => {
            const t = h(grid, "button", "mn-ht");
            t.style.setProperty("--c", `var(${TILE_COLORS[i % TILE_COLORS.length]})`);
            const top = h(t, "div", "mn-ht-top");
            icon(h(top, "span", "mn-ht-ic"), n.icon);
            if (read.has(n.file.path)) icon(h(top, "span", "mn-ht-done"), "check");
            h(t, "div", "mn-ht-t", n.title);
            if (n.summary) h(t, "div", "mn-ht-s", n.summary);
            h(t, "div", "mn-ht-m", n.layout === "deck" ? `${minutes(n.file.stat.size)} 分鐘` : "查詢");
            t.addEventListener("click", (e) => { e.preventDefault(); ctx.openNote(n.file.path); });
        };
        const first = h(out, "div", "mn-ht-grid");
        notes.slice(0, TRIVIA_AFTER).forEach((n, i) => tile(first, n, i));
        trivia(out);
        if (notes.length > TRIVIA_AFTER) {
            const rest = h(out, "div", "mn-ht-grid");
            notes.slice(TRIVIA_AFTER).forEach((n, i) => tile(rest, n, i + TRIVIA_AFTER));
        }
    };

    // "你知道嗎?": one line of a champion's lore on its splash art; tap for the next one
    const trivia = (parent: HTMLElement) => {
        const champs = store.champions().filter((c) => c.blurb);
        if (!champs.length) return;
        let n = Math.floor(Date.now() / 86_400_000);
        const card = h(parent, "button", "mn-trv");
        const draw = () => {
            card.empty();
            const c = champs[hash(n) % champs.length];
            const bg = h(card, "div", "mn-trv-bg");
            bg.style.backgroundImage = `url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg")`;
            const body = h(card, "div", "mn-trv-body");
            h(body, "div", "mn-trv-k", "你知道嗎?");
            h(body, "div", "mn-trv-t", `${c.name} · ${c.title}`);
            h(body, "div", "mn-trv-s", firstSentence(c.blurb));
            icon(h(card, "span", "mn-trv-next"), "refresh-cw");
        };
        card.addEventListener("click", (e) => { e.preventDefault(); n += 1; draw(); });
        draw();
    };

    // quick-search chips: the glossary's terms
    const keywords = async () => {
        const g = notes.find((n) => n.title === GLOSSARY);
        if (!g) return;
        const terms = ((await load()).get(g.file.path) ?? []).map((l) => l.split(/[:：]/)[0].trim()).filter((t) => t && t.length <= 8).slice(0, KEYWORDS);
        for (const t of terms) {
            const b = h(chips, "button", "mn-key", t);
            b.addEventListener("click", (e) => { e.preventDefault(); search.value = t; void results(t.toLowerCase()); });
        }
    };

    const results = async (q: string) => {
        const lines = await load();
        if (search.value.trim().toLowerCase() !== q) return;   // typed on while the notes were being read
        out.empty();
        let found = 0;
        const guide = notes.map((n) => ({ n, lines: (lines.get(n.file.path) ?? []).filter((l) => l.toLowerCase().includes(q)), title: n.title.toLowerCase().includes(q) }))
            .filter((x) => x.title || x.lines.length);
        const sect = (title: string) => { h(out, "div", "mn-gh", title); return h(out, "div", "mn-group"); };
        if (guide.length) {
            const g = sect("Guide");
            for (const { n, lines: ls } of guide) {
                const r = h(g, "div", "mn-row is-tap");
                icon(r, n.icon, "mn-row-ic");
                const main = h(r, "div", "mn-row-main");
                h(main, "div", "mn-row-t", n.title);
                for (const l of ls.slice(0, MAX_PER_NOTE)) marked(h(main, "div", "mn-row-s"), snippet(l, q), q);
                icon(r, "chevron-right", "mn-row-chev");
                r.addEventListener("click", () => ctx.openNote(n.file.path));
                found++;
            }
        }
        const tipHits = store.champions().flatMap((c) => c.tips.filter((t) => `${t.title} ${t.text}`.toLowerCase().includes(q)).map((t) => ({ c, t })));
        if (tipHits.length) {
            const g = sect("Tips");
            for (const { c, t } of tipHits) {
                const r = h(g, "div", "mn-row is-tap");
                const im = h(r, "img", "mn-row-img"); im.src = c.icon; im.alt = "";
                const main = h(r, "div", "mn-row-main");
                h(main, "div", "mn-row-t", `${c.name}:${t.title}`);
                marked(h(main, "div", "mn-row-s"), snippet(t.text, q), q);
                icon(r, "chevron-right", "mn-row-chev");
                r.addEventListener("click", () => ctx.openChampion(c.id, "tips"));
                found++;
            }
        }
        const buildHits = store.champions().flatMap((c) => c.builds.filter((b) => `${b.name} ${b.note}`.toLowerCase().includes(q)).map((b) => ({ c, b })));
        if (buildHits.length) {
            const g = sect("Builds");
            for (const { c, b } of buildHits) {
                const r = h(g, "div", "mn-row is-tap");
                const im = h(r, "img", "mn-row-img"); im.src = c.icon; im.alt = "";
                const main = h(r, "div", "mn-row-main");
                h(main, "div", "mn-row-t", `${c.name}:${b.name}`);
                if (b.note) marked(h(main, "div", "mn-row-s"), snippet(b.note, q), q);
                icon(r, "chevron-right", "mn-row-chev");
                r.addEventListener("click", () => ctx.openChampion(c.id, "build"));
                found++;
            }
        }
        if (!found) empty(out, { icon: "search-x", title: "Nothing found", text: "Try a shorter word." });
    };

    search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        if (!q) home(); else void results(q);
    });
    home();
    void keywords();
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
