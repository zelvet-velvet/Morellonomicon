import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { Champion } from "../data/store";
import { DAMAGE_COLOR, gameIcon, h, holdTip, icon, svg } from "../ui";

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
    const W = 300, H = 204, cx = W / 2, cy = 102, R = 66, LABEL = 22, n = axes.length;
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

// Every ability tag: name, colour, icon, English name and abbreviation, and what it means (the legend shows them all).
// 攻擊特效 (on-hit) is not in the skill text we have, so it only shows when a champion note lists it in `features_extra`.
interface Tag { tag: string; color: string; icon: string; en: string; abbr: string; what: string }
const TAGS: Tag[] = [
    // 傷害方式
    { tag: "強化普攻", color: "var(--mn-aa)", icon: "sword", en: "Empowered attack", abbr: "AA+", what: "技能讓下一次(或接下來幾次)普攻更強,例如額外傷害" },
    { tag: "攻擊特效", color: "var(--mn-onhit)", icon: "crosshair", en: "On-hit", abbr: "On-hit", what: "技能會觸發攻擊特效,適合出攻擊特效裝備(人工標註)" },
    { tag: "斬殺", color: "var(--mn-exec)", icon: "skull", en: "Execute", abbr: "Execute", what: "對生命值低的敵人造成更高傷害或直接擊殺" },
    // 控制
    { tag: "控場", color: "var(--mn-cc)", icon: "lock", en: "Crowd Control", abbr: "CC", what: "暈眩、擊飛、定身、沉默、恐懼、魅惑等,讓敵人動不了或不能放技能" },
    { tag: "緩速", color: "var(--mn-slow)", icon: "snowflake", en: "Slow", abbr: "Slow", what: "降低敵人的移動速度" },
    { tag: "削弱", color: "var(--mn-weak)", icon: "trending-down", en: "Debuff", abbr: "Debuff", what: "致盲、近視、重傷、降低護甲 / 魔抗 / 攻速,讓敵人變弱但還能行動" },
    // 移動
    { tag: "位移", color: "var(--mn-dash)", icon: "arrow-big-right-dash", en: "Dash / Blink", abbr: "Dash", what: "衝刺、閃現、瞬步、跳躍等,讓自己快速移動" },
    { tag: "加速", color: "var(--mn-haste)", icon: "wind", en: "Movement speed", abbr: "MS", what: "提高自己或隊友的移動速度" },
    { tag: "隱身", color: "var(--mn-stealth)", icon: "eye-off", en: "Stealth / Camouflage", abbr: "Stealth", what: "隱形或偽裝,讓敵人看不到你" },
    // 生存
    { tag: "治療", color: "var(--mn-heal)", icon: "heart-pulse", en: "Heal", abbr: "Heal", what: "回復自己或隊友的生命" },
    { tag: "護盾", color: "var(--mn-shield)", icon: "shield-plus", en: "Shield", abbr: "Shield", what: "給自己或隊友一層可吸收傷害的護盾" },
    { tag: "吸血", color: "var(--mn-ls)", icon: "syringe", en: "Lifesteal / Omnivamp", abbr: "LS", what: "造成傷害時回復自己的生命" },
    { tag: "免傷", color: "var(--mn-guard)", icon: "shield-half", en: "Damage reduction / Untargetable", abbr: "DR", what: "減少受到的傷害,或短時間無法被選取 / 無敵" },
    // 團隊
    { tag: "幫隊友", color: "var(--mn-team)", icon: "users", en: "Helps allies", abbr: "Ally", what: "治療、護盾或加速也能給隊友" },
];
// The tags in groups (filter panel, legend), in the order above
export const TAG_GROUPS: [string, string[]][] = [
    ["傷害方式", ["強化普攻", "攻擊特效", "斬殺"]], ["控制", ["控場", "緩速", "削弱"]], ["移動", ["位移", "加速", "隱身"]],
    ["生存", ["治療", "護盾", "吸血", "免傷"]], ["團隊", ["幫隊友"]],
];
const TAG = new Map(TAGS.map((t) => [t.tag, t] as const));

