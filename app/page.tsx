import { readFile } from "node:fs/promises";
import path from "node:path";
import { ArrowUpRight, Download, ExternalLink, Smartphone } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { LivePreviews } from "@/components/live-previews";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SOURCES } from "@/lib/data";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const SCRIPTS = [
  {
    file: "sora-rates-widget.js",
    title: "SORA Rates",
    source: SOURCES.sora,
    param: (
      <>
        <code>sora</code> (default), <code>1m</code> or <code>3m</code> — picks which rate is shown large.
      </>
    ),
  },
  {
    file: "spx-valuation-widget.js",
    title: "S&P 500 Valuation Bands",
    source: SOURCES.spx,
    param: (
      <>
        A multiple like <code>18</code>, <code>20</code> (default) or <code>22</code> — the band the index is
        compared against.
      </>
    ),
  },
];

const STEPS = [
  {
    title: "Install Scriptable",
    body: "Free on the App Store. It runs small JavaScript files as native iOS widgets — no Mac, no developer account.",
  },
  {
    title: "Add the script",
    body: "Open this page on your iPhone, tap Copy script, then in Scriptable tap + and paste. Name it SORA Rates or SPX Bands. Tap ▶ once to preview it.",
  },
  {
    title: "Place the widget",
    body: "Long-press the Home Screen → Edit → Add Widget → Scriptable. Pick small or medium, then long-press it → Edit Widget → choose your script.",
  },
  {
    title: "Optional: Lock Screen",
    body: "Long-press the Lock Screen → Customize → Lock Screen → tap the widget row → Scriptable. The same script adapts to the rectangular, inline and circular slots.",
  },
];

const ALTERNATIVES = [
  {
    name: "Scriptable",
    tag: "Recommended",
    what: "Native widgets from a JavaScript file. What this page ships.",
    pros: "Free, all sizes plus Lock Screen, custom charts, caches data offline, taps open your site.",
    cons: "iOS decides the refresh cadence (usually every 15–60 minutes).",
    href: "https://scriptable.app",
  },
  {
    name: "Your own WidgetKit app",
    tag: "Most polished",
    what: "A small open-source SwiftUI app with a widget extension, built in Xcode.",
    pros: "Swift Charts, interactive widgets, StandBy and Apple Watch complications.",
    cons: "Needs a Mac. A free Apple ID install expires after 7 days; keeping it costs $99 a year.",
    href: "https://developer.apple.com/documentation/widgetkit",
  },
  {
    name: "Widgy",
    tag: "Visual designer",
    what: "A drag-and-drop widget builder that can pull values from a JSON URL.",
    pros: "No code, lots of styling control.",
    cons: "No real charts from your time series, and the JSON-source feature is a paid unlock.",
    href: "https://apps.apple.com/app/widgy-widgets-home-lock-watch/id1524540481",
  },
  {
    name: "Add to Home Screen",
    tag: "Zero setup",
    what: "Safari → Share → Add to Home Screen on each GitHub Pages site.",
    pros: "Opens your full dashboard in one tap, full-screen.",
    cons: "It's an app icon, not a widget — you still have to open it to see numbers.",
    href: SOURCES.sora.site,
  },
  {
    name: "Shortcuts + Siri",
    tag: "Voice",
    what: "Run a Scriptable script from a Shortcut: “Hey Siri, SORA rates”.",
    pros: "Hands-free. You can add the Shortcut as a widget button too.",
    cons: "Shows the result as a card, not a glanceable tile.",
    href: "https://support.apple.com/guide/shortcuts/welcome/ios",
  },
];

