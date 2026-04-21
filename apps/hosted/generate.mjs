import { mkdir, readFile, readdir, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  buildLeaderboard,
  renderIndexPage,
  renderLeaderboardPage,
  renderRepoPage,
  renderRobotsTxt,
  renderSitemap,
  renderStateOfAgentsPage
} from "../../packages/hosted/dist/index.js";

const repoRoot = resolve(process.cwd());
const root = resolve(repoRoot, "apps/hosted/data");
const submissionsDir = join(root, "submissions");
const pagesDir = join(root, "pages");
const registryPath = join(root, "registry.json");

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function loadSubmissions() {
  await ensureDir(submissionsDir);
  const files = existsSync(submissionsDir) ? await readdir(submissionsDir) : [];
  const items = [];
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    items.push(JSON.parse(await readFile(join(submissionsDir, file), 'utf8')));
  }
  return items;
}

function safeSegment(value, label) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`invalid ${label}: ${value}`);
  }
  return value;
}

async function generateSite() {
  const submissions = await loadSubmissions();
  const leaderboard = buildLeaderboard(submissions);
  const registry = submissions.filter((item) => item.attribution);

  await ensureDir(pagesDir);
  await writeFile(join(root, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2), 'utf8');
  await writeFile(join(pagesDir, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2), 'utf8');
  await writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');
  await writeFile(join(pagesDir, 'registry.json'), JSON.stringify(registry, null, 2), 'utf8');

  for (const item of registry) {
    const owner = safeSegment(item.attribution.owner, 'owner');
    const repo = safeSegment(item.attribution.repo, 'repo');
    const ownerDir = join(pagesDir, owner);
    await ensureDir(ownerDir);
    await writeFile(join(ownerDir, `${repo}.json`), JSON.stringify(item, null, 2), 'utf8');
    await writeFile(join(ownerDir, `${repo}.html`), renderRepoPage(item), 'utf8');
  }

  await writeFile(join(pagesDir, 'index.html'), renderIndexPage(leaderboard), 'utf8');
  await writeFile(join(pagesDir, 'leaderboard.html'), renderLeaderboardPage(leaderboard), 'utf8');
  await writeFile(join(pagesDir, 'robots.txt'), renderRobotsTxt(), 'utf8');
  await writeFile(join(pagesDir, 'sitemap.xml'), renderSitemap(leaderboard), 'utf8');
  await writeFile(join(pagesDir, '.nojekyll'), '', 'utf8');

  // State of Agents report page (optional — skipped if data file absent)
  const stateOfAgentsDataPath = join(root, 'state-of-agents.json');
  if (existsSync(stateOfAgentsDataPath)) {
    const stateData = JSON.parse(await readFile(stateOfAgentsDataPath, 'utf8'));
    const stateDir = join(pagesDir, 'state-of-agents');
    await ensureDir(stateDir);
    await writeFile(join(stateDir, 'index.html'), renderStateOfAgentsPage(stateData), 'utf8');
    console.log('Generated state-of-agents/index.html');
  }

  // Copy intro video and cover image if they exist
  const videoDest = join(pagesDir, 'videos');
  await ensureDir(videoDest);
  const videoAssets = ['intro.mp4', 'intro-cover.jpg'];
  for (const asset of videoAssets) {
    const src = join(repoRoot, 'examples/videos', asset);
    if (existsSync(src)) {
      await copyFile(src, join(videoDest, asset));
      console.log(`Copied ${asset} → pages/videos/${asset}`);
    }
  }
}

generateSite().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
