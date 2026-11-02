import { apiGet, ApiError, type ActivityEntry, type ActivityResponse, type SqueekResponse } from "../api";
import { DOC } from "../config";
import { getEconomy, getSqueek } from "../data";
import { useAsync } from "../hooks";
import { big, dateTime, groupDigits, int } from "../lib/format";
import { AddrLink, DocLink, Gate, Loading, ErrorNotice, Notice, Stat, TxLink } from "../components/ui";

const KIND: Record<string, string> = {
  nft_deposited: "Deposited to staking",
  nft_withdrawn: "Withdrawn from staking",
  nft_merged: "Merged",
  nft_launch_claimed: "Claimed at Genesis launch",
  nft_transferred: "Transferred",
};

const MERGE_LABEL: Record<string, string> = { ready: "Can merge", cooldown: "Cooldown", terminal: "Max level", merges_closed: "Merges closed" };

function touches(e: ActivityEntry, id: string) {
  return e.tokenId === id || e.survivorTokenId === id || e.donorTokenId === id;
}

/** The holder's activity, filtered to this Squeek. Follows nextCursor for up to 10 pages of 100. */
async function historyFor(holder: string, id: string, signal: AbortSignal) {
  const out: ActivityEntry[] = [];
  let cursor: string | null = null;
  let complete = false;
  for (let i = 0; i < 10; i += 1) {
    const q = new URLSearchParams({ limit: "100" });
    if (cursor) q.set("cursor", cursor);
    const r: ActivityResponse = await apiGet<ActivityResponse>(`/v1/accounts/${holder}/activity?${q}`, signal);
    if (r.status !== "available") return { status: r, entries: out, complete };
    out.push(...(r.activity ?? []).filter((e) => touches(e, id)));
    cursor = r.nextCursor ?? null;
    if (!cursor) {
      complete = true;
      break;
    }
  }
  return { status: null, entries: out, complete };
}

export function SqueekPage({ id }: { id: string }) {
  const valid = /^\d{1,4}$/.test(id) && Number(id) >= 1 && Number(id) <= 9999;
  const [res, retry] = useAsync(async () => (valid ? getSqueek(String(Number(id))) : Promise.reject(new ApiError(400, "invalid_token_id", "Squeek ids run from 1 to 9999."))), [id]);
  return (
    <section className="section" aria-labelledby="h-sq">
      <p className="crumbs">
        <a href="#/" onClick={(e) => (history.length > 1 ? (e.preventDefault(), history.back()) : undefined)}>
          Back
        </a>
      </p>
      <h1 id="h-sq" className="pixel h1">
        Squeek #{id}
      </h1>
      <Gate res={res} retry={retry} label="Reading this Squeek…">
        {(d) => <SqueekView d={d} id={String(Number(id))} />}
      </Gate>
    </section>
  );
}

