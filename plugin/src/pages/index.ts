import type { App } from "obsidian";
import type MorellonomiconPlugin from "../main";
import type { Frame } from "../router";
import type { TabId } from "../modes";
import { championsPage } from "./champions";
import { guidePage } from "./guide";
import { homePage } from "./home";
import { itemsPage } from "./items";

export interface PageOut { title: string; el: HTMLElement }
export interface PageCtx {
    app: App;
    plugin: MorellonomiconPlugin;
    frame: Frame;
    push(f: Frame): void;
    pop(): void;
    goTab(id: TabId): void;       // jump to another tab's first page
    openNote(path: string): void; // open a note in its own Obsidian tab
}
export type PageRender = (ctx: PageCtx) => PageOut;

// One renderer per tab. A page branches on the mode (ctx.plugin.settings.mode) where Mayhem and Rift differ.
export const PAGES: Record<TabId, PageRender> = {
    home: homePage,
    champions: championsPage,
    items: itemsPage,
    guide: guidePage,
};
