import type { Champion, Change, Skill } from "../data/store";
import { DIR_COLOR } from "./changes";
import { DAMAGE_COLOR, chip, h, icon } from "../ui";

// Passive + Q W E R as icons; the frame colour is the damage type of the skill (orange physical, blue magic, yellow true).
// Tap an icon to open its details right below (tap again to close); no new page.
export function skillStrip(parent: HTMLElement, c: Champion, changes: Change[] = []): void {
    if (!c.skills.length) return;
    const strip = h(parent, "div", "mn-skills");
    const detail = h(parent, "div", "mn-skill-detail");
    let open = -1;
    const boxes = c.skills.map((s, i) => {
        const box = h(strip, "button", "mn-skill-box");
        box.setAttribute("aria-label", `${s.key} ${s.name}`);
        const im = h(box, "img"); im.src = s.icon; im.alt = "";
        box.style.setProperty("--chip", DAMAGE_COLOR[s.damage[0] ?? ""] ?? "var(--background-modifier-border)");
        h(box, "span", "mn-skill-k", s.key);
        if (s.upgrade) icon(box, "chevrons-up", "mn-skill-up");   // this skill has an upgrade / evolve effect
        box.addEventListener("click", (e) => { e.preventDefault(); show(open === i ? -1 : i); });
        if (s.key === "P") h(strip, "span", "mn-skill-sep");   // a thin line between the passive and Q W E R
        return box;
    });
    const show = (i: number) => {
        open = i;
        boxes.forEach((b, j) => b.toggleClass("is-on", j === i));
        detail.empty();
        detail.toggleClass("is-open", i >= 0);
        if (i < 0) return;
        const s = c.skills[i];
        const head = h(detail, "div", "mn-sd-head");
        h(head, "span", "mn-sd-key", s.key);
        h(head, "span", "mn-sd-name", s.name);
        const types = h(head, "span", "mn-sd-types");
        for (const d of s.damage) chip(types, `${d}傷害`, { color: DAMAGE_COLOR[d] });
        if (s.tags.includes("攻擊特效")) chip(types, "觸發攻擊特效", { color: "var(--mn-onhit)" });
        // what kind of crowd control / weakening, read from the skill's text (控場 · 擊飛、暈眩)
        const text = s.desc + s.upgrade;
        for (const [label, color, words] of EFFECT_WORDS) {
            const found = [...new Set(words.filter(([re]) => re.test(text)).map(([, name]) => name))];
            if (found.length) chip(types, `${label} · ${found.join("、")}`, { color });
        }   // hand-set `onhit` in the champion note
        rankTable(detail, s, changes.filter((x) => x.scope === s.key));
        if (s.desc) h(detail, "p", "mn-sd-desc", s.desc);
        if (s.upgrade) {
            const up = h(detail, "div", "mn-sd-up");
            const t = h(up, "div", "mn-sd-up-t");
            icon(t, "chevrons-up", "mn-sd-up-ic");
            h(t, "span", "", "進化 / 升級");
            h(up, "p", "mn-sd-desc", s.upgrade);
        }
        demo(detail, c, s);
        // scroll down to the end of the card (its clip included); a card taller than the screen shows from its top instead
        const reveal = () => {
            const view = detail.closest<HTMLElement>(".mn-scroll");
            const tall = view ? detail.offsetHeight > view.clientHeight - 80 : false;
            detail.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "end" });
        };
        window.requestAnimationFrame(reveal);
        detail.querySelector("video")?.addEventListener("loadedmetadata", reveal, { once: true });   // the clip adds its height once it knows its size
    };
}

