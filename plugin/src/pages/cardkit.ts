import type { Champion, Skill } from "../data/store";
import { DAMAGE_COLOR, blurBackdrop, h, icon } from "../ui";
import { tagInfo } from "./profile";
import { demo } from "./skills";

// The card kit: small components (skill head, tag pills, number grid, stat boxes, big number, form columns) and the layout
// templates that say which component goes in which grid area. A card names a template and a skill (`ability Malphite R`); the
// template lays the components out, so every card of a kind has the same structure, colours and icons.
//
//   ability  Champ Key        head · tags · text · numbers per rank with scaling · cooldown / cost / range
//   clip     Champ Key[2]     the ability's clip fills the picture, key + name on top, tags below
//   number   Champ Key        the scaling as one big number, and what it adds up to at a few stat values
//   forms    Champ A B [*B]   two forms side by side, one line of Q / W / E each; * marks the form to look at
//   formset  Champ A B        both forms' ability pictures: the R of each big, its Q W E under it (Jayce-style files: <id>q_melee / _ranged)
export interface CardData { c: Champion; s: Skill; args: string[] }
type Fill = (el: HTMLElement, d: CardData) => void;
interface Layout { areas: string[]; rows: string; fill: Record<string, Fill> }

const AD_EXAMPLES = [0, 100, 200];    // bonus physical attack values a number card works out
const AP_EXAMPLES = [0, 150, 300];    // magic attack values a number card works out
const FORM_ICONS = ["hammer", "crosshair"];
const FORM_ART = "https://raw.communitydragon.org/latest/game/assets/characters";   // <id>/hud/icons2d/<id><key>_melee|ranged.png: the picture of each form's ability
const DAMAGE_ROW = /^(物理|魔法|真實)傷害|^治療|^護盾/;
const SCALING = /\+([\d./]+)%\s*(額外物理攻擊|物理攻擊|魔法攻擊)/;

const kindColor = (s: Skill): string => DAMAGE_COLOR[s.damage[0] ?? ""] ?? "var(--mn-muted)";
const statColor = (stat: string): string => (stat.includes("魔法") ? DAMAGE_COLOR["魔法"] : DAMAGE_COLOR["物理"]);
const lastNum = (v: string): number => parseFloat(v.split("/").pop() ?? "") || 0;

