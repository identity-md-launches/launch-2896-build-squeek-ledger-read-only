import { describe, expect, it } from "vitest";
import { simulateMerge, type LevelTable } from "./merge";
import { estimate, blocksPerDayMilli, observedPerBlock } from "./estimate";
import { fixed, pct } from "./format";

// Level table as served by /v1/economy/state on 2026-11-02.
const table: LevelTable = {
  basePower: ["1000", "2200", "4840", "10648", "23426", "51536", "113380", "249436", "548759", "1207269"].map(BigInt),
  cooldownBlocks: ["0", "3000", "7000", "14000", "21000", "28000", "35000", "42000", "49000", "0"].map(BigInt),
  maximumLevel: 10,
};
const l1 = (id: string, h = 0n) => ({ tokenId: id, level: 1, nextMergeHeight: h });

describe("simulateMerge", () => {
  it("merges two level-1 Squeeks into one level-2", () => {
    const r = simulateMerge([l1("7"), l1("3")], table, 6808n);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]).toMatchObject({ survivor: "3", donor: "7", toLevel: 2, earliestHeight: 6808n, nextMergeHeight: 9808n });
    expect(r.powerBefore).toBe(2000n);
    expect(r.powerAfter).toBe(2200n);
  });
  it("builds a pyramid from four level-1 Squeeks and waits for the level-2 cooldown", () => {
    const r = simulateMerge([l1("1"), l1("2"), l1("3"), l1("4")], table, 100n);
    expect(r.steps.map((s) => s.toLevel)).toEqual([2, 2, 3]);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].level).toBe(3);
    expect(r.powerAfter).toBe(4840n);
    expect(r.steps[2].earliestHeight).toBe(3100n);
  });
  it("leaves an odd Squeek and different levels unmerged", () => {
    const r = simulateMerge([l1("1"), l1("2"), l1("3"), { tokenId: "9", level: 5, nextMergeHeight: 0n }], table, 0n);
    expect(r.results.map((t) => t.level).sort()).toEqual([1, 2, 5]);
    expect(r.unmerged.map((t) => t.tokenId).sort()).toEqual(["3", "9"]);
  });
  it("never merges the maximum level", () => {
    const r = simulateMerge([{ tokenId: "1", level: 10, nextMergeHeight: 0n }, { tokenId: "2", level: 10, nextMergeHeight: 0n }], table, 0n);
    expect(r.steps).toHaveLength(0);
  });
  it("respects an input still in cooldown", () => {
    const r = simulateMerge([l1("1", 9000n), l1("2")], table, 6808n);
    expect(r.steps[0].earliestHeight).toBe(9000n);
  });
});

describe("estimate", () => {
  it("shares the block reward by power", () => {
    const e18 = 10n ** 18n;
    const r = estimate({ accountPower: 1000n * e18, totalPower: 50000n * e18, sqkPerBlock: 5600n * e18, blocksPerDayMilli: 1000_000n });
    expect(r.perBlock).toBe(112n * e18); // 2% of 5,600
    expect(r.perDay).toBe(112n * 1000n * e18);
  });
  it("returns zero for no power", () => {
    expect(estimate({ accountPower: 0n, totalPower: 10n, sqkPerBlock: 1n, blocksPerDayMilli: 1n }).perDay).toBe(0n);
  });
  it("derives rates from the settlement window", () => {
    expect(observedPerBlock(100n, 0n)).toBeNull();
    expect(observedPerBlock(100n, 4n)).toBe(25n);
    const start = "2026-10-27T12:00:00.000Z";
    const now = Date.parse("2026-10-29T12:00:00.000Z");
    expect(blocksPerDayMilli(2000n, start, "2026-11-03T12:00:00.000Z", now)).toBe(1000_000n);
  });
});

describe("format", () => {
  it("formats fixed point", () => {
    expect(fixed(1234567n * 10n ** 15n, 18, 2)).toBe("1,234.56");
    expect(pct(1n, 50n, 2)).toBe("2%");
  });
});
