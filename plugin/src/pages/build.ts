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

// The Mayhem builds (tools/build_tiers.py), read top to bottom in buying order (Layouts, 出裝, option A 三段, Zaviel 2026-11-03): the
// play style words (a tap on a side switches too) and how it plays; 前兩件, the pair as a set (big), with 也可以, other pairs of the
// style (small; a tap swaps one into the big pair); 第三件, a row each: icon, name, what it is for and why; 4–6 件, grouped by what
// they add, a tap shows the item's why under them; 鞋子 and 命定武器 at the foot. A tap on a pair's or a third item's name opens it.
const POOL_ORDER = ["輸出", "生存", "穿透", "功能", "機動", "重創", "看情況"];
function mayhemBuilds(page: HTMLElement, c: Champion, ctx: PageCtx, b: ChampBuilds): void {
    const store = ctx.plugin.store;
    const name = (id: number) => store.item(id)?.name ?? `#${id}`;
    const root = h(page, "div", "mn-mbp");
    styleSwitch(root, b.styles, (s) => draw(b.styles.indexOf(s)));   // the words, and a tap on the page's left or right side
    const how = h(root, "div", "mn-mbp-how");
    const box = h(root, "div", "mn-mbp-box");
    const head = (parent: HTMLElement, label: string) => h(parent, "div", "mn-mbp-h", label);
    const open = (el: HTMLElement, id: number) => el.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(id); });
    const draw = (n: number) => {
        const st = b.styles[n];
        how.setText(st.why || (st.games ? "" : "依技能組推算的出裝"));
        box.empty();

        // 前兩件: the big pair, the other pairs under it
        const pairs = [st.core, ...(st.alts ?? [])];
        const set = h(box, "div", "mn-mbp-sec");
        head(set, "前兩件");
        const big = h(set, "div", "mn-mbp-pair");
        const others = h(set, "div", "mn-mbp-alts");
        const showPair = (k: number) => {
            big.empty();
            pairs[k].forEach((p, i) => {
                if (i) h(big, "span", "mn-mbp-plus", "+");
                const btn = h(big, "button", "mn-mbp-big");
                itemIcon(btn, c, ctx, p.id);
                h(btn, "span", "mn-mbp-bn", name(p.id));
                open(btn, p.id);
            });
            others.empty();
            if (pairs.length < 2) return;
            h(others, "span", "mn-mbp-or", "也可以");
            pairs.forEach((pair, j) => {
                if (j === k) return;
                const btn = h(others, "button", "mn-mbp-alt");
                pair.forEach((p, i) => { if (i) h(btn, "span", "mn-mbp-plus is-small", "+"); itemIcon(btn, c, ctx, p.id); });
                btn.addEventListener("click", (e) => { e.preventDefault(); showPair(j); });
            });
        };
        showPair(0);

        // 第三件: a row each, what it is for and why
        if (st.third.length) {
            const sec = h(box, "div", "mn-mbp-sec");
            head(sec, "第三件");
            for (const p of st.third) {
                const row = h(sec, "button", "mn-mbp-third");
                itemIcon(row, c, ctx, p.id);
                const words = h(row, "div", "mn-mbp-tw");
                const top = h(words, "div", "mn-mbp-tn");
                h(top, "span", "", name(p.id));
                if (p.need) h(top, "span", "mn-mbp-word", p.need);
                h(words, "div", "mn-mbp-text", p.reason);
                open(row, p.id);
            }
        }

        // 4–6 件: grouped by what they add; a tap shows the why under the pool
        let lit: HTMLElement | null = null;
        const say = h(box, "div", "mn-mbp-say");
        const explain = (p: BuildPick, ic: HTMLElement, word: string, text = p.reason) => {
            lit?.removeClass("is-lit");
            lit = ic;
            ic.addClass("is-lit");
            say.empty();
            const top = h(say, "div", "mn-mbp-tn");
            const nm = h(top, "button", "mn-mbp-open", name(p.id));
            open(nm, p.id);
            if (word) h(top, "span", "mn-mbp-word", word);
            h(say, "div", "mn-mbp-text", p.when ? `${p.when}：${text}` : text);
        };
        const cell = (row: HTMLElement, p: BuildPick, word: string, caption: string, opts: { text?: string; destiny?: boolean } = {}) => {
            const btn = h(row, "button", "mn-mbp-cell");
            const ic = itemIcon(btn, c, ctx, p.id, opts.destiny);
            if (caption) h(btn, "span", "mn-mbp-cap", caption);
            btn.addEventListener("click", (e) => { e.preventDefault(); explain(p, ic, word, opts.text); });
            return ic;
        };
        let firstPool: [BuildPick, HTMLElement, string] | null = null;
        if (st.late.length) {
            const sec = h(box, "div", "mn-mbp-sec");
            head(sec, "4–6 件");
            const groups = new Map<string, BuildPick[]>();
            for (const p of st.late) {
                const k = p.when ? "看情況" : p.need || "輸出";
                groups.set(k, [...(groups.get(k) ?? []), p]);
            }
            const keys = [...groups.keys()].sort((a, z) => POOL_ORDER.indexOf(a) - POOL_ORDER.indexOf(z));
            for (const k of keys) {
                const row = h(sec, "div", "mn-mbp-grp");
                h(row, "span", "mn-mbp-label", k);
                const icons = h(row, "div", "mn-mbp-icons");
                for (const p of groups.get(k) ?? []) {
                    const ic = cell(icons, p, k, p.when ? p.when.replace(/時$/, "") : "");
                    firstPool ??= [p, ic, k];
                }
            }
        }
        box.appendChild(say);   // the why sits under the pool

        // 鞋子 and 命定武器
        const foot = h(box, "div", "mn-mbp-foot");
        let firstFoot: [BuildPick, HTMLElement, string] | null = null;
        if (st.boots) firstFoot = [st.boots, cell(foot, st.boots, "鞋子", st.boots.need ?? ""), "鞋子"];
        const grows = (st.destiny.grows ?? []).slice(0, 3);
        cell(foot, st.destiny, "命定武器", `命定 ${grows.slice(0, 2).join("、")}`.trim(), { destiny: true,
            text: `拿到命定武器時第一件出它，每次參與擊殺${grows.length ? grows.join("、") : "屬性"}永久提升。${st.destiny.reason}` });
        for (const s of b.special) {   // hand builds the games cannot show (鎖子甲 ×6)
            const sec = h(box, "div", "mn-mbp-sec");
            head(sec, s.name);
            const row = h(sec, "div", "mn-mbp-icons is-center");
            for (const id of s.items) cell(row, { id, reason: s.note }, s.name, "");
        }
        const start = firstPool ?? firstFoot;
        if (start) explain(start[0], start[1], start[2]);
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
