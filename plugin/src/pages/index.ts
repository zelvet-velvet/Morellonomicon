import type { App, Component } from "obsidian";
import type MorellonomiconPlugin from "../main";
import type { Frame } from "../router";
import type { TabId } from "../modes";
import { augmentsPage } from "./augments";
import { championCard, championsPage, type SubTab } from "./champions";
import { augmentPage, itemPage, notePage } from "./detail";
import { handbookPage } from "./handbook";
import { gamesPage, homePage, itemsPage } from "./home";
import { patchPage } from "./patch";
import { rosterPage, swipePage } from "./roster";

// `ready`: a page that knows better than the default (the first pictures) what it waits for before it shows
export interface PageOut { title: string; el: HTMLElement; ready?: Promise<void> | null }
export interface PageCtx {
    app: App;
    plugin: MorellonomiconPlugin;
    component: Component;          // owns what a page renders (markdown notes)
    frame: Frame;
    push(f: Frame): void;
    pop(): void;
    goTab(id: TabId): void;        // jump to another tab's first page
    // every detail opens as a page of the app on top of the current tab (Back returns to where you were)
    openChampion(id: string, sub?: SubTab): void;
    openAugment(id: number): void;
    openItem(id: number): void;
    openNote(path: string): void;  // a note, drawn inside the app
}
export type PageRender = (ctx: PageCtx) => PageOut;

// One renderer per tab (its first page).
export const PAGES: Record<TabId, PageRender> = {
    home: homePage,
    champions: championsPage,
    picks: rosterPage,   // 速查: pick the champions the game gave you, then swipe through them
    augments: augmentsPage,
    patch: patchPage,
    handbook: handbookPage,
};

// Detail pages can be reached from any tab, so they are chosen by the frame before the tab's own page.
export function renderPage(tab: TabId, ctx: PageCtx): PageOut {
    switch (ctx.frame.key) {
        case "champion": return championCard(ctx);
        case "augment": return augmentPage(ctx);
        case "item": return itemPage(ctx);
        case "note": return notePage(ctx);
        case "roster": return rosterPage(ctx);
        case "championlist": return championsPage(ctx);
        case "games": return gamesPage(ctx);
        case "itemlist": return itemsPage(ctx);   // the Champions page, opened from Home
        case "rosterswipe": return swipePage(ctx);
        default: return PAGES[tab](ctx);
    }
}
