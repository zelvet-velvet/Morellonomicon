import { App, Platform, PluginSettingTab, Setting } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { MODES, MODE_ORDER, ModeId } from "./modes";

export interface MnSettings {
    mode: ModeId;
    championFolder: string;   // vault-relative folders holding the generated notes (tools/fetch_data.py)
    itemFolder: string;
    guideFolder: string;
    augmentFolder: string;
    openOnStartup: boolean;
}

export const DEFAULTS: MnSettings = {
    mode: "mayhem",
    championFolder: "英雄",
    itemFolder: "道具",
    guideFolder: "新手入門",
    augmentFolder: "強化",
    openOnStartup: Platform.isMobile,
};

export class MnSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: MorellonomiconPlugin) { super(app, plugin); }

    display(): void {
        const { containerEl: c } = this;
        const s = this.plugin.settings;
        const save = () => this.plugin.saveSettings();
        c.empty();
        new Setting(c).setName("Mode").setDesc("What the app shows. Rift is planned.")
            .addDropdown((d) => {
                for (const id of MODE_ORDER) d.addOption(id, MODES[id].label + (MODES[id].enabled ? "" : " (coming soon)"));
                d.setValue(s.mode).onChange(async (v) => { s.mode = v as ModeId; await save(); });
            });
        const folder = (name: string, desc: string, key: "championFolder" | "itemFolder" | "guideFolder" | "augmentFolder") =>
            new Setting(c).setName(name).setDesc(desc)
                .addText((x) => x.setValue(s[key]).onChange(async (v) => { s[key] = v.trim() || DEFAULTS[key]; await save(); }));
        folder("Champion folder", "Notes made by tools/fetch_data.py", "championFolder");
        folder("Item folder", "Notes made by tools/fetch_data.py", "itemFolder");
        folder("Augment folder", "Notes made by tools/fetch_augments.py", "augmentFolder");
        folder("Guide folder", "Beginner guide notes", "guideFolder");
        new Setting(c).setName("Open on startup").setDesc("Show the app when Obsidian starts (on by default on a phone).")
            .addToggle((x) => x.setValue(s.openOnStartup).onChange(async (v) => { s.openOnStartup = v; await save(); }));
    }
}