// The chart of every tag: icon, name, what it means, English name and abbreviation
class TagLegend extends Modal {
    constructor(app: App) { super(app); }
    onOpen(): void {
        this.titleEl.setText("圖示說明");
        const table = h(this.contentEl, "div", "mn-lg");
        // the window lives outside the app, so the tag colours (CSS variables on the app) are read from the app and copied in
        const app = document.querySelector<HTMLElement>(".mn-app");
        const css = app ? getComputedStyle(app) : null;
        const resolve = (v: string): string => v.replace(/var\((--[\w-]+)\)/, (_m, name: string) => css?.getPropertyValue(name).trim() || "currentColor");
        for (const [group, tags] of TAG_GROUPS) {
            h(table, "div", "mn-lg-g", group);
            for (const a of TAGS.filter((x) => tags.includes(x.tag))) {
            const color = resolve(a.color);
            const r = h(table, "div", "mn-lg-r");
            const ic = h(r, "span", "mn-lg-ic");
            ic.style.setProperty("--p", color);
            gameIcon(ic, a.tag, a.icon, 22);
            const name = h(r, "span", "mn-lg-n", a.tag);
            name.style.color = color;
            h(name, "div", "mn-lg-w", a.what);
            h(r, "span", "mn-lg-e", `${a.en} · ${a.abbr}`);
            }
        }
    }
    onClose(): void { this.contentEl.empty(); }
}

// An icon-only filter: dim when off, a ring in its colour when on. Hold for the name.
export function iconFilter(parent: HTMLElement, label: string, iconName: string, color: string, on: boolean, onTap: () => void): HTMLElement {
    const el = h(parent, "button", "mn-ftg" + (on ? " is-yes" : ""));
    el.setAttribute("aria-label", label);
    el.style.setProperty("--p", color);
    gameIcon(el, label, iconName, 24);
    holdTip(el, label);
    el.addEventListener("click", (e) => { e.preventDefault(); onTap(); });
    return el;
}
// A tag (控場 ...) as such a filter, in the tag's own icon and colour
export function tagFilter(parent: HTMLElement, tag: string, on: boolean, onTap: () => void): HTMLElement {
    const t = TAG.get(tag);
    return iconFilter(parent, tag, t?.icon ?? "circle", t?.color ?? "var(--mn-text)", on, onTap);
}

// The keys of the skills that carry a tag ("Q · E · R"), passive first as P
const keysOf = (c: Champion, ...tags: string[]): string => c.skills.filter((s) => tags.some((t) => s.tags.includes(t))).map((s) => s.key).join(" · ");
const hasTag = (c: Champion, tag: string): boolean => c.features.includes(tag);

// 近戰 / 中程 / 遠程
export const reachOf = (c: Champion): string => c.archetypes.find((a) => a === "近戰" || a === "中程" || a === "遠程") ?? "";

// One tag as a chip: icon, name and the skills that carry it; solid when the champion has it, dashed when not. Tap for what it means.
function tagChip(parent: HTMLElement, c: Champion, t: Tag): HTMLElement {
    const lit = hasTag(c, t.tag);
    const el = h(parent, "button", "mn-tg" + (lit ? " is-on" : ""));
    el.style.setProperty("--p", t.color);
    gameIcon(el, t.tag, t.icon, 16);
    h(el, "span", "", t.tag);
    const keys = lit ? keysOf(c, t.tag) : "";
    if (keys) h(el, "span", "mn-tg-k", keys);
    holdTip(el, `${t.tag} · ${t.abbr}`);
    el.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });   // a tag is not a link (inside a 速查 card)
    return el;
}

// A row of tag chips (all of them, or the ones named)
export function tagRow(parent: HTMLElement, c: Champion, only?: string[], litOnly = false): HTMLElement {
    const row = h(parent, "div", "mn-tgs");
    for (const t of TAGS) if ((!only || only.includes(t.tag)) && (!litOnly || hasTag(c, t.tag))) tagChip(row, c, t);
    return row;
}

