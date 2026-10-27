import { MarkdownRenderer, TFile } from "obsidian";
import type { Champion } from "../data/store";
import { DAMAGE_COLOR, augIcon, h, icon, radar } from "../ui";
import type { PageCtx, PageOut } from "./index";
import { demo } from "./skills";

// A guide topic as a deck of swipeable cards. In the note every `## ` heading is one card; right under it:
//   icon: swords                       the big icon when there is no picture (a Lucide name)
//   visual: <kind> <arguments>         what to show on the card (below)
// and then one or two short lines. Visuals:
//   video Ahri Q        Riot's ability clip (champion id + P/Q/W/E/R)       img Assets/hud.png   a picture in the vault, or an https address
//   radar Ahri          the champion's radar chart                           skills Ahri          the skill icons with their damage-colour frames
//   role 戰士           champions of that role (a few, changing daily)       champs Ahri Garen    those champions
//   itemtag Armor       items of that kind (Armor, SpellBlock, Health…)      item 3089            one item and what it is built from
//   augs 稜鏡           Mayhem augments of that rarity (a few, changing daily)
interface Slide { title: string; icon: string; visual: string; text: string }
const STRIP = 6;   // icons in a strip

export function parseSlides(md: string): Slide[] {
    const body = md.replace(/^---[\s\S]*?---\n/, "");
    return body.split(/^## /m).slice(1).map((part) => {
        const lines = part.split("\n");
        const title = (lines.shift() ?? "").trim();
        let ic = "", visual = "";
        const text: string[] = [];
        for (const l of lines) {
            const m = /^(icon|visual):\s*(.*)$/.exec(l.trim());
            if (m) { if (m[1] === "icon") ic = m[2].trim(); else visual = m[2].trim(); } else text.push(l);
        }
        return { title, icon: ic || "sparkles", visual, text: text.join("\n").trim() };
    });
}

const hashStr = (s: string): number => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const day = () => String(Math.floor(Date.now() / 86_400_000));

export function deckPage(ctx: PageCtx, file: TFile): PageOut {
    const store = ctx.plugin.store;
    const el = h(null, "div", "mn-page mn-deckpage");
    h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
    const dots = h(el, "div", "mn-dots");
    const pager = h(el, "div", "mn-pager");
    const nav = h(el, "div", "mn-decknav");

    void ctx.app.vault.cachedRead(file).then((md) => {
        const slides = parseSlides(md);
        const guide = store.guideNotes();
        const at = guide.findIndex((n) => n.file.path === file.path);
        const next = guide[at + 1];

        slides.forEach((s, i) => {
            h(dots, "span", "mn-dot2" + (i === 0 ? " is-on" : ""));
            const sec = h(pager, "section", "mn-slide");
            visual(ctx, h(sec, "div", "mn-sl-vis"), s);
            h(sec, "h2", "mn-sl-t", s.title);
            if (s.text) void MarkdownRenderer.render(ctx.app, s.text, h(sec, "div", "mn-sl-x markdown-rendered"), file.path, ctx.component);
        });
        // the last card: on to the next topic
        const end = h(pager, "section", "mn-slide mn-slide-end");
        h(h(end, "div", "mn-sl-vis"), "div", "mn-sl-hero").appendChild(document.createTextNode("🎉"));
        h(end, "h2", "mn-sl-t", next ? "讀完了!" : "全部讀完了!");
        if (next) {
            const b = h(end, "button", "mn-nextcard");
            h(b, "span", "mn-nextcard-k", "下一篇");
            h(b, "span", "mn-nextcard-t", next.title);
            icon(b, "arrow-right", "mn-nextcard-ic");
            b.addEventListener("click", (e) => { e.preventDefault(); ctx.pop(); ctx.openNote(next.file.path); });
        }
        h(dots, "span", "mn-dot2");

        const count = slides.length + 1;
        const prev = h(nav, "button", "mn-navb", "‹");
        const label = h(nav, "span", "mn-navl", `1 / ${count}`);
        const fwd = h(nav, "button", "mn-navb", "›");
        const go = (d: number) => pager.scrollBy({ left: d * pager.clientWidth, behavior: "smooth" });
        prev.addEventListener("click", (e) => { e.preventDefault(); go(-1); });
        fwd.addEventListener("click", (e) => { e.preventDefault(); go(1); });
        pager.addEventListener("scroll", () => {
            const i = Math.max(0, Math.min(count - 1, Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth))));
            Array.from(dots.children).forEach((d, j) => (d as HTMLElement).toggleClass("is-on", j === i));
            label.textContent = `${i + 1} / ${count}`;
            if (i >= count - 1) void ctx.plugin.markRead(file.path);   // reached the end: counts as read
        }, { passive: true });
    });
    return { title: file.basename, el };
}

