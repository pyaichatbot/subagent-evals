import { describe, expect, it } from "vitest";

import { evaluateRuntimeCase } from "../src/index.js";

function makeCase(id: string, assertions: Array<{ type: string; value?: unknown }>) {
  return {
    id,
    agent: "reviewer",
    kind: "runtime" as const,
    input: { task: "Test task", fixtures: {} },
    expected: { assertions: assertions as Array<{ type: never; value?: unknown }> }
  };
}

describe("determinism assertions", () => {
  describe("output_schema_lock", () => {
    it("passes when output JSON has all expected keys from array", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("schema-lock-pass", [
          { type: "output_schema_lock", value: ["approved", "severity", "issues"] }
        ]),
        { output_text: JSON.stringify({ approved: false, severity: "high", issues: ["err"] }) }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("fails for missing key in output", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("schema-lock-missing-key", [
          { type: "output_schema_lock", value: ["approved", "severity", "issues"] }
        ]),
        { output_text: JSON.stringify({ approved: false }) }
      );
      expect(result.passed).toBe(false);
      expect(result.assertions[0]?.passed).toBe(false);
    });

    it("fails for non-JSON output when value is non-null", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("schema-lock-non-json", [
          { type: "output_schema_lock", value: ["approved"] }
        ]),
        { output_text: "This is not JSON" }
      );
      expect(result.passed).toBe(false);
      expect(result.assertions[0]?.passed).toBe(false);
    });

    it("passes trivially when value is null", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("schema-lock-null-value", [{ type: "output_schema_lock", value: null }]),
        { output_text: "anything" }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });
  });

  describe("retry_stability", () => {
    it("passes trivially when no raw.runs", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("retry-stability-no-runs", [{ type: "retry_stability" }]),
        { output_text: "Some output" }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("passes when all runs match", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("retry-stability-match", [{ type: "retry_stability" }]),
        {
          output_text: "stable output",
          raw: { runs: ["stable output", "stable output", "stable output"] }
        }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("soft-fails when runs differ", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("retry-stability-differ", [{ type: "retry_stability" }]),
        {
          output_text: "run one",
          raw: { runs: ["run one", "run two", "run three"] }
        }
      );
      expect(result.assertions[0]?.passed).toBe(false);
    });
  });

  describe("determinism_score", () => {
    it("passes with score=1.0 when all runs are the same", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("determinism-score-pass", [{ type: "determinism_score", value: 1.0 }]),
        {
          output_text: "same",
          raw: { runs: ["same", "same", "same"] }
        }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("fails when score is below threshold", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("determinism-score-fail", [{ type: "determinism_score", value: 0.9 }]),
        {
          output_text: "run-a",
          raw: { runs: ["run-a", "run-b", "run-c", "run-d"] }
        }
      );
      expect(result.passed).toBe(false);
      expect(result.assertions[0]?.passed).toBe(false);
    });
  });

  describe("trajectory_ordered", () => {
    it("passes when tools appear in expected order", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("trajectory-ordered-pass", [
          { type: "trajectory_ordered", value: ["Read", "Grep"] }
        ]),
        {
          output_text: "Done",
          trace: [
            { type: "tool_call", name: "Read" },
            { type: "tool_call", name: "Grep" },
            { type: "tool_call", name: "Bash" }
          ]
        }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("fails when order is wrong", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("trajectory-ordered-fail", [
          { type: "trajectory_ordered", value: ["Grep", "Read"] }
        ]),
        {
          output_text: "Done",
          trace: [
            { type: "tool_call", name: "Read" },
            { type: "tool_call", name: "Grep" }
          ]
        }
      );
      expect(result.passed).toBe(false);
      expect(result.assertions[0]?.passed).toBe(false);
    });
  });

  describe("trajectory_subset", () => {
    it("passes when all trace tools are in allowed set", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("trajectory-subset-pass", [
          { type: "trajectory_subset", value: ["Read", "Grep", "Bash"] }
        ]),
        {
          output_text: "Done",
          trace: [
            { type: "tool_call", name: "Read" },
            { type: "tool_call", name: "Grep" }
          ]
        }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("soft-fails when an extra tool is used outside the allowed subset", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("trajectory-subset-fail", [
          { type: "trajectory_subset", value: ["Read", "Grep"] }
        ]),
        {
          output_text: "Done",
          trace: [
            { type: "tool_call", name: "Read" },
            { type: "tool_call", name: "Write" }
          ]
        }
      );
      expect(result.assertions[0]?.passed).toBe(false);
    });
  });

  describe("judge_score", () => {
    it("passes trivially without raw.judge_score", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("judge-score-trivial", [{ type: "judge_score", value: 0.7 }]),
        { output_text: "Output without judge score" }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("passes when raw.judge_score meets threshold", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("judge-score-pass", [{ type: "judge_score", value: 0.7 }]),
        {
          output_text: "Output",
          raw: { judge_score: 0.85 }
        }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("fails when raw.judge_score is below threshold", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("judge-score-fail", [{ type: "judge_score", value: 0.7 }]),
        {
          output_text: "Output",
          raw: { judge_score: 0.4 }
        }
      );
      expect(result.passed).toBe(false);
      expect(result.assertions[0]?.passed).toBe(false);
    });
  });

  describe("pairwise_preference", () => {
    it("passes trivially without raw.pairwise_winner", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("pairwise-trivial", [{ type: "pairwise_preference" }]),
        { output_text: "Output without pairwise data" }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("passes when raw.pairwise_winner is 'current'", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("pairwise-pass", [{ type: "pairwise_preference" }]),
        {
          output_text: "Output",
          raw: { pairwise_winner: "current" }
        }
      );
      expect(result.passed).toBe(true);
      expect(result.assertions[0]?.passed).toBe(true);
    });

    it("fails when raw.pairwise_winner is not 'current'", async () => {
      const result = await evaluateRuntimeCase(
        makeCase("pairwise-fail", [{ type: "pairwise_preference" }]),
        {
          output_text: "Output",
          raw: { pairwise_winner: "comparison" }
        }
      );
      expect(result.passed).toBe(false);
      expect(result.assertions[0]?.passed).toBe(false);
    });
  });
});
