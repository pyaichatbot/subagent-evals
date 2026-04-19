import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

import {
  buildLeaderboard,
  renderIndexPage,
  renderLeaderboardPage,
  renderRepoPage,
  renderRobotsTxt,
  renderSitemap,
  validateSubmissionPayload
} from "../../packages/hosted/dist/index.js";

const root = resolve(process.cwd(), "apps/hosted/data");
const submissionsDir = join(root, "submissions");
const pagesDir = join(root, "pages");
const crawlQueuePath = join(root, "crawl-queue.json");
const registryPath = join(root, "registry.json");
const MAX_BODY_BYTES = 1024 * 1024;
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("content-type", contentType);
  res.end(body);
}

function readJsonBody(req, res) {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        sendText(res, 413, "payload too large");
        req.destroy();
        reject(new Error("payload too large"));
        return;
      }
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolvePromise(JSON.parse(body || "{}"));
      } catch (error) {
        sendText(res, 400, "invalid json");
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function safeRepoPath(owner, repo, extension) {
  if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo)) {
    throw new Error("invalid owner or repo");
  }
  const ownerDir = resolve(pagesDir, owner);
  const repoPath = resolve(ownerDir, `${repo}.${extension}`);
  if (!ownerDir.startsWith(resolve(pagesDir)) || !repoPath.startsWith(ownerDir)) {
    throw new Error("unsafe repo path");
  }
  return { ownerDir, repoPath };
}

async function loadSubmissions() {
  await ensureDir(submissionsDir);
  const files = existsSync(submissionsDir) ? await (await import("node:fs/promises")).readdir(submissionsDir) : [];
  const items = [];
  for (const file of files) {
    if (file.endsWith(".json")) {
      items.push(JSON.parse(await readFile(join(submissionsDir, file), "utf8")));
    }
  }
  return items;
}

async function persistSite() {
  const submissions = await loadSubmissions();
  const leaderboard = buildLeaderboard(submissions);
  await ensureDir(pagesDir);
  await writeFile(join(root, "leaderboard.json"), JSON.stringify(leaderboard, null, 2), "utf8");
  const registry = submissions.filter((item) => item.attribution);
  await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf8");
  for (const item of registry) {
    const { ownerDir, repoPath: jsonPath } = safeRepoPath(
      item.attribution.owner,
      item.attribution.repo,
      "json"
    );
    const { repoPath: htmlPath } = safeRepoPath(
      item.attribution.owner,
      item.attribution.repo,
      "html"
    );
    await ensureDir(ownerDir);
    await writeFile(jsonPath, JSON.stringify(item, null, 2), "utf8");
    await writeFile(htmlPath, renderRepoPage(item), "utf8");
  }
  await writeFile(join(pagesDir, "index.html"), renderIndexPage(leaderboard), "utf8");
  await writeFile(
    join(pagesDir, "leaderboard.html"),
    renderLeaderboardPage(leaderboard),
    "utf8"
  );
  await writeFile(join(pagesDir, "robots.txt"), renderRobotsTxt(), "utf8");
  await writeFile(join(pagesDir, "sitemap.xml"), renderSitemap(leaderboard), "utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "POST" && url.pathname === "/api/submit") {
    try {
      const payload = await readJsonBody(req, res);
      if (!validateSubmissionPayload(payload)) {
        sendText(res, 400, "invalid submission payload");
        return;
      }
      await ensureDir(submissionsDir);
      const repoId = payload.attribution
        ? `${payload.attribution.owner}-${payload.attribution.repo}`
        : createHash("sha256").update(JSON.stringify(payload)).digest("hex");
      await writeFile(join(submissionsDir, `${repoId}.json`), JSON.stringify(payload, null, 2), "utf8");
      await persistSite();
      sendText(res, 200, "ok");
    } catch (error) {
      if (!res.headersSent) {
        sendText(res, 400, "invalid request");
      }
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/crawl/enqueue") {
    try {
      const payload = await readJsonBody(req, res);
      const queue = existsSync(crawlQueuePath)
        ? JSON.parse(await readFile(crawlQueuePath, "utf8"))
        : [];
      queue.push(payload);
      await writeFile(crawlQueuePath, JSON.stringify(queue, null, 2), "utf8");
      sendText(res, 200, "queued");
    } catch (error) {
      if (!res.headersSent) {
        sendText(res, 400, "invalid request");
      }
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const indexPath = join(pagesDir, "index.html");
    sendText(
      res,
      200,
      existsSync(indexPath)
        ? await readFile(indexPath, "utf8")
        : renderIndexPage([]),
      "text/html; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/leaderboard") {
    const lbPath = join(pagesDir, "leaderboard.html");
    sendText(
      res,
      200,
      existsSync(lbPath)
        ? await readFile(lbPath, "utf8")
        : renderLeaderboardPage([]),
      "text/html; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/robots.txt") {
    const robotsPath = join(pagesDir, "robots.txt");
    sendText(
      res,
      200,
      existsSync(robotsPath) ? await readFile(robotsPath, "utf8") : renderRobotsTxt(),
      "text/plain; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/sitemap.xml") {
    const sitemapPath = join(pagesDir, "sitemap.xml");
    sendText(
      res,
      200,
      existsSync(sitemapPath) ? await readFile(sitemapPath, "utf8") : renderSitemap([]),
      "application/xml; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/leaderboard.json") {
    sendText(
      res,
      200,
      existsSync(join(root, "leaderboard.json"))
        ? await readFile(join(root, "leaderboard.json"), "utf8")
        : "[]",
      "application/json; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/registry.json") {
    sendText(
      res,
      200,
      existsSync(registryPath) ? await readFile(registryPath, "utf8") : "[]",
      "application/json; charset=utf-8"
    );
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/r/")) {
    const [, , owner, repoFile] = url.pathname.split("/");
    if (!owner || !repoFile) {
      sendText(res, 404, "not found");
      return;
    }
    if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(basename(repoFile))) {
      sendText(res, 400, "invalid path");
      return;
    }
    const file = resolve(pagesDir, owner, basename(repoFile));
    if (!file.startsWith(resolve(pagesDir, owner))) {
      sendText(res, 400, "invalid path");
      return;
    }
    if (!existsSync(file)) {
      sendText(res, 404, "not found");
      return;
    }
    sendText(
      res,
      200,
      await readFile(file, "utf8"),
      file.endsWith(".json") ? "application/json; charset=utf-8" : "text/html; charset=utf-8"
    );
    return;
  }

  sendText(res, 404, "not found");
});

server.listen(4317, () => {
  console.log("subagent-evals hosted scaffold listening on http://127.0.0.1:4317");
});
