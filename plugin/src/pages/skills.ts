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
        if (s.range) {
            const m = h(detail, "div", "mn-sd-meta");
            const cell = h(m, "div", "mn-sd-cell"); h(cell, "span", "mn-sd-k", "射程"); const rv = h(cell, "span", "mn-sd-v", s.range);
            const rc = changes.find((x) => x.scope === s.key && x.field === "射程");
            if (rc) { rv.style.color = DIR_COLOR[rc.dir]; h(cell, "span", "mn-chg-was", `上版 ${rc.old}`); }
        }
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
    };
}

// Riot's own ability demo (the clip the official champion page plays): <champion key, 4 digits>/ability_<key>_<P|Q|W|E|R>1.mp4/.webm.
// An unofficial but public Riot CDN path, so if a clip is missing or the address changes the video simply does not appear.
const DEMO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities";
function demo(parent: HTMLElement, c: Champion, s: Skill): void {
    if (!c.key) return;
    const key = String(c.key).padStart(4, "0");
    const url = `${DEMO_BASE}/${key}/ability_${key}_${s.key}1`;
    const v = h(parent, "video", "mn-sd-video");
    v.muted = true; v.loop = true; v.autoplay = true; v.controls = true; v.preload = "metadata";
    v.setAttribute("playsinline", "");
    const mp4 = h(v, "source"); mp4.src = `${url}.mp4`; mp4.type = "video/mp4";
    const webm = h(v, "source"); webm.src = `${url}.webm`; webm.type = "video/webm";
    webm.addEventListener("error", () => v.remove());   // neither format loaded
}

const ROW_COLOR: [string, string][] = [["魔法", DAMAGE_COLOR["魔法"]], ["物理", DAMAGE_COLOR["物理"]], ["真實", DAMAGE_COLOR["真實"]], ["治療", "var(--color-green)"], ["護盾", "var(--color-cyan)"]];

// Per-rank numbers as a small grid: one row per damage / heal / shield value, then cooldown and cost.
// A row with one value is the same on every rank and spans the grid; the scaling (+50% 魔法攻擊) sits under the row's name.
function rankTable(parent: HTMLElement, s: Skill, changes: Change[]): void {
    if (!s.rows.length) return;
    const ranks = Math.max(1, ...s.rows.map((r) => r.vals.length));
    const grid = h(parent, "div", "mn-rk");
    grid.style.setProperty("--r", String(ranks));
    if (ranks > 1) {
        h(grid, "div", "mn-rk-h");
        for (let i = 1; i <= ranks; i++) h(grid, "div", "mn-rk-h", String(i));
    }
    for (const r of s.rows) {
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
