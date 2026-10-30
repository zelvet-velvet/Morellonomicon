import { MarkdownPostProcessorContext, Notice, TFile, setIcon } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { Choice, picker, splitNames } from "./pickers";

// The inbox notes (Inbox/技巧.md, Inbox/玩法出裝.md) are editors, like the Layouts note: a ```mn-inbox block holds the
// entries as JSON ({"kind": "tip" | "build", "entries": [...]}) and is drawn as cards; tap a card to edit it in a form, + 新增 adds
// one. A field saves when you leave it. "Process the inbox" (LLM Guide) reads the entries and removes the ones turned into cards.
type Kind = "tip" | "build";
// champ / items: a picker with pictures and names (pickers.ts); multi for several, max when the order counts
interface Field { key: string; label: string; type: "text" | "area" | "select" | "date" | "champ" | "items"; options?: string[]; multi?: boolean; max?: number; hint?: string }
type Entry = Record<string, string>;
interface Box { kind: Kind; entries: Entry[] }

const MODES = ["大混戰", "峽谷"];
const STATUS = ["待驗證", "已驗證"];
const FIELDS: Record<Kind, Field[]> = {
    tip: [
        { key: "hero", label: "英雄", type: "champ" },
        { key: "mode", label: "模式", type: "select", options: MODES },
        { key: "type", label: "類型", type: "select", options: ["技巧", "出裝", "有趣出裝", "搭配"] },
        { key: "title", label: "標題", type: "text" },
        { key: "text", label: "內容", type: "area" },
        { key: "items", label: "出裝", type: "items", multi: true },
        { key: "with", label: "搭配英雄", type: "champ", multi: true },
        { key: "patch", label: "版本", type: "text", hint: "26.21 或 16.21；不確定寫 ?" },
        { key: "date", label: "日期", type: "date" },
        { key: "source", label: "來源", type: "text", hint: "頻道名稱 + 網址" },
        { key: "status", label: "狀態", type: "select", options: STATUS },
    ],
    build: [
        { key: "style", label: "玩法", type: "text" },
        { key: "mode", label: "模式", type: "select", options: MODES },
        { key: "items", label: "前三件", type: "items", multi: true, max: 3, hint: "照購買順序" },
        { key: "why", label: "為什麼", type: "area" },
        { key: "champs", label: "適合的英雄", type: "champ", multi: true, hint: "舉幾個就好" },
        { key: "patch", label: "版本", type: "text" },
        { key: "date", label: "日期", type: "date" },
        { key: "source", label: "來源", type: "text", hint: "網站和網址（數字不照抄）" },
        { key: "status", label: "狀態", type: "select", options: STATUS },
    ],
};
const opened = new Map<string, string>();   // note path -> the entry open in its form (kept while the block is redrawn after a save)
const uid = () => Math.random().toString(36).slice(2, 8);

const parse = (source: string): Box | null => {
    if (!source.trim()) return { kind: "tip", entries: [] };
    try {
        const v = JSON.parse(source) as Partial<Box>;
        return { kind: v.kind === "build" ? "build" : "tip", entries: Array.isArray(v.entries) ? v.entries : [] };
    } catch { return null; }
};
// one entry per line, so a change shows as one changed line in git
const serialise = (b: Box): string =>
    `{"kind": "${b.kind}", "entries": [` + (b.entries.length ? "\n" + b.entries.map((e) => "  " + JSON.stringify(e)).join(",\n") + "\n" : "") + "]}";

