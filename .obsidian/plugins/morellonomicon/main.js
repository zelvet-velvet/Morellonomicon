"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MorellonomiconPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian9 = require("obsidian");

// src/data/store.ts
var import_obsidian = require("obsidian");

// src/modes.ts
var MODES = {
  mayhem: { id: "mayhem", label: "Mayhem", icon: "zap", enabled: true, itemFlag: "aram", tabs: ["champions", "augments", "patch", "handbook"] },
  rift: { id: "rift", label: "Rift", icon: "map", enabled: false, itemFlag: "rift", tabs: ["champions", "patch", "handbook"] }
};
var MODE_ORDER = ["mayhem", "rift"];
var TAB_LABEL = { champions: "Champions", augments: "Augments", patch: "Patch", handbook: "Handbook" };
var TAB_ICON = { champions: "users", augments: "sparkles", patch: "newspaper", handbook: "book-open" };

// src/data/store.ts
var patchNo = (p) => {
  const m = /^(\d+)\.(\d+)/.exec(p.trim());
  if (!m) return null;
  const major = Number(m[1]) >= 20 ? Number(m[1]) - 10 : Number(m[1]);
  return major * 100 + Number(m[2]);
};
var patchAge = (entry, now) => {
  const a = patchNo(entry), b = patchNo(now);
  return a === null || b === null ? null : Math.max(0, b - a);
};
var str = (v, d = "") => typeof v === "string" ? v : d;
var num = (v, d = 0) => typeof v === "number" ? v : d;
var rowList = (v) => Array.isArray(v) ? v.flatMap((x) => {
  const o = x;
  return o && typeof o === "object" ? [{ label: str(o.label), vals: list(o.vals), note: str(o.note) }] : [];
}) : [];
var metaOf = (o) => ({ patch: str(o.patch), date: str(o.date), source: str(o.source), sourceName: str(o.source_name), status: str(o.status) });
var numList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
var buildList = (v) => Array.isArray(v) ? v.flatMap((x) => {
  const o = x;
  if (!o || typeof o !== "object") return [];
  const kind = o.kind === "alt" || o.kind === "synergy" ? o.kind : "meta";
  return [{ kind, mode: str(o.mode, "mayhem"), name: str(o.name), items: numList(o.items), note: str(o.note), with: list(o.with), ...metaOf(o) }];
}) : [];
var tipList = (v) => Array.isArray(v) ? v.flatMap((x) => {
  const o = x;
  return o && typeof o === "object" ? [{ title: str(o.title), text: str(o.text), video: str(o.video), ...metaOf(o) }] : [];
}) : [];
var skillList = (v) => Array.isArray(v) ? v.flatMap((x) => {
  const o = x;
  return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), tags: list(o.tags), icon: str(o.icon), desc: str(o.desc), upgrade: str(o.upgrade), range: str(o.range), rows: rowList(o.rows) }] : [];
}) : [];
var list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
var Store = class {
  // augment id -> the game's own description (tools/fetch_augment_text.py)
  constructor(plugin) {
    this.plugin = plugin;
    this.champs = null;
    this.its = null;
    this.augs = null;
    this.stats = null;
    this.changes = null;
    this.riotNotes = [];
    this.gameText = {};
  }
  get app() {
    return this.plugin.app;
  }
  get s() {
    return this.plugin.settings;
  }
  // The counted builds for the current mode, if tools/fetch_builds.py has made them (read from the vault's _data folder)
  async loadStats(mode = this.s.mode) {
    try {
      const path = (0, import_obsidian.normalizePath)(`_data/builds.${mode}.json`);
      this.stats = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)) : null;
    } catch {
      this.stats = null;
    }
    try {
      const path = (0, import_obsidian.normalizePath)("_data/patches.json");
      this.riotNotes = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)).patches ?? [] : [];
    } catch {
      this.riotNotes = [];
    }
    try {
      const path = (0, import_obsidian.normalizePath)("_data/augment-text.json");
      this.gameText = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)).augments ?? {} : {};
      this.augs = null;
    } catch {
      this.gameText = {};
    }
    try {
      const path = (0, import_obsidian.normalizePath)("_data/changes.json");
      this.changes = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)) : null;
    } catch {
      this.changes = null;
    }
  }
  invalidate() {
    this.champs = null;
    this.its = null;
    this.augs = null;
  }
  inData(path) {
    const s = this.s;
    return path.startsWith("_data/") || [s.championFolder, s.itemFolder, s.guideFolder, s.augmentFolder, s.patchFolder].some((f) => path.startsWith((0, import_obsidian.normalizePath)(f) + "/"));
  }
  notes(folder) {
    const prefix = (0, import_obsidian.normalizePath)(folder) + "/";
    const out = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(prefix)) continue;
      out.push({ file, fm: this.app.metadataCache.getFileCache(file)?.frontmatter ?? {} });
    }
    return out;
  }
  champions() {
    if (!this.champs) {
      this.champs = this.notes(this.s.championFolder).filter((n) => n.fm.type === "champion").map(({ file, fm }) => ({
        id: str(fm.id),
        key: num(fm.key),
        name: str(fm.name, file.basename),
        title: str(fm.title),
        blurb: str(fm.blurb),
        tier: str(fm.tier),
        roles: list(fm.roles),
        damageType: str(fm.damage_type),
        skillDamage: list(fm.skill_damage),
        archetypes: [...list(fm.archetypes), ...list(fm.archetypes_extra)],
        features: list(fm.features),
        resource: str(fm.resource),
        attack: num(fm.attack),
        magic: num(fm.magic),
        defense: num(fm.defense),
        difficulty: num(fm.difficulty),
        range: num(fm.range),
        icon: str(fm.icon),
        skills: skillList(fm.skills),
        patch: str(fm.patch),
        pinned: list(fm.pinned),
        avoid: list(fm.avoid),
        video: typeof fm.video === "string" ? fm.video : void 0,
        builds: buildList(fm.builds),
        tips: tipList(fm.tips),
        path: file.path
      })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    }
    return this.champs;
  }
  champion(id) {
    return this.champions().find((c) => c.id === id);
  }
  // Items of the current mode's shop
  items() {
    if (!this.its) {
      this.its = this.notes(this.s.itemFolder).filter((n) => n.fm.type === "item").map(({ file, fm }) => ({
        id: num(fm.id),
        name: str(fm.name, file.basename),
        tags: list(fm.tags),
        desc: str(fm.desc),
        from: numList(fm.from),
        into: numList(fm.into),
        goldTotal: num(fm.gold_total),
        aram: fm.aram === true,
        rift: fm.rift === true,
        icon: str(fm.icon),
        variantOf: typeof fm.variant_of === "string" ? fm.variant_of : void 0,
        path: file.path
      })).sort((a, b) => a.goldTotal - b.goldTotal || a.name.localeCompare(b.name, "zh-Hant"));
    }
    return this.its;
  }
  modeItems() {
    const flag = MODES[this.s.mode].itemFlag;
    return this.items().filter((i) => i[flag]);
  }
  augment(id) {
    return this.augments().find((a) => a.id === id);
  }
  item(id) {
    return this.items().find((i) => i.id === id);
  }
  // Riot's effect text for an augment, from the patch notes where it was introduced (newest patch wins)
  officialEffect(name) {
    for (const n of this.riotNotes) {
      const a = n.augments_new?.find((x) => x.name === name);
      if (a?.text) return a.text;
    }
    return "";
  }
  // What Riot's patch notes say about a champion or an item, newest patch first (only patches that mention it)
  officialFor(kind, name) {
    const out = [];
    for (const n of this.riotNotes) {
      const entry = (kind === "champions" ? n.champions : n.items)?.find((e) => e.name === name);
      if (entry) out.push({ patch: n.patch, url: n.url, entry });
    }
    return out;
  }
  // In which patches an augment was added or removed
  augmentHistory(name) {
    const out = [];
    for (const n of this.riotNotes) {
      if (n.augments_new?.some((a) => a.name === name)) out.push({ patch: n.patch, what: "added" });
      if (n.augments_removed?.includes(name)) out.push({ patch: n.patch, what: "removed" });
    }
    return out;
  }
  augments() {
    if (!this.augs) {
      this.augs = this.notes(this.s.augmentFolder).filter((n) => n.fm.type === "augment").map(({ file, fm }) => ({
        id: num(fm.id),
        name: str(fm.name, file.basename),
        rarity: str(fm.rarity),
        icon: str(fm.icon),
        // hand-written first, then Riot's patch notes (full numbers), then the game's own text (numbers left out, `partial`)
        effect: str(fm.effect) || this.officialEffect(str(fm.name, file.basename)) || this.gameText[String(num(fm.id))]?.text || "",
        partial: !str(fm.effect) && !this.officialEffect(str(fm.name, file.basename)) && !!this.gameText[String(num(fm.id))]?.partial,
        fits: list(fm.fits),
        tier: str(fm.tier),
        path: file.path
      })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
    }
    return this.augs;
  }
  // A champion's changes, newest patch first, and just the ones in the current patch
  changesOf(id) {
    return this.changes?.champions[id] ?? [];
  }
  currentChanges(id) {
    return this.changesOf(id).find((p) => p.patch === this.changes?.current)?.items ?? [];
  }
  // The game patch the notes were generated from, as "16.21" (Data Dragon numbering)
  currentPatch() {
    return this.champions()[0]?.patch.split(".").slice(0, 2).join(".") ?? "";
  }
  // The same patch in Riot's own numbering ("16.21" -> "26.21"; the patch notes and videos use that one)
  riotPatch() {
    const p = this.currentPatch();
    return p.replace(/^(\d+)/, (m) => String(Number(m) + (Number(m) < 20 ? 10 : 0)));
  }
  // Our own patch notes, newest first
  patchNotes() {
    return this.notes(this.s.patchFolder).map(({ file, fm }) => ({ file, title: str(fm.title, file.basename), patch: str(fm.patch), date: str(fm.date), summary: str(fm.summary) })).sort((a, b) => b.date.localeCompare(a.date) || b.patch.localeCompare(a.patch));
  }
  // Every tip / build whose patch is older than the current one, or has none (so it might be out of date)
  staleEntries() {
    const now = this.currentPatch();
    const out = [];
    for (const c of this.champions()) {
      for (const t of c.tips) if (patchAge(t.patch, now) !== 0) out.push({ champion: c, kind: "tip", title: t.title, patch: t.patch });
      for (const b of c.builds) if (patchAge(b.patch, now) !== 0) out.push({ champion: c, kind: "build", title: b.name, patch: b.patch });
    }
    return out;
  }
  // The Learn cards: notes in the guide folder, ordered by their `order` (then name); `icon` and `summary` come from frontmatter
  guideNotes() {
    return this.notes(this.s.guideFolder).map(({ file, fm }) => ({ file, title: file.basename, icon: str(fm.icon, "file-text"), summary: str(fm.summary), order: num(fm.order, 99), layout: str(fm.layout, "deck") })).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hant"));
  }
};

// src/router.ts
var KEY = "morellonomicon-nav";
var STACK_TTL = 30 * 60 * 1e3;
var Router = class {
  constructor(app) {
    this.app = app;
    this.tab = "champions";
    this.stacks = {};
    try {
      const s = this.app.loadLocalStorage(KEY);
      if (s && s.tab) {
        this.tab = s.tab;
        if (Date.now() - s.t < STACK_TTL) this.stacks = s.stacks || {};
      }
    } catch {
    }
  }
  // the open tab must exist in the current mode
  fix(tabs) {
    if (!tabs.includes(this.tab)) this.tab = tabs[0] ?? "champions";
  }
  reset() {
    this.stacks = {};
    this.save();
  }
  stack(tab = this.tab) {
    var _a;
    return (_a = this.stacks)[tab] ?? (_a[tab] = []);
  }
  top(tab = this.tab) {
    const s = this.stack(tab);
    return s[s.length - 1] ?? { key: "root", title: "" };
  }
  depth(tab = this.tab) {
    return this.stack(tab).length;
  }
  setTab(tab) {
    this.tab = tab;
    this.save();
  }
  push(f) {
    if (this.top().key === f.key && JSON.stringify(this.top().params) === JSON.stringify(f.params)) return false;
    this.stack().push(f);
    this.save();
    return true;
  }
  pop() {
    if (!this.depth()) return false;
    this.stack().pop();
    this.save();
    return true;
  }
  popToRoot() {
    if (!this.depth()) return false;
    this.stacks[this.tab] = [];
    this.save();
    return true;
  }
  save() {
    try {
      this.app.saveLocalStorage(KEY, { tab: this.tab, stacks: this.stacks, t: Date.now() });
    } catch {
    }
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");

// src/themes.ts
var THEMES = [
  { id: "auto", name: "Obsidian (follows your theme)" },
  {
    id: "popping",
    name: "Popping and Locking",
    dark: {
      bg: "#1C1D26",
      surface: "#262836",
      surface2: "#30334A",
      text: "#F2E5BC",
      text2: "#C9C2B2",
      text3: "#9A8F80",
      onAccent: "#1C1D26",
      accent: "#E9892B",
      positive: "#A3CF7E",
      negative: "#F7685B",
      warning: "#F5B83D",
      info: "#7DB3C9",
      orange: "#E9892B",
      purple: "#B995D8",
      pink: "#D3869B",
      cyan: "#8EC0B4",
      line: "rgba(242,229,188,0.11)"
    },
    light: {
      bg: "#F6F0DF",
      surface: "#FFFBEE",
      surface2: "#EFE7D0",
      text: "#2B2A33",
      text2: "#5C574C",
      text3: "#766F61",
      onAccent: "#FFFFFF",
      accent: "#B5470A",
      positive: "#3F7A1E",
      negative: "#B8322A",
      warning: "#915600",
      info: "#2D6C8C",
      orange: "#D9741A",
      purple: "#8A5DB5",
      pink: "#C2587A",
      cyan: "#3F9A8A",
      line: "rgba(60,48,20,0.13)"
    }
  },
  {
    id: "ocean",
    name: "Ocean",
    dark: {
      bg: "#101820",
      surface: "#1A2530",
      surface2: "#243241",
      text: "#EAF1F7",
      text2: "#A9B8C6",
      text3: "#7F90A0",
      onAccent: "#0B1218",
      accent: "#4DB6AC",
      positive: "#6FCF97",
      negative: "#EB5757",
      warning: "#F2C94C",
      info: "#56CCF2",
      orange: "#F2994A",
      purple: "#BB86FC",
      pink: "#FF7AA8",
      cyan: "#4DB6AC",
      line: "rgba(234,241,247,0.11)"
    },
    light: {
      bg: "#F4F8FB",
      surface: "#FFFFFF",
      surface2: "#EAF0F5",
      text: "#14202B",
      text2: "#4B5C6B",
      text3: "#66798A",
      onAccent: "#FFFFFF",
      accent: "#00796B",
      positive: "#1B7F46",
      negative: "#C62828",
      warning: "#8A6100",
      info: "#0A6C9A",
      orange: "#E07B20",
      purple: "#8E4EC6",
      pink: "#E0457F",
      cyan: "#12877B",
      line: "rgba(20,32,43,0.13)"
    }
  },
  {
    id: "sakura",
    name: "Sakura",
    dark: {
      bg: "#211922",
      surface: "#2D2230",
      surface2: "#3A2C3E",
      text: "#F7E8F0",
      text2: "#CDB6C4",
      text3: "#9C8696",
      onAccent: "#2A1020",
      accent: "#FF8FB1",
      positive: "#9ED8A5",
      negative: "#FF6B7A",
      warning: "#F7C873",
      info: "#8FC5E8",
      orange: "#FFA776",
      purple: "#C7A2F0",
      pink: "#FF8FB1",
      cyan: "#7DD3CB",
      line: "rgba(247,232,240,0.11)"
    },
    light: {
      bg: "#FBF3F6",
      surface: "#FFFFFF",
      surface2: "#F5E6EC",
      text: "#2B1B24",
      text2: "#5E4654",
      text3: "#7A6270",
      onAccent: "#FFFFFF",
      accent: "#C2185B",
      positive: "#2E7D32",
      negative: "#C62828",
      warning: "#8D5B00",
      info: "#1565A0",
      orange: "#D2691E",
      purple: "#7B4DB2",
      pink: "#C2185B",
      cyan: "#00796B",
      line: "rgba(43,27,36,0.13)"
    }
  },
  {
    id: "forest",
    name: "Forest",
    dark: {
      bg: "#141A16",
      surface: "#1D2620",
      surface2: "#27342B",
      text: "#E6F0E4",
      text2: "#B0C2B0",
      text3: "#86998A",
      onAccent: "#0E1A10",
      accent: "#8FD19E",
      positive: "#8FD19E",
      negative: "#F0776B",
      warning: "#E8C35C",
      info: "#7DC4D6",
      orange: "#E8955A",
      purple: "#B59AE0",
      pink: "#DB8CA8",
      cyan: "#6CC7B5",
      line: "rgba(230,240,228,0.11)"
    },
    light: {
      bg: "#F2F6EF",
      surface: "#FFFFFF",
      surface2: "#E6EEE2",
      text: "#18241A",
      text2: "#4A5E4C",
      text3: "#657A68",
      onAccent: "#FFFFFF",
      accent: "#2E7D32",
      positive: "#2E7D32",
      negative: "#B3261E",
      warning: "#8A6100",
      info: "#0A6C85",
      orange: "#C9651A",
      purple: "#6F4AAE",
      pink: "#B03A6C",
      cyan: "#00796B",
      line: "rgba(24,36,26,0.13)"
    }
  }
];
function themeVars(id, dark) {
  const t = THEMES.find((x) => x.id === id);
  const k = t && (dark ? t.dark : t.light);
  if (!k) return {};
  return {
    "--mn-bg": k.bg,
    "--mn-card": k.surface,
    "--mn-card-hi": k.surface2,
    "--mn-text": k.text,
    "--mn-muted": k.text2,
    "--mn-faint": k.text3,
    "--mn-line": k.line,
    "--mn-accent": k.accent,
    "--interactive-accent": k.accent,
    "--text-on-accent": k.onAccent,
    "--color-green": k.positive,
    "--color-red": k.negative,
    "--color-yellow": k.warning,
    "--color-blue": k.info,
    "--color-orange": k.orange,
    "--color-purple": k.purple,
    "--color-pink": k.pink,
    "--color-cyan": k.cyan
  };
}

// src/settings.ts
var DEFAULTS = {
  mode: "mayhem",
  theme: "popping",
  championFolder: "\u82F1\u96C4",
  itemFolder: "\u9053\u5177",
  guideFolder: "\u65B0\u624B\u5165\u9580",
  augmentFolder: "\u5F37\u5316",
  patchFolder: "\u7248\u672C\u66F4\u65B0",
  openOnStartup: import_obsidian2.Platform.isMobile,
  read: [],
  roster: []
};
var MnSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl: c } = this;
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();
    c.empty();
    new import_obsidian2.Setting(c).setName("Mode").setDesc("What the app shows. Rift is planned.").addDropdown((d) => {
      for (const id of MODE_ORDER) d.addOption(id, MODES[id].label + (MODES[id].enabled ? "" : " (coming soon)"));
      d.setValue(s.mode).onChange(async (v) => {
        s.mode = v;
        await save();
      });
    });
    new import_obsidian2.Setting(c).setName("Color theme").setDesc("Colors of the app screen. Follows Obsidian's light / dark.").addDropdown((d) => {
      for (const t of THEMES) d.addOption(t.id, t.name);
      d.setValue(s.theme).onChange(async (v) => {
        s.theme = v;
        await save();
      });
    });
    const folder = (name, desc, key) => new import_obsidian2.Setting(c).setName(name).setDesc(desc).addText((x) => x.setValue(s[key]).onChange(async (v) => {
      s[key] = v.trim() || DEFAULTS[key];
      await save();
    }));
    folder("Champion folder", "Notes made by tools/fetch_data.py", "championFolder");
    folder("Item folder", "Notes made by tools/fetch_data.py", "itemFolder");
    folder("Augment folder", "Notes made by tools/fetch_augments.py", "augmentFolder");
    folder("Patch notes folder", "Our own patch notes (frontmatter: patch, date, title, summary)", "patchFolder");
    folder("Guide folder", "Beginner guide notes", "guideFolder");
    new import_obsidian2.Setting(c).setName("Open on startup").setDesc("Show the app when Obsidian starts (on by default on a phone).").addToggle((x) => x.setValue(s.openOnStartup).onChange(async (v) => {
      s.openOnStartup = v;
      await save();
    }));
  }
};

