import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";

import fg from "fast-glob";
import yaml from "js-yaml";

export type AgentFormatId = "claude-md" | "generic-frontmatter-md";
export type RunnerAdapterId = "command-runner" | "claude-code-runner";
export type EvalKind = "static" | "runtime";
export type BadgeTier = "experimental" | "usable" | "strong" | "certified";

export interface AgentFile {
  path: string;
  body: string;
}

export interface DiscoveredAgent {
  path: string;
  format_adapter_id: AgentFormatId;
  body?: string;
}

export interface NormalizedAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  model: string | null;
  metadata: Record<string, unknown>;
  source_path: string;
  format_adapter_id: AgentFormatId;
}

export interface StaticFinding {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  message: string;
  suggestion?: string;
}

export interface StaticEvalResult {
  kind: "static";
  agent_id: string;
  score: number;
  badge: BadgeTier;
  dimensions: Record<string, number>;
  findings: StaticFinding[];
  suggestions: string[];
}

export interface TraceEvent {
  type: string;
  name?: string;
  timestamp?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface RunArtifact {
  output_text: string;
  structured_output?: unknown;
  trace?: TraceEvent[];
  files_touched?: string[];
  duration_ms?: number;
  token_usage?: TokenUsage;
  raw?: Record<string, unknown>;
}

export interface RuntimeAssertion {
  type:
    | "exact"
    | "contains"
    | "regex"
    | "json-schema"
    | "trajectory_contains"
    | "trajectory_ordered"
    | "trajectory_subset"
    | "tool_whitelist"
    | "tool_blacklist"
    | "no-file-outside-scope"
    | "judge_score"
    | "pairwise_preference"
    | "repetition_stability"
    | "mentions";
  value?: unknown;
}

export interface RuntimeCase {
  id: string;
  agent: string;
  kind: "runtime";
  input: {
    task: string;
    fixtures: Record<string, unknown>;
  };
  expected: {
    score_min?: number;
    assertions: RuntimeAssertion[];
  };
}

export interface RuntimeAssertionResult {
  type: string;
  passed: boolean;
  message: string;
}

export interface RuntimeEvalResult {
  kind: "runtime";
  id: string;
  agent: string;
  score: number;
  passed: boolean;
  assertions: RuntimeAssertionResult[];
  artifact: RunArtifact;
}

export interface EvalConfig {
  discovery: {
    roots: string[];
    globs?: string[] | undefined;
    format: AgentFormatId;
  };
  runtime: {
    runner: RunnerAdapterId;
    command?: string;
    args?: string[];
  };
  outputs?: {
    json?: string;
    junit?: string;
    html?: string;
  };
}

export interface EvalSummary {
  score: number;
  badge: BadgeTier;
  agents: number;
  static_cases: number;
  runtime_cases: number;
}

export interface EvalReport {
  summary: EvalSummary;
  agents: Array<{
    agent_id: string;
    score: number;
    badge: BadgeTier;
    findings: Array<Pick<StaticFinding, "id" | "title">>;
  }>;
  static_results: StaticEvalResult[];
  runtime_cases: RuntimeEvalResult[];
}

export const defaultConfig = (): EvalConfig => ({
  discovery: {
    roots: [".claude/agents"],
    globs: ["**/*.md"],
    format: "claude-md"
  },
  runtime: {
    runner: "command-runner",
    command: "node",
    args: ["./subagent-evals/example-runner.mjs"]
  },
  outputs: {
    json: "out/results.json",
    junit: "out/results.junit.xml",
    html: "out/report.html"
  }
});

function parseFrontmatter(text: string): { metadata: Record<string, unknown>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: text.trim() };
  }

  const [, rawFrontmatter = "", rawBody = ""] = match;
  const loaded = yaml.load(rawFrontmatter);
  const metadata =
    loaded && typeof loaded === "object" && !Array.isArray(loaded)
      ? (loaded as Record<string, unknown>)
      : {};
  return {
    metadata,
    body: rawBody.trim()
  };
}

