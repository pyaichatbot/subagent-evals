# Trust Roadmap MVP

This document covers the documentation and example contract for the next `subagent-evals` trust wave.

It is intentionally split into:

- **Current engine surface** — what exists today
- **Roadmap MVP surface** — the target interface for upcoming determinism, corpus, replay, diff, audit, and shadow-eval work

## Current engine surface

Today the engine already goes beyond plain linting:

- static dimensions include adversarial guidance and secret handling
- runtime assertions already include prompt-injection, jailbreak, red-team, secret-exfiltration, `not_contains`, and file-scope checks
- replay and live runner modes already exist in baseline form

## Roadmap MVP surface

The next trust layer is documented around five grouped result sections:

- `determinism`
- `security`
- `robustness`
- `supply_chain`
- `telemetry`

### Determinism

Planned fields and checks:

- `determinism_score`
- `output_schema_lock`
- `retry_stability`

Intent:

- prove that a case produces stable output over repeated runs
- lock structured output to a schema
- capture whether retries converge or drift

### Security

Planned additions:

- `indirect_injection_resistance`
- `tool_scope_containment`
- `data_exfiltration_resistance`
- `path_traversal_resistance`
- `rce_resistance`
- `ssrf_resistance`

Intent:

- cover prompt-level attacks, fetched-content attacks, filesystem escapes, and out-of-scope tool behavior

### Robustness

Planned additions:

- `adversarial_diff_resilience`
- `unicode_homoglyph_resistance`
- `refusal_calibration`

Intent:

- measure whether an agent stays trustworthy under hostile review text, confusing unicode, or mixed benign/harmful prompts

### Supply chain

Planned additions:

- `supply_chain_awareness`
- `license_hygiene`

Intent:

- flag floating dependency specs, suspicious package names, and license contamination risk

### Telemetry

Telemetry is planned as reporting-only by default:

- `latency_ms`
- `tokens_input`
- `tokens_output`
- `tokens_total`
- `estimated_cost_usd`
- `tool_calls`
- `runner_id`
- `model_id`
- `corpus_pack_id`
- `replay_bundle_id`

Telemetry should not change badge tiers by default.

## Artifacts in the MVP

Planned artifact families:

- `results.json` — current aggregate eval result
- `replay-bundle.json` — deterministic execution payload for reuse
- `model-diff.json` — side-by-side runner/model comparison
- `audit.json` — dependency, license, and package-hygiene report
- `shadow-eval.json` — non-gating PR comparison artifact

See:

- [`./security-corpus.md`](./security-corpus.md)
- [`./replay-bundles.md`](./replay-bundles.md)
- [`../examples/security-corpus`](../examples/security-corpus)
- [`../examples/replay-bundles`](../examples/replay-bundles)
