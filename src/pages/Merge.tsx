import { useMemo, useState } from "react";
import type { AccountResponse, AccountToken, EconomyResponse } from "../api";
import { DOC } from "../config";
import { getAccount, getEconomy } from "../data";
import { loadPlan, savePlan, useAsync } from "../hooks";
import { big, groupDigits } from "../lib/format";
import { simulateMerge, type LevelTable } from "../lib/merge";
import { AddressForm } from "../components/AddressForm";
import { DocLink, Gate, Notice } from "../components/ui";

export function tableOf(e: EconomyResponse): LevelTable | null {
  if (!e.nft) return null;
  return { basePower: e.nft.basePower.map(BigInt), cooldownBlocks: e.nft.cooldownBlocks.map(BigInt), maximumLevel: e.nft.maximumLevel };
}

export function NeedAddress({ title, target }: { title: string; target: string }) {
  return (
    <section className="section" aria-labelledby="h-need">
      <h1 id="h-need" className="pixel h1">
        {title}
      </h1>
      <p className="lede">Paste the address whose Squeeks you want to use.</p>
      <AddressForm initial="" target={target} />
    </section>
  );
}

export function MergePage({ address }: { address: string }) {
  const [acct, retryA] = useAsync(() => getAccount(address), [address]);
  const [econ, retryE] = useAsync(() => getEconomy(), []);
  if (!address) return <NeedAddress title="Merge planner" target="/merge" />;
  return (
    <section className="section" aria-labelledby="h-merge">
      <h1 id="h-merge" className="pixel h1">
        Merge planner
      </h1>
      <p className="sim-label">Simulation only. Nothing is signed or sent, and no Squeek is burned.</p>
      <Gate res={econ} retry={retryE} label="Reading the level table…">
        {(e) => (
          <Gate res={acct} retry={retryA} label="Reading this address's Squeeks…">
            {(a) => <Planner a={a} e={e} address={address} />}
          </Gate>
        )}
      </Gate>
    </section>
  );
}

