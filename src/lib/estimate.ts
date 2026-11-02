/**
 * Earnings estimate, using only API figures and the documented sharing rule
 * "a Squeek's share of a block is its active power divided by the total active power"
 * (https://docs.squeekchain.com/squeeks/overview/#how-each-blocks-sqk-is-shared).
 */
export interface EstimateInput {
  accountPower: bigint; // nftPower + sqkPower, 18 decimals
  totalPower: bigint; // staking.totalNftPower + totalSqkPower, 18 decimals
  sqkPerBlock: bigint; // SQK base units issued per completed Squeek block
  blocksPerDayMilli: bigint; // completed Squeek blocks per day × 1000
}
export interface Estimate {
  shareBps1e6: bigint; // share × 10^10 (i.e. percent with 8 decimals); 0 when total is 0
  perBlock: bigint; // SQK base units
  perDay: bigint; // SQK base units
}
const SHARE_SCALE = 10n ** 10n;

export function estimate(i: EstimateInput): Estimate {
  if (i.totalPower <= 0n || i.accountPower <= 0n) return { shareBps1e6: 0n, perBlock: 0n, perDay: 0n };
  const perBlock = (i.sqkPerBlock * i.accountPower) / i.totalPower;
  const perDay = (i.sqkPerBlock * i.accountPower * i.blocksPerDayMilli) / (i.totalPower * 1000n);
  return { shareBps1e6: (i.accountPower * SHARE_SCALE) / i.totalPower, perBlock, perDay };
}

/** Observed issuance per block over the settlement window: minted SQK ÷ completed blocks. */
export function observedPerBlock(rangeMinted: bigint | null, blocks: bigint | null): bigint | null {
  if (rangeMinted === null || blocks === null || blocks === 0n) return null;
  return rangeMinted / blocks;
}

/** Completed blocks per day ×1000 over the elapsed part of the window (the 7d window ends in the future). */
export function blocksPerDayMilli(blocks: bigint | null, startAt: string | undefined, endAt: string | undefined, nowMs: number): bigint | null {
  if (blocks === null || !startAt || !endAt) return null;
  const start = Date.parse(startAt);
  const end = Math.min(Date.parse(endAt), nowMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const elapsedMs = BigInt(Math.round(end - start));
  return (blocks * 86_400_000n * 1000n) / elapsedMs;
}
