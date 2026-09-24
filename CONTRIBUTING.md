# Contributing to Keelflow

Keelflow is a long-term maintenance fork of Flowise. The priorities are, in order: security fixes, keeping existing flows and databases working, dependency updates, and bug fixes. New nodes and features are welcome when they are small and do not add remote calls or new default network exposure.

## Repository layout

- `packages/server` — Express API, database migrations, queue workers, CLI (`keelflow start | worker | user`)
- `packages/server/src/identity` — owner account, sessions, API key permissions
- `packages/components` — nodes and integrations (LangChain, LlamaIndex, vector stores, tools)
- `packages/ui` — React web interface
- `packages/api-documentation` — Swagger UI for the REST API

## Setup

Node.js 24 and pnpm 10.

```bash
pnpm install
pnpm build          # set NODE_OPTIONS=--max-old-space-size=4096 if the build runs out of memory
pnpm start          # http://localhost:3000
```

For UI work, run the server with `pnpm start` and the UI with hot reload with `pnpm --filter keelflow-ui dev`.

## Tests

```bash
pnpm --filter keelflow test               # server unit tests
pnpm --filter keelflow-components test    # node and utility tests
pnpm --filter keelflow-ui test            # UI tests
```

With a server running on a fresh database:

```bash
node packages/server/test/auth-flow.mjs http://localhost:3000
```

## Pull requests

- One topic per pull request; describe what changes for users.
- Add or update tests for behaviour you change.
- Database changes need a migration for SQLite, Postgres, MySQL and MariaDB that does nothing when the change is already there.
- Do not add requests to third-party services that run without the user configuring them.
- Keep existing `FLOWISE_*` environment variables, API routes and stored data formats working.

## Security issues

Do not open public issues for vulnerabilities; see [SECURITY.md](SECURITY.md).
