import type { App } from "obsidian";
import type { TabId } from "./modes";

// One page of a tab's stack. The tab's first page is { key: "root" }.
export interface Frame { key: string; title: string; params?: Record<string, string | number> }

interface Saved { tab: TabId; stacks: Partial<Record<TabId, Frame[]>>; t: number }
const KEY = "morellonomicon-nav";
const STACK_TTL = 30 * 60 * 1000;   // reopened within 30 minutes (the phone reloaded Obsidian in the background): the same tab and page; later: a cold start on Home

// Which tab is open and the page stack of every tab. Plain state, no DOM.
export class Router {
    tab: TabId = "home";
    private stacks: Partial<Record<TabId, Frame[]>> = {};

    constructor(private app: App) {
        try {
            const s = this.app.loadLocalStorage(KEY) as Saved | null;
            // like any phone app: coming back soon after leaving shows the same tab and page; a cold start opens Home
            if (s && Date.now() - s.t < STACK_TTL) { this.tab = s.tab; this.stacks = s.stacks ?? {}; }
        } catch { /* fresh start */ }
    }

    // the open tab must exist in the current mode
    fix(tabs: TabId[]): void { if (!tabs.includes(this.tab)) this.tab = tabs.includes("home") ? "home" : (tabs[0] ?? "home"); }

    reset(): void { this.stacks = {}; this.save(); }
    stack(tab: TabId = this.tab): Frame[] { return (this.stacks[tab] ??= []); }
    top(tab: TabId = this.tab): Frame { const s = this.stack(tab); return s[s.length - 1] ?? { key: "root", title: "" }; }
    depth(tab: TabId = this.tab): number { return this.stack(tab).length; }

    setTab(tab: TabId): void { this.tab = tab; this.save(); }
    push(f: Frame): boolean {
        if (this.top().key === f.key && JSON.stringify(this.top().params) === JSON.stringify(f.params)) return false;   // a double tap must not push twice
        this.stack().push(f);
        this.save();
        return true;
    }
    pop(): boolean { if (!this.depth()) return false; this.stack().pop(); this.save(); return true; }
    popToRoot(): boolean { if (!this.depth()) return false; this.stacks[this.tab] = []; this.save(); return true; }

    private save(): void {
        try { this.app.saveLocalStorage(KEY, { tab: this.tab, stacks: this.stacks, t: Date.now() } satisfies Saved); } catch { /* ignore */ }
    }
}
