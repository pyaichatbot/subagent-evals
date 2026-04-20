import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Command } from "commander";
import yaml from "js-yaml";
import {
  createBadgeJson,
  createSubmissionPayload,
  detectDrift,
  diffEvalReports,
  createJUnitReport,
  defaultConfig,
  discoverAgents,
  evaluateParity,
  evaluateProject,
  evaluateSupplyChain,
  loadConfig,
  loadRuntimeCases,
  loadTimeSeriesSnapshots,
  normalizeDiscoveredAgent,
  relativePath,
  renderPrComment,
  verifyCorpusPack,
  type DiscoveryFormat,
  type ModelDiffReport,
  type ReplayBundle
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
      process.stdout.write("\nRun: node packages/cli/dist/bin/subagent-evals.js lint .\n");
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
    .option("--shadow", "run in shadow (non-blocking) mode", false)
    .action(async (target, options) => {
      const cwd = resolveCommandCwd(target, options.cwd);
      const configPath = resolve(cwd, options.config);
      const config = await loadConfig(configPath);
      if (options.shadow) {
        config.runtime.shadow_eval = true;
      }
      const report = await evaluateProject({ cwd, config });
      const outputJson = resolve(cwd, config.outputs?.json ?? "out/results.json");
      const outputJUnit = resolve(cwd, config.outputs?.junit ?? "out/results.junit.xml");
      const outputHtml = resolve(cwd, config.outputs?.html ?? "out/report.html");
      const outputBadge = resolve(cwd, config.outputs?.badge ?? "out/badge.json");
      await writeText(outputJson, JSON.stringify(report, null, 2));
      await writeText(outputJUnit, createJUnitReport(report));
      await writeText(outputHtml, renderHtmlReport(report));
      await writeText(outputBadge, JSON.stringify(createBadgeJson(report), null, 2));
      if (options.shadow) {
        process.stdout.write("[shadow] Eval complete (non-blocking)\n");
      } else {
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

  // diff-model command
  program
    .command("diff-model")
    .requiredOption("--config <config>", "config path", "subagent-evals.config.yaml")
    .requiredOption("--compare-model <model>", "model to compare against")
    .option("--compare-runner <runner>", "runner to use for comparison")
    .option("--output <output>", "output path for diff report json")
    .action(async (options) => {
      const cwd = process.cwd();
      const configPath = resolve(cwd, options.config);
      const config = await loadConfig(configPath);
      const currentReport = await evaluateProject({ cwd, config });
      const compareConfig = {
        ...config,
        runtime: {
          ...config.runtime,
          model: options.compareModel,
          ...(options.compareRunner ? { runner: options.compareRunner } : {})
        }
      };
      const comparisonReport = await evaluateProject({ cwd, config: compareConfig });

      const currentMap = new Map(currentReport.runtime_cases.map((item) => [item.id, item]));
      const comparisonMap = new Map(comparisonReport.runtime_cases.map((item) => [item.id, item]));
      const allIds = [...new Set([...currentMap.keys(), ...comparisonMap.keys()])].sort();

      const runtimeCaseDeltas = allIds
        .filter((id) => currentMap.has(id) && comparisonMap.has(id))
        .map((id) => {
          const cur = currentMap.get(id)!;
          const cmp = comparisonMap.get(id)!;
          return {
            id,
            current_score: cur.score,
            comparison_score: cmp.score,
            score_delta: Number((cmp.score - cur.score).toFixed(3)),
            current_passed: cur.passed,
            comparison_passed: cmp.passed
          };
        });

      const parityCases = runtimeCaseDeltas.filter(
        (item) => item.current_passed === item.comparison_passed
      );
      const parityScore =
        runtimeCaseDeltas.length === 0 ? 1 : parityCases.length / runtimeCaseDeltas.length;

      const diffReport: ModelDiffReport = {
        current_label: config.runtime.model ?? "default",
        comparison_label: options.compareModel,
        current: currentReport,
        comparison: comparisonReport,
        score_delta: Number(
          (comparisonReport.summary.score - currentReport.summary.score).toFixed(3)
        ),
        runtime_case_deltas: runtimeCaseDeltas,
        parity_score: Number(parityScore.toFixed(3))
      };

      const json = JSON.stringify(diffReport, null, 2);
      if (options.output) {
        await writeText(resolve(options.output), json);
      } else {
        process.stdout.write(`${json}\n`);
      }
    });

  // replay subcommands
  const replayCmd = new Command("replay");

  replayCmd
    .addCommand(
      new Command("export")
        .requiredOption("--input <input>", "results json path")
        .requiredOption("--output <output>", "output bundle directory")
        .action(async (options) => {
          const resultsPath = resolve(options.input);
          const report = JSON.parse(await readFile(resultsPath, "utf8")) as {
            replay_bundles?: ReplayBundle[];
          };
          if (!report.replay_bundles || report.replay_bundles.length === 0) {
            process.stdout.write("No replay_bundles found in results file.\n");
            return;
          }
          await ensureDir(resolve(options.output));
          for (const bundle of report.replay_bundles) {
            const outPath = join(resolve(options.output), `${bundle.bundle_id}.json`);
            await writeFile(outPath, JSON.stringify(bundle, null, 2), "utf8");
          }
          process.stdout.write(
            `Exported ${report.replay_bundles.length} replay bundle(s) to ${options.output}\n`
          );
        })
    )
    .addCommand(
      new Command("import")
        .requiredOption("--input <input>", "replay bundle json file")
        .option("--snapshot-dir <dir>", "snapshot directory", ".subagent-evals/cache")
        .action(async (options) => {
          const bundlePath = resolve(options.input);
          const bundle = JSON.parse(await readFile(bundlePath, "utf8")) as ReplayBundle;
          const snapshotDir = resolve(options.snapshotDir);
          const outPath = join(snapshotDir, `${bundle.cache_key}.json`);
          await ensureDir(snapshotDir);
          await writeFile(outPath, JSON.stringify(bundle, null, 2), "utf8");
          process.stdout.write(`Imported replay bundle to ${outPath}\n`);
        })
    );

  program.addCommand(replayCmd);

  // corpus subcommands
  const corpusCmd = new Command("corpus");

  corpusCmd.addCommand(
    new Command("verify")
      .requiredOption("--input <input>", "corpus file path (YAML or JSON)")
      .option("--require-signed", "require the corpus pack to be signed", false)
      .action(async (options) => {
        const filePath = resolve(options.input);
        const raw = await readFile(filePath, "utf8");
        const parsed = filePath.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
        const result = verifyCorpusPack(parsed, { require_signed: options.requireSigned });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (!result.valid) {
          process.exitCode = 1;
        }
      })
  );

  program.addCommand(corpusCmd);

  // parity command
  program
    .command("parity")
    .argument("[target]", "directory to evaluate")
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .option("--output <output>", "output path for parity report json")
    .action(async (target, options) => {
      const cwd = resolveCommandCwd(target, undefined);
      const configPath = resolve(cwd, options.config);
      const config = await loadConfig(configPath);
      const casesDir = resolve(cwd, "cases");
      const runtimeCases = await loadRuntimeCases(casesDir);
      const currentReport = await evaluateProject({ cwd, config });
      const result = await evaluateParity({ cwd, config, runtimeCases, currentReport });
      const json = JSON.stringify(result, null, 2);
      if (options.output) {
        await writeText(resolve(options.output), json);
      } else {
        process.stdout.write(`${json}\n`);
      }
      process.stdout.write(`Parity score: ${result.parity_score.toFixed(3)}\n`);
    });

  // time-series subcommands
  const timeSeriesCmd = new Command("time-series");

  timeSeriesCmd.addCommand(
    new Command("list")
      .argument("[target]", "directory (unused, for symmetry)")
      .option("--dir <dir>", "snapshots directory", ".subagent-evals/time-series")
      .action(async (_target, options) => {
        const snapshotsDir = resolve(options.dir);
        const snapshots = await loadTimeSeriesSnapshots(snapshotsDir);
        for (const snap of snapshots) {
          process.stdout.write(
            `${snap.created_at}  score=${snap.summary.score}  badge=${snap.summary.badge}  agents=${(snap.agents ?? []).length}\n`
          );
        }
      })
  );

  timeSeriesCmd.addCommand(
    new Command("diff")
      .argument("[target]", "directory (unused, for symmetry)")
      .option("--dir <dir>", "snapshots directory", ".subagent-evals/time-series")
      .action(async (_target, options) => {
        const snapshotsDir = resolve(options.dir);
        const snapshots = await loadTimeSeriesSnapshots(snapshotsDir);
        const driftReport = detectDrift(snapshots);
        process.stdout.write(`${JSON.stringify(driftReport, null, 2)}\n`);
        if (driftReport.has_drift) {
          process.exitCode = 1;
        }
      })
  );

  program.addCommand(timeSeriesCmd);

  // audit command
  program
    .command("audit")
    .argument("[target]", "directory to audit")
    .option("--config <config>", "config path", "subagent-evals.config.yaml")
    .option("--output <output>", "output path for audit report json")
    .action(async (target, options) => {
      const cwd = resolve(target ?? process.cwd());
      const configPath = resolve(cwd, options.config);
      const config = await loadConfig(configPath);
      const report = await evaluateSupplyChain(config, cwd);
      const json = JSON.stringify(report, null, 2);
      if (options.output) {
        await writeText(resolve(options.output), json);
      } else {
        process.stdout.write(`${json}\n`);
      }
      if (report.score < 0.5) {
        process.exitCode = 1;
      }
    });

  await program.parseAsync(argv, { from: "user" });
}

export { renderHtmlReport } from "@subagent-evals/report-html";
