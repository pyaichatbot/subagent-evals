import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/index.js";
import { renderGitHubWorkflow } from "../src/templates/github-workflow.js";
import { renderGitLabCi } from "../src/templates/gitlab-ci.js";

describe("renderGitHubWorkflow", () => {
  it("contains required permissions block", () => {
    const yaml = renderGitHubWorkflow({});
    expect(yaml).toContain("pull-requests: write");
    expect(yaml).toContain("statuses: write");
  });

  it("injects min-score check when flag provided", () => {
    const yaml = renderGitHubWorkflow({ minScore: 0.75 });
    expect(yaml).toContain("0.75");
    expect(yaml).toContain("r.summary.score");
  });

  it("uses the eval command's default output path", () => {
    const yaml = renderGitHubWorkflow({});
    expect(yaml).toContain("subagent-evals eval");
    expect(yaml).toContain("out/results.json");
    expect(yaml).not.toContain("eval --output");
  });

  it("omits min-score check when flag absent", () => {
    const yaml = renderGitHubWorkflow({});
    expect(yaml).not.toContain("r.summary.score <");
  });

  it("omits post-comment step when --no-post-comment", () => {
    const yaml = renderGitHubWorkflow({ postComment: false });
    expect(yaml).not.toContain("gh pr comment");
  });
});

describe("renderGitLabCi", () => {
  it("uses merge_request_event rule", () => {
    const yaml = renderGitLabCi({});
    expect(yaml).toContain('CI_PIPELINE_SOURCE == "merge_request_event"');
  });

  it("uses custom gitlab url when provided", () => {
    const yaml = renderGitLabCi({ gitlabUrl: "https://git.company.com" });
    expect(yaml).toContain("https://git.company.com/api/v4");
  });

  it("defaults to CI_API_V4_URL when no gitlabUrl", () => {
    const yaml = renderGitLabCi({});
    expect(yaml).toContain("CI_API_V4_URL");
  });
});

describe("ci init command", () => {
  it("generates GitHub workflow when .github/ exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    mkdirSync(join(dir, ".github"));

    await runCli(["ci", "init", "--cwd", dir]);

    const content = readFileSync(join(dir, ".github/workflows/subagent-evals.yml"), "utf8");
    expect(content).toContain("pull-requests: write");
    expect(content).toContain("subagent-evals eval");
  });

  it("generates GitLab CI when .gitlab-ci.yml exists and overwrite is explicit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    writeFileSync(join(dir, ".gitlab-ci.yml"), "# existing pipeline\n");

    await runCli(["ci", "init", "--platform", "gitlab", "--cwd", dir, "--force", "--yes"]);

    const content = readFileSync(join(dir, ".gitlab-ci.yml"), "utf8");
    expect(content).toContain("merge_request_event");
  });

  it("errors when file exists without --force", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/subagent-evals.yml"), "existing");

    await expect(runCli(["ci", "init", "--cwd", dir])).rejects.toThrow(/already exists/);
  });

  it("prints yaml to stdout with --dry-run, writes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    mkdirSync(join(dir, ".github"));
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: (chunk: string) => boolean }).write = (chunk: string) => {
      writes.push(chunk);
      return true;
    };
    try {
      await runCli(["ci", "init", "--cwd", dir, "--dry-run"]);
    } finally {
      (process.stdout as unknown as { write: typeof orig }).write = orig;
    }

    expect(writes.join("")).toContain("pull-requests: write");
    expect(existsSync(join(dir, ".github/workflows/subagent-evals.yml"))).toBe(false);
  });

  it("errors when platform cannot be detected", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    await expect(runCli(["ci", "init", "--cwd", dir])).rejects.toThrow(/Cannot detect platform/);
  });

  it("injects min-score into github workflow", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    mkdirSync(join(dir, ".github"));

    await runCli(["ci", "init", "--cwd", dir, "--min-score", "0.75"]);

    const content = readFileSync(join(dir, ".github/workflows/subagent-evals.yml"), "utf8");
    expect(content).toContain("0.75");
  });

  it("requires --yes before overwriting a GitLab pipeline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "subagent-ci-"));
    writeFileSync(join(dir, ".gitlab-ci.yml"), "# existing pipeline\n");

    await expect(
      runCli(["ci", "init", "--platform", "gitlab", "--cwd", dir, "--force"])
    ).rejects.toThrow(/--force --yes/);
  });
});
