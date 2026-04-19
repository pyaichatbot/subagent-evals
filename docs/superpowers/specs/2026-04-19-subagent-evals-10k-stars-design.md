# subagent-evals: 10k+ Star Roadmap Design

**Date:** 2026-04-19
**Author:** Praveen Yellamaraju
**Status:** Approved

---

## Context

`subagent-evals` is a TypeScript monorepo (v0.1.0) that lints and evaluates markdown-defined AI subagents. It currently supports Claude Code's `.claude/agents/*.md` format and a generic frontmatter format, with static heuristic scoring and fixture-based runtime assertions.

The goal is to make this the de-facto evaluation standard for markdown AI agents across every major tool — Claude Code, Codex, GitHub Copilot, Cursor, Windsurf — and grow it to 10k+ GitHub stars.

The window is now: all major AI coding assistants are converging on markdown-defined agents and no one owns the eval standard yet.

---

## Positioning

**Primary:** "The Codecov for markdown AI agents."
**Secondary:** "Lint, eval, score, and ship Claude / Codex / Copilot / Cursor / Windsurf agents."

The analogy to Codecov is intentional: badge in every README → viral discovery → PR annotation → habit loop → star growth.

---

## Strategy: Approach A + thin C, defer B

- **A (star engine):** multi-tool support, auto-detect, GitHub Action, badges, public leaderboard
- **C (differentiation):** lightweight eval integrity checks so it's not just another lint tool
- **B (deferred):** benchmark dataset and academic paper wait until there's adoption

---

## Architecture

### CLI-first, language-neutral config, TypeScript now, Python wrapper after traction

```
subagent-evals lint .          # auto-detect + static lint
subagent-evals eval .          # assertions + scoring
subagent-evals report          # badge, HTML, JSON
subagent-evals submit          # opt-in leaderboard submission
```

### Format Adapters (read layer)

Each adapter normalizes agent files to the shared `NormalizedAgent` type. Same evaluators run against all formats.

| Adapter | Source format | Target tools |
|---|---|---|
| `claude-md` | `.claude/agents/*.md` (YAML frontmatter) | Claude Code |
| `codex-md` | `.codex/agents/*.md` or `AGENTS.md` sections | OpenAI Codex |
| `copilot-instructions` | `.github/copilot-instructions.md` sections | GitHub Copilot |
| `cursor-rules` | `.cursor/rules/*.mdc` | Cursor |
| `windsurf-config` | `.windsurf/rules/*.md` | Windsurf |
| `generic-frontmatter` | Any YAML-frontmatter `.md` glob | Generic |

`auto` discovery mode: scan repo root, detect which formats exist, run all matching adapters with zero config.

### Runner Adapters (execute layer)

| Adapter | What it does |
|---|---|
| `command-runner` | Subprocess, JSON on stdin (existing) |
| `claude-code-runner` | Claude CLI invocation (existing, extend) |
| `codex-runner` | Codex CLI invocation (new in v1.0) |
| `replay-runner` | Fixture-based, no live API (existing, default) |

### Evaluation Layers

```
1. Static (linting)     — heuristics on agent definition quality
2. Runtime (testing)    — assertions against output + trace
3. Integrity (new)      — checks on the eval suite itself
4. Semantic (v1.0)      — LLM-as-judge scoring
```

### Config schema (language-neutral YAML)

```yaml
discovery:
  format: auto              # auto | claude-md | codex-md | copilot-instructions | cursor-rules | windsurf-config | generic-frontmatter
  roots: [.]
eval:
  static: true
  runtime: true
  integrity: true           # new: eval suite health checks
  semantic: false           # v1.0: LLM-as-judge
  judge_model: claude-sonnet-4-6
outputs:
  badge: true               # generates badge JSON at out/badge.json
  html: out/report.html
  json: out/results.json
  junit: out/results.junit.xml
thresholds:
  fail_below: 0.55          # exit code 1 if any agent scores below this
  warn_below: 0.75
```

---

## Versioned Roadmap

### v0.2 — "Multi-tool foundation" (Weeks 1–3)

**Goal:** Be the only eval tool that works across all markdown-agent runtimes.

Features:
- Format adapters: `codex-md`, `copilot-instructions`, `cursor-rules`, `windsurf-config`
- `auto` discovery: zero-config format detection in any repo
- Expanded static evaluators (trigger clarity, scope calibration, output contract, tool policy, model spec)
- `npx subagent-evals@latest` zero-install distribution
- Published to npm, GitHub releases with changelog

Definition of done: `npx subagent-evals lint .` works correctly in a Claude repo, a Codex repo, a Copilot repo, and a Cursor repo with no config file.

### v0.5 — "The growth engine" (Weeks 4–7)

**Goal:** Create the viral adoption loop.

Features:
- **GitHub Action** (`subagent-evals/action@v1`):
  - Runs on push/PR, posts agent quality scores as PR review comment
  - Shows score delta vs. base branch
  - `fail-on-threshold` input to gate merges
  - Zero-config: auto-detects repo format
- **Badge system**:
  - `out/badge.json` in Shields.io endpoint format
  - Hosted badge endpoint at `badge.subagent-evals.dev/{owner}/{repo}`
  - README snippet generator: `subagent-evals badge --print`
- **Shareable HTML report**: works offline, embeds in GitHub Pages, single self-contained file
- **Eval integrity checks** (Approach C, thin layer):
  - Weak assertion detection: flags `contains: "a"` or single-char assertions
  - Replay-only overfitting: warns if all runtime cases use fixture runner with no live cases
  - Shallow fixture gaming: detects fixtures that trivially satisfy all assertions without meaningful output
