#!/usr/bin/env node
// Usage: node scripts/state-of-agents.mjs [--repos <path>] [--output-json <path>] [--output-md <path>]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    reposFile: get("--repos") ?? resolve(__dirname, "state-of-agents-repos.json"),
    outputJson: get("--output-json") ?? resolve(root, "apps/hosted/data/state-of-agents.json"),
    outputMd: get("--output-md") ?? resolve(root, "docs/state-of-agents/2026-Q2.md")
  };
}

function cloneAtSha(owner, repo, sha) {
  const dir = resolve(tmpdir(), `subagent-eval-${owner.replaceAll("/", "-")}-${repo.replaceAll("/", "-")}`);
  if (!existsSync(dir)) {
    execFileSync("git", ["clone", "--depth", "50", `https://github.com/${owner}/${repo}.git`, dir], {
      encoding: "utf8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"]
    });
  }
  try {
    execFileSync("git", ["fetch", "--depth", "1", "origin", sha], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000
    });
    execFileSync("git", ["checkout", "--detach", sha], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000
    });
  } catch {
    // sha may already be checked out
  }
  return dir;
}

function runEval(repoDir) {
  const cliPath = resolve(root, "packages/cli/dist/bin/subagent-evals.js");
  const configPath = join(repoDir, "subagent-evals.config.yaml");
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      [
        "discovery:",
        "  roots: [.]",
        "  format: auto",
        "runtime:",
        "  runner: command-runner",
        "  mode: replay",
        "  command: node",
        "  args: [./example-runner.mjs]",
        "  snapshot_dir: .subagent-evals/cache",
        ""
      ].join("\n"),
      "utf8"
    );
  }
  try {
    execFileSync("node", [cliPath, "eval"], {
      cwd: repoDir,
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const outFile = resolve(repoDir, "out/results.json");
    return JSON.parse(readFileSync(outFile, "utf8"));
  } catch {
    return null;
  }
}

const CAVEAT = "Sample selected from the highest-starred public GitHub search results for CLAUDE.md, .cursorrules, copilot-instructions.md, and AGENTS.md. Only repos with supported agent config files discovered by subagent-evals are included. Results reflect pinned commits and may not generalize.";

async function main() {
  const { reposFile, outputJson, outputMd } = parseArgs();

  if (!existsSync(reposFile)) {
    console.error(`Repos file not found: ${reposFile}`);
    process.exit(1);
  }

  const repos = JSON.parse(readFileSync(reposFile, "utf8"));
  console.log(`Evaluating ${repos.length} repos...`);

  const evaluated = [];
  for (const entry of repos) {
    if (entry.sha.startsWith("REPLACE_")) {
      console.log(`  SKIP ${entry.owner}/${entry.repo} — placeholder SHA, fill in state-of-agents-repos.json first`);
      continue;
    }
    console.log(`  ${entry.owner}/${entry.repo} @ ${entry.sha}...`);
    const dir = cloneAtSha(entry.owner, entry.repo, entry.sha);
    const report = runEval(dir);
    if (!report) {
      console.log(`    SKIP — eval failed (no agent configs found or eval error)`);
      continue;
    }
    evaluated.push({
      owner: entry.owner,
      repo: entry.repo,
      sha: entry.sha,
      platform: entry.platform,
      stars: entry.stars ?? null,
      score: report.summary.score,
      tier: report.summary.badge,
      findings: report.static_results.flatMap((result) => result.findings ?? [])
    });
    console.log(`    score=${report.summary.score.toFixed(3)} tier=${report.summary.badge}`);
  }

  if (evaluated.length === 0) {
    console.log("\nNo results — fill in real SHAs in state-of-agents-repos.json before running.");
    process.exit(0);
  }

  const platforms = [...new Set(evaluated.map((r) => r.platform))];
  const byPlatform = {};
  for (const platform of platforms) {
    const group = evaluated.filter((r) => r.platform === platform);
    const avg = group.reduce((s, r) => s + r.score, 0) / group.length;
    byPlatform[platform] = {
      count: group.length,
      avg_score: Math.round(avg * 1000) / 1000,
      tiers: {
        certified: group.filter((r) => r.tier === "certified").length,
        strong: group.filter((r) => r.tier === "strong").length,
        usable: group.filter((r) => r.tier === "usable").length,
        experimental: group.filter((r) => r.tier === "experimental").length
      }
    };
  }

  const allFindings = evaluated.flatMap((r) => r.findings ?? []);
  const failCounts = {};
  const passCounts = {};
  for (const f of allFindings) {
    if (f.severity !== "info") {
      failCounts[f.title] = (failCounts[f.title] ?? 0) + 1;
    } else if (f.severity === "info") {
      passCounts[f.title] = (passCounts[f.title] ?? 0) + 1;
    }
  }
  const topFailures = Object.entries(failCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
  const topPasses = Object.entries(passCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

  const data = {
    period: "2026-Q2",
    generated: new Date().toISOString(),
    sample_size: evaluated.length,
    caveat: CAVEAT,
    repos: evaluated.map(({ findings: _findings, ...repo }) => repo),
    by_platform: byPlatform,
    top_failures: topFailures.length ? topFailures : ["(no common failures found)"],
    top_passes: topPasses.length ? topPasses : ["(no common passes found)"]
  };

  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(data, null, 2), "utf8");
  console.log(`\nWrote ${outputJson}`);

  const platformTable = Object.entries(data.by_platform)
    .map(([p, s]) => `| ${p} | ${s.count} | ${s.avg_score.toFixed(3)} |`)
    .join("\n");

  const repoTable = data.repos
    .map((r) => `| ${r.owner}/${r.repo} | ${r.platform} | ${r.stars ?? ""} | ${r.tier} | ${r.score.toFixed(3)} | ${r.sha.slice(0, 7)} |`)
    .join("\n");

  const md = `# State of AI Agents — ${data.period}

*Generated ${data.generated.slice(0, 10)}. ${CAVEAT}*

## By Platform

| Platform | Repos | Avg Score |
|----------|-------|-----------|
${platformTable}

## All Repos

| Repository | Platform | Stars | Tier | Score | Commit |
|------------|----------|-------|------|-------|--------|
${repoTable}

## Top Failures

${data.top_failures.map((f) => `- ${f}`).join("\n")}

## Top Passes

${data.top_passes.map((p) => `- ${p}`).join("\n")}

---

*${CAVEAT}*
`;

  mkdirSync(dirname(outputMd), { recursive: true });
  writeFileSync(outputMd, md, "utf8");
  console.log(`Wrote ${outputMd}`);
  console.log(`\nDone. ${evaluated.length} repos evaluated.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