export default async function Home() {
  const scripts = await Promise.all(
    SCRIPTS.map(async (s) => ({
      ...s,
      code: await readFile(path.join(process.cwd(), "public", "scriptable", s.file), "utf8"),
    })),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-14 pb-20 sm:px-8">
      <header className="max-w-2xl">
        <Badge variant="outline" className="border-white/15 text-white/70">
          <Smartphone /> iPhone widgets for your GitHub Pages dashboards
        </Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          SORA and S&P 500 valuation, on your Home Screen.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          Two native iPhone widgets that read the same public data as{" "}
          <a className="text-white underline-offset-4 hover:underline" href={SOURCES.sora.site} target="_blank" rel="noreferrer">
            sora-rates
          </a>{" "}
          and{" "}
          <a className="text-white underline-offset-4 hover:underline" href={SOURCES.spx.site} target="_blank" rel="noreferrer">
            spy-valuation-bands
          </a>
          . No server and no API keys. Tap a widget to open the full dashboard.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#install" className={buttonVariants({ size: "lg" })}>
            Set up the widgets
          </a>
          <a href="#options" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-white/15")}>
            Compare other options
          </a>
        </div>
      </header>

      <section className="mt-16" aria-labelledby="preview-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="preview-title" className="text-xl font-semibold text-white">
              Live preview
            </h2>
            <p className="mt-1 text-sm text-white/50">Rendered from today&apos;s data, at real iPhone widget sizes.</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(80%_120%_at_20%_0%,#2a2350_0%,#12131c_60%)] p-5 sm:p-8">
          <LivePreviews />
        </div>
      </section>

      <section id="install" className="mt-20 scroll-mt-8" aria-labelledby="install-title">
        <h2 id="install-title" className="text-xl font-semibold text-white">
          Set up in a few minutes
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                {i + 1}
              </span>
              <h3 className="mt-4 font-medium text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {scripts.map((s) => (
            <Card key={s.file} className="bg-white/[0.03] ring-white/10">
              <CardHeader>
                <CardTitle className="text-white">{s.title}</CardTitle>
                <CardDescription>
                  Widget parameter: {s.param}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={s.code} />
                  <a
                    href={`${BASE}/scriptable/${s.file}`}
                    download
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "border-white/15")}
                  >
                    <Download /> Download .js
                  </a>
                  <a
                    href={s.source.site}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ size: "sm", variant: "ghost" })}
                  >
                    Dashboard <ArrowUpRight />
                  </a>
                </div>
                <Accordion>
                  <AccordionItem value="code" className="border-white/10">
                    <AccordionTrigger className="text-sm text-white/70">View source</AccordionTrigger>
                    <AccordionContent>
                      <pre className="max-h-80 overflow-auto rounded-xl bg-black/50 p-4 text-[11px] leading-relaxed text-white/75">
                        <code>{s.code}</code>
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="options" className="mt-20 scroll-mt-8" aria-labelledby="options-title">
        <h2 id="options-title" className="text-xl font-semibold text-white">
          Other ways to get this on your iPhone
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-white/50">
          GitHub Pages only serves static files, so anything that shows live numbers has to fetch the data itself.
          These are the realistic options, from easiest to most work.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALTERNATIVES.map((alt) => (
            <a
              key={alt.name}
              href={alt.href}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-white">{alt.name}</h3>
                <Badge variant={alt.tag === "Recommended" ? "default" : "secondary"}>{alt.tag}</Badge>
              </div>
              <p className="mt-2 text-sm text-white/60">{alt.what}</p>
              <p className="mt-3 text-sm text-white/55">
                <span className="text-[#78b5aa]">Good:</span> {alt.pros}
              </p>
              <p className="mt-1 text-sm text-white/55">
                <span className="text-[#e08a8a]">Trade-off:</span> {alt.cons}
              </p>
              <span className="mt-auto flex items-center gap-1 pt-4 text-xs text-white/40 group-hover:text-white/70">
                Learn more <ExternalLink className="size-3" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <footer className="mt-20 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/40">
        SORA data from the public sheet behind{" "}
        <a className="underline-offset-4 hover:underline" href={SOURCES.sora.repo}>kush0511/sora-rates</a> (sourced from HousingLoanSG / MAS).
        Valuation data from the daily snapshot in{" "}
        <a className="underline-offset-4 hover:underline" href={SOURCES.spx.repo}>kush0511/spy-valuation-bands</a> (StreetStats).
        Bands are earnings scenarios, not price targets. Educational use only.
      </footer>
    </main>
  );
}
