import type { SubmissionPayload } from "@subagent-evals/core";

export interface HostedRepoEntry {
  id: string;
  summary: SubmissionPayload["summary"];
  attribution?: SubmissionPayload["attribution"];
  source_mode: SubmissionPayload["source_mode"];
  adapters: SubmissionPayload["adapters"];
}

export function validateSubmissionPayload(payload: unknown): payload is SubmissionPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const candidate = payload as Partial<SubmissionPayload>;
  return (
    candidate.schema_version === 1 &&
    !!candidate.summary &&
    typeof candidate.summary.score === "number" &&
    typeof candidate.summary.badge === "string" &&
    typeof candidate.summary.agents === "number" &&
    typeof candidate.summary.static_cases === "number" &&
    typeof candidate.summary.runtime_cases === "number" &&
    Array.isArray(candidate.agents) &&
    Array.isArray(candidate.adapters) &&
    typeof candidate.source_mode === "string"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildLeaderboard(entries: SubmissionPayload[]): HostedRepoEntry[] {
  return entries
    .filter((entry) => entry.attribution)
    .map((entry) => ({
      id: `${entry.attribution?.owner}/${entry.attribution?.repo}`,
      summary: entry.summary,
      attribution: entry.attribution,
      source_mode: entry.source_mode,
      adapters: entry.adapters
    }))
    .sort((a, b) => b.summary.score - a.summary.score);
}

export function renderRepoPage(entry: SubmissionPayload): string {
  const title = entry.attribution
    ? `${entry.attribution.owner}/${entry.attribution.repo}`
    : "anonymous submission";
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>Score: ${escapeHtml(entry.summary.score.toFixed(3))}</p>
    <p>Badge: ${escapeHtml(entry.summary.badge)}</p>
    <p>Adapters: ${escapeHtml(entry.adapters.join(", "))}</p>
    <p>Source mode: ${escapeHtml(entry.source_mode)}</p>
  </body>
</html>`;
}

export function discoverSupportedAgentPaths(paths: string[]): string[] {
  return paths.filter((path) =>
    [
      ".claude/agents/",
      ".cursor/rules/",
      ".windsurf/rules/",
      ".codex/agents/",
      "AGENTS.md",
      ".github/copilot-instructions.md"
    ].some((needle) => path.includes(needle))
  );
}
