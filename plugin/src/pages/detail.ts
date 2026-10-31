import { MarkdownRenderer, TFile } from "obsidian";
import type { AugTier, Augment, Champion, Item, Store } from "../data/store";
import { ITEM_CAT_COLOR, ITEM_CATS, TIER_COLOR, augIcon, chip, empty, group, h, icon, layoutBlock, row, shopIcon, slideSeg } from "../ui";
import { RARITY_COLOR } from "./augments";
import { officialBlock } from "./changes";
import { deckPage, itemTree } from "./deck";
import { glossaryPage } from "./glossary";
import type { PageCtx, PageOut } from "./index";

const TAG_ZH: Record<string, string> = {
    Damage: "物理攻擊", SpellDamage: "魔法攻擊", Armor: "護甲", SpellBlock: "魔抗", Health: "生命", HealthRegen: "生命回復", Mana: "魔力", ManaRegen: "魔力回復",
    CriticalStrike: "暴擊", AttackSpeed: "攻速", LifeSteal: "生命偷取", SpellVamp: "法術吸血", AbilityHaste: "技能加速", CooldownReduction: "冷卻縮減",
    MagicPenetration: "魔法穿透", ArmorPenetration: "護甲穿透", NonbootsMovement: "移速", Boots: "鞋子", OnHit: "攻擊特效", Active: "主動", Tenacity: "韌性",
};
const SUGGESTED = 12;
const GLOSSARY = "名詞表";   // champions shown under "適合的英雄"

