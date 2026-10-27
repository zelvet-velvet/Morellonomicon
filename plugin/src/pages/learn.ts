import { empty, group, page, row } from "../ui";
import type { PageCtx, PageOut } from "./index";

// Learn: a short beginner course, one card per note in the guide folder (frontmatter: order, icon, summary).
export function learnPage(ctx: PageCtx): PageOut {
    const el = page("Learn");
    const notes = ctx.plugin.store.guideNotes();
    if (!notes.length) { empty(el, { icon: "graduation-cap", title: "Nothing here yet", text: "Guide notes go in the guide folder." }); return { title: "Learn", el }; }
    const g = group(el);
    for (const n of notes) row(g, { icon: n.icon, title: n.title, sub: n.summary || undefined, chevron: true, onTap: () => ctx.openNote(n.file.path) });
    return { title: "Learn", el };
}