// src/view.ts
var import_obsidian8 = require("obsidian");

// src/ui.ts
var import_obsidian3 = require("obsidian");
var h = (parent, tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  parent?.appendChild(e);
  return e;
};
var tipEl = null;
var tipTimer = 0;
var TIP_MS = 2200;
var tip = (anchor, text) => {
  tipEl?.remove();
  window.clearTimeout(tipTimer);
  const t = h(anchor.closest(".mn-app") ?? document.body, "div", "mn-tip", text);
  tipEl = t;
  const a = anchor.getBoundingClientRect();
  t.style.left = `${Math.max(8, Math.min(window.innerWidth - t.offsetWidth - 8, a.left + a.width / 2 - t.offsetWidth / 2))}px`;
  t.style.top = `${a.top - t.offsetHeight - 8 < 8 ? a.bottom + 8 : a.top - t.offsetHeight - 8}px`;
  tipTimer = window.setTimeout(() => {
    t.remove();
    if (tipEl === t) tipEl = null;
  }, TIP_MS);
};
var icon = (parent, name, cls = "mn-ic") => {
  const s = h(parent, "span", cls);
  (0, import_obsidian3.setIcon)(s, name);
  if (!s.querySelector("svg")) (0, import_obsidian3.setIcon)(s, "circle");
  return s;
};
var page = (title) => {
  const p = h(null, "div", "mn-page");
  h(h(p, "div", "mn-title-row"), "h1", "mn-title", title);
  return p;
};
var group = (parent, title, footer) => {
  if (title) h(parent, "div", "mn-gh", title);
  const g = h(parent, "div", "mn-group");
  if (footer) h(parent, "div", "mn-gf", footer);
  return g;
};
var AUG_CLASS = { \u9280: "aug-silver", \u91D1: "aug-gold", \u7A1C\u93E1: "aug-prism" };
var TINTED = /_large\.png$|genericabilityaugmenticon/;
var augIcon = (parent, src, rarity, cls = "") => {
  const tinted = TINTED.test(src);
  const box = h(parent, "span", `aug-icon ${AUG_CLASS[rarity] ?? ""} ${cls}`.trim());
  if (tinted) {
    const im = h(box, "img");
    im.alt = "";
    im.loading = "lazy";
    im.src = src;
  } else {
    box.style.setProperty("--glyph", `url("${src}")`);
    h(box, "span", "aug-glyph");
  }
  return box;
};
var row = (parent, r) => {
  const el = h(parent, "div", "mn-row" + (r.onTap ? " is-tap" : "") + (r.muted ? " is-muted" : ""));
  if (r.image && r.rarity && AUG_CLASS[r.rarity]) augIcon(el, r.image, r.rarity, "mn-row-aug");
  else if (r.image) {
    const im = h(el, "img", "mn-row-img");
    im.src = r.image;
    im.loading = "lazy";
    im.alt = "";
  } else if (r.icon) icon(el, r.icon, "mn-row-ic");
  const main = h(el, "div", "mn-row-main");
  h(main, "div", "mn-row-t", r.title);
  if (r.sub) h(main, "div", "mn-row-s" + (r.clamp ? " is-clamp" : ""), r.sub);
  if (r.value) h(el, "div", "mn-row-v", r.value);
  if (r.chevron) icon(el, "chevron-right", "mn-row-chev");
  if (r.onTap) {
    const fn = r.onTap;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      fn();
    });
  }
  return el;
};
var DAMAGE_COLOR = { \u7269\u7406: "var(--color-orange)", \u9B54\u6CD5: "var(--color-blue)", \u771F\u5BE6: "var(--color-yellow)", \u6DF7\u5408: "var(--color-purple)" };
var chip = (parent, text, o = {}) => {
  const el = h(parent, o.onTap ? "button" : "span", "mn-chip" + (o.on ? " is-on" : "") + (o.color ? " has-color" : "") + (o.onTap ? " is-tap" : ""));
  if (o.color && o.onTap && !o.on) h(el, "span", "mn-dot");
  el.appendChild(document.createTextNode(text));
  if (o.color) el.style.setProperty("--chip", o.color);
  if (o.onTap) {
    const fn = o.onTap;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      fn();
    });
  }
  return el;
};
var fgrid = (parent, cells) => {
  const row2 = h(parent, "div", "mn-fgrid");
  row2.style.setProperty("--n", String(cells));
  return row2;
};
var SVG_NS = "http://www.w3.org/2000/svg";
var svg = (parent, tag, attrs = {}, cls) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute("class", cls);
  parent.appendChild(e);
  return e;
};
var empty = (parent, o) => {
  const box = h(parent, "div", "mn-empty");
  icon(box, o.icon, "mn-empty-ic");
  h(box, "div", "mn-empty-t", o.title);
  if (o.text) h(box, "div", "mn-empty-s", o.text);
  return box;
};
var segmented = (parent, options, value, onChange, cls = "") => {
  const seg = h(parent, "div", "mn-seg " + cls);
  for (const [id, label] of options) {
    const b = h(seg, "button", "mn-seg-b" + (id === value ? " is-on" : ""), label);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onChange(id);
    });
  }
  return seg;
};