// ---- a note, drawn inside the app (Handbook cards, our patch notes)
export function notePage(ctx: PageCtx): PageOut {
    const path = String(ctx.frame.params?.path ?? "");
    const file = ctx.app.vault.getAbstractFileByPath(path);
    const el = h(null, "div", "mn-page");
    if (!(file instanceof TFile)) { empty(el, { icon: "file-x", title: "Note not found" }); return { title: "", el }; }
    // a guide topic written as cards (`## ` sections) is a swipeable deck; others (the glossary) are read as a note
    if (ctx.plugin.store.guideNotes().some((n) => n.file.path === path && n.layout === "deck")) return deckPage(ctx, file);
    if (file.basename === GLOSSARY) return glossaryPage(ctx, file);   // the glossary: a grouped list with search
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
    return { title: "", el };
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

// Which augments suit a champion, best first, and why (its Augments page): each augment's effect is read for what it needs (AP, AD,
// attacks, crits, haste, shields and heals, toughness, dashes, crowd control, mana), and each need is scored against what the champion
// really does (damage kind, role, its abilities' tags, its resource); the augment's score is how well its needs fit, and the reason is
// its best-fitting need in plain words. Pinned on the champion note first; its `avoid` and augments the game never offers it are out.
export interface AugmentPick { a: Augment; why: string; score: number }
interface Need { re: RegExp; fit: (c: Champion) => number; why: (c: Champion) => string }
const has = (c: Champion, t: string) => c.features.includes(t) || c.archetypes.includes(t);
const NEEDS: Need[] = [
    { re: /魔攻|魔法傷害|適性/, fit: (c) => c.damageType === "魔法" ? 1 : c.skillDamage.includes("魔法") ? 0.5 : 0, why: () => "吃魔攻" },
    { re: /物攻|物理傷害|物理致命|穿透/, fit: (c) => c.damageType === "物理" ? 1 : c.damageType === "混合" ? 0.6 : 0, why: () => "吃物攻" },
    { re: /普攻|攻速|命中效果/, fit: (c) => c.roles.includes("射手") ? 1 : has(c, "強化普攻") || has(c, "攻擊特效") ? 0.7 : 0, why: (c) => c.roles.includes("射手") ? "普攻射手" : "普攻型" },
    { re: /暴擊/, fit: (c) => c.roles.includes("射手") ? 1 : 0, why: () => "暴擊射手" },
    { re: /技能加速|冷卻/, fit: (c) => c.damageType === "魔法" || c.roles.includes("法師") ? 0.9 : 0.5, why: () => "靠技能" },
    { re: /治療|護盾/, fit: (c) => has(c, "護盾") || has(c, "治療") ? 1 : c.roles.includes("輔助") ? 0.8 : 0, why: (c) => has(c, "護盾") ? "有護盾技能" : has(c, "治療") ? "有治療技能" : "輔助" },
    { re: /生命|物防|魔防|韌性|傷害減免|體型/, fit: (c) => c.roles.includes("坦克") ? 1 : c.roles.includes("戰士") ? 0.7 : 0.1, why: (c) => c.roles.includes("坦克") ? "坦克" : "前排戰士" },
    { re: /衝刺|位移|閃現|跳躍/, fit: (c) => has(c, "位移") ? 1 : 0, why: () => "有位移" },
    { re: /硬控場|禁錮|控場|擊飛|暈眩/, fit: (c) => has(c, "控場") ? 1 : 0, why: () => "有控場" },
    { re: /魔力/, fit: (c) => c.resource === "魔力" ? 0.8 : 0, why: () => "用魔力" },
    { re: /大絕/, fit: () => 0.6, why: () => "大絕強化" },
];
const PICKS_SHOWN = 6;   // on the champion page; the full page shows them all
export { PICKS_SHOWN };
// The picks as tiles three across, all the same size so they line up: the icon in its rarity frame, the name (two lines at most), the
// reason as a small chip; the tile is tinted in its rarity's colour. Tap: the augment's page.
// opt.bare: the champion page family's icon grid (Design Rules): no panel, the icon and its name only (the reason is on the augment's
// page); opt.champ: the champion it is shown for, so the augment's page can say how it fits that champion
export function augmentTiles(parent: HTMLElement, picks: AugmentPick[], ctx: PageCtx, opt: { bare?: boolean; champ?: string } = {}): HTMLElement {
    const grid = h(parent, "div", "mn-aug-tiles" + (opt.bare ? " is-bare" : ""));
    for (const p of picks) {
        const t = h(grid, "button", "mn-aug-tile");
        t.style.setProperty("--r", RARITY_COLOR[p.a.rarity] ?? "var(--mn-muted)");
        augIcon(t, p.a.icon, p.a.rarity, "mn-aug-tic");
        h(t, "span", "mn-aug-tn", p.a.name);
        if (!opt.bare) h(t, "span", "mn-aug-tw", p.why);
        t.addEventListener("click", (e) => { e.preventDefault(); ctx.openAugment(p.a.id, opt.champ); });
    }
    return grid;
}
export function augmentPicks(store: Store, c: Champion): AugmentPick[] {
    const out: AugmentPick[] = [];
    for (const a of store.augments()) {
        if (c.avoid.includes(a.name)) continue;
        const data = store.augmentData(a.id);
        if (data?.fits && !data.fits.includes(c.id.toLowerCase())) continue;   // never offered to this champion
        if (c.pinned.includes(a.name)) { out.push({ a, why: "置頂", score: 100 }); continue; }
        if (!a.effect) continue;
        const needs = NEEDS.filter((n) => n.re.test(a.effect));
        if (!needs.length) continue;
        const fits = needs.map((n) => n.fit(c));
        if (fits.filter((f) => f === 0).length > needs.length / 2) continue;   // mostly for someone else
        const mean = fits.reduce((x, y) => x + y, 0) / fits.length;
        if (mean < 0.5) continue;
        const best = needs[fits.indexOf(Math.max(...fits))];
        // rarer is stronger, a hand-written `fits` or Riot's tags (it is offered to fewer champions) make it surer
        const bonus = (a.rarity === "稜鏡" ? 0.12 : a.rarity === "金" ? 0.06 : 0) + (data?.fits ? 0.08 : 0) + (a.fits.some((f) => has(c, f) || c.roles.includes(f)) ? 0.15 : 0);
        out.push({ a, why: best.why(c), score: Math.round((mean + bonus) * 100) });
    }
    return out.sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name, "zh-Hant"));
}

