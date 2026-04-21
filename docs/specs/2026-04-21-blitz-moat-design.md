# Blitz Moat Design — 3-Day Launch

**Date:** 2026-04-21  
**Author:** Praveen Yellamaraju  
**Goal:** OSS stars via viral distribution. Solo dev + Claude Code. Days not weeks.

---

## Context

subagent-evals v0.5.0 has a solid engine: eval, badge, comment, submit, corpus, merkle, parity, time-series. What it lacks is distribution mechanics. This design builds the viral loop in 3 days.

Existing badge tiers (from `createBadgeJson`): `certified`, `strong`, `usable`, `experimental`.  
`experimental` is the only failing tier (per `buildGitHubStatusPayload`).

---

## Day 1 — `ci init` (Adoption Wedge)

### Command

```
subagent-evals ci init [target] [options]
```

Generates a CI workflow file into the current (or target) directory.

### Platform detection

| Condition | Default platform |
|-----------|-----------------|
| `.github/` directory exists | `github` |
| `.gitlab-ci.yml` exists | `gitlab` |
| Neither | Error with message: `"Cannot detect platform. Use --platform github or --platform gitlab."` No interactive prompt — safe in scripts. |

### Options

| Option | Default | Notes |
|--------|---------|-------|
| `--platform <github\|gitlab>` | auto-detect | Explicit override |
| `--gitlab-url <url>` | `https://gitlab.com` | Self-hosted GitLab base URL |
| `--min-score <n>` | — | See threshold logic below |
| `--fail-on <tier>` | `experimental` | Fail if badge tier equals this or worse |
| `--post-comment / --no-post-comment` | `--post-comment` | Enable/disable MR/PR comment step |
| `--force` | false | Overwrite existing workflow file |
| `--dry-run` | false | Print generated YAML to stdout, write nothing |
| `-y, --yes` | false | Skip confirmation prompts (required in non-TTY) |

### Threshold logic

CI fails if **either** condition is true:
1. Badge tier is `experimental` (always — matches current `buildGitHubStatusPayload`)
2. Score is below `--min-score` (only when flag is provided)

### Overwrite behavior

- File does not exist → write it.
- File exists, no `--force` → abort with error: `"Workflow file already exists. Use --force to overwrite."`
- File exists + `--force` → overwrite.
- `.gitlab-ci.yml` special case: warn that the file is the project's primary pipeline. Require explicit `--force --yes` to overwrite.

### GitHub workflow template

```yaml
name: subagent-evals
on:
  pull_request:
    branches: ["**"]

permissions:
  contents: read
  pull-requests: write    # required for gh pr comment
  statuses: write         # required for GitHub Checks status API

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install subagent-evals
        run: npm install -g subagent-evals@latest
      - name: Run eval
        # If subagent-evals.config.yaml is missing, eval auto-discovers agent files.
        # Run `subagent-evals init` locally to create one.
        run: subagent-evals eval --output results.json
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - name: Generate badge
        run: subagent-evals badge --input results.json --write
      - name: Check threshold
        run: |
          node -e "
            const r = require('./results.json');
            if (r.summary.badge === 'experimental') process.exit(1);
            // --min-score check injected here when flag is provided
          "
      - name: Generate PR comment
        if: always()
        run: subagent-evals comment --current results.json --output comment.md
      - name: Post PR comment
        if: always()
        run: gh pr comment "${{ github.event.number }}" --body-file comment.md
        env:
          GH_TOKEN: ${{ github.token }}
      - name: Post commit status
        if: always()
        run: |
          STATUS=$(node -e "
            const r=require('./results.json');
            const state=r.summary.badge==='experimental'?'failure':'success';
            console.log(JSON.stringify({state,description:'subagent-evals: '+r.summary.badge+' (score='+r.summary.score.toFixed(3)+')',context:'subagent-evals'}));
          ")
          curl -s -X POST \
            -H "Authorization: token ${{ github.token }}" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/statuses/${{ github.sha }}" \
            -d "$STATUS"
```

