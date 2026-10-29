import { ItemView, Menu, Platform, WorkspaceLeaf } from "obsidian";
import type MorellonomiconPlugin from "./main";
import { MODES, MODE_ORDER, TAB_ICON, TAB_LABEL, TabId } from "./modes";
import { THEMES, themeVars } from "./themes";
import { PageOut, renderPage } from "./pages";
import { rememberSub } from "./pages/champions";
import type { Frame } from "./router";
import { autoLoading, empty, h, icon, preloadRoleIcons, releaseVideos, slideSeg, whenLoaded } from "./ui";

export const VIEW_TYPE = "morellonomicon";

// The app screen: top bar (back, title, mode switch), page area, tab bar. A page is drawn in one step when a tab, a detail page
// or the data changes; scroll positions are kept per page so Back returns to where you were.
const OVERLAY_PAGES = new Set(["champion"]);
const IMMERSIVE_PAGES = new Set(["rosterswipe"]);   // full screen: no top bar at all (速查's swipe, like Tinder)
const OVERLAY_SCROLL = 220;   // px scrolled before the top bar gets its background back over a splash
const ARRIVE_MS = 240;

// A picture that arrives after its page is on screen (a card built later, a lazy one) stays clear, then fades in
function fadeIn(im: HTMLImageElement): void {
    if (!im.src || im.complete) return;
    im.addClass("is-loading");
    const shown = () => im.removeClass("is-loading");
    im.addEventListener("load", shown, { once: true });
    im.addEventListener("error", shown, { once: true });
}
const VEIL_DELAY_MS = 250;   // a later page waits this long for its pictures before it shows under the loading veil
const VEIL_MIN_MS = 500;     // and once shown it stays at least this long
const BOOT_PICTURES_MS = 7000;   // at start-up the first page may wait this long for its icons (the first time they come over the network)
const PAGE_WAIT_MS = 2500;   // a page shows its loading look this long at most while the pictures at its top arrive

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
        const loading = autoLoading(app);   // every picture fades in, big ones with the block loading look (ui.ts)
        this.register(() => loading.disconnect());
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
        // the phone's keyboard: while a floating search capsule (Picks, Champions) is being typed in, it is pinned to the bottom of
        // the part of the screen that is still visible, like Safari's bar. The visible part is window.visualViewport: iOS either pans the
        // page or shrinks Obsidian for the keyboard, and the app itself (fixed to the large viewport) does not change, so the capsule is
        // placed from the visible part, not from the app. --mn-vvbottom is that part's bottom edge (styles.css: .is-kb)
        const vv = window.visualViewport;
        const place = () => { if (vv) app.style.setProperty("--mn-vvbottom", `${Math.round(vv.offsetTop + vv.height)}px`); };
        const typing = (e: FocusEvent) => (e.target as HTMLElement | null)?.closest?.(".mn-rq-dock") != null;
        this.registerDomEvent(app, "focusin", (e) => { if (!typing(e)) return; place(); app.addClass("is-kb"); });
        this.registerDomEvent(app, "focusout", (e) => { if (typing(e)) app.removeClass("is-kb"); });
        // when the page neither pans nor shrinks, the app's own keyboard event (Obsidian's Capacitor shell) says how tall the keyboard is
        const shown = (e: Event) => {
            const kh = (e as Event & { keyboardHeight?: number }).keyboardHeight ?? 0;
            if (kh > 0 && vv && vv.offsetTop + vv.height >= window.innerHeight - 1) app.style.setProperty("--mn-vvbottom", `${Math.round(window.innerHeight - kh)}px`);
        };
        window.addEventListener("keyboardWillShow", shown);
        window.addEventListener("keyboardDidShow", shown);
        window.addEventListener("keyboardWillHide", place);
        this.register(() => { window.removeEventListener("keyboardWillShow", shown); window.removeEventListener("keyboardDidShow", shown); window.removeEventListener("keyboardWillHide", place); });
        if (vv) {
            vv.addEventListener("resize", place);
            vv.addEventListener("scroll", place);
            this.register(() => { vv.removeEventListener("resize", place); vv.removeEventListener("scroll", place); });
        }
        this.registerDomEvent(this.scrollEl, "scroll", () => this.markScrolled(), { passive: true });
        // pictures added to a page after it showed (cards built later, lazy ones) fade in instead of popping in
        const late = new MutationObserver((list) => {
            for (const m of list) m.addedNodes.forEach((n) => {
                if (n instanceof HTMLImageElement) fadeIn(n);
                else if (n instanceof HTMLElement) n.querySelectorAll("img").forEach(fadeIn);
            });
        });
        late.observe(this.scrollEl, { childList: true, subtree: true });
        this.register(() => late.disconnect());
        this.tabsEl = h(app, "div", "mn-tabs");
        this.applyTheme();
        this.registerEvent(this.app.workspace.on("css-change", () => this.applyTheme()));   // Obsidian switched light / dark
        preloadRoleIcons();   // class icons for the role filters, fetched up front
        this.buildTabs();
        this.draw();
    }

    async onClose(): Promise<void> { this.scrolls.clear(); }

    private modeBtn!: HTMLElement;
    private veil: HTMLElement | null = null;
    private veilSince = 0;   // the loading veil over the page area
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
        slideSeg(this.tabsEl, "main-tabs", { item: ".mn-tab" });   // one glass pill behind the chosen tab slides and can be dragged
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
        this.router.popToRoot();   // leaving a tab resets it: coming back shows its main page, not the page left open
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

    // The loading veil: a layer the size of the page area that blurs what is under it, with a band of light sliding across
    private showVeil(immediate: boolean): void {
        const place = () => {
            const v = this.veil;
            if (!v) return;
            v.style.top = `${this.scrollEl.offsetTop}px`;
            v.style.left = `${this.scrollEl.offsetLeft}px`;
            v.style.width = `${this.scrollEl.clientWidth}px`;
            v.style.height = `${this.scrollEl.clientHeight}px`;
        };
        if (!this.veil) {
            this.veil = h(this.appEl, "div", "mn-artload is-page");
            this.veilSince = Date.now();
            place();
            if (immediate) this.veil.addClass("is-in is-instant"); else requestAnimationFrame(() => this.veil?.addClass("is-in"));
        }
        place();
        requestAnimationFrame(place);   // the app may not have been laid out yet on the very first frame
    }
    private hideVeil(): void {
        const v = this.veil;
        if (!v) return;
        this.veil = null;
        v.removeClass("is-instant");
        v.removeClass("is-in");   // the blur fades out
        window.setTimeout(() => v.remove(), 450);
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
        // the page shows once the pictures at its top have loaded (or after PAGE_WAIT_MS), so it does not appear with empty frames
        const page = out;
        const show = () => {
            if (id !== this.drawId) return;   // another page was asked for meanwhile
            // forget the old page's scrolled state first: restoring the scroll below lays the new page out at once, and a stale
            // "scrolled" would draw the title row's bottom line and then fade it out (a blink)
            this.appEl.addClass("is-switching");   // and no fades while the classes flip: a line fading out on the new page reads as a blink
            this.appEl.removeClass("has-scrolled");
            this.topEl.removeClass("is-scrolled");
            releaseVideos(this.scrollEl);   // the clips of the page being left give back their decoders
            this.scrollEl.replaceChildren(page.el);
            this.shown = key;
            // a page opened on top of another, and a champion page (its splash sits under the top bar) always start at the top; the
            // others (a tab, a page you come back to) are where you left them
            const fresh = anim === "push" || OVERLAY_PAGES.has(f.key);
            if (fresh) this.scrolls.delete(key);
            // "instant": a smooth scroll still running from the page left (a skill card scrolled into view) must not carry on in this one
            this.scrollEl.scrollTo({ top: fresh ? 0 : (this.scrolls.get(key) ?? 0), left: 0, behavior: "instant" as ScrollBehavior });   // never a sideways offset from the previous page
            this.titleEl.textContent = page.title;
            const titleRow = this.router.depth() === 0 ? page.el.querySelector(":scope > .mn-title-row") : null;
            (titleRow ?? this.topEl).appendChild(this.actsEl);
            this.actsEl.toggleClass("is-hidden", !titleRow);   // only a tab's first page has them
            this.topEl.toggleClass("has-back", this.router.depth() > 0);
            // a champion page puts its splash under the top bar (Back floats on the picture) until it scrolls past it
            this.appEl.toggleClass("is-overlay", OVERLAY_PAGES.has(f.key));
            this.appEl.toggleClass("is-immersive", IMMERSIVE_PAGES.has(f.key));
            this.appEl.toggleClass("is-float", this.router.depth() === 0);
            this.appEl.toggleClass("is-sub", this.router.depth() > 0 && !OVERLAY_PAGES.has(f.key));   // Back sits on the title's line   // a tab's first page: no empty strip above its big title
            this.markScrolled();
            requestAnimationFrame(() => requestAnimationFrame(() => this.appEl.removeClass("is-switching")));
            if (anim === "none") return;
            arrive(page.el, anim);
        };
        // A page no longer waits for its pictures behind a page-wide veil (a tinted layer that blocked taps and, with the band gone from it,
        // looked like a block of colour): its blocks load on their own. Only a page that says so (`ready`) is waited for.
        const wait = page.ready ?? null;
        // Start-up: the page shows at once under the loading veil, which stays up (and survives the page being rebuilt as the data
        // arrives) until the data has settled and the first pictures are in; no sharp half-loaded page shows between.
        if (!this.plugin.booted) {
            show();
            // the pictures are checked once the data has settled, on the page as it is then (it may have been rebuilt meanwhile)
            this.holdVeil(page, this.plugin.whenBooted().then(() => (page.ready === undefined ? whenLoaded(page.el, BOOT_PICTURES_MS) : page.ready)).then(() => undefined), id);
            return;
        }
        if (!wait || anim === "none") { show(); this.hideVeil(); return; }
        // A page with pictures to wait for: the old page stays for a quarter second. If the pictures are in by then the new page
        // shows complete (no blur, nothing popping in); if not, it shows under the veil until they are, and keeps it at least half a second.
        const quick = Promise.race([wait.then(() => true), new Promise<boolean>((r) => window.setTimeout(() => r(false), VEIL_DELAY_MS))]);
        void quick.then((loaded) => {
            if (id !== this.drawId) return;
            show();
            if (loaded) this.hideVeil(); else this.holdVeil(page, wait, id);
        });
    }

    // Puts the loading veil over the page until `until`, then (never sooner than half a second after it appeared) takes it off
    private holdVeil(page: PageOut, until: Promise<void>, id: number): void {
        page.el.addClass("mn-loading");
        this.showVeil(true);
        void until.then(() => {
            page.el.removeClass("mn-loading");
            if (id !== this.drawId) return;   // another page was asked for meanwhile; it decides what happens to the veil
            window.setTimeout(() => { if (id === this.drawId) this.hideVeil(); }, Math.max(0, VEIL_MIN_MS - (Date.now() - this.veilSince)));
        });
    }
}
