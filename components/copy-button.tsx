"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy script" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  }

  return (
    <Button onClick={copy} size="sm">
      {state === "done" ? <Check /> : <Copy />}
      {state === "done" ? "Copied" : state === "failed" ? "Copy blocked — use Download" : label}
    </Button>
  );
}
