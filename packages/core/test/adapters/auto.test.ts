import { describe, expect, it, vi } from "vitest";

import { discoverAutoAgents } from "../../src/adapters/auto.js";
import { normalizeDiscoveredAgent } from "../../src/index.js";

describe("auto discovery", () => {
  it("discovers agents from all present formats in parallel", async () => {
    const agents = await discoverAutoAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/mixed-project"]
    });

    expect(agents.length).toBeGreaterThanOrEqual(3);
    const formats = new Set(agents.map((agent) => agent.format_adapter_id));
    expect(formats).toContain("claude-md");
    expect(formats).toContain("codex-md");
    expect(formats).toContain("cursor-rules");
  });

  it("sets id_override on every discovered agent using the locked ID rule", async () => {
    const agents = await discoverAutoAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/mixed-project"]
    });

    for (const agent of agents) {
      expect(agent.id_override).toBeTruthy();
      expect(agent.id_override).toMatch(new RegExp(`^${agent.format_adapter_id}:`));
      if (agent.section === undefined) {
        expect(agent.id_override).not.toContain("#");
      } else {
        expect(agent.id_override).toContain(`#${agent.section}`);
      }
    }
  });

  it("emits a stderr warning when 3 or more adapters are found", async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    await discoverAutoAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/mixed-project"]
    });

    spy.mockRestore();
    expect(writes.some((message) => message.includes("3 or more agent formats"))).toBe(
      true
    );
  });

  it("emits no warning for single-format repos", async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    await discoverAutoAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/claude-project"]
    });

    spy.mockRestore();
    expect(writes.some((message) => message.includes("3 or more agent formats"))).toBe(
      false
    );
  });

  it("normalizeDiscoveredAgent uses id_override for auto-mode agents", async () => {
    const agents = await discoverAutoAgents({
      cwd: process.cwd(),
      roots: ["packages/core/test/fixtures/mixed-project"]
    });

    const coderAgent = agents.find((agent) => agent.format_adapter_id === "claude-md");
    expect(coderAgent).toBeDefined();
    const normalized = await normalizeDiscoveredAgent(coderAgent!);
    expect(normalized.id).toBe(coderAgent?.id_override);
  });
});
