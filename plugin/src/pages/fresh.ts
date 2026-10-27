import type { Meta } from "../data/store";
import { patchAge } from "../data/store";
import { chip, h } from "../ui";

// The line under a tip or build: patch (green = current, yellow = one behind, red = older or unknown), date, status, source.
export function metaLine(parent: HTMLElement, m: Meta, now: string): void {
    const row = h(parent, "div", "mn-meta");
    const age = patchAge(m.patch, now);
    if (age === null) chip(row, "⚠ 版本未註明", { color: "var(--color-red)" });
    else if (age === 0) chip(row, `✓ ${m.patch}`, { color: "var(--color-green)" });
    else chip(row, `⚠ ${m.patch}(已過 ${age} 版)`, { color: age === 1 ? "var(--color-yellow)" : "var(--color-red)" });
    if (m.date) chip(row, m.date);
    if (m.status) chip(row, m.status, { color: m.status.includes("待") ? "var(--color-orange)" : "var(--color-green)" });
    if (m.source) {
        const a = h(row, "button", "mn-chip mn-meta-src", `↗ ${m.sourceName || "來源"}`);
        a.addEventListener("click", (e) => { e.preventDefault(); window.open(m.source); });
    }
}