- **Python wrapper SDK**: `pip install subagent-evals` bundles the CLI binary (via `pyproject.toml` `[project.scripts]`), shells out for eval, surfaces results as `EvalResult` dataclass; includes pytest plugin exposing `assert_agent_score()` fixture

Definition of done: A new repo can add the GitHub Action, get a PR comment with scores, and put a badge in their README in under 5 minutes.

### v1.0 — "Category winner" (Weeks 8–12)

**Goal:** Own the category with the leaderboard and semantic evals.

Features:
- **Public leaderboard** at `subagent-evals.dev`:
  - `subagent-evals submit` sends anonymized results (opt-in, explicit consent)
  - Rankings: overall, per-tool (best Claude agents, best Codex agents, etc.)
  - "Top agent repos this week" — shareable, embeddable
  - Public agent profiles: `subagent-evals.dev/r/{owner}/{repo}`
- **LLM-as-judge semantic scoring**:
  - `judge_score` assertion type (was reserved, now implemented)
  - Trajectory critique: "Did the agent use the right tools in the right order?"
  - Prompt clarity scoring: "Is this agent's description unambiguous to a routing model?"
  - Uses Claude Sonnet 4.6 by default, configurable
- **Runner adapters**: Codex CLI, Copilot (where API permits)
- **Docs site**: `docs.subagent-evals.dev` with quickstart, adapter reference, assertion reference
- **VS Code extension**: inline lint findings in `.md` agent files

Definition of done: 5+ public repos have submitted to the leaderboard and the leaderboard has a weekly email digest.

---

## GitHub Star Growth Loop

```
Dev adds GitHub Action to repo
        ↓
PR comment shows agent scores + delta
        ↓
Dev fixes the experimental agent (tool is useful → retained)
        ↓
Dev adds README badge → visible to all repo visitors
        ↓
Other devs see badge → click → discover the tool → star it
        ↓
Dev submits to leaderboard ("we're top 10 Claude agent repos")
        ↓
Dev tweets/blogs → HN / Reddit traffic spike
        ↓
Stars → rises in GitHub search for "agent eval" → more organic discovery
```

### Key distribution moments

| Milestone | Action | Expected reach |
|---|---|---|
| v0.2 ships | "Show HN: subagent-evals — lint Claude, Codex, Copilot, Cursor agents" | HN front page potential; multi-tool angle is the hook |
| Each new adapter | Tweet: "subagent-evals now supports [tool] agents" | Earned media per tool |
| v0.5 GitHub Action | Submit to GitHub Marketplace + awesome-actions lists | Passive discovery |
| Leaderboard launch | "Top 100 AI agent repos ranked by eval score" post | Spreadable content, retweetable |
| Integrity check launch | "We tested 500 agent test suites — here's how many can be gamed" | HN / research crossover |

### The Approach C hook that makes the HN post shareable

> "We also detect when your eval suite itself can be gamed — weak assertions, replay overfitting, shallow fixture gaming. Most agent test suites have at least one. Run `subagent-evals lint .` to find out."

This is a shareable insight, not just another lint tool announcement. It addresses the HN-viral "AI benchmarks are broken" narrative directly.

---

## What NOT to Build Yet

- Academic paper or benchmark dataset (defer until v1.0+ has adoption)
- Enterprise compliance workflows (OWASP, NIST) — add as plugin later
- Python-first rewrite — CLI-first with Python wrapper is the right order
- Multi-tenant SaaS — leaderboard is opt-in static site first, not a full platform
- Agent versioning / A/B testing — after v1.0

---

## Success Metrics

| Milestone | Target |
|---|---|
| v0.2 launch | 200 stars, 5+ repos using it |
| v0.5 launch | 1k stars, 50+ repos, 10+ GitHub Action installs |
| v1.0 launch | 3k stars, 200+ repos, leaderboard has 20+ submissions |
| 6 months post-v1.0 | 10k stars, leaderboard has 500+ repos |

---

## Files to Create / Modify

### New files
- `packages/core/src/adapters/codex-md.ts`
- `packages/core/src/adapters/copilot-instructions.ts`
- `packages/core/src/adapters/cursor-rules.ts`
- `packages/core/src/adapters/windsurf-config.ts`
- `packages/core/src/evaluators/integrity.ts`
- `packages/core/src/evaluators/semantic.ts`
- `packages/core/src/badge.ts`
- `packages/report-html/src/badge-json.ts`
- `packages/core/src/runners/codex-runner.ts` (v1.0)
- `packages/python/` (new package: Python wrapper SDK — bundles the CLI binary via `pyproject.toml` scripts, no separate install needed)
- `.github/workflows/self-eval.yml` (dogfood: eval our own agents)
- `action.yml` (GitHub Action definition)
- `action/` (GitHub Action entrypoint)

### Modified files
- `packages/core/src/discovery.ts` — add `auto` format detection
- `packages/core/src/types.ts` — extend `AgentFormatId`, add integrity types
- `packages/cli/src/bin.ts` — add `submit`, `badge` commands
- `packages/core/src/config.ts` — extend config schema
- `README.md` — complete rewrite for new positioning

---

## Verification

End-to-end test before each release:

1. **Multi-tool smoke test**: Run `npx subagent-evals lint .` against example repos for each supported tool format. Confirm correct agent count detected, no false positives.
2. **GitHub Action**: Create a test PR in a fixture repo, verify PR comment appears with correct scores and delta.
3. **Badge**: Run `subagent-evals report`, confirm `badge.json` is valid Shields.io endpoint format, confirm badge renders in a README.
4. **Integrity checks**: Run against `examples/bad-project` — confirm weak assertion and replay-only warnings appear.
5. **Python wrapper**: `pip install -e packages/python && python -c "import subagent_evals; print(subagent_evals.lint('.'))"` succeeds.
6. **Regression**: `pnpm test` passes all existing unit + integration tests.
