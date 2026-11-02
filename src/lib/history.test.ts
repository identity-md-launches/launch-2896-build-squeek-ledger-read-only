import { afterEach, describe, expect, it, vi } from "vitest";
import { historyFor } from "./history";
import type { ActivityEntry } from "../api";

// Deliberate test responses, using the public token/transaction/account identities in the report.
const current = "0x67f25acec84c7b1a0afc3879a1ae4227178a83e5";
const previous = "0x7d8d77e614a976650f8b4f4db3fa738c12aecb0c";
const earliest = "0x340c4cdb74ea6ccf98592b9e63ee80f814673ad7";
const mergeTx = "0x0dcbc7cdd532043462c568c95f13cb614d45f8d903bb93af87d95e746c7c620e";
const transferTx = "0x4331b3b3c4027f2d1d2abe1958001f328861b368d1534ee7471f848a7b45f59b";
const source = { blockNumber: "12049580", blockTimestamp: "2026-11-02T17:17:12.000Z", transactionHash: mergeTx, logIndex: "29" };
const merge: ActivityEntry = { id: "account-merge", kind: "nft_merged", source, survivorTokenId: "8932", donorTokenId: "1165", level: 2 };
const transfer: ActivityEntry = { id: "incoming-transfer", kind: "nft_transferred", tokenId: "8932", from: previous, to: current, source: { ...source, blockNumber: "12048453", logIndex: "26" } };
const older: ActivityEntry = { ...transfer, id: "older-transfer", from: earliest, to: previous, source: { ...source, blockNumber: "12022577", transactionHash: transferTx, logIndex: "58" } };
const feedMerge = { id: "feed-merge", type: "nft.merged", occurredAt: source.blockTimestamp, source: { ...source, kind: "chain" }, payload: { account: current, survivorTokenId: "8932", donorTokenId: "1165", level: 2 } };
const available = (extra: object = {}) => ({ schemaVersion: 2, status: "available", nextCursor: null, ...extra });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "cache-control": "no-store", "content-type": "application/json" } });
const run = (holder: string | null = current, id = "8932") => historyFor(holder, id, new AbortController().signal);
afterEach(() => vi.unstubAllGlobals());

describe("token history recovery", () => {
  it("recovers a burned donor through a later feed page and its last account", async () => {
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = new URL(url); paths.push(u.pathname + u.search);
      if (u.pathname === "/v1/events") return response(available(u.searchParams.has("cursor") ? { events: [feedMerge] } : { events: [], nextCursor: "opaque-feed-page" }));
      return response(available({ activity: [merge] }));
    }));
    const result = await run(null, "1165");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].source.transactionHash).toBe(mergeTx);
    expect(result.complete).toBe(true);
    expect(paths).toContain("/v1/events?category=players&limit=100&cursor=opaque-feed-page");
    expect(paths).toContain(`/v1/accounts/${current}/activity?limit=100`);
  });

  it("walks previous owners, follows account cursors, deduplicates logs and sorts newest first", async () => {
    const owners: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname === "/v1/events") return response(available({ events: [feedMerge] }));
      const account = u.pathname.split("/")[3]; owners.push(account);
      if (account === current) return response(available(u.searchParams.has("cursor") ? { activity: [transfer] } : { activity: [merge], nextCursor: "opaque-account-page" }));
      if (account === previous) return response(available({ activity: [older, transfer] }));
      return response(available({ activity: [older] }));
    }));
    const result = await run();
    expect(result.entries.map((e) => e.id)).toEqual(["account-merge", "incoming-transfer", "older-transfer"]);
    expect(owners).toEqual([current, current, previous, earliest]);
    expect(result.entries.some((e) => e.source.transactionHash === transferTx)).toBe(true);
  });

  it("keeps separate logs in the same transaction and terminates ownership cycles", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (new URL(url).pathname === "/v1/events") return response(available({ events: [] }));
      return response(available({ activity: [merge, { ...merge, id: "other-log", source: { ...source, logIndex: "30" } }, { ...transfer, from: current }] }));
    }));
    const result = await run();
    expect(result.entries).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not truncate at ten account pages, including empty pages with a nextCursor", async () => {
    let page = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (new URL(url).pathname === "/v1/events") return response(available({ events: [] }));
      page += 1;
      return response(available(page === 11 ? { activity: [merge] } : { activity: [], nextCursor: `page-${page}` }));
    }));
    expect((await run()).entries).toHaveLength(1);
    expect(page).toBe(11);
  });

  it("preserves unavailable as unknown, with any known rows marked incomplete", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(new URL(url).pathname === "/v1/events"
      ? available({ events: [feedMerge] })
      : { schemaVersion: 2, status: "unavailable", reason: "indexer_unavailable" })));
    const result = await run();
    expect(result.complete).toBe(false);
    expect(result.status?.reason).toBe("indexer_unavailable");
    expect(result.entries).toHaveLength(1);
  });

  it("distinguishes a fully available empty search from an unavailable empty search", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(available({ events: [], activity: [] }))));
    expect(await run(null)).toMatchObject({ entries: [], complete: true, status: null });
    vi.stubGlobal("fetch", vi.fn(async () => response({ schemaVersion: 2, status: "unavailable", reason: "indexer_disabled" })));
    expect(await run(null)).toMatchObject({ entries: [], complete: false, status: { status: "unavailable" } });
  });

  it("restarts once from page one when a cursor is invalidated", async () => {
    let invalidated = false, feedReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname === "/v1/events") { feedReads += 1; return response(available({ events: [] })); }
      if (!u.searchParams.has("cursor")) return response(available({ activity: [], nextCursor: "next" }));
      if (!invalidated) { invalidated = true; return response({ error: "cursor_invalidated" }, 409); }
      return response(available({ activity: [merge] }));
    }));
    expect((await run()).entries).toHaveLength(1);
    expect(feedReads).toBe(2);
  });
});
