import type { ChampBuilds, Champion } from "../data/store";
import { chip, empty, h, moreLink, goes } from "../ui";
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
    if (reasoned?.cores.length) mayhemBuilds(body, c, ctx, reasoned);

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
    if (!stats && !mine.length && !reasoned?.cores.length) empty(body, { icon: "package-open", title: "No builds of ours yet", text: "Our own builds and ideas for this champion will appear here." });
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

const LATE = 5;   // choices shown for items four to six
// the border the game puts on the item 命定武器 grows (CommunityDragon, shown by address)
const DESTINY_FRAME = "https://raw.communitydragon.org/latest/game/assets/items/itemmodifiers/strawberry_weapon_evolve_border.png";

// The Mayhem builds (tools/build_tiers.py) on one screen, like a build site: the first-three sets as tiles (a play style each), then
// for the chosen tile's style five choices for items four to six with what each adds, the boots and the item for 命定武器 with what
// it grows; one line under them says what the last tapped icon does (a tap on the line opens the item)
function mayhemBuilds(body: HTMLElement, c: Champion, ctx: PageCtx, b: ChampBuilds): void {
    const store = ctx.plugin.store;
    const box = h(body, "div", "mn-mb");
    h(box, "div", "mn-mb-h", "前三件");
    const grid = h(box, "div", "mn-mb-cores");
    const rest = h(box, "div", "mn-mb-rest");
    const say = h(box, "button", "mn-mb-say");
    let lit: HTMLElement | null = null;
    // the line: the item's name, then why (when to buy it first, for a situational one)
    const explain = (id: number, text: string, icon: HTMLElement) => {
        lit?.removeClass("is-lit");
        lit = icon;
        icon.addClass("is-lit");
        say.empty();
        h(say, "b", "", store.item(id)?.name ?? `#${id}`);
        say.appendText(`　${text}`);
        say.dataset.id = String(id);
    };
    say.addEventListener("click", (e) => { e.preventDefault(); const id = Number(say.dataset.id); if (id) ctx.openItem(id); });
    let on = 0;
    const tiles = b.cores.map((core, n) => {
        const tile = h(grid, "div", "mn-mb-core" + (n === 0 ? " is-on" : ""));
        h(tile, "div", "mn-mb-style", b.styles[core.style]?.name ?? "");
        const icons = h(tile, "div", "mn-mb-icons");
        const ics = core.items.map((id, i) => {
            const ic = itemIcon(icons, c, ctx, id);
            ic.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); choose(n); explain(id, core.reasons[i] + (core.games ? "" : "（依技能組推算）"), ic); });
            return ic;
        });
        tile.addEventListener("click", (e) => { e.preventDefault(); choose(n); explain(core.items[0], core.reasons[0], ics[0]); });
        return tile;
    });
    const choose = (n: number) => {
        if (on === n) return;
        tiles[on].removeClass("is-on");
        tiles[n].addClass("is-on");
        on = n;
        drawRest();
    };
    const drawRest = () => {
        rest.empty();
        const core = b.cores[on];
        const st = b.styles[core.style];
        if (!st) return;
        const late = st.late.filter((p) => !core.items.includes(p.id)).slice(0, LATE);
        if (late.length) {
            h(rest, "div", "mn-mb-h", "第四到六件");
            const row = h(rest, "div", "mn-mb-late");
            for (const p of late) cell(row, p.id, p.when ? "看情況" : p.need ?? "", p.when ? `${p.when}：${p.reason}` : p.reason);
        }
        const two = h(rest, "div", "mn-mb-two");
        if (st.boots) {
            const half = h(two, "div", "mn-mb-half");
            h(half, "div", "mn-mb-h", "鞋子");
            cell(half, st.boots.id, st.boots.need ?? "", st.boots.reason, false, "side");
        }
        if (st.destiny) {
            const half = h(two, "div", "mn-mb-half");
            h(half, "div", "mn-mb-h", "命定武器");
            const grows = (st.destiny.grows ?? []).slice(0, 3);
            cell(half, st.destiny.id, "擊殺成長", `拿到命定武器時第一件出它，每次參與擊殺${grows.length ? grows.join("、") : "屬性"}永久提升。${st.destiny.reason}`,
                true, "side", grows.join("、"));
        }
    };
    // an icon with a word under it; a tap explains it on the line
    // ("side": the words beside the icon, the second one under the first)
    const cell = (parent: HTMLElement, id: number, word: string, text: string, destiny = false, side = "", sub = "") => {
        const btn = h(parent, "button", "mn-mb-cell" + (side ? " is-side" : ""));
        const ic = itemIcon(btn, c, ctx, id, destiny);
        const words = h(btn, "span", "mn-mb-words");
        h(words, "span", "mn-mb-word", word);
        if (sub) h(words, "span", "mn-mb-sub", sub);
        btn.addEventListener("click", (e) => { e.preventDefault(); explain(id, text, ic); });
    };
    drawRest();
    for (const s of b.special) {   // hand builds the games cannot show (鎖子甲 ×6): one row, its note on the line
        h(box, "div", "mn-mb-h", "特殊出裝");
        const row = h(box, "button", "mn-mb-special");
        const icons = h(row, "span", "mn-mb-icons");
        for (const id of s.items) itemIcon(icons, c, ctx, id);
        h(row, "span", "mn-mb-word", s.name);
        row.addEventListener("click", (e) => { e.preventDefault(); explain(s.items[0], s.note, icons.firstElementChild as HTMLElement); });
    }
    explain(b.cores[0].items[0], b.cores[0].reasons[0], tiles[0].querySelector(".mn-mb-ic") as HTMLElement);
    box.append(say);
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
