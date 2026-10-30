import { MarkdownRenderer, TFile } from "obsidian";
import type { Augment, Champion, Item, Store } from "../data/store";
import { ITEM_CAT_COLOR, ITEM_CATS, augIcon, chip, empty, group, h, icon, layoutBlock, row, shopIcon, slideSeg } from "../ui";
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

// Which augments suit a champion (its Augments tab), best first, and why: pinned on the champion note first; then Riot's own augment
// tags (the game offers it to this champion and not to everyone); then the augment's hand-written `fits`; then a guess from the
// effect text (the same as the augment page's). Left out: the champion's `avoid`, and augments the game never offers it (Riot's tags).
export interface AugmentPick { a: Augment; why: string; score: number }
export function augmentPicks(store: Store, c: Champion): AugmentPick[] {
    const out: AugmentPick[] = [];
    for (const a of store.augments()) {
        if (c.avoid.includes(a.name)) continue;
        const data = store.augmentData(a.id);
        if (data?.fits && !data.fits.includes(c.id.toLowerCase())) continue;   // never offered to this champion
        let why = "", score = 0;
        if (c.pinned.includes(a.name)) { why = "置頂"; score = 100; }
        else if (data?.fits) { why = "遊戲標籤"; score = 60; }
        else if (a.fits.length && a.fits.some((f) => c.archetypes.includes(f) || c.features.includes(f) || c.roles.includes(f))) { why = "人工整理"; score = 50; }
        else if (a.effect) {
            const kinds = KINDS.filter((k) => k.re.test(a.effect));
            const n = kinds.filter((k) => k.fits(c)).length;
            if (kinds.length && n >= Math.max(1, Math.ceil(kinds.length * 0.6))) { why = "推測"; score = 10 + n * 5 + (n === kinds.length ? 5 : 0); }
        }
        if (score) out.push({ a, why, score });
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

    // who it suits: Riot's own tags when they rule champions out, else the hand-written `fits`, else a guess from the wording
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
    const { stats, effects } = splitItemText(item.desc);
    if (stats.length) {
        const row = h(el, "div", "mn-it-stats");
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
        const card = h(el, "div", "mn-it-fx" + (fx.active ? " is-active" : ""));
        if (fx.active) h(card, "span", "mn-it-fxk", "主動");   // Riot's text marks an active only sometimes, so a card without it has no label
        if (fx.name) h(card, "b", "mn-it-fxn", fx.name.replace(/^主動\s*[─-]\s*/, ""));
        if (fx.text) h(card, "p", "mn-it-fxt", fx.text);
    }
    if (item.variantOf) h(el, "div", "mn-gf", "價格與數值和一般版本不同。");
    // what it is made of, drawn like the shop's tree; then what it builds into; Riot's changes last
    if (item.from.length) { h(el, "div", "mn-gh", "合成材料"); itemTree(h(el, "div", "mn-panel mn-itree"), ctx, item.id); }
    recipe(el, ctx, "可合成", item.into.map((id) => store.item(id)).filter((i): i is Item => !!i));
    const official = store.officialFor("items", item.name);
    if (official.length) { h(el, "div", "mn-gh", "版本調整"); officialBlock(el, official); }
    return { title: "", el };
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
