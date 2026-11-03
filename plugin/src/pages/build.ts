import type { BuildPick, BuildStyle, Champion } from "../data/store";
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
    const reasoned = mode === "mayhem" ? Object.values(store.itemBuilds[c.id] ?? {}) : [];
    if (reasoned.length) reasonedBuild(body, c, ctx, reasoned);

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
    if (!stats && !mine.length && !reasoned.length) empty(body, { icon: "package-open", title: "No builds of ours yet", text: "Our own builds and ideas for this champion will appear here." });
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

// 主出裝 and 替代 (tools/build_tiers.py): one row per item, its picture, name and why it works for this champion; a tap opens the item
function reasonedBuild(body: HTMLElement, c: Champion, ctx: PageCtx, styles: BuildStyle[]): void {
    const wrap = h(body, "div", "mn-rb");
    styleSwitch(wrap, styles, (s) => draw(s));
    const box = h(wrap, "div", "mn-rb-box");
    const draw = (style: BuildStyle) => {
        box.empty();
        section(box, "主出裝");
        style.main.forEach((p, i) => buildRow(box, c, ctx, p, String(i + 1)));
        if (style.boots) buildRow(box, c, ctx, style.boots, "鞋");
        if (style.alt.length) { section(box, "替代"); for (const p of style.alt) buildRow(box, c, ctx, p, ""); }
    };
    draw(styles[0]);
}

function buildRow(parent: HTMLElement, c: Champion, ctx: PageCtx, p: BuildPick, mark: string): void {
    const item = ctx.plugin.store.item(p.id);
    const row = h(parent, "button", "mn-rb-row");
    h(row, "span", "mn-rb-mark", mark);
    const im = h(row, "img");
    im.src = item?.icon || art.item(c.patch, p.id);
    im.alt = "";
    const text = h(row, "span", "mn-rb-text");
    h(text, "span", "mn-rb-name", item?.name ?? `#${p.id}`);
    const why = h(text, "span", "mn-rb-why");
    if (p.when) h(why, "span", "mn-rb-when", `${p.when}：`);
    why.appendText(p.reason);
    if (item) {
        row.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(item.id); });
        goes(row, { key: "item", params: { id: item.id } });
    }
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
