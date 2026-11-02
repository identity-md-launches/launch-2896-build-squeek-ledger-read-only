import { apiGet, unavailableText, type CoreResponse, type EconomyResponse, type StatusResponse } from "../api";
import { DOC, REFRESH_MS } from "../config";
import { usePoll } from "../hooks";
import { big, fixed, int, power18, sqk } from "../lib/format";
import { DocLink, ErrorNotice, Loading, Stat, DeploymentCheck } from "../components/ui";

interface Snapshot {
  status: StatusResponse | null;
  core: CoreResponse | null;
  economy: EconomyResponse | null;
  errors: string[];
}

async function loadSnapshot(signal: AbortSignal): Promise<Snapshot> {
  const [s, c, e] = await Promise.allSettled([
    apiGet<StatusResponse>("/v1/status", signal),
    apiGet<CoreResponse>("/v1/core", signal),
    apiGet<EconomyResponse>("/v1/economy/state", signal),
  ]);
  const errors: string[] = [];
  const firstFailure = [s, c, e].find((r): r is PromiseRejectedResult => r.status === "rejected");
  const pick = <T,>(r: PromiseSettledResult<T>, name: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    errors.push(`${name}: ${(r.reason as Error).message}`);
    return null;
  };
  const snap = { status: pick(s, "/v1/status"), core: pick(c, "/v1/core"), economy: pick(e, "/v1/economy/state"), errors };
  if (!snap.status && !snap.core && !snap.economy) throw firstFailure?.reason ?? new Error("No data");
  return snap;
}

function useNetwork() {
  return usePoll(loadSnapshot, REFRESH_MS);
}

const BLOCK_UNITS = 1_000_000_000n; // block units per Squeek block, per the API's units table

function progressOf(core: CoreResponse | null) {
  if (!core || core.status !== "available" || !core.core) return null;
  const units = big(core.core.blockProgress);
  if (units === null) return null;
  return { height: big(core.core.blockHeight), units, pctMilli: Number((units * 100_000n) / BLOCK_UNITS) / 1000 };
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="progress" role="progressbar" aria-label="Progress to the next Squeek block" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Updated({ at, error }: { at: number | null; error: Error | null }) {
  let text: string;
  if (at && error) text = `Last refresh failed, showing the reading from ${new Date(at).toLocaleTimeString()}. Retrying every 10 s.`;
  else if (at) text = `Updated ${new Date(at).toLocaleTimeString()}, refreshes every 10 s.`;
  else if (error) text = "Retrying every 10 s.";
  else text = "Loading…";
  return (
    <p className="small live" aria-live="polite">
      <span className={`live-dot ${error ? "live-dot-off" : ""}`} aria-hidden="true" />
      {text}
    </p>
  );
}

/** Compact live strip for the home page. */
export function NetworkStrip() {
  const { data, error, updatedAt } = useNetwork();
  const p = progressOf(data?.core ?? null);
  const waiting = data?.status?.settlementQueue?.status === "available" ? big(data.status.settlementQueue.buffered?.roundCount) : null;
  return (
    <section className="section strip" aria-labelledby="h-strip">
      <h2 id="h-strip" className="pixel h2">
        Network now
      </h2>
      {!data && !error && <Loading label="Reading /v1/status and /v1/core…" />}
      {!data && error && <ErrorNotice error={error} />}
      {data && (
        <>
          <dl className="stats">
            <Stat label="Squeek block" value={int(p?.height ?? null)} note={p ? `${p.pctMilli.toFixed(1)}% to the next` : "unknown"} />
            <Stat label="Rounds waiting to settle" value={int(waiting)} />
          </dl>
          {p && <Progress pct={p.pctMilli} />}
          <p className="small">
            <a href="#/network">Full network panel</a>
          </p>
        </>
      )}
      <Updated at={updatedAt} error={error} />
    </section>
  );
}

export function NetworkPage() {
  const { data, error, updatedAt } = useNetwork();
  const p = progressOf(data?.core ?? null);
  const st = data?.status;
  const q = st?.settlementQueue;
  const econ = data?.economy?.status === "available" ? data.economy : null;
  const nftP = big(econ?.staking?.totalNftPower);
  const sqkP = big(econ?.staking?.totalSqkPower);
  const total = nftP !== null && sqkP !== null ? nftP + sqkP : null;
  const projected = st?.builder?.status === "available" ? st.builder.projected : undefined;
  return (
    <section className="section" aria-labelledby="h-net">
      <h1 id="h-net" className="pixel h1">
        Network panel
      </h1>
      <p className="lede">Live Squeekchain state from the public API, refreshed every 10 seconds while this tab is open.</p>
      <Updated at={updatedAt} error={error} />
      {!data && !error && <Loading label="Reading the network…" />}
      {!data && error && <ErrorNotice error={error} />}
      {data && (
        <>
          <DeploymentCheck identities={econ?.identities} />
          {data.errors.length > 0 && (
            <p className="small warn-text">Some endpoints failed this round: {data.errors.join("; ")}</p>
          )}
          <dl className="stats">
            <Stat label="Squeek block height" value={int(p?.height ?? null)} note={<DocLink href={DOC.core}>/v1/core core.blockHeight</DocLink>} />
            <Stat
              label="Progress to next block"
              value={p ? `${p.pctMilli.toFixed(2)}%` : "unknown"}
              note={<DocLink href={DOC.units}>blockProgress ÷ 1,000,000,000</DocLink>}
            />
            <Stat
              label="Rounds waiting to settle"
              value={q?.status === "available" ? int(big(q.buffered?.roundCount)) : "unknown"}
              note={<DocLink href={DOC.status}>{q?.state ? `Queue ${q.state}` : "settlementQueue.buffered"}</DocLink>}
            />
            <Stat
              label="Total active power"
              value={power18(total, 0)}
              note={<DocLink href={DOC.economy}>staking.totalNftPower + totalSqkPower</DocLink>}
            />
            <Stat label="SQK minted" value={sqk(big(econ?.supply?.miningMintedBaseUnits), 0)} note={<DocLink href={DOC.economy}>supply.miningMintedBaseUnits</DocLink>} />
            <Stat
              label="Projected height"
              value={projected ? int(big(projected.blockHeight)) : "unknown"}
              note={<DocLink href={DOC.status}>Optimistic, not yet settled</DocLink>}
            />
          </dl>
          {p && <Progress pct={p.pctMilli} />}
          {data.core?.status === "unavailable" && <p className="small warn-text">{unavailableText(data.core.reason)}</p>}
          <dl className="stats stats-quiet">
            <Stat label="Settled through round" value={int(big(data.core?.core?.settledThroughRound))} />
            <Stat label="Difficulty" value={int(big(data.core?.core?.workPerThousandBlocks))} note="Work per 1,000 blocks" />
            <Stat label="Wheel" value={st?.measurement ? `${st.measurement.freshness}, ${st.measurement.coreStatus.toLowerCase()}` : "no reading"} />
            <Stat label="SQK supply cap" value={econ?.supply ? `${fixed(BigInt(econ.supply.capBaseUnits), 18, 0)} SQK` : "unknown"} />
          </dl>
        </>
      )}
    </section>
  );
}
