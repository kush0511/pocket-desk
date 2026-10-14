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
type TrainState = "journey" | "home" | "travel";

const AIR_SAMPLES = [
  { value: 42, label: "Good" },
  { value: 245, label: "Very unhealthy" },
  { value: 500, label: "Hazardous" },
  { value: 1000, label: "Hazardous" },
] as const;

function airColor(value: number) {
  return value <= 50 ? "#82e8cb" : value <= 100 ? "#e4d579" : value <= 150 ? "#ffb45b" : value <= 200 ? "#ff8898" : value <= 300 ? "#c6a4ee" : "#e685c8";
}

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

function AirDial({ value }: { value: number }) {
  const digits = String(value).length;
  return <svg className="air-dial" viewBox="0 0 60 60" aria-hidden="true">
    {Array.from({ length: 30 }, (_, i) => { const theta = (140 + i * 260 / 29) * Math.PI / 180, lit = (i + 1) * 10 <= Math.min(300, value); return <path key={i} d={`M${30 + Math.cos(theta) * 23},${30 + Math.sin(theta) * 23} L${30 + Math.cos(theta) * 27},${30 + Math.sin(theta) * 27}`} fill="none" stroke={lit ? airColor((i + 1) * 10) : "#5E708F"} strokeWidth="2" opacity={lit ? 1 : .28} />; })}
    <text x="30" y="31" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: digits > 3 ? 17 : digits > 2 ? 21 : 27, fill: airColor(value) }}>{value}</text>
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
function TicketStamp({ state }: { state: Exclude<TrainState, "journey"> }) {
  return <svg className="ticket-stamp" viewBox="0 0 37 37" aria-hidden="true">
    <circle cx="18.5" cy="18.5" r="14.43" fill="none" stroke="#5e3c22" strokeWidth="1" opacity=".35" />
    {state === "home" ? <g fill="none" stroke="#281d16" opacity=".7"><path d="M10.56 18.5 18.5 11.86 26.44 18.5" strokeWidth="1.5" /><path d="M13.02 17.35V24.56H23.98V17.35" strokeWidth="1.3" /><path d="M17.06 24.56V19.94H19.94V24.56" strokeWidth="1.1" /></g> : <g fill="none" stroke="#281d16" opacity=".7"><circle cx="18.5" cy="18.5" r="8.66" strokeWidth="1.1" /><path d="M9.84 18.5H27.16M18.5 9.84 15.18 14.89V22.11L18.5 27.16 21.82 22.11V14.89Z" strokeWidth=".8" /></g>}
  </svg>;
}
function TrainTicket({ state }: { state: TrainState }) {
  if (state !== "journey") {
    const home = state === "home";
    return <>
      <span className="ticket-perforation ticket-state-perforation" aria-hidden="true" />
      <span className={`ticket-state ticket-state-${state}`}>
        <span className="ticket-state-main">
          <span className="ticket-top"><span>{home ? "LAST TRAIN / HOME" : "WANDER MODE"}</span></span>
          <span className="ticket-state-words"><strong>{home ? "Home turf :)" : "~1,234 km"}</strong><span className="ticket-state-detail">{home ? "Lakeside is nearby" : "from Singapore"}</span></span>
          <span className="ticket-state-foot"><span>Location now</span><span className={home ? "ticket-home-direction" : undefined}>{home ? "Nearest MRT · tap for directions" : "Straight-line · SG centre"}</span></span>
        </span>
        <span className="ticket-state-stub"><TicketStamp state={state} /><span className="ticket-stub-code">{home ? "EW26" : "AWAY"}</span></span>
      </span>
    </>;
  }
  return <>
    <span className="ticket-perforation ticket-journey-perforation" aria-hidden="true" />
    <span className="ticket-journey">
      <span className="ticket-route-column">
        <span className="ticket-top"><span>LAST TRAIN / HOME</span></span>
        <span className="ticket-route"><span className="ticket-origin">Farrer Park</span><strong>→ Lakeside</strong><RouteTrack /></span>
        <span className="ticket-bottom"><span>Historical · 29 Jul · verify</span><span>Location now</span></span>
      </span>
      <span className="ticket-departure"><span className="ticket-zone">SGT</span><span className="ticket-time-block"><strong>23:41</strong><span>BOARD BY</span></span></span>
    </span>
    <span className="ticket-vertical"><span className="ticket-top"><span>LAST TRAIN / HOME</span></span><strong>23:41</strong><span className="ticket-history-label">Historical estimate</span><span className="ticket-vertical-route">Farrer Park → Lakeside</span><RouteTrack /><span className="ticket-vertical-spacer" /><span className="ticket-vertical-foot"><span className="ticket-location">Location now</span><span className="ticket-verify">29 Jul · verify</span></span></span>
  </>;
}

