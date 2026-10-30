import { MarkdownPostProcessorContext, Notice, TFile } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { MODES, TAB_ICON, TAB_LABEL } from "./modes";
import { icon } from "./ui";

// Dev Tools/Layouts.md is a layout editor: a ```mn-layout block holds every page of the app as a phone with colour-coded blocks
// (JSON, one page per line, so a change reads well in git). It is drawn as phones side by side; a block can be dragged to move it,
// its corner dragged to resize it, and tapped to rename it, change its kind, write a note or delete it; pages can be added, renamed and
// removed. Each page keeps its own steps (back / forward), can be reset to what is saved, and is written into the note with its save
// button, so Claude reads the exact layout from the repo. Unsaved pages survive the note being redrawn (they live in memory until saved).
const W = 390, H = 844;          // the phone, in CSS px (an iPhone 14)
const SCALE = 0.78;              // drawn at this size
const SNAP = 2;                  // px the blocks snap to
const MARGIN = 16;               // the side margins (Design Rules)
const TABBAR = 64;               // the app's tab bar at the bottom of every page (drawn, not a block)
const STATUS = 47;               // the phone's status bar with the notch at the top (drawn, not a block)
const CARRIER = "中華電信";
const SEP = " · ";               // a page's group and its own name (Home · linked)
export const KINDS: Record<string, { color: string; name: string }> = {
    hero: { color: "#8fb4ee", name: "hero / picture" }, nav: { color: "#9aa3b8", name: "title / nav" }, entry: { color: "#7fd9ad", name: "entries / buttons" },
    list: { color: "#f0cd7a", name: "list / grid" }, info: { color: "#cba8f5", name: "info / stats" }, action: { color: "#f08ab8", name: "input / action" },
    float: { color: "#73bbb2", name: "floating" },
};
const LAYER: Record<string, number> = { hero: 0, float: 3 };   // the rest are 1
const SYNCED = "mn-layout-synced";   // the note's copy of the layout as Claude last synced it: changed pages are marked against it
interface Block { id: string; label: string; kind: string; x: number; y: number; w: number; h: number; note?: string }
interface Page { id: string; name: string; note?: string; tabbar?: boolean; mock?: boolean; blocks: Block[] }   // mock: a proposal by Claude, not built yet (a light blue frame)

// each page's unsaved state and steps, by note and page id: kept here so a redraw of the note (after a save) does not lose them
interface Steps { past: string[]; future: string[]; last: string }
const memory = new Map<string, Map<string, Steps>>();
const winAt = new Map<string, { x: number; y: number }>();   // where a page's block window was dragged to (kept across redraws)
type Metric = "top" | "left" | "right" | "bottom" | "w" | "h";
let metricAt: Metric = "left";   // the number chosen in the box diagram (kept across redraws)
const STEP = 4;                  // px a − / + tap moves (Design Rules: 4 px steps)
const REPEAT_MS = 110;           // a held − / + repeats this often
const uid = () => Math.random().toString(36).slice(2, 8);
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function parse(source: string): Page[] {
    try { const v = JSON.parse(source || "[]") as Page[]; return Array.isArray(v) ? v : []; } catch { return []; }
}
const serialise = (pages: Page[]) => "[\n" + pages.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]";

