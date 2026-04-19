import { existsSync } from "node:fs";
import { resolve } from "node:path";

import fg from "fast-glob";

import type { DiscoveredAgent } from "../index.js";

export async function discoverCursorAgents(input: {
  cwd: string;
  roots: string[];
}): Promise<DiscoveredAgent[]> {
  const results: DiscoveredAgent[] = [];

  for (const root of input.roots) {
    const absoluteRoot = resolve(input.cwd, root);
    const rulesDir = resolve(absoluteRoot, ".cursor/rules");
    if (!existsSync(rulesDir)) {
      continue;
    }
    const paths = await fg("**/*.mdc", { cwd: rulesDir, absolute: true });
    results.push(
      ...paths.map((path) => ({
        path,
        format_adapter_id: "cursor-rules" as const
      }))
    );
  }

  return results;
}
