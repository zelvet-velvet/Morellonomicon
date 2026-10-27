import type { Champion, Change } from "../data/store";
import { h, icon } from "../ui";
import type { PageCtx } from "./index";

export const DIR_COLOR: Record<string, string> = { buff: "var(--color-green)", nerf: "var(--color-red)", mixed: "var(--color-yellow)", change: "var(--color-blue)", text: "var(--color-blue)" };
const DIR_MARK: Record<string, string> = { buff: "▲", nerf: "▼", mixed: "◆", change: "●", text: "✎" };

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

// "Recent changes": one section per patch with changes (newest first), numbers coloured by who they favour. A rewritten skill text
// shows its old and new wording when tapped; it may be a real mechanic change or only a rewording, so it is not coloured as better or worse.
export function changesBlock(parent: HTMLElement, c: Champion, ctx: PageCtx): { el: HTMLElement; open(): void } | null {
    const patches = ctx.plugin.store.changesOf(c.id);
    if (!patches.length) return null;
    const el = h(parent, "div", "mn-chg");
    const head = h(el, "button", "mn-chg-head");
    icon(head, "history", "mn-chg-ic");
    h(head, "span", "mn-chg-t", `Recent changes · ${patches.length} patch${patches.length > 1 ? "es" : ""}`);
    const caret = icon(head, "chevron-down", "mn-chg-caret");
    const body = h(el, "div", "mn-chg-body");
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

