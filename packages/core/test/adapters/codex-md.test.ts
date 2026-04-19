import { describe, expect, it } from "vitest";

import { discoverCodexAgents } from "../../src/adapters/codex-md.js";
import { normalizeDiscoveredAgent } from "../../src/index.js";

describe("codex-md adapter", () => {
  it("discovers file-based agents from .codex/agents/", async () => {
    const agents = await discoverCodexAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/codex-project"]
    });

    const fileBased = agents.filter((agent) => agent.section === undefined);
    expect(fileBased).toHaveLength(1);
    expect(fileBased[0]?.format_adapter_id).toBe("codex-md");
    expect(fileBased[0]?.path).toContain("planner.md");
    expect(fileBased[0]?.id_override).toBeUndefined();
  });

  it("discovers section-based agents from AGENTS.md", async () => {
    const agents = await discoverCodexAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/codex-project"]
    });

    const sectionBased = agents.filter((agent) => agent.section !== undefined);
    expect(sectionBased).toHaveLength(2);
    expect(sectionBased.map((agent) => agent.section)).toEqual(
      expect.arrayContaining(["summarizer", "validator"])
    );
    expect(sectionBased[0]?.path).toContain("AGENTS.md");
    expect(sectionBased[0]?.body).toBeTruthy();
  });

  it("returns both file-based and section-based agents when both are present", async () => {
    const agents = await discoverCodexAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/codex-project"]
    });

    expect(agents).toHaveLength(3);
  });

  it("normalizes a section-based codex agent", async () => {
    const agents = await discoverCodexAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/codex-project"]
    });

    const summarizer = agents.find((agent) => agent.section === "summarizer");
    expect(summarizer).toBeDefined();
    const normalized = await normalizeDiscoveredAgent(summarizer!);
    expect(normalized.description).toContain("Summarizes task results");
    expect(normalized.format_adapter_id).toBe("codex-md");
  });
});
