import { describe, expect, it } from "vitest";

import {
  buildLeaderboard,
  discoverSupportedAgentPaths,
  renderRepoPage,
  validateSubmissionPayload
} from "../src/index.js";

describe("hosted helpers", () => {
  const payload = {
    schema_version: 1 as const,
    source_mode: "ci" as const,
    summary: {
      score: 0.92,
      badge: "certified" as const,
      agents: 2,
      static_cases: 2,
      runtime_cases: 1
    },
    agents: [],
    adapters: ["claude-md" as const],
    runtime_cases: 1,
    static_cases: 2,
    attribution: {
      owner: "spy",
      repo: "subagent-evals"
    }
  };

  it("validates payloads and builds a leaderboard", () => {
    expect(validateSubmissionPayload(payload)).toBe(true);
    expect(buildLeaderboard([payload])[0]?.id).toBe("spy/subagent-evals");
  });

  it("renders repo pages and detects supported agent paths", () => {
    expect(renderRepoPage(payload)).toContain("spy/subagent-evals");
    expect(
      discoverSupportedAgentPaths([
        "src/index.ts",
        ".claude/agents/reviewer.md",
        ".github/copilot-instructions.md"
      ])
    ).toEqual([".claude/agents/reviewer.md", ".github/copilot-instructions.md"]);
  });

  it("rejects malformed summary payloads", () => {
    expect(
      validateSubmissionPayload({
        schema_version: 1,
        source_mode: "ci",
        summary: { badge: "strong" },
        agents: [],
        adapters: []
      })
    ).toBe(false);
  });

  it("escapes html in repo pages", () => {
    expect(
      renderRepoPage({
        ...payload,
        attribution: {
          owner: "<script>",
          repo: "repo"
        }
      })
    ).not.toContain("<script>");
  });
});
