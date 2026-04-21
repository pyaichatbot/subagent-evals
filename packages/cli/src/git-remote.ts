import { execFileSync } from "node:child_process";

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
    host = sshMatch[1]!;
    pathPart = sshMatch[2]!;
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
  const segments = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length < 2) return null;

  const repo = segments[segments.length - 1]!;
  const owner = segments[segments.length - 2]!;

  const platform: "github" | "gitlab" = host === "github.com" ? "github" : "gitlab";

  return { platform, host, owner, repo };
}

export function getGitRemoteUrl(cwd: string): string | null {
  try {
    return execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    }).trim();
  } catch {
    return null;
  }
}

export function getGitBranch(cwd: string): string {
  try {
    return execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    }).trim();
  } catch {
    try {
      const ref = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000
      }).trim();
      return ref === "HEAD" ? "main" : ref;
    } catch {
      return "main";
    }
  }
}

export function buildBadgeUrl(
  info: RemoteInfo,
  branch: string,
  gitlabUrl?: string
): string {
  const filename = "subagent-evals-badge.json";
  const encodedOwner = encodeURIComponent(info.owner);
  const encodedRepo = encodeURIComponent(info.repo);
  const encodedBranch = encodeURIComponent(branch);
  let rawUrl: string;

  if (info.platform === "github") {
    rawUrl = `https://raw.githubusercontent.com/${encodedOwner}/${encodedRepo}/${encodedBranch}/${filename}`;
  } else {
    const base = (gitlabUrl ?? `https://${info.host}`).replace(/\/$/, "");
    rawUrl = `${base}/${encodedOwner}/${encodedRepo}/-/raw/${encodedBranch}/${filename}`;
  }

  return `https://img.shields.io/endpoint?url=${encodeURIComponent(rawUrl)}`;
}