function Planner({ a, e, address }: { a: AccountResponse; e: EconomyResponse; address: string }) {
  const tokens = useMemo(() => [...(a.tokens ?? [])].sort((x, y) => x.level - y.level || Number(BigInt(x.tokenId) - BigInt(y.tokenId))), [a]);
  const ids = new Set(tokens.map((t) => t.tokenId));
  const [picked, setPicked] = useState<string[]>(() => loadPlan(address).filter((id) => ids.has(id)));
  const table = tableOf(e);
  const height = big(a.economy?.coreBlockHeight) ?? 0n;
  if (!table) return <Notice kind="warn" title="The level table is unavailable" />;
  if (tokens.length < 2)
    return (
      <Notice title="A merge needs two Squeeks">
        <p>This address has {tokens.length === 0 ? "no Squeeks" : "one Squeek"}. A merge turns two Squeeks of the same level into one.</p>
      </Notice>
    );
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    savePlan(address, next);
  };
  const chosen = tokens.filter((t) => picked.includes(t.tokenId));
  const sim = chosen.length >= 2 ? simulateMerge(chosen.map((t) => ({ tokenId: t.tokenId, level: t.level, nextMergeHeight: big(t.nextMergeHeight) ?? 0n })), table, height) : null;
  const mergesOpen = e.nft?.mergesOpen ?? a.economy?.mergesOpen;
  return (
    <>
      <p className="small">
        Rules from the docs: two Squeeks at the same level, below level {table.maximumLevel}, become one Squeek a level higher and the donor is burned. Each level's power
        and cooldown come from the live level table. <DocLink href={DOC.merge}>Merging Squeeks</DocLink> · <DocLink href={DOC.mergeRules}>merge() rules</DocLink> ·{" "}
        <DocLink href={DOC.economy}>Level table</DocLink>
      </p>
      {mergesOpen === false && (
        <Notice kind="warn" title="Merges are closed right now">
          <p>The plan still shows what a merge would produce once they open.</p>
        </Notice>
      )}
      <div className="planner">
        <fieldset className="pick">
          <legend>Pick two or more Squeeks</legend>
          <div className="pick-tools">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => (setPicked([]), savePlan(address, []))} disabled={picked.length === 0}>
              Clear
            </button>
            <span className="small">{picked.length} picked</span>
          </div>
          <ul className="pick-list">
            {tokens.map((t) => (
              <PickRow key={t.tokenId} t={t} on={picked.includes(t.tokenId)} toggle={toggle} max={table.maximumLevel} />
            ))}
          </ul>
        </fieldset>
        <div className="result" aria-live="polite">
          <h2 className="pixel h2">Result</h2>
          {!sim ? (
            <p>Pick at least two Squeeks of the same level to see what a merge would produce.</p>
          ) : sim.steps.length === 0 ? (
            <Notice title="No merge possible with this pick">
              <p>Merges need two Squeeks at the same level below the maximum. Pick a matching pair.</p>
            </Notice>
          ) : (
            <>
              <dl className="stats">
                <div className="stat">
                  <dt>Squeeks</dt>
                  <dd>
                    <span className="stat-value">
                      {chosen.length} to {sim.results.length}
                    </span>
                  </dd>
                </div>
                <div className="stat">
                  <dt>Total max power</dt>
                  <dd>
                    <span className="stat-value">
                      {groupDigits(sim.powerBefore)} to {groupDigits(sim.powerAfter)}
                    </span>
                    <span className="stat-note">+{groupDigits(sim.powerAfter - sim.powerBefore)}</span>
                  </dd>
                </div>
                <div className="stat">
                  <dt>Highest level</dt>
                  <dd>
                    <span className="stat-value">{Math.max(...sim.results.map((r) => r.level))}</span>
                  </dd>
                </div>
                <div className="stat">
                  <dt>Last step from block</dt>
                  <dd>
                    <span className="stat-value">{groupDigits(sim.finalHeight)}</span>
                    <span className="stat-note">Now {groupDigits(height)}</span>
                  </dd>
                </div>
              </dl>
              <ol className="steps">
                {sim.steps.map((s, i) => (
                  <li key={i}>
                    Keep #{s.survivor}, burn #{s.donor}: level {s.fromLevel} to {s.toLevel} ({groupDigits(table.basePower[s.toLevel - 1])} power)
                    <span className="small block">
                      {s.earliestHeight > height ? `Waits for cooldown until block ${groupDigits(s.earliestHeight)}. ` : "Possible now. "}
                      Can merge again from block {groupDigits(s.nextMergeHeight)}.
                    </span>
                  </li>
                ))}
              </ol>
              {sim.unmerged.length > 0 && <p className="small">Left as they are: {sim.unmerged.map((u) => `#${u.tokenId} (level ${u.level})`).join(", ")}.</p>}
              <p className="small">
                The survivor of each pair here is the lower id; on a real merge the owner chooses. New power starts earning in the round after a merge, and a Squeek
                with pending power cannot merge until a checkpoint applies it. <DocLink href={DOC.newPower}>When new power starts</DocLink>
              </p>
              <p className="row-actions">
                <a className="btn" href={`#/earnings?a=${address}`}>
                  See earnings after this merge
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PickRow({ t, on, toggle, max }: { t: AccountToken; on: boolean; toggle: (id: string) => void; max: number }) {
  const atMax = t.level >= max;
  const id = `pick-${t.tokenId}`;
  return (
    <li>
      <input id={id} type="checkbox" checked={on} onChange={() => toggle(t.tokenId)} disabled={atMax} />
      <label htmlFor={id}>
        <span className="pick-id">#{t.tokenId}</span>
        <span>
          Level {t.level} · {groupDigits(BigInt(t.basePower))}
        </span>
        <span className="small">{atMax ? "Max level" : t.custody === "staking" ? "Staked" : "In wallet"}{t.mergeState === "cooldown" ? `, cooldown to ${groupDigits(BigInt(t.nextMergeHeight))}` : ""}</span>
      </label>
    </li>
  );
}
