export const SOURCES = {
  sora: {
    name: "SORA Rates",
    data: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSetwT6jWgq4H6LPeIp3hB_hgo4HdF1P1Q7pu0JYlaUqXnzxbonDFpA_Myndbv3ewsbFOyGhW6kxLro/pub?output=csv",
    site: "https://kush0511.github.io/sora-rates/",
    repo: "https://github.com/kush0511/sora-rates",
  },
  spx: {
    name: "SPX Valuation Bands",
    data: "https://raw.githubusercontent.com/kush0511/spy-valuation-bands/main/src/data/valuation-data.json",
    site: "https://kush0511.github.io/spy-valuation-bands/",
    repo: "https://github.com/kush0511/spy-valuation-bands",
  },
} as const;

export const MULTIPLES = [16, 18, 20, 22, 24, 26] as const;
export const BAND_COLORS = ["#779a9a", "#78b5aa", "#b6c78e", "#d6b17a", "#b396b8", "#889fc6"];

export type SoraRow = { date: string; sora: number; m1: number; m3: number };
export type SpxRow = { date: string; spx: number; eps: number; pe: number };

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseSoraCsv(csv: string): SoraRow[] {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const cols = line.split(",");
      if (cols.length < 4) return [];
      const [d, m, y] = cols[0].trim().split("/").map(Number);
      const [sora, m1, m3] = cols.slice(1, 4).map(Number.parseFloat);
      if (!d || !m || !y || [sora, m1, m3].some(Number.isNaN)) return [];
      return [{ date: `${y}-${pad(m)}-${pad(d)}`, sora, m1, m3 }];
    });
}

export function parseSpxJson(json: unknown): SpxRow[] {
  const rows = (json as { rows?: SpxRow[] })?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r) => typeof r?.date === "string" && [r.spx, r.eps, r.pe].every(Number.isFinite),
  );
}

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmtSigned(n: number, digits = 1, suffix = "") {
  const text = fmtNum(Math.abs(n), digits);
  const sign = Number(text.replace(/,/g, "")) === 0 ? "" : n > 0 ? "+" : "−";
  return `${sign}${text}${suffix}`;
}

export function fmtShortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function ageInDays(iso: string, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000));
}

export function summarizeSora(rows: SoraRow[]) {
  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2] ?? latest;
  return {
    latest,
    bps: {
      sora: (latest.sora - prev.sora) * 100,
      m1: (latest.m1 - prev.m1) * 100,
      m3: (latest.m3 - prev.m3) * 100,
    },
    recent: rows.slice(-60),
    age: ageInDays(latest.date),
  };
}

export function bandLabel(pe: number) {
  const lower = [...MULTIPLES].reverse().find((m) => m <= pe);
  const upper = MULTIPLES.find((m) => m >= pe);
  if (lower === undefined) return { lower, upper, text: `below ${MULTIPLES[0]}×` };
  if (upper === undefined) return { lower, upper, text: `above ${MULTIPLES[MULTIPLES.length - 1]}×` };
  if (lower === upper) return { lower, upper, text: `at ${lower}×` };
  return { lower, upper, text: `${lower}×–${upper}× band` };
}

export function summarizeSpx(rows: SpxRow[], target = 20) {
  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2] ?? latest;
  const [y, m, d] = latest.date.split("-").map(Number);
  const cutoff = `${y - 1}-${pad(m)}-${pad(d)}`;
  const year = rows.filter((r) => r.date >= cutoff);
  const band = bandLabel(latest.pe);
  const lo = band.lower ?? MULTIPLES[0];
  const hi = band.upper ?? MULTIPLES[MULTIPLES.length - 1];
  const shown = MULTIPLES.filter((mult) => mult >= lo - 2 && mult <= hi + 2);
  const targetLevel = latest.eps * target;
  return {
    latest,
    target,
    targetLevel,
    targetGap: (latest.spx / targetLevel - 1) * 100,
    dayChange: (latest.spx / prev.spx - 1) * 100,
    band,
    year,
    shown,
    age: ageInDays(latest.date),
  };
}
