import { ItemView, Menu, Platform, WorkspaceLeaf } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { MODES, MODE_ORDER, TAB_ICON, TAB_LABEL, TabId } from "./modes";
import { THEMES, themeVars } from "./themes";
import { PageOut, renderPage } from "./pages";
import { rememberSub } from "./pages/champions";
import type { Frame } from "./router";
import { empty, h, icon } from "./ui";

export const VIEW_TYPE = "morellonomicon";

// The app screen: top bar (back, title, mode switch), page area, tab bar. A page is drawn in one step when a tab, a detail page
// or the data changes; scroll positions are kept per page so Back returns to where you were.
export class MnView extends ItemView {
    private appEl!: HTMLElement;
    private topEl!: HTMLElement;
    private backEl!: HTMLButtonElement;
    private titleEl!: HTMLElement;
    private scrollEl!: HTMLElement;
    private tabsEl!: HTMLElement;
    private scrolls = new Map<string, number>();
    private shown = "";

    constructor(leaf: WorkspaceLeaf, private plugin: MorellonomiconPlugin) { super(leaf); }

    getViewType(): string { return VIEW_TYPE; }
    getDisplayText(): string { return "Morellonomicon"; }
    getIcon(): string { return "book-open"; }

    private get router() { return this.plugin.router; }
    private key(): string { return `${this.plugin.settings.mode}/${this.router.tab}/${this.router.top().key}/${JSON.stringify(this.router.top().params ?? {})}`; }

