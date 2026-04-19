import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../src/index.js";

describe("cli eval with relative discovery roots", () => {
  it("evaluates agents located outside the cwd when configured via relative path", async () => {
    const base = mkdtempSync(join(tmpdir(), "subagent-evals-relative-"));
    const externalAgents = join(base, "external", ".claude", "agents");
    mkdirSync(externalAgents, { recursive: true });
    writeFileSync(
      join(externalAgents, "reviewer.md"),
      `---
name: reviewer
description: Reviews current branch diff and returns JSON findings.
tools: Read, Grep, Bash
model: sonnet
---

You review a diff. JSON only.
Return:
- approved
- severity
- issues
`,
      "utf8"
    );

    const cwd = join(base, "eval-project");
    mkdirSync(join(cwd, "cases"), { recursive: true });
    writeFileSync(
      join(cwd, "subagent-evals.config.yaml"),
      `discovery:
  roots:
    - ../external/.claude/agents
  globs:
    - "**/*.md"
  format: claude-md
runtime:
  runner: command-runner
  command: node
  args:
    - ../example-runner.mjs
outputs:
  json: out/results.json
  junit: out/results.junit.xml
  html: out/report.html
`,
      "utf8"
    );
    writeFileSync(
      join(cwd, "cases", "reviewer.yaml"),
      `id: reviewer-runtime
agent: reviewer
kind: runtime
input:
  task: "Review this diff"
  fixtures:
    output_text: "Found an unhandled error while reading the diff."
    trace:
      - type: tool_call
        name: Read
        timestamp: "2026-04-19T00:00:00Z"
expected:
  score_min: 0.66
  assertions:
    - type: contains
      value: "unhandled error"
    - type: mentions
      value: "reading"
    - type: trajectory_contains
      value: "Read"
`,
      "utf8"
    );
    writeFileSync(
      join(base, "example-runner.mjs"),
      `import { readFileSync } from "node:fs";
const payload = JSON.parse(readFileSync(0, "utf8"));
process.stdout.write(String(payload.input.fixtures.output_text));
`,
      "utf8"
    );

    await runCli(["eval", cwd]);

    const report = JSON.parse(
      readFileSync(join(cwd, "out", "results.json"), "utf8")
    ) as {
      summary: { agents: number };
      agents: Array<{ agent_id: string }>;
      runtime_cases: Array<{ passed: boolean }>;
    };
    expect(report.summary.agents).toBe(1);
    expect(report.agents[0]?.agent_id).toBe("reviewer");
    expect(report.runtime_cases[0]?.passed).toBe(true);
  });
});
