import { MarkdownRenderer, TFile } from "obsidian";
import type { Champion } from "../data/store";
import { mapUrl } from "./handbook";
import { DAMAGE_COLOR, LANES, augIcon, fgrid, h, haptic, icon, laneChip, roleChip, svg, whenMediaLoaded, blurBackdrop, SWIPE } from "../ui";
import { factsStrip, profileAxes, profileRadar, styleCard, tagRow } from "./profile";
import type { PageCtx, PageOut } from "./index";
import { cardKit } from "./cardkit";
import { demo, rankTable } from "./skills";

// A guide topic as a deck of swipeable cards. In the note every `## ` heading is one card; right under it:
//   icon: swords                       the big icon when there is no picture (a Lucide name)
//   visual: <kind> <arguments>         what to show on the card (below)
// and then one or two short lines. Visuals:
//   video Ahri Q        Riot's ability clip (champion id + P/Q/W/E/R; Q2 = the second clip, e.g. a form)  img Assets/hud.png   a picture in the vault, or an https address
//   style Ahri          the champion page's 戰鬥風格 chart                    skills Ahri          the skill icons with their damage-colour frames
//   facts Ahri          the 技能傷害 block (bar and table)                    tags Ahri            the ability tags it has
//   roles               the six role icons                                   lanes                the five lane icons
//   tabs                the champion page's four tabs                        damage               the three damage kinds in their colours
//   map habackground    an ARAM loading screen picture (habackground, arambilgewater, arambloom; no name = one at random)
//   splash Swain        the champion's splash art                            skill Gwen Q [grid]  one ability large: icon, name, Riot's text; grid adds the numbers per rank with scaling
//   tree 3071           an item's recipe drawn like the shop: the item on top, what it is built from below, with prices
//   counters [刺客 …]   the six role icons in a ring with coloured arrows for who counters whom; named roles light up their arrows
//   wards lane|dragon|baron|steal   the Summoner's Rift minimap with ward icons where they help in that moment (a sketch, not exact spots)
//   radar Ahri          the older radar chart
//   role 戰士           champions of that role (a few, changing daily)       champs Ahri Garen    those champions
//   itemtag Armor       items of that kind (Armor, SpellBlock, Health…)      item 3089            one item and what it is built from
//   augs 稜鏡           Mayhem augments of that rarity (a few, changing daily)
interface Slide { title: string; icon: string; visual: string; text: string }
const GLOSSARY = "名詞表";   // the plain-list guide note the i button opens
const STRIP = 6;   // icons in a strip
const PULL = 0.6;      // how far the last card moves per px pulled (it resists a little, like a rubber band)
const GO_AT = 130;     // px of card movement that opens the next topic when the finger lifts
const TILT = 12;       // degrees a card tilts per card width it is dragged (like a Tinder card); left swipe tilts left
const GONE = -1.2;     // where a swiped-away card rests, in card widths to the left of the pile
const FAN = [0, 2.6, -2.2, -2.2];   // degrees the cards under the top one lean, so the pile looks laid on a table
const STEP_Y = 6;      // px each card under the top one sits lower, so their edges show like a stack of cards
const WAIT_CARDS = 3;      // the pile waits for this many cards' pictures and clips; the others keep loading behind them
const LOOK_MIN_MS = 500;   // the cards stay blurred at least this long, so a fast load does not read as a blink
const DECK_WAIT_MS = 8000;   // the pile waits this long at most for the topic's pictures and clips
const NEAR_BEHIND = 1;   // cards already seen that are still painted (the one that comes back on a right swipe)
const NEAR_AHEAD = 2;    // cards under the top one that are painted (the pile shows two)
const SETTLE_MS = 280;
const DECK_BELOW = 10;   // px kept free under the deck (the room for the pile's lower edges is inside the deck, --mn-pile) // how long a card takes to land after a swipe

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


