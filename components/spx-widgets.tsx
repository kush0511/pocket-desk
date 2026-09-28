import { Sparkline } from "@/components/sparkline";
import { WidgetFrame } from "@/components/widget-frame";
import { BAND_COLORS, MULTIPLES, SOURCES, fmtNum, fmtShortDate, fmtSigned, summarizeSpx } from "@/lib/data";

type Summary = ReturnType<typeof summarizeSpx>;

const BG = "bg-[radial-gradient(120%_90%_at_0%_0%,#1d3340_0%,#111d25_55%,#0b141a_100%)]";
const colorFor = (m: number) => BAND_COLORS[MULTIPLES.indexOf(m as (typeof MULTIPLES)[number])];

function Header({ age }: { age: number }) {
  return (
    <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">
      <span>S&P 500 · Fwd P/E</span>
      <span className={age > 4 ? "size-1.5 rounded-full bg-amber-400" : "size-1.5 rounded-full bg-[#b6c78e]"} />
    </div>
  );
}

function BandMeter({ pe }: { pe: number }) {
  const lo = MULTIPLES[0];
  const hi = MULTIPLES[MULTIPLES.length - 1];
  const pos = Math.min(1, Math.max(0, (pe - lo) / (hi - lo)));
  return (
    <div className="relative mt-2">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        {MULTIPLES.slice(0, -1).map((m, i) => (
          <span key={m} className="flex-1" style={{ background: BAND_COLORS[i], opacity: 0.75 }} />
        ))}
      </div>
      <span
        className="absolute -top-[3px] h-3 w-[3px] -translate-x-1/2 rounded-full bg-white shadow"
        style={{ left: `${pos * 100}%` }}
      />
      <div className="mt-1 flex justify-between text-[9px] text-white/40 tabular-nums">
        <span>{lo}×</span>
        <span>{hi}×</span>
      </div>
    </div>
  );
}

export function SpxSmall({ s }: { s: Summary }) {
  return (
    <WidgetFrame size="small" href={SOURCES.spx.site} label="Small" className={BG}>
      <Header age={s.age} />
      <div className="mt-2 text-[30px] leading-none font-bold tracking-tight tabular-nums">
        {s.latest.pe.toFixed(2)}
        <span className="text-[17px] text-white/60">×</span>
      </div>
      <div className="mt-1 text-[11px] font-medium text-white/60">{s.band.text}</div>
      <BandMeter pe={s.latest.pe} />
      <div className="mt-auto flex items-baseline justify-between text-[12px] tabular-nums">
        <span className="font-semibold">{fmtNum(s.latest.spx)}</span>
        <span className={s.dayChange >= 0 ? "text-[#78b5aa]" : "text-[#e08a8a]"}>
          {fmtSigned(s.dayChange, 1, "%")}
        </span>
      </div>
      <div className="text-[10px] text-white/40">{fmtShortDate(s.latest.date)}</div>
    </WidgetFrame>
  );
}

export function SpxMedium({ s }: { s: Summary }) {
  const bandSeries = s.shown.map((m) => ({
    values: s.year.map((r) => r.eps * m),
    color: colorFor(m),
    width: m === s.target ? 1.6 : 1,
    opacity: m === s.target ? 1 : 0.55,
    dashed: m !== s.target,
  }));
  return (
    <WidgetFrame size="medium" href={SOURCES.spx.site} label="Medium" className={`${BG} flex-row gap-3`}>
      <div className="flex w-[42%] flex-col">
        <Header age={s.age} />
        <div className="mt-2 text-[28px] leading-none font-bold tracking-tight tabular-nums">
          {s.latest.pe.toFixed(2)}
          <span className="text-[16px] text-white/60">×</span>
        </div>
        <div className="mt-1 text-[11px] font-medium text-white/60">{s.band.text}</div>
        <div className="mt-auto space-y-0.5 text-[12px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-white/55">SPX</span>
            <span className="font-semibold">{fmtNum(s.latest.spx)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/55">EPS</span>
            <span className="font-semibold">${fmtNum(s.latest.eps, 2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/55">vs {s.target}×</span>
            <span className="font-semibold">{fmtSigned(s.targetGap, 1, "%")}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col rounded-xl bg-white/[0.04] p-2">
        <div className="flex justify-between text-[10px] text-white/45">
          <span>1Y · bands {s.shown[0]}–{s.shown[s.shown.length - 1]}×</span>
          <span>{fmtShortDate(s.latest.date)}</span>
        </div>
        <Sparkline
          className="mt-1 h-full w-full"
          series={[{ values: s.year.map((r) => r.spx), color: "#edf3ef", width: 1.8 }, ...bandSeries]}
        />
      </div>
    </WidgetFrame>
  );
}

export function SpxLock({ s }: { s: Summary }) {
  return (
    <WidgetFrame size="lock" href={SOURCES.spx.site} label="Lock screen" className="bg-white/10 backdrop-blur">
      <div className="text-[11px] font-semibold text-white/70">S&P 500 Fwd P/E</div>
      <div className="text-[18px] leading-tight font-bold tabular-nums">{s.latest.pe.toFixed(2)}×</div>
      <div className="text-[11px] text-white/70 tabular-nums">
        {fmtNum(s.latest.spx)} · {s.band.text.replace(" band", "")}
      </div>
    </WidgetFrame>
  );
}
