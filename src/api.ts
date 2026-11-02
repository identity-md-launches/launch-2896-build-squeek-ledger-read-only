import { NET } from "./config";

/** Thrown for HTTP errors, unparseable bodies and network failures. `code` is the API's error code when it sent one. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface CacheEntry {
  etag: string;
  body: unknown;
}
const etagCache = new Map<string, CacheEntry>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a public endpoint. Sends the last ETag back as If-None-Match (a 304 reuses the cached body),
 * waits out 429/503 Retry-After a bounded number of times, and turns API error bodies into ApiError.
 * See https://docs.squeekchain.com/developers/api/#caching and #errors.
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${NET.apiBase}${path}`;
  for (let attempt = 0; ; attempt += 1) {
    const cached = etagCache.get(url);
    const headers: Record<string, string> = { accept: "application/json" };
    if (cached) headers["if-none-match"] = cached.etag;
    let res: Response;
    try {
      res = await fetch(url, { headers, signal, cache: "no-cache" });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new ApiError(0, "network", "Could not reach api.squeekchain.com. Check your connection and try again.");
    }
    if (res.status === 304 && cached) return cached.body as T;
    if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < 3) {
      const wait = Number(res.headers.get("retry-after") ?? "2");
      await sleep(Math.min(Number.isFinite(wait) ? wait : 2, 10) * 1000 * (attempt + 1));
      continue;
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ApiError(res.status, "unparseable", `The API sent a response that is not JSON (HTTP ${res.status}).`);
    }
    if (!res.ok) {
      const code = (body as { error?: string })?.error ?? "http_error";
      throw new ApiError(res.status, code, describeError(res.status, code));
    }
    const etag = res.headers.get("etag");
    if (etag) etagCache.set(url, { etag, body });
    return body as T;
  }
}

export function describeError(status: number, code: string): string {
  switch (code) {
    case "invalid_address":
      return "That is not a valid address. Use 0x followed by 40 hex digits (not the zero address).";
    case "invalid_token_id":
      return "Squeek ids run from 1 to 9999.";
    case "token_not_found":
      return "No Squeek with this id has been issued yet.";
    case "cursor_invalidated":
      return "The chain moved while paging. Reload to start again from the first page.";
    case "invalid_cursor":
      return "The page cursor expired. Reload to start again.";
    case "rate_limited":
      return "The API is rate limiting this browser. Wait a few seconds and try again.";
    case "database_busy":
    case "indexer_busy":
    case "database_unavailable":
      return "The Squeekchain API is busy right now. Try again in a minute.";
    case "request_timeout":
      return "The API took too long to answer. Try again.";
    default:
      return `The API answered with an error (HTTP ${status}, ${code}).`;
  }
}

/** Unavailable responses are a valid answer meaning "unknown", never zero. */
export function unavailableText(reason: string | undefined): string {
  const map: Record<string, string> = {
    indexer_disabled: "the indexer is switched off",
    not_yet_safe: "the indexer has not reached 12 confirmations yet",
    indexer_unavailable: "the indexer is unavailable",
    indexer_mismatch: "the indexer reports a different deployment",
    unsupported_contract_version: "the contracts run a version the API does not support",
    projection_rebuilding: "the API is rebuilding its data",
  };
  return `Unknown for now: ${map[reason ?? ""] ?? reason ?? "no reason given"}.`;
}