// src/pages/augments.ts
var RARITIES = ["\u9280", "\u91D1", "\u7A1C\u93E1"];
var RARITY_COLOR = { \u9280: "var(--text-muted)", \u91D1: "var(--color-yellow)", \u7A1C\u93E1: "var(--color-purple)" };
var RARITY_RANK = { \u7A1C\u93E1: 0, \u91D1: 1, \u9280: 2 };
var SORTS = [["rarity", "\u7A00\u6709\u5EA6"], ["name", "\u540D\u7A31"], ["new", "\u6700\u65B0"]];
var patchNo2 = (p) => {
  const m = /(\d+)\.(\d+)/.exec(p);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
};
var sortBy = "rarity";
function augmentsPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("Augments");
  const all = store.augments();
  if (!all.length) {
    empty(el, { icon: "database", title: "No augment notes yet", text: "Run python3 tools/fetch_augments.py" });
    return { title: "Augments", el };
  }
  let query = "", rarity = "";
  const latest = store.riotNotes[0]?.patch ?? "";
  const addedIn = new Map(all.map((a) => [a.id, store.augmentHistory(a.name).find((x) => x.what === "added")?.patch ?? ""]));
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search";
  const chips = h(el, "div", "mn-chips");
  segmented(el, SORTS, sortBy, (id) => {
    sortBy = id;
    draw();
    sortbar.querySelectorAll(".mn-seg-b").forEach((b, i) => b.toggleClass("is-on", SORTS[i][0] === id));
  }, "is-sm mn-sortbar");
  const sortbar = el.lastElementChild;
  const list2 = h(el, "div");
  const links = group(el, "Tier lists (other sites)");
  row(links, { icon: "external-link", title: "OP.GG Mayhem tier list", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
  row(links, { icon: "external-link", title: "U.GG augment tier list", chevron: true, onTap: () => window.open("https://u.gg/lol/aram-mayhem-augment-tier-list") });
  const draw = () => {
    list2.empty();
    const q = query.trim().toLowerCase();
    const hits = all.filter((a) => (!rarity || a.rarity === rarity) && (!q || a.name.toLowerCase().includes(q)));
    const byName = (a, b) => a.name.localeCompare(b.name, "zh-Hant");
    if (sortBy === "rarity") hits.sort((a, b) => (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9) || byName(a, b));
    else if (sortBy === "new") hits.sort((a, b) => patchNo2(addedIn.get(b.id) ?? "") - patchNo2(addedIn.get(a.id) ?? "") || byName(a, b));
    else hits.sort(byName);
    const g = group(list2);
    for (const a of hits) {
      const isNew = !!latest && addedIn.get(a.id) === latest;
      row(g, { image: a.icon, rarity: a.rarity, title: a.name, sub: a.effect || void 0, value: isNew ? `${a.rarity} \xB7 \u65B0` : a.rarity, chevron: true, clamp: true, onTap: () => ctx.openAugment(a.id) });
    }
    if (!hits.length) empty(list2, { icon: "search-x", title: "No match" });
  };
  const drawChips = () => {
    chips.empty();
    for (const r of RARITIES) chip(chips, r, { on: rarity === r, color: RARITY_COLOR[r], onTap: () => {
      rarity = rarity === r ? "" : r;
      drawChips();
      draw();
    } });
  };
  search.addEventListener("input", () => {
    query = search.value;
    draw();
  });
  drawChips();
  draw();
  return { title: "Augments", el };
}

// src/pages/profile.ts
var import_obsidian4 = require("obsidian");
var SKILL_STEPS = [0, 4, 7, 9, 10];
var count = (c, ...tags) => c.skills.filter((s) => s.key !== "P" && tags.some((t) => s.tags.includes(t))).length;
var score = (n) => SKILL_STEPS[Math.min(n, SKILL_STEPS.length - 1)];
function profileAxes(c) {
  return [
    { label: "\u8F38\u51FA", value: Math.max(c.attack, c.magic) },
    { label: "\u5766\u5EA6", value: c.defense },
    { label: "\u63A7\u5834", value: score(count(c, "\u63A7\u5834")) },
    { label: "\u4F4D\u79FB", value: score(count(c, "\u4F4D\u79FB")) },
    { label: "\u8F14\u52A9", value: score(count(c, "\u6CBB\u7642", "\u8B77\u76FE")) },
    { label: "\u5C04\u7A0B", value: Math.min(10, Math.round(c.range / 65)) }
  ];
}
var uid = 0;
function profileRadar(parent, axes, color, max = 10) {
  const W = 340, H = 300, cx = W / 2, cy = 150, R = 96, LABEL = 28, n = axes.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r) => axes.map((_, i) => pt(i, r(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const val = (i) => R * Math.max(0, Math.min(max, axes[i].value)) / max;
  const root = svg(parent, "svg", { viewBox: `0 0 ${W} ${H}` }, "mn-radar mn-pro");
  root.style.setProperty("--rd", color);
  const id = `mn-grad-${++uid}`;
  const defs = svg(root, "defs");
  const grad = svg(defs, "linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  svg(grad, "stop", { offset: "0%", "stop-opacity": 0.62 }, "mn-rd-stop").setAttribute("style", `stop-color:${color}`);
  svg(grad, "stop", { offset: "100%", "stop-opacity": 0.14 }, "mn-rd-stop").setAttribute("style", `stop-color:${color}`);
  for (let k = 5; k >= 1; k--) svg(root, "polygon", { points: poly(() => R * k / 5) }, k === 5 ? "mn-rd-ring is-outer" : "mn-rd-ring");
  axes.forEach((_, i) => {
    const [x, y] = pt(i, R);
    svg(root, "line", { x1: cx, y1: cy, x2: x, y2: y }, "mn-rd-axis");
  });
  svg(root, "polygon", { points: poly(val), fill: `url(#${id})` }, "mn-rd-shape");
  axes.forEach((ax, i) => {
    const [dx, dy] = pt(i, val(i));
    svg(root, "circle", { cx: dx, cy: dy, r: 6.5 }, "mn-rd-halo");
    svg(root, "circle", { cx: dx, cy: dy, r: 3.6 }, "mn-rd-dot");
    const [lx, ly] = pt(i, R + LABEL);
    const t = svg(root, "text", { x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "middle" }, "mn-rd-label");
    const name = svg(t, "tspan");
    name.textContent = ax.label;
    const v = svg(t, "tspan", { dx: 5 }, "mn-rd-val");
    v.textContent = String(ax.value);
  });
}
var ABILITIES = [
  { tag: "\u63A7\u5834", color: "var(--color-purple)", icon: "lock", en: "Crowd Control", abbr: "CC", what: "\u6688\u7729\u3001\u64CA\u98DB\u3001\u5B9A\u8EAB\u3001\u6C89\u9ED8\u3001\u6050\u61FC\u7B49,\u8B93\u6575\u4EBA\u52D5\u4E0D\u4E86\u6216\u4E0D\u80FD\u653E\u6280\u80FD" },
  { tag: "\u7DE9\u901F", color: "var(--color-blue)", icon: "snowflake", en: "Slow", abbr: "Slow", what: "\u964D\u4F4E\u6575\u4EBA\u7684\u79FB\u52D5\u901F\u5EA6" },
  { tag: "\u4F4D\u79FB", color: "var(--color-cyan)", icon: "arrow-big-right-dash", en: "Dash / Mobility", abbr: "Dash", what: "\u885D\u523A\u3001\u9583\u73FE\u3001\u77AC\u6B65\u3001\u8DF3\u8E8D\u7B49,\u8B93\u81EA\u5DF1\u5FEB\u901F\u79FB\u52D5" },
  { tag: "\u6CBB\u7642", color: "var(--color-green)", icon: "heart-pulse", en: "Heal", abbr: "Heal", what: "\u56DE\u5FA9\u81EA\u5DF1\u6216\u968A\u53CB\u7684\u751F\u547D" },
  { tag: "\u8B77\u76FE", color: "var(--color-yellow)", icon: "shield-plus", en: "Shield", abbr: "Shield", what: "\u7D66\u81EA\u5DF1\u6216\u968A\u53CB\u4E00\u5C64\u53EF\u5438\u6536\u50B7\u5BB3\u7684\u8B77\u76FE" },
  { tag: "\u5438\u8840", color: "var(--color-red)", icon: "syringe", en: "Lifesteal / Omnivamp", abbr: "LS", what: "\u9020\u6210\u50B7\u5BB3\u6642\u56DE\u5FA9\u81EA\u5DF1\u7684\u751F\u547D" },
  { tag: "\u5F37\u5316\u666E\u653B", color: "var(--color-pink)", icon: "sword", en: "Empowered attacks (On-hit)", abbr: "On-hit", what: "\u6280\u80FD\u6703\u5F37\u5316\u666E\u901A\u653B\u64CA(\u4E0B\u4E00\u6B21\u666E\u653B\u3001\u984D\u5916\u50B7\u5BB3)\u3002\u4F9D\u6280\u80FD\u6587\u5B57\u5224\u65B7,\u6BD4\u300C\u9069\u5408\u51FA\u653B\u64CA\u7279\u6548\u88DD\u300D\u5BEC" }
];
var AbilityLegend = class extends import_obsidian4.Modal {
  constructor(app) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText("\u5716\u793A\u8AAA\u660E");
    const table = h(this.contentEl, "div", "mn-lg");
    const head = h(table, "div", "mn-lg-r mn-lg-h");
    for (const t of ["", "\u540D\u7A31", "\u82F1\u6587 / \u7E2E\u5BEB"]) h(head, "span", "", t);
    for (const a of ABILITIES) {
      const r = h(table, "div", "mn-lg-r");
      const ic = icon(h(r, "span", "mn-pill mn-pill-ic is-lit"), a.icon);
      ic.parentElement?.style.setProperty("--p", a.color);
      const name = h(r, "span", "mn-lg-n", a.tag);
      h(name, "div", "mn-lg-w", a.what);
      h(r, "span", "mn-lg-e", `${a.en} \xB7 ${a.abbr}`);
    }
    h(this.contentEl, "p", "mn-lg-note", "\u4EAE\u7684\u5716\u793A\u4EE3\u8868\u9019\u4F4D\u82F1\u96C4\u6709;\u6697\u7684\u4EE3\u8868\u6C92\u6709\u3002\u6578\u5B57\u662F\u6709\u5E7E\u500B\u6280\u80FD\u6709\u9019\u500B\u6548\u679C\u3002");
  }
  onClose() {
    this.contentEl.empty();
  }
};
function abilityPills(parent, c, onlyLit = false) {
  const row2 = h(parent, "div", "mn-pills");
  for (const a of ABILITIES) {
    const n = count(c, a.tag);
    const lit = c.features.includes(a.tag);
    if (onlyLit && !lit) continue;
    const p = h(row2, "button", "mn-pill mn-pill-ic" + (lit ? " is-lit" : " is-off"));
    p.setAttribute("aria-label", a.tag);
    icon(p, a.icon);
    if (lit && n > 1) h(p, "span", "mn-pill-n", String(n));
    p.style.setProperty("--p", a.color);
    p.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      tip(p, `${a.tag} \xB7 ${a.abbr}`);
    });
  }
  return row2;
}
var reachOf = (c) => c.archetypes.find((a) => a === "\u8FD1\u6230" || a === "\u4E2D\u7A0B" || a === "\u9060\u7A0B") ?? "";
function difficultyDots(parent, c) {
  const dots = h(parent, "span", "mn-hard");
  const level = Math.max(1, Math.min(5, Math.ceil(c.difficulty / 2)));
  for (let i = 1; i <= 5; i++) h(dots, "i", i <= level ? "is-on" : "");
  return dots;
}
function damageMeters(parent, c) {
  const top = Math.max(c.attack, c.magic);
  for (const [kind, rating] of [["\u7269\u7406", c.attack], ["\u9B54\u6CD5", c.magic]]) {
    const row2 = h(parent, "div", "mn-mt" + (rating === top ? " is-main" : ""));
    h(row2, "span", "mn-mt-k", kind);
    h(h(row2, "span", "mn-mt-bar"), "i", "").style.width = `${Math.max(0, Math.min(10, rating)) * 10}%`;
    h(row2, "span", "mn-mt-n", String(rating));
  }
}
function factsRow(parent, c) {
  const spec = h(parent, "div", "mn-spec");
  const line = (label) => {
    const r = h(spec, "div", "mn-spec-r");
    h(r, "div", "mn-spec-l", label);
    return h(r, "div", "mn-spec-v");
  };
  damageMeters(line("\u50B7\u5BB3"), c);
  h(line("\u8DDD\u96E2"), "span", "", reachOf(c) || "\u2014");
  difficultyDots(line("\u96E3\u5EA6"), c);
}
function abilityBlock(parent, c, app) {
  const head = h(parent, "div", "mn-rq-al");
  h(head, "span", "mn-rq-fl", "\u6280\u80FD(\u9EDE\u5716\u793A\u770B\u540D\u7A31)");
  if (app) {
    const q = h(head, "button", "mn-lg-btn");
    icon(q, "circle-help");
    h(q, "span", "", "\u5716\u793A\u8AAA\u660E");
    q.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      new AbilityLegend(app).open();
    });
  }
  abilityPills(parent, c, false);
}
function championProfile(parent, c, color, app) {
  factsRow(parent, c);
  profileRadar(parent, profileAxes(c), color);
  abilityBlock(parent, c, app);
}

// src/pages/fresh.ts
function metaLine(parent, m, now) {
  const row2 = h(parent, "div", "mn-meta");
  const age = patchAge(m.patch, now);
  if (age === null) chip(row2, "\u26A0 \u7248\u672C\u672A\u8A3B\u660E", { color: "var(--color-red)" });
  else if (age === 0) chip(row2, `\u2713 ${m.patch}`, { color: "var(--color-green)" });
  else chip(row2, `\u26A0 ${m.patch}(\u5DF2\u904E ${age} \u7248)`, { color: age === 1 ? "var(--color-yellow)" : "var(--color-red)" });
  if (m.date) chip(row2, m.date);
  if (m.status) chip(row2, m.status, { color: m.status.includes("\u5F85") ? "var(--color-orange)" : "var(--color-green)" });
  if (m.source) {
    const a = h(row2, "button", "mn-chip mn-meta-src", `\u2197 ${m.sourceName || "\u4F86\u6E90"}`);
    a.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(m.source);
    });
  }
}

// src/pages/build.ts
var TOP_SETS = 3;
var TOP_ITEMS = 8;
var pct = (wins, games) => games ? Math.round(wins / games * 100) : 0;
function buildTab(body, c, ctx) {
  const store = ctx.plugin.store;
  const mode = ctx.plugin.settings.mode;
  const stats = store.stats?.champions[c.id];
  const mine = c.builds.filter((b) => b.mode === mode);
  const meta = mine.filter((b) => b.kind === "meta");
  const alt = mine.filter((b) => b.kind === "alt");
  const synergy = mine.filter((b) => b.kind === "synergy");
  if (stats || meta.length) {
    section(body, "\u5E38\u7528");
    if (stats) {
      const top = h(body, "div", "mn-chips");
      chip(top, `${stats.games} \u5834`);
      chip(top, `\u52DD\u7387 ${pct(stats.wins, stats.games)}%`, { color: "var(--color-green)" });
      if (store.stats?.date) chip(top, store.stats.date);
      for (const s of stats.sets.slice(0, TOP_SETS)) {
        const card2 = h(body, "div", "mn-set");
        itemRow(card2, c, ctx, s.items);
        h(card2, "div", "mn-set-m", `${s.games} \u5834 \xB7 \u52DD\u7387 ${pct(s.wins, s.games)}%`);
      }
      const card = h(body, "div", "mn-set");
      h(card, "div", "mn-set-t", "\u6700\u5E38\u51FA\u7684\u88DD\u5099");
      itemRow(card, c, ctx, stats.items.slice(0, TOP_ITEMS).map((i) => i.id), stats.items.slice(0, TOP_ITEMS).map((i) => `${pct(i.games, stats.games)}%`));
    }
    for (const b of meta) setCard(body, c, ctx, b);
  }
  if (alt.length) {
    section(body, "\u6709\u8DA3\u66FF\u4EE3");
    for (const b of alt) setCard(body, c, ctx, b);
  }
  if (synergy.length) {
    section(body, "\u642D\u914D");
    for (const b of synergy) setCard(body, c, ctx, b);
  }
  if (!stats && !mine.length) empty(body, { icon: "package-open", title: "No builds of ours yet", text: "Our own builds and ideas for this champion will appear here." });
  if (mode === "mayhem") liveStats(body, c);
}
var OPGG_SLUG = { MonkeyKing: "wukong" };
function liveStats(body, c) {
  const slug = OPGG_SLUG[c.id] ?? c.id.toLowerCase();
  section(body, "Live stats");
  const g = group(body);
  row(g, { icon: "external-link", title: "OP.GG Mayhem build", chevron: true, onTap: () => window.open(`https://op.gg/lol/modes/aram-mayhem/${slug}/build`) });
  row(g, { icon: "external-link", title: "Mobalytics Mayhem builds", chevron: true, onTap: () => window.open(`https://mobalytics.gg/lol/champions/${slug}/mayhem-builds`) });
}
function section(body, title) {
  h(body, "div", "mn-gh", title);
}
function setCard(body, c, ctx, b) {
  const card = h(body, "div", "mn-set");
  if (b.name) h(card, "div", "mn-set-t", b.name);
  if (b.with.length) {
    const row2 = h(card, "div", "mn-with");
    for (const id of b.with) {
      const mate = ctx.plugin.store.champion(id);
      const btn = h(row2, "button", "mn-with-b");
      const im = h(btn, "img");
      im.src = mate?.icon ?? "";
      im.alt = "";
      h(btn, "span", "", mate?.name ?? id);
      if (mate) btn.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.openChampion(mate.id);
      });
    }
  }
  itemRow(card, c, ctx, b.items);
  if (b.note) h(card, "div", "mn-set-n", b.note);
  metaLine(card, b, ctx.plugin.store.currentPatch());
}
function itemRow(parent, c, ctx, ids, captions = []) {
  const store = ctx.plugin.store;
  const row2 = h(parent, "div", "mn-items");
  const panel = h(parent, "div", "mn-item-panel");
  let open = -1;
  ids.forEach((id, i) => {
    const item = store.item(id);
    const btn = h(row2, "button", "mn-item");
    const im = h(btn, "img");
    im.src = item?.icon || `https://ddragon.leagueoflegends.com/cdn/${c.patch}/img/item/${id}.png`;
    im.alt = item?.name ?? String(id);
    if (captions[i]) h(btn, "span", "mn-item-c", captions[i]);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      open = open === i ? -1 : i;
      row2.querySelectorAll(".mn-item").forEach((b, j) => b.toggleClass("is-on", j === open));
      panel.empty();
      panel.toggleClass("is-open", open >= 0);
      if (open < 0) return;
      const head = h(panel, "div", "mn-ip-head");
      h(head, "span", "mn-ip-name", item?.name ?? `#${id}`);
      if (item) h(head, "span", "mn-ip-gold", `${item.goldTotal}`);
      if (item?.desc) h(panel, "p", "mn-sd-desc", item.desc);
    });
  });
}

