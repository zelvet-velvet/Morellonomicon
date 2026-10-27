import { empty, group, page, row } from "../ui";
import type { PageCtx, PageOut } from "./index";

// The beginner guide: one row per note in the guide folder.
export function guidePage(ctx: PageCtx): PageOut {
    const el = page("Guide");
    const notes = ctx.plugin.store.guideNotes();
    if (!notes.length) { empty(el, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." }); return { title: "Guide", el }; }
    const g = group(el);
    for (const n of notes) row(g, { icon: "file-text", title: n.basename, chevron: true, onTap: () => ctx.openNote(n.path) });
    return { title: "Guide", el };
}
