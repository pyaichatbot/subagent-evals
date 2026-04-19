import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";

describe("growth feature cli commands", () => {
  it("writes a badge artifact", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-growth-"));
    mkdirSync(join(dir, "out"), { recursive: true });
    const current = {
      summary: { score: 0.91, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.91, badge: "certified", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    const baseline = {
      summary: { score: 0.6, badge: "usable", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.6, badge: "usable", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    writeFileSync(join(dir, "current.json"), JSON.stringify(current), "utf8");
    writeFileSync(join(dir, "baseline.json"), JSON.stringify(baseline), "utf8");

    await runCli(["badge", "--input", join(dir, "current.json"), "--output", join(dir, "out/badge.json")]);
    expect(readFileSync(join(dir, "out/badge.json"), "utf8")).toContain("certified");
  });

  it("writes a diff artifact", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-diff-"));
    mkdirSync(join(dir, "out"), { recursive: true });
    const current = {
      summary: { score: 0.91, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.91, badge: "certified", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    const baseline = {
      summary: { score: 0.6, badge: "usable", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.6, badge: "usable", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    writeFileSync(join(dir, "current.json"), JSON.stringify(current), "utf8");
    writeFileSync(join(dir, "baseline.json"), JSON.stringify(baseline), "utf8");

    await runCli([
      "diff",
      "--current",
      join(dir, "current.json"),
      "--baseline",
      join(dir, "baseline.json"),
      "--output",
      join(dir, "out/diff.json")
    ]);
    expect(readFileSync(join(dir, "out/diff.json"), "utf8")).toContain("score_delta");
  });

  it("writes a PR comment artifact", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-comment-"));
    mkdirSync(join(dir, "out"), { recursive: true });
    const current = {
      summary: { score: 0.91, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.91, badge: "certified", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    const baseline = {
      summary: { score: 0.6, badge: "usable", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.6, badge: "usable", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    writeFileSync(join(dir, "current.json"), JSON.stringify(current), "utf8");
    writeFileSync(join(dir, "baseline.json"), JSON.stringify(baseline), "utf8");

    await runCli([
      "comment",
      "--current",
      join(dir, "current.json"),
      "--baseline",
      join(dir, "baseline.json"),
      "--output",
      join(dir, "out/pr-comment.md")
    ]);
    expect(readFileSync(join(dir, "out/pr-comment.md"), "utf8")).toContain("Score delta");
  });

  it("submits to an endpoint or prints payload", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-submit-"));
    const report = {
      summary: { score: 0.91, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.91, badge: "certified", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    writeFileSync(join(dir, "results.json"), JSON.stringify(report), "utf8");

    let body = "";
    const server = createServer((req, res) => {
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    await runCli([
      "submit",
      "--input",
      join(dir, "results.json"),
      "--endpoint",
      `http://127.0.0.1:${port}/api/submit`,
      "--public",
      "--owner",
      "spy",
      "--repo",
      "subagent-evals",
      "--output",
      join(dir, "payload.json")
    ]);
    server.close();

    expect(body).toContain("\"owner\":\"spy\"");
    expect(readFileSync(join(dir, "payload.json"), "utf8")).toContain("\"schema_version\": 1");
  });

  it("fails fast when --public is missing owner/repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-submit-public-"));
    const report = {
      summary: { score: 0.91, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
      adapters: ["claude-md"],
      agents: [{ agent_id: "reviewer", score: 0.91, badge: "certified", findings: [] }],
      static_results: [],
      runtime_cases: []
    };
    writeFileSync(join(dir, "results.json"), JSON.stringify(report), "utf8");

    await expect(
      runCli(["submit", "--input", join(dir, "results.json"), "--public"])
    ).rejects.toThrow(/--public requires --owner and --repo/);
  });
});