// src/pages/changes.ts
var DIR_COLOR = { buff: "var(--color-green)", nerf: "var(--color-red)", mixed: "var(--color-yellow)", change: "var(--color-blue)", text: "var(--color-blue)" };
var DIR_MARK = { buff: "\u25B2", nerf: "\u25BC", mixed: "\u25C6", change: "\u25CF", text: "\u270E" };
var LOWER_IS_BETTER = /冷卻|消耗|前搖|後搖|施放時間/;
var HIGHER_IS_BETTER = /傷害|護盾|治療|回復|生命|護甲|魔抗|物防|魔防|攻擊力|物攻|魔攻|攻速|跑速|移速|射程|吸血|韌性|穿透|技能加速|魔力/;
var AMBIGUOUS = /受到|承受|減免|敵/;
var numbers = (s) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
function noteChangeDir(c) {
  const a = numbers(c.old), b = numbers(c.new);
  const n = Math.min(a.length, b.length);
  if (!n || AMBIGUOUS.test(c.label)) return "change";
  let up = 0, down = 0;
  for (let i = 0; i < n; i++) {
    if (b[i] > a[i]) up++;
    else if (b[i] < a[i]) down++;
  }
  if (up && down) return "mixed";
  if (!up && !down) return "change";
  const lower = LOWER_IS_BETTER.test(c.label);
  if (!lower && !HIGHER_IS_BETTER.test(c.label)) return "change";
  return up > 0 !== lower ? "buff" : "nerf";
}
function entryDir(e) {
  const dirs = e.changes.map(noteChangeDir);
  const buff = dirs.includes("buff"), nerf = dirs.includes("nerf");
  if (dirs.includes("mixed") || buff && nerf) return "mixed";
  return buff ? "buff" : nerf ? "nerf" : "change";
}
var marker = (d) => ({ mark: DIR_MARK[d] ?? "\u25CF", color: DIR_COLOR[d] ?? DIR_COLOR.change });
function tally(items) {
  return { buff: items.filter((i) => i.dir === "buff").length, nerf: items.filter((i) => i.dir === "nerf").length, mixed: items.filter((i) => i.dir === "mixed").length };
}
function badgeText(items) {
  const t = tally(items);
  return [t.buff ? `\u25B2${t.buff}` : "", t.nerf ? `\u25BC${t.nerf}` : "", t.mixed ? `\u25C6${t.mixed}` : ""].filter(Boolean).join(" ");
}
function badgeColor(items) {
  const t = tally(items);
  if (t.mixed || t.buff && t.nerf) return DIR_COLOR.mixed;
  return t.nerf ? DIR_COLOR.nerf : t.buff ? DIR_COLOR.buff : DIR_COLOR.change;
}
function officialBlock(parent, list2) {
  for (const { patch, url, entry } of list2) {
    const sec = h(parent, "div", "mn-off");
    const head = h(sec, "div", "mn-off-h");
    h(head, "span", "mn-off-t", `Riot ${patch} \u7248\u672C\u516C\u544A`);
    const link = h(head, "button", "mn-off-link", "\u5168\u6587 \u2197");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(url);
    });
    for (const c of entry.changes) {
      const line = h(sec, "div", "mn-ent-ch");
      h(line, "div", "mn-ent-l", c.label);
      const vals = h(line, "div", "mn-ent-v");
      h(vals, "span", "mn-chg-old", c.old);
      h(vals, "span", "mn-chg-arrow", "\u2192");
      h(vals, "span", "mn-chg-new", c.new);
    }
    if (entry.more) h(sec, "div", "mn-gf", `\u9084\u6709 ${entry.more} \u9805,\u898B\u5168\u6587`);
  }
}
function changesBlock(parent, c, ctx) {
  const store = ctx.plugin.store;
  const patches = store.changesOf(c.id);
  const official = store.officialFor("champions", c.name);
  if (!patches.length && !official.length) return null;
  const el = h(parent, "div", "mn-chg");
  const head = h(el, "button", "mn-chg-head");
  icon(head, "history", "mn-chg-ic");
  h(head, "span", "mn-chg-t", `Recent changes \xB7 ${official.length || patches.length} patch${(official.length || patches.length) > 1 ? "es" : ""}`);
  const caret = icon(head, "chevron-down", "mn-chg-caret");
  const body = h(el, "div", "mn-chg-body");
  if (official.length) officialBlock(body, official);
  if (patches.length) h(body, "div", "mn-chg-sub", "\u8CC7\u6599\u6BD4\u5C0D(\u51B7\u537B\u3001\u6D88\u8017\u3001\u5C04\u7A0B\u3001\u5C6C\u6027)");
  for (const p of patches) {
    h(body, "div", "mn-chg-p", `${p.from} \u2192 ${p.patch}`);
    for (const i of p.items) {
      const row2 = h(body, "div", "mn-chg-row");
      const mark = h(row2, "span", "mn-chg-m", DIR_MARK[i.dir] ?? "\u25CF");
      mark.style.color = DIR_COLOR[i.dir];
      h(row2, "span", "mn-chg-s", i.scope);
      h(row2, "span", "mn-chg-f", i.field);
      if (i.dir === "text") {
        const more = h(row2, "button", "mn-chg-more", "Old / new wording");
        const diff = h(body, "div", "mn-chg-diff");
        more.addEventListener("click", (e) => {
          e.preventDefault();
          diff.toggleClass("is-open", !diff.hasClass("is-open"));
        });
        h(diff, "div", "mn-chg-old", i.old);
        h(diff, "div", "mn-chg-new", i.new);
      } else {
        h(row2, "span", "mn-chg-old", i.old);
        h(row2, "span", "mn-chg-arrow", "\u2192");
        const nv = h(row2, "span", "mn-chg-new", i.new);
        nv.style.color = DIR_COLOR[i.dir];
      }
    }
  }
  const set = (open) => {
    el.toggleClass("is-open", open);
    caret.toggleClass("is-up", open);
  };
  head.addEventListener("click", (e) => {
    e.preventDefault();
    set(!el.hasClass("is-open"));
  });
  return { el, open: () => set(true) };
}

// src/pages/skills.ts
function skillStrip(parent, c, changes = []) {
  if (!c.skills.length) return;
  const strip2 = h(parent, "div", "mn-skills");
  const detail = h(parent, "div", "mn-skill-detail");
  let open = -1;
  const boxes = c.skills.map((s, i) => {
    const box = h(strip2, "button", "mn-skill-box");
    box.setAttribute("aria-label", `${s.key} ${s.name}`);
    const im = h(box, "img");
    im.src = s.icon;
    im.alt = "";
    box.style.setProperty("--chip", DAMAGE_COLOR[s.damage[0] ?? ""] ?? "var(--background-modifier-border)");
    h(box, "span", "mn-skill-k", s.key);
    if (s.upgrade) icon(box, "chevrons-up", "mn-skill-up");
    box.addEventListener("click", (e) => {
      e.preventDefault();
      show(open === i ? -1 : i);
    });
    return box;
  });
  const show = (i) => {
    open = i;
    boxes.forEach((b, j) => b.toggleClass("is-on", j === i));
    detail.empty();
    detail.toggleClass("is-open", i >= 0);
    if (i < 0) return;
    const s = c.skills[i];
    const head = h(detail, "div", "mn-sd-head");
    h(head, "span", "mn-sd-key", s.key);
    h(head, "span", "mn-sd-name", s.name);
    const types = h(head, "span", "mn-sd-types");
    for (const d of s.damage) chip(types, `${d}\u50B7\u5BB3`, { color: DAMAGE_COLOR[d] });
    if (s.range) {
      const m = h(detail, "div", "mn-sd-meta");
      const cell = h(m, "div", "mn-sd-cell");
      h(cell, "span", "mn-sd-k", "\u5C04\u7A0B");
      const rv = h(cell, "span", "mn-sd-v", s.range);
      const rc = changes.find((x) => x.scope === s.key && x.field === "\u5C04\u7A0B");
      if (rc) {
        rv.style.color = DIR_COLOR[rc.dir];
        h(cell, "span", "mn-chg-was", `\u4E0A\u7248 ${rc.old}`);
      }
    }
    rankTable(detail, s, changes.filter((x) => x.scope === s.key));
    if (s.desc) h(detail, "p", "mn-sd-desc", s.desc);
    if (s.upgrade) {
      const up = h(detail, "div", "mn-sd-up");
      const t = h(up, "div", "mn-sd-up-t");
      icon(t, "chevrons-up", "mn-sd-up-ic");
      h(t, "span", "", "\u9032\u5316 / \u5347\u7D1A");
      h(up, "p", "mn-sd-desc", s.upgrade);
    }
    demo(detail, c, s);
    window.requestAnimationFrame(() => detail.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
}
var DEMO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities";
function demo(parent, c, s) {
  if (!c.key) return;
  const key = String(c.key).padStart(4, "0");
  const url = `${DEMO_BASE}/${key}/ability_${key}_${s.key}1`;
  const v = h(parent, "video", "mn-sd-video");
  v.muted = true;
  v.loop = true;
  v.autoplay = true;
  v.controls = true;
  v.preload = "metadata";
  v.setAttribute("playsinline", "");
  const mp4 = h(v, "source");
  mp4.src = `${url}.mp4`;
  mp4.type = "video/mp4";
  const webm = h(v, "source");
  webm.src = `${url}.webm`;
  webm.type = "video/webm";
  webm.addEventListener("error", () => v.remove());
}
var ROW_COLOR = [["\u9B54\u6CD5", DAMAGE_COLOR["\u9B54\u6CD5"]], ["\u7269\u7406", DAMAGE_COLOR["\u7269\u7406"]], ["\u771F\u5BE6", DAMAGE_COLOR["\u771F\u5BE6"]], ["\u6CBB\u7642", "var(--color-green)"], ["\u8B77\u76FE", "var(--color-cyan)"]];
function rankTable(parent, s, changes) {
  if (!s.rows.length) return;
  const ranks = Math.max(1, ...s.rows.map((r) => r.vals.length));
  const grid = h(parent, "div", "mn-rk");
  grid.style.setProperty("--r", String(ranks));
  if (ranks > 1) {
    h(grid, "div", "mn-rk-h");
    for (let i = 1; i <= ranks; i++) h(grid, "div", "mn-rk-h", String(i));
  }
  for (const r of s.rows) {
    const name = h(grid, "div", "mn-rk-l");
    const label = h(name, "span", "mn-rk-name", r.label);
    const color = ROW_COLOR.find(([k]) => r.label.startsWith(k))?.[1];
    if (color) label.style.color = color;
    if (r.note) h(name, "span", "mn-rk-note", r.note);
    const ch = changes.find((x) => r.label.startsWith(x.field));
    if (ch) h(name, "span", "mn-chg-was", `\u4E0A\u7248 ${ch.old}`);
    const tint = (el) => {
      if (ch) el.style.color = DIR_COLOR[ch.dir];
    };
    if (r.vals.length === 1) {
      const v = h(grid, "div", "mn-rk-v mn-rk-all", r.vals[0]);
      v.style.gridColumn = `span ${ranks}`;
      tint(v);
    } else for (const v of r.vals) tint(h(grid, "div", "mn-rk-v", v));
  }
}

// src/pages/champions.ts
var ROLES = ["\u6230\u58EB", "\u5766\u514B", "\u6CD5\u5E2B", "\u523A\u5BA2", "\u5C04\u624B", "\u8F14\u52A9"];
var DAMAGES = ["\u7269\u7406", "\u9B54\u6CD5", "\u6DF7\u5408"];
var FEATURES = ["\u63A7\u5834", "\u7DE9\u901F", "\u4F4D\u79FB", "\u6CBB\u7642", "\u8B77\u76FE", "\u5438\u8840", "\u5F37\u5316\u666E\u653B"];
var REACH = ["\u8FD1\u6230", "\u4E2D\u7A0B", "\u9060\u7A0B"];
var SORTS2 = [["name", "\u540D\u7A31"], ["easy", "\u7C21\u55AE\u512A\u5148"], ["range", "\u5C04\u7A0B\u9060\u512A\u5148"]];
var SEARCH_EXTRA = 8;
var F = { roles: /* @__PURE__ */ new Set(), dmg: "", feat: /* @__PURE__ */ new Map(), reach: "", sort: "name", open: false };
var activeFilters = () => F.roles.size + (F.dmg ? 1 : 0) + F.feat.size + (F.reach ? 1 : 0);
function matches(c) {
  if (F.roles.size && !c.roles.some((r) => F.roles.has(r))) return false;
  if (F.dmg && c.damageType !== F.dmg) return false;
  for (const [f, want] of F.feat) if (c.features.includes(f) !== (want === 1)) return false;
  return !F.reach || c.archetypes.includes(F.reach);
}
function sorted(list2) {
  if (F.sort === "easy") return [...list2].sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name, "zh-Hant"));
  if (F.sort === "range") return [...list2].sort((a, b) => b.range - a.range || a.name.localeCompare(b.name, "zh-Hant"));
  return list2;
}
function championPicker(parent, ctx) {
  const store = ctx.plugin.store;
  const all = store.champions();
  if (!all.length) {
    empty(parent, { icon: "database", title: "No champion notes yet", text: "Run python3 tools/fetch_data.py" });
    return;
  }
  let query = "";
  const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)]));
  const picked = ctx.plugin.settings.roster.map((id) => store.champion(id)).filter((c) => !!c);
  const qk = h(parent, "button", "mn-qk");
  icon(h(qk, "span", "mn-qk-ic"), "scan-search");
  const qt = h(qk, "div", "mn-qk-main");
  h(qt, "div", "mn-qk-t", "\u5927\u6DF7\u6230\u901F\u67E5");
  h(qt, "div", "mn-qk-s", picked.length ? `\u4F60\u9078\u4E86 ${picked.length} \u4F4D\u82F1\u96C4,\u9EDE\u958B\u770B\u5404\u81EA\u7684\u5B9A\u4F4D\u548C\u80FD\u529B` : "\u62FF\u5230\u4E0D\u8A8D\u8B58\u7684\u82F1\u96C4?\u9EDE\u4E00\u4E0B\u5C31\u77E5\u9053\u5B9A\u4F4D\u548C\u80FD\u529B");
  if (picked.length) {
    const strip2 = h(qt, "div", "mn-qk-strip");
    for (const c of picked.slice(0, 8)) {
      const im = h(strip2, "img");
      im.src = c.icon;
      im.alt = "";
    }
  }
  icon(qk, "chevron-right", "mn-row-chev");
  qk.addEventListener("click", (e) => {
    e.preventDefault();
    ctx.push({ key: "roster", title: "\u901F\u67E5" });
  });
  const box = h(parent, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search champions, augments, items";
  search.setAttribute("enterkeyhint", "search");
  const filters = h(parent, "div", "mn-fgroup");
  const panel = h(parent, "div", "mn-fpanel");
  const count2 = h(parent, "div", "mn-count");
  const grid = h(parent, "div", "mn-grid");
  const extra = h(parent, "div");
  const draw = () => {
    grid.empty();
    extra.empty();
    const q = query.trim().toLowerCase();
    const hits = sorted(all.filter((c) => matches(c) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))));
    count2.textContent = `${hits.length} / ${all.length}`;
    for (const c of hits) {
      const tile2 = h(grid, "button", "mn-tile");
      const im = h(tile2, "img");
      im.src = c.icon;
      im.loading = "lazy";
      im.alt = "";
      const rd = recent.get(c.name);
      if (rd) {
        const m = marker(rd);
        const b = h(tile2, "span", "mn-tile-b", m.mark);
        b.style.background = m.color;
      }
      h(tile2, "span", "mn-tile-n", c.name);
      tile2.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.openChampion(c.id);
      });
    }
    if (!q) return;
    if (!hits.length) empty(grid, { icon: "search-x", title: "No champion" });
    const augs = ctx.plugin.settings.mode === "mayhem" ? store.augments().filter((a) => a.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA) : [];
    if (augs.length) {
      const g = group(extra, "Augments");
      for (const a of augs) row(g, { image: a.icon, rarity: a.rarity, title: a.name, value: a.rarity, chevron: true, onTap: () => ctx.openAugment(a.id) });
    }
    const items = store.modeItems().filter((i) => i.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA);
    if (items.length) {
      const g = group(extra, "Items");
      for (const i of items) row(g, { image: i.icon, title: i.name, sub: i.desc || void 0, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openItem(i.id) });
    }
  };
  const redraw = () => {
    drawFilters();
    drawPanel();
    draw();
  };
  const drawFilters = () => {
    filters.empty();
    const roleRow = fgrid(filters, ROLES.length);
    for (const r of ROLES) chip(roleRow, r, { on: F.roles.has(r), onTap: () => {
      F.roles.has(r) ? F.roles.delete(r) : F.roles.add(r);
      redraw();
    } });
    const kindRow = fgrid(filters, DAMAGES.length + 1);
    for (const d of DAMAGES) chip(kindRow, d, { on: F.dmg === d, color: DAMAGE_COLOR[d], onTap: () => {
      F.dmg = F.dmg === d ? "" : d;
      redraw();
    } });
    const n = activeFilters();
    const fb = h(kindRow, "button", "mn-filterbtn" + (F.open ? " is-open" : "") + (n ? " has-n" : ""));
    icon(fb, "sliders-horizontal", "mn-filterbtn-ic");
    h(fb, "span", "", "\u7BE9\u9078");
    if (n) h(fb, "span", "mn-filterbtn-n", String(n));
    fb.addEventListener("click", (e) => {
      e.preventDefault();
      F.open = !F.open;
      drawFilters();
      drawPanel();
    });
  };
  const drawPanel = () => {
    panel.empty();
    panel.toggleClass("is-open", F.open);
    if (!F.open) return;
    const on = activeFilters();
    const top = h(panel, "div", "mn-fp-top");
    h(top, "span", "mn-fp-count", on ? `\u5DF2\u9078 ${on} \u9805` : "\u9078\u64C7\u689D\u4EF6");
    if (on || F.sort !== "name") {
      const clear = h(top, "button", "mn-clear", "\u5168\u90E8\u6E05\u9664");
      clear.addEventListener("click", (e) => {
        e.preventDefault();
        F.roles.clear();
        F.dmg = "";
        F.feat.clear();
        F.reach = "";
        F.sort = "name";
        redraw();
      });
    }
    const sect = (title, hint = "") => {
      const s = h(panel, "div", "mn-fp-s");
      const head = h(s, "div", "mn-fp-h");
      h(head, "span", "mn-fp-t", title);
      if (hint) h(head, "span", "mn-fp-hint", hint);
      return s;
    };
    const ab = h(sect("\u6280\u80FD"), "div", "mn-chips");
    for (const f of FEATURES) {
      const st = F.feat.get(f);
      chip(ab, (st === 1 ? "\u2713 " : st === -1 ? "\u2715 " : "") + f, {
        on: st !== void 0,
        color: st === -1 ? "var(--color-red)" : "var(--color-green)",
        onTap: () => {
          if (st === void 0) F.feat.set(f, 1);
          else if (st === 1) F.feat.set(f, -1);
          else F.feat.delete(f);
          redraw();
        }
      });
    }
    segmented(sect("\u8DDD\u96E2"), [["", "\u5168\u90E8"], ...REACH.map((r) => [r, r])], F.reach, (id) => {
      F.reach = id;
      redraw();
    }, "is-sm");
    segmented(sect("\u6392\u5E8F"), SORTS2, F.sort, (id) => {
      F.sort = id;
      redraw();
    }, "is-sm");
  };
  search.addEventListener("input", () => {
    query = search.value;
    draw();
  });
  redraw();
}
function championsPage(ctx) {
  if (ctx.frame.key === "champion") return championCard(ctx);
  const el = page("Champions");
  championPicker(el, ctx);
  return { title: "Champions", el };
}
var lastSub = /* @__PURE__ */ new Map();
function rememberSub(id, sub) {
  lastSub.set(id, sub);
}
function championCard(ctx) {
  const c = ctx.plugin.store.champion(String(ctx.frame.params?.id ?? ""));
  const el = h(null, "div", "mn-page");
  if (!c) {
    empty(el, { icon: "user-x", title: "Champion not found" });
    return { title: "", el };
  }
  const hero = h(el, "div", "mn-hero");
  const bg = h(hero, "div", "mn-hero-bg");
  bg.style.backgroundImage = `url("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg")`;
  const head = h(hero, "div", "mn-card-head");
  const im = h(head, "img", "mn-card-img");
  im.src = c.icon;
  im.alt = "";
  const who = h(head, "div", "mn-card-who");
  h(who, "h1", "mn-title", c.name);
  h(who, "div", "mn-card-sub", c.title);
  const tags = h(who, "div", "mn-chips");
  for (const r of c.roles) chip(tags, r);
  if (c.tier) chip(tags, `\u8A55\u50F9 ${c.tier}`, { color: "var(--color-green)" });
  const now = ctx.plugin.store.currentChanges(c.id);
  const openChanges = () => {
    show("skills");
    block?.open();
    block?.el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const official = ctx.plugin.store.officialFor("champions", c.name)[0];
  if (badgeText(now)) chip(tags, badgeText(now), { color: badgeColor(now), onTap: openChanges });
  else if (official) {
    const m = marker(entryDir(official.entry));
    chip(tags, `${m.mark} ${official.patch}`, { color: m.color, onTap: openChanges });
  }
  championProfile(h(el, "div", "mn-panel mn-profile"), c, "var(--mn-muted)", ctx.app);
  const mayhem = ctx.plugin.settings.mode === "mayhem";
  const tabs = [["skills", "Skills"], ["build", "Build"], ["augments", mayhem ? "Augments" : "Runes"], ["tips", "Tips"]];
  let block = null;
  const seg = h(el, "div", "mn-seg");
  const body = h(el, "div", "mn-sub");
  const show = (t) => {
    lastSub.set(c.id, t);
    seg.querySelectorAll(".mn-seg-b").forEach((b) => b.toggleClass("is-on", b.dataset.t === t));
    body.empty();
    if (t === "skills") block = skills(body, c, ctx);
    else if (t === "build") buildTab(body, c, ctx);
    else if (t === "augments") soon(body, mayhem ? "Best augments" : "Runes");
    else tips(body, c, ctx);
  };
  for (const [t, label] of tabs) {
    const b = h(seg, "button", "mn-seg-b", label);
    b.dataset.t = t;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      show(t);
    });
  }
  show(lastSub.get(c.id) ?? "skills");
  return { title: "", el };
}
function skills(body, c, ctx) {
  skillStrip(body, c, ctx.plugin.store.currentChanges(c.id));
  if (c.video) row(group(body), { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video)}`) });
  return changesBlock(body, c, ctx);
}
function soon(body, title) {
  row(group(body), { icon: "sparkles", title, value: "Soon", muted: true });
}
function tips(body, c, ctx) {
  void ctx;
  if (!c.tips.length) {
    empty(body, { icon: "lightbulb", title: "No tips yet", text: "Add tips to this champion's note." });
    return;
  }
  for (const t of c.tips) {
    const card = h(body, "div", "mn-tip");
    icon(card, "lightbulb", "mn-tip-ic");
    const main = h(card, "div", "mn-tip-main");
    h(main, "div", "mn-tip-t", t.title);
    h(main, "div", "mn-tip-s", t.text);
    metaLine(main, t, ctx.plugin.store.currentPatch());
    if (t.video) {
      const v = h(main, "button", "mn-tip-v", "\u25B6 Video");
      v.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(t.video)}`);
      });
    }
  }
}