// ---- an augment (layout A 強化卡, chosen 2026-10-30): a banner, a Lv1 / 最大 switch, stat chips, the effect as a card with its numbers
// coloured by kind, the fitting champions as a sideways strip, the history in one line
// The game's markup around a number or word -> its colour (the app's damage and stat colours); words like 燃燒 are only bold
const KIND_COLOR: Record<string, string> = {
    magicDamage: "var(--mn-magic)", scaleAP: "var(--mn-magic)", scaleMana: "var(--mn-magic)", physicalDamage: "var(--mn-phys)", scaleAD: "var(--mn-phys)",
    trueDamage: "var(--mn-true)", healing: "var(--mn-heal)", scaleHealth: "var(--mn-heal)", lifeSteal: "var(--mn-ls)", lifesteal: "var(--mn-ls)",
    shield: "var(--mn-shield)", scaleMR: "var(--mn-shield)", scaleArmor: "var(--mn-guard)", crit: "var(--mn-exec)", scaleCrit: "var(--mn-exec)",
    speed: "var(--mn-true)", attackSpeed: "var(--mn-true)", scaleAS: "var(--mn-true)", scaleAbilityHaste: "var(--mn-haste)", scaleAH: "var(--mn-haste)",
    armorPen: "var(--mn-aa)", magicPen: "var(--mn-weak)",
};
const KIND_BOLD = new Set(["keywordMajor", "status", "attention", "spellName"]);
// A stat icon in the game's text -> the item shop's stat (for its icon and colour)
const CHIP_CAT: Record<string, string> = {
    scaleAP: "法術強度", scaleAD: "攻擊力", scaleCrit: "暴擊", scaleAS: "攻速", scaleAH: "技能急速", scaleAbilityHaste: "技能急速", scaleHealth: "生命",
    scaleArmor: "護甲", scaleMR: "魔防", scaleAPen: "物理穿透", scaleMPen: "法術穿透", scaleMana: "魔力", scaleMS: "移動", scaleLS: "吸血",
};
// An effect line drawn like the game's tooltip: a value that grows with level is a pill with a rising-line icon, a scaling ("（+50% 額外物攻）")
// is a pill in its stat's colour with the stat's icon, an amount of a stat ("20% 物攻") and a damage kind ("物理傷害") are coloured;
// pills keep a little space on both sides. One stat -> [colour, Lucide icon]; the longest word wins.
const FX_STAT: [RegExp, string, string][] = [
    [/魔法傷害|魔攻|魔力|魔法穿透/, "var(--mn-magic)", "sparkles"], [/物理傷害|物攻|物理致命|物理穿透/, "var(--mn-phys)", "sword"],
    [/真實傷害/, "var(--mn-true)", "gem"], [/適性/, "var(--mn-mixed)", "blend"], [/治療與護盾強度|治療|生命/, "var(--mn-heal)", "heart"],
    [/護盾|魔防/, "var(--mn-shield)", "shield-check"], [/物防/, "var(--mn-guard)", "shield"], [/攻速/, "var(--mn-true)", "gauge"],
    [/技能加速|大絕加速|道具加速/, "var(--mn-haste)", "timer-reset"], [/跑速/, "var(--mn-dash)", "footprints"], [/暴擊/, "var(--mn-exec)", "dice-5"],
    [/吸血/, "var(--mn-ls)", "syringe"], [/攻擊距離/, "var(--mn-range)", "ruler"],
];
const fxStat = (t: string): [string, string] | null => { for (const [re, c, i] of FX_STAT) if (re.test(t)) return [c, i]; return null; };
const FX_TOKEN = new RegExp([
    "（(?:\\+|每)[^（）]*(?:（[^（）]*）[^（）]*)*）",                                  // a scaling in brackets, maybe with a ranged value inside
    "\\d+(?:\\.\\d+)?%?–\\d+(?:\\.\\d+)?%?（隨等級[^）]*）",                              // a value by level
    "\\d+(?:\\.\\d+)?%?(?:（遠程 [^）]+）)?\\s?(?:額外|最大|目前|已損失|基礎|總)?(?:物攻|魔攻|攻速|技能加速|大絕加速|基礎技能加速|道具加速|跑速|物防|魔防|生命|暴擊率|暴擊傷害|全能吸血|普攻吸血|物理致命|物理穿透|魔法穿透|治療與護盾強度|適性之力|魔力|攻擊距離)",
    "\\d+(?:\\.\\d+)?%?(?:（遠程 [^）]+）|(?=（每))",                                     // a number with its ranged value, or before a scaling
    "魔法傷害|物理傷害|真實傷害|適性傷害",
    "(?:額外|最大|已損失)?(?:物攻|魔攻|攻速|技能加速|大絕加速|跑速|物防|魔防|暴擊率|暴擊傷害|全能吸血|普攻吸血|物理致命|物理穿透|魔法穿透|治療與護盾強度|適性之力)",   // a stat named on its own
].join("|"), "g");
function richEffect(p: HTMLElement, text: string): void {
    let at = 0;
    for (const m of text.matchAll(FX_TOKEN)) {
        const t = m[0], i = m.index ?? 0;
        if (i > at) p.append(text.slice(at, i));
        at = i + t.length;
        if (t.startsWith("（")) {   // a scaling pill: "+50% 額外物攻", the brackets dropped
            const inner = t.slice(1, -1);
            const st = fxStat(inner);
            const pill = h(p, "span", "mn-fx-sc");
            if (st) { pill.style.setProperty("--c", st[0]); icon(pill, st[1], "mn-fx-ic"); }
            pill.append(inner.replace(/^每\s*/, "每 "));
            continue;
        }
        const lv = /^(.+?)（隨等級[^）]*）$/.exec(t);
        if (lv) {   // a value by level
            const pill = h(p, "span", "mn-fx-lv");
            icon(pill, "trending-up", "mn-fx-ic");
            pill.append(lv[1]);
            continue;
        }
        const st = fxStat(t);
        const v = h(p, "span", "mn-fx-v", t);
        if (st) v.style.setProperty("--c", st[0]);
    }
    if (at < text.length) p.append(text.slice(at));
}
const LEVEL_LABEL = (lv: number, top: number) => (lv === top && top > 1 ? "最大" : `Lv${lv}`);

