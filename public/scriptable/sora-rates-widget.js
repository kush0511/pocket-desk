// SORA Rates — iPhone widget for Scriptable (https://scriptable.app)
// Reads the same public Google Sheet as https://kush0511.github.io/sora-rates/
//
// Widget parameter (long-press widget → Edit Widget → Parameter):
//   sora (default) | 1m | 3m   → which rate is shown large
// Sizes: small, medium, large, and Lock Screen (rectangular, inline, circular).

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSetwT6jWgq4H6LPeIp3hB_hgo4HdF1P1Q7pu0JYlaUqXnzxbonDFpA_Myndbv3ewsbFOyGhW6kxLro/pub?output=csv";
const SITE_URL = "https://kush0511.github.io/sora-rates/";
const REFRESH_HOURS = 3;
const CHART_DAYS = 60;

const C = {
  bgTop: new Color("#1a2446"),
  bgBottom: new Color("#090b10"),
  text: new Color("#e4e6ec"),
  dim: new Color("#e4e6ec", 0.55),
  faint: new Color("#e4e6ec", 0.35),
  panel: new Color("#ffffff", 0.05),
  sora: new Color("#6699ff"),
  m1: new Color("#2dd4a8"),
  m3: new Color("#a78bfa"),
  up: new Color("#f87171"),
  down: new Color("#34d399"),
  stale: new Color("#fbbf24"),
};
const SERIES = {
  sora: { key: "sora", label: "Overnight SORA", short: "SORA", color: C.sora },
  "1m": { key: "m1", label: "1M Compounded", short: "1M", color: C.m1 },
  "3m": { key: "m3", label: "3M Compounded", short: "3M", color: C.m3 },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseCsv(csv) {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const c = line.split(",");
      const [d, m, y] = (c[0] || "").trim().split("/").map(Number);
      return { date: new Date(y, m - 1, d), sora: parseFloat(c[1]), m1: parseFloat(c[2]), m3: parseFloat(c[3]) };
    })
    .filter((r) => !isNaN(r.date.getTime()) && [r.sora, r.m1, r.m3].every((v) => !isNaN(v)));
}

async function loadRows() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.cachesDirectory(), "sora-rates-widget.csv");
  try {
    const req = new Request(CSV_URL);
    req.timeoutInterval = 20;
    const csv = await req.loadString();
    const rows = parseCsv(csv);
    if (!rows.length) throw new Error("Sheet returned no rows");
    fm.writeString(cachePath, csv);
    return { rows, offline: false };
  } catch (err) {
    if (fm.fileExists(cachePath)) {
      const rows = parseCsv(fm.readString(cachePath));
      if (rows.length) return { rows, offline: true };
    }
    throw err;
  }
}

const fmtDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const fmtBps = (bps) => {
  const text = Math.abs(bps).toFixed(1);
  return `${Number(text) === 0 ? "" : bps > 0 ? "+" : "−"}${text} bps`;
};
const bpsColor = (bps) => (bps > 0 ? C.up : bps < 0 ? C.down : C.dim);
const ageDays = (d) => Math.floor((Date.now() - d.getTime()) / 86400000);

function addText(stack, str, font, color = C.text, opts = {}) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = opts.scale ?? 0.6;
  return t;
}

function drawChart(rows, width, height) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const keys = [
    ["m3", C.m3, 1.6],
    ["m1", C.m1, 1.6],
    ["sora", C.sora, 2.2],
  ];
  const values = rows.flatMap((r) => keys.map(([k]) => r[k]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const x = (i) => (i / (rows.length - 1)) * width;
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);

  for (const [k, color, lw] of keys) {
    const path = new Path();
    rows.forEach((r, i) => (i ? path.addLine(new Point(x(i), y(r[k]))) : path.move(new Point(x(i), y(r[k])))));
    dc.addPath(path);
    dc.setStrokeColor(color);
    dc.setLineWidth(lw);
    dc.strokePath();
  }
  return dc.getImage();
}

function header(w, latest, offline) {
  const row = w.addStack();
  row.centerAlignContent();
  addText(row, "SORA · SG", Font.semiboldSystemFont(10), C.dim);
  row.addSpacer();
  const stale = offline || ageDays(latest.date) > 4;
  addText(row, "●", Font.systemFont(8), stale ? C.stale : C.m1);
}

function rateLine(stack, label, value, color) {
  const row = stack.addStack();
  row.centerAlignContent();
  addText(row, "● ", Font.systemFont(7), color);
  addText(row, label, Font.mediumSystemFont(11), C.dim);
  row.addSpacer();
  addText(row, `${value.toFixed(4)}%`, Font.semiboldMonospacedSystemFont(11));
}

function heroBlock(stack, s, featured, size) {
  const value = s.latest[featured.key];
  const hero = stack.addStack();
  hero.bottomAlignContent();
  addText(hero, value.toFixed(4), Font.boldRoundedSystemFont(size));
  addText(hero, "%", Font.semiboldRoundedSystemFont(size * 0.55), C.dim);
  stack.addSpacer(2);
  const sub = stack.addStack();
  addText(sub, fmtBps(s.bps[featured.key]), Font.semiboldSystemFont(11), bpsColor(s.bps[featured.key]));
  addText(sub, ` ${featured.short}`, Font.mediumSystemFont(11), C.faint);
}

