"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronRight, House, Leaf, TrendingUp, Waves } from "lucide-react";

const SIGNALS = [
  { key: "sora", name: "SORA", icon: Waves, detail: "A real rate curve, not decoration. The installed widget plots recent SORA observations alongside the 1-month and 3-month compounded rates, with the source date kept in view.", link: "https://kush0511.github.io/sora-rates/", action: "Explore SORA rates" },
  { key: "spx", name: "S&P 500", icon: TrendingUp, detail: "The market multiple, on a calibrated 16–26× dial. See S&P 500 forward P/E, its valuation band, and the snapshot date. Tap the installed instrument to explore the earnings scenarios.", link: "https://kush0511.github.io/spy-valuation-bands/", action: "Explore valuation bands" },
  { key: "train", name: "Last train", icon: House, detail: "Your way home, as a transit ticket. The nearest mapped MRT exit and a line-colored route to Lakeside. The July 29 timetable is stale: this is a historical estimate, so verify with the operator before relying on it.", link: "https://kush0511.github.io/sg-last-train-home/", action: "Open last-train planner" },
  { key: "air", name: "Air quality", icon: Leaf, detail: "A little breathing room. The AQI instrument shows modeled US AQI, its category, and the source time. It is not a nearby sensor reading or Singapore PSI. Location sharing is optional and configured on your phone.", link: "https://open-meteo.com/en/docs/air-quality-api", action: "About the air-quality data" },
] as const;

type Size = "large" | "medium" | "small";
type Signal = typeof SIGNALS[number]["key"];

// Deliberately illustrative, never presented as a current financial feed.
const SAMPLE_SORA = [1.48,1.45,1.54,1.42,1.44,1.49,1.38,1.45,1.40,1.37,1.42,1.39,1.31,1.36,1.37,1.29,1.33,1.28,1.30,1.34,1.29,1.26,1.31,1.28,1.22,1.29,1.25,1.24,1.31,1.22,1.21,1.24,1.28,1.19,1.23,1.18,1.25,1.19,1.20,1.16,1.22,1.18,1.16,1.21,1.19,1.15,1.17,1.13,1.19,1.16,1.18,1.12,1.16,1.11,1.18,1.15,1.10,1.15,1.2026,1.0846];
const SAMPLE_M1 = SAMPLE_SORA.map((_, i) => 1.48 - i * .00323);
const SAMPLE_M3 = SAMPLE_SORA.map((_, i) => 1.40 - i * .00277);
function sparkPath(values: number[]) {
  return values.map((v, i) => `${i ? "L" : "M"}${(i * 192 / (values.length - 1) + 3).toFixed(2)},${(49 - (v - 1.05) / .52 * 44).toFixed(2)}`).join(" ");
}
function point(angle: number, radius: number, cx = 60, cy = 61) {
  return [cx + Math.cos(angle * Math.PI / 180) * radius, cy - Math.sin(angle * Math.PI / 180) * radius];
}
function arc(start: number, end: number, radius: number, cx = 60, cy = 61) {
  const a = point(start, radius, cx, cy), b = point(end, radius, cx, cy);
  return `M${a.join(",")} A${radius},${radius} 0 0 1 ${b.join(",")}`;
}

function RateCurve() {
  return <svg className="rate-curve" viewBox="0 0 200 55" preserveAspectRatio="none" aria-hidden="true">
    <path className="chart-grid" d="M2 8H198 M2 28H198 M2 48H198" />
    <path className="chart-grid chart-grid-vertical" d="M3 2V52 M51 2V52 M99 2V52 M147 2V52 M195 2V52" />
    <path className="curve-fill" d={`${sparkPath(SAMPLE_SORA)} L195,53 L3,53 Z`} />
    <path className="curve-m3" d={sparkPath(SAMPLE_M3)} />
    <path className="curve-m1" d={sparkPath(SAMPLE_M1)} />
    <path className="curve-sora-glow" d={sparkPath(SAMPLE_SORA)} />
    <path className="curve-sora" d={sparkPath(SAMPLE_SORA)} />
    <circle className="curve-point" cx="195" cy={49 - (1.0846 - 1.05) / .52 * 44} r="2.7" />
  </svg>;
}

