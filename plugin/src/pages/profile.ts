import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { Champion } from "../data/store";
import { DAMAGE_COLOR, h, icon, svg, tip } from "../ui";

// A champion at a glance: what it can do, drawn as a profile chart, plus the abilities it has. Every axis comes from data we have:
//   輸出 = its stronger damage rating (Riot, 1-10)        坦度 = Riot's defence rating
//   控場 / 位移 / 輔助 = how many of its Q W E R do crowd control / move the champion / heal or shield (read from the skill text)
//   射程 = attack range (650 = full)
export interface Axis { label: string; value: number }
const SKILL_STEPS = [0, 4, 7, 9, 10];   // 0, 1, 2, 3, 4 skills -> a score out of 10

const count = (c: Champion, ...tags: string[]): number => c.skills.filter((s) => s.key !== "P" && tags.some((t) => s.tags.includes(t))).length;
const score = (n: number): number => SKILL_STEPS[Math.min(n, SKILL_STEPS.length - 1)];

export function profileAxes(c: Champion): Axis[] {
    return [
        { label: "輸出", value: Math.max(c.attack, c.magic) },
        { label: "坦度", value: c.defense },
        { label: "控場", value: score(count(c, "控場")) },
        { label: "位移", value: score(count(c, "位移")) },
        { label: "輔助", value: score(count(c, "治療", "護盾")) },
        { label: "射程", value: Math.min(10, Math.round(c.range / 65)) },
    ];
}

let uid = 0;   // gradient ids must be unique on the page

