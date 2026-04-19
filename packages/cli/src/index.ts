import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Command } from "commander";
import yaml from "js-yaml";
import {
  createJUnitReport,
  defaultConfig,
  discoverAgents,
  evaluateProject,
  loadConfig,
  normalizeDiscoveredAgent,
  relativePath
} from "@subagent-evals/core";
import { renderHtmlReport } from "@subagent-evals/report-html";

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function writeText(path: string, text: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, text, "utf8");
}

function starterCase(): string {
  return `id: reviewer-runtime
agent: reviewer
kind: runtime
input:
  task: "Review this diff for correctness and edge cases"
  fixtures:
    output_text: "Found an unhandled error path by reading the diff."
expected:
  score_min: 0.66
  assertions:
    - type: contains
      value: "unhandled error"
    - type: mentions
      value: "reading"
`;
}

function sampleClaudeAgent(): string {
  return `---
name: reviewer
description: Reviews diffs and returns a concise verdict with findings.
tools: Read, Grep, Bash
model: sonnet
---

You review a diff. JSON only.
Return:
- approved
- severity
- issues
`;
}

function sampleGenericAgent(): string {
  return `---
name: summarizer
description: Summarizes a task result for stakeholders.
tools:
  - Read
---

Produce a short summary with decisions, risks, and next steps.
`;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program.name("subagent-evals");

  program
    .command("init")
    .option("--cwd <cwd>", "working directory", process.cwd())
    .action(async (options) => {
      const cwd = resolve(options.cwd);
      const config = defaultConfig();
      await writeText(
        join(cwd, "subagent-evals.config.yaml"),
        yaml.dump({
          discovery: {
            roots: config.discovery.roots,
            globs: config.discovery.globs,
            format: config.discovery.format
          },
          runtime: {
            runner: config.runtime.runner,
            command: config.runtime.command,
            args: config.runtime.args
          },
          outputs: config.outputs
        })
      );
      await writeText(join(cwd, "cases/reviewer.yaml"), starterCase());
      await writeText(
        join(cwd, "examples/claude-project/.claude/agents/reviewer.md"),
        sampleClaudeAgent()
      );
      await writeText(
        join(cwd, "examples/generic-project/agents/summarizer.md"),
        sampleGenericAgent()
      );
    });

  program
    .command("discover")
    .option("--cwd <cwd>", "working directory", process.cwd())
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .action(async (options) => {
      const cwd = resolve(options.cwd);
      const config = await loadConfig(resolve(cwd, options.config));
      const agents = await discoverAgents({
        cwd,
        roots: config.discovery.roots,
        format: config.discovery.format,
        globs: config.discovery.globs
      });
      const normalized = await Promise.all(agents.map(normalizeDiscoveredAgent));
      process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
    });

  program
    .command("lint")
    .option("--cwd <cwd>", "working directory", process.cwd())
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .action(async (options) => {
      const cwd = resolve(options.cwd);
      const config = await loadConfig(resolve(cwd, options.config));
      const report = await evaluateProject({ cwd, config, runtimeCasesDir: "__none__" });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.static_results.some((result) => result.badge === "experimental")) {
        process.exitCode = 1;
      }
    });

  program
    .command("eval")
    .option("--cwd <cwd>", "working directory", process.cwd())
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .action(async (options) => {
      const cwd = resolve(options.cwd);
      const configPath = resolve(cwd, options.config);
      const config = await loadConfig(configPath);
      const report = await evaluateProject({ cwd, config });
      const outputJson = resolve(cwd, config.outputs?.json ?? "out/results.json");
      const outputJUnit = resolve(cwd, config.outputs?.junit ?? "out/results.junit.xml");
      const outputHtml = resolve(cwd, config.outputs?.html ?? "out/report.html");
      await writeText(outputJson, JSON.stringify(report, null, 2));
      await writeText(outputJUnit, createJUnitReport(report));
      await writeText(outputHtml, renderHtmlReport(report));
      process.stdout.write(
        `Evaluated ${report.summary.agents} agents (${relativePath(cwd, outputJson)})\n`
      );
      if (report.runtime_cases.some((item) => !item.passed)) {
        process.exitCode = 1;
      }
    });

  program
    .command("report")
    .requiredOption("--input <input>", "results json")
    .option("--output <output>", "html output")
    .action(async (options) => {
      const input = resolve(options.input);
      const report = JSON.parse(await readFile(input, "utf8"));
      const html = renderHtmlReport(report);
      if (options.output) {
        await writeText(resolve(options.output), html);
      } else {
        process.stdout.write(html);
      }
    });

  await program.parseAsync(argv, { from: "user" });
}

export { renderHtmlReport } from "@subagent-evals/report-html";
