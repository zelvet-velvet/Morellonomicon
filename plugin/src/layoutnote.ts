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
        const addB = head.createEl("button", { cls: "mn-lay-btn", attr: { "aria-label": "Add a block" } });
        icon(addB, "square-plus");
        addB.addEventListener("click", () => {
            const b: Block = { id: uid(), label: "New block", kind: "list", x: 16, y: 120, w: W - 32, h: 80 };
            page.blocks.push(b); selected = { page, block: b }; changed(page); draw();
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

    // the chosen block: its name, kind, note and numbers, delete
    const inspector = (fig: HTMLElement, page: Page, b: Block) => {
        const box = fig.createDiv({ cls: "mn-lay-insp" });
        const row = (label: string) => { const r = box.createDiv({ cls: "mn-lay-row" }); r.createSpan({ text: label }); return r; };
        const lab = row("Name").createEl("input", { attr: { value: b.label } });
        lab.addEventListener("change", () => { b.label = lab.value.trim() || b.label; changed(page); draw(); });
        const kind = row("Kind").createEl("select");
        for (const [k, v] of Object.entries(KINDS)) kind.createEl("option", { text: v.name, attr: { value: k } });
        kind.value = b.kind;
        kind.addEventListener("change", () => { b.kind = kind.value; changed(page); draw(); });
        const nums = row("x y w h");
        for (const key of ["x", "y", "w", "h"] as const) {
            const n = nums.createEl("input", { cls: "mn-lay-num", attr: { type: "number", value: String(b[key]), step: String(SNAP) } });
            n.addEventListener("change", () => { b[key] = Math.max(0, Number(n.value) || 0); changed(page); draw(); });
        }
        const note = row("Note").createEl("textarea", { attr: { rows: "4", placeholder: "What goes here, what is wrong" } });
        note.value = b.note ?? "";
        note.addEventListener("change", () => { b.note = note.value.trim() || undefined; changed(page); draw(); });
        const acts = box.createDiv({ cls: "mn-lay-acts" });
        const dup = acts.createEl("button", { text: "Duplicate" });
        dup.addEventListener("click", () => { const c = { ...b, id: uid(), y: clamp(b.y + 12, 0, H - b.h) }; page.blocks.push(c); selected = { page, block: c }; changed(page); draw(); });
        const del = acts.createEl("button", { cls: "mod-warning", text: "Delete" });
        del.addEventListener("click", () => { page.blocks.splice(page.blocks.indexOf(b), 1); selected = null; changed(page); draw(); });
        const done = acts.createEl("button", { text: "Done" });
        done.addEventListener("click", () => { selected = null; draw(); });
    };

    draw();
}

export function registerLayoutNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-layout", (source, el, ctx) => layoutBlock(plugin, source, el, ctx));
    // the synced copy is for the editor only: shown as one quiet line
    plugin.registerMarkdownCodeBlockProcessor(SYNCED, (_source, el) => { el.createDiv({ cls: "mn-lay-synced", text: "Last synced layout (kept by Claude; changed pages are marked against it)" }); });
}
