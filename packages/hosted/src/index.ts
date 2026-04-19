import type { BadgeTier, SubmissionPayload } from "@subagent-evals/core";

export interface HostedRepoEntry {
  id: string;
  summary: SubmissionPayload["summary"];
  attribution?: SubmissionPayload["attribution"];
  source_mode: SubmissionPayload["source_mode"];
  adapters: SubmissionPayload["adapters"];
}

export interface HostedRenderOptions {
  baseUrl?: string;
  siteName?: string;
  tagline?: string;
  repoUrl?: string;
  generatedAt?: string;
}

const DEFAULT_BASE_URL = "https://pyaichatbot.github.io/subagent-evals";
const DEFAULT_SITE_NAME = "subagent-evals";
const DEFAULT_TAGLINE = "The Codecov for markdown AI agents.";
const DEFAULT_REPO_URL = "https://github.com/pyaichatbot/subagent-evals";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function resolveOptions(options?: HostedRenderOptions) {
  const baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return {
    baseUrl,
    siteName: options?.siteName ?? DEFAULT_SITE_NAME,
    tagline: options?.tagline ?? DEFAULT_TAGLINE,
    repoUrl: options?.repoUrl ?? DEFAULT_REPO_URL,
    generatedAt: options?.generatedAt ?? new Date().toISOString()
  };
}