export function augmentPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const a = store.augment(Number(ctx.frame.params?.id));
    const el = h(null, "div", "mn-page mn-itpage");
    if (!a) { empty(el, { icon: "sparkles", title: "Augment not found" }); return { title: "", el }; }
    const data = store.augmentData(a.id);
    // a hand-written effect (the League wiki's Mayhem numbers) wins over Arena's game data, whose numbers often differ in Mayhem;
    // the game data is then used only for Riot's augment tags (who it suits)
    const nums = a.hand ? undefined : data;
    const history = store.augmentHistory(a.name);

    // banner: the icon in its rarity frame over a soft blur of itself, the name, the rarity and 新 when it came in this patch
    const hero = h(el, "div", "mn-it-hero mn-ag-hero");
    const bg = h(hero, "img", "mn-it-bg"); bg.src = a.icon; bg.alt = "";
    augIcon(hero, a.icon, a.rarity, "mn-dimg-aug mn-ag-ic");
    const who = h(hero, "div", "mn-it-who");
    h(who, "h1", "mn-it-name", a.name);
    const tags = h(who, "div", "mn-it-tags");
    const rar = h(tags, "span", "mn-ag-rar", a.rarity);
    rar.style.setProperty("--c", RARITY_COLOR[a.rarity] ?? "var(--mn-muted)");
    if (history[0]?.what === "added" && history[0].patch === store.riotNotes[0]?.patch) h(tags, "span", "mn-ag-new", "新");
    forChampion(el, store, a, String(ctx.frame.params?.champ ?? ""));

    // the numbers: a Lv1 / 最大 switch when it levels up; chips and the effect card follow it
    const levels = nums?.levels ?? [];
    let at = 0;
    const seg = levels.length > 1 ? h(el, "div", "mn-seg is-sm mn-ag-lv") : null;
    const chipsEl = h(el, "div", "mn-it-stats");
    const card = h(el, "div", "mn-it-fx mn-ag-fx");
    const draw = () => {
        chipsEl.empty();
        card.empty();
        for (const c of nums?.chips[at] ?? []) {
            const cat = CHIP_CAT[c.stat];
            const x = h(chipsEl, "span", "mn-it-stat");
            if (cat) x.style.setProperty("--c", ITEM_CAT_COLOR[cat] ?? "var(--mn-muted)");
            const k = cat ? ITEM_CATS.findIndex(([n]) => n === cat) : -1;
            if (k >= 0) shopIcon(x, k, true);
            const m = /^([+\-]?[\d.]+%?)\s*(.*)$/.exec(c.text);
            if (m) { h(x, "b", undefined, m[1]); x.append(m[2]); } else x.append(c.text);
        }
        chipsEl.toggleClass("is-empty", !chipsEl.childElementCount);
        const p = h(card, "p", "mn-it-fxt");
        if (nums) {
            for (const [text, kind] of nums.runs[at] ?? []) {
                if (!kind) { p.append(text); continue; }
                const sp = h(p, "span", KIND_BOLD.has(kind) ? "mn-ag-kw" : "mn-ag-k", text);
                if (KIND_COLOR[kind]) sp.style.setProperty("--c", KIND_COLOR[kind]);
            }
            h(card, "div", "mn-pn-src", `數值：競技場的遊戲資料，大混戰可能不同${nums.partial ? "（X 是遊戲內才算得出的數值）" : ""}`);
        } else if (a.effect) {
            richEffect(p, a.effect);
            // a hand-written effect names where it came from (the League wiki's numbers, CC BY-SA) and whether it was checked in game
            const src = a.effectSource ? `數值：${a.effectSource}${a.effectSource.includes("Wiki") ? "（CC BY-SA）" : ""}${a.effectPatch ? ` · ${a.effectPatch}` : ""}${a.effectStatus ? ` · ${a.effectStatus}` : ""}` : "";
            h(card, "div", "mn-pn-src", src || (a.partial ? "數值待補（X 是遊戲內才看得到的數值）" : "效果：Riot Games"));
        } else {
            // Riot's patch notes only describe an augment in the patch that adds or changes it; older ones have no text we can read yet
            p.addClass("mn-muted");
            p.setText("這個強化的效果說明還沒有收錄。");
        }
    };
    if (seg) {
        levels.forEach((lv, i) => {
            const b = h(seg, "button", "mn-seg-b" + (i === 0 ? " is-on" : ""), LEVEL_LABEL(lv, levels[levels.length - 1]));
            b.addEventListener("click", (e) => {
                e.preventDefault();
                if (at === i) return;
                at = i;
                seg.querySelectorAll(".mn-seg-b").forEach((x, j) => x.toggleClass("is-on", j === i));
                draw();
            });
        });
        slideSeg(seg);
    }
    draw();
    if (!a.effect && !data) {
        const links = group(el);
        row(links, { icon: "external-link", title: "在 League 維基查看效果", chevron: true, onTap: () => window.open("https://wiki.leagueoflegends.com/en-us/ARAM_Mayhem/Augments") });
        row(links, { icon: "external-link", title: "OP.GG 強化列表", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
    }

    // who it suits: the augment model's best users (Dev Tools/Augment Model.md), the champions it is S for, then A
    if (modelUsers(el, store, a, ctx)) {
        if (history.length) {
            h(el, "div", "mn-gh", "版本紀錄");
            h(el, "div", "mn-ag-hist", history.map((x) => `${x.what === "added" ? "新增於" : "移除於"} ${x.patch}`).join(" · "));
        }
        return { title: "", el };
    }
    // without the model's file: Riot's own tags when they rule champions out, else the hand-written `fits`, else a guess from the wording
    const all = store.champions();
    let tagList: string[] = [], list: Champion[] = [], label = "";
    if (data?.fits) {
        const ok = new Set(data.fits);
        tagList = data.tags;
        list = all.filter((c) => ok.has(c.id.toLowerCase()));
        label = `遊戲的強化標籤：只會出現在這 ${list.length} 位英雄的選項裡`;
    } else if (a.fits.length) {
        tagList = a.fits;
        list = all.filter((c) => a.fits.some((f) => c.archetypes.includes(f) || c.features.includes(f) || c.roles.includes(f))).slice(0, SUGGESTED);
        label = "人工整理";
    } else if (a.effect) {
        const s = suggest(a.effect, all);
        tagList = s.tags;
        list = s.champions;
        label = "依效果文字推測，僅供參考";
    }
    if (list.length) {
        h(el, "div", "mn-gh", "適合的英雄");
        if (tagList.length) { const chips = h(el, "div", "mn-chips mn-ag-tags"); for (const t of tagList) chip(chips, t); }
        const strip = layoutBlock(h(el, "div", "mn-ag-strip"));
        for (const c of list) {
            const tile = h(strip, "button", "mn-tile");
            const t = h(tile, "img"); t.src = c.icon; t.alt = "";
            h(tile, "span", "mn-tile-n", c.name);
            tile.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(c.id, "augments"); });
        }
        h(el, "div", "mn-gf", label);
    }
    if (history.length) {
        h(el, "div", "mn-gh", "版本紀錄");
        h(el, "div", "mn-ag-hist", history.map((x) => `${x.what === "added" ? "新增於" : "移除於"} ${x.patch}`).join(" · "));
    }
    return { title: "", el };   // the name is already the big heading
}

