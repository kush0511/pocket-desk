"use client";

import { useCallback, useEffect, useState } from "react";

type State<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

export function useRemote<T>(url: string, parse: (res: Response) => Promise<T>) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parse(res);
      })
      .then((data) => setState({ status: "ready", data }))
      .catch((err: Error) => {
        if (!controller.signal.aborted) setState({ status: "error", error: err.message });
      });
    return () => controller.abort();
  }, [url, parse, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