// Each damaging ability at max rank: its damage type, base damage and how it scales (+% 物攻 / 魔攻, from the skill's rank grid).
// A skill can list the same hit twice (per dagger and in total): the biggest line of each type is the one shown.
const KINDS = ["物理", "魔法", "真實"] as const;
export interface DamageLine { key: string; name: string; kind: string; first: number; base: number; ad: number; ap: number; onHit: boolean }
const lastNum = (s: string): number => parseFloat(s.split("/").pop() ?? "") || 0;   // "75/85/95" -> 95 (max rank)
export function damageLines(c: Champion): DamageLine[] {
    const out: DamageLine[] = [];
    for (const s of c.skills) for (const kind of KINDS) {
        const rows = s.rows.filter((r) => r.label.startsWith(`${kind}傷害`));
        // the passive has no rank grid in our data: when its text names a damage type, list it without a number
        if (!rows.length && s.key === "P" && s.desc.includes(`${kind}傷害`)) { out.push({ key: s.key, name: s.name, kind, first: 0, base: 0, ad: 0, ap: 0, onHit: s.tags.includes("攻擊特效") }); continue; }
        if (!rows.length) continue;
        const best = rows.reduce((x, y) => (lastNum(y.vals[y.vals.length - 1]) > lastNum(x.vals[x.vals.length - 1]) ? y : x));
        let ad = 0, ap = 0;
        for (const m of best.note.matchAll(/\+([\d./]+)%\s*(額外物理攻擊|物理攻擊|魔法攻擊)/g)) {
            if (m[2] === "魔法攻擊") ap += lastNum(m[1]); else ad += lastNum(m[1]);
        }
        out.push({ key: s.key, name: s.name, kind, first: lastNum(best.vals[0]), base: lastNum(best.vals[best.vals.length - 1]), ad, ap, onHit: s.tags.includes("攻擊特效") });
    }
    return out;
}

// The strip above the chart. Damage: one line per damaging ability (key, name, type, base damage at max rank, scaling), then the
// abilities' scaling added up as 物攻 vs 魔攻 (which items it wants); then reach and difficulty. Labels left, values right.
export function factsStrip(parent: HTMLElement, c: Champion): void {
    const strip = h(parent, "div", "mn-fs");
    const dmg = h(strip, "div", "mn-fs-dmg");
    // a small table with fixed columns: ability, damage type, 物攻 / 魔攻 scaling, base damage from rank 1 to max rank
    h(dmg, "div", "mn-fs-l", "技能傷害");
    const lines = damageLines(c);
    if (!lines.length) h(dmg, "div", "mn-fs-hint", "沒有傷害技能");
    const ad = lines.reduce((n, d) => n + d.ad, 0), ap = lines.reduce((n, d) => n + d.ap, 0);
    // the abilities' scaling added up, above the table: 物攻 at the bar's left end, 魔攻 at its right end
    if (ad + ap > 0) {
        const ends = h(dmg, "div", "mn-fs-row mn-dl-foot");
        const l = h(ends, "span", "mn-dl-sum", ad ? `物攻 ${ad}%` : ""); l.style.color = DAMAGE_COLOR["物理"];
        const r = h(ends, "span", "mn-dl-sum", ap ? `魔攻 ${ap}%` : ""); r.style.color = DAMAGE_COLOR["魔法"];
        const bar = h(dmg, "div", "mn-stack");
        for (const [v, k] of [[ad, "物理"], [ap, "魔法"]] as const) if (v) { const seg = h(bar, "i"); seg.style.flex = String(v); seg.style.background = DAMAGE_COLOR[k]; }
    }
    const list = h(dmg, "div", "mn-dl");
    if (lines.length) for (const t of ["", "", "類型", "物攻", "魔攻", "基礎傷害"]) h(list, "span", "mn-dl-h", t);
    const num = (n: number) => Math.round(n * 10) / 10;
    for (const d of lines) {
        h(list, "span", "mn-dl-key", d.key);
        const name = h(list, "span", "mn-dl-name", d.name);
        const notes = [d.key === "P" && !d.base ? "數值未收錄" : "", d.onHit ? "觸發攻擊特效" : ""].filter(Boolean);
        if (notes.length) {
            const sub = h(name, "span", "mn-dl-sub");
            for (const n of notes) { const x = h(sub, "span", "", n); if (n === "觸發攻擊特效") x.style.color = "var(--mn-onhit)"; }
        }
        const kind = h(list, "span", "mn-dl-kind", d.kind);
        kind.style.color = DAMAGE_COLOR[d.kind] ?? "inherit";
        h(list, "span", "mn-dl-pct", d.ad ? `${d.ad}%` : "—").style.color = d.ad ? DAMAGE_COLOR["物理"] : "";
        h(list, "span", "mn-dl-pct", d.ap ? `${d.ap}%` : "—").style.color = d.ap ? DAMAGE_COLOR["魔法"] : "";
        h(list, "span", "mn-dl-base", !d.base ? "—" : d.first && d.first !== d.base ? `${num(d.first)}–${num(d.base)}` : `${num(d.base)}`);
    }
    const pair = h(strip, "div", "mn-fs-pair");
    const cell = (label: string) => { const d = h(pair, "div", "mn-fs-c"); h(d, "span", "mn-fs-l", label); return h(d, "div", "mn-fs-r"); };
    h(cell("距離"), "div", "mn-fs-v", reachOf(c) || "—");   // the range number is on the chart's 射程 chip
    const v = h(cell("難度"), "div", "mn-fs-v mn-fs-big", String(c.difficulty));
    h(v, "span", "mn-fs-of", " / 10");
}

