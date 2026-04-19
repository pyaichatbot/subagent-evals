import type { EvalReport } from "@subagent-evals/core";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderHtmlReport(report: EvalReport): string {
  const securityFindingIds = new Set([
    "missing-adversarial-guidance",
    "missing-secret-handling-guidance"
  ]);
  const securityAssertionTypes = new Set([
    "prompt_injection_resistance",
    "jailbreak_resistance",
    "red_team_resistance",
    "secret_exfiltration_resistance",
    "no-file-outside-scope"
  ]);

  const leaderboard = report.agents
    .map(
      (agent) => `
        <tr>
          <td>${escapeHtml(agent.agent_id)}</td>
          <td>${agent.score.toFixed(2)}</td>
          <td>${escapeHtml(agent.badge)}</td>
        </tr>`
    )
    .join("");

  const findings = report.agents
    .flatMap((agent) =>
      agent.findings.map(
        (finding) => `
          <tr>
            <td>${escapeHtml(agent.agent_id)}</td>
            <td>${escapeHtml(finding.id)}</td>
            <td>${escapeHtml(finding.title)}</td>
          </tr>`
      )
    )
    .join("");

  const securityFindings = report.static_results
    .flatMap((result) =>
      result.findings
        .filter((finding) => securityFindingIds.has(finding.id))
        .map(
          (finding) => `
            <tr>
              <td>${escapeHtml(result.agent_id)}</td>
              <td>${escapeHtml(finding.id)}</td>
              <td>${escapeHtml(finding.title)}</td>
              <td>${escapeHtml(finding.severity)}</td>
            </tr>`
        )
    )
    .join("");

  const runtimeRows = report.runtime_cases
    .map(
      (testCase) => `
        <section class="card">
          <h3>${escapeHtml(testCase.id)} <span>${escapeHtml(testCase.agent)}</span></h3>
          <p>Score: ${testCase.score.toFixed(2)} | Passed: ${testCase.passed}</p>
          <ul>
            ${testCase.assertions
              .map(
                (assertion) =>
                  `<li>${escapeHtml(assertion.type)}: ${escapeHtml(assertion.message)}</li>`
              )
              .join("")}
          </ul>
          <pre>${escapeHtml(testCase.artifact?.output_text ?? "")}</pre>
        </section>`
    )
    .join("");

  const securityRuntimeRows = report.runtime_cases
    .filter((testCase) =>
      testCase.assertions.some((assertion) => securityAssertionTypes.has(assertion.type))
    )
    .map(
      (testCase) => `
        <tr>
          <td>${escapeHtml(testCase.id)}</td>
          <td>${escapeHtml(testCase.agent)}</td>
          <td>${testCase.passed ? "pass" : "fail"}</td>
          <td>${escapeHtml(
            testCase.assertions
              .filter((assertion) => securityAssertionTypes.has(assertion.type))
              .map((assertion) => `${assertion.type}: ${assertion.message}`)
              .join(" | ")
          )}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>subagent-evals report</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; color: #1f2937; background: #f8fafc; }
      h1, h2, h3 { margin-bottom: 0.5rem; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
      .card { background: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
      table { width: 100%; border-collapse: collapse; background: white; }
      th, td { border: 1px solid #cbd5e1; padding: 0.75rem; text-align: left; }
      pre { white-space: pre-wrap; background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 8px; }
      .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 999px; background: #dbeafe; }
    </style>
  </head>
  <body>
    <h1>subagent-evals report</h1>
    <div class="grid">
      <div class="card"><strong>Overall score</strong><div>${report.summary.score.toFixed(2)}</div></div>
      <div class="card"><strong>Badge</strong><div class="badge">${escapeHtml(report.summary.badge)}</div></div>
      <div class="card"><strong>Agents</strong><div>${report.summary.agents}</div></div>
      <div class="card"><strong>Runtime cases</strong><div>${report.summary.runtime_cases}</div></div>
    </div>
    <h2>Leaderboard</h2>
    <table>
      <thead><tr><th>Agent</th><th>Score</th><th>Badge</th></tr></thead>
      <tbody>${leaderboard}</tbody>
    </table>
    <h2>Findings</h2>
    <table>
      <thead><tr><th>Agent</th><th>ID</th><th>Title</th></tr></thead>
      <tbody>${findings}</tbody>
    </table>
    <h2>Security posture</h2>
    <table>
      <thead><tr><th>Agent</th><th>ID</th><th>Title</th><th>Severity</th></tr></thead>
      <tbody>${securityFindings}</tbody>
    </table>
    <h2>Security runtime cases</h2>
    <table>
      <thead><tr><th>Case</th><th>Agent</th><th>Status</th><th>Security assertions</th></tr></thead>
      <tbody>${securityRuntimeRows}</tbody>
    </table>
    <h2>Runtime cases</h2>
    ${runtimeRows}
  </body>
</html>`;
}
