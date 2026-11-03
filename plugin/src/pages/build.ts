import type { BuildPick, ChampBuilds, Champion } from "../data/store";
import { chip, empty, h, moreLink, goes, styleSwitch } from "../ui";
import { metaLine } from "./fresh";
import type { PageCtx } from "./index";
import { art } from "../media";

const TOP_SETS = 3;
const TOP_ITEMS = 8;
const pct = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0);

// The Build sub-tab: the Mayhem build worked out from the kit (main build and alternatives, per play style), what people really build
// (counted from matches), our own picks, fun alternatives, and builds for playing with a teammate.
export function buildTab(page: HTMLElement, c: Champion, ctx: PageCtx): void {
    // the builds in one part (the champion page centres it down the page), the Live stats links after it (at the page's foot)
    const body = h(page, "div", "mn-bt-main");
    const store = ctx.plugin.store;
    const mode = ctx.plugin.settings.mode;
    const stats = store.stats?.champions[c.id];
    const mine = c.builds.filter((b) => b.mode === mode);
    const meta = mine.filter((b) => b.kind === "meta");
    const alt = mine.filter((b) => b.kind === "alt");
    const synergy = mine.filter((b) => b.kind === "synergy");
    const reasoned = mode === "mayhem" ? store.itemBuilds[c.id] : undefined;
    if (reasoned?.styles.length) { body.remove(); mayhemBuilds(page, c, ctx, reasoned); return; }

    if (stats || meta.length) {
        section(body, "常用");
        if (stats) {
            const top = h(body, "div", "mn-chips");
            chip(top, `${stats.games} 場`);
            chip(top, `勝率 ${pct(stats.wins, stats.games)}%`, { color: "var(--color-green)" });
            if (store.stats?.date) chip(top, store.stats.date);
            for (const s of stats.sets.slice(0, TOP_SETS)) {
                const card = h(body, "div", "mn-set");
                itemRow(card, c, ctx, s.items);
                h(card, "div", "mn-set-m", `${s.games} 場 · 勝率 ${pct(s.wins, s.games)}%`);
            }
            const card = h(body, "div", "mn-set");
            h(card, "div", "mn-set-t", "最常出的裝備");
            itemRow(card, c, ctx, stats.items.slice(0, TOP_ITEMS).map((i) => i.id), stats.items.slice(0, TOP_ITEMS).map((i) => `${pct(i.games, stats.games)}%`));
        }
        for (const b of meta) setCard(body, c, ctx, b);
    }
    if (alt.length) { section(body, "有趣替代"); for (const b of alt) setCard(body, c, ctx, b); }
    if (synergy.length) { section(body, "搭配"); for (const b of synergy) setCard(body, c, ctx, b); }
    if (!stats && !mine.length) empty(body, { icon: "package-open", title: "No builds of ours yet", text: "Our own builds and ideas for this champion will appear here." });
    if (mode === "mayhem") liveStats(h(page, "div", "mn-bt-live"), c);
}

// Live win rates and builds live on other sites; we only link to them (their terms do not allow copying their numbers).
const OPGG_SLUG: Record<string, string> = { MonkeyKing: "wukong" };   // ids that differ from the site's address
function liveStats(body: HTMLElement, c: Champion): void {
    const slug = OPGG_SLUG[c.id] ?? c.id.toLowerCase();
    section(body, "Live stats");
    // accent links, no panel (Design Rules, champion page family)
    const links = h(body, "div", "mn-bt-links");
    moreLink(links, "OP.GG", () => window.open(`https://op.gg/lol/modes/aram-mayhem/${slug}/build`));
    moreLink(links, "Mobalytics", () => window.open(`https://mobalytics.gg/lol/champions/${slug}/mayhem-builds`));
}

function section(body: HTMLElement, title: string): void { h(body, "div", "mn-gh", title); }

