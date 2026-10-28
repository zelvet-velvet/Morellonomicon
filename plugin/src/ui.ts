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
// Pictures a page waits for before it shows (the ones at its top), so it does not appear with empty frames; never longer than `ms`.
// Returns null when there is nothing to wait for. Pictures set to load lazily are made eager, since a page not on screen yet
// would never load them.
export const FIRST_SCREEN = 16;
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
        im.loading = "lazy";
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
    else if (r.image) { const im = h(el, "img", "mn-row-img"); im.src = r.image; im.loading = "lazy"; im.alt = ""; }
    else if (r.icon) icon(el, r.icon, "mn-row-ic");
    const main = h(el, "div", "mn-row-main");
    h(main, "div", "mn-row-t", r.title);
    if (r.sub) h(main, "div", "mn-row-s" + (r.clamp ? " is-clamp" : ""), r.sub);
    if (r.value) h(el, "div", "mn-row-v", r.value);
    if (r.chevron) icon(el, "chevron-right", "mn-row-chev");
    if (r.onTap) { const fn = r.onTap; el.addEventListener("click", (e) => { e.preventDefault(); fn(); }); }
    return el;
};

export const DAMAGE_COLOR: Record<string, string> = { 物理: "var(--mn-phys)", 魔法: "var(--mn-magic)", 真實: "var(--mn-true)", 混合: "var(--mn-mixed)" };

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
    let at: HTMLElement | null = null, moved = false, startX = 0, quietUntil = 0;
    const under = (x: number) => buttons().find((b) => { const r = b.getBoundingClientRect(); return x >= r.left && x < r.right; }) ?? null;
    seg.addEventListener("pointerdown", (e) => { at = under(e.clientX); moved = false; startX = e.clientX; });
    seg.addEventListener("pointermove", (e) => {
        if (!at || (!moved && Math.abs(e.clientX - startX) < 8)) return;
        if (!moved) { moved = true; seg.addClass("is-drag"); }
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
        if (target && !target.hasClass("is-on")) { if (e.type === "pointerup") haptic(); target.click(); }   // lifting the finger counts as a tap for iOS's tick
        else place(on(), true);
        quietUntil = Date.now() + 400;   // the click a drag may still fire (target.click() above is not a real one, so it passes)
    };
    seg.addEventListener("pointerup", end);
    seg.addEventListener("pointercancel", end);
    seg.addEventListener("click", (e) => { if (e.isTrusted && Date.now() < quietUntil) { e.stopPropagation(); e.preventDefault(); } }, { capture: true });
}
