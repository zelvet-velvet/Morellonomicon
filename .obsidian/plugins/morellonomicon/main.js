"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
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
var import_obsidian10 = require("obsidian");

// src/data/sound.ts
function loose(s) {
  return s.replace(/^zh/, "z").replace(/^ch/, "c").replace(/^sh/, "s").replace(/ing$/, "in").replace(/eng$/, "en").replace(/^l/, "n");
}
var Sounds = class {
  // `table`: the usual reading of each character; `rare`: older or rarer ones, which only what was said may use (a name
  // matched on its rare readings finds wrong champions: 鄂爾 for 阿狸)
  constructor(table, rare = {}) {
    this.exact = /* @__PURE__ */ new Map();
    this.near = /* @__PURE__ */ new Map();
    this.exactAll = /* @__PURE__ */ new Map();
    this.nearAll = /* @__PURE__ */ new Map();
    const add = (exact, near, t) => {
      for (const [sound, chars] of Object.entries(t)) for (const ch of chars) {
        if (!exact.has(ch)) {
          exact.set(ch, /* @__PURE__ */ new Set());
          near.set(ch, /* @__PURE__ */ new Set());
        }
        exact.get(ch).add(sound);
        near.get(ch).add(loose(sound));
      }
    };
    add(this.exact, this.near, table);
    add(this.exactAll, this.nearAll, table);
    add(this.exactAll, this.nearAll, rare);
  }
  // The Chinese characters of a text, as sounds (anything else is dropped); a character not in the table matches nothing.
  // `heard`: what was typed or said, which may use any reading; otherwise a name, on its usual readings.
  said(text, near = false, heard = false) {
    const map = heard ? near ? this.nearAll : this.exactAll : near ? this.near : this.exact;
    const out = [];
    for (const ch of text) {
      if (!/\p{Script=Han}/u.test(ch)) continue;
      out.push(map.get(ch) ?? /* @__PURE__ */ new Set());
    }
    return out;
  }
};
var same = (a, b) => {
  for (const x of a) if (b.has(x)) return true;
  return false;
};
function findSaid(whole, part, from = 0) {
  if (!part.length) return -1;
  for (let i = from; i + part.length <= whole.length; i++) {
    let ok = true;
    for (let j = 0; j < part.length && ok; j++) ok = same(whole[i + j], part[j]);
    if (ok) return i;
  }
  return -1;
}
function saidDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function soundScore(q, name, near) {
  const cut = near ? 4 : 0;
  if (!q.length || !name.length) return 0;
  const at = findSaid(name, q);
  if (q.length === name.length && at === 0) return 78 - cut;
  if (q.length >= 2 && at === 0) return 70 - cut;
  if (q.length >= 2 && at > 0) return 64 - cut;
  if (near && Math.min(q.length, name.length) >= 3 && saidDistance(q, name) === 1) return 52;
  return 0;
}

// src/data/store.ts
var import_obsidian = require("obsidian");

// src/modes.ts
var MODES = {
  mayhem: { id: "mayhem", label: "Mayhem", icon: "zap", enabled: true, itemFlag: "aram", tabs: ["augments", "patch", "champions", "handbook"] },
  rift: { id: "rift", label: "Rift", icon: "map", enabled: false, itemFlag: "rift", tabs: ["patch", "champions", "handbook"] }
};
var MODE_ORDER = ["mayhem", "rift"];
var TAB_LABEL = { champions: "Champions", augments: "Augments", patch: "Patch", handbook: "Handbook" };
var TAB_ICON = { champions: "users", augments: "sparkles", patch: "newspaper", handbook: "book-open" };

