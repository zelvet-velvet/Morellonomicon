import { MarkdownRenderer, TFile } from "obsidian";
import type { Champion } from "../data/store";
import { DAMAGE_COLOR, LANES, augIcon, fgrid, h, haptic, icon, laneChip, roleChip } from "../ui";
import { factsStrip, profileAxes, profileRadar, styleCard, tagRow } from "./profile";
import type { PageCtx, PageOut } from "./index";
import { demo } from "./skills";

// A guide topic as a deck of swipeable cards. In the note every `## ` heading is one card; right under it:
//   icon: swords                       the big icon when there is no picture (a Lucide name)
//   visual: <kind> <arguments>         what to show on the card (below)
// and then one or two short lines. Visuals:
//   video Ahri Q        Riot's ability clip (champion id + P/Q/W/E/R)       img Assets/hud.png   a picture in the vault, or an https address
//   style Ahri          the champion page's 戰鬥風格 chart                    skills Ahri          the skill icons with their damage-colour frames
//   facts Ahri          the 技能傷害 block (bar and table)                    tags Ahri            the ability tags it has
//   roles               the six role icons                                   lanes                the five lane icons
//   radar Ahri          the older radar chart
//   role 戰士           champions of that role (a few, changing daily)       champs Ahri Garen    those champions
//   itemtag Armor       items of that kind (Armor, SpellBlock, Health…)      item 3089            one item and what it is built from
//   augs 稜鏡           Mayhem augments of that rarity (a few, changing daily)
interface Slide { title: string; icon: string; visual: string; text: string }
const STRIP = 6;   // icons in a strip
const PULL = 0.42;     // how far the last card moves per px pulled (it resists, like a rubber band)
const GO_AT = 120;     // px of card movement that opens the next topic when the finger lifts

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
    const bars = h(el, "div", "mn-bars");   // one short bar per card, filled up to the one in view (like stories)
    const wrap = h(el, "div", "mn-deckwrap");
    const peek = h(wrap, "div", "mn-peek");   // behind the cards: what pulling the last card leads to
    const pager = h(wrap, "div", "mn-pager");
    // the deck owns sideways swipes: Obsidian's own edge swipes (open a sidebar) must not take them
    for (const ev of ["touchstart", "touchmove"]) pager.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    // cards fill the screen down to the tab bar
    const fit = () => {
        const scroll = el.closest<HTMLElement>(".mn-scroll");
        if (!scroll) return;
        const top = wrap.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
        wrap.style.height = `${Math.max(380, scroll.clientHeight - top - 14)}px`;
    };

    void ctx.app.vault.cachedRead(file).then((md) => {
        const slides = parseSlides(md);
        const guide = store.guideNotes().filter((n) => n.layout === "deck");
        const at = guide.findIndex((n) => n.file.path === file.path);
        const next = guide[at + 1];
        const cards: HTMLElement[] = [];

        for (const s of slides) {
            h(bars, "span", "mn-bar");
            const card = h(h(pager, "section", "mn-slide"), "div", "mn-sl-card");
            visual(ctx, h(card, "div", "mn-sl-vis"), s);
            const words = h(card, "div", "mn-sl-words");
            h(words, "h2", "mn-sl-t", s.title);
            if (s.text) void MarkdownRenderer.render(ctx.app, s.text, h(words, "div", "mn-sl-x markdown-rendered"), file.path, ctx.component);
            cards.push(card);
        }
        // behind the last card: the next topic (or, after the last topic, the way back)
        if (next) {
            icon(h(peek, "div", "mn-peek-ic"), next.icon);
            h(peek, "div", "mn-peek-k", "下一篇");
            h(peek, "div", "mn-peek-t", next.title);
        } else {
            icon(h(peek, "div", "mn-peek-ic"), "check");
            h(peek, "div", "mn-peek-k", "全部讀完了");
            h(peek, "div", "mn-peek-t", "回到 Handbook");
        }
        const go = () => { ctx.pop(); if (next) ctx.openNote(next.file.path); };

        const count = slides.length;
        let shown = -1;
        const show = (i: number) => {
            Array.from(bars.children).forEach((b, j) => (b as HTMLElement).toggleClass("is-on", j <= i));
            if (i >= count - 1) void ctx.plugin.markRead(file.path);   // reached the last card: counts as read
        };
        pager.addEventListener("scroll", () => {
            const i = Math.max(0, Math.min(count - 1, Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth))));
            if (i !== shown) { shown = i; show(i); }
        }, { passive: true });
        show(0);

        // pulling the last card further left: it shivers (a tick), then follows the finger at a fraction of the distance and
        // shows the next topic behind it; let go far enough and that topic opens, otherwise the card springs back
        const last = cards[cards.length - 1];
        let x0 = 0, y0 = 0, pulling = false, armed = false, decided = false;
        pager.addEventListener("touchstart", (e) => {
            x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; pulling = false; armed = false; decided = false;
        }, { passive: true });
        pager.addEventListener("touchmove", (e) => {
            if (!last || shown !== count - 1) return;
            const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
            if (!decided) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                decided = true;
                pulling = dx < 0 && Math.abs(dx) > Math.abs(dy);   // only a leftward, mostly sideways move on the last card
                if (pulling) {
                    last.removeClass("is-back");
                    last.addClass("is-shiver");
                    haptic();
                }
            }
            if (!pulling) return;
            e.preventDefault();   // the card moves, not the page
            const move = Math.min(0, dx) * PULL;
            last.style.transform = `translateX(${move}px)`;
            peek.style.opacity = String(Math.min(1, -move / GO_AT));
            const ready = -move >= GO_AT;
            if (ready !== armed) { armed = ready; peek.toggleClass("is-ready", ready); if (ready) haptic(); }
        }, { passive: false });
        const end = () => {
            if (!pulling) return;
            pulling = false;
            last.removeClass("is-shiver");
            if (armed) {
                last.addClass("is-gone");   // slides away, then the next topic opens
                window.setTimeout(go, 220);
                return;
            }
            last.addClass("is-back");
            last.style.transform = "";
            peek.style.opacity = "";
            peek.removeClass("is-ready");
        };
        pager.addEventListener("touchend", end);
        pager.addEventListener("touchcancel", end);
        requestAnimationFrame(fit);
    });
    window.addEventListener("resize", fit);
    ctx.component.register(() => window.removeEventListener("resize", fit));
    return { title: "", el };
}

