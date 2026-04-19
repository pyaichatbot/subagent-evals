import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../src/index.js";

describe("cli", () => {
  it("scaffolds a starter config and example suites", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-evals-init-"));

    await runCli(["init", "--cwd", dir]);

    const config = readFileSync(join(dir, "subagent-evals.config.yaml"), "utf8");
    expect(config).toContain("format: claude-md");
    expect(config).toContain("runner: command-runner");
    expect(readFileSync(join(dir, "cases", "reviewer.yaml"), "utf8")).toContain(
      "kind: runtime"
    );
  });
});
