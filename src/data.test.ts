import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "./api";
import { getAccount } from "./data";

const address = "0x67f25acec84c7b1a0afc3879a1ae4227178a83e5";
afterEach(() => vi.unstubAllGlobals());

describe("API cache policy", () => {
  it("shares an in-flight account request, then reads no-store again immediately", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ schemaVersion: 2, status: "available", tokens: [], rewards: { claimableBaseUnits: String(calls) } }), { headers: { "cache-control": "no-store" } });
    }));
    const a = getAccount(address), b = getAccount(address);
    expect(a).toBe(b);
    expect((await a).rewards?.claimableBaseUnits).toBe("1");
    expect((await getAccount(address)).rewards?.claimableBaseUnits).toBe("2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("revalidates permitted ETags, then discards a no-store response even with an ETag", async () => {
    const seen: (string | null)[] = [];
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(new Headers(init.headers).get("if-none-match")); calls += 1;
      if (calls === 1) return new Response(JSON.stringify({ status: "available", value: 1 }), { headers: { etag: '"safe-v1"', "cache-control": "public, max-age=0, s-maxage=5" } });
      if (calls === 2) return new Response(null, { status: 304 });
      return new Response(JSON.stringify({ status: "available", value: calls }), { headers: { etag: '"private-v2"', "cache-control": "private, no-store" } });
    }));
    const path = "/v1/core?cache-policy-test";
    expect(await apiGet(path)).toEqual({ status: "available", value: 1 });
    expect(await apiGet(path)).toEqual({ status: "available", value: 1 });
    await apiGet(path); await apiGet(path);
    expect(seen).toEqual([null, '"safe-v1"', '"safe-v1"', null]);
  });

  it("discards unavailable responses even when a server supplies an ETag", async () => {
    const seen: (string | null)[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(new Headers(init.headers).get("if-none-match"));
      return new Response(JSON.stringify({ status: "unavailable", reason: "indexer_unavailable" }), { headers: { etag: '"unknown"' } });
    }));
    await apiGet("/v1/squeeks/1165?unavailable-cache-test");
    await apiGet("/v1/squeeks/1165?unavailable-cache-test");
    expect(seen).toEqual([null, null]);
  });
});
