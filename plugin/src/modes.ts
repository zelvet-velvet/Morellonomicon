// A game mode is the one switch that changes what the app shows. Mayhem is built first; Rift has its slot so that
// adding it later means filling in `enabled`, the item filter and the per-mode sections, not restructuring the app.
export type ModeId = "mayhem" | "rift";
export type TabId = "champions" | "picks" | "augments" | "patch" | "handbook";

export interface ModeDef {
    id: ModeId;
    label: string;            // also the label of the first tab (English UI)
    icon: string;             // Lucide icon name
    enabled: boolean;         // false: shown in the switcher as "coming soon"
    itemFlag: "aram" | "rift"; // which item note frontmatter flag the Items tab filters on
    tabs: TabId[];            // tab order for this mode
}

export const MODES: Record<ModeId, ModeDef> = {
    mayhem: { id: "mayhem", label: "Mayhem", icon: "zap", enabled: true, itemFlag: "aram", tabs: ["augments", "patch", "champions", "picks", "handbook"] },
    rift: { id: "rift", label: "Rift", icon: "map", enabled: false, itemFlag: "rift", tabs: ["patch", "champions", "handbook"] },
};
export const MODE_ORDER: ModeId[] = ["mayhem", "rift"];

export const TAB_LABEL: Record<TabId, string> = { champions: "Champions", picks: "Picks", augments: "Augments", patch: "Patch", handbook: "Handbook" };
export const TAB_ICON: Record<TabId, string> = { champions: "users", picks: "clipboard-edit", augments: "sparkles", patch: "newspaper", handbook: "book-open" };