    async onOpen(): Promise<void> {
        const c = this.contentEl;
        c.empty();
        c.addClass("mn-host");
        const app = h(c, "div", "mn-app");
        this.appEl = app;
        app.toggleClass("is-full", Platform.isMobile);   // phone: the app covers the display and adds the status-bar space itself
        this.topEl = h(app, "div", "mn-top");
        this.backEl = h(this.topEl, "button", "mn-btn mn-back");
        icon(this.backEl, "chevron-left");
        this.backEl.addEventListener("click", (e) => { e.preventDefault(); this.back(); });
        this.titleEl = h(this.topEl, "div", "mn-top-title");
        const acts = h(this.topEl, "div", "mn-acts");
        const themeBtn = h(acts, "button", "mn-btn");
        themeBtn.setAttribute("aria-label", "Color theme");
        icon(themeBtn, "palette");
        themeBtn.addEventListener("click", (e) => { e.preventDefault(); this.themeMenu(e); });
        const modeBtn = h(acts, "button", "mn-btn");
        modeBtn.setAttribute("aria-label", "Mode");
        modeBtn.addEventListener("click", (e) => { e.preventDefault(); this.modeMenu(e); });
        this.modeBtn = modeBtn;
        this.scrollEl = h(app, "div", "mn-scroll");
        this.registerDomEvent(this.scrollEl, "scroll", () => this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > 36), { passive: true });
        this.tabsEl = h(app, "div", "mn-tabs");
        this.applyTheme();
        this.registerEvent(this.app.workspace.on("css-change", () => this.applyTheme()));   // Obsidian switched light / dark
        this.buildTabs();
        this.draw();
    }

    async onClose(): Promise<void> { this.scrolls.clear(); }

    private modeBtn!: HTMLElement;

    // The chosen colour theme as variables on the app element (none = Obsidian's own colours)
    applyTheme(): void {
        for (const name of this.themed) this.appEl.style.removeProperty(name);
        const vars = themeVars(this.plugin.settings.theme, document.body.hasClass("theme-dark"));
        this.themed = Object.keys(vars);
        for (const [k, v] of Object.entries(vars)) this.appEl.style.setProperty(k, v);
    }
    private themed: string[] = [];

    private themeMenu(e: MouseEvent): void {
        const menu = new Menu();
        for (const t of THEMES) menu.addItem((i) => i.setTitle(t.name).setChecked(this.plugin.settings.theme === t.id).onClick(() => { this.plugin.settings.theme = t.id; void this.plugin.saveTheme(); }));
        menu.showAtMouseEvent(e);
    }

    private modeMenu(e: MouseEvent): void {
        const menu = new Menu();
        for (const id of MODE_ORDER) {
            const m = MODES[id];
            menu.addItem((i) => i.setTitle(m.label + (m.enabled ? "" : " (coming soon)")).setIcon(m.icon).setChecked(this.plugin.settings.mode === id).setDisabled(!m.enabled)
                .onClick(() => { this.plugin.settings.mode = id; void this.plugin.saveSettings(); }));
        }
        menu.showAtMouseEvent(e);
    }

    private tabLabel(id: TabId): string { return TAB_LABEL[id]; }
    private tabIcon(id: TabId): string { return TAB_ICON[id]; }

    buildTabs(): void {
        const tabs = MODES[this.plugin.settings.mode].tabs;
        this.router.fix(tabs);
        this.tabsEl.empty();
        this.tabsEl.style.setProperty("--n", String(tabs.length));
        for (const id of tabs) {
            const b = h(this.tabsEl, "button", "mn-tab" + (id === this.router.tab ? " is-on" : ""));
            b.dataset.tab = id;
            icon(b, this.tabIcon(id));
            h(b, "span", "mn-tab-l", this.tabLabel(id));
            b.addEventListener("click", (e) => { e.preventDefault(); this.tapTab(id); });
        }
        this.modeBtn.empty();
        icon(this.modeBtn, MODES[this.plugin.settings.mode].icon);
    }

    private markTab(): void { this.tabsEl.querySelectorAll<HTMLElement>(".mn-tab").forEach((b) => b.toggleClass("is-on", b.dataset.tab === this.router.tab)); }

    tapTab(id: TabId): void {
        if (id === this.router.tab) {
            if (this.router.popToRoot()) this.draw();
            else this.scrollEl.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        this.router.setTab(id);
        this.markTab();
        this.draw();
    }
    goTab(id: TabId): void { this.router.popToRoot(); if (id !== this.router.tab) this.tapTab(id); else this.draw(); }
    push(f: Frame): void { if (this.router.push(f)) this.draw(); }
    back(): void { if (this.router.pop()) this.draw(); }

    // Data or settings changed: redraw from scratch (the mode may have changed the tabs)
    refresh(resetStack = false): void {
        if (resetStack) this.router.reset();
        this.applyTheme();
        this.buildTabs();
        this.draw();
    }

    draw(): void {
        if (this.shown) this.scrolls.set(this.shown, this.scrollEl.scrollTop);
        const key = this.key();
        const f = this.router.top();
        let out: PageOut;
        try {
            const store = this.plugin.store;
            out = renderPage(this.router.tab, {
                app: this.app, plugin: this.plugin, component: this, frame: f, push: (x) => this.push(x), pop: () => this.back(), goTab: (id) => this.goTab(id),
                openChampion: (id, sub) => { if (sub) rememberSub(id, sub); this.push({ key: "champion", title: store.champion(id)?.name ?? id, params: { id } }); },
                openAugment: (id) => this.push({ key: "augment", title: store.augment(id)?.name ?? "Augment", params: { id } }),
                openItem: (id) => this.push({ key: "item", title: store.item(id)?.name ?? "Item", params: { id } }),
                openNote: (path) => this.push({ key: "note", title: path.split("/").pop()?.replace(/\.md$/, "") ?? "Note", params: { path } }),
            });
        } catch (e) {
            const el = h(null, "div", "mn-page");
            empty(el, { icon: "alert-triangle", title: "This page could not be drawn", text: String(e instanceof Error ? e.message : e).slice(0, 200) });
            out = { title: "Error", el };
        }
        this.scrollEl.replaceChildren(out.el);
        this.shown = key;
        this.scrollEl.scrollTop = this.scrolls.get(key) ?? 0;
        this.titleEl.textContent = out.title;
        this.topEl.toggleClass("has-back", this.router.depth() > 0);
        this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > 36);
    }
}
