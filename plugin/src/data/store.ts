import { Sounds } from "./sound";
import { TFile, normalizePath } from "obsidian";
import type MorellonomiconPlugin from "../main";
import { MODES, ModeId } from "../modes";

type FM = Record<string, unknown>;

// What tools/fetch_data.py writes into a champion note's frontmatter (plus the hand-written pinned / avoid / video)
export interface Champion {
    id: string; key: number; name: string; nameEn: string; title: string; blurb: string; tier: string; roles: string[]; damageType: string; skillDamage: string[];
    archetypes: string[]; features: string[]; resource: string; attack: number; magic: number; defense: number; difficulty: number;
    range: number; icon: string; skills: Skill[]; patch: string; pinned: string[]; avoid: string[]; video?: string; positions: string[];
    builds: Build[]; tips: Tip[]; path: string;
}
export interface SkillRow { label: string; vals: string[]; note: string }   // one value per rank, or one value for all ranks
// A hand-written build in a champion note: kind meta (a normal build), alt (fun / other play style) or synergy (with teammates in `with`)
// A tip or build says which patch and day it was written for, where it came from and whether it was tried (status)
export interface Meta { patch: string; date: string; source: string; sourceName: string; status: string }
export interface Build extends Meta { kind: "meta" | "alt" | "synergy"; mode: string; name: string; items: number[]; note: string; with: string[] }
export interface Tip extends Meta { title: string; text: string; video: string }
// What tools/fetch_builds.py counts from real matches (_data/builds.<mode>.json)
export interface Count { id: number; games: number; wins: number }
export interface ChampStats { games: number; wins: number; items: Count[]; sets: { items: number[]; games: number; wins: number }[]; augments: Count[] }
export interface BuildStats { mode: string; queue: number; date: string; matches: number; champions: Record<string, ChampStats> }
// What tools/fetch_changes.py found between patches (_data/changes.json); dir is from the player's point of view
export interface Change { scope: string; field: string; old: string; new: string; dir: "buff" | "nerf" | "mixed" | "change" | "text" }
export interface PatchChange { patch: string; from: string; items: Change[] }
export interface ChangeData { current: string; patches: string[]; date: string; champions: Record<string, PatchChange[]> }
// Riot's own patch notes in short (_data/patches.json, from tools/fetch_patch_notes.py)
export interface NoteChange { label: string; old: string; new: string }
export interface NoteEntry { name: string; changes: NoteChange[]; more: number }
export interface PatchNote {
    patch: string; title: string; url: string; summary: string; image: string; date: string; sections: string[];
    champions?: NoteEntry[]; items?: NoteEntry[]; mayhem_champions?: NoteEntry[];
    augments_new?: { rarity: string; name: string; text: string }[]; augments_removed?: string[];
}
// `onhit: [R]` (hand-written in a champion note): those abilities apply on-hit effects; they get the 攻擊特效 tag like any read tag
function withOnHit(skills: Skill[], keys: string[]): Skill[] {
    return keys.length ? skills.map((s) => (keys.includes(s.key) && !s.tags.includes("攻擊特效") ? { ...s, tags: [...s.tags, "攻擊特效"] } : s)) : skills;
}

export interface Skill { key: string; name: string; damage: string[]; tags: string[]; icon: string; desc: string; upgrade: string; range: string; rows: SkillRow[] }
export interface Augment { id: number; name: string; rarity: string; icon: string; effect: string; partial: boolean; fits: string[]; tier: string; path: string }
export interface Item {
    id: number; name: string; tags: string[]; desc: string; from: number[]; into: number[]; goldTotal: number; aram: boolean; rift: boolean; icon: string; variantOf?: string; path: string;
}