function sitePath(options: ReturnType<typeof resolveOptions>, path: string): string {
  const base = new URL(options.baseUrl);
  const prefix = base.pathname.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${normalized}`;
}

function tierColor(tier: BadgeTier): string {
  switch (tier) {
    case "certified":
      return "#2f5d3a";
    case "strong":
      return "#3c5878";
    case "usable":
      return "#8a6b17";
    default:
      return "#7a2e1e";
  }
}

function tierLabel(tier: BadgeTier): string {
  switch (tier) {
    case "certified":
      return "Certified";
    case "strong":
      return "Strong";
    case "usable":
      return "Usable";
    default:
      return "Experimental";
  }
}

function formatScore(score: number): string {
  const bounded = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  return bounded.toFixed(3);
}

function scorePercent(score: number): number {
  const bounded = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  return Math.round(bounded * 1000) / 10;
}

function faviconDataUri(): string {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
    "<rect width='64' height='64' rx='12' fill='%23f7f4ec'/>" +
    "<path d='M18 42c0 3 3 5 7 5h12c5 0 8-3 8-7 0-4-3-6-8-7l-8-2c-2-1-3-2-3-4s2-3 4-3h13v-6H26c-5 0-8 3-8 7 0 4 3 6 8 7l8 2c2 1 3 2 3 4s-2 3-4 3H20z' fill='%2317171a'/>" +
    "<circle cx='48' cy='20' r='5' fill='%23a8431e'/>" +
    "</svg>";
  return `data:image/svg+xml,${svg}`;
}

function baseCss(): string {
  return `:root{color-scheme:light;--paper:#f7f4ec;--paper-2:#fbf9f2;--ink:#17171a;--ink-2:#2d2c30;--muted:#6a665c;--rule:#d8d3c4;--rule-2:#ebe6d6;--accent:#a8431e;--accent-soft:#f0dfd4;--forest:#2f5d3a;--indigo:#3c5878;--ochre:#8a6b17;--umber:#7a2e1e;--serif:ui-serif,"Iowan Old Style","Apple Garamond",Baskerville,"Times New Roman",serif;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,Roboto,Helvetica,Arial,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--rule);text-underline-offset:3px;text-decoration-thickness:1px;transition:color .15s,text-decoration-color .15s}
a:hover{color:var(--accent);text-decoration-color:var(--accent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
.skip-link{position:absolute;left:-9999px;top:0;padding:.5rem 1rem;background:var(--ink);color:var(--paper)}
.skip-link:focus{left:1rem;top:1rem;z-index:100}
.container{max-width:1120px;margin:0 auto;padding:0 1.5rem}
.site-header{border-bottom:1px solid var(--rule);background:var(--paper);position:sticky;top:0;z-index:10;backdrop-filter:saturate(1.1)}
.site-header__inner{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1rem 0}
.brand{display:flex;align-items:baseline;gap:.6rem;font-family:var(--serif);font-size:1.15rem;font-weight:600;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
.brand__mark{display:inline-block;width:.5rem;height:.5rem;background:var(--accent);transform:translateY(-.1rem)}
.brand__tag{font-family:var(--sans);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:500}
.nav{display:flex;gap:1.5rem;align-items:center}
.nav a{font-size:.9rem;text-decoration:none;color:var(--ink-2)}
.nav a:hover{color:var(--accent)}
main{padding:3rem 0 5rem}
.eyebrow{font-family:var(--sans);font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 .75rem}
.display{font-family:var(--serif);font-weight:500;letter-spacing:-.02em;line-height:1.05;color:var(--ink);margin:0 0 1rem}
h1.display{font-size:clamp(2.2rem,4.5vw,3.4rem)}
h2.display{font-size:clamp(1.6rem,2.8vw,2.1rem);margin-top:3rem}
.lede{font-family:var(--serif);font-size:1.2rem;line-height:1.5;color:var(--ink-2);max-width:60ch;margin:0 0 2rem}
hr.rule{border:0;border-top:1px solid var(--rule);margin:2.5rem 0}
.meta-row{display:flex;flex-wrap:wrap;gap:1.25rem 2rem;color:var(--muted);font-size:.9rem;margin:0 0 2rem;padding:0;list-style:none}
.meta-row dt{font-family:var(--sans);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 .2rem}
.meta-row dd{margin:0;font-family:var(--mono);font-size:.9rem;color:var(--ink)}
.tier-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .6rem;border:1px solid currentColor;border-radius:2px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:600;font-family:var(--sans)}
.tier-pill::before{content:"";width:.4rem;height:.4rem;background:currentColor;border-radius:50%}
.score-hero{display:grid;grid-template-columns:minmax(0,1fr);gap:2rem;padding:2rem;background:var(--paper-2);border:1px solid var(--rule);border-radius:4px;margin:2rem 0}
@media(min-width:720px){.score-hero{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}}
.score-hero__number{font-family:var(--serif);font-size:clamp(3.5rem,8vw,5.5rem);line-height:1;letter-spacing:-.03em;margin:0;color:var(--ink)}
.score-hero__label{font-family:var(--sans);font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem}
.score-hero__aside{display:flex;flex-direction:column;gap:1rem;justify-content:center}
.meter{width:100%;height:.5rem;background:var(--rule-2);border-radius:2px;overflow:hidden}
.meter__fill{height:100%;background:var(--ink)}
.meter__marks{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.7rem;color:var(--muted);margin-top:.4rem}
.grid{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:2rem 0}
.stat{padding:1.25rem 1.5rem;border:1px solid var(--rule);border-radius:3px;background:var(--paper-2)}
.stat__label{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem}
.stat__value{font-family:var(--serif);font-size:1.8rem;line-height:1;color:var(--ink);margin:0}
.stat__hint{font-size:.8rem;color:var(--muted);margin-top:.5rem}
.table{width:100%;border-collapse:collapse;margin:2rem 0;font-size:.95rem}
.table th,.table td{padding:.9rem 1rem;text-align:left;vertical-align:baseline;border-bottom:1px solid var(--rule-2)}
.table thead th{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;border-bottom:1px solid var(--rule)}
.table tbody tr:hover{background:var(--paper-2)}
.table .rank{font-family:var(--mono);color:var(--muted);width:3rem}
.table .repo{font-family:var(--serif);font-size:1.05rem;color:var(--ink)}
.table .repo a{text-decoration:none;color:inherit}
.table .repo a:hover{color:var(--accent)}
.table .score{font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:right;width:6rem}
.adapters{display:flex;flex-wrap:wrap;gap:.35rem}
.adapter-chip{font-family:var(--mono);font-size:.72rem;padding:.15rem .45rem;background:var(--paper);border:1px solid var(--rule);border-radius:2px;color:var(--ink-2)}
.breadcrumb{font-size:.85rem;color:var(--muted);margin:0 0 1.5rem;padding:0;list-style:none;display:flex;gap:.5rem;flex-wrap:wrap}
.breadcrumb li::after{content:"/";margin-left:.5rem;color:var(--rule)}
.breadcrumb li:last-child::after{content:""}
.breadcrumb a{text-decoration:none;color:var(--muted)}
.breadcrumb a:hover{color:var(--accent)}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin:1.5rem 0 2.5rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.55rem .9rem;border:1px solid var(--ink);background:var(--ink);color:var(--paper);font-size:.85rem;text-decoration:none;border-radius:2px;transition:background .15s,color .15s,border-color .15s}
.btn:hover{background:var(--accent);border-color:var(--accent);color:var(--paper)}
.btn--ghost{background:transparent;color:var(--ink);border-color:var(--rule)}
.btn--ghost:hover{background:var(--paper-2);color:var(--accent);border-color:var(--accent)}
.code{font-family:var(--mono);font-size:.85rem;padding:.1rem .35rem;background:var(--paper-2);border:1px solid var(--rule-2);border-radius:2px;color:var(--ink-2)}
pre.code-block{font-family:var(--mono);font-size:.85rem;padding:1rem 1.25rem;background:#17171a;color:#e8e4d8;border-radius:3px;overflow-x:auto;margin:1.25rem 0;line-height:1.5}
pre.code-block .c{color:#8a8576}
.empty-state{padding:3rem 1.5rem;text-align:center;border:1px dashed var(--rule);border-radius:4px;color:var(--muted);background:var(--paper-2)}
.footer{border-top:1px solid var(--rule);padding:2.5rem 0;margin-top:4rem;color:var(--muted);font-size:.85rem}
.footer__inner{display:flex;flex-wrap:wrap;gap:1.5rem 2.5rem;justify-content:space-between;align-items:baseline}
.footer a{color:var(--muted);text-decoration-color:var(--rule-2)}
.footer a:hover{color:var(--accent)}
.tag-row{display:flex;gap:.4rem;flex-wrap:wrap;margin:.6rem 0 0}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;
}

function renderFavicon(): string {
  return `<link rel="icon" type="image/svg+xml" href="${faviconDataUri()}" />`;
}

function renderSeoHead(params: {
  title: string;
  description: string;
  canonical: string;
  type?: "website" | "article" | undefined;
  image?: string | undefined;
  siteName: string;
}): string {
  const { title, description, canonical, type = "website", image, siteName } = params;
  const metaImage = image ?? `${new URL(canonical).origin}/og-default.svg`;
  return [
    `<title>${escapeHtml(truncate(title, 60))}</title>`,
    `<meta name="description" content="${escapeAttr(truncate(description, 160))}" />`,
    `<meta name="viewport" content="width=device-width,initial-scale=1" />`,
    `<meta name="color-scheme" content="light" />`,
    `<meta name="theme-color" content="#f7f4ec" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${escapeAttr(siteName)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(truncate(description, 200))}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(metaImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(truncate(description, 200))}" />`,
    `<meta name="twitter:image" content="${escapeAttr(metaImage)}" />`,
    renderFavicon()
  ].join("\n    ");
}

function renderHeader(options: ReturnType<typeof resolveOptions>, active?: string): string {
  const isLeaderboard = active === "leaderboard";
  const isDocs = active === "docs";
  return `<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header" role="banner">
  <div class="container site-header__inner">
    <a class="brand" href="${sitePath(options, "/")}" aria-label="${escapeAttr(options.siteName)} home">
      <span class="brand__mark" aria-hidden="true"></span>
      <span>${escapeHtml(options.siteName)}</span>
      <span class="brand__tag" aria-hidden="true">evals</span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="${sitePath(options, "/leaderboard")}"${isLeaderboard ? ' aria-current="page"' : ""}>Leaderboard</a>
      <a href="${escapeAttr(options.repoUrl)}/tree/main/docs"${isDocs ? ' aria-current="page"' : ""} rel="noopener">Docs</a>
      <a href="${escapeAttr(options.repoUrl)}" rel="noopener">GitHub</a>
    </nav>
  </div>
</header>`;
}

function renderFooter(options: ReturnType<typeof resolveOptions>): string {
  const year = new Date(options.generatedAt).getUTCFullYear();
  return `<footer class="footer" role="contentinfo">
  <div class="container footer__inner">
    <div>
      <strong style="font-family:var(--serif);color:var(--ink);font-weight:500">${escapeHtml(options.siteName)}</strong>
      &nbsp;·&nbsp; ${escapeHtml(options.tagline)}
    </div>
    <div>
      <a href="${escapeAttr(options.repoUrl)}" rel="noopener">GitHub</a> &nbsp;·&nbsp;
      <a href="${sitePath(options, "/leaderboard")}">Leaderboard</a> &nbsp;·&nbsp;
      <a href="${sitePath(options, "/registry.json")}">Registry JSON</a> &nbsp;·&nbsp;
      <a href="${sitePath(options, "/sitemap.xml")}">Sitemap</a>
    </div>
    <div>
      © ${year} ${escapeHtml(options.siteName)} · MIT License
    </div>
  </div>
</footer>`;
}

function pageShell(params: {
  title: string;
  description: string;
  canonical: string;
  type?: "website" | "article";
  image?: string;
  bodyClass?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  activeNav?: string;
  content: string;
  options: ReturnType<typeof resolveOptions>;
}): string {
  const jsonLdScript = params.jsonLd
    ? `<script type="application/ld+json">${escapeHtml(JSON.stringify(params.jsonLd))}</script>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    ${renderSeoHead({
      title: params.title,
      description: params.description,
      canonical: params.canonical,
      type: params.type,
      image: params.image,
      siteName: params.options.siteName
    })}
    <style>${baseCss()}</style>
    ${jsonLdScript}
  </head>
  <body${params.bodyClass ? ` class="${escapeAttr(params.bodyClass)}"` : ""}>
    ${renderHeader(params.options, params.activeNav)}
    <main id="main" class="container" tabindex="-1">
      ${params.content}
    </main>
    ${renderFooter(params.options)}
  </body>
</html>`;
}

function tierPill(tier: BadgeTier): string {
  const color = tierColor(tier);
  return `<span class="tier-pill" style="color:${color}" aria-label="Tier ${escapeAttr(tierLabel(tier))}">${escapeHtml(tierLabel(tier))}</span>`;
}

function renderAdapters(adapters: string[]): string {
  if (adapters.length === 0) {
    return `<span class="adapter-chip" style="color:var(--muted)">none</span>`;
  }
  return `<div class="adapters">${adapters
    .map((id) => `<span class="adapter-chip">${escapeHtml(id)}</span>`)
    .join("")}</div>`;
}

export function renderRepoPage(entry: SubmissionPayload, options?: HostedRenderOptions): string {
  const opts = resolveOptions(options);
  const title = entry.attribution
    ? `${entry.attribution.owner}/${entry.attribution.repo}`
    : "anonymous submission";
  const canonical = entry.attribution
    ? `${opts.baseUrl}/r/${encodeURIComponent(entry.attribution.owner)}/${encodeURIComponent(entry.attribution.repo)}.html`
    : `${opts.baseUrl}/r/anonymous.html`;
  const scoreStr = formatScore(entry.summary.score);
  const pct = scorePercent(entry.summary.score);
  const desc =
    `${title} scored ${scoreStr} (${tierLabel(entry.summary.badge)}) across ` +
    `${entry.summary.agents} agent${entry.summary.agents === 1 ? "" : "s"}` +
    ` on ${opts.siteName}.`;
  const repoGithub = entry.attribution
    ? `https://github.com/${entry.attribution.owner}/${entry.attribution.repo}`
    : null;
  const badgeUrl = entry.attribution
    ? `${opts.baseUrl}/badge/${encodeURIComponent(entry.attribution.owner)}/${encodeURIComponent(entry.attribution.repo)}.json`
    : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: title,
    description: desc,
    url: canonical,
    ...(repoGithub ? { codeRepository: repoGithub } : {}),
    ...(entry.attribution?.homepage ? { sameAs: [entry.attribution.homepage] } : {}),
    programmingLanguage: "Markdown",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: scoreStr,
      bestRating: "1.0",
      worstRating: "0.0",
      ratingCount: entry.summary.agents || 1
    }
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${opts.baseUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Leaderboard",
        item: `${opts.baseUrl}/leaderboard`
      },
      { "@type": "ListItem", position: 3, name: title, item: canonical }
    ]
  };

  const content = `
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><a href="${sitePath(opts, "/")}">Home</a></li>
          <li><a href="${sitePath(opts, "/leaderboard")}">Leaderboard</a></li>
          <li>${escapeHtml(title)}</li>
        </ol>
      </nav>
      <p class="eyebrow">Repository report · ${escapeHtml(entry.source_mode)}</p>
      <h1 class="display">${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(desc)}</p>
      <div class="actions">
        ${repoGithub ? `<a class="btn" href="${escapeAttr(repoGithub)}" rel="noopener">View on GitHub</a>` : ""}
        ${badgeUrl ? `<a class="btn btn--ghost" href="${escapeAttr(badgeUrl)}">Badge JSON</a>` : ""}
        <a class="btn btn--ghost" href="${escapeAttr(opts.repoUrl)}" rel="noopener">About ${escapeHtml(opts.siteName)}</a>
      </div>

      <section aria-labelledby="score-head" class="score-hero">
        <div>
          <p class="score-hero__label" id="score-head">Overall score</p>
          <p class="score-hero__number">${escapeHtml(scoreStr)}</p>
          <div style="margin-top:1rem">${tierPill(entry.summary.badge)}</div>
        </div>
        <div class="score-hero__aside">
          <div>
            <p class="score-hero__label">Quality meter</p>
            <div class="meter" role="img" aria-label="Score ${escapeAttr(scoreStr)} of 1.0">
              <div class="meter__fill" style="width:${pct}%;background:${tierColor(entry.summary.badge)}"></div>
            </div>
            <div class="meter__marks"><span>0.00</span><span>0.55</span><span>0.75</span><span>0.90</span><span>1.00</span></div>
          </div>
          <p style="font-size:.88rem;color:var(--muted);margin:0">
            Tiers: experimental &lt; 0.55 · usable ≥ 0.55 · strong ≥ 0.75 · certified ≥ 0.90
          </p>
        </div>
      </section>

      <section aria-label="Summary statistics" class="grid">
        <div class="stat">
          <p class="stat__label">Agents evaluated</p>
          <p class="stat__value">${entry.summary.agents}</p>
          <p class="stat__hint">Markdown agents discovered and scored.</p>
        </div>
        <div class="stat">
          <p class="stat__label">Static checks</p>
          <p class="stat__value">${entry.summary.static_cases}</p>
          <p class="stat__hint">Quality heuristics across 9 dimensions.</p>
        </div>
        <div class="stat">
          <p class="stat__label">Runtime cases</p>
          <p class="stat__value">${entry.summary.runtime_cases}</p>
          <p class="stat__hint">Assertion tests on replayed or live output.</p>
        </div>
      </section>

      <h2 class="display">Adapters detected</h2>
      <p style="color:var(--muted);margin:0 0 1rem">Formats auto-detected in this repository.</p>
      ${renderAdapters(entry.adapters)}

      ${entry.attribution?.description ? `<hr class="rule" /><h2 class="display">About</h2><p class="lede">${escapeHtml(entry.attribution.description)}</p>` : ""}

      <hr class="rule" />
      <h2 class="display">Embed your badge</h2>
      <p>Show your current tier on your README. Replace with your repo path.</p>
      <pre class="code-block"><span class="c"># Markdown</span>
![subagent-evals](${opts.baseUrl}/badge/${entry.attribution ? `${escapeHtml(entry.attribution.owner)}/${escapeHtml(entry.attribution.repo)}` : "&lt;owner&gt;/&lt;repo&gt;"}.svg)</pre>
  `;

  return pageShell({
    title: `${title} — ${formatScore(entry.summary.score)} · ${tierLabel(entry.summary.badge)} · ${opts.siteName}`,
    description: desc,
    canonical,
    type: "article",
    jsonLd: [jsonLd, breadcrumbLd],
    activeNav: "repo",
    content,
    options: opts
  });
}

export function renderLeaderboardPage(
  entries: HostedRepoEntry[] | SubmissionPayload[],
  options?: HostedRenderOptions
): string {
  const opts = resolveOptions(options);
  const normalized: HostedRepoEntry[] = entries.every((item) => "id" in item)
    ? (entries as HostedRepoEntry[])
    : buildLeaderboard(entries as SubmissionPayload[]);
  const canonical = `${opts.baseUrl}/leaderboard`;
  const topScore = normalized[0]?.summary.score ?? 0;
  const desc = normalized.length
    ? `Top-scoring AI coding agent repositories on ${opts.siteName}. Leader: ${
        normalized[0]?.id ?? ""
      } at ${formatScore(topScore)}.`
    : `The public leaderboard for AI coding agent repositories evaluated by ${opts.siteName}.`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: normalized.length,
    itemListElement: normalized.slice(0, 50).map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.id,
      url: `${opts.baseUrl}/r/${encodeURIComponent(
        entry.attribution?.owner ?? ""
      )}/${encodeURIComponent(entry.attribution?.repo ?? "")}.html`
    }))
  };

  const rows = normalized
    .map(
      (entry, index) => `
        <tr>
          <td class="rank">${String(index + 1).padStart(2, "0")}</td>
          <td class="repo">
            <a href="${sitePath(
              opts,
              `/r/${encodeURIComponent(entry.attribution?.owner ?? "")}/${encodeURIComponent(
                entry.attribution?.repo ?? ""
              )}.html`
            )}">${escapeHtml(entry.id)}</a>
          </td>
          <td>${tierPill(entry.summary.badge)}</td>
          <td>${renderAdapters(entry.adapters)}</td>
          <td class="score" style="color:${tierColor(entry.summary.badge)}">${escapeHtml(
            formatScore(entry.summary.score)
          )}</td>
        </tr>`
    )
    .join("");

  const body = normalized.length
    ? `<table class="table" aria-label="Ranked repositories">
        <thead>
          <tr>
            <th scope="col" aria-label="Rank">#</th>
            <th scope="col">Repository</th>
            <th scope="col">Tier</th>
            <th scope="col">Adapters</th>
            <th scope="col" style="text-align:right">Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<div class="empty-state">
        <p style="margin:0 0 .5rem;font-family:var(--serif);font-size:1.25rem;color:var(--ink)">No public submissions yet.</p>
        <p style="margin:0">Run <span class="code">npx subagent-evals submit --public</span> to claim a spot.</p>
      </div>`;

  const content = `
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><a href="${sitePath(opts, "/")}">Home</a></li>
          <li>Leaderboard</li>
        </ol>
      </nav>
      <p class="eyebrow">Public rankings</p>
      <h1 class="display">Leaderboard</h1>
      <p class="lede">The highest-scoring AI coding agent repositories, ranked by overall subagent-evals score. Public submissions only.</p>
      ${body}
      <p style="color:var(--muted);font-size:.85rem;margin-top:2rem">
        Data generated ${escapeHtml(opts.generatedAt)}.
        <a href="${sitePath(opts, "/leaderboard.json")}">View as JSON</a>.
      </p>
  `;

  return pageShell({
    title: `Leaderboard — ${opts.siteName}`,
    description: desc,
    canonical,
    jsonLd: itemList,
    activeNav: "leaderboard",
    content,
    options: opts
  });
}

