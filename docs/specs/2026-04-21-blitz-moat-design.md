# Blitz Moat Design — 3-Day Launch

**Date:** 2026-04-21
**Author:** Praveen Yellamaraju
**Goal:** OSS stars via viral distribution. Solo dev + Claude Code. Days not weeks.

---

## Context

subagent-evals v0.5.0 has a solid engine: eval, badge, comment, submit, corpus, merkle, parity, time-series. What it lacks is distribution mechanics. This design builds the viral loop in 3 days.

---

## Approach D: Blitz (best moat per day)

### Day 1 — `ci init` (Adoption Wedge)

New CLI command: `subagent-evals ci init`

Generates CI workflow file to current directory.

**GitHub:** `.github/workflows/subagent-evals.yml`
**GitLab (hosted + self-hosted):** `.gitlab-ci.yml`

**Options:**
- `--platform <github|gitlab>` — explicit platform (auto-detected if omitted)
- `--gitlab-url <url>` — self-hosted GitLab base URL
- `--min-score <n>` — fail threshold (default: 0.6)
- `--post-comment` — enable PR/MR comment (default: true)

**Auto-detection:**
- `.github/` exists → default `github`
- `.gitlab-ci.yml` exists → default `gitlab`
- Neither → prompt user

**Workflow behavior (both platforms):**
1. Install deps + run `subagent-evals eval`
2. Post PR/MR comment via `subagent-evals comment` (existing)
3. Fail pipeline if score < `--min-score`
4. Post GitHub Checks status / GitLab pipeline status (existing `buildGitHubStatusPayload`)

**GitLab specifics:**
- `rules: - if: $CI_PIPELINE_SOURCE == "merge_request_event"`
- MR Notes API for comments (`GITLAB_TOKEN` env var)

**Implementation:** Pure template generation. ~100 lines. No new core logic.

---

### Day 2 — `submit --badge` (Viral Billboard)

Extends existing `subagent-evals submit` command with `--badge` flag.

Writes `subagent-evals-badge.json` to repo root (shields.io-compatible format):

```json
{
  "schemaVersion": 1,
  "label": "agent quality",
  "message": "certified · 0.91",
  "color": "brightgreen"
}
```

**Color mapping:**
- `≥0.9` → `brightgreen` (certified)
- `≥0.7` → `green` (usable)
- `≥0.5` → `yellow` (developing)
- `<0.5` → `red` (failing)

**After writing the file, CLI prints the badge URL:**

GitHub:
```
https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/owner/repo/main/subagent-evals-badge.json
```

GitLab hosted:
```
https://img.shields.io/endpoint?url=https://gitlab.com/owner/repo/-/raw/main/subagent-evals-badge.json
```

GitLab self-hosted:
```
https://img.shields.io/endpoint?url=https://your-gitlab.com/owner/repo/-/raw/main/subagent-evals-badge.json
```

**Options:**
- `--badge` — enable badge file write
- `--platform <github|gitlab>` — controls URL format in output
- `--gitlab-url <url>` — self-hosted GitLab base URL

**Zero infra.** User commits the JSON file. shields.io reads it directly. Badge updates on each `submit --badge` run.

**Implementation:** ~50 lines extending existing submit command.

---

### Day 3 — State of AI Agents + Static Site Page (Authority)

**Script:** `scripts/state-of-agents.mjs`

Runs `subagent-evals eval` against 10-15 hand-picked public repos:
- Popular repos with `CLAUDE.md` (Claude Code)
- Popular repos with `.cursorrules` (Cursor)
- Popular repos with `.github/copilot-instructions.md` (Copilot)

**Outputs two files:**

1. `docs/state-of-agents/2026-Q2.md` — launch post (HN/Twitter content)
2. `apps/hosted/data/state-of-agents.json` — structured data for static site

**JSON structure:**
```json
{
  "date": "2026-Q2",
  "repos": [
    { "name": "owner/repo", "platform": "claude-code", "score": 0.91, "tier": "certified" }
  ],
  "insights": [
    "Claude Code configs score 18% higher than Cursor rules",
    "Most common failure: missing prompt injection guard",
    "Only 3 of 15 repos achieved certified tier"
  ]
}
```

**Static site page:** `apps/hosted/` generates `/state-of-agents/index.html`

Renders:
- Score table with tier badges
- Bar chart per platform
- Key findings (3 bullets)
- "Last updated" timestamp

Fits existing `pnpm build:pages` pipeline. Deploys to `https://pyaichatbot.github.io/subagent-evals/state-of-agents/` on push.

**Launch post title:** *"We scored 15 popular AI agent configs — here's what we found"*

**Implementation:** ~150 lines script + ~100 lines site additions.

---

## Revenue Opportunities (Post-Stars)

| Tier | Model | Price |
|------|-------|-------|
| Badge SaaS | Private repo badge hosting + audit history | $9–29/mo |
| Registry premium | Certified agent marketplace listings | Sponsorship |
| Enterprise | CI audit logs + compliance export + SLA | $99+/mo |
| Reports | Quarterly State of AI Agents sponsor slots | Flat fee |

---

## Deferred Moats (Build After 1k Stars)

These require users before they create value:

1. **Watch mode + live dashboard** — file watcher, re-eval on save, live HTML refresh
2. **Public registry + marketplace** — `search`, `install`, `publish` commands; network effects
3. **Agent composition + inheritance** — `extends:` in agent configs; ecosystem lock-in
4. **Red team arena** — gamified weekly challenges; CTF-style leaderboard
5. **Automated quarterly reports** — aggregate anonymized data; press-worthy authority play

---

## What We Skip Intentionally

- Custom DSL (Markdown + YAML is the standard — work with it)
- Matcher library (config-driven assertions already cover this)
- Multi-language support (TypeScript/Node is the AI tooling ecosystem bet)
- Watch mode now (needs users to validate the workflow first)

---

## Success Criteria

- Day 1: `ci init` works end-to-end for GitHub + GitLab
- Day 2: badge JSON written, URL printed, shields.io renders it
- Day 3: state-of-agents page live at GitHub Pages URL
- Launch: HN post submitted with data from Day 3