// "26.21" and "16.21" are the same patch (Riot's 2026 numbering is 26.x, Data Dragon's is 16.x); compare as minor numbers
const patchNo = (p: string): number | null => {
    const m = /^(\d+)\.(\d+)/.exec(p.trim());
    if (!m) return null;
    const major = Number(m[1]) >= 20 ? Number(m[1]) - 10 : Number(m[1]);
    return major * 100 + Number(m[2]);
};
// 0 = written for the current patch, 1 = one patch behind ..., null = no patch given
export const patchAge = (entry: string, now: string): number | null => {
    const a = patchNo(entry), b = patchNo(now);
    return a === null || b === null ? null : Math.max(0, b - a);
};
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
const rowList = (v: unknown): SkillRow[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ label: str(o.label), vals: list(o.vals), note: str(o.note) }] : [];
}) : []);
const metaOf = (o: Record<string, unknown>): Meta => ({ patch: str(o.patch), date: str(o.date), source: str(o.source), sourceName: str(o.source_name), status: str(o.status) });
const numList = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
const buildList = (v: unknown): Build[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return [];
    const kind = o.kind === "alt" || o.kind === "synergy" ? o.kind : "meta";
    return [{ kind, mode: str(o.mode, "mayhem"), name: str(o.name), items: numList(o.items), note: str(o.note), with: list(o.with), ...metaOf(o) }];
}) : []);
const tipList = (v: unknown): Tip[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ title: str(o.title), text: str(o.text), video: str(o.video), ...metaOf(o) }] : [];
}) : []);
const skillList = (v: unknown): Skill[] => (Array.isArray(v) ? v.flatMap((x) => {
    const o = x as Record<string, unknown> | null;
    return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), tags: list(o.tags), icon: str(o.icon), desc: str(o.desc), upgrade: str(o.upgrade), range: str(o.range), rows: rowList(o.rows) }] : [];
}) : []);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Reads come from Obsidian's metadata cache (instant, no Dataview). Parsed lists are kept until a note in the folders changes.
const LANE_MIN_SHARE = 0.1;   // a lane counts for a champion when at least this share of its ranked games are there
export const LANE_ZH: Record<string, string> = { TOP: "上路", JUNGLE: "打野", MIDDLE: "中路", BOTTOM: "下路", UTILITY: "輔助" };

export class Store {
    private champs: Champion[] | null = null;
    private its: Item[] | null = null;
    private augs: Augment[] | null = null;
    stats: BuildStats | null = null;
    changes: ChangeData | null = null;
    positions: { patch: string; date: string; matches: number; champions: Record<string, Record<string, number>> } | null = null;   // _data/positions.json
    riotNotes: PatchNote[] = [];
    sounds: Sounds | null = null;   // _data/sounds.json: how characters are said, for finding names from speech to text
    gameText: Record<string, { text: string; partial: boolean }> = {};   // augment id -> the game's own description (tools/fetch_augment_text.py)

    constructor(private plugin: MorellonomiconPlugin) {}
    private get app() { return this.plugin.app; }
    private get s() { return this.plugin.settings; }

    // The counted builds for the current mode, if tools/fetch_builds.py has made them (read from the vault's _data folder)
    async loadStats(mode: ModeId = this.s.mode): Promise<void> {
        try {
            const path = normalizePath(`_data/builds.${mode}.json`);
            this.stats = (await this.app.vault.adapter.exists(path)) ? (JSON.parse(await this.app.vault.adapter.read(path)) as BuildStats) : null;
        } catch { this.stats = null; }
        try {
            const path = normalizePath("_data/patches.json");
            this.riotNotes = (await this.app.vault.adapter.exists(path)) ? ((JSON.parse(await this.app.vault.adapter.read(path)) as { patches: PatchNote[] }).patches ?? []) : [];
        } catch { this.riotNotes = []; }
        try {
            const path = normalizePath("_data/augment-text.json");
            this.gameText = (await this.app.vault.adapter.exists(path)) ? ((JSON.parse(await this.app.vault.adapter.read(path)) as { augments: Record<string, { text: string; partial: boolean }> }).augments ?? {}) : {};
            this.augs = null;
        } catch { this.gameText = {}; }
        try {
            const path = normalizePath("_data/positions.json");
            this.positions = (await this.app.vault.adapter.exists(path)) ? JSON.parse(await this.app.vault.adapter.read(path)) : null;
        } catch { this.positions = null; }
        if (!this.sounds) try {
            const path = normalizePath("_data/sounds.json");
            if (await this.app.vault.adapter.exists(path)) {
                const d = JSON.parse(await this.app.vault.adapter.read(path)) as { sounds: Record<string, string>; rare?: Record<string, string> };
                this.sounds = new Sounds(d.sounds, d.rare);
            }
        } catch { this.sounds = null; }
        try {
            const path = normalizePath("_data/changes.json");
            this.changes = (await this.app.vault.adapter.exists(path)) ? (JSON.parse(await this.app.vault.adapter.read(path)) as ChangeData) : null;
        } catch { this.changes = null; }
    }

