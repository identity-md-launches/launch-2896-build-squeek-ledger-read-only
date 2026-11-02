# Squeek Ledger

A static, read-only companion for Squeek holders. Paste an Ethereum address to inspect wallet and staked Squeeks, plan merges and estimate earnings. All runtime data comes directly from the public Squeekchain API. There is no wallet connector, signing, transaction submission or backend database.

## Install, develop and rebuild

With Node.js and npm installed, run:

```sh
npm ci
npm run dev
```

To check and rebuild the delivered export:

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

`npm run build` typechecks, runs Vite with `base: "./"`, then runs `scripts/export-routes.mjs`. The complete production site is in `dist/`, including local fonts, favicon and share image. Publish that directory as-is. Dependencies and package caches are not part of the export.

To inspect the export on a plain static server, without an application fallback:

```sh
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173/`. Serve over HTTP rather than opening HTML as a local file.

## Routes and data

| View | URL | Public data |
| --- | --- | --- |
| Holdings | `/#/?a={address}` | `/v1/accounts/{address}`, following `nextCursor`; images from `/v1/squeeks/{id}` |
| Squeek | `/squeek/{id}/` | `/v1/squeeks/{id}`, player events and paginated account activity |
| Merge planner | `/#/merge?a={address}` | Account tokens and `/v1/economy/state` level/cooldown tables |
| Earnings | `/#/earnings?a={address}` | Account/economy power and `/v1/settlements?range=7d` |
| Network | `/#/network` | `/v1/status`, `/v1/core`, `/v1/economy/state`; every 10 seconds while visible |

Token links use the pathname URL. The build emits compact directory entry pages for every documented valid ID, 1–9999, sharing one application bundle. A directory-index server redirects `/squeek/1166` to `/squeek/1166/` and serves the token view without rewrite rules. Relative asset references and a stable document base also support a gateway subpath. Existing `/#/squeek/{id}` bookmarks remain aliases.

History recovers a burned donor's last account from the paginated player feed, then follows earlier `transfer.from` accounts. It follows all account activity cursors, deduplicates the same source log across feeds/accounts, and sorts newest first. Busy former holders can require many requests before history finishes. An unavailable source produces an incomplete-history message and retry, preserving any known rows.

Requests revalidate permitted ETags. Only simultaneous requests share a promise; settled `no-store` responses are not memoized. Unknown API states are not treated as zero or empty. The browser saves only theme, last address and selected merge IDs in local storage.

## Sources and limits

The source of truth is [Squeekchain's full developer documentation](https://docs.squeekchain.com/llms-full.txt), particularly [API availability](https://docs.squeekchain.com/developers/api/#availability), [caching](https://docs.squeekchain.com/developers/api/#caching), [events](https://docs.squeekchain.com/developers/api/#events) and [account activity](https://docs.squeekchain.com/developers/api/#account-activity). Figure/formula links are beside the relevant values in the UI. Formulas use integer arithmetic; a merge is a local simulation.

The API reports rewards for the account, not individual NFTs. The estimator uses recent observed issuance and block rate, with the documented block reward as its fallback, and explains differences between the API's current schedule and the documentation. Estimates are not guaranteed earnings.

`src/config.ts` contains `ACTIVE_NETWORK` and both network configurations. Sepolia is selected today. Switching to mainnet also depends on the upstream API/deployment being published for mainnet; unpublished contract addresses remain `null`, never guessed. API contract identities are compared with the docs record and differences are disclosed.

## Revision validation

Production build and explicit typecheck passed. All 19 unit tests, 11 Chromium interaction checks and 16 taste@1 checks passed. Six axe accessibility scans reported no violations. Live token histories and static subpath routing were also checked. WebKit could not launch because its required system libraries were unavailable; Safari remains unverified. See [the validation record](artifacts/validation.md) for scope, evidence and remaining limitations, and [DESIGN.md](DESIGN.md) for the implemented design system.