// The six axes of the style chart, each with its colour, icon and a short line under it (main damage, how tough, which skills, reach)
interface StyleAxis { label: string; icon: string; color: string; value: number; sub: string; tag?: string }
function styleAxes(c: Champion): StyleAxis[] {
    const tough = c.defense >= 7 ? "很硬" : c.defense >= 4 ? "普通" : "脆";
    return [
        { label: "輸出", icon: "zap", color: DAMAGE_COLOR[c.damageType] ?? "var(--mn-text)", value: Math.max(c.attack, c.magic), sub: c.damageType === "混合" ? "物理 + 魔法" : `${c.damageType}為主` },
        { label: "坦度", icon: "shield", color: "var(--mn-tank)", value: c.defense, sub: tough },
        { label: "控場", icon: "lock", color: "var(--mn-cc)", value: score(count(c, "控場")), sub: keysOf(c, "控場"), tag: "控場" },
        { label: "位移", icon: "arrow-big-right-dash", color: "var(--mn-dash)", value: score(count(c, "位移")), sub: keysOf(c, "位移"), tag: "位移" },
        { label: "輔助", icon: "heart-pulse", color: "var(--mn-heal)", value: score(count(c, "治療", "護盾")), sub: keysOf(c, "治療", "護盾"), tag: "治療" },
        { label: "射程", icon: "target", color: "var(--mn-range)", value: Math.min(10, Math.round(c.range / 65)), sub: [reachOf(c), String(c.range)].filter(Boolean).join(" · ") },
    ];
}