    // The lanes a champion is played in: a hand-written `positions` list in its note, else the lanes with at least LANE_MIN_SHARE
    // of its ranked games in _data/positions.json (tools/fetch_builds.py --mode ranked), most played first
    lanes(c: Champion): string[] {
        if (c.positions.length) return c.positions;
        const counts = this.positions?.champions[c.id];
        if (!counts) return [];
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return Object.entries(counts).filter(([, n]) => n / total >= LANE_MIN_SHARE).sort((a, b) => b[1] - a[1]).map(([k]) => LANE_ZH[k] ?? k);
    }
    hasLanes(): boolean { return !!this.positions || this.champions().some((c) => c.positions.length); }

    invalidate(): void { this.champs = null; this.its = null; this.augs = null; }
    inData(path: string): boolean {
        const s = this.s;
        return path.startsWith("_data/") || [s.championFolder, s.itemFolder, s.guideFolder, s.augmentFolder, s.patchFolder].some((f) => path.startsWith(normalizePath(f) + "/"));
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
                id: str(fm.id), key: num(fm.key), name: str(fm.name, file.basename), nameEn: str(fm.name_en, str(fm.id)), title: str(fm.title), blurb: str(fm.blurb), tier: str(fm.tier), roles: list(fm.roles), damageType: str(fm.damage_type),
                skillDamage: list(fm.skill_damage), archetypes: [...list(fm.archetypes), ...list(fm.archetypes_extra)], features: [...list(fm.features), ...list(fm.features_extra), ...(list(fm.onhit).length ? ["攻擊特效"] : [])],
                resource: str(fm.resource), attack: num(fm.attack), magic: num(fm.magic), defense: num(fm.defense), difficulty: num(fm.difficulty),
                range: num(fm.range), icon: str(fm.icon), skills: withOnHit(skillList(fm.skills), list(fm.onhit)), patch: str(fm.patch), pinned: list(fm.pinned), avoid: list(fm.avoid), positions: list(fm.positions),
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
                id: num(fm.id), name: str(fm.name, file.basename), tags: list(fm.tags), desc: str(fm.desc), from: numList(fm.from), into: numList(fm.into), goldTotal: num(fm.gold_total), aram: fm.aram === true,
                rift: fm.rift === true, icon: str(fm.icon), variantOf: typeof fm.variant_of === "string" ? fm.variant_of : undefined, path: file.path,
            })).sort((a, b) => a.goldTotal - b.goldTotal || a.name.localeCompare(b.name, "zh-Hant"));
        }
        return this.its;
    }
    modeItems(): Item[] {
        const flag = MODES[this.s.mode].itemFlag;
        return this.items().filter((i) => i[flag]);
    }
    augment(id: number): Augment | undefined { return this.augments().find((a) => a.id === id); }
    item(id: number): Item | undefined { return this.items().find((i) => i.id === id); }

    // Riot's effect text for an augment, from the patch notes where it was introduced (newest patch wins)
    officialEffect(name: string): string {
        for (const n of this.riotNotes) {
            const a = n.augments_new?.find((x) => x.name === name);
            if (a?.text) return a.text;
        }
        return "";
    }

    // What Riot's patch notes say about a champion or an item, newest patch first (only patches that mention it)
    officialFor(kind: "champions" | "items", name: string): { patch: string; url: string; entry: NoteEntry }[] {
        const out: { patch: string; url: string; entry: NoteEntry }[] = [];
        for (const n of this.riotNotes) {
            const entry = (kind === "champions" ? n.champions : n.items)?.find((e) => e.name === name);
            if (entry) out.push({ patch: n.patch, url: n.url, entry });
        }
        return out;
    }

    // In which patches an augment was added or removed
    augmentHistory(name: string): { patch: string; what: "added" | "removed" }[] {
        const out: { patch: string; what: "added" | "removed" }[] = [];
        for (const n of this.riotNotes) {
            if (n.augments_new?.some((a) => a.name === name)) out.push({ patch: n.patch, what: "added" });
            if (n.augments_removed?.includes(name)) out.push({ patch: n.patch, what: "removed" });
        }
        return out;
    }

    augments(): Augment[] {
        if (!this.augs) {
            this.augs = this.notes(this.s.augmentFolder).filter((n) => n.fm.type === "augment").map(({ file, fm }) => ({
                id: num(fm.id), name: str(fm.name, file.basename), rarity: str(fm.rarity), icon: str(fm.icon),
                // hand-written first, then Riot's patch notes (full numbers), then the game's own text (numbers left out, `partial`)
                effect: str(fm.effect) || this.officialEffect(str(fm.name, file.basename)) || this.gameText[String(num(fm.id))]?.text || "",
                partial: !str(fm.effect) && !this.officialEffect(str(fm.name, file.basename)) && !!this.gameText[String(num(fm.id))]?.partial,
                fits: list(fm.fits), tier: str(fm.tier), path: file.path,
            })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
        }
        return this.augs;
    }

    // A champion's changes, newest patch first, and just the ones in the current patch
    changesOf(id: string): PatchChange[] { return this.changes?.champions[id] ?? []; }
    currentChanges(id: string): Change[] { return this.changesOf(id).find((p) => p.patch === this.changes?.current)?.items ?? []; }

    // The game patch the notes were generated from, as "16.21" (Data Dragon numbering)
    currentPatch(): string { return this.champions()[0]?.patch.split(".").slice(0, 2).join(".") ?? ""; }

    // The same patch in Riot's own numbering ("16.21" -> "26.21"; the patch notes and videos use that one)
    riotPatch(): string { const p = this.currentPatch(); return p.replace(/^(\d+)/, (m) => String(Number(m) + (Number(m) < 20 ? 10 : 0))); }

    // Our own patch notes, newest first
    patchNotes(): { file: TFile; title: string; patch: string; date: string; summary: string }[] {
        return this.notes(this.s.patchFolder).map(({ file, fm }) => ({ file, title: str(fm.title, file.basename), patch: str(fm.patch), date: str(fm.date), summary: str(fm.summary) }))
            .sort((a, b) => b.date.localeCompare(a.date) || b.patch.localeCompare(a.patch));
    }

    // Every tip / build whose patch is older than the current one, or has none (so it might be out of date)
    staleEntries(): { champion: Champion; kind: "tip" | "build"; title: string; patch: string }[] {
        const now = this.currentPatch();
        const out: { champion: Champion; kind: "tip" | "build"; title: string; patch: string }[] = [];
        for (const c of this.champions()) {
            for (const t of c.tips) if (patchAge(t.patch, now) !== 0) out.push({ champion: c, kind: "tip", title: t.title, patch: t.patch });
            for (const b of c.builds) if (patchAge(b.patch, now) !== 0) out.push({ champion: c, kind: "build", title: b.name, patch: b.patch });
        }
        return out;
    }

    // The Learn cards: notes in the guide folder, ordered by their `order` (then name); `icon` and `summary` come from frontmatter
    guideNotes(): { file: TFile; title: string; icon: string; summary: string; order: number; layout: string }[] {
        return this.notes(this.s.guideFolder).map(({ file, fm }) => ({ file, title: file.basename, icon: str(fm.icon, "file-text"), summary: str(fm.summary), order: num(fm.order, 99), layout: str(fm.layout, "deck") }))
            .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hant"));
    }
}
