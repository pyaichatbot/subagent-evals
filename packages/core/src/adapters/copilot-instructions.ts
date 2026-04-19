import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { DiscoveredAgent } from "../index.js";
import { extractAgentSections } from "./shared.js";

export async function discoverCopilotAgents(input: {
  cwd: string;
  roots: string[];
}): Promise<DiscoveredAgent[]> {
  const results: DiscoveredAgent[] = [];

  for (const root of input.roots) {
    const absoluteRoot = resolve(input.cwd, root);
    const instructionsPath = resolve(absoluteRoot, ".github/copilot-instructions.md");
    if (!existsSync(instructionsPath)) {
      continue;
    }

    const body = await readFile(instructionsPath, "utf8");
    const sections = extractAgentSections(body);
    if (sections.length > 0) {
      results.push(
        ...sections.map(({ heading, content }) => ({
          path: instructionsPath,
          format_adapter_id: "copilot-instructions" as const,
          body: content,
          section: heading
        }))
      );
    }
  }

  return results;
}
