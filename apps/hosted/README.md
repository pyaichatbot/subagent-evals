# hosted

Minimal static-site + ingest scaffold for `subagent-evals.dev`.

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
