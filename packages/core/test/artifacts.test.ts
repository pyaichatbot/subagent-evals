import { describe, expect, it } from "vitest";

import {
  createBadgeJson,
  createSnapshotKey,
  diffEvalReports,
  renderPrComment,
  type EvalReport,
  type RuntimeCase
} from "../src/index.js";

function report(score: number, badge: EvalReport["summary"]["badge"]): EvalReport {
  return {
    summary: {
      score,
      badge,
      agents: 1,
      static_cases: 1,
      runtime_cases: 1
    },
    adapters: ["claude-md"],
    agents: [
      {
        agent_id: "reviewer",
        score,
        badge,
        findings: badge === "strong" ? [] : [{ id: "missing-output-contract", title: "Missing" }]
      }
    ],
    static_results: [
      {
        kind: "static",
        agent_id: "reviewer",
        score,
        badge,
        dimensions: {},
        findings:
          badge === "strong"
            ? []
            : [
                {
                  id: "missing-output-contract",
                  title: "Missing",
                  severity: "medium",
                  message: "Missing",
                  suggestion: "Add it"
                }
              ],
        suggestions: []
      }
    ],
    runtime_cases: [
      {
        kind: "runtime",
        id: "reviewer-runtime",
        agent: "reviewer",
        score,
        passed: badge === "strong",
        assertions: [
          {
            type: "contains",
            passed: badge === "strong",
            message: badge === "strong" ? "Matched" : "Missing"
          }
        ],
        artifact: {
          output_text: badge === "strong" ? "ok" : "bad"
        }
      }
    ]
  };
}

describe("artifact helpers", () => {
  it("creates a shields badge json payload", () => {
    expect(createBadgeJson(report(0.91, "certified"))).toEqual({
      schemaVersion: 1,
      label: "subagent-evals",
      message: "certified",
      color: "16a34a"
    });
  });

  it("diffs reports and renders a PR comment", () => {
    const current = report(0.9, "certified");
    const baseline = report(0.5, "experimental");
    const diff = diffEvalReports(current, baseline);
    expect(diff.summary_delta?.badge_changed).toBe(true);
    expect(diff.runtime_regressions).toHaveLength(1);
    const comment = renderPrComment(current, diff);
    expect(comment).toContain("Score delta");
    expect(comment).toContain("reviewer");
  });

  it("creates deterministic replay cache keys", () => {
    const testCase: RuntimeCase = {
      id: "reviewer-runtime",
      agent: "reviewer",
      kind: "runtime",
      input: {
        task: "Review this diff",
        fixtures: { diff: "a.patch" }
      },
      expected: { assertions: [] }
    };
    const runtime = {
      runner: "openai-runner" as const,
      mode: "record" as const,
      model: "gpt-5.4-mini",
      cache_key_strategy: "v1"
    };
    expect(createSnapshotKey(testCase, runtime)).toBe(createSnapshotKey(testCase, runtime));
  });
});
