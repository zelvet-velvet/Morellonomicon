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
  mayhem: { id: "mayhem", label: "Mayhem", icon: "zap", enabled: true, itemFlag: "aram", tabs: ["home", "champions", "items", "guide"] },
  rift: { id: "rift", label: "Rift", icon: "map", enabled: false, itemFlag: "rift", tabs: ["home", "champions", "items", "guide"] }
};
var MODE_ORDER = ["mayhem", "rift"];
var TAB_LABEL = { champions: "Champions", items: "Items", guide: "Guide" };
var TAB_ICON = { champions: "users", items: "package", guide: "book-open" };

// src/data/store.ts
var str = (v, d = "") => typeof v === "string" ? v : d;
var num = (v, d = 0) => typeof v === "number" ? v : d;
var skillList = (v) => Array.isArray(v) ? v.flatMap((x) => {
  const o = x;
  return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), icon: str(o.icon), desc: str(o.desc), upgrade: str(o.upgrade), cd: str(o.cd), cost: str(o.cost), range: str(o.range) }] : [];
}) : [];
var list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
var Store = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.champs = null;
    this.its = null;
    this.augs = null;
  }
  get app() {
    return this.plugin.app;
  }
  get s() {
    return this.plugin.settings;
  }
  invalidate() {
    this.champs = null;
    this.its = null;
    this.augs = null;
  }
  inData(path) {
    const s = this.s;
    return [s.championFolder, s.itemFolder, s.guideFolder, s.augmentFolder].some((f) => path.startsWith((0, import_obsidian.normalizePath)(f) + "/"));
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
  guideNotes() {
    return this.notes(this.s.guideFolder).map((n) => n.file).sort((a, b) => a.path.localeCompare(b.path, "zh-Hant"));
  }
};

