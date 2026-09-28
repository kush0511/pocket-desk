// S&P 500 Valuation Bands — iPhone widget for Scriptable (https://scriptable.app)
// Reads the daily snapshot published by https://kush0511.github.io/spy-valuation-bands/
// (src/data/valuation-data.json, refreshed by that repo's GitHub Action).
//
// Widget parameter (long-press widget → Edit Widget → Parameter):
//   a multiple such as 18, 20 (default), 22 → the band compared against the index
// Sizes: small, medium, large, and Lock Screen (rectangular, inline, circular).

const DATA_URL =
  "https://raw.githubusercontent.com/kush0511/spy-valuation-bands/main/src/data/valuation-data.json";
const SITE_URL = "https://kush0511.github.io/spy-valuation-bands/";
const REFRESH_HOURS = 4;
const MULTIPLES = [16, 18, 20, 22, 24, 26];
const BAND_COLORS = ["#779a9a", "#78b5aa", "#b6c78e", "#d6b17a", "#b396b8", "#889fc6"];

const C = {
  bgTop: new Color("#1d3340"),
  bgBottom: new Color("#0b141a"),
  text: new Color("#edf3ef"),
  dim: new Color("#edf3ef", 0.55),
  faint: new Color("#edf3ef", 0.35),
  panel: new Color("#ffffff", 0.05),
  up: new Color("#78b5aa"),
  down: new Color("#e08a8a"),
  live: new Color("#b6c78e"),
  stale: new Color("#fbbf24"),
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function loadRows() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.cachesDirectory(), "spx-valuation-widget.json");
  try {
    const req = new Request(DATA_URL);
    req.timeoutInterval = 30;
    const json = await req.loadJSON();
    const rows = (json.rows || []).filter((r) => r && r.date && [r.spx, r.eps, r.pe].every(Number.isFinite));
    if (!rows.length) throw new Error("Snapshot returned no rows");
    // Keep ~14 months cached so the widget still renders offline without storing the full history.
    fm.writeString(cachePath, JSON.stringify(rows.slice(-300)));
    return { rows, offline: false };
  } catch (err) {
    if (fm.fileExists(cachePath)) {
      const rows = JSON.parse(fm.readString(cachePath));
      if (rows.length) return { rows, offline: true };
    }
    throw err;
  }
}

const num = (n, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n, digits = 1, suffix = "%") => {
  const text = num(Math.abs(n), digits);
  const sign = Number(text.replace(/,/g, "")) === 0 ? "" : n > 0 ? "+" : "−";
  return `${sign}${text}${suffix}`;
};
const shortDate = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const ageDays = (iso) => Math.floor((Date.now() - Date.parse(`${iso}T00:00:00Z`)) / 86400000);
const colorFor = (m) => new Color(BAND_COLORS[MULTIPLES.indexOf(m)] || "#889fc6");

function summarize(rows, target) {
  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2] || latest;
  const [y, m, d] = latest.date.split("-");
  const cutoff = `${Number(y) - 1}-${m}-${d}`;
  const lower = [...MULTIPLES].reverse().find((x) => x <= latest.pe);
  const upper = MULTIPLES.find((x) => x >= latest.pe);
  let band;
  if (lower === undefined) band = `below ${MULTIPLES[0]}×`;
  else if (upper === undefined) band = `above ${MULTIPLES[MULTIPLES.length - 1]}×`;
  else if (lower === upper) band = `at ${lower}×`;
  else band = `${lower}×–${upper}× band`;
  const lo = lower ?? MULTIPLES[0];
  const hi = upper ?? MULTIPLES[MULTIPLES.length - 1];
  return {
    latest,
    target,
    band,
    targetLevel: latest.eps * target,
    targetGap: (latest.spx / (latest.eps * target) - 1) * 100,
    dayChange: (latest.spx / prev.spx - 1) * 100,
    year: rows.filter((r) => r.date >= cutoff),
    shown: MULTIPLES.filter((x) => x >= lo - 2 && x <= hi + 2),
  };
}

