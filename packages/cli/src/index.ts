import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Command } from "commander";
import yaml from "js-yaml";
import {
  createBadgeJson,
  createSubmissionPayload,
  diffEvalReports,
  createJUnitReport,
  defaultConfig,
  discoverAgents,
  evaluateProject,
  loadConfig,
  normalizeDiscoveredAgent,
  relativePath,
  renderPrComment,
  type DiscoveryFormat
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
  return `id: starter-runtime
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
model: haiku
---

Produce a short summary with decisions, risks, and next steps.
`;
}

function resolveCommandCwd(target: string | undefined, cwdOption: string | undefined): string {
  return resolve(cwdOption ?? target ?? process.cwd());
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program.name("subagent-evals");

  program
    .command("init")
    .argument("[target]", "directory to initialize")
    .option("--cwd <cwd>", "working directory")
    .option(
      "--format <format>",
      "agent format (auto | claude-md | codex-md | copilot-instructions | cursor-rules | windsurf-config | generic-frontmatter-md)",
      "auto"
    )
    .action(async (target, options) => {
      const cwd = resolveCommandCwd(target, options.cwd);
      const config = defaultConfig();
      config.discovery.format = options.format as DiscoveryFormat;
      await writeText(
        join(cwd, "subagent-evals.config.yaml"),
        yaml.dump({
          discovery: {
            roots: config.discovery.roots,
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
      await writeText(join(cwd, "cases/starter.yaml"), starterCase());
      await writeText(
        join(cwd, "examples/claude-project/.claude/agents/reviewer.md"),
        sampleClaudeAgent()
      );
      await writeText(
        join(cwd, "examples/generic-project/agents/summarizer.md"),
        sampleGenericAgent()
      );
      process.stdout.write("Initialized subagent-evals\n");
      process.stdout.write(`  format: ${options.format}\n`);
      process.stdout.write("  config: subagent-evals.config.yaml\n");
      process.stdout.write("  starter case: cases/starter.yaml\n");
      process.stdout.write("\nRun: npx subagent-evals@latest lint .\n");
    });

  program
    .command("discover")
    .argument("[target]", "directory to inspect")
    .option("--cwd <cwd>", "working directory")
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .action(async (target, options) => {
      const cwd = resolveCommandCwd(target, options.cwd);
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
    .argument("[target]", "directory to lint")
    .option("--cwd <cwd>", "working directory")
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .action(async (target, options) => {
      const cwd = resolveCommandCwd(target, options.cwd);
      const config = await loadConfig(resolve(cwd, options.config));
      const report = await evaluateProject({ cwd, config, runtimeCasesDir: "__none__" });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      const failBelow = config.thresholds?.fail_below;
      if (
        report.static_results.some(
          (result) =>
            result.badge === "experimental" ||
            (typeof failBelow === "number" && result.score < failBelow)
        )
      ) {
        process.exitCode = 1;
      }
    });

  program
    .command("eval")
    .argument("[target]", "directory to evaluate")
    .option("--cwd <cwd>", "working directory")
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .action(async (target, options) => {
      const cwd = resolveCommandCwd(target, options.cwd);
      const configPath = resolve(cwd, options.config);
      const config = await loadConfig(configPath);
      const report = await evaluateProject({ cwd, config });
      const outputJson = resolve(cwd, config.outputs?.json ?? "out/results.json");
      const outputJUnit = resolve(cwd, config.outputs?.junit ?? "out/results.junit.xml");
      const outputHtml = resolve(cwd, config.outputs?.html ?? "out/report.html");
      const outputBadge = resolve(cwd, config.outputs?.badge ?? "out/badge.json");
      await writeText(outputJson, JSON.stringify(report, null, 2));
      await writeText(outputJUnit, createJUnitReport(report));
      await writeText(outputHtml, renderHtmlReport(report));
      await writeText(outputBadge, JSON.stringify(createBadgeJson(report), null, 2));
      process.stdout.write(
        `Evaluated ${report.summary.agents} agents (${relativePath(cwd, outputJson)})\n`
      );
      const failBelow = config.thresholds?.fail_below;
      if (
        report.runtime_cases.some((item) => !item.passed) ||
        (typeof failBelow === "number" &&
          report.static_results.some((result) => result.score < failBelow))
      ) {
        process.exitCode = 1;
      }
    });

  program
    .command("badge")
    .requiredOption("--input <input>", "results json")
    .requiredOption("--output <output>", "badge json output")
    .action(async (options) => {
      const report = JSON.parse(await readFile(resolve(options.input), "utf8"));
      await writeText(resolve(options.output), JSON.stringify(createBadgeJson(report), null, 2));
    });

  program
    .command("diff")
    .requiredOption("--current <current>", "current results json")
    .option("--baseline <baseline>", "baseline results json")
    .requiredOption("--output <output>", "diff output json")
    .action(async (options) => {
      const current = JSON.parse(await readFile(resolve(options.current), "utf8"));
      const baseline = options.baseline
        ? JSON.parse(await readFile(resolve(options.baseline), "utf8"))
        : null;
      const diff = diffEvalReports(current, baseline);
      await writeText(resolve(options.output), JSON.stringify(diff, null, 2));
    });

  program
    .command("comment")
    .requiredOption("--current <current>", "current results json")
    .option("--baseline <baseline>", "baseline results json")
    .requiredOption("--output <output>", "markdown output path")
    .action(async (options) => {
      const current = JSON.parse(await readFile(resolve(options.current), "utf8"));
      const baseline = options.baseline
        ? JSON.parse(await readFile(resolve(options.baseline), "utf8"))
        : null;
      const diff = diffEvalReports(current, baseline);
      await writeText(resolve(options.output), renderPrComment(current, diff));
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

  program
    .command("submit")
    .requiredOption("--input <input>", "results json")
    .option("--endpoint <endpoint>", "submit endpoint", process.env.SUBAGENT_EVALS_SUBMIT_ENDPOINT)
    .option("--output <output>", "payload output path")
    .option("--public", "include attributed repo metadata")
    .option("--owner <owner>", "repo owner")
    .option("--repo <repo>", "repo name")
    .option("--commit-sha <commitSha>", "commit SHA")
    .option("--homepage <homepage>", "homepage")
    .option("--description <description>", "description")
    .option("--source-mode <sourceMode>", "local | ci | crawl", "local")
    .action(async (options) => {
      if (options.public && (!options.owner || !options.repo)) {
        throw new Error("--public requires --owner and --repo");
      }
      const report = JSON.parse(await readFile(resolve(options.input), "utf8"));
      const payload = createSubmissionPayload({
        report,
        source_mode: options.sourceMode,
        attribution: options.public
          ? {
              owner: options.owner,
              repo: options.repo,
              commit_sha: options.commitSha,
              homepage: options.homepage,
              description: options.description
            }
          : undefined
      });
      if (options.output) {
        await writeText(resolve(options.output), JSON.stringify(payload, null, 2));
      }
      if (options.endpoint) {
        const response = await fetch(options.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`submit failed: ${response.status} ${await response.text()}`);
        }
        process.stdout.write(`${await response.text()}\n`);
      } else {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      }
    });

  await program.parseAsync(argv, { from: "user" });
}

export { renderHtmlReport } from "@subagent-evals/report-html";
