import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateSupplyChain, defaultConfig, loadConfig, type EvalConfig } from "../src/index.js";

function makeConfig(manifests: string[]): EvalConfig {
  return {
    discovery: { roots: ["."], format: "claude-md" },
    runtime: { runner: "command-runner" },
    supply_chain: { manifests }
  };
}

describe("defaultConfig supply_chain opt-in", () => {
  it("defaultConfig has empty manifests array (supply chain is opt-in)", () => {
    const config = defaultConfig();
    expect(config.supply_chain?.manifests).toEqual([]);
  });

  it("loadConfig with no supply_chain section yields empty manifests", async () => {
    const dir = mkdtempSync(join(tmpdir(), "load-config-"));
    const configPath = join(dir, "subagent-evals.yaml");
    writeFileSync(
      configPath,
      "discovery:\n  roots: [.]\n  format: auto\nruntime:\n  runner: command-runner\n",
      "utf8"
    );
    const config = await loadConfig(configPath);
    expect(config.supply_chain?.manifests).toEqual([]);
  });

  it("loadConfig with explicit supply_chain.manifests uses those manifests", async () => {
    const dir = mkdtempSync(join(tmpdir(), "load-config-sc-"));
    const configPath = join(dir, "subagent-evals.yaml");
    writeFileSync(
      configPath,
      "discovery:\n  roots: [.]\n  format: auto\nruntime:\n  runner: command-runner\nsupply_chain:\n  manifests:\n    - package.json\n",
      "utf8"
    );
    const config = await loadConfig(configPath);
    expect(config.supply_chain?.manifests).toEqual(["package.json"]);
  });
});

describe("evaluateSupplyChain", () => {
  it("returns clean report for project with pinned package.json deps", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-pinned-"));
    const pkg = {
      dependencies: {
        lodash: "4.17.21",
        express: "4.18.2"
      }
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(pkg), "utf8");

    const report = await evaluateSupplyChain(makeConfig(["package.json"]), cwd);

    expect(report.schema_version).toBe(1);
    expect(report.manifests).toContain("package.json");
    expect(report.findings.filter((f) => f.id === "unpinned-dependency")).toHaveLength(0);
    expect(report.score).toBeGreaterThanOrEqual(0.9);
  });

  it("returns unpinned findings for package.json with caret versions", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-unpinned-"));
    const pkg = {
      dependencies: {
        lodash: "^4.17.21",
        express: "~4.18.2"
      }
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(pkg), "utf8");

    const report = await evaluateSupplyChain(makeConfig(["package.json"]), cwd);

    const unpinned = report.findings.filter((f) => f.id === "unpinned-dependency");
    expect(unpinned.length).toBeGreaterThanOrEqual(2);
    expect(report.score).toBeLessThan(1.0);
  });

  it("returns unpinned findings for requirements.txt without ==", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-req-"));
    writeFileSync(
      join(cwd, "requirements.txt"),
      "requests>=2.28.0\nnumpy>=1.24.0\n",
      "utf8"
    );

    const report = await evaluateSupplyChain(makeConfig(["requirements.txt"]), cwd);

    const unpinned = report.findings.filter((f) => f.id === "unpinned-dependency");
    expect(unpinned.length).toBeGreaterThanOrEqual(2);
  });

  it("flags typosquatted package name 'lodsh' as suspicious", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-typo-"));
    const pkg = {
      dependencies: {
        lodsh: "1.0.0"
      }
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(pkg), "utf8");

    const report = await evaluateSupplyChain(makeConfig(["package.json"]), cwd);

    const suspicious = report.findings.filter((f) => f.id === "suspicious-package-name");
    expect(suspicious.length).toBeGreaterThanOrEqual(1);
    expect(suspicious[0]?.message).toContain("lodsh");
  });

  it("does not flag canonical package name 'lodash' as suspicious", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-canonical-"));
    const pkg = {
      dependencies: {
        lodash: "4.17.21"
      }
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(pkg), "utf8");

    const report = await evaluateSupplyChain(makeConfig(["package.json"]), cwd);

    const suspicious = report.findings.filter((f) => f.id === "suspicious-package-name");
    expect(suspicious).toHaveLength(0);
  });

  it("handles missing manifests gracefully (no file = no finding for that manifest)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-missing-"));
    // Don't create any files

    const report = await evaluateSupplyChain(
      makeConfig(["package.json", "requirements.txt"]),
      cwd
    );

    expect(report.schema_version).toBe(1);
    expect(report.manifests).toHaveLength(0);
    expect(report.findings).toHaveLength(0);
  });

  it("clamps score to [0, 1]", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "supply-chain-clamp-"));
    // Many unpinned deps to push the score low
    const deps: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
      deps[`pkg-${i}`] = `^1.${i}.0`;
    }
    const pkg = { dependencies: deps };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(pkg), "utf8");

    const report = await evaluateSupplyChain(makeConfig(["package.json"]), cwd);

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);
  });
});
