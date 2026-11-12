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
  default: () => VellumPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/editor.ts
var import_obsidian3 = require("obsidian");

// src/devices.ts
var DEVICES = [
  { id: "iphone-air", brand: "Apple", name: "iPhone Air", w: 420, h: 912, radius: 62, cut: "island", top: 68, bottom: 34, side: { left: 68, bottom: 21 } },
  { id: "iphone-16-pro", brand: "Apple", name: "iPhone 16 Pro / 17 / 17 Pro", w: 402, h: 874, radius: 62, cut: "island", top: 62, bottom: 34, side: { left: 62, bottom: 21 } },
  { id: "iphone-16-pro-max", brand: "Apple", name: "iPhone 16 Pro Max / 17 Pro Max", w: 440, h: 956, radius: 62, cut: "island", top: 62, bottom: 34, side: { left: 62, bottom: 21 } },
  { id: "iphone-16", brand: "Apple", name: "iPhone 16", w: 393, h: 852, radius: 55, cut: "island", top: 59, bottom: 34, side: { left: 59, bottom: 21 } },
  { id: "iphone-14", brand: "Apple", name: "iPhone 13 / 14", w: 390, h: 844, radius: 47, cut: "notch", top: 47, bottom: 34, side: { left: 47, bottom: 21 } },
  { id: "iphone-12-pro-max", brand: "Apple", name: "iPhone 12 Pro Max", w: 428, h: 926, radius: 53, cut: "notch", top: 47, bottom: 34, side: { left: 47, bottom: 21 } },
  { id: "iphone-12", brand: "Apple", name: "iPhone 12 / 12 Pro", w: 390, h: 844, radius: 47, cut: "notch", top: 47, bottom: 34, side: { left: 47, bottom: 21 } },
  { id: "iphone-12-mini", brand: "Apple", name: "iPhone 12 mini", w: 375, h: 812, radius: 44, cut: "notch", top: 50, bottom: 34, side: { left: 50, bottom: 21 } },
  { id: "iphone-se", brand: "Apple", name: "iPhone SE", w: 375, h: 667, radius: 0, cut: "none", top: 20, bottom: 0, side: { left: 0, bottom: 0 } },
  { id: "pixel-8", brand: "Google", name: "Pixel 8", w: 412, h: 915, radius: 40, cut: "hole", top: 32, bottom: 24, side: { left: 32, bottom: 24 } },
  { id: "galaxy-s24", brand: "Samsung", name: "Galaxy S24 / S25", w: 360, h: 780, radius: 36, cut: "hole", top: 32, bottom: 24, side: { left: 32, bottom: 24 } }
];
DEVICES.push({ id: "galaxy-s25-ultra", brand: "Samsung", name: "Galaxy S25 Ultra", w: 412, h: 891, radius: 24, cut: "hole", top: 32, bottom: 24, side: { left: 32, bottom: 24 } });
var customDevice = (w, h) => ({ id: `custom-${w}x${h}`, brand: "Custom", name: `Custom ${w} \xD7 ${h}`, w, h, radius: 40, cut: "none", top: 44, bottom: 24, side: { left: 0, bottom: 20 } });
var deviceOf = (id) => {
  const m = /^custom-(\d{3,4})x(\d{3,4})$/.exec(id ?? "");
  if (m) return customDevice(Number(m[1]), Number(m[2]));
  return DEVICES.find((d) => d.id === id) ?? DEVICES[0];
};
var screenOf = (d, side) => side ? { W: d.h, H: d.w, safe: { top: 0, left: d.side.left, right: d.side.left, bottom: d.side.bottom } } : { W: d.w, H: d.h, safe: { top: d.top, left: 0, right: 0, bottom: d.bottom } };

// src/model.ts
var GRAVITIES = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"];
var uid = () => Math.random().toString(36).slice(2, 8);
var parseDoc = (source) => {
  const empty = { id: uid(), device: "iphone-16-pro", pages: [] };
  if (!source.trim()) return { doc: empty };
  try {
    const v = JSON.parse(source);
    if (!v || typeof v !== "object" || !Array.isArray(v.pages)) return { doc: empty, error: "A vellum block is a JSON object with a pages list." };
    const ok = (list) => list.filter((b) => b && typeof b.x === "number").map((b) => ({ ...b, items: Array.isArray(b.items) ? b.items : [] }));
    const pages = v.pages.filter((p) => p && typeof p.id === "string" && Array.isArray(p.blocks)).map((p) => {
      const q = { ...p, name: String(p.name ?? "Page"), blocks: ok(p.blocks) };
      if (Array.isArray(p.land)) q.land = ok(p.land);
      else delete q.land;
      if (q.side) {
        if (!q.land) {
          q.land = q.blocks;
          q.blocks = [];
        }
        delete q.side;
      }
      if (q.inherit !== true) delete q.inherit;
      return q;
    });
    const doc = { id: typeof v.id === "string" ? v.id : uid(), device: typeof v.device === "string" ? v.device : empty.device, pages };
    const sf = insetsOf(v.safe), sl = insetsOf(v.safeLand);
    if (sf) doc.safe = sf;
    if (sl) doc.safeLand = sl;
    return { doc };
  } catch (e) {
    return { doc: empty, error: `The vellum JSON could not be read: ${e.message}` };
  }
};
var serialiseDoc = (d) => `{"id": ${JSON.stringify(d.id)}, "device": ${JSON.stringify(d.device)}, ` + (d.safe ? `"safe": ${JSON.stringify(d.safe)}, ` : "") + (d.safeLand ? `"safeLand": ${JSON.stringify(d.safeLand)}, ` : "") + `"pages": [
` + d.pages.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]}";
var insetsOf = (v) => {
  if (!v || typeof v !== "object") return void 0;
  const out = {};
  for (const k of ["top", "bottom", "left", "right"]) {
    const n = v[k];
    if (typeof n === "number" && n >= 0 && n <= 400) out[k] = n;
  }
  return Object.keys(out).length ? out : void 0;
};
var axes = (g = "tl") => [g.includes("l") ? -1 : g.includes("r") ? 1 : 0, g.includes("t") ? -1 : g.includes("b") ? 1 : 0];
var findItem = (items, id) => {
  for (const it of items) {
    if (it.id === id) return { item: it, list: items };
    if (it.items) {
      const f = findItem(it.items, id);
      if (f) return f;
    }
  }
  return null;
};
var cloneItem = (it) => ({ ...JSON.parse(JSON.stringify(it)), id: uid(), ...it.items ? { items: it.items.map(cloneItem) } : {} });
var newItem = (type) => {
  const id = uid();
  switch (type) {
    case "text":
      return { id, type, v: "Text", size: 15, g: "tl", dx: 16, dy: 16 };
    case "rect":
      return { id, type, g: "tl", dx: 16, dy: 16, w: 80, h: 48, fill: "tile", r: 8 };
    case "ellipse":
      return { id, type, g: "tl", dx: 16, dy: 16, w: 48, h: 48, fill: "tile" };
    case "line":
      return { id, type, g: "t", dx: 0, dy: 16, w: "fill", h: 1, fill: "line" };
    case "row":
      return { id, type, g: "tl", dx: 16, dy: 16, gap: 8, cross: "center", items: [{ id: uid(), type: "text", v: "One", size: 13 }, { id: uid(), type: "text", v: "Two", size: 13 }] };
    case "col":
      return { id, type, g: "tl", dx: 16, dy: 16, gap: 4, items: [{ id: uid(), type: "text", v: "Line one", size: 15 }, { id: uid(), type: "text", v: "Line two", size: 13, color: "dim" }] };
    case "img":
      return { id, type, g: "tl", dx: 16, dy: 16, w: 120, h: 80, src: "", fit: "cover", r: 8 };
    case "icon":
      return { id, type, g: "tl", dx: 16, dy: 16, name: "sparkles", size: 20 };
  }
};
var childrenOf = (pages, id) => pages.filter((p) => id ? p.parent === id : !p.parent || !pages.some((q) => q.id === p.parent));
var subtreeOf = (pages, id) => {
  const out = /* @__PURE__ */ new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of pages) if (p.parent && out.has(p.parent) && !out.has(p.id)) {
      out.add(p.id);
      grew = true;
    }
  }
  return out;
};
var frameOf = (pages, p) => p.inherit && p.parent ? pages.find((q) => q.id === p.parent && q.id !== p.id) : void 0;
var layersOf = (pages, p, land, seen = /* @__PURE__ */ new Set()) => {
  const own = (land ? p.land : p.blocks) ?? [], par = frameOf(pages, p);
  if (!par || seen.has(p.id)) return own.map((block) => ({ block }));
  seen.add(p.id);
  const base = layersOf(pages, par, land, seen).map((l) => ({ block: l.block, from: l.from ?? par.id }));
  const mine = new Map(own.map((b) => [b.id, b]));
  const out = base.map((l) => {
    const b = mine.get(l.block.id);
    return b ? { block: b, over: l.from } : l;
  });
  for (const b of own) if (!base.some((l) => l.block.id === b.id)) out.push({ block: b });
  return out;
};
var drawnBlocks = (pages, p, land) => layersOf(pages, p, land).map((l) => l.block);
var bgOf = (pages, p, seen = /* @__PURE__ */ new Set()) => {
  if (p.bg || seen.has(p.id)) return p.bg;
  seen.add(p.id);
  const f = frameOf(pages, p);
  return f ? bgOf(pages, f, seen) : void 0;
};

// src/render.ts
var import_obsidian = require("obsidian");
var BASE_THEME = {
  colors: {
    paper: "var(--background-primary)",
    text: "var(--text-normal)",
    dim: "var(--text-muted)",
    line: "var(--background-modifier-border)",
    tile: "var(--background-secondary)",
    loud: "var(--color-red)",
    accent: "var(--interactive-accent)"
  },
  fonts: { ui: "var(--font-interface)", display: "var(--font-interface)", mono: "var(--font-monospace)" }
};
var UI_COLORS = [
  { id: "panels", name: "Panels", group: "Surfaces", vars: ["--background-primary"] },
  { id: "side", name: "Side areas", group: "Surfaces", vars: ["--background-secondary"] },
  { id: "hover", name: "Hover", group: "Surfaces", vars: ["--background-modifier-hover"] },
  { id: "field", name: "Input boxes", group: "Surfaces", vars: ["--background-modifier-form-field"] },
  { id: "border", name: "Borders", group: "Lines", vars: ["--background-modifier-border"] },
  { id: "borderh", name: "Borders on hover", group: "Lines", vars: ["--background-modifier-border-hover"] },
  { id: "text", name: "Text", group: "Text", vars: ["--text-normal"] },
  { id: "muted", name: "Secondary text", group: "Text", vars: ["--text-muted"] },
  { id: "faint", name: "Faint text", group: "Text", vars: ["--text-faint"] },
  { id: "onaccent", name: "Text on accent", group: "Text", vars: ["--text-on-accent"] },
  { id: "accent", name: "Accent", group: "Accent", vars: ["--interactive-accent"] },
  { id: "accenth", name: "Accent hover", group: "Accent", vars: ["--interactive-accent-hover"] },
  { id: "red", name: "Warnings", group: "Signals", vars: ["--color-red", "--text-error"] },
  { id: "guide", name: "Snap guides", group: "Signals", vars: ["--vlu-guide"], follow: "var(--color-pink, #e93147)" }
  // its own variable: block kinds use Obsidian's pink too
];
var BASE_KINDS = [
  { id: "hero", icon: "hash", name: "summary / number", color: "var(--color-blue)" },
  { id: "nav", icon: "heading", name: "title / nav", color: "var(--text-faint)" },
  { id: "card", icon: "square", name: "card", color: "var(--color-purple)" },
  { id: "list", icon: "list", name: "list", color: "var(--color-yellow)" },
  { id: "tiles", icon: "layout-grid", name: "tiles / grid", color: "var(--color-green)" },
  { id: "action", icon: "pointer", name: "input / action", color: "var(--color-pink)" },
  { id: "float", icon: "layers", name: "floating", color: "var(--color-cyan)" }
];
var colorOf = (t, c) => !c || c === "none" ? "transparent" : t.colors[c] ?? c;
var fontOf = (t, f) => f ? t.fonts[f] ?? f : t.fonts.ui;
var resolve = (src) => src;
var setPictureResolver = (fn) => {
  resolve = fn;
};
var pictureUrl = (src) => {
  const s = (src ?? "").trim();
  return !s ? "" : /^(https?|data|app|blob|file):/i.test(s) ? s : resolve(s.replace(/^\/+/, ""));
};
var loaded = /* @__PURE__ */ new Set();
var applyLook = (t, s, o) => {
  const fill = o.fill && o.fill !== "none" ? colorOf(t, o.fill) : "";
  if (fill) s.background = fill;
  if (o.r) s.borderRadius = radiusOf(o.r);
  if (o.sw) {
    const c = colorOf(t, o.stroke ?? "line"), w = px(o.sw), sd = o.sides || "trbl";
    if (["t", "r", "b", "l"].every((x) => sd.includes(x))) {
      s.boxShadow = `inset 0 0 0 ${w} ${c}`;
      return;
    }
    const at = { t: `top / 100% ${w}`, b: `bottom / 100% ${w}`, l: `left / ${w} 100%`, r: `right / ${w} 100%` };
    const lines = ["t", "b", "l", "r"].filter((x) => sd.includes(x)).map((x) => `linear-gradient(${c}, ${c}) ${at[x]} no-repeat`);
    s.background = [...lines, fill].filter(Boolean).join(", ");
  }
};
var radiusOf = (r) => Array.isArray(r) ? [0, 1, 2, 3].map((i) => px(Number(r[i] ?? r[0]) || 0)).join(" ") : px(r ?? 0);
var px = (v) => `${Math.round(v * 100) / 100}px`;
var place = (el, it) => {
  const [ax, ay] = axes(it.g);
  const dx = it.dx ?? 0, dy = it.dy ?? 0, s = el.style;
  let tx = "0", ty = "0";
  if (it.w === "fill") {
    s.left = px(Math.abs(dx));
    s.right = px(Math.abs(dx));
  } else {
    if (ax < 0) s.left = px(dx);
    else if (ax > 0) s.right = px(dx);
    else {
      s.left = "50%";
      tx = `calc(-50% + ${px(dx)})`;
    }
    if (typeof it.w === "number") s.width = px(it.w);
  }
  if (it.h === "fill") {
    s.top = px(Math.abs(dy));
    s.bottom = px(Math.abs(dy));
  } else {
    if (ay < 0) s.top = px(dy);
    else if (ay > 0) s.bottom = px(dy);
    else {
      s.top = "50%";
      ty = `calc(-50% + ${px(dy)})`;
    }
    if (typeof it.h === "number") s.height = px(it.h);
  }
  if (tx !== "0" || ty !== "0") s.transform = `translate(${tx}, ${ty})`;
};
var flow = (el, it, dir) => {
  const main = dir === "row" ? it.w : it.h, cross = dir === "row" ? it.h : it.w, s = el.style;
  if (main === "fill") s.flex = "1 1 0";
  else if (typeof main === "number") s[dir === "row" ? "width" : "height"] = px(main);
  if (cross === "fill") s.alignSelf = "stretch";
  else if (typeof cross === "number") s[dir === "row" ? "height" : "width"] = px(cross);
  s.flexShrink = main === "fill" ? "1" : "0";
};
var drawItem = (t, parent, it, inFlow, lineUp = "left") => {
  const el = parent.createDiv({ cls: `vl-it vl-i-${it.type}`, attr: { "data-id": it.id } });
  if (inFlow) flow(el, it, inFlow);
  else {
    el.addClass("is-abs");
    place(el, it);
  }
  const s = el.style;
  if (it.op !== void 0 && it.op < 100) s.opacity = String(it.op / 100);
  switch (it.type) {
    case "text": {
      el.setText(it.v ?? "");
      s.fontFamily = fontOf(t, it.font);
      s.fontSize = px(it.size ?? 15);
      if (it.wt) s.fontWeight = String(it.wt);
      s.color = colorOf(t, it.color ?? "text");
      const ax = axes(it.g)[0];
      s.textAlign = inFlow ? lineUp : ax < 0 ? "left" : ax > 0 ? "right" : "center";
      if (it.ls) s.letterSpacing = `${it.ls}em`;
      s.lineHeight = String(it.lh ?? 1.2);
      if (it.upper) s.textTransform = "uppercase";
      s.whiteSpace = typeof it.w === "number" || it.w === "fill" ? "pre-wrap" : "pre";
      if (it.fill || it.sw || it.pad) {
        applyLook(t, s, it);
        if (it.pad) s.padding = px(it.pad);
        if (typeof it.h === "number" || it.h === "fill") {
          s.display = "flex";
          s.alignItems = "center";
          s.justifyContent = s.textAlign === "center" ? "center" : s.textAlign === "right" ? "flex-end" : "flex-start";
        }
      }
      break;
    }
    case "rect":
    case "ellipse": {
      s.background = colorOf(t, it.fill);
      if (it.sw) s.border = `${px(it.sw)} solid ${colorOf(t, it.stroke ?? "line")}`;
      s.borderRadius = it.type === "ellipse" ? "50%" : radiusOf(it.r);
      if (it.w === "hug" || it.w === void 0) s.width = "40px";
      if (it.h === "hug" || it.h === void 0) s.height = "40px";
      break;
    }
    case "line": {
      s.background = colorOf(t, it.fill ?? "line");
      if (it.h === "hug" || it.h === void 0) s.height = "1px";
      if (it.w === "hug" || it.w === void 0) s.width = "40px";
      break;
    }
    case "img": {
      s.borderRadius = radiusOf(it.r);
      if (it.w === "hug" || it.w === void 0) s.width = "80px";
      if (it.h === "hug" || it.h === void 0) s.height = "80px";
      (0, import_obsidian.setIcon)(el.createDiv({ cls: "vl-imgph" }), "image");
      const url = pictureUrl(it.src);
      if (!url) break;
      const im = el.createEl("img", { attr: { alt: "", draggable: "false", decoding: "async" } });
      im.style.objectFit = it.fit ?? "cover";
      im.style.objectPosition = it.pos?.trim() || "center";
      const ok = () => {
        loaded.add(url);
        el.addClass("is-loaded");
      };
      const bad = () => {
        loaded.delete(url);
        im.remove();
        el.removeClass("is-loaded");
        el.addClass("is-broken");
        const ph = el.querySelector(".vl-imgph");
        if (ph) {
          ph.empty();
          (0, import_obsidian.setIcon)(ph, "image-off");
        }
      };
      im.addEventListener("load", ok, { once: true });
      im.addEventListener("error", bad, { once: true });
      if (loaded.has(url)) el.addClass("is-loaded");
      im.src = url;
      if (im.complete && im.naturalWidth) ok();
      break;
    }
    case "icon": {
      const sz = px(it.size ?? 20);
      s.width = sz;
      s.height = sz;
      s.color = colorOf(t, it.color ?? "text");
      s.setProperty("--icon-size", sz);
      if (it.sw) s.setProperty("--icon-stroke", px(it.sw));
      const name = (it.name ?? "").trim();
      if (name) (0, import_obsidian.setIcon)(el, name);
      if (!el.querySelector("svg")) {
        el.empty();
        el.addClass("is-unknown");
        el.setText("?");
      }
      break;
    }
    case "row":
    case "col": {
      s.display = "flex";
      s.flexDirection = it.type === "row" ? "row" : "column";
      s.gap = px(it.gap ?? 0);
      if (it.pad) s.padding = px(it.pad);
      s.alignItems = { start: "flex-start", center: "center", end: "flex-end" }[it.cross ?? "start"];
      s.justifyContent = { start: "flex-start", center: "center", end: "flex-end", between: "space-between" }[it.main ?? "start"];
      if (it.fill) s.background = colorOf(t, it.fill);
      if (it.sw) s.border = `${px(it.sw)} solid ${colorOf(t, it.stroke ?? "line")}`;
      if (it.r) s.borderRadius = radiusOf(it.r);
      const up = it.type === "col" ? { start: "left", center: "center", end: "right" }[it.cross ?? "start"] : "left";
      for (const c of it.items ?? []) drawItem(t, el, c, it.type, up);
      break;
    }
  }
  if (!inFlow) el.setAttr("data-top", "1");
  return el;
};

// src/local.ts
var app = null;
var useApp = (a) => {
  app = a;
};
var getLocal = (key) => {
  try {
    const v = app?.loadLocalStorage(key);
    if (v !== null && v !== void 0) return typeof v === "string" ? v : JSON.stringify(v);
    const old = window.localStorage.getItem(key);
    if (old !== null && app) {
      app.saveLocalStorage(key, old);
      window.localStorage.removeItem(key);
    }
    return old;
  } catch {
    return null;
  }
};
var setLocal = (key, value) => {
  try {
    app?.saveLocalStorage(key, value);
  } catch {
  }
};

