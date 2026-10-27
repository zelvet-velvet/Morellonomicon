import { TFile, normalizePath } from "obsidian";
import type MorellonomiconPlugin from "../main";
import { MODES } from "../modes";

type FM = Record<string, unknown>;

// What tools/fetch_data.py writes into a champion note's frontmatter (plus the hand-written pinned / avoid / video)
export interface Champion {
    id: string; name: string; title: string; roles: string[]; damageType: string; skillDamage: string[];
    archetypes: string[]; features: string[]; resource: string; attack: number; magic: number; defense: number; difficulty: number;
    range: number; icon: string; skills: Skill[]; patch: string; pinned: string[]; avoid: string[]; video?: string; path: string;
}
export interface Skill { key: string; name: string; damage: string[]; icon: string }
export interface Item {
    id: number; name: string; tags: string[]; goldTotal: number; aram: boolean; rift: boolean; icon: string; variantOf?: string; path: string;
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
const skillList = (v: unknown): Skill[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), icon: str(o.icon) }] : [];
}) : []);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Reads come from Obsidian's metadata cache (instant, no Dataview). Parsed lists are kept until a note in the folders changes.
export class Store {
    private champs: Champion[] | null = null;
    private its: Item[] | null = null;

    constructor(private plugin: MorellonomiconPlugin) {}
    private get app() { return this.plugin.app; }
    private get s() { return this.plugin.settings; }

    invalidate(): void { this.champs = null; this.its = null; }
    inData(path: string): boolean {
        const s = this.s;
        return [s.championFolder, s.itemFolder, s.guideFolder].some((f) => path.startsWith(normalizePath(f) + "/"));
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
                id: str(fm.id), name: str(fm.name, file.basename), title: str(fm.title), roles: list(fm.roles), damageType: str(fm.damage_type),
                skillDamage: list(fm.skill_damage), archetypes: [...list(fm.archetypes), ...list(fm.archetypes_extra)], features: list(fm.features),
                resource: str(fm.resource), attack: num(fm.attack), magic: num(fm.magic), defense: num(fm.defense), difficulty: num(fm.difficulty),
                range: num(fm.range), icon: str(fm.icon), skills: skillList(fm.skills), patch: str(fm.patch), pinned: list(fm.pinned), avoid: list(fm.avoid),
                video: typeof fm.video === "string" ? fm.video : undefined, path: file.path,
            })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
        }
        return this.champs;
    }
    champion(id: string): Champion | undefined { return this.champions().find((c) => c.id === id); }

    // Items of the current mode's shop
    items(): Item[] {
        if (!this.its) {
            this.its = this.notes(this.s.itemFolder).filter((n) => n.fm.type === "item").map(({ file, fm }) => ({
                id: num(fm.id), name: str(fm.name, file.basename), tags: list(fm.tags), goldTotal: num(fm.gold_total), aram: fm.aram === true,
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

    guideNotes(): TFile[] {
        return this.notes(this.s.guideFolder).map((n) => n.file).sort((a, b) => a.path.localeCompare(b.path, "zh-Hant"));
    }
}
