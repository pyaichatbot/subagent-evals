# hosted

Minimal static-site + ingest scaffold for GitHub Pages hosting.

## Endpoints

- `POST /api/submit`
- `POST /api/crawl/enqueue`
- `GET /leaderboard.json`
- `GET /registry.json`
- `GET /r/{owner}/{repo}.json`

## Local run

```bash
pnpm build
node apps/hosted/server.mjs
```

## GitHub Pages

`pnpm build:pages` generates the static site into `apps/hosted/data/pages/`. The repo ships with `.github/workflows/deploy-pages.yml`, which builds that directory and deploys it to GitHub Pages on every push to `main` or manual dispatch.
