import { getIconIds, setIcon } from "obsidian";
import type MorellonomiconPlugin from "./main";

// Review/Icons.md shows its icons and colours: next to every `lucide-name` in code ticks the icon is drawn, and next to every
// `--css-variable` or `#hex` a colour swatch; an icon in a table row takes the colour written in the same row. Edit the names
// and colours in the note and look at it in Reading view to see the result at once.
const NOTE = "Review/Icons.md";
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COLOUR = /^(?:--[\w-]+|#[0-9a-fA-F]{3,8})$/;

// A ```mn-icons block lists one idea per line: `label | lucide-name | colour (optional)`. It is drawn as a list of icons, in Reading view and in
// Live Preview alike; tapping it in Live Preview shows the lines to edit.
function iconsBlock(source: string, el: HTMLElement): void {
    const ids = new Set(getIconIds());
    const known = (n: string) => ids.has(n) || ids.has(`lucide-${n}`);
    const probe = el.createDiv({ cls: "mn-app mn-icprobe" });
    const resolve = (c: string): string => { if (!c.startsWith("--")) return c; probe.style.color = `var(${c})`; return getComputedStyle(probe).color; };
    const list = el.createDiv({ cls: "mn-iclist" });
    for (const line of source.split("\n")) {
        const [label = "", name = "", colour = ""] = line.split("|").map((s) => s.trim());
        if (!label && !name) continue;
        const row = list.createDiv({ cls: "mn-icrow" });
        const pic = row.createSpan({ cls: "mn-icbig" });
        if (known(name)) { if (COLOUR.test(colour)) pic.style.color = resolve(colour); setIcon(pic, name); }
        else pic.setText("?");
        row.createSpan({ cls: "mn-iclabel", text: label });
        row.createEl("code", { cls: known(name) ? "mn-icname" : "mn-icname mn-icbad", text: name || "(no icon)" });
        row.createSpan({ cls: "mn-icsw", attr: { style: COLOUR.test(colour) ? `background:${resolve(colour)}` : "visibility:hidden" } });
        row.createEl("code", { cls: "mn-iccol", text: colour });
    }
    probe.remove();
}

export function registerIconsNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-icons", iconsBlock);
    plugin.registerMarkdownPostProcessor((el, ctx) => {
        if (ctx.sourcePath !== NOTE) return;
        const ids = new Set(getIconIds());
        const known = (n: string) => ids.has(n) || ids.has(`lucide-${n}`);
        // the CSS variables of the app (--mn-phys …) are defined on .mn-app, so they are read from a hidden one
        const probe = document.body.createDiv({ cls: "mn-app mn-icprobe" });
        const resolve = (c: string): string => {
            if (!c.startsWith("--")) return c;
            probe.style.color = `var(${c})`;
            return getComputedStyle(probe).color;
        };
        try {
            for (const code of Array.from(el.querySelectorAll("code"))) {
                if (code.closest(".mn-iclist")) continue;   // the list block already draws its own
                const text = (code.textContent ?? "").trim();
                if (COLOUR.test(text)) {
                    code.parentElement?.insertBefore(createSpan({ cls: "mn-icsw", attr: { style: `background:${resolve(text)}` } }), code);
                } else if (NAME.test(text) && !text.includes("--")) {
                    const row = code.closest("tr");
                    const colour = Array.from(row?.querySelectorAll("code") ?? []).map((c) => (c.textContent ?? "").trim()).find((t) => COLOUR.test(t));
                    if (!known(text)) { if (row) code.addClass("mn-icbad"); continue; }
                    const span = createSpan({ cls: "mn-icprev" });
                    if (colour) span.style.color = resolve(colour);
                    setIcon(span, text);
                    code.parentElement?.insertBefore(span, code);
                }
            }
        } finally { probe.remove(); }
    });
}
