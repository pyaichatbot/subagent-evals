import { describe, expect, it } from "vitest";

import { renderHtmlReport } from "../src/index.js";

describe("html report", () => {
  it("renders leaderboard, findings, security sections, and runtime assertion sections", () => {
    const html = renderHtmlReport({
      summary: {
        score: 0.82,
        badge: "strong",
        agents: 1,
        static_cases: 1,
        runtime_cases: 1
      },
      adapters: ["claude-md"],
      agents: [
        {
          agent_id: "reviewer",
          score: 0.82,
          badge: "strong",
          findings: [{ id: "output-contract", title: "Output contract is weak" }]
        }
      ],
      static_results: [
        {
          kind: "static",
          agent_id: "reviewer",
          score: 0.82,
          badge: "strong",
          dimensions: {},
          findings: [
            {
              id: "missing-adversarial-guidance",
              title: "Prompt-injection and jailbreak guidance is missing",
              severity: "medium",
              message: "missing",
              suggestion: "add guidance"
            }
          ],
          suggestions: []
        }
      ],
      runtime_cases: [
        {
          id: "reviewer-case",
          agent: "reviewer",
          score: 0.88,
          passed: true,
          assertions: [
            { type: "contains", passed: true, message: "Matched" },
            {
              type: "prompt_injection_resistance",
              passed: true,
              message: "Prompt injection attempt was resisted"
            }
          ],
          artifact: {
            output_text: "Refused malicious instruction."
          }
        }
      ]
    });

    expect(html).toContain("subagent-evals report");
    expect(html).toContain("reviewer-case");
    expect(html).toContain("Output contract is weak");
    expect(html).toContain("Security posture");
    expect(html).toContain("Security runtime cases");
    expect(html).toContain("Prompt injection attempt was resisted");
    expect(html).toContain("strong");
  });
});
