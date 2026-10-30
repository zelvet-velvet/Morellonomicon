import { MarkdownPostProcessorContext, TFile, setIcon } from "obsidian";
import type MorellonomiconPlugin from "./main";
import type { Champion } from "./data/store";
import { pic, picker } from "./pickers";
import { STAT_COLOR, STAT_ICON } from "./ui";

// Inbox/速查卡片.md is an editor for the 速查 card text, which lives in each champion note's frontmatter: punch (一句話), stack (堆),
// soul (玩法, one to three lines), focus (主力), plain (each ability in plain words) and picks_status (待驗證 / 已驗證, the proofreading).
// Pick a champion, edit, and a field is written into that champion's note when you leave it (only these keys, in the one-line style
// the notes already use, so the fetch scripts keep them). The ```mn-picks block holds nothing.
const PUNCH_MAX = 14;   // characters for 一句話 and for each 玩法 line (the card's room)
const SOUL_MAX = 16;
const SOUL_LINES = 3;
const KEYS = ["P", "Q", "W", "E", "R"];
const STATUS = ["待驗證", "已驗證"];
const chosen = new Map<string, string>();   // note path -> the champion being edited (kept when the block is drawn again)

// Writes some top-level frontmatter keys of a note: each key's line (and the indented lines under it) is replaced, or added before the
// closing ---; an empty value removes the key. Values are written as JSON, which YAML reads (strings quoted, ["a", "b"], {"P": "…"}).
async function setKeys(plugin: MorellonomiconPlugin, path: string, values: Record<string, unknown>): Promise<void> {
    const file = plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await plugin.app.vault.process(file, (data) => {
        const lines = data.split("\n");
        if (lines[0] !== "---") return data;
        let end = lines.indexOf("---", 1);
        if (end < 0) return data;
        for (const [key, v] of Object.entries(values)) {
            const empty = v === undefined || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && v !== null && !Array.isArray(v) && !Object.keys(v).length);
            const at = lines.slice(1, end).findIndex((l) => l.startsWith(`${key}:`)) + 1;
            if (at > 0) {
                let n = 1;
                while (at + n < end && /^\s/.test(lines[at + n])) n++;
                lines.splice(at, n, ...(empty ? [] : [`${key}: ${yaml(v)}`]));
                end -= n - (empty ? 0 : 1);
            } else if (!empty) {
                lines.splice(end, 0, `${key}: ${yaml(v)}`);
                end++;
            }
        }
        return lines.join("\n");
    });
}

// JSON in the notes' own spacing (["a", "b"], {"P": "…", "Q": "…"}), so an edit shows only what changed
const yaml = (v: unknown): string => Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]`
    : typeof v === "object" && v !== null ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(", ")}}` : JSON.stringify(v);
const width = (s: string) => [...s].reduce((n, ch) => n + (/[\x00-\x7f]/.test(ch) ? 0.5 : 1), 0);   // full-width 1, ASCII ½ (as check_cards.py)

