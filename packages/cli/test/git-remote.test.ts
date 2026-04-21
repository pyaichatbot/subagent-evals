import { describe, expect, it } from "vitest";
import { parseRemoteUrl } from "../src/git-remote.js";

describe("parseRemoteUrl", () => {
  it("parses github SSH remote", () => {
    expect(parseRemoteUrl("git@github.com:owner/repo.git")).toEqual({
      platform: "github",
      host: "github.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("parses github HTTPS remote", () => {
    expect(parseRemoteUrl("https://github.com/owner/repo.git")).toEqual({
      platform: "github",
      host: "github.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("parses github HTTPS remote without .git", () => {
    expect(parseRemoteUrl("https://github.com/owner/repo")).toEqual({
      platform: "github",
      host: "github.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("parses gitlab.com SSH remote", () => {
    expect(parseRemoteUrl("git@gitlab.com:owner/repo.git")).toEqual({
      platform: "gitlab",
      host: "gitlab.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("parses gitlab.com HTTPS remote", () => {
    expect(parseRemoteUrl("https://gitlab.com/owner/repo.git")).toEqual({
      platform: "gitlab",
      host: "gitlab.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("parses self-hosted gitlab HTTPS remote", () => {
    expect(parseRemoteUrl("https://git.mycompany.com/owner/repo.git")).toEqual({
      platform: "gitlab",
      host: "git.mycompany.com",
      owner: "owner",
      repo: "repo"
    });
  });

  it("returns null for unrecognized remote", () => {
    expect(parseRemoteUrl("not-a-url")).toBeNull();
  });

  it("strips subgroups — takes last two path segments as owner/repo", () => {
    expect(parseRemoteUrl("https://gitlab.com/group/subgroup/repo.git")).toEqual({
      platform: "gitlab",
      host: "gitlab.com",
      owner: "subgroup",
      repo: "repo"
    });
  });
});
