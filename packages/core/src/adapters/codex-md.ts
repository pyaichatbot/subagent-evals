import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import fg from "fast-glob";

import type { DiscoveredAgent } from "../index.js";
import { extractAgentSections } from "./shared.js";

export async function discoverCodexAgents(input: {
  cwd: string;
  roots: string[];
}): Promise<DiscoveredAgent[]> {
  const results: DiscoveredAgent[] = [];

  for (const root of input.roots) {
    const absoluteRoot = resolve(input.cwd, root);

    const agentsDir = resolve(absoluteRoot, ".codex/agents");
    if (existsSync(agentsDir)) {
      const paths = await fg("**/*.md", { cwd: agentsDir, absolute: true });
      results.push(
        ...paths.map((path) => ({
          path,
          format_adapter_id: "codex-md" as const
        }))
      );
    }

    const agentsMd = resolve(absoluteRoot, "AGENTS.md");
    if (existsSync(agentsMd)) {
      const body = await readFile(agentsMd, "utf8");
      const sections = extractAgentSections(body);
      results.push(
        ...sections.map(({ heading, content }) => ({
          path: agentsMd,
          format_adapter_id: "codex-md" as const,
          body: content,
          section: heading
        }))
      );
    }
  }

  return results;
}
