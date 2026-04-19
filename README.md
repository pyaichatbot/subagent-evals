# subagent-evals

**The Codecov for markdown AI agents.**

Lint, eval, score, and ship agents for Claude Code, Codex, GitHub Copilot, Cursor, and Windsurf.

```bash
pnpm build
node packages/cli/dist/bin/subagent-evals.js lint .
```

Maintainer: **Praveen Yellamaraju**  

## What it does

`subagent-evals` evaluates markdown-defined AI agents at two layers:

- **Static** — quality heuristics: trigger clarity, scope, output contract, tool policy, model spec, adversarial guidance, and secret handling
- **Runtime** — assertion testing against fixture, replay snapshot, or live provider output

Auto-detects all agent formats in your repo. Works with every major AI coding tool.

## Supported formats

| Tool | Location | Format flag |
|---|---|---|
| Claude Code | `.claude/agents/*.md` | `claude-md` |
| OpenAI Codex | `.codex/agents/*.md` or `AGENTS.md` | `codex-md` |
| GitHub Copilot | `.github/copilot-instructions.md` | `copilot-instructions` |
| Cursor | `.cursor/rules/*.mdc` | `cursor-rules` |
| Windsurf | `.windsurf/rules/*.md` | `windsurf-config` |
| Generic | Any YAML-frontmatter `.md` glob | `generic-frontmatter-md` |

## Quickstart

The published npm command is not live until the CLI package is released to npm. Today, local development usage is:

```bash
pnpm install
pnpm build
node packages/cli/dist/bin/subagent-evals.js lint .
```

After npm release, the same flows will be available via `npx subagent-evals@latest ...`.

## CLI usage

```bash
# Zero-config: auto-detects all formats in your repo
node packages/cli/dist/bin/subagent-evals.js lint .

# Initialize config
node packages/cli/dist/bin/subagent-evals.js init

# Full eval with runtime assertions
node packages/cli/dist/bin/subagent-evals.js eval .

# Generate badge / diff / comment artifacts
node packages/cli/dist/bin/subagent-evals.js badge --input out/results.json --output out/badge.json
node packages/cli/dist/bin/subagent-evals.js diff --current out/results.json --baseline out/base-results.json --output out/diff.json
node packages/cli/dist/bin/subagent-evals.js comment --current out/results.json --baseline out/base-results.json --output out/pr-comment.md

# Generate HTML report from saved results
node packages/cli/dist/bin/subagent-evals.js report --input out/results.json --output out/report.html

# Submit to hosted leaderboard
node packages/cli/dist/bin/subagent-evals.js submit --input out/results.json --output out/submission.json
```

## Configuration

```yaml
# subagent-evals.config.yaml
discovery:
  format: auto
  roots: [.]
  dedup: false
  primary: claude-md
outputs:
  json: out/results.json
  html: out/report.html
  junit: out/results.junit.xml
  badge: out/badge.json
runtime:
  runner: command-runner
  mode: replay
  snapshot_dir: .subagent-evals/cache
  cache_key_strategy: v1
thresholds:
  fail_below: 0.55
```

## Growth features

- Marketplace-ready GitHub Action scaffold in the sibling repo target: `../subagent-evals-action`
- Badge JSON output for Shields.io at `out/badge.json`
- Baseline diff and PR comment artifact generation
- Provider runners: `claude-code-runner`, `openai-runner`, `anthropic-runner`
- Replay cache for deterministic CI runtime evals
- Hosted package and local scaffold for GitHub Pages repo pages, leaderboard, registry, and crawl ingestion

## Workflow packs and plugins

`subagent-evals` stays generic. Workflow-specific orchestration packs should live outside this repo.

- `multiagent-cli` owns its workflow prompts, commands, and eval fixtures
- `@subagent-evals/plugin-multiagent` is the optional scaffolder for installing the `multiagent-cli` workflow into Claude/Codex-style repos

This repo no longer vendors `multiagent-cli` integration fixtures under `integrations/`.

## Badge tiers

| Score | Badge |
|---|---|
| 0.90+ | `certified` |
| 0.75–0.89 | `strong` |
| 0.55–0.74 | `usable` |
| < 0.55 | `experimental` |

## Scoring dimensions

Static scoring currently averages these dimensions:

- `frontmatter`
- `trigger_clarity`
- `scope_calibration`
- `tool_policy`
- `output_contract`
- `model_spec`
- `adversarial_resilience`
- `secret_handling`
- `readability`

Missing `model_spec` currently scores `0.6`, missing `adversarial_resilience` scores `0.45`, and missing `secret_handling` scores `0.5`. Adding new dimensions can shift historical scores, so keep threshold changes explicit in repo policy.

## Assertion notes

- `not_contains` is treated as a hard-fail assertion. Use it for prohibited output, leaks, or policy violations where any match should fail the case immediately.

## Examples

- `examples/claude-project` — Claude Code agents
- `examples/codex-project` — Codex agents
- `examples/copilot-project` — Copilot instructions
- `examples/cursor-project` — Cursor rules
- `examples/windsurf-project` — Windsurf rules
- `examples/bad-project` — what `experimental` looks like

## License

MIT
