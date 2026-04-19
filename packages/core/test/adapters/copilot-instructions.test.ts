import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discoverCopilotAgents } from "../../src/adapters/copilot-instructions.js";

describe("copilot-instructions adapter", () => {
  it("extracts section-based agents from copilot-instructions.md", async () => {
    const agents = await discoverCopilotAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/copilot-project"]
    });

    expect(agents).toHaveLength(2);
    expect(agents.map((agent) => agent.section)).toEqual(
      expect.arrayContaining(["reviewer", "explainer"])
    );
    expect(agents[0]?.format_adapter_id).toBe("copilot-instructions");
    expect(agents[0]?.path).toContain("copilot-instructions.md");
  });

  it("skips a no-section file because plain copilot instructions are not structured agents", async () => {
    const dir = mkdtempSync(join(tmpdir(), "copilot-whole-file-"));
    const githubDir = join(dir, ".github");
    mkdirSync(githubDir, { recursive: true });
    writeFileSync(
      join(githubDir, "copilot-instructions.md"),
      `---
name: helper
description: Helps with requests by reading relevant files first.
tools:
  - Read
model: gpt-4o-mini
---

Read the request and respond with short actionable guidance.
`,
      "utf8"
    );

    const agents = await discoverCopilotAgents({
      cwd: process.cwd(),
      roots: [dir]
    });

    expect(agents).toHaveLength(0);
  });
});