export function renderIndexPage(
  entries: HostedRepoEntry[] | SubmissionPayload[],
  options?: HostedRenderOptions
): string {
  const opts = resolveOptions(options);
  const normalized: HostedRepoEntry[] = entries.every((item) => "id" in item)
    ? (entries as HostedRepoEntry[])
    : buildLeaderboard(entries as SubmissionPayload[]);
  const canonical = `${opts.baseUrl}/`;
  const top = normalized.slice(0, 5);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: opts.siteName,
    url: canonical,
    description: opts.tagline,
    potentialAction: {
      "@type": "SearchAction",
      target: `${opts.baseUrl}/leaderboard?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.siteName,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    url: opts.repoUrl,
    description: opts.tagline,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
  };

  const topList = top.length
    ? `<table class="table" aria-label="Top repositories">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Repository</th>
            <th scope="col">Tier</th>
            <th scope="col" style="text-align:right">Score</th>
          </tr>
        </thead>
        <tbody>${top
          .map(
            (entry, index) => `
          <tr>
            <td class="rank">${String(index + 1).padStart(2, "0")}</td>
            <td class="repo"><a href="${sitePath(
              opts,
              `/r/${encodeURIComponent(entry.attribution?.owner ?? "")}/${encodeURIComponent(
                entry.attribution?.repo ?? ""
              )}.html`
            )}">${escapeHtml(entry.id)}</a></td>
            <td>${tierPill(entry.summary.badge)}</td>
            <td class="score" style="color:${tierColor(
              entry.summary.badge
            )}">${escapeHtml(formatScore(entry.summary.score))}</td>
          </tr>`
          )
          .join("")}</tbody>
      </table>`
    : `<div class="empty-state">
        <p style="margin:0 0 .5rem;font-family:var(--serif);font-size:1.25rem;color:var(--ink)">No public submissions yet.</p>
        <p style="margin:0">Be the first — run <span class="code">node packages/cli/dist/bin/subagent-evals.js submit --public</span>.</p>
      </div>`;

  const content = `
      <p class="eyebrow">Open-source agent quality index</p>
      <h1 class="display">${escapeHtml(opts.tagline)}</h1>
      <p class="lede">Lint, eval, score, and ship markdown-defined agents for Claude Code, Codex, GitHub Copilot, Cursor, and Windsurf. Zero config. Deterministic replay. Public leaderboard.</p>
      <div class="actions">
        <a class="btn" href="${escapeAttr(opts.repoUrl)}" rel="noopener">Star on GitHub</a>
        <a class="btn btn--ghost" href="${sitePath(opts, "/leaderboard")}">View leaderboard</a>
        <a class="btn btn--ghost" href="${escapeAttr(opts.repoUrl)}#quickstart" rel="noopener">Quickstart</a>
      </div>

      <section aria-label="Install">
        <pre class="code-block"><span class="c"># Local CLI usage (npm publish pending)</span>
node packages/cli/dist/bin/subagent-evals.js lint .

<span class="c"># Public submission to the leaderboard</span>
node packages/cli/dist/bin/subagent-evals.js submit --public --owner you --repo your-repo</pre>
      </section>

      <section aria-label="Value props" class="grid">
        <div class="stat">
          <p class="stat__label">Static</p>
          <p class="stat__value" style="font-size:1.35rem;line-height:1.3">Nine quality dimensions</p>
          <p class="stat__hint">Trigger clarity, tool policy, adversarial resilience, secret handling, and more.</p>
        </div>
        <div class="stat">
          <p class="stat__label">Runtime</p>
          <p class="stat__value" style="font-size:1.35rem;line-height:1.3">Replay by default</p>
          <p class="stat__hint">Deterministic CI. Opt-in live runs against Claude, OpenAI, and Anthropic runners.</p>
        </div>
        <div class="stat">
          <p class="stat__label">Distribution</p>
          <p class="stat__value" style="font-size:1.35rem;line-height:1.3">PR badges + diffs</p>
          <p class="stat__hint">GitHub Action posts sticky PR comments with score deltas and new findings.</p>
        </div>
      </section>

      <h2 class="display">Top public repositories</h2>
      <p style="color:var(--muted);margin:0 0 1rem">Ranked by overall score. Updated on every submission.</p>
      ${topList}
      ${normalized.length > 5 ? `<p style="margin-top:1rem"><a href="${sitePath(opts, "/leaderboard")}">See the full leaderboard →</a></p>` : ""}

      <hr class="rule" />
      <h2 class="display">Supported formats</h2>
      <div class="grid">
        <div class="stat"><p class="stat__label">Claude Code</p><p class="stat__value" style="font-size:1rem;font-family:var(--mono)">.claude/agents/*.md</p></div>
        <div class="stat"><p class="stat__label">OpenAI Codex</p><p class="stat__value" style="font-size:1rem;font-family:var(--mono)">.codex/agents · AGENTS.md</p></div>
        <div class="stat"><p class="stat__label">GitHub Copilot</p><p class="stat__value" style="font-size:1rem;font-family:var(--mono)">.github/copilot-instructions.md</p></div>
        <div class="stat"><p class="stat__label">Cursor</p><p class="stat__value" style="font-size:1rem;font-family:var(--mono)">.cursor/rules/*.mdc</p></div>
        <div class="stat"><p class="stat__label">Windsurf</p><p class="stat__value" style="font-size:1rem;font-family:var(--mono)">.windsurf/rules/*.md</p></div>
        <div class="stat"><p class="stat__label">Generic</p><p class="stat__value" style="font-size:1rem;font-family:var(--mono)">YAML frontmatter *.md</p></div>
      </div>
  `;

  return pageShell({
    title: `${opts.siteName} — ${opts.tagline}`,
    description: `${opts.tagline} Deterministic evals, scoring, and public leaderboard for AI coding agents.`,
    canonical,
    jsonLd: [websiteLd, orgLd],
    activeNav: "home",
    content,
    options: opts
  });
}

export function renderRobotsTxt(options?: HostedRenderOptions): string {
  const opts = resolveOptions(options);
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${opts.baseUrl}/sitemap.xml\n`;
}

export function renderSitemap(
  entries: HostedRepoEntry[] | SubmissionPayload[],
  options?: HostedRenderOptions
): string {
  const opts = resolveOptions(options);
  const normalized: HostedRepoEntry[] = entries.every((item) => "id" in item)
    ? (entries as HostedRepoEntry[])
    : buildLeaderboard(entries as SubmissionPayload[]);
  const lastmod = new Date(opts.generatedAt).toISOString();
  const urls = [
    { loc: `${opts.baseUrl}/`, priority: "1.0", changefreq: "daily" },
    { loc: `${opts.baseUrl}/leaderboard`, priority: "0.9", changefreq: "daily" },
    ...normalized
      .filter((entry) => entry.attribution)
      .map((entry) => ({
        loc: `${opts.baseUrl}/r/${encodeURIComponent(
          entry.attribution?.owner ?? ""
        )}/${encodeURIComponent(entry.attribution?.repo ?? "")}.html`,
        priority: "0.7",
        changefreq: "weekly"
      }))
  ];
  const body = urls
    .map(
      (url) =>
        `  <url><loc>${escapeHtml(url.loc)}</loc><lastmod>${escapeHtml(
          lastmod
        )}</lastmod><changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
