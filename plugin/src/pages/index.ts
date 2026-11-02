import type { App, Component } from "obsidian";
import type MorellonomiconPlugin from "../main";
import type { Frame } from "../router";
import type { TabId } from "../modes";
import type { Need } from "../media";
import { augmentsPage } from "./augments";
import { championCard, championNeeds, championPart, championsPage, type SubTab } from "./champions";
import { augmentNeeds, augmentPage, itemNeeds, itemPage, noteNeeds, notePage } from "./detail";
import { handbookNeeds, handbookNext, handbookPage } from "./handbook";
import { gamesPage, homeNeeds, homePage, itemsPage } from "./home";
import { patchPage } from "./patch";
import { picksNeeds, rosterPage, swipeNeeds, swipePage } from "./roster";

// `ready`: a page that knows better than the default (the first pictures) what it waits for before it shows
export interface PageOut { title: string; el: HTMLElement; ready?: Promise<void> | null; immersive?: boolean; art?: string }   // immersive: full screen, no top bar; art: a picture behind the page, darkened, that does not scroll (the champion page family's sub pages)
export interface PageCtx {
    app: App;
    plugin: MorellonomiconPlugin;
    component: Component;          // owns what a page renders (markdown notes)
    frame: Frame;
    push(f: Frame): void;
    pop(): void;
    goTab(id: TabId): void;        // jump to another tab's first page
    redraw(): void;                // draw this page again where it is (new data for it), without the page animation
    // every detail opens as a page of the app on top of the current tab (Back returns to where you were)
    openChampion(id: string, sub?: SubTab): void;
    openAugment(id: number, champ?: string): void;   // champ: opened from that champion (its page then says how it fits)
    openItem(id: number): void;
    openNote(path: string): void;  // a note, drawn inside the app
}
export type PageRender = (ctx: PageCtx) => PageOut;

// What a page shows from the network, for fetching it ahead (media.ts, Design Rules "Fetch ahead"): the big pictures at its top, the
// art behind it, its first clips. Icons of champions, augments and items are fetched at start-up and need not be listed.
export interface NeedCtx { app: App; plugin: MorellonomiconPlugin }
export type Needs = (n: NeedCtx, frame: Frame) => Need[] | Promise<Need[]>;
// Every page is a route: how it is drawn, what it needs, and (optionally) the pages one tap away whose needs are fetched while it is on
// screen. A page cannot be added without saying what it needs: ROUTES is typed over every page key, so a missing entry does not compile.
export interface Route { render: PageRender; needs: Needs; next?: (n: NeedCtx, frame: Frame) => Frame[] }
const none: Needs = () => [];

// The tabs' first pages, then the pages that can be opened from any tab (chosen by the frame's key before the tab's own page)
type DetailKey = "champion" | "augment" | "item" | "note" | "roster" | "championlist" | "games" | "itemlist" | "rosterswipe" | "champpart";
export type PageKey = TabId | DetailKey;
export const ROUTES: Record<PageKey, Route> = {
    home: { render: homePage, needs: homeNeeds },
    champions: { render: championsPage, needs: none },   // the champion icons: start-up
    picks: { render: rosterPage, needs: picksNeeds },     // 速查: your hand's portraits; a new pick's portrait comes on touch, its card art on pick
    augments: { render: augmentsPage, needs: none },
    patch: { render: patchPage, needs: none },           // the patch notes' pictures load lazily, further down the page
    handbook: { render: handbookPage, needs: handbookNeeds, next: handbookNext },
    champion: { render: championCard, needs: championNeeds },
    champpart: { render: championPart, needs: championNeeds },
    augment: { render: augmentPage, needs: augmentNeeds },
    item: { render: itemPage, needs: itemNeeds },
    note: { render: notePage, needs: noteNeeds },
    roster: { render: rosterPage, needs: picksNeeds },
    championlist: { render: championsPage, needs: none },
    games: { render: gamesPage, needs: none },
    itemlist: { render: itemsPage, needs: none },        // the Items page, opened from Home
    rosterswipe: { render: swipePage, needs: swipeNeeds },
};
export const PAGES: Record<TabId, PageRender> = { home: homePage, champions: championsPage, picks: rosterPage, augments: augmentsPage, patch: patchPage, handbook: handbookPage };

// The route of a frame in a tab: a detail page by its key, else the tab's first page
export function routeKey(tab: TabId, frame: Frame): PageKey { return frame.key in ROUTES && frame.key !== "root" ? (frame.key as PageKey) : tab; }
export function renderPage(tab: TabId, ctx: PageCtx): PageOut { return ROUTES[routeKey(tab, ctx.frame)].render(ctx); }
