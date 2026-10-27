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
var import_obsidian5 = require("obsidian");

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
  return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), icon: str(o.icon), desc: str(o.desc), upgrade: str(o.upgrade), range: str(o.range), rows: rowList(o.rows) }] : [];
}) : [];
var list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
var Store = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.champs = null;
    this.its = null;
    this.augs = null;
    this.stats = null;
    this.changes = null;
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
  item(id) {
    return this.items().find((i) => i.id === id);
  }
  augments() {
    if (!this.augs) {
      this.augs = this.notes(this.s.augmentFolder).filter((n) => n.fm.type === "augment").map(({ file, fm }) => ({
        id: num(fm.id),
        name: str(fm.name, file.basename),
        rarity: str(fm.rarity),
        icon: str(fm.icon),
        effect: str(fm.effect),
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
    return this.notes(this.s.guideFolder).map(({ file, fm }) => ({ file, title: file.basename, icon: str(fm.icon, "file-text"), summary: str(fm.summary), order: num(fm.order, 99) })).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hant"));
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
var DEFAULTS = {
  mode: "mayhem",
  championFolder: "\u82F1\u96C4",
  itemFolder: "\u9053\u5177",
  guideFolder: "\u65B0\u624B\u5165\u9580",
  augmentFolder: "\u5F37\u5316",
  patchFolder: "\u7248\u672C\u66F4\u65B0",
  openOnStartup: import_obsidian2.Platform.isMobile
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
var import_obsidian4 = require("obsidian");

// src/ui.ts
var import_obsidian3 = require("obsidian");
var h = (parent, tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  parent?.appendChild(e);
  return e;
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
var row = (parent, r) => {
  const el = h(parent, "div", "mn-row" + (r.onTap ? " is-tap" : "") + (r.muted ? " is-muted" : ""));
  if (r.image) {
    const im = h(el, "img", "mn-row-img");
    im.src = r.image;
    im.loading = "lazy";
    im.alt = "";
  } else if (r.icon) icon(el, r.icon, "mn-row-ic");
  const main = h(el, "div", "mn-row-main");
  h(main, "div", "mn-row-t", r.title);
  if (r.sub) h(main, "div", "mn-row-s", r.sub);
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
  const el = h(parent, o.onTap ? "button" : "span", "mn-chip" + (o.on ? " is-on" : ""), text);
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
var SVG_NS = "http://www.w3.org/2000/svg";
var svg = (parent, tag, attrs = {}, cls) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute("class", cls);
  parent.appendChild(e);
  return e;
};
var radar = (parent, axes, max = 10, color = "var(--interactive-accent)") => {
  const W = 300, H = 250, cx = W / 2, cy = 128, R = 80, LABEL = 26, n = axes.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r) => axes.map((_, i) => pt(i, typeof r === "number" ? r : r(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const root = svg(parent, "svg", { viewBox: `0 0 ${W} ${H}` }, "mn-radar");
  root.style.setProperty("--rd", color);
  for (const k of [0.25, 0.5, 0.75, 1]) svg(root, "polygon", { points: poly(R * k) }, "mn-rd-ring");
  axes.forEach((_, i) => {
    const [x, y] = pt(i, R);
    svg(root, "line", { x1: cx, y1: cy, x2: x, y2: y }, "mn-rd-axis");
  });
  svg(root, "polygon", { points: poly((i) => R * Math.max(0, Math.min(max, axes[i].value)) / max) }, "mn-rd-area");
  axes.forEach((ax, i) => {
    const [dx, dy] = pt(i, R * Math.max(0, Math.min(max, ax.value)) / max);
    svg(root, "circle", { cx: dx, cy: dy, r: 3.5 }, "mn-rd-dot");
    const [lx, ly] = pt(i, R + LABEL);
    const t = svg(root, "text", { x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "middle" }, "mn-rd-label");
    const name = svg(t, "tspan");
    name.textContent = ax.label + " ";
    const val = svg(t, "tspan", {}, "mn-rd-val");
    val.textContent = String(ax.value);
  });
  return root;
};
var empty = (parent, o) => {
  const box = h(parent, "div", "mn-empty");
  icon(box, o.icon, "mn-empty-ic");
  h(box, "div", "mn-empty-t", o.title);
  if (o.text) h(box, "div", "mn-empty-s", o.text);
  return box;
};

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
        ctx.push({ key: "champion", title: mate.name, params: { id: mate.id } });
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
function changesBlock(parent, c, ctx) {
  const patches = ctx.plugin.store.changesOf(c.id);
  if (!patches.length) return null;
  const el = h(parent, "div", "mn-chg");
  const head = h(el, "button", "mn-chg-head");
  icon(head, "history", "mn-chg-ic");
  h(head, "span", "mn-chg-t", `Recent changes \xB7 ${patches.length} patch${patches.length > 1 ? "es" : ""}`);
  const caret = icon(head, "chevron-down", "mn-chg-caret");
  const body = h(el, "div", "mn-chg-body");
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
  const strip = h(parent, "div", "mn-skills");
  const detail = h(parent, "div", "mn-skill-detail");
  let open = -1;
  const boxes = c.skills.map((s, i) => {
    const box = h(strip, "button", "mn-skill-box");
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
var FEATURES = ["\u63A7\u5834", "\u6CBB\u7642", "\u8B77\u76FE", "\u4F4D\u79FB"];
var REACH = ["\u8FD1\u6230", "\u4E2D\u7A0B", "\u9060\u7A0B"];
var SORTS = [["name", "\u540D\u7A31"], ["easy", "\u7C21\u55AE\u512A\u5148"], ["range", "\u5C04\u7A0B\u9060\u512A\u5148"]];
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
  const box = h(parent, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search champions, augments, items";
  search.setAttribute("enterkeyhint", "search");
  const filters = h(parent, "div", "mn-chips");
  const panel = h(parent, "div", "mn-fpanel");
  const count = h(parent, "div", "mn-count");
  const grid = h(parent, "div", "mn-grid");
  const extra = h(parent, "div");
  const draw = () => {
    grid.empty();
    extra.empty();
    const q = query.trim().toLowerCase();
    const hits = sorted(all.filter((c) => matches(c) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))));
    count.textContent = `${hits.length} / ${all.length}`;
    for (const c of hits) {
      const tile = h(grid, "button", "mn-tile");
      const im = h(tile, "img");
      im.src = c.icon;
      im.loading = "lazy";
      im.alt = "";
      h(tile, "span", "mn-tile-n", c.name);
      tile.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.push({ key: "champion", title: c.name, params: { id: c.id } });
      });
    }
    if (!q) return;
    if (!hits.length) empty(grid, { icon: "search-x", title: "No champion" });
    const augs = ctx.plugin.settings.mode === "mayhem" ? store.augments().filter((a) => a.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA) : [];
    if (augs.length) {
      const g = group(extra, "Augments");
      for (const a of augs) row(g, { image: a.icon, title: a.name, value: a.rarity, chevron: true, onTap: () => ctx.openNote(a.path) });
    }
    const items = store.modeItems().filter((i) => i.name.toLowerCase().includes(q)).slice(0, SEARCH_EXTRA);
    if (items.length) {
      const g = group(extra, "Items");
      for (const i of items) row(g, { image: i.icon, title: i.name, sub: i.desc || void 0, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openNote(i.path) });
    }
  };
  const redraw = () => {
    drawFilters();
    drawPanel();
    draw();
  };
  const drawFilters = () => {
    filters.empty();
    for (const r of ROLES) chip(filters, r, { on: F.roles.has(r), onTap: () => {
      F.roles.has(r) ? F.roles.delete(r) : F.roles.add(r);
      redraw();
    } });
    for (const d of DAMAGES) chip(filters, d, { on: F.dmg === d, color: DAMAGE_COLOR[d], onTap: () => {
      F.dmg = F.dmg === d ? "" : d;
      redraw();
    } });
    const n = activeFilters();
    chip(filters, F.open ? "More \u25B2" : n ? `More (${n}) \u25BC` : "More \u25BC", { on: F.open, onTap: () => {
      F.open = !F.open;
      drawFilters();
      drawPanel();
    } });
    if (n || F.sort !== "name") chip(filters, "Clear", { color: "var(--color-red)", onTap: () => {
      F.roles.clear();
      F.dmg = "";
      F.feat.clear();
      F.reach = "";
      F.sort = "name";
      redraw();
    } });
  };
  const drawPanel = () => {
    panel.empty();
    panel.toggleClass("is-open", F.open);
    if (!F.open) return;
    const sect = (title) => {
      h(panel, "div", "mn-fp-t", title);
      return h(panel, "div", "mn-chips");
    };
    const ab = sect("\u6280\u80FD(\u9EDE\u4E00\u4E0B=\u8981\u6709,\u518D\u9EDE=\u4E0D\u8981\u6709)");
    for (const f of FEATURES) {
      const st = F.feat.get(f);
      chip(ab, (st === 1 ? "\u2713 " : st === -1 ? "\u2715 " : "") + f, {
        on: st !== void 0,
        color: st === -1 ? "var(--color-red)" : void 0,
        onTap: () => {
          if (st === void 0) F.feat.set(f, 1);
          else if (st === 1) F.feat.set(f, -1);
          else F.feat.delete(f);
          redraw();
        }
      });
    }
    const rg = sect("\u8DDD\u96E2");
    for (const r of REACH) chip(rg, r, { on: F.reach === r, onTap: () => {
      F.reach = F.reach === r ? "" : r;
      redraw();
    } });
    const so = sect("\u6392\u5E8F");
    for (const [id, label] of SORTS) chip(so, label, { on: F.sort === id, onTap: () => {
      F.sort = id;
      redraw();
    } });
  };
  search.addEventListener("input", () => {
    query = search.value;
    draw();
  });
  redraw();
}
function championsPage(ctx) {
  if (ctx.frame.key === "champion") return championCard(ctx);
  const mode = MODES[ctx.plugin.settings.mode];
  const el = page("Champions");
  chip(h(el, "div", "mn-chips mn-chips-top"), mode.label, { color: "var(--interactive-accent)" });
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
  const dmgColor = DAMAGE_COLOR[c.damageType] ?? "var(--interactive-accent)";
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
  chip(tags, c.damageType, { color: dmgColor });
  const now = ctx.plugin.store.currentChanges(c.id);
  if (badgeText(now)) chip(tags, badgeText(now), { color: badgeColor(now), onTap: () => {
    show("skills");
    block?.open();
    block?.el.scrollIntoView({ behavior: "smooth", block: "start" });
  } });
  const panel = h(el, "div", "mn-panel");
  radar(panel, [
    { label: "\u7269\u7406", value: c.attack },
    { label: "\u9B54\u6CD5", value: c.magic },
    { label: "\u9632\u79A6", value: c.defense },
    { label: "\u5C04\u7A0B", value: Math.min(10, Math.round(c.range / 65)) },
    { label: "\u96E3\u5EA6", value: c.difficulty }
  ], 10, dmgColor);
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
  return { title: c.name, el };
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

// src/pages/augments.ts
var RARITIES = ["\u9280", "\u91D1", "\u7A1C\u93E1"];
var RARITY_COLOR = { \u9280: "var(--text-muted)", \u91D1: "var(--color-yellow)", \u7A1C\u93E1: "var(--color-purple)" };
function augmentsPage(ctx) {
  const el = page("Augments");
  const all = ctx.plugin.store.augments();
  if (!all.length) {
    empty(el, { icon: "database", title: "No augment notes yet", text: "Run python3 tools/fetch_augments.py" });
    return { title: "Augments", el };
  }
  let query = "", rarity = "";
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search";
  const links = group(el);
  row(links, { icon: "external-link", title: "OP.GG Mayhem tier list", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
  row(links, { icon: "external-link", title: "U.GG augment tier list", chevron: true, onTap: () => window.open("https://u.gg/lol/aram-mayhem-augment-tier-list") });
  const chips = h(el, "div", "mn-chips");
  const list2 = h(el, "div");
  const draw = () => {
    list2.empty();
    const q = query.trim().toLowerCase();
    const hits = all.filter((a) => (!rarity || a.rarity === rarity) && (!q || a.name.toLowerCase().includes(q)));
    const g = group(list2);
    for (const a of hits.slice(0, 100)) row(g, { image: a.icon, title: a.name, sub: a.effect || void 0, value: a.rarity, chevron: true, onTap: () => ctx.openNote(a.path) });
    if (!hits.length) empty(list2, { icon: "search-x", title: "No match" });
    else if (hits.length > 100) h(list2, "div", "mn-gf", `${hits.length - 100} more: search or filter`);
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

// src/pages/handbook.ts
var SNIPPET = 46;
var MAX_PER_NOTE = 2;
function handbookPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("Handbook");
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search the handbook, e.g. \u63A7\u5834, \u8B77\u7532";
  const out = h(el, "div");
  const notes = store.guideNotes();
  let texts = null;
  const openChampion = (id, name, sub) => {
    rememberSub(id, sub);
    ctx.goTab("champions");
    ctx.push({ key: "champion", title: name, params: { id } });
  };
  const cards = () => {
    out.empty();
    if (!notes.length) {
      empty(out, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." });
      return;
    }
    const g = group(out);
    for (const n of notes) row(g, { icon: n.icon, title: n.title, sub: n.summary || void 0, chevron: true, onTap: () => ctx.openNote(n.file.path) });
  };
  const results = async (q) => {
    if (!texts) {
      texts = /* @__PURE__ */ new Map();
      for (const n of notes) texts.set(n.file.path, (await ctx.app.vault.cachedRead(n.file)).replace(/^---[\s\S]*?---\n/, "").split("\n").map(clean).filter(Boolean));
    }
    if (search.value.trim().toLowerCase() !== q) return;
    out.empty();
    let found = 0;
    const guide = notes.map((n) => ({ n, lines: (texts.get(n.file.path) ?? []).filter((l) => l.toLowerCase().includes(q)), title: n.title.toLowerCase().includes(q) })).filter((x) => x.title || x.lines.length);
    if (guide.length) {
      const g = group(out, "Guide");
      for (const { n, lines } of guide) {
        const r = row(g, { icon: n.icon, title: n.title, chevron: true, onTap: () => ctx.openNote(n.file.path) });
        const main = r.querySelector(".mn-row-main");
        for (const l of lines.slice(0, MAX_PER_NOTE)) marked(h(main, "div", "mn-row-s"), snippet(l, q), q);
        found++;
      }
    }
    const tipHits = store.champions().flatMap((c) => c.tips.filter((t) => `${t.title} ${t.text}`.toLowerCase().includes(q)).map((t) => ({ c, t })));
    if (tipHits.length) {
      const g = group(out, "Tips");
      for (const { c, t } of tipHits) {
        const r = row(g, { image: c.icon, title: `${c.name}:${t.title}`, chevron: true, onTap: () => openChampion(c.id, c.name, "tips") });
        marked(h(r.querySelector(".mn-row-main"), "div", "mn-row-s"), snippet(t.text, q), q);
        found++;
      }
    }
    const buildHits = store.champions().flatMap((c) => c.builds.filter((b) => `${b.name} ${b.note}`.toLowerCase().includes(q)).map((b) => ({ c, b })));
    if (buildHits.length) {
      const g = group(out, "Builds");
      for (const { c, b } of buildHits) {
        const r = row(g, { image: c.icon, title: `${c.name}:${b.name}`, chevron: true, onTap: () => openChampion(c.id, c.name, "build") });
        if (b.note) marked(h(r.querySelector(".mn-row-main"), "div", "mn-row-s"), snippet(b.note, q), q);
        found++;
      }
    }
    if (!found) empty(out, { icon: "search-x", title: "Nothing found", text: "Try a shorter word." });
  };
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) cards();
    else void results(q);
  });
  cards();
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
var OFFICIAL = "https://www.leagueoflegends.com/zh-tw/news/tags/patch-notes/";
function patchPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("Patch");
  const now = store.currentPatch();
  const hero = h(el, "div", "mn-patch");
  h(hero, "div", "mn-patch-k", "Data from patch");
  h(hero, "div", "mn-patch-v", now || "\u2014");
  h(hero, "div", "mn-patch-s", "Champions, skills and items are regenerated per patch. Tips and builds below show the patch they were written for.");
  const links = group(el);
  row(links, { icon: "external-link", title: "Official patch notes (\u7E41\u4E2D)", chevron: true, onTap: () => window.open(OFFICIAL) });
  const notes = store.patchNotes();
  if (notes.length) {
    const g2 = group(el, "Our patch notes");
    for (const n of notes) row(g2, { icon: "file-text", title: n.title, sub: n.summary || void 0, value: n.patch, chevron: true, onTap: () => ctx.openNote(n.file.path) });
  }
  const changed = store.champions().map((c) => ({ c, items: store.currentChanges(c.id) })).filter((x) => x.items.length);
  if (changed.length) {
    const g2 = group(el, `Changed in ${now}`);
    for (const { c, items } of changed.sort((a, b) => b.items.length - a.items.length)) {
      const r = row(g2, { image: c.icon, title: c.name, chevron: true, onTap: () => {
        rememberSub(c.id, "skills");
        ctx.goTab("champions");
        ctx.push({ key: "champion", title: c.name, params: { id: c.id } });
      } });
      const badge = h(r, "span", "mn-row-v", badgeText(items) || "\u270E");
      badge.style.color = badgeColor(items);
      r.insertBefore(badge, r.querySelector(".mn-row-chev"));
    }
    h(el, "div", "mn-gf", "Stats, cooldowns, costs, ranges and skill text compared with the previous patch. Damage numbers are not compared yet.");
  }
  const stale = store.staleEntries();
  const g = group(el, "Check these tricks");
  if (!stale.length) {
    empty(g, { icon: "check-circle", title: "Nothing to recheck", text: "Every tip and build matches the current patch." });
  } else {
    for (const s of stale.slice(0, 30)) {
      row(g, { image: s.champion.icon, title: `${s.champion.name}:${s.title}`, sub: s.patch ? `Written for ${s.patch}` : "No patch given", value: s.kind === "tip" ? "Tip" : "Build", chevron: true, onTap: () => {
        rememberSub(s.champion.id, s.kind === "tip" ? "tips" : "build");
        ctx.goTab("champions");
        ctx.push({ key: "champion", title: s.champion.name, params: { id: s.champion.id } });
      } });
    }
    if (stale.length > 30) h(el, "div", "mn-gf", `${stale.length - 30} more`);
  }
  void icon;
  return { title: "Patch", el };
}

// src/pages/index.ts
var PAGES = {
  champions: championsPage,
  augments: augmentsPage,
  patch: patchPage,
  handbook: handbookPage
};

// src/view.ts
var VIEW_TYPE = "morellonomicon";
var MnView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.scrolls = /* @__PURE__ */ new Map();
    this.shown = "";
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
    app.toggleClass("is-full", import_obsidian4.Platform.isMobile);
    this.topEl = h(app, "div", "mn-top");
    this.backEl = h(this.topEl, "button", "mn-btn mn-back");
    icon(this.backEl, "chevron-left");
    this.backEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.back();
    });
    this.titleEl = h(this.topEl, "div", "mn-top-title");
    const acts = h(this.topEl, "div", "mn-acts");
    const modeBtn = h(acts, "button", "mn-btn");
    modeBtn.setAttribute("aria-label", "Mode");
    modeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.modeMenu(e);
    });
    this.modeBtn = modeBtn;
    this.scrollEl = h(app, "div", "mn-scroll");
    this.registerDomEvent(this.scrollEl, "scroll", () => this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > 36), { passive: true });
    this.tabsEl = h(app, "div", "mn-tabs");
    this.buildTabs();
    this.draw();
  }
  async onClose() {
    this.scrolls.clear();
  }
  modeMenu(e) {
    const menu = new import_obsidian4.Menu();
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
      if (this.router.popToRoot()) this.draw();
      else this.scrollEl.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    this.router.setTab(id);
    this.markTab();
    this.draw();
  }
  goTab(id) {
    this.router.popToRoot();
    if (id !== this.router.tab) this.tapTab(id);
    else this.draw();
  }
  push(f) {
    if (this.router.push(f)) this.draw();
  }
  back() {
    if (this.router.pop()) this.draw();
  }
  // Data or settings changed: redraw from scratch (the mode may have changed the tabs)
  refresh(resetStack = false) {
    if (resetStack) this.router.reset();
    this.buildTabs();
    this.draw();
  }
  draw() {
    if (this.shown) this.scrolls.set(this.shown, this.scrollEl.scrollTop);
    const key = this.key();
    const f = this.router.top();
    let out;
    try {
      out = PAGES[this.router.tab]({
        app: this.app,
        plugin: this.plugin,
        frame: f,
        push: (x) => this.push(x),
        pop: () => this.back(),
        goTab: (id) => this.goTab(id),
        openNote: (path) => {
          void this.plugin.openPath(path);
        }
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
};

// src/main.ts
var MorellonomiconPlugin = class extends import_obsidian5.Plugin {
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
    (0, import_obsidian5.setIcon)(this.home, "book-open");
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
    document.body.toggleClass("mn-full", on && import_obsidian5.Platform.isMobile);
    if (!import_obsidian5.Platform.isMobile) return;
    const v = ws.getActiveViewOfType(import_obsidian5.View);
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
      leaf = ws.getLeaf(startup || import_obsidian5.Platform.isMobile ? false : "tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await ws.revealLeaf(leaf);
    ws.setActiveLeaf(leaf, { focus: true });
    this.updateBody();
  }
  // A note in a tab of its own; a tab that already shows it is brought forward instead of opening a second one
  async openPath(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof import_obsidian5.TFile)) return;
    const ws = this.app.workspace;
    const open = ws.getLeavesOfType("markdown").find((l) => l.view.file?.path === path);
    if (open) {
      await ws.revealLeaf(open);
      ws.setActiveLeaf(open, { focus: false });
      return;
    }
    await ws.getLeaf("tab").openFile(f, { state: { mode: "preview" } });
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