// ---- components
function pill(parent: HTMLElement, label: string, color: string, ic?: string): void {
    const p = h(parent, "span", "mn-ck-pill");
    p.style.setProperty("--c", color);
    if (ic) icon(p, ic);
    h(p, "span", undefined, label);
}
function keyBadge(parent: HTMLElement, key: string, color: string): HTMLElement {
    const k = h(parent, "span", "mn-ck-key", key === "P" ? "被" : key);
    k.style.setProperty("--c", color);
    return k;
}
const head: Fill = (el, { c, s }) => {
    const color = kindColor(s);
    const ic = h(el, "div", "mn-ck-ic");
    ic.style.setProperty("--c", color);
    const im = h(ic, "img"); im.src = s.icon; im.alt = "";
    keyBadge(ic, s.key, color);
    const who = h(el, "div", "mn-ck-who");
    h(who, "div", "mn-ck-kn", `${c.name} · ${s.key === "P" ? "被動" : s.key}`);
    h(who, "div", "mn-ck-name", s.name);
};
const tags: Fill = (el, { s }) => {
    for (const k of s.damage) pill(el, `${k}傷害`, DAMAGE_COLOR[k] ?? "var(--mn-muted)", "flame");
    for (const t of s.tags) { const i = tagInfo(t); pill(el, t, i?.color ?? "var(--mn-muted)", i?.icon); }
};
const desc: Fill = (el, { s }) => { el.textContent = s.desc; };
// damage / heal / shield per rank, each with its scaling as a pill under the numbers
const numbers: Fill = (el, { s }) => {
    const rows = s.rows.filter((r) => DAMAGE_ROW.test(r.label));
    if (!rows.length) return;
    const ranks = Math.max(1, ...rows.map((r) => r.vals.length));
    el.style.setProperty("--r", String(ranks));
    if (ranks > 1) { h(el, "div"); for (let i = 1; i <= ranks; i++) h(el, "div", "mn-ck-h", `${i} 級`); }
    for (const r of rows) {
        const color = DAMAGE_COLOR[r.label.slice(0, 2)] ?? (r.label.startsWith("治療") ? "var(--mn-heal)" : "var(--mn-shield)");
        const name = h(el, "div", "mn-ck-l", r.label);
        name.style.color = color;
        if (r.vals.length === 1) { const v = h(el, "div", "mn-ck-v", r.vals[0]); v.style.gridColumn = `span ${ranks}`; v.style.color = color; }
        else for (const v of r.vals) h(el, "div", "mn-ck-v", v).style.color = color;
        if (r.note) { const sc = h(el, "div", "mn-ck-sc"); sc.style.gridColumn = "1 / -1"; pill(sc, r.note, /魔法/.test(r.note) ? DAMAGE_COLOR["魔法"] : DAMAGE_COLOR["物理"], "sparkles"); }
    }
};
const stats: Fill = (el, { s }) => {
    const val = (re: RegExp) => s.rows.find((r) => re.test(r.label))?.vals.join(" / ");
    const box = (ic: string, v: string | undefined, label: string) => {
        if (!v) return;
        const b = h(el, "div", "mn-ck-stat");
        icon(b, ic);
        h(b, "b", undefined, v);
        h(b, "span", undefined, label);
    };
    box("timer", val(/^冷卻/), "冷卻 秒");
    box("droplet", val(/^消耗/), "消耗");
    box("crosshair", s.range, "射程");
};
// the clip fills the picture area (the whole clip, the room around it is the same clip blurred), with the skill's key and name on top
const media: Fill = (el, { c, s, args }) => {
    const wrap = h(el, "div", "mn-sl-video");
    demo(wrap, c, { key: args.find((a) => /^[PQWER]\d?$/i.test(a))?.toUpperCase() ?? s.key });
    const v = wrap.querySelector("video");
    if (v) blurBackdrop(wrap, v);
    const hud = h(el, "div", "mn-ck-hud");
    keyBadge(hud, s.key, kindColor(s));
    h(hud, "span", "mn-ck-hudn", s.name);
};
// the skill's first damage line: its base at the top rank, and what it scales with
function scaling(s: Skill): { base: number; pct: number; stat: string; color: string } | null {
    const row = s.rows.find((r) => /^(物理|魔法|真實)傷害/.test(r.label));
    if (!row) return null;
    const m = SCALING.exec(row.note);
    if (!m) return null;
    return { base: lastNum(row.vals[row.vals.length - 1]), pct: lastNum(m[1]), stat: m[2], color: statColor(m[2]) };
}
const hero: Fill = (el, { s }) => {
    const sc = scaling(s);
    const color = sc?.color ?? kindColor(s);
    const ring = h(el, "div", "mn-ck-ring"); ring.style.setProperty("--c", color);
    icon(ring, sc?.stat.includes("魔法") ? "sparkles" : "sword");
    const n = h(el, "div", "mn-ck-big", sc ? String(sc.pct) : "—");
    n.style.color = color;
    if (sc) h(n, "small", undefined, "%");
    h(el, "div", "mn-ck-cap", sc ? `${sc.stat}變成傷害` : "這個技能沒有成長數值");
};
const bars: Fill = (el, { s }) => {
    const sc = scaling(s);
    if (!sc) return;
    const examples = sc.stat.includes("魔法") ? AP_EXAMPLES : AD_EXAMPLES;
    const totals = examples.map((v) => sc.base + (sc.pct / 100) * v);
    const top = Math.max(...totals);
    examples.forEach((v, i) => {
        const row = h(el, "div", "mn-ck-bar");
        h(row, "span", undefined, `${v} 點`);
        const tr = h(row, "div", "mn-ck-track");
        h(tr, "i", "mn-ck-b1").style.width = `${(sc.base / top) * 100}%`;
        const b2 = h(tr, "i", "mn-ck-b2"); b2.style.width = `${((totals[i] - sc.base) / top) * 100}%`; b2.style.background = sc.color;
        h(row, "b", undefined, String(Math.round(totals[i])));
    });
    const lg = h(el, "div", "mn-ck-lg");
    const one = h(lg, "span");
    h(one, "i").style.background = "#6e7b92";
    one.append("基本傷害");
    const two = h(lg, "span");
    h(two, "i").style.background = sc.color;
    two.append(`${sc.stat}帶來`);
};
const formsTitle: Fill = (el, { c, args }) => {
    const im = h(el, "img", "mn-ck-sq"); im.src = c.icon; im.alt = "";   // the champion's square picture
    h(el, "span", undefined, `${c.name} · ${args.filter((a) => !a.startsWith("*")).length || 2} 種型態`);
};
// both forms as pictures: each column has its R big, then Q W E under it, every one with its short name
const formSets: Fill = (el, { c, args }) => {
    const names = args.map((a) => a.replace(/^\*/, "")).filter((a) => !/^[PQWER]\d?$/i.test(a));
    const id = c.id.toLowerCase();
    names.forEach((form, i) => {
        const col = h(el, "div", "mn-ck-set");
        const t = h(col, "div", "mn-ck-formh");
        icon(t, FORM_ICONS[i] ?? "shapes");
        h(t, "span", undefined, form);
        const pic = (parent: HTMLElement, key: string, big: boolean) => {
            const s = c.skills.find((x) => x.key === key);
            if (!s) return;
            const cell = h(parent, "div", "mn-ck-cell" + (big ? " is-big" : ""));
            const ic = h(cell, "div", "mn-ck-ic" + (big ? " is-big" : " is-sm"));
            ic.style.setProperty("--c", kindColor(s));
            const im = h(ic, "img"); im.alt = ""; im.src = `${FORM_ART}/${id}/hud/icons2d/${id}${key.toLowerCase()}_${i === 0 ? "melee" : "ranged"}.png`;
            im.addEventListener("error", () => { if (i === 0) im.src = s.icon; else im.remove(); }, { once: true });
            keyBadge(ic, key, kindColor(s));
            h(cell, "span", "mn-ck-cn", s.name.split("／")[i] ?? s.name);
        };
        pic(col, "R", true);
        const row = h(col, "div", "mn-ck-qwe");
        for (const k of ["Q", "W", "E"]) pic(row, k, false);
    });
};
// one column per form; each of Q W E is the part of its text that follows "<form>型態："
const formCols: Fill = (el, { c, args }) => {
    const names = args.map((a) => a.replace(/^\*/, "")).filter((a) => !/^[PQWER]$/i.test(a));
    const on = args.find((a) => a.startsWith("*"))?.slice(1);
    const cut = new RegExp(`(?=(?:${names.join("|")})[^：:，。\\s]{0,3}型態[：:])`);
    names.forEach((form, i) => {
        const col = h(el, "div", "mn-ck-form" + (form === on ? " is-on" : ""));
        const t = h(col, "div", "mn-ck-formh");
        icon(t, FORM_ICONS[i] ?? "shapes");
        h(t, "span", undefined, form);
        for (const key of ["Q", "W", "E"]) {
            const s = c.skills.find((x) => x.key === key);
            const part = s?.desc.split(cut).find((p) => p.startsWith(form));
            if (!part) continue;
            const line = h(col, "div", "mn-ck-fl");
            keyBadge(line, key, s ? kindColor(s) : "var(--mn-muted)");
            h(line, "span", undefined, part.replace(/^[^：:]*[：:]/, "").trim());
        }
    });
};

