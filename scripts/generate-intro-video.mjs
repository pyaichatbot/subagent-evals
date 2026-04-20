#!/usr/bin/env node
/**
 * Generate the subagent-evals intro + e2e usage video using HyperFrames.
 * Theme matches the static site: warm parchment, serif headings, terracotta accent.
 *
 * Usage:
 *   node scripts/generate-intro-video.mjs
 *
 * Output: examples/videos/intro.mp4
 *
 * Requires: Node >= 22, FFmpeg, hyperframes (pnpm add -D hyperframes)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const outputPath = resolve(root, "examples/videos/intro.mp4");
const projDir = resolve(root, ".video-temp-intro");

mkdirSync(projDir, { recursive: true });
mkdirSync(dirname(outputPath), { recursive: true });

writeFileSync(resolve(projDir, "hyperframes.json"), JSON.stringify({
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" }
}, null, 2));

writeFileSync(resolve(projDir, "meta.json"), JSON.stringify({
  "id": "intro",
  "name": "subagent-evals intro",
  "createdAt": new Date().toISOString()
}, null, 2));

// ---------------------------------------------------------------------------
// Site design tokens (mirrors packages/hosted/src/index.ts baseCss)
// ---------------------------------------------------------------------------
const T = {
  paper:       "#f7f4ec",  // warm parchment
  paper2:      "#fbf9f2",
  paperDark:   "#ede9df",  // for cards / terminal bg
  ink:         "#17171a",
  ink2:        "#2d2c30",
  muted:       "#6a665c",
  rule:        "#d8d3c4",
  rule2:       "#ebe6d6",
  accent:      "#a8431e",  // terracotta
  accentSoft:  "#f0dfd4",
  forest:      "#2f5d3a",  // certified
  indigo:      "#3c5878",  // strong
  ochre:       "#8a6b17",  // usable
  umber:       "#7a2e1e",  // experimental
  // HyperFrames mapped fonts (see: hyperframes docs/fonts)
  serif:       `"EB Garamond","Times New Roman",Georgia,serif`,
  sans:        `Inter,Helvetica,Arial,sans-serif`,
  mono:        `"JetBrains Mono","SF Mono",Menlo,Consolas,monospace`,
};

function badgePill(label, color) {
  return `<span style="display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .9rem;
    border:2px solid ${color};border-radius:3px;font-size:18px;letter-spacing:.08em;
    text-transform:uppercase;font-weight:700;color:${color};font-family:${T.sans};">
    <span style="width:.5rem;height:.5rem;background:${color};border-radius:50%;display:inline-block;"></span>
    ${label}
  </span>`;
}

function buildComposition() {
  // Slide timings (seconds)
  const S0 = 0;   // Title + tagline
  const S1 = 5;   // Problem: 6 agent formats
  const S2 = 11;  // Solution pipeline: Lint → Eval → Score
  const S3 = 18;  // E2E terminal walkthrough
  const S4 = 30;  // Score reveal + badge
  const S5 = 37;  // PR feedback card
  const S6 = 43;  // CTA
  const TOTAL = 47;

  const agentFormats = [
    { label: "Claude Code",    path: ".claude/agents/*.md",              color: T.accent },
    { label: "OpenAI Codex",   path: "AGENTS.md",                        color: T.indigo },
    { label: "Copilot",        path: ".github/copilot-instructions.md",  color: T.forest },
    { label: "Cursor",         path: ".cursor/rules/*.mdc",              color: T.ochre  },
    { label: "Windsurf",       path: ".windsurf/rules/*.md",             color: T.umber  },
    { label: "Generic YAML",   path: "frontmatter *.md",                 color: T.muted  },
  ];

  const terminalLines = [
    {
      cmd: "$ subagent-evals lint .",
      out: "✓  9/9 checks passed  ·  0 warnings",
      color: T.forest,
      tCmd: S3 + 0.5,
      tOut: S3 + 2.0
    },
    {
      cmd: "$ subagent-evals eval",
      out: "Running 12 cases…  11 passed  ·  1 skipped",
      color: T.forest,
      tCmd: S3 + 4.5,
      tOut: S3 + 6.2
    },
    {
      cmd: "$ subagent-evals submit --public",
      out: "Badge: certified  ·  score: 0.940",
      color: T.accent,
      tCmd: S3 + 8.5,
      tOut: S3 + 10.2
    },
  ];

  const pipelineSteps = [
    {
      icon: "⬡",
      label: "Lint",
      desc: "9 static dimensions\nin milliseconds",
      color: T.indigo,
      t: S2 + 0.4
    },
    {
      icon: "▶",
      label: "Eval",
      desc: "Deterministic replay\nacross all agent formats",
      color: T.forest,
      t: S2 + 0.9
    },
    {
      icon: "✦",
      label: "Score",
      desc: "Badge + leaderboard\nautomatically published",
      color: T.accent,
      t: S2 + 1.4
    },
  ];

  const arcCircumference = Math.round(2 * Math.PI * 130);
  const arcFill = Math.round(arcCircumference * 0.94);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1920, height=1080"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  :root {
    --paper: ${T.paper};
    --paper2: ${T.paper2};
    --paperDark: ${T.paperDark};
    --ink: ${T.ink};
    --ink2: ${T.ink2};
    --muted: ${T.muted};
    --rule: ${T.rule};
    --rule2: ${T.rule2};
    --accent: ${T.accent};
    --forest: ${T.forest};
    --indigo: ${T.indigo};
    --serif: ${T.serif};
    --sans: ${T.sans};
    --mono: ${T.mono};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  .slide {
    position: absolute; inset: 0; opacity: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: var(--paper);
  }
  .eyebrow {
    font-family: var(--sans); font-size: 18px; letter-spacing: .12em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 24px;
  }
  .display {
    font-family: var(--serif); font-weight: 500; letter-spacing: -.02em;
    line-height: 1.08; color: var(--ink);
  }
  .rule-line {
    width: 80px; height: 2px; background: var(--accent); margin: 0 auto;
  }
</style>
</head>
<body>

<div id="root"
     data-composition-id="intro"
     data-start="0"
     data-duration="${TOTAL}"
     data-width="1920"
     data-height="1080">

<!-- ──────────────────────────────────────────────────────────────
     Slide 0 · Title (0–5s)
────────────────────────────────────────────────────────────────── -->
<div id="s0" class="slide" style="gap:32px;">

  <!-- Brand mark row -->
  <div id="s0brand" style="display:flex;align-items:center;gap:18px;opacity:0;">
    <div style="width:20px;height:20px;background:var(--accent);"></div>
    <span style="font-family:var(--serif);font-size:26px;letter-spacing:.02em;color:var(--muted);">
      subagent-evals
    </span>
  </div>

  <!-- Main headline -->
  <div id="s0head" style="text-align:center;opacity:0;">
    <h1 class="display" style="font-size:96px;max-width:14ch;margin:0 auto 28px;">
      The Codecov for<br/>markdown AI agents.
    </h1>
  </div>

  <div id="s0rule" class="rule-line" style="opacity:0;"></div>

  <!-- Pill row -->
  <div id="s0pills" style="display:flex;gap:20px;margin-top:16px;opacity:0;">
    ${["Lint", "Eval", "Score", "Submit"].map(l =>
      `<div style="padding:10px 32px;border:1px solid var(--rule);border-radius:2px;
                   font-size:18px;color:var(--muted);font-family:var(--sans);
                   letter-spacing:.06em;text-transform:uppercase;">${l}</div>`
    ).join("")}
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────────
     Slide 1 · Problem (5–11s)
────────────────────────────────────────────────────────────────── -->
<div id="s1" class="slide" style="gap:56px;">

  <div id="s1head" style="text-align:center;opacity:0;">
    <p class="eyebrow">The problem</p>
    <h2 class="display" style="font-size:62px;">
      AI agents live in six formats.<br/>
      <span style="color:var(--accent);">How do you know they work?</span>
    </h2>
  </div>

  <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;max-width:1440px;">
    ${agentFormats.map((f, i) => `
    <div id="fmt${i}"
         style="padding:24px 32px;background:var(--paper2);
                border:1px solid var(--rule);border-radius:3px;
                min-width:260px;opacity:0;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:8px;height:8px;background:${f.color};border-radius:50%;flex-shrink:0;"></div>
        <div style="font-size:19px;color:${f.color};font-weight:600;font-family:var(--sans);">${f.label}</div>
      </div>
      <div style="font-size:15px;color:var(--muted);font-family:var(--mono);">${f.path}</div>
    </div>`).join("")}
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────────
     Slide 2 · Pipeline (11–18s)
────────────────────────────────────────────────────────────────── -->
<div id="s2" class="slide" style="gap:60px;">
  <div style="text-align:center;opacity:1;">
    <p class="eyebrow">One command, three stages</p>
    <h2 class="display" style="font-size:58px;opacity:1;">subagent-evals lint . &amp;&amp; eval &amp;&amp; submit</h2>
  </div>

  <div style="display:flex;gap:56px;align-items:flex-start;justify-content:center;">
    ${pipelineSteps.map((s, i) => `
    <div id="pc${i}" style="opacity:0;display:flex;flex-direction:column;align-items:center;gap:20px;width:340px;">
      <div style="width:120px;height:120px;border:2px solid ${s.color};border-radius:4px;
                  display:flex;align-items:center;justify-content:center;
                  font-size:52px;color:${s.color};background:${s.color}0d;">${s.icon}</div>
      <div style="font-size:38px;font-weight:500;color:var(--ink);font-family:var(--serif);">${s.label}</div>
      <div style="font-size:19px;color:var(--muted);text-align:center;
                  white-space:pre-line;line-height:1.5;font-family:var(--sans);">${s.desc}</div>
    </div>
    ${i < pipelineSteps.length - 1
      ? `<div id="arr${i}" style="font-size:36px;color:var(--rule);margin-top:40px;opacity:0;">→</div>`
      : ""}`).join("")}
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────────
     Slide 3 · E2E Terminal (18–30s)
────────────────────────────────────────────────────────────────── -->
<div id="s3" class="slide">
  <div style="width:1240px;">
    <!-- Window chrome -->
    <div style="background:var(--ink2);border-radius:6px 6px 0 0;padding:14px 22px;
                display:flex;gap:10px;align-items:center;">
      <div style="width:13px;height:13px;border-radius:50%;background:#ef4444;"></div>
      <div style="width:13px;height:13px;border-radius:50%;background:#f59e0b;"></div>
      <div style="width:13px;height:13px;border-radius:50%;background:#22c55e;"></div>
      <div style="margin-left:20px;font-size:14px;color:var(--rule);font-family:var(--mono);">
        ~/my-agent-repo — zsh
      </div>
    </div>
    <!-- Terminal body: parchment tone -->
    <div style="background:var(--paperDark);border-radius:0 0 6px 6px;
                border:1px solid var(--rule);border-top:0;
                padding:44px 52px;min-height:440px;">
      ${terminalLines.map((l, i) => `
      <div id="tc${i}" style="margin-bottom:36px;opacity:0;">
        <div style="font-size:22px;color:var(--ink2);margin-bottom:10px;font-family:var(--mono);">${l.cmd}</div>
        <div id="to${i}" style="font-size:18px;color:${l.color};padding-left:28px;
                                  opacity:0;font-family:var(--mono);">${l.out}</div>
      </div>`).join("")}
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────────
     Slide 4 · Score reveal (30–37s)
────────────────────────────────────────────────────────────────── -->
<div id="s4" class="slide" style="gap:56px;">
  <p class="eyebrow" style="opacity:1;">Your result</p>

  <div style="display:flex;gap:100px;align-items:center;">
    <!-- Score ring -->
    <div style="position:relative;width:300px;height:300px;">
      <svg width="300" height="300" style="transform:rotate(-90deg);">
        <circle cx="150" cy="150" r="130"
                fill="none" stroke="var(--rule2)" stroke-width="18"/>
        <circle id="arc" cx="150" cy="150" r="130"
                fill="none" stroke="${T.forest}" stroke-width="18"
                stroke-dasharray="0 ${arcCircumference}"
                stroke-linecap="round"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;">
        <div id="scoreNum" style="font-size:72px;font-weight:500;color:var(--ink);
                                   font-family:var(--serif);line-height:1;">0.00</div>
        <div style="font-size:18px;color:var(--muted);margin-top:4px;
                    font-family:var(--sans);letter-spacing:.06em;text-transform:uppercase;">score</div>
      </div>
    </div>

    <!-- Badge + stats -->
    <div style="display:flex;flex-direction:column;gap:28px;">
      <div id="s4badge" style="opacity:0;">
        ${badgePill("Certified", T.forest)}
      </div>
      <div id="s4stats" style="opacity:0;display:flex;flex-direction:column;gap:10px;
                                font-size:19px;color:var(--muted);font-family:var(--sans);">
        <span>3 agents evaluated</span>
        <span>12 static cases · 8 runtime cases</span>
        <span style="color:var(--forest);font-weight:600;">11 / 12 passed</span>
      </div>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────────
     Slide 5 · PR feedback (37–43s)
────────────────────────────────────────────────────────────────── -->
<div id="s5" class="slide" style="gap:44px;">
  <div style="text-align:center;">
    <p class="eyebrow">Automatic PR feedback</p>
    <h2 class="display" style="font-size:54px;">Score deltas on every pull request.</h2>
  </div>

  <!-- Mock GitHub PR comment -->
  <div id="prCard" style="width:1000px;background:var(--paper2);
                border:1px solid var(--rule);border-radius:4px;
                overflow:hidden;opacity:0;transform:translateY(24px);">
    <div style="padding:16px 24px;border-bottom:1px solid var(--rule);
                display:flex;align-items:center;gap:12px;background:var(--paperDark);">
      <div style="width:32px;height:32px;border-radius:50%;
                  background:var(--accent);display:flex;align-items:center;
                  justify-content:center;font-size:16px;color:white;font-weight:700;">✦</div>
      <span style="font-size:15px;color:var(--muted);font-family:var(--sans);">subagent-evals-bot</span>
      <span style="margin-left:auto;font-size:13px;color:var(--muted);
                   border:1px solid var(--rule);padding:3px 12px;border-radius:2px;
                   font-family:var(--sans);">CI check · passing</span>
    </div>
    <div style="padding:32px 36px;display:flex;flex-direction:column;gap:18px;">
      <div style="font-size:22px;font-weight:600;color:var(--ink);font-family:var(--serif);">
        ✦ subagent-evals — Certified · 0.940
      </div>
      <div style="display:flex;gap:40px;">
        <div style="font-size:16px;color:var(--muted);font-family:var(--sans);">
          Score: <span style="color:var(--forest);font-weight:700;">▲ +0.070</span> vs baseline
        </div>
        <div style="font-size:16px;color:var(--muted);font-family:var(--sans);">
          Badge: <span style="color:var(--muted);">strong</span>
          <span style="color:var(--muted);padding:0 8px;">→</span>
          <span style="color:var(--forest);font-weight:700;">certified</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:4px;">
        ${badgePill("11 / 12 passed", T.forest)}
        <span style="display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .9rem;
            border:1px solid var(--rule);border-radius:3px;font-size:18px;letter-spacing:.08em;
            text-transform:uppercase;font-weight:600;color:var(--muted);font-family:${T.sans};">
          1 skipped
        </span>
      </div>
    </div>
  </div>
</div>

<!-- ──────────────────────────────────────────────────────────────
     Slide 6 · CTA (43–47s)
────────────────────────────────────────────────────────────────── -->
<div id="s6" class="slide" style="gap:36px;">
  <div style="display:flex;align-items:center;gap:16px;">
    <div style="width:18px;height:18px;background:var(--accent);"></div>
    <h1 class="display" style="font-size:72px;">subagent-evals</h1>
  </div>

  <div id="s6cmd" style="opacity:0;font-size:21px;background:var(--paperDark);
              border:1px solid var(--rule);border-radius:3px;
              padding:18px 44px;color:var(--ink2);font-family:var(--mono);">
    node packages/cli/dist/bin/subagent-evals.js lint .
  </div>

  <div id="s6url" style="opacity:0;font-size:19px;color:var(--muted);font-family:var(--sans);">
    github.com/pyaichatbot/subagent-evals
  </div>
</div>

</div><!-- #root -->

<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });

  // ── Slide 0: Title ──
  tl.to("#s0", { opacity: 1, duration: 0.5 }, ${S0});
  tl.to("#s0brand", { opacity: 1, y: 0, duration: 0.5 }, ${S0 + 0.2});
  tl.to("#s0head",  { opacity: 1, y: 0, duration: 0.6 }, ${S0 + 0.5});
  tl.to("#s0rule",  { opacity: 1, duration: 0.4 }, ${S0 + 0.9});
  tl.to("#s0pills", { opacity: 1, duration: 0.4 }, ${S0 + 1.2});
  tl.to("#s0", { opacity: 0, duration: 0.4 }, ${S1 - 0.5});

  // ── Slide 1: Problem ──
  tl.to("#s1", { opacity: 1, duration: 0.4 }, ${S1});
  tl.from("#s1head", { y: -20, opacity: 0, duration: 0.5 }, ${S1 + 0.2});
  ${agentFormats.map((_, i) => `
  tl.fromTo("#fmt${i}", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35 }, ${S1 + 1 + i * 0.25});`).join("")}
  tl.to("#s1", { opacity: 0, duration: 0.4 }, ${S2 - 0.5});

  // ── Slide 2: Pipeline ──
  tl.to("#s2", { opacity: 1, duration: 0.4 }, ${S2});
  ${pipelineSteps.map((s, i) => `
  tl.to("#pc${i}", { opacity: 1, duration: 0.45, ease: "power2.out" }, ${s.t});
  ${i < pipelineSteps.length - 1 ? `tl.to("#arr${i}", { opacity: 1, duration: 0.3 }, ${s.t + 0.35});` : ""}`).join("")}
  tl.to("#s2", { opacity: 0, duration: 0.4 }, ${S3 - 0.5});

  // ── Slide 3: Terminal ──
  tl.to("#s3", { opacity: 1, duration: 0.4 }, ${S3});
  ${terminalLines.map((l, i) => `
  tl.to("#tc${i}", { opacity: 1, duration: 0.3 }, ${l.tCmd});
  tl.to("#to${i}", { opacity: 1, duration: 0.4 }, ${l.tOut});`).join("")}
  tl.to("#s3", { opacity: 0, duration: 0.4 }, ${S4 - 0.5});

  // ── Slide 4: Score reveal ──
  tl.to("#s4", { opacity: 1, duration: 0.4 }, ${S4});
  tl.to("#arc", {
    attr: { "stroke-dasharray": "${arcFill} ${arcCircumference}" },
    duration: 1.4, ease: "power2.out"
  }, ${S4 + 0.4});
  tl.to({ v: 0 }, {
    v: 0.94, duration: 1.4, ease: "power2.out",
    onUpdate: function () {
      const el = document.getElementById("scoreNum");
      if (el) el.textContent = this.targets()[0].v.toFixed(2);
    }
  }, ${S4 + 0.4});
  tl.to("#s4badge", { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" }, ${S4 + 1.2});
  tl.to("#s4stats", { opacity: 1, duration: 0.4 }, ${S4 + 1.7});
  tl.to("#s4", { opacity: 0, duration: 0.4 }, ${S5 - 0.5});

  // ── Slide 5: PR badge ──
  tl.to("#s5", { opacity: 1, duration: 0.4 }, ${S5});
  tl.to("#prCard", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, ${S5 + 0.5});
  tl.to("#s5", { opacity: 0, duration: 0.4 }, ${S6 - 0.5});

  // ── Slide 6: CTA ──
  tl.to("#s6", { opacity: 1, duration: 0.5 }, ${S6});
  tl.to("#s6cmd", { opacity: 1, duration: 0.4 }, ${S6 + 0.6});
  tl.to("#s6url", { opacity: 1, duration: 0.4 }, ${S6 + 1.1});

  window.__timelines["intro"] = tl;
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
writeFileSync(resolve(projDir, "index.html"), buildComposition());
console.log(`Project written → ${projDir}/`);

console.log("Rendering video (requires FFmpeg)…");
execSync(`npx hyperframes render --output "${outputPath}"`, {
  cwd: projDir,
  stdio: "inherit"
});

console.log(`\nVideo ready → ${outputPath}`);
