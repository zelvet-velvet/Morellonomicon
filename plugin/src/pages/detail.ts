import { MarkdownRenderer, TFile } from "obsidian";
import type { Champion, Item } from "../data/store";
import { augIcon, chip, empty, group, h, icon, row } from "../ui";
import { RARITY_COLOR } from "./augments";
import { officialBlock } from "./changes";
import { deckPage } from "./deck";
import type { PageCtx, PageOut } from "./index";

const TAG_ZH: Record<string, string> = {
    Damage: "物理攻擊", SpellDamage: "魔法攻擊", Armor: "護甲", SpellBlock: "魔抗", Health: "生命", HealthRegen: "生命回復", Mana: "魔力", ManaRegen: "魔力回復",
    CriticalStrike: "暴擊", AttackSpeed: "攻速", LifeSteal: "生命偷取", SpellVamp: "法術吸血", AbilityHaste: "技能加速", CooldownReduction: "冷卻縮減",
    MagicPenetration: "魔法穿透", ArmorPenetration: "護甲穿透", NonbootsMovement: "移速", Boots: "鞋子", OnHit: "攻擊特效", Active: "主動", Tenacity: "韌性",
};
const SUGGESTED = 12;   // champions shown under "適合的英雄"

// ---- a note, drawn inside the app (Handbook cards, our patch notes)
export function notePage(ctx: PageCtx): PageOut {
    const path = String(ctx.frame.params?.path ?? "");
    const file = ctx.app.vault.getAbstractFileByPath(path);
    const el = h(null, "div", "mn-page");
    if (!(file instanceof TFile)) { empty(el, { icon: "file-x", title: "Note not found" }); return { title: "", el }; }
    // a guide topic written as cards (`## ` sections) is a swipeable deck; others (the glossary) are read as a note
    if (ctx.plugin.store.guideNotes().some((n) => n.file.path === path && n.layout === "deck")) return deckPage(ctx, file);
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
    const body = h(el, "div", "mn-note markdown-rendered");
    void ctx.app.vault.cachedRead(file).then((text) => MarkdownRenderer.render(ctx.app, text.replace(/^---[\s\S]*?---\n/, ""), body, path, ctx.component));
    // a guide card: remember it as read and offer the next one
    const guide = ctx.plugin.store.guideNotes();
    const at = guide.findIndex((n) => n.file.path === path);
    if (at >= 0) {
        void ctx.plugin.markRead(path);
        const next = guide[at + 1];
        if (next) {
            const b = h(el, "button", "mn-nextcard");
            h(b, "span", "mn-nextcard-k", "下一篇");
            h(b, "span", "mn-nextcard-t", next.title);
            icon(b, "arrow-right", "mn-nextcard-ic");
            b.addEventListener("click", (e) => { e.preventDefault(); ctx.pop(); ctx.openNote(next.file.path); });
        } else h(el, "div", "mn-nextcard-done", "🎉 全部讀完了");
    }
    row(group(el), { icon: "pencil", title: "Edit in Obsidian", chevron: true, onTap: () => void ctx.plugin.openPath(path) });
    return { title: file.basename, el };
}

// What an augment's effect text is about, and which kinds of champion that helps. A guess from the wording only (the tags and rules
// are plain and listed here); a hand-written `fits` on the augment note replaces it.
interface Kind { tag: string; re: RegExp; fits: (c: Champion) => boolean }
const KINDS: Kind[] = [
    { tag: "魔法攻擊", re: /魔攻|魔法攻擊|法術強度/, fits: (c) => c.damageType === "魔法" || c.damageType === "混合" },
    { tag: "物理攻擊", re: /物攻|物理攻擊/, fits: (c) => c.damageType === "物理" || c.damageType === "混合" },
    { tag: "普攻", re: /普攻|普通攻擊|攻速|暴擊/, fits: (c) => c.roles.includes("射手") || (c.damageType === "物理" && c.archetypes.includes("近戰")) },
    { tag: "技能", re: /技能|大絕|冷卻/, fits: (c) => c.damageType === "魔法" || c.roles.includes("法師") },
    { tag: "生存", re: /生命|物防|魔防|護甲|魔抗|韌性|減傷/, fits: (c) => c.roles.includes("坦克") || c.roles.includes("戰士") },
    { tag: "護盾 / 治療", re: /護盾|治療|回復/, fits: (c) => c.features.includes("護盾") || c.features.includes("治療") || c.roles.includes("輔助") },
    { tag: "跑速 / 位移", re: /跑速|衝刺|位移/, fits: (c) => c.features.includes("位移") },
    { tag: "控場", re: /緩速|暈眩|擊飛|控制|定身|擊退/, fits: (c) => c.features.includes("控場") },
];