function addText(stack, str, font, color = C.text) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function drawMeter(pe, width) {
  const h = 12;
  const dc = new DrawContext();
  dc.size = new Size(width, h);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const lo = MULTIPLES[0];
  const hi = MULTIPLES[MULTIPLES.length - 1];
  const seg = width / (MULTIPLES.length - 1);
  MULTIPLES.slice(0, -1).forEach((m, i) => {
    dc.setFillColor(new Color(BAND_COLORS[i], 0.8));
    dc.fillRect(new Rect(i * seg, 4, seg, 4));
  });
  const x = Math.min(1, Math.max(0, (pe - lo) / (hi - lo))) * width;
  dc.setFillColor(Color.white());
  dc.fillRect(new Rect(Math.min(width - 3, Math.max(0, x - 1.5)), 0, 3, h));
  return dc.getImage();
}

function drawChart(s, width, height) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const rows = s.year;
  const lines = [
    ...s.shown.map((m) => ({
      values: rows.map((r) => r.eps * m),
      color: new Color(BAND_COLORS[MULTIPLES.indexOf(m)], m === s.target ? 1 : 0.5),
      width: m === s.target ? 1.6 : 1,
    })),
    { values: rows.map((r) => r.spx), color: C.text, width: 2 },
  ];
  const all = lines.flatMap((l) => l.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 3;
  const x = (i) => (i / (rows.length - 1)) * width;
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);
  for (const l of lines) {
    const path = new Path();
    l.values.forEach((v, i) => (i ? path.addLine(new Point(x(i), y(v))) : path.move(new Point(x(i), y(v)))));
    dc.addPath(path);
    dc.setStrokeColor(l.color);
    dc.setLineWidth(l.width);
    dc.strokePath();
  }
  return dc.getImage();
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

function header(stack, s, offline) {
  const row = stack.addStack();
  row.centerAlignContent();
  addText(row, "S&P 500 · FWD P/E", Font.semiboldSystemFont(10), C.dim);
  row.addSpacer();
  const stale = offline || ageDays(s.latest.date) > 4;
  addText(row, "●", Font.systemFont(8), stale ? C.stale : C.live);
}

function hero(stack, s, size) {
  const h = stack.addStack();
  h.bottomAlignContent();
  addText(h, s.latest.pe.toFixed(2), Font.boldRoundedSystemFont(size));
  addText(h, "×", Font.semiboldRoundedSystemFont(size * 0.6), C.dim);
  stack.addSpacer(2);
  addText(stack, s.band, Font.mediumSystemFont(11), C.dim);
}

function kv(stack, key, value, color = C.text) {
  const row = stack.addStack();
  addText(row, key, Font.mediumSystemFont(11), C.dim);
  row.addSpacer();
  addText(row, value, Font.semiboldMonospacedSystemFont(11), color);
}

function buildSmall(s, offline) {
  const w = baseWidget();
  header(w, s, offline);
  w.addSpacer(6);
  hero(w, s, 30);
  w.addSpacer(6);
  const meter = w.addImage(drawMeter(s.latest.pe, 128));
  meter.imageSize = new Size(128, 12);
  w.addSpacer();
  const row = w.addStack();
  addText(row, num(s.latest.spx), Font.semiboldMonospacedSystemFont(12));
  row.addSpacer();
  addText(row, signed(s.dayChange), Font.semiboldSystemFont(11), s.dayChange >= 0 ? C.up : C.down);
  addText(w, shortDate(s.latest.date) + (offline ? " · offline" : ""), Font.mediumSystemFont(10), C.faint);
  return w;
}