// A hexagon chart: soft rings, a gradient-filled shape in the champion's damage colour, a dot and the number on each axis.
export function profileRadar(parent: HTMLElement, axes: Axis[], color: string, max = 10): void {
    const W = 340, H = 300, cx = W / 2, cy = 150, R = 96, LABEL = 28, n = axes.length;
    const pt = (i: number, r: number): [number, number] => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const poly = (r: (i: number) => number) => axes.map((_, i) => pt(i, r(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
    const val = (i: number) => (R * Math.max(0, Math.min(max, axes[i].value))) / max;
    const root = svg(parent, "svg", { viewBox: `0 0 ${W} ${H}` }, "mn-radar mn-pro");
    root.style.setProperty("--rd", color);
    const id = `mn-grad-${++uid}`;
    const defs = svg(root, "defs");
    const grad = svg(defs, "linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    svg(grad, "stop", { offset: "0%", "stop-opacity": 0.62 }, "mn-rd-stop").setAttribute("style", `stop-color:${color}`);
    svg(grad, "stop", { offset: "100%", "stop-opacity": 0.14 }, "mn-rd-stop").setAttribute("style", `stop-color:${color}`);
    for (let k = 5; k >= 1; k--) svg(root, "polygon", { points: poly(() => (R * k) / 5) }, k === 5 ? "mn-rd-ring is-outer" : "mn-rd-ring");
    axes.forEach((_, i) => { const [x, y] = pt(i, R); svg(root, "line", { x1: cx, y1: cy, x2: x, y2: y }, "mn-rd-axis"); });
    svg(root, "polygon", { points: poly(val), fill: `url(#${id})` }, "mn-rd-shape");
    axes.forEach((ax, i) => {
        const [dx, dy] = pt(i, val(i));
        svg(root, "circle", { cx: dx, cy: dy, r: 6.5 }, "mn-rd-halo");
        svg(root, "circle", { cx: dx, cy: dy, r: 3.6 }, "mn-rd-dot");
        const [lx, ly] = pt(i, R + LABEL);
        const t = svg(root, "text", { x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "middle" }, "mn-rd-label");
        const name = svg(t, "tspan"); name.textContent = ax.label;
        const v = svg(t, "tspan", { dx: 5 }, "mn-rd-val"); v.textContent = String(ax.value);
    });
}

// The abilities a champion has, as icons: lit when it has them (with how many of its skills), dim when it does not.
// Tap an icon for its name; the legend lists every icon with its full name and the usual abbreviation.
const ABILITIES: { tag: string; color: string; icon: string; en: string; abbr: string; what: string }[] = [
    { tag: "控場", color: "var(--color-purple)", icon: "lock", en: "Crowd Control", abbr: "CC", what: "暈眩、擊飛、定身、沉默、恐懼等,讓敵人動不了或不能放技能" },
    { tag: "緩速", color: "var(--color-blue)", icon: "snowflake", en: "Slow", abbr: "Slow", what: "降低敵人的移動速度" },
    { tag: "位移", color: "var(--color-cyan)", icon: "arrow-big-right-dash", en: "Dash / Mobility", abbr: "Dash", what: "衝刺、閃現、瞬步、跳躍等,讓自己快速移動" },
    { tag: "治療", color: "var(--color-green)", icon: "heart-pulse", en: "Heal", abbr: "Heal", what: "回復自己或隊友的生命" },
    { tag: "護盾", color: "var(--color-yellow)", icon: "shield-plus", en: "Shield", abbr: "Shield", what: "給自己或隊友一層可吸收傷害的護盾" },
    { tag: "吸血", color: "var(--color-red)", icon: "syringe", en: "Lifesteal / Omnivamp", abbr: "LS", what: "造成傷害時回復自己的生命" },
    { tag: "強化普攻", color: "var(--color-pink)", icon: "sword", en: "Empowered attacks (On-hit)", abbr: "On-hit", what: "技能會強化普通攻擊(下一次普攻、額外傷害)。依技能文字判斷,比「適合出攻擊特效裝」寬" },
];

// The chart of every ability icon: icon, name, English name, abbreviation and what it means
class AbilityLegend extends Modal {
    constructor(app: App) { super(app); }
    onOpen(): void {
        this.titleEl.setText("圖示說明");
        const table = h(this.contentEl, "div", "mn-lg");
        const head = h(table, "div", "mn-lg-r mn-lg-h");
        for (const t of ["", "名稱", "英文 / 縮寫"]) h(head, "span", "", t);
        for (const a of ABILITIES) {
            const r = h(table, "div", "mn-lg-r");
            const ic = icon(h(r, "span", "mn-pill mn-pill-ic is-lit"), a.icon);
            ic.parentElement?.style.setProperty("--p", a.color);
            const name = h(r, "span", "mn-lg-n", a.tag);
            h(name, "div", "mn-lg-w", a.what);
            h(r, "span", "mn-lg-e", `${a.en} · ${a.abbr}`);
        }
        h(this.contentEl, "p", "mn-lg-note", "亮的圖示代表這位英雄有;暗的代表沒有。數字是有幾個技能有這個效果。");
    }
    onClose(): void { this.contentEl.empty(); }
}

export function abilityPills(parent: HTMLElement, c: Champion, onlyLit = false): HTMLElement {
    const row = h(parent, "div", "mn-pills");
    for (const a of ABILITIES) {
        const n = count(c, a.tag);
        const lit = c.features.includes(a.tag);
        if (onlyLit && !lit) continue;
        const p = h(row, "button", "mn-pill mn-pill-ic" + (lit ? " is-lit" : " is-off"));
        p.setAttribute("aria-label", a.tag);
        icon(p, a.icon);
        if (lit && n > 1) h(p, "span", "mn-pill-n", String(n));
        p.style.setProperty("--p", a.color);
        p.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); tip(p, `${a.tag} · ${a.abbr}`); });
    }
    return row;
}

// Every damage kind a champion deals: its main one (Riot's ratings) first, then the others its skills also deal ("輸出" = main, "兼" = also)
export function damageKinds(c: Champion): { kind: string; main: boolean }[] {
    const main = c.damageType === "混合" ? ["物理", "魔法"] : [c.damageType];
    const extra = c.skillDamage.filter((d) => !main.includes(d));
    return [...main.map((kind) => ({ kind, main: true })), ...extra.map((kind) => ({ kind, main: false }))];
}

// 近戰 / 中程 / 遠程
export const reachOf = (c: Champion): string => c.archetypes.find((a) => a === "近戰" || a === "中程" || a === "遠程") ?? "";

// five dots for how hard a champion is
export function difficultyDots(parent: HTMLElement, c: Champion): HTMLElement {
    const dots = h(parent, "span", "mn-hard");
    const level = Math.max(1, Math.min(5, Math.ceil(c.difficulty / 2)));
    for (let i = 1; i <= 5; i++) h(dots, "i", i <= level ? "is-on" : "");
    return dots;
}

// The damage kinds in words ("魔法為主,兼物理") and a bar split by Riot's physical / magic ratings
export function damageBar(parent: HTMLElement, c: Champion): void {
    const kinds = damageKinds(c);
    const mainKinds = kinds.filter((k) => k.main).map((k) => k.kind);
    const extras = kinds.filter((k) => !k.main).map((k) => k.kind);
    const words = mainKinds.length > 1 ? mainKinds.join("+") : `${mainKinds[0]}為主`;
    const line = h(parent, "div", "mn-dmg-t");
    h(line, "span", "mn-dmg-m", words).style.color = DAMAGE_COLOR[mainKinds[0]] ?? "inherit";
    if (extras.length) h(line, "span", "mn-dmg-x", `,兼${extras.join("、")}`);
    const total = Math.max(1, c.attack + c.magic);
    const bar = h(parent, "div", "mn-split");
    for (const [kind, rating] of [["物理", c.attack], ["魔法", c.magic]] as const) {
        const seg = h(bar, "span", "");
        seg.style.flex = String(Math.max(0.08, rating / total));
        seg.style.background = DAMAGE_COLOR[kind];
    }
}

// Three facts side by side: damage (words and bar), reach, difficulty
export function factsRow(parent: HTMLElement, c: Champion): void {
    const facts = h(parent, "div", "mn-rq-facts");
    const fact = (label: string) => { const f = h(facts, "div", "mn-rq-f"); h(f, "div", "mn-rq-fl", label); return h(f, "div", "mn-rq-fv"); };
    damageBar(fact("傷害"), c);
    h(fact("距離"), "span", "mn-rq-big", reachOf(c) || "—");
    difficultyDots(fact("難度"), c);
}

// The ability icons under a small label
export function abilityBlock(parent: HTMLElement, c: Champion, app?: App): void {
    const head = h(parent, "div", "mn-rq-al");
    h(head, "span", "mn-rq-fl", "技能(點圖示看名稱)");
    if (app) {
        const q = h(head, "button", "mn-lg-btn");
        icon(q, "circle-help");
        h(q, "span", "", "圖示說明");
        q.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); new AbilityLegend(app).open(); });
    }
    abilityPills(parent, c, false);
}

// the whole block of the champion card
export function championProfile(parent: HTMLElement, c: Champion, color: string, app?: App): void {
    factsRow(parent, c);
    profileRadar(parent, profileAxes(c), color);
    abilityBlock(parent, c, app);
}