// Opened from a champion's 強化: how the augment fits that champion (its face, the tier in its colour, the reason, 前期強 / 後期強),
// the detail its icon grid leaves out
function forChampion(el: HTMLElement, store: Store, a: Augment, cid: string): void {
    const c = cid ? store.champion(cid) : undefined;
    if (!c) return;
    let best: AugTier | undefined;
    for (const st of Object.values(store.augTiers[cid] ?? {})) {
        const t = st.tiers.find((x) => x.id === a.id);
        if (t && (!best || t.score > best.score)) best = t;
    }
    const line = h(el, "div", "mn-ag-for");
    const im = h(line, "img"); im.src = c.icon; im.alt = "";
    const tx = h(line, "div", "mn-ag-for-t");
    if (c.pinned.includes(a.name)) { h(tx, "b", undefined, `${c.name} · 置頂`); return; }
    if (!best) { h(tx, "b", undefined, `${c.name} · 沒有幫助`); return; }
    const head = h(tx, "b");
    head.append(`${c.name} · `);
    const tier = h(head, "span", "mn-ag-for-tier", best.tier);
    tier.style.setProperty("--t", TIER_COLOR[best.tier] ?? "var(--mn-muted)");
    h(tx, "span", undefined, [best.reason, best.when].filter(Boolean).join(" · "));
}