function inboxBlock(plugin: MorellonomiconPlugin, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const box = parse(source);
    const root = el.createDiv({ cls: "mn-inb" });
    if (!box) { root.createDiv({ cls: "mn-lay-err", text: "The inbox data could not be read (JSON). Fix it in the source view." }); return; }
    const fields = FIELDS[box.kind];
    const write = () => {
        const info = ctx.getSectionInfo(el);
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!info || !(file instanceof TFile)) { new Notice("Could not save the inbox"); return; }
        void plugin.app.vault.process(file, (data) => {
            const lines = data.split("\n");
            lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...serialise(box).split("\n"));
            return lines.join("\n");
        });
    };
    // what the pickers offer: champions (found by their English name too), and the items of the entry's mode (one per name)
    const champs: Choice[] = plugin.store.champions().map((c) => ({ name: c.name, img: c.icon, also: `${c.nameEn} ${c.aliases.join(" ")}` }));
    // the items worth naming in a build: legendary (made from parts, builds into nothing more) first, then epic (made from parts and
    // still building into something: a champion may sit on one, e.g. for Kai'Sa's evolutions); no parts, starters or potions. One per name.
    const itemsFor = (mode: string): Choice[] => {
        const seen = new Set<string>(), legendary: Choice[] = [], epic: Choice[] = [];
        for (const i of [...plugin.store.items()].reverse()) {   // the dearest first
            if ((mode === "峽谷" ? !i.rift : !i.aram) || !i.from.length || seen.has(i.name)) continue;
            seen.add(i.name);
            (i.into.length ? epic : legendary).push({ name: i.name, img: i.icon, group: i.into.length ? "中階" : "傳說" });
        }
        return [...legendary, ...epic];
    };

    const bar = root.createDiv({ cls: "mn-inb-bar" });
    bar.createSpan({ cls: "mn-inb-count", text: box.entries.length ? `${box.entries.length} 筆待整理` : "還沒有東西，按 + 新增" });
    const add = bar.createEl("button", { cls: "mn-inb-add" });
    setIcon(add.createSpan(), "plus");
    add.createSpan({ text: "新增" });
    add.addEventListener("click", () => {
        const e: Entry = { id: uid(), mode: MODES[0], status: STATUS[0], date: window.moment().format("YYYY-MM-DD"), patch: plugin.store.currentPatch() };
        if (box.kind === "tip") e.type = "技巧";
        box.entries.unshift(e);
        opened.set(ctx.sourcePath, e.id);
        write();
    });

    for (const e of box.entries) {
        if (!e.id) e.id = uid();
        const card = root.createDiv({ cls: "mn-inb-card" });
        const head = card.createDiv({ cls: "mn-inb-head" });
        const who = head.createDiv({ cls: "mn-inb-who" });
        const top = box.kind === "tip" ? [e.hero || "（英雄）", e.type, e.mode] : [e.style || "（玩法）", e.mode];
        who.createDiv({ cls: "mn-inb-t", text: top.filter(Boolean).join(" · ") });
        const sub = box.kind === "tip" ? (e.title || e.text || "") : (e.items || e.why || "");
        if (sub) who.createDiv({ cls: "mn-inb-s", text: sub });
        head.createSpan({ cls: "mn-inb-st" + (e.status === "已驗證" ? " is-ok" : ""), text: e.status || STATUS[0] });
        const form = card.createDiv({ cls: "mn-inb-form" });
        const isOpen = opened.get(ctx.sourcePath) === e.id;
        card.toggleClass("is-open", isOpen);
        head.addEventListener("click", () => {
            const now = !card.hasClass("is-open");
            root.querySelectorAll(".mn-inb-card.is-open").forEach((c) => c.removeClass("is-open"));
            card.toggleClass("is-open", now);
            if (now) opened.set(ctx.sourcePath, e.id); else opened.delete(ctx.sourcePath);
        });
        for (const f of fields) {
            const row = form.createDiv({ cls: "mn-inb-row" });
            row.createDiv({ cls: "mn-inb-l", text: f.label });
            if (f.type === "champ" || f.type === "items") {
                picker(row, {
                    choices: f.type === "champ" ? champs : itemsFor(e.mode || MODES[0]), value: splitNames(e[f.key]), multi: f.multi, max: f.max,
                    placeholder: f.hint ?? (f.type === "champ" ? "搜尋英雄" : "搜尋裝備"),
                    onChange: (v) => { if (v.length) e[f.key] = v.join("、"); else delete e[f.key]; write(); },
                });
                continue;
            }
            let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (f.type === "select") {
                input = row.createEl("select");
                for (const o of f.options ?? []) input.createEl("option", { text: o, attr: { value: o } });
                input.value = e[f.key] || f.options?.[0] || "";
            } else if (f.type === "area") {
                input = row.createEl("textarea", { attr: { rows: "4" } });
                input.value = e[f.key] ?? "";
            } else {
                input = row.createEl("input", { attr: { type: f.type === "date" ? "date" : "text", spellcheck: "false" } });
                input.value = e[f.key] ?? "";
            }
            if (f.hint) input.setAttr("placeholder", f.hint);
            // saved when the field is left (a save redraws the block, so not while typing)
            input.addEventListener("change", () => {
                const v = input.value.trim();
                if ((e[f.key] ?? "") === v) return;
                if (v) e[f.key] = v; else delete e[f.key];
                write();
            });
        }
        const del = form.createEl("button", { cls: "mn-inb-del", text: "刪除這一筆" });
        let armed = false;
        del.addEventListener("click", () => {
            if (!armed) { armed = true; del.setText("再按一次刪除"); del.addClass("is-armed"); window.setTimeout(() => { armed = false; del.setText("刪除這一筆"); del.removeClass("is-armed"); }, 2500); return; }
            box.entries = box.entries.filter((x) => x !== e);
            write();
        });
    }
}

export function registerInboxNote(plugin: MorellonomiconPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor("mn-inbox", (source, el, ctx) => inboxBlock(plugin, source, el, ctx));
}