// src/store.ts
var import_obsidian2 = require("obsidian");
var srcOf = (source) => {
  const m = /^\s*src:\s*(.+?)\s*$/m.exec(source);
  return m && !source.trim().startsWith("{") ? (0, import_obsidian2.normalizePath)(m[1].replace(/^["']|["']$/g, "")) : null;
};
var DOC = "_doc.json";
var pageText = (p) => {
  const { blocks, land, ...meta } = p;
  const list = (l) => l.length ? "[\n" + l.map((b) => "  " + JSON.stringify(b)).join(",\n") + "\n]" : "[]";
  return `${JSON.stringify(meta).slice(0, -1)}, "blocks": ${list(blocks)}` + (land ? `, "land": ${list(land)}` : "") + "}\n";
};
var fileName = (name) => name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "Screen";
var FolderStore = class {
  // our own writes, not outside changes
  constructor(app2, dir) {
    this.app = app2;
    this.dir = dir;
    this.files = /* @__PURE__ */ new Map();
    // page id → its file, as loaded or last saved
    this.ownUntil = 0;
  }
  watches(path) {
    return path === this.dir || path.startsWith(this.dir + "/");
  }
  async load() {
    const folder = this.app.vault.getAbstractFileByPath(this.dir);
    this.files.clear();
    const id = this.dir.split("/").pop() || uid();
    if (!(folder instanceof import_obsidian2.TFolder)) return { doc: { id, device: "iphone-16-pro", pages: [] } };
    let meta = {};
    const pages = [], bad = [];
    for (const f of folder.children) {
      if (!(f instanceof import_obsidian2.TFile) || f.extension !== "json") continue;
      const text = await this.app.vault.read(f);
      if (f.name === DOC) {
        try {
          meta = JSON.parse(text);
        } catch {
          bad.push(f.name);
        }
        continue;
      }
      const { doc: doc2, error } = parseDoc(`{"pages": [${text}]}`);
      if (error || !doc2.pages[0]) {
        bad.push(f.name);
        continue;
      }
      pages.push(doc2.pages[0]);
      this.files.set(doc2.pages[0].id, f.path);
    }
    const order = meta.order ?? [];
    const at = (p) => {
      const i = order.indexOf(p.id);
      return i < 0 ? order.length : i;
    };
    pages.sort((a, b) => at(a) - at(b) || a.name.localeCompare(b.name));
    const doc = { id: meta.id ?? id, device: meta.device ?? "iphone-16-pro", pages };
    const sf = insetsOf(meta.safe), sl = insetsOf(meta.safeLand);
    if (sf) doc.safe = sf;
    if (sl) doc.safeLand = sl;
    return { doc, error: bad.length ? `Not read (fix the JSON): ${bad.join(", ")}` : void 0 };
  }
  async save(doc) {
    const v = this.app.vault;
    this.ownUntil = Date.now() + 2e3;
    if (!(v.getAbstractFileByPath(this.dir) instanceof import_obsidian2.TFolder)) await v.createFolder(this.dir);
    const ours = new Set(this.files.values()), target = /* @__PURE__ */ new Map(), taken = /* @__PURE__ */ new Set();
    for (const p of doc.pages) {
      const base = fileName(p.name);
      let path = (0, import_obsidian2.normalizePath)(`${this.dir}/${base}.json`), n = 2;
      while (taken.has(path) || v.getAbstractFileByPath(path) && !ours.has(path)) path = (0, import_obsidian2.normalizePath)(`${this.dir}/${base} ${n++}.json`);
      taken.add(path);
      target.set(p.id, path);
    }
    for (const p of doc.pages) {
      const path = target.get(p.id), f = v.getAbstractFileByPath(path), text = pageText(p);
      if (f instanceof import_obsidian2.TFile) {
        if (await v.read(f) !== text) await v.modify(f, text);
      } else await v.create(path, text);
    }
    for (const path of ours) {
      if (taken.has(path)) continue;
      const f = v.getAbstractFileByPath(path);
      if (f instanceof import_obsidian2.TFile) await this.app.fileManager.trashFile(f);
    }
    this.files = target;
    const meta = JSON.stringify({ id: doc.id, device: doc.device, safe: doc.safe, safeLand: doc.safeLand, order: doc.pages.map((p) => p.id) }, null, 2) + "\n";
    const m = v.getAbstractFileByPath(`${this.dir}/${DOC}`);
    if (m instanceof import_obsidian2.TFile) {
      if (await v.read(m) !== meta) await v.modify(m, meta);
    } else await v.create(`${this.dir}/${DOC}`, meta);
    this.ownUntil = Date.now() + 1500;
  }
};

// src/editor.ts
var SNAP_DEFAULT = { on: true, dist: 6, grid: 4, margins: [16], frame: true, others: true, guides: true };
var snap = { ...SNAP_DEFAULT };
var keepSnap = () => {
};
var setSnap = (c, save) => {
  snap = c;
  keepSnap = save;
};
var grid = () => Math.max(1, snap.grid || 1);
var EDIT_DEFAULT = { arrow: 1, hold: true };
var editCfg = { ...EDIT_DEFAULT };
var setEdit = (c) => {
  editCfg = c;
};
var near = (pts, lines, reach) => {
  let best = null;
  for (const q of pts) for (const l of lines) {
    const d = l - q;
    if (Math.abs(d) <= reach && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: l };
  }
  return best;
};
var toD = (a, L, W, bw) => Math.round(a < 0 ? L : a > 0 ? bw - L - W : L + W / 2 - bw / 2);
var view = /* @__PURE__ */ new Map();
var reopen = /* @__PURE__ */ new Map();
var VIEW = "vellum-editor";
var editors = /* @__PURE__ */ new Map();
var live = /* @__PURE__ */ new Set();
var windows = /* @__PURE__ */ new Map();
var VellumWindow = class extends import_obsidian3.ItemView {
  constructor() {
    super(...arguments);
    this.key = "";
  }
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return "Vellum" + (this.key ? " \xB7 " + (this.key.split(":")[1] ?? "").replace(/\.md$/, "") : "");
  }
  getIcon() {
    return "vellum";
  }
  getState() {
    return { key: this.key };
  }
  async setState(state, result) {
    const k = state?.key ?? "";
    if (k && k !== this.key) {
      this.key = k;
      windows.set(k, this);
      const ed = editors.get(k) ?? (k.includes(".md:") ? void 0 : await folderEditor(k.replace(/^vellum:/, "")));
      if (ed) ed.mount(this.contentEl);
      else {
        this.contentEl.empty();
        this.contentEl.createDiv({ cls: "vl-err", text: "Open the note with this Vellum block, then Open editor." });
      }
    }
    return super.setState(state, result);
  }
  async onClose() {
    if (windows.get(this.key) === this) windows.delete(this.key);
    editors.get(this.key)?.unmount();
  }
};
var raise = (win) => {
  const ew = win.electronWindow;
  try {
    if (ew?.isMinimized?.()) ew.restore?.();
    ew?.show?.();
    ew?.moveTop?.();
    ew?.focus?.();
  } catch {
  }
  win.focus();
};
var Editor = class {
  // store: the folder the doc is kept in (src: in the block), with the doc as read; none = the JSON in the block itself
  // el / ctx: the ```vellum block it is drawn in; none = opened straight on a folder (the ribbon, a command)
  constructor(plugin, host, source, el, ctx, store, loaded2) {
    this.plugin = plugin;
    this.el = el;
    this.ctx = ctx;
    this.store = store;
    this.past = [];
    this.future = [];
    this.sel = null;
    this.pending = null;
    this.panel = null;
    this.tab = "style";
    this.root = null;
    // the theme's colours as --vl-* on an element (the card in the note, the workspace on the body)
    // the look from the host. The editor's own colours are set as Obsidian's variables on the editor, which the screens inside
    // it would inherit: a screen colour that names a changed variable reads a copy of Obsidian's value instead (--vlr--…)
    this.ui = {};
    this.stale = null;
    this.railTop = 0;
    // a screen as a small picture (the rail's rows): drawn again only when the screen changed
    this.thumbs = /* @__PURE__ */ new Map();
    this.keepTop = 0;
    // while dragging: only the numbers change (the panel stays as it is)
    this.liveText = /* @__PURE__ */ new Map();
    this.getters = /* @__PURE__ */ new Map();
    this.colorMode = getLocal("vellum:colorMode") || "hex";
    // the picker: a panel floating by its bar. The colour square (saturation across, brightness down), the hue and opacity
    // bars, then the exact value (hex or any CSS colour, or RGB / HSL numbers), then recent colours.
    // Each drag or typed change is one undo step; a tap anywhere else, or Esc, closes it
    this.picker = null;
    // "Opened from": the field shows where the screen sits; its list is the screens rail's tree, with a search. Screens that
    // can't be chosen (this one, those under it: a loop) stay in the list and say why
    this.parentClose = null;
    this.howKept = /* @__PURE__ */ new Map();
    this.lookFrom(host);
    this.kinds = host.kinds ?? BASE_KINDS;
    const { doc, error } = loaded2 ?? parseDoc(source);
    this.doc = doc;
    this.saved = serialiseDoc(doc);
    this.card = el ? el.createDiv({ cls: "vl vl-card" }) : createDiv({ cls: "vl vl-card" });
    if (error && !store) {
      this.card.createDiv({ cls: "vl-err", text: error + " Fix it in the source view." });
      return;
    }
    if (error) new import_obsidian3.Notice(`Vellum (${store.dir}): ${error}`);
    const draft = this.draftGet();
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.doc && d.base === this.saved) this.doc = d.doc;
        else if (d.doc) this.stale = d.doc;
        else if (d.pages) this.stale = d;
      } catch {
      }
    }
    this.paint(this.card);
    const onResize = () => {
      if (this.root?.isConnected && this.v.fit) this.drawPages();
    };
    window.addEventListener("resize", onResize);
    const key = this.draftKey();
    editors.set(key, this);
    live.add(this);
    if (!el || !ctx) return;
    const life = new import_obsidian3.MarkdownRenderChild(el);
    life.onunload = () => {
      window.removeEventListener("resize", onResize);
      if (editors.get(key) === this) editors.delete(key);
      live.delete(this);
      if (!this.root?.isConnected) return;
      reopen.set(key, { at: Date.now(), sel: this.sel, past: this.past, future: this.future });
      this.root.remove();
      this.root = null;
      if (!import_obsidian3.Platform.isMobile) window.setTimeout(() => {
        if (!editors.has(key)) windows.get(key)?.leaf.detach();
      }, 3e3);
    };
    ctx.addChild(life);
    this.drawCard();
    const back = reopen.get(key);
    if (back && Date.now() - back.at < 3e3) {
      reopen.delete(key);
      this.past = back.past;
      this.future = back.future;
      this.sel = back.sel;
      this.fixSel();
      const w = windows.get(key);
      if (w) this.mount(w.contentEl);
      else if (import_obsidian3.Platform.isMobile) this.openWs();
    }
  }
  lookFrom(host) {
    this.ui = { ...host.ui };
    const changed = new Set(UI_COLORS.filter((u) => this.ui[u.id]).flatMap((u) => u.vars));
    const colors = { ...BASE_THEME.colors, ...host.theme?.colors };
    for (const k of Object.keys(colors)) colors[k] = colors[k].replace(/var\((--[\w-]+)/g, (m, v) => changed.has(v) ? `var(--vlr${v}` : m);
    this.theme = { colors, fonts: { ...BASE_THEME.fonts, ...host.theme?.fonts } };
  }
  paintLook(e) {
    for (const c of Object.keys(this.theme.colors)) e.style.setProperty(`--vl-${c}`, this.theme.colors[c]);
    const obsidian = getComputedStyle(e.doc.body), own = e === this.root;
    for (const u of UI_COLORS) for (const name of u.vars) {
      if (this.ui[u.id]) {
        e.style.setProperty(`--vlr${name}`, obsidian.getPropertyValue(name).trim());
        if (own) e.style.setProperty(name, this.ui[u.id]);
      } else {
        e.style.removeProperty(`--vlr${name}`);
        if (own) e.style.removeProperty(name);
      }
    }
  }
  // the settings changed (or Obsidian's theme): the open editor takes them at once
  relook(host) {
    this.lookFrom(host);
    this.paintLook(this.card);
    if (!this.root) {
      this.drawCard();
      return;
    }
    this.paintLook(this.root);
    this.thumbs.clear();
    this.drawPanel();
    this.drawPages();
  }
  paint(e) {
    this.paintLook(e);
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart", "dblclick"]) e.addEventListener(ev, (x) => x.stopPropagation());
  }
  // ---- state, undo, drafts, save
  get v() {
    return view.get(this.doc.id) ?? { zoom: 0.75, fit: true, show: false, rail: !import_obsidian3.Platform.isMobile && window.innerWidth >= 1e3 };
  }
  setView(p) {
    view.set(this.doc.id, { ...this.v, ...p });
  }
  snap() {
    return JSON.stringify(this.doc);
  }
  get dirty() {
    return serialiseDoc(this.doc) !== this.saved;
  }
  draftKey() {
    return this.store ? `vellum:${this.store.dir}` : `vellum:${this.ctx.sourcePath}:${this.doc.id}`;
  }
  draftGet() {
    try {
      return getLocal(this.draftKey());
    } catch {
      return null;
    }
  }
  draftPut() {
    try {
      if (this.dirty) setLocal(this.draftKey(), JSON.stringify({ base: this.saved, doc: this.doc }));
      else if (!this.stale) setLocal(this.draftKey(), null);
    } catch {
    }
  }
  // a discrete change: one undo step
  edit(fn, panel = true) {
    const s = this.snap();
    fn();
    this.commit(s, panel);
  }
  // a continuous change (typing, dragging, scrubbing): begin once, apply many, end once
  begin() {
    if (this.pending === null) this.pending = this.snap();
  }
  end() {
    if (this.pending !== null) {
      const s = this.pending;
      this.pending = null;
      this.commit(s, false);
    }
  }
  commit(before, panel) {
    const was = serialiseDoc(JSON.parse(before)) !== this.saved;
    if (before !== this.snap()) {
      this.past.push(before);
      this.future = [];
    }
    this.draftPut();
    this.drawPages();
    if (panel) this.drawPanel();
    else this.drawBar();
    if (!was && this.dirty) this.hint("Unsaved: kept on this device until you save", void 0, false);
  }
  // a short note under the Save button for a few seconds (floats: nothing moves)
  // a short note by the button it is about (else under Save): a mark and a few words, gone after a moment
  hint(text, at, ok = true) {
    const R = this.root;
    if (!R?.isConnected) return;
    R.querySelector(".vl-hint")?.remove();
    const a = at?.isConnected ? at : this.bar?.querySelector(".is-savebtn");
    const h = R.createDiv({ cls: "vl-hint" + (ok ? " is-ok" : "") });
    (0, import_obsidian3.setIcon)(h.createSpan({ cls: "vl-hinti" }), ok ? "check" : "info");
    h.createSpan({ text });
    if (a) {
      const rr = R.getBoundingClientRect(), ar = a.getBoundingClientRect();
      h.style.top = `${ar.bottom - rr.top + 8}px`;
      const left = Math.min(rr.width - h.offsetWidth - 8, Math.max(8, ar.left - rr.left + ar.width / 2 - h.offsetWidth / 2));
      h.style.left = `${left}px`;
      h.style.setProperty("--arrow", `${ar.left - rr.left + ar.width / 2 - left}px`);
    }
    window.setTimeout(() => h.addClass("is-out"), 1800);
    window.setTimeout(() => h.remove(), 2200);
  }
  undo() {
    const s = this.past.pop();
    if (!s) return;
    this.future.push(this.snap());
    this.doc = JSON.parse(s);
    this.fixSel();
    this.draftPut();
    this.draw();
  }
  redo() {
    const s = this.future.pop();
    if (!s) return;
    this.past.push(this.snap());
    this.doc = JSON.parse(s);
    this.fixSel();
    this.draftPut();
    this.draw();
  }
  save() {
    if (this.store) {
      const text2 = serialiseDoc(this.doc), st = this.store;
      st.save(this.doc).then(() => {
        this.saved = text2;
        try {
          setLocal(this.draftKey(), null);
        } catch {
        }
        this.drawBar();
        this.drawCard();
        this.hint(`Saved to ${st.dir}`);
      }, (e) => new import_obsidian3.Notice(`Vellum: not saved (${e.message}). Your work is kept.`));
      return;
    }
    if (!this.ctx || !this.el) return;
    const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    const info = this.ctx.getSectionInfo(this.el);
    if (!(file instanceof import_obsidian3.TFile) || !info) {
      new import_obsidian3.Notice("Vellum: could not find this block in the note");
      return;
    }
    const text = serialiseDoc(this.doc);
    void this.plugin.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      if (lines[info.lineStart]?.trim() !== "```vellum" || !lines[info.lineEnd]?.trim().startsWith("```")) {
        new import_obsidian3.Notice("Vellum: the note changed, not saved. Your work is kept; reopen the note.");
        return data;
      }
      lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...text.split("\n"));
      this.saved = text;
      try {
        setLocal(this.draftKey(), null);
      } catch {
      }
      window.setTimeout(() => {
        this.drawBar();
        this.drawCard();
        this.hint("Saved into the note");
      });
      return lines.join("\n");
    });
  }
  // the folder changed outside (the agent, a sync): taken as it is; unsaved work here is offered back, never lost
  async outside() {
    if (!this.store) return;
    const { doc } = await this.store.load(), text = serialiseDoc(doc);
    if (text === this.saved) return;
    if (this.dirty) this.stale = this.doc;
    this.doc = doc;
    this.saved = text;
    this.fixSel();
    this.draftPut();
    this.drawCard();
    if (this.root?.isConnected) this.draw();
  }
  // ---- what is chosen
  page(id = this.sel?.page) {
    return this.doc.pages.find((p) => p.id === id);
  }
  block() {
    const p = this.page();
    return p ? this.blocks(p).find((b) => b.id === this.sel?.block) : void 0;
  }
  // the layout on show: portrait, or landscape (a screen may have none yet: make = start an empty one)
  get land() {
    return !!this.v.land;
  }
  blocks(p, make = false) {
    if (!this.land) return p.blocks;
    if (!p.land && make) p.land = [];
    return p.land ?? [];
  }
  // landscape from portrait: full-width blocks stretch to the new width, the rest keep their place under the status bar;
  // each keeps its id (a block of a frame and its overrides are the same block in both layouts)
  makeLand(p) {
    this.edit(() => {
      const up = this.screen(p, false), sd = this.screen(p, true);
      const roomUp = up.W - up.safe.left - up.safe.right, roomSd = sd.W - sd.safe.left - sd.safe.right;
      p.land = p.blocks.map((b) => {
        const c = JSON.parse(JSON.stringify(b));
        const m = b.x - up.safe.left, wide = b.w >= roomUp - 2 * m - 4;
        c.x = sd.safe.left + m;
        c.w = wide ? Math.max(8, roomSd - 2 * m) : b.w;
        c.y = Math.max(sd.safe.top, b.y - up.safe.top);
        return c;
      });
    });
  }
  // a page's screen as drawn: the device's, with the safe areas set for this doc (upright / sideways)
  screen(p, land = this.land) {
    const sc = screenOf(deviceOf(p.device ?? this.doc.device), land), o = land ? this.doc.safeLand : this.doc.safe;
    return { ...sc, safe: { ...sc.safe, ...o } };
  }
  // the room a block keeps to: inside the safe areas, or the whole screen when it may go under the bars (bleed)
  room(p, b) {
    const { W, H, safe } = this.screen(p);
    return b?.bleed ? { l: 0, t: 0, r: W, b: H } : { l: safe.left, t: safe.top, r: W - safe.right, b: H - safe.bottom };
  }
  // the blocks drawn on a page (its frame's under its own) in the layout on show; layer(): the chosen one among them
  layers(p) {
    return layersOf(this.doc.pages, p, this.land);
  }
  layer() {
    const p = this.page();
    return p && this.sel?.block ? this.layers(p).find((l) => l.block.id === this.sel?.block) : void 0;
  }
  item() {
    const b = this.block();
    return b && this.sel?.item ? findItem(b.items, this.sel.item) : null;
  }
  choose(s) {
    this.sel = s;
    this.drawPanel();
    this.drawPages();
  }
  fixSel() {
    if (!this.page()) this.sel = null;
    else if (this.sel?.block && !this.layer()) this.sel = { page: this.sel.page };
    else if (this.sel?.item && !this.item()) this.sel = { page: this.sel.page, block: this.sel.block };
  }
  // ---- the card in the note: the screens as a small map, Open
  drawCard() {
    const c = this.card;
    c.empty();
    const head = c.createDiv({ cls: "vl-chead" });
    const t = head.createDiv({ cls: "vl-ctitle" });
    t.createSpan({ cls: "vl-cname", text: "Vellum" });
    t.createSpan({ cls: "vl-cinfo", text: `${this.doc.pages.length} screen${this.doc.pages.length === 1 ? "" : "s"} \xB7 ${deviceOf(this.doc.device).name}` + (this.store ? ` \xB7 ${this.store.dir}` : "") + (this.dirty ? " \xB7 unsaved edits on this device" : "") });
    const o = head.createEl("button", { cls: "vl-open mod-cta" });
    (0, import_obsidian3.setIcon)(o.createSpan(), "pencil-ruler");
    o.appendText("Open editor");
    o.addEventListener("click", () => this.openWs());
    const m = c.createDiv({ cls: "vl-map" });
    this.drawMap(m);
  }
  // ---- the workspace: over the whole window; top bar, screens rail, the stage with the phone in its middle, the panel
  // computer: its own window (a pop-out, focused if already open); phone: over the whole screen
  openWs(page) {
    if (page) this.setView({ page, fit: true });
    if (import_obsidian3.Platform.isMobile) {
      if (!this.root?.isConnected) this.mount(activeDocument.body);
      else this.draw();
      return;
    }
    const key = this.draftKey();
    const w = windows.get(key) ?? this.plugin.app.workspace.getLeavesOfType(VIEW).map((l) => l.view).find((v) => v instanceof VellumWindow && v.key === key);
    if (w) {
      if (page) this.draw();
      void this.plugin.app.workspace.revealLeaf(w.leaf);
      raise(w.contentEl.win);
      return;
    }
    const leaf = this.plugin.app.workspace.openPopoutLeaf({ size: { width: 1280, height: 880 } });
    void leaf.setViewState({ type: VIEW, active: true, state: { key } }).then(() => {
      const ew = leaf.view.containerEl.win.electronWindow;
      try {
        ew?.maximize?.();
      } catch {
      }
    });
  }
  mount(container) {
    this.root?.remove();
    container.empty();
    const pop = container !== container.doc.body;
    const R = this.root = container.createDiv({ cls: "vl vl-ws" + (import_obsidian3.Platform.isMobile ? " is-phone" : "") + (pop ? " is-pop" : ""), attr: { tabindex: "-1" } });
    this.paint(R);
    const onKey = (e) => {
      if (!R.isConnected) return R.win.removeEventListener("keydown", onKey, true);
      const a = R.doc.activeElement;
      if (a && (R === a || R.contains(a))) this.key(e);
    };
    R.win.addEventListener("keydown", onKey, true);
    if (pop) {
      let raf = 0;
      new ResizeObserver(() => {
        if (!R.isConnected) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (this.v.fit && this.pending === null) this.drawPages();
        });
      }).observe(R);
    }
    this.draw();
    R.focus({ preventScroll: true });
  }
  unmount() {
    this.end();
    this.root?.remove();
    this.root = null;
    this.panel = null;
    this.drawCard();
  }
  closeWs() {
    const w = windows.get(this.draftKey());
    if (w && !import_obsidian3.Platform.isMobile) w.leaf.detach();
    else this.unmount();
  }
  draw() {
    const R = this.root;
    if (!R) return;
    R.empty();
    this.panel = null;
    this.bar = R.createDiv({ cls: "vl-top" });
    this.drawStale();
    const body = R.createDiv({ cls: "vl-body" });
    this.rail = body.createDiv({ cls: "vl-rail" });
    this.rail.addEventListener("click", (e) => {
      if (e.target === this.rail) {
        this.setView({ rail: false });
        this.draw();
      }
    });
    const mid = body.createDiv({ cls: "vl-mid" });
    this.wall = mid.createDiv({ cls: "vl-stage" });
    this.wall.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, { x: e.clientX, y: e.clientY });
    }, { passive: false });
    this.wall.addEventListener("click", (e) => {
      if (e.target === this.wall && this.sel) this.choose(null);
    });
    this.zbar = mid.createDiv({ cls: "vl-zbar" });
    this.side = import_obsidian3.Platform.isMobile ? R : body;
    this.drawPanel();
    this.drawPages();
  }
  // unsaved work from before the note changed: offered back, never applied by itself
  drawStale() {
    if (!this.stale || !this.root) return;
    const s = this.root.createDiv({ cls: "vl-stale" });
    s.createSpan({ text: "The note changed since your unsaved edits on this device. The note is shown." });
    const keep = s.createEl("button", { text: "Restore my edits" });
    keep.addEventListener("click", () => {
      const d = this.stale;
      this.stale = null;
      this.edit(() => {
        this.doc = d;
      });
      this.draw();
    });
    const drop = s.createEl("button", { text: "Drop them" });
    drop.addEventListener("click", () => {
      this.stale = null;
      try {
        setLocal(this.draftKey(), null);
      } catch {
      }
      this.draw();
    });
  }
  // the page in the editor: the one opened (or chosen), else the first
  current() {
    return this.doc.pages.find((p) => p.id === (this.v.page ?? this.sel?.page)) ?? this.doc.pages[0];
  }
  openPage(p) {
    this.setView({ page: p.id });
    this.sel = null;
    if (import_obsidian3.Platform.isMobile) this.setView({ rail: false });
    this.draw();
  }
  // the top bar: close and where you are on the left, undo / redo / save on the right; nothing else
  drawBar() {
    const b = this.bar;
    if (!b?.isConnected) return;
    b.empty();
    const l = b.createDiv({ cls: "vl-tl" });
    if (import_obsidian3.Platform.isMobile) this.btn(l, "x", "Close the editor", () => this.closeWs()).addClass("vl-x");
    const cur = this.current();
    if (import_obsidian3.Platform.isMobile) {
      const rt = l.createEl("button", { cls: "vl-railbtn" + (this.v.rail ? " is-on" : ""), attr: { "aria-label": "Screens" } });
      (0, import_obsidian3.setIcon)(rt.createSpan(), "layers");
      rt.createSpan({ cls: "vl-pg", text: cur?.name ?? "No screens" });
      (0, import_obsidian3.setIcon)(rt.createSpan({ cls: "vl-chev" }), "chevron-down");
      rt.addEventListener("click", () => {
        this.setView({ rail: !this.v.rail });
        this.draw();
      });
    } else {
      this.btn(l, this.v.rail ? "sidebar-left" : "vellum-side-left", this.v.rail ? "Collapse the screens" : "Expand the screens", () => {
        this.setView({ rail: !this.v.rail });
        this.draw();
      }).addClass("vl-side-toggle");
      l.createSpan({ cls: "vl-pg vl-pgname", text: cur?.name ?? "No screens" });
    }
    const r = b.createDiv({ cls: "vl-tr" });
    this.btn(r, "settings", "Vellum settings (colours, fonts, snapping)", () => {
      const set = this.plugin.app.setting;
      if (!set) return;
      set.open();
      set.openTabById(this.plugin.manifest.id);
      const up = () => raise(set.win ?? window);
      up();
      for (const ms of [120, 400]) window.setTimeout(up, ms);
    });
    this.btn(r, "undo-2", "Undo (Ctrl+Z)", () => this.undo(), !this.past.length);
    this.btn(r, "redo-2", "Redo (Ctrl+Shift+Z)", () => this.redo(), !this.future.length);
    const sv = r.createEl("button", { cls: "vl-save is-savebtn" + (this.dirty ? " is-dirty" : ""), attr: { "aria-label": "Save into the note (Ctrl+S)" } });
    (0, import_obsidian3.setIcon)(sv.createSpan(), this.dirty ? "save" : "check");
    sv.appendText(this.dirty ? "Save" : "Saved");
    sv.addEventListener("click", () => {
      if (this.dirty) this.save();
    });
    if (!import_obsidian3.Platform.isMobile && !this.v.show && !this.v.map) {
      r.createSpan({ cls: "vl-zsep" });
      this.btn(r, this.v.panel === false ? "vellum-side-right" : "sidebar-right", this.v.panel === false ? "Expand the settings" : "Collapse the settings", () => {
        this.setView({ panel: this.v.panel === false });
        this.draw();
      }).addClass("vl-side-toggle");
    }
    this.drawZoom();
  }
  // the pill at the foot of the stage: Edit / Show, zoom, fit
  drawZoom() {
    const z = this.zbar;
    if (!z?.isConnected) return;
    z.empty();
    if (!this.doc.pages.length) return;
    const pill = z.createDiv({ cls: "vl-zpill" });
    const seg = pill.createDiv({ cls: "vl-seg" });
    const mode = this.v.map ? "map" : this.v.show ? "show" : "edit";
    for (const [label2, m] of [["Edit", "edit"], ["Show", "show"], ["Map", "map"]]) {
      const x = seg.createEl("button", { text: label2, cls: mode === m ? "is-on" : "", attr: { "aria-label": m === "map" ? "Every screen as a tree" : m === "show" ? "The screen alone" : "Frames and safe areas" } });
      x.addEventListener("click", () => {
        if (mode === m) return;
        this.setView({ show: m === "show", map: m === "map" });
        if (m !== "edit") this.sel = null;
        this.draw();
      });
    }
    pill.createSpan({ cls: "vl-zsep" });
    const ori = pill.createDiv({ cls: "vl-seg is-ori" });
    for (const [land, icon, label2] of [[false, "rectangle-vertical", "Portrait"], [true, "rectangle-horizontal", "Landscape"]]) {
      const x = ori.createEl("button", { cls: this.land === land ? "is-on" : "", attr: { "aria-label": label2 } });
      (0, import_obsidian3.setIcon)(x, icon);
      if (!x.querySelector("svg")) x.setText(label2);
      x.addEventListener("click", () => {
        if (this.land === land) return;
        this.setView({ land });
        this.sel = null;
        this.thumbs.clear();
        this.draw();
      });
    }
    if (!this.v.map && !this.v.show) {
      this.btn(pill, "magnet", snap.on ? "Snapping on: to edges, middles and other items (Alt while dragging: off; details in Settings \u2192 Vellum)" : "Snapping off: the grid only", () => {
        snap.on = !snap.on;
        keepSnap();
        this.drawZoom();
      }).toggleClass("is-on", snap.on);
    }
    pill.createSpan({ cls: "vl-zsep" });
    this.btn(pill, "minus", "Zoom out (Ctrl+wheel)", () => this.zoomBy(1 / 1.25));
    pill.createSpan({ cls: "vl-zoom", text: `${Math.round((this.v.map ? this.v.mapZoom ?? 1 : this.v.zoom) * 100)}%` });
    this.btn(pill, "plus", "Zoom in (Ctrl+wheel)", () => this.zoomBy(1.25));
    const fitOn = this.v.map ? this.v.mapFit !== false : this.v.fit;
    const fit = pill.createEl("button", { cls: "vl-zfit" + (fitOn ? " is-on" : ""), text: "Fit", attr: { "aria-label": "Fit to the window" } });
    fit.addEventListener("click", () => {
      this.setView(this.v.map ? { mapFit: true } : { fit: true });
      this.drawPages();
    });
  }
  // at: the pointer (Ctrl+wheel): the spot under it stays under it. Its place in the map or the phone, as a fraction,
  // before the zoom; after the redraw the stage scrolls that place back under the pointer (content that fits stays centred)
  zoomBy(f, at) {
    const sel = this.v.map ? ".vl-mapbox" : ".vl-phone";
    const r0 = at ? this.wall?.querySelector(sel)?.getBoundingClientRect() : void 0;
    if (this.v.map) this.setView({ mapFit: false, mapZoom: Math.min(3, Math.max(0.3, Math.round((this.v.mapZoom ?? 1) * f * 100) / 100)) });
    else this.setView({ fit: false, zoom: Math.min(4, Math.max(0.2, Math.round(this.v.zoom * f * 100) / 100)) });
    this.drawPages();
    const r1 = r0 ? this.wall?.querySelector(sel)?.getBoundingClientRect() : void 0;
    if (!at || !r0 || !r1 || !r0.width || !r0.height) return;
    const u = (at.x - r0.left) / r0.width, v = (at.y - r0.top) / r0.height;
    this.wall.scrollLeft += r1.left + u * r1.width - at.x;
    this.wall.scrollTop += r1.top + v * r1.height - at.y;
  }
  // a new main page, or one opened from a page
  addPage(parent) {
    this.edit(() => {
      const n = { id: uid(), name: "New page", blocks: [{ id: uid(), name: "Title", kind: "nav", x: 16, y: 64, w: 370, h: 48, items: [{ id: uid(), type: "text", v: "Title", size: 30, wt: 800, font: "display", g: "l", dx: 0 }] }] };
      const pages = this.doc.pages;
      if (parent) {
        n.parent = parent.id;
        pages.splice(pages.indexOf(parent) + 1, 0, n);
      } else pages.push(n);
      this.sel = { page: n.id };
      this.setView({ page: n.id });
    });
    this.draw();
  }
  btn(parent, icon, label2, act, off = false) {
    const x = parent.createEl("button", { cls: "vl-btn" + (off ? " is-off" : ""), attr: { "aria-label": label2 } });
    (0, import_obsidian3.setIcon)(x, icon);
    x.addEventListener("click", () => {
      if (!off) act();
    });
    return x;
  }
  drawPages() {
    if (!this.wall?.isConnected) return;
    const sx = this.wall.scrollLeft, sy = this.wall.scrollTop, keep = () => {
      this.wall.scrollLeft = sx;
      this.wall.scrollTop = sy;
    };
    this.wall.empty();
    if (!this.doc.pages.length) {
      const e = this.wall.createDiv({ cls: "vl-empty" });
      e.createSpan({ text: "No screens yet." });
      e.createEl("button", { cls: "vl-act", text: "+ Add a screen" }).addEventListener("click", () => this.addPage());
    }
    this.drawRail();
    if (this.v.map && this.doc.pages.length) {
      const box = this.wall.createDiv({ cls: "vl-stagemap" });
      const pick = (p) => {
        this.setView({ map: false, page: p.id });
        this.sel = null;
        this.draw();
      };
      const BASE = 110, room = this.wall.clientWidth - 64;
      let tw = BASE * (this.v.mapZoom ?? 1);
      if (this.v.mapFit !== false) {
        const { slots, rows } = this.drawMap(box, BASE, pick), d = deviceOf(this.doc.device), ratio = d.h / d.w;
        const byW = room / Math.max(1, slots) - 40, byH = ((this.wall.clientHeight - 150) / Math.max(1, rows) - 86) / ratio;
        tw = Math.max(48, Math.min(200, Math.floor(Math.min(byW, byH))));
        this.setView({ mapZoom: Math.round(tw / BASE * 100) / 100 });
      }
      this.drawMap(box, tw, pick);
      this.drawZoom();
      keep();
      return;
    }
    const cur = this.current();
    if (cur) {
      if (this.v.fit) {
        const dev = deviceOf(cur.device ?? this.doc.device), { W, H } = screenOf(dev, this.land);
        const ph = import_obsidian3.Platform.isMobile;
        const sw = this.wall.clientWidth - (ph ? 44 : 64), sh = this.wall.clientHeight - (ph ? 100 : 120);
        if (sw > 0 && sh > 0) view.set(this.doc.id, { ...this.v, zoom: Math.max(0.2, Math.min(2, Math.floor(Math.min(sw / W, sh / H) * 100) / 100)) });
      }
      this.drawPage(cur);
    }
    this.drawZoom();
    keep();
  }
  // the screens rail: every page as a row, sub pages indented under the page they open from (with how you get there);
  // a tap opens it, + beside a row adds a page opened from it; the device for the whole note at the foot
  drawRail() {
    const r = this.rail;
    if (!r?.isConnected) return;
    this.unpeek();
    r.empty();
    r.toggleClass("is-on", this.v.rail);
    if (!this.v.rail) return;
    if (!import_obsidian3.Platform.isMobile) {
      r.style.width = `${Number(getLocal("vellum:railW")) || 248}px`;
      const g = r.createDiv({ cls: "vl-rgrip" });
      g.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        g.setPointerCapture(e.pointerId);
        g.addClass("is-on");
        const x0 = e.clientX, w0 = r.offsetWidth;
        const tw0 = this.picW(w0);
        const mv = (m) => {
          const w = Math.min(560, Math.max(180, w0 + m.clientX - x0));
          r.style.width = `${w}px`;
          r.style.setProperty("--vl-pz", String(this.picW(w) / tw0));
        };
        const up = () => {
          g.removeEventListener("pointermove", mv);
          g.removeEventListener("pointerup", up);
          g.removeClass("is-on");
          try {
            setLocal("vellum:railW", String(r.offsetWidth));
          } catch {
          }
          r.style.removeProperty("--vl-pz");
          this.drawPages();
        };
        g.addEventListener("pointermove", mv);
        g.addEventListener("pointerup", up);
      });
    }
    const box = r.createDiv({ cls: "vl-railbox" });
    box.addEventListener("scroll", () => {
      this.railTop = box.scrollTop;
      this.unpeek();
    }, { passive: true });
    box.addEventListener("mouseleave", () => this.unpeek());
    const pics = getLocal("vellum:pics") === "1";
    const hd = box.createDiv({ cls: "vl-railhead" });
    hd.createDiv({ cls: "vl-sech", text: `Screens \xB7 ${this.doc.pages.length}` });
    this.btn(hd, "image", pics ? "Hide the pictures" : "Show a picture of each screen", () => {
      try {
        setLocal("vellum:pics", pics ? "0" : "1");
      } catch {
      }
      this.drawRail();
    }).toggleClass("is-on", pics);
    const list = box.createDiv({ cls: "vl-plist" });
    const pages = this.doc.pages, cur = this.current(), seen = /* @__PURE__ */ new Set(), fold = this.folds();
    const row = (p, depth) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const kids = childrenOf(pages, p.id).filter((c) => !seen.has(c.id));
      if (p.link && depth) {
        const ed = list.createDiv({ cls: "vl-pedge" });
        const gi = ed.createDiv({ cls: "vl-pind" });
        for (let i = 0; i < depth; i++) gi.createSpan({ cls: "vl-pguide" });
        (0, import_obsidian3.setIcon)(ed.createSpan({ cls: "vl-pedgei" }), "corner-down-right");
        ed.createSpan({ cls: "vl-pedget", text: p.link });
      }
      const w = list.createDiv({ cls: "vl-prow" + (p.id === cur?.id ? " is-on" : "") + (p.mock ? " is-mock" : "") });
      const ind = w.createDiv({ cls: "vl-pind" });
      for (let i = 0; i < depth; i++) ind.createSpan({ cls: "vl-pguide" });
      if (kids.length) {
        const ch = w.createEl("button", { cls: "vl-pchev", attr: { "aria-label": fold.has(p.id) ? "Unfold" : "Fold" } });
        (0, import_obsidian3.setIcon)(ch, fold.has(p.id) ? "chevron-right" : "chevron-down");
        ch.addEventListener("click", (e) => {
          e.stopPropagation();
          if (fold.has(p.id)) fold.delete(p.id);
          else fold.add(p.id);
          this.keepFolds(fold);
          this.drawRail();
        });
      } else w.createSpan({ cls: "vl-pchev is-leaf" });
      if (pics) w.appendChild(this.thumb(p));
      this.peekOn(w, p);
      const t = w.createDiv({ cls: "vl-ptext" });
      t.createDiv({ cls: "vl-pn", text: p.name + (p.mock ? " \xB7 mock" : "") });
      if (p.link && !depth) t.createDiv({ cls: "vl-pl", text: p.link });
      w.addEventListener("click", () => this.openPage(p));
      const add = this.btn(w, "plus", `Add a screen opened from ${p.name}`, () => this.addPage(p));
      add.addClass("vl-padd");
      add.addEventListener("click", (e) => e.stopPropagation());
      if (!fold.has(p.id)) for (const c of kids) row(c, depth + 1);
      else for (const c of subtreeOf(pages, p.id)) if (c !== p.id) seen.add(c);
    };
    for (const p of childrenOf(pages)) row(p, 0);
    for (const p of pages) row(p, 0);
    const na = box.createEl("button", { cls: "vl-act vl-newp" });
    (0, import_obsidian3.setIcon)(na.createSpan(), "plus");
    na.appendText("New Screen");
    na.addEventListener("click", () => this.addPage());
    const foot = box.createDiv({ cls: "vl-rfoot" });
    foot.createDiv({ cls: "vl-sech", text: "Device" });
    const devc = deviceOf(this.doc.device);
    const dev = foot.createEl("button", { cls: "vl-dev" });
    dev.createSpan({ text: devc.name });
    (0, import_obsidian3.setIcon)(dev.createSpan({ cls: "vl-chev" }), "chevron-down");
    dev.addEventListener("click", () => {
      const R = this.root;
      const open = R.querySelector(".vl-menu");
      if (open) {
        open.remove();
        return;
      }
      const m = R.createDiv({ cls: "vl-menu" });
      const rr = R.getBoundingClientRect(), dr = dev.getBoundingClientRect();
      m.style.left = `${dr.left - rr.left}px`;
      m.style.bottom = `${rr.bottom - dr.top + 4}px`;
      let brand = "";
      for (const d of DEVICES) {
        if (d.brand !== brand) {
          brand = d.brand;
          m.createDiv({ cls: "vl-menuh", text: brand });
        }
        const it = m.createEl("button", { cls: "vl-menui" + (d.id === devc.id ? " is-on" : "") });
        it.createSpan({ text: d.name });
        it.createSpan({ cls: "vl-devsz", text: `${d.w}\xD7${d.h} \xB7 ${d.cut === "none" ? "home button" : d.cut}` });
        it.addEventListener("click", () => {
          m.remove();
          if (d.id !== this.doc.device) this.edit(() => {
            this.doc.device = d.id;
          });
        });
      }
      m.createDiv({ cls: "vl-menuh", text: "Custom" });
      const cu = m.createDiv({ cls: "vl-custom" });
      const now = deviceOf(this.doc.device);
      const wi = cu.createEl("input", { attr: { type: "number", min: "240", max: "1600", placeholder: "W", value: devc.brand === "Custom" ? String(now.w) : "" } });
      cu.createSpan({ text: "\xD7" });
      const hi = cu.createEl("input", { attr: { type: "number", min: "320", max: "2400", placeholder: "H", value: devc.brand === "Custom" ? String(now.h) : "" } });
      const ok = cu.createEl("button", { cls: "vl-act", text: "Use" });
      ok.addEventListener("click", () => {
        const w = Math.round(Number(wi.value)), h = Math.round(Number(hi.value));
        if (!(w >= 240 && w <= 1600 && h >= 320 && h <= 2400)) {
          new import_obsidian3.Notice("Vellum: a width of 240\u20131600 and a height of 320\u20132400 points");
          return;
        }
        m.remove();
        this.edit(() => {
          this.doc.device = customDevice(w, h).id;
        });
      });
      const off = (e) => {
        if (!m.isConnected) return R.doc.removeEventListener("pointerdown", off, true);
        if (!m.contains(e.target) && !dev.contains(e.target)) {
          m.remove();
          R.doc.removeEventListener("pointerdown", off, true);
        }
      };
      window.setTimeout(() => R.doc.addEventListener("pointerdown", off, true));
    });
    box.scrollTop = this.railTop;
  }
  // a large look at a screen without opening it: the pointer resting on its row (computer), a long press (phone)
  peekOn(row, p) {
    let t = 0;
    if (!import_obsidian3.Platform.isMobile) {
      row.addEventListener("mouseenter", () => this.peek(p, row));
      row.addEventListener("mouseleave", () => this.unpeek());
      row.addEventListener("pointerdown", () => this.unpeek());
      return;
    }
    let shown = false;
    row.addEventListener("pointerdown", () => {
      shown = false;
      t = window.setTimeout(() => {
        shown = true;
        this.peek(p, row);
      }, 450);
    });
    const off = () => {
      window.clearTimeout(t);
      if (shown) window.setTimeout(() => this.unpeek(), 0);
    };
    row.addEventListener("pointerup", off);
    row.addEventListener("pointercancel", off);
    row.addEventListener("pointerleave", off);
    row.addEventListener("click", (e) => {
      if (shown) {
        e.stopImmediatePropagation();
        e.preventDefault();
        shown = false;
      }
    }, true);
    row.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  peek(p, row, beside) {
    const R = this.root;
    if (!R?.isConnected) return;
    this.unpeek();
    const W = import_obsidian3.Platform.isMobile ? Math.min(300, R.clientWidth * 0.72) : 240;
    const box = R.createDiv({ cls: "vl-peek" });
    box.createDiv({ cls: "vl-peekname", text: p.name });
    box.appendChild(this.pic(p, W));
    const rr = R.getBoundingClientRect(), wr = row.getBoundingClientRect(), br = this.rail.getBoundingClientRect();
    if (import_obsidian3.Platform.isMobile) {
      box.style.left = `${(rr.width - W) / 2 - 8}px`;
      box.style.top = `${Math.max(56, (rr.height - box.offsetHeight) / 2)}px`;
    } else {
      box.style.left = `${beside ? Math.max(8, beside.getBoundingClientRect().left - rr.left - box.offsetWidth - 10) : br.right - rr.left + 10}px`;
      box.style.top = `${Math.max(8, Math.min(rr.height - box.offsetHeight - 8, wr.top - rr.top - 40))}px`;
    }
  }
  unpeek() {
    this.root?.querySelectorAll(".vl-peek").forEach((e) => e.remove());
  }
  // a screen drawn small, as it looks (no frames)
  pic(p, TW) {
    const d = deviceOf(p.device ?? this.doc.device), sc = screenOf(d, this.land), k = TW / sc.W;
    const el = createDiv({ cls: "vl-pthumb" });
    el.style.width = `${TW}px`;
    el.style.height = `${Math.round(sc.H * k)}px`;
    el.style.borderRadius = `${Math.max(3, d.radius * k)}px`;
    const scr = el.createDiv({ cls: "vl-screen is-show" });
    Object.assign(scr.style, { width: `${sc.W}px`, height: `${sc.H}px`, transform: `scale(${k})` });
    const bg = bgOf(this.doc.pages, p);
    if (bg) scr.style.background = colorOf(this.theme, bg);
    const keep = this.sel;
    this.sel = null;
    for (const b of drawnBlocks(this.doc.pages, p, this.land)) this.drawBlock(scr, p, b, true);
    this.sel = keep;
    return el;
  }
  // the tree's pictures are as big as its width allows: 22 px at the narrowest, up to 180 px
  picW(railW) {
    return Math.round(Math.min(180, Math.max(22, (railW - 190) * 0.9)));
  }
  // folded branches of the tree, kept on the device per doc
  folds() {
    try {
      return new Set(JSON.parse(getLocal(`vellum:fold:${this.draftKey()}`) ?? "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  keepFolds(f) {
    try {
      setLocal(`vellum:fold:${this.draftKey()}`, JSON.stringify([...f]));
    } catch {
    }
  }
  thumb(p) {
    const tw = this.picW(this.rail?.offsetWidth || Number(getLocal("vellum:railW")) || 248);
    const sig = JSON.stringify(p) + JSON.stringify(drawnBlocks(this.doc.pages, p, this.land)) + bgOf(this.doc.pages, p) + this.doc.device + tw + this.land, hit = this.thumbs.get(p.id);
    if (hit && hit.sig === sig) return hit.el;
    const el = this.pic(p, tw);
    this.thumbs.set(p.id, { sig, el });
    return el;
  }
  // the map in the note's card: every page as a small screen; main pages along the top, each page's sub pages under it,
  // joined by lines (with how you get there); a click opens the editor on that page
  // TW: a screen's width in the map; pick: what a click does (the card: open the editor there); returns the slots across
  drawMap(m, TW = 76, pick = (p) => this.openWs(p.id)) {
    m.empty();
    if (!this.doc.pages.length) {
      m.createDiv({ cls: "vl-empty", text: "No screens yet: open the editor to add one." });
      return { slots: 0, rows: 0 };
    }
    const pages = this.doc.pages, cur = this.root?.isConnected ? this.current() : void 0;
    const GAP = 40, LABEL = 46, slotW = TW + GAP;
    const dims = (p) => {
      const d = deviceOf(p.device ?? this.doc.device), sc = screenOf(d, this.land);
      const k = TW / Math.max(sc.W, d.w);
      return { k, w: sc.W * k, h: sc.H * k, d, sc };
    };
    const rowH = Math.max(...pages.map((p) => dims(p).h)) + LABEL + GAP;
    const pos = /* @__PURE__ */ new Map();
    let depthMax = 0;
    const place2 = (p, depth, x0, seen2) => {
      if (seen2.has(p.id)) return 0;
      seen2.add(p.id);
      depthMax = Math.max(depthMax, depth);
      const kids = childrenOf(pages, p.id);
      let x2 = x0;
      for (const c of kids) x2 += place2(c, depth + 1, x2, seen2);
      const w = Math.max(1, x2 - x0);
      pos.set(p.id, { x: x0 + (w - 1) / 2, y: depth });
      return w;
    };
    let x = 0;
    const seen = /* @__PURE__ */ new Set();
    for (const r of childrenOf(pages)) x += place2(r, 0, x, seen);
    for (const p of pages) if (!pos.has(p.id)) x += place2(p, 0, x, seen);
    const box = m.createDiv({ cls: "vl-mapbox" });
    box.style.width = `${x * slotW}px`;
    box.style.height = `${(depthMax + 1) * rowH - GAP + 4}px`;
    const NS = "http://www.w3.org/2000/svg";
    const svg = m.doc.createElementNS(NS, "svg");
    svg.setAttribute("class", "vl-maplines");
    svg.setAttribute("width", String(x * slotW));
    svg.setAttribute("height", String((depthMax + 1) * rowH - GAP + 4));
    box.appendChild(svg);
    const at = (p) => {
      const q = pos.get(p.id), d = dims(p);
      return { cx: q.x * slotW + slotW / 2, top: q.y * rowH, h: d.h };
    };
    for (const p of pages) {
      const par = pages.find((q) => q.id === p.parent);
      if (!par || !pos.has(par.id)) continue;
      const a = at(par), b = at(p);
      const y0 = a.top + a.h + 26, midY = y0 + 8;
      const path = m.doc.createElementNS(NS, "path");
      path.setAttribute("d", `M${a.cx} ${y0} V${midY} H${b.cx} V${b.top - 2}`);
      svg.appendChild(path);
      if (p.link) {
        const t = box.createDiv({ cls: "vl-maplink", text: p.link });
        t.style.left = `${b.cx}px`;
        t.style.maxWidth = `${slotW}px`;
        t.style.top = `${b.top - 19}px`;
      }
    }
    const keep = this.sel;
    this.sel = null;
    for (const p of pages) {
      const q = pos.get(p.id), d = dims(p);
      const t = box.createDiv({ cls: "vl-thumb" + (p.mock ? " is-mock" : "") + (p.parent ? "" : " is-main") });
      t.style.left = `${q.x * slotW + (slotW - d.w) / 2}px`;
      t.style.top = `${q.y * rowH}px`;
      t.style.width = `${d.w}px`;
      const ph = t.createDiv({ cls: "vl-tphone" });
      ph.style.height = `${d.h}px`;
      ph.style.borderRadius = `${d.d.radius * d.k}px`;
      const scr = ph.createDiv({ cls: "vl-screen is-show" });
      const bg = bgOf(pages, p);
      if (bg) {
        scr.style.background = colorOf(this.theme, bg);
        ph.style.background = scr.style.background;
      }
      Object.assign(scr.style, { width: `${d.sc.W}px`, height: `${d.sc.H}px`, transform: `scale(${d.k})` });
      for (const b of drawnBlocks(pages, p, this.land)) this.drawBlock(scr, p, b, true);
      t.createDiv({ cls: "vl-tname", text: p.name });
      t.addEventListener("click", () => pick(p));
      if (p.id === cur?.id) t.addClass("is-on");
    }
    this.sel = keep;
    return { slots: x, rows: depthMax + 1 };
  }
  drawPage(p) {
    const dev = deviceOf(p.device ?? this.doc.device), { W, H, safe } = this.screen(p), z = this.v.zoom, show = this.v.show;
    const fig = this.wall.createDiv({ cls: "vl-page" + (p.mock ? " is-mock" : "") + (this.sel?.page === p.id ? " is-sel" : "") });
    fig.createDiv({ cls: "vl-pname", text: p.name + (p.mock ? "  \xB7 mock" : "") });
    const phone = fig.createDiv({ cls: "vl-phone" });
    phone.style.width = `${W * z}px`;
    phone.style.height = `${H * z}px`;
    phone.style.borderRadius = `${dev.radius * z}px`;
    const scr = phone.createDiv({ cls: "vl-screen" + (show ? " is-show" : "") });
    const bg = bgOf(this.doc.pages, p);
    if (bg) {
      scr.style.background = colorOf(this.theme, bg);
      phone.style.background = scr.style.background;
    }
    Object.assign(scr.style, { width: `${W}px`, height: `${H}px`, transform: `scale(${z})`, borderRadius: `${dev.radius}px` });
    if (!this.land) {
      const sb = scr.createDiv({ cls: "vl-status" });
      sb.style.height = `${dev.top}px`;
      const cutW = dev.cut === "island" ? 125 : dev.cut === "notch" ? 209 : 0;
      sb.style.setProperty("--ear", `${(W - cutW) / 2}px`);
      sb.createDiv({ cls: "vl-ear" }).createSpan({ cls: "vl-time", text: "9:41" });
      const r = sb.createDiv({ cls: "vl-ear" });
      const bars = r.createSvg("svg", { cls: "vl-bars", attr: { viewBox: "0 0 18 12", width: 18, height: 12 } });
      for (const [x, y, h] of [[0, 7.5, 4.5], [5, 5, 7], [10, 2.5, 9.5], [15, 0, 12]]) bars.createSvg("rect", { attr: { x, y, width: 3, height: h, rx: 1 } });
      r.createSpan({ cls: "vl-net", text: "5G" });
      const batt = r.createSvg("svg", { cls: "vl-batt", attr: { viewBox: "0 0 28 13", width: 28, height: 13 } });
      batt.createSvg("rect", { attr: { x: 0.5, y: 0.5, width: 24, height: 12, rx: 3.8, fill: "none", stroke: "currentColor", opacity: 0.4 } });
      batt.createSvg("rect", { attr: { x: 2, y: 2, width: 16, height: 9, rx: 2.4 } });
      batt.createSvg("path", { attr: { d: "M26 4.5v4a2.2 2.2 0 0 0 0-4z", opacity: 0.45 } });
    }
    if (dev.cut !== "none") scr.createDiv({ cls: `vl-cut is-${dev.cut}` + (this.land ? " is-side" : "") });
    if (safe.bottom) scr.createDiv({ cls: "vl-home" });
    if (!show) {
      for (const [k, v] of Object.entries(safe)) if (v) {
        const s = scr.createDiv({ cls: `vl-safe is-${k}` });
        s.style[k === "top" || k === "bottom" ? "height" : "width"] = `${v}px`;
      }
    }
    const layers = this.layers(p);
    for (const l of layers) this.drawBlock(scr, p, l.block, show, show ? void 0 : l);
    if (this.land && !p.land && !layers.length) {
      const mk = scr.createDiv({ cls: "vl-mkland" });
      mk.createDiv({ text: "No landscape layout yet" });
      const go = mk.createEl("button", { cls: "mod-cta", text: "Make landscape from portrait" });
      go.addEventListener("click", (e) => {
        e.stopPropagation();
        this.makeLand(p);
      });
      go.addEventListener("pointerdown", (e) => e.stopPropagation());
      return;
    }
    if (!show) scr.addEventListener("pointerdown", (e) => this.down(e, p, scr));
    if (!show) scr.addEventListener("dblclick", (e) => this.typeInPlace(e, p));
  }
  // one block again, in its place (a drag keeps its screen element, which holds the pointer)
  redrawBlock(scr, p, b) {
    const old = scr.querySelector(`[data-block="${b.id}"]`);
    const el = this.drawBlock(scr, p, b, false, this.layers(p).find((l) => l.block === b));
    if (old) old.replaceWith(el);
  }
  // l (editing): where the block comes from: a frame's (inherited: faded, locked) or an override of one (a small mark)
  drawBlock(scr, p, b, show, l) {
    const kind = this.kinds.find((k) => k.id === b.kind) ?? this.kinds[0];
    const sel = this.sel?.page === p.id && this.sel.block === b.id;
    const inh = !!l?.from && !l.over;
    const el = scr.createDiv({ cls: "vl-block" + (sel ? " is-sel" : "") + (inh ? " is-inh" : "") + (l?.over ? " is-over" : ""), attr: { "data-block": b.id } });
    Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    applyLook(this.theme, el.style, b);
    el.style.setProperty("--k", kind?.color ?? "var(--text-faint)");
    if (!show) {
      const tag = el.createDiv({ cls: "vl-tag" });
      if (inh) (0, import_obsidian3.setIcon)(tag.createSpan({ cls: "vl-tagi" }), "lock");
      tag.appendText(b.name + (inh ? ` \xB7 ${this.page(l.from)?.name ?? "frame"}` : ""));
    }
    for (const it of b.items) drawItem(this.theme, el, it);
    if (l?.over && !show) (0, import_obsidian3.setIcon)(el.createDiv({ cls: "vl-overmark", attr: { "aria-label": `Overrides ${this.page(l.over)?.name ?? "the frame"}'s ${b.name}` } }), "layers-2");
    if (sel && inh) {
    } else if (sel) {
      const id = this.sel?.item;
      if (id) {
        el.querySelector(`[data-id="${id}"]`)?.addClass("is-sel");
        const it = findItem(b.items, id)?.item;
        if (it && b.items.includes(it)) {
          const [ax, ay] = axes(it.g);
          const d = el.createDiv({ cls: "vl-anchor" });
          d.style.left = `${(ax + 1) * 50}%`;
          d.style.top = `${(ay + 1) * 50}%`;
        }
        if (it && b.items.includes(it) && RESIZE.includes(it.type)) this.itemGrips(el, b, it);
      } else el.createDiv({ cls: "vl-grip", attr: { "data-grip": "1" } });
    }
    return el;
  }
  // a chosen picture / shape (placed in its block, not in a row): a handle at both bottom corners to resize it
  itemGrips(bEl, b, it) {
    const box = this.itemBox(bEl, b, it);
    if (!box) return;
    for (const c of ["bl", "br"]) {
      const g = bEl.createDiv({ cls: `vl-igrip is-${c}`, attr: { "data-igrip": c, "aria-label": "Resize (Shift: keep the shape, Alt: 1 px)" } });
      g.style.left = `${c === "bl" ? box.L : box.L + box.W}px`;
      g.style.top = `${box.T + box.H}px`;
    }
  }
  // an item's box in its block's points, as drawn (hug and fill too)
  itemBox(bEl, b, it) {
    const iEl = bEl.querySelector(`[data-id="${it.id}"]`), br = bEl.getBoundingClientRect();
    if (!iEl || !br.width) return null;
    const ir = iEl.getBoundingClientRect(), k = br.width / b.w;
    return { L: (ir.left - br.left) / k, T: (ir.top - br.top) / k, W: ir.width / k, H: ir.height / k };
  }
  // the lines a box snaps to: an item's in its block (block points), a block's on the screen
  itemLines(bEl, b, it) {
    const x = [], y = [];
    if (snap.frame) {
      x.push(0, b.w / 2, b.w);
      y.push(0, b.h / 2, b.h);
      for (const m of snap.margins) {
        x.push(m, b.w - m);
        y.push(m, b.h - m);
      }
    }
    if (snap.others) for (const o of b.items) {
      if (o === it) continue;
      const r = this.itemBox(bEl, b, o);
      if (!r) continue;
      x.push(r.L, r.L + r.W / 2, r.L + r.W);
      y.push(r.T, r.T + r.H / 2, r.T + r.H);
    }
    return { x, y };
  }
  blockLines(p, b) {
    const { W, H, safe } = this.screen(p), x = [], y = [];
    if (snap.frame) {
      const l = safe.left, r = W - safe.right, t = safe.top, bo = H - safe.bottom;
      x.push(0, W / 2, W, l, r);
      y.push(0, H / 2, H, t, bo);
      for (const m of snap.margins) {
        x.push(l + m, r - m);
        y.push(t + m, bo - m);
      }
    }
    if (snap.others) for (const { block: o } of this.layers(p)) {
      if (o.id === b.id) continue;
      x.push(o.x, o.x + o.w / 2, o.x + o.w);
      y.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    return { x, y };
  }
  // the lines a drag snapped to, across the screen (screen points); none = cleared
  guides(scr, xs = [], ys = []) {
    scr.querySelectorAll(".vl-guide").forEach((g) => g.remove());
    if (!snap.guides) return;
    for (const v of xs) {
      const g = scr.createDiv({ cls: "vl-guide is-v" });
      g.style.left = `${v}px`;
    }
    for (const v of ys) {
      const g = scr.createDiv({ cls: "vl-guide is-h" });
      g.style.top = `${v}px`;
    }
  }
  // drag a corner: w / h change live (snapped like blocks, Alt 1 px, Shift keeps the shape); the opposite edge stays put,
  // whatever the item's gravity (its offset follows); a "fill" size becomes a number
  resizeItem(e, p, b, scr, corner) {
    const it = this.item()?.item, bEl = scr.querySelector(`[data-block="${b.id}"]`);
    const box0 = it && bEl ? this.itemBox(bEl, b, it) : null;
    if (!it || !box0) return;
    const L0 = Math.round(box0.L), T0 = Math.round(box0.T), W0 = Math.round(box0.W), H0 = Math.round(box0.H);
    const [ax, ay] = axes(it.g), x0 = e.clientX, y0 = e.clientY, z = this.v.zoom;
    let moved = false;
    const lines = this.itemLines(bEl, b, it);
    scr.setPointerCapture(e.pointerId);
    const move = (m) => {
      const dx = (m.clientX - x0) / z, dy = (m.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      if (!moved) {
        moved = true;
        this.begin();
      }
      const sn = (v) => Math.max(4, m.altKey ? Math.round(v) : Math.round(v / grid()) * grid());
      const on = snap.on && !m.altKey, reach = snap.dist / z, gx = [], gy = [];
      const gX = on ? near([corner === "br" ? L0 + W0 + dx : L0 + dx], lines.x, reach) : null;
      if (gX) gx.push(gX.at);
      const W = gX ? Math.max(4, Math.round(corner === "br" ? gX.at - L0 : L0 + W0 - gX.at)) : sn(corner === "br" ? W0 + dx : W0 - dx);
      const gY = on && !m.shiftKey ? near([T0 + H0 + dy], lines.y, reach) : null;
      if (gY) gy.push(gY.at);
      const H = m.shiftKey && W0 && H0 ? Math.max(4, Math.round(W * H0 / W0)) : gY ? Math.max(4, Math.round(gY.at - T0)) : sn(H0 + dy);
      const L = corner === "br" ? L0 : L0 + W0 - W;
      it.w = W;
      it.h = H;
      it.dx = ax < 0 ? L : ax > 0 ? b.w - L - W : Math.round(L + W / 2 - b.w / 2);
      it.dy = ay < 0 ? T0 : ay > 0 ? b.h - T0 - H : Math.round(T0 + H / 2 - b.h / 2);
      this.redrawBlock(scr, p, b);
      this.guides(scr, gx.map((v) => v + b.x), gy.map((v) => v + b.y));
      this.livePanel();
    };
    const up = () => {
      scr.removeEventListener("pointermove", move);
      scr.removeEventListener("pointerup", up);
      scr.removeEventListener("pointercancel", up);
      this.guides(scr);
      if (moved) {
        this.end();
        this.drawPanel();
      }
    };
    scr.addEventListener("pointermove", move);
    scr.addEventListener("pointerup", up);
    scr.addEventListener("pointercancel", up);
  }
  // ---- pointer: a tap chooses, a drag moves (snaps to 4 px, Alt for 1 px)
  down(e, p, scr) {
    if (e.button !== 0) return;
    const t = e.target;
    const bEl = t.closest("[data-block]"), b = bEl ? this.blocks(p).find((x) => x.id === bEl.dataset.block) : void 0;
    const grip = !!t.closest("[data-grip]");
    const itEl = t.closest(".vl-it");
    const topEl = t.closest("[data-top]");
    const pickId = itEl?.dataset.id, dragId = topEl?.dataset.id;
    const before = this.sel;
    if (!b) {
      const l = bEl ? this.layers(p).find((x) => x.block.id === bEl.dataset.block) : void 0;
      this.choose(l ? { page: p.id, block: l.block.id } : { page: p.id });
      return;
    }
    const ig = t.closest("[data-igrip]");
    if (ig && this.sel?.item && this.sel.block === b.id) {
      this.resizeItem(e, p, b, scr, ig.dataset.igrip);
      return;
    }
    const blockChosen = before?.page === p.id && before.block === b.id;
    const wholeBlock = e.ctrlKey || e.metaKey || !!t.closest(".vl-tag");
    const target = pickId && blockChosen && !wholeBlock ? { page: p.id, block: b.id, item: pickId } : { page: p.id, block: b.id };
    const dragItem = target?.item ? findItem(b.items, dragId)?.item : void 0;
    const x0 = e.clientX, y0 = e.clientY, z = this.v.zoom, start = { ...b }, istart = dragItem ? { dx: dragItem.dx ?? 0, dy: dragItem.dy ?? 0 } : null;
    let moved = false;
    let ib = null, lines = { x: [], y: [] };
    const R = this.room(p, b), keep = !b.bleed && inRoom(b, R);
    scr.setPointerCapture(e.pointerId);
    const move = (m) => {
      const dx = (m.clientX - x0) / z, dy = (m.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!moved) {
        moved = true;
        this.begin();
        const be = scr.querySelector(`[data-block="${b.id}"]`);
        if (dragItem && be) {
          ib = this.itemBox(be, b, dragItem);
          lines = this.itemLines(be, b, dragItem);
        } else lines = this.blockLines(p, b);
        if (!blockChosen || target?.item !== this.sel?.item) {
          this.sel = target;
          this.drawPanel();
        }
      }
      const sn = (v) => m.altKey ? Math.round(v) : Math.round(v / grid()) * grid();
      const on = snap.on && !m.altKey, reach = snap.dist / z, gx = [], gy = [];
      const pick = (pts, ls, out) => {
        const g = on ? near(pts, ls, reach) : null;
        if (g) out.push(g.at);
        return g;
      };
      let ox = 0, oy = 0;
      if (dragItem && istart) {
        const [ax, ay] = axes(dragItem.g);
        ox = b.x;
        oy = b.y;
        if (dragItem.w !== "fill") {
          const L = (ib?.L ?? 0) + dx, W = ib?.W ?? 0, g = ib ? pick([L, L + W / 2, L + W], lines.x, gx) : null;
          dragItem.dx = g ? toD(ax, L + g.d, W, b.w) : sn(istart.dx + (ax > 0 ? -dx : dx));
        }
        if (dragItem.h !== "fill") {
          const T = (ib?.T ?? 0) + dy, H = ib?.H ?? 0, g = ib ? pick([T, T + H / 2, T + H], lines.y, gy) : null;
          dragItem.dy = g ? toD(ay, T + g.d, H, b.h) : sn(istart.dy + (ay > 0 ? -dy : dy));
        }
      } else if (grip) {
        const gR = pick([start.x + start.w + dx], lines.x, gx), gB = pick([start.y + start.h + dy], lines.y, gy);
        b.w = Math.max(8, gR ? Math.round(gR.at - start.x) : sn(start.w + dx));
        b.h = Math.max(8, gB ? Math.round(gB.at - start.y) : sn(start.h + dy));
      } else {
        const L = start.x + dx, T = start.y + dy;
        const g1 = pick([L, L + b.w / 2, L + b.w], lines.x, gx), g2 = pick([T, T + b.h / 2, T + b.h], lines.y, gy);
        b.x = g1 ? Math.round(L + g1.d) : sn(L);
        b.y = g2 ? Math.round(T + g2.d) : sn(T);
      }
      if (!dragItem && keep) clampTo(b, R, grip);
      this.redrawBlock(scr, p, b);
      this.guides(scr, gx.map((v) => v + ox), gy.map((v) => v + oy));
      this.livePanel();
    };
    const up = () => {
      scr.removeEventListener("pointermove", move);
      scr.removeEventListener("pointerup", up);
      scr.removeEventListener("pointercancel", up);
      this.guides(scr);
      if (moved) {
        this.end();
        return;
      }
      const again = target?.item && before?.item === target.item;
      this.choose(target);
      if (again && import_obsidian3.Platform.isMobile) this.writeItem(b, target.item);
    };
    scr.addEventListener("pointermove", move);
    scr.addEventListener("pointerup", up);
    scr.addEventListener("pointercancel", up);
  }
  typeInPlace(e, p) {
    const at = (this.root?.doc ?? activeDocument).elementFromPoint(e.clientX, e.clientY);
    const itEl = at?.closest(".vl-it"), bEl = at?.closest("[data-block]");
    const b = bEl ? this.blocks(p).find((x) => x.id === bEl.dataset.block) : void 0;
    const f = b && itEl?.dataset.id ? findItem(b.items, itEl.dataset.id) : null;
    if (!b || !f) return;
    this.choose({ page: p.id, block: b.id, item: f.item.id });
    if (f.item.type !== "text") return;
    if (import_obsidian3.Platform.isMobile) {
      this.writeItem(b, f.item.id);
      return;
    }
    const el = (this.wall ?? activeDocument).querySelector(`.vl-it[data-id="${f.item.id}"]`);
    if (!el) return;
    el.contentEditable = "true";
    el.addClass("is-typing");
    el.focus();
    el.doc.getSelection()?.selectAllChildren(el);
    el.addEventListener("keydown", (k) => {
      if (k.key === "Escape" || k.key === "Enter" && !k.shiftKey) {
        k.preventDefault();
        el.blur();
      }
    });
    el.addEventListener("blur", () => this.edit(() => {
      f.item.v = el.innerText.replace(/\n$/, "");
    }), { once: true });
  }
  writeItem(b, id) {
    const it = findItem(b.items, id)?.item;
    if (it?.type === "text") this.writer("Text", it.v ?? "", (v) => this.edit(() => {
      it.v = v;
    }));
  }
  // ---- keys (only when not typing in a field)
  key(e) {
    if (this.handle(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  handle(e) {
    const typing = e.target.closest("input, textarea, select, [contenteditable]");
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "s") {
      this.save();
      return true;
    }
    if (mod && e.shiftKey && k === "c" && !typing) {
      this.copyReference();
      return true;
    }
    if (typing) return false;
    if (mod && k === "z") {
      if (e.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if (mod && k === "y") {
      this.redo();
      return true;
    }
    if (mod && k === "d") {
      this.duplicate();
      return true;
    }
    if (e.key === "Escape" && !this.sel) return true;
    if (e.key === "Escape") {
      const s = this.sel;
      this.choose(s?.item ? { page: s.page, block: s.block } : s?.block ? { page: s.page } : null);
      return true;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      this.remove();
      return true;
    }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d && this.sel?.block) {
      this.nudge(d[0] * (e.shiftKey ? grid() : 1), d[1] * (e.shiftKey ? grid() : 1));
      return true;
    }
    return false;
  }
  nudge(dx, dy) {
    const f = this.item(), b = this.block();
    this.edit(() => {
      if (f) {
        const [ax, ay] = axes(f.item.g);
        if (f.item.w !== "fill") f.item.dx = (f.item.dx ?? 0) + (ax > 0 ? -dx : dx);
        if (f.item.h !== "fill") f.item.dy = (f.item.dy ?? 0) + (ay > 0 ? -dy : dy);
      } else if (b) {
        const p = this.page(), R = this.room(p, b), keep = !b.bleed && inRoom(b, R);
        b.x += dx;
        b.y += dy;
        if (keep) clampTo(b, R, false);
      }
    });
  }
  duplicate() {
    const f = this.item(), b = this.block(), p = this.page();
    if (this.sel?.block && !b) return;
    if (f) this.edit(() => {
      const c = cloneItem(f.item);
      f.list.splice(f.list.indexOf(f.item) + 1, 0, c);
      this.sel = { ...this.sel, item: c.id };
    });
    else if (b && p) this.edit(() => {
      const c = { ...JSON.parse(JSON.stringify(b)), id: uid(), y: b.y + b.h + 8 };
      c.items = b.items.map(cloneItem);
      this.blocks(p).push(c);
      this.sel = { page: p.id, block: c.id };
    });
    else if (p) this.edit(() => {
      const c = { ...JSON.parse(JSON.stringify(p)), id: uid(), name: p.name + " copy" };
      this.doc.pages.splice(this.doc.pages.indexOf(p) + 1, 0, c);
      this.sel = { page: c.id };
    });
  }
  remove() {
    const f = this.item(), b = this.block(), p = this.page();
    if (f) this.edit(() => {
      f.list.splice(f.list.indexOf(f.item), 1);
      this.sel = { page: p.id, block: b.id };
    });
    else if (b && p) this.edit(() => {
      const l = this.blocks(p);
      l.splice(l.indexOf(b), 1);
      this.sel = { page: p.id };
    });
  }
  // ---- the panel: only what is chosen, as controls
  drawPanel() {
    this.closePicker();
    this.parentClose?.();
    this.keepTop = this.panel?.querySelector(".vl-pbody")?.scrollTop ?? 0;
    this.panel?.remove();
    this.panel = null;
    this.getters.clear();
    this.drawBar();
    this.panelBody();
    if (import_obsidian3.Platform.isMobile && this.v.fit && this.pending === null) this.drawPages();
  }
  panelBody() {
    if (!this.side?.isConnected || this.v.show || !this.sel && import_obsidian3.Platform.isMobile || !import_obsidian3.Platform.isMobile && this.v.panel === false || this.v.map) return;
    const p = this.page() ?? this.current();
    if (!p) return;
    const P = this.panel = this.side.createDiv({ cls: "vl-panel" + (import_obsidian3.Platform.isMobile ? " is-sheet" : "") });
    if (!import_obsidian3.Platform.isMobile) {
      const pw = Number(getLocal("vellum:panelW")) || 300;
      P.style.width = `${pw}px`;
      const g = P.createDiv({ cls: "vl-pgrip" });
      g.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        g.setPointerCapture(e.pointerId);
        g.addClass("is-on");
        const x0 = e.clientX, w0 = P.offsetWidth;
        const mv = (m) => {
          P.style.width = `${Math.min(600, Math.max(240, w0 - (m.clientX - x0)))}px`;
        };
        const up = () => {
          g.removeEventListener("pointermove", mv);
          g.removeEventListener("pointerup", up);
          g.removeClass("is-on");
          try {
            setLocal("vellum:panelW", String(P.offsetWidth));
          } catch {
          }
          if (this.v.fit) this.drawPages();
        };
        g.addEventListener("pointermove", mv);
        g.addEventListener("pointerup", up);
      });
    }
    const b = this.block(), f = this.item(), inh = !b ? this.layer() : void 0;
    const head = P.createDiv({ cls: "vl-crumb" });
    const crumb = (text, s, on) => {
      const c = head.createEl("button", { text, cls: on ? "is-on" : "" });
      c.addEventListener("click", () => this.choose(s));
    };
    crumb(p.name, { page: p.id }, !b);
    if (b) {
      head.createSpan({ text: "\u203A" });
      crumb(b.name, { page: p.id, block: b.id }, !f);
    } else if (inh) {
      head.createSpan({ text: "\u203A" });
      crumb(inh.block.name, { page: p.id, block: inh.block.id }, true);
    }
    if (f) {
      head.createSpan({ text: "\u203A" });
      crumb(label(f.item), this.sel, true);
    }
    const acts = head.createDiv({ cls: "vl-hacts" });
    const refB = this.btn(acts, "link", "Copy reference: one line that points at it (Ctrl+Shift+C)", () => this.copyReference(refB));
    const agB = this.btn(acts, "clipboard-copy", "Copy for the agent: the reference, its JSON now, and a line for what to change", () => this.copyForAgent(agB));
    if (f || b) {
      this.btn(acts, "copy", "Duplicate (Ctrl+D)", () => this.duplicate());
      this.btn(acts, "trash-2", "Delete (Delete)", () => this.remove());
    } else if (!inh) {
      this.btn(acts, "copy", "Duplicate the screen", () => this.duplicate());
      this.btn(acts, "trash-2", "Delete the screen", () => this.edit(() => {
        this.doc.pages.splice(this.doc.pages.indexOf(p), 1);
        this.sel = null;
      }));
    }
    if (this.sel) this.btn(acts, "x", "Let go (Esc)", () => this.choose(null)).addClass("vl-close");
    const body = P.createDiv({ cls: "vl-pbody" });
    if (f && b) this.itemPanel(body, b, f.item, b.items.includes(f.item));
    else if (b) this.blockPanel(body, p, b);
    else if (inh) this.framePanel(body, p, inh);
    else this.pagePanel(body, p);
    body.scrollTop = this.keepTop;
    this.keepTop = 0;
  }
  // what is chosen, written for a coding agent: where it lives (the folder, the file, the screen, the block, the item),
  // what it is now (its JSON), and a line for what to change. Pasted to the agent, no need to describe which thing it is
  // where the chosen thing is, in one line: the file, the block, the item (ids to search for)
  reference() {
    const p = this.page() ?? this.current();
    if (!p) return "";
    const b = this.block() ?? this.layer()?.block, f = this.item();
    const file = this.store ? this.store.files.get(p.id) ?? `${this.store.dir}/${p.name}.json` : `${this.ctx?.sourcePath ?? "the note"} \u203A ${p.name}`;
    const parts = [file + (this.land ? " (landscape)" : "")];
    if (b) parts.push(`${b.name} (${b.id})`);
    if (f) parts.push(`${f.item.type}${f.item.type === "text" ? ` "${(f.item.v ?? "").split("\n")[0].slice(0, 30)}"` : f.item.type === "icon" ? ` ${f.item.name ?? ""}` : ""} ${f.item.id}`);
    return parts.join(" \u203A ");
  }
  copyReference(at) {
    const t = this.reference();
    if (!t) return;
    (this.root?.win ?? window).navigator.clipboard.writeText(t).then(() => this.hint("Reference copied", at), () => this.writer("Copy this reference", t, () => {
    }));
  }
  copyForAgent(at) {
    const p = this.page() ?? this.current();
    if (!p) return;
    const b = this.block() ?? this.layer()?.block, f = this.item();
    const file = this.store ? `${this.store.files.get(p.id) ?? `${this.store.dir}/${p.name}.json`}` : `${this.ctx?.sourcePath ?? "the note"} (a vellum block)`;
    const where = [`Vellum screen "${p.name}" (id ${p.id}) in ${file}`];
    if (this.land) where.push("its landscape layout (land)");
    if (b) where.push(`block "${b.name}" (id ${b.id}, kind ${b.kind}, x ${b.x} y ${b.y} w ${b.w} h ${b.h})`);
    if (f) where.push(`item ${f.item.type}${f.item.type === "text" ? ` "${(f.item.v ?? "").split("\n")[0].slice(0, 40)}"` : ""} (id ${f.item.id})`);
    const now = f ? f.item : b ?? { id: p.id, name: p.name, parent: p.parent, link: p.link, bg: p.bg, blocks: this.blocks(p).map((x) => `${x.name} (${x.id})`) };
    const text = `${where.join(" \xB7 ")}

Now:
${JSON.stringify(now, null, 1)}

What I want changed:
`;
    const done = () => this.hint("Copied for the agent", at);
    const nav = (this.root?.win ?? window).navigator;
    nav.clipboard.writeText(text).then(done, () => this.writer("Copy this for the agent", text, () => {
    }));
  }
  // numbers shown as text (the gaps) kept live while dragging too
  livePanel() {
    for (const [el, g] of this.liveText) if (el.isConnected) el.setText(g());
    else this.liveText.delete(el);
    this.panel?.querySelectorAll("input[data-live]").forEach((i) => {
      const g = this.getters.get(i);
      if (g && i.doc.activeElement !== i) i.value = String(g());
    });
  }
  // controls
  // a section: its title and its body; fold: a click on the title folds it (kept on the device, by title)
  // a section: its title and its body. fold: a click on the title folds it (kept on the device, by title); shut: it
  // starts folded; hint: a summary in the title, shown while it is folded (what is in it)
  section(parent, title, fold = false, o = {}) {
    const sc = parent.createDiv({ cls: "vl-sec" }), h = sc.createDiv({ cls: "vl-sech" });
    h.createSpan({ text: title });
    if (o.hint) h.createSpan({ cls: "vl-sechint", text: o.hint });
    const body = sc.createDiv({ cls: "vl-secb" });
    if (!fold) return body;
    const KEY = "vellum:secstate";
    let st = {};
    try {
      st = JSON.parse(getLocal(KEY) ?? "{}");
    } catch {
    }
    if (!(title in st)) {
      try {
        if (JSON.parse(getLocal("vellum:secfold") ?? "[]").includes(title)) st[title] = true;
      } catch {
      }
    }
    h.addClass("is-fold");
    (0, import_obsidian3.setIcon)(h.createSpan({ cls: "vl-secchev" }), "chevron-down");
    sc.toggleClass("is-folded", st[title] ?? !!o.shut);
    h.addEventListener("click", () => {
      const now = !sc.hasClass("is-folded");
      sc.toggleClass("is-folded", now);
      st[title] = now;
      setLocal(KEY, JSON.stringify(st));
    });
    return body;
  }
  // a choice as a segmented control: words (an icon too, or an icon alone with its words in the tooltip)
  seg(parent, opts, on, pick, iconsOnly = false) {
    const g = parent.createDiv({ cls: "vl-seg2" + (iconsOnly ? " is-icons" : "") });
    for (const [v, text, icon] of opts) {
      const c = g.createEl("button", { cls: v === on ? "is-on" : "", attr: { "aria-label": text } });
      if (icon) (0, import_obsidian3.setIcon)(c.createSpan({ cls: "vl-seg2i" }), icon);
      if (!iconsOnly) c.createSpan({ text });
      c.addEventListener("click", () => this.edit(() => pick(v)));
    }
    return g;
  }
  // a row: its label at the left, the control at the right
  frow(parent, label2) {
    const r = parent.createDiv({ cls: "vl-frow" });
    r.createSpan({ cls: "vl-frowl", text: label2 });
    return r.createDiv({ cls: "vl-frowc" });
  }
  // a menu of choices (Obsidian's own dropdown)
  menu(parent, opts, on, pick, label2 = "") {
    const m = parent.createEl("select", { cls: "dropdown vl-menu2", attr: { "aria-label": label2 } });
    for (const [v, t] of opts) m.createEl("option", { value: v, text: t });
    m.value = on;
    m.addEventListener("change", () => this.edit(() => pick(m.value)));
    return m;
  }
  // a number: type it, or drag its label sideways to scrub; live while it changes, one undo step for the whole change
  // a number box, as ZeLedger's amount tiles: the value is text. Hold the box (a mouse or a finger), then drag up or down
  // to change it, a bubble showing the value; a quick click or tap turns it into a field to type in (Enter keeps it, Esc
  // puts it back); with the box focused, ↑ ↓ step and Enter types
  num(parent, name, get, set, o = {}) {
    const w = parent.createDiv({ cls: "vl-num", attr: { tabindex: "0", role: "spinbutton", "aria-label": name } });
    w.createSpan({ cls: "vl-numl", text: name });
    const vr = w.createDiv({ cls: "vl-numv" });
    const vt = vr.createSpan({ cls: "vl-numt" });
    if (o.unit) vr.createSpan({ cls: "vl-numu", text: o.unit });
    const st = o.step ?? 1, fmt = (v) => String(+v.toFixed(4));
    const clamp = (v) => Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v));
    const show = () => {
      vt.setText(fmt(get()));
      w.setAttr("aria-valuenow", String(get()));
    };
    show();
    this.liveText.set(vt, () => fmt(get()));
    const apply = (v) => {
      set(+clamp(Math.round(v / st) * st).toFixed(6));
      this.draftPut();
      this.drawPages();
      this.drawBar();
      show();
      this.livePanel();
    };
    const type = () => {
      if (w.querySelector("input")) return;
      const i = createEl("input", { cls: "vl-numin", attr: { type: "text", inputmode: "decimal", "aria-label": name } });
      i.value = fmt(get());
      vt.replaceWith(i);
      w.addClass("is-typing");
      const v0 = get();
      this.begin();
      i.focus();
      i.select();
      let done = false;
      const fin = (keep) => {
        if (done) return;
        done = true;
        if (!keep) apply(v0);
        i.replaceWith(vt);
        w.removeClass("is-typing");
        show();
        this.end();
        this.liveText.set(vt, () => fmt(get()));
      };
      i.addEventListener("input", () => {
        const n = Number(i.value.replace(",", "."));
        if (i.value.trim() !== "" && !Number.isNaN(n)) apply(n);
      });
      i.addEventListener("keydown", (k) => {
        k.stopPropagation();
        if (k.key === "Enter") {
          k.preventDefault();
          fin(true);
          w.focus();
        }
        if (k.key === "Escape") {
          k.preventDefault();
          fin(false);
          w.focus();
        }
      });
      i.addEventListener("blur", () => fin(true));
    };
    w.addEventListener("click", (e) => {
      if (!e.target.closest(".vl-arrows")) type();
    });
    w.addEventListener("keydown", (k) => {
      if (k.target !== w) return;
      if (k.key === "Enter") {
        k.preventDefault();
        type();
      } else if (k.key === "ArrowUp" || k.key === "ArrowDown") {
        k.preventDefault();
        k.stopPropagation();
        this.begin();
        apply(get() + (k.key === "ArrowUp" ? 1 : -1) * st * editCfg.arrow * (k.shiftKey ? 10 : 1));
        this.end();
      }
    });
    this.numberExtras(w, null, name, get, set, { ...o, refresh: show, anyPointer: true, arrows: false });
    return w;
  }
  // a number box's extras: ▲▼ arrows (a press moves one arrow step, Shift ten of them, holding repeats) and hold-and-drag:
  // hold the box still, then drag up or down; a bubble shows the value and the change; letting go keeps it, a cancel
  // puts it back. host: the box; arrows: where the arrows go (false: none); set is live (one undo step per change)
  numberExtras(host, input, label2, get, set, o = {}) {
    const st = o.step ?? 1, clamp = (v) => Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v));
    const put = (v) => {
      set(+clamp(Math.round(v / st) * st).toFixed(6));
      if (input) input.value = String(get());
      o.refresh?.();
      this.draftPut();
      this.drawPages();
      this.drawBar();
      this.livePanel();
    };
    if (o.arrows !== false) {
      const box = (o.arrows ?? host).createDiv({ cls: "vl-arrows" });
      for (const [dir, icon, name] of [[1, "chevron-up", "More"], [-1, "chevron-down", "Less"]]) {
        const b = box.createEl("button", { cls: "vl-arrow", attr: { "aria-label": `${name} (Shift: \xD710)`, tabindex: "-1" } });
        (0, import_obsidian3.setIcon)(b, icon);
        let wait = 0, rep = 0;
        const stop = () => {
          window.clearTimeout(wait);
          window.clearInterval(rep);
          wait = rep = 0;
          this.end();
        };
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.begin();
          const once = () => put(get() + dir * st * editCfg.arrow * (e.shiftKey ? 10 : 1));
          once();
          wait = window.setTimeout(() => {
            rep = window.setInterval(once, 70);
          }, 380);
          try {
            b.setPointerCapture(e.pointerId);
          } catch {
          }
        });
        b.addEventListener("pointerup", stop);
        b.addEventListener("pointercancel", stop);
        b.addEventListener("click", (e) => e.preventDefault());
      }
    }
    let timer = 0, active = false, x0 = 0, y0 = 0, v0 = 0, id = -1, bub = null, both = false, fine = 1;
    const notches = (dy) => {
      const u = Math.abs(dy) / 9;
      return Math.sign(dy) * Math.floor(u < 10 ? u : 10 + Math.pow(u - 10, 1.35));
    };
    const fmt = (v) => String(+v.toFixed(4));
    let preview = 0;
    const light = (v) => {
      const n = +clamp(Math.round(v / st) * st).toFixed(6);
      if (n === get()) return false;
      set(n);
      if (input) input.value = String(n);
      o.refresh?.();
      if (!preview) preview = window.setTimeout(() => {
        preview = 0;
        this.drawPages();
      }, 90);
      return true;
    };
    const paint = (tick = false) => {
      if (!bub) return;
      const v = get(), d = +(v - v0).toFixed(4), ve = bub.querySelector(".vl-bubble-v");
      ve?.setText(fmt(v));
      if (tick && ve) {
        ve.removeClass("is-tick");
        void ve.offsetWidth;
        ve.addClass("is-tick");
      }
      bub.querySelector(".vl-bubble-d")?.setText(d ? `${d > 0 ? "+" : "\u2212"}${fmt(Math.abs(d))}` : "\u2195");
      bub.toggleClass("is-up", d > 0);
      bub.toggleClass("is-down", d < 0);
    };
    host.addEventListener("touchmove", (e) => {
      if (active) e.preventDefault();
    }, { passive: false });
    host.addEventListener("contextmenu", (e) => {
      if (active || timer) e.preventDefault();
    });
    const start = () => {
      timer = 0;
      active = true;
      input?.blur();
      v0 = get();
      this.begin();
      try {
        host.setPointerCapture(id);
      } catch {
      }
      host.addClass("is-scrub");
      const R = this.root;
      if (!R) return;
      bub = R.createDiv({ cls: "vl-bubble" });
      bub.createDiv({ cls: "vl-bubble-k", text: label2 });
      bub.createDiv({ cls: "vl-bubble-v" });
      bub.createDiv({ cls: "vl-bubble-d" });
      const rr = R.getBoundingClientRect(), hr = host.getBoundingClientRect();
      bub.style.left = `${Math.min(rr.width - 80, Math.max(80, hr.left - rr.left + hr.width / 2))}px`;
      bub.style.top = `${Math.max(96, hr.top - rr.top - 10)}px`;
      paint();
    };
    if (o.handle) {
      const hd = o.handle;
      hd.addClass("vl-drag");
      hd.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || active) return;
        e.preventDefault();
        e.stopPropagation();
        x0 = e.clientX;
        y0 = e.clientY;
        id = e.pointerId;
        both = true;
        try {
          hd.setPointerCapture(id);
        } catch {
        }
        start();
      });
      hd.addEventListener("pointermove", (e) => {
        if (e.pointerId === id && active) move(e);
      });
      hd.addEventListener("pointerup", (e) => {
        if (e.pointerId === id) finish(true);
      });
      hd.addEventListener("pointercancel", (e) => {
        if (e.pointerId === id) finish(false);
      });
    }
    host.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || active || !editCfg.hold || e.pointerType === "mouse" && !o.anyPointer || e.target.closest(".vl-arrows, .vl-drag, input")) return;
      x0 = e.clientX;
      y0 = e.clientY;
      id = e.pointerId;
      both = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(start, 280);
    });
    const move = (e) => {
      e.preventDefault();
      fine = e.shiftKey ? 10 : 1;
      const d = (both ? y0 - e.clientY + (e.clientX - x0) : y0 - e.clientY) / (e.altKey ? 4 : 1);
      if (light(v0 + notches(d) * st * editCfg.arrow * fine)) {
        paint(true);
        if (e.pointerType !== "mouse") try {
          navigator.vibrate?.(8);
        } catch {
        }
      }
    };
    host.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id || both) return;
      if (!active) {
        if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) {
          window.clearTimeout(timer);
          timer = 0;
        }
        return;
      }
      move(e);
    });
    const finish = (keep) => {
      window.clearTimeout(timer);
      timer = 0;
      if (!active) return;
      active = false;
      host.removeClass("is-scrub");
      bub?.remove();
      bub = null;
      window.clearTimeout(preview);
      preview = 0;
      put(keep ? get() : v0);
      this.end();
      const eat = (c) => {
        c.preventDefault();
        c.stopPropagation();
      };
      host.addEventListener("click", eat, { capture: true, once: true });
      window.setTimeout(() => host.removeEventListener("click", eat, { capture: true }), 400);
    };
    host.addEventListener("pointerup", (e) => {
      if (e.pointerId === id && !both) finish(true);
    });
    host.addEventListener("pointercancel", (e) => {
      if (e.pointerId === id && !both) finish(false);
    });
  }
  // a choice of words or swatches: a tap is the answer
  // a choice: words, an icon (its words in the tooltip: [value, words, icon]), or a colour swatch alone (bare)
  chips(parent, opts, on, pick, swatch, bare = false) {
    const g = parent.createDiv({ cls: "vl-chips" + (opts.some((o) => o[2]) ? " is-icons" : "") + (bare ? " is-swatches" : "") });
    for (const [v, text, icon] of opts) {
      const c = g.createEl("button", { cls: "vl-chip" + (v === on ? " is-on" : "") + (icon ? " is-icon" : "") + (bare ? " is-swatch" : ""), attr: { "aria-label": text } });
      if (swatch) {
        const s = c.createSpan({ cls: "vl-sw" });
        s.style.background = swatch(v);
      }
      if (icon) {
        (0, import_obsidian3.setIcon)(c, icon);
        if (!c.querySelector("svg")) {
          c.setText(text);
          c.removeClass("is-icon");
        }
      } else if (!bare) c.appendText(text);
      c.addEventListener("click", () => this.edit(() => pick(v)));
    }
    return g;
  }
  text(parent, get, set, o = {}) {
    if (import_obsidian3.Platform.isMobile) {
      const t = parent.createDiv({ cls: "vl-text vl-tap" + (get() ? "" : " is-empty"), text: get() || o.placeholder || "" });
      t.addEventListener("click", () => this.writer(o.title ?? o.placeholder ?? "Text", get(), (v) => this.edit(() => set(v)), !!o.area));
      return t;
    }
    const i = o.area ? parent.createEl("textarea", { cls: "vl-text", attr: { rows: "2", placeholder: o.placeholder ?? "" } }) : parent.createEl("input", { cls: "vl-text", attr: { type: "text", placeholder: o.placeholder ?? "" } });
    i.value = get();
    i.addEventListener("focus", () => this.begin());
    i.addEventListener("input", () => {
      set(i.value);
      this.draftPut();
      this.drawPages();
      this.drawBar();
    });
    i.addEventListener("blur", () => this.end());
    return i;
  }
  // the writing window: centred in the part of the screen the keyboard leaves (visualViewport), Cancel / Done
  writer(title, value, done, multi = true) {
    activeDocument.querySelector(".vl-writer")?.remove();
    const dim = activeDocument.body.createDiv({ cls: "vl-writer" });
    const w = dim.createDiv({ cls: "vl-wbox" });
    const head = w.createDiv({ cls: "vl-whead" });
    const cancel = head.createEl("button", { text: "Cancel" });
    head.createSpan({ text: title });
    const ok = head.createEl("button", { text: "Done", cls: "mod-cta" });
    const box = w.createEl("textarea", { attr: { rows: multi ? "4" : "1", spellcheck: "false" } });
    box.value = value;
    const vv = window.visualViewport;
    const place2 = () => {
      const top = vv ? vv.offsetTop + vv.height / 2 : window.innerHeight / 2;
      w.style.top = `${top}px`;
    };
    place2();
    vv?.addEventListener("resize", place2);
    vv?.addEventListener("scroll", place2);
    const close = () => {
      vv?.removeEventListener("resize", place2);
      vv?.removeEventListener("scroll", place2);
      dim.remove();
    };
    for (const ev of ["pointerdown", "mousedown", "click", "touchstart"]) dim.addEventListener(ev, (e) => e.stopPropagation());
    dim.addEventListener("click", (e) => {
      if (e.target === dim) close();
    });
    cancel.addEventListener("click", close);
    ok.addEventListener("click", () => {
      const v = multi ? box.value : box.value.replace(/\n/g, " ");
      close();
      if (v !== value) done(v);
    });
    box.addEventListener("keydown", (k) => {
      if (k.key === "Enter" && (!multi || k.metaKey || k.ctrlKey)) {
        k.preventDefault();
        ok.click();
      }
      if (k.key === "Escape") close();
    });
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
  // a colour: a bar showing it (its swatch, its name or value; a tap opens the picker) and a palette row under it (the
  // theme's colours, then the recent ones): one tap picks
  colors(parent, on, pick, none = false) {
    const names = Object.keys(this.theme.colors);
    const bar = parent.createEl("button", { cls: "vl-cbar", attr: { "aria-label": "Colour: open the picker" } });
    const sw = bar.createSpan({ cls: "vl-cbar-sw" }), tx = bar.createSpan({ cls: "vl-cbar-tx" });
    (0, import_obsidian3.setIcon)(bar.createSpan({ cls: "vl-cbar-ch" }), "chevron-down");
    const tiles = [];
    const show = (v) => {
      const empty = !v || v === "none";
      tiles.forEach((x) => x.toggleClass("is-on", x.getAttr("data-v") === (empty ? "none" : v)));
      sw.style.setProperty("--c", empty ? "transparent" : colorOf(this.theme, v));
      sw.toggleClass("is-none", empty);
      tx.setText(empty ? "None" : v);
      tx.toggleClass("is-name", !empty && names.includes(v));
    };
    show(on);
    bar.addEventListener("click", () => {
      if (this.picker?.anchor === bar) this.closePicker();
      else this.openPicker(bar, on, pick, show, none);
    });
    const opts = [...none ? ["none"] : [], ...names];
    const g = parent.createDiv({ cls: "vl-tiles2" });
    const cur = on ?? (none ? "none" : void 0);
    for (const v of opts) {
      const t = g.createEl("button", { cls: "vl-ctile" + (v === cur ? " is-on" : ""), attr: { "aria-label": v === "none" ? "No colour" : `${v}: ${this.theme.colors[v]}`, "data-v": v } });
      tiles.push(t);
      const sw2 = t.createSpan({ cls: "vl-ctsw" + (v === "none" ? " is-none" : "") });
      if (v !== "none") sw2.style.background = colorOf(this.theme, v);
      t.createSpan({ cls: "vl-ctn", text: v });
      t.addEventListener("click", () => this.edit(() => pick(v)));
    }
    const recent = this.recentColors().filter((c) => !names.includes(c)).slice(0, 4);
    if (recent.length) {
      parent.createDiv({ cls: "vl-recentl", text: "Recent" });
      const rr = parent.createDiv({ cls: "vl-tiles2 is-recent" });
      for (const c of recent) {
        const t = rr.createEl("button", { cls: "vl-ctile" + (c === on ? " is-on" : ""), attr: { "aria-label": c, "data-v": c } });
        tiles.push(t);
        t.createSpan({ cls: "vl-ctsw is-check" }).style.setProperty("--c", c);
        t.createSpan({ cls: "vl-ctn is-hex", text: /^#[0-9a-f]{6,8}$/i.test(c) ? c.slice(1).toUpperCase() : c });
        t.addEventListener("click", () => {
          this.edit(() => pick(c));
          this.keepColor(c);
        });
      }
    }
  }
  // recent custom colours, newest first (kept on the device for this vault)
  recentColors() {
    try {
      return JSON.parse(getLocal("vellum:recentColors") ?? "[]");
    } catch {
      return [];
    }
  }
  keepColor(c) {
    if (!c || c === "none" || c in this.theme.colors) return;
    setLocal("vellum:recentColors", JSON.stringify([c, ...this.recentColors().filter((x) => x !== c)].slice(0, 8)));
  }
  closePicker() {
    const p = this.picker;
    if (!p) return;
    this.picker = null;
    p.off();
    p.el.remove();
  }
  openPicker(anchor, on, pick, show, none) {
    this.closePicker();
    const R = this.root;
    if (!R) return;
    const c = this.rgbaOf(on), hsv = rgbToHsv(c.r, c.g, c.b);
    const el = R.createDiv({ cls: "vl-cpop" });
    const sq = el.createDiv({ cls: "vl-csq" }), sqk = sq.createDiv({ cls: "vl-cknob" });
    const hue = el.createDiv({ cls: "vl-cstrip is-hue" }), huek = hue.createDiv({ cls: "vl-cknob" });
    const al = el.createDiv({ cls: "vl-cstrip is-alpha" }), alk = al.createDiv({ cls: "vl-cknob" });
    const vals = el.createDiv({ cls: "vl-cvals" });
    const fields = vals.createDiv({ cls: "vl-cfields" });
    const modes = el.createDiv({ cls: "vl-cmodes" });
    const foot = el.createDiv({ cls: "vl-cfoot" });
    const paint = () => {
      const hueC = `hsl(${hsv.h}, 100%, 50%)`, solid2 = `rgb(${c.r}, ${c.g}, ${c.b})`;
      sq.style.setProperty("--hue", hueC);
      sqk.style.left = `${hsv.s}%`;
      sqk.style.top = `${100 - hsv.v}%`;
      sqk.style.setProperty("--c", solid2);
      huek.style.left = `${hsv.h / 360 * 100}%`;
      huek.style.setProperty("--c", hueC);
      al.style.setProperty("--c", solid2);
      alk.style.left = `${c.a * 100}%`;
      alk.style.setProperty("--c", hexOf(c));
      for (const f of refresh) f();
    };
    const refresh = [];
    const set = () => {
      const h = hexOf(c);
      pick(h);
      show(h);
      this.draftPut();
      this.drawPages();
      this.drawBar();
      paint();
    };
    const fromHsv = () => {
      const r = hsvToRgb(hsv.h, hsv.s, hsv.v);
      c.r = r.r;
      c.g = r.g;
      c.b = r.b;
    };
    const drag = (area, at) => {
      area.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.begin();
        area.setPointerCapture(e.pointerId);
        const go = (m) => {
          const r = area.getBoundingClientRect();
          at(Math.min(1, Math.max(0, (m.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (m.clientY - r.top) / r.height)));
          set();
        };
        go(e);
        const up = () => {
          area.removeEventListener("pointermove", go);
          area.removeEventListener("pointerup", up);
          area.removeEventListener("pointercancel", up);
          this.end();
          this.keepColor(hexOf(c));
        };
        area.addEventListener("pointermove", go);
        area.addEventListener("pointerup", up);
        area.addEventListener("pointercancel", up);
      });
    };
    drag(sq, (x, y) => {
      hsv.s = Math.round(x * 100);
      hsv.v = Math.round((1 - y) * 100);
      fromHsv();
    });
    drag(hue, (x) => {
      hsv.h = Math.round(x * 360);
      fromHsv();
    });
    drag(al, (x) => {
      c.a = Math.round(x * 100) / 100;
    });
    const drawFields = () => {
      fields.empty();
      refresh.length = 0;
      if (this.colorMode === "hex") {
        const t = fields.createEl("input", { cls: "vl-chex", attr: { type: "text", spellcheck: "false", "aria-label": "Hex or any CSS colour" } });
        t.value = on && !(on in this.theme.colors) && on !== "none" && !/^#/.test(on) ? on : hexOf(c);
        refresh.push(() => {
          if (t.ownerDocument.activeElement !== t) t.value = hexOf(c);
        });
        t.addEventListener("keydown", (k) => {
          if (k.key === "Enter") t.blur();
        });
        t.addEventListener("change", () => {
          const v = t.value.trim();
          if (!v) return;
          if (!CSS.supports("color", v)) {
            t.addClass("is-bad");
            return;
          }
          t.removeClass("is-bad");
          Object.assign(c, this.rgbaOf(v));
          Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
          this.begin();
          pick(v);
          show(v);
          this.draftPut();
          this.drawPages();
          this.end();
          this.keepColor(v);
          paint();
          t.value = v;
        });
        return;
      }
      const box = (name, max, get, put) => {
        const w = fields.createDiv({ cls: "vl-num vl-cnum" });
        w.createSpan({ cls: "vl-numl", text: name });
        const i = w.createEl("input", { attr: { type: "number", min: "0", max: String(max), step: "1", "aria-label": name } });
        const val = (v) => {
          put(Math.min(max, Math.max(0, Math.round(v))));
          set();
        };
        i.addEventListener("focus", () => this.begin());
        i.addEventListener("input", () => {
          if (i.value !== "" && !Number.isNaN(Number(i.value))) val(Number(i.value));
        });
        i.addEventListener("blur", () => {
          this.end();
          this.keepColor(hexOf(c));
        });
        i.addEventListener("keydown", (k) => {
          if (k.key === "Enter") i.blur();
        });
        this.numberExtras(w, i, name, get, val, { min: 0, max, arrows: false, handle: w.querySelector(".vl-numl") ?? void 0 });
        refresh.push(() => {
          if (i.ownerDocument.activeElement !== i) i.value = String(Math.round(get()));
        });
      };
      if (this.colorMode === "rgb") {
        box("Red", 255, () => c.r, (v) => {
          c.r = v;
          Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
        });
        box("Green", 255, () => c.g, (v) => {
          c.g = v;
          Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
        });
        box("Blue", 255, () => c.b, (v) => {
          c.b = v;
          Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
        });
      } else {
        const hl = () => rgbToHsl(c.r, c.g, c.b);
        const fromHsl = (h, s, l) => {
          Object.assign(c, hslToRgb(h, s, l));
          Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
          hsv.h = h;
        };
        box("Hue", 360, () => hsv.h, (v) => {
          const x = hl();
          fromHsl(v, x.s, x.l);
        });
        box("Sat", 100, () => hl().s, (v) => {
          fromHsl(hsv.h, v, hl().l);
        });
        box("Light", 100, () => hl().l, (v) => {
          fromHsl(hsv.h, hl().s, v);
        });
      }
      box("Opacity", 100, () => Math.round(c.a * 100), (v) => {
        c.a = v / 100;
      });
    };
    for (const [m, label2] of [["hex", "HEX"], ["rgb", "RGB"], ["hsl", "HSL"]]) {
      const b = modes.createEl("button", { cls: "vl-cmode" + (this.colorMode === m ? " is-on" : ""), text: label2 });
      b.addEventListener("click", () => {
        this.colorMode = m;
        setLocal("vellum:colorMode", m);
        modes.querySelectorAll(".vl-cmode").forEach((x) => x.toggleClass("is-on", x === b));
        drawFields();
        paint();
      });
    }
    drawFields();
    const names2 = Object.keys(this.theme.colors), tl = el.createDiv({ cls: "vl-tiles2 is-pop" });
    el.insertBefore(tl, foot);
    for (const v of names2) {
      const t = tl.createEl("button", { cls: "vl-ctile" + (v === on ? " is-on" : ""), attr: { "aria-label": v } });
      t.createSpan({ cls: "vl-ctsw" }).style.background = colorOf(this.theme, v);
      t.createSpan({ cls: "vl-ctn", text: v });
      t.addEventListener("click", () => {
        this.edit(() => pick(v));
        this.closePicker();
      });
    }
    const recent = this.recentColors();
    if (none) {
      const n = foot.createEl("button", { cls: "vl-cdot is-none", attr: { "aria-label": "None" } });
      n.addEventListener("click", () => {
        this.edit(() => pick("none"));
        this.closePicker();
      });
    }
    for (const h of recent) {
      const d = foot.createEl("button", { cls: "vl-cdot", attr: { "aria-label": h } });
      d.style.setProperty("--c", h);
      d.addEventListener("click", () => {
        Object.assign(c, this.rgbaOf(h));
        Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
        this.begin();
        set();
        this.end();
        this.keepColor(h);
      });
    }
    if (!recent.length && !none) foot.remove();
    paint();
    const rr = R.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
    el.style.left = `${Math.max(8, Math.min(rr.width - pw - 8, ar.left - rr.left))}px`;
    el.style.top = `${ar.bottom - rr.top + 6 + ph > rr.height - 8 ? Math.max(8, ar.top - rr.top - 6 - ph) : ar.bottom - rr.top + 6}px`;
    const doc = R.doc;
    const outside = (e) => {
      const t = e.target;
      if (!el.contains(t) && !anchor.contains(t)) this.closePicker();
    };
    const esc = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        this.closePicker();
      }
    };
    window.setTimeout(() => doc.addEventListener("pointerdown", outside, true));
    doc.addEventListener("keydown", esc, true);
    this.picker = { el, anchor, off: () => {
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", esc, true);
    } };
  }
  // any colour (a theme name, CSS) as red, green, blue (0–255) and opacity (0–1), as the browser draws it
  rgbaOf(v) {
    const host = this.panel ?? this.root ?? activeDocument.body, el = host.createDiv();
    el.style.color = !v || v === "none" ? "rgb(128, 128, 128)" : colorOf(this.theme, v);
    const m = (getComputedStyle(el).color.match(/[\d.]+/g) ?? []).map(Number);
    el.remove();
    return { r: m[0] ?? 128, g: m[1] ?? 128, b: m[2] ?? 128, a: m.length > 3 ? m[3] : 1 };
  }
  actions(parent, list) {
    const g = parent.createDiv({ cls: "vl-acts" });
    for (const [icon, text, act] of list) {
      const x = g.createEl("button", { cls: "vl-act" });
      (0, import_obsidian3.setIcon)(x.createSpan(), icon);
      x.appendText(text);
      x.addEventListener("click", act);
    }
  }
  // a main screen has no How: the text comes back if it gets a parent again (this session, not saved)
  chainOf(id) {
    const out = [], seen = /* @__PURE__ */ new Set();
    for (let c = this.doc.pages.find((q) => q.id === id); c && !seen.has(c.id); c = this.doc.pages.find((q) => q.id === c?.parent)) {
      seen.add(c.id);
      out.unshift(c);
    }
    return out;
  }
  parentField(parent, p) {
    const chain = this.chainOf(p.parent), names = chain.map((c) => c.name);
    const f = parent.createEl("button", { cls: "vl-ppf", attr: { "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": `Opened from: ${names.join(" \u203A ") || "Main screen"}` } });
    f.createSpan({ cls: "vl-ppft", text: names.length ? (names.length > 2 ? "\u2026 \u203A " : "") + names.slice(-2).join(" \u203A ") : "Main screen" });
    (0, import_obsidian3.setIcon)(f.createSpan({ cls: "vl-chev" }), "chevron-down");
    f.addEventListener("click", () => {
      if (this.parentClose) this.parentClose();
      else this.parentOpen(f, p);
    });
  }
  parentPick(p, v) {
    let reset = false;
    this.edit(() => {
      if (v) {
        const kept = !p.parent ? this.howKept.get(p.id) : void 0;
        if (kept && !p.link) p.link = kept;
        this.howKept.delete(p.id);
        if (p.inherit) {
          delete p.inherit;
          reset = true;
        }
        p.parent = v;
      } else {
        if (p.link) this.howKept.set(p.id, p.link);
        delete p.parent;
        delete p.link;
        delete p.inherit;
      }
    });
    const f = this.panel?.querySelector(".vl-ppf");
    f?.focus();
    if (reset) this.hint("Layout set back to Its own", f ?? void 0, false);
  }
  parentOpen(field, p) {
    const R = this.root;
    if (!R?.isConnected) return;
    const pages = this.doc.pages, under = subtreeOf(pages, p.id), now = this.chainOf(p.parent).pop()?.id ?? "";
    const tree = [], seen = /* @__PURE__ */ new Set();
    const walk = (q, depth) => {
      if (seen.has(q.id)) return;
      seen.add(q.id);
      tree.push({ q, depth });
      for (const c of childrenOf(pages, q.id)) walk(c, depth + 1);
    };
    for (const q of childrenOf(pages)) walk(q, 0);
    for (const q of pages) walk(q, 0);
    const pop = R.createDiv({ cls: "vl-pp" + (import_obsidian3.Platform.isMobile ? " is-phone" : "") });
    const find = pop.createDiv({ cls: "vl-ppfind" });
    (0, import_obsidian3.setIcon)(find.createSpan({ cls: "vl-ppfi" }), "search");
    const input = find.createEl("input", { attr: { type: "text", placeholder: "Find a screen", "aria-label": "Find a screen", autocomplete: "off", spellcheck: "false" } });
    const opts = pop.createDiv({ attr: { role: "listbox", "aria-label": "Opened from" } });
    const top = opts.createDiv(), sep = opts.createDiv({ cls: "vl-ppsep" }), list = opts.createDiv({ cls: "vl-pplist" });
    const rr = R.getBoundingClientRect(), fr = field.getBoundingClientRect(), W = Math.min(290, rr.width - 16);
    pop.style.width = `${W}px`;
    pop.style.left = `${Math.max(8, Math.min(rr.width - W - 8, fr.right - rr.left - W))}px`;
    const below = rr.bottom - fr.bottom - 12, above = fr.top - rr.top - 12, down = below >= 300 || below >= above;
    if (down) pop.style.top = `${fr.bottom - rr.top + 4}px`;
    else pop.style.bottom = `${rr.bottom - fr.top + 4}px`;
    list.style.maxHeight = `${Math.max(120, Math.min(340, (down ? below : above) - 90))}px`;
    let live2 = [], at = -1, shown;
    const look = (q, el) => {
      if (import_obsidian3.Platform.isMobile || q === shown) return;
      shown = q;
      if (q) this.peek(q, el, pop);
      else this.unpeek();
    };
    const unlook = () => {
      shown = void 0;
      this.unpeek();
    };
    const show = (i, scroll, peek) => {
      live2[at]?.el.removeClass("is-active");
      at = i;
      const o = live2[i];
      if (!o) return;
      o.el.addClass("is-active");
      if (scroll && list.contains(o.el)) {
        const y = o.el.offsetTop, h = o.el.offsetHeight;
        if (y < list.scrollTop || y + h > list.scrollTop + list.clientHeight) list.scrollTop = y - (list.clientHeight - h) / 2;
      }
      if (peek) look(o.page, o.el);
    };
    const addRow = (to, id, name, o = {}) => {
      const el = to.createDiv({ cls: "vl-ppr" + (id === now ? " is-on" : "") + (o.page?.mock ? " is-mock" : "") + (o.why ? " is-off" : ""), attr: { role: "option", "aria-selected": String(id === now) } });
      if (o.why) el.setAttr("aria-disabled", "true");
      if (o.depth) {
        const ind = el.createDiv({ cls: "vl-pind" });
        for (let i = 0; i < o.depth; i++) ind.createSpan({ cls: "vl-pguide" });
      }
      const n = el.createSpan({ cls: "vl-ppn" }), m = o.text ? name.toLowerCase().indexOf(o.text) : -1;
      if (m >= 0) {
        n.appendText(name.slice(0, m));
        n.createSpan({ cls: "vl-ppm", text: name.slice(m, m + o.text.length) });
        n.appendText(name.slice(m + o.text.length));
      } else n.setText(name);
      if (o.page?.mock) n.appendText(" \xB7 mock");
      if (o.text && m < 0) el.addClass("is-ctx");
      if (o.why) el.createSpan({ cls: "vl-pptag", text: o.why });
      else if (id === now) (0, import_obsidian3.setIcon)(el.createSpan({ cls: "vl-ppc" }), "check");
      const opt = { id, el, page: o.page };
      if (!o.why) {
        live2.push(opt);
        el.addEventListener("click", () => {
          close();
          if (id !== now) this.parentPick(p, id);
          else field.focus();
        });
      }
      if (o.page && import_obsidian3.Platform.isMobile) this.peekOn(el, o.page);
      if (!import_obsidian3.Platform.isMobile) el.addEventListener("mousemove", () => {
        const i = live2.indexOf(opt);
        if (i >= 0 && i !== at) show(i, false, false);
        look(o.page, el);
      });
    };
    const fill = () => {
      const text = input.value.trim().toLowerCase();
      top.empty();
      list.empty();
      live2 = [];
      at = -1;
      unlook();
      sep.toggle(!text);
      if (!text) addRow(top, "", "Main screen");
      const keep = /* @__PURE__ */ new Set();
      if (text) {
        for (const { q } of tree) if (q.name.toLowerCase().includes(text)) for (const c of this.chainOf(q.id)) keep.add(c.id);
      }
      for (const { q, depth } of tree) {
        if (text && !keep.has(q.id)) continue;
        addRow(list, q.id, q.name, { depth, page: q, text, why: q.id === p.id ? "this screen" : under.has(q.id) ? "under this screen" : "" });
      }
      if (text && !keep.size) list.createDiv({ cls: "vl-ppnone", text: `No screen has "${input.value.trim()}" in its name` });
      show(text ? Math.max(0, live2.findIndex((o) => o.page?.name.toLowerCase().includes(text))) : live2.findIndex((o) => o.id === now), true, false);
    };
    input.addEventListener("input", fill);
    input.addEventListener("keydown", (k) => {
      if (k.isComposing) return;
      k.stopPropagation();
      if (k.key === "ArrowDown" || k.key === "ArrowUp") {
        k.preventDefault();
        if (live2.length) show((at + (k.key === "ArrowDown" ? 1 : -1) + live2.length) % live2.length, true, true);
      } else if (k.key === "Enter") {
        k.preventDefault();
        live2[at]?.el.click();
      } else if (k.key === "Escape") {
        k.preventDefault();
        close();
        field.focus();
      }
    });
    pop.addEventListener("mouseleave", unlook);
    const scroller = field.closest(".vl-pbody"), off = (e) => {
      if (!pop.isConnected) close();
      else if (!pop.contains(e.target) && !field.contains(e.target)) close();
    };
    const close = () => {
      if (this.parentClose === close) this.parentClose = null;
      pop.remove();
      this.unpeek();
      field.setAttr("aria-expanded", "false");
      R.doc.removeEventListener("pointerdown", off, true);
      R.win.removeEventListener("resize", close);
      scroller?.removeEventListener("scroll", close);
    };
    this.parentClose = close;
    field.setAttr("aria-expanded", "true");
    R.doc.addEventListener("pointerdown", off, true);
    R.win.addEventListener("resize", close);
    scroller?.addEventListener("scroll", close, { passive: true });
    fill();
    if (!import_obsidian3.Platform.isMobile) input.focus();
  }
  pagePanel(body, p) {
    const s = this.section(body, "Screen");
    this.text(this.frow(s, "Name"), () => p.name, (v) => {
      p.name = v;
    }, { title: "Screen name" });
    this.seg(this.frow(s, "Status"), [["real", "Real", "badge-check"], ["mock", "Mock", "lightbulb"]], p.mock ? "mock" : "real", (v) => {
      if (v === "mock") p.mock = true;
      else delete p.mock;
    });
    this.parentField(this.frow(s, "Opened from"), p);
    if (p.parent) this.text(this.frow(s, "How"), () => p.link ?? "", (v) => {
      if (v.trim()) p.link = v;
      else delete p.link;
    }, { placeholder: "tap a row, + button\u2026", title: "How you get there" });
    const par = p.parent ? this.page(p.parent) : void 0;
    if (par) this.seg(this.frow(s, "Layout"), [["own", "Its own"], ["frame", `On ${par.name}'s frame`]], p.inherit ? "frame" : "own", (v) => {
      if (v === "frame") p.inherit = true;
      else delete p.inherit;
    });
    const fr = frameOf(this.doc.pages, p), was = fr && bgOf(this.doc.pages, fr) || "paper";
    this.colors(this.section(body, "Background"), p.bg ?? was, (v) => {
      if (v === was) delete p.bg;
      else p.bg = v;
    });
    const a = this.section(body, "Add a block");
    const g = a.createDiv({ cls: "vl-addgrid" });
    for (const k of this.kinds) {
      const c = g.createEl("button", { cls: "vl-addt", attr: { "aria-label": `Add a ${k.name} block` } });
      c.style.setProperty("--k", k.color);
      (0, import_obsidian3.setIcon)(c.createSpan({ cls: "vl-addi" }), k.icon ?? "square");
      c.createSpan({ text: k.name.split(" / ")[0] });
      c.addEventListener("click", () => this.edit(() => {
        const { W, safe } = this.screen(p);
        const low = drawnBlocks(this.doc.pages, p, this.land).reduce((m, x) => Math.max(m, x.y + x.h), safe.top);
        const nb = { id: uid(), name: k.name.split(" / ")[0], kind: k.id, x: 16 + safe.left, y: low + 8, w: W - 32 - safe.left - safe.right, h: 80, items: [] };
        this.blocks(p, true).push(nb);
        this.sel = { page: p.id, block: nb.id };
      }));
    }
    if (this.land && p.land) this.actions(a, [["trash", "Remove the landscape layout", () => this.edit(() => {
      delete p.land;
      this.sel = { page: p.id };
    })]]);
    else if (this.land && p.blocks.length) this.actions(a, [["rectangle-horizontal", "Make landscape from portrait", () => this.makeLand(p)]]);
    const cur = this.screen(p).safe;
    const sa = this.section(body, "Safe areas", true, { shut: true, hint: `${cur.top} \xB7 ${cur.bottom} \xB7 ${cur.left} \xB7 ${cur.right}` });
    sa.createDiv({ cls: "vl-frameinfo", text: `Every screen, ${this.land ? "landscape" : "portrait"}.` });
    const own = screenOf(deviceOf(p.device ?? this.doc.device), this.land).safe, key = this.land ? "safeLand" : "safe";
    const nums = sa.createDiv({ cls: "vl-nums" });
    const lit = (side) => {
      const w = this.wall;
      if (!w) return;
      if (side === void 0) delete w.dataset.safe;
      else w.dataset.safe = side;
    };
    const sec = sa.parentElement;
    sec.addEventListener("mouseenter", () => lit("all"));
    sec.addEventListener("mouseleave", () => lit());
    for (const [k, name] of [["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"]]) {
      const nw = this.num(nums, name, () => this.screen(p).safe[k], (v) => {
        const o = { ...this.doc[key] };
        if (v === own[k]) delete o[k];
        else o[k] = v;
        if (Object.keys(o).length) this.doc[key] = o;
        else delete this.doc[key];
      }, { min: 0, max: 400, unit: "pt" });
      nw.addEventListener("mouseenter", () => lit(k));
      nw.addEventListener("mouseleave", () => lit("all"));
    }
    if (this.doc[key]) this.actions(sa, [["rotate-ccw", `The device's own (${own.top} \xB7 ${own.bottom} \xB7 ${own.left} \xB7 ${own.right})`, () => this.edit(() => {
      delete this.doc[key];
    })]]);
    const n = this.section(body, "Note", true, { shut: true, hint: p.note ? p.note.split("\n")[0].slice(0, 26) : "empty" });
    this.text(n, () => p.note ?? "", (v) => {
      if (v.trim()) p.note = v;
      else delete p.note;
    }, { area: true, placeholder: "What this screen is for" });
  }
  blockPanel(body, p, b) {
    const s = this.section(body, "Block");
    this.text(this.frow(s, "Name"), () => b.name, (v) => {
      b.name = v;
    }, { title: "Block name" });
    const kc = this.frow(s, "Kind"), kind = this.kinds.find((k) => k.id === b.kind) ?? this.kinds[0];
    const ki = kc.createSpan({ cls: "vl-kindi" });
    ki.style.setProperty("--k", kind.color);
    (0, import_obsidian3.setIcon)(ki, kind.icon ?? "square");
    this.menu(kc, this.kinds.map((k) => [k.id, k.name]), b.kind, (v) => {
      b.kind = v;
    }, "Kind");
    const l = this.layers(p).find((x) => x.block === b);
    if (l?.over) {
      const o = this.section(body, "Override");
      o.createDiv({ cls: "vl-frameinfo", text: `Takes the place of ${this.page(l.over)?.name ?? "the frame"}'s ${b.name} on this screen.` });
      this.actions(o, [["undo-2", "Back to the frame", () => this.edit(() => {
        const own = this.blocks(p);
        own.splice(own.indexOf(b), 1);
        this.sel = { page: p.id, block: b.id };
      })]]);
    }
    const pl = this.section(body, "Place");
    this.placeTool(pl, p, b);
    this.seg(this.frow(pl, "Bars"), [["in", "Inside the safe area"], ["bleed", "Under them"]], b.bleed ? "bleed" : "in", (v) => {
      if (v === "bleed") b.bleed = true;
      else {
        delete b.bleed;
        const R = this.room(p, b);
        if (!inRoom(b, R)) clampTo(b, R, false);
      }
    });
    this.lookControls(this.section(body, "Look", true, { shut: !lookOn(b), hint: lookHint(b) }), b, { sides: true });
    const it = this.section(body, "Items", true, { hint: String(b.items.length) });
    this.itemList(it, b, b.items);
    this.addButtons(it, b, b.items, ["text", "rect", "img", "icon", "line", "row", "col", "ellipse"]);
    const n = this.section(body, "Note", true, { shut: true, hint: b.note ? b.note.split("\n")[0].slice(0, 26) : "empty" });
    this.text(n, () => b.note ?? "", (v) => {
      if (v.trim()) b.note = v;
      else delete b.note;
    }, { area: true, placeholder: "What goes here, what is wrong (for the agent)" });
  }
  // a frame's block on a page that inherits it: locked here; copy it in to change it here, or edit it where it belongs
  framePanel(body, p, l) {
    const owner = this.page(l.from), s = this.section(body, "From the frame");
    const lk = s.createDiv({ cls: "vl-lock" });
    (0, import_obsidian3.setIcon)(lk.createSpan({ cls: "vl-locki" }), "lock");
    lk.createSpan({ text: `${l.block.name} belongs to ${owner?.name ?? "the frame"}. It is drawn under this screen's own blocks and locked here.` });
    const acts = [["copy-plus", "Change it on this screen only", () => this.edit(() => {
      const c = JSON.parse(JSON.stringify(l.block));
      this.blocks(p, true).push(c);
      this.sel = { page: p.id, block: c.id };
    })]];
    if (owner) acts.push(["arrow-up-right", `Edit it in ${owner.name}`, () => {
      this.setView({ page: owner.id });
      this.sel = { page: owner.id, block: l.block.id };
      if (import_obsidian3.Platform.isMobile) this.setView({ rail: false });
      this.draw();
    }]);
    this.actions(s, acts);
  }
  // where a block sits, on a small phone: the safe areas, every block, the chosen one with its corner to resize; drag it
  // to move, click another to choose it; its distance to each edge of the room on the diagram (a click types it). Under
  // it the numbers (x, y, w, h: their labels drag), the align bar, and whether it may go under the bars
  placeTool(pl, p, b) {
    const room = this.room(p, b), { W, H, safe } = this.screen(p);
    const gap = { l: () => b.x - room.l, r: () => room.r - b.x - b.w, t: () => b.y - room.t, b: () => room.b - b.y - b.h };
    const setGap = (side, d) => {
      if (side === "l") b.x = room.l + d;
      else if (side === "r") b.x = room.r - b.w - d;
      else if (side === "t") b.y = room.t + d;
      else b.y = room.b - b.h - d;
    };
    const dia = pl.createDiv({ cls: "vl-gdia" });
    const k = Math.min(200 / H, 180 / W), ph = dia.createDiv({ cls: "vl-gphone" });
    Object.assign(ph.style, { width: `${W * k}px`, height: `${H * k}px` });
    for (const [side, v] of Object.entries(safe)) if (v) {
      const sa = ph.createDiv({ cls: `vl-gsafe is-${side}` });
      sa.style[side === "top" || side === "bottom" ? "height" : "width"] = `${v * k}px`;
    }
    const others = this.layers(p).map((l) => l.block).filter((x) => x.id !== b.id);
    for (const o of others) {
      const r = ph.createDiv({ cls: "vl-gblk", attr: { "aria-label": `Choose ${o.name}` } });
      Object.assign(r.style, { left: `${o.x * k}px`, top: `${o.y * k}px`, width: `${o.w * k}px`, height: `${o.h * k}px` });
      r.addEventListener("click", () => this.choose({ page: p.id, block: o.id }));
    }
    const me = ph.createDiv({ cls: "vl-gblk is-me" }), grip = me.createDiv({ cls: "vl-ggrip", attr: { "aria-label": "Resize" } });
    const tags = {};
    for (const [side, name] of [["l", "Left"], ["r", "Right"], ["t", "Top"], ["b", "Bottom"]]) {
      const t = dia.createEl("button", { cls: `vl-gdist is-${side}`, attr: { "aria-label": `${name} distance: click to type` } });
      tags[side] = t;
      t.addEventListener("click", () => {
        const i = createEl("input", { cls: "vl-gdin", attr: { type: "number" } });
        i.value = String(gap[side]());
        i.style.left = t.style.left;
        i.style.top = t.style.top;
        t.replaceWith(i);
        i.focus();
        i.select();
        let done = false;
        const fin = (keep) => {
          if (done) return;
          done = true;
          const n = Number(i.value);
          if (keep && i.value !== "" && !Number.isNaN(n)) this.edit(() => setGap(side, Math.round(n)));
          else this.drawPanel();
        };
        i.addEventListener("keydown", (e) => {
          if (e.key === "Enter") fin(true);
          if (e.key === "Escape") {
            e.stopPropagation();
            fin(false);
          }
        });
        i.addEventListener("blur", () => fin(true));
      });
    }
    const paint = () => {
      Object.assign(me.style, { left: `${b.x * k}px`, top: `${b.y * k}px`, width: `${b.w * k}px`, height: `${b.h * k}px` });
      const pr = ph.offsetLeft, pt = ph.offsetTop;
      tags.l.setText(String(gap.l()));
      tags.r.setText(String(gap.r()));
      tags.t.setText(String(gap.t()));
      tags.b.setText(String(gap.b()));
      Object.assign(tags.l.style, { left: `${pr + (room.l + gap.l() / 2) * k}px`, top: `${pt + (b.y + b.h / 2) * k}px` });
      Object.assign(tags.r.style, { left: `${pr + (b.x + b.w + gap.r() / 2) * k}px`, top: `${pt + (b.y + b.h / 2) * k}px` });
      Object.assign(tags.t.style, { left: `${pr + (b.x + b.w / 2) * k}px`, top: `${pt + (room.t + gap.t() / 2) * k}px` });
      Object.assign(tags.b.style, { left: `${pr + (b.x + b.w / 2) * k}px`, top: `${pt + (b.y + b.h + gap.b() / 2) * k}px` });
    };
    const drag = (el, resize) => el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      this.begin();
      const x0 = e.clientX, y0 = e.clientY, s0 = { ...b }, R = this.room(p, b), keep = !b.bleed && inRoom(b, R);
      const mv = (m) => {
        const dx = (m.clientX - x0) / k, dy = (m.clientY - y0) / k, sn = (v) => m.altKey ? Math.round(v) : Math.round(v / grid()) * grid();
        if (resize) {
          b.w = Math.max(8, sn(s0.w + dx));
          b.h = Math.max(8, sn(s0.h + dy));
        } else {
          b.x = sn(s0.x + dx);
          b.y = sn(s0.y + dy);
        }
        if (keep) clampTo(b, R, resize);
        paint();
        this.draftPut();
        this.drawPages();
        this.livePanel();
      };
      const up = () => {
        el.removeEventListener("pointermove", mv);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        this.end();
        this.drawPanel();
      };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
    drag(me, false);
    drag(grip, true);
    window.setTimeout(paint);
    const nums = pl.createDiv({ cls: "vl-nums is-four" });
    this.num(nums, "X", () => b.x, (v) => {
      b.x = Math.round(v);
    });
    this.num(nums, "Y", () => b.y, (v) => {
      b.y = Math.round(v);
    });
    this.num(nums, "W", () => b.w, (v) => {
      b.w = Math.max(8, Math.round(v));
    }, { min: 8 });
    this.num(nums, "H", () => b.h, (v) => {
      b.h = Math.max(8, Math.round(v));
    }, { min: 8 });
    const al = pl.createDiv({ cls: "vl-align" });
    const A = [
      ["align-horizontal-justify-start", "Align left", () => {
        b.x = room.l;
      }],
      ["align-horizontal-justify-center", "Centre across", () => {
        b.x = Math.round((room.l + room.r - b.w) / 2);
      }],
      ["align-horizontal-justify-end", "Align right", () => {
        b.x = room.r - b.w;
      }],
      ["|", "", () => {
      }],
      ["align-vertical-justify-start", "Align top", () => {
        b.y = room.t;
      }],
      ["align-vertical-justify-center", "Centre down", () => {
        b.y = Math.round((room.t + room.b - b.h) / 2);
      }],
      ["align-vertical-justify-end", "Align bottom", () => {
        b.y = room.b - b.h;
      }],
      ["|", "", () => {
      }],
      ["move-horizontal", "Full width", () => {
        b.x = room.l;
        b.w = room.r - room.l;
      }],
      ["maximize", "Fill the screen", () => {
        b.x = room.l;
        b.y = room.t;
        b.w = room.r - room.l;
        b.h = room.b - room.t;
      }]
    ];
    for (const [icon, label2, act] of A) {
      if (icon === "|") {
        al.createSpan({ cls: "vl-alsep" });
        continue;
      }
      this.icon(this.btn(al, icon, label2, () => this.edit(act)), icon, label2);
    }
    const live2 = dia.createSpan({ cls: "vl-gdlive" });
    this.liveText.set(live2, () => {
      paint();
      return "";
    });
  }
  // a block kind: its icon in its colour, its name in the tooltip
  kindChip(g, k, on) {
    const c = g.createEl("button", { cls: "vl-chip is-icon is-kind" + (on ? " is-on" : ""), attr: { "aria-label": k.name } });
    c.style.setProperty("--k", k.color);
    (0, import_obsidian3.setIcon)(c, k.icon ?? "square");
    if (!c.querySelector("svg")) c.setText(k.name);
    return c;
  }
  // an icon by name, else its words (an icon set may not have every name)
  icon(el, name, words) {
    if (!el.querySelector("svg")) {
      el.empty();
      el.setText(words);
      el.addClass("is-words");
    }
    return el;
  }
  itemList(parent, b, list) {
    const l = parent.createDiv({ cls: "vl-list" });
    list.forEach((it, i) => {
      const r = l.createDiv({ cls: "vl-row" });
      const grip = r.createSpan({ cls: "vl-igrip2", attr: { "aria-label": "Drag up or down to reorder" } });
      (0, import_obsidian3.setIcon)(grip, "grip-vertical");
      const pick = r.createEl("button", { cls: "vl-rowmain" });
      (0, import_obsidian3.setIcon)(pick.createSpan({ cls: "vl-rowty" }), TYPE_ICON[it.type]);
      pick.createSpan({ cls: "vl-rowtx", text: label(it) });
      const d = detail(it);
      if (d) pick.createSpan({ cls: "vl-rowsub", text: d });
      pick.addEventListener("click", () => this.choose({ page: this.sel.page, block: b.id, item: it.id }));
      const lit = (on) => this.wall?.querySelectorAll(`.vl-block[data-block="${b.id}"] .vl-it[data-id="${it.id}"]`).forEach((x) => x.toggleClass("is-hl", on));
      r.addEventListener("mouseenter", () => lit(true));
      r.addEventListener("mouseleave", () => lit(false));
      grip.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        const rows = [...l.querySelectorAll(":scope > .vl-row")];
        let to = i;
        const mv = (m) => {
          to = rows.findIndex((x) => m.clientY < x.getBoundingClientRect().top + x.offsetHeight / 2);
          if (to < 0) to = rows.length;
          rows.forEach((x, n) => {
            x.toggleClass("is-drop", n === to);
          });
          l.toggleClass("is-drop-end", to === rows.length);
          r.addClass("is-moving");
        };
        const up = () => {
          grip.removeEventListener("pointermove", mv);
          grip.removeEventListener("pointerup", up);
          grip.removeEventListener("pointercancel", up);
          rows.forEach((x) => x.removeClass("is-drop"));
          l.removeClass("is-drop-end");
          r.removeClass("is-moving");
          const dest = to > i ? to - 1 : to;
          if (dest !== i) this.edit(() => {
            const [x] = list.splice(i, 1);
            list.splice(dest, 0, x);
          });
        };
        grip.addEventListener("pointermove", mv);
        grip.addEventListener("pointerup", up);
        grip.addEventListener("pointercancel", up);
      });
    });
  }
  addButtons(parent, b, list, types) {
    const names = { text: "Text", rect: "Shape", ellipse: "Circle", line: "Line", img: "Picture", icon: "Icon", row: "Row", col: "Column" };
    const g = parent.createDiv({ cls: "vl-addgrid is-items" });
    for (const t of types) {
      const c = g.createEl("button", { cls: "vl-addt", attr: { "aria-label": `Add a ${names[t].toLowerCase()}` } });
      (0, import_obsidian3.setIcon)(c.createSpan({ cls: "vl-addi" }), t === "icon" ? "smile-plus" : TYPE_ICON[t]);
      c.createSpan({ text: names[t] });
      c.addEventListener("click", () => this.edit(() => {
        const it = newItem(t);
        if (list !== b.items) {
          delete it.g;
          delete it.dx;
          delete it.dy;
        }
        list.push(it);
        this.sel = { page: this.sel.page, block: b.id, item: it.id };
      }));
    }
  }
  itemPanel(body, b, it, top) {
    this.stylePanel(body, b, it);
    this.placePanel(body, b, it, top);
    this.text(this.section(body, "Note", true), () => it.note ?? "", (v) => {
      if (v.trim()) it.note = v;
      else delete it.note;
    }, { area: true, placeholder: "Why it is here, what to change (for the agent)" });
  }
  stylePanel(body, b, it) {
    if (it.type === "text") {
      const s = this.section(body, "Text");
      this.text(s, () => it.v ?? "", (v) => {
        it.v = v;
      }, { area: true });
      const fc = this.frow(s, "Font");
      this.menu(fc, Object.keys(this.theme.fonts).map((k) => [k, k]), it.font ?? "ui", (v) => {
        it.font = v === "ui" ? void 0 : v;
      }, "Font");
      this.menu(fc, [["100", "Thin"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"], ["900", "Black"]], String(it.wt ?? 400), (v) => {
        it.wt = v === "400" ? void 0 : Number(v);
      }, "Weight");
      const r = s.createDiv({ cls: "vl-nums is-three" });
      this.num(r, "Size", () => it.size ?? 15, (v) => {
        it.size = v;
      }, { min: 4, max: 400 });
      this.num(r, "Spacing", () => it.ls ?? 0, (v) => {
        it.ls = v || void 0;
      }, { step: 0.01 });
      this.num(r, "Line", () => it.lh ?? 1.2, (v) => {
        it.lh = v;
      }, { step: 0.05, min: 0.5 });
      this.seg(this.frow(s, "Case"), [["no", "As typed"], ["up", "CAPITALS"]], it.upper ? "up" : "no", (v) => {
        it.upper = v === "up" || void 0;
      });
      this.colors(this.section(body, "Colour"), it.color ?? "text", (v) => {
        it.color = v === "text" ? void 0 : v;
      });
      this.lookControls(this.section(body, "Box", true, { shut: !lookOn(it), hint: lookHint(it) }), it, { pad: true });
    } else if (it.type === "line") {
      const s = this.section(body, "Line");
      const r = s.createDiv({ cls: "vl-nums" });
      this.num(r, "Thickness", () => typeof it.h === "number" ? it.h : 1, (v) => {
        it.h = v;
      }, { min: 1, unit: "pt" });
      this.num(r, "Opacity", () => it.op ?? 100, (v) => {
        it.op = v >= 100 ? void 0 : v;
      }, { min: 0, max: 100, unit: "%" });
      this.colors(this.section(body, "Colour"), it.fill ?? "line", (v) => {
        it.fill = v;
      });
    } else if (it.type === "img") {
      this.picturePanel(body, b, it);
    } else if (it.type === "icon") {
      const s = this.section(body, "Icon");
      const sug = createDiv({ cls: "vl-chips is-icons vl-iconpick" });
      const fill = () => {
        sug.empty();
        const q = (it.name ?? "").trim().toLowerCase(), all = iconNames();
        const hits = q ? all.filter((n) => n.includes(q)).sort((a, z) => Number(!a.startsWith(q)) - Number(!z.startsWith(q)) || a.length - z.length) : all;
        for (const n of hits.slice(0, 48)) {
          const c = sug.createEl("button", { cls: "vl-chip is-icon" + (n === it.name ? " is-on" : ""), attr: { "aria-label": n } });
          (0, import_obsidian3.setIcon)(c, n);
          c.addEventListener("click", () => this.edit(() => {
            it.name = n;
          }));
        }
        if (!hits.length) sug.createDiv({ cls: "vl-frameinfo", text: "No icon by that name: it shows as a ?" });
      };
      this.text(s, () => it.name ?? "", (v) => {
        it.name = v.trim();
        fill();
      }, { placeholder: "A Lucide name: sparkles, house\u2026", title: "Icon name" });
      s.appendChild(sug);
      fill();
      const r = s.createDiv({ cls: "vl-nums is-three" });
      this.num(r, "Size", () => it.size ?? 20, (v) => {
        it.size = v;
      }, { min: 4, max: 400 });
      this.num(r, "Stroke", () => it.sw ?? 0, (v) => {
        it.sw = v || void 0;
      }, { step: 0.25, min: 0, max: 4 });
      this.num(r, "Opacity", () => it.op ?? 100, (v) => {
        it.op = v >= 100 ? void 0 : v;
      }, { min: 0, max: 100, unit: "%" });
      this.colors(this.section(body, "Colour"), it.color ?? "text", (v) => {
        it.color = v === "text" ? void 0 : v;
      });
    } else if (it.type === "row" || it.type === "col") {
      const s = this.section(body, "Layout"), across = it.type === "row";
      this.seg(this.frow(s, "Direction"), [["row", "Across", "arrow-right"], ["col", "Down", "arrow-down"]], it.type, (v) => {
        it.type = v;
      });
      this.seg(this.frow(s, "Line up"), across ? [["start", "Top"], ["center", "Middle"], ["end", "Bottom"]] : [["start", "Left"], ["center", "Middle"], ["end", "Right"]], it.cross ?? "start", (v) => {
        it.cross = v;
      });
      this.seg(this.frow(s, "Spread"), [["start", "Start"], ["center", "Middle"], ["end", "End"], ["between", "Apart"]], it.main ?? "start", (v) => {
        it.main = v;
      });
      const r = s.createDiv({ cls: "vl-nums" });
      this.num(r, "Gap", () => it.gap ?? 0, (v) => {
        it.gap = v;
      }, { min: 0, unit: "pt" });
      this.num(r, "Padding", () => it.pad ?? 0, (v) => {
        it.pad = v || void 0;
      }, { min: 0, unit: "pt" });
      const c = this.section(body, "Items in it", true, { hint: String(it.items?.length ?? 0) });
      this.itemList(c, b, it.items ?? (it.items = []));
      this.addButtons(c, b, it.items, ["text", "rect", "img", "icon", "row", "col", "ellipse"]);
      this.lookControls(this.section(body, "Look", true, { shut: !lookOn(it), hint: lookHint(it) }), it, {});
    } else {
      this.shapeStyle(body, it, false);
      this.sizeNums(body, it, b.items.includes(it));
      this.rectToLook(body, b, it);
    }
  }
  // a picture's settings: the whole picture with the part the box shows framed (click or drag it to choose that part),
  // its address (or a picture of the vault), how it fits, the focus as a 3 × 3 grid, its size
  picturePanel(body, b, it) {
    const s = this.section(body, "Picture");
    const prev = s.createDiv({ cls: "vl-imgprev" }), info = s.createDiv({ cls: "vl-frameinfo" });
    const fit = () => it.fit ?? "cover";
    const box = () => {
      const el = (this.wall ?? activeDocument).querySelector(`.vl-it[data-id="${it.id}"]`);
      return { W: el?.offsetWidth || (typeof it.w === "number" ? it.w : 80), H: el?.offsetHeight || (typeof it.h === "number" ? it.h : 80) };
    };
    let im = null, crop = null;
    const layout = () => {
      if (!im || !crop || !im.naturalWidth) return;
      const nw = im.naturalWidth, nh = im.naturalHeight, PW = prev.clientWidth || 240;
      const ph = Math.min(180, PW * nh / nw), pw = ph * nw / nh, k = pw / nw;
      Object.assign(im.style, { width: `${pw}px`, height: `${ph}px` });
      prev.style.height = `${ph}px`;
      const { W, H } = box();
      info.setText(`Picture ${nw} \xD7 ${nh} px \xB7 box ${W} \xD7 ${H}`);
      if (fit() !== "cover") {
        crop.hide();
        return;
      }
      const sc = Math.max(W / nw, H / nh), vw = W / sc, vh = H / sc, [fx, fy] = focusOf(it.pos);
      crop.show();
      Object.assign(crop.style, { left: `${(PW - pw) / 2 + (nw - vw) * fx * k}px`, top: `${(nh - vh) * fy * k}px`, width: `${vw * k}px`, height: `${vh * k}px` });
    };
    const draw = () => {
      prev.empty();
      prev.removeClass("is-empty", "is-broken");
      prev.style.height = "";
      im = crop = null;
      const url = pictureUrl(it.src);
      if (!url) {
        prev.addClass("is-empty");
        (0, import_obsidian3.setIcon)(prev.createDiv(), "image");
        info.setText("No picture yet: an https address or a vault path.");
        return;
      }
      info.setText("Loading\u2026");
      im = prev.createEl("img", { attr: { alt: "", draggable: "false" } });
      crop = prev.createDiv({ cls: "vl-imgcrop" });
      crop.hide();
      im.addEventListener("load", layout, { once: true });
      im.addEventListener("error", () => {
        prev.empty();
        prev.addClass("is-broken");
        (0, import_obsidian3.setIcon)(prev.createDiv(), "image-off");
        info.setText("This address can not be loaded.");
      }, { once: true });
      im.src = url;
      if (im.complete && im.naturalWidth) layout();
    };
    draw();
    prev.addEventListener("pointerdown", (e) => {
      if (!im?.naturalWidth || fit() === "fill") return;
      e.preventDefault();
      prev.setPointerCapture(e.pointerId);
      this.begin();
      const at = (m) => {
        const r2 = im.getBoundingClientRect(), nw = im.naturalWidth, nh = im.naturalHeight, { W, H } = box();
        const cx = Math.min(1, Math.max(0, (m.clientX - r2.left) / r2.width)), cy = Math.min(1, Math.max(0, (m.clientY - r2.top) / r2.height));
        let fx = cx, fy = cy;
        if (fit() === "cover") {
          const sc = Math.max(W / nw, H / nh), vw = W / sc, vh = H / sc;
          fx = nw - vw > 1 ? Math.min(1, Math.max(0, (cx * nw - vw / 2) / (nw - vw))) : 0.5;
          fy = nh - vh > 1 ? Math.min(1, Math.max(0, (cy * nh - vh / 2) / (nh - vh))) : 0.5;
        }
        const pc = (v) => Math.round(v * 100);
        if (pc(fx) === 50 && pc(fy) === 50) delete it.pos;
        else it.pos = `${pc(fx)}% ${pc(fy)}%`;
        this.draftPut();
        this.drawPages();
        layout();
      };
      at(e);
      const up = () => {
        prev.removeEventListener("pointermove", at);
        prev.removeEventListener("pointerup", up);
        this.end();
        this.drawPanel();
      };
      prev.addEventListener("pointermove", at);
      prev.addEventListener("pointerup", up);
    });
    const row = s.createDiv({ cls: "vl-srcrow" });
    let t = 0;
    this.text(row, () => it.src ?? "", (v) => {
      it.src = v;
      window.clearTimeout(t);
      t = window.setTimeout(draw, 400);
    }, { placeholder: "https://\u2026 or a vault path", title: "Picture address" });
    this.btn(row, "folder-open", "A picture of the vault", () => new ImagePick(this.plugin.app, (f) => this.edit(() => {
      it.src = f.path;
    })).open());
    const fs = this.section(body, "Fit");
    this.chips(fs, [["cover", "Cover"], ["contain", "Contain"], ["fill", "Stretch"]], fit(), (v) => {
      it.fit = v;
    });
    fs.createDiv({ cls: "vl-frameinfo", text: { cover: "Fills the box; the edges are cut off.", contain: "All of the picture, inside the box.", fill: "Pulled to the box's shape." }[fit()] });
    if (fit() !== "fill") {
      const ps = this.section(body, "Focus");
      const wrap = ps.createDiv({ cls: "vl-gwrap" });
      const grid2 = wrap.createDiv({ cls: "vl-grav" });
      const [fx, fy] = focusOf(it.pos);
      for (const y of [0, 0.5, 1]) for (const x of [0, 0.5, 1]) {
        const name = `${["left", "center", "right"][x * 2]} ${["top", "center", "bottom"][y * 2]}`;
        const d = grid2.createEl("button", { cls: fx === x && fy === y ? "is-on" : "", attr: { "aria-label": name === "center center" ? "Middle" : name } });
        d.createSpan();
        d.addEventListener("click", () => this.edit(() => {
          if (x === 0.5 && y === 0.5) delete it.pos;
          else it.pos = name;
        }));
      }
      const side = wrap.createDiv({ cls: "vl-secb" });
      side.createDiv({ cls: "vl-frameinfo", text: "Or click the picture above. Exact (CSS object-position):" });
      this.text(side, () => it.pos ?? "", (v) => {
        if (v.trim()) it.pos = v;
        else delete it.pos;
      }, { placeholder: "center \xB7 50% 30%", title: "Focus" });
    }
    this.sizeNums(body, it, b.items.includes(it));
    this.actions(body.lastElementChild?.querySelector(".vl-secb") ?? body, [["ratio", "Height from the picture's shape", () => {
      if (!im?.naturalWidth) {
        new import_obsidian3.Notice("Vellum: the picture is not loaded yet");
        return;
      }
      const W = typeof it.w === "number" ? it.w : box().W, H = Math.round(W * im.naturalHeight / im.naturalWidth);
      this.edit(() => {
        it.w = W;
        it.h = H;
      });
    }]]);
    const r = this.section(body, "Corners and opacity").createDiv({ cls: "vl-nums" });
    this.num(r, "Radius", () => Array.isArray(it.r) ? it.r[0] ?? 0 : it.r ?? 0, (v) => {
      it.r = v || void 0;
    }, { min: 0 });
    this.num(r, "Opacity", () => it.op ?? 100, (v) => {
      it.op = v >= 100 ? void 0 : v;
    }, { min: 0, max: 100 });
  }
  // exact size and offset as numbers (a hug / fill size shows as drawn; typing a number fixes it); the corner handles change them too
  sizeNums(body, it, top) {
    const r = this.section(body, "Size and place").createDiv({ cls: "vl-nums" });
    const drawn = (axis) => {
      const el = (this.wall ?? activeDocument).querySelector(`.vl-it[data-id="${it.id}"]`);
      return el ? axis === "w" ? el.offsetWidth : el.offsetHeight : 40;
    };
    this.num(r, "W", () => typeof it.w === "number" ? it.w : drawn("w"), (v) => {
      it.w = v;
    }, { min: 1 });
    this.num(r, "H", () => typeof it.h === "number" ? it.h : drawn("h"), (v) => {
      it.h = v;
    }, { min: 1 });
    if (top) {
      this.num(r, "X", () => it.dx ?? 0, (v) => {
        it.dx = v;
      });
      this.num(r, "Y", () => it.dy ?? 0, (v) => {
        it.dy = v;
      });
    }
  }
  // a box's own look (a block, a text): its fill, an outline (all round, or on some sides), a radius, a padding
  lookControls(sec, o, opt = {}) {
    this.colors(sec, o.fill ?? "none", (v) => {
      if (v === "none") delete o.fill;
      else o.fill = v;
    }, true);
    const r = sec.createDiv({ cls: "vl-nums is-three" });
    this.num(r, "Outline", () => o.sw ?? 0, (v) => {
      o.sw = v || void 0;
    }, { min: 0, step: 0.5, unit: "pt" });
    this.num(r, "Radius", () => Array.isArray(o.r) ? o.r[0] ?? 0 : o.r ?? 0, (v) => {
      o.r = v || void 0;
    }, { min: 0, unit: "pt" });
    if (opt.pad) this.num(r, "Padding", () => o.pad ?? 0, (v) => {
      o.pad = v || void 0;
    }, { min: 0, unit: "pt" });
    if (opt.sides && o.sw) {
      const g = sec.createDiv({ cls: "vl-chips is-icons" }), cur = o.sides || "trbl";
      for (const [k, icon, name] of [["t", "panel-top", "Top"], ["r", "panel-right", "Right"], ["b", "panel-bottom", "Bottom"], ["l", "panel-left", "Left"]]) {
        const c = g.createEl("button", { cls: "vl-chip is-icon" + (cur.includes(k) ? " is-on" : ""), attr: { "aria-label": `${name} side` } });
        (0, import_obsidian3.setIcon)(c, icon);
        c.addEventListener("click", () => this.edit(() => {
          const now = (o.sides || "trbl").includes(k) ? (o.sides || "trbl").replace(k, "") : (o.sides || "") + k;
          const sorted = "trbl".split("").filter((x) => now.includes(x)).join("");
          if (!sorted || sorted === "trbl") delete o.sides;
          else o.sides = sorted;
        }));
      }
    }
    if (o.sw) this.colors(sec, o.stroke ?? "line", (v) => {
      o.stroke = v;
    });
  }
  // a rectangle drawn as a frame: one that covers its block becomes the block's look; one under a single text becomes
  // that text's box (a chip, a tile, a button). Agents draw frames with rectangles; this turns them into what they are
  rectToLook(body, b, it) {
    if (it.type !== "rect" || !b.items.includes(it)) return;
    const bEl = this.wall?.querySelector(`.vl-block[data-block="${b.id}"]`);
    if (!bEl) return;
    const box = this.itemBox(bEl, b, it);
    if (!box) return;
    const look = (to) => {
      if (it.fill) to.fill = it.fill;
      if (it.sw) {
        to.sw = it.sw;
        to.stroke = it.stroke;
      }
      if (it.r) to.r = it.r;
    };
    const drop = () => b.items.splice(b.items.indexOf(it), 1);
    if (box.L < 1 && box.T < 1 && Math.abs(box.W - b.w) < 1 && Math.abs(box.H - b.h) < 1) {
      this.actions(body, [["square-dashed-bottom", "Make it the block's look", () => this.edit(() => {
        look(b);
        drop();
        this.sel = { page: this.sel.page, block: b.id };
      })]]);
      return;
    }
    const on = b.items.filter((x) => x !== it).map((x) => ({ x, r: this.itemBox(bEl, b, x) })).filter((o) => o.r && o.r.L + o.r.W / 2 > box.L && o.r.L + o.r.W / 2 < box.L + box.W && o.r.T + o.r.H / 2 > box.T && o.r.T + o.r.H / 2 < box.T + box.H);
    if (on.length !== 1 || on[0].x.type !== "text") return;
    const t = on[0].x, tr = on[0].r;
    this.actions(body, [["text-select", "Make it the text's box", () => this.edit(() => {
      look(t);
      const centred = Math.abs(tr.L + tr.W / 2 - (box.L + box.W / 2)) < 3;
      t.w = Math.round(box.W);
      t.h = Math.round(box.H);
      t.dy = Math.round(box.T);
      if (centred) {
        t.g = "t";
        t.dx = toD(0, box.L, box.W, b.w);
      } else {
        t.g = "tl";
        t.dx = Math.round(box.L);
        t.pad = Math.max(0, Math.round(tr.L - box.L)) || void 0;
      }
      drop();
      this.sel = { page: this.sel.page, block: b.id, item: t.id };
    })]]);
  }
  shapeStyle(body, it, box) {
    if (!box) this.seg(this.section(body, "Shape"), [["rect", "Rectangle", "square"], ["ellipse", "Circle", "circle"]], it.type, (v) => {
      it.type = v;
    });
    this.colors(this.section(body, box ? "Background" : "Fill"), it.fill, (v) => {
      if (v === "none") delete it.fill;
      else it.fill = v;
    }, true);
    const o = this.section(body, "Outline", true, { shut: !it.sw, hint: it.sw ? `${it.sw} pt` : "none" });
    const r = o.createDiv({ cls: "vl-nums is-three" });
    this.num(r, "Width", () => it.sw ?? 0, (v) => {
      it.sw = v || void 0;
    }, { min: 0, step: 0.5, unit: "pt" });
    if (it.type !== "ellipse") this.num(r, "Radius", () => Array.isArray(it.r) ? it.r[0] ?? 0 : it.r ?? 0, (v) => {
      it.r = v || void 0;
    }, { min: 0 });
    this.num(r, "Opacity", () => it.op ?? 100, (v) => {
      it.op = v >= 100 ? void 0 : v;
    }, { min: 0, max: 100, unit: "%" });
    if (it.sw) this.colors(o, it.stroke ?? "line", (v) => {
      it.stroke = v;
    });
  }
  placePanel(body, b, it, top) {
    const s = this.section(body, "Place", true);
    if (top) {
      const bEl = this.wall?.querySelector(`.vl-block[data-block="${b.id}"]`), ib = bEl ? this.itemBox(bEl, b, it) : null;
      const k = Math.min(250 / b.w, 110 / b.h), pv = s.createDiv({ cls: "vl-apv" });
      Object.assign(pv.style, { width: `${b.w * k}px`, height: `${b.h * k}px` });
      if (ib) {
        const r = pv.createDiv({ cls: "vl-abox" });
        Object.assign(r.style, { left: `${ib.L * k}px`, top: `${ib.T * k}px`, width: `${Math.max(2, ib.W * k)}px`, height: `${Math.max(2, ib.H * k)}px` });
      }
      const [cx, cy] = axes(it.g);
      for (const g of GRAVITIES) {
        const [ax, ay] = axes(g);
        const d = pv.createEl("button", { cls: "vl-adot" + (g === (it.g ?? "tl") ? " is-on" : ""), attr: { "aria-label": `Hold on to the ${{ tl: "top left", t: "top", tr: "top right", l: "left", c: "middle", r: "right", bl: "bottom left", b: "bottom", br: "bottom right" }[g]}` } });
        Object.assign(d.style, { left: `${(ax + 1) * 50}%`, top: `${(ay + 1) * 50}%` });
        d.addEventListener("click", () => this.edit(() => {
          if (ib) {
            if (it.w !== "fill") it.dx = toD(ax, ib.L, ib.W, b.w);
            if (it.h !== "fill") it.dy = toD(ay, ib.T, ib.H, b.h);
          }
          it.g = g;
        }));
      }
      if (ib) {
        const px2 = (cx + 1) / 2, py = (cy + 1) / 2;
        const svg = pv.createSvg("svg", { cls: "vl-aline", attr: { width: b.w * k, height: b.h * k } });
        svg.createSvg("line", { attr: { x1: px2 * b.w * k, y1: py * b.h * k, x2: (ib.L + px2 * ib.W) * k, y2: (ib.T + py * ib.H) * k } });
      }
      const nums = s.createDiv({ cls: "vl-nums is-four" });
      if (it.w !== "fill") this.num(nums, cx < 0 ? "\u2190 X" : cx > 0 ? "X \u2192" : "X \u2194", () => it.dx ?? 0, (v) => {
        it.dx = v;
      });
      if (it.h !== "fill") this.num(nums, cy < 0 ? "\u2191 Y" : cy > 0 ? "Y \u2193" : "Y \u2195", () => it.dy ?? 0, (v) => {
        it.dy = v;
      });
    }
    if (it.type === "icon") {
      s.createDiv({ cls: "vl-frameinfo", text: "An icon is as big as its Size." });
      return;
    }
    for (const [axis, name] of [["w", "Width"], ["h", "Height"]]) {
      const row = s.createDiv({ cls: "vl-frow" });
      row.createSpan({ cls: "vl-frowl", text: name });
      const ctl = row.createDiv({ cls: "vl-frowc" });
      const cur = it[axis];
      const rule = cur === "fill" ? "fill" : typeof cur === "number" ? "fixed" : "hug";
      this.chips(ctl, [["hug", "Hug: as big as its content", axis === "w" ? "fold-horizontal" : "fold-vertical"], ["fixed", "Fixed: a set size", "lock"], ["fill", "Fill: the block's room", axis === "w" ? "unfold-horizontal" : "unfold-vertical"]], rule, (v) => {
        if (v === "fixed") {
          const el = (this.wall ?? activeDocument).querySelector(`.vl-it[data-id="${it.id}"]`);
          it[axis] = Math.round(el ? axis === "w" ? el.offsetWidth : el.offsetHeight : 40);
        } else it[axis] = v;
      });
      if (rule === "fixed") this.num(ctl, "pt", () => it[axis], (v) => {
        it[axis] = v;
      }, { min: 1 });
      if (rule === "fill" && top) this.num(ctl, "Margin", () => Math.abs((axis === "w" ? it.dx : it.dy) ?? 0), (v) => {
        if (axis === "w") it.dx = v;
        else it.dy = v;
      }, { min: 0 });
    }
  }
};
var focusOf = (pos) => {
  const w = (pos ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const kw = { left: [0, "x"], right: [1, "x"], top: [0, "y"], bottom: [1, "y"], center: [0.5, ""] };
  let x = 0.5, y = 0.5, i = 0;
  for (const t of w.slice(0, 2)) {
    const k = kw[t], n = /^(-?\d+(?:\.\d+)?)%$/.exec(t);
    if (k) {
      if (k[1] === "y") y = k[0];
      else if (k[1] === "x") x = k[0];
    } else if (n) {
      if (i === 0 && w.length > 1) x = Number(n[1]) / 100;
      else if (i === 0) x = Number(n[1]) / 100;
      else y = Number(n[1]) / 100;
    }
    i++;
  }
  return [x, y];
};
var ImagePick = class extends import_obsidian3.FuzzySuggestModal {
  constructor(app2, pick) {
    super(app2);
    this.pick = pick;
    this.setPlaceholder("A picture of the vault");
  }
  getItems() {
    return this.app.vault.getFiles().filter((f) => /^(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(f.extension));
  }
  getItemText(f) {
    return f.path;
  }
  onChooseItem(f) {
    this.pick(f);
  }
};
var inRoom = (b, R) => b.x >= R.l && b.y >= R.t && b.x + b.w <= R.r && b.y + b.h <= R.b;
var clampTo = (b, R, resize) => {
  if (resize) {
    b.w = Math.max(8, Math.min(b.w, R.r - b.x));
    b.h = Math.max(8, Math.min(b.h, R.b - b.y));
    return;
  }
  b.x = Math.max(R.l, Math.min(b.x, R.r - b.w));
  b.y = Math.max(R.t, Math.min(b.y, R.b - b.h));
};
var hexOf = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("") + (c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, "0") : "");
var rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};
var hslToRgb = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
};
var rgbToHsv = (r, g, b) => {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, d = mx - mn, h = rgbToHsl(r, g, b).h;
  return { h, s: Math.round(mx ? d / mx * 100 : 0), v: Math.round(mx * 100) };
};
var hsvToRgb = (h, s, v) => {
  s /= 100;
  v /= 100;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
};
var TYPE_ICON = { text: "type", rect: "square", ellipse: "circle", line: "minus", img: "image", icon: "smile", row: "columns-3", col: "rows-3" };
var detail = (it) => it.type === "text" ? `${it.font ?? "ui"} ${it.size ?? 15}` : it.type === "icon" ? `${it.size ?? 20}` : it.type === "img" ? it.fit ?? "cover" : it.type === "row" || it.type === "col" ? `${it.items?.length ?? 0} in it` : it.fill && typeof it.fill === "string" && !it.fill.includes("(") ? it.fill : "";
var lookOn = (o) => !!(o.fill && o.fill !== "none") || !!o.sw;
var lookHint = (o) => {
  const f = o.fill && o.fill !== "none" ? o.fill.includes("(") ? "custom fill" : o.fill : "", line = o.sw ? `outline ${o.sw}${o.sides ? ` ${o.sides}` : ""}` : "";
  return [f, line].filter(Boolean).join(" \xB7 ") || "none";
};
var RESIZE = ["img", "rect", "ellipse"];
var label = (it) => it.type === "text" ? (it.v ?? "").split("\n")[0].slice(0, 24) || "(empty text)" : it.type === "row" || it.type === "col" ? `${it.items?.length ?? 0} items` : it.type === "img" ? (it.src ?? "").split(/[/?#]/).filter(Boolean).pop()?.slice(0, 24) || "picture" : it.type === "icon" ? it.name || "icon" : it.type === "ellipse" ? "circle" : it.type;
var icons = null;
var iconNames = () => icons ?? (icons = [...new Set((0, import_obsidian3.getIconIds)().map((n) => n.replace(/^lucide-/, "")))].sort());
var ref = null;
async function folderEditor(dir) {
  if (!ref) return void 0;
  const ex = editors.get(`vellum:${dir}`);
  if (ex) return ex;
  const store = new FolderStore(ref.plugin.app, dir);
  return new Editor(ref.plugin, ref.host(), "", void 0, void 0, store, await store.load());
}
function refreshLook() {
  if (ref) for (const ed of editors.values()) ed.relook(ref.host());
}
async function openVellum(dir, page) {
  (await folderEditor(dir))?.openWs(page);
}
function registerVellum(plugin, host = {}) {
  ref = { plugin, host: () => typeof host === "function" ? host() : host };
  const vault = plugin.app.vault;
  setPictureResolver((src) => {
    const path = (0, import_obsidian3.normalizePath)(src), f = vault.getAbstractFileByPath(path);
    return f instanceof import_obsidian3.TFile ? vault.getResourcePath(f) : vault.adapter.getResourcePath(path);
  });
  const frame = (x) => `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"/><path d="M${x} 4V20"/></g>`;
  (0, import_obsidian3.addIcon)("vellum-side-left", frame(7));
  (0, import_obsidian3.addIcon)("vellum-side-right", frame(17));
  plugin.registerView(VIEW, (leaf) => new VellumWindow(leaf));
  plugin.registerMarkdownCodeBlockProcessor("vellum", async (source, el, ctx) => {
    const h = typeof host === "function" ? host() : host, dir = srcOf(source);
    if (!dir) {
      new Editor(plugin, h, source, el, ctx);
      return;
    }
    const store = new FolderStore(plugin.app, dir);
    new Editor(plugin, h, source, el, ctx, store, await store.load());
  });
  const due = /* @__PURE__ */ new Map();
  const touched = (path) => {
    for (const ed of live) {
      const st = ed.store;
      if (!st || !st.watches(path) || Date.now() < st.ownUntil) continue;
      window.clearTimeout(due.get(ed));
      due.set(ed, window.setTimeout(() => {
        due.delete(ed);
        void ed.outside();
      }, 400));
    }
  };
  const v = plugin.app.vault;
  for (const ev of ["create", "modify", "delete"]) plugin.registerEvent(v.on(ev, (f) => touched(f.path)));
  plugin.registerEvent(v.on("rename", (f, old) => {
    touched(f.path);
    touched(old);
  }));
}

// src/main.ts
var ICON = `<g fill="none" stroke="currentColor" stroke-width="7.3" stroke-linecap="round" stroke-linejoin="round"><rect x="38" y="8" width="48" height="84" rx="11"/><path d="M38 28H20a6 6 0 0 0-6 6v46a6 6 0 0 0 6 6h18"/></g><rect x="50" y="24" width="24" height="10" rx="3" fill="currentColor"/><rect x="50" y="42" width="24" height="33" rx="4" fill="currentColor"/>`;
var DEFAULTS = { folder: "Screens", colors: { ...BASE_THEME.colors }, ui: {}, fonts: { ...BASE_THEME.fonts }, snap: { ...SNAP_DEFAULT }, edit: { ...EDIT_DEFAULT } };
var VellumPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = structuredClone(DEFAULTS);
  }
  async onload() {
    const saved = await this.loadData();
    this.settings = { folder: saved?.folder || DEFAULTS.folder, colors: { ...DEFAULTS.colors, ...saved?.colors }, ui: { ...saved?.ui }, fonts: { ...DEFAULTS.fonts, ...saved?.fonts }, snap: { ...SNAP_DEFAULT, ...saved?.snap }, edit: { ...EDIT_DEFAULT, ...saved?.edit } };
    useApp(this.app);
    (0, import_obsidian4.addIcon)("vellum", ICON);
    registerVellum(this, () => ({ theme: this.theme(), ui: this.settings.ui }));
    this.registerEvent(this.app.workspace.on("css-change", () => {
      if (Object.keys(this.settings.ui).length) refreshLook();
    }));
    setSnap(this.settings.snap, () => {
      void this.save();
    });
    setEdit(this.settings.edit);
    this.addRibbonIcon("vellum", "Open Vellum", () => {
      void openVellum(this.settings.folder);
    });
    this.addCommand({ id: "open", name: "Open the screens", callback: () => {
      void openVellum(this.settings.folder);
    } });
    this.addCommand({ id: "open-folder", name: "Open screens from another folder", callback: () => new FolderPick(this.app, async (f) => {
      this.settings.folder = f.path;
      await this.save();
      void openVellum(f.path);
    }).open() });
    this.addSettingTab(new VellumSettings(this.app, this));
  }
  theme() {
    return { colors: { ...this.settings.colors }, fonts: { ...this.settings.fonts } };
  }
  async save() {
    await this.saveData(this.settings);
  }
};
var VellumSettings = class extends import_obsidian4.PluginSettingTab {
  constructor(app2, plugin) {
    super(app2, plugin);
    this.plugin = plugin;
    // saved and shown a moment after the last change (a drag in the colour picker makes many)
    this.lookT = 0;
    this.syncs = [];
    // ‹ the page's name and a dot for each page ›; the arrow keys too. The page is kept while the settings are open
    this.colourPages = {};
    // Vellum's colour picker (the square, hue, opacity, the value), for a tile in the settings
    this.pickerOff = null;
    this.pickerAt = null;
  }
  save() {
    void this.plugin.save();
  }
  // a card: a heading (a click unfolds it; at first only Screens is open, the open ones kept on the device) with a short summary at its
  // right, and its body
  card(c, key, title, summary) {
    const KEY = "vellum:setopen3";
    let open = [];
    try {
      open = JSON.parse(getLocal(KEY) ?? '["screens"]');
    } catch {
    }
    const card = c.createDiv({ cls: "vls-card" + (open.includes(key) ? "" : " is-folded") });
    const head = card.createDiv({ cls: "vls-head", attr: { role: "button", tabindex: "0" } });
    (0, import_obsidian4.setIcon)(head.createSpan({ cls: "vls-chev" }), "chevron-down");
    head.createSpan({ cls: "vls-title", text: title });
    head.createSpan({ cls: "vls-sum", text: summary });
    const flip = () => {
      card.toggleClass("is-folded", !card.hasClass("is-folded"));
      open = card.hasClass("is-folded") ? open.filter((k) => k !== key) : [.../* @__PURE__ */ new Set([...open, key])];
      try {
        setLocal(KEY, JSON.stringify(open));
      } catch {
      }
    };
    head.addEventListener("click", flip);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });
    return card.createDiv({ cls: "vls-body" });
  }
  // a row: its name (and a line under it) on the left, the control on the right
  row(parent, name, desc) {
    const r = parent.createDiv({ cls: "vls-row" });
    const l = r.createDiv({ cls: "vls-label" });
    l.createDiv({ cls: "vls-name", text: name });
    if (desc) l.createDiv({ cls: "vls-desc", text: desc });
    return r.createDiv({ cls: "vls-ctl" });
  }
  input(parent, value, set, o = {}) {
    const i = parent.createEl("input", { cls: "vls-input" + (o.cls ? " " + o.cls : ""), attr: { type: o.type ?? "text", placeholder: o.placeholder ?? "", spellcheck: "false" } });
    i.value = value;
    i.addEventListener("input", () => set(i.value));
    return i;
  }
  queueLook() {
    window.clearTimeout(this.lookT);
    this.lookT = window.setTimeout(() => {
      this.save();
      refreshLook();
    }, 120);
  }
  hide() {
    this.pickerOff?.();
    super.hide();
  }
  // a list of colours: a tile (Vellum's picker), the name, the value ("Obsidian" while it follows), a way back. Follow Obsidian
  // sets the list back, with an undo; rules: pairs [text, background, least contrast, name] that warn on the text's row
  swatches(body, blurb, pages, rules, changed, demo) {
    const bar = body.createDiv({ cls: "vls-colbar" }), msg = bar.createSpan({ text: blurb });
    const undo = bar.createEl("button", { text: "Undo" });
    undo.hide();
    const follow = bar.createEl("button", { text: "Follow Obsidian" });
    const sum = body.closest(".vls-card")?.querySelector(".vls-sum");
    const rows = /* @__PURE__ */ new Map();
    const all = pages.flatMap((p) => p[1].flatMap((g) => g[1]));
    const pager = pages.length > 1 ? body.createDiv({ cls: "vls-pager" }) : null;
    const holder = body.createDiv({ cls: "vls-pages" + (pager ? " is-paged" : "") }), boxes = [];
    for (const [page, groups] of pages) {
      const wrap = holder.createDiv({ cls: "vls-groups" });
      boxes.push(wrap);
      for (const [title, list] of groups) {
        const g = wrap.createDiv({ cls: "vls-group" });
        if (title && title !== page) g.createDiv({ cls: "vls-grp", text: title });
        for (const e of list) {
          const r = g.createDiv({ cls: "vls-colour" });
          const n = r.createDiv({ cls: "vls-cname" });
          n.createDiv({ cls: "vls-cn", text: e.name });
          if (e.desc) n.createDiv({ cls: "vls-cdesc", text: e.desc });
          const warn = n.createDiv({ cls: "vls-cwarn" });
          const field = r.createDiv({ cls: "vls-cf" });
          const sw = field.createEl("button", { cls: "vls-chip", attr: { "aria-label": `Pick ${e.name}` } }), chip = sw.createSpan();
          const val = field.createEl("input", { cls: "vls-cv", attr: { type: "text", spellcheck: "false", placeholder: "Obsidian", "aria-label": `${e.name} value` } });
          const back = field.createEl("button", { cls: "vls-cb", attr: { "aria-label": e.drop ? `Remove ${e.name}` : "Back to Obsidian" } });
          (0, import_obsidian4.setIcon)(back, e.drop ? "x" : "rotate-ccw");
          const shown = (v) => v && v.startsWith("#") ? v.toUpperCase() : v ?? "";
          const paint = () => {
            const v = e.get();
            chip.style.background = v ?? e.follow ?? "transparent";
            if (val.ownerDocument.activeElement !== val) val.value = shown(v);
            back.toggleVisibility(!!(v || e.drop));
            field.toggleClass("is-custom", !!v);
          };
          rows.set(e.key, { e, chip, paint, warn, field });
          sw.addEventListener("click", () => this.picker(field, chip, (h) => {
            e.set(h);
            changed();
          }));
          back.addEventListener("click", () => {
            if (e.drop) {
              e.drop();
              this.queueLook();
              this.display();
            } else {
              e.set(void 0);
              changed();
            }
          });
          val.addEventListener("keydown", (k) => {
            if (k.key === "Enter") val.blur();
          });
          val.addEventListener("change", () => {
            const v = val.value.trim();
            if (v && !CSS.supports("color", v)) {
              field.addClass("is-bad");
              return;
            }
            field.removeClass("is-bad");
            if (v) e.set(v);
            else e.set(void 0);
            changed();
          });
          const lit = (on) => {
            demo.querySelectorAll(`[data-use~="${e.key}"]`).forEach((d) => d.toggleClass("is-lit", on));
            demo.querySelectorAll(`[data-state~="${e.key}"]`).forEach((d) => d.toggleClass("is-state", on));
          };
          r.addEventListener("mouseenter", () => lit(true));
          r.addEventListener("mouseleave", () => lit(false));
        }
      }
    }
    if (pager) this.pager(pager, pages.map((p) => p[0]), boxes);
    this.syncs.push(() => {
      for (const r of rows.values()) r.paint();
      for (const r of rows.values()) {
        let text = "";
        for (const [fg, bg, least, on] of rules) {
          const b = rows.get(bg);
          if (fg !== r.e.key || !b || !(r.e.get() || b.e.get())) continue;
          const x = solid(r.chip), y = solid(b.chip);
          if (x && y && contrast(x, y) < least) {
            text = `Hard to read on ${on}`;
            break;
          }
        }
        r.warn.setText(text);
        r.field.toggleClass("is-warn", !!text);
      }
      const n = all.filter((e) => !e.drop && e.get()).length;
      sum?.setText(n ? `${n} changed` : "Following Obsidian");
      follow.disabled = !n;
    });
    let timer = 0;
    const calm = () => {
      window.clearTimeout(timer);
      msg.setText(blurb);
      undo.hide();
    };
    follow.addEventListener("click", () => {
      const before = all.filter((e) => !e.drop).map((e) => [e, e.get()]);
      for (const [e] of before) e.set(void 0);
      changed();
      msg.setText("Now following Obsidian");
      undo.show();
      undo.onclick = () => {
        for (const [e, v] of before) e.set(v);
        calm();
        changed();
      };
      window.clearTimeout(timer);
      timer = window.setTimeout(calm, 7e3);
    });
    this.syncs[this.syncs.length - 1]();
  }
  // each card's page, by its pages' names
  pager(el, titles, boxes) {
    const n = titles.length, key = titles.slice(0, 3).join("|");
    let at = this.colourPages[key] ?? 0;
    const prev = el.createEl("button", { cls: "vls-pgb", attr: { "aria-label": "Previous colours" } });
    (0, import_obsidian4.setIcon)(prev, "chevron-left");
    const mid = el.createDiv({ cls: "vls-pgm" }), name = mid.createDiv({ cls: "vls-pgn" }), dots = mid.createDiv({ cls: "vls-pgd" });
    const next = el.createEl("button", { cls: "vls-pgb", attr: { "aria-label": "Next colours" } });
    (0, import_obsidian4.setIcon)(next, "chevron-right");
    const go = (i) => {
      at = this.colourPages[key] = (i + n) % n;
      boxes.forEach((b, j) => b.toggle(j === at));
      name.setText(titles[at]);
      dots.querySelectorAll(".vls-dot").forEach((d, j) => d.toggleClass("is-on", j === at));
    };
    titles.forEach((t, i) => dots.createEl("button", { cls: "vls-dot", attr: { "aria-label": t } }).addEventListener("click", () => go(i)));
    prev.addEventListener("click", () => go(at - 1));
    next.addEventListener("click", () => go(at + 1));
    el.addEventListener("keydown", (k) => {
      if (k.key === "ArrowLeft" || k.key === "ArrowRight") {
        k.preventDefault();
        go(at + (k.key === "ArrowLeft" ? -1 : 1));
      }
    });
    go(Math.min(at, n - 1));
  }
  picker(anchor, from, set) {
    const again = this.pickerAt === anchor;
    this.pickerOff?.();
    if (again) return;
    const doc = anchor.doc, rgba = (css) => {
      const m = (css.match(/[\d.]+/g) ?? []).map(Number);
      return { r: m[0] ?? 128, g: m[1] ?? 128, b: m[2] ?? 128, a: m.length > 3 ? m[3] : 1 };
    };
    const c = rgba(getComputedStyle(from).backgroundColor), hsv = rgbToHsv(c.r, c.g, c.b);
    const el = doc.body.createDiv({ cls: "vl-cpop vls-pop" });
    const sq = el.createDiv({ cls: "vl-csq" }), sqk = sq.createDiv({ cls: "vl-cknob" });
    const hue = el.createDiv({ cls: "vl-cstrip is-hue" }), huek = hue.createDiv({ cls: "vl-cknob" });
    const al = el.createDiv({ cls: "vl-cstrip is-alpha" }), alk = al.createDiv({ cls: "vl-cknob" });
    const hex = el.createEl("input", { attr: { type: "text", spellcheck: "false", "aria-label": "Hex or any CSS colour" } });
    const show = () => {
      const hueC = `hsl(${hsv.h}, 100%, 50%)`, solidC = `rgb(${c.r}, ${c.g}, ${c.b})`;
      sq.style.setProperty("--hue", hueC);
      sqk.style.left = `${hsv.s}%`;
      sqk.style.top = `${100 - hsv.v}%`;
      sqk.style.setProperty("--c", solidC);
      huek.style.left = `${hsv.h / 360 * 100}%`;
      huek.style.setProperty("--c", hueC);
      al.style.setProperty("--c", solidC);
      alk.style.left = `${c.a * 100}%`;
      alk.style.setProperty("--c", hexOf(c));
      if (doc.activeElement !== hex) hex.value = hexOf(c);
    };
    const put = () => {
      set(hexOf(c));
      show();
    };
    const fromHsv = () => {
      Object.assign(c, hsvToRgb(hsv.h, hsv.s, hsv.v));
    };
    const drag = (area, at) => area.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      area.setPointerCapture(e.pointerId);
      const go = (m) => {
        const r = area.getBoundingClientRect();
        at(Math.min(1, Math.max(0, (m.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (m.clientY - r.top) / r.height)));
        put();
      };
      go(e);
      const up = () => {
        area.removeEventListener("pointermove", go);
        area.removeEventListener("pointerup", up);
        area.removeEventListener("pointercancel", up);
      };
      area.addEventListener("pointermove", go);
      area.addEventListener("pointerup", up);
      area.addEventListener("pointercancel", up);
    });
    drag(sq, (x, y) => {
      hsv.s = Math.round(x * 100);
      hsv.v = Math.round((1 - y) * 100);
      fromHsv();
    });
    drag(hue, (x) => {
      hsv.h = Math.round(x * 360);
      fromHsv();
    });
    drag(al, (x) => {
      c.a = Math.round(x * 100) / 100;
    });
    hex.addEventListener("keydown", (k) => {
      if (k.key === "Enter") hex.blur();
    });
    hex.addEventListener("change", () => {
      const v = hex.value.trim();
      if (!v || !CSS.supports("color", v)) {
        hex.addClass("is-bad");
        return;
      }
      hex.removeClass("is-bad");
      el.style.color = v;
      Object.assign(c, rgba(getComputedStyle(el).color));
      el.style.color = "";
      Object.assign(hsv, rgbToHsv(c.r, c.g, c.b));
      set(v);
      show();
    });
    show();
    const a = anchor.getBoundingClientRect(), win = doc.win;
    el.style.left = `${Math.max(8, Math.min(win.innerWidth - el.offsetWidth - 8, a.left))}px`;
    el.style.top = `${a.bottom + 6 + el.offsetHeight > win.innerHeight - 8 ? Math.max(8, a.top - el.offsetHeight - 6) : a.bottom + 6}px`;
    const outside = (e) => {
      const t = e.target;
      if (!el.contains(t) && !anchor.contains(t)) off();
    };
    const esc = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        off();
      }
    };
    const off = () => {
      this.pickerOff = null;
      this.pickerAt = null;
      el.remove();
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", esc, true);
    };
    this.pickerOff = off;
    this.pickerAt = anchor;
    doc.addEventListener("pointerdown", outside, true);
    doc.addEventListener("keydown", esc, true);
  }
  // a phone's contents, in the screen colours; editing: one card mid-drag, snapped both ways. data-use: every colour
  // that paints the element (its background, border or text), so a row outlines exactly what it colours
  phoneArt(ph, editing) {
    if (editing) div(ph, "vlsd-g is-v", "", "guide");
    div(ph, "vlsd-title", "Today", "s-text");
    div(ph, "vlsd-d", "3 sessions left", "s-dim");
    const pair = div(ph, "vlsd-pair");
    if (editing) div(pair, "vlsd-g", "", "guide");
    const run = div(pair, "vlsd-t", "Run", "s-tile s-text");
    div(run, "vlsd-d", "30 min", "s-dim");
    const swim = div(pair, "vlsd-t" + (editing ? " is-drag" : ""), "Swim", "s-tile s-text" + (editing ? " accent" : ""));
    div(swim, "vlsd-d", "45 min", "s-dim");
    if (editing) div(swim, "vlsd-grip", "", "accent");
    div(ph, "vlsd-line", "", "s-line");
    const read = div(ph, "vlsd-t", "Reading", "s-tile s-text");
    div(read, "vlsd-loud", "Overdue", "s-loud");
    div(ph, "vlsd-a", "Start", "s-accent");
  }
  // the previews: a small editor, and a phone. The row under the pointer outlines where its colour is used
  demo(parent) {
    const d = parent.createDiv({ cls: "vls-demo" });
    const bar = div(d, "vlsd-bar is-area", "", "panels border");
    bar.createSpan({ text: "Weekly plan", attr: { "data-use": "muted" } });
    const saves = div(bar, "vlsd-saves");
    div(saves, "vlsd-save", "Save", "accent onaccent accenth").setAttr("data-state", "accenth");
    const body = div(d, "vlsd-body");
    const rail = div(body, "vlsd-rail is-area", "", "panels border");
    div(rail, "vlsd-h", "Screens \xB7 5", "faint");
    div(rail, "vlsd-r", "Home", "text");
    div(rail, "vlsd-r is-sub", "Search", "muted");
    div(rail, "vlsd-r is-on", "Plans", "accent");
    div(rail, "vlsd-r", "Detail", "hover text").setAttr("data-state", "hover");
    div(rail, "vlsd-r", "Settings", "text");
    const stage = div(body, "vlsd-stage is-area", "", "side");
    this.phoneArt(div(stage, "vlsd-phone"), true);
    const side = div(body, "vlsd-side is-area", "", "panels border");
    div(side, "vlsd-h", "Block", "faint");
    const label2 = (t) => {
      const f = div(side, "");
      f.createSpan({ text: t, attr: { "data-use": "muted" } });
      return f;
    };
    div(label2("Name"), "vlsd-in", "Header", "field border text");
    div(label2("Height"), "vlsd-in", "80", "field border borderh text").setAttr("data-state", "borderh");
    const seg = div(label2("Status"), "vlsd-seg", "", "border");
    seg.createSpan({ cls: "is-on", text: "Real", attr: { "data-use": "accent onaccent" } });
    seg.createSpan({ text: "Mock", attr: { "data-use": "muted" } });
    div(side, "vlsd-del", "Delete block", "red");
    return d;
  }
  demoPhone(parent) {
    const d = parent.createDiv({ cls: "vlsd-solo" });
    this.phoneArt(div(d, "vlsd-phone is-area", "", "s-paper s-text"), false);
    return d;
  }
  paintDemo(d) {
    const s = this.plugin.settings, obsidian = getComputedStyle(d.doc.body);
    for (const u of UI_COLORS) for (const name of u.vars) {
      if (s.ui[u.id]) d.style.setProperty(name, s.ui[u.id]);
      else d.style.removeProperty(name);
    }
    for (const name of Object.keys(DEFAULTS.colors)) d.style.setProperty(`--vls-${name}`, s.colors[name].replace(/var\((--[\w-]+)[^)]*\)/g, (_, v) => obsidian.getPropertyValue(v).trim()));
  }
  display() {
    const { containerEl: c } = this, s = this.plugin.settings;
    this.pickerOff?.();
    this.syncs = [];
    c.empty();
    c.addClass("vl-settings");
    c.createDiv({ cls: "vls-intro", text: "Colours and fonts follow your Obsidian theme until you change them. An open editor updates at once." });
    const sc = this.card(c, "screens", "Screens", s.folder);
    this.input(this.row(sc, "Screens folder", "What the ribbon button opens: one JSON file per screen, made on the first save."), s.folder, (v) => {
      s.folder = v.trim().replace(/\/+$/, "") || DEFAULTS.folder;
      this.save();
    }, { placeholder: "Screens" });
    const stack = (body) => [body.createDiv({ cls: "vls-prev" }), body.createDiv({ cls: "vls-list" })];
    const [edPrev, edList] = stack(this.card(c, "editortheme", "Editor theme", ""));
    const [scPrev, co] = stack(this.card(c, "colours", "Screen colours", "").createDiv({ cls: "vls-beside" }));
    const edDemo = this.demo(edPrev), scDemo = this.demoPhone(scPrev);
    for (const pv of [edPrev, scPrev]) pv.createDiv({ cls: "vls-prevcap", text: "Point at a colour below to see where it is used." });
    const paintDemos = () => {
      this.paintDemo(edDemo);
      this.paintDemo(scDemo);
    };
    const changed = () => {
      for (const f of this.syncs) f();
      paintDemos();
      this.queueLook();
    };
    const uiGroups = [];
    for (const u of UI_COLORS) {
      let g = uiGroups.find((x) => x[0] === u.group);
      if (!g) uiGroups.push(g = [u.group, []]);
      g[1].push({ key: u.id, name: u.name, follow: u.follow ?? `var(${u.vars[0]})`, get: () => s.ui[u.id], set: (v) => {
        if (v) s.ui[u.id] = v;
        else delete s.ui[u.id];
      } });
    }
    const pageOf = (title, names) => [title, uiGroups.filter((g) => names.includes(g[0]))];
    this.swatches(
      edList,
      "The editor's panels and controls.",
      [pageOf("Surfaces and lines", ["Surfaces", "Lines"]), pageOf("Text", ["Text"]), pageOf("Accent and signals", ["Accent", "Signals"])],
      [["text", "panels", 4.5, "Panels"], ["text", "field", 4.5, "Input boxes"], ["muted", "panels", 3, "Panels"], ["onaccent", "accent", 3, "Accent"]],
      changed,
      edDemo
    );
    const screens = Object.keys(s.colors).map((name) => name in DEFAULTS.colors ? { key: `s-${name}`, name, desc: SCREEN_USE[name], follow: DEFAULTS.colors[name], get: () => s.colors[name] === DEFAULTS.colors[name] ? void 0 : s.colors[name], set: (v) => {
      s.colors[name] = v ?? DEFAULTS.colors[name];
    } } : { key: `s-${name}`, name, desc: "Your colour", get: () => s.colors[name], set: (v) => {
      if (v) s.colors[name] = v;
    }, drop: () => {
      delete s.colors[name];
    } });
    const scPage = (title, names) => [title, [["", screens.filter((e) => !e.drop && names.includes(e.name))]]];
    const scPages = [scPage("Background and lines", ["paper", "tile", "line"]), scPage("Text", ["text", "dim"]), scPage("Accent and warnings", ["accent", "loud"])];
    const mine = screens.filter((e) => e.drop);
    if (mine.length) scPages.push(["Your colours", [["", mine]]]);
    this.swatches(co, "The named colours of the phones you design.", scPages, [["s-text", "s-paper", 4.5, "paper"], ["s-dim", "s-paper", 3, "paper"]], changed, scDemo);
    const add = co.createDiv({ cls: "vls-add" });
    let fresh = "";
    const ni = this.input(add, "", (v) => {
      fresh = v.trim();
    }, { placeholder: "A new colour name" });
    const ab = add.createEl("button", { text: "Add colour" });
    const doAdd = () => {
      if (!fresh || fresh in s.colors) {
        ni.focus();
        return;
      }
      s.colors[fresh] = "#888888";
      this.queueLook();
      this.display();
    };
    ab.addEventListener("click", doAdd);
    ni.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });
    paintDemos();
    const fo = this.card(c, "fonts", "Fonts", `${Object.keys(s.fonts).length} named`);
    const fl = fo.createDiv({ cls: "vls-tokens" });
    for (const name of Object.keys(s.fonts)) {
      const t = fl.createDiv({ cls: "vls-token" });
      const aa = t.createDiv({ cls: "vls-aa", text: "Aa" });
      aa.style.fontFamily = s.fonts[name];
      t.createDiv({ cls: "vls-tname", text: name });
      this.input(t, s.fonts[name], (v) => {
        s.fonts[name] = v.trim();
        aa.style.fontFamily = v;
        this.queueLook();
      }, { cls: "is-mono" });
      t.createDiv();
    }
    const sn = s.snap;
    const ed = s.edit;
    const eg = this.card(c, "editing", "Editing", `Drag step \xD7${ed.arrow}`);
    this.input(this.row(eg, "Drag step", "How many steps a number box moves for each notch of a drag (Shift: ten times that)."), String(ed.arrow), (v) => {
      const n = Number(v);
      if (n > 0 && n <= 1e3) {
        ed.arrow = n;
        eg.parentElement?.querySelector(".vls-sum")?.setText(`Drag step \xD7${n}`);
        this.save();
      }
    }, { cls: "is-num", type: "number" });
    new import_obsidian4.ToggleComponent(this.row(eg, "Hold and drag", "Hold a number box, then drag up or down to change it. A click types the value.")).setValue(ed.hold).onChange((v) => {
      ed.hold = v;
      this.save();
    });
    const sp = this.card(c, "snapping", "Snapping", sn.on ? "On" : "Off");
    const master = this.row(sp, "Snap while dragging", "Blocks and items snap to the lines near them. Alt turns it off for one drag; the magnet under the phone switches it too.");
    const rest = sp.createDiv({ cls: "vls-group" + (sn.on ? "" : " is-off") });
    new import_obsidian4.ToggleComponent(master).setValue(sn.on).onChange((v) => {
      sn.on = v;
      rest.toggleClass("is-off", !v);
      sp.parentElement?.querySelector(".vls-sum")?.setText(v ? "On" : "Off");
      this.save();
    });
    const to = this.row(rest, "Snap to", "The frame: an item's block, or a block's screen and safe area.");
    const pill = (text, on, flip) => {
      const b = to.createEl("button", { cls: "vls-pill" + (on() ? " is-on" : ""), text });
      b.addEventListener("click", () => {
        flip();
        b.toggleClass("is-on", on());
        this.save();
      });
    };
    pill("The frame", () => sn.frame, () => {
      sn.frame = !sn.frame;
    });
    pill("Other items", () => sn.others, () => {
      sn.others = !sn.others;
    });
    const di = this.row(rest, "Distance", "How near a line pulls, in screen pixels.");
    new import_obsidian4.SliderComponent(di).setLimits(2, 16, 1).setValue(sn.dist).setDynamicTooltip().onChange((v) => {
      sn.dist = v;
      this.save();
    });
    this.input(this.row(rest, "Grid", "Points a drag steps by when no line is near (1: free); Shift + arrow keys too."), String(sn.grid), (v) => {
      const n = Math.round(Number(v));
      if (n >= 1 && n <= 64) {
        sn.grid = n;
        this.save();
      }
    }, { cls: "is-num", type: "number" });
    this.input(this.row(rest, "Margins", "Lines this far inside each edge, comma separated."), sn.margins.join(", "), (v) => {
      sn.margins = v.split(/[,\s]+/).map(Number).filter((n) => n > 0 && n < 400);
      this.save();
    }, { cls: "is-short", placeholder: "16, 24" });
    new import_obsidian4.ToggleComponent(this.row(rest, "Guide lines", "Show the line a drag snapped to.")).setValue(sn.guides).onChange((v) => {
      sn.guides = v;
      this.save();
    });
    const edCard = edPrev.closest(".vls-card");
    if (edCard) c.appendChild(edCard);
    const foot = c.createDiv({ cls: "vls-foot" });
    foot.createSpan({ text: "Back to your Obsidian theme's colours and fonts." });
    const rb = foot.createEl("button", { cls: "mod-warning", text: "Reset look" });
    rb.addEventListener("click", () => {
      this.plugin.settings = { ...structuredClone(DEFAULTS), folder: s.folder, snap: s.snap, edit: s.edit };
      this.queueLook();
      this.display();
    });
  }
};
var div = (p, cls, text = "", use = "") => {
  const e = p.createDiv({ cls });
  if (text) e.setText(text);
  if (use) e.setAttr("data-use", use);
  return e;
};
var SCREEN_USE = { paper: "Screen background", text: "Main text", dim: "Secondary text", line: "Borders", tile: "Cards", loud: "Warnings", accent: "Buttons, highlights" };
var solid = (e) => {
  const css = getComputedStyle(e).backgroundColor;
  if (!css.startsWith("rgb")) return null;
  const m = (css.match(/[\d.]+/g) ?? []).map(Number);
  return m.length === 3 || m[3] === 1 ? m : null;
};
var luma = (c) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
var contrast = (a, b) => {
  const x = luma(a), y = luma(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
var FolderPick = class extends import_obsidian4.FuzzySuggestModal {
  constructor(app2, pick) {
    super(app2);
    this.pick = pick;
    this.setPlaceholder("A folder of screens");
  }
  getItems() {
    return this.app.vault.getAllLoadedFiles().filter((f) => f instanceof import_obsidian4.TFolder && f.path !== "/");
  }
  getItemText(f) {
    return f.path;
  }
  onChooseItem(f) {
    this.pick(f);
  }
};
