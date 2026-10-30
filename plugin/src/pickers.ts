import { setIcon } from "obsidian";

// A picker for the note editors (inbox, 速查卡片): the chosen ones as chips with their picture and name (× takes one out), and a box that
// opens a list of matches with picture and name while you type (or as soon as it is tapped). One choice or several; with `max` the order
// counts and the chips are numbered (前三件). Values are names; the field keeps them joined with 「、」.
export interface Choice { name: string; img?: string; icon?: string; color?: string; also?: string }   // img: a picture URL; icon: a Lucide name; also: other words it is found by
export interface PickerOpts { choices: Choice[]; value: string[]; multi?: boolean; max?: number; placeholder?: string; onChange: (v: string[]) => void }
const LIMIT = 40;   // matches shown at once

export const splitNames = (s: string | undefined): string[] => (s ?? "").split(/[、,，]/).map((x) => x.trim()).filter(Boolean);

const pic = (parent: HTMLElement, c: Choice | undefined, cls: string): void => {
    const box = parent.createSpan({ cls });
    if (c?.img) box.createEl("img", { attr: { src: c.img, alt: "" } });
    else if (c?.icon) { setIcon(box, c.icon); if (c.color) box.style.color = c.color; }
};

export function picker(parent: HTMLElement, o: PickerOpts): HTMLElement {
    const root = parent.createDiv({ cls: "mn-pick" });
    const byName = new Map(o.choices.map((c) => [c.name, c]));
    let value = [...o.value];
    const chips = root.createDiv({ cls: "mn-pick-chips" });
    const input = root.createEl("input", { cls: "mn-pick-in", attr: { type: "text", placeholder: o.placeholder ?? "搜尋…", spellcheck: "false", autocomplete: "off" } });
    const list = root.createDiv({ cls: "mn-pick-list" });
    const full = () => !o.multi ? false : !!o.max && value.length >= o.max;
    const set = (v: string[]) => { value = v; drawChips(); o.onChange(value); };
    const drawChips = () => {
        chips.empty();
        value.forEach((n, i) => {
            const chip = chips.createDiv({ cls: "mn-pick-chip" });
            if (o.max && o.multi) chip.createSpan({ cls: "mn-pick-no", text: String(i + 1) });
            pic(chip, byName.get(n), "mn-pick-pic");
            chip.createSpan({ text: n });
            const x = chip.createSpan({ cls: "mn-pick-x" });
            setIcon(x, "x");
            x.addEventListener("click", (e) => { e.stopPropagation(); set(value.filter((_, j) => j !== i)); });
        });
        chips.toggleClass("is-empty", !value.length);
        input.toggleClass("is-hidden", full());
    };
    const drawList = () => {
        list.empty();
        const q = input.value.trim().toLowerCase();
        const hits = o.choices.filter((c) => !value.includes(c.name) && (!q || c.name.toLowerCase().includes(q) || (c.also ?? "").toLowerCase().includes(q))).slice(0, LIMIT);
        list.toggleClass("is-open", document.activeElement === input && hits.length > 0);
        for (const c of hits) {
            const row = list.createDiv({ cls: "mn-pick-opt" });
            pic(row, c, "mn-pick-pic");
            row.createSpan({ text: c.name });
            // pointerdown, not click: the box loses its focus on the way and would close the list first
            row.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                input.value = "";
                set(o.multi ? [...value, c.name] : [c.name]);
                if (o.multi && !full()) drawList(); else { list.removeClass("is-open"); input.blur(); }
            });
        }
    };
    input.addEventListener("focus", drawList);
    input.addEventListener("input", drawList);
    input.addEventListener("blur", () => window.setTimeout(() => list.removeClass("is-open"), 120));
    drawChips();
    return root;
}
