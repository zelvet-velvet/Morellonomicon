// A game mode is the one switch that changes what the app shows. Mayhem is built first; Rift has its slot so that
// adding it later means filling in `enabled`, the item filter and the per-mode sections, not restructuring the app.
export type ModeId = "mayhem" | "rift";
export type TabId = "champions" | "augments" | "learn";

export interface ModeDef {
    id: ModeId;
    label: string;            // also the label of the first tab (English UI)
    icon: string;             // Lucide icon name
    enabled: boolean;         // false: shown in the switcher as "coming soon"
    itemFlag: "aram" | "rift"; // which item note frontmatter flag the Items tab filters on
    tabs: TabId[];            // tab order for this mode
}

export const MODES: Record<ModeId, ModeDef> = {
    mayhem: { id: "mayhem", label: "Mayhem", icon: "zap", enabled: true, itemFlag: "aram", tabs: ["champions", "augments", "learn"] },
    rift: { id: "rift", label: "Rift", icon: "map", enabled: false, itemFlag: "rift", tabs: ["champions", "learn"] },
};
export const MODE_ORDER: ModeId[] = ["mayhem", "rift"];

export const TAB_LABEL: Record<TabId, string> = { champions: "Champions", augments: "Augments", learn: "Learn" };
export const TAB_ICON: Record<TabId, string> = { champions: "users", augments: "sparkles", learn: "graduation-cap" };
