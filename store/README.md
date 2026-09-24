# Release checklist (maintainer notes)

Files here are not part of the app.

- `github-release-v3.2.0.md` — notes for the GitHub release; the Release workflow uses `store/github-release-<tag>.md` for the draft.
- `social-preview.png` (1280×640) — upload in the repository's Settings → General → Social preview. Source: `social-preview.svg`.

After creating the repository:

1. Settings → General → Features: tick **Sponsorships** so the Sponsor button uses `.github/FUNDING.yml`.
2. Settings → General → Social preview: upload `store/social-preview.png`.
3. Settings → Code security: enable private vulnerability reporting, Dependabot alerts and security updates.
4. Push a `v*` tag: the Release workflow publishes `ghcr.io/perruer/keelflow` (amd64 + arm64) and drafts the release.
5. Packages → keelflow → Package settings: make the package public so `docker pull` works without signing in.
