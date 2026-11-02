import { apiGet, getAllAccountPages, type AccountResponse, type EconomyResponse, type SettlementsResponse, type SqueekResponse } from "./api";

/** Short-lived in-memory memo so moving between pages does not refetch everything. */
const memo = new Map<string, { at: number; p: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p as Promise<T>;
  const p = load();
  memo.set(key, { at: Date.now(), p });
  p.catch(() => memo.delete(key));
  return p;
}

// Accounts are never cached by the API (no-store); keep a 15 s memo only for page switches.
export const getAccount = (addr: string) => cached(`acct:${addr}`, 15_000, () => getAllAccountPages(addr)) as Promise<AccountResponse>;
export const getEconomy = () => cached("economy", 5_000, () => apiGet<EconomyResponse>("/v1/economy/state"));
export const getSettlements7d = () => cached("settle7d", 60_000, () => apiGet<SettlementsResponse>("/v1/settlements?range=7d"));
export const getSqueek = (id: string) => cached(`sq:${id}`, 5_000, () => apiGet<SqueekResponse>(`/v1/squeeks/${id}`));

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
