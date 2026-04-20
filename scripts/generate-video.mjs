#!/usr/bin/env node
/**
 * Generate an MP4 summary video from subagent-evals results using HyperFrames.
 *
 * Usage:
 *   node scripts/generate-video.mjs [results.json] [baseline.json]
 *
 * Output: examples/videos/eval-summary.mp4
 *
 * Requires: Node >= 22, FFmpeg, hyperframes (pnpm add -D hyperframes)
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
const projDir = resolve(root, ".video-temp");

if (!existsSync(resultsPath)) {
  console.error(`Error: results file not found: ${resultsPath}`);
  console.error("Run 'subagent-evals eval' first to generate out/results.json");
  process.exit(1);
}

const report = JSON.parse(readFileSync(resultsPath, "utf8"));
const baseline = baselinePath && existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;

mkdirSync(projDir, { recursive: true });
mkdirSync(dirname(outputPath), { recursive: true });

// HyperFrames project structure
writeFileSync(resolve(projDir, "hyperframes.json"), JSON.stringify({
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" }
}, null, 2));

writeFileSync(resolve(projDir, "meta.json"), JSON.stringify({
  "id": "eval-summary",
  "name": "subagent-evals summary",
  "createdAt": new Date().toISOString()
}, null, 2));

writeFileSync(resolve(projDir, "index.html"), buildComposition(report, baseline));
console.log(`Project written → ${projDir}/`);

console.log("Rendering video (requires FFmpeg)…");
execSync(`npx hyperframes render --output "${outputPath}"`, {
  cwd: projDir,
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

function pct(score) { return Math.round(score * 100); }

function buildComposition(report, baseline) {
  const { summary, agents = [], runtime_cases = [] } = report;
  const { score, badge } = summary;
  const color = badgeColor(badge);
  const passed = runtime_cases.filter(c => c.passed).length;
  const failed = runtime_cases.length - passed;

  const hasDiff = baseline !== null;
  const scoreDelta = hasDiff ? score - baseline.summary.score : 0;
  const badgeChanged = hasDiff && badge !== baseline.summary.badge;
  const totalDuration = hasDiff ? 26 : 22;

  const S0 = 0, S1 = 3, S2 = 9, S3 = 15, S4 = 20;

  const agentClips = agents.slice(0, 6).map((a, i) => {
    const c = badgeColor(a.badge);
    const id = `agent${i}`;
    return {
      html: `
      <div id="${id}" style="position:absolute;left:200px;top:${260 + i * 72}px;width:1520px;
                             display:flex;align-items:center;gap:24px;opacity:0;">
        <span style="font-size:28px;font-family:monospace;color:#94a3b8;width:320px;
                     overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.agent_id}</span>
        <div style="flex:1;height:12px;background:#1e293b;border-radius:6px;overflow:hidden;">
          <div id="${id}bar" style="height:100%;width:0%;background:${c};border-radius:6px;"></div>
        </div>
        <span style="font-size:26px;font-weight:700;color:${c};width:80px;text-align:right;">
          ${a.score.toFixed(2)}
        </span>
        <span style="font-size:20px;color:${c};background:${c}22;padding:4px 14px;
                     border-radius:20px;font-weight:600;">${a.badge}</span>
      </div>`,
      gsap: `
      tl.to("#${id}", { opacity: 1, y: 0, duration: 0.4 }, ${S2 + 0.3 * i});
      tl.to("#${id}bar", { width: "${pct(a.score)}%", duration: 0.6 }, ${S2 + 0.3 * i + 0.1});`
    };
  });

  const diffSlide = hasDiff ? `
    <div id="slide4" style="position:absolute;inset:0;display:flex;flex-direction:column;
                             align-items:center;justify-content:center;gap:32px;
                             background:#0f172a;opacity:0;">
      <div style="font-size:28px;color:#64748b;letter-spacing:4px;text-transform:uppercase;">vs baseline</div>
      <div id="deltaText" style="font-size:96px;font-weight:900;color:${diffColor(scoreDelta)};font-family:monospace;">
        ${diffArrow(scoreDelta)}
      </div>
      ${badgeChanged
        ? `<div style="display:flex;align-items:center;gap:24px;font-size:36px;">
             <span style="color:${badgeColor(baseline.summary.badge)};font-weight:700;">${baseline.summary.badge}</span>
             <span style="color:#475569;">→</span>
             <span style="color:${color};font-weight:700;">${badge}</span>
           </div>`
        : `<div style="font-size:32px;color:#475569;">badge unchanged · ${badge}</div>`}
      <div style="font-size:24px;color:#475569;">${summary.agents} agents · ${summary.runtime_cases} cases</div>
    </div>` : "";

  const diffGsap = hasDiff ? `
      tl.to("#slide4", { opacity: 1, duration: 0.5 }, ${S4});
      tl.from("#deltaText", { scale: 0.5, duration: 0.5, ease: "back.out(1.7)" }, ${S4 + 0.1});` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1920, height=1080"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0f172a;}
</style>
</head>
<body>

<div id="root"
     data-composition-id="eval-summary"
     data-start="${S0}"
     data-duration="${totalDuration}"
     data-width="1920"
     data-height="1080">

  <!-- Slide 0: Title (0–3s) -->
  <div id="slide0" style="position:absolute;inset:0;display:flex;flex-direction:column;
                           align-items:center;justify-content:center;gap:24px;opacity:0;">
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
  <div id="slide1" style="position:absolute;inset:0;display:flex;flex-direction:column;
                           align-items:center;justify-content:center;gap:48px;opacity:0;">
    <div style="position:relative;width:300px;height:300px;">
      <svg width="300" height="300" style="transform:rotate(-90deg);">
        <circle cx="150" cy="150" r="130" fill="none" stroke="#1e293b" stroke-width="20"/>
        <circle id="scoreArc" cx="150" cy="150" r="130"
                fill="none" stroke="${color}" stroke-width="20"
                stroke-dasharray="0 ${Math.round(2 * Math.PI * 130)}"
                stroke-linecap="round"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;">
        <div style="font-size:72px;font-weight:900;color:#f1f5f9;font-family:monospace;">${score.toFixed(2)}</div>
        <div style="font-size:22px;color:#64748b;">score</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:16px;background:${color}22;border:2px solid ${color};
                padding:16px 48px;border-radius:60px;">
      <span style="font-size:40px;color:${color};">${badgeEmoji(badge)}</span>
      <span style="font-size:48px;font-weight:800;color:${color};letter-spacing:2px;">${badge}</span>
    </div>
    <div style="display:flex;gap:80px;font-size:26px;color:#64748b;">
      <span>${summary.agents} agents</span>
      <span>${summary.static_cases} static cases</span>
      <span>${summary.runtime_cases} runtime cases</span>
    </div>
  </div>

  <!-- Slide 2: Agent breakdown (9–15s) -->
  <div id="slide2" style="position:absolute;inset:0;background:#0f172a;opacity:0;">
    <div style="padding:80px 200px;">
      <div style="font-size:32px;color:#475569;letter-spacing:4px;text-transform:uppercase;margin-bottom:40px;">agents</div>
      ${agentClips.map(a => a.html).join("\n")}
    </div>
  </div>

  <!-- Slide 3: Runtime pass/fail (15–20s) -->
  <div id="slide3" style="position:absolute;inset:0;display:flex;flex-direction:column;
                           align-items:center;justify-content:center;gap:48px;opacity:0;">
    <div style="font-size:32px;color:#475569;letter-spacing:4px;text-transform:uppercase;">runtime cases</div>
    <div style="display:flex;gap:80px;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div style="font-size:120px;font-weight:900;color:#22c55e;font-family:monospace;">${passed}</div>
        <div style="font-size:28px;color:#22c55e;letter-spacing:4px;">PASSED</div>
      </div>
      <div style="width:2px;background:#1e293b;"></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div style="font-size:120px;font-weight:900;color:${failed > 0 ? "#ef4444" : "#1e293b"};font-family:monospace;">${failed}</div>
        <div style="font-size:28px;color:${failed > 0 ? "#ef4444" : "#334155"};letter-spacing:4px;">FAILED</div>
      </div>
    </div>
    ${runtime_cases.length > 0 ? `
    <div style="width:800px;height:12px;background:#1e293b;border-radius:6px;overflow:hidden;">
      <div id="passBar" style="height:100%;width:0%;background:#22c55e;border-radius:6px;"></div>
    </div>` : ""}
  </div>

  ${diffSlide}

</div>

<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });

  // Slide 0
  tl.to("#slide0", { opacity: 1, duration: 0.6 }, ${S0});
  tl.to("#slide0", { opacity: 0, duration: 0.4 }, ${S1 - 0.4});

  // Slide 1
  tl.to("#slide1", { opacity: 1, duration: 0.5 }, ${S1});
  tl.to("#scoreArc", {
    attr: { "stroke-dasharray": "${Math.round(2 * Math.PI * 130 * score)} ${Math.round(2 * Math.PI * 130)}" },
    duration: 1.2, ease: "power2.out"
  }, ${S1 + 0.3});
  tl.to("#slide1", { opacity: 0, duration: 0.4 }, ${S2 - 0.4});

  // Slide 2
  tl.to("#slide2", { opacity: 1, duration: 0.5 }, ${S2});
  ${agentClips.map(a => a.gsap).join("\n")}
  tl.to("#slide2", { opacity: 0, duration: 0.4 }, ${S3 - 0.4});

  // Slide 3
  tl.to("#slide3", { opacity: 1, duration: 0.5 }, ${S3});
  ${runtime_cases.length > 0 ? `tl.to("#passBar", { width: "${Math.round(passed / runtime_cases.length * 100)}%", duration: 0.8, ease: "power2.out" }, ${S3 + 0.3});` : ""}
  ${hasDiff ? `tl.to("#slide3", { opacity: 0, duration: 0.4 }, ${S4 - 0.4});` : ""}

  ${diffGsap}

  window.__timelines["eval-summary"] = tl;
</script>
</body>
</html>`;
}