function ValuationDial() {
  const marker = point(180 - (19.22 - 16) / 10 * 180, 53, 60, 62);
  return <svg className="valuation-dial" viewBox="0 0 120 66" aria-hidden="true">
    {["#577CBA", "#769FDA", "#A4CFFF", "#C0ABEE", "#E2AEBA"].map((color, i) => <path key={color} d={arc(178 - i * 36, 146 - i * 36, 53, 60, 62)} fill="none" stroke={color} strokeWidth="3" opacity=".85" />)}
    {Array.from({ length: 11 }, (_, i) => { const a = point(180 - i * 18, 48, 60, 62), b = point(180 - i * 18, i % 2 ? 46 : 44, 60, 62); return <path key={i} d={`M${a.join(",")}L${b.join(",")}`} className="dial-tick" />; })}
    <circle cx={marker[0]} cy={marker[1]} r="4.2" fill="#09141f" />
    <circle cx={marker[0]} cy={marker[1]} r="2.6" fill="#edf2eb" />
  </svg>;
}

function AirDial() {
  return <svg className="air-dial" viewBox="0 0 60 60" aria-hidden="true">
    {Array.from({ length: 30 }, (_, i) => { const theta = (140 + i * 260 / 29) * Math.PI / 180; return <path key={i} d={`M${30 + Math.cos(theta) * 23},${30 + Math.sin(theta) * 23} L${30 + Math.cos(theta) * 27},${30 + Math.sin(theta) * 27}`} fill="none" stroke={i < 4 ? "#C5F277" : "#5E708F"} strokeWidth="2" opacity={i < 4 ? 1 : .28} />; })}
    <text x="30" y="38" textAnchor="middle">42</text>
  </svg>;
}

function SoraInstrument() {
  return <>
    <span className="instrument-label">SORA · O/N<span className="instrument-index">60 obs</span></span>
    <span className="sora-reading"><span>1.0846</span><small>%</small></span>
    <span className="rate-comparisons"><span><i />1M <b>1.289</b></span><span><i />3M <b>1.237</b></span></span>
    <RateCurve />
    <span className="instrument-foot"><span>13 Oct</span></span>
  </>;
}

function SpxInstrument() {
  return <>
    <span className="instrument-label">S&P 500</span>
    <span className="spx-subtitle">Forward P/E</span>
    <span className="pe-gauge"><ValuationDial /><span className="spx-reading">19.22<small>×</small></span></span>
    <span className="pe-range"><span>16×</span><span>26×</span></span>
    <span className="spx-band">18–20× band</span>
    <svg className="pe-history" viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true"><path d="M1 8H119" className="chart-grid" /><path d="M2 10 L7 8 L12 9 L17 6 L22 7 L27 4 L32 6 L37 5 L42 7 L47 3 L52 5 L57 2 L62 4 L67 3 L72 5 L77 4 L82 7 L87 6 L92 9 L97 8 L102 7 L107 10 L112 8 L118 9" fill="none" stroke="#a4cfff" strokeWidth="1" /><circle cx="118" cy="9" r="1.5" fill="#a4cfff" /></svg>
    <span className="instrument-foot"><span>12 Oct</span></span>
  </>;
}

function RouteTrack() {
  return <span className="route-track"><i className="route-stop" /><i className="route-ne" /><i className="route-interchange" /><i className="route-ew" /><i className="route-stop route-end" /></span>;
}
function TrainTicket() {
  return <>
    <span className="ticket-perforation" aria-hidden="true" />
    <span className="ticket-top"><span>LAST TRAIN / HOME</span><span>SGT</span></span>
    <span className="ticket-main">
      <span className="ticket-route"><span className="ticket-origin">Farrer Park</span><strong>→ Lakeside</strong><RouteTrack /></span>
      <span className="ticket-departure"><strong>23:41</strong><span>BOARD BY</span></span>
    </span>
    <span className="ticket-bottom"><span>Historical estimate · 29 Jul · verify</span><span>GPS 18:00 · example</span></span>
    <span className="ticket-vertical"><strong>23:41</strong><span className="ticket-history-label">Historical estimate</span><span className="ticket-vertical-route">Farrer Park → Lakeside</span><RouteTrack /><span className="ticket-vertical-spacer" /><span className="ticket-location">GPS 18:00 · example</span><span className="ticket-verify">29 Jul · verify</span></span>
  </>;
}

function AirInstrument() {
  return <>
    <span className="air-standalone-title">AIR / US AQI</span>
    <AirDial />
    <span className="air-copy"><span className="instrument-label">US AQI · model</span><strong>Good</strong><span className="air-standalone-model">US AQI · model</span><span className="air-attribution">CAMS / Open-Meteo</span><span className="air-time">14 Oct 17:45</span></span>
    <span className="air-source"><span>SOURCES</span><span className="source-lights" aria-hidden="true"><i /><i /><i /><i /></span><span className="source-warning">1 to check</span></span>
  </>;
}

