import { setIcon } from "obsidian";

// Small DOM helpers. Text always goes in through textContent (never innerHTML).
export const h = <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement | null, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    parent?.appendChild(e);
    return e;
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

export interface RowSpec { icon?: string; image?: string; title: string; sub?: string; value?: string; chevron?: boolean; muted?: boolean; onTap?: () => void }
export const row = (parent: HTMLElement, r: RowSpec): HTMLElement => {
    const el = h(parent, "div", "mn-row" + (r.onTap ? " is-tap" : "") + (r.muted ? " is-muted" : ""));
    if (r.image) { const im = h(el, "img", "mn-row-img"); im.src = r.image; im.loading = "lazy"; im.alt = ""; }
    else if (r.icon) icon(el, r.icon, "mn-row-ic");
    const main = h(el, "div", "mn-row-main");
    h(main, "div", "mn-row-t", r.title);
    if (r.sub) h(main, "div", "mn-row-s", r.sub);
    if (r.value) h(el, "div", "mn-row-v", r.value);
    if (r.chevron) icon(el, "chevron-right", "mn-row-chev");
    if (r.onTap) { const fn = r.onTap; el.addEventListener("click", (e) => { e.preventDefault(); fn(); }); }
    return el;
};

export const DAMAGE_COLOR: Record<string, string> = { 物理: "var(--color-orange)", 魔法: "var(--color-blue)", 真實: "var(--color-yellow)", 混合: "var(--color-purple)" };

export const chip = (parent: HTMLElement, text: string, o: { color?: string; on?: boolean; onTap?: () => void } = {}): HTMLElement => {
    const el = h(parent, o.onTap ? "button" : "span", "mn-chip" + (o.on ? " is-on" : ""), text);
    if (o.color) el.style.setProperty("--chip", o.color);
    if (o.onTap) { const fn = o.onTap; el.addEventListener("click", (e) => { e.preventDefault(); fn(); }); }
    return el;
};

export const bar = (parent: HTMLElement, label: string, value: number, max = 10, color = "var(--interactive-accent)"): HTMLElement => {
    const r = h(parent, "div", "mn-bar");
    h(r, "div", "mn-bar-l", label);
    const track = h(r, "div", "mn-bar-track");
    const fill = h(track, "div", "mn-bar-fill");
    fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
    fill.style.background = color;
    h(r, "div", "mn-bar-v", String(value));
    return r;
};

export const empty = (parent: HTMLElement, o: { icon: string; title: string; text?: string }): HTMLElement => {
    const box = h(parent, "div", "mn-empty");
    icon(box, o.icon, "mn-empty-ic");
    h(box, "div", "mn-empty-t", o.title);
    if (o.text) h(box, "div", "mn-empty-s", o.text);
    return box;
};
