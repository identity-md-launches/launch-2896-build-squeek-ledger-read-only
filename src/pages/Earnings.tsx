import type { AccountResponse, EconomyResponse, SettlementsResponse } from "../api";
import { DOC, NET } from "../config";
import { getAccount, getEconomy, getSettlements7d } from "../data";
import { loadPlan, useAsync } from "../hooks";
import { big, E18, fixed, groupDigits, power18, sqk } from "../lib/format";
import { blocksPerDayMilli, estimate, observedPerBlock } from "../lib/estimate";
import { simulateMerge } from "../lib/merge";
import { DeploymentCheck, DocLink, Gate, Notice } from "../components/ui";
import { NeedAddress, tableOf } from "./Merge";

export function EarningsPage({ address }: { address: string }) {
  const [res, retry] = useAsync(async () => {
    const [a, e, s] = await Promise.all([getAccount(address), getEconomy(), getSettlements7d()]);
    return { status: [a, e, s].find((x) => x.status === "unavailable")?.status ?? "available", reason: [a, e, s].find((x) => x.status === "unavailable")?.reason, schemaVersion: 1, a, e, s };
  }, [address]);
  if (!address) return <NeedAddress title="Earnings estimator" target="/earnings" />;
  return (
    <section className="section" aria-labelledby="h-earn">
      <h1 id="h-earn" className="pixel h1">
        Earnings estimator
      </h1>
      <p className="sim-label">An estimate from recent rates, not a promise. Testnet SQK has no value.</p>
      <Gate res={res} retry={retry} label="Reading account, economy and the last 7 days of settlements…">
        {(d) => <EarningsView a={d.a} e={d.e} s={d.s} address={address} />}
      </Gate>
    </section>
  );
}

