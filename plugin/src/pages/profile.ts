import type { Champion } from "../data/store";
import { DAMAGE_COLOR, h, svg } from "../ui";

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

// The abilities a champion has, lit when it has them (with how many of its skills), dim when it does not
const ABILITIES: { tag: string; color: string }[] = [
    { tag: "控場", color: "var(--color-purple)" }, { tag: "緩速", color: "var(--color-blue)" }, { tag: "位移", color: "var(--color-cyan)" },
    { tag: "治療", color: "var(--color-green)" }, { tag: "護盾", color: "var(--color-yellow)" }, { tag: "吸血", color: "var(--color-red)" },
    { tag: "強化普攻", color: "var(--color-pink)" },
];

// Every damage kind a champion deals: its main one (Riot's ratings) first, then the others its skills also deal ("輸出" = main, "兼" = also)
export function damageKinds(c: Champion): { kind: string; main: boolean }[] {
    const main = c.damageType === "混合" ? ["物理", "魔法"] : [c.damageType];
    const extra = c.skillDamage.filter((d) => !main.includes(d));
    return [...main.map((kind) => ({ kind, main: true })), ...extra.map((kind) => ({ kind, main: false }))];
}

export function abilityPills(parent: HTMLElement, c: Champion, onlyLit = false): HTMLElement {
    const row = h(parent, "div", "mn-pills");
    for (const a of ABILITIES) {
        const n = count(c, a.tag);
        const lit = c.features.includes(a.tag);
        if (onlyLit && !lit) continue;
        const p = h(row, "span", "mn-pill" + (lit ? " is-lit" : " is-off"), a.tag + (lit && n > 1 ? ` ×${n}` : ""));
        p.style.setProperty("--p", a.color);
    }
    return row;
}

// 近戰 / 中程 / 遠程, the damage kind and how hard the champion is (dots)
export function styleLine(parent: HTMLElement, c: Champion): void {
    const row = h(parent, "div", "mn-pro-line");
    const reach = c.archetypes.find((a) => a === "近戰" || a === "中程" || a === "遠程") ?? "";
    if (reach) h(row, "span", "mn-pro-i", reach);
    for (const d of damageKinds(c)) {
        const dmg = h(row, "span", "mn-pro-i", d.main ? `${d.kind}輸出` : `兼${d.kind}`);
        dmg.style.color = DAMAGE_COLOR[d.kind] ?? "inherit";
    }
    const dots = h(row, "span", "mn-pro-i mn-hard");
    h(dots, "span", "", "難度");
    const level = Math.max(1, Math.min(5, Math.ceil(c.difficulty / 2)));
    for (let i = 1; i <= 5; i++) h(dots, "i", i <= level ? "is-on" : "");
}

// the whole block of the champion card
export function championProfile(parent: HTMLElement, c: Champion, color: string): void {
    styleLine(parent, c);
    profileRadar(parent, profileAxes(c), color);
    abilityPills(parent, c);
}
