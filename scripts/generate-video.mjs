#!/usr/bin/env node
/**
 * Generate an MP4 summary video from subagent-evals results using HyperFrames.
 *
 * Usage:
 *   node scripts/generate-video.mjs [results.json] [baseline.json]
 *
 * Output: examples/videos/eval-summary.mp4
 *
 * Requires: Node >= 22, FFmpeg, npx
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const resultsPath = resolve(process.argv[2] ?? "out/results.json");
const baselinePath = process.argv[3] ? resolve(process.argv[3]) : null;
const outputPath = resolve(root, "examples/videos/eval-summary.mp4");
const compDir = resolve(root, ".video-temp");
const compPath = resolve(compDir, "composition.html");

if (!existsSync(resultsPath)) {
  console.error(`Error: results file not found: ${resultsPath}`);
  console.error("Run 'subagent-evals eval' first to generate out/results.json");
  process.exit(1);
}

const report = JSON.parse(readFileSync(resultsPath, "utf8"));
const baseline = baselinePath && existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;

mkdirSync(compDir, { recursive: true });
mkdirSync(dirname(outputPath), { recursive: true });

writeFileSync(compPath, buildComposition(report, baseline));
console.log(`Composition written → ${compPath}`);

console.log("Rendering video (requires FFmpeg)…");
execSync(`npx hyperframes render --output ${outputPath}`, {
  cwd: compDir,
  stdio: "inherit"
});

console.log(`\nVideo ready → ${outputPath}`);

// ---------------------------------------------------------------------------

function badgeColor(badge) {
  switch (badge) {
    case "certified": return "#16a34a";
    case "strong":    return "#2563eb";
    case "usable":    return "#ca8a04";
    default:          return "#dc2626";
  }
}

function badgeEmoji(badge) {
  switch (badge) {
    case "certified": return "✦";
    case "strong":    return "◈";
    case "usable":    return "◇";
    default:          return "○";
  }
}

function scoreFill(score) {
  return Math.round(score * 100);
}

function diffArrow(delta) {
  if (delta > 0.001) return `▲ +${delta.toFixed(3)}`;
  if (delta < -0.001) return `▼ ${delta.toFixed(3)}`;
  return `→ 0.000`;
}

function diffColor(delta) {
  if (delta > 0.001) return "#22c55e";
  if (delta < -0.001) return "#ef4444";
  return "#94a3b8";
}

function buildComposition(report, baseline) {
  const { summary, agents = [], runtime_cases = [] } = report;
  const score = summary.score;
  const badge = summary.badge;
  const color = badgeColor(badge);
  const passed = runtime_cases.filter(c => c.passed).length;
  const failed = runtime_cases.length - passed;

  const hasDiff = baseline !== null;
  const scoreDelta = hasDiff ? score - baseline.summary.score : 0;
  const badgeChanged = hasDiff && badge !== baseline.summary.badge;
  const totalDuration = hasDiff ? 26 : 22;

  // Slide timing
  const S0 = 0;   // title
  const S1 = 3;   // score + badge
  const S2 = 9;   // agents
  const S3 = 15;  // runtime pass/fail
  const S4 = 20;  // diff (if present)

  const agentRows = agents.slice(0, 6).map((a, i) => {
    const c = badgeColor(a.badge);
    return `
      <div data-start="${S2 + 0.3 * i}" data-duration="${totalDuration - S2 - 0.3 * i}"
           data-track-index="${10 + i}"
           style="position:absolute;left:200px;top:${260 + i * 72}px;width:1520px;
                  display:flex;align-items:center;gap:24px;opacity:0;
                  animation:fadeUp 0.4s ${0.3 * i}s forwards;">
        <span style="font-size:28px;font-family:monospace;color:#94a3b8;width:320px;
                     overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.agent_id}</span>
        <div style="flex:1;height:12px;background:#1e293b;border-radius:6px;overflow:hidden;">
          <div style="height:100%;width:${scoreFill(a.score)}%;background:${c};
                      border-radius:6px;transition:width 0.6s ease;"></div>
        </div>
        <span style="font-size:26px;font-weight:700;color:${c};width:80px;text-align:right;">
          ${a.score.toFixed(2)}
        </span>
        <span style="font-size:20px;color:${c};background:${c}22;padding:4px 14px;
                     border-radius:20px;font-weight:600;">${a.badge}</span>
      </div>`;
  }).join("\n");

  const diffSlide = hasDiff ? `
    <!-- Slide 4: Diff summary -->
    <div data-start="${S4}" data-duration="${totalDuration - S4}"
         data-track-index="40"
         style="position:absolute;inset:0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:32px;
                background:#0f172a;opacity:0;animation:fadeIn 0.5s 0s forwards;">
      <div style="font-size:28px;color:#64748b;letter-spacing:4px;text-transform:uppercase;">
        vs baseline
      </div>
      <div style="font-size:96px;font-weight:900;color:${diffColor(scoreDelta)};
                  font-family:monospace;">
        ${diffArrow(scoreDelta)}
      </div>
      ${badgeChanged ? `
      <div style="display:flex;align-items:center;gap:24px;font-size:36px;">
        <span style="color:${badgeColor(baseline.summary.badge)};font-weight:700;">
          ${baseline.summary.badge}
        </span>
        <span style="color:#475569;">→</span>
        <span style="color:${color};font-weight:700;">${badge}</span>
      </div>` : `
      <div style="font-size:32px;color:#475569;">badge unchanged · ${badge}</div>`}
      <div style="font-size:24px;color:#475569;">
        ${summary.agents} agents · ${summary.runtime_cases} cases
      </div>
    </div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes growBar {
    from { width: 0; }
    to   { width: ${scoreFill(score)}%; }
  }
  body { background: #0f172a; overflow: hidden; }
</style>
</head>
<body>

<div id="stage"
     data-composition-id="eval-summary"
     data-start="${S0}"
     data-width="1920"
     data-height="1080">

  <!-- Slide 0: Title card (0–3s) -->
  <div data-start="${S0}" data-duration="3"
       data-track-index="0"
       style="position:absolute;inset:0;display:flex;flex-direction:column;
              align-items:center;justify-content:center;gap:24px;
              background:#0f172a;opacity:0;animation:fadeIn 0.6s 0s forwards;">
    <div style="font-size:72px;font-weight:900;letter-spacing:-2px;
                background:linear-gradient(135deg,#60a5fa,#a78bfa);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
      subagent-evals
    </div>
    <div style="font-size:28px;color:#475569;letter-spacing:6px;text-transform:uppercase;">
      evaluation report · ${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}
    </div>
  </div>

  <!-- Slide 1: Score + badge (3–9s) -->
  <div data-start="${S1}" data-duration="${S2 - S1}"
       data-track-index="1"
       style="position:absolute;inset:0;display:flex;flex-direction:column;
              align-items:center;justify-content:center;gap:48px;
              background:#0f172a;opacity:0;animation:fadeIn 0.5s 0s forwards;">

    <!-- Score ring -->
    <div style="position:relative;width:300px;height:300px;">
      <svg width="300" height="300" style="transform:rotate(-90deg);">
        <circle cx="150" cy="150" r="130"
                fill="none" stroke="#1e293b" stroke-width="20"/>
        <circle cx="150" cy="150" r="130"
                fill="none" stroke="${color}" stroke-width="20"
                stroke-dasharray="${Math.round(2 * Math.PI * 130 * score)} ${Math.round(2 * Math.PI * 130)}"
                stroke-linecap="round"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;">
        <div style="font-size:72px;font-weight:900;color:#f1f5f9;font-family:monospace;">
          ${score.toFixed(2)}
        </div>
        <div style="font-size:22px;color:#64748b;">score</div>
      </div>
    </div>

    <!-- Badge pill -->
    <div style="display:flex;align-items:center;gap:16px;
                background:${color}22;border:2px solid ${color};
                padding:16px 48px;border-radius:60px;">
      <span style="font-size:40px;color:${color};">${badgeEmoji(badge)}</span>
      <span style="font-size:48px;font-weight:800;color:${color};letter-spacing:2px;">
        ${badge}
      </span>
    </div>

    <!-- Stats row -->
    <div style="display:flex;gap:80px;font-size:26px;color:#64748b;">
      <span>${summary.agents} agents</span>
      <span>${summary.static_cases} static cases</span>
      <span>${summary.runtime_cases} runtime cases</span>
    </div>
  </div>

  <!-- Slide 2: Agent breakdown (9–15s) -->
  <div data-start="${S2}" data-duration="${S3 - S2}"
       data-track-index="2"
       style="position:absolute;inset:0;background:#0f172a;
              opacity:0;animation:fadeIn 0.5s 0s forwards;">
    <div style="padding:80px 200px;">
      <div style="font-size:32px;color:#475569;letter-spacing:4px;
                  text-transform:uppercase;margin-bottom:40px;">agents</div>
      ${agentRows}
    </div>
  </div>

  <!-- Slide 3: Runtime pass/fail (15–20s) -->
  <div data-start="${S3}" data-duration="${(hasDiff ? S4 : totalDuration) - S3}"
       data-track-index="3"
       style="position:absolute;inset:0;display:flex;flex-direction:column;
              align-items:center;justify-content:center;gap:48px;
              background:#0f172a;opacity:0;animation:fadeIn 0.5s 0s forwards;">
    <div style="font-size:32px;color:#475569;letter-spacing:4px;text-transform:uppercase;">
      runtime cases
    </div>
    <div style="display:flex;gap:80px;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div style="font-size:120px;font-weight:900;color:#22c55e;font-family:monospace;">
          ${passed}
        </div>
        <div style="font-size:28px;color:#22c55e;letter-spacing:4px;">PASSED</div>
      </div>
      <div style="width:2px;background:#1e293b;"></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div style="font-size:120px;font-weight:900;
                    color:${failed > 0 ? "#ef4444" : "#1e293b"};font-family:monospace;">
          ${failed}
        </div>
        <div style="font-size:28px;color:${failed > 0 ? "#ef4444" : "#334155"};letter-spacing:4px;">
          FAILED
        </div>
      </div>
    </div>
    ${runtime_cases.length > 0 ? `
    <div style="width:800px;height:12px;background:#1e293b;border-radius:6px;overflow:hidden;">
      <div style="height:100%;width:${Math.round(passed / runtime_cases.length * 100)}%;
                  background:#22c55e;border-radius:6px;"></div>
    </div>` : ""}
  </div>

  ${diffSlide}

</div>

</body>
</html>`;
}
