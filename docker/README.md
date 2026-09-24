# Keelflow with Docker

The image `ghcr.io/perruer/keelflow` is built from the [Dockerfile](../Dockerfile) in the repository root for `linux/amd64` and `linux/arm64`. It runs as the non-root `node` user (uid 1000).

## Single container

```bash
docker run -d --name keelflow -p 3000:3000 -v ~/.keelflow:/home/node/.keelflow ghcr.io/perruer/keelflow:latest
```

Or with compose:

1. Copy `.env.example` to `.env` and adjust it.
2. `docker compose up -d`
3. Open http://localhost:3000 and create the owner account.

If you bind-mount a host folder, it must be writable by uid 1000: `chown -R 1000:1000 ~/.keelflow` on Linux.

## Coming from the Flowise image

Keep your volume and environment and change only the image:

```bash
docker run -d --name keelflow -p 3000:3000 -v ~/.flowise:/home/node/.flowise ghcr.io/perruer/keelflow:latest
```

Keelflow uses `/home/node/.flowise` while `/home/node/.keelflow` is empty. If your compose file sets `DATABASE_PATH`, `SECRETKEY_PATH`, `LOG_PATH` or `BLOB_STORAGE_PATH`, those keep working as before.

## Queue mode

A main instance puts executions on a Redis queue and workers run them. Both use the same image; workers start with the `worker` command.

- [docker-compose-queue-prebuilt.yml](docker-compose-queue-prebuilt.yml) — published image, Redis, one worker
- [docker-compose-queue-source.yml](docker-compose-queue-source.yml) — builds the image from this repository

```bash
docker compose -f docker-compose-queue-prebuilt.yml up -d
```

Main and workers must share the database, the encryption key (`SECRETKEY_PATH` or `FLOWISE_SECRETKEY_OVERWRITE`), storage and `QUEUE_NAME`.

## Useful commands

```bash
docker logs -f keelflow
docker exec keelflow node /app/bin/run user owner@example.com 'New-password-1'   # reset the owner's password
```

All settings are listed in [.env.example](.env.example).
