import { App, Platform, PluginSettingTab, Setting } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { MODES, MODE_ORDER, ModeId } from "./modes";
import { THEMES } from "./themes";
import { haptic } from "./ui";

export interface MnSettings {
    mode: ModeId;
    theme: string;             // colour theme id (themes.ts)
    championFolder: string;   // vault-relative folders holding the generated notes (tools/fetch_data.py)
    itemFolder: string;
    guideFolder: string;
    augmentFolder: string;
    patchFolder: string;
    openOnStartup: boolean;
    read: string[];            // guide cards you have opened (their note paths)
    roster: string[];          // the champions picked in Quick Look (ids), at most 15
    riotId: string;            // your Riot ID (Name#TAG) for Home; kept in this device's settings only (data.json is git-ignored)
    riotServer: string;        // the platform, e.g. TW2
    wallpaper: string;         // Home's background, "<champion id>_<skin number>"; empty: your top mastery champion's newest skin
}

export const DEFAULTS: MnSettings = {
    mode: "mayhem",
    theme: "popping",
    // where the notes live: the only place the plugin names these folders (tools/vault_paths.py does the same for the scripts)
    championFolder: "英雄",
    itemFolder: "道具",
    guideFolder: "新手入門",
    augmentFolder: "強化",
    patchFolder: "版本更新",
    openOnStartup: Platform.isMobile,
    riotId: "",
    riotServer: "TW2",
    wallpaper: "",
    read: [],
    roster: [],
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
        new Setting(c).setName("Color theme").setDesc("Colors of the app screen. Follows Obsidian's light / dark.")
            .addDropdown((d) => {
                for (const t of THEMES) d.addOption(t.id, t.name);
                d.setValue(s.theme).onChange(async (v) => { s.theme = v; await save(); });
            });
        const folder = (name: string, desc: string, key: "championFolder" | "itemFolder" | "guideFolder" | "augmentFolder" | "patchFolder") =>
            new Setting(c).setName(name).setDesc(desc)
                .addText((x) => x.setValue(s[key]).onChange(async (v) => { s[key] = v.trim() || DEFAULTS[key]; await save(); }));
        folder("Champion folder", "Notes made by tools/fetch_data.py", "championFolder");
        folder("Item folder", "Notes made by tools/fetch_data.py", "itemFolder");
        folder("Augment folder", "Notes made by tools/fetch_augments.py", "augmentFolder");
        folder("Patch notes folder", "Our own patch notes (frontmatter: patch, date, title, summary)", "patchFolder");
        folder("Guide folder", "Beginner guide notes", "guideFolder");
        new Setting(c).setName("Open on startup").setDesc("Show the app when Obsidian starts (on by default on a phone).")
            .addToggle((x) => x.setValue(s.openOnStartup).onChange(async (v) => { s.openOnStartup = v; await save(); }));
        // which way this phone gives the tick on the button bars, if any (see haptic in ui.ts)
        const hap = new Setting(c).setName("Test haptic").setDesc("Tap: the phone should tick once.");
        hap.addButton((b) => b.setButtonText("Tick").onClick(() => {
            const how = haptic();
            hap.setDesc({ capacitor: "Used: Obsidian's haptics.", vibrate: "Used: web vibration.", switch: "Used: the iOS 18 switch tick. Felt nothing? Then Obsidian has no haptics here.", "": "No haptics found on this device." }[how] ?? how);
        }));
    }
}
