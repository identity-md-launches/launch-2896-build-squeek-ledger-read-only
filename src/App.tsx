import { useEffect, useState } from "react";
import { DOC, NET } from "./config";
import { lastAddress, rememberAddress, useRoute } from "./hooks";
import { isAddress } from "./api";
import { Home } from "./pages/Home";
import { SqueekPage } from "./pages/Squeek";
import { MergePage } from "./pages/Merge";
import { EarningsPage } from "./pages/Earnings";
import { NetworkPage } from "./pages/Network";

type Theme = "light" | "dark";
function initialTheme(): Theme {
  try {
    const t = localStorage.getItem("squeek-ledger:theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("squeek-ledger:theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const qa = route.query.get("a") ?? "";
  const address = isAddress(qa) ? qa.toLowerCase() : "";
  useEffect(() => {
    if (address) rememberAddress(address);
  }, [address]);
  const navAddr = address || lastAddress();
  const withA = (p: string) => (navAddr ? `#${p}?a=${navAddr}` : `#${p}`);
  const [page, arg] = route.path;
  const current = page ?? "";

  let body;
  if (page === "squeek" && arg) body = <SqueekPage id={arg} />;
  else if (page === "merge") body = <MergePage address={address || navAddr} />;
  else if (page === "earnings") body = <EarningsPage address={address || navAddr} />;
  else if (page === "network") body = <NetworkPage />;
  else if (!page) body = <Home address={address} />;
  else
    body = (
      <section className="section">
        <h1 className="pixel h1">Page not found</h1>
        <p>
          <a href="#/">Go to the start page</a>
        </p>
      </section>
    );

  const nav: [string, string, string][] = [
    ["", "Holdings", withA("/")],
    ["merge", "Merge", withA("/merge")],
    ["earnings", "Earnings", withA("/earnings")],
    ["network", "Network", "#/network"],
  ];
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => {
        e.preventDefault();
        const main = document.getElementById("main");
        main?.focus();
        main?.scrollIntoView();
      }}>
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <a className="brand pixel" href="#/" aria-label="Squeek Ledger home">
            <img src="./favicon.svg" alt="" width={24} height={24} />
            <span>Squeek Ledger</span>
          </a>
          <span className="net-pill">{NET.label}</span>
          <button
            type="button"
            className="btn btn-quiet btn-sm theme-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
        <nav className="wrap nav" aria-label="Main">
          {nav.map(([key, label, href]) => (
            <a key={key} href={href} aria-current={current === key || (key === "" && current === "squeek") ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" className="wrap" tabIndex={-1}>
        {body}
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p>Unofficial community tool, read-only. Data from api.squeekchain.com and Ethereum.</p>
          <p className="footer-links">
            <a href={DOC.home} target="_blank" rel="noreferrer">
              docs.squeekchain.com
            </a>
            <a href={DOC.genesis} target="_blank" rel="noreferrer">
              squeekchain.com/genesis
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
