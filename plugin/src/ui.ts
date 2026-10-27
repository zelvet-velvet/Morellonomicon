import { setIcon } from "obsidian";

// Small DOM helpers. Text always goes in through textContent (never innerHTML).
export const h = <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement | null, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    parent?.appendChild(e);
    return e;
};

// A small bubble over (or under) an element, for the name of an icon: replaces itself on the next tap and fades after a moment
let tipEl: HTMLElement | null = null;
let tipTimer = 0;
const TIP_MS = 2200;
export const tip = (anchor: HTMLElement, text: string): void => {
    tipEl?.remove();
    window.clearTimeout(tipTimer);
    const t = h(anchor.closest<HTMLElement>(".mn-app") ?? document.body, "div", "mn-tip", text);
    tipEl = t;
    const a = anchor.getBoundingClientRect();
    t.style.left = `${Math.max(8, Math.min(window.innerWidth - t.offsetWidth - 8, a.left + a.width / 2 - t.offsetWidth / 2))}px`;
    t.style.top = `${a.top - t.offsetHeight - 8 < 8 ? a.bottom + 8 : a.top - t.offsetHeight - 8}px`;
    tipTimer = window.setTimeout(() => { t.remove(); if (tipEl === t) tipEl = null; }, TIP_MS);
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

export const DAMAGE_COLOR: Record<string, string> = { 物理: "var(--color-orange)", 魔法: "var(--color-blue)", 真實: "var(--color-yellow)", 混合: "var(--color-purple)" };

export const chip = (parent: HTMLElement, text: string, o: { color?: string; on?: boolean; onTap?: () => void } = {}): HTMLElement => {
    const el = h(parent, o.onTap ? "button" : "span", "mn-chip" + (o.on ? " is-on" : "") + (o.color ? " has-color" : "") + (o.onTap ? " is-tap" : ""));
    if (o.color && o.onTap && !o.on) h(el, "span", "mn-dot");   // a coloured dot on a choice that is not selected
    el.appendChild(document.createTextNode(text));
    if (o.color) el.style.setProperty("--chip", o.color);
    if (o.onTap) { const fn = o.onTap; el.addEventListener("click", (e) => { e.preventDefault(); fn(); }); }
    return el;
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
    return seg;
};
