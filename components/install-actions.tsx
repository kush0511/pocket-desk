"use client";

import { Check, Copy, Download } from "lucide-react";
import { useRef, useState, useEffect } from "react";

export function InstallActions({ code, downloadUrl }: { code: string; downloadUrl: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  async function copyScript() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
      resetTimer.current = setTimeout(() => setState("idle"), 3500);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="install-actions-wrap">
      <div className="install-actions">
        <button className="button button-primary" onClick={copyScript}>{state === "copied" ? <Check /> : <Copy />}{state === "copied" ? "Script copied" : "Copy widget script"}</button>
        <a className="button button-secondary" href={downloadUrl} download="pocket-desk.js"><Download />Download .js</a>
      </div>
      <p className={state === "error" ? "copy-status copy-error" : "copy-status"} role="status">{state === "copied" ? "Ready to paste into a new script in Scriptable." : state === "error" ? "Clipboard access was blocked. Download the file, or copy it from View source below." : "One script. All four cards. No account to create."}</p>
    </div>
  );
}
