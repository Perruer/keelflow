# Changelog

## 3.2.1 — 2026-09-25

### Changed

- New installations keep their data in the platform's data folder instead of another dot folder in the home directory: `$XDG_DATA_HOME/keelflow` (by default `~/.local/share/keelflow`) on Linux, `~/Library/Application Support/keelflow` on macOS, `%LOCALAPPDATA%\keelflow` on Windows. Existing data is never moved: a `~/.keelflow` or `~/.flowise` that holds files keeps being used, and so does an empty `~/.keelflow` such as the volume mount point in the Docker image. `KEELFLOW_HOME` still overrides everything.

### Fixed

- Evaluations fall back to the local server when `APP_URL` is not set.
- The stats endpoint answers a malformed request with a JSON 400 instead of echoing the parser error.
- The data and log folders are created with their parent folders.

## 3.2.0 — 2026-09-24

First Keelflow release, based on Flowise 3.1.4 (the last Flowise release, July 29, 2026). Databases, flows, credentials and API keys from Flowise 3.x work without changes.

### License

- Removed all code under the FlowiseAI Commercial License (`packages/server/src/enterprise`, `IdentityManager.ts`) from the repository and its history. Flowise's open source edition needed that code to sign in; Keelflow replaces it with an independent implementation. Every file is now under Apache-2.0 ([NOTICE](NOTICE)).

### Accounts and sign-in

- One owner account (email and password) plus API keys with per-permission scopes.
- The first visit creates the owner; registration is closed as soon as any account exists (fixes the unauthenticated registration of GHSA-v5w9-prxf-w882 for every setup).
- Server-side sessions: the cookie holds a random token, the database stores only its SHA-256. Sessions end after 7 days without use and after 30 days in any case (`SESSION_EXPIRY_IN_MINUTES`, `SESSION_MAX_AGE_IN_MINUTES`).
- Changing the password in the UI, or resetting it with `keelflow user <email> <password>`, ends every session.
- Sign-in is throttled: 10 failures within 15 minutes per IP address and per email.
- API keys can no longer reach account endpoints (`/api/v1/user`, `/api/v1/auth`).
- The queue dashboard (`/admin/queues`) requires the owner's session; any signed-in user could open it before (GHSA-rpcc-gw54-mfgx).
- SSO, invitations, roles, organization and workspace management, and Stripe billing are removed. The SSO account takeover issues GHSA-vf3j-89vf-r697 and GHSA-cffm-583c-vffr no longer apply.

### Security fixes

- Flows could decrypt a credential from another workspace by referencing its id (GHSA-27w2-26m5-x82c): credential lookups during flow runs are limited to the flow's workspace.
- vm2 3.11.2 → 3.12.2: closes the sandbox escapes that let Custom Function and Custom Tool code run on the host.
- `expr-eval` (code execution, no fixed release) replaced with `expr-eval-fork` 3.0.3.
- Updated or pinned about 60 vulnerable dependencies (axios, handlebars, fast-xml-parser, langchain 0.3, langsmith, mysql2, xmldom, lodash, js-yaml, multer, ws, sharp, playwright, basic-ftp and others); `xlsx` comes from SheetJS's own distribution (0.20.3). Advisories reported for the lockfile: 385 → 153; critical 19 → 1 (install-time only). See [SECURITY.md](SECURITY.md) for what remains.
- Removed dependencies that only the deleted code used: passport and its strategies, express-session and its stores, jsonwebtoken, nodemailer, stripe.

### Privacy and hardening

- The web UI no longer loads the Rewardful affiliate tracker (`r.wdfl.co`) or Google Fonts, and no longer queries the GitHub API on every page. Fonts are bundled.
- The model list ships with the app. Flowise downloaded it from GitHub on every use; set `MODEL_LIST_CONFIG_JSON` to use your own file or URL (cached for an hour).
- `X-Forwarded-For` is trusted only from loopback, link-local and private addresses unless `TRUST_PROXY` says otherwise. Flowise trusted every client, so anyone could choose the IP that rate limiting saw.

### Features available without a paid plan

- Datasets, evaluations, evaluators and the server log viewer.

### Other changes

- Renamed to Keelflow: packages `keelflow`, `keelflow-components`, `keelflow-ui`; CLI `keelflow`. `FLOWISE_*` environment variables, API routes, webhook headers and metric names are unchanged.
- Data folder: `~/.keelflow`, or an existing `~/.flowise` while `~/.keelflow` is empty; `KEELFLOW_HOME` sets it explicitly.
- Docker image `ghcr.io/perruer/keelflow`: multi-stage build that ships only production files.
- Removed the `@flowiseai/agentflow` and `@flowiseai/observe` SDK packages.
