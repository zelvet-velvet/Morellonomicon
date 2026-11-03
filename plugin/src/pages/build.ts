import type { BuildPick, ChampBuilds, Champion } from "../data/store";
import { chip, empty, h, moreLink, goes, textSwitch } from "../ui";
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

// The Mayhem builds (tools/build_tiers.py), laid out like 技能: the play styles as words and how the chosen one plays at the top, what
// the tapped item does under them, and the items as a bar at the bottom (at the thumb): 核心 (the first two), 第三 (choices for the
// third), 可換 (items other pairs put in place of one of the two), 後續 (items four to six, a word each for what it adds), 鞋子 and 命定武器
function mayhemBuilds(page: HTMLElement, c: Champion, ctx: PageCtx, b: ChampBuilds): void {
    const store = ctx.plugin.store;
    const root = h(page, "div", "mn-mbp");
    if (b.styles.length > 1) textSwitch(root, b.styles.map((s, i) => [String(i), s.name]), "0", (id) => draw(Number(id)));
    const how = h(root, "div", "mn-mbp-how");
    const say = h(root, "div", "mn-mbp-say");
    const bar = h(root, "div", "mn-mbp-bar");
    let lit: HTMLElement | null = null;
    // the top: the tapped item's name, what it adds (a word) and why; a tap on the name opens the item
    const explain = (p: BuildPick, word: string, icon: HTMLElement, text = p.reason) => {
        lit?.removeClass("is-lit");
        lit = icon;
        icon.addClass("is-lit");
        say.empty();
        const head = h(say, "div", "mn-mbp-name");
        const name = h(head, "button", "mn-mbp-open", store.item(p.id)?.name ?? `#${p.id}`);
        name.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(p.id); });
        if (word) h(head, "span", "mn-mbp-word", word);
        h(say, "div", "mn-mbp-text", p.when ? `${p.when}：${text}` : text);
    };
    const cell = (row: HTMLElement, p: BuildPick, word: string, opts: { text?: string; destiny?: boolean; caption?: string } = {}) => {
        const btn = h(row, "button", "mn-mbp-cell");
        const ic = itemIcon(btn, c, ctx, p.id, opts.destiny);
        if (opts.caption !== undefined) h(btn, "span", "mn-mbp-cap", opts.caption);
        btn.addEventListener("click", (e) => { e.preventDefault(); explain(p, word, ic, opts.text); });
        return ic;
    };
    const line = (label: string) => {
        const r = h(bar, "div", "mn-mbp-row");
        h(r, "span", "mn-mbp-label", label);
        return h(r, "div", "mn-mbp-icons");
    };
    const draw = (n: number) => {
        const st = b.styles[n];
        how.setText(st.why || (st.games ? "" : "依技能組推算的出裝"));
        bar.empty();
        const core = line("核心");
        let first: HTMLElement | null = null;
        st.core.forEach((p, i) => {
            if (i) h(core, "span", "mn-mbp-arrow", "›");
            const ic = cell(core, p, `第 ${i + 1} 件`);
            first ??= ic;
        });
        if (st.third.length) {
            const third = line("第三");
            for (const p of st.third) cell(third, p, "第三件", { text: `核心兩件之後最常接的第三件：${p.reason}` });
        }
        if (st.swaps.length) {
            const swap = line("可換");
            for (const p of st.swaps) cell(swap, p, "可換", { text: `可以換掉核心兩件的其中一件：${p.reason}` });
        }
        if (st.late.length) {
            const late = line("後續");
            for (const p of st.late) cell(late, p, p.when ? "看情況" : p.need ?? "", { caption: p.when ? "看情況" : p.need ?? "" });
        }
        const last = line("鞋子");
        if (st.boots) cell(last, st.boots, st.boots.need ?? "", { caption: st.boots.need ?? "" });
        const grows = (st.destiny.grows ?? []).slice(0, 3);
        h(last, "span", "mn-mbp-label is-inner", "命定");
        cell(last, st.destiny, "命定武器", { destiny: true, caption: grows.slice(0, 2).join("、"),
            text: `拿到命定武器時第一件出它，每次參與擊殺${grows.length ? grows.join("、") : "屬性"}永久提升。${st.destiny.reason}` });
        for (const s of b.special) {   // hand builds the games cannot show (鎖子甲 ×6)
            const row = line("特殊");
            for (const id of s.items) cell(row, { id, reason: s.note }, s.name);
        }
        if (first) explain(st.core[0], "第 1 件", first);
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