// ---- the picture of a card
function visual(ctx: PageCtx, box: HTMLElement, s: Slide): void {
    const store = ctx.plugin.store;
    const [kind, ...args] = s.visual.split(/\s+/).filter(Boolean);
    const champ = (id?: string): Champion | undefined => (id ? store.champion(id) : undefined);

    if (kind === "video") {
        const c = champ(args[0]);
        if (c) { const wrap = h(box, "div", "mn-sl-video"); demo(wrap, c, { key: args[1] ?? "Q" }); return; }
    } else if (kind === "img") {
        const src = args.join(" ");
        const url = /^https?:/.test(src) ? src : ctx.app.vault.adapter.getResourcePath(src);
        const im = h(box, "img", "mn-sl-img"); im.src = url; im.alt = ""; return;
    } else if (kind === "radar") {
        const c = champ(args[0]);
        if (c) {
            const p = h(box, "div", "mn-sl-radar");
            radar(p, [{ label: "物理", value: c.attack }, { label: "魔法", value: c.magic }, { label: "防禦", value: c.defense },
                { label: "射程", value: Math.min(10, Math.round(c.range / 65)) }, { label: "難度", value: c.difficulty }], 10, DAMAGE_COLOR[c.damageType]);
            return;
        }
    } else if (kind === "skills") {
        const c = champ(args[0]);
        if (c) {
            const strip = h(box, "div", "mn-skills mn-sl-skills");
            for (const k of c.skills) {
                const b = h(strip, "div", "mn-skill-box");
                b.style.setProperty("--chip", DAMAGE_COLOR[k.damage[0] ?? ""] ?? "var(--background-modifier-border)");
                const im = h(b, "img"); im.src = k.icon; im.alt = "";
                h(b, "span", "mn-skill-k", k.key);
            }
            return;
        }
    } else if (kind === "role") {
        const list = store.champions().filter((c) => c.roles.includes(args[0] ?? "")).sort((a, b) => hashStr(a.id + day()) - hashStr(b.id + day())).slice(0, STRIP);
        if (list.length) { strip(box, list.map((c) => ({ src: c.icon, label: c.name, tap: () => ctx.openChampion(c.id) }))); return; }
    } else if (kind === "champs") {
        const list = args.map(champ).filter((c): c is Champion => !!c);
        if (list.length) { strip(box, list.map((c) => ({ src: c.icon, label: c.name, tap: () => ctx.openChampion(c.id) }))); return; }
    } else if (kind === "itemtag") {
        const list = store.items().filter((i) => i.aram && i.tags.includes(args[0] ?? "") && i.into.length === 0 && i.goldTotal >= 2000)
            .sort((a, b) => hashStr(String(a.id) + day()) - hashStr(String(b.id) + day())).slice(0, STRIP - 1);
        if (list.length) { strip(box, list.map((i) => ({ src: i.icon, label: i.name, tap: () => ctx.openItem(i.id) }))); return; }
    } else if (kind === "item") {
        const i = store.item(Number(args[0]));
        if (i) {
            const parts = i.from.map((id) => store.item(id)).filter((x) => !!x);
            strip(box, [{ src: i.icon, label: i.name, tap: () => ctx.openItem(i.id) }, ...parts.map((p) => ({ src: p!.icon, label: p!.name, tap: () => ctx.openItem(p!.id) }))]);
            return;
        }
    } else if (kind === "augs") {
        const list = store.augments().filter((a) => a.rarity === args[0]).sort((a, b) => hashStr(String(a.id) + day()) - hashStr(String(b.id) + day())).slice(0, STRIP);
        if (list.length) { strip(box, list.map((a) => ({ src: a.icon, label: a.name, rarity: a.rarity, tap: () => ctx.openAugment(a.id) }))); return; }
    }
    // nothing to show (or not enough data): the card's own big icon
    icon(h(box, "div", "mn-sl-hero"), s.icon);
}

// icons with their names under them
function strip(box: HTMLElement, items: { src: string; label: string; rarity?: string; tap: () => void }[]): void {
    const row = h(box, "div", "mn-sl-strip");
    for (const it of items) {
        const b = h(row, "button", "mn-sl-ic");
        if (it.rarity) augIcon(b, it.src, it.rarity, "mn-sl-aug");
        else { const im = h(b, "img"); im.src = it.src; im.alt = ""; }
        h(b, "span", "", it.label);
        b.addEventListener("click", (e) => { e.preventDefault(); it.tap(); });
    }
}