**Required secret:** `ANTHROPIC_API_KEY` — only needed for runtime evals that call a live model. Static-only evals (no `kind: runtime` cases) do not need it.

### GitLab CI template

```yaml
subagent-evals:
  image: node:20
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npm install -g subagent-evals@latest
    # If subagent-evals.config.yaml is missing, eval auto-discovers agent files.
    - subagent-evals eval --output results.json
    - subagent-evals badge --input results.json --write
    - node -e "const r=require('./results.json'); if(r.summary.badge==='experimental') process.exit(1);"
    - subagent-evals comment --current results.json --output comment.md
    - |
      BODY=$(cat comment.md | python3 -c "import sys,json; print(json.dumps({'body': sys.stdin.read()}))")
      curl -s --request POST \
        --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        --header "Content-Type: application/json" \
        "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/merge_requests/${CI_MERGE_REQUEST_IID}/notes" \
        --data "$BODY"
  variables:
    ANTHROPIC_API_KEY: ""   # set in GitLab CI/CD Variables (Settings > CI/CD > Variables)
    GITLAB_TOKEN: ""        # set in GitLab CI/CD Variables; needs api scope
  allow_failure: false
```

**Self-hosted GitLab:** When `--gitlab-url` is provided, template replaces `${CI_API_V4_URL}` with `<gitlab-url>/api/v4`. A comment in the template explains the substitution.

### Implementation scope

- New `ci init` command handler in `packages/cli/src/index.ts`
- Two template strings: `packages/cli/src/templates/github-workflow.ts`, `packages/cli/src/templates/gitlab-ci.ts`
- `--min-score` injects additional shell check into threshold step
- ~150 lines total

---

## Day 2 — `badge --write` (Viral Billboard)

### Change: extend existing `badge` command

Drop `submit --badge`. Extend the existing `badge` command with `--write`.

```
subagent-evals badge --input results.json --write [--platform <github|gitlab>] [--gitlab-url <url>]
```

`--output` remains for explicit path. `--write` sets output to `./subagent-evals-badge.json` and triggers URL printing after writing.

### Badge format

Keep existing `createBadgeJson` format (`label: "subagent-evals"`, hex colors). No parallel badge contract. Hex colors are valid shields.io endpoint colors. Message stays as tier only (`certified`, `strong`, `usable`, `experimental`) — score is in the GitHub status description, not the badge (keeps badge readable at small sizes).

### URL generation

After writing the file, CLI auto-detects origin and prints the URL:

1. Run `git remote get-url origin` in `--cwd` (or `process.cwd()`)
2. Parse remote URL — support SSH (`git@github.com:owner/repo.git`) and HTTPS
3. Run `git symbolic-ref --short HEAD` for branch name
4. Construct raw URL

| Platform | Raw URL pattern |
|----------|----------------|
| GitHub | `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/subagent-evals-badge.json` |
| GitLab hosted | `https://gitlab.com/{owner}/{repo}/-/raw/{branch}/subagent-evals-badge.json` |
| Self-hosted GitLab | `{--gitlab-url}/{owner}/{repo}/-/raw/{branch}/subagent-evals-badge.json` |

**Printed output:**
```
Badge written to subagent-evals-badge.json

Add to your README:
![agent quality](https://img.shields.io/endpoint?url=<raw-url>)
```

**Edge cases:**

| Condition | Behavior |
|-----------|----------|
| No git remote | Print generic instructions with `<raw-url>` placeholder. No error. |
| Private repo | Print note: "Private repos: shields.io cannot read private raw URLs. Host the badge JSON on a public URL." |
| URL special chars | Owner/repo percent-encoded (rare but handled) |
| `--platform` provided | Override auto-detected platform |
| Both GitHub + GitLab remotes | Use `--platform` to disambiguate; error if ambiguous and flag absent |

### Implementation scope

- ~60 lines extending existing `badge` command handler
- Git remote parsing utility: ~30 lines in `packages/cli/src/index.ts`

---

## Day 3 — State of AI Agents + Static Site Page (Authority)

### Script: `scripts/state-of-agents.mjs`

Evaluates a fixed, pinned list of public repos and writes results for the static site.

