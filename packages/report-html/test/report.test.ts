import { describe, expect, it } from "vitest";

import { renderHtmlReport } from "../src/index.js";

describe("html report", () => {
  it("renders leaderboard, findings, and runtime assertion sections", () => {
    const html = renderHtmlReport({
      summary: {
        score: 0.82,
        badge: "strong",
        agents: 1,
        static_cases: 1,
        runtime_cases: 1
      },
      agents: [
        {
          agent_id: "reviewer",
          score: 0.82,
          badge: "strong",
          findings: [{ id: "output-contract", title: "Output contract is weak" }]
        }
      ],
      runtime_cases: [
        {
          id: "reviewer-case",
          agent: "reviewer",
          score: 0.88,
          passed: true,
          assertions: [{ type: "contains", passed: true, message: "Matched" }]
        }
      ]
    });

    expect(html).toContain("subagent-evals report");
    expect(html).toContain("reviewer-case");
    expect(html).toContain("Output contract is weak");
    expect(html).toContain("strong");
  });
});