// src/pages/detail.ts
var import_obsidian6 = require("obsidian");

// src/pages/deck.ts
var import_obsidian5 = require("obsidian");
var STRIP = 6;
function parseSlides(md) {
  const body = md.replace(/^---[\s\S]*?---\n/, "");
  return body.split(/^## /m).slice(1).map((part) => {
    const lines = part.split("\n");
    const title = (lines.shift() ?? "").trim();
    let ic = "", visual2 = "";
    const text = [];
    for (const l of lines) {
      const m = /^(icon|visual):\s*(.*)$/.exec(l.trim());
      if (m) {
        if (m[1] === "icon") ic = m[2].trim();
        else visual2 = m[2].trim();
      } else text.push(l);
    }
    return { title, icon: ic || "sparkles", visual: visual2, text: text.join("\n").trim() };
  });
}
var hashStr = (s) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
};
var day = () => String(Math.floor(Date.now() / 864e5));
function deckPage(ctx, file) {
  const store = ctx.plugin.store;
  const el = h(null, "div", "mn-page mn-deckpage");
  h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
  const dots = h(el, "div", "mn-dots");
  const pager = h(el, "div", "mn-pager");
  const nav = h(el, "div", "mn-decknav");
  void ctx.app.vault.cachedRead(file).then((md) => {
    const slides = parseSlides(md);
    const guide = store.guideNotes();
    const at = guide.findIndex((n) => n.file.path === file.path);
    const next = guide[at + 1];
    slides.forEach((s, i) => {
      h(dots, "span", "mn-dot2" + (i === 0 ? " is-on" : ""));
      const sec = h(pager, "section", "mn-slide");
      visual(ctx, h(sec, "div", "mn-sl-vis"), s);
      h(sec, "h2", "mn-sl-t", s.title);
      if (s.text) void import_obsidian5.MarkdownRenderer.render(ctx.app, s.text, h(sec, "div", "mn-sl-x markdown-rendered"), file.path, ctx.component);
    });
    const end = h(pager, "section", "mn-slide mn-slide-end");
    h(h(end, "div", "mn-sl-vis"), "div", "mn-sl-hero").appendChild(document.createTextNode("\u{1F389}"));
    h(end, "h2", "mn-sl-t", next ? "\u8B80\u5B8C\u4E86!" : "\u5168\u90E8\u8B80\u5B8C\u4E86!");
    if (next) {
      const b = h(end, "button", "mn-nextcard");
      h(b, "span", "mn-nextcard-k", "\u4E0B\u4E00\u7BC7");
      h(b, "span", "mn-nextcard-t", next.title);
      icon(b, "arrow-right", "mn-nextcard-ic");
      b.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.pop();
        ctx.openNote(next.file.path);
      });
    }
    h(dots, "span", "mn-dot2");
    const count2 = slides.length + 1;
    const prev = h(nav, "button", "mn-navb", "\u2039");
    const label = h(nav, "span", "mn-navl", `1 / ${count2}`);
    const fwd = h(nav, "button", "mn-navb", "\u203A");
    const go = (d) => pager.scrollBy({ left: d * pager.clientWidth, behavior: "smooth" });
    prev.addEventListener("click", (e) => {
      e.preventDefault();
      go(-1);
    });
    fwd.addEventListener("click", (e) => {
      e.preventDefault();
      go(1);
    });
    pager.addEventListener("scroll", () => {
      const i = Math.max(0, Math.min(count2 - 1, Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth))));
      Array.from(dots.children).forEach((d, j) => d.toggleClass("is-on", j === i));
      label.textContent = `${i + 1} / ${count2}`;
      if (i >= count2 - 1) void ctx.plugin.markRead(file.path);
    }, { passive: true });
  });
  return { title: "", el };
}
function visual(ctx, box, s) {
  const store = ctx.plugin.store;
  const [kind, ...args] = s.visual.split(/\s+/).filter(Boolean);
  const champ = (id) => id ? store.champion(id) : void 0;
  if (kind === "video") {
    const c = champ(args[0]);
    if (c) {
      const wrap = h(box, "div", "mn-sl-video");
      demo(wrap, c, { key: args[1] ?? "Q" });
      return;
    }
  } else if (kind === "img") {
    const src = args.join(" ");
    const url = /^https?:/.test(src) ? src : ctx.app.vault.adapter.getResourcePath(src);
    const im = h(box, "img", "mn-sl-img");
    im.src = url;
    im.alt = "";
    return;
  } else if (kind === "radar") {
    const c = champ(args[0]);
    if (c) {
      profileRadar(h(box, "div", "mn-sl-radar"), profileAxes(c), DAMAGE_COLOR[c.damageType] ?? "var(--interactive-accent)");
      return;
    }
  } else if (kind === "skills") {
    const c = champ(args[0]);
    if (c) {
      const strip2 = h(box, "div", "mn-skills mn-sl-skills");
      for (const k of c.skills) {
        const b = h(strip2, "div", "mn-skill-box");
        b.style.setProperty("--chip", DAMAGE_COLOR[k.damage[0] ?? ""] ?? "var(--background-modifier-border)");
        const im = h(b, "img");
        im.src = k.icon;
        im.alt = "";
        h(b, "span", "mn-skill-k", k.key);
      }
      return;
    }
  } else if (kind === "role") {
    const list2 = store.champions().filter((c) => c.roles.includes(args[0] ?? "")).sort((a, b) => hashStr(a.id + day()) - hashStr(b.id + day())).slice(0, STRIP);
    if (list2.length) {
      strip(box, list2.map((c) => ({ src: c.icon, label: c.name, tap: () => ctx.openChampion(c.id) })));
      return;
    }
  } else if (kind === "champs") {
    const list2 = args.map(champ).filter((c) => !!c);
    if (list2.length) {
      strip(box, list2.map((c) => ({ src: c.icon, label: c.name, tap: () => ctx.openChampion(c.id) })));
      return;
    }
  } else if (kind === "itemtag") {
    const list2 = store.items().filter((i) => i.aram && i.tags.includes(args[0] ?? "") && i.into.length === 0 && i.goldTotal >= 2e3).sort((a, b) => hashStr(String(a.id) + day()) - hashStr(String(b.id) + day())).slice(0, STRIP - 1);
    if (list2.length) {
      strip(box, list2.map((i) => ({ src: i.icon, label: i.name, tap: () => ctx.openItem(i.id) })));
      return;
    }
  } else if (kind === "item") {
    const i = store.item(Number(args[0]));
    if (i) {
      const parts = i.from.map((id) => store.item(id)).filter((x) => !!x);
      strip(box, [{ src: i.icon, label: i.name, tap: () => ctx.openItem(i.id) }, ...parts.map((p) => ({ src: p.icon, label: p.name, tap: () => ctx.openItem(p.id) }))]);
      return;
    }
  } else if (kind === "augs") {
    const list2 = store.augments().filter((a) => a.rarity === args[0]).sort((a, b) => hashStr(String(a.id) + day()) - hashStr(String(b.id) + day())).slice(0, STRIP);
    if (list2.length) {
      strip(box, list2.map((a) => ({ src: a.icon, label: a.name, rarity: a.rarity, tap: () => ctx.openAugment(a.id) })));
      return;
    }
  }
  icon(h(box, "div", "mn-sl-hero"), s.icon);
}
function strip(box, items) {
  const row2 = h(box, "div", "mn-sl-strip");
  for (const it of items) {
    const b = h(row2, "button", "mn-sl-ic");
    if (it.rarity) augIcon(b, it.src, it.rarity, "mn-sl-aug");
    else {
      const im = h(b, "img");
      im.src = it.src;
      im.alt = "";
    }
    h(b, "span", "", it.label);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      it.tap();
    });
  }
}

