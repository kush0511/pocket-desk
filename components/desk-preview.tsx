"use client";

import { useState } from "react";
import { ChevronRight, House, Leaf, TrendingUp, Waves } from "lucide-react";

const SIGNALS = [
  { key: "sora", name: "SORA", icon: Waves, detail: "Overnight SORA, with 1-month and 3-month compounded rates and a source date. Tap the installed card to open your full rates dashboard.", link: "https://kush0511.github.io/sora-rates/", action: "Explore SORA rates" },
  { key: "spx", name: "S&P 500", icon: TrendingUp, detail: "Forward price-to-earnings, a valuation-band reference, and the snapshot date. Tap the installed card to explore the underlying earnings scenarios.", link: "https://kush0511.github.io/spy-valuation-bands/", action: "Explore valuation bands" },
  { key: "train", name: "Last train", icon: House, detail: "Find the nearest MRT exit to your location, then estimate the last train to Lakeside. The current July 29 timetable is stale, so its clock is explicitly a historical estimate. Check the operator before relying on it.", link: "https://kush0511.github.io/sg-last-train-home/", action: "Open last-train planner" },
  { key: "air", name: "Air quality", icon: Leaf, detail: "US AQI near your chosen location, with a source time and air-quality category. This is modeled air quality, not a nearby sensor reading or Singapore PSI. Location sharing is optional and set up on your phone.", link: "https://open-meteo.com/en/docs/air-quality-api", action: "About the air-quality data" },
] as const;

type Size = "large" | "medium" | "small";
type Signal = typeof SIGNALS[number]["key"];

const CARDS: Record<Signal, { title: string; value: string; unit?: string; label: string; detail: string; foot: string; attribution?: string; warning?: boolean }> = {
  sora: { title: "SORA", value: "1.0846", unit: "%", label: "Overnight", detail: "1M 1.289% · 3M 1.237%", foot: "13 Oct" },
  spx: { title: "S&P 500", value: "19.22", unit: "×", label: "Forward P/E", detail: "18–20× band", foot: "12 Oct" },
  train: { title: "LAST TRAIN", value: "23:41", label: "Historical estimate", detail: "Nearest MRT → Lakeside", foot: "29 Jul · verify", attribution: "GPS 18:00 · example", warning: true },
  air: { title: "AIR QUALITY", value: "42", label: "US AQI · model", detail: "Good", foot: "14 Oct 17:45", attribution: "CAMS / Open-Meteo" },
};

export function DeskPreview() {
  const [size, setSize] = useState<Size>("large");
  const [active, setActive] = useState<Signal>("sora");
  const [smallCard, setSmallCard] = useState<Signal>("sora");
  const [mediumSet, setMediumSet] = useState<"markets" | "local">("markets");
  const selected = SIGNALS.find((signal) => signal.key === active)!;
  const Icon = selected.icon;
  const visible: Signal[] = size === "large" ? ["sora", "spx", "train", "air"] : size === "small" ? [smallCard] : mediumSet === "markets" ? ["sora", "spx"] : ["train", "air"];

  function changeSize(option: Size) {
    setSize(option);
    setActive(option === "small" ? smallCard : option === "medium" && mediumSet === "local" ? "train" : "sora");
  }

  return (
    <div className="preview-composition" id="preview">
      <div className="preview-topline"><span><span className="status-dot" /> THE HOME SCREEN EDITION</span><span className="preview-version">FOUR IN ONE</span></div>
      <div className={`preview-stage preview-stage-${size}`}>
        <div className={`desk-widget desk-widget-${size}`} aria-label={`Illustrative ${size} Pocket Desk widget preview. All numbers are examples.`}>
          {size === "large" && <div className="widget-heading"><span className="widget-brand">POCKET DESK</span><span className="widget-edition">18:00 snapshot</span></div>}
          <div className="widget-grid">
            {visible.map((key) => {
              const card = CARDS[key];
              return <button key={key} className={`signal-card signal-${key} ${active === key ? "signal-active" : ""}`} onClick={() => setActive(key)} aria-label={`Explore the ${card.title} card`} aria-pressed={active === key}>
                <span className="signal-label"><span className="signal-title-dot" />{card.title}</span>
                <span className="signal-number">{card.value}{card.unit && <span>{card.unit}</span>}</span>
                <span className="signal-context">{card.label}</span>
                <span className="signal-detail">{card.detail}</span>
                <span className="signal-spacer" />
                {card.attribution && <span className="signal-attribution">{card.attribution}</span>}
                <span className={`signal-foot ${card.warning ? "signal-warning" : ""}`}>{card.foot}</span>
              </button>;
            })}
          </div>
        </div>
      </div>
      <div className="preview-controls">
        <div className="size-switch" aria-label="Preview widget size">
          {(["large", "medium", "small"] as const).map((option) => <button key={option} aria-pressed={size === option} onClick={() => changeSize(option)}>{option}</button>)}
        </div>
        <span className="preview-hint">{size === "large" ? "The full picture" : size === "medium" ? "Two cards, your choice" : "One thing, in focus"}</span>
      </div>
      {size !== "large" && <div className="parameter-select"><span>Widget parameter</span>{size === "medium" ? <select aria-label="Medium widget parameter" value={mediumSet} onChange={(event) => { const next = event.target.value as "markets" | "local"; setMediumSet(next); setActive(next === "markets" ? "sora" : "train"); }}><option value="markets">markets · SORA + S&P 500</option><option value="local">local · Last train + air</option></select> : <select aria-label="Small widget parameter" value={smallCard} onChange={(event) => { const next = event.target.value as Signal; setSmallCard(next); setActive(next); }}>{SIGNALS.map((signal) => <option key={signal.key} value={signal.key}>{signal.key} · {signal.name}</option>)}</select>}</div>}
      <div className="preview-note">Illustrative web preview · Sample values · Not an iPhone screenshot</div>
      <div className="preview-detail" aria-live="polite" aria-atomic="true"><span className={`detail-icon detail-${selected.key}`}><Icon aria-hidden="true" /></span><div><p>{selected.detail}</p><a href={selected.link} target="_blank" rel="noreferrer">{selected.action}<ChevronRight /></a></div></div>
    </div>
  );
}
