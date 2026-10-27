import { TFile, normalizePath } from "obsidian";
import type MorellonomiconPlugin from "../main";
import { MODES, ModeId } from "../modes";

type FM = Record<string, unknown>;

// What tools/fetch_data.py writes into a champion note's frontmatter (plus the hand-written pinned / avoid / video)
export interface Champion {
    id: string; key: number; name: string; title: string; roles: string[]; damageType: string; skillDamage: string[];
    archetypes: string[]; features: string[]; resource: string; attack: number; magic: number; defense: number; difficulty: number;
    range: number; icon: string; skills: Skill[]; patch: string; pinned: string[]; avoid: string[]; video?: string;
    builds: Build[]; tips: Tip[]; path: string;
}
export interface SkillRow { label: string; vals: string[]; note: string }   // one value per rank, or one value for all ranks
// A hand-written build in a champion note: kind meta (a normal build), alt (fun / other play style) or synergy (with teammates in `with`)
export interface Build { kind: "meta" | "alt" | "synergy"; mode: string; name: string; items: number[]; note: string; with: string[] }
export interface Tip { title: string; text: string; video: string }
// What tools/fetch_builds.py counts from real matches (_data/builds.<mode>.json)
export interface Count { id: number; games: number; wins: number }
export interface ChampStats { games: number; wins: number; items: Count[]; sets: { items: number[]; games: number; wins: number }[]; augments: Count[] }
export interface BuildStats { mode: string; queue: number; date: string; matches: number; champions: Record<string, ChampStats> }
export interface Skill { key: string; name: string; damage: string[]; icon: string; desc: string; upgrade: string; range: string; rows: SkillRow[] }
export interface Augment { id: number; name: string; rarity: string; icon: string; effect: string; fits: string[]; tier: string; path: string }
export interface Item {
    id: number; name: string; tags: string[]; desc: string; goldTotal: number; aram: boolean; rift: boolean; icon: string; variantOf?: string; path: string;
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
const rowList = (v: unknown): SkillRow[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ label: str(o.label), vals: list(o.vals), note: str(o.note) }] : [];
}) : []);
const numList = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
const buildList = (v: unknown): Build[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return [];
    const kind = o.kind === "alt" || o.kind === "synergy" ? o.kind : "meta";
    return [{ kind, mode: str(o.mode, "mayhem"), name: str(o.name), items: numList(o.items), note: str(o.note), with: list(o.with) }];
}) : []);
const tipList = (v: unknown): Tip[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ title: str(o.title), text: str(o.text), video: str(o.video) }] : [];
}) : []);
const skillList = (v: unknown): Skill[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), icon: str(o.icon), desc: str(o.desc), upgrade: str(o.upgrade), range: str(o.range), rows: rowList(o.rows) }] : [];
}) : []);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Reads come from Obsidian's metadata cache (instant, no Dataview). Parsed lists are kept until a note in the folders changes.
export class Store {
    private champs: Champion[] | null = null;
    private its: Item[] | null = null;
    private augs: Augment[] | null = null;
    stats: BuildStats | null = null;

    constructor(private plugin: MorellonomiconPlugin) {}
    private get app() { return this.plugin.app; }
    private get s() { return this.plugin.settings; }

    // The counted builds for the current mode, if tools/fetch_builds.py has made them (read from the vault's _data folder)
    async loadStats(mode: ModeId = this.s.mode): Promise<void> {
        try {
            const path = normalizePath(`_data/builds.${mode}.json`);
            this.stats = (await this.app.vault.adapter.exists(path)) ? (JSON.parse(await this.app.vault.adapter.read(path)) as BuildStats) : null;
        } catch { this.stats = null; }
    }

    invalidate(): void { this.champs = null; this.its = null; this.augs = null; }
    inData(path: string): boolean {
        const s = this.s;
        return path.startsWith("_data/") || [s.championFolder, s.itemFolder, s.guideFolder, s.augmentFolder].some((f) => path.startsWith(normalizePath(f) + "/"));
    }

    private notes(folder: string): { file: TFile; fm: FM }[] {
        const prefix = normalizePath(folder) + "/";
        const out: { file: TFile; fm: FM }[] = [];
        for (const file of this.app.vault.getMarkdownFiles()) {
            if (!file.path.startsWith(prefix)) continue;
            out.push({ file, fm: (this.app.metadataCache.getFileCache(file)?.frontmatter as FM | undefined) ?? {} });
        }
        return out;
    }

    champions(): Champion[] {
        if (!this.champs) {
            this.champs = this.notes(this.s.championFolder).filter((n) => n.fm.type === "champion").map(({ file, fm }) => ({
                id: str(fm.id), key: num(fm.key), name: str(fm.name, file.basename), title: str(fm.title), roles: list(fm.roles), damageType: str(fm.damage_type),
                skillDamage: list(fm.skill_damage), archetypes: [...list(fm.archetypes), ...list(fm.archetypes_extra)], features: list(fm.features),
                resource: str(fm.resource), attack: num(fm.attack), magic: num(fm.magic), defense: num(fm.defense), difficulty: num(fm.difficulty),
                range: num(fm.range), icon: str(fm.icon), skills: skillList(fm.skills), patch: str(fm.patch), pinned: list(fm.pinned), avoid: list(fm.avoid),
                video: typeof fm.video === "string" ? fm.video : undefined, builds: buildList(fm.builds), tips: tipList(fm.tips), path: file.path,
            })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
        }
        return this.champs;
    }
    champion(id: string): Champion | undefined { return this.champions().find((c) => c.id === id); }

    // Items of the current mode's shop
    items(): Item[] {
        if (!this.its) {
            this.its = this.notes(this.s.itemFolder).filter((n) => n.fm.type === "item").map(({ file, fm }) => ({
                id: num(fm.id), name: str(fm.name, file.basename), tags: list(fm.tags), desc: str(fm.desc), goldTotal: num(fm.gold_total), aram: fm.aram === true,
                rift: fm.rift === true, icon: str(fm.icon), variantOf: typeof fm.variant_of === "string" ? fm.variant_of : undefined, path: file.path,
            })).sort((a, b) => a.goldTotal - b.goldTotal || a.name.localeCompare(b.name, "zh-Hant"));
        }
        return this.its;
    }
    modeItems(): Item[] {
        const flag = MODES[this.s.mode].itemFlag;
        return this.items().filter((i) => i[flag]);
    }
    item(id: number): Item | undefined { return this.items().find((i) => i.id === id); }

    augments(): Augment[] {
        if (!this.augs) {
            this.augs = this.notes(this.s.augmentFolder).filter((n) => n.fm.type === "augment").map(({ file, fm }) => ({
                id: num(fm.id), name: str(fm.name, file.basename), rarity: str(fm.rarity), icon: str(fm.icon), effect: str(fm.effect),
                fits: list(fm.fits), tier: str(fm.tier), path: file.path,
            })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
        }
        return this.augs;
    }

    // The Learn cards: notes in the guide folder, ordered by their `order` (then name); `icon` and `summary` come from frontmatter
    guideNotes(): { file: TFile; title: string; icon: string; summary: string; order: number }[] {
        return this.notes(this.s.guideFolder).map(({ file, fm }) => ({ file, title: file.basename, icon: str(fm.icon, "file-text"), summary: str(fm.summary), order: num(fm.order, 99) }))
            .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hant"));
    }
}
