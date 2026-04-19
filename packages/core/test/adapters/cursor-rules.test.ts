import { describe, expect, it } from "vitest";

import { discoverCursorAgents } from "../../src/adapters/cursor-rules.js";

describe("cursor-rules adapter", () => {
  it("discovers .mdc rules from .cursor/rules", async () => {
    const agents = await discoverCursorAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/cursor-project"]
    });

    expect(agents).toHaveLength(1);
    expect(agents[0]?.path).toContain("formatter.mdc");
    expect(agents[0]?.format_adapter_id).toBe("cursor-rules");
  });
});