// src/pages/detail.ts
var TAG_ZH = {
  Damage: "\u7269\u7406\u653B\u64CA",
  SpellDamage: "\u9B54\u6CD5\u653B\u64CA",
  Armor: "\u8B77\u7532",
  SpellBlock: "\u9B54\u6297",
  Health: "\u751F\u547D",
  HealthRegen: "\u751F\u547D\u56DE\u5FA9",
  Mana: "\u9B54\u529B",
  ManaRegen: "\u9B54\u529B\u56DE\u5FA9",
  CriticalStrike: "\u66B4\u64CA",
  AttackSpeed: "\u653B\u901F",
  LifeSteal: "\u751F\u547D\u5077\u53D6",
  SpellVamp: "\u6CD5\u8853\u5438\u8840",
  AbilityHaste: "\u6280\u80FD\u52A0\u901F",
  CooldownReduction: "\u51B7\u537B\u7E2E\u6E1B",
  MagicPenetration: "\u9B54\u6CD5\u7A7F\u900F",
  ArmorPenetration: "\u8B77\u7532\u7A7F\u900F",
  NonbootsMovement: "\u79FB\u901F",
  Boots: "\u978B\u5B50",
  OnHit: "\u653B\u64CA\u7279\u6548",
  Active: "\u4E3B\u52D5",
  Tenacity: "\u97CC\u6027"
};
var SUGGESTED = 12;
function notePage(ctx) {
  const path = String(ctx.frame.params?.path ?? "");
  const file = ctx.app.vault.getAbstractFileByPath(path);
  const el = h(null, "div", "mn-page");
  if (!(file instanceof import_obsidian6.TFile)) {
    empty(el, { icon: "file-x", title: "Note not found" });
    return { title: "", el };
  }
  if (ctx.plugin.store.guideNotes().some((n) => n.file.path === path && n.layout === "deck")) return deckPage(ctx, file);
  h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
  const body = h(el, "div", "mn-note markdown-rendered");
  void ctx.app.vault.cachedRead(file).then((text) => import_obsidian6.MarkdownRenderer.render(ctx.app, text.replace(/^---[\s\S]*?---\n/, ""), body, path, ctx.component));
  const guide = ctx.plugin.store.guideNotes();
  const at = guide.findIndex((n) => n.file.path === path);
  if (at >= 0) {
    void ctx.plugin.markRead(path);
    const next = guide[at + 1];
    if (next) {
      const b = h(el, "button", "mn-nextcard");
      h(b, "span", "mn-nextcard-k", "\u4E0B\u4E00\u7BC7");
      h(b, "span", "mn-nextcard-t", next.title);
      icon(b, "arrow-right", "mn-nextcard-ic");
      b.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.pop();
        ctx.openNote(next.file.path);
      });
    } else h(el, "div", "mn-nextcard-done", "\u{1F389} \u5168\u90E8\u8B80\u5B8C\u4E86");
  }
  row(group(el), { icon: "pencil", title: "Edit in Obsidian", chevron: true, onTap: () => void ctx.plugin.openPath(path) });
  return { title: "", el };
}
var KINDS = [
  { tag: "\u9B54\u6CD5\u653B\u64CA", re: /魔攻|魔法攻擊|法術強度/, fits: (c) => c.damageType === "\u9B54\u6CD5" || c.damageType === "\u6DF7\u5408" },
  { tag: "\u7269\u7406\u653B\u64CA", re: /物攻|物理攻擊/, fits: (c) => c.damageType === "\u7269\u7406" || c.damageType === "\u6DF7\u5408" },
  { tag: "\u666E\u653B", re: /普攻|普通攻擊|攻速|暴擊/, fits: (c) => c.roles.includes("\u5C04\u624B") || c.damageType === "\u7269\u7406" && c.archetypes.includes("\u8FD1\u6230") },
  { tag: "\u6280\u80FD", re: /技能|大絕|冷卻/, fits: (c) => c.damageType === "\u9B54\u6CD5" || c.roles.includes("\u6CD5\u5E2B") },
  { tag: "\u751F\u5B58", re: /生命|物防|魔防|護甲|魔抗|韌性|減傷/, fits: (c) => c.roles.includes("\u5766\u514B") || c.roles.includes("\u6230\u58EB") },
  { tag: "\u8B77\u76FE / \u6CBB\u7642", re: /護盾|治療|回復/, fits: (c) => c.features.includes("\u8B77\u76FE") || c.features.includes("\u6CBB\u7642") || c.roles.includes("\u8F14\u52A9") },
  { tag: "\u8DD1\u901F / \u4F4D\u79FB", re: /跑速|衝刺|位移/, fits: (c) => c.features.includes("\u4F4D\u79FB") },
  { tag: "\u63A7\u5834", re: /緩速|暈眩|擊飛|控制|定身|擊退/, fits: (c) => c.features.includes("\u63A7\u5834") }
];
function suggest(effect, champions) {
  const kinds = KINDS.filter((k) => k.re.test(effect));
  if (!kinds.length) return { tags: [], champions: [] };
  const need = Math.max(1, Math.ceil(kinds.length * 0.6));
  const scored = champions.map((c) => ({ c, n: kinds.filter((k) => k.fits(c)).length })).filter((x) => x.n >= need);
  scored.sort((a, b) => b.n - a.n || a.c.name.localeCompare(b.c.name, "zh-Hant"));
  return { tags: kinds.map((k) => k.tag), champions: scored.slice(0, SUGGESTED).map((x) => x.c) };
}
function augmentPage(ctx) {
  const store = ctx.plugin.store;
  const a = store.augment(Number(ctx.frame.params?.id));
  const el = h(null, "div", "mn-page");
  if (!a) {
    empty(el, { icon: "sparkles", title: "Augment not found" });
    return { title: "", el };
  }
  const history = store.augmentHistory(a.name);
  const head = h(el, "div", "mn-dhead");
  augIcon(head, a.icon, a.rarity, "mn-dimg-aug");
  const who = h(head, "div", "mn-dwho");
  h(who, "h1", "mn-title", a.name);
  const tags = h(who, "div", "mn-chips");
  chip(tags, a.rarity, { color: RARITY_COLOR[a.rarity] });
  const last = history[0];
  if (last) chip(tags, `${last.what === "added" ? "\u65B0\u589E\u65BC" : "\u79FB\u9664\u65BC"} ${last.patch}`, { color: last.what === "added" ? "var(--color-blue)" : "var(--color-red)" });
  const panel = h(el, "div", "mn-panel mn-dpanel");
  if (a.effect) {
    h(panel, "p", "mn-dtext", a.effect);
    const official = store.officialEffect(a.name) === a.effect;
    h(panel, "div", "mn-pn-src", `Effect text: Riot Games ${official ? "patch notes" : "game text"}`);
    if (a.partial) h(panel, "div", "mn-pn-src", "X = \u904A\u6232\u5167\u624D\u770B\u5F97\u5230\u7684\u6578\u503C");
  } else {
    h(panel, "p", "mn-dtext mn-muted", "\u9019\u500B\u5F37\u5316\u7684\u6548\u679C\u8AAA\u660E\u9084\u6C92\u6709\u6536\u9304\u3002");
    const links = group(el);
    row(links, { icon: "external-link", title: "\u5728 League \u7DAD\u57FA\u67E5\u770B\u6548\u679C", chevron: true, onTap: () => window.open("https://wiki.leagueoflegends.com/en-us/ARAM_Mayhem/Augments") });
    row(links, { icon: "external-link", title: "OP.GG \u5F37\u5316\u5217\u8868", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
  }
  const all = store.champions();
  let tagList = [], list2 = [], label = "";
  if (a.fits.length) {
    tagList = a.fits;
    list2 = all.filter((c) => a.fits.some((f) => c.archetypes.includes(f) || c.features.includes(f) || c.roles.includes(f))).slice(0, SUGGESTED);
    label = "\u4EBA\u5DE5\u6574\u7406";
  } else if (a.effect) {
    const s = suggest(a.effect, all);
    tagList = s.tags;
    list2 = s.champions;
    label = "\u4F9D\u6548\u679C\u6587\u5B57\u81EA\u52D5\u63A8\u6E2C,\u50C5\u4F9B\u53C3\u8003";
  }
  if (tagList.length) {
    h(el, "div", "mn-gh", "\u6548\u679C\u91CD\u9EDE");
    const chips = h(el, "div", "mn-chips");
    for (const t of tagList) chip(chips, t);
  }
  if (list2.length) {
    h(el, "div", "mn-gh", "\u9069\u5408\u7684\u82F1\u96C4");
    const grid = h(el, "div", "mn-grid");
    for (const c of list2) {
      const tile2 = h(grid, "button", "mn-tile");
      const t = h(tile2, "img");
      t.src = c.icon;
      t.alt = "";
      h(tile2, "span", "mn-tile-n", c.name);
      tile2.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.openChampion(c.id, "augments");
      });
    }
    h(el, "div", "mn-gf", label);
  }
  if (history.length) {
    h(el, "div", "mn-gh", "\u7248\u672C\u7D00\u9304");
    const g = group(el);
    for (const x of history) row(g, { icon: x.what === "added" ? "plus-circle" : "minus-circle", title: x.what === "added" ? "\u65B0\u589E" : "\u79FB\u9664", value: x.patch });
  }
  return { title: "", el };
}
function itemPage(ctx) {
  const store = ctx.plugin.store;
  const item = store.item(Number(ctx.frame.params?.id));
  const el = h(null, "div", "mn-page");
  if (!item) {
    empty(el, { icon: "package-x", title: "Item not found" });
    return { title: "", el };
  }
  const head = h(el, "div", "mn-dhead");
  const im = h(head, "img", "mn-dimg");
  im.src = item.icon;
  im.alt = "";
  const who = h(head, "div", "mn-dwho");
  h(who, "h1", "mn-title", item.name);
  const tags = h(who, "div", "mn-chips");
  chip(tags, `${item.goldTotal} \u91D1`, { color: "var(--color-yellow)" });
  for (const t of item.tags) if (TAG_ZH[t]) chip(tags, TAG_ZH[t]);
  if (item.desc) {
    const panel = h(el, "div", "mn-panel mn-dpanel");
    h(panel, "p", "mn-dtext", item.desc);
  }
  if (item.variantOf) h(el, "div", "mn-gf", "\u9019\u662F ARAM \u5C08\u7528\u7248\u672C,\u50F9\u683C\u8207\u6578\u503C\u548C\u4E00\u822C\u7248\u672C\u4E0D\u540C\u3002");
  const official = store.officialFor("items", item.name);
  if (official.length) {
    h(el, "div", "mn-gh", "\u7248\u672C\u8ABF\u6574");
    officialBlock(el, official);
  }
  recipe(el, ctx, "\u5408\u6210\u6750\u6599", item.from.map((id) => store.item(id)).filter((i) => !!i));
  recipe(el, ctx, "\u53EF\u5408\u6210", item.into.map((id) => store.item(id)).filter((i) => !!i));
  return { title: "", el };
}
function recipe(el, ctx, title, items) {
  if (!items.length) return;
  h(el, "div", "mn-gh", title);
  const grid = h(el, "div", "mn-recipe");
  for (const i of items) {
    const b = h(grid, "button", "mn-rc");
    const im = h(b, "img");
    im.src = i.icon;
    im.alt = "";
    h(b, "span", "mn-rc-n", i.name);
    h(b, "span", "mn-rc-g", `${i.goldTotal}`);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.openItem(i.id);
    });
  }
}

// src/pages/handbook.ts
var SNIPPET = 46;
var MAX_PER_NOTE = 2;
var CHARS_PER_MINUTE = 350;
var KEYWORDS = 8;
var LOAD_TIMEOUT = 8e3;
var TILE_COLORS = ["--color-blue", "--color-purple", "--color-orange", "--color-green", "--color-cyan", "--color-pink", "--color-yellow", "--color-red"];
var GLOSSARY = "\u540D\u8A5E\u8868";
var TRIVIA_AFTER = 4;
var hash = (x) => Math.imul(x ^ 2654435769, 2654435761) >>> 0;
function firstSentence(blurb) {
  const s = blurb.split(/(?<=[。!?!?])/)[0] ?? blurb;
  return s.length > 64 ? s.slice(0, 62) + "\u2026" : s;
}
function handbookPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("Handbook");
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search anything you read here";
  const chips = h(el, "div", "mn-keys");
  const out = h(el, "div");
  const notes = store.guideNotes();
  let texts = null;
  const read = new Set(ctx.plugin.settings.read);
  const minutes = (size) => Math.max(1, Math.round(size / 3 / CHARS_PER_MINUTE));
  const load = async () => {
    if (texts) return texts;
    texts = /* @__PURE__ */ new Map();
    for (const n of notes) texts.set(n.file.path, (await ctx.app.vault.cachedRead(n.file)).replace(/^---[\s\S]*?---\n/, "").split("\n").map(clean).filter(Boolean));
    return texts;
  };
  const home = () => {
    out.empty();
    if (!notes.length) {
      empty(out, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." });
      return;
    }
    const done = notes.filter((n) => read.has(n.file.path)).length;
    const next = notes.find((n) => !read.has(n.file.path)) ?? notes[Math.floor(Math.random() * notes.length)];
    const hero = h(out, "button", "mn-hh");
    const body = h(hero, "div", "mn-hh-body");
    h(body, "div", "mn-hh-k", done >= notes.length ? "\u5168\u90E8\u8B80\u5B8C\u4E86 \u{1F389} \u518D\u8907\u7FD2\u4E00\u4E0B?" : done ? "\u63A5\u8457\u770B" : "\u5F9E\u9019\u88E1\u958B\u59CB");
    h(body, "div", "mn-hh-t", next.title);
    if (next.summary) h(body, "div", "mn-hh-s", next.summary);
    const go = h(body, "span", "mn-hh-go", `${minutes(next.file.stat.size)} \u5206\u9418 \xB7 \u958B\u59CB \u2192`);
    void go;
    const ic = h(hero, "div", "mn-hh-ic");
    icon(ic, next.icon);
    const prog = h(out, "div", "mn-prog");
    const bar = h(h(prog, "div", "mn-prog-track"), "div", "mn-prog-fill");
    bar.style.width = `${done / notes.length * 100}%`;
    h(prog, "div", "mn-prog-t", `${done} / ${notes.length}`);
    hero.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.openNote(next.file.path);
    });
    const tile2 = (grid, n, i) => {
      const t = h(grid, "button", "mn-ht");
      t.style.setProperty("--c", `var(${TILE_COLORS[i % TILE_COLORS.length]})`);
      const top = h(t, "div", "mn-ht-top");
      icon(h(top, "span", "mn-ht-ic"), n.icon);
      if (read.has(n.file.path)) icon(h(top, "span", "mn-ht-done"), "check");
      h(t, "div", "mn-ht-t", n.title);
      if (n.summary) h(t, "div", "mn-ht-s", n.summary);
      h(t, "div", "mn-ht-m", n.layout === "deck" ? `${minutes(n.file.stat.size)} \u5206\u9418` : "\u67E5\u8A62");
      t.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.openNote(n.file.path);
      });
    };
    const first = h(out, "div", "mn-ht-grid");
    notes.slice(0, TRIVIA_AFTER).forEach((n, i) => tile2(first, n, i));
    trivia(out);
    if (notes.length > TRIVIA_AFTER) {
      const rest = h(out, "div", "mn-ht-grid");
      notes.slice(TRIVIA_AFTER).forEach((n, i) => tile2(rest, n, i + TRIVIA_AFTER));
    }
  };
  const trivia = (parent) => {
    const champs = store.champions().filter((c) => c.blurb);
    if (!champs.length) return;
    let n = Math.floor(Date.now() / 864e5);
    const card = h(parent, "button", "mn-trv");
    let seq = 0;
    const draw = () => {
      const mine = ++seq;
      const c = champs[hash(n) % champs.length];
      const url = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg`;
      card.empty();
      card.addClass("is-loading");
      h(h(card, "div", "mn-trv-load"), "span", "mn-spin");
      let shown = false;
      const show = () => {
        if (shown || mine !== seq) return;
        shown = true;
        card.empty();
        card.removeClass("is-loading");
        h(card, "div", "mn-trv-bg").style.backgroundImage = `url("${url}")`;
        const body = h(card, "div", "mn-trv-body");
        h(body, "div", "mn-trv-k", "\u4F60\u77E5\u9053\u55CE?");
        h(body, "div", "mn-trv-t", `${c.name} \xB7 ${c.title}`);
        h(body, "div", "mn-trv-s", firstSentence(c.blurb));
        icon(h(card, "span", "mn-trv-next"), "refresh-cw");
      };
      const img = new Image();
      img.onload = show;
      img.onerror = show;
      img.src = url;
      window.setTimeout(show, LOAD_TIMEOUT);
    };
    card.addEventListener("click", (e) => {
      e.preventDefault();
      if (card.hasClass("is-loading")) return;
      n += 1;
      draw();
    });
    draw();
  };
  const keywords = async () => {
    const g = notes.find((n) => n.title === GLOSSARY);
    if (!g) return;
    const terms = ((await load()).get(g.file.path) ?? []).map((l) => l.split(/[:：]/)[0].trim()).filter((t) => t && t.length <= 8).slice(0, KEYWORDS);
    for (const t of terms) {
      const b = h(chips, "button", "mn-key", t);
      b.addEventListener("click", (e) => {
        e.preventDefault();
        search.value = t;
        void results(t.toLowerCase());
      });
    }
  };
  const results = async (q) => {
    const lines = await load();
    if (search.value.trim().toLowerCase() !== q) return;
    out.empty();
    let found = 0;
    const guide = notes.map((n) => ({ n, lines: (lines.get(n.file.path) ?? []).filter((l) => l.toLowerCase().includes(q)), title: n.title.toLowerCase().includes(q) })).filter((x) => x.title || x.lines.length);
    const sect = (title) => {
      h(out, "div", "mn-gh", title);
      return h(out, "div", "mn-group");
    };
    if (guide.length) {
      const g = sect("Guide");
      for (const { n, lines: ls } of guide) {
        const r = h(g, "div", "mn-row is-tap");
        icon(r, n.icon, "mn-row-ic");
        const main = h(r, "div", "mn-row-main");
        h(main, "div", "mn-row-t", n.title);
        for (const l of ls.slice(0, MAX_PER_NOTE)) marked(h(main, "div", "mn-row-s"), snippet(l, q), q);
        icon(r, "chevron-right", "mn-row-chev");
        r.addEventListener("click", () => ctx.openNote(n.file.path));
        found++;
      }
    }
    const tipHits = store.champions().flatMap((c) => c.tips.filter((t) => `${t.title} ${t.text}`.toLowerCase().includes(q)).map((t) => ({ c, t })));
    if (tipHits.length) {
      const g = sect("Tips");
      for (const { c, t } of tipHits) {
        const r = h(g, "div", "mn-row is-tap");
        const im = h(r, "img", "mn-row-img");
        im.src = c.icon;
        im.alt = "";
        const main = h(r, "div", "mn-row-main");
        h(main, "div", "mn-row-t", `${c.name}:${t.title}`);
        marked(h(main, "div", "mn-row-s"), snippet(t.text, q), q);
        icon(r, "chevron-right", "mn-row-chev");
        r.addEventListener("click", () => ctx.openChampion(c.id, "tips"));
        found++;
      }
    }
    const buildHits = store.champions().flatMap((c) => c.builds.filter((b) => `${b.name} ${b.note}`.toLowerCase().includes(q)).map((b) => ({ c, b })));
    if (buildHits.length) {
      const g = sect("Builds");
      for (const { c, b } of buildHits) {
        const r = h(g, "div", "mn-row is-tap");
        const im = h(r, "img", "mn-row-img");
        im.src = c.icon;
        im.alt = "";
        const main = h(r, "div", "mn-row-main");
        h(main, "div", "mn-row-t", `${c.name}:${b.name}`);
        if (b.note) marked(h(main, "div", "mn-row-s"), snippet(b.note, q), q);
        icon(r, "chevron-right", "mn-row-chev");
        r.addEventListener("click", () => ctx.openChampion(c.id, "build"));
        found++;
      }
    }
    if (!found) empty(out, { icon: "search-x", title: "Nothing found", text: "Try a shorter word." });
  };
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) home();
    else void results(q);
  });
  home();
  void keywords();
  return { title: "Handbook", el };
}
var clean = (l) => l.replace(/^\s*(?:[-*]|\d+\.|>)\s*/, "").replace(/[*_`]/g, "").replace(/!?\[\[?([^\]|]*)(?:\|[^\]]*)?\]\]?/g, "$1").trim();
function snippet(line, q) {
  const i = line.toLowerCase().indexOf(q);
  if (i < 0 || line.length <= SNIPPET * 2) return line;
  const from = Math.max(0, i - SNIPPET), to = Math.min(line.length, i + q.length + SNIPPET);
  return (from ? "\u2026" : "") + line.slice(from, to) + (to < line.length ? "\u2026" : "");
}
function marked(parent, text, q) {
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
    if (i > at) parent.appendChild(document.createTextNode(text.slice(at, i)));
    h(parent, "mark", "mn-hl", text.slice(i, i + q.length));
    at = i + q.length;
  }
  if (at < text.length) parent.appendChild(document.createTextNode(text.slice(at)));
}

