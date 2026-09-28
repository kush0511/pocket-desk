import { Sparkline } from "@/components/sparkline";
import { WidgetFrame } from "@/components/widget-frame";
import { SOURCES, fmtShortDate, fmtSigned, summarizeSora } from "@/lib/data";

type Summary = ReturnType<typeof summarizeSora>;

const BG = "bg-[radial-gradient(120%_90%_at_0%_0%,#1a2446_0%,#0d1120_55%,#090b10_100%)]";
const bpsClass = (bps: number) => (bps > 0 ? "text-[#f87171]" : bps < 0 ? "text-[#34d399]" : "text-white/50");

function Header({ age }: { age: number }) {
  return (
    <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">
      <span>SORA · SG</span>
      <span className={age > 4 ? "size-1.5 rounded-full bg-amber-400" : "size-1.5 rounded-full bg-[#2dd4a8]"} />
    </div>
  );
}

function RateLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline justify-between text-[12px] tabular-nums">
      <span className="flex items-center gap-1.5 text-white/60">
        <i className="size-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-semibold">{value.toFixed(4)}%</span>
    </div>
  );
}

export function SoraSmall({ s }: { s: Summary }) {
  return (
    <WidgetFrame size="small" href={SOURCES.sora.site} label="Small" className={BG}>
      <Header age={s.age} />
      <div className="mt-2 text-[28px] leading-none font-bold tracking-tight tabular-nums">
        {s.latest.sora.toFixed(4)}
        <span className="text-[16px] text-white/60">%</span>
      </div>
      <div className={`mt-1 text-[11px] font-semibold tabular-nums ${bpsClass(s.bps.sora)}`}>
        {fmtSigned(s.bps.sora, 1, " bps")} <span className="text-white/40">overnight</span>
      </div>
      <div className="mt-auto space-y-0.5">
        <RateLine label="1M" value={s.latest.m1} color="#2dd4a8" />
        <RateLine label="3M" value={s.latest.m3} color="#a78bfa" />
        <div className="pt-0.5 text-[10px] text-white/40">{fmtShortDate(s.latest.date)}</div>
      </div>
    </WidgetFrame>
  );
}

export function SoraMedium({ s }: { s: Summary }) {
  return (
    <WidgetFrame size="medium" href={SOURCES.sora.site} label="Medium" className={`${BG} flex-row gap-3`}>
      <div className="flex w-[42%] flex-col">
        <Header age={s.age} />
        <div className="mt-2 text-[26px] leading-none font-bold tracking-tight tabular-nums">
          {s.latest.sora.toFixed(4)}
          <span className="text-[15px] text-white/60">%</span>
        </div>
        <div className={`mt-1 text-[11px] font-semibold tabular-nums ${bpsClass(s.bps.sora)}`}>
          {fmtSigned(s.bps.sora, 1, " bps")}
        </div>
        <div className="mt-auto space-y-0.5">
          <RateLine label="1M" value={s.latest.m1} color="#2dd4a8" />
          <RateLine label="3M" value={s.latest.m3} color="#a78bfa" />
        </div>
      </div>
      <div className="flex flex-1 flex-col rounded-xl bg-white/[0.04] p-2">
        <div className="flex justify-between text-[10px] text-white/45">
          <span>Last 60 days</span>
          <span>{fmtShortDate(s.latest.date)}</span>
        </div>
        <Sparkline
          className="mt-1 h-full w-full"
          fill="rgba(102,153,255,0.12)"
          series={[
            { values: s.recent.map((r) => r.sora), color: "#6699ff", width: 1.8 },
            { values: s.recent.map((r) => r.m1), color: "#2dd4a8", width: 1.4 },
            { values: s.recent.map((r) => r.m3), color: "#a78bfa", width: 1.4 },
          ]}
        />
      </div>
    </WidgetFrame>
  );
}

export function SoraLock({ s }: { s: Summary }) {
  return (
    <WidgetFrame size="lock" href={SOURCES.sora.site} label="Lock screen" className="bg-white/10 backdrop-blur">
      <div className="text-[11px] font-semibold text-white/70">SORA {fmtShortDate(s.latest.date)}</div>
      <div className="text-[18px] leading-tight font-bold tabular-nums">{s.latest.sora.toFixed(4)}%</div>
      <div className="text-[11px] text-white/70 tabular-nums">
        1M {s.latest.m1.toFixed(2)} · 3M {s.latest.m3.toFixed(2)}
      </div>
    </WidgetFrame>
  );
}
