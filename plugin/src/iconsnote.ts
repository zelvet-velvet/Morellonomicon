import { MarkdownPostProcessorContext, TFile, getIconIds, setIcon } from "obsidian";
import type MorellonomiconPlugin from "./main";

// Dev Tools/Icons.md is an editor: a ```mn-icons block has one line per idea, `label | lucide-name | --css-variable | #hex` (variable and hex
// optional; a #hex wins over the variable). The block is drawn as rows with a live icon, a box for the Lucide name (with suggestions),
// a colour picker and a hex box; changing one writes the line back into the note.
const HEX = /^#[0-9a-fA-F]{6}$/;
const CHUNK = 90;   // icons added to the picker at a time (there are about 1700; drawing them all at once is slow on a phone)

const toHex = (rgb: string): string => {   // "rgb(224, 137, 74)" -> "#e0894a"
    const m = rgb.match(/\d+(?:\.\d+)?/g);
    return m && m.length >= 3 ? "#" + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("") : "";
};

interface Row { label: string; name: string; variable: string; hex: string }
const parse = (line: string): Row => {
    const f = line.split("|").map((s) => s.trim());
    let variable = "", hex = "";
    for (const x of f.slice(2)) { if (x.startsWith("--")) variable = x; else if (/^#[0-9a-fA-F]{3,8}$/.test(x)) hex = x.toLowerCase(); }
    return { label: f[0] ?? "", name: f[1] ?? "", variable, hex };
};
// What each row was when the note was first drawn in this session: the ↺ next to the icon name goes back to it
const baseline = new Map<string, Row>();
const serialise = (r: Row): string => [r.label, r.name, r.variable, r.hex].filter((x, i) => i < 2 || x).join(" | ");

function iconsBlock(plugin: MorellonomiconPlugin, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const ids = getIconIds().map((i) => i.replace(/^lucide-/, ""));
    const known = new Set(ids);
    // CSS variables are defined on .mn-app, so they are read from a hidden one attached to the page (a detached element has no colour)
    const probe = document.body.createDiv({ cls: "mn-app mn-icprobe" });
    const current = (r: Row): string => {
        if (r.hex) return r.hex.length === 7 ? r.hex : "#888888";
        if (!r.variable) return "";
        probe.style.color = `var(${r.variable})`;
        return toHex(getComputedStyle(probe).color);
    };
    const info = ctx.getSectionInfo(el);
    const list = el.createDiv({ cls: "mn-iclist" });
    let openPanel: HTMLElement | null = null;
    // write one line of the block back into the note (the block's lines follow its opening fence)
    const save = (i: number, r: Row) => {
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!info || !(file instanceof TFile)) return;
        void plugin.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            lines[info.lineStart + 1 + i] = serialise(r);
            return lines.join("\n");
        });
    };
    source.split("\n").forEach((line, i) => {
        if (!line.trim()) return;
        const r = parse(line);
        const key = `${ctx.sourcePath}|${r.label}`;
        if (!baseline.has(key)) baseline.set(key, { ...r });
        const base = baseline.get(key)!;
        const row = list.createDiv({ cls: "mn-icrow" });
        const pic = row.createSpan({ cls: "mn-icbig" });
        const label = row.createDiv({ cls: "mn-iclabel", text: r.label });
        if (r.variable) label.createSpan({ cls: "mn-icvar", text: r.variable });
        const ctl = row.createDiv({ cls: "mn-icctl" });
        const name = ctl.createEl("input", { cls: "mn-icin", attr: { type: "text", value: r.name, placeholder: "lucide name", spellcheck: "false", autocapitalize: "off", autocomplete: "off" } });
        const resetName = ctl.createEl("button", { cls: "mn-icreset", attr: { "aria-label": "Back to the first icon" } });
        setIcon(resetName, "rotate-ccw");
        const pick = ctl.createEl("input", { cls: "mn-icpick", attr: { type: "color" } });
        const hex = ctl.createEl("input", { cls: "mn-icin mn-ichexin", attr: { type: "text", placeholder: "#hex", spellcheck: "false", autocapitalize: "off" } });
        const reset = ctl.createEl("button", { cls: "mn-icreset", attr: { "aria-label": "Back to the app's colour" } });
        setIcon(reset, "rotate-ccw");
        const draw = () => {
            const c = current(r);
            pic.empty();
            pic.style.color = c || "";
            if (known.has(r.name)) setIcon(pic, r.name); else pic.setText("?");
            name.toggleClass("is-bad", !known.has(r.name));
            if (HEX.test(c)) pick.value = c;
            hex.value = r.hex;
            hex.placeholder = c || "#hex";
            reset.toggleClass("is-off", r.variable ? !r.hex : r.hex === base.hex);   // nothing to undo
            resetName.toggleClass("is-off", r.name === base.name);
        };
        draw();
        // the picker: a scrolling grid of icons under the row, filtered by what is typed; tap one to take it
        const panel = row.createDiv({ cls: "mn-icpanel is-hidden" });
        let shown = 0, matches: string[] = [];
        const more = () => {
            for (const id of matches.slice(shown, shown + CHUNK)) {
                const b = panel.createEl("button", { cls: "mn-ictile" });
                b.createSpan({ cls: "mn-ictile-ic" }).style.color = current(r);
                setIcon(b.firstElementChild as HTMLElement, id);
                b.createSpan({ cls: "mn-ictile-n", text: id });
                b.addEventListener("click", (e) => { e.preventDefault(); r.name = id; name.value = id; draw(); close(); save(i, r); });
            }
            shown += CHUNK;
        };
        const fill = () => {
            const q = name.value.trim().toLowerCase().replace(/^lucide-/, "");
            matches = q ? ids.filter((x) => x.includes(q)) : ids;
            panel.empty(); shown = 0; panel.scrollTop = 0;
            if (!matches.length) panel.createDiv({ cls: "mn-icnone", text: "no icon with that name" }); else more();
        };
        const close = () => { panel.addClass("is-hidden"); if (openPanel === panel) openPanel = null; };
        panel.addEventListener("scroll", () => { if (shown < matches.length && panel.scrollTop + panel.clientHeight > panel.scrollHeight - 80) more(); });
        panel.addEventListener("mousedown", (e) => e.preventDefault());   // a tap on the grid must not blur the box first
        name.addEventListener("focus", () => { openPanel?.addClass("is-hidden"); openPanel = panel; panel.removeClass("is-hidden"); name.select(); fill(); });
        name.addEventListener("input", fill);
        name.addEventListener("blur", () => window.setTimeout(close, 150));
        name.addEventListener("keydown", (e) => { if (e.key === "Escape") { name.blur(); } });
        name.addEventListener("change", () => { r.name = name.value.trim().toLowerCase().replace(/^lucide-/, ""); draw(); if (known.has(r.name)) save(i, r); });
        pick.addEventListener("input", () => { r.hex = pick.value.toLowerCase(); draw(); });
        pick.addEventListener("change", () => { r.hex = pick.value.toLowerCase(); draw(); save(i, r); });
        hex.addEventListener("change", () => {
            const v = hex.value.trim().toLowerCase().replace(/^(?=[0-9a-f]{6}$)/, "#");
            r.hex = HEX.test(v) ? v : ""; draw(); save(i, r);
        });
        reset.addEventListener("click", (e) => { e.preventDefault(); r.hex = r.variable ? "" : base.hex; draw(); save(i, r); });
        resetName.addEventListener("click", (e) => { e.preventDefault(); r.name = base.name; name.value = base.name; draw(); save(i, r); });
    });
    probe.remove();
}

export function registerIconsNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-icons", (source, el, ctx) => iconsBlock(plugin, source, el, ctx));
}
