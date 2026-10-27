import { Platform, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { Store } from "./data/store";
import { Router } from "./router";
import { DEFAULTS, MnSettingTab, MnSettings } from "./settings";
import { MnView, VIEW_TYPE } from "./view";

export default class MorellonomiconPlugin extends Plugin {
    settings: MnSettings = { ...DEFAULTS };
    router!: Router;
    store!: Store;
    private dataTimer = 0;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.router = new Router(this.app);
        this.store = new Store(this);
        this.registerView(VIEW_TYPE, (leaf) => new MnView(leaf, this));
        this.addRibbonIcon("book-open", "Open Morellonomicon", () => { void this.activate(false); });
        this.addCommand({ id: "open", name: "Open Morellonomicon", callback: () => { void this.activate(false); } });
        this.addSettingTab(new MnSettingTab(this.app, this));

        // A champion / item / guide note changed: redraw once for a burst of changes (e.g. a sync or a fetch_data run)
        const onFile = (file: TAbstractFile, oldPath?: string) => {
            if (this.store.inData(file.path) || (oldPath && this.store.inData(oldPath))) this.dataChanged();
        };
        this.registerEvent(this.app.metadataCache.on("changed", (f) => onFile(f)));
        this.registerEvent(this.app.vault.on("delete", (f) => onFile(f)));
        this.registerEvent(this.app.vault.on("rename", (f, old) => onFile(f, old)));
        this.registerEvent(this.app.metadataCache.on("resolved", () => this.dataChanged()));

        this.app.workspace.onLayoutReady(() => { if (this.settings.openOnStartup) void this.activate(true); });
    }

    onunload(): void { window.clearTimeout(this.dataTimer); }

    views(): MnView[] {
        return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v): v is MnView => v instanceof MnView);
    }

    private dataChanged(): void {
        window.clearTimeout(this.dataTimer);
        this.dataTimer = window.setTimeout(() => { this.store.invalidate(); this.views().forEach((v) => v.refresh()); }, 300);
    }

    // Show the app: the existing screen if there is one, else in the current tab (start-up, phone) or a new tab (desktop).
    async activate(startup: boolean): Promise<void> {
        const ws = this.app.workspace;
        let leaf: WorkspaceLeaf | null = ws.getLeavesOfType(VIEW_TYPE)[0] ?? null;
        if (!leaf) {
            leaf = ws.getLeaf(startup || Platform.isMobile ? false : "tab");
            await leaf.setViewState({ type: VIEW_TYPE, active: true });
        }
        await ws.revealLeaf(leaf);
        ws.setActiveLeaf(leaf, { focus: true });
    }

    // A note in a tab of its own; a tab that already shows it is brought forward instead of opening a second one
    async openPath(path: string): Promise<void> {
        const f = this.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) return;
        const ws = this.app.workspace;
        const open = ws.getLeavesOfType("markdown").find((l) => (l.view as { file?: TFile }).file?.path === path);
        if (open) { await ws.revealLeaf(open); ws.setActiveLeaf(open, { focus: false }); return; }
        await ws.getLeaf("tab").openFile(f, { state: { mode: "preview" } });
    }

    async loadSettings(): Promise<void> {
        this.settings = { ...DEFAULTS, ...((await this.loadData()) as Partial<MnSettings> | null) };
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.views().forEach((v) => v.refresh(true));
    }
}
