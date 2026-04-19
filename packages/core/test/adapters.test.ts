import { describe, expect, it } from "vitest";

import { discoverAgents, normalizeDiscoveredAgent } from "../src/index.js";

describe("agent discovery", () => {
  it("discovers Claude-style agents and normalizes their metadata", async () => {
    const discovered = await discoverAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/claude-project"],
      format: "claude-md"
    });

    expect(discovered).toHaveLength(1);
    const normalized = await normalizeDiscoveredAgent(discovered[0]);
    expect(normalized).toMatchObject({
      id: "reviewer",
      name: "reviewer",
      description: expect.stringContaining("Reviews current branch diff"),
      tools: ["Read", "Grep", "Bash"],
      model: "sonnet",
      format_adapter_id: "claude-md"
    });
    expect(normalized.instructions).toContain("JSON only");
  });
});
