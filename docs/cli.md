# CLI Reference

## `init`

Scaffold config, starter cases, and sample agents.

```bash
npx subagent-evals@latest init
npx subagent-evals@latest init --format codex-md
```

## `discover`

Print normalized discovered agents as JSON.

```bash
npx subagent-evals@latest discover .
```

## `lint`

Run static evaluation only.

```bash
npx subagent-evals@latest lint .
```

Exits non-zero when:

- any agent is `experimental`
- `thresholds.fail_below` is set and an agent falls below it

## `eval`

Run static and runtime evaluation.

```bash
npx subagent-evals@latest eval .
```

Writes JSON, JUnit, HTML, and badge outputs.

Exits non-zero when:

- any runtime case fails
- a configured static threshold is violated

## `badge`

Generate Shields-compatible badge JSON from results.

```bash
npx subagent-evals@latest badge --input out/results.json --output out/badge.json
```

## `diff`

Compare current results to a baseline.

```bash
npx subagent-evals@latest diff \
  --current out/results.json \
  --baseline out/base-results.json \
  --output out/diff.json
```

## `comment`

Render a PR comment markdown artifact from current + baseline results.

```bash
npx subagent-evals@latest comment \
  --current out/results.json \
  --baseline out/base-results.json \
  --output out/pr-comment.md
```

## `report`

Render HTML from a saved results file.

```bash
npx subagent-evals@latest report --input out/results.json --output out/report.html
```

## `submit`

Create a hosted submission payload from saved results.

```bash
npx subagent-evals@latest submit --input out/results.json --output out/submission.json
```

Public submission metadata:

```bash
npx subagent-evals@latest submit \
  --input out/results.json \
  --public \
  --owner pyaichatbot \
  --repo subagent-evals \
  --output out/submission.json
```
