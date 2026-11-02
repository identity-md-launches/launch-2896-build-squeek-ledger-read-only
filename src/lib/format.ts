const E18 = 10n ** 18n;

/** Decimal string → bigint, or null when missing/malformed (shown as unknown, never zero). */
export function big(v: string | number | null | undefined): bigint | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return /^\d+$/.test(s) ? BigInt(s) : null;
}

export function groupDigits(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Fixed-point bigint with `decimals` places → readable string with at most `dp` decimals. */
export function fixed(v: bigint, decimals: number, dp = 2): string {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = a / base;
  const frac = a % base;
  let fracStr = frac.toString().padStart(decimals, "0").slice(0, dp).replace(/0+$/, "");
  if (whole === 0n && frac > 0n && fracStr === "") fracStr = ""; // below display precision
  const out = groupDigits(whole) + (fracStr ? "." + fracStr : "");
  if (whole === 0n && frac > 0n && !fracStr) return (neg ? "-" : "") + "<0." + "0".repeat(Math.max(dp - 1, 0)) + "1";
  return (neg ? "-" : "") + out;
}

export const sqk = (baseUnits: bigint | null, dp = 2) => (baseUnits === null ? "unknown" : `${fixed(baseUnits, 18, dp)} SQK`);
/** Account and staking power fields carry 18 decimals; token basePower is a plain integer. */
export const power18 = (v: bigint | null, dp = 2) => (v === null ? "unknown" : fixed(v, 18, dp));
export const int = (v: bigint | null) => (v === null ? "unknown" : groupDigits(v));
export { E18 };

/** Ratio a/b as a percentage string with `dp` decimals, exact on bigints. */
export function pct(a: bigint, b: bigint, dp = 4): string {
  if (b === 0n) return "unknown";
  const scale = 10n ** BigInt(dp + 2);
  return `${fixed((a * scale) / b, dp, dp)}%`;
}

export function shortHash(h: string, n = 6): string {
  return h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h;
}

export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function dateTime(iso: string | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
