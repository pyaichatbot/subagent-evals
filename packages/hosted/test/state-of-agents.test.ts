import { describe, expect, it } from "vitest";
import { renderStateOfAgentsPage } from "@subagent-evals/hosted";
import type { StateOfAgentsData } from "@subagent-evals/hosted";

const sampleData: StateOfAgentsData = {
  period: "2026-Q2",
  generated: "2026-04-21T00:00:00Z",
  sample_size: 3,
  caveat: "Sample of 3 repos. Not a random sample.",
  repos: [
    { owner: "acme", repo: "agent", sha: "abc1234", platform: "claude-code", score: 0.91, tier: "certified" },
    { owner: "foo", repo: "bot", sha: "def5678", platform: "cursor", score: 0.65, tier: "usable" },
    { owner: "bar", repo: "ai", sha: "ghi9012", platform: "copilot", score: 0.42, tier: "experimental" }
  ],
  by_platform: {
    "claude-code": { count: 1, avg_score: 0.91, tiers: { certified: 1, strong: 0, usable: 0, experimental: 0 } },
    "cursor": { count: 1, avg_score: 0.65, tiers: { certified: 0, strong: 0, usable: 1, experimental: 0 } },
    "copilot": { count: 1, avg_score: 0.42, tiers: { certified: 0, strong: 0, usable: 0, experimental: 1 } }
  },
  top_failures: ["missing prompt injection guard"],
  top_passes: ["explicit tool allowlist"]
};

describe("renderStateOfAgentsPage", () => {
  it("returns valid HTML string", () => {
    const html = renderStateOfAgentsPage(sampleData);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("</html>");
  });

  it("includes period in title", () => {
    const html = renderStateOfAgentsPage(sampleData);
    expect(html).toContain("2026-Q2");
  });

  it("renders all repos in a table", () => {
    const html = renderStateOfAgentsPage(sampleData);
    expect(html).toContain("acme/agent");
    expect(html).toContain("foo/bot");
    expect(html).toContain("bar/ai");
  });

  it("includes caveat text", () => {
    const html = renderStateOfAgentsPage(sampleData);
    expect(html).toContain("Not a random sample");
  });

  it("includes platform breakdown", () => {
    const html = renderStateOfAgentsPage(sampleData);
    expect(html).toContain("claude-code");
    expect(html).toContain("cursor");
    expect(html).toContain("copilot");
  });

  it("includes top failures and passes", () => {
    const html = renderStateOfAgentsPage(sampleData);
    expect(html).toContain("missing prompt injection guard");
    expect(html).toContain("explicit tool allowlist");
  });
});