function SqueekView({ d, id }: { d: SqueekResponse; id: string }) {
  const [econ] = useAsync(() => getEconomy(), []);
  const c = d.custody;
  const holder = c?.depositor ?? c?.owner ?? null;
  const [hist, retryHist] = useAsync(
    (signal) => (holder && !c?.burned ? historyFor(holder, id, signal) : Promise.resolve(null)),
    [holder, id],
  );
  const level = d.level ?? 0;
  const table = econ.state === "done" && econ.data.status === "available" ? econ.data.nft : undefined;
  const next = table && level > 0 && level < table.maximumLevel ? table.basePower[level] : undefined;
  const lvl1 = table?.basePower[0];
  const cooldown = table && level > 0 ? table.cooldownBlocks[level - 1] : undefined;
  const img = d.metadata?.imageDataUri ?? d.metadata?.cardImageUrl;
  const height = big(d.economy?.coreBlockHeight);
  const nextMerge = big(d.nextMergeHeight);
  return (
    <div className="sq-layout">
      <div className="sq-art">
        {img && /^(data:image\/svg\+xml|https:)/.test(img) ? (
          <img src={img} alt={`Squeek #${id} DotGrid image`} width={320} height={320} />
        ) : (
          <div className="sq-img sq-img-big">
            <span className="sq-img-ph">{d.metadata?.status === "pending" ? "Image pending refresh" : "No image"}</span>
          </div>
        )}
        {d.metadata?.attributes && d.metadata.attributes.length > 0 && (
          <dl className="traits">
            {d.metadata.attributes.map((a) => (
              <div key={a.traitType}>
                <dt>{a.traitType}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="sq-info">
        <h2 className="pixel h2">Power</h2>
        <dl className="stats">
          <Stat label="Level" value={level || "unknown"} note={table ? `of ${table.maximumLevel}` : undefined} />
          <Stat label="Maximum power" value={d.basePower ? groupDigits(BigInt(d.basePower)) : "unknown"} note={<DocLink href={DOC.levels}>Set by level</DocLink>} />
          <Stat
            label="Next level power"
            value={next ? groupDigits(BigInt(next)) : level && table && level >= table.maximumLevel ? "Max level" : "unknown"}
            note={<DocLink href={DOC.economy}>nft.basePower[]</DocLink>}
          />
          <Stat
            label="vs. a level 1"
            value={d.basePower && lvl1 ? `${(Number(BigInt(d.basePower) * 100n / BigInt(lvl1)) / 100).toFixed(2)}×` : "unknown"}
          />
        </dl>
        <p className="small">
          Active power, the part that earns, is set by staking and is reported per account, not per Squeek. <DocLink href={DOC.staking}>Staking docs</DocLink>
        </p>
        <h2 className="pixel h2">Merge state</h2>
        <dl className="stats">
          <Stat label="State" value={MERGE_LABEL[d.mergeState ?? ""] ?? d.mergeState ?? "unknown"} />
          <Stat
            label="Can merge from block"
            value={nextMerge === null ? "unknown" : height !== null && nextMerge <= height ? "Now" : int(nextMerge)}
            note={height !== null ? `Height now ${groupDigits(height)}` : undefined}
          />
          <Stat label="Cooldown after reaching this level" value={cooldown ? `${groupDigits(BigInt(cooldown))} blocks` : "unknown"} note={<DocLink href={DOC.cooldown}>Counted in Squeek blocks</DocLink>} />
        </dl>
        <h2 className="pixel h2">Ownership</h2>
        {c ? (
          <dl className="stats">
            <Stat label="Holder" value={c.owner ? <AddrLink addr={c.owner} /> : "none"} note={c.depositor ? "The staking contract" : undefined} />
            <Stat label="Depositor" value={c.depositor ? <AddrLink addr={c.depositor} /> : "Not staked"} />
            <Stat label="Burned" value={c.burned ? "Yes, as a merge donor or otherwise" : "No"} />
          </dl>
        ) : (
          <p>Unknown.</p>
        )}
        {holder && !c?.burned && (
          <p className="row-actions">
            <a className="btn btn-quiet" href={`#/?a=${holder}`}>
              See this holder's Squeeks
            </a>
          </p>
        )}
        <h2 className="pixel h2">History</h2>
        <p className="small">
          From the holder's <DocLink href={DOC.activity}>account activity</DocLink>, filtered to this Squeek. Each row links to its Ethereum transaction.
        </p>
        {c?.burned ? (
          <Notice title="This Squeek is burned">
            <p>A burned Squeek has no holder whose history the API can list.</p>
          </Notice>
        ) : hist.state === "loading" ? (
          <Loading label="Reading history…" />
        ) : hist.state === "error" ? (
          <ErrorNotice error={hist.error} retry={retryHist} />
        ) : !hist.data ? (
          <p>No holder recorded.</p>
        ) : hist.data.entries.length === 0 ? (
          <Notice title="No recorded events for this Squeek yet">
            <p>The holder's activity has no deposits, withdrawals, merges or transfers involving #{id}.</p>
          </Notice>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">When</th>
                  <th scope="col">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {hist.data.entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {KIND[e.kind] ?? e.kind}
                      {e.kind === "nft_merged" && (
                        <span className="small block">
                          {e.survivorTokenId === id ? `Kept, burned #${e.donorTokenId}` : `Burned into #${e.survivorTokenId}`}, to level {e.level}
                        </span>
                      )}
                      {e.kind === "nft_transferred" && e.from && e.to && (
                        <span className="small block">
                          <AddrLink addr={e.from} /> to <AddrLink addr={e.to} />
                        </span>
                      )}
                    </td>
                    <td>{dateTime(e.source.blockTimestamp)}</td>
                    <td>
                      <TxLink hash={e.source.transactionHash} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hist.state === "done" && hist.data && !hist.data.complete && <p className="small">Only the holder's newest 1,000 activity entries were searched.</p>}
        <p className="small">
          Data: <DocLink href={DOC.squeek}>/v1/squeeks/{id}</DocLink>
        </p>
      </div>
    </div>
  );
}
