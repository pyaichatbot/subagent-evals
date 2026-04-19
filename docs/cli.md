# CLI Reference

## `init`

Scaffold config, starter cases, and sample agents.

```bash
node packages/cli/dist/bin/subagent-evals.js init
node packages/cli/dist/bin/subagent-evals.js init --format codex-md
```

## `discover`

Print normalized discovered agents as JSON.

```bash
node packages/cli/dist/bin/subagent-evals.js discover .
```

## `lint`

Run static evaluation only.

```bash
node packages/cli/dist/bin/subagent-evals.js lint .
```

Exits non-zero when:

- any agent is `experimental`
- `thresholds.fail_below` is set and an agent falls below it

## `eval`

Run static and runtime evaluation.

```bash
node packages/cli/dist/bin/subagent-evals.js eval .
```

Writes JSON, JUnit, HTML, and badge outputs.

Exits non-zero when:

- any runtime case fails
- a configured static threshold is violated

## `badge`

Generate Shields-compatible badge JSON from results.

```bash
node packages/cli/dist/bin/subagent-evals.js badge --input out/results.json --output out/badge.json
```

## `diff`

Compare current results to a baseline.

```bash
node packages/cli/dist/bin/subagent-evals.js diff \
  --current out/results.json \
  --baseline out/base-results.json \
  --output out/diff.json
```

## `comment`

Render a PR comment markdown artifact from current + baseline results.

```bash
node packages/cli/dist/bin/subagent-evals.js comment \
  --current out/results.json \
  --baseline out/base-results.json \
  --output out/pr-comment.md
```

## `report`

Render HTML from a saved results file.

```bash
node packages/cli/dist/bin/subagent-evals.js report --input out/results.json --output out/report.html
```

## `submit`

Create a hosted submission payload from saved results.

```bash
node packages/cli/dist/bin/subagent-evals.js submit --input out/results.json --output out/submission.json
```

Public submission metadata:

```bash
node packages/cli/dist/bin/subagent-evals.js submit \
  --input out/results.json \
  --public \
  --owner pyaichatbot \
  --repo subagent-evals \
  --output out/submission.json
```