function AirInstrument({ value, trainState }: { value: number; trainState: TrainState }) {
  const quality = AIR_SAMPLES.find(sample => sample.value === value)!.label;
  const warnings = Number(trainState === "journey") + Number(value > 100);
  return <>
    <span className="air-standalone-title">AIR / US AQI</span>
    <AirDial value={value} />
    <span className="air-copy"><span className="instrument-label">US AQI · model</span><strong className={value > 100 ? "air-quality-warning" : undefined}>{quality}</strong><span className="air-standalone-model">US AQI · model</span><span className="air-attribution">CAMS / Open-Meteo</span><span className="air-time">14 Oct 17:45</span><span className="sr-only">Sample AQI {value}</span></span>
    <span className="air-source"><span>SOURCES</span><span className="source-lights" aria-hidden="true"><i /><i /><i className={trainState === "journey" ? "source-caution" : undefined} /><i style={{ background: value > 100 ? "#ffd28d" : "#82e8cb" }} /></span><span className={warnings ? "source-warning" : "source-ready"}>{warnings ? `${warnings} to check` : "ALL SET"}</span></span>
  </>;
}

export function DeskPreview() {
  const [size, setSize] = useState<Size>("large");
  const [active, setActive] = useState<Signal>("sora");
  const [smallCard, setSmallCard] = useState<Signal>("sora");
  const [mediumSet, setMediumSet] = useState<"markets" | "local">("markets");
  const [trainState, setTrainState] = useState<TrainState>("home");
  const [airValue, setAirValue] = useState(245);
  const selected = SIGNALS.find((signal) => signal.key === active)!;
  const Icon = selected.icon;
  const hasTrain = size === "large" || (size === "medium" && mediumSet === "local") || (size === "small" && smallCard === "train");
  const hasAir = size === "large" || (size === "medium" && mediumSet === "local") || (size === "small" && smallCard === "air");
  const detail = active === "train" && trainState !== "journey"
    ? trainState === "home"
      ? "A little welcome back when your home MRT is nearby. This sample uses Lakeside. On your phone, a fresh location within 800 m of your nearest home station shows this card; saved locations are labelled. It does not confirm that you are at home."
      : "A little travel ticket when you are more than 75 km from the Singapore reference point. The installed widget calculates an approximate straight-line distance on your phone. This 1,234 km example is illustrative."
    : selected.detail;

  function instrument(key: Signal) {
    return <button key={key} className={`instrument instrument-${key}${key === "train" ? ` instrument-train-${trainState}` : ""}${active === key ? " instrument-active" : ""}`} onClick={() => setActive(key)} aria-label={`Explore ${SIGNALS.find(s => s.key === key)!.name}${key === "air" ? `, sample AQI ${airValue}` : ""}`} aria-pressed={active === key}>{key === "sora" ? <SoraInstrument /> : key === "spx" ? <SpxInstrument /> : key === "train" ? <TrainTicket state={trainState} /> : <AirInstrument value={airValue} trainState={trainState} />}</button>;
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
      {(hasTrain || hasAir) && <div className="sample-controls">
        {hasTrain && <div className="sample-select"><label htmlFor="train-sample">Train sample</label><select id="train-sample" value={trainState} onChange={event => { setTrainState(event.target.value as TrainState); setActive("train"); }}><option value="journey">Journey home</option><option value="home">Near home</option><option value="travel">Travelling</option></select></div>}
        {hasAir && <div className="sample-select"><label htmlFor="air-sample">Air sample</label><select id="air-sample" value={airValue} onChange={event => { setAirValue(Number(event.target.value)); setActive("air"); }}>{AIR_SAMPLES.map(sample => <option key={sample.value} value={sample.value}>{sample.value} · {sample.label}</option>)}</select></div>}
      </div>}
      <p className="preview-note">Illustrative web preview. Sample values & curves. Not an iPhone screenshot.</p>
      <div className="preview-detail" aria-live="polite" aria-atomic="true"><span className={`detail-icon detail-${selected.key}`}><Icon aria-hidden="true" /></span><div><p>{detail}</p><a href={selected.link} target="_blank" rel="noreferrer">{selected.action}<ChevronRight /></a></div></div>
    </div>
  );
}
