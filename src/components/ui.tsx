import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, unavailableText, type Envelope } from "../api";
import { DOC, NET } from "../config";
import { getSqueek, limited } from "../data";
import type { Async } from "../hooks";

export function DocLink({ href, children = "Source" }: { href: string; children?: ReactNode }) {
  return (
    <a className="doclink" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function TxLink({ hash }: { hash: string }) {
  return (
    <a className="mono-num" href={`${NET.explorer}/tx/${hash}`} target="_blank" rel="noreferrer" title={hash}>
      {hash.slice(0, 10)}…{hash.slice(-6)}
    </a>
  );
}
export function AddrLink({ addr }: { addr: string }) {
  return (
    <a className="mono-num addr" href={`${NET.explorer}/address/${addr}`} target="_blank" rel="noreferrer" title={addr}>
      {addr.slice(0, 8)}…{addr.slice(-6)}
    </a>
  );
}

export function Notice({ kind = "info", title, children, action }: { kind?: "info" | "warn" | "error"; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <p className="notice-title">{title}</p>
      {children && <div className="notice-body">{children}</div>}
      {action}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p className="loading" role="status" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" /> {label}
    </p>
  );
}

export function ErrorNotice({ error, retry }: { error: Error; retry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : `Something went wrong: ${error.message}`;
  return (
    <Notice
      kind="error"
      title="Could not load this data"
      action={
        retry && (
          <button type="button" className="btn btn-quiet" onClick={retry}>
            Try again
          </button>
        )
      }
    >
      <p>{msg}</p>
    </Notice>
  );
}

/** Renders loading / error / unavailable states for an API envelope, else the children. */
export function Gate<T extends Envelope>({ res, retry, label, children }: { res: Async<T>; retry?: () => void; label: string; children: (d: T) => ReactNode }) {
  if (res.state === "loading") return <Loading label={label} />;
  if (res.state === "error") return <ErrorNotice error={res.error} retry={retry} />;
  if (res.data.status === "unavailable")
    return (
      <Notice kind="warn" title="The API has no answer right now">
        <p>{unavailableText(res.data.reason)}</p>
      </Notice>
    );
  return <>{children(res.data)}</>;
}

/** Warns when the API's contract identities differ from the docs' deployment record. */
export function DeploymentCheck({ identities }: { identities?: Envelope["identities"] }) {
  const rec = NET.deploymentRecord;
  if (!identities || !rec.core) return null;
  const pairs: [string, string | null, string | undefined][] = [
    ["SqueekCore", rec.core, identities.core],
    ["SqueekMining", rec.mining, identities.mining?.proxy],
    ["SqueekToken", rec.token, identities.token],
    ["SqueekNFT", rec.nft, identities.genesis],
  ];
  const diff = pairs.filter(([, a, b]) => a && b && a.toLowerCase() !== b.toLowerCase());
  if (diff.length === 0) return null;
  return (
    <details className="notice notice-warn deploy-check">
      <summary>The API serves a newer deployment than the docs record</summary>
      <p>
        Figures below are exactly what the API reports. Its contracts differ from the <DocLink href={DOC.deployments}>deployment record</DocLink>:
      </p>
      <ul>
        {diff.map(([name, a, b]) => (
          <li key={name}>
            {name}: docs <span className="mono-num">{a!.slice(0, 10)}…</span>, API <AddrLink addr={b!} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** DotGrid image from /v1/squeeks/{id}, fetched only when the card scrolls into view. */
export function SqueekImage({ tokenId, size = 96 }: { tokenId: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const load = () =>
      limited(() => getSqueek(tokenId)).then(
        (r) => {
          if (cancelled) return;
          const uri = r.metadata?.imageDataUri ?? r.metadata?.cardImageUrl;
          if (uri && /^(data:image\/svg\+xml|https:)/.test(uri)) setSrc(uri);
          else setFailed(true);
        },
        () => !cancelled && setFailed(true),
      );
    if (!("IntersectionObserver" in window)) {
      load();
      return () => void (cancelled = true);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [tokenId]);
  return (
    <div ref={ref} className="sq-img" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={`Squeek #${tokenId} DotGrid image`} width={size} height={size} loading="lazy" /> : <span className="sq-img-ph">{failed ? "No image" : ""}</span>}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        <span className="stat-value">{value}</span>
        {note && <span className="stat-note">{note}</span>}
      </dd>
    </div>
  );
}
