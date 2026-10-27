// A game mode is the one switch that changes what the app shows. Mayhem is built first; Rift has its slot so that
// adding it later means filling in `enabled`, the item filter and the per-mode sections, not restructuring the app.
export type ModeId = "mayhem" | "rift";
export type TabId = "home" | "champions" | "items" | "guide";

export interface ModeDef {
    id: ModeId;
    label: string;            // also the label of the first tab (English UI)
    icon: string;             // Lucide icon name
    enabled: boolean;         // false: shown in the switcher as "coming soon"
    itemFlag: "aram" | "rift"; // which item note frontmatter flag the Items tab filters on
    tabs: TabId[];            // tab order for this mode
}

export const MODES: Record<ModeId, ModeDef> = {
    mayhem: { id: "mayhem", label: "Mayhem", icon: "zap", enabled: true, itemFlag: "aram", tabs: ["home", "champions", "items", "guide"] },
    rift: { id: "rift", label: "Rift", icon: "map", enabled: false, itemFlag: "rift", tabs: ["home", "champions", "items", "guide"] },
};
export const MODE_ORDER: ModeId[] = ["mayhem", "rift"];

export const TAB_LABEL: Record<Exclude<TabId, "home">, string> = { champions: "Champions", items: "Items", guide: "Guide" };
export const TAB_ICON: Record<Exclude<TabId, "home">, string> = { champions: "users", items: "package", guide: "book-open" };
