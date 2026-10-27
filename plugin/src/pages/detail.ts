import { MarkdownRenderer, TFile } from "obsidian";
import type { Item, NoteEntry } from "../data/store";
import { chip, empty, group, h, icon, row } from "../ui";
import { RARITY_COLOR } from "./augments";
import type { PageCtx, PageOut } from "./index";

const TAG_ZH: Record<string, string> = {
    Damage: "物理攻擊", SpellDamage: "魔法攻擊", Armor: "護甲", SpellBlock: "魔抗", Health: "生命", HealthRegen: "生命回復", Mana: "魔力", ManaRegen: "魔力回復",
    CriticalStrike: "暴擊", AttackSpeed: "攻速", LifeSteal: "生命偷取", SpellVamp: "法術吸血", AbilityHaste: "技能加速", CooldownReduction: "冷卻縮減",
    MagicPenetration: "魔法穿透", ArmorPenetration: "護甲穿透", NonbootsMovement: "移速", Boots: "鞋子", OnHit: "攻擊特效", Active: "主動", Tenacity: "韌性",
};

// ---- a note, drawn inside the app (Handbook cards, our patch notes)
export function notePage(ctx: PageCtx): PageOut {
    const path = String(ctx.frame.params?.path ?? "");
    const file = ctx.app.vault.getAbstractFileByPath(path);
    const el = h(null, "div", "mn-page");
    if (!(file instanceof TFile)) { empty(el, { icon: "file-x", title: "Note not found" }); return { title: "", el }; }
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
    const body = h(el, "div", "mn-note markdown-rendered");
    void ctx.app.vault.cachedRead(file).then((text) => MarkdownRenderer.render(ctx.app, text.replace(/^---[\s\S]*?---\n/, ""), body, path, ctx.component));
    row(group(el), { icon: "pencil", title: "Edit in Obsidian", chevron: true, onTap: () => void ctx.plugin.openPath(path) });
    return { title: file.basename, el };
}

// ---- an augment
export function augmentPage(ctx: PageCtx): PageOut {
    const a = ctx.plugin.store.augment(Number(ctx.frame.params?.id));
    const el = h(null, "div", "mn-page");
    if (!a) { empty(el, { icon: "sparkles", title: "Augment not found" }); return { title: "", el }; }
    const head = h(el, "div", "mn-dhead");
    const im = h(head, "img", "mn-dimg"); im.src = a.icon; im.alt = "";
    const who = h(head, "div", "mn-dwho");
    h(who, "h1", "mn-title", a.name);
    const tags = h(who, "div", "mn-chips");
    chip(tags, a.rarity, { color: RARITY_COLOR[a.rarity] });
    if (a.tier) chip(tags, `評價 ${a.tier}`, { color: "var(--color-green)" });
    const added = ctx.plugin.store.riotNotes.find((n) => n.augments_new?.some((x) => x.name === a.name));
    if (added) chip(tags, `新增於 ${added.patch}`, { color: "var(--color-blue)" });

    const panel = h(el, "div", "mn-panel mn-dpanel");
    if (a.effect) h(panel, "p", "mn-dtext", a.effect);
    else h(panel, "p", "mn-dtext mn-muted", "No effect text yet.");
    if (a.effect && ctx.plugin.store.officialEffect(a.name) === a.effect) h(panel, "div", "mn-pn-src", "Effect text: Riot Games patch notes");
    if (a.fits.length) {
        h(el, "div", "mn-gh", "適合");
        const fits = h(el, "div", "mn-chips");
        for (const f of a.fits) chip(fits, f);
    }
    return { title: a.name, el };
}

