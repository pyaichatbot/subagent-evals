import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/index.js";

const certifiedReport = {
  summary: { score: 0.91, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
  adapters: ["claude-md"],
  agents: [{ agent_id: "reviewer", score: 0.91, badge: "certified", findings: [] }],
  static_results: [],
  runtime_cases: []
};

describe("badge --write", () => {
  it("writes subagent-evals-badge.json to cwd", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-badge-"));
    writeFileSync(join(dir, "results.json"), JSON.stringify(certifiedReport));
    await runCli(["badge", "--input", join(dir, "results.json"), "--write", "--cwd", dir]);
    const badge = JSON.parse(readFileSync(join(dir, "subagent-evals-badge.json"), "utf8"));
    expect(badge.schemaVersion).toBe(1);
    expect(badge.label).toBe("subagent-evals");
    expect(badge.message).toBe("certified");
  });

  it("--write and --output are mutually exclusive", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-badge-"));
    writeFileSync(join(dir, "results.json"), JSON.stringify(certifiedReport));
    await expect(
      runCli(["badge", "--input", join(dir, "results.json"), "--write", "--output", join(dir, "other.json"), "--cwd", dir])
    ).rejects.toThrow(/mutually exclusive/);
  });

  it("prints shields.io badge markdown after writing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-badge-"));
    writeFileSync(join(dir, "results.json"), JSON.stringify(certifiedReport));
    const output: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (chunk: string) => { output.push(chunk); return true; };
    await runCli(["badge", "--input", join(dir, "results.json"), "--write", "--cwd", dir]);
    (process.stdout as any).write = orig;
    const text = output.join("");
    expect(text).toContain("img.shields.io/endpoint");
    expect(text).toContain("subagent-evals-badge.json");
  });
});
