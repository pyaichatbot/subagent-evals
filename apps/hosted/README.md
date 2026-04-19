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

Publish `apps/hosted/data/pages/` with GitHub Pages, or copy those generated files into your Pages publish directory in CI.
