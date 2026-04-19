import { describe, expect, it } from "vitest";

import { discoverWindsurfAgents } from "../../src/adapters/windsurf-config.js";

describe("windsurf-config adapter", () => {
  it("discovers markdown rules from .windsurf/rules", async () => {
    const agents = await discoverWindsurfAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/windsurf-project"]
    });

    expect(agents).toHaveLength(1);
    expect(agents[0]?.path).toContain("reviewer.md");
    expect(agents[0]?.format_adapter_id).toBe("windsurf-config");
  });
});
