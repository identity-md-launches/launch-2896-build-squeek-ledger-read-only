/**
 * Merge pyramid simulation, following the documented rules
 * (https://docs.squeekchain.com/squeeks/merge/ and https://docs.squeekchain.com/developers/mining/#merge):
 * - a merge takes two Squeeks at the same level, below the maximum level, and leaves one Squeek one level higher;
 *   the donor is burned;
 * - each level's power and merge cooldown come from /v1/economy/state `nft.basePower[]` and `nft.cooldownBlocks[]`
 *   (index 0 is level 1);
 * - a Squeek can merge again once its cooldown (in completed Squeek blocks) has passed.
 * Pure function: it never signs or sends anything.
 */
export interface PlanInput {
  tokenId: string;
  level: number;
  nextMergeHeight: bigint;
}
export interface LevelTable {
  basePower: bigint[];
  cooldownBlocks: bigint[];
  maximumLevel: number;
}
export interface MergeStep {
  survivor: string;
  donor: string;
  fromLevel: number;
  toLevel: number;
  /** Earliest completed Squeek block height at which both inputs are past cooldown. */
  earliestHeight: bigint;
  /** Height from which the survivor may merge again (earliestHeight + cooldown of the new level). */
  nextMergeHeight: bigint;
}
export interface PlanResult {
  steps: MergeStep[];
  results: PlanInput[];
  powerBefore: bigint;
  powerAfter: bigint;
  finalHeight: bigint;
  unmerged: PlanInput[];
}

export function powerAt(table: LevelTable, level: number): bigint {
  const p = table.basePower[level - 1];
  if (p === undefined) throw new Error(`No power listed for level ${level}`);
  return p;
}

export function simulateMerge(inputs: PlanInput[], table: LevelTable, currentHeight: bigint): PlanResult {
  // Survivor = the lower token id of each pair (the user can choose either on the real merge).
  const pool = inputs.map((t) => ({ ...t, merged: false }));
  const steps: MergeStep[] = [];
  const max = table.maximumLevel;
  for (let level = 1; level < max; level += 1) {
    for (;;) {
      const atLevel = pool
        .filter((t) => t.level === level)
        .sort((a, b) => (a.nextMergeHeight < b.nextMergeHeight ? -1 : a.nextMergeHeight > b.nextMergeHeight ? 1 : Number(BigInt(a.tokenId) - BigInt(b.tokenId))));
      if (atLevel.length < 2) break;
      const [a, b] = atLevel;
      const [survivor, donor] = BigInt(a.tokenId) <= BigInt(b.tokenId) ? [a, b] : [b, a];
      const earliest = [a.nextMergeHeight, b.nextMergeHeight, currentHeight].reduce((m, x) => (x > m ? x : m));
      const toLevel = level + 1;
      const cooldown = table.cooldownBlocks[toLevel - 1] ?? 0n;
      const next = earliest + cooldown;
      steps.push({ survivor: survivor.tokenId, donor: donor.tokenId, fromLevel: level, toLevel, earliestHeight: earliest, nextMergeHeight: next });
      pool.splice(pool.indexOf(donor), 1);
      survivor.level = toLevel;
      survivor.nextMergeHeight = next;
      survivor.merged = true;
    }
  }
  const sum = (xs: { level: number }[]) => xs.reduce((s, t) => s + powerAt(table, t.level), 0n);
  const results = pool.map(({ merged: _m, ...t }) => t);
  return {
    steps,
    results,
    powerBefore: sum(inputs),
    powerAfter: sum(results),
    finalHeight: steps.reduce((m, s) => (s.earliestHeight > m ? s.earliestHeight : m), currentHeight),
    unmerged: pool.filter((t) => !t.merged).map(({ merged: _m, ...t }) => t),
  };
}
