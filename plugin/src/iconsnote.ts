import { getIconIds, setIcon } from "obsidian";
import type MorellonomiconPlugin from "./main";

// Review/Icons.md shows its icons and colours: next to every `lucide-name` in code ticks the icon is drawn, and next to every
// `--css-variable` or `#hex` a colour swatch; an icon in a table row takes the colour written in the same row. Edit the names
// and colours in the note and look at it in Reading view to see the result at once.
const NOTE = "Review/Icons.md";
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COLOUR = /^(?:--[\w-]+|#[0-9a-fA-F]{3,8})$/;

export function registerIconsNote(plugin: MorellonomiconPlugin): void {
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
