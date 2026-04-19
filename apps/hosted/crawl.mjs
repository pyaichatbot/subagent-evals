import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { discoverSupportedAgentPaths } from "../../packages/hosted/dist/index.js";

const input = resolve(process.argv[2] ?? "apps/hosted/data/repo-tree.json");
const output = resolve(process.argv[3] ?? "apps/hosted/data/crawl-output.json");

const paths = JSON.parse(await readFile(input, "utf8"));
const discovered = discoverSupportedAgentPaths(paths);
await writeFile(output, JSON.stringify({ discovered }, null, 2), "utf8");
console.log(`discovered ${discovered.length} supported agent paths`);
