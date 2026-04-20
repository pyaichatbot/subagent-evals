# Security Corpus Packs

Security corpus packs are the documented MVP format for reusable prompt-injection, jailbreak, exfiltration, traversal, and robustness cases.

## Why corpus packs exist

They give teams a stable, versioned set of hostile fixtures so they can:

- replay the same security cases in CI
- compare models and runners on the same attacks
- publish reproducible evidence with hosted results

## Planned pack shape

Each pack is intended to carry:

- `pack_id`
- `pack_version`
- `pack_type`
- `created_at`
- `cases`
- `expected_assertions`
- `signature`
- `attestation`

Each case is intended to include:

- `case_id`
- `attack_family`
- input payloads
- optional fetched-content payload
- expected refusal or containment behavior
- optional scope constraints
- optional schema constraints
- optional telemetry thresholds

## Example pack types

Tier 1 pack families:

- prompt injection
- jailbreak
- indirect injection
- data exfiltration
- path traversal
- tool scope containment

Tier 2 pack families:

- RCE
- SSRF
- adversarial diff
- unicode homoglyph
- retry drift
- cross-host parity fixtures

## Signing model

The roadmap defaults to **Sigstore/cosign**.

Intended policy:

- released packs are signed
- CI can require signed packs
- local development can opt into unsigned packs explicitly

Until the engine-side verification lands, treat the examples in this repo as format guidance rather than an enforced security boundary.

## Example files

This repo includes example pack documents under:

- [`../examples/security-corpus/prompt-security-pack.yaml`](../examples/security-corpus/prompt-security-pack.yaml)
- [`../examples/security-corpus/red-team-pack.yaml`](../examples/security-corpus/red-team-pack.yaml)

Use them as templates for:

- prompt injection fixtures
- data exfiltration fixtures
- traversal fixtures
- hostile diff fixtures
- unicode confusion fixtures
