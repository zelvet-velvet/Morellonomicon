import { requestUrl } from "obsidian";
import type { Champion, Change, Skill } from "../data/store";
import { DIR_COLOR } from "./changes";
import { DAMAGE_COLOR, blockUntil, chip, h, icon, scalingParts, whenMediaLoaded } from "../ui";
const CLIP_FADE_MS = 350;
const STAGE_DPR = 2;        // the champion page's clip canvas is drawn at most at this pixel density (enough on a phone, half the work of 3x)   // a clip fades in over 0.3 s (styles.css, .mn-app video); its stand-in stays under it that long

// Passive + Q W E R as icons; the frame colour is the damage type of the skill (orange physical, blue magic, yellow true).
// Tap an icon to open its details right below (tap again to close); no new page.
// opt.open: open this skill at once and keep one always open (the champion page's Skills tab); opt.clipFirst: the clip above the
// numbers; opt.scroll false: never scroll the page to the card (the tab already shows it); opt.shelf: a tiny holder on the screen where
// every ability's clip loads ahead (iOS loads a clip only while it is on the screen), so a tap shows a clip that is already there
export interface StripOpts { open?: number; clipFirst?: boolean; scroll?: boolean; shelf?: HTMLElement; barBelow?: boolean }   // barBelow: the P Q W E R bar under the card (the champion page: clip, numbers and text on top, the buttons at the thumb)
export function skillStrip(parent: HTMLElement, c: Champion, changes: Change[] = [], opt: StripOpts = {}): void {
    if (!c.skills.length) return;
    const strip = h(parent, "div", "mn-skills");
    const detail = h(parent, "div", "mn-skill-detail");
    if (opt.barBelow) parent.append(strip);
    let open = -1;
    // The champion page (opt.shelf): every ability's clip loads ahead in the shelf and never leaves it; the clip box shows the playing
    // one on a canvas, frame by frame. iOS draws a <video> on a layer of its own, and a clip moved around the page a few times came out
    // as a smaller hard rectangle that ignored the box's fade and size; a canvas is ordinary drawing, so the fade always holds. The canvas
    // keeps the last frame until the next clip has one, so a switch goes from clip to clip with nothing in between.
    const shelf = opt.shelf;
    const held = new Map<number, HTMLVideoElement>();
    let active: HTMLVideoElement | null = null;
    if (shelf) c.skills.forEach((s, i) => {
        demo(shelf, c, s, () => { held.delete(i); if (open === i) detail.querySelector(".mn-sd-clipbox")?.remove(); });
        const v = shelf.lastElementChild;
        if (!(v instanceof HTMLVideoElement)) return;
        held.set(i, v);
        v.addEventListener("loadeddata", () => { if (v !== active) v.pause(); }, { once: true });   // loaded: it waits, paused, until shown
    });
    let stage: HTMLElement | null = null, canvas: HTMLCanvasElement | null = null, ph: HTMLElement | null = null;
    let painted = false, raf = 0;
    const paint = () => {
        raf = 0;
        if (!stage?.isConnected || !canvas) { active?.pause(); return; }   // the page was left: the clip stops
        const v = active;
        const w = canvas.clientWidth, ht = canvas.clientHeight;
        if (v && v.readyState >= 2 && v.videoWidth && w && ht) {
            const dpr = Math.min(STAGE_DPR, window.devicePixelRatio || 1);
            if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(ht * dpr); }
            const g = canvas.getContext("2d");
            if (g) {   // the clip covers the box (as object-fit: cover), its middle kept
                const k = Math.max(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
                const sw = canvas.width / k, sh = canvas.height / k;
                g.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
                if (!painted) { painted = true; window.setTimeout(() => ph?.remove(), CLIP_FADE_MS); canvas.addClass("is-on"); }
            }
        }
        raf = requestAnimationFrame(paint);
    };
    const stageClip = (i: number, s: Skill): Promise<void> | null => {
        const v = held.get(i);
        if (!v) return null;   // its clip could not play: no box
        if (!stage) { stage = h(null, "div", "mn-sd-clipbox mn-sd-stage"); canvas = h(stage, "canvas", "mn-sd-canvas"); }
        detail.append(stage);
        if (!painted) {   // nothing drawn yet: the skill's own picture, enlarged and blurred, under the canvas
            ph?.remove();
            ph = h(null, "div", "mn-sd-clipph");
            ph.style.backgroundImage = `url("${s.icon}")`;
            stage.prepend(ph);
        }
        if (active && active !== v) active.pause();
        active = v;
        v.currentTime = 0;
        void v.play().catch(() => undefined);
        if (!raf) raf = requestAnimationFrame(paint);
        if (v.readyState >= 2) return Promise.resolve();
        const loaded = new Promise<void>((done) => { v.addEventListener("loadeddata", () => done(), { once: true }); window.setTimeout(done, CLIP_WAIT_MS); });
        if (!painted) blockUntil(stage, loaded);
        return loaded;
    };
    const boxes = c.skills.map((s, i) => {
        const box = h(strip, "button", "mn-skill-box");
        box.setAttribute("aria-label", `${s.key} ${s.name}`);
        const im = h(box, "img"); im.src = s.icon; im.alt = "";
        box.style.setProperty("--chip", DAMAGE_COLOR[s.damage[0] ?? ""] ?? "var(--background-modifier-border)");
        h(box, "span", "mn-skill-k", s.key);
        if (s.upgrade) icon(box, "chevrons-up", "mn-skill-up");   // this skill has an upgrade / evolve effect
        box.addEventListener("click", (e) => { e.preventDefault(); show(open === i && opt.open === undefined ? -1 : i); });
        if (s.key === "P") h(strip, "span", "mn-skill-sep");   // a thin line between the passive and Q W E R
        return box;
    });
    const show = (i: number) => {
        open = i;
        boxes.forEach((b, j) => b.toggleClass("is-on", j === i));
        // the clip on show (with a frame) stays as the new clip's stand-in, so a tapped ability goes from clip to clip, not via a picture
        const shown = detail.querySelector<HTMLVideoElement>(".mn-sd-video");
        const prev = shown && shown.readyState >= 2 ? shown : null;
        prev?.remove();
        detail.empty();
        detail.toggleClass("is-open", i >= 0);
        // the clip that was on show (another strip's own clip, not the champion page's): let go once the new one is in
        let dropped = false;
        const dropPrev = () => {
            if (!prev || dropped) return;
            dropped = true;
            prev.remove(); prev.pause(); prev.removeAttribute("src"); prev.replaceChildren(); prev.load();
        };
        if (i < 0) { dropPrev(); return; }
        const s = c.skills[i];
        const clip = () => {
            if (shelf) return stageClip(i, s);   // the champion page: the canvas over the shelf's clip
            // The clip has its room from the start (a box of the clip's shape) and loads as a block of its own, with the blur and the band
            // of light. A clip that cannot play takes its box away.
            const clipBox = h(detail, "div", "mn-sd-clipbox");
            // something to blur from the first moment, before the clip has a single frame: the clip that was on show, or else the skill's
            // own picture, enlarged and blurred; the clip covers it when it appears (and goes after the clip's own fade-in)
            let stand: HTMLElement;
            if (prev) { stand = prev; clipBox.append(prev); void prev.play().catch(() => undefined); }
            else { stand = h(clipBox, "div", "mn-sd-clipph"); stand.style.backgroundImage = `url("${s.icon}")`; }
            const letGo = () => { if (stand === prev) dropPrev(); else stand.remove(); };
            demo(clipBox, c, s, () => { letGo(); clipBox.remove(); });
            const last = clipBox.lastElementChild;   // demo's new clip, after the stand-in
            const v = last instanceof HTMLVideoElement && last !== prev ? last : null;
            v?.addEventListener("loadeddata", () => window.setTimeout(letGo, CLIP_FADE_MS), { once: true });
            if (!v) { letGo(); clipBox.remove(); return null; }   // no clip for this skill
            const loaded = whenMediaLoaded([clipBox], CLIP_WAIT_MS);
            blockUntil(clipBox, loaded);
            return loaded;
        };
        const early = opt.clipFirst ? clip() : undefined;
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
        const loaded = opt.clipFirst ? early : clip();
        if (opt.scroll === false) return;
        // scroll down to the end of the card (its clip included); a card taller than the screen shows from its top instead. Once at
        // once (the clip box already has its room) and again when the clip is in, in case the card ended up elsewhere
        const reveal = () => {
            if (open !== i || !detail.isConnected) return;   // another skill was opened meanwhile, or the page was left
            const view = detail.closest<HTMLElement>(".mn-scroll");
            const tall = view ? detail.offsetHeight > view.clientHeight - 80 : false;
            detail.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "end" });
        };
        window.requestAnimationFrame(reveal);
        if (loaded) void loaded.then(() => window.requestAnimationFrame(reveal));
    };
    if (opt.open !== undefined) show(Math.max(0, Math.min(opt.open, c.skills.length - 1)));
}

