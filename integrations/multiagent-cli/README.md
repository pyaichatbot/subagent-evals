# multiagent_cli integration

This folder evaluates the current markdown subagent pack in:

- `../../../multi-agent-orchestration/multiagent_cli/.claude/agents`

It does two things:

- runs static evals against the real `planner`, `coder`, `reviewer`, `tester`, `gatekeeper`, and `debugger` markdown files
- runs a small replay-case suite for `reviewer` and `planner` so the integration also exercises runtime assertions

Run it from the standalone repo root:

```bash
node packages/cli/dist/bin/subagent-evals.js eval --cwd integrations/multiagent-cli
node packages/cli/dist/bin/subagent-evals.js report --input integrations/multiagent-cli/out/results.json --output integrations/multiagent-cli/out/report.html
```

The runtime cases are replay fixtures, not live Claude invocations. They validate the eval harness against the `multiagent_cli` agent identities, while the static layer evaluates the actual current markdown prompts.
