# subagent-evals

`subagent-evals` is an OSS eval harness for markdown-defined agents and subagents.

It evaluates `.md` agents at two layers:

- static quality of the markdown file itself
- runtime behavior on fixture or live tasks

It is markdown-subagent native, local-first, CI-friendly, and adapter-based rather than tied to one host.

Maintainer: **Praveen Yellamaraju**  
Contact: `pyaichatbot@gmail.com`

## What you get

- `@subagent-evals/core`: discovery, normalization, evaluators, runner adapters, result schema
- `@subagent-evals/cli`: `init`, `discover`, `lint`, `eval`, `report`
- `@subagent-evals/report-html`: offline HTML report renderer

## Quickstart

```bash
pnpm install
pnpm test
pnpm build
node packages/cli/dist/bin/subagent-evals.js init --cwd /tmp/demo
```

## Supported in v1

- Claude-style markdown subagents from `.claude/agents/*.md`
- generic frontmatter-based markdown agent files
- static heuristics for scope, trigger clarity, output contract, tool-policy mismatches
- runtime assertions for output text and tool trajectory constraints
- HTML, JSON, and JUnit outputs

## Example config

```yaml
discovery:
  roots:
    - .claude/agents
  globs:
    - "**/*.md"
  format: claude-md
runtime:
  runner: command-runner
  command: node
  args:
    - ./subagent-evals/example-runner.mjs
outputs:
  json: out/results.json
  junit: out/results.junit.xml
  html: out/report.html
```

## Example workflow

```bash
node packages/cli/dist/bin/subagent-evals.js init --cwd .
node packages/cli/dist/bin/subagent-evals.js discover --cwd .
node packages/cli/dist/bin/subagent-evals.js lint --cwd .
node packages/cli/dist/bin/subagent-evals.js eval --cwd .
node packages/cli/dist/bin/subagent-evals.js report --input out/results.json --output out/report.html
```

## Sample projects

- [examples/claude-project](/Users/spy/Documents/PY/AI/multi-agent-orchestration/subagent-evals/examples/claude-project)
- [examples/generic-project](/Users/spy/Documents/PY/AI/multi-agent-orchestration/subagent-evals/examples/generic-project)
- [examples/bad-project](/Users/spy/Documents/PY/AI/multi-agent-orchestration/subagent-evals/examples/bad-project)

## CI example

See [examples/github-action.yml](/Users/spy/Documents/PY/AI/multi-agent-orchestration/subagent-evals/examples/github-action.yml).
