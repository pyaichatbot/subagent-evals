# Getting Started

## Install

The npm package is not published yet. Use the local built CLI:

```bash
pnpm install
pnpm build
node packages/cli/dist/bin/subagent-evals.js lint .
```

## Supported agent formats

| Tool | Location | Format |
| --- | --- | --- |
| Claude Code | `.claude/agents/*.md` | `claude-md` |
| OpenAI Codex | `.codex/agents/*.md`, `AGENTS.md` | `codex-md` |
| GitHub Copilot | `.github/copilot-instructions.md` | `copilot-instructions` |
| Cursor | `.cursor/rules/*.mdc` | `cursor-rules` |
| Windsurf | `.windsurf/rules/*.md` | `windsurf-config` |
| Generic markdown | YAML frontmatter `.md` files | `generic-frontmatter-md` |

## Quickstart

Initialize a starter project:

```bash
node packages/cli/dist/bin/subagent-evals.js init
```

Run static linting:

```bash
node packages/cli/dist/bin/subagent-evals.js lint .
```

Run a full evaluation:

```bash
node packages/cli/dist/bin/subagent-evals.js eval .
```

Generate an HTML report:

```bash
node packages/cli/dist/bin/subagent-evals.js report --input out/results.json --output out/report.html
```

## Outputs

Default outputs:

- `out/results.json`
- `out/results.junit.xml`
- `out/report.html`
- `out/badge.json`

## Scoring

Badge tiers:

- `certified`: `0.90+`
- `strong`: `0.75–0.89`
- `usable`: `0.55–0.74`
- `experimental`: `< 0.55`

Static scoring includes frontmatter, role clarity, scope, tool policy, output contract, model declaration, adversarial guidance, secret handling, and readability.
