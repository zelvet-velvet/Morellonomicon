import { empty, h, icon, page } from "../ui";
import type { PageCtx, PageOut } from "./index";

const SNIPPET = 46;      // characters of context around a match
const MAX_PER_NOTE = 2;  // matching lines shown per guide card
const KEYWORDS = 8;      // quick-search chips taken from the glossary (two full rows of four)
const GLOSSARY = "名詞表";
// A topic's cover picture from its `cover:` frontmatter: a champion id (its splash art) or `map <name>` (an ARAM loading screen)
export const coverUrl = (cover: string): string => {
    const [a, b] = cover.trim().split(/\s+/);
    if (!a) return "";
    return a === "map" ? mapUrl(b)
        : `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(a)}_0.jpg`;
};
// An ARAM map's loading screen picture by name, or one of the three at random
export const mapUrl = (name?: string): string => {
    const n = name || ["habackground", "arambilgewater", "arambloom"][Math.floor(Math.random() * 3)];
    return `https://raw.communitydragon.org/latest/game/assets/ux/loadingscreen/${n}.png`;
};
// the game's ARAM loading screen backgrounds (CommunityDragon, shown by address): Howling Abyss, Butcher's Bridge, the Ionian bridge
const ARAM_ART = ["habackground", "arambilgewater", "arambloom"].map((n) => `https://raw.communitydragon.org/latest/game/assets/ux/loadingscreen/${n}.png`);

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

    const load = async () => {
        if (texts) return texts;
        texts = new Map();
        for (const n of notes) texts.set(n.file.path, (await ctx.app.vault.cachedRead(n.file)).replace(/^---[\s\S]*?---\n/, "").split("\n").map(clean).filter(Boolean));
        return texts;
    };

    // The loading screen on top (an ARAM map with a tip on it), then two blocks of topics, 初來乍到 (the basics) and 高手必備 (advanced):
    // in each, an odd number of topics shows the next one to read large and the rest two across, an even number is all two across
    // (✓ when read). The glossary is the i button on a topic's page.
    const home = () => {
        out.empty();
        if (!notes.length) { empty(out, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." }); return; }
        trivia(out);
        const decks = notes.filter((n) => n.layout === "deck");
        const block = (name: string, list: typeof decks) => {
            if (!list.length) return;
            const done = list.filter((n) => read.has(n.file.path)).length;
            const next = list.length % 2 ? list.find((n) => !read.has(n.file.path)) : undefined;
            const head = h(out, "div", "mn-hb-head");
            h(head, "span", "mn-hb-k", name);
            h(head, "span", "mn-hb-n", done >= list.length ? "全部讀完了" : `${done} / ${list.length}`);
            h(h(out, "div", "mn-hb-track"), "div", "mn-hb-fill").style.width = `${(done / list.length) * 100}%`;
            const tile = (parent: HTMLElement, n: (typeof notes)[number], big: boolean) => {
                const b = h(parent, "button", "mn-hb-tile" + (big ? " is-big" : "") + (read.has(n.file.path) ? " is-read" : ""));
                const url = coverUrl(n.cover);
                if (url) { const im = h(b, "img", "mn-hb-art"); im.alt = ""; im.loading = "lazy"; im.onerror = () => im.remove(); im.src = url; }   // no picture: the plain tile
                const txt = h(b, "div", "mn-hb-ov");
                const num = String(list.indexOf(n) + 1).padStart(2, "0");
                h(txt, "div", "mn-hb-kn", big ? `${done ? "繼續" : "開始"} · ${num}` : read.has(n.file.path) ? `✓ ${num}` : num);
                h(txt, "div", "mn-hb-t", n.title);
                if (big && n.summary) h(txt, "div", "mn-hb-s", n.summary);
                b.addEventListener("click", (e) => { e.preventDefault(); ctx.openNote(n.file.path); });
            };
            if (next) tile(out, next, true);
            const rest = list.filter((n) => n !== next);
            if (rest.length) { const grid = h(out, "div", "mn-hb-grid"); rest.forEach((n) => tile(grid, n, false)); }
        };
        block("初來乍到", decks.filter((n) => n.level !== "advanced"));
        block("高手必備", decks.filter((n) => n.level === "advanced"));
    };

    // a loading screen tip (the game's own text) in the middle of one of ARAM's three loading screen backgrounds, dimmed: a random
    // map and tip each visit; a tap shows another tip on the same map, none comes back until all were shown
    const trivia = (parent: HTMLElement) => {
        const tips = store.loadingTips;
        if (!tips.length) return;
        const order = tips.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        let n = 0;
        const art = Math.floor(Math.random() * ARAM_ART.length);
        const card = h(parent, "button", "mn-trv");
        const bg = h(card, "div", "mn-trv-bg");
        const text = h(card, "div", "mn-trv-tip");
        icon(h(card, "span", "mn-trv-next"), "refresh-cw");
        const draw = () => {
            text.textContent = tips[order[n % order.length]].text;
            const url = ARAM_ART[art];
            if (bg.dataset.url === url) return;
            bg.dataset.url = url;
            bg.removeClass("is-in");
            const img = new Image();
            img.onload = () => { bg.style.backgroundImage = `url("${url}")`; bg.addClass("is-in"); };   // the tip shows at once; the picture fades in under it
            img.src = url;
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