// The augment model's best users of an augment: per champion its best play style's tier; the S ones, then the A ones, best first, as
// rows of faces (a tap opens the champion's 強化). An augment the model cannot value says why. False when there is no model file.
const USERS_SHOWN = 24;   // faces per tier row
function modelUsers(el: HTMLElement, store: Store, a: Augment, ctx: PageCtx): boolean {
    const champs = Object.entries(store.augTiers);
    if (!champs.length) return false;
    h(el, "div", "mn-gh", "適合的英雄");
    const why = store.augUnrated[String(a.id)];
    if (why) { h(el, "div", "mn-gf", `這個強化無法用數值估算（${why}），沒有排名。`); return true; }
    const best = new Map<string, { tier: string; score: number }>();
    for (const [cid, styles] of champs) {
        for (const st of Object.values(styles)) {
            const t = st.tiers.find((x) => x.id === a.id);
            if (t && (!best.has(cid) || t.score > best.get(cid)!.score)) best.set(cid, { tier: t.tier, score: t.score });
        }
    }
    let shown = 0;
    for (const tier of ["S", "A"]) {
        const list = [...best].filter(([, b]) => b.tier === tier).sort((x, y) => y[1].score - x[1].score).slice(0, USERS_SHOWN);
        const faces = list.map(([cid]) => store.champion(cid)).filter((c): c is Champion => !!c);
        if (!faces.length) continue;
        shown += faces.length;
        h(el, "div", "mn-ag-tier", tier);
        const strip = layoutBlock(h(el, "div", "mn-ag-strip"));
        for (const c of faces) {
            const tile = h(strip, "button", "mn-tile");
            const t = h(tile, "img"); t.src = c.icon; t.alt = "";
            h(tile, "span", "mn-tile-n", c.name);
            tile.addEventListener("click", (e) => { e.preventDefault(); ctx.openChampion(c.id, "augments"); });
        }
    }
    h(el, "div", "mn-gf", shown ? "依英雄的技能數值估算：對這些英雄是 S 或 A（和同稀有度的其他強化比較，也和其他英雄比較）。不是勝率。"
        : "依英雄的技能數值估算，沒有英雄特別適合這個強化。");
    return true;
}