// ---- an item, with what it is built from and what it builds into
export function itemPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const item = store.item(Number(ctx.frame.params?.id));
    const el = h(null, "div", "mn-page");
    if (!item) { empty(el, { icon: "package-x", title: "Item not found" }); return { title: "", el }; }
    const head = h(el, "div", "mn-dhead");
    const im = h(head, "img", "mn-dimg"); im.src = item.icon; im.alt = "";
    const who = h(head, "div", "mn-dwho");
    h(who, "h1", "mn-title", item.name);
    const tags = h(who, "div", "mn-chips");
    chip(tags, `${item.goldTotal} 金`, { color: "var(--color-yellow)" });
    for (const t of item.tags) if (TAG_ZH[t]) chip(tags, TAG_ZH[t]);

    if (item.desc) { const panel = h(el, "div", "mn-panel mn-dpanel"); h(panel, "p", "mn-dtext", item.desc); }
    if (item.variantOf) h(el, "div", "mn-gf", "這是 ARAM 專用版本,價格與數值和一般版本不同。");
    recipe(el, ctx, "合成材料", item.from.map((id) => store.item(id)).filter((i): i is Item => !!i));
    recipe(el, ctx, "可合成", item.into.map((id) => store.item(id)).filter((i): i is Item => !!i));
    return { title: item.name, el };
}

function recipe(el: HTMLElement, ctx: PageCtx, title: string, items: Item[]): void {
    if (!items.length) return;
    h(el, "div", "mn-gh", title);
    const grid = h(el, "div", "mn-recipe");
    for (const i of items) {
        const b = h(grid, "button", "mn-rc");
        const im = h(b, "img"); im.src = i.icon; im.alt = "";
        h(b, "span", "mn-rc-n", i.name);
        h(b, "span", "mn-rc-g", `${i.goldTotal}`);
        b.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(i.id); });
    }
}

// ---- "Show all": a full page of a patch's changes, one card each with the numbers laid out in full
export function listPage(ctx: PageCtx): PageOut {
    const kind = String(ctx.frame.params?.kind);
    const note = ctx.plugin.store.riotNotes.find((n) => n.patch === String(ctx.frame.params?.patch));
    const el = h(null, "div", "mn-page");
    const title = kind === "champions" ? "Champions" : kind === "items" ? "Items" : "New augments";
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", `${title} · ${note?.patch ?? ""}`);
    if (!note) { empty(el, { icon: "newspaper", title: "No patch notes" }); return { title, el }; }
    const store = ctx.plugin.store;

    if (kind === "augments") {
        const byName = new Map(store.augments().map((a) => [a.name, a]));
        for (const a of note.augments_new ?? []) {
            const mine = byName.get(a.name);
            const card = h(el, "div", "mn-ent" + (mine ? " is-tap" : ""));
            const head = h(card, "div", "mn-ent-head");
            if (mine) { const im = h(head, "img"); im.src = mine.icon; im.alt = ""; }
            h(head, "span", "mn-ent-n", a.name);
            chip(head, a.rarity, { color: RARITY_COLOR[a.rarity] });
            if (a.text) h(card, "div", "mn-ent-t", a.text);
            if (mine) card.addEventListener("click", () => ctx.openAugment(mine.id));
        }
        return { title, el };
    }

    const entries: NoteEntry[] = (kind === "champions" ? note.champions : note.items) ?? [];
    for (const e of entries) {
        const champ = kind === "champions" ? store.champions().find((c) => c.name === e.name) : undefined;
        const item = kind === "items" ? store.items().find((i) => i.name === e.name) : undefined;
        const open = champ ? () => ctx.openChampion(champ.id, "skills") : item ? () => ctx.openItem(item.id) : null;
        const card = h(el, "div", "mn-ent" + (open ? " is-tap" : ""));
        const head = h(card, "div", "mn-ent-head");
        const src = champ?.icon ?? item?.icon;
        if (src) { const im = h(head, "img"); im.src = src; im.alt = ""; }
        h(head, "span", "mn-ent-n", e.name);
        if (open) icon(head, "chevron-right", "mn-row-chev");
        for (const c of e.changes) {
            const line = h(card, "div", "mn-ent-ch");
            h(line, "div", "mn-ent-l", c.label);
            const vals = h(line, "div", "mn-ent-v");
            h(vals, "span", "mn-chg-old", c.old);
            h(vals, "span", "mn-chg-arrow", "→");
            h(vals, "span", "mn-chg-new", c.new);
        }
        if (e.more) h(card, "div", "mn-gf", `+${e.more} more in Riot's notes`);
        if (open) card.addEventListener("click", open);
    }
    if (!entries.length) empty(el, { icon: "newspaper", title: "Nothing listed" });
    return { title, el };
}