// the border the game puts on the item 命定武器 grows (CommunityDragon, shown by address)
const DESTINY_FRAME = "https://raw.communitydragon.org/latest/game/assets/items/itemmodifiers/strawberry_weapon_evolve_border.png";

// The Mayhem builds (tools/build_tiers.py), in buying order on a fixed five-column grid (Layouts, 出裝, Zaviel 2026-11-03): the play
// style words, how it plays and the tapped item (name, what it is for, why) on top, each in a box of fixed height; then three rows of
// item cells, every cell alike (icon, name, what it is for): 前兩件 and 或這兩件 (another pair of the style), 第三件 and 鞋子 · 命定,
// 4–6 件. Empty cells keep their place, so switching the style (its words or a tap on a side) moves nothing.
const COLS = 5;
const POOL_ORDER = ["輸出", "生存", "穿透", "功能", "機動", "重創"];
function mayhemBuilds(page: HTMLElement, c: Champion, ctx: PageCtx, b: ChampBuilds): void {
    const store = ctx.plugin.store;
    const name = (id: number) => store.item(id)?.name ?? `#${id}`;
    const root = h(page, "div", "mn-mbp");
    styleSwitch(root, b.styles, (s) => draw(b.styles.indexOf(s)));   // the words, and a tap on the page's left or right side
    const how = h(root, "div", "mn-mbp-how");
    const say = h(root, "div", "mn-mbp-say");
    const grid = h(root, "div", "mn-mbp-grid");
    let lit: HTMLElement | null = null;
    const explain = (p: BuildPick, word: string, ic: HTMLElement, text = p.reason) => {
        lit?.removeClass("is-lit");
        lit = ic;
        ic.addClass("is-lit");
        say.empty();
        const top = h(say, "div", "mn-mbp-tn");
        const nm = h(top, "button", "mn-mbp-open", `${name(p.id)} ›`);
        nm.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(p.id); });
        if (word) h(top, "span", "mn-mbp-word", word);
        h(say, "div", "mn-mbp-text", p.when ? `${p.when}：${text}` : text);
    };
    // a heading over `span` columns (blank keeps the place)
    const head = (label: string, span: number) => { const el = h(grid, "div", "mn-mbp-h", label); el.style.gridColumn = `span ${span}`; };
    const gap = () => h(grid, "div", "mn-mbp-slot");
    const word = (p: BuildPick) => (p.when ? p.when.replace(/時$/, "") : p.need ?? "");
    const cell = (p: BuildPick | undefined, w = p ? word(p) : "", opts: { text?: string; destiny?: boolean } = {}) => {
        if (!p) { gap(); return null; }
        const btn = h(grid, "button", "mn-mbp-cell");
        const ic = itemIcon(btn, c, ctx, p.id, opts.destiny);
        h(btn, "span", "mn-mbp-cn", name(p.id));
        h(btn, "span", "mn-mbp-cap", w);
        btn.addEventListener("click", (e) => { e.preventDefault(); explain(p, w, ic, opts.text); });
        return ic;
    };
    const draw = (n: number) => {
        const st = b.styles[n];
        how.setText(st.why || (st.games ? "" : "依技能組推算的出裝"));
        grid.empty();
        lit = null;
        // row 1: the core pair, then another pair of the style
        const alt = st.alts?.[0];
        head("前兩件", 2); head("", 1); head(alt ? "或這兩件" : "", 2);
        const first = cell(st.core[0]);
        cell(st.core[1]);
        h(grid, "div", "mn-mbp-or", alt ? "或" : "");
        cell(alt?.[0]); cell(alt?.[1]);
        // row 2: the third item's choices, boots and 命定武器
        head("第三件 (選一)", 3); head("鞋子 · 命定", 2);
        for (let i = 0; i < 3; i++) cell(st.third[i]);
        cell(st.boots ?? undefined);
        const grows = (st.destiny.grows ?? []).slice(0, 3);
        cell(st.destiny, "命定", { destiny: true,
            text: `拿到命定武器時第一件出它，每次參與擊殺${grows.length ? grows.join("、") : "屬性"}永久提升。${st.destiny.reason}` });
        // row 3: items four to six, like with like (看情況 last)
        head("4–6 件 (挑三件)", COLS);
        const rank = (p: BuildPick) => (p.when ? 99 : POOL_ORDER.indexOf(p.need ?? "輸出"));
        const late = [...st.late].sort((x, y) => rank(x) - rank(y));
        for (let i = 0; i < COLS; i++) cell(late[i]);
        for (const s of b.special) {   // hand builds the games cannot show (鎖子甲 ×6)
            head(s.name, COLS);
            const ids = [...new Set(s.items)];   // ×6 of one item is in its name
            for (let i = 0; i < COLS; i++) cell(ids[i] !== undefined ? { id: ids[i], reason: s.note } : undefined, s.name);
        }
        if (first) explain(st.core[0], word(st.core[0]), first);
    };
    draw(0);
}