function EarningsView({ a, e, s, address }: { a: AccountResponse; e: EconomyResponse; s: SettlementsResponse; address: string }) {
  const nft = big(a.power?.nftPower);
  const sp = big(a.power?.sqkPower);
  const tn = big(e.staking?.totalNftPower);
  const ts = big(e.staking?.totalSqkPower);
  if (nft === null || sp === null || tn === null || ts === null) return <Notice kind="warn" title="Power totals are unknown right now" />;
  const mine = nft + sp;
  const total = tn + ts;
  const blocks = big(s.summary?.completedBlockCount);
  const minted = big(s.mining?.rangeMintedBaseUnits);
  const perBlockObserved = observedPerBlock(minted, blocks);
  const bpd = blocksPerDayMilli(blocks, s.window?.startAt, s.window?.endAt, Date.parse(s.generatedAt ?? "") || Date.now());
  const docsPerBlock = NET.docsRewardPerBlockSqk !== null ? BigInt(NET.docsRewardPerBlockSqk) * E18 : null;
  const perBlock = perBlockObserved ?? docsPerBlock;

  // The planned merge from the merge planner (saved in this browser), counted only for staked Squeeks.
  const table = tableOf(e);
  const planIds = loadPlan(address);
  const planTokens = (a.tokens ?? []).filter((t) => planIds.includes(t.tokenId));
  const stakedPlan = planTokens.filter((t) => t.custody === "staking");
  const sim =
    table && stakedPlan.length >= 2
      ? simulateMerge(stakedPlan.map((t) => ({ tokenId: t.tokenId, level: t.level, nextMergeHeight: big(t.nextMergeHeight) ?? 0n })), table, big(a.economy?.coreBlockHeight) ?? 0n)
      : null;
  const delta = sim ? (sim.powerAfter - sim.powerBefore) * E18 : 0n;

  const now = perBlock !== null && bpd !== null ? estimate({ accountPower: mine, totalPower: total, sqkPerBlock: perBlock, blocksPerDayMilli: bpd }) : null;
  const after = sim && perBlock !== null && bpd !== null ? estimate({ accountPower: mine + delta, totalPower: total + delta, sqkPerBlock: perBlock, blocksPerDayMilli: bpd }) : null;
  const share = (x: bigint) => `${fixed(x, 8, 4)}%`;
  const earned7 = (a.earnings ?? []).reduce((acc, x) => acc + (big(x.earnedBaseUnits) ?? 0n), 0n);

  return (
    <>
      <DeploymentCheck identities={e.identities} />
      {mine === 0n && (
        <Notice title="This address has no active power">
          <p>Only staked Squeeks and staked SQK earn. Deposit a Squeek in staking and it will show here. <DocLink href={DOC.staking}>Staking</DocLink></p>
        </Notice>
      )}
      <div className="table-wrap">
        <table className="table est">
          <caption className="small">
            Share = account power ÷ total active power (<DocLink href={DOC.share}>docs</DocLink>). Per block = share × SQK per block. Per day = per block × blocks per day.
          </caption>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col" className="num">
                Now
              </th>
              <th scope="col" className="num">
                After planned merge
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Account power</th>
              <td className="num">{power18(mine, 0)}</td>
              <td className="num">{sim ? power18(mine + delta, 0) : "No plan"}</td>
            </tr>
            <tr>
              <th scope="row">Total active power</th>
              <td className="num">{power18(total, 0)}</td>
              <td className="num">{sim ? power18(total + delta, 0) : "No plan"}</td>
            </tr>
            <tr>
              <th scope="row">Share of power</th>
              <td className="num">{now ? share(now.shareBps1e6) : "unknown"}</td>
              <td className="num">{after ? share(after.shareBps1e6) : "No plan"}</td>
            </tr>
            <tr>
              <th scope="row">SQK per Squeek block</th>
              <td className="num">{now ? sqk(now.perBlock, 4) : "unknown"}</td>
              <td className="num">{after ? sqk(after.perBlock, 4) : "No plan"}</td>
            </tr>
            <tr>
              <th scope="row">SQK per day</th>
              <td className="num">{now ? sqk(now.perDay, 2) : "unknown"}</td>
              <td className="num">{after ? sqk(after.perDay, 2) : "No plan"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!sim && (
        <p className="small">
          {planTokens.length > 0 && stakedPlan.length < 2
            ? "Your planned merge has fewer than two staked Squeeks, so it does not change earning power. "
            : "No merge planned yet. "}
          <a href={`#/merge?a=${address}`}>Open the merge planner</a>
        </p>
      )}
      {sim && planTokens.length !== stakedPlan.length && <p className="small">Wallet Squeeks in your plan are left out: only staked Squeeks earn.</p>}
      {sim && <p className="small">The merged power is assumed fully active, and other holders' power is assumed unchanged.</p>}
      <h2 className="pixel h2">Inputs</h2>
      <dl className="stats">
        <div className="stat">
          <dt>SQK per Squeek block</dt>
          <dd>
            <span className="stat-value">{sqk(perBlock, 2)}</span>
            <span className="stat-note">
              {perBlockObserved !== null ? (
                <>
                  Observed: SQK minted ÷ blocks completed, last 7 days (<DocLink href={DOC.settlements}>/v1/settlements?range=7d</DocLink>)
                </>
              ) : (
                <>Docs value, no recent issuance</>
              )}
            </span>
          </dd>
        </div>
        <div className="stat">
          <dt>Squeek blocks per day</dt>
          <dd>
            <span className="stat-value">{bpd !== null ? fixed(bpd, 3, 1) : "unknown"}</span>
            <span className="stat-note">
              {blocks !== null ? groupDigits(blocks) : "?"} blocks over the elapsed 7-day window (<DocLink href={DOC.settlements}>settlements</DocLink>)
            </span>
          </dd>
        </div>
        <div className="stat">
          <dt>Docs block reward</dt>
          <dd>
            <span className="stat-value">{docsPerBlock !== null ? sqk(docsPerBlock, 0) : "unknown"}</span>
            <span className="stat-note">
              <DocLink href={DOC.rewardPerBlock}>REWARD_PER_BLOCK on Sepolia</DocLink> · <DocLink href={DOC.rewardCalc}>reward formula</DocLink>
            </span>
          </dd>
        </div>
        <div className="stat">
          <dt>Actually earned, 7 days</dt>
          <dd>
            <span className="stat-value">{sqk(earned7, 2)}</span>
            <span className="stat-note">
              Sum of <DocLink href={DOC.account}>earnings[]</DocLink>
            </span>
          </dd>
        </div>
      </dl>
      <details className="caveats" open>
        <summary>Why the estimate can differ from what you earn</summary>
        <ul>
          <li>
            The docs give {NET.docsRewardPerBlockSqk ? groupDigits(BigInt(NET.docsRewardPerBlockSqk)) : "an unknown amount of"} SQK per block on Sepolia, while the live issuance over the
            last 7 days averaged {sqk(perBlockObserved, 2)} per block. The API also reports a schedule (first period rate {sqk(big(e.schedule?.firstPeriodRateBaseUnits), 2)}, launch bonus{" "}
            {sqk(big(e.schedule?.launchBonusBaseUnits), 0)} over {groupDigits(big(e.schedule?.bonusBlocks) ?? 0n)} blocks, halving every{" "}
            {groupDigits(big(e.schedule?.halvingBlocks) ?? 0n)} blocks) that the docs do not describe yet, so this site uses the observed rate.
          </li>
          <li>
            Of SQK issued so far, the API reports {sqk(big(e.mining?.stakingFundedBaseUnits), 0)} funded to staking rewards and {sqk(big(e.mining?.gachaFundedBaseUnits), 0)} to the game vault. The docs do
            not describe this split, so the estimate follows the documented rule and shares the whole block by power. Compare it with what this address actually earned above.
          </li>
          <li>Block rate follows the hamster. A quiet wheel completes fewer blocks.</li>
          <li>New power waits a round, and a checkpoint must process settled rounds before SQK is claimable.</li>
        </ul>
      </details>
    </>
  );
}
