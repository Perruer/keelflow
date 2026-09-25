A small release with fixes and one change to where new installations keep their data.

## Data folder

New installations keep their data in the platform's data folder instead of another dot folder in the home directory:

- Linux: `$XDG_DATA_HOME/keelflow` (by default `~/.local/share/keelflow`)
- macOS: `~/Library/Application Support/keelflow`
- Windows: `%LOCALAPPDATA%\keelflow`

Existing data is never moved. A `~/.keelflow` or `~/.flowise` that holds files keeps being used, and so does the `/home/node/.keelflow` volume in the Docker image. `KEELFLOW_HOME` still overrides everything. Thanks to the reader on Habr who suggested it.

## Fixes

- Evaluations fall back to the local server when `APP_URL` is not set.
- The stats endpoint answers a malformed request with a JSON 400 instead of echoing the parser error.
- The data and log folders are created together with their parent folders.

## Upgrade

```bash
docker pull ghcr.io/perruer/keelflow:3.2.1
```

Full list: [CHANGELOG](https://github.com/Perruer/keelflow/blob/main/CHANGELOG.md).