// an item picture; 命定武器's gets the game's rainbow border drawn over it
function itemIcon(parent: HTMLElement, c: Champion, ctx: PageCtx, id: number, destiny = false): HTMLElement {
    const item = ctx.plugin.store.item(id);
    const box = h(parent, "span", "mn-mb-ic" + (destiny ? " is-destiny" : ""));
    const im = h(box, "img");
    im.src = item?.icon || art.item(c.patch, id);
    im.alt = item?.name ?? "";
    if (destiny) box.style.setProperty("--mn-frame", `url("${DESTINY_FRAME}")`);
    return box;
}

function setCard(body: HTMLElement, c: Champion, ctx: PageCtx, b: Champion["builds"][number]): void {
    const card = h(body, "div", "mn-set");
    if (b.name) h(card, "div", "mn-set-t", b.name);
    if (b.with.length) {   // the teammates this build is for
        const row = h(card, "div", "mn-with");
        for (const id of b.with) {
            const mate = ctx.plugin.store.champion(id);
            const btn = h(row, "button", "mn-with-b");
            const im = h(btn, "img"); im.src = mate?.icon ?? ""; im.alt = "";
            h(btn, "span", "", mate?.name ?? id);
            if (mate) { btn.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(mate.id); }); goes(btn, { key: "champion", params: { id: mate.id } }); }
        }
    }
    itemRow(card, c, ctx, b.items);
    if (b.note) h(card, "div", "mn-set-n", b.note);
    metaLine(card, b, ctx.plugin.store.currentPatch());
}

// A row of item icons (optional caption under each); tap one to open its name, price and effect right below.
function itemRow(parent: HTMLElement, c: Champion, ctx: PageCtx, ids: number[], captions: string[] = []): void {
    const store = ctx.plugin.store;
    const row = h(parent, "div", "mn-items");
    const panel = h(parent, "div", "mn-item-panel");
    let open = -1;
    ids.forEach((id, i) => {
        const item = store.item(id);
        const btn = h(row, "button", "mn-item");
        const im = h(btn, "img");
        im.src = item?.icon || art.item(c.patch, id);
        im.alt = item?.name ?? String(id);
        if (captions[i]) h(btn, "span", "mn-item-c", captions[i]);
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            open = open === i ? -1 : i;
            row.querySelectorAll<HTMLElement>(".mn-item").forEach((b, j) => b.toggleClass("is-on", j === open));
            panel.empty();
            panel.toggleClass("is-open", open >= 0);
            if (open < 0) return;
            const head = h(panel, "div", "mn-ip-head");
            h(head, "span", "mn-ip-name", item?.name ?? `#${id}`);
            if (item) h(head, "span", "mn-ip-gold", `${item.goldTotal}`);
            if (item?.desc) h(panel, "p", "mn-sd-desc", item.desc);
            if (item) {   // the item's own page: its recipe tree, what it builds into, its patch changes
                const more = h(panel, "button", "mn-ip-more", "道具頁 ›");
                more.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(item.id); });
            }
        });
    });
}
