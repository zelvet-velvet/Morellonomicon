import { ItemView, Menu, Platform, WorkspaceLeaf } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { MODES, MODE_ORDER, TAB_ICON, TAB_LABEL, TabId } from "./modes";
import { THEMES, themeVars } from "./themes";
import { PageOut, renderPage } from "./pages";
import { rememberSub } from "./pages/champions";
import type { Frame } from "./router";
import { empty, h, icon, preloadRoleIcons, slideSeg } from "./ui";

export const VIEW_TYPE = "morellonomicon";

// The app screen: top bar (back, title, mode switch), page area, tab bar. A page is drawn in one step when a tab, a detail page
// or the data changes; scroll positions are kept per page so Back returns to where you were.
const OVERLAY_PAGES = new Set(["champion"]);
const OVERLAY_SCROLL = 220;   // px scrolled before the top bar gets its background back over a splash
const ARRIVE_MS = 240;

// Pictures in the first screen of a page that have not loaded yet, each as a promise that settles when it loads or fails
function fadeInImages(page: HTMLElement): void {
    for (const im of page.querySelectorAll<HTMLImageElement>("img")) {
        if (!im.src || im.complete) continue;
        im.addClass("is-loading");
        const shown = () => im.removeClass("is-loading");
        im.addEventListener("load", shown, { once: true });
        im.addEventListener("error", shown, { once: true });
    }
}

function arrive(page: HTMLElement, anim: "push" | "back" | "tab"): void {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !page.animate) return;
    const from = anim === "push" ? "translateX(28px)" : anim === "back" ? "translateX(-28px)" : "translateY(10px)";
    page.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: ARRIVE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
}

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
        this.actsEl = acts;
        const themeBtn = h(acts, "button", "mn-btn");
        themeBtn.setAttribute("aria-label", "Color theme");
        icon(themeBtn, "palette");
        themeBtn.addEventListener("click", (e) => { e.preventDefault(); this.themeMenu(e); });
        const modeBtn = h(acts, "button", "mn-btn");
        modeBtn.setAttribute("aria-label", "Mode");
        modeBtn.addEventListener("click", (e) => { e.preventDefault(); this.modeMenu(e); });
        this.modeBtn = modeBtn;
        this.scrollEl = h(app, "div", "mn-scroll");
        this.registerDomEvent(this.scrollEl, "scroll", () => this.markScrolled(), { passive: true });
        this.tabsEl = h(app, "div", "mn-tabs");
        this.applyTheme();
        this.registerEvent(this.app.workspace.on("css-change", () => this.applyTheme()));   // Obsidian switched light / dark
        preloadRoleIcons();   // class icons for the role filters, fetched up front
        this.buildTabs();
        this.draw();
    }

    async onClose(): Promise<void> { this.scrolls.clear(); }

    private modeBtn!: HTMLElement;
    private drawId = 0;
    private markScrolled(): void {
        const past = this.appEl.hasClass("is-overlay") ? OVERLAY_SCROLL : 36;
        this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > past);
        this.appEl.toggleClass("has-scrolled", this.scrollEl.scrollTop > 4);   // a pinned title row shows its bottom line once the page moves
    }
    private actsEl!: HTMLElement;   // theme and mode buttons: in the big title row of a tab's first page, in the top bar elsewhere

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
        slideSeg(this.tabsEl, "main-tabs", { item: ".mn-tab", fit: ".mn-ic" });   // a pill under the chosen tab's icon slides and can be dragged
        this.modeBtn.empty();
        icon(this.modeBtn, MODES[this.plugin.settings.mode].icon);
    }

    private markTab(): void { this.tabsEl.querySelectorAll<HTMLElement>(".mn-tab").forEach((b) => b.toggleClass("is-on", b.dataset.tab === this.router.tab)); }

    tapTab(id: TabId): void {
        if (id === this.router.tab) {
            if (this.router.popToRoot()) this.draw("back");
            else this.scrollEl.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        this.router.setTab(id);
        this.markTab();
        this.draw("tab");
    }
    goTab(id: TabId): void { this.router.popToRoot(); if (id !== this.router.tab) this.tapTab(id); else this.draw("tab"); }
    push(f: Frame): void { if (this.router.push(f)) this.draw("push"); }
    back(): void { if (this.router.pop()) this.draw("back"); }

    // Data or settings changed: redraw from scratch (the mode may have changed the tabs)
    refresh(resetStack = false): void {
        if (resetStack) this.router.reset();
        this.applyTheme();
        preloadRoleIcons();   // class icons for the role filters, fetched up front
        this.buildTabs();
        this.draw();
    }

    // How a new page arrives: slides in from the right (deeper), from the left (back), or rises in (another tab); "none" for a refresh
    draw(anim: "none" | "push" | "back" | "tab" = "none"): void {
        const id = ++this.drawId;
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
        // forget the old page's scrolled state first: restoring the scroll below lays the new page out at once, and a stale
        // "scrolled" would draw the title row's bottom line and then fade it out (a blink)
        this.appEl.addClass("is-switching");   // and no fades while the classes flip: a line fading out on the new page reads as a blink
        this.appEl.removeClass("has-scrolled");
        this.topEl.removeClass("is-scrolled");
        this.scrollEl.replaceChildren(out.el);
        this.shown = key;
        this.scrollEl.scrollTop = this.scrolls.get(key) ?? 0;
        this.scrollEl.scrollLeft = 0;   // never carry a sideways offset from the previous page
        this.titleEl.textContent = out.title;
        const titleRow = this.router.depth() === 0 ? out.el.querySelector(":scope > .mn-title-row") : null;
        (titleRow ?? this.topEl).appendChild(this.actsEl);
        this.actsEl.toggleClass("is-hidden", !titleRow);   // only a tab's first page has them
        this.topEl.toggleClass("has-back", this.router.depth() > 0);
        // a champion page puts its splash under the top bar (Back floats on the picture) until it scrolls past it
        this.appEl.toggleClass("is-overlay", OVERLAY_PAGES.has(f.key));
        this.appEl.toggleClass("is-float", this.router.depth() === 0);
        this.appEl.toggleClass("is-sub", this.router.depth() > 0 && !OVERLAY_PAGES.has(f.key));   // Back sits on the title's line   // a tab's first page: no empty strip above its big title
        this.markScrolled();
        requestAnimationFrame(() => requestAnimationFrame(() => this.appEl.removeClass("is-switching")));
        if (anim === "none") return;
                // the page comes in at once; a picture still loading stays clear and fades in when it arrives (hiding the whole page
        // until then made a quick load blink: blank, then the page)
        fadeInImages(out.el);
        arrive(out.el, anim);
    }
}
