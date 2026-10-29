import { MarkdownPostProcessorContext, TFile, getIconIds, setIcon } from "obsidian";
import type MorellonomiconPlugin from "./main";

// Review/Icons.md is an editor: a ```mn-icons block has one line per idea, `label | lucide-name | --css-variable | #hex` (variable and hex
// optional; a #hex wins over the variable). The block is drawn as rows with a live icon, a box for the Lucide name (with suggestions),
// a colour picker and a hex box; changing one writes the line back into the note.
const HEX = /^#[0-9a-fA-F]{6}$/;
const LIST_ID = "mn-lucide-ids";

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
    const dl = list.createEl("datalist", { attr: { id: LIST_ID } });
    for (const id of ids) dl.createEl("option", { attr: { value: id } });
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
        const row = list.createDiv({ cls: "mn-icrow" });
        const pic = row.createSpan({ cls: "mn-icbig" });
        const label = row.createDiv({ cls: "mn-iclabel", text: r.label });
        if (r.variable) label.createSpan({ cls: "mn-icvar", text: r.variable });
        const ctl = row.createDiv({ cls: "mn-icctl" });
        const name = ctl.createEl("input", { cls: "mn-icin", attr: { type: "text", list: LIST_ID, value: r.name, placeholder: "lucide name", spellcheck: "false", autocapitalize: "off", autocomplete: "off" } });
        const pick = ctl.createEl("input", { cls: "mn-icpick", attr: { type: "color" } });
        const hex = ctl.createEl("input", { cls: "mn-icin mn-ichexin", attr: { type: "text", placeholder: "#hex", spellcheck: "false", autocapitalize: "off" } });
        const reset = ctl.createEl("button", { cls: "mn-icreset", attr: { "aria-label": "Use the app's colour" } });
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
            reset.toggleClass("is-hidden", !r.hex || !r.variable);
        };
        draw();
        name.addEventListener("change", () => { r.name = name.value.trim().toLowerCase().replace(/^lucide-/, ""); draw(); if (known.has(r.name)) save(i, r); });
        pick.addEventListener("input", () => { r.hex = pick.value.toLowerCase(); draw(); });
        pick.addEventListener("change", () => { r.hex = pick.value.toLowerCase(); draw(); save(i, r); });
        hex.addEventListener("change", () => {
            const v = hex.value.trim().toLowerCase().replace(/^(?=[0-9a-f]{6}$)/, "#");
            r.hex = HEX.test(v) ? v : ""; draw(); save(i, r);
        });
        reset.addEventListener("click", (e) => { e.preventDefault(); r.hex = ""; draw(); save(i, r); });
    });
    probe.remove();
}

export function registerIconsNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-icons", (source, el, ctx) => iconsBlock(plugin, source, el, ctx));
}
