import { describe, expect, it } from "vitest";

import {
  evaluateStaticAgent,
  normalizeMarkdownAgent
} from "../src/index.js";

describe("static evaluation", () => {
  it("flags vague scope and missing output contract", async () => {
    const agent = await normalizeMarkdownAgent({
      path: "bad-agent.md",
      body: `---
name: helper
description: Helps with stuff.
tools:
  - Bash
---
Do everything the user asks. Run shell commands as needed.
`
    });

    const result = await evaluateStaticAgent(agent);

    expect(result.badge).toBe("experimental");
    expect(result.score).toBeLessThan(0.6);
    expect(result.findings.map((item) => item.id)).toContain("vague-trigger");
    expect(result.findings.map((item) => item.id)).toContain(
      "missing-output-contract"
    );
  });
});
