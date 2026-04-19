# Configuration

Default config file: `subagent-evals.config.yaml`

## Minimal example

```yaml
discovery:
  format: auto
  roots:
    - .

runtime:
  runner: command-runner
  mode: replay
  snapshot_dir: .subagent-evals/cache
  cache_key_strategy: v1

outputs:
  json: out/results.json
  html: out/report.html
  junit: out/results.junit.xml
  badge: out/badge.json

thresholds:
  fail_below: 0.55
```

## Discovery

Fields:

- `format`: `auto`, `claude-md`, `codex-md`, `copilot-instructions`, `cursor-rules`, `windsurf-config`, `generic-frontmatter-md`
- `roots`: directories to scan
- `globs`: optional explicit globs
- `dedup`: collapse duplicate logical agents across formats
- `primary`: preferred format when deduping

## Runtime

Fields:

- `runner`: `command-runner`, `claude-code-runner`, `openai-runner`, `anthropic-runner`
- `mode`: `replay`, `record`, `live`
- `snapshot_dir`: replay cache directory
- `cache_key_strategy`: current default `v1`
- `model`, `temperature`, `max_tokens`, `base_url`, `api_env_var`: provider runner settings

Recommended CI default:

```yaml
runtime:
  runner: openai-runner
  mode: replay
  snapshot_dir: .subagent-evals/cache
```

## Outputs

Set output file paths for machine and human artifacts:

- JSON report
- HTML report
- JUnit
- Shields badge JSON

## Thresholds

Use `fail_below` to gate CI on minimum score:

```yaml
thresholds:
  fail_below: 0.75
```

## Notes

- `not_contains` is a hard-fail assertion.
- replay mode fails on cache miss unless live fallback is explicitly enabled in the runner path.
- adding new scoring dimensions can shift historical scores.
