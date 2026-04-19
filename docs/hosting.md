# GitHub Pages Hosting

`subagent-evals` ships a hosted static site scaffold for public results.

## What gets hosted

The hosted site is for published eval results, not the CLI itself.

Generated pages include:

- homepage
- leaderboard
- per-repo result pages
- `leaderboard.json`
- `registry.json`
- `robots.txt`
- `sitemap.xml`

For this repository, the site lives at:

- `https://pyaichatbot.github.io/subagent-evals/`

## Build the site locally

```bash
pnpm build:pages
```

This generates static output under:

- `apps/hosted/data/pages/`

That directory is ignored in git and produced in CI for deployment.

## Automatic deployment

GitHub Pages deployment is handled by:

- `.github/workflows/deploy-pages.yml`

It runs on:

- pushes to `main`
- manual workflow dispatch

## One-time GitHub setup

In the GitHub repo:

1. Open `Settings > Pages`
2. Set the source to `GitHub Actions`

After that, pushes to `main` deploy automatically.

## Important for project Pages

This repo uses a project Pages URL, so all hosted routes must stay under the repo subpath:

- correct: `https://pyaichatbot.github.io/subagent-evals/leaderboard`
- wrong: `https://pyaichatbot.github.io/leaderboard`

The hosted renderer is configured to generate links under `/subagent-evals/`.