// The style chart: a hexagon whose corners are labelled with coloured chips (icon, name, value, the skills or a hint).
// A corner at zero gets a dashed chip. The shape is tinted with the champion's main damage colour.
const SW = 350, SH = 356, SCX = 175, SCY = 180, SR = 96, CHIP_R = 140;
function styleChart(parent: HTMLElement, c: Champion): void {
    const axes = styleAxes(c);
    const n = axes.length;
    const pt = (i: number, r: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [SCX + r * Math.cos(a), SCY + r * Math.sin(a)]; };
    const poly = (r: (i: number) => number) => axes.map((_, i) => pt(i, r(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
    const val = (i: number) => (SR * Math.max(0, Math.min(10, axes[i].value))) / 10;
    const color = axes[0].color;
    const wrap = h(parent, "div", "mn-sc");
    const root = svg(wrap, "svg", { viewBox: `0 0 ${SW} ${SH}`, "aria-hidden": "true" }, "mn-sc-svg");
    const id = `mn-grad-${++uid}`;
    const grad = svg(svg(root, "defs"), "linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    svg(grad, "stop", { offset: "0%", "stop-opacity": 0.55 }).setAttribute("style", `stop-color:${color}`);
    svg(grad, "stop", { offset: "100%", "stop-opacity": 0.12 }).setAttribute("style", `stop-color:${color}`);
    for (let k = 4; k >= 1; k--) svg(root, "polygon", { points: poly(() => (SR * k) / 4) }, k === 4 ? "mn-sc-ring is-outer" : "mn-sc-ring");
    axes.forEach((ax, i) => {
        const [x, y] = pt(i, SR);
        const line = svg(root, "line", { x1: SCX, y1: SCY, x2: x, y2: y }, "mn-sc-axis" + (ax.value > 0 ? " is-on" : ""));
        line.setAttribute("style", `--p:${ax.color}`);
    });
    const shape = svg(root, "polygon", { points: poly(val), fill: `url(#${id})` }, "mn-sc-shape");
    shape.setAttribute("style", `stroke:color-mix(in srgb, ${color} 55%, white)`);
    axes.forEach((ax, i) => {
        if (ax.value <= 0) return;
        const [x, y] = pt(i, val(i));
        svg(root, "circle", { cx: x, cy: y, r: 4.5 }, "mn-sc-dot").setAttribute("style", `fill:${ax.color}`);
    });
    axes.forEach((ax, i) => {
        const [x, y] = pt(i, CHIP_R);
        const on = ax.value > 0;
        const chip = h(wrap, "button", "mn-scc" + (on ? " is-on" : ""));
        chip.style.left = `${(x / SW) * 100}%`;
        chip.style.top = `${(y / SH) * 100}%`;
        chip.style.setProperty("--p", ax.color);
        const top = h(chip, "span", "mn-scc-t");
        gameIcon(top, ax.label === "輸出" ? (c.damageType === "物理" ? "物理" : "魔法") : ax.tag ?? ax.label, ax.icon, 16);
        h(top, "span", "", ax.label);
        h(top, "b", "", String(ax.value));
        h(chip, "span", "mn-scc-k", on && ax.sub ? ax.sub : "—");
        const t = ax.tag ? TAG.get(ax.tag) : undefined;
        holdTip(chip, t ? `${ax.label} · ${t.abbr}` : `${ax.label} ${ax.value} / 10`);
        chip.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
    });
}

// The 戰鬥風格 card: header with the key and the legend button, the chart, then the tags that are not corners of the chart
const OFF_CHART = TAGS.map((x) => x.tag).filter((x) => !["控場", "位移", "治療", "護盾"].includes(x));   // the chart's corners show the rest
export function styleCard(parent: HTMLElement, c: Champion, app?: App): void {
    const card = h(parent, "div", "mn-panel mn-style");
    const head = h(card, "div", "mn-style-h");
    h(head, "span", "mn-style-t", "戰鬥風格");
    const key = h(head, "button", "mn-lg-btn");   // the key (solid = has it, dashed = not, letters = skills) lives in the legend
    key.setAttribute("aria-label", "圖示說明");
    icon(key, "info");
    if (app) key.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); new TagLegend(app).open(); });
    styleChart(card, c);
    // only the ones it has (with 14 tags, the missing ones would crowd the card)
    if (OFF_CHART.some((x) => hasTag(c, x))) tagRow(h(card, "div", "mn-style-f"), c, OFF_CHART, true);
}

// the whole block of the champion card: the facts strip, then the style card
export function championProfile(parent: HTMLElement, c: Champion, app?: App): void {
    factsStrip(parent, c);
    styleCard(parent, c, app);
}
