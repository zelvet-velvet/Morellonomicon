import type { Champion, Skill } from "../data/store";
import { DAMAGE_COLOR, DAMAGE_ICON, h, icon, scalingParts } from "../ui";
import { tagInfo } from "./profile";
import { demo } from "./skills";

// The card kit: small components (skill head, tag pills, number grid, stat boxes, level bars, form columns) and the layout
// templates that say which component goes in which grid area. A card names a template and a skill (`ability Malphite R`); the
// template lays the components out, so every card of a kind has the same structure, colours and icons.
//
//   ability  Champ Key        head · tags · text · numbers per rank with scaling · cooldown / cost / range
//   clip     Champ Key[2] [a-b]   the ability's clip fills the picture (cut to where the champion stands), key + name on top, tags on its lower edge; a-b = play only seconds a to b; a-b+c-d = those pieces in turn (skips what lies between, e.g. a fast-forward)
//   levels   Champ Key [n]    per rank (R: Lv 6 / 11 / 16) two bars: the rank's own damage, and with n of the stat it scales with added
//   forms    Champ A B [*B]   two forms side by side, one line of Q / W / E each; * marks the form to look at
//   combo    Champ A B *B K1 K2 [= word word]   the clips of K1 then K2 play one after the other, big, with K1 → K2 as pictures and the result chips on the picture's lower edge (A B *B pick the form's art)
//   formset  Champ A B        both forms' ability pictures: the R of each big, its Q W E under it (Jayce-style files: <id>q_melee / _ranged)
export interface CardData { c: Champion; s: Skill; args: string[] }
type Fill = (el: HTMLElement, d: CardData) => void;
interface Layout { areas: string[]; rows: string; fill: Record<string, Fill> }

const LEVELS_STAT = { ap: 300, ad: 200 };   // the stat a levels card adds when the note gives none: a built-up AP or AD build
const ULT_LEVELS = [6, 11, 16];       // the champion levels an ultimate's ranks open at
const FORM_ICONS = ["hammer", "crosshair"];
const FORM_ART = "https://raw.communitydragon.org/latest/game/assets/characters";   // <id>/hud/icons2d/<id><key>_melee|ranged.png: the picture of each form's ability
const DAMAGE_ROW = /^(物理|魔法|真實)傷害|^治療|^護盾/;
const SCALING = /\+([\d./]+)%\s*(額外物理攻擊|物理攻擊|魔法攻擊)/;

const NEUTRAL = "#6b7183";   // a skill with no damage (most passives): dark enough for the white key letter (被) on it
const kindColor = (s: Skill): string => DAMAGE_COLOR[s.damage[0] ?? ""] ?? NEUTRAL;
const statColor = (stat: string): string => (stat.includes("魔法") ? DAMAGE_COLOR["魔法"] : DAMAGE_COLOR["物理"]);
const lastNum = (v: string): number => parseFloat(v.split("/").pop() ?? "") || 0;