export function DeskPreview() {
  const [size, setSize] = useState<Size>("large");
  const [active, setActive] = useState<Signal>("sora");
  const [smallCard, setSmallCard] = useState<Signal>("sora");
  const [mediumSet, setMediumSet] = useState<"markets" | "local">("markets");
  const selected = SIGNALS.find((signal) => signal.key === active)!;
  const Icon = selected.icon;

  function instrument(key: Signal) {
    return <button key={key} className={`instrument instrument-${key}${active === key ? " instrument-active" : ""}`} onClick={() => setActive(key)} aria-label={`Explore ${SIGNALS.find(s => s.key === key)!.name}`} aria-pressed={active === key}>{key === "sora" ? <SoraInstrument /> : key === "spx" ? <SpxInstrument /> : key === "train" ? <TrainTicket /> : <AirInstrument />}</button>;
  }
  function changeSize(option: Size) {
    setSize(option);
    setActive(option === "small" ? smallCard : option === "medium" && mediumSet === "local" ? "train" : "sora");
  }

  return (
    <div className="preview-composition" id="preview">
      <div className="preview-topline"><span><span className="status-dot" /> POCKET DESK / NIGHT SHIFT</span><span className="preview-version">EDITION 02</span></div>
      <div className={`preview-stage preview-stage-${size}`}>
        <span className="stage-corner stage-corner-tl" aria-hidden="true" /><span className="stage-corner stage-corner-tr" aria-hidden="true" /><span className="stage-corner stage-corner-bl" aria-hidden="true" /><span className="stage-corner stage-corner-br" aria-hidden="true" />
        <span className="stage-label">PERSONAL INSTRUMENT PANEL</span>
        <div className={`widget-viewport widget-viewport-${size}`}>
          <div className={`desk-widget desk-widget-${size} desk-widget-${size === "small" ? smallCard : size === "medium" ? mediumSet : "all"}`} aria-label={`Illustrative ${size} Pocket Desk widget preview. All values and curves are examples.`}>
            {size === "large" && <div className="widget-heading"><span className="widget-brand"><span className="widget-brand-mark">◒</span>NIGHT SHIFT</span><span className="widget-edition">18:00 snapshot</span></div>}
            {size === "large" ? <><div className="finance-row">{instrument("sora")}{instrument("spx")}</div>{instrument("train")}{instrument("air")}</> : size === "medium" ? <div className={`medium-pair medium-${mediumSet}`}>{mediumSet === "markets" ? <>{instrument("sora")}{instrument("spx")}</> : <>{instrument("train")}{instrument("air")}</>}</div> : instrument(smallCard)}
          </div>
        </div>
        <span className="stage-footnote"><span>iOS / SCRIPTABLE</span><span>TAP ANY SIGNAL <ArrowUpRight /></span></span>
      </div>
      <div className="preview-controls">
        <div className="size-switch" aria-label="Preview widget size">{(["large", "medium", "small"] as const).map((option) => <button key={option} aria-pressed={size === option} onClick={() => changeSize(option)}><span className={`size-icon size-icon-${option}`} aria-hidden="true" />{option}</button>)}</div>
        <span className="preview-hint">{size === "large" ? "The full control room" : size === "medium" ? "Two signals. New rhythm." : "A solo instrument"}</span>
      </div>
      {size !== "large" && <div className="parameter-select"><label htmlFor="widget-parameter">Widget parameter</label>{size === "medium" ? <select id="widget-parameter" value={mediumSet} onChange={(event) => { const next = event.target.value as "markets" | "local"; setMediumSet(next); setActive(next === "markets" ? "sora" : "train"); }}><option value="markets">markets · SORA + S&P 500</option><option value="local">local · Last train + air</option></select> : <select id="widget-parameter" value={smallCard} onChange={(event) => { const next = event.target.value as Signal; setSmallCard(next); setActive(next); }}>{SIGNALS.map((signal) => <option key={signal.key} value={signal.key}>{signal.key} · {signal.name}</option>)}</select>}</div>}
      <p className="preview-note">Illustrative web preview. Sample values & curves. Not an iPhone screenshot.</p>
      <div className="preview-detail" aria-live="polite" aria-atomic="true"><span className={`detail-icon detail-${selected.key}`}><Icon aria-hidden="true" /></span><div><p>{selected.detail}</p><a href={selected.link} target="_blank" rel="noreferrer">{selected.action}<ChevronRight /></a></div></div>
    </div>
  );
}
