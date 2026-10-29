import { MarkdownPostProcessorContext, Notice, TFile } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { icon } from "./ui";

// Review/Layouts.md is a layout editor: a ```mn-layout block holds every page of the app as a phone with colour-coded blocks
// (JSON, one page per line, so a change reads well in git). It is drawn as phones side by side; a block can be dragged to move it,
// its corner dragged to resize it, and tapped to rename it, change its kind, write a note or delete it; pages can be added, renamed and
// removed. Every change is written back into the note when the finger lifts, so Claude reads the exact layout from the repo.
const W = 390, H = 844;          // the phone, in CSS px (an iPhone 14)
const SCALE = 0.78;              // drawn at this size
const SNAP = 2;                  // px the blocks snap to
const TABBAR = 64;               // the app's tab bar at the bottom of every page (drawn, not a block)
export const KINDS: Record<string, { color: string; name: string }> = {
    hero: { color: "#8fb4ee", name: "hero / picture" }, nav: { color: "#9aa3b8", name: "title / nav" }, entry: { color: "#7fd9ad", name: "entries / buttons" },
    list: { color: "#f0cd7a", name: "list / grid" }, info: { color: "#cba8f5", name: "info / stats" }, action: { color: "#f08ab8", name: "input / action" },
    float: { color: "#73bbb2", name: "floating" },
};
interface Block { id: string; label: string; kind: string; x: number; y: number; w: number; h: number; note?: string }
interface Page { id: string; name: string; note?: string; tabbar?: boolean; blocks: Block[] }

const uid = () => Math.random().toString(36).slice(2, 8);
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function parse(source: string): Page[] {
    try { const v = JSON.parse(source || "[]") as Page[]; return Array.isArray(v) ? v : []; } catch { return []; }
}
const serialise = (pages: Page[]) => "[\n" + pages.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]";

