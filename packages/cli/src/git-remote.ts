import { execSync } from "node:child_process";

export interface RemoteInfo {
  platform: "github" | "gitlab";
  host: string;
  owner: string;
  repo: string;
}

export function parseRemoteUrl(url: string): RemoteInfo | null {
  let host: string;
  let pathPart: string;

  const sshMatch = url.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    host = sshMatch[1];
    pathPart = sshMatch[2];
  } else {
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      pathPart = parsed.pathname.replace(/^\//, "");
    } catch {
      return null;
    }
  }

  if (!host || !pathPart) return null;

  pathPart = pathPart.replace(/\.git$/, "");
  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const repo = segments[segments.length - 1];
  const owner = segments[segments.length - 2];

  const platform: "github" | "gitlab" = host === "github.com" ? "github" : "gitlab";

  return { platform, host, owner, repo };
}

export function getGitRemoteUrl(cwd: string): string | null {
  try {
    return execSync("git remote get-url origin", { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function getGitBranch(cwd: string): string {
  try {
    return execSync("git symbolic-ref --short HEAD", { cwd, encoding: "utf8" }).trim();
  } catch {
    return "main";
  }
}

export function buildBadgeUrl(
  info: RemoteInfo,
  branch: string,
  gitlabUrl?: string
): string {
  const filename = "subagent-evals-badge.json";
  let rawUrl: string;

  if (info.platform === "github") {
    rawUrl = `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${branch}/${filename}`;
  } else {
    const base = (gitlabUrl ?? `https://${info.host}`).replace(/\/$/, "");
    rawUrl = `${base}/${info.owner}/${info.repo}/-/raw/${branch}/${filename}`;
  }

  return `https://img.shields.io/endpoint?url=${encodeURIComponent(rawUrl)}`;
}
