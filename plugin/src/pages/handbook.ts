import { SWIPE, blockLoad, blockUntil, empty, h, icon, page } from "../ui";
import { parseSlides } from "./deck";
import type { PageCtx, PageOut } from "./index";
import { preloadClip } from "./skills";

const SNIPPET = 46;      // characters of context around a match
const MAX_PER_NOTE = 2;  // matching lines shown per guide card
const KEYWORDS = 8;      // quick-search chips taken from the glossary (two full rows of four)
const GLOSSARY = "名詞表";
const TRIVIA_TILT = 10;   // degrees the tip card tilts per card width it is dragged
const TRIVIA_MS = 300;    // how long the card takes to leave or spring back
const WARM_CLIPS = 3;       // clips of a topic downloaded ahead of time (its first cards)
const WARM_DELAY_MS = 1500; // after the home is shown
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
    const home = (): Promise<void> | null => {
        out.empty();
        if (!notes.length) { empty(out, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." }); return null; }
        const triviaHost = h(out, "div");   // the tip stack loads as a block of its own
        const tipsReady = trivia(triviaHost);
        if (tipsReady) blockUntil(triviaHost, tipsReady);
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
                if (url) { const im = h(b, "img", "mn-hb-art"); im.alt = ""; im.onerror = () => im.remove(); im.src = url; }   // no picture: the plain tile
                const txt = h(b, "div", "mn-hb-ov");
                const num = String(list.indexOf(n) + 1).padStart(2, "0");
                h(txt, "div", "mn-hb-kn", big ? `${done ? "繼續" : "開始"} · ${num}` : read.has(n.file.path) ? `✓ ${num}` : num);
                h(txt, "div", "mn-hb-t", n.title);
                if (big && n.summary) h(txt, "div", "mn-hb-s", n.summary);
                b.addEventListener("click", (e) => { e.preventDefault(); ctx.openNote(n.file.path); });
            };
            // each group of topic tiles loads as a block of its own, under its heading
            const tiles = h(out, "div");
            if (next) tile(tiles, next, true);
            const rest = list.filter((n) => n !== next);
            if (rest.length) { const grid = h(tiles, "div", "mn-hb-grid"); rest.forEach((n) => tile(grid, n, false)); }
            blockLoad(tiles);
        };
        block("初來乍到", decks.filter((n) => n.level !== "advanced"));
        block("高手必備", decks.filter((n) => n.level === "advanced"));
        return tipsReady;
    };

    // The "did you know" stack: the game's own loading screen tips, each on one of ARAM's loading screens, dimmed. Two cards lie
    // on top of each other (the next tip fully covered); swipe the top one away to either side and the next tip is there, and a
    // new one slips under it. Returns when the picture has loaded, so the page does not show an empty frame.
    const trivia = (parent: HTMLElement): Promise<void> | null => {
        const tips = store.loadingTips;
        if (!tips.length) return null;
        const order = tips.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const url = ARAM_ART[Math.floor(Math.random() * ARAM_ART.length)];
        const stack = h(parent, "div", "mn-trv-stack");
        const make = (i: number, z: number): HTMLElement => {
            const c = h(stack, "div", "mn-trv");
            c.style.backgroundImage = `url("${url}")`;
            c.style.zIndex = String(z);
            h(c, "div", "mn-trv-tip", tips[order[i % order.length]].text);
            return c;
        };
        let n = 0, top = make(0, 2), under = make(1, 1);
        let busy = false, pid = -1, x0 = 0, y0 = 0, t0 = 0, dx = 0, lastY = 0, mode: "" | "x" | "y" = "";
        const scroller = () => stack.closest<HTMLElement>(".mn-scroll");
        for (const ev of ["touchstart", "touchmove"]) stack.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });   // Obsidian's edge swipes stay out
        const pose = (x: number) => { top.style.transform = `translateX(${x.toFixed(1)}px) rotate(${(x / Math.max(1, stack.clientWidth) * TRIVIA_TILT).toFixed(2)}deg)`; };
        stack.addEventListener("pointerdown", (e) => {
            if (busy || pid !== -1 || (e.pointerType === "mouse" && e.button !== 0)) return;
            pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; lastY = e.clientY; t0 = e.timeStamp; dx = 0; mode = "";
        });
        stack.addEventListener("pointermove", (e) => {
            if (e.pointerId !== pid) return;
            dx = e.clientX - x0;
            const dy = e.clientY - y0;
            if (!mode) {
                if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return;
                mode = Math.abs(dx) > Math.abs(dy) * SWIPE.bias ? "x" : "y";   // a slightly diagonal swipe still counts as sideways
                stack.setPointerCapture(pid);
                if (mode === "x") top.style.transition = "none";
            }
            if (mode === "x") pose(dx);
            else { scroller()?.scrollBy(0, lastY - e.clientY); }   // the block takes every touch (so a swipe is never cancelled by the page), and passes vertical moves on
            lastY = e.clientY;
        });
        const end = (e: PointerEvent) => {
            if (e.pointerId !== pid) return;
            pid = -1;
            const m = mode;
            mode = "";
            if (m !== "x") return;
            const w = stack.clientWidth, v = dx / Math.max(1, e.timeStamp - t0);
            const far = Math.abs(dx) > SWIPE.at * w || (Math.abs(v) > SWIPE.flick && Math.abs(dx) > SWIPE.flickMin);
            top.style.transition = `transform ${TRIVIA_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${TRIVIA_MS}ms`;
            if (!far) { top.style.transform = ""; return; }
            busy = true;
            const gone = top, dir = dx < 0 ? -1 : 1;
            gone.style.transform = `translateX(${dir * w * 1.3}px) rotate(${dir * TRIVIA_TILT * 1.2}deg)`;
            window.setTimeout(() => {
                gone.remove();
                top = under; top.style.zIndex = "2";
                n += 1;
                under = make(n + 1, 1);
                busy = false;
            }, TRIVIA_MS);
        };
        stack.addEventListener("pointerup", end);
        stack.addEventListener("pointercancel", end);
        return new Promise((done) => { const im = new Image(); im.onload = im.onerror = () => done(); im.src = url; });
    };

    // quick-search chips: the glossary's terms
    const keywords = async () => {
        const g = notes.find((n) => n.title === GLOSSARY);
        if (!g) return;
        // a hidden chip holds the row's height until the real ones are read, so the page below does not jump when they arrive
        const spacer = h(chips, "button", "mn-key", "AD");
        spacer.style.visibility = "hidden";
        const terms = ((await load()).get(g.file.path) ?? []).map((l) => l.split(/[:：]/)[0].trim()).filter((t) => t && t.length <= 8).slice(0, KEYWORDS);
        spacer.remove();
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
        if (!q) void home(); else void results(q);
    });
    // while you look at the home, the first clips of the topic to read next in each block are downloaded one by one, so opening it
    // shows the cards at once (nothing is fetched on a data-saver connection)
    const warm = () => {
        if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
        const decks = notes.filter((n) => n.layout === "deck");
        const next = [decks.filter((n) => n.level !== "advanced"), decks.filter((n) => n.level === "advanced")].flatMap((list) => list.find((n) => !read.has(n.file.path)) ?? []);
        void (async () => {
            for (const n of next) {
                const md = await ctx.app.vault.cachedRead(n.file);
                const clips = parseSlides(md).slice(0, WARM_CLIPS).flatMap((s) => {
                    const [kind, id, key] = s.visual.split(/\s+/);
                    const c = id ? store.champion(id) : undefined;
                    return (kind === "video" || kind === "clip") && c ? [{ c, key: key ?? "Q" }] : [];
                });
                for (const { c, key } of clips) await preloadClip(c, key);
            }
        })();
    };
    window.setTimeout(warm, WARM_DELAY_MS);
    home();
    void keywords();
    // the page shows at once; the tip stack and each group of tiles load as blocks of their own
    return { title: "Handbook", el, ready: null };
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