// src/pages/patch.ts
var LEGEND = "\u25B2 \u589E\u5F37 \xB7 \u25BC \u524A\u5F31 \xB7 \u25C6 \u6709\u589E\u6709\u6E1B \xB7 \u25CF \u8ABF\u6574\u3002\u65B9\u5411\u662F\u4F9D\u6578\u5B57\u8B8A\u5316\u63A8\u6E2C\u7684,\u4E0D\u662F\u5B98\u65B9\u6A19\u793A\u3002";
function patchPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("Patch");
  const [latest, ...older] = store.riotNotes;
  if (latest) latestCard(el, latest);
  else {
    const hero = h(el, "div", "mn-patch");
    h(hero, "div", "mn-patch-k", "Data from patch");
    h(hero, "div", "mn-patch-v", store.riotPatch() || "\u2014");
    h(hero, "div", "mn-patch-s", "Run tools/fetch_patch_notes.py to show Riot's patch notes here.");
  }
  if (latest && ctx.plugin.settings.mode === "mayhem") mayhemSection(el, ctx, latest);
  if (latest?.champions?.length) {
    h(el, "div", "mn-gh", `Champions \xB7 ${latest.champions.length}`);
    const grid = h(el, "div", "mn-grid");
    for (const e of latest.champions) {
      const c = store.champions().find((x) => x.name === e.name);
      if (c) tile(grid, c.icon, c.name, () => ctx.openChampion(c.id, "skills"), { dir: entryDir(e) });
    }
    h(el, "div", "mn-gf", LEGEND);
  }
  if (latest?.items?.length) {
    h(el, "div", "mn-gh", `Items \xB7 ${latest.items.length}`);
    const grid = h(el, "div", "mn-grid");
    for (const e of latest.items) {
      const i = store.items().find((x) => x.name === e.name);
      if (i) tile(grid, i.icon, i.name, () => ctx.openItem(i.id), { dir: entryDir(e) });
    }
    h(el, "div", "mn-gf", LEGEND);
  }
  if (older.length) {
    const g2 = group(el, "Earlier patches");
    for (const n of older) row(g2, { icon: "newspaper", title: n.title, sub: n.summary || void 0, value: n.date, chevron: true, clamp: true, onTap: () => window.open(n.url) });
  }
  const mine = store.patchNotes();
  if (mine.length) {
    const g2 = group(el, "Our patch notes");
    for (const n of mine) row(g2, { icon: "file-text", title: n.title, sub: n.summary || void 0, value: n.patch, chevron: true, onTap: () => ctx.openNote(n.file.path) });
  }
  const stale = store.staleEntries();
  const g = group(el, "Check these tricks");
  if (!stale.length) empty(g, { icon: "check-circle", title: "Nothing to recheck", text: "Every tip and build matches the current patch." });
  else {
    for (const s of stale.slice(0, 30)) {
      row(g, {
        image: s.champion.icon,
        title: `${s.champion.name}:${s.title}`,
        sub: s.patch ? `Written for ${s.patch}` : "No patch given",
        value: s.kind === "tip" ? "Tip" : "Build",
        chevron: true,
        onTap: () => ctx.openChampion(s.champion.id, s.kind === "tip" ? "tips" : "build")
      });
    }
    if (stale.length > 30) h(el, "div", "mn-gf", `${stale.length - 30} more`);
  }
  return { title: "Patch", el };
}
function tile(grid, src, name, onTap, o = {}) {
  const t = h(grid, "button", "mn-tile");
  if (o.rarity && AUG_CLASS[o.rarity]) augIcon(t, src, o.rarity, "mn-tile-aug");
  else {
    const im = h(t, "img");
    im.src = src;
    im.alt = "";
    im.loading = "lazy";
  }
  if (o.dir) {
    const m = marker(o.dir);
    const b = h(t, "span", "mn-tile-b", m.mark);
    b.style.background = m.color;
  }
  h(t, "span", "mn-tile-n", name);
  t.addEventListener("click", (e) => {
    e.preventDefault();
    onTap();
  });
}
function latestCard(el, n) {
  const card = h(el, "div", "mn-pn");
  if (n.image) {
    const im = h(card, "img", "mn-pn-img");
    im.src = n.image;
    im.alt = "";
    im.loading = "lazy";
  }
  const body = h(card, "div", "mn-pn-body");
  h(body, "div", "mn-patch-k", `Patch ${n.patch} \xB7 ${n.date}`);
  h(body, "div", "mn-pn-t", n.title);
  if (n.summary) h(body, "div", "mn-patch-s", n.summary);
  const btn = h(body, "button", "mn-pn-btn", "Read the full notes \u2197");
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    window.open(n.url);
  });
  h(body, "div", "mn-pn-src", "Riot Games \xB7 \u7248\u672C\u66F4\u65B0\u516C\u544A");
}
function mayhemSection(el, ctx, n) {
  const added = n.augments_new ?? [], removed = n.augments_removed ?? [];
  if (!added.length && !removed.length) return;
  const byName = new Map(ctx.plugin.store.augments().map((a) => [a.name, a]));
  if (added.length) {
    h(el, "div", "mn-gh", `Mayhem \xB7 ${added.length} new augments`);
    const grid = h(el, "div", "mn-grid");
    for (const a of added) {
      const mine = byName.get(a.name);
      if (mine) tile(grid, mine.icon, a.name, () => ctx.openAugment(mine.id), { rarity: a.rarity });
    }
  }
  if (removed.length) {
    h(el, "div", "mn-gh", `Removed augments \xB7 ${removed.length}`);
    const chips = h(el, "div", "mn-chips");
    for (const r of removed) chip(chips, r, { color: RARITY_COLOR["\u9280"] });
  }
}

// src/pages/roster.ts
var import_obsidian7 = require("obsidian");
var MAX_PICKS = 15;
var ROLES2 = ["\u6230\u58EB", "\u5766\u514B", "\u6CD5\u5E2B", "\u523A\u5BA2", "\u5C04\u624B", "\u8F14\u52A9"];
var SPLIT = /[\s,，、;；和跟與及]+/;
function matchScore(c, raw) {
  const q = raw.trim().toLowerCase();
  if (!q) return 0;
  const name = c.name.toLowerCase(), title = c.title.toLowerCase(), id = c.id.toLowerCase();
  if (name === q || id === q) return 100;
  if (name.startsWith(q) || id.startsWith(q)) return 90;
  if (name.includes(q) || id.includes(q)) return 80;
  if (title.includes(q)) return 60;
  const chars = [...q];
  let at = 0;
  for (const ch of name) if (ch === chars[at]) at++;
  if (at === chars.length && chars.length >= 2) return 50;
  const shared = chars.filter((ch) => name.includes(ch)).length;
  return chars.length >= 3 && shared / chars.length >= 0.66 ? 20 + shared : 0;
}
function distance(a, b) {
  const x = [...a], y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}
function closest(all, raw, limit = 4) {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const allowed = [...q].length <= 4 ? 1 : 2;
  return all.map((c) => ({ c, d: Math.min(distance(q, c.name.toLowerCase()), distance(q, c.id.toLowerCase())) })).filter((x) => x.d <= allowed).sort((a, b) => a.d - b.d || a.c.name.localeCompare(b.c.name, "zh-Hant")).slice(0, limit).map((x) => x.c);
}
function rosterPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("\u901F\u67E5");
  const all = store.champions();
  let picks = ctx.plugin.settings.roster.filter((id) => all.some((c) => c.id === id)).slice(0, MAX_PICKS);
  let query = "", role = "";
  const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)]));
  const save = () => {
    void ctx.plugin.setRoster(picks);
  };
  h(el, "p", "mn-rq-hint", "\u5927\u6DF7\u6230\u6703\u96A8\u6A5F\u7D66\u4F60\u82F1\u96C4\u3002\u9EDE\u4F60\u62FF\u5230\u7684(\u6700\u591A 15 \u4F4D),\u99AC\u4E0A\u770B\u5230\u5B9A\u4F4D\u548C\u80FD\u529B\u3002");
  const results = h(el, "div", "mn-rq-results");
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "\u8F38\u5165\u82F1\u96C4\u540D\u5B57,\u6216\u6309\u9375\u76E4\u4E0A\u7684 \u{1F3A4} \u8AAA\u51FA\u4F86";
  search.setAttribute("enterkeyhint", "search");
  const suggest2 = h(el, "div", "mn-chips");
  const roles = fgrid(el, ROLES2.length);
  const grid = h(el, "div", "mn-grid");
  const toggle = (id) => {
    if (picks.includes(id)) picks = picks.filter((p) => p !== id);
    else if (picks.length >= MAX_PICKS) {
      new import_obsidian7.Notice(`\u6700\u591A\u9078 ${MAX_PICKS} \u4F4D`);
      return;
    } else picks = [...picks, id];
    save();
    drawResults();
    drawGrid();
  };
  const card = (c) => {
    const r = h(results, "div", "mn-rq");
    const top = h(r, "div", "mn-rq-top");
    const im = h(top, "img", "mn-rq-img");
    im.src = c.icon;
    im.alt = "";
    const who = h(top, "div", "mn-rq-who");
    h(who, "div", "mn-rq-name", c.name);
    h(who, "div", "mn-rq-title", c.title);
    const rm = h(top, "button", "mn-rq-x");
    icon(rm, "x");
    rm.setAttribute("aria-label", "\u79FB\u9664");
    rm.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(c.id);
    });
    const roles2 = h(r, "div", "mn-rq-roles");
    for (const role_ of c.roles) h(roles2, "span", "mn-rq-role", role_);
    const rd = recent.get(c.name);
    if (rd) {
      const m = marker(rd);
      const b = h(roles2, "span", "mn-rq-role mn-rq-mark", `${m.mark} \u672C\u7248\u8ABF\u6574`);
      b.style.setProperty("--m", m.color);
    }
    factsRow(r, c);
    abilityBlock(r, c, ctx.app);
    r.addEventListener("click", () => ctx.openChampion(c.id));
  };
  const drawResults = () => {
    results.empty();
    if (!picks.length) return;
    const head = h(results, "div", "mn-rq-head");
    h(head, "span", "mn-rq-count", `\u4F60\u7684\u82F1\u96C4 ${picks.length} / ${MAX_PICKS}`);
    const clear = h(head, "button", "mn-clear", "\u5168\u90E8\u6E05\u9664");
    clear.addEventListener("click", (e) => {
      e.preventDefault();
      picks = [];
      save();
      drawResults();
      drawGrid();
    });
    for (const id of picks) {
      const c = all.find((x) => x.id === id);
      if (c) card(c);
    }
  };
  const drawSuggest = () => {
    suggest2.empty();
    const tokens = query.split(SPLIT).filter(Boolean);
    if (!tokens.length) return;
    const best = (t) => {
      const ranked = all.map((c) => ({ c, s: matchScore(c, t) })).sort((a, b) => b.s - a.s);
      return ranked[0] && ranked[0].s >= 50 ? { list: [ranked[0].c], exact: true } : { list: closest(all, t, 3), exact: false };
    };
    const found = tokens.map(best);
    const unique = [...new Map(found.flatMap((f) => f.list).map((c) => [c.id, c])).values()];
    if (!unique.length) return;
    const guessed = found.some((f) => !f.exact && f.list.length);
    if (tokens.length === 1 && !guessed) return;
    if (guessed) h(suggest2, "span", "mn-dym", "\u4F60\u662F\u4E0D\u662F\u5728\u627E:");
    for (const c of unique) chip(suggest2, `${picks.includes(c.id) ? "\u2713 " : "+ "}${c.name}`, { color: "var(--color-green)", onTap: () => toggle(c.id) });
    if (unique.length > 1) chip(suggest2, "\u5168\u90E8\u52A0\u5165", { on: true, onTap: () => {
      for (const c of unique) if (!picks.includes(c.id) && picks.length < MAX_PICKS) picks = [...picks, c.id];
      save();
      drawResults();
      drawGrid();
    } });
  };
  const drawGrid = () => {
    grid.empty();
    const tokens = query.split(SPLIT).filter(Boolean);
    let list2 = all.filter((c) => !role || c.roles.includes(role));
    if (tokens.length) {
      const scored = list2.map((c) => ({ c, s: Math.max(...tokens.map((t) => matchScore(c, t))) })).filter((x) => x.s > 0);
      scored.sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name, "zh-Hant"));
      list2 = scored.map((x) => x.c);
    }
    for (const c of list2) {
      const on = picks.includes(c.id);
      const t = h(grid, "button", "mn-tile mn-pick" + (on ? " is-pick" : ""));
      const im = h(t, "img");
      im.src = c.icon;
      im.alt = "";
      im.loading = "lazy";
      if (on) icon(h(t, "span", "mn-pick-ok"), "check");
      h(t, "span", "mn-tile-n", c.name);
      t.addEventListener("click", (e) => {
        e.preventDefault();
        toggle(c.id);
      });
    }
    if (!list2.length) empty(grid, { icon: "search-x", title: "\u627E\u4E0D\u5230\u9019\u500B\u540D\u5B57", text: "\u4E0A\u9762\u7684\u300C\u4F60\u662F\u4E0D\u662F\u5728\u627E\u300D\u6703\u5217\u51FA\u6700\u63A5\u8FD1\u7684,\u6216\u63DB\u500B\u8AAA\u6CD5\u518D\u8A66\u3002" });
  };
  const drawRoles = () => {
    roles.empty();
    for (const r of ROLES2) chip(roles, r, { on: role === r, onTap: () => {
      role = role === r ? "" : r;
      drawRoles();
      drawGrid();
    } });
  };
  search.addEventListener("input", () => {
    query = search.value;
    drawSuggest();
    drawGrid();
  });
  drawResults();
  drawRoles();
  drawGrid();
  return { title: "\u901F\u67E5", el };
}