function normalizeTools(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function deriveId(path: string, metadata: Record<string, unknown>): string {
  if (typeof metadata.name === "string" && metadata.name.trim().length > 0) {
    return metadata.name.trim();
  }
  return basename(path, extname(path));
}

export async function normalizeMarkdownAgent(
  file: AgentFile,
  format: AgentFormatId = "generic-frontmatter-md"
): Promise<NormalizedAgent> {
  const { metadata, body } = parseFrontmatter(file.body);
  const id = deriveId(file.path, metadata);
  return {
    id,
    name: id,
    description:
      typeof metadata.description === "string" ? metadata.description.trim() : "",
    instructions: body,
    tools: normalizeTools(metadata.tools),
    model: typeof metadata.model === "string" ? metadata.model : null,
    metadata,
    source_path: file.path,
    format_adapter_id: format
  };
}

async function discoverClaudeAgents(input: {
  cwd: string;
  roots: string[];
}): Promise<DiscoveredAgent[]> {
  const files: DiscoveredAgent[] = [];
  for (const root of input.roots) {
    const absoluteRoot = resolve(input.cwd, root);
    if (!existsSync(absoluteRoot)) {
      const candidate = resolve(input.cwd, root, ".claude/agents");
      if (existsSync(candidate)) {
        const paths = await fg("**/*.md", { cwd: candidate, absolute: true });
        files.push(
          ...paths.map((path) => ({
            path,
            format_adapter_id: "claude-md" as const
          }))
        );
        continue;
      }
      continue;
    }
    const repoCandidate = resolve(absoluteRoot, ".claude/agents");
    if (existsSync(repoCandidate)) {
      const paths = await fg("**/*.md", { cwd: repoCandidate, absolute: true });
      files.push(
        ...paths.map((path) => ({
          path,
          format_adapter_id: "claude-md" as const
        }))
      );
      continue;
    }
    const target = absoluteRoot.endsWith(".md")
      ? [absoluteRoot]
      : await fg("**/*.md", { cwd: absoluteRoot, absolute: true });
    files.push(
      ...target.map((path) => ({
        path,
        format_adapter_id: "claude-md" as const
      }))
    );
  }
  return files;
}

async function discoverGenericAgents(input: {
  cwd: string;
  roots: string[];
  globs?: string[] | undefined;
}): Promise<DiscoveredAgent[]> {
  const patterns = input.globs?.length ? input.globs : ["**/*.md"];
  const files: DiscoveredAgent[] = [];
  for (const root of input.roots) {
    const absoluteRoot = resolve(input.cwd, root);
    if (!existsSync(absoluteRoot)) {
      continue;
    }
    const matches = await fg(patterns, { cwd: absoluteRoot, absolute: true });
    files.push(
      ...matches.map((path) => ({
        path,
        format_adapter_id: "generic-frontmatter-md" as const
      }))
    );
  }
  return files;
}

export async function discoverAgents(input: {
  cwd: string;
  roots: string[];
  format: AgentFormatId;
  globs?: string[] | undefined;
}): Promise<DiscoveredAgent[]> {
  if (input.format === "claude-md") {
    return discoverClaudeAgents(input);
  }
  return discoverGenericAgents(input);
}

export async function normalizeDiscoveredAgent(
  discovered: DiscoveredAgent
): Promise<NormalizedAgent> {
  const body = discovered.body ?? (await readFile(discovered.path, "utf8"));
  return normalizeMarkdownAgent(
    { path: discovered.path, body },
    discovered.format_adapter_id
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

export function badgeForScore(score: number): BadgeTier {
  if (score >= 0.9) {
    return "certified";
  }
  if (score >= 0.75) {
    return "strong";
  }
  if (score >= 0.55) {
    return "usable";
  }
  return "experimental";
}

function hasOutputContract(text: string): boolean {
  return /(json only|return|output|single fenced|format:|schema)/i.test(text);
}

export async function evaluateStaticAgent(
  agent: NormalizedAgent
): Promise<StaticEvalResult> {
  const findings: StaticFinding[] = [];
  const suggestions = new Set<string>();

  if (!agent.description || agent.description.length < 20 || /stuff|things|help/i.test(agent.description)) {
    findings.push({
      id: "vague-trigger",
      title: "Trigger description is vague",
      severity: "high",
      message: "Description does not clearly state when the agent should be selected.",
      suggestion: "Describe trigger conditions and scope in a concrete sentence."
    });
    suggestions.add("Tighten the agent description so selection criteria are explicit.");
  }

  if (!hasOutputContract(agent.instructions)) {
    findings.push({
      id: "missing-output-contract",
      title: "Output contract is missing",
      severity: "medium",
      message: "Instructions do not specify the required response format or completion contract.",
      suggestion: "Add a short output section describing required format and stopping conditions."
    });
    suggestions.add("Add an explicit output contract.");
  }

  if (/do everything|anything the user asks/i.test(agent.instructions)) {
    findings.push({
      id: "scope-overreach",
      title: "Scope is too broad",
      severity: "high",
      message: "Instructions encourage a general-purpose role instead of a narrow subagent.",
      suggestion: "Constrain the agent to one responsibility and document boundaries."
    });
    suggestions.add("Reduce the role to a single responsibility.");
  }

  if (/bash|shell|command/i.test(agent.instructions) && !agent.tools.includes("Bash")) {
    findings.push({
      id: "tool-mismatch",
      title: "Tool policy mismatch",
      severity: "medium",
      message: "Instructions mention shell execution but Bash is absent from declared tools.",
      suggestion: "Either add Bash to tools or remove shell guidance from instructions."
    });
    suggestions.add("Align tool references in the prompt with frontmatter tools.");
  }

  const dimensions = {
    frontmatter: agent.description ? 0.9 : 0.2,
    trigger_clarity: findings.some((item) => item.id === "vague-trigger") ? 0.25 : 0.9,
    scope_calibration: findings.some((item) => item.id === "scope-overreach") ? 0.2 : 0.9,
    tool_policy: findings.some((item) => item.id === "tool-mismatch") ? 0.3 : 0.9,
    output_contract: findings.some((item) => item.id === "missing-output-contract") ? 0.2 : 0.9,
    readability: agent.instructions.length > 0 ? 0.8 : 0.1
  };

  const score = clamp(
    Object.values(dimensions).reduce((sum, value) => sum + value, 0) /
      Object.values(dimensions).length
  );

  return {
    kind: "static",
    agent_id: agent.id,
    score,
    badge: badgeForScore(score),
    dimensions,
    findings,
    suggestions: [...suggestions]
  };
}

function toolNames(trace?: TraceEvent[]): string[] {
  return (trace ?? [])
    .filter((event) => event.type === "tool_call" && typeof event.name === "string")
    .map((event) => event.name as string);
}

function assertionMessage(passed: boolean, ok: string, bad: string): string {
  return passed ? ok : bad;
}

export async function evaluateRuntimeCase(
  testCase: RuntimeCase,
  artifact: RunArtifact
): Promise<RuntimeEvalResult> {
  const assertions: RuntimeAssertionResult[] = [];
  let hardFail = false;

  for (const assertion of testCase.expected.assertions) {
    switch (assertion.type) {
      case "contains":
      case "mentions": {
        const needle = String(assertion.value ?? "");
        const passed = artifact.output_text.includes(needle);
        assertions.push({
          type: assertion.type,
          passed,
          message: assertionMessage(passed, `Matched ${needle}`, `Missing ${needle}`)
        });
        break;
      }
      case "exact": {
        const expected = String(assertion.value ?? "");
        const passed = artifact.output_text.trim() === expected.trim();
        assertions.push({
          type: "exact",
          passed,
          message: assertionMessage(passed, "Exact output matched", "Exact output did not match")
        });
        break;
      }
      case "regex": {
        const pattern = new RegExp(String(assertion.value ?? ""));
        const passed = pattern.test(artifact.output_text);
        assertions.push({
          type: "regex",
          passed,
          message: assertionMessage(passed, "Regex matched output", "Regex did not match output")
        });
        break;
      }
      case "trajectory_contains": {
        const needle = String(assertion.value ?? "");
        const passed = toolNames(artifact.trace).includes(needle);
        assertions.push({
          type: "trajectory_contains",
          passed,
          message: assertionMessage(
            passed,
            `Trace contains ${needle}`,
            `Trace missing ${needle}`
          )
        });
        break;
      }
      case "tool_blacklist": {
        const blocked = String(assertion.value ?? "");
        const passed = !toolNames(artifact.trace).includes(blocked);
        if (!passed) {
          hardFail = true;
        }
        assertions.push({
          type: "tool_blacklist",
          passed,
          message: assertionMessage(
            passed,
            `${blocked} was not used`,
            `${blocked} was used`
          )
        });
        break;
      }
      case "tool_whitelist": {
        const allowed = new Set(
          Array.isArray(assertion.value)
            ? assertion.value.map((item) => String(item))
            : [String(assertion.value ?? "")]
        );
        const used = toolNames(artifact.trace);
        const disallowed = used.filter((item) => !allowed.has(item));
        const passed = disallowed.length === 0;
        if (!passed) {
          hardFail = true;
        }
        assertions.push({
          type: "tool_whitelist",
          passed,
          message: assertionMessage(
            passed,
            "Only allowed tools were used",
            `Disallowed tools used: ${disallowed.join(", ")}`
          )
        });
        break;
      }
      default: {
        assertions.push({
          type: assertion.type,
          passed: true,
          message: `Assertion type ${assertion.type} reserved but not enforced in v1`
        });
      }
    }
  }

  const passCount = assertions.filter((item) => item.passed).length;
  const score = clamp(assertions.length === 0 ? 1 : passCount / assertions.length);
  const minScore = testCase.expected.score_min ?? 0;
  const passed = !hardFail && score >= minScore && assertions.every((item) => item.passed);

  return {
    kind: "runtime",
    id: testCase.id,
    agent: testCase.agent,
    score,
    passed,
    assertions,
    artifact
  };
}

export async function runCommandRunner(input: {
  command: string;
  args?: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
}): Promise<RunArtifact> {
  const started = performance.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(input.command, input.args ?? [], {
      cwd: input.cwd,
      env: { ...process.env, ...input.env },
      stdio: "pipe"
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", () => {
      resolvePromise({
        output_text: stdout.trim() || stderr.trim(),
        raw: {
          stderr: stderr.trim()
        },
        duration_ms: Math.round(performance.now() - started)
      });
    });
    if (input.stdin) {
      child.stdin.write(input.stdin);
    }
    child.stdin.end();
  });
}

export async function runClaudeCodeRunner(input: {
  cwd: string;
  prompt: string;
}): Promise<RunArtifact> {
  return runCommandRunner({
    command: "claude",
    args: ["-p", input.prompt, "--output-format", "json"],
    cwd: input.cwd
  });
}

export async function loadConfig(path: string): Promise<EvalConfig> {
  const config = yaml.load(await readFile(path, "utf8")) as Partial<EvalConfig>;
  const defaults = defaultConfig();
  return {
    discovery: {
      ...defaults.discovery,
      ...config.discovery
    },
    runtime: {
      ...defaults.runtime,
      ...config.runtime
    },
    outputs: {
      ...defaults.outputs,
      ...config.outputs
    }
  };
}

export async function loadRuntimeCases(dir: string): Promise<RuntimeCase[]> {
  if (!existsSync(dir)) {
    return [];
  }
  const files = await fg("**/*.yaml", { cwd: dir, absolute: true });
  const cases: RuntimeCase[] = [];
  for (const path of files) {
    const loaded = yaml.load(await readFile(path, "utf8")) as RuntimeCase;
    if (loaded.kind === "runtime") {
      cases.push(loaded);
    }
  }
  return cases;
}

export function createJUnitReport(report: EvalReport): string {
  const tests = report.static_results.length + report.runtime_cases.length;
  const failures =
    report.static_results.filter((result) => result.findings.some((item) => item.severity === "high")).length +
    report.runtime_cases.filter((result) => !result.passed).length;
  const cases = [
    ...report.static_results.map((result) => {
      const highFindings = result.findings.filter((item) => item.severity === "high");
      const failure =
        highFindings.length > 0
          ? `<failure message="static findings">${escapeXml(
              highFindings.map((item) => item.title).join("; ")
            )}</failure>`
          : "";
      return `<testcase classname="static" name="${escapeXml(result.agent_id)}">${failure}</testcase>`;
    }),
    ...report.runtime_cases.map((result) => {
      const failure = result.passed
        ? ""
        : `<failure message="runtime assertions">${escapeXml(
            result.assertions.filter((item) => !item.passed).map((item) => item.message).join("; ")
          )}</failure>`;
      return `<testcase classname="runtime" name="${escapeXml(result.id)}">${failure}</testcase>`;
    })
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?><testsuite name="subagent-evals" tests="${tests}" failures="${failures}">${cases}</testsuite>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export async function evaluateProject(input: {
  cwd: string;
  config: EvalConfig;
  runtimeCasesDir?: string;
}): Promise<EvalReport> {
  const discoveryInput: {
    cwd: string;
    roots: string[];
    format: AgentFormatId;
    globs?: string[] | undefined;
  } = {
    cwd: input.cwd,
    roots: input.config.discovery.roots,
    format: input.config.discovery.format
  };
  if (input.config.discovery.globs) {
    discoveryInput.globs = input.config.discovery.globs;
  }
  const discovered = await discoverAgents({
    ...discoveryInput
  });
  const agents = await Promise.all(discovered.map(normalizeDiscoveredAgent));
  const staticResults = await Promise.all(agents.map(evaluateStaticAgent));

  const runtimeDir = resolve(input.cwd, input.runtimeCasesDir ?? "cases");
  const cases = await loadRuntimeCases(runtimeDir);
  const runtimeResults: RuntimeEvalResult[] = [];

  for (const testCase of cases) {
    let artifact: RunArtifact;
    if (input.config.runtime.runner === "claude-code-runner") {
      artifact = await runClaudeCodeRunner({
        cwd: input.cwd,
        prompt: testCase.input.task
      });
    } else {
      const fixtureOutput =
        typeof testCase.input.fixtures.output_text === "string"
          ? String(testCase.input.fixtures.output_text)
          : undefined;
      if (fixtureOutput) {
        artifact = { output_text: fixtureOutput };
        if (Array.isArray(testCase.input.fixtures.trace)) {
          artifact.trace = testCase.input.fixtures.trace as TraceEvent[];
        }
        if (Array.isArray(testCase.input.fixtures.files_touched)) {
          artifact.files_touched = testCase.input.fixtures.files_touched as string[];
        }
      } else {
        artifact = await runCommandRunner({
          cwd: input.cwd,
          command: input.config.runtime.command ?? "node",
          args: input.config.runtime.args ?? [],
          stdin: JSON.stringify(testCase)
        });
      }
    }
    runtimeResults.push(await evaluateRuntimeCase(testCase, artifact));
  }

  const combinedScores = [
    ...staticResults.map((item) => item.score),
    ...runtimeResults.map((item) => item.score)
  ];
  const average =
    combinedScores.length === 0
      ? 1
      : combinedScores.reduce((sum, value) => sum + value, 0) / combinedScores.length;

  return {
    summary: {
      score: clamp(average),
      badge: badgeForScore(average),
      agents: agents.length,
      static_cases: staticResults.length,
      runtime_cases: runtimeResults.length
    },
    agents: staticResults.map((result) => ({
      agent_id: result.agent_id,
      score: result.score,
      badge: result.badge,
      findings: result.findings.map((item) => ({ id: item.id, title: item.title }))
    })),
    static_results: staticResults,
    runtime_cases: runtimeResults
  };
}

export async function listMarkdownFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return [];
  }
  const info = await stat(root);
  if (info.isFile()) {
    return [root];
  }
  const entries = await readdir(root, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

export function relativePath(cwd: string, target: string): string {
  return relative(cwd, target) || ".";
}