// Riot's own ability demo (the clip the official champion page plays): <champion key, 4 digits>/ability_<key>_<P|Q|W|E|R>1.mp4/.webm.
// An unofficial but public Riot CDN path, so if a clip is missing or the address changes the video simply does not appear.
const DEMO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities";
const CLIP_WAIT_MS = 8000;    // a skill's clip box shows its loading look this long at most before the page scrolls to it anyway
const CLIP_STALL_MS = 5000;   // a downloaded clip that still has no frame after this long is given up
const clipAddress = (c: Champion, key: string): string => {
    const k = String(c.key).padStart(4, "0");
    // "Q" is the ability's first clip; "Q2" the second one (the other form of Jayce, Nidalee, Elise… where Riot made one)
    return `${DEMO_BASE}/${k}/ability_${k}_${/\d$/.test(key) ? key : `${key}1`}`;
};
// Clips downloaded ahead of time (see preloadClip): clip address -> a local address of the whole file, which plays at once. Only the
// last CLIP_CACHE are kept (oldest first out), so browsing many champions does not fill the phone's memory
const CLIP_CACHE = 15;
const downloaded = new Map<string, string>();
const webmOnly = new Set<string>();   // clips Riot has only as WebM: a phone decodes those in software, so only the clip in view should play
const downloading = new Map<string, Promise<void>>();
// Downloads a clip into memory with Obsidian's own request (Riot's server allows no cross-site fetch from a page), so the card that
// uses it later has the whole file already. Does nothing for a clip already fetched; a clip that cannot be fetched is skipped.
export function preloadClip(c: Champion, key: string): Promise<void> {
    if (!c.key) return Promise.resolve();
    const url = clipAddress(c, key);
    const have = downloading.get(url);
    if (have) return have;
    const job = (async () => {
        for (const ext of ["mp4", "webm"]) {
            try {
                const r = await requestUrl({ url: `${url}.${ext}`, throw: false });
                if (r.status === 200) {
                    if (ext === "webm") webmOnly.add(url);
                    downloaded.set(url, URL.createObjectURL(new Blob([r.arrayBuffer], { type: `video/${ext}` })));
                    for (const [old, local] of downloaded) {
                        if (downloaded.size <= CLIP_CACHE) break;
                        URL.revokeObjectURL(local); downloaded.delete(old); downloading.delete(old);
                    }
                    return;
                }
            } catch { /* try the next format */ }
        }
    })();
    downloading.set(url, job);
    return job;
}
export function demo(parent: HTMLElement, c: Champion, s: { key: string; seconds?: [number, number][] }, onFail?: () => void): void {
    if (!c.key) return;
    const url = clipAddress(c, s.key);
    const v = h(parent, "video", "mn-sd-video");
    // a silent looping clip, no player controls (no play / pause, seek, full screen or picture-in-picture buttons)
    v.muted = true; v.loop = true; v.autoplay = true; v.controls = false; v.preload = "auto";
    v.setAttribute("playsinline", "");
    v.setAttribute("disablepictureinpicture", "");
    v.setAttribute("disableremoteplayback", "");
    const fail = () => { v.remove(); onFail?.(); };
    // only the important parts of a long clip: each [start, end] piece in turn, then back to the first, so the rest (a fast-forward,
    // a long wait) is never shown (the file is still downloaded whole; a clip cannot be cut without re-encoding it)
    const parts = s.seconds?.length ? s.seconds : undefined;
    if (parts) {
        let at = 0;
        v.loop = false;
        v.addEventListener("loadedmetadata", () => { v.currentTime = parts[0][0]; });
        const guard = window.setInterval(() => {
            if (!v.isConnected) { window.clearInterval(guard); return; }
            if (v.currentTime >= parts[at][1] || v.ended) {
                at = (at + 1) % parts.length;
                v.currentTime = parts[at][0];
                if (v.paused) void v.play().catch(() => undefined);
            }
        }, 60);
    }
    // the whole file, played from memory: for a clip already downloaded, and the way out for a clip that does not stream
    const playLocal = (local: string) => {
        v.replaceChildren();
        if (webmOnly.has(url)) v.dataset.heavy = "1";
        v.addEventListener("error", fail, { once: true });
        v.src = local;
        v.load();
        void v.play().catch(() => undefined);
    };
    const local = downloaded.get(url);
    if (local) { playLocal(local); return; }
    v.addEventListener("loadeddata", () => { void v.play().catch(() => undefined); }, { once: true });
    // Some champions (Pyke…) have only a WebM clip, which Riot's server labels as plain text; a phone refuses to stream that.
    // Downloading the file and playing it as a video makes the format known, so when neither source streams that is tried before giving up.
    let tried = false;
    const fallback = () => {
        if (tried) return;
        tried = true;
        // a device that cannot decode WebM at all would only stall: show the skill picture at once instead
        if (!document.createElement("video").canPlayType("video/webm")) { fail(); return; }
        void preloadClip(c, s.key).then(() => {
            const f = downloaded.get(url);
            if (!f) { fail(); return; }
            playLocal(f);
            window.setTimeout(() => { if (v.isConnected && v.readyState < 2) fail(); }, CLIP_STALL_MS);   // loaded but never shows a frame: give up
        });
    };
    const mp4 = h(v, "source"); mp4.src = `${url}.mp4`; mp4.type = "video/mp4";
    const webm = h(v, "source"); webm.src = `${url}.webm`; webm.type = "video/webm";
    mp4.addEventListener("error", fallback);
    webm.addEventListener("error", fallback);
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
export function rankTable(parent: HTMLElement, s: Skill, changes: Change[]): void {
    // range is the last row (one value spans the grid, or one per rank)
    const rows = s.range ? [...s.rows, { label: "射程", vals: s.range.split("/"), note: "" }] : s.rows;
    if (!rows.length) return;
    const ranks = Math.max(1, ...rows.map((r) => r.vals.length));
    const grid = h(parent, "div", "mn-rk");
    grid.style.setProperty("--r", String(ranks));
    if (ranks > 1) {
        h(grid, "div", "mn-rk-h");
        for (let i = 1; i <= ranks; i++) h(grid, "div", "mn-rk-h", s.levels[i - 1] ? `Lv${s.levels[i - 1]}` : String(i));   // a passive: champion levels
    }
    for (const r of rows) {
        const name = h(grid, "div", "mn-rk-l");
        const label = h(name, "span", "mn-rk-name", r.label);
        const color = ROW_COLOR.find(([k]) => r.label.startsWith(k))?.[1];
        if (color) label.style.color = color;
        if (r.note) {   // each stat it scales with in that stat's colour
            const note = h(name, "span", "mn-rk-note");
            for (const p of scalingParts(r.note)) h(note, "span", undefined, p.text).style.color = p.color;
        }
        // changed since the last patch: the numbers take the colour (green = better for the player) and the old value is shown under the name
        const ch = changes.find((x) => r.label.startsWith(x.field));
        if (ch) h(name, "span", "mn-chg-was", `上版 ${ch.old}`);
        const tint = (el: HTMLElement) => { if (ch) el.style.color = DIR_COLOR[ch.dir]; };
        if (r.vals.length === 1) { const v = h(grid, "div", "mn-rk-v mn-rk-all", r.vals[0]); v.style.gridColumn = `span ${ranks}`; tint(v); }
        else for (const v of r.vals) tint(h(grid, "div", "mn-rk-v", v));
    }
}