// src/pages/index.ts
var PAGES = {
  champions: championsPage,
  augments: augmentsPage,
  patch: patchPage,
  handbook: handbookPage
};
function renderPage(tab, ctx) {
  switch (ctx.frame.key) {
    case "champion":
      return championCard(ctx);
    case "augment":
      return augmentPage(ctx);
    case "item":
      return itemPage(ctx);
    case "note":
      return notePage(ctx);
    case "roster":
      return rosterPage(ctx);
    default:
      return PAGES[tab](ctx);
  }
}

// src/view.ts
var VIEW_TYPE = "morellonomicon";
var SPINNER_DELAY = 140;
var IMAGE_WAIT = 8e3;
var ARRIVE_MS = 240;
function pendingImages(page2) {
  const out = [];
  const urls = [...page2.querySelectorAll(".mn-hero-bg")].map((e) => /url\("?([^")]+)"?\)/.exec(e.style.backgroundImage)?.[1]).filter((u) => !!u);
  for (const u of urls) out.push(new Promise((r) => {
    const im = new Image();
    im.onload = im.onerror = () => r();
    im.src = u;
    if (im.complete) r();
  }));
  for (const im of page2.querySelectorAll("img")) {
    if (!im.src || im.complete || im.getBoundingClientRect().top > window.innerHeight) continue;
    out.push(new Promise((r) => {
      im.addEventListener("load", () => r(), { once: true });
      im.addEventListener("error", () => r(), { once: true });
    }));
  }
  return out;
}
function arrive(page2, anim) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !page2.animate) return;
  const from = anim === "push" ? "translateX(28px)" : anim === "back" ? "translateX(-28px)" : "translateY(10px)";
  page2.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: ARRIVE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
}
var MnView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.scrolls = /* @__PURE__ */ new Map();
    this.shown = "";
    this.drawId = 0;
    this.themed = [];
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Morellonomicon";
  }
  getIcon() {
    return "book-open";
  }
  get router() {
    return this.plugin.router;
  }
  key() {
    return `${this.plugin.settings.mode}/${this.router.tab}/${this.router.top().key}/${JSON.stringify(this.router.top().params ?? {})}`;
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    c.addClass("mn-host");
    const app = h(c, "div", "mn-app");
    this.appEl = app;
    app.toggleClass("is-full", import_obsidian8.Platform.isMobile);
    this.topEl = h(app, "div", "mn-top");
    this.backEl = h(this.topEl, "button", "mn-btn mn-back");
    icon(this.backEl, "chevron-left");
    this.backEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.back();
    });
    this.titleEl = h(this.topEl, "div", "mn-top-title");
    const acts = h(this.topEl, "div", "mn-acts");
    this.actsEl = acts;
    const themeBtn = h(acts, "button", "mn-btn");
    themeBtn.setAttribute("aria-label", "Color theme");
    icon(themeBtn, "palette");
    themeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.themeMenu(e);
    });
    const modeBtn = h(acts, "button", "mn-btn");
    modeBtn.setAttribute("aria-label", "Mode");
    modeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.modeMenu(e);
    });
    this.modeBtn = modeBtn;
    this.scrollEl = h(app, "div", "mn-scroll");
    this.registerDomEvent(this.scrollEl, "scroll", () => this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > 36), { passive: true });
    this.loaderEl = h(app, "div", "mn-loader");
    h(this.loaderEl, "div", "mn-spin");
    this.tabsEl = h(app, "div", "mn-tabs");
    this.applyTheme();
    this.registerEvent(this.app.workspace.on("css-change", () => this.applyTheme()));
    this.buildTabs();
    this.draw();
  }
  async onClose() {
    this.scrolls.clear();
  }
  // theme and mode buttons: in the big title row of a tab's first page, in the top bar elsewhere
  // The chosen colour theme as variables on the app element (none = Obsidian's own colours)
  applyTheme() {
    for (const name of this.themed) this.appEl.style.removeProperty(name);
    const vars = themeVars(this.plugin.settings.theme, document.body.hasClass("theme-dark"));
    this.themed = Object.keys(vars);
    for (const [k, v] of Object.entries(vars)) this.appEl.style.setProperty(k, v);
  }
  themeMenu(e) {
    const menu = new import_obsidian8.Menu();
    for (const t of THEMES) menu.addItem((i) => i.setTitle(t.name).setChecked(this.plugin.settings.theme === t.id).onClick(() => {
      this.plugin.settings.theme = t.id;
      void this.plugin.saveTheme();
    }));
    menu.showAtMouseEvent(e);
  }
  modeMenu(e) {
    const menu = new import_obsidian8.Menu();
    for (const id of MODE_ORDER) {
      const m = MODES[id];
      menu.addItem((i) => i.setTitle(m.label + (m.enabled ? "" : " (coming soon)")).setIcon(m.icon).setChecked(this.plugin.settings.mode === id).setDisabled(!m.enabled).onClick(() => {
        this.plugin.settings.mode = id;
        void this.plugin.saveSettings();
      }));
    }
    menu.showAtMouseEvent(e);
  }
  tabLabel(id) {
    return TAB_LABEL[id];
  }
  tabIcon(id) {
    return TAB_ICON[id];
  }
  buildTabs() {
    const tabs = MODES[this.plugin.settings.mode].tabs;
    this.router.fix(tabs);
    this.tabsEl.empty();
    this.tabsEl.style.setProperty("--n", String(tabs.length));
    for (const id of tabs) {
      const b = h(this.tabsEl, "button", "mn-tab" + (id === this.router.tab ? " is-on" : ""));
      b.dataset.tab = id;
      icon(b, this.tabIcon(id));
      h(b, "span", "mn-tab-l", this.tabLabel(id));
      b.addEventListener("click", (e) => {
        e.preventDefault();
        this.tapTab(id);
      });
    }
    this.modeBtn.empty();
    icon(this.modeBtn, MODES[this.plugin.settings.mode].icon);
  }
  markTab() {
    this.tabsEl.querySelectorAll(".mn-tab").forEach((b) => b.toggleClass("is-on", b.dataset.tab === this.router.tab));
  }
  tapTab(id) {
    if (id === this.router.tab) {
      if (this.router.popToRoot()) this.draw("back");
      else this.scrollEl.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    this.router.setTab(id);
    this.markTab();
    this.draw("tab");
  }
  goTab(id) {
    this.router.popToRoot();
    if (id !== this.router.tab) this.tapTab(id);
    else this.draw("tab");
  }
  push(f) {
    if (this.router.push(f)) this.draw("push");
  }
  back() {
    if (this.router.pop()) this.draw("back");
  }
  // Data or settings changed: redraw from scratch (the mode may have changed the tabs)
  refresh(resetStack = false) {
    if (resetStack) this.router.reset();
    this.applyTheme();
    this.buildTabs();
    this.draw();
  }
  // How a new page arrives: slides in from the right (deeper), from the left (back), or rises in (another tab); "none" for a refresh
  draw(anim = "none") {
    const id = ++this.drawId;
    if (this.shown) this.scrolls.set(this.shown, this.scrollEl.scrollTop);
    const key = this.key();
    const f = this.router.top();
    let out;
    try {
      const store = this.plugin.store;
      out = renderPage(this.router.tab, {
        app: this.app,
        plugin: this.plugin,
        component: this,
        frame: f,
        push: (x) => this.push(x),
        pop: () => this.back(),
        goTab: (id2) => this.goTab(id2),
        openChampion: (id2, sub) => {
          if (sub) rememberSub(id2, sub);
          this.push({ key: "champion", title: store.champion(id2)?.name ?? id2, params: { id: id2 } });
        },
        openAugment: (id2) => this.push({ key: "augment", title: store.augment(id2)?.name ?? "Augment", params: { id: id2 } }),
        openItem: (id2) => this.push({ key: "item", title: store.item(id2)?.name ?? "Item", params: { id: id2 } }),
        openNote: (path) => this.push({ key: "note", title: path.split("/").pop()?.replace(/\.md$/, "") ?? "Note", params: { path } })
      });
    } catch (e) {
      const el = h(null, "div", "mn-page");
      empty(el, { icon: "alert-triangle", title: "This page could not be drawn", text: String(e instanceof Error ? e.message : e).slice(0, 200) });
      out = { title: "Error", el };
    }
    this.scrollEl.replaceChildren(out.el);
    this.shown = key;
    this.scrollEl.scrollTop = this.scrolls.get(key) ?? 0;
    this.scrollEl.scrollLeft = 0;
    this.titleEl.textContent = out.title;
    const titleRow = this.router.depth() === 0 ? out.el.querySelector(":scope > .mn-title-row") : null;
    (titleRow ?? this.topEl).appendChild(this.actsEl);
    this.actsEl.toggleClass("is-hidden", !titleRow);
    this.topEl.toggleClass("has-back", this.router.depth() > 0);
    this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > 36);
    if (anim === "none") {
      this.loaderEl.removeClass("is-on");
      return;
    }
    const waiting = pendingImages(out.el);
    if (!waiting.length) {
      this.loaderEl.removeClass("is-on");
      arrive(out.el, anim);
      return;
    }
    out.el.style.opacity = "0";
    const spin = window.setTimeout(() => {
      if (id === this.drawId) this.loaderEl.addClass("is-on");
    }, SPINNER_DELAY);
    const done = () => {
      window.clearTimeout(spin);
      if (id !== this.drawId) return;
      this.loaderEl.removeClass("is-on");
      out.el.style.opacity = "";
      arrive(out.el, anim);
    };
    void Promise.race([Promise.all(waiting), new Promise((r) => window.setTimeout(r, IMAGE_WAIT))]).then(done);
  }
};

// src/main.ts
var MorellonomiconPlugin = class extends import_obsidian9.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    this.dataTimer = 0;
  }
  async onload() {
    await this.loadSettings();
    this.router = new Router(this.app);
    this.store = new Store(this);
    this.registerView(VIEW_TYPE, (leaf) => new MnView(leaf, this));
    this.addRibbonIcon("book-open", "Open Morellonomicon", () => {
      void this.activate(false);
    });
    this.addCommand({ id: "open", name: "Open Morellonomicon", callback: () => {
      void this.activate(false);
    } });
    this.addSettingTab(new MnSettingTab(this.app, this));
    const onFile = (file, oldPath) => {
      if (this.store.inData(file.path) || oldPath && this.store.inData(oldPath)) this.dataChanged();
    };
    this.registerEvent(this.app.metadataCache.on("changed", (f) => onFile(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => onFile(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => onFile(f, old)));
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.dataChanged()));
    this.home = createEl("button", { cls: "mn-home", attr: { "aria-label": "Open Morellonomicon" } });
    (0, import_obsidian9.setIcon)(this.home, "book-open");
    this.home.addEventListener("click", (e) => {
      e.preventDefault();
      void this.activate(false);
    });
    this.register(() => this.home.remove());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateBody()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.updateBody()));
    this.app.workspace.onLayoutReady(() => {
      void this.store.loadStats().then(() => this.views().forEach((v) => v.refresh()));
      if (this.settings.openOnStartup) void this.activate(true);
      this.updateBody();
    });
  }
  onunload() {
    window.clearTimeout(this.dataTimer);
    document.body.removeClass("mn-on", "mn-full");
  }
  // body.mn-on while the app is the active screen; mn-full (phone) additionally hides Obsidian's floating navigation
  updateBody() {
    const ws = this.app.workspace;
    const on = !!ws.getActiveViewOfType(MnView);
    document.body.toggleClass("mn-on", on);
    document.body.toggleClass("mn-full", on && import_obsidian9.Platform.isMobile);
    if (!import_obsidian9.Platform.isMobile) return;
    const v = ws.getActiveViewOfType(import_obsidian9.View);
    if (!v || v instanceof MnView || v.leaf.getRoot() !== ws.rootSplit) {
      this.home.remove();
      return;
    }
    if (this.home.parentElement !== v.containerEl) {
      v.containerEl.addClass("mn-home-host");
      v.containerEl.appendChild(this.home);
    }
  }
  views() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof MnView);
  }
  dataChanged() {
    window.clearTimeout(this.dataTimer);
    this.dataTimer = window.setTimeout(() => {
      this.store.invalidate();
      void this.store.loadStats().then(() => this.views().forEach((v) => v.refresh()));
    }, 300);
  }
  // Show the app: the existing screen if there is one, else in the current tab (start-up, phone) or a new tab (desktop).
  async activate(startup) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = ws.getLeaf(startup || import_obsidian9.Platform.isMobile ? false : "tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await ws.revealLeaf(leaf);
    ws.setActiveLeaf(leaf, { focus: true });
    this.updateBody();
  }
  // A note in a tab of its own; a tab that already shows it is brought forward instead of opening a second one
  async openPath(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof import_obsidian9.TFile)) return;
    const ws = this.app.workspace;
    const open = ws.getLeavesOfType("markdown").find((l) => l.view.file?.path === path);
    if (open) {
      await ws.revealLeaf(open);
      ws.setActiveLeaf(open, { focus: false });
      return;
    }
    await ws.getLeaf("tab").openFile(f, { state: { mode: "preview" } });
  }
  // A new colour theme: save and repaint, keeping the page you are on
  async saveTheme() {
    await this.saveData(this.settings);
    this.views().forEach((v) => v.applyTheme());
  }
  // The Quick Look picks changed: remember them without redrawing the screen
  async setRoster(ids) {
    this.settings.roster = ids;
    await this.saveData(this.settings);
  }
  // A guide card was opened: remember it without redrawing the screen
  async markRead(path) {
    if (this.settings.read.includes(path)) return;
    this.settings.read = [...this.settings.read, path];
    await this.saveData(this.settings);
  }
  async loadSettings() {
    this.settings = { ...DEFAULTS, ...await this.loadData() };
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.store.loadStats();
    this.views().forEach((v) => v.refresh(true));
  }
};
