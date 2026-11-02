import { useEffect, useState, type FormEvent } from "react";
import { isAddress, ZERO } from "../api";

export function AddressForm({ initial, target = "/" }: { initial: string; target?: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => {
    setValue(initial);
    setError("");
  }, [initial]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!isAddress(v)) return setError("Enter 0x followed by 40 hex digits, for example a wallet address copied from Etherscan.");
    if (v.toLowerCase() === ZERO) return setError("The zero address holds no Squeeks. Paste a wallet address instead.");
    setError("");
    window.location.hash = `#${target}?a=${v.toLowerCase()}`;
  };
  return (
    <form className="addr-form" onSubmit={submit} noValidate>
      <label htmlFor="addr">Wallet address</label>
      <div className="addr-row">
        <input
          id="addr"
          name="address"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="0x…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "addr-err" : "addr-hint"}
        />
        <button type="submit" className="btn">
          Look up
        </button>
      </div>
      {error ? (
        <p id="addr-err" className="field-error" role="alert">
          {error}
        </p>
      ) : (
        <p id="addr-hint" className="field-hint">
          No wallet connection. Nothing is signed or sent.
        </p>
      )}
    </form>
  );
}
