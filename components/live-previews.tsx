"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { SoraLock, SoraMedium, SoraSmall } from "@/components/sora-widgets";
import { SpxLock, SpxMedium, SpxSmall } from "@/components/spx-widgets";
import { Button } from "@/components/ui/button";
import { WidgetSkeleton } from "@/components/widget-frame";
import { useRemote } from "@/hooks/use-remote";
import { SOURCES, parseSoraCsv, parseSpxJson, summarizeSora, summarizeSpx } from "@/lib/data";

const loadSora = async (res: Response) => {
  const rows = parseSoraCsv(await res.text());
  if (!rows.length) throw new Error("The SORA sheet returned no rows");
  return summarizeSora(rows);
};

const loadSpx = async (res: Response) => {
  const rows = parseSpxJson(await res.json());
  if (!rows.length) throw new Error("The valuation snapshot returned no rows");
  return summarizeSpx(rows);
};

function ErrorTile({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[170px] w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/15 p-6 text-center">
      <AlertTriangle className="size-5 text-amber-400" />
      <div>
        <p className="text-sm font-medium text-white">Couldn&apos;t load {title}</p>
        <p className="mt-1 text-xs text-white/50">{message}. The widget on your phone keeps its last good copy when this happens.</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}

function Row({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/50">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-start gap-5">{children}</div>
    </div>
  );
}

export function LivePreviews() {
  const sora = useRemote(SOURCES.sora.data, loadSora);
  const spx = useRemote(SOURCES.spx.data, loadSpx);

  return (
    <div className="space-y-10">
      <Row title="SORA Rates" subtitle="Overnight SORA with 1M and 3M compounded, straight from the sheet behind your SORA page.">
        {sora.state.status === "loading" && (
          <>
            <WidgetSkeleton size="small" />
            <WidgetSkeleton size="medium" />
            <WidgetSkeleton size="lock" />
          </>
        )}
        {sora.state.status === "error" && (
          <ErrorTile title="SORA rates" message={sora.state.error} onRetry={sora.retry} />
        )}
        {sora.state.status === "ready" && (
          <>
            <SoraSmall s={sora.state.data} />
            <SoraMedium s={sora.state.data} />
            <SoraLock s={sora.state.data} />
          </>
        )}
      </Row>

      <Row title="S&P 500 Valuation Bands" subtitle="Forward P/E, where the index sits in the 16×–26× bands, and a 1-year chart against them.">
        {spx.state.status === "loading" && (
          <>
            <WidgetSkeleton size="small" />
            <WidgetSkeleton size="medium" />
            <WidgetSkeleton size="lock" />
          </>
        )}
        {spx.state.status === "error" && (
          <ErrorTile title="valuation bands" message={spx.state.error} onRetry={spx.retry} />
        )}
        {spx.state.status === "ready" && (
          <>
            <SpxSmall s={spx.state.data} />
            <SpxMedium s={spx.state.data} />
            <SpxLock s={spx.state.data} />
          </>
        )}
      </Row>
    </div>
  );
}
