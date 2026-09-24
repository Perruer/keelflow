First release of **Keelflow**, the security-maintained continuation of Flowise. It starts from Flowise 3.1.4, the last Flowise release, and runs on the same databases, flows, credentials and API keys.

### Install

```bash
docker run -d --name keelflow -p 3000:3000 -v ~/.keelflow:/home/node/.keelflow ghcr.io/perruer/keelflow:3.2.0
```

Coming from the Flowise image? Keep your volume and change only the image: a volume at `/home/node/.flowise` is picked up automatically. See [Migrating from Flowise](https://github.com/Perruer/keelflow#migrating-from-flowise).

### Highlights

- **Apache-2.0 only.** Flowise's open source edition signed users in with code under the FlowiseAI Commercial License. That code is removed from the repository and its history, and replaced by an independent owner account with API keys and server-side sessions.
- **Security fixes** for advisories published after Flowise's end of life: cross-workspace credential access during flow runs (GHSA-27w2-26m5-x82c), unauthenticated registration (GHSA-v5w9-prxf-w882), the queue dashboard open to any signed-in user (GHSA-rpcc-gw54-mfgx); SSO account takeovers no longer apply because SSO is gone.
- **vm2 3.12.2**: closes the sandbox escapes in Custom Function and Custom Tool nodes.
- **Dependencies**: known advisories in the lockfile down from 385 to 153, critical from 19 to 1 (install-time only).
- **No calls home**: the web UI no longer loads an affiliate tracker, Google Fonts or the GitHub API, and the model list ships with the app.
- **Datasets, evaluations, evaluators and server logs** are available without a paid plan.
- **Tested upgrade path**: CI builds a database with the published `flowise@3.1.4` migrations and starts Keelflow on it; sign-in and API keys are checked on SQLite, Postgres, MySQL and MariaDB.

### Not carried over

SSO, invitations, roles, several users and switching workspaces (Flowise Enterprise features), Stripe billing, and the `@flowiseai/agentflow` / `@flowiseai/observe` SDKs.

Full list: [CHANGELOG.md](https://github.com/Perruer/keelflow/blob/main/CHANGELOG.md)
