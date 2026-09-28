// Runs each Scriptable widget script against live data with a minimal mock of the
// Scriptable API, for every widget family, and prints the text each widget renders.
import { readFile } from "node:fs/promises";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FAMILIES = ["small", "medium", "large", "accessoryRectangular", "accessoryInline", "accessoryCircular"];
const SCRIPTS = [
  ["sora-rates-widget.js", ["", "3m"]],
  ["spx-valuation-widget.js", ["", "22"]],
];
const cacheDir = mkdtempSync(join(tmpdir(), "scriptable-"));

function makeRuntime(family, parameter, { offline = false } = {}) {
  const texts = [];
  let result = null;
  class Stack {
    constructor() { this.children = []; }
    addText(t) { const o = { text: String(t), centerAlignText() {} }; texts.push(o.text); return o; }
    addStack() { const s = new Stack(); this.children.push(s); return s; }
    addImage(img) { if (!img?.drawn) throw new Error("image not drawn"); return {}; }
    addSpacer() {}
    setPadding() {}
    layoutHorizontally() {}
    layoutVertically() {}
    centerAlignContent() {}
    bottomAlignContent() {}
  }
  class ListWidget extends Stack {
    async presentMedium() { env.Script.setWidget(this); }
  }
  class DrawContext {
    addPath(p) { if (!p.points.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))) throw new Error("NaN in path"); }
    setStrokeColor() {} setFillColor() {} setLineWidth() {} strokePath() {} fillRect() {}
    getImage() { return { drawn: true }; }
  }
  class Path {
    constructor() { this.points = []; }
    move(p) { this.points.push(p); }
    addLine(p) { this.points.push(p); }
  }
  class Request {
    constructor(url) { this.url = url; }
    async loadString() { if (offline) throw new Error("offline"); return (await fetch(this.url)).text(); }
    async loadJSON() { if (offline) throw new Error("offline"); return (await fetch(this.url)).json(); }
  }
  const FileManager = {
    local: () => ({
      cacheDirectory: () => cacheDir,
      joinPath: (a, b) => join(a, b),
      fileExists: existsSync,
      readString: (p) => readFileSync(p, "utf8"),
      writeString: (p, s) => writeFileSync(p, s),
    }),
  };
  const font = new Proxy({}, { get: () => () => ({}) });
  const env = {
    ListWidget, DrawContext, Path, Request, FileManager,
    Color: Object.assign(function Color() {}, { white: () => ({}) }),
    Font: font,
    Point: function Point(x, y) { this.x = x; this.y = y; },
    Size: function Size(w, h) { this.w = w; this.h = h; },
    Rect: function Rect() {},
    LinearGradient: function LinearGradient() {},
    config: { widgetFamily: family, runsInWidget: true, runsInAccessoryWidget: family.startsWith("accessory") },
    args: { widgetParameter: parameter },
    Script: { setWidget: (w) => { result = w; }, complete() {} },
  };
  return { env, texts, getResult: () => result };
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
let failures = 0;

for (const [file, params] of SCRIPTS) {
  const code = await readFile(new URL(`../public/scriptable/${file}`, import.meta.url), "utf8");
  for (const offline of [false, true]) {
    for (const family of FAMILIES) {
      for (const param of params) {
        const rt = makeRuntime(family, param, { offline });
        await new AsyncFunction(...Object.keys(rt.env), code)(...Object.values(rt.env));
        const w = rt.getResult();
        const rendered = rt.texts.join(" | ");
        const bad = !w || !w.url || /Can't reach|NaN|undefined/.test(rendered);
        if (bad) failures++;
        console.log(`${bad ? "FAIL" : "ok  "} ${file} ${offline ? "[offline]" : ""} ${family} ${param || "-"}\n     ${rendered}`);
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} widget render(s) failed`);
  process.exit(1);
}
console.log("\nAll widget renders passed.");