// An item's text, split for its page: the stats ("120 魔法攻擊"), then each passive or active with its name and text. Riot's text is one
// line with " / " between the parts; a part "名：text" is one effect, a short part with no full stop is a name whose text follows.
const STAT_CAT: Record<string, string> = {
    生命: "生命", 基礎生命回復: "生命", 物理攻擊: "攻擊力", 魔法攻擊: "法術強度", 技能加速: "技能急速", 冷卻時間減免: "技能急速", 物理防禦: "護甲",
    魔法防禦: "魔防", 跑速: "移動", 攻擊速度: "攻速", 暴擊率: "暴擊", 暴擊傷害: "暴擊", 魔力: "魔力", 基礎魔力回復: "魔力", 物理致命: "物理穿透",
    物理穿透: "物理穿透", 魔法穿透: "法術穿透", 普攻吸血: "吸血", 全能吸血: "吸血",
};
const STAT_NAME = 8;   // a stat's name is short; a longer "number + words" part is effect text
const FX_NAME = 16;    // an effect's name, without its cooldown in brackets, is short and has no full stop or comma
const bareName = (part: string) => { const b = part.replace(/\s*[（(][^)）]*[)）]/g, "").trim(); return b.length > 0 && b.length <= FX_NAME && !/[。，、]/.test(b); };
function splitItemText(desc: string): { stats: { value: string; name: string }[]; effects: { name: string; text: string; active: boolean }[] } {
    const stats: { value: string; name: string }[] = [];
    const effects: { name: string; text: string; active: boolean }[] = [];
    for (const raw of desc.split(" / ")) {
        const part = raw.trim();
        if (!part) continue;
        const st = /^([+\-]?\d+(?:\.\d+)?%?)\s*([^\d：。，]+)$/.exec(part);
        if (st && !effects.length && st[2].trim().length <= STAT_NAME) { stats.push({ value: st[1], name: st[2].trim() }); continue; }
        const named = /^([^：。，]{1,16})：(.+)$/.exec(part);
        const last = effects[effects.length - 1];
        if (named) effects.push({ name: named[1].trim(), text: named[2].trim(), active: /^主動/.test(named[1]) });
        else if (bareName(part)) effects.push({ name: part, text: "", active: /^主動/.test(part) });   // a name (perhaps with its cooldown); its text follows
        else if (last) last.text = last.text ? `${last.text}${part}` : part;
        else effects.push({ name: "", text: part, active: false });
    }
    return { stats, effects };
}