// who counters whom, drawn as arrows between role icons (from → to, colour)
const COUNTERS: [string, string, string][] = [
    ["刺客", "射手", "var(--color-red)"], ["刺客", "法師", "var(--color-red)"],
    ["坦克", "刺客", "var(--color-blue)"], ["輔助", "刺客", "var(--color-blue)"],
    ["射手", "坦克", "var(--color-orange)"], ["法師", "戰士", "var(--color-purple)"],
];
// 刺客 in the middle (four of the six arrows meet it), the rest around it in the order that keeps 射手 next to 坦克 and 法師 next
// to 戰士, so no two arrows cross
const RING = ["戰士", "坦克", "射手", "輔助", "法師"];   // clockwise from the top
const MIDDLE = "刺客";
// Ward spots on the Summoner's Rift minimap for each moment, in % of the map (0,0 = top left; blue base bottom left).
// A sketch of where vision helps, not exact pixel spots. kind: w = stealth ward (yellow), c = control ward (pink)
const WARDS: Record<string, { obj?: [string, number, number][]; wards: [number, number, "w" | "c"][] }> = {
    lane: { wards: [[27, 33, "w"], [73, 66, "w"], [46, 54, "w"]] },
    dragon: { obj: [["小龍", 67, 70]], wards: [[60, 66, "c"], [62, 76, "w"], [73, 61, "w"]] },
    baron: { obj: [["巴龍", 33, 30]], wards: [[40, 34, "c"], [38, 24, "w"], [27, 39, "w"]] },
    steal: { obj: [["小龍", 67, 70]], wards: [[64, 74, "w"], [76, 58, "w"], [83, 70, "c"]] },
};

const hashStr = (s: string): number => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const day = () => String(Math.floor(Date.now() / 86_400_000));

