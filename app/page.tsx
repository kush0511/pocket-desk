import { readFile } from "node:fs/promises";
import path from "node:path";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Code2, ExternalLink, House, Leaf, MapPin, RefreshCw, ShieldCheck, Smartphone, TrendingUp, Waves } from "lucide-react";

import { DeskPreview } from "@/components/desk-preview";
import { InstallActions } from "@/components/install-actions";
import { SOURCES } from "@/lib/data";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const features = [
  { icon: Waves, color: "mint", number: "01", title: "Rates, in context.", description: "Overnight SORA plus 1M and 3M compounded rates. Your daily interest-rate check, distilled.", tag: "SORA RATES" },
  { icon: TrendingUp, color: "blue", number: "02", title: "The market multiple.", description: "S&P 500 forward P/E and its valuation band. A little perspective beyond the index level.", tag: "S&P 500 VALUATION" },
  { icon: House, color: "amber", number: "03", title: "A way home.", description: "The nearest MRT exit, then the last train to Lakeside. A dated planning estimate with a clear freshness warning.", tag: "LAST-TRAIN PLANNER" },
  { icon: Leaf, color: "sage", number: "04", title: "A breath of context.", description: "Local US AQI, clearly labeled. Modeled air-quality data for the location you choose on your phone.", tag: "LOCAL AIR QUALITY" },
];

