import { MODES } from "../modes";
import { group, page, row } from "../ui";
import { augmentsPage } from "./augments";
import { championPicker } from "./champions";
import type { PageCtx, PageOut } from "./index";

// The first screen is the thing you need mid-game: pick your champion. Mode-specific shortcuts sit under the picker.
export function homePage(ctx: PageCtx): PageOut {
    if (ctx.frame.key === "augments") return augmentsPage(ctx);
    const mode = MODES[ctx.plugin.settings.mode];
    const el = page(mode.id === "mayhem" ? "Who are you playing?" : "Summoner's Rift");
    if (!mode.enabled) {
        row(group(el), { icon: "construction", title: "Rift is not built yet", sub: "Switch to Mayhem (top right).", muted: true });
        return { title: mode.label, el };
    }
    championPicker(el, ctx, false);
    const g = group(el);
    row(g, { icon: "sparkles", title: "Augments", chevron: true, onTap: () => ctx.push({ key: "augments", title: "Augments" }) });
    row(g, { icon: "flame", title: "Combos", value: "Soon", muted: true });
    row(g, { icon: "package", title: "ARAM items", chevron: true, onTap: () => ctx.goTab("items") });
    return { title: mode.label, el };
}
