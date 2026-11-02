import { useCallback, useEffect, useRef, useState } from "react";

export interface Route {
  path: string[];
  query: URLSearchParams;
}
function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [p, q = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean), query: new URLSearchParams(q) };
}
export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export type Async<T> = { state: "loading" } | { state: "error"; error: Error } | { state: "done"; data: T };

/** Runs `fn` when deps change; aborts the previous run. */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): [Async<T>, () => void] {
  const [result, setResult] = useState<Async<T>>({ state: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setResult({ state: "loading" });
    fn(ctl.signal).then(
      (data) => !ctl.signal.aborted && setResult({ state: "done", data }),
      (error: Error) => !ctl.signal.aborted && error.name !== "AbortError" && setResult({ state: "error", error }),
    );
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return [result, retry];
}

/**
 * Polls `fn` every `ms` while the tab is visible. Keeps the last good data when a poll fails,
 * so a passing error does not blank the panel.
 */
export function usePoll<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let timer: number | undefined;
    let ctl: AbortController | null = null;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        ctl = new AbortController();
        try {
          const d = await fnRef.current(ctl.signal);
          if (stopped) return;
          setData(d);
          setError(null);
          setUpdatedAt(Date.now());
        } catch (e) {
          if (!stopped && (e as Error).name !== "AbortError") setError(e as Error);
        }
      }
      if (!stopped) timer = window.setTimeout(tick, ms);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        tick();
      }
    };
    tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      ctl?.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms]);
  return { data, error, updatedAt };
}

const ADDR_KEY = "squeek-ledger:address";
export const rememberAddress = (a: string) => {
  try {
    localStorage.setItem(ADDR_KEY, a);
  } catch {
    /* storage may be blocked */
  }
};
export const lastAddress = (): string => {
  try {
    return localStorage.getItem(ADDR_KEY) ?? "";
  } catch {
    return "";
  }
};
const planKey = (a: string) => `squeek-ledger:plan:${a.toLowerCase()}`;
export function loadPlan(address: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(planKey(address)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function savePlan(address: string, ids: string[]) {
  try {
    localStorage.setItem(planKey(address), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
