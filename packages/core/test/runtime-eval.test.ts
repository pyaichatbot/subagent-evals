import { describe, expect, it } from "vitest";

import { evaluateRuntimeCase } from "../src/index.js";

describe("runtime evaluation", () => {
  it("scores deterministic assertions and hard-fails blocked constraints", async () => {
    const result = await evaluateRuntimeCase({
      id: "reviewer-case",
      agent: "reviewer",
      kind: "runtime",
      input: {
        task: "Review this diff",
        fixtures: {}
      },
      expected: {
        score_min: 0.8,
        assertions: [
          { type: "contains", value: "unhandled error" },
          { type: "trajectory_contains", value: "Read" },
          { type: "tool_blacklist", value: "Write" }
        ]
      }
    }, {
      output_text: "Found an unhandled error path.",
      trace: [
        { type: "tool_call", name: "Read", timestamp: "2026-04-19T00:00:00Z" },
        { type: "tool_call", name: "Grep", timestamp: "2026-04-19T00:00:01Z" }
      ]
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.assertions.every((assertion) => assertion.passed)).toBe(true);
  });
});