// src/data/store.ts
function withOnHit(skills2, keys) {
  return keys.length ? skills2.map((s) => keys.includes(s.key) && !s.tags.includes("\u653B\u64CA\u7279\u6548") ? { ...s, tags: [...s.tags, "\u653B\u64CA\u7279\u6548"] } : s) : skills2;
}
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
  return o && typeof o === "object" ? [{ key: str(o.key), name: str(o.name), damage: list(o.damage), tags: list(o.tags), icon: str(o.icon), desc: str(o.desc), upgrade: str(o.upgrade), range: str(o.range), rows: rowList(o.rows), levels: numList(o.levels) }] : [];
}) : [];
var textMap = (v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter((e) => typeof e[1] === "string")) : {};
var list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
var LANE_MIN_SHARE = 0.1;
var LANE_ZH = { TOP: "\u4E0A\u8DEF", JUNGLE: "\u6253\u91CE", MIDDLE: "\u4E2D\u8DEF", BOTTOM: "\u4E0B\u8DEF", UTILITY: "\u8F14\u52A9" };
var Store = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.champs = null;
    this.its = null;
    this.augs = null;
    this.stats = null;
    this.changes = null;
    // your own champion mastery (_data/mastery.json from tools/fetch_mastery.py; git-ignored, so only on the device that has the file)
    this.mastery = null;
    this.positions = null;
    // _data/positions.json
    this.riotNotes = [];
    this.sounds = null;
    // _data/sounds.json: how characters are said, for finding names from speech to text
    this.loadingTips = [];
    // _data/loading-tips.json: the game's loading screen tips (zh_TW)
    this.gameText = {};
    // augment id -> the game's own description (tools/fetch_augment_text.py)
    // false until the data files (_data/*.json) have been read once after start-up
    this.ready = false;
  }
  masteryOf(id) {
    return this.mastery?.champions[id];
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
      const path = (0, import_obsidian.normalizePath)("_data/positions.json");
      this.positions = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)) : null;
    } catch {
      this.positions = null;
    }
    try {
      const path = (0, import_obsidian.normalizePath)("_data/mastery.json");
      const raw = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)) : null;
      this.mastery = raw?.champions ? { fetched: raw.fetched ?? "", total: raw.total_points ?? 0, champions: raw.champions } : null;
    } catch {
      this.mastery = null;
    }
    try {
      const path = (0, import_obsidian.normalizePath)("_data/loading-tips.json");
      this.loadingTips = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)).tips ?? [] : [];
    } catch {
      this.loadingTips = [];
    }
    if (!this.sounds) try {
      const path = (0, import_obsidian.normalizePath)("_data/sounds.json");
      if (await this.app.vault.adapter.exists(path)) {
        const d = JSON.parse(await this.app.vault.adapter.read(path));
        this.sounds = new Sounds(d.sounds, d.rare);
      }
    } catch {
      this.sounds = null;
    }
    try {
      const path = (0, import_obsidian.normalizePath)("_data/changes.json");
      this.changes = await this.app.vault.adapter.exists(path) ? JSON.parse(await this.app.vault.adapter.read(path)) : null;
    } catch {
      this.changes = null;
    }
    this.ready = true;
  }
  // The lanes a champion is played in: a hand-written `positions` list in its note, else the lanes with at least LANE_MIN_SHARE
  // of its ranked games in _data/positions.json (tools/fetch_builds.py --mode ranked), most played first
  lanes(c) {
    if (c.positions.length) return c.positions;
    const counts = this.positions?.champions[c.id];
    if (!counts) return [];
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts).filter(([, n]) => n / total >= LANE_MIN_SHARE).sort((a, b) => b[1] - a[1]).map(([k]) => LANE_ZH[k] ?? k);
  }
  hasLanes() {
    return !!this.positions || this.champions().some((c) => c.positions.length);
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
        nameEn: str(fm.name_en, str(fm.id)),
        title: str(fm.title),
        blurb: str(fm.blurb),
        tier: str(fm.tier),
        roles: list(fm.roles),
        damageType: str(fm.damage_type),
        skillDamage: list(fm.skill_damage),
        archetypes: [...list(fm.archetypes), ...list(fm.archetypes_extra)],
        features: [...list(fm.features), ...list(fm.features_extra), ...list(fm.onhit).length ? ["\u653B\u64CA\u7279\u6548"] : []],
        resource: str(fm.resource),
        attack: num(fm.attack),
        magic: num(fm.magic),
        defense: num(fm.defense),
        difficulty: num(fm.difficulty),
        range: num(fm.range),
        icon: str(fm.icon),
        skills: withOnHit(skillList(fm.skills), list(fm.onhit)),
        patch: str(fm.patch),
        pinned: list(fm.pinned),
        avoid: list(fm.avoid),
        positions: list(fm.positions),
        aliases: list(fm.aliases),
        video: typeof fm.video === "string" ? fm.video : void 0,
        builds: buildList(fm.builds),
        tips: tipList(fm.tips),
        path: file.path,
        punch: str(fm.punch),
        soul: str(fm.soul),
        plain: textMap(fm.plain)
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
    return this.notes(this.s.guideFolder).map(({ file, fm }) => ({ file, title: file.basename, icon: str(fm.icon, "file-text"), summary: str(fm.summary), order: num(fm.order, 99), layout: str(fm.layout, "deck"), cover: str(fm.cover), level: str(fm.level, "basic") })).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hant"));
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
      if (s && Date.now() - s.t < STACK_TTL && s.stacks?.[this.tab]) this.stacks = { [this.tab]: s.stacks[this.tab] };
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

// src/ui.ts
var import_obsidian2 = require("obsidian");
var h = (parent, tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  parent?.appendChild(e);
  return e;
};
var bubbleEl = null;
var bubbleTimer = 0;
var BUBBLE_MS = 2200;
var closeBubble = () => {
  window.clearTimeout(bubbleTimer);
  bubbleEl?.remove();
  bubbleEl = null;
  document.removeEventListener("pointerdown", closeBubble, true);
  document.removeEventListener("scroll", closeBubble, true);
};
var tip = (anchor, text) => {
  closeBubble();
  const t = h(anchor.closest(".mn-app") ?? document.body, "div", "mn-bubble", text);
  bubbleEl = t;
  const a = anchor.getBoundingClientRect();
  t.style.left = `${Math.max(8, Math.min(window.innerWidth - t.offsetWidth - 8, a.left + a.width / 2 - t.offsetWidth / 2))}px`;
  t.style.top = `${a.top - t.offsetHeight - 8 < 8 ? a.bottom + 8 : a.top - t.offsetHeight - 8}px`;
  bubbleTimer = window.setTimeout(closeBubble, BUBBLE_MS);
  window.setTimeout(() => {
    if (bubbleEl !== t) return;
    document.addEventListener("pointerdown", closeBubble, true);
    document.addEventListener("scroll", closeBubble, true);
  }, 0);
};
var SWIPE = { slop: 6, bias: 0.7, at: 0.25, flick: 0.5, flickMin: 24 };
var FIRST_SCREEN = 36;
function whenLoaded(root, ms, count2 = FIRST_SCREEN) {
  const pending = Array.from(root.querySelectorAll("img")).slice(0, count2).filter((im) => im.src && !im.complete);
  if (!pending.length) return null;
  return new Promise((done) => {
    let left = pending.length;
    const t = window.setTimeout(done, ms);
    const one = () => {
      if (--left <= 0) {
        window.clearTimeout(t);
        done();
      }
    };
    for (const im of pending) {
      im.loading = "eager";
      im.addEventListener("load", one, { once: true });
      im.addEventListener("error", one, { once: true });
    }
  });
}
function releaseVideos(root) {
  root.querySelectorAll("video").forEach((v) => {
    v.pause();
    v.removeAttribute("src");
    v.replaceChildren();
    v.load();
  });
}
function whenMediaLoaded(roots, ms) {
  const media2 = roots.flatMap((r) => Array.from(r.querySelectorAll("img, video")));
  const ready = (m) => !m.isConnected || (m instanceof HTMLVideoElement ? m.readyState >= 2 || !!m.error : m.complete);
  return new Promise((done) => {
    const t0 = Date.now();
    const tick = () => {
      if (media2.every(ready) || Date.now() - t0 > ms) done();
      else window.setTimeout(tick, 150);
    };
    tick();
  });
}
var BLOCK_MAX_MS = 8e3;
var BLOCK_MIN_MS = 500;
var BLOCK_DELAY_MS = 120;
var blockState = /* @__PURE__ */ new WeakMap();
var BAND_MS = 1500;
var BAND_RUN = 0.8;
var BAND_TILT = Math.tan(22 * Math.PI / 180);
var bandVeils = /* @__PURE__ */ new Set();
var bandFrame = 0;
var bandPhase = () => performance.now() % BAND_MS / BAND_MS;
function bandStep() {
  const w = window.innerWidth, hh = window.innerHeight, bw = w * 0.55;
  const q = Math.min(1, bandPhase() / BAND_RUN), e = 1 - Math.pow(1 - q, 2.2);
  const start = w + bw / 2 + 0.4 * hh, end = -bw / 2 - 0.4 * hh;
  const lineX = start + (end - start) * e;
  for (const el of bandVeils) {
    if (!el.isConnected) {
      bandVeils.delete(el);
      continue;
    }
    const r = el.getBoundingClientRect();
    const x = lineX - (r.top + r.height / 2 - hh / 2) * BAND_TILT;
    el.style.setProperty("--bx", `${(x - r.left - bw / 2).toFixed(1)}px`);
    el.style.setProperty("--bw", `${bw.toFixed(0)}px`);
  }
  bandFrame = bandVeils.size ? requestAnimationFrame(bandStep) : 0;
}
function trackBand(el) {
  bandVeils.add(el);
  if (!bandFrame) bandFrame = requestAnimationFrame(bandStep);
}
function endBand(el) {
  const p = bandPhase();
  const wait = (p < BAND_RUN ? BAND_RUN - p : 1 - p + BAND_RUN) * BAND_MS;
  window.setTimeout(() => {
    bandVeils.delete(el);
    el.remove();
  }, wait);
}
function lift(host, state) {
  window.setTimeout(() => {
    if (blockState.get(host) !== state) return;
    blockState.delete(host);
    state.veil.classList.remove("is-in");
    endBand(state.veil);
  }, Math.max(0, BLOCK_MIN_MS - (Date.now() - state.since)));
}
function blockUntil(host, until, delay = 0) {
  if (delay > 0 && !blockState.get(host)) {
    let done = false;
    void until.then(() => {
      done = true;
    });
    window.setTimeout(() => {
      if (!done) blockUntil(host, until);
    }, delay);
    return;
  }
  host.classList.add("mn-blk");
  let st = blockState.get(host);
  if (!st) {
    st = { veil: h(host, "div", "mn-blkveil is-in"), since: Date.now() };
    trackBand(st.veil);
    blockState.set(host, st);
  }
  const state = st;
  const cap = window.setTimeout(() => lift(host, state), BLOCK_MAX_MS);
  void until.then(() => {
    window.clearTimeout(cap);
    lift(host, state);
  });
}
function blockLoad(host) {
  const pending = Array.from(host.querySelectorAll("img")).filter((im) => im.src && !im.complete);
  const st = blockState.get(host);
  if (!pending.length) {
    if (st) lift(host, st);
    return;
  }
  blockUntil(host, Promise.all(pending.map((im) => new Promise((done) => {
    im.addEventListener("load", () => done(), { once: true });
    im.addEventListener("error", () => done(), { once: true });
  }))).then(() => void 0), host.classList.contains("mn-blk") ? 0 : BLOCK_DELAY_MS);
}
async function warmPictures(urls, batch = 6) {
  for (let i = 0; i < urls.length; i += batch) {
    await Promise.all(urls.slice(i, i + batch).map((u) => new Promise((done) => {
      const im = new Image();
      im.onload = im.onerror = () => done();
      im.src = u;
    })));
  }
}
var HOLD_MS = 280;
var holdTip = (el, text) => {
  let timer = 0, shown = false;
  el.classList.add("mn-holdable");
  const end = () => {
    window.clearTimeout(timer);
    if (shown) closeBubble();
  };
  el.addEventListener("pointerdown", () => {
    shown = false;
    timer = window.setTimeout(() => {
      shown = true;
      tip(el, typeof text === "function" ? text() : text);
      window.clearTimeout(bubbleTimer);
    }, HOLD_MS);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, end);
  el.addEventListener("click", (e) => {
    if (shown) {
      e.preventDefault();
      e.stopImmediatePropagation();
      shown = false;
    }
  }, true);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
};
var icon = (parent, name, cls = "mn-ic") => {
  const s = h(parent, "span", cls);
  (0, import_obsidian2.setIcon)(s, name);
  if (!s.querySelector("svg")) (0, import_obsidian2.setIcon)(s, "circle");
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
var DAMAGE_COLOR = { \u7269\u7406: "var(--mn-phys)", \u9B54\u6CD5: "var(--mn-magic)", \u771F\u5BE6: "var(--mn-true)", \u6DF7\u5408: "var(--mn-mixed)" };
var DAMAGE_ICON = { \u7269\u7406: "sword", \u9B54\u6CD5: "sparkles", \u771F\u5BE6: "gem", \u6DF7\u5408: "blend" };
var scalingParts = (note) => (note.match(/\+[^+]+/g) ?? []).map((p) => p.trim()).filter(Boolean).map((text) => {
  const kind = text.includes("\u9B54\u6CD5") ? "\u9B54\u6CD5" : text.includes("\u7269\u7406") ? "\u7269\u7406" : "";
  return { text, color: kind ? DAMAGE_COLOR[kind] : "var(--mn-muted)", icon: kind ? DAMAGE_ICON[kind] : "plus" };
});
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
var ROLE_ICON = { \u6230\u58EB: "swords", \u5766\u514B: "shield", \u6CD5\u5E2B: "wand-sparkles", \u523A\u5BA2: "slice", \u5C04\u624B: "target", \u8F14\u52A9: "heart-handshake" };
var ROLE_WIKI = "https://wiki.leagueoflegends.com/en-us/Special:FilePath/";
var LANES = ["\u4E0A\u8DEF", "\u6253\u91CE", "\u4E2D\u8DEF", "\u4E0B\u8DEF", "\u8F14\u52A9"];
var LANE_ICON = { \u4E0A\u8DEF: "arrow-up-left", \u6253\u91CE: "trees", \u4E2D\u8DEF: "move-diagonal-2", \u4E0B\u8DEF: "arrow-down-right", \u8F14\u52A9: "heart-handshake" };
var LANE_FILE = { \u4E0A\u8DEF: "Top_icon.png", \u6253\u91CE: "Jungle_icon.png", \u4E2D\u8DEF: "Middle_icon.png", \u4E0B\u8DEF: "Bottom_icon.png", \u8F14\u52A9: "Support_icon.png" };
var ROLE_FILE = { \u6230\u58EB: "Fighter_icon.png", \u5766\u514B: "Tank_icon.png", \u6CD5\u5E2B: "Mage_icon.png", \u523A\u5BA2: "Slayer_icon.png", \u5C04\u624B: "Marksman_icon.png", \u8F14\u52A9: "Controller_icon.png" };
var preloaded = /* @__PURE__ */ new Map();
var preloadRoleIcons = () => {
  if (preloaded.size) return;
  for (const file of [...Object.values(ROLE_FILE), ...Object.values(LANE_FILE)]) {
    const im = new Image();
    im.src = ROLE_WIKI + file;
    preloaded.set(file, im);
  }
};
var iconChip = (parent, label, file, fallback, o) => {
  const el = chip(parent, "", { on: o.on, onTap: o.onTap });
  el.classList.add("mn-chip-ic");
  el.setAttribute("aria-label", label);
  holdTip(el, label);
  if (!file) {
    icon(el, fallback);
    return el;
  }
  const im = h(el, "img", "mn-role-img");
  im.alt = "";
  im.draggable = false;
  const cached = preloaded.get(file);
  if (!(cached?.complete && cached.naturalWidth)) {
    im.classList.add("is-loading");
    im.addEventListener("load", () => im.classList.remove("is-loading"), { once: true });
  }
  im.addEventListener("error", () => {
    im.remove();
    icon(el, fallback);
  }, { once: true });
  im.src = ROLE_WIKI + file;
  return el;
};
var roleArt = (parent, role) => {
  const box = h(parent, "span", "mn-role-art");
  const file = ROLE_FILE[role];
  if (!file) {
    icon(box, ROLE_ICON[role] ?? "circle");
    return box;
  }
  const im = h(box, "img", "mn-role-img");
  im.alt = "";
  im.draggable = false;
  im.addEventListener("error", () => {
    im.remove();
    icon(box, ROLE_ICON[role] ?? "circle");
  }, { once: true });
  im.src = ROLE_WIKI + file;
  return box;
};
var roleChip = (parent, role, o) => iconChip(parent, role, ROLE_FILE[role], ROLE_ICON[role] ?? "circle", o);
var laneChip = (parent, lane, o) => iconChip(parent, lane, LANE_FILE[lane], LANE_ICON[lane] ?? "circle", o);
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
  slideSeg(seg, options.map(([id]) => id).join("|"));
  return seg;
};
var tickBox = null;
function haptic() {
  try {
    const hp = window.Capacitor?.Plugins?.Haptics;
    if (hp?.impact) {
      void hp.impact({ style: "LIGHT" });
      return "capacitor";
    }
    if (hp?.selectionChanged) {
      void hp.selectionChanged();
      return "capacitor";
    }
  } catch {
  }
  try {
    if (navigator.vibrate?.(8)) return "vibrate";
  } catch {
  }
  if (!tickBox) {
    tickBox = document.createElement("label");
    tickBox.className = "mn-tick";
    tickBox.setAttribute("aria-hidden", "true");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("switch", "");
    box.tabIndex = -1;
    tickBox.appendChild(box);
    document.body.appendChild(tickBox);
  }
  tickBox.click();
  return /iPhone|iPad/.test(navigator.userAgent) ? "switch" : "";
}
var segLast = /* @__PURE__ */ new Map();
var slid = /* @__PURE__ */ new WeakMap();
function slideSeg(seg, key = "", opt = {}) {
  const done = slid.get(seg);
  if (done) {
    if (!done.hl.isConnected) seg.prepend(done.hl);
    requestAnimationFrame(done.place);
    return;
  }
  const item = opt.item ?? ".mn-seg-b";
  const hl = document.createElement("div");
  hl.className = "mn-seg-hl";
  seg.prepend(hl);
  seg.addClass("has-hl");
  const buttons = () => Array.from(seg.querySelectorAll(`:scope > ${item}`));
  key = key || buttons().map((b) => b.textContent ?? "").join("|");
  const box = (b) => {
    const r = (opt.fit && b.querySelector(opt.fit) || b).getBoundingClientRect(), s = seg.getBoundingClientRect();
    return { x: r.left - s.left - seg.clientLeft, y: r.top - s.top - seg.clientTop, w: r.width, h: r.height };
  };
  const put = (p) => {
    hl.style.opacity = "1";
    hl.style.width = `${p.w}px`;
    if (opt.fit) {
      hl.style.height = `${p.h}px`;
      hl.style.top = `${p.y}px`;
    }
    hl.style.transform = `translateX(${p.x}px)`;
  };
  const place = (b, animate) => {
    if (!b || !b.offsetWidth) {
      if (!b) hl.style.opacity = "0";
      return;
    }
    if (!animate) hl.style.transition = "none";
    const p = box(b);
    put(p);
    if (!animate) {
      void hl.offsetWidth;
      hl.style.transition = "";
    }
    segLast.set(key, p);
  };
  const on = () => buttons().find((b) => b.hasClass("is-on"));
  requestAnimationFrame(() => {
    const last = segLast.get(key);
    if (last) {
      hl.style.transition = "none";
      put(last);
      void hl.offsetWidth;
      hl.style.transition = "";
      place(on(), true);
    } else place(on(), false);
  });
  slid.set(seg, { hl, place: () => place(on(), false) });
  new MutationObserver(() => {
    if (!seg.hasClass("is-drag")) place(on(), true);
  }).observe(seg, { subtree: true, attributes: true, attributeFilter: ["class"] });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => place(on(), false)).observe(seg);
  let at = null, moved = false, startX = 0, quietUntil = 0;
  const under = (x) => buttons().find((b) => {
    const r = b.getBoundingClientRect();
    return x >= r.left && x < r.right;
  }) ?? null;
  seg.addEventListener("pointerdown", (e) => {
    at = under(e.clientX);
    moved = false;
    startX = e.clientX;
  });
  seg.addEventListener("pointermove", (e) => {
    if (!at || !moved && Math.abs(e.clientX - startX) < 8) return;
    if (!moved) {
      moved = true;
      seg.addClass("is-drag");
      try {
        seg.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    const b = under(e.clientX);
    if (b && b !== at) {
      at = b;
      buttons().forEach((x) => x.toggleClass("is-pv", x === b));
      place(b, true);
      haptic();
    }
  });
  const end = (e) => {
    const target = moved ? at : null;
    at = null;
    if (!moved) return;
    moved = false;
    seg.removeClass("is-drag");
    buttons().forEach((x) => x.removeClass("is-pv"));
    if (target && !target.hasClass("is-on")) {
      if (e.type === "pointerup") haptic();
      target.click();
    } else place(on(), true);
    quietUntil = Date.now() + 400;
  };
  seg.addEventListener("pointerup", end);
  seg.addEventListener("pointercancel", end);
  for (const ev of ["touchstart", "touchmove"]) seg.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  seg.addEventListener("touchmove", (e) => {
    if (moved && e.cancelable) e.preventDefault();
  }, { passive: false });
  seg.addEventListener("click", (e) => {
    if (e.isTrusted && Date.now() < quietUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, { capture: true });
}

// src/settings.ts
var import_obsidian3 = require("obsidian");

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
  // where the notes live: the only place the plugin names these folders (tools/vault_paths.py does the same for the scripts)
  championFolder: "\u82F1\u96C4",
  itemFolder: "\u9053\u5177",
  guideFolder: "\u65B0\u624B\u5165\u9580",
  augmentFolder: "\u5F37\u5316",
  patchFolder: "\u7248\u672C\u66F4\u65B0",
  openOnStartup: import_obsidian3.Platform.isMobile,
  read: [],
  roster: []
};
var MnSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl: c } = this;
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();
    c.empty();
    new import_obsidian3.Setting(c).setName("Mode").setDesc("What the app shows. Rift is planned.").addDropdown((d) => {
      for (const id of MODE_ORDER) d.addOption(id, MODES[id].label + (MODES[id].enabled ? "" : " (coming soon)"));
      d.setValue(s.mode).onChange(async (v) => {
        s.mode = v;
        await save();
      });
    });
    new import_obsidian3.Setting(c).setName("Color theme").setDesc("Colors of the app screen. Follows Obsidian's light / dark.").addDropdown((d) => {
      for (const t of THEMES) d.addOption(t.id, t.name);
      d.setValue(s.theme).onChange(async (v) => {
        s.theme = v;
        await save();
      });
    });
    const folder = (name, desc2, key) => new import_obsidian3.Setting(c).setName(name).setDesc(desc2).addText((x) => x.setValue(s[key]).onChange(async (v) => {
      s[key] = v.trim() || DEFAULTS[key];
      await save();
    }));
    folder("Champion folder", "Notes made by tools/fetch_data.py", "championFolder");
    folder("Item folder", "Notes made by tools/fetch_data.py", "itemFolder");
    folder("Augment folder", "Notes made by tools/fetch_augments.py", "augmentFolder");
    folder("Patch notes folder", "Our own patch notes (frontmatter: patch, date, title, summary)", "patchFolder");
    folder("Guide folder", "Beginner guide notes", "guideFolder");
    new import_obsidian3.Setting(c).setName("Open on startup").setDesc("Show the app when Obsidian starts (on by default on a phone).").addToggle((x) => x.setValue(s.openOnStartup).onChange(async (v) => {
      s.openOnStartup = v;
      await save();
    }));
    const hap = new import_obsidian3.Setting(c).setName("Test haptic").setDesc("Tap: the phone should tick once.");
    hap.addButton((b) => b.setButtonText("Tick").onClick(() => {
      const how = haptic();
      hap.setDesc({ capacitor: "Used: Obsidian's haptics.", vibrate: "Used: web vibration.", switch: "Used: the iOS 18 switch tick. Felt nothing? Then Obsidian has no haptics here.", "": "No haptics found on this device." }[how] ?? how);
    }));
  }
};

// src/view.ts
var import_obsidian9 = require("obsidian");

// src/pages/augments.ts
var RARITIES = ["\u9280", "\u91D1", "\u7A1C\u93E1"];
var RARITY_COLOR = { \u9280: "var(--text-muted)", \u91D1: "var(--color-yellow)", \u7A1C\u93E1: "var(--color-purple)" };
var RARITY_RANK = { \u7A1C\u93E1: 0, \u91D1: 1, \u9280: 2 };
var SORTS = [["rarity", "\u7A00\u6709\u5EA6"], ["name", "\u540D\u7A31"], ["new", "\u6700\u65B0"]];
var patchNo2 = (p) => {
  const m = /(\d+)\.(\d+)/.exec(p);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
};
var SORT_DIR = { rarity: -1, name: 1, new: -1 };
var sortBy = "rarity";
var sortDir = -1;
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
  const sortHost = h(el, "div", "mn-aug-sort");
  const chips = h(el, "div", "mn-chips mn-aug-rar");
  const list2 = h(el, "div", "mn-blk");
  const links = group(el, "Tier lists (other sites)");
  row(links, { icon: "external-link", title: "OP.GG Mayhem tier list", chevron: true, onTap: () => window.open("https://op.gg/lol/modes/aram-mayhem") });
  row(links, { icon: "external-link", title: "U.GG augment tier list", chevron: true, onTap: () => window.open("https://u.gg/lol/aram-mayhem-augment-tier-list") });
  const draw = () => {
    list2.empty();
    const q = query.trim().toLowerCase();
    const hits = all.filter((a) => (!rarity || a.rarity === rarity) && (!q || a.name.toLowerCase().includes(q)));
    const byName = (a, b) => a.name.localeCompare(b.name, "zh-Hant");
    const d = sortDir;
    if (sortBy === "rarity") hits.sort((a, b) => d * ((RARITY_RANK[b.rarity] ?? 9) - (RARITY_RANK[a.rarity] ?? 9)) || byName(a, b));
    else if (sortBy === "new") hits.sort((a, b) => d * (patchNo2(addedIn.get(a.id) ?? "") - patchNo2(addedIn.get(b.id) ?? "")) || byName(a, b));
    else hits.sort((a, b) => d * byName(a, b));
    const g = group(list2);
    for (const a of hits) {
      const isNew = !!latest && addedIn.get(a.id) === latest;
      row(g, { image: a.icon, rarity: a.rarity, title: a.name, sub: a.effect || void 0, value: isNew ? `${a.rarity} \xB7 \u65B0` : a.rarity, chevron: true, clamp: true, onTap: () => ctx.openAugment(a.id) });
    }
    if (!hits.length) empty(list2, { icon: "search-x", title: "No match" });
    blockLoad(list2);
  };
  const drawSort = () => {
    sortHost.empty();
    const arrow = (id) => sortBy !== id ? "" : sortDir === 1 ? " \u2191" : " \u2193";
    segmented(sortHost, SORTS.map(([id, l]) => [id, l + arrow(id)]), sortBy, (id) => {
      if (id === sortBy) sortDir = sortDir === 1 ? -1 : 1;
      else {
        sortBy = id;
        sortDir = SORT_DIR[id] ?? 1;
      }
      drawSort();
      draw();
    }, "is-sm mn-sortbar");
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
  drawSort();
  drawChips();
  draw();
  return { title: "Augments", el, ready: null };
}

// src/pages/profile.ts
var import_obsidian4 = require("obsidian");
var SKILL_STEPS = [0, 4, 7, 9, 10];
var count = (c, ...tags2) => c.skills.filter((s) => s.key !== "P" && tags2.some((t) => s.tags.includes(t))).length;
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
  const W = 300, H = 204, cx = W / 2, cy = 102, R = 66, LABEL = 22, n = axes.length;
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
var TAGS = [
  // 傷害
  { tag: "\u5F37\u5316\u666E\u653B", color: "var(--mn-aa)", icon: "sword", en: "Empowered attack", abbr: "AA+", what: "\u6280\u80FD\u8B93\u4E0B\u4E00\u6B21(\u6216\u63A5\u4E0B\u4F86\u5E7E\u6B21)\u666E\u653B\u66F4\u5F37,\u4F8B\u5982\u984D\u5916\u50B7\u5BB3" },
  { tag: "\u653B\u64CA\u7279\u6548", color: "var(--mn-onhit)", icon: "crosshair", en: "On-hit", abbr: "On-hit", what: "\u6280\u80FD\u6703\u89F8\u767C\u653B\u64CA\u7279\u6548,\u9069\u5408\u51FA\u653B\u64CA\u7279\u6548\u88DD\u5099(\u4EBA\u5DE5\u6A19\u8A3B)" },
  {
    tag: "%\u751F\u547D\u50B7\u5BB3",
    color: "var(--color-red)",
    icon: "heart-crack",
    // not "percent": the name already starts with %
    en: "% health damage",
    abbr: "%HP",
    what: "\u50B7\u5BB3\u662F\u76EE\u6A19\u751F\u547D\u7684\u4E00\u500B\u767E\u5206\u6BD4(\u6700\u5927 / \u76EE\u524D / \u5DF2\u640D\u5931),\u5C0D\u8840\u539A\u7684\u6575\u4EBA\u4E5F\u6709\u7528(\u5F9E\u904A\u6232\u5167\u7684\u6280\u80FD\u8AAA\u660E\u8B80\u51FA,\u6709\u4E9B\u6280\u80FD\u7528\u7684\u53EF\u80FD\u662F\u81EA\u5DF1\u7684\u751F\u547D)"
  },
  { tag: "\u65AC\u6BBA", color: "var(--mn-exec)", icon: "skull", en: "Execute", abbr: "Execute", what: "\u5C0D\u751F\u547D\u503C\u4F4E\u7684\u6575\u4EBA\u9020\u6210\u66F4\u9AD8\u50B7\u5BB3\u6216\u76F4\u63A5\u64CA\u6BBA" },
  // 控制
  { tag: "\u63A7\u5834", color: "var(--mn-cc)", icon: "lock", en: "Crowd Control", abbr: "CC", what: "\u6688\u7729\u3001\u64CA\u98DB\u3001\u5B9A\u8EAB\u3001\u6C89\u9ED8\u3001\u6050\u61FC\u3001\u9B45\u60D1\u7B49,\u8B93\u6575\u4EBA\u52D5\u4E0D\u4E86\u6216\u4E0D\u80FD\u653E\u6280\u80FD" },
  { tag: "\u7DE9\u901F", color: "var(--mn-slow)", icon: "snowflake", en: "Slow", abbr: "Slow", what: "\u964D\u4F4E\u6575\u4EBA\u7684\u79FB\u52D5\u901F\u5EA6" },
  { tag: "\u6E1B\u76CA", color: "var(--mn-weak)", icon: "trending-down", en: "Debuff", abbr: "Debuff", what: "\u81F4\u76F2\u3001\u8FD1\u8996\u3001\u91CD\u50B7\u3001\u964D\u4F4E\u8B77\u7532 / \u9B54\u6297 / \u653B\u901F,\u8B93\u6575\u4EBA\u8B8A\u5F31\u4F46\u9084\u80FD\u884C\u52D5" },
  // 移動
  { tag: "\u4F4D\u79FB", color: "var(--mn-dash)", icon: "arrow-big-right-dash", en: "Dash / Blink", abbr: "Dash", what: "\u885D\u523A\u3001\u9583\u73FE\u3001\u77AC\u6B65\u3001\u8DF3\u8E8D\u7B49,\u8B93\u81EA\u5DF1\u5FEB\u901F\u79FB\u52D5" },
  { tag: "\u52A0\u901F", color: "var(--mn-haste)", icon: "wind", en: "Movement speed", abbr: "MS", what: "\u63D0\u9AD8\u81EA\u5DF1\u6216\u968A\u53CB\u7684\u79FB\u52D5\u901F\u5EA6" },
  { tag: "\u96B1\u8EAB", color: "var(--mn-stealth)", icon: "eye-off", en: "Stealth / Camouflage", abbr: "Stealth", what: "\u96B1\u5F62\u6216\u507D\u88DD,\u8B93\u6575\u4EBA\u770B\u4E0D\u5230\u4F60" },
  // 生存
  { tag: "\u6CBB\u7642", color: "var(--mn-heal)", icon: "heart-pulse", en: "Heal", abbr: "Heal", what: "\u56DE\u5FA9\u81EA\u5DF1\u6216\u968A\u53CB\u7684\u751F\u547D" },
  { tag: "\u8B77\u76FE", color: "var(--mn-shield)", icon: "shield-plus", en: "Shield", abbr: "Shield", what: "\u7D66\u81EA\u5DF1\u6216\u968A\u53CB\u4E00\u5C64\u53EF\u5438\u6536\u50B7\u5BB3\u7684\u8B77\u76FE" },
  { tag: "\u5438\u8840", color: "var(--mn-ls)", icon: "syringe", en: "Lifesteal / Omnivamp", abbr: "LS", what: "\u9020\u6210\u50B7\u5BB3\u6642\u56DE\u5FA9\u81EA\u5DF1\u7684\u751F\u547D" },
  { tag: "\u514D\u50B7", color: "var(--mn-guard)", icon: "shield-half", en: "Damage reduction / Untargetable", abbr: "DR", what: "\u6E1B\u5C11\u53D7\u5230\u7684\u50B7\u5BB3,\u6216\u77ED\u6642\u9593\u7121\u6CD5\u88AB\u9078\u53D6 / \u7121\u6575" },
  // 團隊
  { tag: "\u968A\u53CB\u589E\u76CA", color: "var(--mn-team)", icon: "users", en: "Helps allies", abbr: "Ally", what: "\u6CBB\u7642\u3001\u8B77\u76FE\u6216\u52A0\u901F\u4E5F\u80FD\u7D66\u968A\u53CB" }
];
var TAG_GROUPS = [
  ["\u50B7\u5BB3", ["\u5F37\u5316\u666E\u653B", "\u653B\u64CA\u7279\u6548", "%\u751F\u547D\u50B7\u5BB3", "\u65AC\u6BBA"]],
  ["\u63A7\u5236", ["\u63A7\u5834", "\u7DE9\u901F", "\u6E1B\u76CA"]],
  ["\u79FB\u52D5", ["\u4F4D\u79FB", "\u52A0\u901F", "\u96B1\u8EAB"]],
  ["\u751F\u5B58", ["\u6CBB\u7642", "\u8B77\u76FE", "\u5438\u8840", "\u514D\u50B7"]],
  ["\u5718\u968A", ["\u968A\u53CB\u589E\u76CA"]]
];
var TAG = new Map(TAGS.map((t) => [t.tag, t]));
var tagInfo = (tag) => TAG.get(tag);
var TagLegend = class extends import_obsidian4.Modal {
  constructor(app) {
    super(app);
  }
  onOpen() {
    this.titleEl.setText("\u5716\u793A\u8AAA\u660E");
    const table = h(this.contentEl, "div", "mn-lg");
    const app = document.querySelector(".mn-app");
    const css = app ? getComputedStyle(app) : null;
    const resolve = (v) => v.replace(/var\((--[\w-]+)\)/, (_m, name) => css?.getPropertyValue(name).trim() || "currentColor");
    for (const [group2, tags2] of TAG_GROUPS) {
      h(table, "div", "mn-lg-g", group2);
      for (const a of TAGS.filter((x) => tags2.includes(x.tag))) {
        const color = resolve(a.color);
        const r = h(table, "div", "mn-lg-r");
        const ic = h(r, "span", "mn-lg-ic");
        ic.style.setProperty("--p", color);
        icon(ic, a.icon);
        const name = h(r, "span", "mn-lg-n", a.tag);
        name.style.color = color;
        h(name, "div", "mn-lg-w", a.what);
        h(r, "span", "mn-lg-e", `${a.en} \xB7 ${a.abbr}`);
      }
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
function iconFilter(parent, label, iconName, color, on, onTap) {
  const el = h(parent, "button", "mn-ftg" + (on ? " is-yes" : ""));
  el.setAttribute("aria-label", label);
  el.style.setProperty("--p", color);
  icon(el, iconName);
  holdTip(el, label);
  el.addEventListener("click", (e) => {
    e.preventDefault();
    onTap();
  });
  return el;
}
function tagFilter(parent, tag, on, onTap) {
  const t = TAG.get(tag);
  return iconFilter(parent, tag, t?.icon ?? "circle", t?.color ?? "var(--mn-text)", on, onTap);
}
var keysOf = (c, ...tags2) => c.skills.filter((s) => tags2.some((t) => s.tags.includes(t))).map((s) => s.key).join(" \xB7 ");
var hasTag = (c, tag) => c.features.includes(tag);
var reachOf = (c) => c.archetypes.find((a) => a === "\u8FD1\u6230" || a === "\u4E2D\u7A0B" || a === "\u9060\u7A0B") ?? "";
function tagChip(parent, c, t) {
  const lit = hasTag(c, t.tag);
  const el = h(parent, "button", "mn-tg" + (lit ? " is-on" : ""));
  el.style.setProperty("--p", t.color);
  icon(el, t.icon);
  h(el, "span", "", t.tag);
  const keys = lit ? keysOf(c, t.tag) : "";
  if (keys) h(el, "span", "mn-tg-k", keys);
  holdTip(el, `${t.tag} \xB7 ${t.abbr}`);
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  return el;
}
function tagRow(parent, c, only, litOnly = false) {
  const row2 = h(parent, "div", "mn-tgs");
  for (const t of TAGS) if ((!only || only.includes(t.tag)) && (!litOnly || hasTag(c, t.tag))) tagChip(row2, c, t);
  return row2;
}
var KINDS = ["\u7269\u7406", "\u9B54\u6CD5", "\u771F\u5BE6"];
var lastNum = (s) => parseFloat(s.split("/").pop() ?? "") || 0;
function damageLines(c) {
  const out = [];
  for (const s of c.skills) for (const kind of KINDS) {
    const rows = s.rows.filter((r) => r.label.startsWith(`${kind}\u50B7\u5BB3`));
    if (!rows.length && s.key === "P" && s.desc.includes(`${kind}\u50B7\u5BB3`)) {
      out.push({ key: s.key, name: s.name, kind, first: 0, base: 0, ad: 0, ap: 0, onHit: s.tags.includes("\u653B\u64CA\u7279\u6548") });
      continue;
    }
    if (!rows.length) continue;
    const best = rows.reduce((x, y) => lastNum(y.vals[y.vals.length - 1]) > lastNum(x.vals[x.vals.length - 1]) ? y : x);
    let ad = 0, ap = 0;
    for (const m of best.note.matchAll(/\+([\d./]+)%\s*(額外物理攻擊|物理攻擊|魔法攻擊)/g)) {
      if (m[2] === "\u9B54\u6CD5\u653B\u64CA") ap += lastNum(m[1]);
      else ad += lastNum(m[1]);
    }
    out.push({ key: s.key, name: s.name, kind, first: lastNum(best.vals[0]), base: lastNum(best.vals[best.vals.length - 1]), ad, ap, onHit: s.tags.includes("\u653B\u64CA\u7279\u6548") });
  }
  return out;
}
function factsStrip(parent, c) {
  const strip2 = h(parent, "div", "mn-fs");
  const dmg = h(strip2, "div", "mn-fs-dmg");
  h(dmg, "div", "mn-fs-l", "\u6280\u80FD\u50B7\u5BB3");
  const lines = damageLines(c);
  if (!lines.length) h(dmg, "div", "mn-fs-hint", "\u6C92\u6709\u50B7\u5BB3\u6280\u80FD");
  const ad = lines.reduce((n, d) => n + d.ad, 0), ap = lines.reduce((n, d) => n + d.ap, 0);
  if (ad + ap > 0) {
    const ends = h(dmg, "div", "mn-fs-row mn-dl-foot");
    const l = h(ends, "span", "mn-dl-sum", ad ? `\u7269\u653B ${ad}%` : "");
    l.style.color = DAMAGE_COLOR["\u7269\u7406"];
    const r = h(ends, "span", "mn-dl-sum", ap ? `\u9B54\u653B ${ap}%` : "");
    r.style.color = DAMAGE_COLOR["\u9B54\u6CD5"];
    const bar = h(dmg, "div", "mn-stack");
    for (const [v2, k] of [[ad, "\u7269\u7406"], [ap, "\u9B54\u6CD5"]]) if (v2) {
      const seg = h(bar, "i");
      seg.style.flex = String(v2);
      seg.style.background = DAMAGE_COLOR[k];
    }
  }
  const list2 = h(dmg, "div", "mn-dl");
  if (lines.length) for (const t of ["", "", "\u985E\u578B", "\u7269\u653B", "\u9B54\u653B", "\u57FA\u790E\u50B7\u5BB3"]) h(list2, "span", "mn-dl-h", t);
  const num2 = (n) => Math.round(n * 10) / 10;
  for (const d of lines) {
    h(list2, "span", "mn-dl-key", d.key);
    const name = h(list2, "span", "mn-dl-name", d.name);
    const notes = [d.key === "P" && !d.base ? "\u6578\u503C\u672A\u6536\u9304" : "", d.onHit ? "\u89F8\u767C\u653B\u64CA\u7279\u6548" : ""].filter(Boolean);
    if (notes.length) {
      const sub = h(name, "span", "mn-dl-sub");
      for (const n of notes) {
        const x = h(sub, "span", "", n);
        if (n === "\u89F8\u767C\u653B\u64CA\u7279\u6548") x.style.color = "var(--mn-onhit)";
      }
    }
    const kind = h(list2, "span", "mn-dl-kind", d.kind);
    kind.style.color = DAMAGE_COLOR[d.kind] ?? "inherit";
    h(list2, "span", "mn-dl-pct", d.ad ? `${d.ad}%` : "\u2014").style.color = d.ad ? DAMAGE_COLOR["\u7269\u7406"] : "";
    h(list2, "span", "mn-dl-pct", d.ap ? `${d.ap}%` : "\u2014").style.color = d.ap ? DAMAGE_COLOR["\u9B54\u6CD5"] : "";
    h(list2, "span", "mn-dl-base", !d.base ? "\u2014" : d.first && d.first !== d.base ? `${num2(d.first)}\u2013${num2(d.base)}` : `${num2(d.base)}`);
  }
  const pair = h(strip2, "div", "mn-fs-pair");
  const cell = (label) => {
    const d = h(pair, "div", "mn-fs-c");
    h(d, "span", "mn-fs-l", label);
    return h(d, "div", "mn-fs-r");
  };
  h(cell("\u8DDD\u96E2"), "div", "mn-fs-v", reachOf(c) || "\u2014");
  const v = h(cell("\u96E3\u5EA6"), "div", "mn-fs-v mn-fs-big", String(c.difficulty));
  h(v, "span", "mn-fs-of", " / 10");
}
function styleAxes(c) {
  const tough = c.defense >= 7 ? "\u5F88\u786C" : c.defense >= 4 ? "\u666E\u901A" : "\u8106";
  return [
    { label: "\u8F38\u51FA", icon: "zap", color: DAMAGE_COLOR[c.damageType] ?? "var(--mn-text)", value: Math.max(c.attack, c.magic), sub: c.damageType === "\u6DF7\u5408" ? "\u7269\u7406 + \u9B54\u6CD5" : `${c.damageType}\u70BA\u4E3B` },
    { label: "\u5766\u5EA6", icon: "shield", color: "var(--mn-tank)", value: c.defense, sub: tough },
    { label: "\u63A7\u5834", icon: "lock", color: "var(--mn-cc)", value: score(count(c, "\u63A7\u5834")), sub: keysOf(c, "\u63A7\u5834"), tag: "\u63A7\u5834" },
    { label: "\u4F4D\u79FB", icon: "arrow-big-right-dash", color: "var(--mn-dash)", value: score(count(c, "\u4F4D\u79FB")), sub: keysOf(c, "\u4F4D\u79FB"), tag: "\u4F4D\u79FB" },
    { label: "\u8F14\u52A9", icon: "heart-pulse", color: "var(--mn-heal)", value: score(count(c, "\u6CBB\u7642", "\u8B77\u76FE")), sub: keysOf(c, "\u6CBB\u7642", "\u8B77\u76FE"), tag: "\u6CBB\u7642" },
    { label: "\u5C04\u7A0B", icon: "target", color: "var(--mn-range)", value: Math.min(10, Math.round(c.range / 65)), sub: [reachOf(c), String(c.range)].filter(Boolean).join(" \xB7 ") }
  ];
}
var SW = 350;
var SH = 356;
var SCX = 175;
var SCY = 180;
var SR = 96;
var CHIP_R = 140;
function styleChart(parent, c) {
  const axes = styleAxes(c);
  const n = axes.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return [SCX + r * Math.cos(a), SCY + r * Math.sin(a)];
  };
  const poly = (r) => axes.map((_, i) => pt(i, r(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const val = (i) => SR * Math.max(0, Math.min(10, axes[i].value)) / 10;
  const color = axes[0].color;
  const wrap = h(parent, "div", "mn-sc");
  const root = svg(wrap, "svg", { viewBox: `0 0 ${SW} ${SH}`, "aria-hidden": "true" }, "mn-sc-svg");
  const id = `mn-grad-${++uid}`;
  const grad = svg(svg(root, "defs"), "linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  svg(grad, "stop", { offset: "0%", "stop-opacity": 0.55 }).setAttribute("style", `stop-color:${color}`);
  svg(grad, "stop", { offset: "100%", "stop-opacity": 0.12 }).setAttribute("style", `stop-color:${color}`);
  for (let k = 4; k >= 1; k--) svg(root, "polygon", { points: poly(() => SR * k / 4) }, k === 4 ? "mn-sc-ring is-outer" : "mn-sc-ring");
  axes.forEach((ax, i) => {
    const [x, y] = pt(i, SR);
    const line = svg(root, "line", { x1: SCX, y1: SCY, x2: x, y2: y }, "mn-sc-axis" + (ax.value > 0 ? " is-on" : ""));
    line.setAttribute("style", `--p:${ax.color}`);
  });
  const shape = svg(root, "polygon", { points: poly(val), fill: `url(#${id})` }, "mn-sc-shape");
  shape.setAttribute("style", `stroke:color-mix(in srgb, ${color} 55%, white)`);
  axes.forEach((ax, i) => {
    if (ax.value <= 0) return;
    const [x, y] = pt(i, val(i));
    svg(root, "circle", { cx: x, cy: y, r: 4.5 }, "mn-sc-dot").setAttribute("style", `fill:${ax.color}`);
  });
  axes.forEach((ax, i) => {
    const [x, y] = pt(i, CHIP_R);
    const on = ax.value > 0;
    const chip2 = h(wrap, "button", "mn-scc" + (on ? " is-on" : ""));
    chip2.style.left = `${x / SW * 100}%`;
    chip2.style.top = `${y / SH * 100}%`;
    chip2.style.setProperty("--p", ax.color);
    const top = h(chip2, "span", "mn-scc-t");
    icon(top, ax.icon);
    h(top, "span", "", ax.label);
    h(top, "b", "", String(ax.value));
    h(chip2, "span", "mn-scc-k", on && ax.sub ? ax.sub : "\u2014");
    const t = ax.tag ? TAG.get(ax.tag) : void 0;
    holdTip(chip2, t ? `${ax.label} \xB7 ${t.abbr}` : `${ax.label} ${ax.value} / 10`);
    chip2.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
}
var OFF_CHART = TAGS.map((x) => x.tag).filter((x) => !["\u63A7\u5834", "\u4F4D\u79FB", "\u6CBB\u7642", "\u8B77\u76FE"].includes(x));
function styleCard(parent, c, app) {
  const card = h(parent, "div", "mn-panel mn-style");
  const head2 = h(card, "div", "mn-style-h");
  h(head2, "span", "mn-style-t", "\u6230\u9B25\u98A8\u683C");
  const key = h(head2, "button", "mn-lg-btn");
  key.setAttribute("aria-label", "\u5716\u793A\u8AAA\u660E");
  icon(key, "info");
  if (app) key.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    new TagLegend(app).open();
  });
  styleChart(card, c);
  if (OFF_CHART.some((x) => hasTag(c, x))) tagRow(h(card, "div", "mn-style-f"), c, OFF_CHART, true);
}
function championProfile(parent, c, app) {
  factsStrip(parent, c);
  styleCard(parent, c, app);
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
  const stats2 = store.stats?.champions[c.id];
  const mine = c.builds.filter((b) => b.mode === mode);
  const meta = mine.filter((b) => b.kind === "meta");
  const alt = mine.filter((b) => b.kind === "alt");
  const synergy = mine.filter((b) => b.kind === "synergy");
  if (stats2 || meta.length) {
    section(body, "\u5E38\u7528");
    if (stats2) {
      const top = h(body, "div", "mn-chips");
      chip(top, `${stats2.games} \u5834`);
      chip(top, `\u52DD\u7387 ${pct(stats2.wins, stats2.games)}%`, { color: "var(--color-green)" });
      if (store.stats?.date) chip(top, store.stats.date);
      for (const s of stats2.sets.slice(0, TOP_SETS)) {
        const card2 = h(body, "div", "mn-set");
        itemRow(card2, c, ctx, s.items);
        h(card2, "div", "mn-set-m", `${s.games} \u5834 \xB7 \u52DD\u7387 ${pct(s.wins, s.games)}%`);
      }
      const card = h(body, "div", "mn-set");
      h(card, "div", "mn-set-t", "\u6700\u5E38\u51FA\u7684\u88DD\u5099");
      itemRow(card, c, ctx, stats2.items.slice(0, TOP_ITEMS).map((i) => i.id), stats2.items.slice(0, TOP_ITEMS).map((i) => `${pct(i.games, stats2.games)}%`));
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
  if (!stats2 && !mine.length) empty(body, { icon: "package-open", title: "No builds of ours yet", text: "Our own builds and ideas for this champion will appear here." });
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
      const head2 = h(panel, "div", "mn-ip-head");
      h(head2, "span", "mn-ip-name", item?.name ?? `#${id}`);
      if (item) h(head2, "span", "mn-ip-gold", `${item.goldTotal}`);
      if (item?.desc) h(panel, "p", "mn-sd-desc", item.desc);
      if (item) {
        const more = h(panel, "button", "mn-ip-more", "\u9053\u5177\u9801 \u203A");
        more.addEventListener("click", (e2) => {
          e2.preventDefault();
          ctx.openItem(item.id);
        });
      }
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
    const head2 = h(sec, "div", "mn-off-h");
    h(head2, "span", "mn-off-t", `Riot ${patch} \u7248\u672C\u516C\u544A`);
    const link = h(head2, "button", "mn-off-link", "\u5168\u6587 \u2197");
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
  const head2 = h(el, "button", "mn-chg-head");
  icon(head2, "history", "mn-chg-ic");
  h(head2, "span", "mn-chg-t", `Recent changes \xB7 ${official.length || patches.length} patch${(official.length || patches.length) > 1 ? "es" : ""}`);
  const caret = icon(head2, "chevron-down", "mn-chg-caret");
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
  head2.addEventListener("click", (e) => {
    e.preventDefault();
    set(!el.hasClass("is-open"));
  });
  return { el, open: () => set(true) };
}

// src/pages/skills.ts
var import_obsidian5 = require("obsidian");
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
    if (s.key === "P") h(strip2, "span", "mn-skill-sep");
    return box;
  });
  const show = (i) => {
    open = i;
    boxes.forEach((b, j) => b.toggleClass("is-on", j === i));
    detail.empty();
    detail.toggleClass("is-open", i >= 0);
    if (i < 0) return;
    const s = c.skills[i];
    const head2 = h(detail, "div", "mn-sd-head");
    h(head2, "span", "mn-sd-key", s.key);
    h(head2, "span", "mn-sd-name", s.name);
    const types = h(head2, "span", "mn-sd-types");
    for (const d of s.damage) chip(types, `${d}\u50B7\u5BB3`, { color: DAMAGE_COLOR[d] });
    if (s.tags.includes("\u653B\u64CA\u7279\u6548")) chip(types, "\u89F8\u767C\u653B\u64CA\u7279\u6548", { color: "var(--mn-onhit)" });
    const text = s.desc + s.upgrade;
    for (const [label, color, words] of EFFECT_WORDS) {
      const found = [...new Set(words.filter(([re]) => re.test(text)).map(([, name]) => name))];
      if (found.length) chip(types, `${label} \xB7 ${found.join("\u3001")}`, { color });
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
    const clipBox = h(detail, "div", "mn-sd-clipbox");
    const ph = h(clipBox, "div", "mn-sd-clipph");
    ph.style.backgroundImage = `url("${s.icon}")`;
    demo(clipBox, c, s, () => clipBox.remove());
    clipBox.querySelector("video")?.addEventListener("loadeddata", () => ph.remove(), { once: true });
    const reveal = () => {
      if (open !== i || !detail.isConnected) return;
      const view = detail.closest(".mn-scroll");
      const tall = view ? detail.offsetHeight > view.clientHeight - 80 : false;
      detail.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "end" });
    };
    if (!clipBox.querySelector("video")) {
      clipBox.remove();
      window.requestAnimationFrame(reveal);
      return;
    }
    const loaded = whenMediaLoaded([clipBox], CLIP_WAIT_MS);
    blockUntil(clipBox, loaded);
    window.requestAnimationFrame(reveal);
    void loaded.then(() => window.requestAnimationFrame(reveal));
  };
}
var DEMO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities";
var CLIP_WAIT_MS = 8e3;
var CLIP_STALL_MS = 5e3;
var clipAddress = (c, key) => {
  const k = String(c.key).padStart(4, "0");
  return `${DEMO_BASE}/${k}/ability_${k}_${/\d$/.test(key) ? key : `${key}1`}`;
};
var downloaded = /* @__PURE__ */ new Map();
var webmOnly = /* @__PURE__ */ new Set();
var downloading = /* @__PURE__ */ new Map();
function preloadClip(c, key) {
  if (!c.key) return Promise.resolve();
  const url = clipAddress(c, key);
  const have = downloading.get(url);
  if (have) return have;
  const job = (async () => {
    for (const ext of ["mp4", "webm"]) {
      try {
        const r = await (0, import_obsidian5.requestUrl)({ url: `${url}.${ext}`, throw: false });
        if (r.status === 200) {
          if (ext === "webm") webmOnly.add(url);
          downloaded.set(url, URL.createObjectURL(new Blob([r.arrayBuffer], { type: `video/${ext}` })));
          return;
        }
      } catch {
      }
    }
  })();
  downloading.set(url, job);
  return job;
}
function demo(parent, c, s, onFail) {
  if (!c.key) return;
  const url = clipAddress(c, s.key);
  const v = h(parent, "video", "mn-sd-video");
  v.muted = true;
  v.loop = true;
  v.autoplay = true;
  v.controls = false;
  v.preload = "auto";
  v.setAttribute("playsinline", "");
  v.setAttribute("disablepictureinpicture", "");
  v.setAttribute("disableremoteplayback", "");
  const fail = () => {
    v.remove();
    onFail?.();
  };
  const parts = s.seconds?.length ? s.seconds : void 0;
  if (parts) {
    let at = 0;
    v.loop = false;
    v.addEventListener("loadedmetadata", () => {
      v.currentTime = parts[0][0];
    });
    const guard = window.setInterval(() => {
      if (!v.isConnected) {
        window.clearInterval(guard);
        return;
      }
      if (v.currentTime >= parts[at][1] || v.ended) {
        at = (at + 1) % parts.length;
        v.currentTime = parts[at][0];
        if (v.paused) void v.play().catch(() => void 0);
      }
    }, 60);
  }
  const playLocal = (local2) => {
    v.replaceChildren();
    if (webmOnly.has(url)) v.dataset.heavy = "1";
    v.addEventListener("error", fail, { once: true });
    v.src = local2;
    v.load();
    void v.play().catch(() => void 0);
  };
  const local = downloaded.get(url);
  if (local) {
    playLocal(local);
    return;
  }
  v.addEventListener("loadeddata", () => {
    void v.play().catch(() => void 0);
  }, { once: true });
  let tried = false;
  const fallback = () => {
    if (tried) return;
    tried = true;
    if (!document.createElement("video").canPlayType("video/webm")) {
      fail();
      return;
    }
    void preloadClip(c, s.key).then(() => {
      const f = downloaded.get(url);
      if (!f) {
        fail();
        return;
      }
      playLocal(f);
      window.setTimeout(() => {
        if (v.isConnected && v.readyState < 2) fail();
      }, CLIP_STALL_MS);
    });
  };
  const mp4 = h(v, "source");
  mp4.src = `${url}.mp4`;
  mp4.type = "video/mp4";
  const webm = h(v, "source");
  webm.src = `${url}.webm`;
  webm.type = "video/webm";
  mp4.addEventListener("error", fallback);
  webm.addEventListener("error", fallback);
}
var EFFECT_WORDS = [
  ["\u63A7\u5834", "var(--mn-cc)", [
    [/暈眩|眩暈|擊暈/, "\u6688\u7729"],
    [/擊飛|擊倒/, "\u64CA\u98DB"],
    [/擊退/, "\u64CA\u9000"],
    [/定身|禁錮|束縛/, "\u5B9A\u8EAB"],
    [/沉默/, "\u6C89\u9ED8"],
    [/恐懼/, "\u6050\u61FC"],
    [/魅惑/, "\u9B45\u60D1"],
    [/嘲諷/, "\u5632\u8AF7"],
    [/睡眠/, "\u7761\u7720"],
    [/壓制/, "\u58D3\u5236"],
    [/變形/, "\u8B8A\u5F62"],
    [/牽引|拉向/, "\u62C9\u626F"]
  ]],
  ["\u6E1B\u76CA", "var(--mn-weak)", [
    [/致盲/, "\u81F4\u76F2"],
    [/近視|(降低|減少|縮小)[^。]{0,4}(視線|視野)/, "\u8FD1\u8996"],
    [/重傷/, "\u91CD\u50B7"],
    [/(降低|減少|削減)[^。]{0,8}(護甲|魔法防禦|魔抗|物理防禦)|破甲/, "\u964D\u9632"],
    [/(降低|減少|削減)[^。]{0,8}(攻速|攻擊速度)/, "\u964D\u653B\u901F"]
  ]]
];
var ROW_COLOR = [["\u9B54\u6CD5", DAMAGE_COLOR["\u9B54\u6CD5"]], ["\u7269\u7406", DAMAGE_COLOR["\u7269\u7406"]], ["\u771F\u5BE6", DAMAGE_COLOR["\u771F\u5BE6"]], ["\u6CBB\u7642", "var(--color-green)"], ["\u8B77\u76FE", "var(--color-cyan)"]];
function rankTable(parent, s, changes) {
  const rows = s.range ? [...s.rows, { label: "\u5C04\u7A0B", vals: s.range.split("/"), note: "" }] : s.rows;
  if (!rows.length) return;
  const ranks = Math.max(1, ...rows.map((r) => r.vals.length));
  const grid = h(parent, "div", "mn-rk");
  grid.style.setProperty("--r", String(ranks));
  if (ranks > 1) {
    h(grid, "div", "mn-rk-h");
    for (let i = 1; i <= ranks; i++) h(grid, "div", "mn-rk-h", s.levels[i - 1] ? `Lv${s.levels[i - 1]}` : String(i));
  }
  for (const r of rows) {
    const name = h(grid, "div", "mn-rk-l");
    const label = h(name, "span", "mn-rk-name", r.label);
    const color = ROW_COLOR.find(([k]) => r.label.startsWith(k))?.[1];
    if (color) label.style.color = color;
    if (r.note) {
      const note = h(name, "span", "mn-rk-note");
      for (const p of scalingParts(r.note)) h(note, "span", void 0, p.text).style.color = p.color;
    }
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
var REACH = ["\u8FD1\u6230", "\u4E2D\u7A0B", "\u9060\u7A0B"];
var SORTS2 = [["name", "\u540D\u7A31"], ["diff", "\u96E3\u5EA6"], ["range", "\u5C04\u7A0B"]];
var SORT_DIR2 = { name: 1, diff: 1, range: -1 };
var SEARCH_EXTRA = 8;
var F = { lanes: /* @__PURE__ */ new Set(), roles: /* @__PURE__ */ new Set(), dmg: "", feat: /* @__PURE__ */ new Map(), reach: "", sort: "name", dir: 1, open: false };
var activeFilters = () => F.roles.size + (F.dmg ? 1 : 0) + F.feat.size + (F.reach ? 1 : 0);
function matches(c, lanes) {
  if (F.lanes.size && !lanes.some((l) => F.lanes.has(l))) return false;
  if (F.roles.size && !c.roles.some((r) => F.roles.has(r))) return false;
  if (F.dmg && c.damageType !== F.dmg) return false;
  for (const [f, want] of F.feat) if (c.features.includes(f) !== (want === 1)) return false;
  return !F.reach || c.archetypes.includes(F.reach);
}
function sorted(list2) {
  const byName = (a, b) => a.name.localeCompare(b.name, "zh-Hant");
  if (F.sort === "diff") return [...list2].sort((a, b) => F.dir * (a.difficulty - b.difficulty) || byName(a, b));
  if (F.sort === "range") return [...list2].sort((a, b) => F.dir * (a.range - b.range) || byName(a, b));
  return F.dir === 1 ? list2 : [...list2].reverse();
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
  const searchRow = h(parent, "div", "mn-search-row");
  const box = h(searchRow, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "Search champions, augments, items";
  search.setAttribute("enterkeyhint", "search");
  const picked = ctx.plugin.settings.roster.filter((id) => store.champion(id)).length;
  const qk = h(searchRow, "button", "mn-qk-btn");
  qk.setAttribute("aria-label", "\u5927\u6DF7\u6230\u901F\u67E5");
  icon(qk, "scan-search");
  h(qk, "span", "", "\u901F\u67E5");
  if (picked) h(qk, "span", "mn-qk-n", String(picked));
  qk.addEventListener("click", (e) => {
    e.preventDefault();
    ctx.push({ key: "roster", title: "\u901F\u67E5" });
  });
  const filtersHost = h(parent, "div");
  const filters = h(filtersHost, "div", "mn-fgroup");
  const panel = h(parent, "div", "mn-fpanel");
  const count2 = h(parent, "div", "mn-count");
  const gridHost = h(parent, "div");
  const grid = h(gridHost, "div", "mn-grid");
  const extra = h(parent, "div");
  const draw = () => {
    grid.empty();
    extra.empty();
    const q = query.trim().toLowerCase();
    const hits = sorted(all.filter((c) => matches(c, store.lanes(c)) && (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))));
    count2.textContent = `${hits.length} / ${all.length}`;
    for (const c of hits) {
      const tile2 = h(grid, "button", "mn-tile");
      const im = h(tile2, "img");
      im.src = c.icon;
      im.alt = "";
      const rd = recent.get(c.name);
      if (rd) {
        const m = marker(rd);
        const b = h(tile2, "span", "mn-tile-b", m.mark);
        b.style.background = m.color;
      }
      const ms = store.masteryOf(c.id);
      if (ms && ms.level > 0) h(tile2, "span", "mn-tile-m" + (ms.level >= 10 ? " is-high" : ""), String(ms.level));
      h(tile2, "span", "mn-tile-n", c.name);
      tile2.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.openChampion(c.id);
      });
    }
    blockLoad(gridHost);
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
    const row2 = fgrid(filters, LANES.length + 1);
    const known = store.hasLanes();
    for (const l of LANES) {
      const chipEl = laneChip(row2, l, { on: F.lanes.has(l), onTap: () => {
        if (!known) {
          tip(chipEl, "\u9084\u6C92\u6709\u5206\u8DEF\u8CC7\u6599");
          return;
        }
        F.lanes.has(l) ? F.lanes.delete(l) : F.lanes.add(l);
        redraw();
      } });
    }
    const n = activeFilters();
    const fb = h(row2, "button", "mn-filterbtn" + (F.open ? " is-open" : "") + (n ? " has-n" : ""));
    fb.setAttribute("aria-label", "\u7BE9\u9078");
    icon(fb, "sliders-horizontal", "mn-filterbtn-ic");
    if (n) h(fb, "span", "mn-filterbtn-n", String(n));
    fb.addEventListener("click", (e) => {
      e.preventDefault();
      F.open = !F.open;
      drawFilters();
      drawPanel();
    });
    blockLoad(filtersHost);
  };
  const drawPanel = () => {
    panel.empty();
    panel.toggleClass("is-open", F.open);
    if (!F.open) return;
    const sect = (title, hint = "") => {
      const s = h(panel, "div", "mn-fp-s");
      const head2 = h(s, "div", "mn-fp-h");
      h(head2, "span", "mn-fp-t", title);
      if (hint) h(head2, "span", "mn-fp-hint", hint);
      return s;
    };
    const roleSect = sect("\u5B9A\u4F4D");
    if (activeFilters() || F.sort !== "name" || F.dir !== 1) {
      const clear = h(roleSect.querySelector(".mn-fp-h") ?? roleSect, "button", "mn-clear", "\u5168\u90E8\u6E05\u9664");
      clear.addEventListener("click", (e) => {
        e.preventDefault();
        F.roles.clear();
        F.dmg = "";
        F.feat.clear();
        F.reach = "";
        F.sort = "name";
        F.dir = 1;
        redraw();
      });
    }
    const roleRow = fgrid(roleSect, ROLES.length);
    for (const r of ROLES) roleChip(roleRow, r, { on: F.roles.has(r), onTap: () => {
      F.roles.has(r) ? F.roles.delete(r) : F.roles.add(r);
      redraw();
    } });
    const ab = sect("\u6280\u80FD");
    for (const [group2, tags2] of TAG_GROUPS) {
      const line = h(ab, "div", "mn-fcat");
      h(line, "span", "mn-fcat-l", group2);
      for (const f of tags2) {
        const on = F.feat.get(f) === 1;
        tagFilter(line, f, on, () => {
          if (on) F.feat.delete(f);
          else F.feat.set(f, 1);
          redraw();
        });
      }
    }
    const kindRow = fgrid(sect("\u50B7\u5BB3\u985E\u578B"), DAMAGES.length);
    for (const d of DAMAGES) iconFilter(kindRow, d, DAMAGE_ICON[d], DAMAGE_COLOR[d], F.dmg === d, () => {
      F.dmg = F.dmg === d ? "" : d;
      redraw();
    });
    segmented(sect("\u653B\u64CA\u8DDD\u96E2"), [["", "\u5168\u90E8"], ...REACH.map((r) => [r, r])], F.reach, (id) => {
      F.reach = id;
      redraw();
    }, "is-sm");
    const arrow = (id) => F.sort !== id ? "" : F.dir === 1 ? " \u2191" : " \u2193";
    segmented(sect("\u6392\u5E8F"), SORTS2.map(([id, l]) => [id, l + arrow(id)]), F.sort, (id) => {
      if (id === F.sort) F.dir = F.dir === 1 ? -1 : 1;
      else {
        F.sort = id;
        F.dir = SORT_DIR2[id] ?? 1;
      }
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
  return { title: "Champions", el, ready: null };
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
  const head2 = h(hero, "div", "mn-card-head");
  const im = h(head2, "img", "mn-card-img");
  im.src = c.icon;
  im.alt = "";
  const splash = bg.style.backgroundImage.slice(5, -2);
  blockUntil(hero, Promise.all([new Promise((r) => {
    const s = new Image();
    s.onload = s.onerror = () => r();
    s.src = splash;
  }), new Promise((r) => {
    if (im.complete) r();
    else {
      im.addEventListener("load", () => r(), { once: true });
      im.addEventListener("error", () => r(), { once: true });
    }
  })]).then(() => void 0), 200);
  const who = h(head2, "div", "mn-card-who");
  h(who, "h1", "mn-title", c.name);
  h(who, "div", "mn-card-sub", c.title);
  const tags2 = h(who, "div", "mn-chips");
  for (const r of c.roles) chip(tags2, r);
  if (c.tier) chip(tags2, `\u8A55\u50F9 ${c.tier}`, { color: "var(--color-green)" });
  const mastery = ctx.plugin.store.masteryOf(c.id);
  if (mastery && mastery.level > 0) chip(tags2, `\u719F\u7DF4\u5EA6 ${mastery.level} \xB7 ${mastery.points.toLocaleString("en-US")}`, { color: "var(--color-yellow)" });
  const now = ctx.plugin.store.currentChanges(c.id);
  const openChanges = () => {
    show("skills");
    block?.open();
    block?.el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const official = ctx.plugin.store.officialFor("champions", c.name)[0];
  if (badgeText(now)) chip(tags2, badgeText(now), { color: badgeColor(now), onTap: openChanges });
  else if (official) {
    const m = marker(entryDir(official.entry));
    chip(tags2, `${m.mark} ${official.patch}`, { color: m.color, onTap: openChanges });
  }
  championProfile(el, c, ctx.app);
  const mayhem = ctx.plugin.settings.mode === "mayhem";
  const tabs = [["skills", "Skills"], ["build", "Build"], ["augments", mayhem ? "Augments" : "Runes"], ["tips", "Tips"]];
  let block = null;
  const seg = h(el, "div", "mn-seg mn-seg-line");
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
  slideSeg(seg);
  show(lastSub.get(c.id) ?? "skills");
  return { title: "", el, ready: null };
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
var import_obsidian7 = require("obsidian");

// src/pages/deck.ts
var import_obsidian6 = require("obsidian");

// src/pages/handbook.ts
var SNIPPET = 46;
var MAX_PER_NOTE = 2;
var KEYWORDS = 8;
var GLOSSARY = "\u540D\u8A5E\u8868";
var TRIVIA_TILT = 10;
var TRIVIA_MS = 300;
var WARM_CLIPS = 3;
var WARM_DELAY_MS = 1500;
var coverUrl = (cover) => {
  const [a, b] = cover.trim().split(/\s+/);
  if (!a) return "";
  return a === "map" ? mapUrl(b) : `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(a)}_0.jpg`;
};
var mapUrl = (name) => {
  const n = name || ["habackground", "arambilgewater", "arambloom"][Math.floor(Math.random() * 3)];
  return `https://raw.communitydragon.org/latest/game/assets/ux/loadingscreen/${n}.png`;
};
var ARAM_ART = ["habackground", "arambilgewater", "arambloom"].map((n) => `https://raw.communitydragon.org/latest/game/assets/ux/loadingscreen/${n}.png`);
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
      return null;
    }
    const triviaHost = h(out, "div");
    const tipsReady = trivia(triviaHost);
    if (tipsReady) blockUntil(triviaHost, tipsReady);
    const decks = notes.filter((n) => n.layout === "deck");
    const block = (name, list2) => {
      if (!list2.length) return;
      const done = list2.filter((n) => read.has(n.file.path)).length;
      const next = list2.length % 2 ? list2.find((n) => !read.has(n.file.path)) : void 0;
      const head2 = h(out, "div", "mn-hb-head");
      h(head2, "span", "mn-hb-k", name);
      h(head2, "span", "mn-hb-n", done >= list2.length ? "\u5168\u90E8\u8B80\u5B8C\u4E86" : `${done} / ${list2.length}`);
      h(h(out, "div", "mn-hb-track"), "div", "mn-hb-fill").style.width = `${done / list2.length * 100}%`;
      const tile2 = (parent, n, big) => {
        const b = h(parent, "button", "mn-hb-tile" + (big ? " is-big" : "") + (read.has(n.file.path) ? " is-read" : ""));
        const url = coverUrl(n.cover);
        if (url) {
          const im = h(b, "img", "mn-hb-art");
          im.alt = "";
          im.onerror = () => im.remove();
          im.src = url;
        }
        const txt = h(b, "div", "mn-hb-ov");
        const num2 = String(list2.indexOf(n) + 1).padStart(2, "0");
        h(txt, "div", "mn-hb-kn", big ? `${done ? "\u7E7C\u7E8C" : "\u958B\u59CB"} \xB7 ${num2}` : read.has(n.file.path) ? `\u2713 ${num2}` : num2);
        h(txt, "div", "mn-hb-t", n.title);
        if (big && n.summary) h(txt, "div", "mn-hb-s", n.summary);
        b.addEventListener("click", (e) => {
          e.preventDefault();
          ctx.openNote(n.file.path);
        });
      };
      const tiles = h(out, "div");
      if (next) tile2(tiles, next, true);
      const rest = list2.filter((n) => n !== next);
      if (rest.length) {
        const grid = h(tiles, "div", "mn-hb-grid");
        rest.forEach((n) => tile2(grid, n, false));
      }
      blockLoad(tiles);
    };
    block("\u521D\u4F86\u4E4D\u5230", decks.filter((n) => n.level !== "advanced"));
    block("\u9AD8\u624B\u5FC5\u5099", decks.filter((n) => n.level === "advanced"));
    return tipsReady;
  };
  const trivia = (parent) => {
    const tips2 = store.loadingTips;
    if (!tips2.length) return null;
    const order = tips2.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let lastArt = "";
    const pickArt = () => {
      const choices = ARAM_ART.filter((u) => u !== lastArt);
      lastArt = choices[Math.floor(Math.random() * choices.length)];
      return lastArt;
    };
    const loadArt = (u) => new Promise((done) => {
      const im = new Image();
      im.onload = im.onerror = () => done();
      im.src = u;
    });
    const stack = h(parent, "div", "mn-trv-stack");
    const arts = [];
    const make = (i, z) => {
      const c = h(stack, "div", "mn-trv");
      const art = pickArt();
      c.style.backgroundImage = `url("${art}")`;
      arts.push(art);
      c.style.zIndex = String(z);
      h(c, "div", "mn-trv-tip", tips2[order[i % order.length]].text);
      return c;
    };
    let n = 0, top = make(0, 2), under = make(1, 1);
    let busy = false, pid = -1, x0 = 0, y0 = 0, t0 = 0, dx = 0, lastY = 0, mode = "";
    const scroller = () => stack.closest(".mn-scroll");
    for (const ev of ["touchstart", "touchmove"]) stack.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    const pose = (x) => {
      top.style.transform = `translateX(${x.toFixed(1)}px) rotate(${(x / Math.max(1, stack.clientWidth) * TRIVIA_TILT).toFixed(2)}deg)`;
    };
    stack.addEventListener("pointerdown", (e) => {
      if (busy || pid !== -1 || e.pointerType === "mouse" && e.button !== 0) return;
      pid = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      lastY = e.clientY;
      t0 = e.timeStamp;
      dx = 0;
      mode = "";
    });
    stack.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!mode) {
        if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return;
        mode = Math.abs(dx) > Math.abs(dy) * SWIPE.bias ? "x" : "y";
        stack.setPointerCapture(pid);
        if (mode === "x") top.style.transition = "none";
      }
      if (mode === "x") pose(dx);
      else {
        scroller()?.scrollBy(0, lastY - e.clientY);
      }
      lastY = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      const m = mode;
      mode = "";
      if (m !== "x") return;
      const w = stack.clientWidth, v = dx / Math.max(1, e.timeStamp - t0);
      const far = Math.abs(dx) > SWIPE.at * w || Math.abs(v) > SWIPE.flick && Math.abs(dx) > SWIPE.flickMin;
      top.style.transition = `transform ${TRIVIA_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${TRIVIA_MS}ms`;
      if (!far) {
        top.style.transform = "";
        return;
      }
      busy = true;
      const gone = top, dir = dx < 0 ? -1 : 1;
      gone.style.transform = `translateX(${dir * w * 1.3}px) rotate(${dir * TRIVIA_TILT * 1.2}deg)`;
      window.setTimeout(() => {
        gone.remove();
        top = under;
        top.style.zIndex = "2";
        n += 1;
        under = make(n + 1, 1);
        void loadArt(arts[arts.length - 1]);
        busy = false;
      }, TRIVIA_MS);
    };
    stack.addEventListener("pointerup", end);
    stack.addEventListener("pointercancel", end);
    return Promise.all(arts.slice(0, 2).map(loadArt)).then(() => void 0);
  };
  const keywords = async () => {
    const g = notes.find((n) => n.title === GLOSSARY);
    if (!g) return;
    const spacer = h(chips, "button", "mn-key", "AD");
    spacer.style.visibility = "hidden";
    const terms = ((await load()).get(g.file.path) ?? []).map((l) => l.split(/[:：]/)[0].trim()).filter((t) => t && t.length <= 8).slice(0, KEYWORDS);
    spacer.remove();
    for (const t of terms) {
      const b = h(chips, "button", "mn-key", t.replace("\uFF08", " (").replace("\uFF09", ")").trim());
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
    if (!q) void home();
    else void results(q);
  });
  const warm = () => {
    if (navigator.connection?.saveData) return;
    const decks = notes.filter((n) => n.layout === "deck");
    const next = [decks.filter((n) => n.level !== "advanced"), decks.filter((n) => n.level === "advanced")].flatMap((list2) => list2.find((n) => !read.has(n.file.path)) ?? []);
    void (async () => {
      for (const n of next) {
        const md = await ctx.app.vault.cachedRead(n.file);
        const clips = parseSlides(md).slice(0, WARM_CLIPS).flatMap((s) => {
          const [kind, id, key] = s.visual.split(/\s+/);
          const c = id ? store.champion(id) : void 0;
          return (kind === "video" || kind === "clip") && c ? [{ c, key: key ?? "Q" }] : [];
        });
        for (const { c, key } of clips) await preloadClip(c, key);
      }
    })();
  };
  window.setTimeout(warm, WARM_DELAY_MS);
  home();
  void keywords();
  return { title: "Handbook", el, ready: null };
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

// src/pages/pile.ts
var PULL = 0.6;
var GO_AT = 130;
var TILT = 12;
var GONE = -1.2;
var FAN = [0, 2.6, -2.2, -2.2];
var STEP_Y = 6;
var SETTLE_MS = 280;
function cardPile(pager, sec, o) {
  const count2 = sec.length;
  let cur = 0;
  const right = [];
  const pose = (el, u, toRight = false) => {
    const w = pager.clientWidth;
    let x = 0, y = 0, deg = 0, op = "";
    if (u < 0) {
      const s = toRight ? -1 : 1;
      x = s * u * w;
      deg = s * u * TILT;
    } else {
      const k = Math.min(FAN.length - 1, Math.floor(u)), a = FAN[k], b = FAN[Math.min(FAN.length - 1, k + 1)];
      deg = a + (b - a) * (u - k);
      y = Math.min(u, 2) * STEP_Y;
      if (u > 2) op = String(Math.max(0, 3 - u));
    }
    el.style.transform = `translateX(${x.toFixed(1)}px) translateY(${y.toFixed(1)}px) rotate(${deg.toFixed(2)}deg)`;
    el.style.setProperty("--sheen", `${(30 - Math.min(u, 0) * 70).toFixed(0)}%`);
    el.style.opacity = op;
  };
  let busy = false, leaving = false, settleT = 0;
  const layout = (animate) => {
    if (animate) {
      busy = true;
      sec.forEach((c) => c.addClass("is-settle"));
      window.clearTimeout(settleT);
      settleT = window.setTimeout(() => {
        sec.forEach((c) => c.removeClass("is-settle"));
        busy = false;
      }, SETTLE_MS);
    }
    sec.forEach((c, i) => {
      pose(c, i < cur ? GONE : i - cur, !!right[i]);
      c.style.zIndex = String(i < cur ? 100 + i : count2 - i);
    });
    o.onLayout?.(cur);
  };
  const decide = (like) => {
    if (!o.judge || cur >= count2 || leaving) return;
    right[cur] = like;
    o.onJudge?.(cur, like);
    o.onDrag?.(0, pager.clientWidth);
    cur++;
    haptic();
    layout(true);
    if (cur >= count2) {
      leaving = true;
      window.setTimeout(() => o.onEnd?.(), SETTLE_MS);
    }
  };
  const lastIdx = count2 - 1;
  let x0 = 0, y0 = 0, t0 = 0, pid = -1, dx = 0, lastY = 0, mode = "", armed = false;
  let scroller = null;
  const drag = () => {
    const w = pager.clientWidth, top = sec[cur];
    if (!top) return;
    if (o.judge) {
      pose(top, -Math.abs(dx) / w, dx > 0);
      const p = Math.min(1, Math.abs(dx) / w / 0.8);
      for (let i = cur + 1; i < count2; i++) pose(sec[i], i - cur - p);
      o.onDrag?.(dx, w);
      return;
    }
    if (dx < 0) {
      if (cur === lastIdx) {
        const move = dx * PULL;
        top.style.transform = `translateX(${move.toFixed(1)}px) translateY(0px) rotate(${(move / GO_AT * TILT).toFixed(2)}deg)`;
        if (o.last) {
          const ready = o.last.move(-move);
          if (ready !== armed) {
            armed = ready;
            if (ready) haptic();
          }
        }
        return;
      }
      pose(top, dx / w);
      const p = Math.min(1, -dx / w / 0.8);
      for (let i = cur + 1; i < count2; i++) pose(sec[i], i - cur - p);
    } else {
      if (cur === 0) {
        top.style.transform = `translateX(${(dx * 0.2).toFixed(1)}px) translateY(0px) rotate(${(dx * 0.2 / w * TILT).toFixed(2)}deg)`;
        return;
      }
      o.last?.reset();
      armed = false;
      pose(sec[cur - 1], Math.min(0, GONE + dx / w));
      const p = Math.min(1, dx / w / 0.8);
      for (let i = cur; i < count2; i++) pose(sec[i], i - cur + p);
    }
  };
  pager.addEventListener("pointerdown", (e) => {
    if (leaving || pid !== -1 || cur >= count2 || e.pointerType === "mouse" && e.button !== 0) return;
    if (busy) {
      window.clearTimeout(settleT);
      sec.forEach((c) => c.removeClass("is-settle"));
      busy = false;
      layout(false);
    }
    x0 = e.clientX;
    y0 = e.clientY;
    lastY = e.clientY;
    t0 = e.timeStamp;
    pid = e.pointerId;
    mode = "";
    dx = 0;
    scroller = o.scroll ? e.target.closest(o.scroll) : null;
  });
  pager.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (!mode) {
      if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return;
      mode = Math.abs(dx) > Math.abs(dy) * SWIPE.bias ? "x" : "y";
      pager.setPointerCapture(pid);
      if (mode === "x") {
        pager.addClass("is-drag");
        sec.forEach((c) => c.removeClass("is-settle"));
        if (!o.judge && cur === lastIdx && dx < 0) {
          const card = sec[cur].firstElementChild;
          card?.removeClass("is-shiver");
          void card?.offsetWidth;
          card?.addClass("is-shiver");
          haptic();
        }
      }
    }
    if (mode === "x") drag();
    else if (scroller) scroller.scrollTop += lastY - e.clientY;
    lastY = e.clientY;
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    const m = mode;
    mode = "";
    pager.removeClass("is-drag");
    if (m !== "x") return;
    sec[cur]?.firstElementChild?.removeClass("is-shiver");
    const w = pager.clientWidth, v = dx / Math.max(1, e.timeStamp - t0);
    const far = Math.abs(dx) > SWIPE.at * w || Math.abs(v) > SWIPE.flick && Math.abs(dx) > SWIPE.flickMin;
    if (o.judge) {
      if (far) {
        decide(dx > 0);
        return;
      }
      o.onDrag?.(0, w);
      layout(true);
      return;
    }
    if (dx < 0 && far && cur < lastIdx) cur++;
    else if (dx > 0 && far && cur > 0) cur--;
    else if (dx < 0 && cur === lastIdx && armed && o.last) {
      busy = leaving = true;
      sec[cur].addClass("is-settle");
      pose(sec[cur], GONE);
      window.setTimeout(o.last.go, 220);
      return;
    }
    o.last?.reset();
    armed = false;
    layout(true);
  };
  pager.addEventListener("pointerup", end);
  pager.addEventListener("pointercancel", end);
  return { layout, decide, get cur() {
    return cur;
  } };
}

// src/pages/cardkit.ts
var LEVELS_STAT = { ap: 300, ad: 200 };
var ULT_LEVELS = [6, 11, 16];
var FORM_ICONS = ["hammer", "crosshair"];
var FORM_ART = "https://raw.communitydragon.org/latest/game/assets/characters";
var DAMAGE_ROW = /^(物理|魔法|真實)傷害|^治療|^護盾/;
var SCALING = /\+([\d./]+)%\s*(額外物理攻擊|物理攻擊|魔法攻擊)/;
var NEUTRAL = "#6b7183";
var kindColor = (s) => DAMAGE_COLOR[s.damage[0] ?? ""] ?? NEUTRAL;
var statColor = (stat) => stat.includes("\u9B54\u6CD5") ? DAMAGE_COLOR["\u9B54\u6CD5"] : DAMAGE_COLOR["\u7269\u7406"];
var lastNum2 = (v) => parseFloat(v.split("/").pop() ?? "") || 0;
function pill(parent, label, color, ic) {
  const p = h(parent, "span", "mn-ck-pill");
  p.style.setProperty("--c", color);
  if (ic) icon(p, ic);
  h(p, "span", void 0, label);
}
var measure = null;
function centreInk(letter) {
  if (!letter.isConnected) return;
  measure ?? (measure = document.createElement("canvas").getContext("2d"));
  if (!measure) return;
  const cs = getComputedStyle(letter);
  measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = measure.measureText(letter.textContent ?? "");
  const box = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
  const ink = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  if (Number.isFinite(ink) && Number.isFinite(box)) letter.style.setProperty("--dy", `${(ink - box).toFixed(2)}px`);
}
function keyBadge(parent, key, color) {
  const k = h(parent, "span", "mn-ck-key" + (key === "P" ? " is-zh" : ""));
  const letter = h(k, "span", void 0, key === "P" ? "\u88AB" : key);
  k.style.setProperty("--c", color);
  requestAnimationFrame(() => centreInk(letter));
  void document.fonts?.ready.then(() => centreInk(letter));
  return k;
}
var head = (el, { c, s }) => {
  const color = kindColor(s);
  const ic = h(el, "div", "mn-ck-ic");
  ic.style.setProperty("--c", color);
  const im = h(ic, "img");
  im.src = s.icon;
  im.alt = "";
  keyBadge(ic, s.key, color);
  const who = h(el, "div", "mn-ck-who");
  h(who, "div", "mn-ck-kn", `${c.name} \xB7 ${s.key === "P" ? "\u88AB\u52D5" : s.key}`);
  h(who, "div", "mn-ck-name", s.name);
};
var tags = (el, { s }) => {
  for (const k of s.damage) pill(el, `${k}\u50B7\u5BB3`, DAMAGE_COLOR[k] ?? NEUTRAL, DAMAGE_ICON[k] ?? "flame");
  for (const t of s.tags) {
    const i = tagInfo(t);
    pill(el, t, i?.color ?? "var(--mn-muted)", i?.icon);
  }
};
var desc = (el, { s }) => {
  el.textContent = s.desc;
};
var numbers2 = (el, { s }) => {
  const rows = s.rows.filter((r) => DAMAGE_ROW.test(r.label));
  if (!rows.length) return;
  const ranks = Math.max(1, ...rows.map((r) => r.vals.length));
  el.style.setProperty("--r", String(ranks));
  if (ranks > 1) {
    h(el, "div");
    for (let i = 1; i <= ranks; i++) h(el, "div", "mn-ck-h", s.levels[i - 1] ? `Lv ${s.levels[i - 1]}` : `${i} \u7D1A`);
  }
  for (const r of rows) {
    const color = DAMAGE_COLOR[r.label.slice(0, 2)] ?? (r.label.startsWith("\u6CBB\u7642") ? "var(--mn-heal)" : "var(--mn-shield)");
    const name = h(el, "div", "mn-ck-l", r.label);
    name.style.color = color;
    if (r.vals.length === 1) {
      const v = h(el, "div", "mn-ck-v", r.vals[0]);
      v.style.gridColumn = `span ${ranks}`;
      v.style.color = color;
    } else for (const v of r.vals) h(el, "div", "mn-ck-v", v).style.color = color;
    if (r.note) {
      const sc = h(el, "div", "mn-ck-sc");
      sc.style.gridColumn = "1 / -1";
      for (const p of scalingParts(r.note)) pill(sc, p.text, p.color, p.icon);
    }
  }
};
var stats = (el, { s }) => {
  const val = (re) => s.rows.find((r) => re.test(r.label))?.vals.join(" / ");
  const box = (ic, v, label) => {
    if (!v) return;
    const b = h(el, "div", "mn-ck-stat");
    icon(b, ic);
    h(b, "b", void 0, v);
    h(b, "span", void 0, label);
  };
  box("timer", val(/^冷卻/), "\u51B7\u537B \u79D2");
  box("droplet", val(/^消耗/), "\u6D88\u8017");
  box("crosshair", s.range, "\u5C04\u7A0B");
};
var media = (el, { c, s, args }) => {
  const wrap = h(el, "div", "mn-sl-video");
  const spec = args.find((a) => /^\d+(?:\.\d+)?-\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?-\d+(?:\.\d+)?)*$/.test(a));
  const seconds = spec?.split("+").map((p) => p.split("-").map(Number));
  demo(wrap, c, { key: args.find((a) => /^[PQWER]\d?$/i.test(a))?.toUpperCase() ?? s.key, seconds }, () => {
    const im = h(wrap, "img", "mn-ck-failic");
    im.src = s.icon;
    im.alt = "";
  });
  tags(h(wrap, "div", "mn-ck-onclip"), { c, s, args });
  const hud = h(wrap, "div", "mn-ck-hud");
  keyBadge(hud, s.key, kindColor(s));
  h(hud, "span", "mn-ck-hudn", s.name);
};
var levelBars = (el, { s, args }) => {
  const row2 = s.rows.find((r) => /^(物理|魔法|真實)傷害/.test(r.label));
  const m = row2 ? SCALING.exec(row2.note) : null;
  if (!row2 || !m) return;
  const pct2 = lastNum2(m[1]), stat = m[2], color = statColor(stat);
  const amount = Number(args.find((a2) => /^\d+$/.test(a2))) || (stat.includes("\u9B54\u6CD5") ? LEVELS_STAT.ap : LEVELS_STAT.ad);
  const bonus = Math.round(pct2 / 100 * amount);
  const bases = row2.vals.map((v) => lastNum2(v));
  const top = Math.max(...bases) + bonus;
  bases.forEach((base, i) => {
    const r = h(el, "div", "mn-ck-lv");
    const lab = h(r, "div", "mn-ck-lvk");
    h(lab, "b", void 0, `${i + 1} \u7D1A`);
    if (s.key === "R" && ULT_LEVELS[i]) h(lab, "span", void 0, `Lv ${ULT_LEVELS[i]}`);
    const pair = h(r, "div", "mn-ck-lvp");
    const one = (withStat) => {
      const line = h(pair, "div", "mn-ck-lvl");
      const tr = h(line, "div", "mn-ck-track");
      h(tr, "i", "mn-ck-b1", withStat ? "" : String(base)).style.width = `${base / top * 100}%`;
      if (withStat) {
        const b2 = h(tr, "i", "mn-ck-b2", `+${bonus}`);
        b2.style.width = `${bonus / top * 100}%`;
        b2.style.background = color;
      }
      h(line, "b", void 0, String(base + (withStat ? bonus : 0)));
    };
    one(false);
    one(true);
  });
  const lg = h(el, "div", "mn-ck-lg");
  const a = h(lg, "span");
  h(a, "i").style.background = "#6e7b92";
  a.append("\u6280\u80FD\u7B49\u7D1A\u7D66\u7684");
  const b = h(lg, "span");
  h(b, "i").style.background = color;
  b.append(`${amount} ${stat.replace("\u653B\u64CA", "\u653B")}\u591A\u7D66\u7684`);
};
var formsTitle = (el, { c, args }) => {
  const im = h(el, "img", "mn-ck-sq");
  im.src = c.icon;
  im.alt = "";
  h(el, "span", void 0, `${c.name} \xB7 ${args.filter((a) => !/^[PQWER]\d?$/i.test(a)).length || 2} \u7A2E\u578B\u614B`);
};
var formSets = (el, { c, args }) => {
  const names = args.map((a) => a.replace(/^\*/, "")).filter((a) => !/^[PQWER]\d?$/i.test(a));
  const id = c.id.toLowerCase();
  names.forEach((form, i) => {
    const col = h(el, "div", "mn-ck-set");
    const t = h(col, "div", "mn-ck-formh");
    icon(t, FORM_ICONS[i] ?? "shapes");
    h(t, "span", void 0, form);
    const pic = (parent, key, big) => {
      const s = c.skills.find((x) => x.key === key);
      if (!s) return;
      const cell = h(parent, "div", "mn-ck-cell" + (big ? " is-big" : ""));
      const ic = h(cell, "div", "mn-ck-ic" + (big ? " is-big" : " is-sm"));
      ic.style.setProperty("--c", kindColor(s));
      const im = h(ic, "img");
      im.alt = "";
      im.src = `${FORM_ART}/${id}/hud/icons2d/${id}${key.toLowerCase()}_${i === 0 ? "melee" : "ranged"}.png`;
      im.addEventListener("error", () => {
        if (i === 0) im.src = s.icon;
        else im.remove();
      }, { once: true });
      keyBadge(ic, key, kindColor(s));
      h(cell, "span", "mn-ck-cn", s.name.split("\uFF0F")[i] ?? s.name);
    };
    pic(col, "R", true);
    const row2 = h(col, "div", "mn-ck-qwe");
    for (const k of ["Q", "W", "E"]) pic(row2, k, false);
  });
};
var RESULT_ICON = [[/快|速/, "zap"], [/遠|長/, "move-horizontal"], [/痛|傷|強/, "flame"], [/穩|盾/, "shield"]];
var beforeEquals = (args) => args.includes("=") ? args.slice(0, args.indexOf("=")) : args;
var comboMedia = (el, { c, args }) => {
  const keys = beforeEquals(args).filter((a) => /^[PQWER]\d?$/i.test(a)).map((a) => a.toUpperCase());
  const wrap = h(el, "div", "mn-sl-video");
  const reels = keys.map((key) => {
    const box = h(wrap, "div", "mn-ck-reel");
    demo(box, c, { key });
    return box;
  });
  let now = 0;
  const show = (i) => {
    now = i;
    reels.forEach((box, n) => {
      box.classList.toggle("is-on", n === i);
      if (n !== i) box.querySelector("video")?.pause();
    });
    const v = reels[i]?.querySelector("video");
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => void 0);
    }
  };
  reels.forEach((box, i) => {
    const v = box.querySelector("video");
    if (!v || reels.length < 2) return;
    v.loop = false;
    v.addEventListener("ended", () => {
      if (now === i) show((i + 1) % reels.length);
    });
    v.addEventListener("play", () => {
      if (now !== i) v.pause();
    });
  });
  reels[0]?.classList.add("is-on");
  comboFlow(h(wrap, "div", "mn-ck-comboFlow"), { c, s: c.skills[0], args });
};
var comboFlow = (el, { c, args }) => {
  const spec = beforeEquals(args);
  const names = spec.filter((a) => !/^[PQWER]\d?$/i.test(a)).map((a) => a.replace(/^\*/, ""));
  const form = Math.max(0, names.indexOf(spec.find((a) => a.startsWith("*"))?.slice(1) ?? ""));
  const keys = spec.filter((a) => /^[PQWER]\d?$/i.test(a)).map((a) => a.toUpperCase());
  const id = c.id.toLowerCase();
  keys.forEach((key, i) => {
    if (i) icon(el, "arrow-right", "mn-ck-arrow");
    const s = c.skills.find((x) => x.key === key.charAt(0));
    if (!s) return;
    const cell = h(el, "div", "mn-ck-cell is-step");
    const ic = h(cell, "div", "mn-ck-ic is-huge");
    ic.style.setProperty("--c", kindColor(s));
    const im = h(ic, "img");
    im.alt = "";
    im.src = `${FORM_ART}/${id}/hud/icons2d/${id}${key.toLowerCase()}_${form === 0 ? "melee" : "ranged"}.png`;
    im.addEventListener("error", () => {
      im.src = s.icon;
    }, { once: true });
    keyBadge(ic, key, kindColor(s));
    h(ic, "span", "mn-ck-step", String(i + 1));
    h(cell, "span", "mn-ck-cn", s.name.split("\uFF0F")[form] ?? s.name);
  });
  const at = args.indexOf("=");
  if (at < 0) return;
  const chips = h(el, "div", "mn-ck-comboChips");
  for (const w of args.slice(at + 1)) pill(chips, w, "#f0b074", RESULT_ICON.find(([re]) => re.test(w))?.[1] ?? "sparkles");
};
var formCols = (el, { c, args }) => {
  const names = args.map((a) => a.replace(/^\*/, "")).filter((a) => !/^[PQWER]$/i.test(a));
  const on = args.find((a) => a.startsWith("*"))?.slice(1);
  const cut = new RegExp(`(?=(?:${names.join("|")})[^\uFF1A:\uFF0C\u3002\\s]{0,3}\u578B\u614B[\uFF1A:])`);
  names.forEach((form, i) => {
    const col = h(el, "div", "mn-ck-form" + (form === on ? " is-on" : ""));
    const t = h(col, "div", "mn-ck-formh");
    icon(t, FORM_ICONS[i] ?? "shapes");
    h(t, "span", void 0, form);
    for (const key of ["Q", "W", "E"]) {
      const s = c.skills.find((x) => x.key === key);
      const part = s?.desc.split(cut).find((p) => p.startsWith(form));
      if (!part) continue;
      const line = h(col, "div", "mn-ck-fl");
      keyBadge(line, key, s ? kindColor(s) : "var(--mn-muted)");
      h(line, "span", void 0, part.replace(/^[^：:]*[：:]/, "").trim());
    }
  });
};
var LAYOUTS = {
  ability: { areas: ["head", "tags", "desc", "numbers", "stats"], rows: "auto auto auto auto auto", fill: { head, tags, desc, numbers: numbers2, stats } },
  clip: { areas: ["media"], rows: "1fr", fill: { media } },
  levels: { areas: ["head", "levelBars"], rows: "auto auto", fill: { head, levelBars } },
  forms: { areas: ["formsTitle", "formCols"], rows: "auto auto", fill: { formsTitle, formCols } },
  combo: { areas: ["comboMedia"], rows: "1fr", fill: { comboMedia } },
  formset: { areas: ["formsTitle", "formSets"], rows: "auto auto", fill: { formsTitle, formSets } }
};
function cardKit(box, kind, c, args) {
  const layout = LAYOUTS[kind];
  if (!layout || !c) return false;
  const key = (args.find((a) => /^[PQWER]\d?$/i.test(a)) ?? "Q").toUpperCase();
  const s = c.skills.find((x) => x.key === key.charAt(0));
  if (!s && kind !== "forms" && kind !== "formset" && kind !== "combo") return false;
  const root = h(box, "div", `mn-ck mn-ck-${kind}`);
  root.style.gridTemplateAreas = layout.areas.map((a) => `"${a}"`).join(" ");
  root.style.gridTemplateRows = layout.rows;
  for (const area of layout.areas) {
    const slot = h(root, "div", `mn-ck-slot mn-ck-${area}`);
    slot.style.gridArea = area;
    layout.fill[area](slot, { c, s: s ?? c.skills[0], args });
  }
  return true;
}

// src/pages/deck.ts
var GLOSSARY2 = "\u540D\u8A5E\u8868";
var STRIP = 6;
var WAIT_CARDS = 3;
var LOOK_MIN_MS = 500;
var DECK_WAIT_MS = 8e3;
var NEAR_BEHIND = 1;
var NEAR_AHEAD = 2;
var DECK_BELOW = 10;
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
var COUNTERS = [
  ["\u523A\u5BA2", "\u5C04\u624B", "var(--color-red)"],
  ["\u523A\u5BA2", "\u6CD5\u5E2B", "var(--color-red)"],
  ["\u5766\u514B", "\u523A\u5BA2", "var(--color-blue)"],
  ["\u8F14\u52A9", "\u523A\u5BA2", "var(--color-blue)"],
  ["\u5C04\u624B", "\u5766\u514B", "var(--color-orange)"],
  ["\u6CD5\u5E2B", "\u6230\u58EB", "var(--color-purple)"]
];
var RING = ["\u6230\u58EB", "\u5766\u514B", "\u5C04\u624B", "\u8F14\u52A9", "\u6CD5\u5E2B"];
var MIDDLE = "\u523A\u5BA2";
var WARDS = {
  lane: { wards: [[27, 33, "w"], [73, 66, "w"], [46, 54, "w"]] },
  dragon: { obj: [["\u5C0F\u9F8D", 67, 70]], wards: [[60, 66, "c"], [62, 76, "w"], [73, 61, "w"]] },
  baron: { obj: [["\u5DF4\u9F8D", 33, 30]], wards: [[40, 34, "c"], [38, 24, "w"], [27, 39, "w"]] },
  steal: { obj: [["\u5C0F\u9F8D", 67, 70]], wards: [[64, 74, "w"], [76, 58, "w"], [83, 70, "c"]] }
};
var hashStr = (s) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
};
var day = () => String(Math.floor(Date.now() / 864e5));
function deckPage(ctx, file) {
  const store = ctx.plugin.store;
  const el = h(null, "div", "mn-page mn-deckpage");
  const titleRow = h(el, "div", "mn-title-row");
  h(titleRow, "h1", "mn-title", file.basename);
  const glossary = store.guideNotes().find((n) => n.layout !== "deck" && n.title === GLOSSARY2);
  if (glossary) {
    const info = h(titleRow, "button", "mn-btn");
    info.setAttribute("aria-label", GLOSSARY2);
    icon(info, "info");
    info.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.openNote(glossary.file.path);
    });
  }
  const bars = h(el, "div", "mn-bars");
  const wrap = h(el, "div", "mn-deckwrap");
  const peek = h(wrap, "div", "mn-peek");
  const peekIn = h(peek, "div", "mn-peek-in");
  const pager = h(wrap, "div", "mn-pager");
  pager.addClass("is-wait");
  const band = h(wrap, "div", "mn-artload");
  trackBand(band);
  const since = Date.now();
  for (const ev of ["touchstart", "touchmove"]) pager.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const fit = () => {
    const scroll = el.closest(".mn-scroll");
    if (!scroll) return;
    const top = wrap.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    wrap.style.height = `${Math.max(380, scroll.clientHeight - top - DECK_BELOW)}px`;
  };
  void ctx.app.vault.cachedRead(file).then((md) => {
    const slides = parseSlides(md);
    const guide = store.guideNotes().filter((n) => n.layout === "deck");
    const at = guide.findIndex((n) => n.file.path === file.path);
    const next = guide[at + 1];
    const sec = [];
    slides.forEach((s, i) => {
      h(bars, "span", "mn-bar");
      const section2 = h(pager, "section", "mn-slide");
      const card = h(section2, "div", "mn-sl-card");
      const face = h(card, "div", "mn-sl-face");
      visual(ctx, h(face, "div", "mn-sl-vis"), s);
      const words = h(face, "div", "mn-sl-words");
      const measure2 = () => face.style.setProperty("--mn-words-h", `${words.offsetHeight}px`);
      const watch = new ResizeObserver(measure2);
      watch.observe(words);
      ctx.component.register(() => watch.disconnect());
      h(words, "div", "mn-sl-kn", `${file.basename} \xB7 ${i + 1} / ${slides.length}`);
      h(words, "h2", "mn-sl-t", s.title);
      const tip2 = /^([\s\S]*?)\*\*([^*\n]{1,8})[:：]\*\*\s*([\s\S]+)$/.exec(s.text);
      const main = tip2 ? tip2[1].trim() : s.text;
      const body = h(words, "div", "mn-sl-x markdown-rendered");
      if (main) void import_obsidian6.MarkdownRenderer.render(ctx.app, main, body, file.path, ctx.component);
      const box = h(words, "div", "mn-sl-tip" + (tip2 ? "" : " is-empty"));
      if (tip2) {
        h(box, "div", "mn-sl-tip-k", tip2[2]);
        void import_obsidian6.MarkdownRenderer.render(ctx.app, tip2[3].trim(), h(box, "div", "mn-sl-tip-x markdown-rendered"), file.path, ctx.component);
      }
      sec.push(section2);
    });
    if (next) {
      icon(h(peekIn, "div", "mn-peek-ic"), next.icon);
      h(peekIn, "div", "mn-peek-k", "\u4E0B\u4E00\u7BC7");
      h(peekIn, "div", "mn-peek-t", next.title);
    } else {
      icon(h(peekIn, "div", "mn-peek-ic"), "check");
      h(peekIn, "div", "mn-peek-k", "\u5168\u90E8\u8B80\u5B8C\u4E86");
      h(peekIn, "div", "mn-peek-t", "\u56DE\u5230 Handbook");
    }
    const go = () => {
      ctx.pop();
      if (next) ctx.openNote(next.file.path);
    };
    const resetPeek = () => {
      peek.style.opacity = "";
      peek.removeClass("is-ready");
    };
    const pile = cardPile(pager, sec, {
      scroll: ".mn-sl-words",
      // the progress bars; only the cards near the top are painted, and only the ones in view play their clip: a topic with
      // many clips otherwise has them all running under the top card, which makes some swipes smooth and others not
      onLayout: (cur) => {
        Array.from(bars.children).forEach((b, j) => b.toggleClass("is-on", j <= cur));
        if (cur >= sec.length - 1) void ctx.plugin.markRead(file.path);
        sec.forEach((c, i) => {
          c.style.visibility = i >= cur - NEAR_BEHIND && i <= cur + NEAR_AHEAD ? "" : "hidden";
          c.querySelectorAll("video").forEach((v) => {
            const live = () => v.dataset.heavy === "1" ? i === cur : i >= cur - 1 && i <= cur + 1;
            if (live()) {
              void v.play().catch(() => void 0);
              return;
            }
            if (v.readyState >= 2) v.pause();
            else v.addEventListener("loadeddata", () => {
              if (!live()) v.pause();
            }, { once: true });
          });
        });
      },
      // pulling the last card shows the next topic under it (fixed panel); let go far enough and that topic opens
      last: {
        move: (px) => {
          peek.style.opacity = String(Math.min(1, px / 30));
          const ready = px >= GO_AT;
          peek.toggleClass("is-ready", ready);
          return ready;
        },
        reset: resetPeek,
        go
      }
    });
    pile.layout(false);
    sec.forEach((c) => c.querySelectorAll("video").forEach((v) => {
      void v.play().catch(() => void 0);
    }));
    const loaded = whenMediaLoaded(sec.slice(0, WAIT_CARDS), DECK_WAIT_MS);
    void loaded.then(() => {
      pile.layout(false);
      window.setTimeout(() => {
        pager.removeClass("is-wait");
        endBand(band);
      }, Math.max(0, LOOK_MIN_MS - (Date.now() - since)));
    });
    const onResize = () => pile.layout(false);
    window.addEventListener("resize", onResize);
    ctx.component.register(() => window.removeEventListener("resize", onResize));
    requestAnimationFrame(fit);
  });
  window.addEventListener("resize", fit);
  ctx.component.register(() => window.removeEventListener("resize", fit));
  return { title: "", el };
}
function itemTree(parent, ctx, id) {
  const store = ctx.plugin.store;
  const node = (at, itemId, depth) => {
    const it = store.item(itemId);
    if (!it) return;
    const n = h(at, "div", "mn-tree-n");
    const b = h(n, "button", "mn-tree-item" + (depth === 0 ? " is-root" : ""));
    const im = h(b, "img");
    im.src = it.icon;
    im.alt = "";
    h(b, "span", "mn-tree-g", String(it.goldTotal));
    h(b, "span", "mn-tree-name", it.name);
    if (depth > 0 || ctx.frame.key !== "item") b.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.openItem(it.id);
    });
    if (it.from.length && depth < 2) {
      const kids = h(n, "div", "mn-tree-kids");
      for (const f of it.from) node(kids, f, depth + 1);
    }
  };
  node(h(parent, "div", "mn-tree"), id, 0);
}
function visual(ctx, box, s) {
  const store = ctx.plugin.store;
  const [kind, ...args] = s.visual.split(/\s+/).filter(Boolean);
  box.addClass(`is-${kind || "icon"}`);
  const champ = (id) => id ? store.champion(id) : void 0;
  if (kind === "video") {
    const c = champ(args[0]);
    if (c) {
      demo(h(box, "div", "mn-sl-video"), c, { key: args[1] ?? "Q" });
      return;
    }
  } else if (kind === "img") {
    const src = args.join(" ");
    const url = /^https?:/.test(src) ? src : ctx.app.vault.adapter.getResourcePath(src);
    const im = h(box, "img", "mn-sl-img");
    im.src = url;
    im.alt = "";
    return;
  } else if (kind === "style") {
    const c = champ(args[0]);
    if (c) {
      styleCard(h(box, "div", "mn-sl-style"), c, ctx.app);
      return;
    }
  } else if (kind === "facts") {
    const c = champ(args[0]);
    if (c) {
      factsStrip(h(box, "div", "mn-sl-facts"), c);
      return;
    }
  } else if (kind === "tags") {
    const c = champ(args[0]);
    if (c) {
      tagRow(h(box, "div", "mn-sl-tags"), c, void 0, true);
      return;
    }
  } else if (kind === "roles" || kind === "lanes") {
    const names = kind === "roles" ? ["\u6230\u58EB", "\u5766\u514B", "\u6CD5\u5E2B", "\u523A\u5BA2", "\u5C04\u624B", "\u8F14\u52A9"] : LANES;
    const row2 = fgrid(h(box, "div", "mn-sl-icons"), names.length);
    for (const n of names) {
      const cell = h(row2, "div", "mn-sl-icon");
      (kind === "roles" ? roleChip : laneChip)(cell, n, { on: false, onTap: () => void 0 });
      h(cell, "span", "mn-sl-icon-l", n);
    }
    return;
  } else if (kind === "tabs") {
    const seg = h(h(box, "div", "mn-sl-tabs"), "div", "mn-seg mn-seg-line");
    ["Skills", "Build", "Augments", "Tips"].forEach((l, i) => h(seg, "span", "mn-seg-b" + (i === 0 ? " is-on" : ""), l));
    return;
  } else if (kind === "damage") {
    const row2 = h(box, "div", "mn-sl-dmg");
    for (const k of ["\u7269\u7406", "\u9B54\u6CD5", "\u771F\u5BE6"]) {
      const d = h(row2, "div", "mn-sl-dmg-k", k);
      d.style.setProperty("--c", DAMAGE_COLOR[k]);
    }
    return;
  } else if (kind === "ability" || kind === "clip" || kind === "levels" || kind === "forms" || kind === "formset" || kind === "combo") {
    if (cardKit(box, kind, champ(args[0]), args.slice(1))) return;
  } else if (kind === "skill") {
    const c = champ(args[0]), k = (args[1] ?? "Q").toUpperCase();
    const sk = c?.skills.find((x) => x.key === k);
    if (c && sk) {
      const wrap = h(box, "div", "mn-sl-skill");
      const top = h(wrap, "div", "mn-sl-skill-top");
      const im = h(top, "img", "mn-sl-skill-ic");
      im.src = sk.icon;
      im.alt = "";
      im.style.setProperty("--chip", DAMAGE_COLOR[sk.damage[0] ?? ""] ?? "var(--mn-line)");
      const who = h(top, "div");
      h(who, "div", "mn-sl-skill-k", `${c.name} \xB7 ${k === "P" ? "\u88AB\u52D5" : k}`);
      h(who, "div", "mn-sl-skill-n", sk.name);
      h(wrap, "div", "mn-sl-skill-d", sk.desc);
      if (args.includes("grid")) rankTable(wrap, sk, []);
      return;
    }
  } else if (kind === "tree") {
    const root = store.item(Number(args[0]));
    if (root) {
      itemTree(box, ctx, root.id);
      return;
    }
  } else if (kind === "counters") {
    const lit = new Set(args);
    const wrap = h(box, "div", "mn-ctr");
    const at = (r) => {
      if (r === MIDDLE) return [50, 52];
      const a = -Math.PI / 2 + RING.indexOf(r) * 2 * Math.PI / RING.length;
      return [50 + 39 * Math.cos(a), 52 + 39 * Math.sin(a)];
    };
    const g = svg(wrap, "svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, "mn-ctr-svg");
    const defs = svg(g, "defs");
    COUNTERS.forEach(([from, to, color], i) => {
      const mk = svg(defs, "marker", { id: `mn-ah-${i}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 3.6, markerHeight: 3.6, orient: "auto-start-reverse" });
      svg(mk, "path", { d: "M0,0 L10,5 L0,10 z" }).setAttribute("style", `fill:${color}`);
      const [x1, y1] = at(from), [x2, y2] = at(to);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), cut = 12 / len;
      const line = svg(g, "line", { x1: x1 + dx * cut, y1: y1 + dy * cut, x2: x2 - dx * cut, y2: y2 - dy * cut, "marker-end": `url(#mn-ah-${i})` }, "mn-ctr-a");
      line.setAttribute("style", `stroke:${color}`);
      if (lit.size && !lit.has(from)) line.addClass("is-dim");
    });
    for (const r of [...RING, MIDDLE]) {
      const [x, y] = at(r);
      const node = h(wrap, "div", "mn-ctr-n" + (lit.size && !lit.has(r) && !COUNTERS.some(([f, to]) => lit.has(f) && to === r) ? " is-dim" : ""));
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
      roleChip(node, r, { on: false, onTap: () => void 0 });
      h(node, "span", "mn-ctr-l", r);
    }
    return;
  } else if (kind === "wards") {
    const scene = WARDS[args[0] ?? "lane"] ?? WARDS.lane;
    const ver = /\/cdn\/([\d.]+)\//.exec(store.champions()[0]?.icon ?? "")?.[1] ?? "";
    const map = h(box, "div", "mn-wmap");
    const im = h(map, "img", "mn-wmap-img");
    im.src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/map/map11.png`;
    im.alt = "";
    for (const [label, x, y] of scene.obj ?? []) {
      const o = h(map, "span", "mn-wmap-obj", label);
      o.style.left = `${x}%`;
      o.style.top = `${y}%`;
    }
    for (const [x, y, k] of scene.wards) {
      const w = h(map, "img", "mn-wmap-ward is-" + k);
      w.src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${k === "c" ? 2055 : 3340}.png`;
      w.alt = "";
      w.style.left = `${x}%`;
      w.style.top = `${y}%`;
    }
    return;
  } else if (kind === "splash") {
    const c = champ(args[0]);
    if (c) {
      const im = h(box, "img", "mn-sl-img mn-sl-splash");
      im.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(c.id)}_0.jpg`;
      im.alt = "";
      box.className = "mn-sl-vis is-img";
      return;
    }
  } else if (kind === "map") {
    const im = h(box, "img", "mn-sl-img");
    im.src = mapUrl(args[0]);
    im.alt = "";
    box.className = "mn-sl-vis is-img";
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
  box.className = "mn-sl-vis is-icon";
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
  if (!(file instanceof import_obsidian7.TFile)) {
    empty(el, { icon: "file-x", title: "Note not found" });
    return { title: "", el };
  }
  if (ctx.plugin.store.guideNotes().some((n) => n.file.path === path && n.layout === "deck")) return deckPage(ctx, file);
  h(h(el, "div", "mn-title-row"), "h1", "mn-title", file.basename);
  const body = h(el, "div", "mn-note markdown-rendered");
  void ctx.app.vault.cachedRead(file).then((text) => import_obsidian7.MarkdownRenderer.render(ctx.app, text.replace(/^---[\s\S]*?---\n/, ""), body, path, ctx.component));
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
var KINDS2 = [
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
  const kinds = KINDS2.filter((k) => k.re.test(effect));
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
  const head2 = h(el, "div", "mn-dhead");
  augIcon(head2, a.icon, a.rarity, "mn-dimg-aug");
  const who = h(head2, "div", "mn-dwho");
  h(who, "h1", "mn-title", a.name);
  const tags2 = h(who, "div", "mn-chips");
  chip(tags2, a.rarity, { color: RARITY_COLOR[a.rarity] });
  const last = history[0];
  if (last) chip(tags2, `${last.what === "added" ? "\u65B0\u589E\u65BC" : "\u79FB\u9664\u65BC"} ${last.patch}`, { color: last.what === "added" ? "var(--color-blue)" : "var(--color-red)" });
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
  const head2 = h(el, "div", "mn-dhead");
  const im = h(head2, "img", "mn-dimg");
  im.src = item.icon;
  im.alt = "";
  const who = h(head2, "div", "mn-dwho");
  h(who, "h1", "mn-title", item.name);
  const tags2 = h(who, "div", "mn-chips");
  chip(tags2, `${item.goldTotal} \u91D1`, { color: "var(--color-yellow)" });
  for (const t of item.tags) if (TAG_ZH[t]) chip(tags2, TAG_ZH[t]);
  if (item.desc) {
    const panel = h(el, "div", "mn-panel mn-dpanel");
    h(panel, "p", "mn-dtext", item.desc);
  }
  if (item.variantOf) h(el, "div", "mn-gf", "\u9019\u662F ARAM \u5C08\u7528\u7248\u672C,\u50F9\u683C\u8207\u6578\u503C\u548C\u4E00\u822C\u7248\u672C\u4E0D\u540C\u3002");
  if (item.from.length) {
    h(el, "div", "mn-gh", "\u5408\u6210\u6750\u6599");
    itemTree(h(el, "div", "mn-panel mn-itree"), ctx, item.id);
  }
  recipe(el, ctx, "\u53EF\u5408\u6210", item.into.map((id) => store.item(id)).filter((i) => !!i));
  const official = store.officialFor("items", item.name);
  if (official.length) {
    h(el, "div", "mn-gh", "\u7248\u672C\u8ABF\u6574");
    officialBlock(el, official);
  }
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
  if (latest?.champions?.length) {
    h(el, "div", "mn-gh", `Champions \xB7 ${latest.champions.length}`);
    const grid = h(el, "div", "mn-grid");
    for (const { e, dir } of byDir(latest.champions)) {
      const c = store.champions().find((x) => x.name === e.name);
      if (c) tile(grid, c.icon, c.name, () => ctx.openChampion(c.id, "skills"), { dir });
    }
    blockLoad(grid);
    h(el, "div", "mn-gf", LEGEND);
  }
  if (latest?.items?.length) {
    h(el, "div", "mn-gh", `Items \xB7 ${latest.items.length}`);
    const grid = h(el, "div", "mn-grid");
    for (const { e, dir } of byDir(latest.items)) {
      const i = store.items().find((x) => x.name === e.name);
      if (i) tile(grid, i.icon, i.name, () => ctx.openItem(i.id), { dir });
    }
    blockLoad(grid);
    h(el, "div", "mn-gf", LEGEND);
  }
  if (latest && ctx.plugin.settings.mode === "mayhem") mayhemSection(el, ctx, latest);
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
  return { title: "Patch", el, ready: null };
}
var DIR_ORDER = ["buff", "nerf", "mixed", "change"];
function byDir(list2) {
  return list2.map((e) => ({ e, dir: entryDir(e) })).sort((a, b) => DIR_ORDER.indexOf(a.dir) - DIR_ORDER.indexOf(b.dir));
}
function tile(grid, src, name, onTap, o = {}) {
  const t = h(grid, "button", "mn-tile");
  if (o.rarity && AUG_CLASS[o.rarity]) augIcon(t, src, o.rarity, "mn-tile-aug");
  else {
    const im = h(t, "img");
    im.src = src;
    im.alt = "";
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
  blockLoad(card);
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
    blockLoad(grid);
  }
  if (removed.length) {
    h(el, "div", "mn-gh", `Removed augments \xB7 ${removed.length}`);
    const chips = h(el, "div", "mn-chips");
    for (const r of removed) chip(chips, r, { color: RARITY_COLOR["\u9280"] });
  }
}

// src/pages/roster.ts
var import_obsidian8 = require("obsidian");
var MAX_PICKS = 15;
var BTN_ROOM = 84;
var SPLIT = /[\s,，、;；和跟與及]+/;
var swipeAt = 0;
var swipeLiked = [];
var swipeSig = "";
function matchScore(c, raw) {
  const q = raw.trim().toLowerCase();
  if (!q) return 0;
  const name = c.name.toLowerCase(), title = c.title.toLowerCase(), id = c.id.toLowerCase(), en = (c.nameEn ?? "").toLowerCase();
  const nick = c.aliases.map((a) => a.toLowerCase());
  if (name === q || id === q || en === q || nick.includes(q)) return 100;
  if (name.startsWith(q) || id.startsWith(q) || en.startsWith(q) || nick.some((a) => a.startsWith(q))) return 90;
  if (name.includes(q)) return 80;
  if (id.includes(q) || en.includes(q)) return q.length >= 4 ? 80 : 40;
  if (q.length >= 2 && nick.some((a) => a.includes(q))) return 70;
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
function enKey(s) {
  return s.toLowerCase().replace(/[^a-z]/g, "").replace(/ph/g, "f").replace(/ck/g, "k").replace(/ch/g, "1").replace(/c/g, "k").replace(/q/g, "k").replace(/x/g, "ks").replace(/z/g, "s").replace(/ee|ea|ie/g, "i").replace(/oo|ou/g, "u").replace(/y/g, "i").replace(/(.)\1+/g, "$1");
}
function edits(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_2, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
function enScore(c, raw) {
  return Math.max(enScoreOf(enKey(c.id), raw), c.nameEn ? enScoreOf(enKey(c.nameEn), raw) : 0);
}
function enScoreOf(name, raw) {
  const q = enKey(raw);
  if (q.length < 3 || !name) return 0;
  if (q === name) return 88;
  if (name.startsWith(q)) return 84;
  const allowed = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
  const whole = edits(q, name);
  if (whole <= allowed) return 60 - 4 * whole;
  if (q.length >= 4 && q.length < name.length && edits(q, name.slice(0, q.length)) <= 1) return 52;
  return 0;
}
function closest(all, raw, limit = 4) {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const allowed = [...q].length <= 4 ? 1 : 2;
  return all.map((c) => ({ c, d: Math.min(distance(q, c.name.toLowerCase()), distance(q, c.id.toLowerCase()), distance(q, (c.nameEn || c.id).toLowerCase())) })).filter((x) => x.d <= allowed).sort((a, b) => a.d - b.d || a.c.name.localeCompare(b.c.name, "zh-Hant")).slice(0, limit).map((x) => x.c);
}
function finder(all, sounds) {
  const heard = /* @__PURE__ */ new Map();
  const heardOf = (c) => {
    let x = heard.get(c.id);
    if (!x && sounds) heard.set(c.id, x = { name: [sounds.said(c.name), sounds.said(c.name, true)], title: [sounds.said(c.title), sounds.said(c.title, true)], nick: c.aliases.map((a) => [sounds.said(a), sounds.said(a, true)]) });
    return x;
  };
  const score2 = (c, t) => {
    const s = Math.max(matchScore(c, t), enScore(c, t));
    if (s >= 80 || !sounds) return s;
    const q = [sounds.said(t, false, true), sounds.said(t, true, true)];
    if (!q[0].length) return s;
    const x = heardOf(c);
    const byName = Math.max(soundScore(q[0], x.name[0], false), soundScore(q[1], x.name[1], true));
    const byTitle = Math.max(soundScore(q[0], x.title[0], false), soundScore(q[1], x.title[1], true));
    const byNick = Math.max(0, ...x.nick.map((n) => Math.max(soundScore(q[0], n[0], false), soundScore(q[1], n[1], true))));
    return Math.max(s, byName, byNick, byTitle >= 64 ? byTitle - 20 : 0);
  };
  const within = (t) => {
    if (!sounds) return [];
    const han = [...t].filter((ch) => /\p{Script=Han}/u.test(ch));
    const q = [sounds.said(t, false, true), sounds.said(t, true, true)];
    if (q[0].length < 3) return [];
    const hits = [];
    for (const c of all) {
      const x = heardOf(c);
      if (x.name[0].length < 2 || x.name[0].length >= q[0].length) continue;
      for (const near of [0, 1]) {
        const at = findSaid(q[near], x.name[near]);
        if (at >= 0) {
          hits.push({ c, at, len: x.name[0].length, near });
          break;
        }
      }
    }
    hits.sort((a, b) => b.len - a.len || a.near - b.near || a.at - b.at);
    const used = /* @__PURE__ */ new Set(), out = [];
    const take = (c, at, len) => {
      for (let i = at; i < at + len; i++) used.add(i);
      out.push({ c, at });
    };
    for (const h_ of hits) {
      if (out.some((o) => o.c.id === h_.c.id)) continue;
      if (Array.from({ length: h_.len }, (_, i) => h_.at + i).some((i) => used.has(i))) continue;
      take(h_.c, h_.at, h_.len);
    }
    if (out.length) {
      for (let i = 0; i < han.length; ) {
        if (used.has(i)) {
          i++;
          continue;
        }
        let j = i;
        while (j < han.length && !used.has(j)) j++;
        const part = han.slice(i, j).join("");
        const best = all.map((c) => ({ c, s: score2(c, part) })).sort((a, b) => b.s - a.s)[0];
        if (best && best.s >= (j - i >= 2 ? 50 : 78) && !out.some((o) => o.c.id === best.c.id)) take(best.c, i, j - i);
        i = j;
      }
    }
    return out.sort((a, b) => a.at - b.at).map((x) => x.c);
  };
  return { score: score2, within };
}
function rosterPage(ctx) {
  const store = ctx.plugin.store;
  const el = page("\u901F\u67E5");
  const all = store.champions();
  let picks = ctx.plugin.settings.roster.filter((id) => all.some((c) => c.id === id)).slice(0, MAX_PICKS);
  let query = "", lane = "";
  const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)]));
  const save = () => {
    void ctx.plugin.setRoster(picks);
  };
  const { score: score2, within } = finder(all, store.sounds);
  const box = h(el, "div", "mn-search");
  icon(box, "search", "mn-search-ic");
  const search = h(box, "input");
  search.type = "search";
  search.placeholder = "\u8F38\u5165\u82F1\u96C4\u540D\u5B57,\u6216\u6309\u9375\u76E4\u4E0A\u7684 \u{1F3A4} \u8AAA\u51FA\u4F86";
  search.setAttribute("enterkeyhint", "search");
  const suggest2 = h(el, "div", "mn-chips mn-rq-sugg");
  const lanes = fgrid(el, LANES.length);
  lanes.addClass("mn-rq-lanes");
  const grid = h(el, "div", "mn-faces");
  const go = h(el, "button", "mn-rq-go");
  icon(go, "layers");
  const goText = h(go, "span");
  go.addEventListener("click", (e) => {
    e.preventDefault();
    ctx.push({ key: "rosterswipe", title: "\u901F\u67E5" });
  });
  const drawCount = () => {
    go.toggleClass("is-hidden", !picks.length);
    goText.textContent = `\u9078\u597D\u4E86 \xB7 ${picks.length} \u4F4D,\u958B\u59CB\u6ED1`;
  };
  const toggle = (id) => {
    if (picks.includes(id)) picks = picks.filter((p) => p !== id);
    else if (picks.length >= MAX_PICKS) {
      new import_obsidian8.Notice(`\u6700\u591A\u9078 ${MAX_PICKS} \u4F4D`);
      return;
    } else picks = [...picks, id];
    save();
    drawCount();
    drawGrid();
  };
  let named = [];
  const pickFromSearch = (id) => {
    const adding = !picks.includes(id);
    toggle(id);
    if (adding && query && named.every((n) => picks.includes(n))) {
      search.value = "";
      query = "";
      drawSuggest();
      drawGrid();
      search.focus();
    } else if (query) drawSuggest();
  };
  const drawSuggest = () => {
    suggest2.empty();
    named = [];
    const tokens = query.split(SPLIT).filter(Boolean);
    if (!tokens.length) return;
    const best = (t) => {
      const ranked = all.map((c) => ({ c, s: score2(c, t) })).sort((a, b) => b.s - a.s);
      if (ranked[0] && ranked[0].s >= 70) return { list: [ranked[0].c], exact: true };
      const many = within(t);
      if (many.length >= 2) return { list: many, exact: true };
      if (ranked[0] && ranked[0].s >= 50) return { list: [ranked[0].c], exact: true };
      const near = ranked.filter((x) => x.s > 0).slice(0, 3).map((x) => x.c);
      return { list: near.length ? near : closest(all, t, 3), exact: false };
    };
    const found = tokens.map(best);
    const unique = [...new Map(found.flatMap((f) => f.list).map((c) => [c.id, c])).values()];
    named = found.every((f) => f.exact) ? unique.map((c) => c.id) : [];
    if (!unique.length) return;
    const guessed = found.some((f) => !f.exact && f.list.length);
    if (unique.length === 1 && !guessed) return;
    if (guessed) h(suggest2, "span", "mn-dym", "\u4F60\u662F\u4E0D\u662F\u5728\u627E:");
    for (const c of unique) chip(suggest2, `${picks.includes(c.id) ? "\u2713 " : "+ "}${c.name}`, { color: "var(--color-green)", onTap: () => pickFromSearch(c.id) });
    if (unique.length > 1) chip(suggest2, "\u5168\u90E8\u52A0\u5165", { on: true, onTap: () => {
      for (const c of unique) if (!picks.includes(c.id) && picks.length < MAX_PICKS) picks = [...picks, c.id];
      save();
      search.value = "";
      query = "";
      drawCount();
      drawSuggest();
      drawGrid();
    } });
  };
  const drawGrid = () => {
    grid.empty();
    const tokens = query.split(SPLIT).filter(Boolean);
    let list2 = all.filter((c) => !lane || store.lanes(c).includes(lane));
    if (tokens.length) {
      const said = new Set(tokens.filter((t) => !all.some((c) => score2(c, t) >= 70)).flatMap((t) => within(t)).map((c) => c.id));
      const scored = list2.map((c) => ({ c, s: Math.max(said.has(c.id) ? 75 : 0, ...tokens.map((t) => score2(c, t))) })).filter((x) => x.s > 0);
      scored.sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name, "zh-Hant"));
      list2 = scored.map((x) => x.c);
    }
    grid.toggleClass("is-named", tokens.length > 0);
    for (const c of list2) {
      const on = picks.includes(c.id);
      const t = h(grid, "button", "mn-face" + (on ? " is-pick" : ""));
      const im = h(t, "img");
      im.src = c.icon;
      im.alt = c.name;
      if (on) icon(h(t, "span", "mn-pick-ok"), "check");
      h(t, "span", "mn-face-n", c.name);
      holdTip(t, c.name);
      t.addEventListener("click", (e) => {
        e.preventDefault();
        pickFromSearch(c.id);
      });
    }
    if (!list2.length) empty(grid, { icon: "search-x", title: "\u627E\u4E0D\u5230\u9019\u500B\u540D\u5B57", text: "\u63DB\u500B\u8AAA\u6CD5\u518D\u8A66,\u6216\u770B\u4E0A\u9762\u7684\u300C\u4F60\u662F\u4E0D\u662F\u5728\u627E\u300D\u3002" });
  };
  const drawLanes = () => {
    lanes.empty();
    const known = store.hasLanes();
    for (const l of LANES) {
      const chipEl = laneChip(lanes, l, { on: lane === l, onTap: () => {
        if (!known) {
          tip(chipEl, "\u9084\u6C92\u6709\u5206\u8DEF\u8CC7\u6599");
          return;
        }
        lane = lane === l ? "" : l;
        drawLanes();
        drawGrid();
      } });
    }
  };
  search.addEventListener("input", () => {
    query = search.value;
    drawSuggest();
    drawGrid();
  });
  drawCount();
  drawLanes();
  drawGrid();
  return { title: "\u901F\u67E5", el };
}
function swipePage(ctx) {
  const store = ctx.plugin.store;
  const el = h(null, "div", "mn-page mn-deckpage");
  const all = store.champions();
  let picks = ctx.plugin.settings.roster.filter((id) => all.some((c) => c.id === id)).slice(0, MAX_PICKS);
  const recent = new Map((store.riotNotes[0]?.champions ?? []).map((e) => [e.name, entryDir(e)]));
  if (swipeSig !== picks.join(",")) {
    swipeSig = picks.join(",");
    swipeAt = 0;
    swipeLiked = [];
  }
  let at = swipeAt, liked = swipeLiked;
  const titleRow = h(el, "div", "mn-title-row");
  h(titleRow, "h1", "mn-title", "\u901F\u67E5");
  const results = h(el, "div", "mn-rq-results");
  const restart = () => {
    at = swipeAt = 0;
    liked = swipeLiked = [];
    drawResults();
  };
  const toggle = (id) => {
    picks = picks.filter((p) => p !== id);
    void ctx.plugin.setRoster(picks);
    swipeSig = picks.join(",");
    restart();
  };
  const card = (c, parent) => {
    const r = h(parent, "div", "mn-rq");
    const top = h(r, "div", "mn-rq-top");
    const im = h(top, "img", "mn-rq-img");
    im.src = c.icon;
    im.alt = "";
    const who = h(top, "div", "mn-rq-who");
    h(who, "div", "mn-rq-name", c.name);
    if (c.punch) h(who, "div", "mn-rq-punch", c.punch);
    const rm = h(top, "button", "mn-rq-x");
    icon(rm, "x");
    rm.setAttribute("aria-label", "\u79FB\u9664");
    rm.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(c.id);
    });
    const big = h(r, "div", "mn-rq-big");
    const main = c.damageType || c.skillDamage[0] || "";
    if (main) {
      const t = h(big, "div", "mn-rq-tile");
      const ic = h(t, "span", "mn-rq-tic");
      ic.style.setProperty("--c", DAMAGE_COLOR[main] ?? "var(--mn-muted)");
      icon(ic, DAMAGE_ICON[main] ?? "flame");
      const tx = h(t, "div");
      h(tx, "b", void 0, main === "\u7269\u7406" ? "\u7269\u653B" : main === "\u9B54\u6CD5" ? "\u9B54\u653B" : main);
      const also = c.skillDamage.filter((k) => k !== main);
      h(tx, "span", void 0, also.length ? `\u517C${also.join("\u3001")}` : `${main}\u50B7\u5BB3`);
    }
    if (c.roles.length) {
      const t = h(big, "div", "mn-rq-tile");
      const arts = h(t, "span", "mn-rq-arts");
      for (const role_ of c.roles.slice(0, 2)) roleArt(arts, role_);
      const tx = h(t, "div");
      h(tx, "b", void 0, c.roles.join(" \xB7 "));
      const rd = recent.get(c.name);
      if (rd) {
        const m = marker(rd);
        const x = h(tx, "span", "mn-rq-mark", `${m.mark} \u672C\u7248\u8ABF\u6574`);
        x.style.setProperty("--m", m.color);
      } else h(tx, "span", void 0, "\u5B9A\u4F4D");
    }
    if (c.soul) {
      const s = h(r, "div", "mn-rq-soul");
      const k = h(s, "div", "mn-rq-soul-k");
      icon(k, "flame");
      k.append("\u9748\u9B42");
      h(s, "p", void 0, c.soul);
    }
    const fold = (title, fill) => {
      const f = h(r, "div", "mn-rq-fold is-open");
      const head2 = h(f, "button", "mn-rq-fh");
      h(head2, "span", void 0, title);
      icon(head2, "chevron-right");
      const body = h(f, "div", "mn-rq-fb");
      fill(body);
      head2.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        f.toggleClass("is-open", !f.hasClass("is-open"));
      });
    };
    fold("\u6280\u80FD", (body) => {
      const list2 = h(body, "div", "mn-rq-plain");
      for (const key of ["P", "Q", "W", "E", "R"]) {
        const s = c.skills.find((x) => x.key === key);
        const text = c.plain[key];
        if (!s && !text) continue;
        keyBadge(list2, key, DAMAGE_COLOR[s?.damage[0] ?? ""] ?? "#6b7183");
        const cell = h(list2, "span");
        if (text) {
          cell.textContent = text;
          continue;
        }
        h(cell, "b", void 0, s.name);
        const what = [...s.damage.map((d) => `${d}\u50B7\u5BB3`), ...s.tags].join("\u3001");
        if (what) h(cell, "small", void 0, what);
      }
    });
    fold("\u8A73\u7D30", (body) => {
      factsStrip(body, c);
      tagRow(body, c, void 0, true);
    });
    r.addEventListener("click", () => ctx.openChampion(c.id));
    return r;
  };
  const drawResults = () => {
    results.empty();
    if (!picks.length) {
      empty(results, { icon: "users", title: "\u9084\u6C92\u9078\u82F1\u96C4" });
      return;
    }
    const head2 = h(results, "div", "mn-rq-head");
    const done = at >= picks.length;
    const progress = () => at >= picks.length ? `\u559C\u6B61\u7684\u82F1\u96C4 \xB7 ${liked.length}` : `${at + 1} / ${picks.length} \xB7 \u559C\u6B61 ${liked.length}`;
    const count2 = h(head2, "span", "mn-rq-count", progress());
    const clear = h(head2, "button", "mn-clear", "\u5168\u90E8\u6E05\u9664");
    clear.addEventListener("click", (e) => {
      e.preventDefault();
      picks = [];
      void ctx.plugin.setRoster(picks);
      swipeSig = "";
      ctx.pop();
    });
    if (done) {
      const box = h(results, "div", "mn-rq-end");
      const fitEnd = () => {
        const scroll = el.closest(".mn-scroll");
        if (!scroll || !box.isConnected) return;
        box.style.height = `${Math.max(240, scroll.clientHeight - (box.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop) - DECK_BELOW)}px`;
      };
      likedGrid(box);
      requestAnimationFrame(fitEnd);
      return;
    }
    const wrap = h(results, "div", "mn-deckwrap mn-rq-deck");
    const pager = h(wrap, "div", "mn-pager");
    for (const ev of ["touchstart", "touchmove"]) pager.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    const ids = picks.slice(at);
    const sec = [];
    const stamps = [];
    for (const id of ids) {
      const c = all.find((x) => x.id === id);
      if (!c) continue;
      const section2 = h(pager, "section", "mn-slide");
      const face = h(h(section2, "div", "mn-sl-card"), "div", "mn-sl-face mn-rq-face");
      card(c, face);
      const st = h(section2.firstElementChild, "div", "mn-rq-stamp");
      icon(st, "heart", "mn-rq-st-like");
      icon(st, "x", "mn-rq-st-pass");
      stamps.push(st);
      sec.push(section2);
    }
    const pile = cardPile(pager, sec, {
      judge: true,
      scroll: ".mn-rq-face",
      onLayout: (cur) => sec.forEach((c, i) => {
        c.style.visibility = i >= cur - 1 && i <= cur + 2 ? "" : "hidden";
      }),
      onDrag: (dx, w) => {
        const st = stamps[pile?.cur ?? 0];
        if (!st) return;
        const k = Math.min(1, Math.abs(dx) / (w * SWIPE.at));
        st.toggleClass("is-like", dx > 0);
        st.style.opacity = String(k);
        st.style.setProperty("--k", String(k));
      },
      onJudge: (i, like) => {
        at = ++swipeAt;
        if (like) swipeLiked = liked = [...liked, ids[i]];
        count2.textContent = progress();
      },
      onEnd: () => drawResults()
    });
    pile.layout(false);
    const fit = () => {
      const scroll = el.closest(".mn-scroll");
      if (!scroll || !wrap.isConnected) return;
      const top = wrap.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      wrap.style.height = `${Math.max(380, scroll.clientHeight - top - DECK_BELOW - BTN_ROOM)}px`;
    };
    requestAnimationFrame(fit);
    const btns = h(results, "div", "mn-rq-btns");
    const no = h(btns, "button", "mn-rq-no");
    icon(no, "x");
    no.setAttribute("aria-label", "\u7565\u904E");
    const yes = h(btns, "button", "mn-rq-yes");
    icon(yes, "heart");
    yes.setAttribute("aria-label", "\u559C\u6B61");
    no.addEventListener("click", (e) => {
      e.preventDefault();
      pile.decide(false);
    });
    yes.addEventListener("click", (e) => {
      e.preventDefault();
      pile.decide(true);
    });
  };
  const likedGrid = (results2) => {
    if (liked.length) {
      const g = h(results2, "div", "mn-rq-liked");
      for (const id of liked) {
        const c = all.find((x) => x.id === id);
        if (!c) continue;
        const b = h(g, "button", "mn-rq-lk");
        const im = h(b, "img");
        im.src = c.icon;
        im.alt = "";
        const who = h(b, "span", "mn-rq-lw");
        h(who, "b", void 0, c.name);
        const main = c.damageType || c.skillDamage[0] || "";
        h(who, "span", "mn-rq-ls", [c.roles.join(" \xB7 "), main && `${main}\u50B7`, c.range ? c.range >= 550 ? "\u9060\u7A0B" : c.range >= 300 ? "\u4E2D\u7A0B" : "\u8FD1\u6230" : ""].filter(Boolean).join(" \xB7 "));
        if (c.punch) h(who, "span", "mn-rq-lp", c.punch);
        const tags2 = c.features.slice(0, 6);
        if (tags2.length) h(who, "span", "mn-rq-lt", tags2.join(" \xB7 "));
        icon(b, "chevron-right", "mn-rq-lgo");
        b.addEventListener("click", (e) => {
          e.preventDefault();
          ctx.openChampion(c.id);
        });
      }
    } else empty(results2, { icon: "heart-off", title: "\u4E00\u500B\u90FD\u6C92\u559C\u6B61" });
    const again = h(results2, "button", "mn-rq-again");
    icon(again, "rotate-ccw");
    again.append("\u518D\u6ED1\u4E00\u6B21");
    again.addEventListener("click", (e) => {
      e.preventDefault();
      restart();
    });
  };
  drawResults();
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
    case "rosterswipe":
      return swipePage(ctx);
    default:
      return PAGES[tab](ctx);
  }
}

// src/view.ts
var VIEW_TYPE = "morellonomicon";
var OVERLAY_PAGES = /* @__PURE__ */ new Set(["champion"]);
var OVERLAY_SCROLL = 220;
var ARRIVE_MS = 240;
function fadeIn(im) {
  if (!im.src || im.complete) return;
  im.addClass("is-loading");
  const shown = () => im.removeClass("is-loading");
  im.addEventListener("load", shown, { once: true });
  im.addEventListener("error", shown, { once: true });
}
var VEIL_DELAY_MS = 250;
var VEIL_MIN_MS = 500;
var BOOT_PICTURES_MS = 7e3;
function arrive(page2, anim) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !page2.animate) return;
  const from = anim === "push" ? "translateX(28px)" : anim === "back" ? "translateX(-28px)" : "translateY(10px)";
  page2.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: ARRIVE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
}
var MnView = class extends import_obsidian9.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.scrolls = /* @__PURE__ */ new Map();
    this.shown = "";
    this.veil = null;
    this.veilSince = 0;
    // the loading veil over the page area
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
    app.toggleClass("is-full", import_obsidian9.Platform.isMobile);
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
    this.registerDomEvent(this.scrollEl, "scroll", () => this.markScrolled(), { passive: true });
    const late = new MutationObserver((list2) => {
      for (const m of list2) m.addedNodes.forEach((n) => {
        if (n instanceof HTMLImageElement) fadeIn(n);
        else if (n instanceof HTMLElement) n.querySelectorAll("img").forEach(fadeIn);
      });
    });
    late.observe(this.scrollEl, { childList: true, subtree: true });
    this.register(() => late.disconnect());
    this.tabsEl = h(app, "div", "mn-tabs");
    this.applyTheme();
    this.registerEvent(this.app.workspace.on("css-change", () => this.applyTheme()));
    preloadRoleIcons();
    this.buildTabs();
    this.draw();
  }
  async onClose() {
    this.scrolls.clear();
  }
  markScrolled() {
    const past = this.appEl.hasClass("is-overlay") ? OVERLAY_SCROLL : 36;
    this.topEl.toggleClass("is-scrolled", this.scrollEl.scrollTop > past);
    this.appEl.toggleClass("has-scrolled", this.scrollEl.scrollTop > 4);
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
    const menu = new import_obsidian9.Menu();
    for (const t of THEMES) menu.addItem((i) => i.setTitle(t.name).setChecked(this.plugin.settings.theme === t.id).onClick(() => {
      this.plugin.settings.theme = t.id;
      void this.plugin.saveTheme();
    }));
    menu.showAtMouseEvent(e);
  }
  modeMenu(e) {
    const menu = new import_obsidian9.Menu();
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
    slideSeg(this.tabsEl, "main-tabs", { item: ".mn-tab" });
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
    this.router.popToRoot();
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
    preloadRoleIcons();
    this.buildTabs();
    this.draw();
  }
  // The loading veil: a layer the size of the page area that blurs what is under it, with a band of light sliding across
  showVeil(immediate) {
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
      if (immediate) this.veil.addClass("is-in is-instant");
      else requestAnimationFrame(() => this.veil?.addClass("is-in"));
    }
    place();
    requestAnimationFrame(place);
  }
  hideVeil() {
    const v = this.veil;
    if (!v) return;
    this.veil = null;
    v.removeClass("is-instant");
    v.removeClass("is-in");
    window.setTimeout(() => v.remove(), 450);
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
    const page2 = out;
    const show = () => {
      if (id !== this.drawId) return;
      this.appEl.addClass("is-switching");
      this.appEl.removeClass("has-scrolled");
      this.topEl.removeClass("is-scrolled");
      releaseVideos(this.scrollEl);
      this.scrollEl.replaceChildren(page2.el);
      this.shown = key;
      const fresh = anim === "push" || OVERLAY_PAGES.has(f.key);
      if (fresh) this.scrolls.delete(key);
      this.scrollEl.scrollTo({ top: fresh ? 0 : this.scrolls.get(key) ?? 0, left: 0, behavior: "instant" });
      this.titleEl.textContent = page2.title;
      const titleRow = this.router.depth() === 0 ? page2.el.querySelector(":scope > .mn-title-row") : null;
      (titleRow ?? this.topEl).appendChild(this.actsEl);
      this.actsEl.toggleClass("is-hidden", !titleRow);
      this.topEl.toggleClass("has-back", this.router.depth() > 0);
      this.appEl.toggleClass("is-overlay", OVERLAY_PAGES.has(f.key));
      this.appEl.toggleClass("is-float", this.router.depth() === 0);
      this.appEl.toggleClass("is-sub", this.router.depth() > 0 && !OVERLAY_PAGES.has(f.key));
      this.markScrolled();
      requestAnimationFrame(() => requestAnimationFrame(() => this.appEl.removeClass("is-switching")));
      if (anim === "none") return;
      arrive(page2.el, anim);
    };
    const wait = page2.ready ?? null;
    if (!this.plugin.booted) {
      show();
      this.holdVeil(page2, this.plugin.whenBooted().then(() => page2.ready === void 0 ? whenLoaded(page2.el, BOOT_PICTURES_MS) : page2.ready).then(() => void 0), id);
      return;
    }
    if (!wait || anim === "none") {
      show();
      this.hideVeil();
      return;
    }
    const quick = Promise.race([wait.then(() => true), new Promise((r) => window.setTimeout(() => r(false), VEIL_DELAY_MS))]);
    void quick.then((loaded) => {
      if (id !== this.drawId) return;
      show();
      if (loaded) this.hideVeil();
      else this.holdVeil(page2, wait, id);
    });
  }
  // Puts the loading veil over the page until `until`, then (never sooner than half a second after it appeared) takes it off
  holdVeil(page2, until, id) {
    page2.el.addClass("mn-loading");
    this.showVeil(true);
    void until.then(() => {
      page2.el.removeClass("mn-loading");
      if (id !== this.drawId) return;
      window.setTimeout(() => {
        if (id === this.drawId) this.hideVeil();
      }, Math.max(0, VEIL_MIN_MS - (Date.now() - this.veilSince)));
    });
  }
};

// src/main.ts
var BOOT_QUIET_MS = 600;
var BOOT_MAX_MS = 6e3;
var MorellonomiconPlugin = class extends import_obsidian10.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    this.dataTimer = 0;
    // Start-up is over when the data files are read, the champion notes are indexed and nothing has changed for BOOT_QUIET_MS (the
    // page is rebuilt each time the data changes; the loading veil stays up until it stops), or after BOOT_MAX_MS
    this.booted = false;
    this.lastChange = Date.now();
    this.bootPromise = null;
  }
  whenBooted() {
    if (this.booted) return Promise.resolve();
    this.bootPromise ?? (this.bootPromise = new Promise((done) => {
      const t0 = Date.now();
      const tick = () => {
        const settled = this.store.ready && this.store.champions().length > 0 && Date.now() - this.lastChange > BOOT_QUIET_MS;
        if (settled || Date.now() - t0 > BOOT_MAX_MS) {
          this.booted = true;
          done();
        } else window.setTimeout(tick, 100);
      };
      tick();
    }));
    return this.bootPromise;
  }
  async onload() {
    preloadRoleIcons();
    await this.loadSettings();
    if (import_obsidian10.Platform.isMobile && this.settings.openOnStartup) document.body.addClass("mn-on", "mn-full");
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
    (0, import_obsidian10.setIcon)(this.home, "book-open");
    this.home.addEventListener("click", (e) => {
      e.preventDefault();
      void this.activate(false);
    });
    this.register(() => this.home.remove());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateBody()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.updateBody()));
    this.app.workspace.onLayoutReady(() => {
      void this.store.loadStats().then(() => {
        this.lastChange = Date.now();
        this.views().forEach((v) => v.refresh());
      });
      void this.whenBooted().then(() => warmPictures([...this.store.champions().map((c) => c.icon), ...this.store.augments().map((a) => a.icon)]));
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
    document.body.toggleClass("mn-full", on && import_obsidian10.Platform.isMobile);
    if (!import_obsidian10.Platform.isMobile) return;
    const v = ws.getActiveViewOfType(import_obsidian10.View);
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
    this.lastChange = Date.now();
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
      leaf = ws.getLeaf(startup || import_obsidian10.Platform.isMobile ? false : "tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await ws.revealLeaf(leaf);
    ws.setActiveLeaf(leaf, { focus: true });
    this.updateBody();
  }
  // A note in a tab of its own; a tab that already shows it is brought forward instead of opening a second one
  async openPath(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof import_obsidian10.TFile)) return;
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