// ---- Response types (only the fields this site reads) ----
export interface Identities {
  core?: string;
  token?: string;
  genesis?: string;
  mining?: { proxy?: string } | null;
}
export interface Envelope {
  schemaVersion: number;
  status?: "available" | "unavailable";
  reason?: string;
  generatedAt?: string;
  chain?: { chainId: string; safeThroughBlock: string; safeBlockTimestamp?: string };
  release?: { id: string };
  identities?: Identities;
}
export interface Frontier {
  blockHeight: string;
  blockProgress: string;
  cumulativeBlockUnits: string;
  workPerThousandBlocks: string;
  completedBlockCount?: string;
}
export interface StatusResponse extends Envelope {
  measurement: { freshness: string; coreStatus: string; receivedAt: string } | null;
  builder: { status: string; reason?: string; anchor?: Frontier & { settledThroughRound: string }; projected?: Frontier };
  settlementQueue: {
    status: string;
    reason?: string;
    state?: string;
    buffered?: { roundCount: string; activeRoundCount: string; workUnits: string; firstRound: string | null; lastRound: string | null };
  };
}
export interface CoreResponse extends Envelope {
  core?: Frontier & { settledThroughRound: string; cumulativeWork: string; paused: boolean };
  configuration?: { roundDuration: string; blockUnitsPerBlock: string };
}
export interface EconomyResponse extends Envelope {
  lifecycle?: { stage: string; currentRound: string; paused: boolean };
  supply?: { capBaseUnits: string; miningMintedBaseUnits: string; totalMintedBaseUnits: string; liveSupplyBaseUnits: string };
  schedule?: {
    allowanceBaseUnits: string;
    launchBonusBaseUnits: string;
    bonusBlocks: string;
    halvingBlocks: string;
    firstPeriodRateBaseUnits: string;
    startHeight: string | null;
    closedThroughBlock: string;
    issuedBaseUnits: string;
  };
  mining?: { processedThroughRound: string; fundedBlocks: string; gachaFundedBaseUnits?: string; stakingFundedBaseUnits?: string };
  staking?: { totalNftPower: string; totalSqkPower: string; paused: boolean } | null;
  nft?: { mergesOpen: boolean; maximumLevel: number; basePower: string[]; cooldownBlocks: string[]; live: string };
}
export interface SettlementsResponse extends Envelope {
  range: string;
  window: { startAt: string; endAt: string; bucketSeconds: number } | null;
  summary?: { settlementCount: string; completedBlockCount: string; activeRoundCount: string };
  mining?: { status: string; rangeMintedBaseUnits?: string; miningMintedBaseUnits?: string };
}
export interface AccountToken {
  tokenId: string;
  custody: "staking" | "wallet";
  level: number;
  basePower: string;
  nextMergeHeight: string;
  mergeState: "ready" | "cooldown" | "terminal" | "merges_closed";
  metadataStatus: string;
}
export interface AccountResponse extends Envelope {
  account?: string;
  economy?: { coreBlockHeight: string; mergesOpen: boolean; maximumLevel: number; currentRound: string };
  rewards?: { claimableBaseUnits: string; lifetimePaidBaseUnits: string; lifetimeCompoundedBaseUnits: string };
  power?: { nftPower: string; sqkPower: string };
  stake?: { principalBaseUnits: string };
  earnings?: { date: string; earnedBaseUnits: string }[];
  tokenCounts?: { staking: string; wallet: string };
  tokens?: AccountToken[];
  nextCursor?: string | null;
}
export interface SqueekResponse extends Envelope {
  tokenId?: string;
  custody?: { owner: string | null; depositor: string | null; stray: boolean; burned: boolean };
  level?: number;
  basePower?: string;
  nextMergeHeight?: string;
  mergeState?: string | null;
  economy?: { coreBlockHeight: string; maximumLevel: number; mergesOpen: boolean };
  metadata?: {
    status?: string;
    name?: string;
    description?: string;
    imageDataUri?: string;
    cardImageUrl?: string;
    attributes?: { traitType: string; value: string }[];
  } | null;
}
export interface ActivityEntry {
  id: string;
  kind: string;
  source: { blockNumber: string; blockTimestamp: string; transactionHash: string };
  account?: string;
  tokenId?: string;
  survivorTokenId?: string;
  donorTokenId?: string;
  level?: string | number;
  from?: string;
  to?: string;
  basePower?: string;
  nftPowerDelta?: string;
  nextMergeHeight?: string;
}
export interface ActivityResponse extends Envelope {
  activity?: ActivityEntry[];
  nextCursor?: string | null;
  total?: string;
}

/** Follows nextCursor until the last page. Restarts once from page one on 409 cursor_invalidated. */
export async function getAllAccountPages(address: string, signal?: AbortSignal): Promise<AccountResponse> {
  for (let restart = 0; ; restart += 1) {
    try {
      let cursor: string | null = null;
      let first: AccountResponse | null = null;
      const tokens: AccountToken[] = [];
      for (let page = 0; page < 120; page += 1) {
        const q = new URLSearchParams({ limit: "100" });
        if (cursor) q.set("cursor", cursor);
        const res: AccountResponse = await apiGet<AccountResponse>(`/v1/accounts/${address}?${q}`, signal);
        if (res.status !== "available") return res;
        first ??= res;
        tokens.push(...(res.tokens ?? []));
        cursor = res.nextCursor ?? null;
        if (!cursor) break;
      }
      return { ...(first as AccountResponse), tokens, nextCursor: null };
    } catch (e) {
      if (e instanceof ApiError && e.code === "cursor_invalidated" && restart < 1) continue;
      throw e;
    }
  }
}

export const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
export const ZERO = "0x0000000000000000000000000000000000000000";
