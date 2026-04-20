# Replay Bundles and Diff Artifacts

Replay bundles are the documented MVP artifact for making runtime evals portable and reproducible.

## What a replay bundle is for

A replay bundle is intended to capture one normalized execution so it can be:

- replayed in CI without paying for another live model call
- compared against a later model run
- attached to hosted results for reproduction
- imported into another workspace for debugging

## Planned replay bundle contents

The roadmap bundle format is intended to include:

- normalized case input
- runner id
- model id
- cache key
- artifact output
- tool/trace events
- token usage
- duration / latency
- corpus pack id and version
- optional attestation metadata

## Related artifacts

The same trust wave also documents:

- `model-diff.json`
- `audit.json`
- `shadow-eval.json`

### `model-diff.json`

Compares two runner/model targets on the same case set:

- score delta
- assertion delta
- telemetry delta
- parity summary

### `audit.json`

Captures dependency and trust-hygiene checks:

- manifest inventory
- pinned vs floating dependency findings
- suspicious package names
- license markers

### `shadow-eval.json`

Stores comparison-only PR data without blocking merge:

- current summary
- baseline summary
- regressions
- parity or drift notes

## Example files

This repo includes example artifacts under:

- [`../examples/replay-bundles/stable-reviewer-bundle.json`](../examples/replay-bundles/stable-reviewer-bundle.json)
- [`../examples/replay-bundles/unstable-reviewer-bundle.json`](../examples/replay-bundles/unstable-reviewer-bundle.json)
- [`../examples/replay-bundles/model-diff-example.json`](../examples/replay-bundles/model-diff-example.json)
- [`../examples/replay-bundles/audit-example.json`](../examples/replay-bundles/audit-example.json)
- [`../examples/replay-bundles/shadow-eval-example.json`](../examples/replay-bundles/shadow-eval-example.json)

These examples are documentation fixtures. They show the intended artifact shape without claiming that every field is already emitted by the current build.
