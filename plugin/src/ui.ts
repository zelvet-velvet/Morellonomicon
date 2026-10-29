import { setIcon } from "obsidian";

// Small DOM helpers. Text always goes in through textContent (never innerHTML).
export const h = <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement | null, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    parent?.appendChild(e);
    return e;
};

// A small bubble over (or under) an element, for the name of an icon: replaced by the next one, gone on any other tap or scroll
let bubbleEl: HTMLElement | null = null;
let bubbleTimer = 0;
const BUBBLE_MS = 2200;
const closeBubble = (): void => {
    window.clearTimeout(bubbleTimer);
    bubbleEl?.remove();
    bubbleEl = null;
    document.removeEventListener("pointerdown", closeBubble, true);
    document.removeEventListener("scroll", closeBubble, true);
};
export const tip = (anchor: HTMLElement, text: string): void => {
    closeBubble();
    const t = h(anchor.closest<HTMLElement>(".mn-app") ?? document.body, "div", "mn-bubble", text);
    bubbleEl = t;
    const a = anchor.getBoundingClientRect();
    t.style.left = `${Math.max(8, Math.min(window.innerWidth - t.offsetWidth - 8, a.left + a.width / 2 - t.offsetWidth / 2))}px`;
    t.style.top = `${a.top - t.offsetHeight - 8 < 8 ? a.bottom + 8 : a.top - t.offsetHeight - 8}px`;
    bubbleTimer = window.setTimeout(closeBubble, BUBBLE_MS);
    // listen from the next tick on, so the tap that opened it does not close it
    window.setTimeout(() => {
        if (bubbleEl !== t) return;
        document.addEventListener("pointerdown", closeBubble, true);
        document.addEventListener("scroll", closeBubble, true);
    }, 0);
};

// The name bubble while a finger rests on an element: it shows after a short hold and goes the moment the finger lifts.
// How a card swipe is read, shared by the Handbook's tip stack and the topic cards so they feel the same: the direction is decided
// after `slop` px (sideways wins unless the move is clearly more vertical than horizontal, `bias`), a drag past `at` of the width or a
// quicker, shorter one (`flick` px/ms over at least `flickMin` px) turns the card, anything less springs back
export const SWIPE = { slop: 6, bias: 0.7, at: 0.25, flick: 0.5, flickMin: 24 };

// Pictures a page waits for before it shows (the ones at its top), so it does not appear with empty frames; never longer than `ms`.
// Returns null when there is nothing to wait for. Pictures set to load lazily are made eager, since a page not on screen yet
// would never load them.
export const FIRST_SCREEN = 36;
export function whenLoaded(root: HTMLElement, ms: number, count = FIRST_SCREEN): Promise<void> | null {
    const pending = Array.from(root.querySelectorAll<HTMLImageElement>("img")).slice(0, count).filter((im) => im.src && !im.complete);
    if (!pending.length) return null;
    return new Promise((done) => {
        let left = pending.length;
        const t = window.setTimeout(done, ms);
        const one = () => { if (--left <= 0) { window.clearTimeout(t); done(); } };
        for (const im of pending) { im.loading = "eager"; im.addEventListener("load", one, { once: true }); im.addEventListener("error", one, { once: true }); }
    });
}

// Lets go of the clips on a page that is being replaced: a detached <video> keeps its decoder until it is collected, and a phone
// has only a few, so after a few pages the new clips stayed black or stuck.
export function releaseVideos(root: HTMLElement): void {
    root.querySelectorAll("video").forEach((v) => { v.pause(); v.removeAttribute("src"); v.replaceChildren(); v.load(); });
}