function otherRates(stack, s, featured) {
  for (const f of Object.values(SERIES)) {
    if (f.key !== featured.key) rateLine(stack, f.short, s.latest[f.key], f.color);
  }
}

function baseWidget() {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.bgTop, C.bgBottom];
  g.locations = [0, 0.8];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);
  return w;
}

function buildSmall(s, featured, offline) {
  const w = baseWidget();
  header(w, s.latest, offline);
  w.addSpacer(6);
  heroBlock(w, s, featured, 28);
  w.addSpacer();
  otherRates(w, s, featured);
  w.addSpacer(3);
  addText(w, fmtDate(s.latest.date) + (offline ? " · offline" : ""), Font.mediumSystemFont(10), C.faint);
  return w;
}

function buildMedium(s, featured, offline, large) {
  const w = baseWidget();
  const body = w.addStack();
  body.layoutHorizontally();

  const left = body.addStack();
  left.layoutVertically();
  left.size = new Size(128, 0);
  header(left, s.latest, offline);
  left.addSpacer(6);
  heroBlock(left, s, featured, 26);
  left.addSpacer();
  otherRates(left, s, featured);

  body.addSpacer(12);

  const right = body.addStack();
  right.layoutVertically();
  right.backgroundColor = C.panel;
  right.cornerRadius = 12;
  right.setPadding(8, 8, 8, 8);
  const cap = right.addStack();
  addText(cap, `Last ${CHART_DAYS} days`, Font.mediumSystemFont(10), C.faint);
  cap.addSpacer();
  addText(cap, fmtDate(s.latest.date) + (offline ? " · offline" : ""), Font.mediumSystemFont(10), C.faint);
  right.addSpacer(4);
  const chartHeight = large ? 150 : 88;
  const img = right.addImage(drawChart(s.recent, 180, chartHeight));
  img.imageSize = new Size(180, chartHeight);

  if (large) {
    w.addSpacer(10);
    const table = w.addStack();
    table.layoutVertically();
    table.spacing = 3;
    for (const r of s.rows.slice(-6).reverse()) {
      const row = table.addStack();
      addText(row, fmtDate(r.date), Font.mediumSystemFont(11), C.dim);
      row.addSpacer();
      addText(row, `${r.sora.toFixed(4)}   ${r.m1.toFixed(4)}   ${r.m3.toFixed(4)}`, Font.regularMonospacedSystemFont(11));
    }
  }
  return w;
}

function buildAccessory(s, featured, family) {
  const w = new ListWidget();
  const value = s.latest[featured.key];
  if (family === "accessoryInline") {
    w.addText(`${featured.short} ${value.toFixed(3)}% ${fmtBps(s.bps[featured.key])}`);
    return w;
  }
  if (family === "accessoryCircular") {
    w.addSpacer();
    const a = addText(w, featured.short, Font.semiboldSystemFont(10), Color.white());
    a.centerAlignText();
    const b = addText(w, value.toFixed(2), Font.boldRoundedSystemFont(16), Color.white());
    b.centerAlignText();
    w.addSpacer();
    return w;
  }
  addText(w, `${featured.label} · ${fmtDate(s.latest.date)}`, Font.semiboldSystemFont(11), Color.white());
  addText(w, `${value.toFixed(4)}%  ${fmtBps(s.bps[featured.key])}`, Font.boldRoundedSystemFont(17), Color.white());
  const others = Object.values(SERIES)
    .filter((f) => f.key !== featured.key)
    .map((f) => `${f.short} ${s.latest[f.key].toFixed(2)}`)
    .join(" · ");
  addText(w, others, Font.mediumSystemFont(11), new Color("#ffffff", 0.75));
  return w;
}

function errorWidget(message) {
  const w = baseWidget();
  addText(w, "SORA · SG", Font.semiboldSystemFont(10), C.dim);
  w.addSpacer();
  addText(w, "Can't reach the rates sheet", Font.semiboldSystemFont(13));
  w.addSpacer(4);
  const t = addText(w, message, Font.systemFont(10), C.faint);
  t.lineLimit = 3;
  w.addSpacer();
  addText(w, "Will retry automatically", Font.mediumSystemFont(10), C.faint);
  return w;
}

async function run() {
  const family = config.widgetFamily ?? "medium";
  const featured = SERIES[String(args.widgetParameter || "sora").trim().toLowerCase()] || SERIES.sora;
  let widget;
  try {
    const { rows, offline } = await loadRows();
    const latest = rows[rows.length - 1];
    const prev = rows[rows.length - 2] || latest;
    const s = {
      rows,
      latest,
      recent: rows.slice(-CHART_DAYS),
      bps: {
        sora: (latest.sora - prev.sora) * 100,
        m1: (latest.m1 - prev.m1) * 100,
        m3: (latest.m3 - prev.m3) * 100,
      },
    };
    if (family.startsWith("accessory")) widget = buildAccessory(s, featured, family);
    else if (family === "small") widget = buildSmall(s, featured, offline);
    else widget = buildMedium(s, featured, offline, family === "large" || family === "extraLarge");
  } catch (err) {
    widget = errorWidget(String(err.message || err));
  }
  widget.url = SITE_URL;
  widget.refreshAfterDate = new Date(Date.now() + REFRESH_HOURS * 3600 * 1000);

  if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(widget);
  else await widget.presentMedium();
  Script.complete();
}

await run();
