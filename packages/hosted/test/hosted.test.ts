import { describe, expect, it } from "vitest";

import {
  buildBadgeAttestation,
  buildGitHubStatusPayload,
  buildLeaderboard,
  buildMerkleSnapshot,
  buildRegistry,
  createCertificationRequest,
  discoverSupportedAgentPaths,
  renderRepoPage,
  validateSubmissionPayload,
  verifyCorpusInclusion
} from "../src/index.js";
import type { HostedRepoEntry, HostedSubmissionPayload } from "../src/index.js";

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

describe("buildGitHubStatusPayload", () => {
  const baseEntry: HostedSubmissionPayload = {
    schema_version: 1,
    source_mode: "ci",
    summary: {
      score: 0.92,
      badge: "certified",
      agents: 2,
      static_cases: 2,
      runtime_cases: 1
    },
    agents: [],
    adapters: ["claude-md"],
    runtime_cases: 1,
    static_cases: 2,
    attribution: { owner: "spy", repo: "subagent-evals" }
  };

  it("certified badge -> state: success", () => {
    const result = buildGitHubStatusPayload({ ...baseEntry, summary: { ...baseEntry.summary, badge: "certified" } });
    expect(result.state).toBe("success");
  });

  it("strong badge -> state: success", () => {
    const result = buildGitHubStatusPayload({ ...baseEntry, summary: { ...baseEntry.summary, badge: "strong" } });
    expect(result.state).toBe("success");
  });

  it("usable badge -> state: success (not pending)", () => {
    const result = buildGitHubStatusPayload({ ...baseEntry, summary: { ...baseEntry.summary, badge: "usable" } });
    expect(result.state).toBe("success");
  });

  it("experimental badge -> state: failure", () => {
    const result = buildGitHubStatusPayload({ ...baseEntry, summary: { ...baseEntry.summary, badge: "experimental", score: 0.3 } });
    expect(result.state).toBe("failure");
  });

  it("description includes badge and score", () => {
    const result = buildGitHubStatusPayload(baseEntry);
    expect(result.description).toContain("certified");
    expect(result.description).toContain("0.920");
  });

  it("target_url constructed from base_url + attribution when provided", () => {
    const result = buildGitHubStatusPayload(baseEntry, { base_url: "https://example.com" });
    expect(result.target_url).toBe("https://example.com/repos/spy/subagent-evals");
  });

  it("target_url is absent when base_url not provided", () => {
    const result = buildGitHubStatusPayload(baseEntry);
    expect(result.target_url).toBeUndefined();
  });
});

describe("buildRegistry", () => {
  it("returns schema_version: 1", () => {
    const result = buildRegistry([]);
    expect(result.schema_version).toBe(1);
  });

  it("generated_at is a valid ISO string", () => {
    const result = buildRegistry([]);
    expect(() => new Date(result.generated_at)).not.toThrow();
    expect(new Date(result.generated_at).toISOString()).toBe(result.generated_at);
  });

  it("entries array is passed through", () => {
    const entry = {
      pack_id: "test-pack",
      pack_version: "1.0.0",
      pack_type: "prompt-injection",
      publisher: "spy",
      verified: true,
      created_at: "2026-04-19T00:00:00Z"
    };
    const result = buildRegistry([entry]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.pack_id).toBe("test-pack");
  });
});

describe("createCertificationRequest", () => {
  it("returns schema_version: 1 and submitted_at is a valid ISO string", () => {
    const result = createCertificationRequest({ repo_id: "spy/test", reviewer_id: "reviewer-1" });
    expect(result.schema_version).toBe(1);
    expect(() => new Date(result.submitted_at)).not.toThrow();
    expect(new Date(result.submitted_at).toISOString()).toBe(result.submitted_at);
  });

  it("all input fields present in output", () => {
    const result = createCertificationRequest({
      repo_id: "spy/test",
      reviewer_id: "reviewer-1",
      corpus_pack_id: "pack-abc",
      replay_bundle_id: "bundle-xyz",
      notes: "looks good"
    });
    expect(result.repo_id).toBe("spy/test");
    expect(result.reviewer_id).toBe("reviewer-1");
    expect(result.corpus_pack_id).toBe("pack-abc");
    expect(result.replay_bundle_id).toBe("bundle-xyz");
    expect(result.notes).toBe("looks good");
  });
});

describe("buildBadgeAttestation", () => {
  const entry: HostedRepoEntry = {
    id: "spy/subagent-evals",
    summary: { score: 0.92, badge: "certified", agents: 2, static_cases: 2, runtime_cases: 1 },
    attribution: { owner: "spy", repo: "subagent-evals" },
    source_mode: "ci",
    adapters: ["claude-md"]
  };

  it("payload_hash is a 64-char hex string", () => {
    const result = buildBadgeAttestation(entry);
    expect(result.payload_hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(result.payload_hash)).toBe(true);
  });

  it("repo_id comes from attribution when present", () => {
    const result = buildBadgeAttestation(entry);
    expect(result.repo_id).toBe("spy/subagent-evals");
  });

  it("repo_id falls back to entry.id when attribution is absent", () => {
    const noAttr: HostedRepoEntry = { ...entry, attribution: undefined };
    const result = buildBadgeAttestation(noAttr);
    expect(result.repo_id).toBe("spy/subagent-evals");
  });

  it("merkle_root included when passed in options", () => {
    const result = buildBadgeAttestation(entry, { merkle_root: "abc123" });
    expect(result.merkle_root).toBe("abc123");
  });

  it("merkle_root absent when not passed", () => {
    const result = buildBadgeAttestation(entry);
    expect(result.merkle_root).toBeUndefined();
  });

  it("corpus_pack_id and replay_bundle_id included when in options", () => {
    const result = buildBadgeAttestation(entry, {
      corpus_pack_id: "pack-abc",
      replay_bundle_id: "bundle-xyz"
    });
    expect(result.corpus_pack_id).toBe("pack-abc");
    expect(result.replay_bundle_id).toBe("bundle-xyz");
  });
});

describe("verifyCorpusInclusion", () => {
  it("returns included: true with leaf_hash when pack_id found in snapshot leaves", () => {
    const snapshot = buildMerkleSnapshot(
      [
        {
          id: "spy/subagent-evals",
          summary: { score: 0.92, badge: "certified", agents: 1, static_cases: 1, runtime_cases: 0 },
          source_mode: "ci",
          adapters: []
        }
      ],
      "2026-04-19T00:00:00Z"
    );
    const result = verifyCorpusInclusion("spy/subagent-evals", snapshot);
    expect(result.included).toBe(true);
    expect(result.leaf_hash).toBeDefined();
    expect(typeof result.leaf_hash).toBe("string");
  });

  it("returns included: false when not found", () => {
    const snapshot = buildMerkleSnapshot([], "2026-04-19T00:00:00Z");
    const result = verifyCorpusInclusion("not-in-snapshot", snapshot);
    expect(result.included).toBe(false);
    expect(result.leaf_hash).toBeUndefined();
  });
});
