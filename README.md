<p align="center">
  <img src="https://raw.githubusercontent.com/Perruer/keelflow/main/images/keelflow_light.png#gh-light-mode-only" width="360" alt="Keelflow">
  <img src="https://raw.githubusercontent.com/Perruer/keelflow/main/images/keelflow_dark.png#gh-dark-mode-only" width="360" alt="Keelflow">
</p>

<p align="center">
  <b>Build AI agents and LLM workflows visually. Self-hosted, security-maintained continuation of Flowise.</b>
</p>

<p align="center">
  <a href="https://github.com/Perruer/keelflow/actions/workflows/main.yml"><img src="https://github.com/Perruer/keelflow/actions/workflows/main.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Perruer/keelflow/releases"><img src="https://img.shields.io/github/v/release/Perruer/keelflow" alt="Release"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0"></a>
</p>

<p align="center">English · <a href="README.ru.md">Русский</a></p>

---

Flowise was archived on August 13, 2026 and reached end of life on August 31. Security advisories kept being published after that without fixes, and thousands of instances are still reachable from the internet.

Keelflow starts from Flowise 3.1.4 and keeps it safe to run: vulnerabilities fixed, dependencies updated, and every file under the Apache-2.0 license. Your flows, credentials, API keys and database work as they are.

## What's different from Flowise 3.1.4

| | Flowise 3.1.4 | Keelflow 3.2 |
| --- | --- | --- |
| License | Apache-2.0 plus the FlowiseAI Commercial License: the sign-in code of the open source edition was commercial | Apache-2.0 only. The commercial code is removed from the history and replaced by an independent implementation |
| Accounts | Owner (open source); users, roles, SSO (paid) | One owner account plus API keys with per-permission scopes |
| Sessions | JWT in cookies | Server-side sessions with hashed tokens; a password change signs out everywhere; sign-in throttling |
| Known advisories in dependencies | 385 (19 critical) | 153 (1 critical, install-time only) |
| Custom JavaScript sandbox | vm2 3.11.2 with 9 critical sandbox escapes | vm2 3.12.2 |
| Datasets, evaluations, evaluators, server logs | Paid plans only | Included |
| Third-party requests from the web UI | Rewardful affiliate tracker, Google Fonts, GitHub API on every page | None |
| Model list | Fetched from GitHub on every use | Shipped with the app; a custom URL or file is optional |
| `X-Forwarded-For` | Trusted from anyone by default | Trusted from local and private networks by default |

Fixed advisories and hardening are listed in the [changelog](CHANGELOG.md). Everything that is not listed there works as in Flowise 3.1.4: the same nodes, agentflows, document stores, API and embed widget.

## Quick start

### Docker

```bash
docker run -d --name keelflow -p 3000:3000 -v ~/.keelflow:/home/node/.keelflow ghcr.io/perruer/keelflow:latest
```

Open http://localhost:3000 and create the owner account. Images are built for `linux/amd64` and `linux/arm64`.

A `docker compose` setup (with queue mode and Postgres examples) is in [docker/](docker/).

### From source

Node.js 24 and pnpm 10 are required.

```bash
git clone https://github.com/Perruer/keelflow.git
cd keelflow
pnpm install
pnpm build        # needs about 4 GB of memory: export NODE_OPTIONS=--max-old-space-size=4096
pnpm start
```

## Migrating from Flowise

1. Stop Flowise and back up its data folder (`~/.flowise`) or database.
2. Start Keelflow on the same data:
    - **Docker:** replace the image `flowiseai/flowise` with `ghcr.io/perruer/keelflow` and keep your volumes and environment variables. A volume mounted at `/home/node/.flowise` is picked up automatically.
    - **Source or npm install:** Keelflow uses `~/.flowise` as long as `~/.keelflow` does not exist. `DATABASE_*`, `SECRETKEY_PATH`, `FLOWISE_SECRETKEY_OVERWRITE` and the other `FLOWISE_*` variables keep their names.
3. Sign in with the owner's email and password from Flowise. Credentials stay readable as long as the encryption key is the same.

What does not carry over: other user accounts (from Flowise Enterprise), SSO, invitations, roles and switching between several workspaces. API keys keep working with the permissions they had. If a database from Flowise Enterprise has several workspaces, choose the one to use with `KEELFLOW_WORKSPACE_ID`.

The `@flowiseai/agentflow` and `@flowiseai/observe` SDK packages are not part of Keelflow.

## Configuration

Settings are environment variables; see [packages/server/.env.example](packages/server/.env.example). Those added by Keelflow:

| Variable | Default | |
| --- | --- | --- |
| `KEELFLOW_HOME` | `~/.keelflow` | Folder for the SQLite database, encryption key, uploads and logs |
| `SESSION_EXPIRY_IN_MINUTES` | `10080` (7 days) | A sign-in ends after this long without use |
| `SESSION_MAX_AGE_IN_MINUTES` | `43200` (30 days) | A sign-in ends after this long in any case |
| `TRUST_PROXY` | local and private networks | `true` trusts every proxy, as Flowise did |
| `KEELFLOW_WORKSPACE_ID` | oldest workspace | Only for databases from Flowise Enterprise |

Forgot the owner's password? Reset it on the server; this also ends every existing sign-in:

```bash
docker exec keelflow node /app/bin/run user owner@example.com 'New-password-1'
```

From a source checkout the same command is `pnpm user owner@example.com 'New-password-1'`.

## Documentation

The [Flowise documentation](https://docs.flowiseai.com) describes nodes, flows, the API and the embed widget, and applies to Keelflow. Sign-in, users and SSO work differently, as described above.

## Security

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/Perruer/keelflow/security/advisories/new). See [SECURITY.md](SECURITY.md).

Custom JavaScript nodes and tools run in vm2. It is not a strong isolation boundary: only let people you trust edit flows, and set `E2B_APIKEY` to run code in E2B sandboxes instead.

## Support the project

Keelflow is maintained in my free time. If it keeps your agents running, you can support it:

- [Boosty](https://boosty.to/mikio_kuroki/donate)
- USDT / TRX (TRC-20): `TXUBW4e88SDTfrnJRKfbhYfFcggufbonc1`
- USDT / USDC / ETH (ERC-20): `0x1378491169064702786b2E5b58c6375776177E8A`
- TON / USDT (TON): `UQAhI7EKzoa-JuKOfv0ULMzA3FrmpxsDkXj8Qevwj2z1cMRN`

## License

[Apache-2.0](LICENSE.md). Keelflow is a fork of [Flowise](https://github.com/FlowiseAI/Flowise) by FlowiseAI, Inc.; see [NOTICE](NOTICE). Keelflow is not affiliated with or endorsed by FlowiseAI, Inc.
