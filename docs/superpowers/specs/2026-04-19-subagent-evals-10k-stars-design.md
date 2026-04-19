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

**`auto` discovery — explicit policy for mixed and monorepos:**

`auto` runs all matching adapters and applies these rules in order:

1. **Stable agent ID**: each discovered agent gets an ID of `{adapter}:{relative-path}#{section}`. IDs are stable across runs regardless of discovery order.
2. **No deduplication by default**: if the same logical agent appears in two formats (e.g., during a tool migration), both are reported as separate agents under their respective adapter IDs. The report groups by adapter so scores are never merged silently.
3. **Explicit dedup config**: repos that want to suppress duplicates declare `discovery.dedup: true` and provide a `discovery.primary` adapter (e.g., `claude-md`). Secondary adapters are still discovered but skipped in scoring if the primary also matched the same path stem.
4. **Monorepo roots**: `discovery.roots` accepts multiple paths (`[packages/agent-a, packages/agent-b]`). Each root is discovered independently; results are namespaced by root in the report.
5. **Section-based formats**: Copilot and Codex formats that define multiple agents in one file use heading-level extraction. Each `## Agent: <name>` heading becomes one `NormalizedAgent` with ID `{adapter}:{file}#{normalized-heading}`.
6. **Ambiguity warning**: if `auto` discovers agents from 3+ adapters and no `discovery.dedup` is set, it emits a warning recommending explicit config.

This makes "zero-config" predictable: it always runs everything, always labels by adapter, never silently merges.

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
- **Python wrapper SDK**: `pip install subagent-evals` — implementation strategy for v0.5:
  - **Runtime dependency on Node**: the Python package declares `node >= 18` as a system requirement (checked at import time with a clear error). It shells out to `npx subagent-evals@{version}` pinned to the same version as the Python package. This is the simplest cross-platform story and avoids binary bundling entirely.
  - **What the wrapper provides**: `EvalResult` dataclass (parsed from `--output json`), `lint(path)` / `eval(path)` / `report(path)` convenience functions, and a pytest plugin with an `assert_agent_score(min=0.75)` fixture.
  - **What it does not try to do**: bundle a Node binary, vendor compiled JS, or work without Node installed. A future v1.x release may add platform wheels with bundled Node via `nuitka` or `pyinstaller`, but that is explicitly deferred.
  - **Why this is safe for v0.5**: the target Python user is a developer already running Node for their AI tool (Claude Code, Codex). Node presence can be assumed. The "no Node" case gets a clear install error, not a silent failure.

Definition of done: A new repo can add the GitHub Action, get a PR comment with scores, and put a badge in their README in under 5 minutes.

### v1.0 — "Category winner" (Weeks 8–12)

**Goal:** Own the category with the leaderboard and semantic evals.

Features:
- **Public leaderboard** at `subagent-evals.dev` — two explicit submission modes:
  - **Anonymous mode** (default): `subagent-evals submit` sends only scores, badge tier, agent count, and adapter type. No repo name, no org, no file paths. Feeds aggregate stats ("X% of Claude repos are certified") but does not appear as a named entry.
  - **Attributed mode** (opt-in, requires `--public` flag + GitHub token): submits the same payload plus `{owner}/{repo}` and links the entry to a public GitHub repo. This creates `subagent-evals.dev/r/{owner}/{repo}`. CLI requires explicit `--public` confirmation; GitHub Action requires `public: true` input. The two modes never mix data: anonymous submissions are never retroactively attributed.
  - Rankings ("Top agent repos this week") only include attributed entries. Anonymous submissions only appear in aggregate leaderboard stats.
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

> Note: the current codebase has not yet been split into separate modules. All core logic lives in `packages/core/src/index.ts` and all CLI logic lives in `packages/cli/src/index.ts`. The implementation plan will need to either extract modules from these files or add new functions to them. The paths below describe the intended post-refactor structure; the implementation plan decides whether to refactor first or extend in-place.

- `packages/core/src/index.ts` — extend `AgentFormatId` union, add `auto` discovery, add integrity eval exports, add `NormalizedAgent` section-ID support
- `packages/cli/src/index.ts` — add `submit`, `badge`, `report` (with badge flag) commands
- `README.md` — complete rewrite for new positioning

---

## Edge Cases and Explicit Policies

| Scenario | Behaviour |
|---|---|
| Mixed-format repo (Claude + Cursor both present) | `auto` discovers both; reports under separate adapter IDs; warns if 3+ adapters and no explicit config |
| Private repo that wants local badges, never public | `subagent-evals report --badge` always works locally; `submit` requires `--public` flag to touch the network; badge endpoint can be self-hosted |
| Monorepo with multiple agent packs | `discovery.roots: [packages/agent-a, packages/agent-b]` — each root is namespaced in report output |
| Repo with only replay cases, no live runner credentials | Fully supported; `replay-runner` is the default. The report notes "runtime: fixture-only" and integrity checks flag if no live cases exist (warning, not error) |
| Tool format that defines multiple agents in one file | Section-based extraction: `## Agent: <name>` headings split the file into one `NormalizedAgent` per heading; ID is `{adapter}:{file}#{normalized-heading}` |
| Agent appears in two formats during migration | Both discovered; neither deduplicated unless `discovery.dedup: true` is set; report groups by adapter |
| Score delta on first PR (no base branch result) | GitHub Action treats missing base score as "no prior baseline"; shows absolute score only, no delta |

---

## Verification

End-to-end test before each release:

1. **Multi-tool smoke test**: Run `npx subagent-evals lint .` against example repos for each supported tool format. Confirm correct agent count detected, no false positives.
2. **GitHub Action**: Create a test PR in a fixture repo, verify PR comment appears with correct scores and delta.
3. **Badge**: Run `subagent-evals report`, confirm `badge.json` is valid Shields.io endpoint format, confirm badge renders in a README.
4. **Integrity checks**: Run against `examples/bad-project` — confirm weak assertion and replay-only warnings appear.
5. **Python wrapper**: `pip install -e packages/python && python -c "import subagent_evals; print(subagent_evals.lint('.'))"` succeeds.
6. **Regression**: `pnpm test` passes all existing unit + integration tests.