function suggest(effect: string, champions: Champion[]): { tags: string[]; champions: Champion[] } {
    const kinds = KINDS.filter((k) => k.re.test(effect));
    if (!kinds.length) return { tags: [], champions: [] };
    const need = Math.max(1, Math.ceil(kinds.length * 0.6));
    const scored = champions.map((c) => ({ c, n: kinds.filter((k) => k.fits(c)).length })).filter((x) => x.n >= need);
    scored.sort((a, b) => b.n - a.n || a.c.name.localeCompare(b.c.name, "zh-Hant"));
    return { tags: kinds.map((k) => k.tag), champions: scored.slice(0, SUGGESTED).map((x) => x.c) };
}

// ---- an augment: effect, what it is about, which champions suit it, and its history
export function augmentPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const a = store.augment(Number(ctx.frame.params?.id));
    const el = h(null, "div", "mn-page");
    if (!a) { empty(el, { icon: "sparkles", title: "Augment not found" }); return { title: "", el }; }
    const history = store.augmentHistory(a.name);
    const head = h(el, "div", "mn-dhead");
    augIcon(head, a.icon, a.rarity, "mn-dimg-aug");
    const who = h(head, "div", "mn-dwho");
    h(who, "h1", "mn-title", a.name);
    const tags = h(who, "div", "mn-chips");
    chip(tags, a.rarity, { color: RARITY_COLOR[a.rarity] });
    const last = history[0];
    if (last) chip(tags, `${last.what === "added" ? "新增於" : "移除於"} ${last.patch}`, { color: last.what === "added" ? "var(--color-blue)" : "var(--color-red)" });

    const panel = h(el, "div", "mn-panel mn-dpanel");
    if (a.effect) {
        h(panel, "p", "mn-dtext", a.effect);
        const official = store.officialEffect(a.name) === a.effect;
        h(panel, "div", "mn-pn-src", `Effect text: Riot Games ${official ? "patch notes" : "game text"}`);
        if (a.partial) h(panel, "div", "mn-pn-src", "X = 遊戲內才看得到的數值");
    } else {
        // Riot's patch notes only describe an augment in the patch that adds or changes it; older ones have no text we can read yet
        h(panel, "p", "mn-dtext mn-muted", "這個強化的效果說明還沒有收錄。");
        const links = group(el);
        row(links, { icon: "external-link", title: "在 League 維基查看效果", chevron: true, onTap: () => window.open("https://wiki.leagueoflegends.com/en-us/ARAM_Mayhem/Augments") });
        row(links, { icon: "external-link", title: "OP.GG 強化列表", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
    }

    // which champions suit it: the hand-written `fits` when there is one, else a guess from the wording
    const all = store.champions();
    let tagList: string[] = [], list: Champion[] = [], label = "";
    if (a.fits.length) {
        tagList = a.fits;
        list = all.filter((c) => a.fits.some((f) => c.archetypes.includes(f) || c.features.includes(f) || c.roles.includes(f))).slice(0, SUGGESTED);
        label = "人工整理";
    } else if (a.effect) {
        const s = suggest(a.effect, all);
        tagList = s.tags;
        list = s.champions;
        label = "依效果文字自動推測,僅供參考";
    }
    if (tagList.length) {
        h(el, "div", "mn-gh", "效果重點");
        const chips = h(el, "div", "mn-chips");
        for (const t of tagList) chip(chips, t);
    }
    if (list.length) {
        h(el, "div", "mn-gh", "適合的英雄");
        const grid = h(el, "div", "mn-grid");
        for (const c of list) {
            const tile = h(grid, "button", "mn-tile");
            const t = h(tile, "img"); t.src = c.icon; t.alt = "";
            h(tile, "span", "mn-tile-n", c.name);
            tile.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(c.id, "augments"); });
        }
        h(el, "div", "mn-gf", label);
    }
    if (history.length) {
        h(el, "div", "mn-gh", "版本紀錄");
        const g = group(el);
        for (const x of history) row(g, { icon: x.what === "added" ? "plus-circle" : "minus-circle", title: x.what === "added" ? "新增" : "移除", value: x.patch });
    }
    return { title: a.name, el };
}

// ---- an item: effect, what it is built from and builds into, and what Riot changed in it
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
    const official = store.officialFor("items", item.name);
    if (official.length) { h(el, "div", "mn-gh", "版本調整"); officialBlock(el, official); }
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