// Riot's own ability demo (the clip the official champion page plays): <champion key, 4 digits>/ability_<key>_<P|Q|W|E|R>1.mp4/.webm.
// An unofficial but public Riot CDN path, so if a clip is missing or the address changes the video simply does not appear.
const DEMO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities";
export function demo(parent: HTMLElement, c: Champion, s: { key: string }): void {
    if (!c.key) return;
    const key = String(c.key).padStart(4, "0");
    const url = `${DEMO_BASE}/${key}/ability_${key}_${s.key}1`;
    const v = h(parent, "video", "mn-sd-video");
    // a silent looping clip, no player controls (no play / pause, seek, full screen or picture-in-picture buttons)
    v.muted = true; v.loop = true; v.autoplay = true; v.controls = false; v.preload = "auto";
    v.setAttribute("playsinline", "");
    v.setAttribute("disablepictureinpicture", "");
    v.setAttribute("disableremoteplayback", "");
    v.addEventListener("loadeddata", () => { void v.play().catch(() => undefined); }, { once: true });
    const mp4 = h(v, "source"); mp4.src = `${url}.mp4`; mp4.type = "video/mp4";
    const webm = h(v, "source"); webm.src = `${url}.webm`; webm.type = "video/webm";
    webm.addEventListener("error", () => v.remove());   // neither format loaded
}

// Kinds of crowd control and weakening, by the words Riot's zh_TW text uses
const EFFECT_WORDS: [string, string, [RegExp, string][]][] = [
    ["控場", "var(--mn-cc)", [[/暈眩|眩暈|擊暈/, "暈眩"], [/擊飛|擊倒/, "擊飛"], [/擊退/, "擊退"], [/定身|禁錮|束縛/, "定身"], [/沉默/, "沉默"], [/恐懼/, "恐懼"],
        [/魅惑/, "魅惑"], [/嘲諷/, "嘲諷"], [/睡眠/, "睡眠"], [/壓制/, "壓制"], [/變形/, "變形"], [/牽引|拉向/, "拉扯"]]],
    ["減益", "var(--mn-weak)", [[/致盲/, "致盲"], [/近視|(降低|減少|縮小)[^。]{0,4}(視線|視野)/, "近視"], [/重傷/, "重傷"],
        [/(降低|減少|削減)[^。]{0,8}(護甲|魔法防禦|魔抗|物理防禦)|破甲/, "降防"], [/(降低|減少|削減)[^。]{0,8}(攻速|攻擊速度)/, "降攻速"]]],
];

const ROW_COLOR: [string, string][] = [["魔法", DAMAGE_COLOR["魔法"]], ["物理", DAMAGE_COLOR["物理"]], ["真實", DAMAGE_COLOR["真實"]], ["治療", "var(--color-green)"], ["護盾", "var(--color-cyan)"]];

// Per-rank numbers as a small grid: one row per damage / heal / shield value, then cooldown and cost.
// A row with one value is the same on every rank and spans the grid; the scaling (+50% 魔法攻擊) sits under the row's name.
function rankTable(parent: HTMLElement, s: Skill, changes: Change[]): void {
    // range is the last row (one value spans the grid, or one per rank)
    const rows = s.range ? [...s.rows, { label: "射程", vals: s.range.split("/"), note: "" }] : s.rows;
    if (!rows.length) return;
    const ranks = Math.max(1, ...rows.map((r) => r.vals.length));
    const grid = h(parent, "div", "mn-rk");
    grid.style.setProperty("--r", String(ranks));
    if (ranks > 1) {
        h(grid, "div", "mn-rk-h");
        for (let i = 1; i <= ranks; i++) h(grid, "div", "mn-rk-h", String(i));
    }
    for (const r of rows) {
        const name = h(grid, "div", "mn-rk-l");
        const label = h(name, "span", "mn-rk-name", r.label);
        const color = ROW_COLOR.find(([k]) => r.label.startsWith(k))?.[1];
        if (color) label.style.color = color;
        if (r.note) h(name, "span", "mn-rk-note", r.note);
        // changed since the last patch: the numbers take the colour (green = better for the player) and the old value is shown under the name
        const ch = changes.find((x) => r.label.startsWith(x.field));
        if (ch) h(name, "span", "mn-chg-was", `上版 ${ch.old}`);
        const tint = (el: HTMLElement) => { if (ch) el.style.color = DIR_COLOR[ch.dir]; };
        if (r.vals.length === 1) { const v = h(grid, "div", "mn-rk-v mn-rk-all", r.vals[0]); v.style.gridColumn = `span ${ranks}`; tint(v); }
        else for (const v of r.vals) tint(h(grid, "div", "mn-rk-v", v));
    }
}
