import { relative } from "node:path";

import { discoverCodexAgents } from "./codex-md.js";
import { discoverCopilotAgents } from "./copilot-instructions.js";
import { discoverCursorAgents } from "./cursor-rules.js";
import { discoverWindsurfAgents } from "./windsurf-config.js";
import { discoverAgents } from "../index.js";

import type { DiscoveredAgent } from "../index.js";

export async function discoverAutoAgents(input: {
  cwd: string;
  roots: string[];
  globs?: string[] | undefined;
}): Promise<DiscoveredAgent[]> {
  const [claudeAgents, codexAgents, copilotAgents, cursorAgents, windsurfAgents] =
    await Promise.all([
      discoverAgents({ ...input, format: "claude-md" }),
      discoverCodexAgents(input),
      discoverCopilotAgents(input),
      discoverCursorAgents(input),
      discoverWindsurfAgents(input)
    ]);

  const allAgents = [
    ...claudeAgents,
    ...codexAgents,
    ...copilotAgents,
    ...cursorAgents,
    ...windsurfAgents
  ];

  const activeAdapters = new Set(allAgents.map((agent) => agent.format_adapter_id));
  if (activeAdapters.size >= 3) {
    process.stderr.write(
      `[subagent-evals] Warning: 3 or more agent formats detected (${[...activeAdapters]
        .sort()
        .join(", ")}). Set discovery.dedup: true and discovery.primary to suppress duplicates.\n`
    );
  }

  return allAgents.map((agent) => ({
    ...agent,
    id_override: buildQualifiedId(agent, input.cwd)
  }));
}

function buildQualifiedId(agent: DiscoveredAgent, cwd: string): string {
  const rel = relative(cwd, agent.path).replaceAll("\\", "/");
  const base = `${agent.format_adapter_id}:${rel}`;
  return agent.section !== undefined ? `${base}#${agent.section}` : base;
}
