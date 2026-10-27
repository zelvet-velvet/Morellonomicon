import type { Champion, Change, NoteEntry } from "../data/store";
import { h, icon } from "../ui";
import type { PageCtx } from "./index";

export const DIR_COLOR: Record<string, string> = { buff: "var(--color-green)", nerf: "var(--color-red)", mixed: "var(--color-yellow)", change: "var(--color-blue)", text: "var(--color-blue)" };
const DIR_MARK: Record<string, string> = { buff: "▲", nerf: "▼", mixed: "◆", change: "●", text: "✎" };

// Which way one of Riot's patch-note lines goes for the player, guessed from the numbers and the name of the stat (the notes themselves do not say).
// Only stats whose better direction is obvious count: lower cooldown / cost is better; more damage, shield, heal, health, armor, speed, range... is better.
// Anything else (durations, ratios, "damage taken"...) is just an adjustment, shown without an arrow.
const LOWER_IS_BETTER = /冷卻|消耗|前搖|後搖|施放時間/;
const HIGHER_IS_BETTER = /傷害|護盾|治療|回復|生命|護甲|魔抗|物防|魔防|攻擊力|物攻|魔攻|攻速|跑速|移速|射程|吸血|韌性|穿透|技能加速|魔力/;
const AMBIGUOUS = /受到|承受|減免|敵/;
const numbers = (s: string): number[] => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
export type OfficialDir = "buff" | "nerf" | "mixed" | "change";

export function noteChangeDir(c: { label: string; old: string; new: string }): OfficialDir {
    const a = numbers(c.old), b = numbers(c.new);
    const n = Math.min(a.length, b.length);
    if (!n || AMBIGUOUS.test(c.label)) return "change";
    let up = 0, down = 0;
    for (let i = 0; i < n; i++) { if (b[i] > a[i]) up++; else if (b[i] < a[i]) down++; }
    if (up && down) return "mixed";
    if (!up && !down) return "change";
    const lower = LOWER_IS_BETTER.test(c.label);
    if (!lower && !HIGHER_IS_BETTER.test(c.label)) return "change";
    return (up > 0) !== lower ? "buff" : "nerf";
}

// The overall direction of one champion's / item's entry: all buffs, all nerfs, a mix, or just adjusted
export function entryDir(e: NoteEntry): OfficialDir {
    const dirs = e.changes.map(noteChangeDir);
    const buff = dirs.includes("buff"), nerf = dirs.includes("nerf");
    if (dirs.includes("mixed") || (buff && nerf)) return "mixed";
    return buff ? "buff" : nerf ? "nerf" : "change";
}

export const marker = (d: OfficialDir): { mark: string; color: string } => ({ mark: DIR_MARK[d] ?? "●", color: DIR_COLOR[d] ?? DIR_COLOR.change });

// ▲ buffs, ▼ nerfs (text rewrites and neutral changes are not counted) for a list of changes
export function tally(items: Change[]): { buff: number; nerf: number; mixed: number } {
    return { buff: items.filter((i) => i.dir === "buff").length, nerf: items.filter((i) => i.dir === "nerf").length, mixed: items.filter((i) => i.dir === "mixed").length };
}

export function badgeText(items: Change[]): string {
    const t = tally(items);
    return [t.buff ? `▲${t.buff}` : "", t.nerf ? `▼${t.nerf}` : "", t.mixed ? `◆${t.mixed}` : ""].filter(Boolean).join(" ");
}

export function badgeColor(items: Change[]): string {
    const t = tally(items);
    if (t.mixed || (t.buff && t.nerf)) return DIR_COLOR.mixed;
    return t.nerf ? DIR_COLOR.nerf : t.buff ? DIR_COLOR.buff : DIR_COLOR.change;
}

// Riot's own lines for one champion or item, one section per patch ("label old → new"); the full text is on Riot's page.
export function officialBlock(parent: HTMLElement, list: { patch: string; url: string; entry: NoteEntry }[]): void {
    for (const { patch, url, entry } of list) {
        const sec = h(parent, "div", "mn-off");
        const head = h(sec, "div", "mn-off-h");
        h(head, "span", "mn-off-t", `Riot ${patch} 版本公告`);
        const link = h(head, "button", "mn-off-link", "全文 ↗");
        link.addEventListener("click", (e) => { e.preventDefault(); window.open(url); });
        for (const c of entry.changes) {
            const line = h(sec, "div", "mn-ent-ch");
            h(line, "div", "mn-ent-l", c.label);
            const vals = h(line, "div", "mn-ent-v");
            h(vals, "span", "mn-chg-old", c.old);
            h(vals, "span", "mn-chg-arrow", "→");
            h(vals, "span", "mn-chg-new", c.new);
        }
        if (entry.more) h(sec, "div", "mn-gf", `還有 ${entry.more} 項,見全文`);
    }
}

// "Recent changes": Riot's patch-note lines for this champion, then what we found by comparing the data patch to patch (numbers coloured by
// who they favour). A rewritten skill text shows its old and new wording when tapped; it may be a real mechanic change or only a rewording,
// so it is not coloured as better or worse.
export function changesBlock(parent: HTMLElement, c: Champion, ctx: PageCtx): { el: HTMLElement; open(): void } | null {
    const store = ctx.plugin.store;
    const patches = store.changesOf(c.id);
    const official = store.officialFor("champions", c.name);
    if (!patches.length && !official.length) return null;
    const el = h(parent, "div", "mn-chg");
    const head = h(el, "button", "mn-chg-head");
    icon(head, "history", "mn-chg-ic");
    h(head, "span", "mn-chg-t", `Recent changes · ${official.length || patches.length} patch${(official.length || patches.length) > 1 ? "es" : ""}`);
    const caret = icon(head, "chevron-down", "mn-chg-caret");
    const body = h(el, "div", "mn-chg-body");
    if (official.length) officialBlock(body, official);
    if (patches.length) h(body, "div", "mn-chg-sub", "資料比對(冷卻、消耗、射程、屬性)");
    for (const p of patches) {
        h(body, "div", "mn-chg-p", `${p.from} → ${p.patch}`);
        for (const i of p.items) {
            const row = h(body, "div", "mn-chg-row");
            const mark = h(row, "span", "mn-chg-m", DIR_MARK[i.dir] ?? "●");
            mark.style.color = DIR_COLOR[i.dir];
            h(row, "span", "mn-chg-s", i.scope);
            h(row, "span", "mn-chg-f", i.field);
            if (i.dir === "text") {
                const more = h(row, "button", "mn-chg-more", "Old / new wording");
                const diff = h(body, "div", "mn-chg-diff");
                more.addEventListener("click", (e) => { e.preventDefault(); diff.toggleClass("is-open", !diff.hasClass("is-open")); });
                h(diff, "div", "mn-chg-old", i.old);
                h(diff, "div", "mn-chg-new", i.new);
            } else {
                h(row, "span", "mn-chg-old", i.old);
                h(row, "span", "mn-chg-arrow", "→");
                const nv = h(row, "span", "mn-chg-new", i.new);
                nv.style.color = DIR_COLOR[i.dir];
            }
        }
    }
    const set = (open: boolean) => { el.toggleClass("is-open", open); caret.toggleClass("is-up", open); };
    head.addEventListener("click", (e) => { e.preventDefault(); set(!el.hasClass("is-open")); });
    return { el, open: () => set(true) };
}