function layoutBlock(plugin: MorellonomiconPlugin, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const pages = parse(source);
    const info = ctx.getSectionInfo(el);
    const root = el.createDiv({ cls: "mn-lay" });
    if (source.trim() && !pages.length) { root.createDiv({ cls: "mn-lay-err", text: "The layout data could not be read (JSON). Fix it in the source view." }); return; }
    // the whole block is replaced in the note: the lines between the fences
    const save = () => {
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!info || !(file instanceof TFile)) { new Notice("Could not save the layout"); return; }
        void plugin.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...serialise(pages).split("\n"));
            return lines.join("\n");
        });
    };
    // a tap or drag inside the editor must not put Live Preview into source mode
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart"]) root.addEventListener(ev, (e) => e.stopPropagation());

    const legend = root.createDiv({ cls: "mn-lay-legend" });
    for (const v of Object.values(KINDS)) { const s = legend.createSpan(); s.createEl("i").style.borderColor = v.color; s.append(v.name); }
    const wall = root.createDiv({ cls: "mn-lay-pages" });
    let selected: { page: Page; block: Block } | null = null;

    const draw = () => {
        wall.empty();
        for (const page of pages) drawPage(page);
        const add = wall.createEl("button", { cls: "mn-lay-addpage" });
        icon(add, "plus");
        add.append("Page");
        add.addEventListener("click", () => { pages.push({ id: uid(), name: "New page", tabbar: true, blocks: [] }); save(); draw(); });
    };

    const drawPage = (page: Page) => {
        const fig = wall.createDiv({ cls: "mn-lay-page" });
        const head = fig.createDiv({ cls: "mn-lay-head" });
        const name = head.createEl("input", { cls: "mn-lay-name", attr: { value: page.name, spellcheck: "false" } });
        name.addEventListener("change", () => { page.name = name.value.trim() || page.name; save(); });
        const addB = head.createEl("button", { cls: "mn-lay-btn", attr: { "aria-label": "Add a block" } });
        icon(addB, "square-plus");
        addB.addEventListener("click", () => {
            const b: Block = { id: uid(), label: "New block", kind: "list", x: 16, y: 120, w: W - 32, h: 80 };
            page.blocks.push(b); selected = { page, block: b }; save(); draw();
        });
        const delP = head.createEl("button", { cls: "mn-lay-btn", attr: { "aria-label": "Delete the page (tap twice)" } });
        icon(delP, "trash-2");
        delP.addEventListener("click", () => {
            if (!delP.hasClass("is-armed")) { delP.addClass("is-armed"); window.setTimeout(() => delP.removeClass("is-armed"), 2500); return; }
            pages.splice(pages.indexOf(page), 1); save(); draw();
        });
        const note = fig.createEl("textarea", { cls: "mn-lay-pnote", attr: { rows: "2", placeholder: "What this page is for" } });
        note.value = page.note ?? "";
        note.addEventListener("change", () => { page.note = note.value.trim() || undefined; save(); });

        const phone = fig.createDiv({ cls: "mn-lay-phone" });
        phone.style.width = `${W * SCALE}px`;
        phone.style.height = `${H * SCALE}px`;
        const screen = phone.createDiv({ cls: "mn-lay-screen" });
        screen.style.transform = `scale(${SCALE})`;
        screen.style.width = `${W}px`;
        screen.style.height = `${H}px`;
        if (page.tabbar !== false) { const tb = screen.createDiv({ cls: "mn-lay-tabbar" }); tb.style.height = `${TABBAR}px`; for (const t of ["Augments", "Patch", "Home", "Picks", "Handbook"]) tb.createSpan({ text: t }); }

        for (const b of page.blocks) {
            const z = screen.createDiv({ cls: "mn-lay-z" + (selected?.block === b ? " is-sel" : "") });
            const pos = () => { z.style.left = `${b.x}px`; z.style.top = `${b.y}px`; z.style.width = `${b.w}px`; z.style.height = `${b.h}px`; size.textContent = `${b.w}×${b.h}`; };
            const col = KINDS[b.kind]?.color ?? "#9aa3b8";
            z.style.setProperty("--c", col);
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
                    if (moved) save();
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
        lab.addEventListener("change", () => { b.label = lab.value.trim() || b.label; save(); draw(); });
        const kind = row("Kind").createEl("select");
        for (const [k, v] of Object.entries(KINDS)) kind.createEl("option", { text: v.name, attr: { value: k } });
        kind.value = b.kind;
        kind.addEventListener("change", () => { b.kind = kind.value; save(); draw(); });
        const nums = row("x y w h");
        for (const key of ["x", "y", "w", "h"] as const) {
            const n = nums.createEl("input", { cls: "mn-lay-num", attr: { type: "number", value: String(b[key]), step: String(SNAP) } });
            n.addEventListener("change", () => { b[key] = Math.max(0, Number(n.value) || 0); save(); draw(); });
        }
        const note = row("Note").createEl("textarea", { attr: { rows: "2", placeholder: "What goes here, what is wrong" } });
        note.value = b.note ?? "";
        note.addEventListener("change", () => { b.note = note.value.trim() || undefined; save(); draw(); });
        const acts = box.createDiv({ cls: "mn-lay-acts" });
        const dup = acts.createEl("button", { text: "Duplicate" });
        dup.addEventListener("click", () => { const c = { ...b, id: uid(), y: clamp(b.y + 12, 0, H - b.h) }; page.blocks.push(c); selected = { page, block: c }; save(); draw(); });
        const del = acts.createEl("button", { cls: "mod-warning", text: "Delete" });
        del.addEventListener("click", () => { page.blocks.splice(page.blocks.indexOf(b), 1); selected = null; save(); draw(); });
        const done = acts.createEl("button", { text: "Done" });
        done.addEventListener("click", () => { selected = null; draw(); });
    };

    draw();
}

export function registerLayoutNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-layout", (source, el, ctx) => layoutBlock(plugin, source, el, ctx));
}