### Repo selection criteria

- Public repos only
- Must have at least one agent config file (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `AGENTS.md`, `.windsurf/rules`)
- ≥100 GitHub stars
- At least one commit in the last 90 days
- No repos owned by `pyaichatbot` (conflict of interest)
- Target 5 repos per platform, max 15 total

### Pinning

Each repo is evaluated at a specific commit SHA. SHA list lives in `scripts/state-of-agents-repos.json`:

```json
[
  { "owner": "owner", "repo": "repo", "sha": "abc1234", "platform": "claude-code" }
]
```

Committed alongside the script. Re-running with the same file produces identical results.

**Reproducibility:**
```bash
git checkout <report-commit>
node scripts/state-of-agents.mjs --repos scripts/state-of-agents-repos.json
```

### Bias caveat

Included in both Markdown output and site page:
> "Sample of 15 repos selected for activity and star count. Not a random sample. Results reflect these specific configs at pinned commits and may not generalize."

### Output files

1. `docs/state-of-agents/2026-Q2.md` — launch post (table + findings + caveat)
2. `apps/hosted/data/state-of-agents.json` — structured data:

```json
{
  "period": "2026-Q2",
  "generated": "2026-04-21T00:00:00Z",
  "sample_size": 15,
  "caveat": "Sample of 15 repos...",
  "repos": [
    { "owner": "o", "repo": "r", "sha": "abc", "platform": "claude-code", "score": 0.91, "tier": "certified" }
  ],
  "by_platform": {
    "claude-code": { "count": 5, "avg_score": 0.82, "tiers": { "certified": 2, "strong": 2, "usable": 1, "experimental": 0 } },
    "cursor": { "count": 5, "avg_score": 0.61, "tiers": { "certified": 0, "strong": 2, "usable": 2, "experimental": 1 } },
    "copilot": { "count": 5, "avg_score": 0.58, "tiers": { "certified": 0, "strong": 1, "usable": 3, "experimental": 1 } }
  },
  "top_failures": ["missing prompt injection guard", "no tool restrictions", "no scope definition"],
  "top_passes": ["explicit tool allowlist", "clear task boundaries", "security rules present"]
}
```

### Static site integration

**New export** in `packages/hosted/src/index.ts`:
```ts
export function renderStateOfAgentsPage(data: StateOfAgentsData): string
```

**`generate.mjs` additions:**
1. Load `apps/hosted/data/state-of-agents.json` if it exists (skip gracefully if absent — build still passes)
2. Call `renderStateOfAgentsPage(data)`
3. Write `pages/state-of-agents/index.html`
4. Add `/state-of-agents/` entry to `renderSitemap` output
5. Add "State of Agents" nav link in `renderIndexPage` output

**URL:** `https://pyaichatbot.github.io/subagent-evals/state-of-agents/`

### Implementation scope

- `scripts/state-of-agents.mjs`: ~120 lines
- `scripts/state-of-agents-repos.json`: repo list with pinned SHAs
- `packages/hosted/src/index.ts`: `renderStateOfAgentsPage` export (~80 lines)
- `apps/hosted/generate.mjs`: ~20 lines added

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

- Custom DSL (Markdown + YAML is the standard)
- Matcher library (config-driven assertions already cover this)
- Multi-language support (TypeScript/Node is the AI tooling ecosystem bet)
- Watch mode now (needs users to validate the workflow first)
- Cloudflare Workers / external infra (GitHub Pages + raw URLs sufficient at this scale)

---

## Success Criteria

- Day 1: `ci init --platform github` and `--platform gitlab` generate valid YAML; `--dry-run` works; `--force` required to overwrite; non-TTY safe (no prompts, clear errors)
- Day 2: `badge --input results.json --write` writes file, prints correct shields.io URL for auto-detected platform, handles missing git remote gracefully
- Day 3: `state-of-agents.mjs` runs against pinned repo list, writes JSON + Markdown, static site page renders at GitHub Pages URL; build passes when JSON is absent
- Launch: HN post uses Day 3 data; badge README snippet added to `subagent-evals` README itself