function layoutBlock(plugin: MorellonomiconPlugin, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const saved = parse(source);
    const steps = memory.get(ctx.sourcePath) ?? new Map<string, Steps>();
    memory.set(ctx.sourcePath, steps);
    // what is shown: each saved page, or its unsaved state; then pages added but not saved yet
    const pages: Page[] = saved.map((p) => (steps.has(p.id) ? (JSON.parse(steps.get(p.id)!.last) as Page) : p));
    for (const [id, s] of steps) if (!saved.some((p) => p.id === id)) pages.push(JSON.parse(s.last) as Page);
    const info = ctx.getSectionInfo(el);
    const root = el.createDiv({ cls: "mn-lay" });
    if (source.trim() && !saved.length) { root.createDiv({ cls: "mn-lay-err", text: "The layout data could not be read (JSON). Fix it in the source view." }); return; }
    // the saved pages are written into the note (the lines between the fences)
    const write = (list: Page[]) => {
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!info || !(file instanceof TFile)) { new Notice("Could not save the layout"); return; }
        void plugin.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...serialise(list).split("\n"));
            return lines.join("\n");
        });
    };
    // the layout as last synced, from the note's mn-layout-synced block: a page that differs is marked as changed
    let synced = new Map<string, string>();
    const file0 = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (file0 instanceof TFile) void plugin.app.vault.cachedRead(file0).then((text) => {
        const m = new RegExp("```" + SYNCED + "\\n([\\s\\S]*?)\\n```").exec(text);
        synced = new Map(parse(m?.[1] ?? "").map((p) => [p.id, JSON.stringify(p)]));
        draw();
    });
    const changedSinceSync = (page: Page) => synced.size > 0 && synced.get(page.id) !== savedJson(page.id);
    const savedJson = (id: string) => { const p = saved.find((x) => x.id === id); return p ? JSON.stringify(p) : ""; };
    const stepsOf = (page: Page): Steps => {
        let s = steps.get(page.id);
        if (!s) { s = { past: [], future: [], last: savedJson(page.id) || JSON.stringify(page) }; steps.set(page.id, s); }
        return s;
    };
    // after any change to a page: the state before it becomes a step back
    const changed = (page: Page) => {
        const s = stepsOf(page), now = JSON.stringify(page);
        if (now === s.last) return;
        s.past.push(s.last); s.last = now; s.future = [];
    };
    const goTo = (page: Page, json: string) => { const v = JSON.parse(json) as Page; Object.assign(page, v); if (!page.note) delete page.note; if (!v.mock) delete page.mock; selected = null; draw(); };
    const dirty = (page: Page) => (steps.get(page.id)?.last ?? JSON.stringify(page)) !== savedJson(page.id);
    // save one page: the note gets this page as it is now, the other pages as they were saved
    const savePage = (page: Page) => {
        const list = saved.map((p) => (p.id === page.id ? page : p));
        if (!saved.some((p) => p.id === page.id)) list.push(page);
        write(list);
    };
    // a tap or drag inside the editor must not put Live Preview into source mode
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart"]) root.addEventListener(ev, (e) => e.stopPropagation());

    const legend = root.createDiv({ cls: "mn-lay-legend" });
    for (const v of Object.values(KINDS)) { const s = legend.createSpan(); s.createEl("i").style.borderColor = v.color; s.append(v.name); }
    const wall = root.createDiv({ cls: "mn-lay-groups" });
    let selected: { page: Page; block: Block } | null = null;

    // pages are grouped by the part of their name before " · ": the group is a big title (Home), its pages sit under it by the rest
    // of their name (not linked, linked); a page named just "Picks" is the group's main page
    const groupOf = (p: Page) => p.name.split(SEP)[0];
    const subOf = (p: Page) => p.name.split(SEP).slice(1).join(SEP);
    const named = (group: string, sub: string) => (sub ? group + SEP + sub : group);
    const addPage = (name: string, after?: Page) => {
        const p: Page = { id: uid(), name, tabbar: true, blocks: [] };
        pages.splice(after ? pages.indexOf(after) + 1 : pages.length, 0, p);
        stepsOf(p); draw();
    };
    const draw = () => {
        wall.empty();
        const groups = new Map<string, Page[]>();
        for (const p of pages) groups.set(groupOf(p), [...(groups.get(groupOf(p)) ?? []), p]);
        for (const [group, list] of groups) {
            const sec = wall.createDiv({ cls: "mn-lay-group" });
            const gh = sec.createDiv({ cls: "mn-lay-ghead" });
            // renaming the group renames all of its pages (each saved with its own save button)
            const gname = gh.createEl("input", { cls: "mn-lay-gname", attr: { value: group, spellcheck: "false" } });
            gname.addEventListener("change", () => {
                const g = gname.value.trim();
                if (!g || g === group) return;
                for (const p of list) { p.name = named(g, subOf(p)); changed(p); }
                draw();
            });
            const sub = gh.createEl("button", { cls: "mn-lay-btn", attr: { "aria-label": "Add a page to this group" } });
            icon(sub, "plus");
            sub.addEventListener("click", () => addPage(named(group, "New page"), list[list.length - 1]));
            const row = sec.createDiv({ cls: "mn-lay-pages" });
            for (const page of list) drawPage(row, page);
        }
        const add = wall.createEl("button", { cls: "mn-lay-addpage" });
        icon(add, "plus");
        add.append("Page");
        add.addEventListener("click", () => addPage("New page"));
    };

    const drawPage = (parent: HTMLElement, page: Page) => {
        const fig = parent.createDiv({ cls: "mn-lay-page" + (page.mock ? " is-mock" : changedSinceSync(page) ? " is-changed" : "") + (dirty(page) ? " is-dirty" : "") });
        const head = fig.createDiv({ cls: "mn-lay-head" });
        const name = head.createEl("input", { cls: "mn-lay-name", attr: { value: subOf(page), placeholder: "Main page", spellcheck: "false" } });
        name.addEventListener("change", () => { page.name = named(groupOf(page), name.value.trim()); changed(page); draw(); });
        // the page's own steps: back, forward, reset to what is saved, save
        const s = stepsOf(page);
        const tool = (ic: string, label: string, on: boolean, act: () => void, cls = "") => {
            const b = head.createEl("button", { cls: "mn-lay-btn" + cls + (on ? "" : " is-off"), attr: { "aria-label": label } });
            icon(b, ic);
            b.addEventListener("click", () => { if (on) act(); });
        };
        tool("undo-2", "Back a step", s.past.length > 0, () => { s.future.push(s.last); s.last = s.past.pop()!; goTo(page, s.last); });
        tool("redo-2", "Forward a step", s.future.length > 0, () => { s.past.push(s.last); s.last = s.future.pop()!; goTo(page, s.last); });
        // reset: back to the layout as last synced, written into the note at once (back still undoes it); a page added since has none
        const base = synced.get(page.id);
        tool("rotate-ccw", "Reset to the synced layout", !!base && (dirty(page) || changedSinceSync(page)), () => {
            s.past.push(s.last); s.last = base!; s.future = []; goTo(page, s.last); savePage(page);
        });
        // a mock (light blue) is a proposal; turning it off makes it a real page, to be built at the next sync
        tool("flask-conical", page.mock ? "Mock: tap to make it a real page" : "Mark as a mock", true, () => {
            if (page.mock) delete page.mock; else page.mock = true;
            changed(page); draw();
        }, page.mock ? " is-mock" : "");
        tool("save", "Save this page into the note", dirty(page), () => savePage(page), dirty(page) ? " is-dirty" : "");
        // + block: a grid of the kinds (colour and name) opens under the button; the block comes in that kind, below the lowest one
        const addB = head.createEl("button", { cls: "mn-lay-btn", attr: { "aria-label": "Add a block" } });
        icon(addB, "square-plus");
        addB.addEventListener("click", () => {
            const open = fig.querySelector(".mn-lay-kinds.is-add");
            if (open) { open.remove(); return; }
            const pop = kindGrid(fig, "", (k) => {
                pop.remove();
                const low = page.blocks.reduce((m, x) => Math.max(m, x.y + x.h), STATUS + 8);
                const y = clamp(snap(low + 8), 0, H - TABBAR - 80);
                const b: Block = { id: uid(), label: `New ${KINDS[k].name.split(" / ")[0]}`, kind: k, x: MARGIN, y, w: W - 2 * MARGIN, h: 80 };
                page.blocks.push(b); selected = { page, block: b }; changed(page); draw();
            });
            pop.addClass("is-add");
        });
        const delP = head.createEl("button", { cls: "mn-lay-btn", attr: { "aria-label": "Delete the page (tap twice)" } });
        icon(delP, "trash-2");
        delP.addEventListener("click", () => {
            if (!delP.hasClass("is-armed")) { delP.addClass("is-armed"); window.setTimeout(() => delP.removeClass("is-armed"), 2500); return; }
            // deleting a page is written at once (tap twice to confirm)
            steps.delete(page.id);
            if (saved.some((p) => p.id === page.id)) write(saved.filter((p) => p.id !== page.id));
            else { pages.splice(pages.indexOf(page), 1); draw(); }
        });
        const note = fig.createEl("textarea", { cls: "mn-lay-pnote", attr: { rows: "4", placeholder: "What this page is for" } });
        note.value = page.note ?? "";
        note.addEventListener("change", () => { page.note = note.value.trim() || undefined; changed(page); draw(); });

        const phone = fig.createDiv({ cls: "mn-lay-phone" });
        phone.style.width = `${W * SCALE}px`;
        phone.style.height = `${H * SCALE}px`;
        const screen = phone.createDiv({ cls: "mn-lay-screen" });
        screen.style.transform = `scale(${SCALE})`;
        screen.style.width = `${W}px`;
        screen.style.height = `${H}px`;
        // the phone around the page: the status bar with the notch (carrier at the left; signal, 5G and battery at the right) and the
        // app's tab bar with its icons, in the current mode's order
        const sb = screen.createDiv({ cls: "mn-lay-status" });
        sb.style.height = `${STATUS}px`;
        sb.createSpan({ cls: "mn-lay-carrier", text: CARRIER });
        sb.createDiv({ cls: "mn-lay-notch" });
        const sig = sb.createDiv({ cls: "mn-lay-sig" });
        const bars = sig.createSpan({ cls: "mn-lay-bars" });
        for (let i = 0; i < 4; i++) bars.createEl("i");
        sig.createSpan({ text: "5G" });
        sig.createSpan({ cls: "mn-lay-batt" }).createEl("i");
        if (page.tabbar !== false) {
            const tb = screen.createDiv({ cls: "mn-lay-tabbar" });
            tb.style.height = `${TABBAR}px`;
            for (const t of MODES[plugin.settings.mode].tabs) { const c = tb.createSpan(); icon(c, TAB_ICON[t]); c.createSpan({ text: TAB_LABEL[t] }); }
        }

        for (const b of page.blocks) {
            const z = screen.createDiv({ cls: "mn-lay-z" + (selected?.block === b ? " is-sel" : "") });
            const pos = () => { z.style.left = `${b.x}px`; z.style.top = `${b.y}px`; z.style.width = `${b.w}px`; z.style.height = `${b.h}px`; size.textContent = `${b.w}×${b.h}`; };
            const col = KINDS[b.kind]?.color ?? "#9aa3b8";
            z.style.setProperty("--c", col);
            z.style.zIndex = String(LAYER[b.kind] ?? 1);   // pictures at the back, floating parts in front: no layer setting needed
            const tag = z.createDiv({ cls: "mn-lay-tag" });
            tag.createSpan({ text: b.label });
            const size = tag.createEl("small");
            if (b.note) z.createDiv({ cls: "mn-lay-znote", text: b.note });
            const grip = z.createDiv({ cls: "mn-lay-grip" });
            pos();
            // drag the block to move it, its corner to resize it; positions are in phone px (the screen is scaled)
            const drag = (resize: boolean) => (e: PointerEvent) => {
                e.preventDefault(); e.stopPropagation();
                const x0 = e.clientX, y0 = e.clientY, start = { ...b };
                let moved = false;
                z.setPointerCapture(e.pointerId);
                const move = (m: PointerEvent) => {
                    const dx = (m.clientX - x0) / SCALE, dy = (m.clientY - y0) / SCALE;
                    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
                    if (resize) { b.w = clamp(snap(start.w + dx), 16, W - b.x); b.h = clamp(snap(start.h + dy), 12, H - b.y); }
                    else { b.x = clamp(snap(start.x + dx), 0, W - b.w); b.y = clamp(snap(start.y + dy), 0, H - b.h); }
                    pos();
                };
                const up = () => {
                    z.removeEventListener("pointermove", move);
                    z.removeEventListener("pointerup", up);
                    z.removeEventListener("pointercancel", up);
                    if (moved) { changed(page); draw(); }
                    else { selected = selected?.block === b ? null : { page, block: b }; draw(); }
                };
                z.addEventListener("pointermove", move);
                z.addEventListener("pointerup", up);
                z.addEventListener("pointercancel", up);
            };
            z.addEventListener("pointerdown", drag(false));
            grip.addEventListener("pointerdown", drag(true));
        }
        if (selected?.page === page) inspector(fig, page, selected.block);
    };

    // A grid of the block kinds, each a swatch in its colour with its name; the current one ringed
    const kindGrid = (parent: HTMLElement, current: string, pick: (k: string) => void) => {
        const g = parent.createDiv({ cls: "mn-lay-kinds" });
        for (const [k, v] of Object.entries(KINDS)) {
            const c = g.createEl("button", { cls: "mn-lay-kind" + (k === current ? " is-on" : "") });
            const sw = c.createSpan({ cls: "mn-lay-sw" });
            sw.style.setProperty("--c", v.color);
            c.createSpan({ text: v.name });
            c.addEventListener("click", (e) => { e.stopPropagation(); pick(k); });
        }
        return g;
    };

    // The chosen block's window, floating over the phone next to its block, laid out like a design tool's panel (Figma's): a top bar with
    // the block's name (double-tap to rename; drag the bar to move the window) and ✕; the kind; a row of alignment buttons (to the 16 px
    // margins across, to the screen's middle, top under the status bar, bottom over the tab bar); the position and size as labelled
    // fields X Y W H, and the right and bottom edges (x + w, y + h); drag a field's label sideways to scrub its value. (0, 0) is the
    // phone's top left; X and Y are the block's top-left corner; an edge keeps the opposite edge where it is. Then the note (it grows
    // with its text) and the duplicate and delete icons.
    const inspector = (fig: HTMLElement, page: Page, b: Block) => {
        const win = fig.createDiv({ cls: "mn-lay-win" });
        const phone = fig.querySelector<HTMLElement>(".mn-lay-phone");
        // under the block if there is room on the phone, else over its lower part; where it was dragged to wins
        const top = (phone?.offsetTop ?? 0) + (b.y + b.h) * SCALE + 8;
        win.style.top = `${Math.min(top, (phone?.offsetTop ?? 0) + H * SCALE - 360)}px`;
        const moved = winAt.get(page.id);
        if (moved) win.style.transform = `translate(${moved.x}px, ${moved.y}px)`;
        const commit = () => { changed(page); draw(); };

        // top bar: the name as text, left; double-tap to rename it in place; the rest of the bar drags the window
        const head = win.createDiv({ cls: "mn-lay-winhead" });
        // the name: a box you tap to type in; it wraps and grows with its text (16 px, so iOS does not zoom in on it)
        const title = head.createEl("textarea", { cls: "mn-lay-wtitle-in", attr: { rows: "1", spellcheck: "false", "aria-label": "Block name" } });
        title.value = b.label;
        const growTitle = () => { title.style.height = "auto"; title.style.height = `${title.scrollHeight}px`; };
        title.addEventListener("input", growTitle);
        requestAnimationFrame(growTitle);
        title.addEventListener("keydown", (k) => { if (k.key === "Enter") { k.preventDefault(); title.blur(); } });
        title.addEventListener("change", () => { b.label = title.value.replace(/\s+/g, " ").trim() || b.label; commit(); });
        const close = head.createEl("button", { cls: "mn-lay-wbtn", attr: { "aria-label": "Close" } });
        icon(close, "x");
        close.addEventListener("click", () => { selected = null; winAt.delete(page.id); draw(); });
        head.addEventListener("pointerdown", (e) => {
            if ((e.target as HTMLElement).closest("input, textarea, button")) return;
            const x0 = e.clientX, y0 = e.clientY, start = winAt.get(page.id) ?? { x: 0, y: 0 };
            let dragging = false;
            head.setPointerCapture(e.pointerId);
            const move = (m: PointerEvent) => {
                if (!dragging && Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) < 4) return;   // a tap (or the first tap of a double-tap) does not move it
                dragging = true;
                const p = { x: start.x + m.clientX - x0, y: start.y + m.clientY - y0 };
                winAt.set(page.id, p);
                win.style.transform = `translate(${p.x}px, ${p.y}px)`;
            };
            const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up); };
            head.addEventListener("pointermove", move);
            head.addEventListener("pointerup", up);
            head.addEventListener("pointercancel", up);
        });

        // kind: the swatch button opens the grid of kinds
        const kindRow = win.createDiv({ cls: "mn-lay-wrow" });
        const kindBtn = kindRow.createEl("button", { cls: "mn-lay-kindbtn" });
        const ks = kindBtn.createSpan({ cls: "mn-lay-sw" });
        ks.style.setProperty("--c", KINDS[b.kind]?.color ?? "#9aa3b8");
        kindBtn.createSpan({ text: KINDS[b.kind]?.name ?? b.kind });
        icon(kindBtn, "chevron-down");
        kindBtn.addEventListener("click", () => {
            const open = win.querySelector(".mn-lay-kinds");
            if (open) { open.remove(); return; }
            kindRow.after(kindGrid(win, b.kind, (k) => { b.kind = k; commit(); }));
        });

        // alignment, like a design tool's top row: to the page's margins and middle (the screen between the status bar and the tab bar)
        const SAFE_TOP = STATUS + 1, SAFE_BOTTOM = H - (page.tabbar !== false ? TABBAR : 0);
        const align = win.createDiv({ cls: "mn-lay-align" });
        const al = (ic: string, label: string, act: () => void) => {
            const btn = align.createEl("button", { cls: "mn-lay-wbtn", attr: { "aria-label": label, title: label } });
            icon(btn, ic);
            btn.addEventListener("click", () => { act(); commit(); });
        };
        al("align-start-vertical", "Align left (16 px margin)", () => { b.x = MARGIN; });
        al("align-center-vertical", "Centre across", () => { b.x = Math.round((W - b.w) / 2); });
        al("align-end-vertical", "Align right (16 px margin)", () => { b.x = W - MARGIN - b.w; });
        align.createSpan({ cls: "mn-lay-asep" });
        al("align-start-horizontal", "Align top (under the status bar)", () => { b.y = SAFE_TOP; });
        al("align-center-horizontal", "Centre down", () => { b.y = Math.round((SAFE_TOP + SAFE_BOTTOM - b.h) / 2); });
        al("align-end-horizontal", "Align bottom (over the tab bar)", () => { b.y = SAFE_BOTTOM - b.h; });
        align.createSpan({ cls: "mn-lay-asep" });
        al("stretch-horizontal", "Full width (16 px margins)", () => { b.x = MARGIN; b.w = W - 2 * MARGIN; });
        al("layout-grid", "Snap every edge to 4 px", () => { const r = (v: number) => Math.round(v / 4) * 4; const x2 = r(b.x + b.w), y2 = r(b.y + b.h); b.x = r(b.x); b.y = r(b.y); b.w = Math.max(4, x2 - b.x); b.h = Math.max(4, y2 - b.y); });

        // position and size as a box diagram (like a browser's box model): the screen's outline with the block in it, its distance to each
        // screen edge on the four sides and its size inside; tap a number to choose it, then change it with − / + (4 px a tap, held to
        // repeat) or type it. A distance moves the block (its size stays); W and H resize it from its top-left corner.
        const get: Record<Metric, () => number> = { top: () => b.y, left: () => b.x, right: () => W - b.x - b.w, bottom: () => H - b.y - b.h, w: () => b.w, h: () => b.h };
        const put: Record<Metric, (v: number) => void> = {
            top: (v) => { b.y = clamp(v, 0, H - b.h); }, left: (v) => { b.x = clamp(v, 0, W - b.w); },
            right: (v) => { b.x = clamp(W - v - b.w, 0, W - b.w); }, bottom: (v) => { b.y = clamp(H - v - b.h, 0, H - b.h); },
            w: (v) => { b.w = clamp(v, 8, W - b.x); }, h: (v) => { b.h = clamp(v, 8, H - b.y); },
        };
        const NAME: Record<Metric, string> = { top: "Top gap", left: "Left gap", right: "Right gap", bottom: "Bottom gap", w: "Width", h: "Height" };
        const boxEl = win.createDiv({ cls: "mn-lay-box" });
        const nums = new Map<Metric, HTMLElement>();
        const num = (m: Metric, parent: HTMLElement, cls: string) => {
            const btn = parent.createEl("button", { cls: "mn-lay-bnum " + cls + (m === metricAt ? " is-on" : ""), text: String(get[m]()), attr: { "aria-label": NAME[m] } });
            btn.addEventListener("click", () => { metricAt = m; nums.forEach((x, k) => x.toggleClass("is-on", k === m)); showStep(); });
            nums.set(m, btn);
        };
        num("top", boxEl, "is-top");
        num("left", boxEl, "is-left");
        const blockEl = boxEl.createDiv({ cls: "mn-lay-bblock" });
        blockEl.style.setProperty("--c", KINDS[b.kind]?.color ?? "#9aa3b8");
        num("w", blockEl, "is-w");
        blockEl.createSpan({ cls: "mn-lay-bx", text: "×" });
        num("h", blockEl, "is-h");
        num("right", boxEl, "is-right");
        num("bottom", boxEl, "is-bottom");
        // the chosen number's stepper
        const step = win.createDiv({ cls: "mn-lay-step" });
        const stepName = step.createSpan({ cls: "mn-lay-sname" });
        const minus = step.createEl("button", { cls: "mn-lay-sbtn", attr: { "aria-label": "Less" } });
        icon(minus, "minus");
        const input = step.createEl("input", { cls: "mn-lay-sin", attr: { type: "number", inputmode: "numeric", step: String(STEP) } });
        const plus = step.createEl("button", { cls: "mn-lay-sbtn", attr: { "aria-label": "More" } });
        icon(plus, "plus");
        const showStep = () => { stepName.setText(NAME[metricAt]); input.value = String(get[metricAt]()); };
        const refresh = () => { nums.forEach((x, k) => x.setText(String(get[k]()))); input.value = String(get[metricAt]()); };
        const nudge = (d: number) => { put[metricAt](get[metricAt]() + d); refresh(); };
        let held = 0, nudged = false;
        const hold = (btn: HTMLElement, d: number) => {
            btn.addEventListener("pointerdown", (e) => { e.preventDefault(); nudge(d); nudged = true; held = window.setInterval(() => nudge(d), REPEAT_MS); });
            const stop = () => { window.clearInterval(held); held = 0; if (nudged) { nudged = false; commit(); } };
            for (const ev of ["pointerup", "pointercancel", "pointerleave"]) btn.addEventListener(ev, stop);
        };
        hold(minus, -STEP);
        hold(plus, STEP);
        input.addEventListener("change", () => { put[metricAt](Math.round(Number(input.value) || 0)); commit(); });
        showStep();

        // the note grows with its text
        const note = win.createEl("textarea", { cls: "mn-lay-wnote", attr: { rows: "1", placeholder: "Note: what goes here, what is wrong" } });
        note.value = b.note ?? "";
        const grow = () => { note.style.height = "auto"; note.style.height = `${note.scrollHeight + 2}px`; };
        note.addEventListener("input", grow);
        requestAnimationFrame(grow);
        note.addEventListener("change", () => { b.note = note.value.trim() || undefined; commit(); });

        const acts = win.createDiv({ cls: "mn-lay-acts" });
        const dup = acts.createEl("button", { cls: "mn-lay-wbtn", attr: { "aria-label": "Duplicate", title: "Duplicate" } });
        icon(dup, "copy");
        dup.addEventListener("click", () => { const c = { ...b, id: uid(), y: clamp(b.y + 12, 0, H - b.h) }; page.blocks.push(c); selected = { page, block: c }; commit(); });
        const del = acts.createEl("button", { cls: "mn-lay-wbtn is-danger", attr: { "aria-label": "Delete", title: "Delete" } });
        icon(del, "trash-2");
        del.addEventListener("click", () => { page.blocks.splice(page.blocks.indexOf(b), 1); selected = null; commit(); });
    };

    draw();
}

export function registerLayoutNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-layout", (source, el, ctx) => layoutBlock(plugin, source, el, ctx));
    // the synced copy is for the editor only: shown as one quiet line
    plugin.registerMarkdownCodeBlockProcessor(SYNCED, (_source, el) => { el.createDiv({ cls: "mn-lay-synced", text: "Last synced layout (kept by Claude; changed pages are marked against it)" }); });
}