const steps = [
  { number: "01", title: "Get Scriptable.", body: <>Install <a href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noreferrer">Scriptable <ArrowUpRight /></a> on your iPhone. It turns a small JavaScript file into a Home Screen widget.</> },
  { number: "02", title: "Make it yours.", body: <>Copy the script below. In Scriptable, tap +, paste, and name it <strong>Pocket Desk</strong>. Run it once, enable nearest-MRT location if you want it, and set up optional local air quality. Lakeside is the default home station.</> },
  { number: "03", title: "Give it a home.", body: <>Long-press your Home Screen, add a <strong>Scriptable</strong> widget, and choose <strong>Large</strong>. Edit the widget and select your Pocket Desk script.</> },
];

export default async function Home() {
  const code = await readFile(path.join(process.cwd(), "public", "scriptable", "pocket-desk.js"), "utf8");

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="site-shell">
        <header className="site-header">
          <a className="wordmark" href="#" aria-label="Pocket Desk home"><span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /></span>Pocket Desk<span className="wordmark-period">.</span></a>
          <nav aria-label="Main navigation"><a href="#inside">What’s inside</a><a href="#install">Setup</a><a href="#sources">Sources</a></nav>
          <a className="header-action" href="#install">Get the widget <ArrowUpRight /></a>
        </header>
        <main id="main">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> SMALL WIDGET. CLEARER DAY.</div>
              <h1 id="hero-title">Your day,<br />at a <span>glance.</span></h1>
              <p className="hero-description">Rates. Markets. The way home. The air outside.<br className="desktop-break" /> Four useful signals, together on your iPhone.</p>
              <div className="hero-actions"><a href="#install" className="button button-primary">Put it on your Home Screen <ArrowRight /></a><a href="#inside" className="text-link">Take a closer look <ArrowDown /></a></div>
              <div className="hero-facts"><span><Smartphone /> Built with Scriptable</span><span><Check /> One combined widget</span></div>
              <div className="hero-margin-note"><span className="note-star" aria-hidden="true">✳</span><p>A little less opening apps.<br />A little more getting on with your day.</p></div>
            </div>
            <DeskPreview />
          </section>

          <section className="inside-section" id="inside" aria-labelledby="inside-title">
            <div className="section-heading"><div><span className="eyebrow">GOOD INFORMATION. LESS FRICTION.</span><h2 id="inside-title">Four corners. One clear picture.</h2></div><p>Designed as a single, balanced grid.<br />Every number has a place.</p></div>
            <div className="feature-grid">{features.map(({ icon: Icon, ...feature }) => <article className={`feature feature-${feature.color}`} key={feature.number}><div className="feature-top"><span className="feature-icon"><Icon /></span><span className="feature-number">{feature.number}</span></div><span className="feature-tag">{feature.tag}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div>
          </section>

          <section className="install-section" id="install" aria-labelledby="install-title">
            <div className="section-heading"><div><span className="eyebrow">A FEW MINUTES, ONCE.</span><h2 id="install-title">From here to your Home Screen.</h2></div><span className="section-side-note"><Smartphone /> Setup on your iPhone</span></div>
            <ol className="steps">{steps.map((step) => <li key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
            <div className="download-panel"><div className="download-panel-heading"><span className="script-file-icon"><Code2 /></span><div><h3>Pocket Desk</h3><p>pocket-desk.js <span>·</span> Scriptable for iOS</p></div><span className="file-badge">ALL FOUR, TOGETHER</span></div><InstallActions code={code} downloadUrl={`${BASE}/scriptable/pocket-desk.js`} /><details className="source-disclosure"><summary>View the script <ChevronDown /></summary><pre tabIndex={0} aria-label="Pocket Desk script source"><code>{code}</code></pre></details></div>
            <div className="setup-notes"><div><MapPin /><p><strong>Your places, set locally.</strong> Allow location in Scriptable for nearest MRT → Lakeside, or set an origin manually. Air-quality sharing is a separate choice. This website never requests your location.</p></div><div><RefreshCw /><p><strong>A glance, not a live feed.</strong> iOS decides when widgets refresh. Dates and cached data matter; open the source for a fresh check before acting.</p></div></div>
          </section>

          <section className="details-section" id="sources" aria-labelledby="sources-title">
            <div className="details-intro"><span className="eyebrow">KNOW WHAT YOU’RE LOOKING AT.</span><h2 id="sources-title">Useful, with<br />the details intact.</h2><p>Clear sources. Honest limits.<br />A helpful snapshot, never the whole story.</p><span className="open-source-note"><ShieldCheck /> Open script. No hidden dashboard.</span></div>
            <div className="faq-list">
              <details open><summary>Where do the numbers come from?<ChevronDown /></summary><div className="faq-content"><p>SORA uses the public data feed behind your <a href={SOURCES.sora.site} target="_blank" rel="noreferrer">SORA dashboard <ArrowUpRight /></a>. Forward P/E uses the snapshot behind your <a href={SOURCES.spx.site} target="_blank" rel="noreferrer">valuation dashboard <ArrowUpRight /></a>. Each financial snapshot has its own source date.</p><p>Local air uses <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Open-Meteo air-quality data <ArrowUpRight /></a>, based on CAMS modeling. It shows US AQI, which is different from Singapore’s PSI.</p><p>Contains information from LTA’s <a href="https://data.gov.sg/datasets/d_b39d3a0871985372d7e1637193335da5/view" target="_blank" rel="noreferrer">MRT Station Exit (GEOJSON) <ArrowUpRight /></a>, accessed October 14, 2026, under the <a href="https://data.gov.sg/open-data-licence" target="_blank" rel="noreferrer">Singapore Open Data Licence 1.0 <ArrowUpRight /></a>.</p></div></details>
              <details><summary>What does “way home” actually show?<ChevronDown /></summary><div className="faq-content"><p>Your <a href="https://kush0511.github.io/sg-last-train-home/" target="_blank" rel="noreferrer">last-train planner <ArrowUpRight /></a> uses your current location to select the closest mapped MRT exit and estimate the last train to Lakeside. “Nearest” means straight-line distance, not a walking route. You can override the origin or home station in Scriptable.</p><p>The current timetable is dated July 29, 2026. Its displayed time is labeled “Historical estimate” and “verify.” It is not a live departure, fastest-route ETA, or a guarantee you will make the train. Check the operator and allow time to walk to the station. Apple Maps transit directions are available from setup.</p></div></details>
              <details><summary>How often does the widget refresh?<ChevronDown /></summary><div className="faq-content"><p>Scriptable can request an update, but iOS chooses when to run it. Refreshes are not guaranteed at a fixed interval. Financial sources also update on their own schedule.</p><p>The script can keep the last successful data when a request fails. Check the displayed date and any cached or stale labels. Running the script in Scriptable checks the data, reusing recent cached values when appropriate.</p></div></details>
              <details><summary>Does my home address go on this website?<ChevronDown /></summary><div className="faq-content"><p>No. You can allow Scriptable to find your nearest MRT exit on the phone, choose stations manually, and configure air quality separately. No private coordinates are embedded in this website or the downloaded script. A cached location may be used if iOS does not provide a fresh one; the widget labels its timestamp.</p><p>Your chosen air-quality coordinates are sent directly to Open-Meteo when you enable that feature. Opening a route or map can pass its destinations to the relevant mapping service. Review the script and its setup prompts before enabling location-based features.</p></div></details>
              <details><summary>Can I use a smaller widget?<ChevronDown /></summary><div className="faq-content"><p>Large shows all four cards. Medium defaults to markets; set its Parameter to <strong>local</strong> for last train and air quality, or a pair such as <strong>sora,air</strong>. Small shows one card: <strong>sora</strong>, <strong>spx</strong>, <strong>train</strong>, or <strong>air</strong>.</p><p>Set the parameter in iOS by long-pressing the installed widget and choosing Edit Widget. The preview controls above illustrate these layouts; they do not change the widget on your phone.</p></div></details><details><summary>Is this a native iPhone screenshot?<ChevronDown /></summary><div className="faq-content"><p>The preview above is an interactive web illustration with sample numbers, not a capture of an installed widget. The actual widget is rendered by Scriptable and can vary with device size, font rendering, and iOS settings.</p><p>Choose the large Home Screen widget for the full four-card layout. The source script is the installation artifact; this page itself does not become an iOS widget.</p></div></details>
            </div>
          </section>
        </main>
        <footer className="site-footer"><div className="footer-top"><a href="#" className="wordmark"><span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /></span>Pocket Desk<span className="wordmark-period">.</span></a><p>A small place for the things worth knowing.</p><a href="https://github.com/kush0511/pocket-desk" target="_blank" rel="noreferrer">View on GitHub <ExternalLink /></a></div><div className="footer-bottom"><span>Made for a more considered Home Screen.</span><span>Financial information is educational, not investment advice.</span></div></footer>
      </div>
    </>
  );
}
