import { apiGet, getAllAccountPages, type EconomyResponse, type SettlementsResponse, type SqueekResponse } from "./api";

/** Share simultaneous requests only. Settled responses follow HTTP/ETag policy in apiGet. */
const pending = new Map<string, Promise<unknown>>();
function inFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = pending.get(key);
  if (hit) return hit as Promise<T>;
  const p = load();
  pending.set(key, p);
  const clear = () => pending.delete(key);
  p.then(clear, clear);
  return p;
}

export const getAccount = (addr: string) => inFlight(`acct:${addr}`, () => getAllAccountPages(addr));
export const getEconomy = () => inFlight("economy", () => apiGet<EconomyResponse>("/v1/economy/state"));
export const getSettlements7d = () => inFlight("settle7d", () => apiGet<SettlementsResponse>("/v1/settlements?range=7d"));
export const getSqueek = (id: string) => inFlight(`sq:${id}`, () => apiGet<SqueekResponse>(`/v1/squeeks/${id}`));

/** Limits concurrent Squeek metadata requests (the metadata class allows 20/s; 4 at a time stays well inside it). */
let active = 0;
const queue: (() => void)[] = [];
export async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((r) => queue.push(r));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}
