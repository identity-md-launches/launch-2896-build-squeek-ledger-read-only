import { AddressForm } from "../components/AddressForm";
import { NetworkStrip } from "./Network";
import { Gate, DocLink, Stat, Notice, SqueekImage, DeploymentCheck } from "../components/ui";
import { useAsync } from "../hooks";
import { getAccount } from "../data";
import { DOC } from "../config";
import { big, int, power18, sqk, fixed, groupDigits } from "../lib/format";
import type { AccountResponse, AccountToken } from "../api";

const MERGE_STATE: Record<AccountToken["mergeState"], string> = {
  ready: "Can merge",
  cooldown: "Cooldown",
  terminal: "Max level",
  merges_closed: "Merges closed",
};

export function Home({ address }: { address: string }) {
  return (
    <>
      <section className="hero" aria-labelledby="h-home">
        <h1 id="h-home" className="pixel">
          Squeek Ledger
        </h1>
        <p className="lede">Paste any address to see its Squeeks, power and SQK on Squeekchain.</p>
        <AddressForm initial={address} />
      </section>
      {address ? <Account address={address} /> : <NetworkStrip />}
    </>
  );
}

function Account({ address }: { address: string }) {
  const [res, retry] = useAsync(() => getAccount(address), [address]);
  return (
    <section className="section" aria-labelledby="h-acct">
      <h2 id="h-acct" className="pixel h2">
        Holdings
      </h2>
      <Gate res={res} retry={retry} label="Reading the account from api.squeekchain.com…">
        {(d) => <AccountView d={d} address={address} />}
      </Gate>
    </section>
  );
}

function AccountView({ d, address }: { d: AccountResponse; address: string }) {
  const tokens = d.tokens ?? [];
  const nft = big(d.power?.nftPower);
  const sqkP = big(d.power?.sqkPower);
  const active = nft !== null && sqkP !== null ? nft + sqkP : null;
  const staked = tokens.filter((t) => t.custody === "staking").length;
  return (
    <>
      <DeploymentCheck identities={d.identities} />
      <p className="meta">
        <span className="mono-num addr-full">{d.account ?? address}</span> · read at Sepolia block {int(big(d.chain?.safeThroughBlock))} · <DocLink href={DOC.account}>API: Account</DocLink>
      </p>
      <dl className="stats">
        <Stat label="Squeeks" value={groupDigits(BigInt(tokens.length))} note={`${staked} staked, ${tokens.length - staked} in wallet`} />
        <Stat label="Active power" value={power18(active)} note={<DocLink href={DOC.units}>nftPower + sqkPower</DocLink>} />
        <Stat label="Pending SQK" value={sqk(big(d.rewards?.claimableBaseUnits))} note="What one claim pays now" />
        <Stat label="Claimed SQK" value={sqk(big(d.rewards?.lifetimePaidBaseUnits))} note={`${sqk(big(d.rewards?.lifetimeCompoundedBaseUnits))} into staking`} />
      </dl>
      <p className="small">
        The API reports pending and claimed SQK for the whole account, not per Squeek.
      </p>
      {tokens.length === 0 ? (
        <Notice title="No Squeeks at this address">
          <p>
            This address holds no Squeeks in its wallet and has none deposited in staking. Check the address, or see how to get one at{" "}
            <a href={DOC.genesis} target="_blank" rel="noreferrer">
              squeekchain.com/genesis
            </a>
            .
          </p>
        </Notice>
      ) : (
        <>
          <div className="row-actions">
            <a className="btn btn-quiet" href={`#/merge?a=${address}`}>
              Plan a merge
            </a>
            <a className="btn btn-quiet" href={`#/earnings?a=${address}`}>
              Estimate earnings
            </a>
          </div>
          <ul className="cards" aria-label="Squeeks at this address">
            {tokens.map((t) => (
              <li key={t.tokenId} className="card">
                <a className="card-link" href={`#/squeek/${t.tokenId}`} aria-label={`Squeek ${t.tokenId}, level ${t.level}`}>
                  <SqueekImage tokenId={t.tokenId} />
                  <div className="card-body">
                    <p className="card-title">#{t.tokenId}</p>
                    <p className="card-line">
                      Level {t.level} · {groupDigits(BigInt(t.basePower))} power
                    </p>
                    <p className="card-line">
                      <span className={`badge ${t.custody === "staking" ? "badge-on" : ""}`}>{t.custody === "staking" ? "Staked" : "In wallet"}</span>
                      <span className="badge badge-quiet">{MERGE_STATE[t.mergeState] ?? t.mergeState}</span>
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {d.earnings && d.earnings.length > 0 && (
        <details className="earn7">
          <summary>Earned in the last seven days</summary>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col" className="num">
                  Earned
                </th>
              </tr>
            </thead>
            <tbody>
              {d.earnings.map((e) => (
                <tr key={e.date}>
                  <td>{e.date}</td>
                  <td className="num">{fixed(BigInt(e.earnedBaseUnits), 18, 2)} SQK</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