function buildMedium(s, offline, large) {
  const w = baseWidget();
  const body = w.addStack();
  body.layoutHorizontally();

  const left = body.addStack();
  left.layoutVertically();
  left.size = new Size(128, 0);
  header(left, s, offline);
  left.addSpacer(6);
  hero(left, s, 28);
  left.addSpacer();
  kv(left, "SPX", num(s.latest.spx));
  kv(left, "EPS", `$${num(s.latest.eps, 2)}`);
  kv(left, `vs ${s.target}×`, signed(s.targetGap));

  body.addSpacer(12);

  const right = body.addStack();
  right.layoutVertically();
  right.backgroundColor = C.panel;
  right.cornerRadius = 12;
  right.setPadding(8, 8, 8, 8);
  const cap = right.addStack();
  addText(cap, `1Y · ${s.shown[0]}–${s.shown[s.shown.length - 1]}×`, Font.mediumSystemFont(10), C.faint);
  cap.addSpacer();
  addText(cap, shortDate(s.latest.date) + (offline ? " · offline" : ""), Font.mediumSystemFont(10), C.faint);
  right.addSpacer(4);
  const chartHeight = large ? 150 : 88;
  const img = right.addImage(drawChart(s, 180, chartHeight));
  img.imageSize = new Size(180, chartHeight);

  if (large) {
    w.addSpacer(10);
    addText(w, "INDEX LEVEL AT EACH MULTIPLE", Font.semiboldSystemFont(10), C.faint);
    w.addSpacer(4);
    for (const m of MULTIPLES) {
      const row = w.addStack();
      row.centerAlignContent();
      addText(row, "● ", Font.systemFont(8), colorFor(m));
      addText(row, `${m}×`, Font.semiboldSystemFont(11), m === s.target ? C.text : C.dim);
      row.addSpacer();
      const level = s.latest.eps * m;
      addText(row, `${num(level)}   ${signed((level / s.latest.spx - 1) * 100)}`, Font.regularMonospacedSystemFont(11));
    }
  }
  return w;
}

function buildAccessory(s, family) {
  const w = new ListWidget();
  if (family === "accessoryInline") {
    w.addText(`SPX ${s.latest.pe.toFixed(1)}× · ${num(s.latest.spx)}`);
    return w;
  }
  if (family === "accessoryCircular") {
    w.addSpacer();
    const a = addText(w, "P/E", Font.semiboldSystemFont(10), Color.white());
    a.centerAlignText();
    const b = addText(w, s.latest.pe.toFixed(1), Font.boldRoundedSystemFont(17), Color.white());
    b.centerAlignText();
    w.addSpacer();
    return w;
  }
  addText(w, `S&P 500 Fwd P/E · ${shortDate(s.latest.date)}`, Font.semiboldSystemFont(11), Color.white());
  addText(w, `${s.latest.pe.toFixed(2)}×  ${s.band.replace(" band", "")}`, Font.boldRoundedSystemFont(17), Color.white());
  addText(w, `${num(s.latest.spx)} · ${signed(s.targetGap)} vs ${s.target}×`, Font.mediumSystemFont(11), new Color("#ffffff", 0.75));
  return w;
}

function errorWidget(message) {
  const w = baseWidget();
  addText(w, "S&P 500 · FWD P/E", Font.semiboldSystemFont(10), C.dim);
  w.addSpacer();
  addText(w, "Can't reach the valuation snapshot", Font.semiboldSystemFont(13));
  w.addSpacer(4);
  const t = addText(w, message, Font.systemFont(10), C.faint);
  t.lineLimit = 3;
  w.addSpacer();
  addText(w, "Will retry automatically", Font.mediumSystemFont(10), C.faint);
  return w;
}

async function run() {
  const family = config.widgetFamily ?? "medium";
  const param = parseInt(String(args.widgetParameter || ""), 10);
  const target = MULTIPLES.includes(param) ? param : 20;
  let widget;
  try {
    const { rows, offline } = await loadRows();
    const s = summarize(rows, target);
    if (family.startsWith("accessory")) widget = buildAccessory(s, family);
    else if (family === "small") widget = buildSmall(s, offline);
    else widget = buildMedium(s, offline, family === "large" || family === "extraLarge");
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
