import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  detectDrift,
  evaluateParity,
  loadTimeSeriesSnapshots,
  saveTimeSeriesSnapshot
} from "../src/index.js";
import type { EvalConfig, TimeSeriesSnapshot } from "../src/index.js";

function makeSnapshot(score: number, badge: "certified" | "strong" | "usable" | "experimental", createdAt: string, agents: Array<{ agent_id: string; score: number; badge: "certified" | "strong" | "usable" | "experimental" }> = []): TimeSeriesSnapshot {
  return {
    schema_version: 1,
    created_at: createdAt,
    summary: { score, badge, agents: agents.length || 1, static_cases: 1, runtime_cases: 0 },
    agents
  };
}

describe("detectDrift", () => {
  it("returns has_drift: false when fewer than 2 snapshots", () => {
    const result = detectDrift([]);
    expect(result.has_drift).toBe(false);

    const single = detectDrift([makeSnapshot(0.9, "certified", "2026-01-01T00:00:00Z")]);
    expect(single.has_drift).toBe(false);
  });

  it("returns has_drift: false when scores are identical across snapshots", () => {
    const s1 = makeSnapshot(0.9, "certified", "2026-01-01T00:00:00Z");
    const s2 = makeSnapshot(0.9, "certified", "2026-01-02T00:00:00Z");
    const result = detectDrift([s1, s2]);
    expect(result.has_drift).toBe(false);
    expect(result.score_delta).toBe(0);
  });

  it("returns has_drift: true when latest score drops more than 0.05 from previous", () => {
    const s1 = makeSnapshot(0.9, "certified", "2026-01-01T00:00:00Z", [
      { agent_id: "reviewer", score: 0.9, badge: "certified" }
    ]);
    const s2 = makeSnapshot(0.82, "strong", "2026-01-02T00:00:00Z", [
      { agent_id: "reviewer", score: 0.82, badge: "strong" }
    ]);
    const result = detectDrift([s1, s2]);
    expect(result.has_drift).toBe(true);
    expect(result.score_delta).toBeCloseTo(-0.08, 2);
  });

  it("returns has_drift: false when latest score improves", () => {
    const s1 = makeSnapshot(0.7, "strong", "2026-01-01T00:00:00Z");
    const s2 = makeSnapshot(0.95, "certified", "2026-01-02T00:00:00Z");
    const result = detectDrift([s1, s2]);
    expect(result.has_drift).toBe(false);
    expect(result.score_delta).toBeGreaterThan(0);
  });

  it("badge_changed: true when badge changes direction even without has_drift", () => {
    const s1 = makeSnapshot(0.7, "strong", "2026-01-01T00:00:00Z");
    const s2 = makeSnapshot(0.95, "certified", "2026-01-02T00:00:00Z");
    const result = detectDrift([s1, s2]);
    expect(result.badge_changed).toBe(true);
    expect(result.has_drift).toBe(false);
  });

  it("agent_regressions populated when agent score drops more than 0.05", () => {
    const s1 = makeSnapshot(0.9, "certified", "2026-01-01T00:00:00Z", [
      { agent_id: "reviewer", score: 0.9, badge: "certified" }
    ]);
    const s2 = makeSnapshot(0.8, "strong", "2026-01-02T00:00:00Z", [
      { agent_id: "reviewer", score: 0.8, badge: "strong" }
    ]);
    const result = detectDrift([s1, s2]);
    expect(result.agent_regressions).toHaveLength(1);
    expect(result.agent_regressions[0]?.agent_id).toBe("reviewer");
  });

  it("score_delta is latest minus previous (positive for improvement)", () => {
    const s1 = makeSnapshot(0.6, "usable", "2026-01-01T00:00:00Z");
    const s2 = makeSnapshot(0.85, "strong", "2026-01-02T00:00:00Z");
    const result = detectDrift([s1, s2]);
    expect(result.score_delta).toBeCloseTo(0.25, 2);
  });

  it("score_delta is negative for regression", () => {
    const s1 = makeSnapshot(0.9, "certified", "2026-01-01T00:00:00Z");
    const s2 = makeSnapshot(0.5, "usable", "2026-01-02T00:00:00Z");
    const result = detectDrift([s1, s2]);
    expect(result.score_delta).toBeLessThan(0);
  });
});

describe("saveTimeSeriesSnapshot + loadTimeSeriesSnapshots", () => {
  it("saves a snapshot and loads it back (round-trip)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-ts-"));
    const snap = makeSnapshot(0.9, "certified", "2026-04-19T00:00:00.000Z");

    await saveTimeSeriesSnapshot(snap, dir);
    const loaded = await loadTimeSeriesSnapshots(dir);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.summary.score).toBe(0.9);
    expect(loaded[0]?.summary.badge).toBe("certified");
    expect(loaded[0]?.created_at).toBe("2026-04-19T00:00:00.000Z");
  });

  it("saves two snapshots and loads both sorted ascending by created_at", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-ts-sort-"));
    const snap1 = makeSnapshot(0.7, "strong", "2026-04-19T00:00:00.000Z");
    const snap2 = makeSnapshot(0.9, "certified", "2026-04-20T00:00:00.000Z");

    // Save in reverse order to verify sorting
    await saveTimeSeriesSnapshot(snap2, dir);
    await saveTimeSeriesSnapshot(snap1, dir);

    const loaded = await loadTimeSeriesSnapshots(dir);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.created_at).toBe("2026-04-19T00:00:00.000Z");
    expect(loaded[1]?.created_at).toBe("2026-04-20T00:00:00.000Z");
  });

  it("returns [] from non-existent directory", async () => {
    const loaded = await loadTimeSeriesSnapshots("/tmp/does-not-exist-subagent-evals-ts-xyz");
    expect(loaded).toEqual([]);
  });

  it("two snapshots saved in the same millisecond don't overwrite (random suffix)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-ts-race-"));
    const snap = makeSnapshot(0.9, "certified", "2026-04-19T00:00:00.000Z");

    // Save the same snapshot twice concurrently (same timestamp, different suffix)
    await Promise.all([
      saveTimeSeriesSnapshot(snap, dir),
      saveTimeSeriesSnapshot(snap, dir)
    ]);

    const loaded = await loadTimeSeriesSnapshots(dir);
    expect(loaded).toHaveLength(2);
  });
});

describe("evaluateParity", () => {
  it("returns parity_score: 1 and empty case_deltas when diff_targets is empty", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-parity-"));
    const config: EvalConfig = {
      discovery: { roots: [], format: "claude-md" },
      runtime: {
        runner: "command-runner",
        mode: "replay",
        snapshot_dir: ".subagent-evals/cache",
        cache_key_strategy: "v1",
        allow_live_fallback: false
        // no diff_targets
      }
    };
    const currentReport = {
      summary: { score: 0.9, badge: "certified" as const, agents: 1, static_cases: 0, runtime_cases: 0 },
      adapters: [] as const,
      agents: [],
      static_results: [],
      runtime_cases: []
    };

    const result = await evaluateParity({ cwd: dir, config, currentReport });
    expect(result.parity_score).toBe(1);
    expect(result.case_deltas).toEqual([]);
  });
});