// ---- the layout templates: grid areas, and which component fills each
const LAYOUTS: Record<string, Layout> = {
    ability: { areas: ["head", "tags", "desc", "numbers", "stats"], rows: "auto auto auto 1fr auto", fill: { head, tags, desc, numbers, stats } },
    clip: { areas: ["media", "tags"], rows: "1fr auto", fill: { media, tags } },
    number: { areas: ["hero", "bars"], rows: "auto 1fr", fill: { hero, bars } },
    forms: { areas: ["formsTitle", "formCols"], rows: "auto 1fr", fill: { formsTitle, formCols } },
    formset: { areas: ["formsTitle", "formSets"], rows: "auto 1fr", fill: { formsTitle, formSets } },
};

// Lays out a card's picture area from a template; false when the champion or skill is not there (the caller shows nothing special)
export function cardKit(box: HTMLElement, kind: string, c: Champion | undefined, args: string[]): boolean {
    const layout = LAYOUTS[kind];
    if (!layout || !c) return false;
    const key = (args.find((a) => /^[PQWER]\d?$/i.test(a)) ?? "Q").toUpperCase();
    const s = c.skills.find((x) => x.key === key.charAt(0));
    if (!s && kind !== "forms" && kind !== "formset") return false;
    const root = h(box, "div", `mn-ck mn-ck-${kind}`);
    root.style.gridTemplateAreas = layout.areas.map((a) => `"${a}"`).join(" ");
    root.style.gridTemplateRows = layout.rows;
    for (const area of layout.areas) {
        const slot = h(root, "div", `mn-ck-slot mn-ck-${area}`);
        slot.style.gridArea = area;
        layout.fill[area](slot, { c, s: s ?? c.skills[0], args });
    }
    return true;
}
