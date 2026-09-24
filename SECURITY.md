# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/Perruer/keelflow/security/advisories/new). Please include the affected version, steps to reproduce, and the impact. I aim to reply within a week.

Vulnerabilities in Flowise 3.1.4 and earlier are in scope when they also affect Keelflow: Flowise no longer accepts reports, so this is the place to send them.

## Supported versions

Only the latest Keelflow release gets fixes.

## Security model

- **One owner account.** The owner can do everything, including editing flows that run code. Anyone with the owner's password or an active session has full control of the instance.
- **API keys** carry explicit permissions (for example `chatflows:view`). They cannot manage the account or API keys unless given `apikeys:*` permissions.
- **Public endpoints.** Prediction, chatbot config, uploads for chat and a few others are public by design so chatbots can be embedded. Protect a flow by assigning it an API key.
- **Custom JavaScript** (Custom Function, Custom Tool and similar nodes) runs in vm2, which has a long history of sandbox escapes. Treat anyone who can edit flows as able to run code on the server. Set `E2B_APIKEY` to run such code in E2B sandboxes instead.
- **Outgoing requests** from nodes are checked against a deny list of private and metadata addresses (`HTTP_SECURITY_CHECK`, `HTTP_DENY_LIST`). Local MCP servers over stdio are off unless `CUSTOM_MCP_PROTOCOL=stdio` and `CUSTOM_MCP_ALLOWED_COMMANDS` are set.

## Recommended deployment

- Put Keelflow behind HTTPS and set `SECURE_COOKIES=true`.
- Do not expose it to the internet unless you need public chatbots; restrict the admin UI by network or reverse proxy where you can.
- Keep `TRUST_PROXY` at its default unless your reverse proxy is on a public address.
- Back up the encryption key (`encryption.key` in the data folder, or `FLOWISE_SECRETKEY_OVERWRITE`): credentials cannot be decrypted without it.

## Known issues in dependencies

`npm audit`-style scans still report advisories in packages used only while installing or building (`tar`, `extract-zip`, `vite`, `svgo`, `postcss`, `serialize-javascript`), in `ip-address` inside proxy agents, and in `jsondiffpatch` used by the Vercel AI SDK. They are tracked and updated as fixed versions become usable.