function picksBlock(plugin: MorellonomiconPlugin, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const store = plugin.store;
    const all = store.champions();
    const root = el.createDiv({ cls: "mn-pk mn-inb" });
    if (!all.length) { root.createDiv({ text: "No champion notes yet." }); return; }
    const statusOf = (c: Champion) => String(plugin.app.metadataCache.getFileCache(plugin.app.vault.getAbstractFileByPath(c.path) as TFile)?.frontmatter?.picks_status ?? STATUS[0]);
    const bar = root.createDiv({ cls: "mn-inb-bar" });
    const count = bar.createSpan({ cls: "mn-inb-count" });
    const next = bar.createEl("button", { cls: "mn-inb-add" });
    setIcon(next.createSpan(), "skip-forward");
    next.createSpan({ text: "下一位待驗證" });
    const pickHost = root.createDiv();
    const form = root.createDiv({ cls: "mn-pk-form" });
    const counted = () => count.setText(`已驗證 ${all.filter((c) => statusOf(c) === "已驗證").length} / ${all.length}`);

    const show = (c: Champion | undefined) => {
        form.empty();
        if (!c) return;
        chosen.set(ctx.sourcePath, c.id);
        const save = (values: Record<string, unknown>) => void setKeys(plugin, c.path, values).then(counted);
        const head = form.createDiv({ cls: "mn-pk-head" });
        pic(head, { name: c.name, img: c.icon }, "mn-pk-face");   // a square background (an <img> is stretched by the theme)
        const who = head.createDiv();
        who.createDiv({ cls: "mn-inb-t", text: c.name });
        who.createDiv({ cls: "mn-inb-s", text: c.title });
        const status = head.createEl("select", { cls: "mn-pk-status" });
        for (const s of STATUS) status.createEl("option", { text: s, attr: { value: s } });
        status.value = statusOf(c);
        status.toggleClass("is-ok", status.value === "已驗證");
        status.addEventListener("change", () => { status.toggleClass("is-ok", status.value === "已驗證"); save({ picks_status: status.value === STATUS[0] ? "" : status.value }); });

        const row = (label: string) => { const r = form.createDiv({ cls: "mn-inb-row" }); const l = r.createDiv({ cls: "mn-inb-l", text: label }); return { r, l }; };
        // a text box with a count of its room; saved when it is left
        const text = (parent: HTMLElement, value: string, max: number, onSave: (v: string) => void) => {
            const wrap = parent.createDiv({ cls: "mn-pk-text" });
            const input = wrap.createEl("input", { attr: { type: "text" } });
            input.value = value;
            const n = wrap.createSpan({ cls: "mn-pk-n" });
            const tick = () => { const w = width(input.value); n.setText(`${w}/${max}`); n.toggleClass("is-over", w > max); };
            tick();
            input.addEventListener("input", tick);
            input.addEventListener("change", () => onSave(input.value.trim()));
            return input;
        };
        text(row("一句話（punch）").r, c.punch, PUNCH_MAX, (v) => save({ punch: v }));

        const stats = Object.keys(STAT_ICON).map((name) => ({ name, icon: STAT_ICON[name], color: STAT_COLOR[name] }));
        picker(row("堆（stack）· 兩三個").r, { choices: stats, value: c.stack, multi: true, max: 3, placeholder: "選屬性", onChange: (v) => save({ stack: v }) });

        const soul = row("玩法（soul）· 一行一句").r;
        const lines = [...c.how, ...Array(SOUL_LINES).fill("")].slice(0, SOUL_LINES);
        const soulInputs = lines.map((l) => text(soul, l, SOUL_MAX, () => {
            const v = soulInputs.map((i) => i.value.trim()).filter(Boolean);
            save({ soul: v.length > 1 ? v : v[0] ?? "" });
        }));

        const focus = row("主力（focus）· 只有一招是重點時").r.createEl("select");
        for (const k of ["", ...KEYS]) focus.createEl("option", { text: k || "（無）", attr: { value: k } });
        focus.value = c.focus;
        focus.addEventListener("change", () => save({ focus: focus.value }));

        const plain = row("技能白話（plain）").r;
        const plainInputs: Record<string, HTMLInputElement> = {};
        for (const k of KEYS) {
            const s = c.skills.find((x) => x.key === k);
            const line = plain.createDiv({ cls: "mn-pk-skill" });
            pic(line, s ? { name: s.name, img: s.icon } : undefined, "mn-pk-skic");
            line.createSpan({ cls: "mn-pk-key", text: k });
            const input = line.createEl("input", { attr: { type: "text", placeholder: s?.name ?? "" } });
            input.value = c.plain[k] ?? "";
            plainInputs[k] = input;
            input.addEventListener("change", () => {
                const v: Record<string, string> = {};
                for (const key of KEYS) if (plainInputs[key].value.trim()) v[key] = plainInputs[key].value.trim();
                save({ plain: v });
            });
        }
        const open = form.createEl("button", { cls: "mn-inb-del", text: "打開英雄筆記" });
        open.addEventListener("click", () => void plugin.app.workspace.openLinkText(c.path, ctx.sourcePath, true));
    };

    const choices = all.map((c) => ({ name: c.name, img: c.icon, also: `${c.nameEn} ${c.aliases.join(" ")}` }));
    const byName = new Map(all.map((c) => [c.name, c]));
    const current = all.find((c) => c.id === chosen.get(ctx.sourcePath));
    const drawPicker = (c: Champion | undefined) => {
        pickHost.empty();
        picker(pickHost, { choices, value: c ? [c.name] : [], placeholder: "選一位英雄", onChange: (v) => show(byName.get(v[0])) });
    };
    next.addEventListener("click", () => {
        const at = all.findIndex((c) => c.id === chosen.get(ctx.sourcePath));
        const c = [...all.slice(at + 1), ...all.slice(0, at + 1)].find((x) => statusOf(x) !== "已驗證");
        drawPicker(c);
        show(c);
    });
    counted();
    drawPicker(current);
    show(current);
}

export function registerPicksNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-picks", (_source, el, ctx) => picksBlock(plugin, el, ctx));
}