// ---- the picture of a card
function visual(ctx: PageCtx, box: HTMLElement, s: Slide): void {
    const store = ctx.plugin.store;
    const [kind, ...args] = s.visual.split(/\s+/).filter(Boolean);
    box.addClass(`is-${kind || "icon"}`);   // the picture's kind: media fills the card edge to edge, the rest is scaled up
    const champ = (id?: string): Champion | undefined => (id ? store.champion(id) : undefined);

    if (kind === "video") {
        const c = champ(args[0]);
        if (c) { const wrap = h(box, "div", "mn-sl-video"); demo(wrap, c, { key: args[1] ?? "Q" }); return; }
    } else if (kind === "img") {
        const src = args.join(" ");
        const url = /^https?:/.test(src) ? src : ctx.app.vault.adapter.getResourcePath(src);
        const im = h(box, "img", "mn-sl-img"); im.src = url; im.alt = ""; return;
    } else if (kind === "style") {
        const c = champ(args[0]);
        if (c) { styleCard(h(box, "div", "mn-sl-style"), c, ctx.app); return; }
    } else if (kind === "facts") {
        const c = champ(args[0]);
        if (c) { factsStrip(h(box, "div", "mn-sl-facts"), c); return; }
    } else if (kind === "tags") {
        const c = champ(args[0]);
        if (c) { tagRow(h(box, "div", "mn-sl-tags"), c, undefined, true); return; }
    } else if (kind === "roles" || kind === "lanes") {
        const names = kind === "roles" ? ["戰士", "坦克", "法師", "刺客", "射手", "輔助"] : LANES;
        const row = fgrid(h(box, "div", "mn-sl-icons"), names.length);
        for (const n of names) {
            const cell = h(row, "div", "mn-sl-icon");
            (kind === "roles" ? roleChip : laneChip)(cell, n, { on: false, onTap: () => undefined });
            h(cell, "span", "mn-sl-icon-l", n);
        }
        return;
    } else if (kind === "radar") {
        const c = champ(args[0]);
        if (c) {
            profileRadar(h(box, "div", "mn-sl-radar"), profileAxes(c), DAMAGE_COLOR[c.damageType] ?? "var(--interactive-accent)");
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
    box.className = "mn-sl-vis is-icon";
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