// ---- components
function pill(parent: HTMLElement, label: string, color: string, ic?: string): void {
    const p = h(parent, "span", "mn-ck-pill");
    p.style.setProperty("--c", color);
    if (ic) icon(p, ic);
    h(p, "span", undefined, label);
}
// The key letter's offset that puts its ink (not its line box) in the middle of the badge, measured in the badge's own font:
// capitals sit high in a line box and 被 low, by an amount that differs per font, so no fixed nudge is right everywhere
let measure: CanvasRenderingContext2D | null = null;
function centreInk(letter: HTMLElement): void {
    if (!letter.isConnected) return;
    measure ??= document.createElement("canvas").getContext("2d");
    if (!measure) return;
    const cs = getComputedStyle(letter);
    measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = measure.measureText(letter.textContent ?? "");
    // with line-height 1 the letter's box is the font size tall and its baseline sits (ascent - descent) / 2 below the box's middle;
    // the ink's middle is (ink ascent - ink descent) / 2 above the baseline: move the letter by the difference
    const box = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    const ink = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    if (Number.isFinite(ink) && Number.isFinite(box)) letter.style.setProperty("--dy", `${(ink - box).toFixed(2)}px`);
}
function keyBadge(parent: HTMLElement, key: string, color: string): HTMLElement {
    const k = h(parent, "span", "mn-ck-key" + (key === "P" ? " is-zh" : ""));   // is-zh: a Chinese character, sized to match the capitals
    const letter = h(k, "span", undefined, key === "P" ? "被" : key);
    k.style.setProperty("--c", color);
    requestAnimationFrame(() => centreInk(letter));
    void document.fonts?.ready.then(() => centreInk(letter));
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
    for (const k of s.damage) pill(el, `${k}傷害`, DAMAGE_COLOR[k] ?? NEUTRAL, DAMAGE_ICON[k] ?? "flame");
    for (const t of s.tags) { const i = tagInfo(t); pill(el, t, i?.color ?? "var(--mn-muted)", i?.icon); }
};
const desc: Fill = (el, { s }) => { el.textContent = s.desc; };
// damage / heal / shield per rank, each with its scaling as a pill under the numbers
const numbers: Fill = (el, { s }) => {
    const rows = s.rows.filter((r) => DAMAGE_ROW.test(r.label));
    if (!rows.length) return;
    const ranks = Math.max(1, ...rows.map((r) => r.vals.length));
    el.style.setProperty("--r", String(ranks));
    if (ranks > 1) { h(el, "div"); for (let i = 1; i <= ranks; i++) h(el, "div", "mn-ck-h", s.levels[i - 1] ? `Lv ${s.levels[i - 1]}` : `${i} 級`); }
    for (const r of rows) {
        const color = DAMAGE_COLOR[r.label.slice(0, 2)] ?? (r.label.startsWith("治療") ? "var(--mn-heal)" : "var(--mn-shield)");
        const name = h(el, "div", "mn-ck-l", r.label);
        name.style.color = color;
        if (r.vals.length === 1) { const v = h(el, "div", "mn-ck-v", r.vals[0]); v.style.gridColumn = `span ${ranks}`; v.style.color = color; }
        else for (const v of r.vals) h(el, "div", "mn-ck-v", v).style.color = color;
        if (r.note) {   // one pill per stat it scales with, each in that stat's colour
            const sc = h(el, "div", "mn-ck-sc"); sc.style.gridColumn = "1 / -1";
            for (const p of scalingParts(r.note)) pill(sc, p.text, p.color, p.icon);
        }
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
// the whole clip at its own shape, centred in the picture area on the card's own background, with the skill's key and name on top
const media: Fill = (el, { c, s, args }) => {
    const wrap = h(el, "div", "mn-sl-video");
    // "0-4.5": only those seconds of the clip; "0-2.4+3.8-6": those pieces in turn, skipping what lies between them
    const spec = args.find((a) => /^\d+(?:\.\d+)?-\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?-\d+(?:\.\d+)?)*$/.test(a));
    const seconds = spec?.split("+").map((p) => p.split("-").map(Number) as [number, number]);
    demo(wrap, c, { key: args.find((a) => /^[PQWER]\d?$/i.test(a))?.toUpperCase() ?? s.key, seconds }, () => {
        // the clip cannot play on this device: the skill's picture takes its place
        const im = h(wrap, "img", "mn-ck-failic"); im.src = s.icon; im.alt = "";
    });
    tags(h(wrap, "div", "mn-ck-onclip"), { c, s, args });   // the tags sit on the picture, just above the words
    const hud = h(wrap, "div", "mn-ck-hud");
    keyBadge(hud, s.key, kindColor(s));
    h(hud, "span", "mn-ck-hudn", s.name);
};
// per rank two bars on one scale: the rank's own damage (grey), and the same with the stat added (its colour, the added part labelled)
const levelBars: Fill = (el, { s, args }) => {
    const row = s.rows.find((r) => /^(物理|魔法|真實)傷害/.test(r.label));
    const m = row ? SCALING.exec(row.note) : null;
    if (!row || !m) return;
    const pct = lastNum(m[1]), stat = m[2], color = statColor(stat);
    const amount = Number(args.find((a) => /^\d+$/.test(a))) || (stat.includes("魔法") ? LEVELS_STAT.ap : LEVELS_STAT.ad);
    const bonus = Math.round((pct / 100) * amount);
    const bases = row.vals.map((v) => lastNum(v));
    const top = Math.max(...bases) + bonus;
    bases.forEach((base, i) => {
        const r = h(el, "div", "mn-ck-lv");
        const lab = h(r, "div", "mn-ck-lvk");
        h(lab, "b", undefined, `${i + 1} 級`);
        if (s.key === "R" && ULT_LEVELS[i]) h(lab, "span", undefined, `Lv ${ULT_LEVELS[i]}`);
        const pair = h(r, "div", "mn-ck-lvp");
        const one = (withStat: boolean) => {
            const line = h(pair, "div", "mn-ck-lvl");
            const tr = h(line, "div", "mn-ck-track");
            h(tr, "i", "mn-ck-b1", withStat ? "" : String(base)).style.width = `${(base / top) * 100}%`;
            if (withStat) { const b2 = h(tr, "i", "mn-ck-b2", `+${bonus}`); b2.style.width = `${(bonus / top) * 100}%`; b2.style.background = color; }
            h(line, "b", undefined, String(base + (withStat ? bonus : 0)));
        };
        one(false);
        one(true);
    });
    const lg = h(el, "div", "mn-ck-lg");
    const a = h(lg, "span"); h(a, "i").style.background = "#6e7b92"; a.append("技能等級給的");   // the same grey as .mn-ck-b1
    const b = h(lg, "span"); h(b, "i").style.background = color; b.append(`${amount} ${stat.replace("攻擊", "攻")}多給的`);
};
const formsTitle: Fill = (el, { c, args }) => {
    const im = h(el, "img", "mn-ck-sq"); im.src = c.icon; im.alt = "";   // the champion's square picture
    h(el, "span", undefined, `${c.name} · ${args.filter((a) => !/^[PQWER]\d?$/i.test(a)).length || 2} 種型態`);
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
// the words after "=" on a combo card, each with a picture: what the combo gives you
const RESULT_ICON: [RegExp, string][] = [[/快|速/, "zap"], [/遠|長/, "move-horizontal"], [/痛|傷|強/, "flame"], [/穩|盾/, "shield"]];
// a combo of one form: its two abilities as pictures with a step number and an arrow, no sentences
const beforeEquals = (args: string[]): string[] => (args.includes("=") ? args.slice(0, args.indexOf("=")) : args);
// the combo's clips one after the other (Riot has one clip per ability, none for a combo), big and cut to the middle where the
// champion is; the steps and the result sit on the lower edge of the picture
const comboMedia: Fill = (el, { c, args }) => {
    const keys = beforeEquals(args).filter((a) => /^[PQWER]\d?$/i.test(a)).map((a) => a.toUpperCase());
    const wrap = h(el, "div", "mn-sl-video");
    const reels = keys.map((key) => {
        const box = h(wrap, "div", "mn-ck-reel");
        demo(box, c, { key });
        return box;
    });
    let now = 0;
    const show = (i: number) => {
        now = i;
        reels.forEach((box, n) => { box.classList.toggle("is-on", n === i); if (n !== i) box.querySelector("video")?.pause(); });
        const v = reels[i]?.querySelector("video");
        if (v) { v.currentTime = 0; void v.play().catch(() => undefined); }
    };
    reels.forEach((box, i) => {
        const v = box.querySelector("video");
        if (!v || reels.length < 2) return;
        v.loop = false;
        v.addEventListener("ended", () => { if (now === i) show((i + 1) % reels.length); });
        v.addEventListener("play", () => { if (now !== i) v.pause(); });
    });
    reels[0]?.classList.add("is-on");
    comboFlow(h(wrap, "div", "mn-ck-comboFlow"), { c, s: c.skills[0], args });
};
const comboFlow: Fill = (el, { c, args }) => {
    const spec = beforeEquals(args);
    const names = spec.filter((a) => !/^[PQWER]\d?$/i.test(a)).map((a) => a.replace(/^\*/, ""));
    const form = Math.max(0, names.indexOf(spec.find((a) => a.startsWith("*"))?.slice(1) ?? ""));
    const keys = spec.filter((a) => /^[PQWER]\d?$/i.test(a)).map((a) => a.toUpperCase());
    const id = c.id.toLowerCase();
    keys.forEach((key, i) => {
        if (i) icon(el, "arrow-right", "mn-ck-arrow");
        const s = c.skills.find((x) => x.key === key.charAt(0));
        if (!s) return;
        const cell = h(el, "div", "mn-ck-cell is-step");
        const ic = h(cell, "div", "mn-ck-ic is-huge");
        ic.style.setProperty("--c", kindColor(s));
        const im = h(ic, "img"); im.alt = ""; im.src = `${FORM_ART}/${id}/hud/icons2d/${id}${key.toLowerCase()}_${form === 0 ? "melee" : "ranged"}.png`;
        im.addEventListener("error", () => { im.src = s.icon; }, { once: true });
        keyBadge(ic, key, kindColor(s));
        h(ic, "span", "mn-ck-step", String(i + 1));
        h(cell, "span", "mn-ck-cn", s.name.split("／")[form] ?? s.name);
    });
    const at = args.indexOf("=");
    if (at < 0) return;
    const chips = h(el, "div", "mn-ck-comboChips");
    for (const w of args.slice(at + 1)) pill(chips, w, "#f0b074", RESULT_ICON.find(([re]) => re.test(w))?.[1] ?? "sparkles");
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
    ability: { areas: ["head", "tags", "desc", "numbers", "stats"], rows: "auto auto auto auto auto", fill: { head, tags, desc, numbers, stats } },
    clip: { areas: ["media"], rows: "1fr", fill: { media } },
    levels: { areas: ["head", "levelBars"], rows: "auto auto", fill: { head, levelBars } },
    forms: { areas: ["formsTitle", "formCols"], rows: "auto auto", fill: { formsTitle, formCols } },
    combo: { areas: ["comboMedia"], rows: "1fr", fill: { comboMedia } },
    formset: { areas: ["formsTitle", "formSets"], rows: "auto auto", fill: { formsTitle, formSets } },
};

// Lays out a card's picture area from a template; false when the champion or skill is not there (the caller shows nothing special)
export function cardKit(box: HTMLElement, kind: string, c: Champion | undefined, args: string[]): boolean {
    const layout = LAYOUTS[kind];
    if (!layout || !c) return false;
    const key = (args.find((a) => /^[PQWER]\d?$/i.test(a)) ?? "Q").toUpperCase();
    const s = c.skills.find((x) => x.key === key.charAt(0));
    if (!s && kind !== "forms" && kind !== "formset" && kind !== "combo") return false;
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