// ---- an item (layout "道具卡", Dev Tools/Layouts.md): a banner with the item's picture blurred behind its icon, name, price and ARAM tag;
// the stats as chips with the shop's icons; each passive / active in its own card; then its recipe tree, what it builds into, Riot's changes
export function itemPage(ctx: PageCtx): PageOut {
    const store = ctx.plugin.store;
    const item = store.item(Number(ctx.frame.params?.id));
    const el = h(null, "div", "mn-page mn-itpage");
    if (!item) { empty(el, { icon: "package-x", title: "Item not found" }); return { title: "", el }; }
    const hero = h(el, "div", "mn-it-hero");
    const bg = h(hero, "img", "mn-it-bg"); bg.src = item.icon; bg.alt = "";
    const im = h(hero, "img", "mn-it-ic"); im.src = item.icon; im.alt = "";
    const who = h(hero, "div", "mn-it-who");
    h(who, "h1", "mn-it-name", item.name);
    const tags = h(who, "div", "mn-it-tags");
    h(tags, "span", "mn-it-gold", `${item.goldTotal} 金`);
    if (item.variantOf) h(tags, "span", "mn-it-aram", "ARAM 版本");
    // everything under the banner, centred down the screen when it is shorter than the screen (Design Rules, balance)
    el.addClass("is-centred");
    const body = h(el, "div", "mn-it-body");
    const { stats, effects } = splitItemText(item.desc);
    if (stats.length) {
        const row = h(body, "div", "mn-it-stats");
        for (const s of stats) {
            const cat = STAT_CAT[s.name];
            const k = cat ? ITEM_CATS.findIndex(([n]) => n === cat) : -1;
            const x = h(row, "span", "mn-it-stat");
            if (cat) x.style.setProperty("--c", ITEM_CAT_COLOR[cat] ?? "var(--mn-muted)");
            if (k >= 0) shopIcon(x, k, true);
            h(x, "b", undefined, s.value);
            x.append(s.name);
        }
    }
    for (const fx of effects) {
        const card = h(body, "div", "mn-it-fx" + (fx.active ? " is-active" : ""));
        if (fx.active) h(card, "span", "mn-it-fxk", "主動");   // Riot's text marks an active only sometimes, so a card without it has no label
        if (fx.name) h(card, "b", "mn-it-fxn", fx.name.replace(/^主動\s*[─-]\s*/, ""));
        if (fx.text) h(card, "p", "mn-it-fxt", fx.text);
    }
    if (item.variantOf) h(body, "div", "mn-gf", "價格與數值和一般版本不同。");
    // its route: what it is made of, drawn like the shop's tree; then what it builds into, in two rows: 升級 (straight into) and 最終
    // (the legendaries they lead to), so a base item shows its whole path instead of a short page with blank space under it
    if (item.from.length) { h(body, "div", "mn-gh", "合成材料"); itemTree(h(body, "div", "mn-itree"), ctx, item.id); }
    const next = item.into.map((id) => store.item(id)).filter((i): i is Item => !!i && !i.reward);
    const finals = new Map<number, Item>();
    for (const i of next) for (const id of i.into) { const f = store.item(id); if (f && !f.reward && !next.includes(f)) finals.set(f.id, f); }
    recipe(body, ctx, "升級", next);
    recipe(body, ctx, "最終", [...finals.values()].sort((x, y) => x.goldTotal - y.goldTotal));
    const official = store.officialFor("items", item.name);
    if (official.length) { h(body, "div", "mn-gh", "版本調整"); officialBlock(body, official); }
    return { title: "", el };
}

function recipe(el: HTMLElement, ctx: PageCtx, title: string, items: Item[]): void {
    if (!items.length) return;
    h(el, "div", "mn-gh", title);
    const grid = layoutBlock(h(el, "div", "mn-recipe"));
    for (const i of items) {
        const b = h(grid, "button", "mn-rc");
        const im = h(b, "img"); im.src = i.icon; im.alt = "";
        h(b, "span", "mn-rc-n", i.name);
        h(b, "span", "mn-rc-g", `${i.goldTotal}`);
        b.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(i.id); });
    }
}
