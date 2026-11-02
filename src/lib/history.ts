import { apiGet, ApiError, isAddress, ZERO, type ActivityEntry, type ActivityResponse, type Envelope, type EventsResponse } from "../api";

export interface TokenHistory {
  entries: ActivityEntry[];
  status: Envelope | null;
  complete: boolean;
}

const touches = (e: Pick<ActivityEntry, "tokenId" | "survivorTokenId" | "donorTokenId">, id: string) =>
  e.tokenId === id || e.survivorTokenId === id || e.donorTokenId === id;

/** The public feed and account activity give the same log different IDs. Deduplicate by source. */
function eventKey(e: ActivityEntry) {
  const log = e.source.logIndex ?? [e.kind, e.tokenId, e.survivorTokenId, e.donorTokenId].join(":");
  return `${e.source.blockNumber}:${e.source.transactionHash.toLowerCase()}:${log}`;
}

function newestFirst(a: ActivityEntry, b: ActivityEntry) {
  for (const field of ["blockNumber", "transactionIndex", "logIndex"] as const) {
    const av = BigInt(a.source[field] ?? "0"), bv = BigInt(b.source[field] ?? "0");
    if (av !== bv) return av > bv ? -1 : 1;
  }
  return b.source.blockTimestamp.localeCompare(a.source.blockTimestamp);
}

async function collectHistory(holder: string | null, id: string, signal: AbortSignal): Promise<TokenHistory> {
  const entries = new Map<string, ActivityEntry>();
  const accounts: string[] = [];
  const seenAccounts = new Set<string>();
  let status: Envelope | null = null;
  const enqueue = (address?: string | null) => {
    if (!address || !isAddress(address) || address.toLowerCase() === ZERO) return;
    const normalized = address.toLowerCase();
    if (!seenAccounts.has(normalized)) {
      seenAccounts.add(normalized);
      accounts.push(normalized);
    }
  };
  const add = (e: ActivityEntry) => {
    if (!touches(e, id)) return;
    entries.set(eventKey(e), e);
    enqueue(e.account);
    // Walk back through earlier holders, including the sender of an incoming transfer.
    if (e.kind === "nft_transferred") enqueue(e.from);
  };
  enqueue(holder);

  // A burned donor has no ownerOf/depositor. Find its last account in the player feed.
  // With a known holder, one feed page supplements the account search; the ownership
  // traversal below supplies older records without scanning unrelated global activity.
  let cursor: string | null = null;
  const feedCursors = new Set<string>();
  do {
    const q = new URLSearchParams({ category: "players", limit: "100" });
    if (cursor) q.set("cursor", cursor);
    const r = await apiGet<EventsResponse>(`/v1/events?${q}`, signal);
    if (r.status !== "available") {
      status = r;
      break;
    }
    for (const e of r.events ?? []) {
      if (e.source.kind !== "chain" || !e.type.startsWith("nft.") || !touches(e.payload, id)) continue;
      add({ ...e.payload, id: e.id, kind: e.type.replace(".", "_"), source: { ...e.source, blockTimestamp: e.occurredAt } });
    }
    cursor = r.nextCursor ?? null;
    if (cursor && feedCursors.has(cursor)) throw new ApiError(400, "invalid_cursor", "The event feed repeated a page. Try again to restart the history search.");
    if (cursor) feedCursors.add(cursor);
  } while (cursor && accounts.length === 0);

  for (let index = 0; index < accounts.length; index += 1) {
    cursor = null;
    const activityCursors = new Set<string>();
    do {
      const q = new URLSearchParams({ limit: "100" });
      if (cursor) q.set("cursor", cursor);
      const r = await apiGet<ActivityResponse>(`/v1/accounts/${accounts[index]}/activity?${q}`, signal);
      if (r.status !== "available") {
        status ??= r;
        break;
      }
      for (const e of r.activity ?? []) add(e);
      cursor = r.nextCursor ?? null;
      if (cursor && activityCursors.has(cursor)) throw new ApiError(400, "invalid_cursor", "The account history repeated a page. Try again to restart the history search.");
      if (cursor) activityCursors.add(cursor);
    } while (cursor);
  }

  return { entries: [...entries.values()].sort(newestFirst), status, complete: status === null };
}

/** Follow every account cursor and earlier owner; restart once if a reorg invalidates a cursor. */
export async function historyFor(holder: string | null, id: string, signal: AbortSignal): Promise<TokenHistory> {
  for (let restart = 0; ; restart += 1) {
    try {
      return await collectHistory(holder, id, signal);
    } catch (e) {
      if (e instanceof ApiError && ["cursor_invalidated", "invalid_cursor"].includes(e.code) && restart < 1) continue;
      throw e;
    }
  }
}
