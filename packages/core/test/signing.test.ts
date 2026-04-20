import { describe, expect, it } from "vitest";

import { evaluateJudgeMetrics, signCorpusPack } from "../src/index.js";
import type { RunArtifact } from "../src/index.js";

describe("signCorpusPack (sha256 method)", () => {
  it("returns { type: 'sha256', value: <64-char hex> } for any string input", async () => {
    const result = await signCorpusPack({ packContent: "hello world", method: "sha256" });
    expect(result.type).toBe("sha256");
    expect(result.value).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(result.value)).toBe(true);
  });

  it("the same content always produces the same hash (deterministic)", async () => {
    const content = "pack_id: test-pack\nversion: 1.0.0\n";
    const r1 = await signCorpusPack({ packContent: content, method: "sha256" });
    const r2 = await signCorpusPack({ packContent: content, method: "sha256" });
    expect(r1.value).toBe(r2.value);
  });

  it("different content produces different hashes", async () => {
    const r1 = await signCorpusPack({ packContent: "content-a", method: "sha256" });
    const r2 = await signCorpusPack({ packContent: "content-b", method: "sha256" });
    expect(r1.value).not.toBe(r2.value);
  });

  it("empty string produces a valid 64-char hex hash", async () => {
    const result = await signCorpusPack({ packContent: "", method: "sha256" });
    expect(result.type).toBe("sha256");
    expect(result.value).toHaveLength(64);
  });
});

describe("evaluateJudgeMetrics", () => {
  it("returns empty object {} when artifact.raw is absent", () => {
    const artifact: RunArtifact = { output_text: "ok" };
    const result = evaluateJudgeMetrics(artifact);
    expect(result).toEqual({});
  });

  it("returns only defined numeric fields when partial raw is present", () => {
    const artifact: RunArtifact = {
      output_text: "ok",
      raw: { judge_score: 0.8 }
    };
    const result = evaluateJudgeMetrics(artifact);
    expect(result).toEqual({ judge_score: 0.8 });
  });

  it("returns all four fields when all are present in raw", () => {
    const artifact: RunArtifact = {
      output_text: "ok",
      raw: {
        judge_score: 0.9,
        hallucination_rate: 0.05,
        long_context_decay: 0.1,
        citation_faithfulness: 0.85
      }
    };
    const result = evaluateJudgeMetrics(artifact);
    expect(result).toEqual({
      judge_score: 0.9,
      hallucination_rate: 0.05,
      long_context_decay: 0.1,
      citation_faithfulness: 0.85
    });
  });

  it("ignores string values (only numbers included)", () => {
    const artifact: RunArtifact = {
      output_text: "ok",
      raw: {
        judge_score: 0.8,
        hallucination_rate: "low" as unknown as number
      }
    };
    const result = evaluateJudgeMetrics(artifact);
    expect(result).toEqual({ judge_score: 0.8 });
    expect(result.hallucination_rate).toBeUndefined();
  });

  it("returns {} when raw fields are non-numeric", () => {
    const artifact: RunArtifact = {
      output_text: "ok",
      raw: {
        judge_score: "high" as unknown as number
      }
    };
    const result = evaluateJudgeMetrics(artifact);
    expect(result).toEqual({});
  });
});