// src/router.ts
var KEY = "morellonomicon-nav";
var STACK_TTL = 30 * 60 * 1e3;
var Router = class {
  constructor(app) {
    this.app = app;
    this.tab = "home";
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
    if (!tabs.includes(this.tab)) this.tab = tabs[0] ?? "home";
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

// src/pages/champions.ts
var ROLES = ["\u6230\u58EB", "\u5766\u514B", "\u6CD5\u5E2B", "\u523A\u5BA2", "\u5C04\u624B", "\u8F14\u52A9"];
var DAMAGES = ["\u7269\u7406", "\u9B54\u6CD5", "\u6DF7\u5408"];
function championPicker(parent, ctx, withFilters) {
  const all = ctx.plugin.store.champions();
  if (!all.length) {
    empty(parent, { icon: "database", title: "No champion notes yet", text: "Run python3 tools/fetch_data.py" });
    return;
  }
  let query = "", role = "", dmg = "";
  const box = h(parent, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search";
  search.setAttribute("enterkeyhint", "search");
  let filters = null;
  if (withFilters) filters = h(parent, "div", "mn-chips");
  const grid = h(parent, "div", "mn-grid");
  const drawGrid = () => {
    grid.empty();
    const q = query.trim().toLowerCase();
    const hits = all.filter((c) => (!role || c.roles.includes(role)) && (!dmg || c.damageType === dmg) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)));
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
    if (!hits.length) empty(grid, { icon: "search-x", title: "No match" });
  };
  const drawFilters = () => {
    if (!filters) return;
    filters.empty();
    for (const r of ROLES) chip(filters, r, { on: role === r, onTap: () => {
      role = role === r ? "" : r;
      drawFilters();
      drawGrid();
    } });
    for (const d of DAMAGES) chip(filters, d, { on: dmg === d, color: DAMAGE_COLOR[d], onTap: () => {
      dmg = dmg === d ? "" : d;
      drawFilters();
      drawGrid();
    } });
  };
  search.addEventListener("input", () => {
    query = search.value;
    drawGrid();
  });
  drawFilters();
  drawGrid();
}
function championsPage(ctx) {
  if (ctx.frame.key === "champion") return championCard(ctx);
  const el = page("Champions");
  championPicker(el, ctx, true);
  return { title: "Champions", el };
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
  const panel = h(el, "div", "mn-panel");
  radar(panel, [
    { label: "\u7269\u7406", value: c.attack },
    { label: "\u9B54\u6CD5", value: c.magic },
    { label: "\u9632\u79A6", value: c.defense },
    { label: "\u5C04\u7A0B", value: Math.min(10, Math.round(c.range / 65)) },
    { label: "\u96E3\u5EA6", value: c.difficulty }
  ], 10, dmgColor);
  skillStrip(el, c);
  if (c.archetypes.length || c.features.length) {
    const tg = h(el, "div", "mn-chips");
    for (const a of c.archetypes) chip(tg, a);
    for (const f of c.features) chip(tg, f, { color: "var(--color-cyan)" });
  }
  const mode = MODES[ctx.plugin.settings.mode];
  const g = group(el, mode.id === "mayhem" ? "Augments" : "Build");
  row(g, { icon: mode.id === "mayhem" ? "sparkles" : "swords", title: mode.id === "mayhem" ? "Best augments" : "Core build", value: "Soon", muted: true });
  if (c.video) row(group(el), { icon: "play-circle", title: "Combo video", chevron: true, onTap: () => window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(c.video)}`) });
  return { title: c.name, el };
}
function skillStrip(parent, c) {
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
    const meta = [];
    if (s.cd) meta.push(["\u51B7\u537B", `${s.cd} \u79D2`]);
    if (s.cost) meta.push(["\u6D88\u8017", s.cost === "0" ? "\u7121" : `${s.cost} ${c.resource}`]);
    if (s.range) meta.push(["\u5C04\u7A0B", s.range]);
    if (meta.length) {
      const m = h(detail, "div", "mn-sd-meta");
      for (const [k, v] of meta) {
        const cell = h(m, "div", "mn-sd-cell");
        h(cell, "span", "mn-sd-k", k);
        h(cell, "span", "mn-sd-v", v);
      }
    }
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

// src/pages/guide.ts
function guidePage(ctx) {
  const el = page("Guide");
  const notes = ctx.plugin.store.guideNotes();
  if (!notes.length) {
    empty(el, { icon: "book-open", title: "Nothing here yet", text: "Guide notes go in the guide folder." });
    return { title: "Guide", el };
  }
  const g = group(el);
  for (const n of notes) row(g, { icon: "file-text", title: n.basename, chevron: true, onTap: () => ctx.openNote(n.path) });
  return { title: "Guide", el };
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

// src/pages/home.ts
function homePage(ctx) {
  if (ctx.frame.key === "augments") return augmentsPage(ctx);
  const mode = MODES[ctx.plugin.settings.mode];
  const el = page(mode.id === "mayhem" ? "Who are you playing?" : "Summoner's Rift");
  if (!mode.enabled) {
    row(group(el), { icon: "construction", title: "Rift is not built yet", sub: "Switch to Mayhem (top right).", muted: true });
    return { title: mode.label, el };
  }
  championPicker(el, ctx, false);
  const g = group(el);
  row(g, { icon: "sparkles", title: "Augments", chevron: true, onTap: () => ctx.push({ key: "augments", title: "Augments" }) });
  row(g, { icon: "flame", title: "Combos", value: "Soon", muted: true });
  row(g, { icon: "package", title: "ARAM items", chevron: true, onTap: () => ctx.goTab("items") });
  return { title: mode.label, el };
}

// src/pages/items.ts
var KINDS = [["AP", "SpellDamage"], ["AD", "Damage"], ["Armor", "Armor"], ["MR", "SpellBlock"], ["HP", "Health"], ["Speed", "Boots"]];
function itemsPage(ctx) {
  const el = page("Items");
  const all = ctx.plugin.store.modeItems().filter((i) => i.goldTotal > 0);
  if (!all.length) {
    empty(el, { icon: "database", title: "No item notes yet", text: "Run python3 tools/fetch_data.py" });
    return { title: "Items", el };
  }
  let query = "", kind = "";
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search";
  const chips = h(el, "div", "mn-chips");
  const list2 = h(el, "div");
  const draw = () => {
    list2.empty();
    const q = query.trim().toLowerCase();
    const hits = all.filter((i) => (!kind || i.tags.includes(kind)) && (!q || i.name.toLowerCase().includes(q)));
    const g = group(list2);
    for (const i of hits.slice(0, 80)) row(g, { image: i.icon, title: i.name, value: `${i.goldTotal}`, chevron: true, onTap: () => ctx.openNote(i.path) });
    if (!hits.length) empty(list2, { icon: "search-x", title: "No match" });
    else if (hits.length > 80) h(list2, "div", "mn-gf", `${hits.length - 80} more: search or filter`);
  };
  const drawChips = () => {
    chips.empty();
    for (const [label, tag] of KINDS) chip(chips, label, { on: kind === tag, onTap: () => {
      kind = kind === tag ? "" : tag;
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
  return { title: "Items", el };
}

// src/pages/index.ts
var PAGES = {
  home: homePage,
  champions: championsPage,
  items: itemsPage,
  guide: guidePage
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
    return id === "home" ? MODES[this.plugin.settings.mode].label : TAB_LABEL[id];
  }
  tabIcon(id) {
    return id === "home" ? MODES[this.plugin.settings.mode].icon : TAB_ICON[id];
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
      this.views().forEach((v) => v.refresh());
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
    this.views().forEach((v) => v.refresh(true));
  }
};
