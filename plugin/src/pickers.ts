import { setIcon } from "obsidian";

// A picker for the note editors (inbox, 速查卡片): the chosen ones as chips with their picture and name (× takes one out), and a box that
// opens a list of matches with picture and name while you type (or as soon as it is tapped). One choice or several; with `max` the order
// counts and the chips are numbered (前三件). Values are names; the field keeps them joined with 「、」. The list is a grid of pictures
// with their names; with several choices it stays open while you pick, and the change is handed on once it closes (a save redraws a
// note's editor, which would close it after every pick).
export interface Choice { name: string; img?: string; icon?: string; color?: string; also?: string; group?: string }   // img: a picture URL; icon: a Lucide name; also: other words it is found by; group: a heading it sits under in the list
export interface PickerOpts { choices: Choice[]; value: string[]; multi?: boolean; max?: number; placeholder?: string; onChange: (v: string[]) => void }

export const splitNames = (s: string | undefined): string[] => (s ?? "").split(/[、,，]/).map((x) => x.trim()).filter(Boolean);

export const pic = (parent: HTMLElement, c: Choice | undefined, cls: string): void => {
    const box = parent.createSpan({ cls });
    // a background, not an <img>: the theme's rules for pictures in notes would stretch an <img> to the width of the line
    if (c?.img) { box.addClass("has-img"); box.style.backgroundImage = `url("${c.img}")`; }
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
    let pending = false;   // picks made while the list is open, handed on when it closes
    const set = (v: string[], now = true) => { value = v; drawChips(); if (now) o.onChange(value); else pending = true; };
    const close = () => { list.removeClass("is-open"); if (pending) { pending = false; o.onChange(value); } };
    const drawChips = () => {
        chips.empty();
        value.forEach((n, i) => {
            const chip = chips.createDiv({ cls: "mn-pick-chip" });
            if (o.max && o.multi) chip.createSpan({ cls: "mn-pick-no", text: String(i + 1) });
            pic(chip, byName.get(n), "mn-pick-pic");
            chip.createSpan({ text: n });
            const x = chip.createSpan({ cls: "mn-pick-x" });
            setIcon(x, "x");
            x.addEventListener("click", (e) => { e.stopPropagation(); set(value.filter((_, j) => j !== i), !list.hasClass("is-open")); });
        });
        chips.toggleClass("is-empty", !value.length);
        input.toggleClass("is-hidden", full());
    };
    const drawList = () => {
        list.empty();
        const q = input.value.trim().toLowerCase();
        const hits = o.choices.filter((c) => !value.includes(c.name) && (!q || c.name.toLowerCase().includes(q) || (c.also ?? "").toLowerCase().includes(q)));   // all of them: the grid scrolls
        list.toggleClass("is-open", document.activeElement === input && hits.length > 0);
        let group = "";
        for (const c of hits) {
            if (c.group && c.group !== group) { group = c.group; list.createDiv({ cls: "mn-pick-group", text: group }); }   // a heading across the grid
            const row = list.createDiv({ cls: "mn-pick-opt" });
            pic(row, c, "mn-pick-pic");
            row.createSpan({ text: c.name });
            // a tap picks (a finger that scrolls the grid does not); the list keeps the box focused (see the mousedown below)
            row.addEventListener("click", (e) => {
                e.preventDefault();
                input.value = "";
                if (o.multi) {
                    set([...value, c.name], false);
                    if (full()) { input.blur(); close(); } else drawList();
                } else { set([c.name]); list.removeClass("is-open"); input.blur(); }
            });
        }
    };
    list.addEventListener("mousedown", (e) => e.preventDefault());   // a press in the list leaves the focus in the box, so it does not close
    input.addEventListener("focus", drawList);
    input.addEventListener("input", drawList);
    input.addEventListener("blur", () => window.setTimeout(close, 120));
    drawChips();
    return root;
}