export function deckPage(ctx: PageCtx, file: TFile): PageOut {
    const store = ctx.plugin.store;
    const el = h(null, "div", "mn-page mn-deckpage");
    const titleRow = h(el, "div", "mn-title-row");
    h(titleRow, "h1", "mn-title", file.basename);
    // the glossary is one tap away from every topic: an i button at the right of the title
    const glossary = store.guideNotes().find((n) => n.layout !== "deck" && n.title === GLOSSARY);
    if (glossary) {
        const info = h(titleRow, "button", "mn-btn");
        info.setAttribute("aria-label", GLOSSARY);
        icon(info, "info");
        info.addEventListener("click", (e) => { e.preventDefault(); ctx.openNote(glossary.file.path); });
    }
    const bars = h(el, "div", "mn-bars");   // one short bar per card, filled up to the one in view (like stories)
    const wrap = h(el, "div", "mn-deckwrap");
    const peek = h(wrap, "div", "mn-peek");   // behind the cards: what pulling the last card leads to; fills the whole card area, the pulled card uncovers it
    const peekIn = h(peek, "div", "mn-peek-in");   // the text sits at the right side, where the card leaves first
    const pager = h(wrap, "div", "mn-pager");
    // blurred from the very first frame, with a soft band of light sliding over it, until the topic's pictures and clips are in
    pager.addClass("is-wait");
    const band = h(wrap, "div", "mn-artload");
    const since = Date.now();
    // the deck owns sideways swipes: Obsidian's own edge swipes (open a sidebar) must not take them
    for (const ev of ["touchstart", "touchmove"]) pager.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    // cards fill the screen down to the tab bar
    const fit = () => {
        const scroll = el.closest<HTMLElement>(".mn-scroll");
        if (!scroll) return;
        const top = wrap.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
        wrap.style.height = `${Math.max(380, scroll.clientHeight - top - DECK_BELOW)}px`;
    };

    void ctx.app.vault.cachedRead(file).then((md) => {
        const slides = parseSlides(md);
        const guide = store.guideNotes().filter((n) => n.layout === "deck");
        const at = guide.findIndex((n) => n.file.path === file.path);
        const next = guide[at + 1];
        const sec: HTMLElement[] = [];   // one per card; the pile is made by posing these

        slides.forEach((s, i) => {
            h(bars, "span", "mn-bar");
            const section = h(pager, "section", "mn-slide");
            const card = h(section, "div", "mn-sl-card");   // the white collectible border
            const face = h(card, "div", "mn-sl-face");      // the dark face inside it: picture, text on the lower part
            visual(ctx, h(face, "div", "mn-sl-vis"), s);
            // under the picture: where you are, the title, the line, and a closing "**label：** tip" in its own box
            const words = h(face, "div", "mn-sl-words");
            h(words, "div", "mn-sl-kn", `${file.basename} · ${i + 1} / ${slides.length}`);
            h(words, "h2", "mn-sl-t", s.title);
            const tip = /^([\s\S]*?)\*\*([^*\n]{1,8})[:：]\*\*\s*([\s\S]+)$/.exec(s.text);
            const main = tip ? tip[1].trim() : s.text;
            if (main) void MarkdownRenderer.render(ctx.app, main, h(words, "div", "mn-sl-x markdown-rendered"), file.path, ctx.component);
            if (tip) {
                const box = h(words, "div", "mn-sl-tip");
                h(box, "div", "mn-sl-tip-k", tip[2]);
                void MarkdownRenderer.render(ctx.app, tip[3].trim(), h(box, "div", "mn-sl-tip-x markdown-rendered"), file.path, ctx.component);
            }
            sec.push(section);
        });
        // behind the last card: the next topic (or, after the last topic, the way back)
        if (next) {
            icon(h(peekIn, "div", "mn-peek-ic"), next.icon);
            h(peekIn, "div", "mn-peek-k", "下一篇");
            h(peekIn, "div", "mn-peek-t", next.title);
        } else {
            icon(h(peekIn, "div", "mn-peek-ic"), "check");
            h(peekIn, "div", "mn-peek-k", "全部讀完了");
            h(peekIn, "div", "mn-peek-t", "回到 Handbook");
        }
        const go = () => { ctx.pop(); if (next) ctx.openNote(next.file.path); };

        const count = slides.length;
        let cur = 0;   // the card on top
        const show = () => {
            Array.from(bars.children).forEach((b, j) => (b as HTMLElement).toggleClass("is-on", j <= cur));
            if (cur >= count - 1) void ctx.plugin.markRead(file.path);   // reached the last card: counts as read
        };

        // The cards are a pile: the top one at rest, the next ones leaning under it, the ones already seen parked off to the left.
        // `u` places a card: 0 = on top, 1 = first under it … , below 0 = dragged to the left by that many card widths.
        const pose = (el: HTMLElement, u: number) => {
            const w = pager.clientWidth;
            let x = 0, y = 0, deg = 0, op = "";
            if (u < 0) { x = u * w; deg = u * TILT; }
            else {
                const k = Math.min(FAN.length - 1, Math.floor(u)), a = FAN[k], b = FAN[Math.min(FAN.length - 1, k + 1)];
                deg = a + (b - a) * (u - k);
                y = Math.min(u, 2) * STEP_Y;
                if (u > 2) op = String(Math.max(0, 3 - u));
            }
            el.style.transform = `translateX(${x.toFixed(1)}px) translateY(${y.toFixed(1)}px) rotate(${deg.toFixed(2)}deg)`;
            el.style.setProperty("--sheen", `${(30 - Math.min(u, 0) * 70).toFixed(0)}%`);   // the rainbow sheen slides across the face as the card is dragged
            el.style.opacity = op;
        };
        let busy = false, leaving = false, settleT = 0;
        const layout = (animate: boolean) => {
            if (animate) {
                busy = true;
                sec.forEach((c) => c.addClass("is-settle"));
                window.clearTimeout(settleT);
                settleT = window.setTimeout(() => { sec.forEach((c) => c.removeClass("is-settle")); busy = false; }, SETTLE_MS);
            }
            sec.forEach((c, i) => { pose(c, i < cur ? GONE : i - cur); c.style.zIndex = String(i < cur ? 100 + i : count - i); });
            // only the cards near the top are painted, and only the ones in view play their clip: a topic with many clips (each with
            // a blurred copy) otherwise has them all running under the top card, which makes some swipes smooth and others not
            sec.forEach((c, i) => {
                c.style.visibility = i >= cur - NEAR_BEHIND && i <= cur + NEAR_AHEAD ? "" : "hidden";
                const live = i >= cur - 1 && i <= cur + 1;
                c.querySelectorAll("video").forEach((v) => {
                    if (live) { void v.play().catch(() => undefined); return; }
                    // a clip still loading keeps playing (a phone may not fetch a paused one), and is paused once it has its first frame
                    if (v.readyState >= 2) v.pause(); else v.addEventListener("loadeddata", () => { if (!(i >= cur - 1 && i <= cur + 1)) v.pause(); }, { once: true });
                });
            });
            show();
        };
        layout(false);
        // The pile shows once every picture and clip of the topic has its first frame (or after DECK_WAIT_MS), so nothing pops in
        // while swiping. Clips under the top card are told to play meanwhile: a phone may not fetch a paused clip at all.
        sec.forEach((c) => c.querySelectorAll("video").forEach((v) => { void v.play().catch(() => undefined); }));
        const loaded = whenMediaLoaded(sec.slice(0, WAIT_CARDS), DECK_WAIT_MS);
        // the cards were blurred from the start (see the top); they sharpen when loaded, never before half a second so it is no blink
        void loaded.then(() => {
            layout(false);
            window.setTimeout(() => { pager.removeClass("is-wait"); band.remove(); }, Math.max(0, LOOK_MIN_MS - (Date.now() - since)));
        });
        const onResize = () => layout(false);
        window.addEventListener("resize", onResize);
        ctx.component.register(() => window.removeEventListener("resize", onResize));

        // Dragging the top card: it follows the finger and tilts, the pile under it moves up; right drags the previous card back
        // on top. The last card resists, shivers once, and shows the next topic under it (fixed panel); let go far enough and that
        // topic opens, otherwise the card springs back.
        const lastIdx = count - 1;
        let x0 = 0, y0 = 0, t0 = 0, pid = -1, dx = 0, lastY = 0, mode: "" | "x" | "y" = "", armed = false;
        let words: HTMLElement | null = null;   // the text area under the finger, scrolled by hand on a vertical move
        const resetPeek = () => { peek.style.opacity = ""; peek.removeClass("is-ready"); armed = false; };
        const drag = () => {
            const w = pager.clientWidth, top = sec[cur];
            if (dx < 0) {
                if (cur === lastIdx) {
                    const move = dx * PULL;
                    top.style.transform = `translateX(${move.toFixed(1)}px) translateY(0px) rotate(${(move / GO_AT * TILT).toFixed(2)}deg)`;
                    peek.style.opacity = String(Math.min(1, -move / 30));
                    const ready = -move >= GO_AT;
                    if (ready !== armed) { armed = ready; peek.toggleClass("is-ready", ready); if (ready) haptic(); }
                    return;
                }
                pose(top, dx / w);
                const p = Math.min(1, -dx / w / 0.8);
                for (let i = cur + 1; i < count; i++) pose(sec[i], i - cur - p);
            } else {
                if (cur === 0) { top.style.transform = `translateX(${(dx * 0.2).toFixed(1)}px) translateY(0px) rotate(${(dx * 0.2 / w * TILT).toFixed(2)}deg)`; return; }
                resetPeek();
                pose(sec[cur - 1], Math.min(0, GONE + dx / w));
                const p = Math.min(1, dx / w / 0.8);
                for (let i = cur; i < count; i++) pose(sec[i], i - cur + p);
            }
        };
        pager.addEventListener("pointerdown", (e) => {
            if (leaving || pid !== -1 || (e.pointerType === "mouse" && e.button !== 0)) return;
            if (busy) {   // a new drag while the cards are still landing: let them land at once, never make the finger wait
                window.clearTimeout(settleT);
                sec.forEach((c) => c.removeClass("is-settle"));
                busy = false;
                layout(false);
            }
            x0 = e.clientX; y0 = e.clientY; lastY = e.clientY; t0 = e.timeStamp; pid = e.pointerId; mode = ""; dx = 0;
            words = (e.target as HTMLElement).closest<HTMLElement>(".mn-sl-words");
        });
        pager.addEventListener("pointermove", (e) => {
            if (e.pointerId !== pid) return;
            dx = e.clientX - x0;
            const dy = e.clientY - y0;
            if (!mode) {
                if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return;
                mode = Math.abs(dx) > Math.abs(dy) * SWIPE.bias ? "x" : "y";   // sideways: ours; vertical: the card's text or the page scrolls
                if (mode === "y") pager.setPointerCapture(pid);
                if (mode === "x") {
                    pager.setPointerCapture(pid);
                    pager.addClass("is-drag");
                    sec.forEach((c) => c.removeClass("is-settle"));
                    if (cur === lastIdx && dx < 0) { const card = sec[cur].firstElementChild; card?.removeClass("is-shiver"); void (card as HTMLElement | null)?.offsetWidth; card?.addClass("is-shiver"); haptic(); }
                }
            }
            if (mode === "x") drag();
            else if (words) words.scrollTop += lastY - e.clientY;
            lastY = e.clientY;
        });
        const end = (e: PointerEvent) => {
            if (e.pointerId !== pid) return;
            pid = -1;
            const m = mode;
            mode = "";
            pager.removeClass("is-drag");
            if (m !== "x") return;
            sec[cur].firstElementChild?.removeClass("is-shiver");
            const w = pager.clientWidth, v = dx / Math.max(1, e.timeStamp - t0);
            const far = Math.abs(dx) > SWIPE.at * w || (Math.abs(v) > SWIPE.flick && Math.abs(dx) > SWIPE.flickMin);
            if (dx < 0 && far && cur < lastIdx) cur++;
            else if (dx > 0 && far && cur > 0) cur--;
            else if (dx < 0 && cur === lastIdx && armed) {
                busy = leaving = true;
                sec[cur].addClass("is-settle");
                pose(sec[cur], GONE);   // flies off, then the next topic opens
                window.setTimeout(go, 220);
                return;
            }
            resetPeek();
            layout(true);
        };
        pager.addEventListener("pointerup", end);
        pager.addEventListener("pointercancel", end);
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
        if (c) {
            // the whole clip, never cropped; the space around it is the same clip, blurred (it fills the card without cutting it)
            const wrap = h(box, "div", "mn-sl-video");
            demo(wrap, c, { key: args[1] ?? "Q" });
            const v = wrap.querySelector("video");
            if (v) blurBackdrop(wrap, v);
            return;
        }
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
    } else if (kind === "tabs") {
        // the champion page's four tabs, as they look there
        const seg = h(h(box, "div", "mn-sl-tabs"), "div", "mn-seg mn-seg-line");
        ["Skills", "Build", "Augments", "Tips"].forEach((l, i) => h(seg, "span", "mn-seg-b" + (i === 0 ? " is-on" : ""), l));
        return;
    } else if (kind === "damage") {
        // the three kinds of damage in the colours the app uses for them
        const row = h(box, "div", "mn-sl-dmg");
        for (const k of ["物理", "魔法", "真實"]) { const d = h(row, "div", "mn-sl-dmg-k", k); d.style.setProperty("--c", DAMAGE_COLOR[k]); }
        return;
    } else if (kind === "ability" || kind === "clip" || kind === "number" || kind === "forms" || kind === "formset") {
        if (cardKit(box, kind, champ(args[0]), args.slice(1))) return;
    } else if (kind === "skill") {
        const c = champ(args[0]), k = (args[1] ?? "Q").toUpperCase();
        const sk = c?.skills.find((x) => x.key === k);
        if (c && sk) {
            const wrap = h(box, "div", "mn-sl-skill");
            const top = h(wrap, "div", "mn-sl-skill-top");
            const im = h(top, "img", "mn-sl-skill-ic"); im.src = sk.icon; im.alt = "";
            im.style.setProperty("--chip", DAMAGE_COLOR[sk.damage[0] ?? ""] ?? "var(--mn-line)");
            const who = h(top, "div");
            h(who, "div", "mn-sl-skill-k", `${c.name} · ${k === "P" ? "被動" : k}`);
            h(who, "div", "mn-sl-skill-n", sk.name);
            h(wrap, "div", "mn-sl-skill-d", sk.desc);
            if (args.includes("grid")) rankTable(wrap, sk, []);   // damage, heal or shield per rank with its scaling (+90% 魔法攻擊), cooldown, cost, range
            return;
        }
    } else if (kind === "tree") {
        // the shop's recipe tree: each item, then the items it is built from on the row below, joined by lines
        const root = store.item(Number(args[0]));
        if (root) {
            const node = (parent: HTMLElement, id: number, depth: number) => {
                const it = store.item(id);
                if (!it) return;
                const n = h(parent, "div", "mn-tree-n");
                const b = h(n, "button", "mn-tree-item" + (depth === 0 ? " is-root" : ""));
                const im = h(b, "img"); im.src = it.icon; im.alt = "";
                h(b, "span", "mn-tree-g", String(it.goldTotal));
                h(b, "span", "mn-tree-name", it.name);
                b.addEventListener("click", (e) => { e.preventDefault(); ctx.openItem(it.id); });
                if (it.from.length && depth < 2) {
                    const kids = h(n, "div", "mn-tree-kids");
                    for (const f of it.from) node(kids, f, depth + 1);
                }
            };
            node(h(box, "div", "mn-tree"), root.id, 0);
            return;
        }
    } else if (kind === "counters") {
        // role icons around a ring; an arrow from each role to the one it counters, its colour per kind of matchup
        const lit = new Set(args);
        const wrap = h(box, "div", "mn-ctr");
        const at = (r: string): [number, number] => {
            if (r === MIDDLE) return [50, 52];
            const a = -Math.PI / 2 + (RING.indexOf(r) * 2 * Math.PI) / RING.length;
            return [50 + 39 * Math.cos(a), 52 + 39 * Math.sin(a)];
        };
        const g = svg(wrap, "svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, "mn-ctr-svg");
        const defs = svg(g, "defs");
        COUNTERS.forEach(([from, to, color], i) => {
            const mk = svg(defs, "marker", { id: `mn-ah-${i}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 3.6, markerHeight: 3.6, orient: "auto-start-reverse" });
            svg(mk, "path", { d: "M0,0 L10,5 L0,10 z" }).setAttribute("style", `fill:${color}`);
            const [x1, y1] = at(from), [x2, y2] = at(to);
            const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), cut = 12 / len;   // stop short of the icons
            const line = svg(g, "line", { x1: x1 + dx * cut, y1: y1 + dy * cut, x2: x2 - dx * cut, y2: y2 - dy * cut, "marker-end": `url(#mn-ah-${i})` }, "mn-ctr-a");
            line.setAttribute("style", `stroke:${color}`);
            if (lit.size && !lit.has(from)) line.addClass("is-dim");
        });
        for (const r of [...RING, MIDDLE]) {
            const [x, y] = at(r);
            const node = h(wrap, "div", "mn-ctr-n" + (lit.size && !lit.has(r) && !COUNTERS.some(([f, to]) => lit.has(f) && to === r) ? " is-dim" : ""));
            node.style.left = `${x}%`; node.style.top = `${y}%`;
            roleChip(node, r, { on: false, onTap: () => undefined });
            h(node, "span", "mn-ctr-l", r);
        }
        return;
    } else if (kind === "wards") {
        // the minimap with ward icons (Data Dragon's own map and ward pictures, shown by address)
        const scene = WARDS[args[0] ?? "lane"] ?? WARDS.lane;
        const ver = /\/cdn\/([\d.]+)\//.exec(store.champions()[0]?.icon ?? "")?.[1] ?? "";
        const map = h(box, "div", "mn-wmap");
        const im = h(map, "img", "mn-wmap-img"); im.src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/map/map11.png`; im.alt = "";
        for (const [label, x, y] of scene.obj ?? []) { const o = h(map, "span", "mn-wmap-obj", label); o.style.left = `${x}%`; o.style.top = `${y}%`; }
        for (const [x, y, k] of scene.wards) {
            const w = h(map, "img", "mn-wmap-ward is-" + k);
            w.src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${k === "c" ? 2055 : 3340}.png`; w.alt = "";
            w.style.left = `${x}%`; w.style.top = `${y}%`;
        }
        return;
    } else if (kind === "splash") {
        // a champion's splash art, filling the card (its face kept in view)
        const c = champ(args[0]);
        if (c) {
            const im = h(box, "img", "mn-sl-img mn-sl-splash"); im.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg`; im.alt = "";
            box.className = "mn-sl-vis is-img";
            return;
        }
    } else if (kind === "map") {
        // ARAM's loading screen picture (the game's, shown from CommunityDragon by address)
        const im = h(box, "img", "mn-sl-img"); im.src = mapUrl(args[0]); im.alt = "";
        box.className = "mn-sl-vis is-img";
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
