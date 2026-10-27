import type { Champion } from "../data/store";
import { chip, empty, h } from "../ui";
import type { PageCtx } from "./index";

const TOP_SETS = 3;
const TOP_ITEMS = 8;
const pct = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0);

// The Build sub-tab: what people really build (counted from matches), our own picks, fun alternatives, and builds for playing with a teammate.
export function buildTab(body: HTMLElement, c: Champion, ctx: PageCtx): void {
    const store = ctx.plugin.store;
    const mode = ctx.plugin.settings.mode;
    const stats = store.stats?.champions[c.id];
    const mine = c.builds.filter((b) => b.mode === mode);
    const meta = mine.filter((b) => b.kind === "meta");
    const alt = mine.filter((b) => b.kind === "alt");
    const synergy = mine.filter((b) => b.kind === "synergy");

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
    if (!stats && !mine.length) empty(body, { icon: "package-open", title: "No builds yet", text: "Match data and hand-written builds appear here." });
}

function section(body: HTMLElement, title: string): void { h(body, "div", "mn-gh", title); }

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
            if (mate) btn.addEventListener("click", (e) => { e.preventDefault(); ctx.push({ key: "champion", title: mate.name, params: { id: mate.id } }); });
        }
    }
    itemRow(card, c, ctx, b.items);
    if (b.note) h(card, "div", "mn-set-n", b.note);
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
        im.src = item?.icon || `https://ddragon.leagueoflegends.com/cdn/${c.patch}/img/item/${id}.png`;
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
        });
    });
}