// Every picture and clip under the roots has its first frame (or failed, or was removed because no format loaded), or `ms` passed.
// Checked on a short timer rather than events, because a clip whose sources all fail is removed without any event.
export function whenMediaLoaded(roots: HTMLElement[], ms: number): Promise<void> {
    const media = roots.flatMap((r) => Array.from(r.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video")));
    const ready = (m: HTMLImageElement | HTMLVideoElement) => !m.isConnected || (m instanceof HTMLVideoElement ? m.readyState >= 2 || !!m.error : m.complete);
    return new Promise((done) => {
        const t0 = Date.now();
        const tick = () => { if (media.every(ready) || Date.now() - t0 > ms) done(); else window.setTimeout(tick, 150); };
        tick();
    });
}

// A block (a row of icons, a grid) that loads on its own: while its pictures are still arriving it shows blurred with the soft band of
// light sliding over it, and sharpens when they are in (never sooner than half a second after it appeared, so it is no blink). The page
// itself shows at once. Call it after the block is filled; a block whose pictures are all there gets no veil. `host` must not be
// emptied by its owner (the veil lives in it), so give a container that is redrawn its own host.
const BLOCK_MAX_MS = 8000, BLOCK_MIN_MS = 500, BLOCK_DELAY_MS = 120;
const blockState = new WeakMap<HTMLElement, { veil: HTMLElement; since: number; open: number }>();
// The loading band. Every block that is loading draws its part of ONE slanted line that crosses the screen on one clock, so
// neighbouring blocks (the lane row and the grid under it) show the same line, not two bands out of step with each other.
// trackBand puts a veil on that clock; a frame loop sets --bx (where the band's middle is inside the veil) and --bw (its width).
const BAND_MS = 1500;          // one pass
const BAND_RUN = 0.8;          // the part of the pass in which the band crosses; the rest it is off screen
const BAND_TILT = Math.tan((22 * Math.PI) / 180);   // the slope of the line (22 degrees from upright)
const bandVeils = new Set<HTMLElement>();
let bandFrame = 0;
const bandPhase = (): number => (performance.now() % BAND_MS) / BAND_MS;
function bandStep(): void {
    const w = window.innerWidth, hh = window.innerHeight, bw = w * 0.55;
    const q = Math.min(1, bandPhase() / BAND_RUN), e = 1 - Math.pow(1 - q, 2.2);
    const start = w + bw / 2 + 0.4 * hh, end = -bw / 2 - 0.4 * hh;
    const lineX = start + (end - start) * e;   // where the line crosses the middle of the screen
    for (const el of bandVeils) {
        if (!el.isConnected) { bandVeils.delete(el); continue; }
        const r = el.getBoundingClientRect();
        const x = lineX - (r.top + r.height / 2 - hh / 2) * BAND_TILT;   // the same line, at the middle of this veil
        el.style.setProperty("--bx", `${(x - r.left - bw / 2).toFixed(1)}px`);
        el.style.setProperty("--bw", `${bw.toFixed(0)}px`);
    }
    bandFrame = bandVeils.size ? requestAnimationFrame(bandStep) : 0;
}
export function trackBand(el: HTMLElement): void {
    bandVeils.add(el);
    if (!bandFrame) bandFrame = requestAnimationFrame(bandStep);
}
// Takes a loading veil away once its band has crossed and gone off the left edge (the end of the current pass, at most one pass away);
// the blur has been fading meanwhile, so the light seems to sweep the sharp page into view
export function endBand(el: HTMLElement): void {
    const p = bandPhase();
    const wait = (p < BAND_RUN ? BAND_RUN - p : 1 - p + BAND_RUN) * BAND_MS;
    window.setTimeout(() => { bandVeils.delete(el); el.remove(); }, wait);
}
function lift(host: HTMLElement, state: { veil: HTMLElement; since: number; open: number }): void {
    window.setTimeout(() => {
        if (blockState.get(host) !== state) return;
        blockState.delete(host);
        state.veil.classList.remove("is-in");   // the blur fades out, the band finishes its pass
        endBand(state.veil);
    }, Math.max(0, BLOCK_MIN_MS - (Date.now() - state.since)));
}
// The same for a block that waits for something that is not a plain <img> (a CSS background, a promise): veil until `until` settles
// With `delay`, the veil only appears if `until` has not settled after that many ms (a picture from the cache is there before it, and
// shows no loading look at all).
export function blockUntil(host: HTMLElement, until: Promise<void>, delay = 0): void {
    if (delay > 0 && !blockState.get(host)) {
        let done = false;
        void until.then(() => { done = true; });
        window.setTimeout(() => { if (!done) blockUntil(host, until); }, delay);
        return;
    }
    host.classList.add("mn-blk");
    let st = blockState.get(host);
    if (!st) {
        st = { veil: h(host, "div", "mn-blkveil is-in"), since: Date.now(), open: 0 };
        trackBand(st.veil);
        blockState.set(host, st);
    }
    const state = st;
    state.open++;   // the veil stays until everything the block waits for has settled (it may be asked again while loading)
    const cap = window.setTimeout(() => lift(host, state), BLOCK_MAX_MS);
    void until.then(() => { window.clearTimeout(cap); if (--state.open <= 0) lift(host, state); });
}
// Pictures drawn as a CSS background (the shop's sprite, a glyph mask) count too. Each address is fetched once and its picture is
// kept, so the phone does not drop it from memory and leave a block blank with no loading look; a failed fetch is tried again a few
// times, and once it is in, the backgrounds that missed it are set again (a failed CSS background never retries by itself)
const BG_TRIES = 3;
const BG_RETRY_MS = 800;
const bgHeld = new Map<string, HTMLImageElement>();   // loaded and decoded
const bgLoading = new Map<string, Promise<void>>();
const URL_IN_STYLE = /url\(["']?([^"')]+)["']?\)/g;
function loadBackground(src: string): Promise<void> {
    const known = bgLoading.get(src);
    if (known) return known;
    const p = new Promise<void>((done) => {
        const im = new Image();
        let tries = 0;
        const finish = () => { bgLoading.delete(src); done(); };
        im.onload = () => {
            void (im.decode ? im.decode() : Promise.resolve()).catch(() => undefined).then(() => {
                bgHeld.set(src, im);
                if (tries) document.querySelectorAll<HTMLElement>(`[style*="${CSS.escape(src)}"]`).forEach((el) => { const b = el.style.backgroundImage; el.style.backgroundImage = "none"; void el.offsetWidth; el.style.backgroundImage = b; });
                finish();
            });
        };
        im.onerror = () => {
            if (++tries >= BG_TRIES) { finish(); return; }
            window.setTimeout(() => { im.removeAttribute("src"); im.src = src; }, BG_RETRY_MS);
        };
        im.src = src;
    });
    bgLoading.set(src, p);
    return p;
}
function pendingBackgrounds(host: HTMLElement): Promise<void>[] {
    const out: Promise<void>[] = [], asked = new Set<string>();
    for (const el of [host, ...Array.from(host.querySelectorAll<HTMLElement>("[style]"))]) {
        for (const m of (el.getAttribute("style") ?? "").matchAll(URL_IN_STYLE)) {
            const src = m[1];
            if (asked.has(src) || bgHeld.get(src)?.complete) continue;
            asked.add(src);
            out.push(loadBackground(src));
        }
    }
    return out;
}
// Several hosts drawn together (the blocks of a page that just opened) load as one: each keeps its loading look until the pictures of
// all of them are in, so a block whose pictures were already there does not show sharp beside one still loading.
export function blockLoad(host: HTMLElement | HTMLElement[]): void {
    const hosts = Array.isArray(host) ? host : [host];
    const waits = hosts.flatMap((one) => [
        ...Array.from(one.querySelectorAll<HTMLImageElement>("img")).filter((im) => im.src && !im.complete).map((im) => new Promise<void>((done) => {
            im.addEventListener("load", () => done(), { once: true });
            im.addEventListener("error", () => done(), { once: true });
        })),
        ...pendingBackgrounds(one),
    ]);
    if (!waits.length) {   // redrawn with every picture already there
        for (const one of hosts) { const st = blockState.get(one); if (st && st.open <= 0) lift(one, st); }
        return;
    }
    const all = Promise.all(waits).then(() => undefined);
    const delay = hosts.some((one) => one.classList.contains("mn-blk")) ? 0 : BLOCK_DELAY_MS;
    for (const one of hosts) blockUntil(one, all, delay);
}

// A block as the Layouts note defines it (Dev Tools/Layouts.md: the title row, a grid, a shelf, a hero...). Marking its element is
// all a page does: whenever pictures in it are still loading (drawn, redrawn, a picture added later) the whole block shows the block
// loading look until they are in, the way the Handbook's tile groups do (LLM Guide, "Loading look").
// own: the block loads by itself instead of with the page's other blocks (Items: the role tabs, the stat rail and the list)
export function layoutBlock<T extends HTMLElement>(el: T, own = false): T {
    el.classList.add("mn-lb");
    if (own) el.classList.add("mn-lb-own");
    return el;
}

// Every picture gets the loading look by itself, so no page has to ask for it (LLM Guide, "Loading look"): a picture still loading is
// hidden and fades in when it arrives, and a big one (its frame AUTO_BLOCK px or more each way: a card, a splash, a wallpaper) puts the
// block loading look (blur and the band of light) on its frame until then. Inside a Layouts block (layoutBlock) the whole block gets
// that look instead. Pictures inside a block a page already handles (mn-blk), inside a card pile (it has its own) or under .mn-noauto
// are left alone.
const AUTO_BLOCK = 64;
export function autoLoading(root: HTMLElement): MutationObserver {
    const seen = new WeakSet<HTMLImageElement>();
    // the Layouts blocks that something was added to: checked once after this round of changes
    const blocks = new Set<HTMLElement>();
    // the blocks of one page that changed in the same round load together (a page that just opened: all of its blocks)
    const flush = () => {
        const byPage = new Map<Element, HTMLElement[]>();
        for (const b of blocks) {
            if (!b.isConnected) continue;
            const pg = b.classList.contains("mn-lb-own") ? b : b.closest(".mn-page") ?? b;
            byPage.set(pg, [...(byPage.get(pg) ?? []), b]);
        }
        blocks.clear();
        for (const group of byPage.values()) blockLoad(group);
    };
    const queue = (b: HTMLElement) => {
        if (b.closest(".mn-noauto, .mn-pager")) return;
        if (!blocks.size) window.setTimeout(flush, 0);
        blocks.add(b);
    };
    // the block a node went into, and the blocks it brings along (a whole page added at once)
    const inBlock = (n: Element) => {
        const b = n.closest<HTMLElement>(".mn-lb");
        if (b) queue(b);
        n.querySelectorAll<HTMLElement>(".mn-lb").forEach(queue);
    };
    const take = (im: HTMLImageElement) => {
        if (seen.has(im) || !im.getAttribute("src") || (im.complete && im.naturalWidth) || im.closest(".mn-noauto, .mn-blk, .mn-pager")) return;
        seen.add(im);
        im.classList.add("is-loading");
        const done = () => im.classList.remove("is-loading");
        im.addEventListener("load", done, { once: true });
        im.addEventListener("error", done, { once: true });
        const host = im.parentElement;
        if (!host || im.closest(".mn-lb")) return;   // a Layouts block shows the look for all of it
        const r = host.getBoundingClientRect();
        if (Math.min(r.width, r.height) >= AUTO_BLOCK) blockLoad(host);
    };
    const scan = (n: Node) => {
        if (n instanceof HTMLElement) inBlock(n);
        if (n instanceof HTMLImageElement) take(n);
        else if (n instanceof HTMLElement) n.querySelectorAll("img").forEach(take);
    };
    const mo = new MutationObserver((list) => {
        for (const m of list) {
            if (m.type === "attributes") { if (m.target instanceof HTMLImageElement) { inBlock(m.target); take(m.target); } }
            else m.addedNodes.forEach(scan);
        }
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    return mo;
}

// Fetches pictures into the browser's cache a few at a time, in the background, so a list that shows them later (Champions, Augments)
// has them at once instead of each one fading in as it arrives
export async function warmPictures(urls: string[], batch = 6): Promise<void> {
    for (let i = 0; i < urls.length; i += batch) {
        await Promise.all(urls.slice(i, i + batch).map((u) => new Promise<void>((done) => { const im = new Image(); im.onload = im.onerror = () => done(); im.src = u; })));
    }
}

// A hold does not count as a tap (the element's tap action stays for a quick tap).
const HOLD_MS = 280;
export const holdTip = (el: HTMLElement, text: string | (() => string)): void => {
    let timer = 0, shown = false;
    el.classList.add("mn-holdable");
    const end = (): void => { window.clearTimeout(timer); if (shown) closeBubble(); };
    el.addEventListener("pointerdown", () => {
        shown = false;
        timer = window.setTimeout(() => {
            shown = true;
            tip(el, typeof text === "function" ? text() : text);
            window.clearTimeout(bubbleTimer);   // stays while held
        }, HOLD_MS);
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, end);
    el.addEventListener("click", (e) => { if (shown) { e.preventDefault(); e.stopImmediatePropagation(); shown = false; } }, true);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
};

export const icon = (parent: HTMLElement, name: string, cls = "mn-ic"): HTMLElement => {
    const s = h(parent, "span", cls);
    setIcon(s, name);
    if (!s.querySelector("svg")) setIcon(s, "circle");
    return s;
};

// A large title page (the title collapses into the top bar while scrolling).
export const page = (title: string): HTMLElement => {
    const p = h(null, "div", "mn-page");
    h(h(p, "div", "mn-title-row"), "h1", "mn-title", title);
    return p;
};

// Inset grouped list
export const group = (parent: HTMLElement, title?: string, footer?: string): HTMLElement => {
    if (title) h(parent, "div", "mn-gh", title);
    const g = h(parent, "div", "mn-group");
    if (footer) h(parent, "div", "mn-gf", footer);
    return g;
};

// The frame an augment icon gets for its rarity (silver, gold, prismatic = metallic rainbow); drawn in CSS, see styles.css
export const AUG_CLASS: Record<string, string> = { 銀: "aug-silver", 金: "aug-gold", 稜鏡: "aug-prism" };

// An augment icon the way the game shows it: its large icon (the rarity's tint is already in the picture) in the rarity's frame, see .aug-icon in
// styles.css. The large file sits in the game's own folder; a few augments only have the small one, which is the fallback.
// The data points each augment at its best file (tools/fetch_augments.py): a large icon or a generic rarity icon is already tinted; a small one is
// a plain grey shape the game tints at runtime, so it is drawn as a mask filled with the rarity's colours (sampled from the game's tinted icons).
const TINTED = /_large\.png$|genericabilityaugmenticon/;
export const augIcon = (parent: HTMLElement, src: string, rarity: string, cls = ""): HTMLElement => {
    const tinted = TINTED.test(src);
    const box = h(parent, "span", `aug-icon ${AUG_CLASS[rarity] ?? ""} ${cls}`.trim());
    if (tinted) {
        const im = h(box, "img");
        im.alt = "";
        im.src = src;
    } else {
        box.style.setProperty("--glyph", `url("${src}")`);
        h(box, "span", "aug-glyph");
    }
    return box;
};

export interface RowSpec { icon?: string; image?: string; rarity?: string; title: string; sub?: string; value?: string; chevron?: boolean; muted?: boolean; clamp?: boolean; onTap?: () => void }
export const row = (parent: HTMLElement, r: RowSpec): HTMLElement => {
    const el = h(parent, "div", "mn-row" + (r.onTap ? " is-tap" : "") + (r.muted ? " is-muted" : ""));
    if (r.image && r.rarity && AUG_CLASS[r.rarity]) augIcon(el, r.image, r.rarity, "mn-row-aug");
    else if (r.image) { const im = h(el, "img", "mn-row-img"); im.src = r.image; im.alt = ""; }
    else if (r.icon) icon(el, r.icon, "mn-row-ic");
    const main = h(el, "div", "mn-row-main");
    h(main, "div", "mn-row-t", r.title);
    if (r.sub) h(main, "div", "mn-row-s" + (r.clamp ? " is-clamp" : ""), r.sub);
    if (r.value) h(el, "div", "mn-row-v", r.value);
    if (r.chevron) icon(el, "chevron-right", "mn-row-chev");
    if (r.onTap) { const fn = r.onTap; el.addEventListener("click", (e) => { e.preventDefault(); fn(); }); }
    return el;
};

// The app's icons for each idea live in a few maps (this one, ROLE_ICON below, TAGS in pages/profile.ts, TAB_ICON in modes.ts);
// Dev Tools/Icons.md lists them. Every page takes its icon from these maps, never its own pick, so one idea has one icon everywhere.
export const DAMAGE_COLOR: Record<string, string> = { 物理: "var(--mn-phys)", 魔法: "var(--mn-magic)", 真實: "var(--mn-true)", 混合: "var(--mn-mixed)" };
export const DAMAGE_ICON: Record<string, string> = { 物理: "sword", 魔法: "sparkles", 真實: "gem", 混合: "blend" };
// The stats a champion builds towards (速查's 玩法 tab, the `stack` key); only these names are shown
export const STAT_ICON: Record<string, string> = { 法術強度: "sparkles", 攻擊力: "sword", 攻速: "gauge", 技能急速: "timer-reset", 暴擊: "dice-5", 生命: "heart", 護甲: "shield", 魔防: "shield-check", 穿透: "arrow-right-to-line", 跑速: "footprints" };
export const STAT_COLOR: Record<string, string> = { 法術強度: "var(--mn-magic)", 攻擊力: "var(--mn-phys)", 攻速: "var(--mn-true)", 技能急速: "var(--mn-haste)", 暴擊: "var(--mn-exec)", 生命: "var(--mn-heal)", 護甲: "var(--mn-guard)", 魔防: "var(--mn-shield)", 穿透: "var(--mn-aa)", 跑速: "var(--mn-dash)" };
export const REACH_ICON = "ruler";   // 近戰 / 中程 / 遠程
// The item shop's stat filters, in the shop's order: name, Lucide fallback icon, and the Data Dragon tags that count (Items page).
// The game's own icons are one sprite sheet (CommunityDragon, shown by address): one row per filter in this order, five states across
// (column 0 plain, column 2 lit); SHOP_ICON_Y / SHOP_ICON_X are the middles of each row / column, measured from the sheet.
export const SHOP_SPRITE = "https://raw.communitydragon.org/latest/game/assets/ux/itemshop/itemshop_texture_atlas4.png";
export const SHOP_ICON_Y = [11.5, 37.5, 63.5, 91.5, 118.5, 147.5, 176.5, 203.5, 231.5, 259.5, 286.5, 314.5, 341.5, 370.5];
export const SHOP_ICON_X = [12, 38, 64, 92.5, 120.5];
// One of the shop's icons from that sheet (row: the ITEM_CATS index), plain grey or lit in its colour, in a `size` px square
export const shopIcon = (parent: HTMLElement, row: number, lit: boolean, cls = "mn-shopic"): HTMLElement => {
    // a real picture of the sheet, cropped to the icon (not a CSS background), so it gets the loading look like every other picture
    const el = h(parent, "span", cls);
    const im = h(el, "img");
    im.src = SHOP_SPRITE; im.alt = ""; im.draggable = false;
    im.style.objectPosition = `${-(SHOP_ICON_X[lit ? 2 : 0] - 13)}px ${-(SHOP_ICON_Y[row] - 13)}px`;
    return el;
};
// The stats and damage kinds that have a shop icon: the row in the sheet (others keep their Lucide icon)
export const SHOP_ROW: Record<string, number> = { 攻擊力: 0, 物理: 0, 暴擊: 1, 攻速: 2, 穿透: 4, 法術強度: 5, 魔法: 5, 生命: 8, 護甲: 9, 魔防: 10, 技能急速: 11, 跑速: 12 };
export const ITEM_CATS: [string, string, string[]][] = [
    ["攻擊力", "sword", ["Damage"]], ["暴擊", "dice-5", ["CriticalStrike"]], ["攻速", "gauge", ["AttackSpeed"]], ["攻擊特效", "crosshair", ["OnHit"]],
    ["物理穿透", "arrow-right-to-line", ["ArmorPenetration"]], ["法術強度", "sparkles", ["SpellDamage"]], ["魔力", "droplet", ["Mana", "ManaRegen"]],
    ["法術穿透", "wand-sparkles", ["MagicPenetration"]], ["生命", "heart", ["Health", "HealthRegen"]], ["護甲", "shield", ["Armor"]], ["魔防", "shield-check", ["SpellBlock", "MagicResist"]],
    ["技能急速", "timer-reset", ["AbilityHaste", "CooldownReduction"]], ["移動", "footprints", ["Boots", "NonbootsMovement"]], ["吸血", "syringe", ["LifeSteal", "SpellVamp"]],
];
// A skill row's scaling note ("+25% 魔法攻擊 +10% 額外物理攻擊") split into its parts, each in the colour of its stat
// (magic blue, physical orange, anything else muted)
export const scalingParts = (note: string): { text: string; color: string; icon: string }[] =>
    (note.match(/\+[^+]+/g) ?? []).map((p) => p.trim()).filter(Boolean).map((text) => {
        const kind = text.includes("魔法") ? "魔法" : text.includes("物理") ? "物理" : "";
        return { text, color: kind ? DAMAGE_COLOR[kind] : "var(--mn-muted)", icon: kind ? DAMAGE_ICON[kind] : "plus" };
    });

export const chip = (parent: HTMLElement, text: string, o: { color?: string; on?: boolean; onTap?: () => void } = {}): HTMLElement => {
    const el = h(parent, o.onTap ? "button" : "span", "mn-chip" + (o.on ? " is-on" : "") + (o.color ? " has-color" : "") + (o.onTap ? " is-tap" : ""));
    if (o.color && o.onTap && !o.on) h(el, "span", "mn-dot");   // a coloured dot on a choice that is not selected
    el.appendChild(document.createTextNode(text));
    if (o.color) el.style.setProperty("--chip", o.color);
    if (o.onTap) { const fn = o.onTap; el.addEventListener("click", (e) => { e.preventDefault(); fn(); }); }
    return el;
};

// Role filter chips show an icon (echoing the game's class icons) instead of the word; the word is the label and shows in a bubble on tap
export const ROLE_ICON: Record<string, string> = { 戰士: "swords", 坦克: "shield", 法師: "wand-sparkles", 刺客: "slice", 射手: "target", 輔助: "heart-handshake" };
// The game's class icons, shown from the League of Legends Wiki by address (never stored in the vault). The wiki's classes differ
// a little from Riot's role tags: 刺客 is under its Slayer class, 輔助 its Controller class. A missing file falls back to ROLE_ICON.
const ROLE_WIKI = "https://wiki.leagueoflegends.com/en-us/Special:FilePath/";
// Lanes the same way (the wiki's position icons; a missing file falls back to these look-alikes)
export const LANES = ["上路", "打野", "中路", "下路", "輔助"];
const LANE_ICON: Record<string, string> = { 上路: "arrow-up-left", 打野: "trees", 中路: "move-diagonal-2", 下路: "arrow-down-right", 輔助: "heart-handshake" };
const LANE_FILE: Record<string, string> = { 上路: "Top_icon.png", 打野: "Jungle_icon.png", 中路: "Middle_icon.png", 下路: "Bottom_icon.png", 輔助: "Support_icon.png" };
const ROLE_FILE: Record<string, string> = { 戰士: "Fighter_icon.png", 坦克: "Tank_icon.png", 法師: "Mage_icon.png", 刺客: "Slayer_icon.png", 射手: "Marksman_icon.png", 輔助: "Controller_icon.png" };
// Fetch the class and lane icons once when the plugin loads, so they are ready when drawn
const preloaded = new Map<string, HTMLImageElement>();
export const preloadRoleIcons = (): void => {
    if (preloaded.size) return;
    for (const file of [...Object.values(ROLE_FILE), ...Object.values(LANE_FILE)]) { const im = new Image(); im.src = ROLE_WIKI + file; preloaded.set(file, im); }
};

// An icon-only filter chip with the game's icon (drawn at once when cached, else fading in; a look-alike if it fails to load).
// Hold for its name.
const iconChip = (parent: HTMLElement, label: string, file: string | undefined, fallback: string, o: { on: boolean; onTap: () => void }): HTMLElement => {
    const el = chip(parent, "", { on: o.on, onTap: o.onTap });
    el.classList.add("mn-chip-ic");
    el.setAttribute("aria-label", label);
    holdTip(el, label);
    if (!file) { icon(el, fallback); return el; }
    const im = h(el, "img", "mn-role-img");
    im.alt = "";
    im.draggable = false;
    const cached = preloaded.get(file);
    if (!(cached?.complete && cached.naturalWidth)) {
        im.classList.add("is-loading");
        im.addEventListener("load", () => im.classList.remove("is-loading"), { once: true });
    }
    im.addEventListener("error", () => { im.remove(); icon(el, fallback); }, { once: true });
    im.src = ROLE_WIKI + file;
    return el;
};
// A role's game art on its own (no chip), with the look-alike icon if the file does not load
export const roleArt = (parent: HTMLElement, role: string): HTMLElement => {
    const box = h(parent, "span", "mn-role-art");
    const file = ROLE_FILE[role];
    if (!file) { icon(box, ROLE_ICON[role] ?? "circle"); return box; }
    const im = h(box, "img", "mn-role-img"); im.alt = ""; im.draggable = false;
    im.addEventListener("error", () => { im.remove(); icon(box, ROLE_ICON[role] ?? "circle"); }, { once: true });
    im.src = ROLE_WIKI + file;
    return box;
};
export const roleChip = (parent: HTMLElement, role: string, o: { on: boolean; onTap: () => void }): HTMLElement => iconChip(parent, role, ROLE_FILE[role], ROLE_ICON[role] ?? "circle", o);
export const laneChip = (parent: HTMLElement, lane: string, o: { on: boolean; onTap: () => void }): HTMLElement => iconChip(parent, lane, LANE_FILE[lane], LANE_ICON[lane] ?? "circle", o);

// A row of equal-width cells that fills the page width (role chips, filter buttons)
export const fgrid = (parent: HTMLElement, cells: number): HTMLElement => {
    const row = h(parent, "div", "mn-fgrid");
    row.style.setProperty("--n", String(cells));
    return row;
};

const SVG_NS = "http://www.w3.org/2000/svg";
export const svg = (parent: Element, tag: string, attrs: Record<string, string | number> = {}, cls?: string): SVGElement => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (cls) e.setAttribute("class", cls);
    parent.appendChild(e);
    return e;
};

// A radar chart of 3+ axes (values 0..max), clockwise from the top. Labels carry the value.
export const radar = (parent: HTMLElement, axes: { label: string; value: number }[], max = 10, color = "var(--interactive-accent)"): SVGElement => {
    const W = 300, H = 250, cx = W / 2, cy = 128, R = 80, LABEL = 26, n = axes.length;
    const pt = (i: number, r: number): [number, number] => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const poly = (r: number | ((i: number) => number)) =>
        axes.map((_, i) => pt(i, typeof r === "number" ? r : r(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
    const root = svg(parent, "svg", { viewBox: `0 0 ${W} ${H}` }, "mn-radar");
    root.style.setProperty("--rd", color);
    for (const k of [0.25, 0.5, 0.75, 1]) svg(root, "polygon", { points: poly(R * k) }, "mn-rd-ring");
    axes.forEach((_, i) => { const [x, y] = pt(i, R); svg(root, "line", { x1: cx, y1: cy, x2: x, y2: y }, "mn-rd-axis"); });
    svg(root, "polygon", { points: poly((i) => (R * Math.max(0, Math.min(max, axes[i].value))) / max) }, "mn-rd-area");
    axes.forEach((ax, i) => {
        const [dx, dy] = pt(i, (R * Math.max(0, Math.min(max, ax.value))) / max);
        svg(root, "circle", { cx: dx, cy: dy, r: 3.5 }, "mn-rd-dot");
        const [lx, ly] = pt(i, R + LABEL);
        const t = svg(root, "text", { x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "middle" }, "mn-rd-label");
        const name = svg(t, "tspan"); name.textContent = ax.label + " ";
        const val = svg(t, "tspan", {}, "mn-rd-val"); val.textContent = String(ax.value);
    });
    return root;
};

export const empty = (parent: HTMLElement, o: { icon: string; title: string; text?: string }): HTMLElement => {
    const box = h(parent, "div", "mn-empty");
    icon(box, o.icon, "mn-empty-ic");
    h(box, "div", "mn-empty-t", o.title);
    if (o.text) h(box, "div", "mn-empty-s", o.text);
    return box;
};

// A row of equal-width choices (one is on). Used for sub-tabs, reach and sort.
export const segmented = (parent: HTMLElement, options: [string, string][], value: string, onChange: (id: string) => void, cls = ""): HTMLElement => {
    const seg = h(parent, "div", "mn-seg " + cls);
    for (const [id, label] of options) {
        const b = h(seg, "button", "mn-seg-b" + (id === value ? " is-on" : ""), label);
        b.addEventListener("click", (e) => { e.preventDefault(); onChange(id); });
    }
    slideSeg(seg, options.map(([id]) => id).join("|"));
    return seg;
};

// A small tick from the phone, where it can give one. Returns how: "capacitor" (Obsidian's own Haptics plugin, if the app has
// it), "vibrate" (the web vibration API; iPhones ignore it), "switch" (iOS 18+ ticks when a switch-style checkbox is toggled,
// but only inside a tap, not while a finger moves) or "" when nothing is there.
let tickBox: HTMLLabelElement | null = null;
export function haptic(): string {
    try {
        const hp = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: { selectionChanged?: () => unknown; impact?: (o: { style: string }) => unknown } } } }).Capacitor?.Plugins?.Haptics;
        if (hp?.impact) { void hp.impact({ style: "LIGHT" }); return "capacitor"; }
        if (hp?.selectionChanged) { void hp.selectionChanged(); return "capacitor"; }
    } catch { /* not there */ }
    try { if (navigator.vibrate?.(8)) return "vibrate"; } catch { /* not there */ }
    if (!tickBox) {
        tickBox = document.createElement("label");
        tickBox.className = "mn-tick";
        tickBox.setAttribute("aria-hidden", "true");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.setAttribute("switch", "");
        box.tabIndex = -1;
        tickBox.appendChild(box);
        document.body.appendChild(tickBox);
    }
    tickBox.click();
    return /iPhone|iPad/.test(navigator.userAgent) ? "switch" : "";
}

// The chosen option's highlight slides between buttons instead of jumping, and a finger can drag along the bar: the highlight
// follows it (a tick on each new option) and letting go picks the option under it. A bar drawn again (same options) starts
// from where the last one's highlight was, so a redraw still slides. Works on any bar whose buttons (`item`) toggle .is-on;
// `fit` sizes the highlight to a part of the button (the bottom bar's icon) instead of the whole button. Calling it again
// on the same bar (its buttons were rebuilt) only puts the highlight back.
const segLast = new Map<string, { x: number; y: number; w: number; h: number }>();
const slid = new WeakMap<HTMLElement, { hl: HTMLElement; place: () => void }>();
// A page that does not scroll itself (Picks, Champions): it is as tall as the scroll area, its own list part scrolls (.mn-rq-list), and
// with nothing to scroll iOS cannot jump the page when the keyboard opens for its search capsule (styles.css: .mn-rq-fixed)
export function fixedPage(el: HTMLElement, owner: { register(cb: () => void): void }): void {
    el.addClass("mn-rq-fixed");   // its height follows the scroll area in CSS at once (a measured height lagged when the keyboard closed)
    void owner;
}
const EDGE_ZONE = 28;   // px at the bottom of the screen where iOS's home-bar swipe begins
export function slideSeg(seg: HTMLElement, key = "", opt: { item?: string; fit?: string } = {}): void {
    const done = slid.get(seg);
    if (done) { if (!done.hl.isConnected) seg.prepend(done.hl); requestAnimationFrame(done.place); return; }
    const item = opt.item ?? ".mn-seg-b";
    const hl = document.createElement("div");
    hl.className = "mn-seg-hl";
    seg.prepend(hl);
    seg.addClass("has-hl");
    const buttons = () => Array.from(seg.querySelectorAll<HTMLElement>(`:scope > ${item}`));
    key = key || buttons().map((b) => b.textContent ?? "").join("|");
    const box = (b: HTMLElement) => {
        const r = ((opt.fit && b.querySelector<HTMLElement>(opt.fit)) || b).getBoundingClientRect(), s = seg.getBoundingClientRect();
        return { x: r.left - s.left - seg.clientLeft, y: r.top - s.top - seg.clientTop, w: r.width, h: r.height };
    };
    const put = (p: { x: number; y: number; w: number; h: number }) => {
        hl.style.opacity = "1";
        hl.style.width = `${p.w}px`;
        if (opt.fit) { hl.style.height = `${p.h}px`; hl.style.top = `${p.y}px`; }
        hl.style.transform = `translateX(${p.x}px)`;
    };
    const place = (b: HTMLElement | undefined, animate: boolean) => {
        if (!b || !b.offsetWidth) { if (!b) hl.style.opacity = "0"; return; }
        if (!animate) hl.style.transition = "none";
        const p = box(b);
        put(p);
        if (!animate) { void hl.offsetWidth; hl.style.transition = ""; }
        segLast.set(key, p);
    };
    const on = () => buttons().find((b) => b.hasClass("is-on"));
    requestAnimationFrame(() => {
        const last = segLast.get(key);
        if (last) { hl.style.transition = "none"; put(last); void hl.offsetWidth; hl.style.transition = ""; place(on(), true); }
        else place(on(), false);
    });
    slid.set(seg, { hl, place: () => place(on(), false) });
    new MutationObserver(() => { if (!seg.hasClass("is-drag")) place(on(), true); }).observe(seg, { subtree: true, attributes: true, attributeFilter: ["class"] });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => place(on(), false)).observe(seg);

    // drag: the button under the finger, previewed until the finger lifts
    // iPhone's home-bar swipe (switch or close apps) starts at the bottom edge and runs up or sideways over the tab bar: a touch that
    // starts in that edge, or that goes up more than across, or that iOS takes over (pointercancel) never changes the tab
    let at: HTMLElement | null = null, moved = false, startX = 0, startY = 0, quietUntil = 0, fromEdge = false;
    const under = (x: number) => buttons().find((b) => { const r = b.getBoundingClientRect(); return x >= r.left && x < r.right; }) ?? null;
    seg.addEventListener("pointerdown", (e) => {
        fromEdge = e.pointerType === "touch" && e.clientY > window.innerHeight - EDGE_ZONE;
        at = fromEdge ? null : under(e.clientX); moved = false; startX = e.clientX; startY = e.clientY;
    });
    seg.addEventListener("pointermove", (e) => {
        if (!at) return;
        if (!moved && Math.abs(e.clientY - startY) > Math.abs(e.clientX - startX) && Math.abs(e.clientY - startY) > 8) { at = null; fromEdge = true; return; }   // a swipe up: not ours
        if (!moved && Math.abs(e.clientX - startX) < 8) return;
        if (!moved) { moved = true; seg.addClass("is-drag"); try { seg.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ } }
        const b = under(e.clientX);
        if (b && b !== at) { at = b; buttons().forEach((x) => x.toggleClass("is-pv", x === b)); place(b, true); haptic(); }
    });
    const end = (e: PointerEvent) => {
        const target = moved ? at : null;
        at = null;
        if (!moved) return;
        moved = false;
        seg.removeClass("is-drag");
        buttons().forEach((x) => x.removeClass("is-pv"));
        if (target && !target.hasClass("is-on") && e.type === "pointerup") { haptic(); target.click(); }   // lifting the finger counts as a tap for iOS's tick; a cancel (iOS took the gesture) changes nothing
        else place(on(), true);
        quietUntil = Date.now() + 400;   // the click a drag may still fire (target.click() above is not a real one, so it passes)
    };
    seg.addEventListener("pointerup", end);
    seg.addEventListener("pointercancel", end);
    // dragging along a bar is ours: Obsidian must not read it as the swipe that opens a sidebar
    for (const ev of ["touchstart", "touchmove"]) seg.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    seg.addEventListener("touchmove", (e) => { if (moved && e.cancelable) e.preventDefault(); }, { passive: false });
    seg.addEventListener("click", (e) => { if (e.isTrusted && (Date.now() < quietUntil || fromEdge)) { e.stopPropagation(); e.preventDefault(); fromEdge = false; } }, { capture: true });
}
